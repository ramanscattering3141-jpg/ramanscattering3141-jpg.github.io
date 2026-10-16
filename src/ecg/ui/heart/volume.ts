// Voxel model of the heart: one regular grid carries the myocardium mesh (surface nets), the
// tissue map (region, ischaemic zone, coronary supply) and, for every distinct beat, the local
// activation and repolarisation times. Activation is the geodesic arrival time through the wall
// from the beat's real entry points (Purkinje sites chosen by the bundle-branch state, an ectopic
// focus, the accessory-pathway insertion, the pacing lead, or combinations for fusion): fast along
// the Purkinje-lined endocardium of a side whose bundle conducts, slow cell-to-cell elsewhere, never
// through scar or across the fibrous AV ring. Times are scaled so the whole sequence lasts exactly
// as long as that beat's QRS (or P wave), so the heart and the tracing stay in step.

import type { EcgRun } from '../../engine';
import type { BeatInfo } from '../../engine/synth';
import type { AtrialEvent } from '../../engine/rhythm';
import { buildP, territoryVector } from '../../engine/morphology';
import type { AtrialSite } from '../../engine/params';
import { type Anatomy, type V3, Region, add, comb, dot, isAtrial, isVentricular, len, lvSegment, norm, segmentCoronary, sub } from './anatomy';

export const NEVER = 9000;

export interface Grid {
  nx: number;
  ny: number;
  nz: number;
  h: number;
  min: V3;
  /** Region per voxel (0 = no myocardium), after dilation by two voxels for texture sampling. */
  region: Uint8Array;
  /** True myocardium voxels (before dilation). */
  solid: Uint8Array;
  /** 0 endocardium … 1 epicardium. */
  depth: Float32Array;
  /** Purkinje-lined endocardium: 0 none, 1 LV septal-fascicle territory, 2 LAF, 3 LPF, 4 RV. */
  pk: Uint8Array;
  /** Fast inter-atrial / internodal tracts. */
  fastA: Uint8Array;
  /** AHA segment (LV) and coronary supply (1 LAD, 2 LCx, 3 RCA). */
  seg: Uint8Array;
  cor: Uint8Array;
  /** Index of the nearest solid voxel (for dilated voxels; self for solid ones). */
  near: Int32Array;
}

export interface MeshData {
  pos: Float32Array;
  normal: Float32Array;
  index: Uint32Array;
}

export const idx = (g: Grid, i: number, j: number, k: number): number => i + g.nx * (j + g.ny * k);
export const voxelPos = (g: Grid, i: number, j: number, k: number): V3 => [g.min[0] + i * g.h, g.min[1] + j * g.h, g.min[2] + k * g.h];

/** Nearest voxel index for a point (clamped to the grid). */
export function voxelAt(g: Grid, p: V3): number {
  const i = Math.max(0, Math.min(g.nx - 1, Math.round((p[0] - g.min[0]) / g.h)));
  const j = Math.max(0, Math.min(g.ny - 1, Math.round((p[1] - g.min[1]) / g.h)));
  const k = Math.max(0, Math.min(g.nz - 1, Math.round((p[2] - g.min[2]) / g.h)));
  return idx(g, i, j, k);
}

