// Signal-level feature extraction used by the fidelity tests: every number here is measured on the
// synthesised lead signals (not taken from the model), the way a reader would measure a tracing.

import { makePhysio, runEcg, simulate, synthesize, measure, type EcgRun, type LeadId } from '../../src/ecg/engine';
import { buildP } from '../../src/ecg/engine/morphology';
import { PRESETS } from '../../src/ecg/engine/presets';
import { applyPatch, type PhysioPatch } from '../../src/ecg/engine/params';
import type { BeatInfo } from '../../src/ecg/engine/synth';

export const TWELVE: LeadId[] = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
export const ALL: LeadId[] = [...TWELVE, 'V4R', 'V7', 'V8', 'V9'];
export const LIMB: LeadId[] = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF'];
export const PREC: LeadId[] = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6'];

/** Run a preset exactly as the site does (same seed and noise), but also synthesise a noise-free copy for measuring. */
export function runPreset(id: string, extra?: PhysioPatch, dur?: number): { run: EcgRun; clean: EcgRun } {
  const pr = PRESETS[id];
  const p = applyPatch(makePhysio(pr.patch), extra);
  const d = dur ?? pr.duration ?? 10000;
  const run = runEcg(p, d);
  const sim = simulate(p, { duration: d });
  const sig = synthesize(p, sim, { from: 0, to: d, leads: ALL, noise: false });
  const clean: EcgRun = { physio: p, sim, sig, m: measure(p, sim, sig) };
  return { run, clean };
}

/** A representative beat: the middle beat among those that match. */
export function midBeat(r: EcgRun, pred: (b: BeatInfo) => boolean = (b) => b.ev.route === 'his' && b.ev.aberrant === 'none'): BeatInfo | undefined {
  const bs = r.sig.beats.filter((b) => b.ev.t >= 300 && b.ev.t + b.morph.tEnd < r.sim.duration - 50 && pred(b));
  return bs[Math.floor(bs.length / 2)];
}

const at = (r: EcgRun, l: LeadId, t: number): number => {
  const a = r.sig.leads[l]!;
  const i = Math.round((t - r.sig.from) * r.sig.fs / 1000);
  return a[Math.max(0, Math.min(a.length - 1, i))];
};

export interface Lobe {
  sign: 1 | -1;
  amp: number; // signed peak (mV)
  t0: number; // ms from QRS onset
  t1: number;
  notches: number;
}

export interface QrsFeatures {
  base: number; // PR-segment (QRS-onset) level
  lobes: Lobe[];
  pattern: string; // e.g. "qRs", "rSR'", "QS"
  q: number; // initial negative deflection (≤ 0), 0 if none
  qDur: number;
  r: number; // largest positive deflection
  s: number; // largest negative deflection AFTER the first R (≤ 0)
  rPrime: number; // positive deflection after an S (0 if none)
  minAll: number;
  ptp: number; // peak-to-peak QRS amplitude
  stJ: number; // ST at J point relative to the PR segment
  st60: number; // ST at J+60 ms
  st80: number;
  tPeak: number; // signed largest T deflection relative to PR segment
  tMax: number;
  tMin: number;
  uPeak: number;
  rPeakTime: number; // ms from onset to the largest R
  terminal40: number; // mean of the last 40 ms of the QRS
}

