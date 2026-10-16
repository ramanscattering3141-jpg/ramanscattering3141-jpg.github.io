// The 3-D heart's activation sequences must match textbook electrophysiology (Durrer 1970 for the
// normal sequence; the bundle-branch, pre-excitation and scar patterns the ECG engine draws).

import { describe, expect, it } from 'vitest';
import { makePhysio, runEcg, type EcgRun } from '../../src/ecg/engine';
import { PRESETS } from '../../src/ecg/engine/presets';
import { Region, len, sub } from '../../src/ecg/ui/heart/anatomy';
import { computeAnatomy, computeMap, computeZones } from '../../src/ecg/ui/heart/compute';
import { apInsertion, NEVER, voxelPos, type Grid } from '../../src/ecg/ui/heart/volume';

const run = (id: string): EcgRun => runEcg(makePhysio({ ...PRESETS[id].patch, noise: 0 }), 5000);
const firstBeat = (r: EcgRun): number => r.sig.beats.findIndex((b) => b.ev.t > 400 && b.ev.mechanism !== 'pvc');

function stats(r: EcgRun, index: number): { g: Grid; data: Float32Array; mean: (reg: Region) => number; min: (reg: Region) => number; max: number } {
  const { grid: g } = computeAnatomy(r.physio);
  const zones = computeZones(r);
  const m = computeMap(r, { key: 'x', kind: 'v', index }, zones);
  const agg = new Map<number, number[]>();
  for (let n = 0; n < g.solid.length; n++) {
    if (!g.solid[n] || m.data[n * 2] >= NEVER) continue;
    const a = agg.get(g.region[n]) ?? [];
    a.push(m.data[n * 2]);
    agg.set(g.region[n], a);
  }
  const mean = (reg: Region): number => {
    const a = agg.get(reg) ?? [];
    return a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  };
  const min = (reg: Region): number => Math.min(...(agg.get(reg) ?? [Infinity]));
  return { g, data: m.data, mean, min, max: m.maxAct };
}

describe('3-D heart anatomy', () => {
  it('builds a closed myocardium mesh with plausible chamber wall volumes', () => {
    const { grid: g, result } = computeAnatomy(makePhysio({}));
    expect(result.mesh.pos.length / 3).toBeGreaterThan(10000);
    const vol = new Map<number, number>();
    for (let n = 0; n < g.solid.length; n++) if (g.solid[n]) vol.set(g.region[n], (vol.get(g.region[n]) ?? 0) + g.h ** 3);
    const lv = (vol.get(Region.LVFree) ?? 0) + (vol.get(Region.Septum) ?? 0);
    const rv = (vol.get(Region.RVFree) ?? 0) + (vol.get(Region.RVOT) ?? 0);
    expect(lv).toBeGreaterThan(70);
    expect(lv).toBeLessThan(220);
    expect(rv).toBeGreaterThan(15);
    expect(rv).toBeLessThan(lv / 1.5);
    expect(vol.get(Region.RA) ?? 0).toBeGreaterThan(5);
    expect(vol.get(Region.LA) ?? 0).toBeGreaterThan(5);
  });
});

describe('3-D heart activation sequence', () => {
  it('normal: the left septal surface is activated first and the whole sequence lasts one QRS', () => {
    const r = run('nsr');
    const bi = firstBeat(r);
    const s = stats(r, bi);
    expect(s.min(Region.Septum)).toBeLessThanOrEqual(Math.min(s.min(Region.LVFree), s.min(Region.RVFree)));
    expect(s.max).toBeGreaterThan(r.sig.beats[bi].morph.qrsDur * 0.85);
    expect(s.max).toBeLessThanOrEqual(r.sig.beats[bi].morph.qrsDur);
  });
  it('LBBB: the LV free wall is activated well after the RV free wall', () => {
    const r = run('lbbb');
    const s = stats(r, firstBeat(r));
    expect(s.mean(Region.LVFree) - s.mean(Region.RVFree)).toBeGreaterThan(15);
  });
  it('RBBB: the RV free wall is activated after the LV free wall', () => {
    const r = run('rbbb');
    const s = stats(r, firstBeat(r));
    expect(s.mean(Region.RVFree)).toBeGreaterThan(s.mean(Region.LVFree));
  });
  it('WPW: the earliest ventricular activation is at the accessory-pathway insertion', () => {
    const r = run('wpw');
    const bi = r.sig.beats.findIndex((b) => b.ev.t > 400 && b.ev.route === 'ap');
    const s = stats(r, bi);
    let best = -1;
    let bt = Infinity;
    for (let n = 0; n < s.g.solid.length; n++) if (s.g.solid[n] && s.data[n * 2] < bt) ((bt = s.data[n * 2]), (best = n));
    const k = Math.floor(best / (s.g.nx * s.g.ny));
    const j = Math.floor((best - k * s.g.nx * s.g.ny) / s.g.nx);
    const i = best - j * s.g.nx - k * s.g.nx * s.g.ny;
    const { A } = computeAnatomy(r.physio);
    expect(len(sub(voxelPos(s.g, i, j, k), apInsertion(A, r.physio.rhythm.ap.location)))).toBeLessThan(1.5);
  });
  it('old infarct: scar is never activated', () => {
    const r = run('oldInferior');
    const zones = computeZones(r);
    const s = stats(r, firstBeat(r));
    let scar = 0;
    for (let n = 0; n < zones.length; n++) {
      if (zones[n] !== 2 || !s.g.solid[n]) continue;
      scar++;
      expect(s.data[n * 2]).toBeGreaterThanOrEqual(NEVER);
    }
    expect(scar).toBeGreaterThan(100);
  });
  it('sinus P wave: the right atrium is activated before the left', () => {
    const r = run('nsr');
    const ai = r.sim.atrial.findIndex((a) => a.t > 400);
    const { grid: g } = computeAnatomy(r.physio);
    const m = computeMap(r, { key: 'a', kind: 'a', index: ai }, computeZones(r));
    const mean = (reg: Region): number => {
      let s = 0;
      let c = 0;
      for (let n = 0; n < g.solid.length; n++) if (g.solid[n] && g.region[n] === reg && m.data[n * 2] < NEVER) ((s += m.data[n * 2]), c++);
      return s / Math.max(1, c);
    };
    expect(mean(Region.LA)).toBeGreaterThan(mean(Region.RA) + 10);
  });
});
