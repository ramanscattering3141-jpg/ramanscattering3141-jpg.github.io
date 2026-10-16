// Fidelity audit: every preset must satisfy the textbook ECG criteria of the diagnosis it
// illustrates, and every number the site displays must be what a careful reader would measure on
// the tracing. Features are measured on the synthesised lead signals (fidelity-helpers.ts), using
// each preset's fixed seed. Units: mV and ms (1 mm = 0.1 mV on standard paper).

import { describe, expect, it } from 'vitest';
import type { LeadId } from '../../src/ecg/engine';
import { ELECTRODE_COEF, LEADS } from '../../src/ecg/engine/leads';
import { classifyRegularity } from '../../src/ecg/engine/measure';
import type { VentEvent } from '../../src/ecg/engine/rhythm';
import type { BeatInfo } from '../../src/ecg/engine/synth';
import { ALL, LIMB, PREC, PRESETS, TWELVE, halfRiseTime, midBeat, pFeatures, qrsDurFromSignal, qrsFeatures, runPreset, signalAxis, valueAt, visBeats } from './fidelity-helpers';

type Pair = ReturnType<typeof runPreset>;
const cache = new Map<string, Pair>();
const get = (id: string): Pair => {
  let v = cache.get(id);
  if (!v) {
    v = runPreset(id);
    cache.set(id, v);
  }
  return v;
};
const C = (id: string) => get(id).clean;
const M = (id: string) => get(id).run.m;
const his = (b: BeatInfo): boolean => b.ev.route === 'his' && b.ev.aberrant === 'none';
const beatOf = (id: string, pred: (b: BeatInfo) => boolean = his): BeatInfo => {
  const b = midBeat(C(id), pred);
  if (!b) throw new Error(`no beat for ${id}`);
  return b;
};
const F = (id: string, l: LeadId, pred?: (b: BeatInfo) => boolean) => qrsFeatures(C(id), beatOf(id, pred), l);
const vs = (id: string): VentEvent[] => C(id).sim.ventricular.filter((v) => v.t >= 0 && v.t < C(id).sim.duration);
const atrial = (id: string) => C(id).sim.atrial.filter((a) => a.t >= 0 && a.t < C(id).sim.duration);
const rrOf = (v: VentEvent[]): number[] => v.slice(1).map((x, i) => x.t - v[i].t);
const prOf = (id: string, v: VentEvent): number => v.t - C(id).sim.atrial[v.atrialIndex].t;
const pOf = (id: string, l: LeadId, pred?: (b: BeatInfo) => boolean) => pFeatures(C(id), beatOf(id, pred).ev.atrialIndex, l);
const mean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;
const ID = Object.keys(PRESETS);

// ---------------------------------------------------------------------------------------------
describe('lead system and measurement formulas', () => {
  it('hexaxial angles and Goldberger gains are standard', () => {
    const want: Record<string, number> = { I: 0, II: 60, III: 120, aVR: -150, aVL: -30, aVF: 90 };
    for (const [l, ang] of Object.entries(want)) {
      const L = LEADS[l as LeadId];
      expect(L.angle).toBe(ang);
      expect(Math.atan2(L.axis[1], L.axis[0]) * (180 / Math.PI)).toBeCloseTo(ang, 6);
      expect(L.gain).toBeCloseTo(l.startsWith('aV') ? Math.sqrt(3) / 2 : 1, 9);
    }
    // Precordial electrodes sweep from right-anterior (V1) to the left mid-axillary line (V6).
    const ang = PREC.map((l) => LEADS[l].angle);
    for (let i = 1; i < ang.length; i++) expect(ang[i]).toBeLessThan(ang[i - 1]);
    expect(ang[0]).toBeGreaterThan(90);
    expect(ang[5]).toBe(0);
  });
  it('lead vectors and electrode coefficients obey Einthoven (I + III = II) and Goldberger', () => {
    const v = (l: LeadId) => LEADS[l].axis.map((x) => x * LEADS[l].gain);
    const [I, II, III, aVR, aVL, aVF] = LIMB.map(v);
    for (let k = 0; k < 3; k++) {
      expect(I[k] + III[k]).toBeCloseTo(II[k], 9);
      expect(aVR[k] + aVL[k] + aVF[k]).toBeCloseTo(0, 9);
      expect(aVR[k]).toBeCloseTo(-(I[k] + II[k]) / 2, 9);
      expect(aVL[k]).toBeCloseTo(I[k] - II[k] / 2, 9);
      expect(aVF[k]).toBeCloseTo(II[k] - I[k] / 2, 9);
    }
    const e = ELECTRODE_COEF;
    for (let k = 0; k < 3; k++) expect(e.I[k] + e.III[k]).toBe(e.II[k]);
  });
  it.each(ID)('%s: recorded signals obey Einthoven/Goldberger exactly (noise, pacing spikes, cable swaps included)', (id) => {
    const L = get(id).run.sig.leads;
    let err = 0;
    for (let i = 0; i < L.I!.length; i++) {
      err = Math.max(err, Math.abs(L.I![i] + L.III![i] - L.II![i]), Math.abs(L.aVR![i] + L.aVL![i] + L.aVF![i]), Math.abs(L.aVF![i] - (L.II![i] - L.I![i] / 2)));
    }
    expect(err).toBeLessThan(1e-4);
  });
  it.each(ID)('%s: model measurements are independent of recording noise', (id) => {
    expect(get(id).run.m).toEqual(get(id).clean.m);
  });
  it.each(ID)('%s: QTc Bazett and Fridericia come from the same QT and R–R', (id) => {
    const m = M(id);
    if (m.qt === null) return;
    const rrB = (m.qt / m.qtcBazett!) ** 2;
    const rrF = (m.qt / m.qtcFridericia!) ** 3;
    expect(Math.abs(rrB - rrF)).toBeLessThan(0.02 * rrB + 0.01);
  });
  it.each(ID)('%s: QT read-out equals the end of the T wave actually drawn', (id) => {
    for (const b of visBeats(C(id))) expect(b.morph.qt).toBeCloseTo(b.morph.tEnd, 6);
  });
  // Cable reversal and electrode artefact change the RECORDING, not the heart: the read-out reports the
  // heart's true axis (and the reversal tests below check what the tracing shows).
  it.each(ID.filter((id) => !['raLaReversal', 'raLlReversal', 'laLlReversal', 'artifactMotion', 'artifactTremor', 'vf', 'vflutter', 'asystole'].includes(id)))('%s: model axis matches the axis measured from leads I and aVF', (id) => {
    const r = C(id);
    const m = r.m;
    if (m.axis === null) return;
    const dom = r.sig.beats.find((b) => b.ev.t === m.repBeatT)!;
    const d = Math.abs((((signalAxis(r, dom) - m.axis) % 360) + 540) % 360 - 180);
    expect(d).toBeLessThan(15);
  });
  it.each(ID.filter((id) => !['vf', 'vflutter', 'asystole'].includes(id)))('%s: reported QRS duration matches the signal (2.5 % threshold) within 12 ms', (id) => {
    const r = C(id);
    const m = r.m;
    const dom = r.sig.beats.find((b) => b.ev.t === m.repBeatT)!;
    expect(m.qrs).toBe(Math.round(dom.morph.qrsDur));
    expect(Math.abs(qrsDurFromSignal(r, dom) - m.qrs!)).toBeLessThanOrEqual(12);
  });
  it('regularity classifier: phasic ≠ irregularly irregular; ectopy, pauses, group beating and onset are named', () => {
    const f = (rr: number[], prem: boolean[] = rr.map(() => false), chaotic = false, patterned = true) => classifyRegularity(rr, prem, chaotic, patterned).regularity;
    expect(f([800, 805, 798, 802, 801])).toBe('regular');
    expect(f([700, 800, 900, 1000, 900, 800, 700, 800], undefined, false, false)).toBe('irregular');
    expect(f([800, 450, 1150, 800, 805, 800], [false, true, true, false, false, false])).toBe('regular with premature beats');
    expect(f([800, 800, 800, 2600, 800, 800, 800])).toBe('regular with pauses');
    expect(f([900, 900, 1700, 900, 900, 1700, 900, 900])).toBe('regularly irregular');
    expect(f([850, 850, 580, 330, 333, 331, 334, 332, 333, 330], [false, false, true, true, false, false, false, false, false, false])).toBe('regular after abrupt onset');
    expect(f([500, 900, 650, 400, 820], undefined, true)).toBe('irregularly irregular');
  });
});