/** Segment the QRS of beat `b` in lead `l` into positive/negative lobes and derive Q/R/S/R′ amplitudes. */
export function qrsFeatures(r: EcgRun, b: BeatInfo, l: LeadId, minLobe = 0.03): QrsFeatures {
  const t0 = b.ev.t;
  const dur = b.morph.qrsDur;
  const base = at(r, l, t0);
  const v: number[] = [];
  for (let t = 0; t <= Math.round(dur); t++) v.push(at(r, l, t0 + t) - base);
  // raw sign lobes
  const raw: Lobe[] = [];
  let cur: Lobe | null = null;
  for (let i = 0; i < v.length; i++) {
    const s: 1 | -1 | 0 = v[i] > 0.004 ? 1 : v[i] < -0.004 ? -1 : 0;
    if (s === 0) continue;
    if (!cur || cur.sign !== s) {
      cur = { sign: s, amp: v[i], t0: i, t1: i, notches: 0 };
      raw.push(cur);
    } else {
      cur.t1 = i;
      if (Math.abs(v[i]) > Math.abs(cur.amp)) cur.amp = v[i];
    }
  }
  // drop tiny lobes, merging neighbours of the same sign
  const lobes: Lobe[] = [];
  for (const lb of raw) {
    if (Math.abs(lb.amp) < minLobe) continue;
    const last = lobes[lobes.length - 1];
    if (last && last.sign === lb.sign) {
      last.t1 = lb.t1;
      if (Math.abs(lb.amp) > Math.abs(last.amp)) last.amp = lb.amp;
    } else lobes.push({ ...lb });
  }
  // notches: local extrema inside a lobe with a reversal ≥ 0.05 mV
  for (const lb of lobes) {
    let peaks = 0;
    let trend = 0;
    let ext = v[lb.t0];
    for (let i = lb.t0 + 1; i <= lb.t1; i++) {
      const x = v[i] * lb.sign;
      const e = ext * lb.sign;
      if (trend >= 0) {
        if (x > e) ext = v[i];
        else if (e - x > 0.05) {
          peaks++;
          trend = -1;
          ext = v[i];
        }
      } else {
        if (x < e) ext = v[i];
        else if (x - e > 0.05) {
          trend = 1;
          ext = v[i];
        }
      }
    }
    lb.notches = Math.max(0, peaks - (trend === -1 ? 1 : 0));
  }
  const maxAbs = Math.max(1e-6, ...lobes.map((x) => Math.abs(x.amp)));
  let pattern = '';
  let seenR = false;
  let rCount = 0;
  let sCount = 0;
  let q = 0;
  let qDur = 0;
  let s = 0;
  let rPrime = 0;
  if (lobes.length === 1 && lobes[0].sign < 0) pattern = Math.abs(lobes[0].amp) >= 0.5 * maxAbs ? 'QS' : 'qs';
  else
    for (const lb of lobes) {
      const big = Math.abs(lb.amp) >= 0.5 * maxAbs;
      if (lb.sign < 0 && !seenR) {
        pattern += big ? 'Q' : 'q';
        q = lb.amp;
        qDur = lb.t1 - lb.t0 + 1;
      } else if (lb.sign > 0) {
        seenR = true;
        pattern += (big ? 'R' : 'r') + "'".repeat(rCount);
        if (rCount > 0) rPrime = Math.max(rPrime, lb.amp);
        rCount++;
      } else {
        pattern += (big ? 'S' : 's') + "'".repeat(sCount);
        sCount++;
        s = Math.min(s, lb.amp);
      }
    }
  const rMax = Math.max(0, ...v);
  let rPeakTime = 0;
  for (let i = 0; i < v.length; i++) if (v[i] === rMax) rPeakTime = i;
  const minAll = Math.min(0, ...v);
  const J = t0 + dur;
  let tMax = 0;
  let tMin = 0;
  for (let t = b.morph.tStart; t <= b.morph.tEnd; t += 1) {
    const x = at(r, l, t0 + t) - base;
    tMax = Math.max(tMax, x);
    tMin = Math.min(tMin, x);
  }
  const tPeak = Math.abs(tMin) > Math.abs(tMax) ? tMin : tMax;
  // U wave: largest deflection 40–200 ms after T end, relative to the TP level at T end + 220 ms
  let uPeak = 0;
  for (let t = b.morph.tEnd - 20; t <= b.morph.tEnd + 130; t++) {
    const x = at(r, l, t0 + t) - base;
    if (Math.abs(x) > Math.abs(uPeak)) uPeak = x;
  }
  let term = 0;
  for (let t = Math.max(0, Math.round(dur) - 40); t <= Math.round(dur); t++) term += v[t];
  term /= 41;
  return {
    base,
    lobes,
    pattern: pattern || 'flat',
    q,
    qDur,
    r: Math.max(0, ...lobes.filter((x) => x.sign > 0).map((x) => x.amp)),
    s,
    rPrime,
    minAll,
    ptp: rMax - minAll,
    stJ: at(r, l, J) - base,
    st60: at(r, l, J + 60) - base,
    st80: at(r, l, J + 80) - base,
    tPeak,
    tMax,
    tMin,
    uPeak,
    rPeakTime,
    terminal40: term,
  };
}

export interface PFeatures {
  pos: number;
  neg: number;
  /** duration (ms) where |P| exceeds 0.02 mV in this lead */
  dur: number;
  /** number of positive peaks separated by a dip ≥ 0.01 mV */
  peaks: number;
  peakSep: number;
  /** V1 terminal negative area (mm·s, Morris index: depth mm × duration s) */
  termNegArea: number;
  termNegDur: number;
  modelDur: number;
}

export function pFeatures(r: EcgRun, aIdx: number, l: LeadId): PFeatures {
  const a = r.sim.atrial[aIdx];
  const pm = buildP(r.physio, a.site);
  const base = at(r, l, a.t - 2);
  const span = Math.round(pm.pDur + 10);
  const v: number[] = [];
  for (let t = 0; t <= span; t++) v.push(at(r, l, a.t + t) - base);
  let pos = 0;
  let neg = 0;
  let first = -1;
  let last = -1;
  for (let i = 0; i < v.length; i++) {
    pos = Math.max(pos, v[i]);
    neg = Math.min(neg, v[i]);
    if (Math.abs(v[i]) > 0.02) {
      if (first < 0) first = i;
      last = i;
    }
  }
  // positive peaks
  const pk: number[] = [];
  for (let i = 2; i < v.length - 2; i++) if (v[i] > 0.03 && v[i] >= v[i - 1] && v[i] > v[i + 1] && v[i] >= v[i - 2] && v[i] > v[i + 2]) pk.push(i);
  let peaks = pk.length;
  let peakSep = 0;
  if (pk.length >= 2) {
    const lo = Math.min(...v.slice(pk[0], pk[pk.length - 1]));
    if (Math.min(v[pk[0]], v[pk[pk.length - 1]]) - lo < 0.01) peaks = 1;
    else peakSep = pk[pk.length - 1] - pk[0];
  }
  // Terminal negative portion (Morris index): depth (mm) × duration (s) of the negative deflection
  // in the second half of the P wave.
  const half = Math.floor(pm.pDur / 2);
  let iMin = half;
  for (let i = half; i < Math.min(v.length, Math.round(pm.pDur) + 5); i++) if (v[i] < v[iMin]) iMin = i;
  let termNegArea = 0;
  let termNegDur = 0;
  if (v[iMin] < -0.005) {
    let a0 = iMin;
    let a1 = iMin;
    while (a0 > 0 && v[a0 - 1] < -0.005) a0--;
    while (a1 < v.length - 1 && v[a1 + 1] < -0.005) a1++;
    termNegDur = a1 - a0 + 1;
    termNegArea = -v[iMin] * 10 * (termNegDur / 1000);
  }
  return { pos, neg, dur: first >= 0 ? last - first + 1 : 0, peaks, peakSep, termNegArea, termNegDur, modelDur: pm.pDur };
}

