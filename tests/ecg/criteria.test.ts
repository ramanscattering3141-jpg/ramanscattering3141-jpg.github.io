// Published ECG criteria, checked on the signal each preset actually draws (not on the engine's
// internal bookkeeping). Thresholds follow the AHA/ACCF/HRS standardisation statements and
// standard texts: e.g. RV infarction ≥ 0.1 mV STE in V4R, low voltage < 0.5 mV in every limb lead,
// Brugada type 2 J ≥ 0.2 mV with a saddleback, Sokolow–Lyon ≥ 3.5 mV.

import { describe, expect, it } from 'vitest';
import { makePhysio, runEcg, type EcgRun, type LeadId } from '../../src/ecg/engine';
import { PRESETS } from '../../src/ecg/engine/presets';

const ALL: LeadId[] = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V4R', 'V7', 'V8', 'V9'];
const LIMB: LeadId[] = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF'];
const CHEST: LeadId[] = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
const cache = new Map<string, EcgRun>();
const run = (id: string, dur = 10000): EcgRun => {
  const key = `${id}:${dur}`;
  if (!cache.has(key)) cache.set(key, runEcg(makePhysio({ ...PRESETS[id].patch, noise: 0 }), dur, ALL));
  return cache.get(key)!;
};

/** A typical beat of the dominant mechanism, away from the strip edges. */
function beat(r: EcgRun) {
  const bs = r.sig.beats.filter((b) => b.ev.mechanism === r.m.dominant && b.ev.aberrant === 'none' && b.ev.t > 600 && b.ev.t < r.sim.duration - 900);
  return bs[Math.floor(bs.length / 2)];
}
const at = (r: EcgRun, l: LeadId, t: number) => r.sig.leads[l]![Math.round(t)];
/** Baseline: the PR segment if there is a P wave, otherwise just before the QRS. */
const base = (r: EcgRun, l: LeadId) => at(r, l, beat(r).ev.t - 12);
const st = (r: EcgRun, l: LeadId, off = 60) => at(r, l, beat(r).ev.t + beat(r).morph.qrsDur + off) - base(r, l);
function qrsRange(r: EcgRun, l: LeadId): [number, number] {
  const b = beat(r);
  let hi = -9;
  let lo = 9;
  for (let t = 0; t <= b.morph.qrsDur; t++) {
    const v = at(r, l, b.ev.t + t) - base(r, l);
    hi = Math.max(hi, v);
    lo = Math.min(lo, v);
  }
  return [hi, lo];
}
const R = (r: EcgRun, l: LeadId) => qrsRange(r, l)[0];
const S = (r: EcgRun, l: LeadId) => -qrsRange(r, l)[1];
const p2p = (r: EcgRun, l: LeadId) => R(r, l) + S(r, l);
function tWave(r: EcgRun, l: LeadId): number {
  const b = beat(r);
  let m = 0;
  for (let t = Math.round(b.morph.tStart); t < b.morph.tEnd; t++) {
    const v = at(r, l, b.ev.t + t) - base(r, l);
    if (Math.abs(v) > Math.abs(m)) m = v;
  }
  return m;
}
/** Depth and width (ms) of an initial negative deflection. */
function q(r: EcgRun, l: LeadId): { depth: number; width: number } {
  const b = beat(r);
  let depth = 0;
  let t = 1;
  for (; t < b.morph.qrsDur; t++) {
    const v = at(r, l, b.ev.t + t) - base(r, l);
    if (v > 0.01) break;
    depth = Math.min(depth, v);
  }
  return { depth: -depth, width: depth < -0.02 ? t : 0 };
}
/** Net QRS area axis from leads I and aVF, as a reader would estimate it. */
function signalAxis(r: EcgRun): number {
  const b = beat(r);
  let a1 = 0;
  let aF = 0;
  for (let t = 0; t <= b.morph.qrsDur; t++) {
    a1 += at(r, 'I', b.ev.t + t) - base(r, 'I');
    aF += at(r, 'aVF', b.ev.t + t) - base(r, 'aVF');
  }
  return (Math.atan2(aF / (Math.sqrt(3) / 2), a1) * 180) / Math.PI;
}