// ------------------------------------------------------------------ grid + mesh
export function buildGrid(A: Anatomy, h = 0.17): { grid: Grid; mesh: MeshData } {
  const min = A.bounds.min;
  const nx = Math.ceil((A.bounds.max[0] - min[0]) / h) + 1;
  const ny = Math.ceil((A.bounds.max[1] - min[1]) / h) + 1;
  const nz = Math.ceil((A.bounds.max[2] - min[2]) / h) + 1;
  const N = nx * ny * nz;
  const field = new Float32Array(N);
  const g: Grid = { nx, ny, nz, h, min, region: new Uint8Array(N), solid: new Uint8Array(N), depth: new Float32Array(N), pk: new Uint8Array(N), fastA: new Uint8Array(N), seg: new Uint8Array(N), cor: new Uint8Array(N), near: new Int32Array(N).fill(-1) };
  const f = (p: V3): number => Math.min(A.sdfV(p), A.sdfA(p));
  // Coarse pass every C points; blocks whose corners are all far from the surface (same sign) are
  // filled by interpolation, the rest are evaluated exactly.
  const C = 3;
  const cx = Math.ceil((nx - 1) / C) + 1;
  const cy = Math.ceil((ny - 1) / C) + 1;
  const cz = Math.ceil((nz - 1) / C) + 1;
  const coarse = new Float32Array(cx * cy * cz);
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) coarse[i + cx * (j + cy * k)] = f([min[0] + i * C * h, min[1] + j * C * h, min[2] + k * C * h]);
  const safe = 1.6 * C * h * Math.sqrt(3);
  for (let K = 0; K < cz - 1; K++)
    for (let J = 0; J < cy - 1; J++)
      for (let I = 0; I < cx - 1; I++) {
        const c = (di: number, dj: number, dk: number): number => coarse[I + di + cx * (J + dj + cy * (K + dk))];
        const v = [c(0, 0, 0), c(1, 0, 0), c(0, 1, 0), c(1, 1, 0), c(0, 0, 1), c(1, 0, 1), c(0, 1, 1), c(1, 1, 1)];
        const far = v.every((x) => x > safe) || v.every((x) => x < -safe);
        for (let k = K * C; k <= Math.min(nz - 1, K * C + C); k++)
          for (let j = J * C; j <= Math.min(ny - 1, J * C + C); j++)
            for (let i = I * C; i <= Math.min(nx - 1, I * C + C); i++) {
              const n = idx(g, i, j, k);
              if (far) {
                const u = (i - I * C) / C;
                const t = (j - J * C) / C;
                const s = (k - K * C) / C;
                const x0 = v[0] + (v[1] - v[0]) * u;
                const x1 = v[2] + (v[3] - v[2]) * u;
                const x2 = v[4] + (v[5] - v[4]) * u;
                const x3 = v[6] + (v[7] - v[6]) * u;
                const y0 = x0 + (x1 - x0) * t;
                const y1 = x2 + (x3 - x2) * t;
                field[n] = y0 + (y1 - y0) * s;
              } else field[n] = f(voxelPos(g, i, j, k));
            }
      }
  for (let n = 0; n < N; n++) {
    if (field[n] >= 0) continue;
    const k = Math.floor(n / (nx * ny));
    const j = Math.floor((n - k * nx * ny) / nx);
    const i = n - nx * (j + ny * k);
    const r = A.region(voxelPos(g, i, j, k));
    if (r !== Region.None) {
      g.solid[n] = 1;
      g.region[n] = r;
      g.near[n] = n;
    }
  }
  classify(A, g);
  const mesh = surfaceNets(field, g);
  dilate(g, 2);
  return { grid: g, mesh };
}