/** Signal-derived QRS duration: span over which the spatial magnitude of the activation vector exceeds 2.5 % of its peak. */
export function qrsDurFromSignal(r: EcgRun, b: BeatInfo): number {
  // Use only activation components so overlapping ST/T do not bias the end.
  const comps = b.morph.comps.filter((c) => c.t0 < b.morph.qrsDur - 13 && !/ST segment|T wave|U wave|J-point|Osborn/.test(c.tag));
  let peak = 0;
  const mags: number[] = [];
  for (let t = -20; t <= b.morph.qrsDur + 80; t++) {
    let x = 0;
    let y = 0;
    let z = 0;
    for (const c of comps) {
      const u = (t - c.t0) / c.dur;
      if (u <= 0 || u >= 1) continue;
      const s = shape(c.shape, u);
      x += c.dir[0] * c.amp * s;
      y += c.dir[1] * c.amp * s;
      z += c.dir[2] * c.amp * s;
    }
    const m = Math.hypot(x, y, z);
    mags.push(m);
    peak = Math.max(peak, m);
  }
  let on = -1;
  let off = -1;
  for (let i = 0; i < mags.length; i++) if (mags[i] > 0.025 * peak) {
    if (on < 0) on = i;
    off = i;
  }
  return off - on;
}

function shape(s: string, u: number): number {
  switch (s) {
    case 'bump':
      return Math.sin(Math.PI * u) ** 2;
    case 'tskew':
      return Math.sin(Math.PI * u ** 1.45) ** 2;
    case 'spike':
      return u < 0.5 ? u * 2 : (1 - u) * 2;
    case 'ramp':
      return u < 0.7 ? Math.pow(u / 0.7, 1.3) : Math.pow(1 - (u - 0.7) / 0.3, 2);
    default:
      return Math.sin(Math.PI * u) ** 2;
  }
}

export function allQrs(r: EcgRun, b: BeatInfo, leads: LeadId[] = TWELVE): Record<string, QrsFeatures> {
  const o: Record<string, QrsFeatures> = {};
  for (const l of leads) o[l] = qrsFeatures(r, b, l);
  return o;
}

export const mm = (mV: number): number => Math.round(mV * 100) / 10;

/** Value of lead `l` at absolute time t (ms). */
export function valueAt(r: EcgRun, l: LeadId, t: number): number {
  return at(r, l, t);
}

/** Net QRS area (mV·ms) of beat b in lead l, relative to the QRS-onset level. */
export function netQrsArea(r: EcgRun, b: BeatInfo, l: LeadId): number {
  const base = at(r, l, b.ev.t);
  let s = 0;
  for (let t = 0; t <= b.morph.qrsDur; t++) s += at(r, l, b.ev.t + t) - base;
  return s;
}

/** Visible beats (inside the strip). */
export const visBeats = (r: EcgRun): BeatInfo[] => r.sig.beats.filter((b) => b.ev.t >= 0 && b.ev.t < r.sim.duration);

/** Frontal axis computed from the SIGNAL: net QRS areas in I and aVF (aVF de-augmented by √3/2). */
export function signalAxis(r: EcgRun, b: BeatInfo): number {
  const i = netQrsArea(r, b, 'I');
  const f = netQrsArea(r, b, 'aVF') / (Math.sqrt(3) / 2);
  return (Math.atan2(f, i) * 180) / Math.PI;
}

/** Time (ms from QRS onset) to reach half of the largest absolute QRS deflection in lead l. */
export function halfRiseTime(r: EcgRun, b: BeatInfo, l: LeadId): number {
  const base = at(r, l, b.ev.t);
  let peak = 0;
  for (let t = 0; t <= b.morph.qrsDur; t++) peak = Math.max(peak, Math.abs(at(r, l, b.ev.t + t) - base));
  for (let t = 0; t <= b.morph.qrsDur; t++) if (Math.abs(at(r, l, b.ev.t + t) - base) >= peak / 2) return t;
  return b.morph.qrsDur;
}

export { buildP, PRESETS, makePhysio, runEcg };