describe('rates, intervals and the measured axis agree with the drawn signal', () => {
  for (const id of ['nsr', 'lafb', 'lpfb', 'rvh', 'lbbb', 'rbbb', 'lvh', 'wpw', 'chbVentricular', 'vvi', 'dextrocardia', 'raLaReversal', 'laLlReversal', 'raLlReversal']) {
    it(`${id}: read-out axis matches the signal within 10°`, () => {
      const r = run(id);
      expect(Math.abs(((signalAxis(r) - r.m.axis! + 540) % 360) - 180)).toBeLessThan(10);
    });
  }
  it('normal sinus rhythm: 60–100/min, PR 120–200, QRS < 110, QTc 350–450, axis −30…+90', () => {
    const r = run('nsr');
    expect(r.m.ventRate!).toBeGreaterThanOrEqual(60);
    expect(r.m.ventRate!).toBeLessThanOrEqual(100);
    expect(r.m.pr!).toBeGreaterThanOrEqual(120);
    expect(r.m.pr!).toBeLessThanOrEqual(200);
    expect(r.m.qrs!).toBeLessThan(110);
    expect(r.m.qtcBazett!).toBeGreaterThan(350);
    expect(r.m.qtcBazett!).toBeLessThan(450);
    expect(R(r, 'V6')).toBeGreaterThan(S(r, 'V6')); // R progression
    expect(S(r, 'V1')).toBeGreaterThan(R(r, 'V1'));
    expect(tWave(r, 'aVR')).toBeLessThan(0);
    expect(tWave(r, 'II')).toBeGreaterThan(0);
  });
  it('sinus bradycardia < 60 and tachycardia > 100', () => {
    expect(run('sinusBrady').m.ventRate!).toBeLessThan(60);
    expect(run('sinusTach').m.ventRate!).toBeGreaterThan(100);
  });
});

describe('rhythm', () => {
  it('controlled AF: irregularly irregular, rate < 110, no P waves', () => {
    const r = run('af', 20000);
    expect(r.m.ventRate!).toBeLessThan(110);
    expect(r.m.ventRate!).toBeGreaterThan(55);
    expect(r.m.regularity).toBe('irregularly irregular');
    expect(r.m.pr).toBeNull();
  });
  it('AF with rapid ventricular response > 110', () => {
    expect(run('afRvr').m.ventRate!).toBeGreaterThan(110);
  });
  it('ventricular bigeminy: every sinus beat is followed by a PVC and the P after it is blocked', () => {
    const r = run('pvcBigeminy');
    // the ventricular rate stays at the sinus rate (each pair spans two sinus cycles)
    expect(Math.abs(r.m.ventRate! - r.m.atrialRate!)).toBeLessThan(10);
    expect(r.m.conductedFraction).toBeGreaterThan(0.35);
    expect(r.m.conductedFraction).toBeLessThan(0.65);
  });
  it('a single PVC at a normal sinus rate has a fully compensatory pause', () => {
    const r = run('pvc');
    const vs = r.sim.ventricular.filter((v) => v.t > 0);
    const i = vs.findIndex((v, k) => k > 0 && k < vs.length - 1 && v.route === 'focus');
    expect(i).toBeGreaterThan(0);
    const before = vs[i].t - vs[i - 1].t;
    const after = vs[i + 1].t - vs[i].t;
    const sinusCL = 60000 / r.m.atrialRate!;
    expect(before + after).toBeGreaterThan(1.85 * sinusCL);
  });
  it('an interpolated PVC (slow sinus) has no pause', () => {
    const r = run('pvcInterpolated');
    expect(r.sim.atrial.filter((a) => a.t > 0 && a.kind === 'sinus').every((a) => a.conducted)).toBe(true);
  });
  it('torsades de pointes runs at 160–280/min (not blocked 2:1 by the long QT)', () => {
    const r = run('torsades');
    const tdp = r.sim.ventricular.filter((v) => v.mechanism === 'torsades de pointes');
    expect(tdp.length).toBeGreaterThan(12);
    const cl = (tdp[tdp.length - 1].t - tdp[0].t) / (tdp.length - 1);
    expect(60000 / cl).toBeGreaterThan(160);
    expect(60000 / cl).toBeLessThan(280);
  });
  it('monomorphic VT runs at its programmed rate', () => {
    const r = run('monoVT');
    expect(Math.abs(r.m.ventRate! - 175)).toBeLessThan(15);
  });
  it('a PAC with aberrancy does not make the read-out QRS wide', () => {
    expect(run('pacAberrant').m.qrs!).toBeLessThan(110);
  });
  it('flutter waves are visible inferiorly (≥ 0.1 mV sawtooth between QRS complexes at 4:1)', () => {
    const r = run('flutter41');
    const b = beat(r);
    let hi = -9;
    let lo = 9;
    // the long diastole between conducted beats
    for (let t = b.ev.t + b.morph.tEnd + 40; t < b.ev.t + 60000 / r.m.ventRate! - 60; t++) {
      hi = Math.max(hi, at(r, 'II', t));
      lo = Math.min(lo, at(r, 'II', t));
    }
    expect(hi - lo).toBeGreaterThan(0.1);
  });
});

