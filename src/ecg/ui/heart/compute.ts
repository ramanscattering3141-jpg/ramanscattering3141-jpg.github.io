// Heavy geometry/activation work for the 3-D heart, shared by the Web Worker and the synchronous
// fallback. Inputs and outputs are plain data (structured-clone friendly).

import type { EcgRun } from '../../engine';
import type { Physio } from '../../engine/params';
import { buildAnatomy, type Anatomy } from './anatomy';
import { atrialMap, buildGrid, ischaemiaZones, ventricularMap, type Grid, type MeshData } from './volume';

export interface GridMeta {
  nx: number;
  ny: number;
  nz: number;
  h: number;
  min: [number, number, number];
}

export interface AnatomyResult {
  key: string;
  meta: GridMeta;
  mesh: MeshData;
  /** Per voxel RGBA8: region, (zone — filled per run), coronary territory, AHA segment. */
  info: Uint8Array;
  depth: Float32Array;
  near: Int32Array;
}

/** A beat reduced to what the activation solver needs (no ECG samples). */
export interface BeatJob {
  key: string;
  kind: 'v' | 'a';
  /** Index into run.sig.beats (ventricular) or run.sim.atrial (atrial). */
  index: number;
}

export interface MapResult {
  key: string;
  kind: 'v' | 'a';
  data: Float32Array;
  half: Uint16Array;
  maxAct: number;
}

const anatomyCache = new Map<string, { A: Anatomy; grid: Grid; result: AnatomyResult }>();

export function anatomyKey(p: Physio): string {
  return buildAnatomyKey(p);
}
function buildAnatomyKey(p: Physio): string {
  const c = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x));
  return [Math.pow(c(p.lvMass, 0.7, 2.6), 0.75), Math.pow(c(p.rvMass, 0.7, 3.5), 0.6), 1 + 0.35 * c(p.rvStrain, 0, 1) + 0.08 * Math.max(0, p.rvMass - 1), Math.pow(c(p.raSize, 0.7, 2.5), 0.35), Math.pow(c(p.laSize, 0.7, 2.5), 0.35), c(p.hcm ?? 0, 0, 1)].map((x) => x.toFixed(3)).join('|');
}

export function computeAnatomy(p: Physio): { A: Anatomy; grid: Grid; result: AnatomyResult } {
  const key = buildAnatomyKey(p);
  const hit = anatomyCache.get(key);
  if (hit) return hit;
  const A = buildAnatomy(p);
  const { grid, mesh } = buildGrid(A);
  const N = grid.region.length;
  const info = new Uint8Array(N * 4);
  for (let n = 0; n < N; n++) {
    info[n * 4] = grid.region[n];
    info[n * 4 + 2] = grid.cor[n];
    info[n * 4 + 3] = grid.seg[n];
  }
  const result: AnatomyResult = { key, meta: { nx: grid.nx, ny: grid.ny, nz: grid.nz, h: grid.h, min: grid.min }, mesh, info, depth: grid.depth, near: grid.near };
  const out = { A, grid, result };
  anatomyCache.set(key, out);
  if (anatomyCache.size > 4) anatomyCache.delete(anatomyCache.keys().next().value!);
  return out;
}

/** Ischaemic zones for this run: 1 injured, 2 scar (per voxel). */
export function computeZones(run: EcgRun): Uint8Array {
  const { A, grid } = computeAnatomy(run.physio);
  const z = ischaemiaZones(A, grid, run);
  const out = new Uint8Array(grid.region.length);
  for (let n = 0; n < out.length; n++) {
    const src = grid.near[n];
    if (src < 0) continue;
    out[n] = z.scar[src] ? 2 : z.injured[src] ? 1 : 0;
  }
  return out;
}

export function computeMap(run: EcgRun, job: BeatJob, zones: Uint8Array): MapResult {
  const { A, grid } = computeAnatomy(run.physio);
  let data: Float32Array;
  let maxAct: number;
  if (job.kind === 'v') {
    const scar = new Uint8Array(zones.length);
    const injured = new Uint8Array(zones.length);
    for (let n = 0; n < zones.length; n++) {
      if (zones[n] === 2) scar[n] = 1;
      else if (zones[n] === 1) injured[n] = 1;
    }
    ({ data, maxAct } = ventricularMap(A, grid, run, run.sig.beats[job.index], { scar, injured }));
  } else ({ data, maxAct } = atrialMap(A, grid, run, run.sim.atrial[job.index]));
  return { key: job.key, kind: job.kind, data, half: toHalf(data), maxAct };
}

// Float32 → IEEE half (round to nearest), for RG16F textures with linear filtering.
const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);
function toHalfOne(v: number): number {
  f32[0] = v;
  const x = u32[0];
  const sign = (x >>> 16) & 0x8000;
  let e = ((x >>> 23) & 0xff) - 127 + 15;
  let m = x & 0x7fffff;
  if (e <= 0) return sign;
  if (e >= 31) return sign | 0x7bff;
  m += 0x1000;
  if (m & 0x800000) {
    m = 0;
    e++;
    if (e >= 31) return sign | 0x7bff;
  }
  return sign | (e << 10) | (m >>> 13);
}
export function toHalf(a: Float32Array): Uint16Array {
  const out = new Uint16Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = toHalfOne(a[i]);
  return out;
}