// ---------------------------------------------------------------------------------------------
describe('sinus rhythms', () => {
  const sinusP = (id: string) => {
    const pI = pOf(id, 'I');
    const pII = pOf(id, 'II');
    const pVF = pOf(id, 'aVF');
    const pR = pOf(id, 'aVR');
    expect(pI.pos, 'P upright in I').toBeGreaterThan(0.04);
    expect(pII.pos, 'P upright in II').toBeGreaterThan(0.08);
    expect(pVF.pos, 'P upright in aVF').toBeGreaterThan(0.05);
    expect(pR.neg, 'P inverted in aVR').toBeLessThan(-0.05);
  };
  it('NSR: rate 60–100, PR 120–200, QRS < 110, normal axis, sinus P, no LAE/RAE, normal voltage', () => {
    const m = M('nsr');
    expect(m.ventRate!).toBeGreaterThanOrEqual(60);
    expect(m.ventRate!).toBeLessThanOrEqual(100);
    expect(m.pr!).toBeGreaterThanOrEqual(120);
    expect(m.pr!).toBeLessThanOrEqual(200);
    expect(m.qrs!).toBeLessThan(110);
    expect(m.axisLabel).toBe('normal');
    expect(m.regularity).toBe('regular');
    expect(m.qtcBazett!).toBeLessThan(450);
    sinusP('nsr');
    expect(pOf('nsr', 'II').pos).toBeLessThan(0.25);
    expect(pOf('nsr', 'II').modelDur).toBeLessThan(120);
    expect(pOf('nsr', 'V1').termNegArea, 'P-terminal force in V1 below LAE threshold').toBeLessThan(0.04);
    const sok = -F('nsr', 'V1').minAll + Math.max(F('nsr', 'V5').r, F('nsr', 'V6').r);
    expect(sok).toBeLessThan(3.5);
    for (const l of TWELVE) expect(Math.abs(F('nsr', l).stJ), l).toBeLessThan(0.05);
  });
  it('sinus bradycardia < 60, sinus tachycardia 100–150, inappropriate sinus tachycardia > 100 — all with sinus P and normal PR', () => {
    expect(M('sinusBrady').ventRate!).toBeLessThan(60);
    expect(M('sinusTach').ventRate!).toBeGreaterThan(100);
    expect(M('sinusTach').ventRate!).toBeLessThanOrEqual(150);
    expect(M('ist').ventRate!).toBeGreaterThan(100);
    for (const id of ['sinusBrady', 'sinusTach', 'ist']) {
      sinusP(id);
      expect(M(id).avRelation).toBe('1:1 AV conduction');
      expect(M(id).pr!).toBeGreaterThanOrEqual(120);
      expect(M(id).pr!).toBeLessThanOrEqual(200);
    }
  });
  it('sinus arrhythmia: identical sinus P, constant PR, phasic P–P variation (irregular, not irregularly irregular)', () => {
    const a = atrial('sinusArrhythmia');
    expect(a.every((x) => x.kind === 'sinus')).toBe(true);
    const pp = a.slice(1).map((x, i) => x.t - a[i].t);
    expect((Math.max(...pp) - Math.min(...pp)) / Math.min(...pp)).toBeGreaterThan(0.15);
    expect(M('sinusArrhythmia').prRange![1] - M('sinusArrhythmia').prRange![0]).toBeLessThan(5);
    expect(M('sinusArrhythmia').regularity).toBe('irregular');
  });
  it('sinus pause: the pause is NOT a multiple of the P–P interval; escape beat narrow', () => {
    const a = atrial('sinusPause').filter((x) => x.kind === 'sinus');
    const pp = a.slice(1).map((x, i) => x.t - a[i].t);
    const base = mean(pp.filter((x) => x < 1000));
    const pause = Math.max(...pp);
    expect(pause / base).toBeGreaterThan(2);
    expect(Math.abs(pause / base - Math.round(pause / base))).toBeGreaterThan(0.1);
    expect(M('sinusPause').regularity).toBe('regular with pauses');
    for (const b of visBeats(C('sinusPause'))) expect(b.morph.qrsDur).toBeLessThan(110);
  });
  it('sinus arrest: junctional escape 40–60/min with narrow QRS takes over', () => {
    const j = vs('sinusArrest').filter((v) => v.junctional);
    expect(j.length).toBeGreaterThan(3);
    const rate = 60000 / mean(rrOf(j));
    expect(rate).toBeGreaterThanOrEqual(40);
    expect(rate).toBeLessThanOrEqual(60);
    expect(M('sinusArrest').ventRate!).toBeGreaterThanOrEqual(40);
    expect(M('sinusArrest').ventRate!).toBeLessThanOrEqual(60);
  });
  it('SA exit block: the pause is exactly two P–P intervals and no escape beat interrupts it', () => {
    const a = atrial('saExitBlock');
    const pp = a.slice(1).map((x, i) => x.t - a[i].t);
    const base = mean(pp.filter((x) => x < 1000));
    const pauses = pp.filter((x) => x > 1000);
    expect(pauses.length).toBeGreaterThan(0);
    for (const p of pauses) expect(Math.abs(p / base - 2)).toBeLessThan(0.1);
    expect(vs('saExitBlock').every((v) => !v.junctional)).toBe(true);
    expect(M('saExitBlock').avRelation).toBe('1:1 AV conduction');
  });
});

// ---------------------------------------------------------------------------------------------
describe('premature beats', () => {
  it('PAC: early P′ of different morphology, conducted, non-compensatory pause', () => {
    const a = atrial('pac');
    const i = a.findIndex((x) => x.kind === 'ectopic' && a.indexOf(x) > 0 && a.indexOf(x) < a.length - 1);
    const pre = a[i - 1];
    const post = a[i + 1];
    const base = mean(a.filter((x) => x.kind === 'sinus').slice(1, 4).map((x, k, arr) => (k ? x.t - arr[k - 1].t : NaN)).filter(Number.isFinite));
    expect(a[i].t - pre.t).toBeLessThan(0.8 * base);
    expect(post.t - pre.t, 'non-compensatory').toBeLessThan(2 * base - 50);
    expect(a[i].site).not.toBe('sinus');
    expect(M('pac').regularity).toBe('regular with premature beats');
    expect(M('pac').qrs!).toBeLessThan(110);
  });
  it('blocked PAC: a premature P′ inside the preceding T wave that is not followed by a QRS', () => {
    const r = C('pacBlocked');
    const blocked = atrial('pacBlocked').filter((x) => x.kind === 'ectopic' && !x.conducted);
    expect(blocked.length).toBeGreaterThan(0);
    for (const p of blocked) {
      const prev = [...r.sig.beats].reverse().find((b) => b.ev.t < p.t)!;
      expect(p.t).toBeGreaterThan(prev.ev.t + prev.morph.tStart);
      expect(p.t).toBeLessThan(prev.ev.t + prev.morph.tEnd);
    }
    expect(vs('pacBlocked').every((v) => v.aberrant === 'none')).toBe(true);
  });
  it('PAC with aberrancy: early PACs conduct with RBBB morphology (QRS ≥ 120, terminal R′ in V1); read-outs describe the narrow sinus beats', () => {
    const r = C('pacAberrant');
    const ab = visBeats(r).filter((b) => b.ev.aberrant === 'rbbb');
    expect(ab.length).toBeGreaterThan(1);
    for (const b of ab) {
      expect(b.morph.qrsDur).toBeGreaterThanOrEqual(120);
      expect(qrsFeatures(r, b, 'V1').rPrime).toBeGreaterThan(0.3);
    }
    expect(M('pacAberrant').qrs!).toBeLessThan(110);
    expect(M('pacAberrant').qtcBazett!).toBeLessThan(450);
  });
  it('PVC: wide (≥ 120), no premature P, discordant T, fully compensatory pause', () => {
    const r = C('pvc');
    const v = vs('pvc');
    const k = v.findIndex((x, i) => x.mechanism === 'pvc' && i > 0 && i < v.length - 1);
    const pre = v[k - 1];
    const post = v[k + 1];
    // Fully compensatory: the sinus node is not reset, so the beats around the PVC are exactly two
    // sinus cycles apart (the P wave in between is blocked).
    const sa = C('pvc').sim.atrial;
    const pPre = sa[pre.atrialIndex];
    const pPost = sa[post.atrialIndex];
    const between = sa.filter((a) => a.t > pPre.t && a.t < pPost.t);
    expect(between.length).toBe(1);
    expect(between[0].conducted).toBe(false);
    expect(Math.abs(post.t - pre.t - (pPost.t - pPre.t))).toBeLessThan(15);
    const pp = mean(atrial('pvc').slice(1).map((x, i) => x.t - atrial('pvc')[i].t));
    expect(Math.abs((post.t - pre.t) / pp - 2)).toBeLessThan(0.1);
    const b = r.sig.beats.find((x) => x.ev === v[k])!;
    expect(b.morph.qrsDur).toBeGreaterThanOrEqual(120);
    expect(v[k].atrialIndex).toBe(-1);
    let disc = 0;
    for (const l of TWELVE) {
      const f = qrsFeatures(r, b, l);
      const main = f.r + f.minAll;
      if (Math.abs(main) > 0.3 && Math.sign(f.tPeak) === -Math.sign(main)) disc++;
    }
    expect(disc).toBeGreaterThanOrEqual(6);
    expect(M('pvc').regularity).toBe('regular with premature beats');
    expect(M('pvc').qrs!).toBeLessThan(110);
    // RVOT origin: LBBB-like (negative V1) with an inferior axis
    expect(qrsFeatures(r, b, 'V1').r).toBeLessThan(-qrsFeatures(r, b, 'V1').minAll);
    for (const l of ['II', 'III', 'aVF'] as LeadId[]) expect(qrsFeatures(r, b, l).r, l).toBeGreaterThan(-qrsFeatures(r, b, l).minAll);
  });
  it('ventricular bigeminy: every sinus beat followed by a PVC at a fixed coupling interval', () => {
    const v = vs('pvcBigeminy');
    let pairs = 0;
    const coup: number[] = [];
    for (let i = 1; i < v.length; i++) if (v[i].mechanism === 'pvc' && v[i - 1].mechanism === 'conducted') {
      pairs++;
      coup.push(v[i].t - v[i - 1].t);
    }
    expect(pairs).toBeGreaterThanOrEqual(4);
    expect(Math.max(...coup) - Math.min(...coup)).toBeLessThan(40);
    for (let i = 1; i < v.length; i++) expect(v[i].mechanism === 'pvc' && v[i - 1].mechanism === 'pvc').toBe(false);
    expect(M('pvcBigeminy').regularity).toBe('regularly irregular');
    expect(M('pvcBigeminy').qrs!).toBeLessThan(110);
  });
  it('interpolated PVC: sandwiched between two sinus beats without a pause', () => {
    const v = vs('pvcInterpolated');
    const sinusRR = mean(rrOf(v.filter((x) => x.mechanism === 'conducted')).filter((x) => x > 1000));
    const k = v.findIndex((x, i) => x.mechanism === 'pvc' && i > 0 && i < v.length - 1);
    expect(Math.abs((v[k + 1].t - v[k - 1].t) / sinusRR - 1)).toBeLessThan(0.1);
  });
  it('PVC couplets are multifocal (two different morphologies)', () => {
    const v = vs('pvcCouplet');
    const k = v.findIndex((x, i) => x.mechanism === 'pvc' && v[i + 1]?.mechanism === 'pvc');
    expect(k).toBeGreaterThan(-1);
    expect(v[k].site).not.toBe(v[k + 1].site);
  });
});