function classify(A: Anatomy, g: Grid): void {
  const fast: V3[][] = A.tracts.filter((t) => t.kind === 'atrial').map((t) => t.pts);
  const sites = A.sites;
  for (let n = 0; n < g.region.length; n++) {
    if (!g.solid[n]) continue;
    const k = Math.floor(n / (g.nx * g.ny));
    const j = Math.floor((n - k * g.nx * g.ny) / g.nx);
    const i = n - g.nx * (j + g.ny * k);
    const p = voxelPos(g, i, j, k);
    const r = g.region[n];
    if (isVentricular(r)) {
      const dL = A.cavLV(p);
      const dR = A.cavRV(p);
      const dEndo = Math.max(0, Math.min(dL, dR));
      const outer = -A.sdfV(p);
      g.depth[n] = Math.max(0, Math.min(1, dEndo / Math.max(0.05, dEndo + Math.max(0, outer))));
      const { u, th } = A.lvCoords(p);
      // Purkinje-lined endocardium: apical two-thirds of both ventricles (sparse at the base and the outflow tracts).
      if (dEndo < 0.32 && u > 1.25 && r !== Region.RVOT) {
        if (dL <= dR) {
          const dSept = len(sub(p, sites.lvSeptal));
          const dLaf = len(sub(p, sites.laf));
          const dLpf = len(sub(p, sites.lpf));
          g.pk[n] = dLaf < dLpf && dLaf < dSept ? 2 : dLpf < dSept ? 3 : 1;
        } else g.pk[n] = 4;
      }
      if (r === Region.LVFree || r === Region.Septum) {
        const s = lvSegment(u / A.apexU, th);
        g.seg[n] = s;
        g.cor[n] = segmentCoronary(s);
      } else g.cor[n] = r === Region.RVOT || th < 25 ? 3 : 3;
      // The anterior third of the RV free wall next to the anterior interventricular groove is supplied by the LAD.
      if (r === Region.RVFree && th > 40) g.cor[n] = 1;
    } else if (isAtrial(r)) {
      const dEndo = Math.max(0, Math.min(A.cavRA(p), A.cavLA(p)));
      g.depth[n] = Math.max(0, Math.min(1, dEndo / 0.33));
      for (const pts of fast) {
        for (let q = 0; q + 1 < pts.length; q++) {
          if (segDist(p, pts[q], pts[q + 1]) < 0.32) g.fastA[n] = 1;
        }
      }
    }
  }
}

function segDist(p: V3, a: V3, b: V3): number {
  const ab = sub(b, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / Math.max(1e-9, dot(ab, ab))));
  return len(sub(p, comb([a, 1], [ab, t])));
}

/** Copy the nearest solid voxel's labels into empty neighbours (so trilinear sampling at the surface is valid). */
function dilate(g: Grid, layers: number): void {
  let frontier: number[] = [];
  for (let n = 0; n < g.solid.length; n++) if (g.solid[n]) frontier.push(n);
  const sx = 1;
  const sy = g.nx;
  const sz = g.nx * g.ny;
  for (let l = 0; l < layers; l++) {
    const next: number[] = [];
    for (const n of frontier) {
      const k = Math.floor(n / sz);
      const j = Math.floor((n - k * sz) / sy);
      const i = n - j * sy - k * sz;
      for (let dk = -1; dk <= 1; dk++)
        for (let dj = -1; dj <= 1; dj++)
          for (let di = -1; di <= 1; di++) {
            const ii = i + di;
            const jj = j + dj;
            const kk = k + dk;
            if (ii < 0 || jj < 0 || kk < 0 || ii >= g.nx || jj >= g.ny || kk >= g.nz) continue;
            const m = ii * sx + jj * sy + kk * sz;
            if (g.near[m] >= 0) continue;
            g.near[m] = g.near[n];
            g.region[m] = g.region[n];
            g.depth[m] = g.depth[n];
            g.seg[m] = g.seg[n];
            g.cor[m] = g.cor[n];
            next.push(m);
          }
    }
    frontier = next;
  }
}

