import { describe, expect, it } from 'vitest';
import { makePhysio, runEcg } from '../../src/ecg/engine';
import { PRESETS } from '../../src/ecg/engine/presets';
import { simulateHemo, type HemoResult } from '../../src/ecg/engine/hemo';

const cache = new Map<string, HemoResult>();
function hemo(preset: string): HemoResult {
  let h = cache.get(preset);
  if (!h) {
    h = simulateHemo(runEcg(makePhysio(PRESETS[preset].patch), 10000));
    cache.set(preset, h);
  }
  return h;
}
/** Mean A2→P2 interval (ms); negative = reversed splitting. */
function split(h: HemoResult): number {
  const a2 = h.sounds.filter((s) => s.component === 'A2' && s.t > 1000);
  const d: number[] = [];
  for (const a of a2) {
    const p2 = h.sounds.find((s) => s.component === 'P2' && Math.abs(s.t - a.t) < 150);
    if (p2) d.push(p2.t - a.t);
  }
  return d.reduce((x, y) => x + y, 0) / Math.max(1, d.length);
}

describe('haemodynamics model', () => {
  it('normal sinus rhythm gives normal resting values', () => {
    const s = hemo('nsr').summary;
    expect(s.sbp).toBeGreaterThanOrEqual(105);
    expect(s.sbp).toBeLessThanOrEqual(135);
    expect(s.dbp).toBeGreaterThanOrEqual(60);
    expect(s.dbp).toBeLessThanOrEqual(85);
    expect(s.ef).toBeGreaterThanOrEqual(52);
    expect(s.ef).toBeLessThanOrEqual(70);
    expect(s.co).toBeGreaterThanOrEqual(4);
    expect(s.co).toBeLessThanOrEqual(7.5);
    expect(s.lvedp).toBeLessThanOrEqual(16);
    expect(s.rap).toBeLessThanOrEqual(8);
    expect(s.pasp).toBeLessThanOrEqual(32);
    expect(s.pulseDeficit).toBe(0);
  });

  it('aortic valve closure (A2) falls near the end of the T wave in sinus rhythm', () => {
    const run = runEcg(makePhysio(PRESETS.nsr.patch), 10000);
    const h = simulateHemo(run);
    for (const b of run.sig.beats.filter((x) => x.ev.t > 1500 && x.ev.t < 8500)) {
      const a2 = h.valveEvents.find((e) => e.valve === 'aortic' && e.kind === 'close' && e.t > b.ev.t);
      expect(a2).toBeDefined();
      expect(Math.abs(a2!.t - (b.ev.t + b.morph.tEnd))).toBeLessThan(45);
      const ao = h.valveEvents.find((e) => e.valve === 'aortic' && e.kind === 'open' && e.t > b.ev.t)!;
      // Pre-ejection period ≈ 80–130 ms in normal adults.
      expect(ao.t - b.ev.t).toBeGreaterThan(70);
      expect(ao.t - b.ev.t).toBeLessThan(135);
    }
  });

  it('S2 splitting: physiological in NSR, wide in RBBB, reversed in LBBB and RV pacing', () => {
    expect(split(hemo('nsr'))).toBeGreaterThan(5);
    expect(split(hemo('nsr'))).toBeLessThan(45);
    expect(split(hemo('rbbb'))).toBeGreaterThan(45);
    expect(split(hemo('lbbb'))).toBeLessThan(-12);
    expect(split(hemo('vvi'))).toBeLessThan(-5);
  });

  it('AF removes atrial contraction (no S4, no atrial-systole phase)', () => {
    const h = hemo('af');
    expect(h.sounds.some((s) => s.kind === 'S4')).toBe(false);
    expect(h.phase.includes('atrialSystole')).toBe(false);
    expect(h.notes.join(' ')).toMatch(/no a wave/);
  });

  it('complete heart block produces cannon a waves and AV dissociation of S1 intensity', () => {
    const h = hemo('chbVentricular');
    expect(h.notes.join(' ')).toMatch(/cannon a waves/);
    expect(h.notes.join(' ')).toMatch(/Variable intensity of S1/);
  });

  it('VF has no output; polymorphic VT is hypotensive with a pulse deficit', () => {
    const vf = hemo('vf').summary;
    expect(vf.co).toBe(0);
    expect(vf.pulseRate).toBe(0);
    const pvt = hemo('polyVT').summary;
    expect(pvt.sbp).toBeLessThan(95);
    expect(pvt.pulseDeficit).toBeGreaterThan(0);
  });

  it('every preset produces finite values and a physically consistent volume', () => {
    for (const id of Object.keys(PRESETS)) {
      const h = hemo(id);
      for (const arr of [h.lvP, h.aoP, h.laP, h.rvP, h.paP, h.raP, h.lvV, h.rvV]) {
        for (let i = 0; i < arr.length; i += 97) expect(Number.isFinite(arr[i])).toBe(true);
      }
      expect(h.summary.ef).toBeLessThanOrEqual(85);
      expect(h.summary.sbp).toBeLessThan(200);
    }
  });
});
