import { describe, expect, it } from 'vitest';
import { makePhysio, runEcg, type EcgRun, type LeadId } from '../../src/ecg/engine';
import { PRESETS } from '../../src/ecg/engine/presets';
import type { PhysioPatch } from '../../src/ecg/engine/params';
import { BRUGADA_WCT, VERECKEI_AVR, chadsAdvice, chadsVasc, qtc, runWct, sgarbossa } from '../../src/ecg/content/calculators';
import { GLOSSARY } from '../../src/ecg/content/glossary';
import { PATH } from '../../src/ecg/pages/path';
import { resolveDx, search } from '../../src/ecg/content/index';

const ALL: LeadId[] = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V4R', 'V7', 'V8', 'V9'];
const run = (id: string, extra: PhysioPatch = {}): EcgRun => runEcg(makePhysio({ ...PRESETS[id].patch, noise: 0, ...extra }), 8000, ALL);

function mid(r: EcgRun) {
  const his = r.sig.beats.filter((b) => b.ev.route === 'his');
  return his[Math.floor(his.length / 2)];
}
const base = (r: EcgRun, l: LeadId): number => r.sig.leads[l]![Math.round(mid(r).ev.t - 25)];
/** Deviation (mV) at J + off ms. */
const st = (r: EcgRun, l: LeadId, off = 60): number => r.sig.leads[l]![Math.round(mid(r).ev.t + mid(r).morph.qrsDur + off)] - base(r, l);
/** Largest-magnitude T-wave deflection. */
function tPeak(r: EcgRun, l: LeadId): number {
  const b = mid(r);
  let m = 0;
  for (let t = Math.round(b.morph.tStart); t < b.morph.tEnd; t++) {
    const v = r.sig.leads[l]![Math.round(b.ev.t + t)] - base(r, l);
    if (Math.abs(v) > Math.abs(m)) m = v;
  }
  return m;
}
/** Most negative deflection in the first `win` ms of the QRS (initial q). */
function initialMin(r: EcgRun, l: LeadId, win = 20): number {
  const b = mid(r);
  let m = 0;
  for (let t = 0; t < win; t++) m = Math.min(m, r.sig.leads[l]![Math.round(b.ev.t + t)] - base(r, l));
  return m;
}
function rMax(r: EcgRun, l: LeadId): number {
  const b = mid(r);
  let m = 0;
  for (let t = 0; t < b.morph.qrsDur; t++) m = Math.max(m, r.sig.leads[l]![Math.round(b.ev.t + t)] - base(r, l));
  return m;
}
const maxAbsDiff = (a: Float32Array, b: Float32Array, sign = 1): number => {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - sign * b[i]));
  return m;
};

describe('posterior leads', () => {
  it('posterior STEMI: ST depression V1–V3 and ST elevation ≥ 0.5 mm in V7–V9', () => {
    const r = run('stemiPosterior');
    for (const l of ['V1', 'V2', 'V3'] as LeadId[]) expect(st(r, l), l).toBeLessThan(-0.1);
    for (const l of ['V7', 'V8', 'V9'] as LeadId[]) expect(st(r, l), l).toBeGreaterThanOrEqual(0.05);
  });
  it('normal ECG: posterior leads have smaller R waves than V6 and a flat ST', () => {
    const r = run('nsr');
    expect(rMax(r, 'V9')).toBeLessThan(rMax(r, 'V6'));
    for (const l of ['V7', 'V8', 'V9'] as LeadId[]) expect(Math.abs(st(r, l))).toBeLessThan(0.02);
  });
});

describe('cardiomyopathies', () => {
  it('HCM: deep narrow lateral Q waves and high voltage, QRS not wide', () => {
    const n = run('nsr');
    const r = run('hcm');
    expect(initialMin(r, 'V6')).toBeLessThan(-0.3);
    expect(initialMin(r, 'I')).toBeLessThan(-0.2);
    expect(initialMin(n, 'V6')).toBeGreaterThan(-0.15);
    expect(rMax(r, 'V1')).toBeGreaterThan(2 * rMax(n, 'V1'));
    expect(r.m.qrs!).toBeLessThan(110);
  });
  it('ARVC: T inversion V1–V3 with upright T in V5–V6, and an epsilon local term', () => {
    const r = run('arvc');
    for (const l of ['V1', 'V2', 'V3'] as LeadId[]) expect(tPeak(r, l), l).toBeLessThan(0);
    for (const l of ['V5', 'V6'] as LeadId[]) expect(tPeak(r, l), l).toBeGreaterThan(0);
    expect(mid(r).morph.local.some((t) => t.kind === 'epsilon')).toBe(true);
  });
  it('Takotsubo: deep widespread T inversion, upright T in aVR, long QTc', () => {
    const r = run('takotsubo');
    for (const l of ['II', 'aVF', 'V2', 'V3', 'V4', 'V5'] as LeadId[]) expect(tPeak(r, l), l).toBeLessThan(-0.1);
    expect(tPeak(r, 'aVR')).toBeGreaterThan(0.1);
    expect(r.m.qtcFridericia!).toBeGreaterThan(470);
  });
  it('athlete: sinus bradycardia, first-degree AV block, narrow QRS', () => {
    const r = run('athlete');
    expect(r.m.ventRate!).toBeLessThan(55);
    expect(r.m.pr!).toBeGreaterThan(200);
    expect(r.m.qrs!).toBeLessThan(120);
  });
  it('CPVT: sinus rhythm first, then bidirectional VT', () => {
    const r = run('cpvt');
    expect(r.sim.ventricular[0].mechanism).toBe('conducted');
    expect(r.sim.ventricular.filter((v) => v.mechanism === 'bidirectional VT').length).toBeGreaterThan(5);
  });
});