/** Naive surface nets on the sampled SDF; vertices are then pulled onto the exact surface. */
function surfaceNets(field: Float32Array, g: Grid): MeshData {
  const { nx, ny, nz, h, min } = g;
  const cellIndex = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cid = (i: number, j: number, k: number): number => i + (nx - 1) * (j + (ny - 1) * k);
  const pos: number[] = [];
  const corner = new Float32Array(8);
  const EDGES: [number, number][] = [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
    [0, 2],
    [1, 3],
    [4, 6],
    [5, 7],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];
  const off = (c: number): V3 => [c & 1, (c >> 1) & 1, (c >> 2) & 1];
  for (let k = 0; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const o = off(c);
          const v = field[idx(g, i + o[0], j + o[1], k + o[2])];
          corner[c] = v;
          if (v < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let cnt = 0;
        for (const [a, b] of EDGES) {
          const va = corner[a];
          const vb = corner[b];
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          const oa = off(a);
          const ob = off(b);
          sx += oa[0] + (ob[0] - oa[0]) * t;
          sy += oa[1] + (ob[1] - oa[1]) * t;
          sz += oa[2] + (ob[2] - oa[2]) * t;
          cnt++;
        }
        cellIndex[cid(i, j, k)] = pos.length / 3;
        pos.push(min[0] + (i + sx / cnt) * h, min[1] + (j + sy / cnt) * h, min[2] + (k + sz / cnt) * h);
      }
  const index: number[] = [];
  // One quad per sign-changing grid edge, joining the four cells around it.
  for (let k = 1; k < nz - 1; k++)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const v0 = field[idx(g, i, j, k)];
        const inside = v0 < 0;
        // x edge (i,j,k)–(i+1,j,k): cells (i, j-1..j, k-1..k)
        if (i < nx - 1 && inside !== field[idx(g, i + 1, j, k)] < 0) quad(cid(i, j - 1, k - 1), cid(i, j, k - 1), cid(i, j, k), cid(i, j - 1, k), inside);
        if (j < ny - 1 && inside !== field[idx(g, i, j + 1, k)] < 0) quad(cid(i - 1, j, k - 1), cid(i - 1, j, k), cid(i, j, k), cid(i, j, k - 1), inside);
        if (k < nz - 1 && inside !== field[idx(g, i, j, k + 1)] < 0) quad(cid(i - 1, j - 1, k), cid(i, j - 1, k), cid(i, j, k), cid(i - 1, j, k), inside);
      }
  function quad(a: number, b: number, c: number, d: number, flip: boolean): void {
    const A = cellIndex[a];
    const B = cellIndex[b];
    const C = cellIndex[c];
    const D = cellIndex[d];
    if (A < 0 || B < 0 || C < 0 || D < 0) return;
    if (flip) index.push(A, B, C, A, C, D);
    else index.push(A, C, B, A, D, C);
  }
  // Normals from the gradient of the sampled field (trilinear interpolation of central differences).
  const n = pos.length / 3;
  const P = new Float32Array(pos);
  const N = new Float32Array(n * 3);
  const fv = (i: number, j: number, k: number): number => field[idx(g, Math.max(0, Math.min(nx - 1, i)), Math.max(0, Math.min(ny - 1, j)), Math.max(0, Math.min(nz - 1, k)))];
  for (let v = 0; v < n; v++) {
    const x = (P[v * 3] - min[0]) / h;
    const y = (P[v * 3 + 1] - min[1]) / h;
    const z = (P[v * 3 + 2] - min[2]) / h;
    const i0 = Math.floor(x);
    const j0 = Math.floor(y);
    const k0 = Math.floor(z);
    let gx = 0;
    let gy = 0;
    let gz = 0;
    for (let c = 0; c < 8; c++) {
      const i = i0 + (c & 1);
      const j = j0 + ((c >> 1) & 1);
      const k = k0 + ((c >> 2) & 1);
      const wgt = (c & 1 ? x - i0 : 1 - (x - i0)) * ((c >> 1) & 1 ? y - j0 : 1 - (y - j0)) * ((c >> 2) & 1 ? z - k0 : 1 - (z - k0));
      gx += wgt * (fv(i + 1, j, k) - fv(i - 1, j, k));
      gy += wgt * (fv(i, j + 1, k) - fv(i, j - 1, k));
      gz += wgt * (fv(i, j, k + 1) - fv(i, j, k - 1));
    }
    N.set(norm([gx, gy, gz]), v * 3);
  }
  // The quad winding above follows the sign convention; make triangles face along the SDF gradient.
  const I = new Uint32Array(index);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3;
    const b = I[t + 1] * 3;
    const c = I[t + 2] * 3;
    const ab: V3 = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]];
    const ac: V3 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
    const fn: V3 = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    if (fn[0] * N[a] + fn[1] * N[a + 1] + fn[2] * N[a + 2] < 0) {
      const tmp = I[t + 1];
      I[t + 1] = I[t + 2];
      I[t + 2] = tmp;
    }
  }
  return { pos: P, normal: N, index: I };
}

