// Signal synthesis: sum every atrial and ventricular activation/repolarisation component
// into a 3-D heart-vector time series, then project it onto each lead axis.

import { LEADS, TWELVE, type LeadId } from './leads';
import { buildP, buildVentBeat, localAt, shapeAt, type BeatMorph, type Comp } from './morphology';
import type { Physio } from './params';
import { effectiveSinusRate } from './params';
import type { SimResult, VentEvent } from './rhythm';
import { mulberry32, gauss } from './random';
import { norm, vec, type Vec3 } from './vec';
import { voltageFactor } from './derived';

export interface BeatInfo {
  ev: VentEvent;
  morph: BeatMorph;
  rr: number;
}

export interface EcgSignal {
  fs: number;
  from: number; // ms of first sample
  n: number;
  leads: Partial<Record<LeadId, Float32Array>>;
  vcg: [Float32Array, Float32Array, Float32Array];
  beats: BeatInfo[];
}

export interface SynthOptions {
  fs?: number;
  from?: number;
  to?: number;
  leads?: LeadId[];
  noise?: boolean;
}

export function synthesize(p: Physio, sim: SimResult, opts: SynthOptions = {}): EcgSignal {
  const fs = opts.fs ?? 1000;
  const from = opts.from ?? 0;
  const to = opts.to ?? sim.duration;
  const n = Math.max(1, Math.round(((to - from) * fs) / 1000));
  const vx = new Float32Array(n);
  const vy = new Float32Array(n);
  const vz = new Float32Array(n);
  const dt = 1000 / fs;
  const idx = (t: number): number => Math.round((t - from) / dt);

  const addComp = (t: number, c: Comp): void => {
    const a = t + c.t0;
    const i0 = Math.max(0, idx(a));
    const i1 = Math.min(n - 1, idx(a + c.dur));
    if (i1 < 0 || i0 > n - 1) return;
    const ax = c.dir[0] * c.amp;
    const ay = c.dir[1] * c.amp;
    const az = c.dir[2] * c.amp;
    for (let i = i0; i <= i1; i++) {
      const u = (from + i * dt - a) / c.dur;
      const s = shapeAt(c.shape, u);
      if (s === 0) continue;
      vx[i] += ax * s;
      vy[i] += ay * s;
      vz[i] += az * s;
    }
  };

  // --- Atrial activity ---
  const pCache = new Map<string, ReturnType<typeof buildP>>();
  for (const a of sim.atrial) {
    if (a.kind === 'flutter') continue;
    if (a.t < from - 500 || a.t > to) continue;
    let pm = pCache.get(a.site);
    if (!pm) {
      pm = buildP(p, a.site);
      pCache.set(a.site, pm);
    }
    for (const c of pm.comps) addComp(a.t, c);
  }

  // --- Continuous atrial / ventricular activity ---
  const rngC = mulberry32(p.rhythm.seed * 31 + 7);
  const vfK = voltageFactor(p);
  for (const c of sim.continuous) {
    const i0 = Math.max(0, idx(c.t0));
    const i1 = Math.min(n - 1, idx(c.t1));
    if (c.kind === 'flutter') {
      // Macro-re-entry around the tricuspid annulus: counter-clockwise typical flutter activates
      // the septum caudo-cranially, so the dominant vector points SUPERIORLY for most of the cycle
      // (negative sawtooth in II, III, aVF) and anteriorly during the septal/lateral limb (positive in V1).
      const cl = c.cl ?? 200;
      const sgn = c.reverse ? -1 : 1;
      for (let i = i0; i <= i1; i++) {
        const t = from + i * dt;
        const ph = (((t - c.t0) % cl) + cl) % cl / cl;
        const saw = ph < 0.72 ? 0.55 - ph / 0.72 : -0.45 + (ph - 0.72) / 0.28;
        const ant = Math.exp(-((ph - 0.8) ** 2) / 0.012);
        const k = 0.16 * vfK;
        vx[i] += k * sgn * 0.08 * saw;
        vy[i] += k * sgn * saw;
        vz[i] += k * (0.25 * sgn * saw * -1 + 0.55 * ant);
      }
    } else if (c.kind === 'fib') {
      const amp = (0.018 + 0.09 * p.rhythm.afCoarse) * vfK;
      const f = [5.5 + rngC() * 2, 6.3 + rngC() * 2, 7.4 + rngC() * 2];
      const ph = [rngC() * 6, rngC() * 6, rngC() * 6];
      const d: Vec3[] = [norm(vec(0.1, 0.35, 0.93)), norm(vec(0.5, 0.6, 0.6)), norm(vec(-0.3, 0.5, 0.8))];
      for (let i = i0; i <= i1; i++) {
        const t = (from + i * dt) / 1000;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        for (let k = 0; k < 3; k++) {
          const env = 0.6 + 0.4 * Math.sin(t * (0.7 + k * 0.37) + ph[k]);
          const s = env * Math.sin(2 * Math.PI * f[k] * t + ph[k] + 0.8 * Math.sin(t * 1.3 + k));
          sx += d[k][0] * s;
          sy += d[k][1] * s;
          sz += d[k][2] * s;
        }
        vx[i] += (amp * sx) / 2;
        vy[i] += (amp * sy) / 2;
        vz[i] += (amp * sz) / 2;
      }
    } else {
      // Ventricular fibrillation (multiple wandering wavelets) or ventricular flutter (single rapid circuit).
      const isVF = c.kind === 'vf';
      const f = isVF ? [4.2 + rngC() * 1.5, 5.3 + rngC() * 1.5, 6.4 + rngC() * 1.5] : [4.8, 0, 0];
      const ph = [rngC() * 6, rngC() * 6, rngC() * 6];
      for (let i = i0; i <= i1; i++) {
        const t = (from + i * dt) / 1000;
        const tt = (from + i * dt - c.t0) / 1000;
        const decay = isVF ? Math.max(0.25, Math.exp(-tt / 25)) : 1;
        let sx = 0;
        let sy = 0;
        let sz = 0;
        const nk = isVF ? 3 : 1;
        for (let k = 0; k < nk; k++) {
          const env = isVF ? 0.55 + 0.45 * Math.sin(t * (0.9 + 0.5 * k) + ph[k]) : 1;
          const s = env * Math.sin(2 * Math.PI * f[k] * t + ph[k] + (isVF ? 1.5 * Math.sin(t * 0.8 + k) : 0));
          const rot = t * (isVF ? 0.6 + 0.3 * k : 0) + ph[k];
          sx += Math.cos(rot) * s;
          sy += Math.sin(rot) * s * 0.9;
          sz += 0.6 * Math.sin(rot * 0.7 + 1) * s;
        }
        const k = (isVF ? 0.45 : 1.1) * decay * vfK;
        vx[i] += (k * sx) / nk;
        vy[i] += (k * sy) / nk;
        vz[i] += (k * sz) / nk;
      }
    }
  }

  // --- Ventricular beats ---
  const beats: BeatInfo[] = [];
  const defaultRR = 60000 / effectiveSinusRate(p);
  const vs = sim.ventricular;
  for (let k = 0; k < vs.length; k++) {
    const ev = vs[k];
    const rr = k > 0 ? ev.t - vs[k - 1].t : defaultRR;
    if (ev.t < from - 1400 || ev.t > to) continue;
    const morph = buildVentBeat(p, ev, { rr, index: k, seed: p.rhythm.seed });
    beats.push({ ev, morph, rr });
    for (const c of morph.comps) addComp(ev.t, c);
  }

  // --- Project onto leads ---
  const leadIds = opts.leads ?? TWELVE;
  const out: Partial<Record<LeadId, Float32Array>> = {};
  const noiseAmp = opts.noise === false ? 0 : p.noise;
  const rngN = mulberry32(p.rhythm.seed * 97 + 3);
  for (const id of leadIds) {
    const L = LEADS[id];
    const arr = new Float32Array(n);
    const [ax, ay, az] = L.axis;
    const g = L.gain;
    for (let i = 0; i < n; i++) arr[i] = g * (vx[i] * ax + vy[i] * ay + vz[i] * az);
    // Local (non-dipolar) potentials.
    for (const b of beats) {
      for (const term of b.morph.local) {
        const wgt = term.weights[id];
        if (!wgt) continue;
        const a = b.ev.t + term.t0;
        const i0 = Math.max(0, idx(a));
        const i1 = Math.min(n - 1, idx(a + term.dur));
        for (let i = i0; i <= i1; i++) arr[i] += wgt * localAt(term, from + i * dt - a);
      }
    }
    // Pacing stimuli: very brief, large, lead-dependent artefacts.
    for (const s of sim.spikes) {
      const i = idx(s.t);
      if (i < 0 || i >= n - 2) continue;
      if (s.chamber === 'shock') {
        for (let j = 0; j < 40 && i + j < n; j++) arr[i + j] += 3 * Math.exp(-j / 8) * (j < 3 ? 1 : -0.4);
        continue;
      }
      const bip = p.rhythm.pacer.bipolar;
      const dir = s.chamber === 'A' ? vec(0.3, 0.8, 0.4) : vec(0.15, -0.7, -0.6);
      const proj = dir[0] * ax + dir[1] * ay + dir[2] * az;
      const h = (bip ? 0.6 : 2.2) * (0.35 + 0.65 * Math.abs(proj)) * Math.sign(proj || 1);
      arr[i] += h;
      arr[i + 1] += h * 0.6;
      arr[i + 2] -= h * 0.15;
    }
    if (noiseAmp > 0) {
      const phase = rngN() * 6.28;
      const phase2 = rngN() * 6.28;
      let emg = 0;
      for (let i = 0; i < n; i++) {
        const t = (from + i * dt) / 1000;
        emg = 0.7 * emg + 0.3 * gauss(rngN);
        arr[i] += noiseAmp * (0.05 * Math.sin(2 * Math.PI * 0.22 * t + phase) + 0.025 * Math.sin(2 * Math.PI * 0.07 * t + phase2) + 0.012 * emg);
      }
    }
    out[id] = arr;
  }
  return { fs, from, n, leads: out, vcg: [vx, vy, vz], beats };
}

/** Sample the heart vector of a single beat on its own (for the vector loop / physiology views). */
export function beatVectorLoop(comps: Comp[], t0: number, t1: number, step = 2): Vec3[] {
  const pts: Vec3[] = [];
  for (let t = t0; t <= t1; t += step) {
    let x = 0;
    let y = 0;
    let z = 0;
    for (const c of comps) {
      const s = shapeAt(c.shape, (t - c.t0) / c.dur);
      if (!s) continue;
      x += c.dir[0] * c.amp * s;
      y += c.dir[1] * c.amp * s;
      z += c.dir[2] * c.amp * s;
    }
    pts.push([x, y, z]);
  }
  return pts;
}