describe('occlusion-MI look-alikes', () => {
  it('de Winter: J-point depression V2–V5, tall precordial T, STE in aVR', () => {
    const r = run('deWinter');
    for (const l of ['V2', 'V3', 'V4', 'V5'] as LeadId[]) expect(st(r, l, 5), l).toBeLessThan(-0.08);
    for (const l of ['V2', 'V3', 'V4'] as LeadId[]) expect(tPeak(r, l), l).toBeGreaterThan(0.8);
    expect(st(r, 'aVR', 5)).toBeGreaterThan(0.04);
  });
  it('LV aneurysm: QS waves with persistent anterior STE and small T', () => {
    const r = run('lvAneurysm');
    for (const l of ['V2', 'V3'] as LeadId[]) {
      expect(initialMin(r, l, 30), l).toBeLessThan(-0.4);
      expect(st(r, l), l).toBeGreaterThan(0.15);
    }
    expect(tPeak(r, 'V3')).toBeLessThan(rMax(run('nsr'), 'V3'));
  });
});

describe('heart position, cable reversal and artefact', () => {
  const n = run('nsr');
  it('RA/LA reversal inverts lead I, swaps II/III and aVR/aVL, leaves aVF and chest leads untouched', () => {
    const r = run('raLaReversal');
    const L = r.sig.leads;
    const N = n.sig.leads;
    expect(maxAbsDiff(L.I!, N.I!, -1)).toBeLessThan(1e-4);
    expect(maxAbsDiff(L.II!, N.III!)).toBeLessThan(1e-4);
    expect(maxAbsDiff(L.aVR!, N.aVL!)).toBeLessThan(1e-4);
    expect(maxAbsDiff(L.aVF!, N.aVF!)).toBeLessThan(1e-4);
    for (const l of ['V1', 'V3', 'V6'] as LeadId[]) expect(maxAbsDiff(L[l]!, N[l]!), l).toBeLessThan(1e-4);
    // The heart itself is unchanged, so model measurements are unchanged.
    expect(r.m.axis).toBe(n.m.axis);
  });
  it('LA/LL reversal: I ↔ II, III inverted, aVR unchanged', () => {
    const r = run('laLlReversal');
    expect(maxAbsDiff(r.sig.leads.I!, n.sig.leads.II!)).toBeLessThan(1e-4);
    expect(maxAbsDiff(r.sig.leads.III!, n.sig.leads.III!, -1)).toBeLessThan(1e-4);
    expect(maxAbsDiff(r.sig.leads.aVR!, n.sig.leads.aVR!)).toBeLessThan(1e-4);
  });
  it('dextrocardia: lead I inverted, R waves shrink from V1 to V6, right axis', () => {
    const r = run('dextrocardia');
    expect(maxAbsDiff(r.sig.leads.I!, n.sig.leads.I!, -1)).toBeLessThan(1e-4);
    expect(rMax(r, 'V6')).toBeLessThan(rMax(r, 'V1'));
    expect(rMax(n, 'V6')).toBeGreaterThan(rMax(n, 'V1'));
    expect(r.m.axis!).toBeGreaterThan(90);
  });
  it('RA motion artefact spares lead III and leaves the rhythm measurements unchanged', () => {
    const r = run('artifactMotion', { noise: 0 });
    expect(maxAbsDiff(r.sig.leads.III!, n.sig.leads.III!)).toBeLessThan(1e-4);
    expect(maxAbsDiff(r.sig.leads.II!, n.sig.leads.II!)).toBeGreaterThan(0.5);
    // One-third of the electrode signal appears in every chest lead.
    const ratio = maxAbsDiff(r.sig.leads.V2!, n.sig.leads.V2!) / maxAbsDiff(r.sig.leads.II!, n.sig.leads.II!);
    expect(ratio).toBeGreaterThan(0.3);
    expect(ratio).toBeLessThan(0.37);
    expect(r.m.regularity).toBe('regular');
    expect(r.m.ventRate).toBe(n.m.ventRate);
  });
  it('LA tremor spares lead II', () => {
    const r = run('artifactTremor', { noise: 0 });
    expect(maxAbsDiff(r.sig.leads.II!, n.sig.leads.II!)).toBeLessThan(1e-4);
    expect(maxAbsDiff(r.sig.leads.I!, n.sig.leads.I!)).toBeGreaterThan(0.1);
  });
});