// ------------------------------------------------------------------ geodesic activation
class Heap {
  private k: Float64Array;
  private v: Int32Array;
  size = 0;
  constructor(cap: number) {
    this.k = new Float64Array(cap);
    this.v = new Int32Array(cap);
  }
  push(key: number, val: number): void {
    if (this.size >= this.k.length) {
      const k2 = new Float64Array(this.k.length * 2);
      k2.set(this.k);
      const v2 = new Int32Array(this.v.length * 2);
      v2.set(this.v);
      this.k = k2;
      this.v = v2;
    }
    let i = this.size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.k[p] <= key) break;
      this.k[i] = this.k[p];
      this.v[i] = this.v[p];
      i = p;
    }
    this.k[i] = key;
    this.v[i] = val;
  }
  pop(): [number, number] {
    const rk = this.k[0];
    const rv = this.v[0];
    const k = this.k[--this.size];
    const v = this.v[this.size];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= this.size) break;
      if (c + 1 < this.size && this.k[c + 1] < this.k[c]) c++;
      if (this.k[c] >= k) break;
      this.k[i] = this.k[c];
      this.v[i] = this.v[c];
      i = c;
    }
    this.k[i] = k;
    this.v[i] = v;
    return [rk, rv];
  }
}

export interface Seed {
  p: V3;
  t: number;
}

/**
 * Arrival time (ms, unscaled) at every solid voxel of the chosen tissue from the seeds.
 * `speed(n, m)` gives the conduction velocity (cm/ms) between neighbouring voxels; 0 = no conduction.
 */
export function geodesic(g: Grid, seeds: Seed[], tissue: (r: number) => boolean, speed: (n: number, m: number) => number, blocked?: Uint8Array): Float64Array {
  const N = g.solid.length;
  const T = new Float64Array(N).fill(Infinity);
  const heap = new Heap(4096);
  const sy = g.nx;
  const sz = g.nx * g.ny;
  for (const s of seeds) {
    // Nearest solid voxel of the right tissue to the seed (small search).
    let best = -1;
    let bd = Infinity;
    const c = voxelAt(g, s.p);
    const k0 = Math.floor(c / sz);
    const j0 = Math.floor((c - k0 * sz) / sy);
    const i0 = c - j0 * sy - k0 * sz;
    for (let r = 0; r <= 6 && best < 0; r++) {
      for (let dk = -r; dk <= r; dk++)
        for (let dj = -r; dj <= r; dj++)
          for (let di = -r; di <= r; di++) {
            const i = i0 + di;
            const j = j0 + dj;
            const k = k0 + dk;
            if (i < 0 || j < 0 || k < 0 || i >= g.nx || j >= g.ny || k >= g.nz) continue;
            const m = i + j * sy + k * sz;
            if (!g.solid[m] || !tissue(g.region[m]) || blocked?.[m]) continue;
            const d = di * di + dj * dj + dk * dk;
            if (d < bd) {
              bd = d;
              best = m;
            }
          }
    }
    if (best >= 0 && s.t < T[best]) {
      T[best] = s.t;
      heap.push(s.t, best);
    }
  }
  const h = g.h;
  const OFF: [number, number][] = [];
  for (let dk = -1; dk <= 1; dk++) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (di || dj || dk) OFF.push([di + dj * sy + dk * sz, Math.hypot(di, dj, dk) * h]);
  while (heap.size) {
    const [t, n] = heap.pop();
    if (t > T[n]) continue;
    const k = Math.floor(n / sz);
    const j = Math.floor((n - k * sz) / sy);
    const i = n - j * sy - k * sz;
    if (i === 0 || j === 0 || k === 0 || i === g.nx - 1 || j === g.ny - 1 || k === g.nz - 1) continue;
    for (const [o, d] of OFF) {
      const m = n + o;
      if (!g.solid[m] || !tissue(g.region[m]) || blocked?.[m]) continue;
      const v = speed(n, m);
      if (v <= 0) continue;
      const tt = t + d / v;
      if (tt < T[m]) {
        T[m] = tt;
        heap.push(tt, m);
      }
    }
  }
  return T;
}