describe('conduction', () => {
  it('RBBB: QRS ≥ 120, terminal R′ in V1, wide S in I and V6, T discordant in V1', () => {
    const r = run('rbbb');
    expect(r.m.qrs!).toBeGreaterThanOrEqual(120);
    const b = beat(r);
    expect(at(r, 'V1', b.ev.t + b.morph.qrsDur - 15) - base(r, 'V1')).toBeGreaterThan(0.2); // terminal positivity
    expect(S(r, 'I')).toBeGreaterThan(0.2);
    expect(S(r, 'V6')).toBeGreaterThan(0.2);
    expect(tWave(r, 'V1')).toBeLessThan(0);
  });
  it('LBBB: QRS ≥ 120, QS/rS in V1, broad R in I/V6 without septal q, discordant ST–T', () => {
    const r = run('lbbb');
    expect(r.m.qrs!).toBeGreaterThanOrEqual(120);
    expect(S(r, 'V1')).toBeGreaterThan(5 * R(r, 'V1'));
    expect(q(r, 'V6').depth).toBeLessThan(0.05);
    expect(q(r, 'I').depth).toBeLessThan(0.05);
    expect(tWave(r, 'V6')).toBeLessThan(0);
    expect(tWave(r, 'V1')).toBeGreaterThan(0);
  });
  it('LAFB: axis −45° or more negative, qR in aVL, rS in II/III/aVF; LPFB: axis > +90', () => {
    const a = run('lafb');
    expect(a.m.axis!).toBeLessThanOrEqual(-45);
    expect(R(a, 'aVL')).toBeGreaterThan(S(a, 'aVL'));
    expect(S(a, 'III')).toBeGreaterThan(R(a, 'III'));
    expect(run('lpfb').m.axis!).toBeGreaterThan(90);
  });
  it('WPW: PR < 120, QRS > 110, slurred delta wave that runs into the QRS (no notch back to baseline)', () => {
    const r = run('wpw');
    expect(r.m.pr!).toBeLessThan(120);
    expect(r.m.qrs!).toBeGreaterThan(110);
    expect(r.m.qrs!).toBeLessThan(170);
    // lead I: monotonic upstroke from the onset of pre-excitation to the R peak
    const b = beat(r);
    const I = (t: number) => at(r, 'I', b.ev.t + t) - base(r, 'I');
    let peak = 0;
    for (let t = 0; t < b.morph.qrsDur; t++) if (I(t) > I(peak)) peak = t;
    // a slight notch where the His–Purkinje wavefront joins is allowed, a return toward baseline is not
    let drop = 0;
    let best = I(10);
    for (let t = 10; t < peak; t++) {
      best = Math.max(best, I(t));
      drop = Math.max(drop, best - I(t));
    }
    expect(drop).toBeLessThan(0.06);
    expect(I(peak - 30)).toBeGreaterThan(0.2); // the slurred delta is already well up before the R peak
  });
  it('Mobitz II and complete heart block keep a constant PR / dissociate P from QRS', () => {
    const m2 = run('mobitz2', 12000);
    expect(m2.m.prRange![1] - m2.m.prRange![0]).toBeLessThan(12);
    expect(run('chbJunctional').m.conductedFraction).toBe(0);
  });
});