// ---------------------------------------------------------------------------------------------
describe('atrial tachyarrhythmias', () => {
  it('focal AT: 100–250/min, non-sinus P′ (inverted inferiorly from a low RA focus), 1:1, isoelectric baseline', () => {
    const m = M('focalAT');
    expect(m.atrialRate!).toBeGreaterThan(100);
    expect(m.avRelation).toBe('1:1 AV conduction');
    expect(pOf('focalAT', 'II').neg).toBeLessThan(-0.1);
    expect(pOf('focalAT', 'II').pos).toBeLessThan(-pOf('focalAT', 'II').neg);
    expect(C('focalAT').sim.continuous.length).toBe(0);
  });
  it('AT with 2:1 block: atrial rate ≈ 2 × ventricular rate', () => {
    const m = M('atWithBlock');
    expect(m.atrialRate!).toBeGreaterThan(150);
    expect(Math.abs(m.atrialRate! / m.ventRate! - 2)).toBeLessThan(0.1);
    expect(m.conductedFraction).toBeCloseTo(0.5, 1);
  });
  it('MAT: ≥ 3 P-wave morphologies, rate > 100, variable PR, irregularly irregular', () => {
    const sites = new Set(atrial('mat').map((a) => a.site));
    expect(sites.size).toBeGreaterThanOrEqual(3);
    const m = M('mat');
    expect(m.ventRate!).toBeGreaterThan(100);
    expect(m.prRange![1] - m.prRange![0]).toBeGreaterThan(20);
    expect(m.regularity).toBe('irregularly irregular');
  });
  it('typical flutter: ~300/min sawtooth (negative ramp in II); 2:1 → ~150, 4:1 → ~75, variable block varies', () => {
    expect(Math.abs(M('flutter21').atrialRate! - 300)).toBeLessThan(20);
    expect(Math.abs(M('flutter21').ventRate! - 150)).toBeLessThan(10);
    expect(Math.abs(M('flutter41').ventRate! - 75)).toBeLessThan(8);
    expect(M('flutter21').pr).toBeNull();
    // Sawtooth polarity in lead II: the slow limb descends (negative flutter waves).
    const r = C('flutter41');
    const b = beatOf('flutter41');
    let down = 0;
    let tot = 0;
    for (let t = Math.round(b.ev.t + b.morph.tEnd + 20); t < b.ev.t + b.rr - 40 + 400 && t < b.ev.t + 760; t++) {
      tot++;
      if (valueAt(r, 'II', t + 1) < valueAt(r, 'II', t)) down++;
    }
    expect(down / tot).toBeGreaterThan(0.6);
    const ratios = new Set(rrOf(vs('flutterVariable')).map((x) => Math.round(x / 205)));
    expect(ratios.size).toBeGreaterThanOrEqual(2);
    for (const id of ['flutter21', 'flutter41', 'flutterVariable']) expect(M(id).qrs!).toBeLessThan(110);
  });
  it('AF: no P waves, irregularly irregular; controlled < 110/min, RVR > 110/min', () => {
    for (const id of ['af', 'afRvr']) {
      expect(M(id).atrialRate).toBeNull();
      expect(M(id).pr).toBeNull();
      expect(M(id).regularity).toBe('irregularly irregular');
      expect(M(id).rrCV).toBeGreaterThan(0.1);
      expect(M(id).qrs!).toBeLessThan(110);
    }
    expect(M('af').ventRate!).toBeLessThan(110);
    // fibrillatory waves visible in V1 during the T–Q interval
    const r = C('af');
    const b = beatOf('af');
    let lo = Infinity;
    let hi = -Infinity;
    const next = visBeats(r).find((x) => x.ev.t > b.ev.t)!.ev.t;
    for (let t = Math.round(b.ev.t + b.morph.tEnd + 20); t < Math.min(next - 20, b.ev.t + b.morph.tEnd + 220); t++) {
      const v = valueAt(r, 'V1', t);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    expect(hi - lo).toBeGreaterThan(0.03);
    expect(M('afRvr').ventRate!).toBeGreaterThan(110);
  });
});

// ---------------------------------------------------------------------------------------------
describe('junctional and re-entrant rhythms', () => {
  it('junctional escape 40–60, accelerated junctional 60–100, junctional tachycardia > 100 — narrow, no antegrade P, retrograde P inverted in II', () => {
    const range: Record<string, [number, number]> = { junctionalEscape: [40, 60], accelJunctional: [60, 100], junctionalTach: [100, 200] };
    for (const [id, [lo, hi]] of Object.entries(range)) {
      const m = M(id);
      expect(m.ventRate!, id).toBeGreaterThanOrEqual(lo);
      expect(m.ventRate!, id).toBeLessThanOrEqual(hi);
      expect(m.qrs!).toBeLessThan(110);
      expect(m.pr).toBeNull();
      expect(m.avRelation).toMatch(/retrograde P′/);
      const retro = atrial(id).filter((a) => a.kind === 'retro');
      expect(retro.length).toBeGreaterThan(3);
      expect(atrial(id).filter((a) => a.kind !== 'retro').length).toBe(0);
    }
    const b = beatOf('junctionalEscape', (x) => x.ev.junctional);
    const a = C('junctionalEscape').sim.atrial.find((x) => x.kind === 'retro' && x.t > b.ev.t - 50)!;
    expect(pFeatures(C('junctionalEscape'), C('junctionalEscape').sim.atrial.indexOf(a), 'aVF').neg).toBeLessThan(-0.05);
  });
  it('AVNRT: PAC with a PR jump initiates a regular narrow tachycardia 140–250 with RP′ < 70 ms', () => {
    const v = vs('avnrt');
    const prs = v.filter((x) => x.atrialIndex >= 0 && C('avnrt').sim.atrial[x.atrialIndex].kind !== 'retro').map((x) => prOf('avnrt', x));
    expect(Math.max(...prs) - Math.min(...prs), 'PR jump').toBeGreaterThan(60);
    const m = M('avnrt');
    expect(m.regularity).toBe('regular after abrupt onset');
    expect(m.ventRate!).toBeGreaterThanOrEqual(140);
    expect(m.ventRate!).toBeLessThanOrEqual(250);
    expect(Number(m.avRelation.match(/RP′ (\d+)/)![1])).toBeLessThan(70);
    expect(m.qrs!).toBeLessThan(110);
  });
  it('orthodromic AVRT: narrow regular 150–250 with RP′ ≥ 70 ms and RP′ < P′R; manifest pathway pre-excites sinus beats, concealed does not', () => {
    for (const id of ['orthoAvrt', 'concealedAvrt']) {
      const m = M(id);
      expect(m.regularity).toBe('regular after abrupt onset');
      expect(m.ventRate!).toBeGreaterThanOrEqual(150);
      expect(m.ventRate!).toBeLessThanOrEqual(250);
      const rp = Number(m.avRelation.match(/RP′ (\d+)/)![1]);
      expect(rp).toBeGreaterThanOrEqual(70);
      expect(rp).toBeLessThan(60000 / m.ventRate! / 2);
      expect(vs(id).filter((v) => v.t > 4000).every((v) => v.route === 'his')).toBe(true);
    }
    expect(vs('orthoAvrt')[0].route).toBe('ap');
    expect(prOf('orthoAvrt', vs('orthoAvrt')[0])).toBeLessThan(120);
    expect(vs('concealedAvrt')[0].route).toBe('his');
    expect(prOf('concealedAvrt', vs('concealedAvrt')[0])).toBeGreaterThanOrEqual(120);
  });
  it('antidromic AVRT: regular wide-complex tachycardia, fully pre-excited', () => {
    const m = M('antiAvrt');
    expect(m.ventRate!).toBeGreaterThanOrEqual(150);
    expect(m.qrs!).toBeGreaterThanOrEqual(120);
    expect(m.regularity).toBe('regular after abrupt onset');
  });
  it('WPW: PR < 120, slurred delta wave, QRS > 110, PJ < 260, secondary ST–T', () => {
    const m = M('wpw');
    expect(m.pr!).toBeLessThan(120);
    expect(m.qrs!).toBeGreaterThan(110);
    expect(m.pr! + m.qrs!).toBeLessThan(260);
    const b = beatOf('wpw', (x) => x.ev.route === 'ap');
    expect(b.morph.comps.some((c) => /delta/.test(c.tag))).toBe(true);
    // Slurred upstroke: 40 ms into the QRS the heart vector is still small (delta wave), whereas a
    // normally conducted QRS is already near its peak.
    const growth = (id: string, x: BeatInfo): number => {
      const [vx, vy, vz] = C(id).sig.vcg;
      const mag = (t: number) => Math.hypot(vx[Math.round(x.ev.t + t)], vy[Math.round(x.ev.t + t)], vz[Math.round(x.ev.t + t)]);
      let mx = 0;
      for (let t = 0; t < x.morph.qrsDur; t++) mx = Math.max(mx, mag(t));
      return mag(40) / mx;
    };
    expect(growth('wpw', b)).toBeLessThan(0.4);
    expect(growth('nsr', beatOf('nsr'))).toBeGreaterThan(0.6);
    expect(halfRiseTime(C('wpw'), b, 'I')).toBeGreaterThan(halfRiseTime(C('nsr'), beatOf('nsr'), 'I') + 20);
  });
  it('pre-excited AF: irregularly irregular, fast, wide QRS of varying width, occasional narrow beats, no P', () => {
    const r = C('preexAf');
    const m = M('preexAf');
    expect(m.regularity).toBe('irregularly irregular');
    expect(m.ventRate!).toBeGreaterThan(150);
    expect(m.atrialRate).toBeNull();
    const w = visBeats(r).map((b) => b.morph.qrsDur);
    expect(Math.max(...w) - Math.min(...w)).toBeGreaterThan(30);
    expect(w.some((x) => x < 110)).toBe(true);
    expect(Math.min(...rrOf(vs('preexAf')))).toBeLessThan(300);
  });
});

// ---------------------------------------------------------------------------------------------
describe('AV block', () => {
  it('first-degree: PR > 200, constant, every P conducted', () => {
    const m = M('avb1');
    expect(m.pr!).toBeGreaterThan(200);
    expect(m.prRange![1] - m.prRange![0]).toBeLessThan(10);
    expect(m.avRelation).toBe('1:1 AV conduction');
  });
  it('Mobitz I: PR lengthens progressively to a dropped P, shortest PR after the drop, pause < 2 × P–P, R–R shortening, group beating', () => {
    const r = C('mobitz1');
    const a = atrial('mobitz1');
    const groups: number[][] = [];
    let cur: number[] = [];
    for (const p of a) {
      if (!p.conducted) {
        if (cur.length) groups.push(cur);
        cur = [];
        continue;
      }
      const v = r.sim.ventricular.find((x) => x.atrialIndex === r.sim.atrial.indexOf(p))!;
      cur.push(v.t - p.t);
    }
    const full = groups.filter((g, i) => i > 0 && g.length >= 3);
    expect(full.length).toBeGreaterThan(0);
    for (const g of full) {
      for (let i = 1; i < g.length; i++) expect(g[i]).toBeGreaterThan(g[i - 1]);
      // increments decrease (classic Wenckebach)
      expect(g[2] - g[1]).toBeLessThan(g[1] - g[0]);
    }
    const pp = mean(a.slice(1).map((x, i) => x.t - a[i].t));
    const rr = rrOf(vs('mobitz1'));
    expect(Math.max(...rr)).toBeLessThan(2 * pp);
    expect(M('mobitz1').regularity).toBe('regularly irregular');
    expect(M('mobitz1').qrs!).toBeLessThan(110);
  });
  it('Mobitz II: constant PR, sudden dropped P, constant P–P, pause = 2 × P–P, wide QRS', () => {
    const m = M('mobitz2');
    expect(m.prRange![1] - m.prRange![0]).toBeLessThan(5);
    expect(m.conductedFraction).toBeLessThan(1);
    expect(m.qrs!).toBeGreaterThanOrEqual(120);
    const a = atrial('mobitz2');
    const pp = a.slice(1).map((x, i) => x.t - a[i].t);
    const v = vs('mobitz2');
    const sinusPP = mean(pp);
    const pause = Math.max(...rrOf(v));
    expect(Math.abs(pause / sinusPP - 2)).toBeLessThan(0.12);
    expect(m.regularity).toBe('regularly irregular');
  });
  it('2:1 block: every second P blocked, constant PR, atrial rate = 2 × ventricular', () => {
    const a = atrial('avb21');
    for (let i = 1; i < a.length; i++) expect(a[i].conducted).toBe(!a[i - 1].conducted);
    expect(Math.abs(M('avb21').atrialRate! / M('avb21').ventRate! - 2)).toBeLessThan(0.1);
    expect(M('avb21').prRange![1] - M('avb21').prRange![0]).toBeLessThan(5);
  });
  it('high-grade block: ≥ 2 consecutive blocked P, conducted beats with a fixed PR', () => {
    const a = atrial('highGrade');
    let run = 0;
    let maxRun = 0;
    for (const p of a) {
      run = p.conducted ? 0 : run + 1;
      maxRun = Math.max(maxRun, run);
    }
    expect(maxRun).toBeGreaterThanOrEqual(2);
    expect(a.some((p) => p.conducted)).toBe(true);
    expect(M('highGrade').prRange![1] - M('highGrade').prRange![0]).toBeLessThan(5);
  });
  it('complete heart block: AV dissociation, atrial rate > ventricular; junctional escape narrow 40–60, ventricular escape wide 20–40', () => {
    for (const id of ['chbJunctional', 'chbVentricular']) {
      const m = M(id);
      expect(m.conductedFraction).toBe(0);
      expect(m.avRelation).toMatch(/dissociation/);
      expect(m.atrialRate!).toBeGreaterThan(m.ventRate!);
      expect(m.regularity).toBe('regular');
      // P waves march through: no fixed P–QRS relation
      const v = vs(id);
      const a = C(id).sim.atrial;
      const pq = v.map((x) => x.t - [...a].reverse().find((p) => p.t < x.t)!.t);
      expect(Math.max(...pq) - Math.min(...pq)).toBeGreaterThan(150);
    }
    expect(M('chbJunctional').ventRate!).toBeGreaterThanOrEqual(40);
    expect(M('chbJunctional').ventRate!).toBeLessThanOrEqual(60);
    expect(M('chbJunctional').qrs!).toBeLessThan(110);
    expect(M('chbVentricular').ventRate!).toBeLessThanOrEqual(40);
    expect(M('chbVentricular').qrs!).toBeGreaterThanOrEqual(120);
  });
});

// ---------------------------------------------------------------------------------------------
describe('bundle-branch and fascicular block', () => {
  it('RBBB: QRS ≥ 120, rsR′ in V1–V2, wide S in I and V6, secondary STD/TWI in V1–V2', () => {
    expect(M('rbbb').qrs!).toBeGreaterThanOrEqual(120);
    for (const l of ['V1', 'V2'] as LeadId[]) {
      expect(F('rbbb', l).pattern, l).toMatch(/^r[sS]R'/);
      expect(F('rbbb', l).tPeak, l).toBeLessThan(0);
    }
    for (const l of ['I', 'V6'] as LeadId[]) expect(F('rbbb', l).s, l).toBeLessThan(-0.3);
    expect(M('rbbb').axisLabel).toBe('normal');
  });
  it('incomplete RBBB: rsr′ in V1 with QRS 110–119', () => {
    expect(M('incompleteRbbb').qrs!).toBeGreaterThanOrEqual(110);
    expect(M('incompleteRbbb').qrs!).toBeLessThan(120);
    expect(F('incompleteRbbb', 'V1').pattern).toMatch(/^r[sS][rR]'/);
  });
  it('LBBB: QRS ≥ 120, monophasic notched R in I/aVL/V5–V6 without septal q, QS/rS in V1–V3, discordant ST–T', () => {
    expect(M('lbbb').qrs!).toBeGreaterThanOrEqual(120);
    let notched = 0;
    for (const l of ['I', 'aVL', 'V5', 'V6'] as LeadId[]) {
      const f = F('lbbb', l);
      expect(f.pattern, l).toBe('R');
      expect(f.q, l).toBe(0);
      // broad R: the positive deflection occupies most of the (wide) QRS
      expect(f.lobes[0].t1 - f.lobes[0].t0, `${l} broad R`).toBeGreaterThan(0.6 * M('lbbb').qrs!);
      if (f.lobes[0].notches >= 1) notched++;
      expect(f.st60, l).toBeLessThan(-0.02);
      expect(f.tPeak, l).toBeLessThan(0);
    }
    expect(notched, 'notched ("M") R in the lateral leads').toBeGreaterThanOrEqual(2);
    for (const l of ['V1', 'V2', 'V3'] as LeadId[]) {
      const f = F('lbbb', l);
      expect(f.r, l).toBeLessThan(0.1);
      expect(f.minAll, l).toBeLessThan(-0.8);
      expect(f.st60, l).toBeGreaterThan(0.05);
    }
  });
  it('LAFB: axis −45° to −90°, qR in I/aVL, rS in II/III/aVF, QRS < 120', () => {
    const m = M('lafb');
    expect(m.axis!).toBeLessThanOrEqual(-45);
    expect(m.axis!).toBeGreaterThanOrEqual(-90);
    expect(m.qrs!).toBeLessThan(120);
    for (const l of ['I', 'aVL'] as LeadId[]) {
      expect(F('lafb', l).q, l).toBeLessThan(-0.03);
      expect(F('lafb', l).r, l).toBeGreaterThan(-F('lafb', l).s);
    }
    for (const l of ['II', 'III', 'aVF'] as LeadId[]) {
      expect(F('lafb', l).lobes[0].sign, l).toBe(1);
      expect(F('lafb', l).r, l).toBeLessThan(-F('lafb', l).s);
    }
  });
  it('LPFB: axis > +90°, rS in I/aVL, qR in II/III/aVF, QRS < 120', () => {
    const m = M('lpfb');
    expect(m.axis!).toBeGreaterThan(90);
    expect(m.axis!).toBeLessThanOrEqual(180);
    expect(m.qrs!).toBeLessThan(120);
    for (const l of ['I', 'aVL'] as LeadId[]) expect(F('lpfb', l).r, l).toBeLessThan(-F('lpfb', l).s);
    for (const l of ['II', 'III', 'aVF'] as LeadId[]) {
      expect(F('lpfb', l).q, l).toBeLessThan(-0.05);
      expect(F('lpfb', l).r, l).toBeGreaterThan(0.5);
    }
  });
  it('bifascicular block: RBBB pattern (QRS ≥ 120, rsR′ V1, wide S in I) + LAD (−45…−90) or RAD', () => {
    for (const id of ['bifascicular', 'rbbbLpfb']) {
      expect(M(id).qrs!).toBeGreaterThanOrEqual(120);
      expect(F(id, 'V1').rPrime + F(id, 'V1').r).toBeGreaterThan(0.5);
      expect(F(id, 'I').s).toBeLessThan(-0.3);
    }
    expect(F('bifascicular', 'V1').pattern).toMatch(/^r[sS]R'/);
    expect(M('bifascicular').axis!).toBeLessThanOrEqual(-45);
    expect(M('bifascicular').axis!).toBeGreaterThanOrEqual(-90);
    expect(M('rbbbLpfb').axis!).toBeGreaterThan(90);
  });
  it('nonspecific IVCD: QRS > 110 without a BBB pattern', () => {
    expect(M('ivcd').qrs!).toBeGreaterThan(110);
    expect(F('ivcd', 'V1').rPrime).toBe(0);
    expect(F('ivcd', 'V6').q).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------------------------
describe('ventricular rhythms', () => {
  const vt = (b: BeatInfo) => b.ev.route === 'focus';
  it('ventricular escape 20–40/min wide, AIVR 50–110/min wide', () => {
    expect(M('ventEscape').ventRate!).toBeGreaterThanOrEqual(20);
    expect(M('ventEscape').ventRate!).toBeLessThanOrEqual(40);
    expect(M('ventEscape').qrs!).toBeGreaterThanOrEqual(120);
    const a = vs('aivr');
    const runs = rrOf(a).filter((x, i) => a[i].mechanism === 'AIVR' && a[i + 1].mechanism === 'AIVR');
    const rate = 60000 / mean(runs);
    expect(rate).toBeGreaterThanOrEqual(50);
    expect(rate).toBeLessThanOrEqual(110);
    expect(M('aivr').qrs!).toBeGreaterThanOrEqual(120);
  });
  it('monomorphic VT: regular, wide (≥ 140), 120–250/min, AV dissociation, identical complexes', () => {
    for (const id of ['monoVT', 'pulselessVT', 'rvotVT', 'arvcVT']) {
      const m = M(id);
      expect(m.ventRate!, id).toBeGreaterThanOrEqual(120);
      expect(m.ventRate!, id).toBeLessThanOrEqual(250);
      expect(m.qrs!, id).toBeGreaterThanOrEqual(140);
      expect(m.regularity, id).toBe('regular');
      expect(m.avRelation, id).toMatch(/dissociation/);
    }
    const r = C('monoVT');
    // monomorphic: every non-fusion VT beat has the same activation sequence (identical QRS vector)
    const bs = visBeats(r).filter((b) => vt(b) && !b.morph.notes.includes('fusion'));
    expect(bs.length).toBeGreaterThan(20);
    const a0 = bs[0].morph.qrsArea;
    for (const b of bs) for (let k = 0; k < 3; k++) expect(Math.abs(b.morph.qrsArea[k] - a0[k])).toBeLessThan(1e-6 + 0.01 * Math.hypot(...a0));
  });
  it('RVOT VT: LBBB-like (V1 negative) with an inferior axis; ARVC VT: LBBB-like with a superior axis', () => {
    const neg = (id: string, l: LeadId) => -F(id, l, vt).minAll > F(id, l, vt).r;
    expect(neg('rvotVT', 'V1')).toBe(true);
    for (const l of ['II', 'III', 'aVF'] as LeadId[]) expect(neg('rvotVT', l), l).toBe(false);
    expect(M('rvotVT').axis!).toBeGreaterThan(30);
    expect(M('rvotVT').axis!).toBeLessThanOrEqual(110);
    expect(neg('arvcVT', 'V1')).toBe(true);
    for (const l of ['II', 'III', 'aVF'] as LeadId[]) expect(neg('arvcVT', l), l).toBe(true);
    expect(M('arvcVT').axis!).toBeLessThan(-30);
  });
  it('fascicular VT: RBBB-like, left superior axis, relatively narrow (120–140 ms); bidirectional VT alternates its axis beat to beat', () => {
    const m = M('fascicularVT');
    expect(m.qrs!).toBeGreaterThanOrEqual(120);
    expect(m.qrs!).toBeLessThanOrEqual(140);
    expect(m.axis!).toBeLessThan(-30);
    expect(F('fascicularVT', 'V1', vt).r).toBeGreaterThan(-F('fascicularVT', 'V1', vt).s);
    const r = C('bidirectionalVT');
    const bs = visBeats(r).filter(vt);
    const sign = bs.map((b) => Math.sign(qrsFeatures(r, b, 'aVF').r + qrsFeatures(r, b, 'aVF').minAll));
    for (let i = 1; i < sign.length; i++) expect(sign[i]).toBe(-sign[i - 1]);
    expect(M('bidirectionalVT').regularity).toBe('regular');
    expect(M('bidirectionalVT').qrs!).toBeLessThan(140);
  });
  it('NSVT: ≥ 3 consecutive ventricular beats > 100/min lasting < 30 s between sinus beats', () => {
    const v = vs('nsvt');
    const run = v.filter((x) => x.mechanism === 'VT');
    expect(run.length).toBeGreaterThanOrEqual(3);
    expect(60000 / mean(rrOf(run))).toBeGreaterThan(100);
    expect(v[0].mechanism).toBe('conducted');
    expect(v[v.length - 1].mechanism).toBe('conducted');
  });
  it('polymorphic VT (normal QT) and torsades (long QT): changing axis, 150–300/min; sinus-beat QTc normal vs > 500', () => {
    const r = C('polyVT');
    const bs = visBeats(r).filter((b) => b.ev.mechanism === 'polymorphic VT');
    const ax = bs.map((b) => Math.atan2(b.morph.qrsArea[1], b.morph.qrsArea[0]));
    expect(Math.max(...ax) - Math.min(...ax)).toBeGreaterThan(1.5);
    const rate = 60000 / mean(rrOf(vs('polyVT').filter((v) => v.mechanism === 'polymorphic VT')));
    expect(rate).toBeGreaterThanOrEqual(150);
    expect(rate).toBeLessThanOrEqual(300);
    expect(M('polyVT').qtcFridericia!).toBeLessThan(450);
    expect(M('torsades').qtcFridericia!).toBeGreaterThan(500);
    const tv = vs('torsades').filter((v) => v.mechanism === 'torsades de pointes');
    const tr = 60000 / mean(rrOf(tv));
    expect(tr).toBeGreaterThanOrEqual(160);
    expect(tr).toBeLessThanOrEqual(300);
    expect(vs('torsades')[vs('torsades').length - 1].mechanism).toBe('conducted');
  });
  it('VF / ventricular flutter: no QRS; flutter ≈ 250–300/min sine wave; no rate, PR, QRS or axis read-outs', () => {
    for (const id of ['vf', 'vflutter']) {
      const m = M(id);
      expect([m.ventRate, m.atrialRate, m.pr, m.qrs, m.axis]).toEqual([null, null, null, null, null]);
    }
    const II = C('vflutter').sig.leads.II!;
    let zc = 0;
    for (let i = 1; i < II.length; i++) if (II[i - 1] < 0 && II[i] >= 0) zc++;
    const perMin = zc * (60000 / C('vflutter').sim.duration);
    expect(perMin).toBeGreaterThan(240);
    expect(perMin).toBeLessThan(320);
  });
  it('asystole: P waves without QRS; PEA: an organised rhythm', () => {
    expect(vs('asystole').length).toBe(0);
    expect(M('asystole').avRelation).toMatch(/P waves without QRS/);
    expect(M('pea').ventRate!).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------------
describe('pacing', () => {
  it('AAI: atrial spike → P → native PR → narrow QRS at the lower rate', () => {
    const m = M('aai');
    expect(m.ventRate).toBe(70);
    expect(m.qrs!).toBeLessThan(110);
    expect(C('aai').sim.spikes.every((s) => s.chamber === 'A')).toBe(true);
  });
  it('VVI and DDD: wide LBBB-like paced QRS with a superior axis; tracking at the AV delay; AV-sequential spikes', () => {
    for (const id of ['vvi', 'dddTracking', 'dddSequential']) {
      expect(M(id).qrs!).toBeGreaterThanOrEqual(120);
      expect(M(id).axis!).toBeLessThan(-30);
      const f = F(id, 'V1', (b) => b.ev.route === 'paced');
      expect(-f.minAll).toBeGreaterThan(f.r);
    }
    // discordant ST–T: T opposite to the main QRS deflection in most leads
    const r = C('vvi');
    const pb = beatOf('vvi', (x) => x.ev.route === 'paced');
    let disc = 0;
    let n = 0;
    for (const l of TWELVE) {
      const f = qrsFeatures(r, pb, l);
      const main = f.r + f.minAll;
      if (Math.abs(main) < 0.3) continue;
      n++;
      if (Math.sign(f.tPeak) === -Math.sign(main)) disc++;
    }
    expect(disc / n).toBeGreaterThanOrEqual(0.75);
    expect(M('vvi').avRelation).toMatch(/dissociation/);
    expect(M('dddTracking').avRelation).toMatch(/atrial-tracked ventricular pacing \(AV delay 15\d ms\)/);
    expect(M('dddSequential').avRelation).toMatch(/AV sequential pacing \(AV delay 1[67]\d ms\)/);
  });
  it('malfunction: non-capturing spikes, spikes despite native beats, pauses longer than the lower-rate interval without a spike', () => {
    expect(C('failCapture').sim.spikes.some((s) => !s.captured && s.t > 0)).toBe(true);
    const fs = C('failSense');
    expect(fs.sim.spikes.some((s) => vs('failSense').some((v) => v.route === 'his' && s.t > v.t && s.t - v.t < 450))).toBe(true);
    const ov = vs('oversense');
    expect(Math.max(...rrOf(ov))).toBeGreaterThan(1000 + 200);
    const big = rrOf(ov).findIndex((x) => x > 1200);
    expect(C('oversense').sim.spikes.some((s) => s.t > ov[big].t + 20 && s.t < ov[big + 1].t - 20)).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
describe('hypertrophy, enlargement, voltage', () => {
  const sokolow = (id: string) => -F(id, 'V1').minAll + Math.max(F(id, 'V5').r, F(id, 'V6').r);
  it('LVH with strain: Sokolow–Lyon ≥ 3.5 mV, lateral STD with T inversion, LAE; voltage-only LVH has upright lateral T', () => {
    expect(sokolow('lvh')).toBeGreaterThanOrEqual(3.5);
    expect(sokolow('lvhVoltage')).toBeGreaterThanOrEqual(3.5);
    for (const l of ['I', 'aVL', 'V6'] as LeadId[]) {
      expect(F('lvh', l).stJ, l).toBeLessThan(-0.04);
      expect(F('lvh', l).tPeak, l).toBeLessThan(-0.1);
    }
    expect(F('lvh', 'V5').tPeak).toBeLessThan(0);
    for (const l of ['I', 'V5', 'V6'] as LeadId[]) expect(F('lvhVoltage', l).tPeak, l).toBeGreaterThan(0.1);
    expect(M('lvh').qrs!).toBeLessThan(120);
    expect(pOf('lvh', 'V1').termNegArea).toBeGreaterThanOrEqual(0.04);
  });
  it('RVH / chronic pulmonary hypertension: RAD, dominant R in V1 (R ≥ 0.7 mV, R/S > 1), deep S in V5–V6, RV strain T, no lateral Q waves', () => {
    for (const id of ['rvh', 'pulmHtn']) {
      expect(M(id).axis!, id).toBeGreaterThan(90);
      const v1 = F(id, 'V1');
      expect(v1.r).toBeGreaterThanOrEqual(0.7);
      expect(v1.r).toBeGreaterThan(-v1.s);
      for (const l of ['V5', 'V6'] as LeadId[]) expect(F(id, l).s, `${id} ${l}`).toBeLessThan(-0.5);
      for (const l of ['I', 'aVL', 'V5', 'V6'] as LeadId[]) expect(F(id, l).qDur, `${id} ${l} Q`).toBeLessThan(30);
      for (const l of ['V1', 'V2', 'V3'] as LeadId[]) expect(F(id, l).tPeak, `${id} ${l} T`).toBeLessThan(0);
      expect(pOf(id, 'II').pos, `${id} P pulmonale`).toBeGreaterThanOrEqual(0.25);
    }
  });
  it('RAE: P ≥ 2.5 mm in II, normal duration; LAE: P ≥ 120 ms, notched (≥ 40 ms), V1 terminal force ≥ 0.04 mm·s', () => {
    expect(pOf('rae', 'II').pos).toBeGreaterThanOrEqual(0.25);
    expect(pOf('rae', 'II').modelDur).toBeLessThan(120);
    const lae = pOf('lae', 'II');
    expect(lae.modelDur).toBeGreaterThanOrEqual(120);
    expect(lae.dur).toBeGreaterThanOrEqual(120);
    expect(lae.peaks).toBe(2);
    expect(lae.peakSep).toBeGreaterThanOrEqual(40);
    expect(pOf('lae', 'V1').termNegArea).toBeGreaterThanOrEqual(0.04);
  });
  it('poor R-wave progression: R ≤ 3 mm in V3, R < S in V1–V4, transition at V5', () => {
    expect(F('poorR', 'V3').r).toBeLessThanOrEqual(0.3);
    for (const l of ['V1', 'V2', 'V3', 'V4'] as LeadId[]) expect(F('poorR', l).r, l).toBeLessThan(-F('poorR', l).s);
    expect(F('poorR', 'V5').r).toBeGreaterThanOrEqual(-F('poorR', 'V5').s);
    for (const l of ['V1', 'V2', 'V3'] as LeadId[]) expect(F('poorR', l).q, l).toBe(0);
  });
  it('low voltage + alternans: every limb lead < 5 mm and every chest lead < 10 mm in every beat; alternate beats differ ≥ 15 %; sinus tachycardia', () => {
    const r = C('lowVolt');
    const bs = visBeats(r).filter((b) => b.ev.t + b.morph.tEnd < r.sim.duration);
    for (const b of bs) {
      for (const l of LIMB) expect(qrsFeatures(r, b, l).ptp, l).toBeLessThan(0.5);
      for (const l of PREC) expect(qrsFeatures(r, b, l).ptp, l).toBeLessThan(1.0);
    }
    const a0 = qrsFeatures(r, bs[2], 'V5').ptp;
    const a1 = qrsFeatures(r, bs[3], 'V5').ptp;
    expect(Math.max(a0, a1) / Math.min(a0, a1)).toBeGreaterThan(1.15);
    expect(M('lowVolt').ventRate!).toBeGreaterThan(100);
  });
  it('COPD: limb-lead low voltage, right axis, small precordial R waves through V3, vertical P axis', () => {
    for (const l of LIMB) expect(F('copd', l).ptp, l).toBeLessThan(0.5);
    expect(M('copd').axis!).toBeGreaterThan(90);
    for (const l of ['V1', 'V2', 'V3'] as LeadId[]) expect(F('copd', l).r, l).toBeLessThan(-F('copd', l).s);
    expect(pOf('copd', 'III').pos).toBeGreaterThan(pOf('copd', 'I').pos);
  });
});

// ---------------------------------------------------------------------------------------------
describe('ischaemia and infarction (ST measured at the J point, relative to the PR segment)', () => {
  const J = (id: string, l: LeadId) => F(id, l).stJ;
  it('anterior STEMI (proximal LAD): STE ≥ 2 mm V2–V3, ≥ 1 mm V1, V4, I, aVL; reciprocal inferior STD', () => {
    for (const l of ['V2', 'V3'] as LeadId[]) expect(J('stemiAnterior', l), l).toBeGreaterThanOrEqual(0.2);
    for (const l of ['V1', 'V4', 'I', 'aVL'] as LeadId[]) expect(J('stemiAnterior', l), l).toBeGreaterThanOrEqual(0.1);
    expect(J('stemiAnterior', 'III')).toBeLessThanOrEqual(-0.1);
    expect(J('stemiAnterior', 'aVF')).toBeLessThan(-0.03);
  });
  it('inferior STEMI with RV involvement: STE ≥ 1 mm II/III/aVF with III > II, reciprocal STD in aVL and I, STE ≥ 1 mm in V4R', () => {
    for (const l of ['II', 'III', 'aVF'] as LeadId[]) expect(J('stemiInferior', l), l).toBeGreaterThanOrEqual(0.1);
    expect(J('stemiInferior', 'III')).toBeGreaterThan(J('stemiInferior', 'II'));
    expect(J('stemiInferior', 'aVL')).toBeLessThan(-0.05);
    expect(J('stemiInferior', 'I')).toBeLessThan(0);
    expect(J('stemiInferior', 'V4R')).toBeGreaterThanOrEqual(0.1);
  });
  it('high lateral STEMI: STE ≥ 1 mm in I and aVL, reciprocal STD III/aVF, no anterior STE (V2–V4 < 1 mm)', () => {
    for (const l of ['I', 'aVL'] as LeadId[]) expect(J('stemiLateral', l), l).toBeGreaterThanOrEqual(0.1);
    for (const l of ['III', 'aVF'] as LeadId[]) expect(J('stemiLateral', l), l).toBeLessThanOrEqual(-0.05);
    for (const l of ['V2', 'V3', 'V4'] as LeadId[]) expect(J('stemiLateral', l), l).toBeLessThan(0.1);
  });
  it('posterior STEMI: horizontal STD ≥ 1 mm V1–V3 maximal in V2–V3 with upright T in V2–V3; STE ≥ 0.5 mm in V7–V9', () => {
    for (const l of ['V1', 'V2', 'V3'] as LeadId[]) {
      expect(J('stemiPosterior', l), l).toBeLessThanOrEqual(-0.1);
      expect(Math.abs(F('stemiPosterior', l).st60 - J('stemiPosterior', l)), `${l} horizontal`).toBeLessThan(0.05);
    }
    expect(Math.min(J('stemiPosterior', 'V2'), J('stemiPosterior', 'V3'))).toBeLessThan(J('stemiPosterior', 'V1'));
    for (const l of ['V2', 'V3'] as LeadId[]) expect(F('stemiPosterior', l).tMax, `${l} upright T`).toBeGreaterThan(0.05);
    for (const l of ['V7', 'V8', 'V9'] as LeadId[]) expect(J('stemiPosterior', l), l).toBeGreaterThanOrEqual(0.05);
  });
  it('hyperacute T: tall broad T in V2–V4 (≥ 8 mm) before diagnostic ST elevation (J < 1 mm)', () => {
    for (const l of ['V2', 'V3', 'V4'] as LeadId[]) {
      expect(F('hyperacute', l).tMax, l).toBeGreaterThanOrEqual(0.8);
      expect(J('hyperacute', l), l).toBeLessThan(0.1);
    }
  });
  it('evolving anterior MI: Q/QS in V1–V3, T inversion V1–V4, residual STE', () => {
    for (const l of ['V1', 'V2', 'V3'] as LeadId[]) expect(F('evolvingMI', l).lobes[0].sign, l).toBe(-1);
    for (const l of ['V1', 'V2', 'V3', 'V4'] as LeadId[]) expect(F('evolvingMI', l).tMin, l).toBeLessThan(-0.1);
  });
  it('old inferior MI: pathological Q (≥ 30 ms, ≥ 1 mm) in II and aVF, QS in III, no ST elevation', () => {
    for (const l of ['II', 'aVF'] as LeadId[]) {
      expect(F('oldInferior', l).qDur, l).toBeGreaterThanOrEqual(30);
      expect(F('oldInferior', l).q, l).toBeLessThanOrEqual(-0.1);
    }
    expect(F('oldInferior', 'III').pattern).toMatch(/^Q/);
    for (const l of TWELVE) expect(Math.abs(J('oldInferior', l)), l).toBeLessThan(0.05);
  });
  it('Wellens: deep symmetric T inversion V2–V3, minimal ST change, no Q waves, preserved R progression', () => {
    for (const l of ['V2', 'V3'] as LeadId[]) {
      expect(F('wellens', l).tMin, l).toBeLessThan(-0.5);
      expect(Math.abs(J('wellens', l)), l).toBeLessThan(0.1);
      expect(F('wellens', l).q, l).toBe(0);
    }
    expect(F('wellens', 'V4').r).toBeGreaterThan(F('wellens', 'V2').r);
  });
  it('diffuse subendocardial ischaemia: STE in aVR (and V1), STD in ≥ 6 leads incl. I, II, V4–V6', () => {
    expect(F('subendo', 'aVR').st60).toBeGreaterThanOrEqual(0.08);
    const dep = TWELVE.filter((l) => F('subendo', l).st60 <= -0.05);
    expect(dep.length).toBeGreaterThanOrEqual(6);
    for (const l of ['I', 'II', 'V5', 'V6'] as LeadId[]) expect(dep, l).toContain(l);
  });
  it('de Winter: upsloping J-point depression ≥ 1 mm in V2–V5 into tall T waves, slight STE in aVR', () => {
    for (const l of ['V2', 'V3', 'V4', 'V5'] as LeadId[]) {
      expect(J('deWinter', l), l).toBeLessThanOrEqual(-0.1);
      expect(F('deWinter', l).st60, `${l} upsloping`).toBeGreaterThan(J('deWinter', l));
      expect(F('deWinter', l).tMax, l).toBeGreaterThan(0.8);
    }
    expect(J('deWinter', 'aVR')).toBeGreaterThanOrEqual(0.05);
  });
  it('LV aneurysm: QS V1–V2, persistent STE ≥ 1 mm V1–V4, small T relative to QRS (Σ T/Σ QRS V1–V4 < 0.22)', () => {
    for (const l of ['V1', 'V2'] as LeadId[]) expect(F('lvAneurysm', l).lobes[0].sign, l).toBe(-1);
    let tSum = 0;
    let qSum = 0;
    for (const l of ['V1', 'V2', 'V3', 'V4'] as LeadId[]) {
      const f = F('lvAneurysm', l);
      expect(f.stJ, l).toBeGreaterThanOrEqual(0.1);
      tSum += f.tMax;
      qSum += Math.max(f.r, -f.minAll);
    }
    expect(tSum / qSum).toBeLessThan(0.22);
  });
  it('Takotsubo (subacute): widespread deep T inversion, upright T in aVR, QTc > 470, no reciprocal STD', () => {
    for (const l of ['I', 'II', 'V2', 'V3', 'V4', 'V5'] as LeadId[]) expect(F('takotsubo', l).tMin, l).toBeLessThan(-0.1);
    expect(F('takotsubo', 'aVR').tMax).toBeGreaterThan(0.1);
    expect(M('takotsubo').qtcBazett!).toBeGreaterThan(470);
    for (const l of TWELVE) expect(J('takotsubo', l), l).toBeGreaterThan(-0.05);
  });
});

// ---------------------------------------------------------------------------------------------
describe('pericardium, myocardium, lungs', () => {
  it('acute pericarditis: diffuse STE (I, II, aVL ≥ 0, aVF, V2–V6), PR depression in II with PR elevation in aVR, STD only in aVR/V1, no Q', () => {
    for (const l of ['I', 'II', 'aVF', 'V2', 'V3', 'V4', 'V5', 'V6'] as LeadId[]) expect(F('pericarditis', l).stJ, l).toBeGreaterThanOrEqual(0.1);
    expect(F('pericarditis', 'aVL').stJ).toBeGreaterThanOrEqual(0);
    expect(F('pericarditis', 'aVR').stJ).toBeLessThanOrEqual(-0.1);
    for (const l of TWELVE.filter((x) => x !== 'aVR' && x !== 'V1')) expect(F('pericarditis', l).stJ, l).toBeGreaterThanOrEqual(0);
    // PR segment relative to the TP baseline just before the P wave
    const r = C('pericarditis');
    const b = beatOf('pericarditis');
    const a = r.sim.atrial[b.ev.atrialIndex];
    const pr = (l: LeadId) => valueAt(r, l, b.ev.t - 8) - valueAt(r, l, a.t - 5);
    expect(pr('II')).toBeLessThan(-0.03);
    expect(pr('aVR')).toBeGreaterThan(0.02);
  });
  it('pericarditis stage 3: diffuse T inversion with upright T in aVR, isoelectric ST', () => {
    for (const l of ['I', 'II', 'aVF', 'V2', 'V3', 'V4', 'V5', 'V6'] as LeadId[]) expect(F('pericarditis3', l).tPeak, l).toBeLessThan(0);
    expect(F('pericarditis3', 'aVR').tPeak).toBeGreaterThan(0);
  });
  it('myocarditis: sinus tachycardia with ectopy', () => {
    expect(M('myocarditis').ventRate!).toBeGreaterThan(100);
    expect(vs('myocarditis').some((v) => v.mechanism === 'pvc')).toBe(true);
  });
  it('acute PE: sinus tachycardia, incomplete RBBB, S in I, T inversion in V1–V4 and III', () => {
    const m = M('pe');
    expect(m.ventRate!).toBeGreaterThan(100);
    expect(m.qrs!).toBeGreaterThanOrEqual(110);
    expect(m.qrs!).toBeLessThan(120);
    expect(F('pe', 'V1').rPrime).toBeGreaterThan(0.1);
    expect(F('pe', 'I').s).toBeLessThan(-0.15);
    for (const l of ['V1', 'V2', 'V3', 'V4', 'III'] as LeadId[]) expect(F('pe', l).tPeak, l).toBeLessThan(-0.05);
  });
});

// ---------------------------------------------------------------------------------------------
describe('electrolytes and drugs', () => {
  const tAmp = (id: string, l: LeadId) => F(id, l).tMax;
  it('hyperkalaemia: peaked T (6.3) → flat P, long PR, wide QRS (7.3) → no P, very wide QRS merging with T (8.3) → sine wave (9.2)', () => {
    for (const l of ['V2', 'V3', 'V4'] as LeadId[]) expect(tAmp('hyperK6', l), l).toBeGreaterThan(1.5 * tAmp('nsr', l));
    expect(M('hyperK6').qrs!).toBeLessThan(110);
    expect(pOf('hyperK7', 'II').pos).toBeLessThan(0.6 * pOf('nsr', 'II').pos);
    expect(M('hyperK7').pr!).toBeGreaterThan(M('nsr').pr!);
    expect(M('hyperK7').qrs!).toBeGreaterThan(M('nsr').qrs! + 15);
    for (const id of ['hyperK8', 'hyperK9']) {
      expect(M(id).pr).toBeNull();
      expect(M(id).avRelation).toBe('no visible P waves');
      const b = beatOf(id, (x) => x.ev.route === 'his');
      expect(b.morph.tStart - b.morph.qrsDur, `${id}: ST segment`).toBeLessThan(30);
    }
    expect(pOf('hyperK8', 'II').pos).toBeLessThan(0.03);
    expect(M('hyperK8').qrs!).toBeGreaterThanOrEqual(120);
    expect(M('hyperK9').qrs!).toBeGreaterThanOrEqual(160);
    const b9 = beatOf('hyperK9', (x) => x.ev.route === 'his');
    expect(b9.morph.tStart).toBeLessThanOrEqual(b9.morph.qrsDur);
  });
  it('hypokalaemia: prominent U (> 1 mm, larger than T in V2–V3), ST depression, apparent QT prolongation', () => {
    for (const l of ['V2', 'V3'] as LeadId[]) {
      const f = F('hypoK', l);
      expect(f.uPeak, l).toBeGreaterThan(0.1);
      expect(f.uPeak, l).toBeGreaterThan(f.tMax);
    }
    expect(F('hypoK', 'V5').st60).toBeLessThan(-0.03);
    expect(M('hypoK').qtcBazett!).toBeGreaterThan(M('nsr').qtcBazett!);
  });
  it('calcium: hyper → short ST and QTc < 360; hypo → long flat ST, QTc > 470, normal T', () => {
    const bh = beatOf('hyperCa');
    expect(bh.morph.tStart - bh.morph.qrsDur).toBeLessThan(40);
    expect(M('hyperCa').qtcBazett!).toBeLessThan(360);
    const bl = beatOf('hypoCa');
    expect(bl.morph.tStart - bl.morph.qrsDur).toBeGreaterThan(150);
    expect(M('hypoCa').qtcBazett!).toBeGreaterThan(470);
    expect(Math.abs(tAmp('hypoCa', 'V4') / tAmp('nsr', 'V4') - 1)).toBeLessThan(0.2);
  });
  it('magnesium: hypo → QT prolongation; marked hyper → bradycardia, PR and QRS prolongation', () => {
    expect(M('hypoMg').qtcBazett!).toBeGreaterThan(M('nsr').qtcBazett! + 20);
    expect(M('hyperMg').ventRate!).toBeLessThan(60);
    expect(M('hyperMg').pr!).toBeGreaterThan(M('nsr').pr!);
    expect(M('hyperMg').qrs!).toBeGreaterThan(M('nsr').qrs!);
  });
  it('digoxin effect: sagging lateral ST depression, flattened T, shorter QT, longer PR', () => {
    for (const l of ['V5', 'V6', 'II'] as LeadId[]) expect(F('digoxinEffect', l).st60, l).toBeLessThan(-0.04);
    expect(M('digoxinEffect').qtcFridericia!).toBeLessThan(M('nsr').qtcFridericia!);
    expect(M('digoxinEffect').pr!).toBeGreaterThan(M('nsr').pr!);
    expect(beatOf('digoxinEffect').morph.comps.some((c) => c.shape === 'sag')).toBe(true);
  });
  it('AV-nodal blockers: β-blocker bradycardia with longer PR; CCB toxicity bradycardia with first-degree block', () => {
    expect(M('betaBlocker').ventRate!).toBeLessThanOrEqual(60);
    expect(M('betaBlocker').pr!).toBeGreaterThan(M('nsr').pr!);
    expect(M('ccbTox').ventRate!).toBeLessThan(60);
    expect(M('ccbTox').pr!).toBeGreaterThan(200);
  });
  it('Na-channel blockade: TCA → sinus tachycardia, QRS > 120, terminal R in aVR ≥ 3 mm; flecainide → PR and QRS prolongation', () => {
    expect(M('tca').ventRate!).toBeGreaterThan(100);
    expect(M('tca').qrs!).toBeGreaterThan(120);
    expect(F('tca', 'aVR').rPrime, 'terminal R′ in aVR').toBeGreaterThanOrEqual(0.3);
    expect(M('flecainide').pr!).toBeGreaterThan(M('nsr').pr!);
    expect(M('flecainide').qrs!).toBeGreaterThan(M('nsr').qrs! + 20);
  });
  it('QT-prolonging drug, amiodarone, congenital LQTS and SQTS', () => {
    expect(M('qtDrug').qtcBazett!).toBeGreaterThanOrEqual(480);
    expect(M('amiodarone').ventRate!).toBeLessThan(60);
    expect(M('amiodarone').pr!).toBeGreaterThan(M('nsr').pr!);
    expect(M('amiodarone').qtcFridericia!).toBeGreaterThan(M('nsr').qtcFridericia! + 30);
    expect(M('lqts').qtcBazett!).toBeGreaterThanOrEqual(480);
    expect(M('sqts').qtcBazett!).toBeLessThanOrEqual(340);
    const b = beatOf('sqts');
    expect(b.morph.tStart - b.morph.qrsDur).toBeLessThan(50);
  });
});

// ---------------------------------------------------------------------------------------------
describe('inherited syndromes, cardiomyopathies, variants', () => {
  it('early repolarisation: J elevation ≥ 1 mm in ≥ 2 contiguous inferolateral leads with notch/slur, STD only in aVR', () => {
    const hi = (l: LeadId) => F('earlyRepol', l).stJ >= 0.1;
    expect((hi('V4') && hi('V5')) || (hi('V5') && hi('V6')) || (hi('II') && hi('aVF'))).toBe(true);
    expect(F('earlyRepol', 'V5').rPrime).toBeGreaterThan(0.05);
    expect(F('earlyRepol', 'aVR').stJ).toBeLessThan(-0.05);
    for (const l of TWELVE.filter((x) => x !== 'aVR')) expect(F('earlyRepol', l).stJ, l).toBeGreaterThan(-0.03);
  });
  it('Brugada type 1: coved STE ≥ 2 mm in V1–V2 descending into a negative T', () => {
    const r = C('brugada1');
    const b = beatOf('brugada1');
    for (const l of ['V1', 'V2'] as LeadId[]) {
      const f = qrsFeatures(r, b, l);
      expect(f.stJ, l).toBeGreaterThanOrEqual(0.2);
      // coved: no saddle — the ST descends monotonically from J+10 to its crossing below baseline
      let prev = Infinity;
      let mono = true;
      let crossed = false;
      for (let t = 10; t < b.morph.tEnd - b.morph.qrsDur; t += 5) {
        const v = valueAt(r, l, b.ev.t + b.morph.qrsDur + t) - f.base;
        if (!crossed && v > prev + 0.005) mono = false;
        if (v < 0) crossed = true;
        prev = v;
      }
      expect(mono, `${l} coved`).toBe(true);
      expect(f.tMin, `${l} negative T`).toBeLessThan(-0.05);
    }
  });
  it('Brugada type 2: saddleback — J ≥ 2 mm in V1 or V2, ST trough ≥ 0.5 mm, positive T', () => {
    const v1 = F('brugada2', 'V1');
    const v2 = F('brugada2', 'V2');
    expect(Math.max(v1.stJ, v2.stJ)).toBeGreaterThanOrEqual(0.2);
    for (const f of [v1, v2]) {
      expect(f.st60).toBeGreaterThanOrEqual(0.05);
      expect(f.st60).toBeLessThan(f.stJ);
      expect(f.tMax).toBeGreaterThan(f.st60);
      expect(f.tMin).toBeGreaterThanOrEqual(-0.01);
    }
  });
  it('hypothermia: Osborn J waves (≥ 1 mm in II, V5–V6), bradycardia, long PR/QRS/QT', () => {
    for (const l of ['II', 'V5', 'V6'] as LeadId[]) expect(F('hypothermia', l).stJ, l).toBeGreaterThanOrEqual(0.1);
    expect(M('hypothermia').ventRate!).toBeLessThan(60);
    expect(M('hypothermia').pr!).toBeGreaterThan(M('nsr').pr!);
    expect(M('hypothermia').qrs!).toBeGreaterThan(M('nsr').qrs!);
    expect(M('hypothermia').qtcBazett!).toBeGreaterThan(450);
  });
  it('HCM: deep (> 3 mm) narrow (< 40 ms) Q in I, aVL, V5–V6, tall R in V1, LVH voltage, repolarisation abnormality, LAE', () => {
    for (const l of ['I', 'aVL', 'V6'] as LeadId[]) {
      const f = F('hcm', l);
      expect(f.q, l).toBeLessThan(-0.3);
      expect(f.qDur, l).toBeLessThan(40);
    }
    expect(F('hcm', 'V1').r).toBeGreaterThan(2 * F('nsr', 'V1').r);
    expect(-F('hcm', 'V1').minAll + F('hcm', 'V6').r).toBeGreaterThanOrEqual(3.5);
    expect(F('hcm', 'V6').stJ).toBeLessThan(0);
    expect(pOf('hcm', 'V1').termNegArea).toBeGreaterThanOrEqual(0.04);
    expect(M('hcm').qrs!).toBeLessThan(120);
  });
  it('ARVC: T inversion V1–V3 (upright V5–V6), epsilon local term, terminal activation delay ≥ 55 ms in V1', () => {
    for (const l of ['V1', 'V2', 'V3'] as LeadId[]) expect(F('arvc', l).tPeak, l).toBeLessThan(0);
    for (const l of ['V5', 'V6'] as LeadId[]) expect(F('arvc', l).tPeak, l).toBeGreaterThan(0);
    const r = C('arvc');
    const b = beatOf('arvc');
    expect(b.morph.local.some((t) => t.kind === 'epsilon')).toBe(true);
    // TAD: nadir of S to the end of all depolarisation (QRS + epsilon) in V1
    let nadir = 0;
    let vmin = Infinity;
    for (let t = 0; t <= b.morph.qrsDur; t++) {
      const v = valueAt(r, 'V1', b.ev.t + t);
      if (v < vmin) {
        vmin = v;
        nadir = t;
      }
    }
    expect(b.morph.qrsDur - nadir).toBeGreaterThanOrEqual(55);
  });
  it("athlete's heart: sinus bradycardia, first-degree AV block, incomplete RBBB (110–119 ms, rsr′ V1), isolated voltage, early repolarisation", () => {
    const m = M('athlete');
    expect(m.ventRate!).toBeLessThan(60);
    expect(m.ventRate!).toBeGreaterThanOrEqual(30);
    expect(m.pr!).toBeGreaterThan(200);
    expect(m.pr!).toBeLessThan(400);
    expect(m.qrs!).toBeGreaterThanOrEqual(110);
    expect(m.qrs!).toBeLessThan(120);
    expect(F('athlete', 'V1').rPrime).toBeGreaterThan(0.1);
    expect(-F('athlete', 'V1').minAll + Math.max(F('athlete', 'V5').r, F('athlete', 'V6').r)).toBeGreaterThanOrEqual(3.5);
    const hi = (l: LeadId) => F('athlete', l).stJ >= 0.1;
    expect((hi('V3') && hi('V4')) || (hi('V4') && hi('V5'))).toBe(true);
  });
  it('CPVT: normal sinus beats, then bidirectional VT with alternating axis', () => {
    const v = vs('cpvt');
    expect(v[0].mechanism).toBe('conducted');
    const r = C('cpvt');
    const bs = visBeats(r).filter((b) => b.ev.mechanism === 'bidirectional VT');
    expect(bs.length).toBeGreaterThan(5);
    const s = bs.map((b) => Math.sign(qrsFeatures(r, b, 'aVF').r + qrsFeatures(r, b, 'aVF').minAll));
    for (let i = 1; i < s.length; i++) expect(s[i]).toBe(-s[i - 1]);
  });
});

// ---------------------------------------------------------------------------------------------
describe('heart position and cable reversal', () => {
  it('dextrocardia: inverted P, QRS and T in I; positive aVR; right axis; decreasing R from V1 to V6', () => {
    expect(pOf('dextrocardia', 'I').neg).toBeLessThan(-0.04);
    expect(pOf('dextrocardia', 'I').pos).toBeLessThan(0.01);
    const f = F('dextrocardia', 'I');
    expect(f.r + f.minAll).toBeLessThan(0);
    expect(f.tPeak).toBeLessThan(0);
    expect(F('dextrocardia', 'aVR').r).toBeGreaterThan(-F('dextrocardia', 'aVR').minAll);
    expect(M('dextrocardia').axis!).toBeGreaterThan(90);
    expect(F('dextrocardia', 'V6').r).toBeLessThan(F('dextrocardia', 'V2').r);
  });
  it('RA/LA reversal: negative P/QRS/T in I and positive P in aVR; LA/LL: P in I > P in II, negative P in III; RA/LL: II inverted', () => {
    expect(pOf('raLaReversal', 'I').neg).toBeLessThan(-0.04);
    expect(pOf('raLaReversal', 'aVR').pos).toBeGreaterThan(0.03);
    expect(F('raLaReversal', 'I').tPeak).toBeLessThan(0);
    expect(pOf('laLlReversal', 'I').pos).toBeGreaterThan(pOf('laLlReversal', 'II').pos);
    expect(pOf('laLlReversal', 'III').neg).toBeLessThan(-0.02);
    const f = F('raLlReversal', 'II');
    expect(f.r + f.minAll).toBeLessThan(0);
    expect(pOf('raLlReversal', 'II').neg).toBeLessThan(-0.05);
  });
});

// ---------------------------------------------------------------------------------------------
describe('every lead used above is synthesised', () => {
  it('posterior and right-sided leads are available in the measured runs', () => {
    for (const l of ALL) expect(C('nsr').sig.leads[l], l).toBeDefined();
  });
});