// ------------------------------------------------------------------ per-beat maps
export interface BeatMap {
  /** Interleaved (activation, repolarisation) ms after the beat's onset, per voxel (dilated). NEVER where not activated. */
  data: Float32Array;
  maxAct: number;
}

const V_SLOW = 0.055; // cm/ms, cell-to-cell ventricular myocardium (≈ 0.5 m/s)
const V_PK = 0.26; // Purkinje-lined endocardium (≈ 2.5 m/s)
const A_SLOW = 0.07; // atrial myocardium
const A_FAST = 0.16; // Bachmann's bundle / internodal routes

interface ScarInfo {
  scar: Uint8Array;
  injured: Uint8Array;
}

/** Ischaemic territory: scar (no activation, no contraction) and injured (ST-segment) zones. */
export function ischaemiaZones(A: Anatomy, g: Grid, run: EcgRun): ScarInfo {
  const p = run.physio;
  const isch = p.ischemia;
  const N = g.solid.length;
  const scar = new Uint8Array(N);
  const injured = new Uint8Array(N);
  if (isch.stage === 'none' || isch.stage === 'takotsubo') return { scar, injured };
  const scarStage = (isch.stage === 'old' || isch.stage === 'evolving' || isch.stage === 'aneurysm') && isch.territory !== 'diffuseSubendo';
  const tdir = territoryVector(isch.territory) as unknown as V3;
  const sz = g.nx * g.ny;
  for (let n = 0; n < N; n++) {
    const r = g.region[n];
    if (!isVentricular(r)) continue;
    const k = Math.floor(n / sz);
    const j = Math.floor((n - k * sz) / g.nx);
    const i = n - j * g.nx - k * sz;
    const q = voxelPos(g, i, j, k);
    const dir = norm(sub(q, A.centre));
    const inZone = isch.territory === 'diffuseSubendo' || isch.stage === 'subendocardial' ? g.depth[n] < 0.45 : dot(dir, tdir) > 0.6 - 0.2 * (1 - Math.min(1, isch.extent));
    if (!inZone) continue;
    if (scarStage) {
      // Transmural scar in the core; the viable rim is not acutely injured.
      if (dot(dir, tdir) > 0.66) scar[n] = 1;
    } else injured[n] = 1;
  }
  return { scar, injured };
}

const AP_SITES: Record<string, (A: Anatomy) => V3> = {
  leftLateral: (A) => basePoint(A, 180),
  leftPosterior: (A) => basePoint(A, -140),
  posteroseptal: (A) => basePoint(A, -40),
  rightFreeWall: (A) => comb([A.B, 1], [A.a, 0.55], [A.s, 4.3], [A.w, -0.3]),
  anteroseptal: (A) => basePoint(A, 35),
  midseptal: (A) => basePoint(A, -5),
};
function basePoint(A: Anatomy, th: number): V3 {
  const t = (th * Math.PI) / 180;
  const r = 2.4;
  return comb([A.B, 1], [A.a, 0.45], [A.s, r * Math.cos(t)], [A.w, r * Math.sin(t)]);
}
export function apInsertion(A: Anatomy, loc: string): V3 {
  return (AP_SITES[loc] ?? AP_SITES.leftLateral)(A);
}