describe('clinical calculators', () => {
  it('QTc formulas agree at 60/min and diverge at fast rates', () => {
    const a = qtc(400, 60);
    expect([a.bazett, a.fridericia, a.framingham, a.hodges]).toEqual([400, 400, 400, 400]);
    const b = qtc(320, 120);
    expect(b.bazett).toBe(453);
    expect(b.fridericia).toBe(403);
    expect(b.framingham).toBe(397);
    expect(b.hodges).toBe(425);
  });
  it('CHA₂DS₂-VASc and CHA₂DS₂-VA', () => {
    const base = { chf: false, htn: false, age: 50, dm: false, strokeTia: false, vascular: false, female: false };
    expect(chadsVasc(base)).toEqual({ vasc: 0, va: 0 });
    expect(chadsVasc({ ...base, female: true })).toEqual({ vasc: 1, va: 0 });
    expect(chadsVasc({ ...base, age: 70 }).vasc).toBe(1);
    expect(chadsVasc({ ...base, age: 80, strokeTia: true, htn: true, female: true })).toEqual({ vasc: 6, va: 5 });
    // Sex alone does not trigger anticoagulation; 2 non-sex points do.
    expect(chadsAdvice({ ...base, female: true }).acc).toMatch(/Low risk/);
    expect(chadsAdvice({ ...base, htn: true, dm: true }).acc).toMatch(/recommended/);
    expect(chadsAdvice({ ...base, htn: true, female: true }).acc).toMatch(/reasonable/);
    expect(chadsAdvice({ ...base, htn: true }).esc).toMatch(/considered/);
  });
  it('Sgarbossa score and Smith ratio', () => {
    expect(sgarbossa({ concordantSTE: true, concordantSTDV1V3: false, discordantSTE5: false }).original).toBe(true);
    expect(sgarbossa({ concordantSTE: false, concordantSTDV1V3: false, discordantSTE5: true }).score).toBe(2);
    const s = sgarbossa({ concordantSTE: false, concordantSTDV1V3: false, discordantSTE5: false, discordantST: 5, discordantRS: -15 });
    expect(s.smithRatio!).toBeCloseTo(-0.333, 2);
    expect(s.smith).toBe(true);
    expect(sgarbossa({ concordantSTE: false, concordantSTDV1V3: false, discordantSTE5: false, discordantST: 3, discordantRS: -20 }).smith).toBe(false);
  });
  it('WCT algorithms stop at the first VT criterion', () => {
    expect(BRUGADA_WCT).toHaveLength(4);
    expect(VERECKEI_AVR).toHaveLength(4);
    expect(runWct(BRUGADA_WCT, [false, true])).toEqual({ result: 'VT', stoppedAt: 1 });
    expect(runWct(VERECKEI_AVR, [false, false, false, false]).result).toBe('SVT with aberrancy');
    expect(runWct(VERECKEI_AVR, [false]).result).toBe('incomplete');
  });
});

describe('glossary, learning path and search', () => {
  it('glossary ids are unique and every link targets a known route', () => {
    const ids = GLOSSARY.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of GLOSSARY) {
      if (!g.see) continue;
      const m = g.see.match(/^#\/dx\/(.+)$/);
      if (m) expect(resolveDx(m[1]), g.see).toBeDefined();
      else expect(g.see).toMatch(/^#\/(fundamentals|physiology|simulator|rhythms|conduction|ischemia|sandbox|tools|ddx)/);
    }
  });
  it('every learning-path diagnosis exists', () => {
    for (const s of PATH) for (const id of s.dx) expect(resolveDx(id), id).toBeDefined();
  });
  it('search finds the new tools, diagnoses and glossary terms', () => {
    const ids = (q: string): string[] => search(q).map((h) => h.id);
    expect(ids('qtc')).toContain('tools-qtc');
    expect(ids('lead reversal')).toContain('leadReversal');
    expect(ids('dextrocardia')).toContain('dextrocardia');
    expect(ids('de winter')).toContain('deWinter');
    expect(ids('hcm')).toContain('hcm');
    expect(ids('epsilon wave')).toContain('term-epsilon');
    expect(ids('sgarbossa')).toContain('tools-sgarbossa');
  });
});
