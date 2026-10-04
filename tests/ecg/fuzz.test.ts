// Robustness: any combination of settings the simulator exposes must produce a finite ECG and
// self-consistent measurements, without throwing or hanging.
import { describe, expect, it } from 'vitest';
import { makePhysio, runEcg } from '../../src/ecg/engine';
import { PRESETS } from '../../src/ecg/engine/presets';
import { applyPatch, type Physio } from '../../src/ecg/engine/params';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const pick = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
const between = (r: () => number, lo: number, hi: number) => lo + (hi - lo) * r();

function randomPhysio(r: () => number): Physio {
  const base = makePhysio(PRESETS[pick(r, Object.keys(PRESETS))].patch);
  const p = applyPatch(base, {
    autonomic: between(r, -1, 1),
    K: r() < 0.3 ? between(r, 2, 9.5) : base.K,
    Ca: r() < 0.2 ? between(r, 1.4, 3.8) : base.Ca,
    Mg: r() < 0.2 ? between(r, 0.3, 3) : base.Mg,
    lvMass: r() < 0.3 ? between(r, 0.7, 2.4) : base.lvMass,
    rvMass: r() < 0.3 ? between(r, 0.7, 3.5) : base.rvMass,
    ventricularCV: r() < 0.3 ? between(r, 0.4, 1.5) : base.ventricularCV,
    axisShift: r() < 0.3 ? between(r, -180, 180) : base.axisShift,
    qtcBase: r() < 0.3 ? between(r, 280, 600) : base.qtcBase,
    hypothermia: r() < 0.1 ? r() : base.hypothermia,
    lowVoltage: r() < 0.1 ? r() : base.lowVoltage,
    bundle: r() < 0.25 ? pick(r, ['normal', 'rbbb', 'incompleteRbbb', 'lbbb', 'lafb', 'lpfb', 'rbbb+lafb', 'rbbb+lpfb', 'ivcd'] as const) : base.bundle,
    drugs: {
      betaBlocker: r() < 0.2 ? r() : base.drugs.betaBlocker,
      ccb: r() < 0.2 ? r() : base.drugs.ccb,
      digoxin: r() < 0.2 ? between(r, 0, 1.5) : base.drugs.digoxin,
      naBlocker: r() < 0.2 ? r() : base.drugs.naBlocker,
      qtDrug: r() < 0.2 ? r() : base.drugs.qtDrug,
      amiodarone: r() < 0.2 ? r() : base.drugs.amiodarone,
    },
    rhythm: {
      seed: Math.floor(r() * 1000),
      sinusRate: r() < 0.3 ? between(r, 20, 180) : base.rhythm.sinusRate,
      avnERP: r() < 0.3 ? between(r, 80, 700) : base.rhythm.avnERP,
      vtRate: r() < 0.3 ? between(r, 100, 320) : base.rhythm.vtRate,
      flutterCL: r() < 0.2 ? between(r, 160, 320) : base.rhythm.flutterCL,
    },
  });
  return p;
}

describe('random settings never break the simulator', () => {
  const r = rng(20261004);
  for (let k = 0; k < 160; k++) {
    const p = randomPhysio(r);
    it(`case ${k}`, () => {
      const t0 = performance.now();
      const run = runEcg(p, 8000);
      expect(performance.now() - t0).toBeLessThan(10000);
      for (const a of Object.values(run.sig.leads)) for (const v of a!) expect(Number.isFinite(v)).toBe(true);
      const m = run.m;
      if (m.ventRate !== null) {
        expect(m.ventRate).toBeGreaterThan(5);
        expect(m.ventRate).toBeLessThan(400);
      }
      if (m.qrs !== null) {
        expect(m.qrs).toBeGreaterThan(40);
        expect(m.qrs).toBeLessThan(400);
      }
      if (m.qt !== null && m.qrs !== null) expect(m.qt).toBeGreaterThan(m.qrs);
      if (m.pr !== null) expect(m.pr).toBeGreaterThan(0);
      for (const b of run.sig.beats) {
        expect(b.morph.tEnd).toBeGreaterThan(b.morph.qrsDur);
        expect(Number.isFinite(b.morph.qt)).toBe(true);
      }
    });
  }
});