/** Ventricular activation/repolarisation for one beat. */
export function ventricularMap(A: Anatomy, g: Grid, run: EcgRun, b: BeatInfo, zones: ScarInfo): BeatMap {
  const p = run.physio;
  const ev = b.ev;
  const seeds: Seed[] = [];
  const S = A.sites;
  let pkOn = { L: true, R: true, laf: true, lpf: true };
  let bundleState = p.bundle as string;
  if (ev.aberrant === 'rbbb' && !bundleState.startsWith('rbbb')) bundleState = bundleState === 'lafb' ? 'rbbb+lafb' : bundleState === 'lpfb' ? 'rbbb+lpfb' : bundleState === 'lbbb' ? 'lbbb' : 'rbbb';
  const his = (t0: number): void => {
    const rb = !bundleState.startsWith('rbbb');
    const lb = bundleState !== 'lbbb';
    const laf = lb && bundleState !== 'lafb' && bundleState !== 'rbbb+lafb';
    const lpf = lb && bundleState !== 'lpfb' && bundleState !== 'rbbb+lpfb';
    const inc = bundleState === 'incompleteRbbb';
    pkOn = { L: lb, R: rb, laf, lpf };
    if (lb) seeds.push({ p: S.lvSeptal, t: t0 });
    if (laf) seeds.push({ p: S.laf, t: t0 + 5 });
    if (lpf) seeds.push({ p: S.lpf, t: t0 + 5 });
    if (rb) seeds.push({ p: S.rbSeptal, t: t0 + (inc ? 22 : 8) }, { p: S.rbFree, t: t0 + (inc ? 26 : 11) });
  };
  if (ev.route === 'his') his(0);
  else if (ev.route === 'ap') {
    seeds.push({ p: apInsertion(A, ev.apLocation ?? p.rhythm.ap.location), t: 0 });
    if (Number.isFinite(ev.hisDelay)) his(ev.hisDelay);
    else pkOn = { L: true, R: true, laf: true, lpf: true };
  } else {
    const site = ev.route === 'paced' ? 'rvApex' : (ev.site ?? 'rvApex');
    if (site === 'fascicularPosterior') seeds.push({ p: S.lpf, t: 0 });
    else if (site === 'fascicularAnterior') seeds.push({ p: S.laf, t: 0 });
    else seeds.push({ p: S[site] ?? S.rvApex, t: 0 });
    if (Number.isFinite(ev.hisDelay) && ev.hisDelay < 70) his(ev.hisDelay);
  }
  const pk = g.pk;
  const speed = (n: number, m: number): number => {
    const a = pk[n];
    const c = pk[m];
    if (a && c && (a === 4) === (c === 4)) {
      const side = a === 4 ? pkOn.R : pkOn.L;
      const terr = (x: number): boolean => x === 1 || x === 4 || (x === 2 && pkOn.laf) || (x === 3 && pkOn.lpf);
      if (side && terr(a) && terr(c)) return V_PK;
    }
    return V_SLOW;
  };
  const T = geodesic(g, seeds, isVentricular, speed, zones.scar);
  let maxT = 0;
  for (let n = 0; n < T.length; n++) if (Number.isFinite(T[n]) && T[n] > maxT) maxT = T[n];
  const scale = maxT > 0 ? (b.morph.qrsDur * 0.96) / maxT : 1;
  // Repolarisation: cells the T vector points toward repolarise first, and the epicardium before
  // the endocardium (shorter epicardial action potentials) — the dispersion the T wave records.
  const tComp = b.morph.comps.find((c) => c.tag === 'T wave');
  const td: V3 | null = tComp ? norm(tComp.dir as unknown as V3) : null;
  const data = new Float32Array(T.length * 2).fill(NEVER);
  const sz = g.nx * g.ny;
  let maxAct = 0;
  for (let n = 0; n < T.length; n++) {
    const src = g.near[n];
    if (src < 0 || !isVentricular(g.region[n])) continue;
    const t = T[src];
    if (!Number.isFinite(t)) continue;
    const act = t * scale;
    const k = Math.floor(src / sz);
    const j = Math.floor((src - k * sz) / g.nx);
    const i = src - j * g.nx - k * sz;
    const dir = norm(sub(voxelPos(g, i, j, k), A.centre));
    let f = 0.5 + 0.22 * (0.5 - g.depth[src]);
    if (td) f -= 0.36 * dot(dir, td);
    f = Math.max(0.03, Math.min(0.97, f));
    const rep = b.morph.tStart + (b.morph.tEnd - b.morph.tStart) * (0.42 + 0.58 * f);
    data[n * 2] = act;
    data[n * 2 + 1] = Math.max(act + 120, rep);
    if (act > maxAct) maxAct = act;
  }
  return { data, maxAct };
}