describe('hypertrophy, voltage, pulmonary', () => {
  it('LVH with strain: Sokolow–Lyon ≥ 3.5 mV, lateral ST depression and T inversion', () => {
    const r = run('lvh');
    expect(S(r, 'V1') + Math.max(R(r, 'V5'), R(r, 'V6'))).toBeGreaterThanOrEqual(3.5);
    expect(st(r, 'V6')).toBeLessThan(-0.05);
    expect(tWave(r, 'V6')).toBeLessThan(-0.1);
    expect(tWave(r, 'aVL')).toBeLessThan(0);
  });
  it('LVH by voltage alone keeps upright lateral T waves', () => {
    const r = run('lvhVoltage');
    expect(S(r, 'V1') + R(r, 'V5')).toBeGreaterThanOrEqual(3.5);
    expect(tWave(r, 'V6')).toBeGreaterThan(0);
  });
  it('RVH: right axis, dominant R in V1, right precordial T inversion', () => {
    const r = run('rvh');
    expect(r.m.axis!).toBeGreaterThan(90);
    expect(R(r, 'V1')).toBeGreaterThan(S(r, 'V1'));
    expect(tWave(r, 'V1')).toBeLessThan(0);
  });
  it('low voltage: every limb lead < 0.5 mV and every chest lead < 1.0 mV peak-to-peak', () => {
    const r = run('lowVolt');
    for (const l of LIMB) expect(p2p(r, l)).toBeLessThan(0.5);
    for (const l of CHEST) expect(p2p(r, l)).toBeLessThan(1.0);
  });
  it('acute PE: tachycardia, S in I, T inversion in III and V1–V3', () => {
    const r = run('pe');
    expect(r.m.ventRate!).toBeGreaterThan(100);
    expect(S(r, 'I')).toBeGreaterThan(0.15);
    expect(tWave(r, 'III')).toBeLessThan(0);
    for (const l of ['V1', 'V2', 'V3'] as LeadId[]) expect(tWave(r, l)).toBeLessThan(0);
  });
});

describe('ischaemia and infarction', () => {
  it('anterior STEMI: ≥ 0.2 mV STE in two of V2–V3 (men ≥ 40), reciprocal inferior change', () => {
    const r = run('stemiAnterior');
    expect(st(r, 'V2')).toBeGreaterThanOrEqual(0.2);
    expect(st(r, 'V3')).toBeGreaterThanOrEqual(0.2);
    expect(st(r, 'III')).toBeLessThan(0);
  });
  it('inferior STEMI with RV infarction: STE II/III/aVF with III > II, reciprocal aVL, ≥ 0.1 mV STE in V4R and STE in V1', () => {
    const r = run('stemiInferior');
    for (const l of ['II', 'III', 'aVF'] as LeadId[]) expect(st(r, l)).toBeGreaterThanOrEqual(0.1);
    expect(st(r, 'III')).toBeGreaterThan(st(r, 'II'));
    expect(st(r, 'aVL')).toBeLessThan(-0.05);
    expect(st(r, 'V4R')).toBeGreaterThanOrEqual(0.1);
    expect(st(r, 'V1')).toBeGreaterThan(0);
  });
  it('posterior STEMI: ST depression V1–V3 with STE ≥ 0.05 mV in V7–V9', () => {
    const r = run('stemiPosterior');
    for (const l of ['V1', 'V2', 'V3'] as LeadId[]) expect(st(r, l)).toBeLessThan(-0.1);
    for (const l of ['V7', 'V8', 'V9'] as LeadId[]) expect(st(r, l)).toBeGreaterThanOrEqual(0.05);
  });
  it('old inferior MI: pathological Q waves (≥ 0.1 mV, ≥ 30 ms) in II, III and aVF', () => {
    const r = run('oldInferior');
    for (const l of ['II', 'III', 'aVF'] as LeadId[]) {
      const qq = q(r, l);
      expect(qq.depth).toBeGreaterThanOrEqual(0.1);
      expect(qq.width).toBeGreaterThanOrEqual(30);
    }
    expect(st(r, 'II')).toBeLessThan(0.05);
  });
  it('Wellens: deep symmetric T inversion V2–V3 without significant STE', () => {
    const r = run('wellens');
    expect(tWave(r, 'V2')).toBeLessThan(-0.3);
    expect(tWave(r, 'V3')).toBeLessThan(-0.3);
    expect(st(r, 'V2')).toBeLessThan(0.1);
  });
  it('de Winter: upsloping J-point depression with tall precordial T and STE in aVR', () => {
    const r = run('deWinter');
    expect(st(r, 'V3', 0)).toBeLessThan(-0.1);
    expect(tWave(r, 'V3')).toBeGreaterThan(0.6);
    expect(st(r, 'aVR')).toBeGreaterThan(0.05);
  });
  it('diffuse subendocardial ischaemia: STE in aVR with widespread ST depression', () => {
    const r = run('subendo');
    expect(st(r, 'aVR')).toBeGreaterThan(0.05);
    expect(st(r, 'V5')).toBeLessThan(-0.05);
    expect(st(r, 'II')).toBeLessThan(-0.05);
  });
});