const ATRIAL_SITE: Record<AtrialSite, (A: Anatomy) => V3> = {
  sinus: (A) => A.landmarks.SA,
  highRA: (A) => A.landmarks.SA,
  crista: (A) => add(A.landmarks.raLabel, [-1.5, 0.4, 0.5]),
  lowRA: (A) => add(A.landmarks.AVN, [-0.2, 0.6, -1.0]),
  leftAtrial: (A) => add(A.landmarks.laLabel, [1.6, -0.5, -0.2]),
  lowLA: (A) => add(A.landmarks.laLabel, [0.6, 1.0, -0.6]),
  retroSeptal: (A) => A.landmarks.AVN,
  retroPosteroseptal: (A) => add(A.landmarks.AVN, [-0.1, 0.5, -1.0]),
  retroLeftLateral: (A) => comb([A.valves[0].c, 1], [A.a, -0.6], [A.s, -1.5]),
  retroRightFree: (A) => comb([A.valves[1].c, 1], [A.a, -0.6], [A.s, 1.5]),
};

/** Atrial activation/repolarisation for one atrial beat (P wave). */
export function atrialMap(A: Anatomy, g: Grid, run: EcgRun, a: AtrialEvent): BeatMap {
  const origin = (ATRIAL_SITE[a.site] ?? ATRIAL_SITE.sinus)(A);
  const speed = (n: number, m: number): number => (g.fastA[n] && g.fastA[m] ? A_FAST : A_SLOW);
  const T = geodesic(g, [{ p: origin, t: 0 }], isAtrial, speed);
  let maxT = 0;
  for (let n = 0; n < T.length; n++) if (Number.isFinite(T[n]) && T[n] > maxT) maxT = T[n];
  const pDur = buildP(run.physio, a.site).pDur;
  const scale = maxT > 0 ? pDur / maxT : 1;
  const apd = atrialApd(run);
  const data = new Float32Array(T.length * 2).fill(NEVER);
  let maxAct = 0;
  for (let n = 0; n < T.length; n++) {
    const src = g.near[n];
    if (src < 0 || !isAtrial(g.region[n])) continue;
    const t = T[src];
    if (!Number.isFinite(t)) continue;
    const act = t * scale;
    data[n * 2] = act;
    data[n * 2 + 1] = act + apd;
    if (act > maxAct) maxAct = act;
  }
  return { data, maxAct };
}

export function atrialApd(run: EcgRun): number {
  const p = run.physio;
  // Atrial APD ≈ 150–250 ms; shorter with vagal tone and at fast rates.
  return Math.max(110, 200 - 40 * Math.max(0, -p.autonomic) - 20 * Math.max(0, p.autonomic));
}

/** Key identifying beats with the same activation sequence (so their maps can be shared). */
export function ventKey(run: EcgRun, b: BeatInfo): string {
  const ev = b.ev;
  const T = b.morph.comps.find((c) => c.tag === 'T wave');
  return [ev.route, ev.site ?? '', ev.apLocation ?? '', ev.aberrant, Number.isFinite(ev.hisDelay) ? Math.round(ev.hisDelay / 4) : 'x', Math.round(b.morph.qrsDur), Math.round(b.morph.tStart / 4), Math.round(b.morph.tEnd / 4), T ? T.dir.map((x) => x.toFixed(1)).join(',') : '', run.physio.bundle].join('|');
}
export function atrialKey(run: EcgRun, a: AtrialEvent): string {
  return [a.site, Math.round(buildP(run.physio, a.site).pDur)].join('|');
}