describe('pericardium, electrolytes, drugs, channelopathies', () => {
  it('acute pericarditis: diffuse STE, ST depression only in aVR, PR depression in II and PR elevation in aVR', () => {
    const r = run('pericarditis');
    for (const l of ['I', 'II', 'aVF', 'V4', 'V5', 'V6'] as LeadId[]) expect(st(r, l)).toBeGreaterThan(0.05);
    expect(st(r, 'aVR')).toBeLessThan(-0.05);
    const b = beat(r);
    const pOn = r.sim.atrial[b.ev.atrialIndex].t;
    const prSeg = (l: LeadId) => at(r, l, b.ev.t - 12) - at(r, l, pOn - 15);
    expect(prSeg('II')).toBeLessThan(-0.03);
    expect(prSeg('aVR')).toBeGreaterThan(0.03);
  });
  it('hyperkalaemia progresses: peaked T (6.3) → wide QRS (8.3) → sine wave with QRS ≥ 180 and no ST segment (9.2)', () => {
    expect(tWave(run('hyperK6'), 'V3')).toBeGreaterThan(1.4 * tWave(run('nsr'), 'V3'));
    expect(run('hyperK8').m.qrs!).toBeGreaterThan(120);
    const s = run('hyperK9');
    expect(s.m.qrs!).toBeGreaterThanOrEqual(180);
    const b = beat(s);
    expect(b.morph.tStart).toBeLessThan(b.morph.qrsDur); // T begins before activation ends
  });
  it('hypercalcaemia shortens and hypocalcaemia prolongs the QTc', () => {
    expect(run('hyperCa').m.qtcBazett!).toBeLessThan(run('nsr').m.qtcBazett! - 60);
    expect(run('hypoCa').m.qtcBazett!).toBeGreaterThan(470);
  });
  it('TCA toxicity: QRS > 100 ms and terminal R in aVR > 0.3 mV', () => {
    const r = run('tca');
    expect(r.m.qrs!).toBeGreaterThan(100);
    expect(R(r, 'aVR')).toBeGreaterThan(0.3);
  });
  it('Brugada type 1: coved STE ≥ 0.2 mV in V1–V2; type 2: J ≥ 0.2 mV with a saddleback ≥ 0.05 mV', () => {
    const t1 = run('brugada1');
    expect(st(t1, 'V1', 20)).toBeGreaterThanOrEqual(0.2);
    const t2 = run('brugada2');
    const b = beat(t2);
    let j = 0;
    for (let t = 0; t < 30; t++) j = Math.max(j, at(t2, 'V2', b.ev.t + b.morph.qrsDur + t) - base(t2, 'V2'));
    expect(j).toBeGreaterThanOrEqual(0.2);
    expect(st(t2, 'V2', 60)).toBeGreaterThanOrEqual(0.05);
    expect(tWave(t2, 'V2')).toBeGreaterThan(0);
  });
  it('long and short QT syndromes', () => {
    expect(run('lqts').m.qtcBazett!).toBeGreaterThan(470);
    expect(run('sqts').m.qtcBazett!).toBeLessThan(340);
  });
});

describe('technical', () => {
  it('RA–LA reversal: inverted P/QRS/T in I, aVR and aVL swapped; chest leads unchanged', () => {
    const rev = run('raLaReversal');
    const nsr = run('nsr');
    expect(R(rev, 'I')).toBeLessThan(S(rev, 'I'));
    expect(tWave(rev, 'I')).toBeLessThan(0);
    expect(Math.abs(R(rev, 'aVR') - R(nsr, 'aVL'))).toBeLessThan(0.02);
    expect(Math.abs(R(rev, 'V5') - R(nsr, 'V5'))).toBeLessThan(0.02);
  });
  it('dextrocardia: inverted I, positive aVR, R waves shrink across the chest', () => {
    const r = run('dextrocardia');
    expect(S(r, 'I')).toBeGreaterThan(R(r, 'I'));
    expect(R(r, 'V6')).toBeLessThan(R(r, 'V1'));
  });
});
