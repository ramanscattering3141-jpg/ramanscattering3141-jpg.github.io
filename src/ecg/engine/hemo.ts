// Mechanical consequences of the electrical simulation: a closed-loop, lumped-parameter model of
// the circulation in which each cardiac chamber is a time-varying elastance (Suga & Sagawa)
// switched on by the ELECTRICAL events that the rhythm engine produced.
//
//   chamber pressure  P(t) = e(t)·Ees·(V − V0) + (1 − e(t))·EDPVR(V)      (+ pericardial pressure)
//
// e(t) (0 = fully relaxed, 1 = end-systole) is driven by each chamber's local activation: atrial
// contraction follows each P wave, ventricular contraction follows each QRS, and dyssynchronous
// activation (bundle-branch block, pacing, ectopy, pre-excitation) is modelled as segments of
// the ventricle contracting at staggered times — which lowers dP/dt and stroke volume exactly as
// in real hearts. Valves are pressure-driven (semilunar valves carry blood inertia, which is what
// produces the incisura of the aortic pressure trace). Nothing is drawn by hand: cannon a waves,
// loss of the atrial kick in AF, pulse deficit after early ectopics, paradoxical splitting of S2 in
// LBBB and the absent output of VF all EMERGE from the timing of the electrical events.
//
// Units: mL, mmHg, seconds inside the integrator; ms on the public interface (like the ECG).
// Parameter values are typical resting adult values from the lumped-model literature
// (Suga & Sagawa 1974; Smith, Chase et al. 2004; Ursino 1998) tuned to give BP ≈ 120/75 mmHg,
// LVEDV ≈ 120–130 mL, EF ≈ 60 % and CO ≈ 5 L/min in normal sinus rhythm at 72/min.

import type { Physio } from './params';
import type { EcgRun } from './index';
import type { VentEvent } from './rhythm';
import { VENT_SITE, AP_SITE } from './morphology';
import { qtAtRR, qtcEffective } from './derived';

export type ValveId = 'mitral' | 'tricuspid' | 'aortic' | 'pulmonary';
export type CyclePhase = 'atrialSystole' | 'isoContraction' | 'rapidEjection' | 'reducedEjection' | 'isoRelaxation' | 'rapidFilling' | 'diastasis' | 'noOutput';

export interface ValveEvent {
  t: number; // ms
  valve: ValveId;
  kind: 'open' | 'close';
}

export interface SoundEvent {
  t: number; // ms
  kind: 'S1' | 'S2' | 'S3' | 'S4';
  component: 'M1' | 'T1' | 'A2' | 'P2' | 'S3' | 'S4';
  /** Relative loudness 0..~1.5 (1 = a normal S1/S2 component). */
  amp: number;
}

export interface BeatHemo {
  /** Time (ms) of the QRS that started this mechanical systole. */
  t: number;
  edv: number;
  esv: number;
  sv: number;
  ef: number;
  sbp: number;
  dbp: number;
  /** false = the aortic valve never opened: the beat produced no pulse (pulse deficit). */
  ejected: boolean;
  lvedp: number;
  rvSv: number;
}

export interface HemoSummary {
  hr: number;
  pulseRate: number;
  sbp: number;
  dbp: number;
  map: number;
  sv: number;
  co: number; // L/min
  ef: number; // %
  lvedv: number;
  lvedp: number;
  rap: number;
  pasp: number;
  padp: number;
  pawp: number; // mean left-atrial ≈ pulmonary artery wedge pressure
  pulseDeficit: number; // per min
}

export interface HemoResult {
  fs: number;
  from: number;
  n: number;
  lvP: Float32Array;
  aoP: Float32Array;
  laP: Float32Array;
  rvP: Float32Array;
  paP: Float32Array;
  raP: Float32Array;
  jvp: Float32Array;
  lvV: Float32Array;
  rvV: Float32Array;
  laV: Float32Array;
  raV: Float32Array;
  /** Ventricular / atrial activation state 0..1 (drives the 3-D contraction). */
  eLv: Float32Array;
  eRv: Float32Array;
  eLa: Float32Array;
  eRa: Float32Array;
  qMv: Float32Array;
  qAv: Float32Array;
  qTv: Float32Array;
  qPv: Float32Array;
  /** Bit field per sample: 1 mitral, 2 tricuspid, 4 aortic, 8 pulmonary open. */
  valves: Uint8Array;
  phase: CyclePhase[];
  pcg: Float32Array;
  valveEvents: ValveEvent[];
  sounds: SoundEvent[];
  beats: BeatHemo[];
  summary: HemoSummary;
  /** Plain-language mechanical notes for this rhythm (e.g. "cannon a waves"). */
  notes: string[];
}

export const PHASE_LABEL: Record<CyclePhase, string> = {
  atrialSystole: 'Atrial systole (atrial kick)',
  isoContraction: 'Isovolumetric contraction',
  rapidEjection: 'Rapid ejection',
  reducedEjection: 'Reduced ejection',
  isoRelaxation: 'Isovolumetric relaxation',
  rapidFilling: 'Rapid (early) filling',
  diastasis: 'Diastasis (slow filling)',
  noOutput: 'No coordinated contraction',
};

export const PHASE_TEXT: Record<CyclePhase, string> = {
  atrialSystole: 'The atria contract after the P wave and top up the relaxed ventricles (≈ 20 % of filling at rest, more in stiff ventricles, absent in AF). Mitral and tricuspid valves open, semilunar valves closed.',
  isoContraction: 'The QRS has activated the ventricles; pressure rises steeply but all four valves are closed, so volume cannot change. Mitral/tricuspid closure makes the first heart sound (S1).',
  rapidEjection: 'Ventricular pressure exceeds aortic (and pulmonary) pressure: the semilunar valves open and most of the stroke volume leaves during the ST segment.',
  reducedEjection: 'Ventricular cells are repolarising (T wave); active tension falls, outflow slows, aortic pressure peaks and starts to fall.',
  isoRelaxation: 'Near the end of the T wave ventricular pressure drops below aortic pressure: the aortic and pulmonary valves close (S2 = A2 then P2). All valves closed again; pressure falls at constant volume.',
  rapidFilling: 'Ventricular pressure falls below atrial pressure, the AV valves open and blood rushes in (the JVP y descent). An S3 occurs here if a large volume decelerates in a stiff or overfilled ventricle.',
  diastasis: 'Slow filling while atria and ventricles are both relaxed (TP segment). Shortens and disappears at fast heart rates — the reason diastolic filling suffers in tachycardia.',
  noOutput: 'Without organised ventricular activation there is no coordinated contraction: no valves open, no stroke volume, no pulse — pressures drift toward the mean systemic filling pressure (~7 mmHg).',
};

// ---------------------------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------------------------

interface Ventricle {
  ees: number; // end-systolic elastance mmHg/mL
  v0: number; // mL
  a: number; // EDPVR scale mmHg
  k: number; // EDPVR stiffness 1/mL
}
interface Atrium {
  emin: number;
  emax: number;
  v0: number;
}

interface Params {
  lv: Ventricle;
  rv: Ventricle;
  la: Atrium;
  ra: Atrium;
  rMv: number;
  rTv: number;
  rAv: number;
  lAv: number;
  rPv: number;
  lPv: number;
  cAo: number;
  rC: number;
  lC: number;
  cSa: number;
  rSys: number;
  cSv: number;
  rVr: number;
  cPa: number;
  rPul: number;
  cPv: number;
  rPvLa: number;
  ppc: number; // pericardial pressure (tamponade)
  totalStressed: number;
  emd: number; // electromechanical delay (ms)
  /** Atrial contraction strength multiplier (flutter ~0.35, normal 1). */
  atrialGain: number;
}

function paramsFor(p: Physio): Params {
  const isch = p.ischemia;
  let lvK = 1;
  let rvK = 1;
  const ext = Math.max(0, Math.min(1, isch.extent));
  const rvTerritory = isch.territory === 'rv' || isch.territory === 'proxRCA';
  switch (isch.stage) {
    case 'hyperacute':
    case 'stemi':
    case 'deWinter':
      lvK *= isch.territory === 'rv' ? 0.95 : 1 - 0.33 * ext;
      if (rvTerritory) rvK *= 1 - 0.55 * ext;
      break;
    case 'evolving':
    case 'old':
      lvK *= 1 - 0.25 * ext;
      if (rvTerritory) rvK *= 1 - 0.3 * ext;
      break;
    case 'aneurysm':
      lvK *= 1 - 0.38 * ext;
      break;
    case 'takotsubo':
      lvK *= 0.5;
      break;
    case 'subendocardial':
      lvK *= isch.territory === 'diffuseSubendo' ? 0.8 : 0.92;
      break;
    case 'wellens':
      lvK *= 0.95;
      break;
    default:
      break;
  }
  const symp = p.autonomic;
  const inotropy = (1 + 0.32 * Math.max(0, symp) + 0.08 * Math.min(0, symp)) * (1 - 0.15 * p.drugs.betaBlocker) * (1 - 0.15 * p.drugs.ccb) * (1 - 0.4 * p.myocarditis) * (1 - 0.35 * p.hypothermia) * (p.K > 7 ? 1 - Math.min(0.4, (p.K - 7) * 0.2) : 1) * (1 + 0.08 * Math.min(1, p.drugs.digoxin));
  lvK *= inotropy;
  rvK *= inotropy * (1 - 0.45 * p.arvc);
  const lvMass = Math.max(0.6, p.lvMass);
  const lvStiff = Math.pow(lvMass, 1.6) * (1 + 1.4 * p.hcm) * (isch.stage !== 'none' && isch.stage !== 'old' ? 1.25 : 1) * (1 + 0.25 * p.hypothermia);
  const rvStiff = Math.pow(Math.max(0.6, p.rvMass), 1.3);
  const lv: Ventricle = { ees: 2.3 * lvK * Math.pow(lvMass, 0.4) * (1 + 0.2 * p.hcm), v0: 10, a: 0.27 * lvStiff, k: 0.03 * (1 + 0.15 * (lvMass - 1)) };
  const rv: Ventricle = { ees: ((globalThis as unknown as { __rve?: number }).__rve ?? 0.5) * rvK * Math.pow(Math.max(0.6, p.rvMass), 0.5), v0: 15, a: 0.22 * rvStiff, k: 0.024 };
  const tamponade = p.alternans > 0.2 ? 6 + 10 * p.alternans : 0;
  return {
    lv,
    rv,
    la: { emin: 0.13 / Math.pow(Math.max(0.5, p.laSize), 0.8), emax: 0.42, v0: 5 * p.laSize },
    ra: { emin: 0.1 / Math.pow(Math.max(0.5, p.raSize), 0.8), emax: 0.3, v0: 5 * p.raSize },
    rMv: 0.006,
    rTv: 0.005,
    rAv: 0.004,
    lAv: 0.0006,
    rPv: 0.003,
    lPv: (globalThis as unknown as { __lpv?: number }).__lpv ?? 0.0016,
    cAo: 0.35,
    rC: 0.04,
    lC: 0.0012,
    cSa: 1.15 * (1 - Math.min(0.45, Math.max(0, p.age - 40) * 0.008)),
    rSys: 0.95 * (1 + 0.25 * Math.max(0, symp)) * (1 + 0.3 * p.hypothermia),
    cSv: 55,
    rVr: 0.035,
    cPa: 3.2,
    rPul: 0.075 * (1 + 3.2 * p.rvStrain),
    cPv: 11,
    rPvLa: 0.01,
    ppc: tamponade,
    totalStressed: 960 + (tamponade ? 140 : 0),
    emd: 18,
    atrialGain: 1,
  };
}

// ---------------------------------------------------------------------------------------------
// Activation (elastance) waveforms
// ---------------------------------------------------------------------------------------------

/** Normalised activation of a contracting segment τ ms after its local mechanical onset. */
function twitch(tau: number, tp: number, tr: number): number {
  if (tau <= 0) return 0;
  // Brisk rise (cross-bridge recruitment), slower approach to the end-systolic peak.
  if (tau < tp) {
    const u = tau / tp;
    const g = (globalThis as unknown as { __tw?: number }).__tw ?? 0;
    if (g === 0) return 0.5 * (1 - Math.cos(Math.PI * Math.pow(u, 0.62)));
    if (g === 1) return u * (1.5 - 0.5 * u * u);
    if (g === 2) return Math.min(1, u * (1.25 - 0.25 * u * u * u));
    return Math.pow(u, 0.75);
  }
  if (tau < tp + tr) return 0.5 * (1 + Math.cos((Math.PI * (tau - tp)) / tr));
  return 0;
}

interface MechBeat {
  t: number; // QRS onset (ms)
  ev: VentEvent | null;
  /** Segment onset delays (ms after t) and weights, per ventricle. */
  lvSeg: number[];
  rvSeg: number[];
  tp: number;
  tr: number;
  gain: number;
}

interface MechAtrial {
  t: number;
  raOn: number;
  laOn: number;
  gain: number;
}

function spread(a: number, b: number, n = 6): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(a + ((b - a) * (i + 0.5)) / n);
  return out;
}

/** Order and timing of LV vs RV activation for one ventricular event, from its route. */
function segmentTiming(p: Physio, ev: VentEvent | null, qrs: number): { lv: number[]; rv: number[]; sync: number } {
  const q = Math.max(70, qrs);
  if (!ev || ev.route === 'his') {
    let bundle = p.bundle as string;
    if (ev?.aberrant === 'rbbb' && !bundle.startsWith('rbbb')) bundle = 'rbbb';
    if (bundle === 'lbbb') return { lv: spread(35, q - 5), rv: spread(0, 55), sync: 0.86 };
    if (bundle.startsWith('rbbb')) return { lv: spread(0, 75), rv: spread(45, q - 5), sync: 0.97 };
    if (bundle === 'ivcd') return { lv: spread(5, q - 10), rv: spread(5, q - 20), sync: 0.92 };
    return { lv: spread(0, Math.min(80, q - 10)), rv: spread(5, Math.min(75, q - 15)), sync: 1 };
  }
  // Pre-excitation: the pathway's ventricle is activated first, the rest via the His–Purkinje system.
  if (ev.route === 'ap') {
    const loc = ev.apLocation ?? p.rhythm.ap.location;
    const left = AP_SITE[loc].pos[0] > 0;
    const early = spread(0, 45, 3);
    const late = spread(Math.min(60, ev.hisDelay), q - 5, 3);
    return left ? { lv: [...early, ...late], rv: spread(Math.min(70, ev.hisDelay + 5), q - 15), sync: 0.94 } : { lv: spread(Math.min(70, ev.hisDelay + 5), q - 10), rv: [...early, ...late], sync: 0.94 };
  }
  // Paced (RV lead) or ectopic focus: the ventricle containing the focus contracts first and the
  // other is reached late by slow cell-to-cell conduction.
  const site = ev.route === 'paced' ? 'rvApex' : (ev.site ?? 'rvApex');
  const fascicular = site === 'fascicularPosterior' || site === 'fascicularAnterior';
  if (fascicular) return { lv: spread(0, 70), rv: spread(40, q - 5), sync: 0.93 };
  const rvSide = VENT_SITE[site].rv;
  return rvSide ? { lv: spread(40, q), rv: spread(0, 60), sync: 0.84 } : { lv: spread(0, q - 30), rv: spread(45, q), sync: 0.84 };
}

// ---------------------------------------------------------------------------------------------
// Electrical → mechanical activation
// ---------------------------------------------------------------------------------------------

interface Activation {
  t0: number; // ms of sample 0 (whole ms)
  len: number;
  lv: Float32Array;
  rv: Float32Array;
  la: Float32Array;
  ra: Float32Array;
  mechA: MechAtrial[];
  mechV: MechBeat[];
  ventFib: [number, number][];
}

const ATP = 80; // atrial twitch time-to-peak (ms)
const ATR = 110; // atrial relaxation (ms)

function buildActivation(run: EcgRun, P: Params, tStart: number, tEnd: number): Activation {
  const p = run.physio;
  const sim = run.sim;
  const sig = run.sig;
  const morphByT = new Map<number, (typeof sig.beats)[number]>();
  for (const b of sig.beats) morphByT.set(b.ev.t, b);
  const vents = sim.ventricular.slice().sort((a, b) => a.t - b.t);
  const fib = sim.continuous.filter((c) => c.kind === 'fib').map((c) => [c.t0, c.t1] as [number, number]);
  const ventFib = sim.continuous.filter((c) => c.kind === 'vf' || c.kind === 'vflutter').map((c) => [c.t0, c.t1] as [number, number]);
  const inside = (r: [number, number][], t: number): boolean => r.some(([a, b]) => t >= a && t <= b);

  const mechV: MechBeat[] = [];
  for (let i = 0; i < vents.length; i++) {
    const ev = vents[i];
    if (inside(ventFib, ev.t)) continue;
    const b = morphByT.get(ev.t);
    const rr = i > 0 ? ev.t - vents[i - 1].t : 830;
    const qrs = b?.morph.qrsDur ?? 90;
    const qt = b?.morph.qt ?? qtAtRR(qtcEffective(p), Math.max(250, rr));
    const seg = segmentTiming(p, ev, qrs);
    // Mechanical systole ends (aortic closure, S2) close to the end of the T wave: the active state
    // peaks shortly before that and decays over isovolumetric relaxation.
    const G = globalThis as unknown as { __tpo?: number; __trf?: number };
    const tp = Math.max(110, qt - P.emd - (G.__tpo ?? 40));
    const tr = Math.max(80, (G.__trf ?? 0.4) * tp);
    const poly = /poly|torsade|bidirect/i.test(ev.mechanism ?? '');
    mechV.push({ t: ev.t, ev, lvSeg: seg.lv, rvSeg: seg.rv, tp, tr, gain: seg.sync * (poly ? 0.6 : 1) });
  }
  const mechA: MechAtrial[] = [];
  for (const a of sim.atrial) {
    if (inside(fib, a.t)) continue;
    const flutter = a.kind === 'flutter';
    const laFirst = a.site === 'leftAtrial' || a.site === 'lowLA' || a.site === 'retroLeftLateral';
    const both = a.site === 'retroSeptal' || a.site === 'retroPosteroseptal';
    const inter = 28 + p.interatrialDelay;
    // Atrial contraction begins ≈ 40 ms after local activation (mid-P wave).
    const raOn = a.t + 35 + (laFirst ? inter : both ? 5 : 0);
    const laOn = a.t + 35 + (laFirst ? 0 : both ? 10 : inter);
    mechA.push({ t: a.t, raOn, laOn, gain: flutter ? 0.3 : 1 });
  }

  const len = Math.ceil(tEnd - tStart) + 2;
  const lv = new Float32Array(len);
  const rv = new Float32Array(len);
  const la = new Float32Array(len);
  const ra = new Float32Array(len);
  const tmpL = new Float32Array(len);
  const tmpR = new Float32Array(len);
  for (const b of mechV) {
    const s0 = Math.max(0, Math.floor(b.t - tStart));
    const s1 = Math.min(len, Math.ceil(b.t + P.emd + b.tp + b.tr + 140 - tStart));
    if (s1 <= 0 || s0 >= len) continue;
    tmpL.fill(0, s0, s1);
    tmpR.fill(0, s0, s1);
    // Later-activated segments have shorter action potentials (and twitches), so the whole
    // ventricle relaxes at about the same time — as in real hearts.
    const addSeg = (arr: Float32Array, d: number, w: number, rvSide: boolean): void => {
      const G = globalThis as unknown as { __rvo?: number; __shf?: number };
      const tp = Math.max(90, b.tp - (G.__shf ?? 0.3) * d + (rvSide ? (G.__rvo ?? 18) : 0));
      for (let s = s0; s < s1; s++) arr[s] += w * twitch(tStart + s - b.t - P.emd - d, tp, b.tr);
    };
    for (const d of b.lvSeg) addSeg(tmpL, d, b.gain / b.lvSeg.length, false);
    for (const d of b.rvSeg) addSeg(tmpR, d, b.gain / b.rvSeg.length, true);
    // Overlapping beats: myocardium that is still contracting cannot be re-activated beyond full activation.
    for (let s = s0; s < s1; s++) {
      if (tmpL[s] > lv[s]) lv[s] = Math.min(1, tmpL[s]);
      if (tmpR[s] > rv[s]) rv[s] = Math.min(1, tmpR[s]);
    }
  }
  for (const a of mechA) {
    const s0 = Math.max(0, Math.floor(Math.min(a.raOn, a.laOn) - tStart));
    const s1 = Math.min(len, Math.ceil(Math.max(a.raOn, a.laOn) + ATP + ATR + 2 - tStart));
    for (let s = s0; s < s1; s++) {
      const t = tStart + s;
      const l = twitch(t - a.laOn, ATP, ATR) * a.gain;
      const r = twitch(t - a.raOn, ATP, ATR) * a.gain;
      if (l > la[s]) la[s] = l;
      if (r > ra[s]) ra[s] = r;
    }
  }
  return { t0: tStart, len, lv, rv, la, ra, mechA, mechV, ventFib };
}

// ---------------------------------------------------------------------------------------------
// Integration
// ---------------------------------------------------------------------------------------------

interface Trace {
  lvP: Float32Array;
  aoP: Float32Array;
  laP: Float32Array;
  rvP: Float32Array;
  paP: Float32Array;
  raP: Float32Array;
  jvp: Float32Array;
  lvV: Float32Array;
  rvV: Float32Array;
  laV: Float32Array;
  raV: Float32Array;
  eLv: Float32Array;
  eRv: Float32Array;
  eLa: Float32Array;
  eRa: Float32Array;
  qMv: Float32Array;
  qAv: Float32Array;
  qTv: Float32Array;
  qPv: Float32Array;
  valves: Uint8Array;
}

interface CloseInfo {
  t: number;
  valve: ValveId;
  flow: number;
  p: number;
  dpdt: number;
}

function newTrace(n: number): Trace {
  const f = (): Float32Array => new Float32Array(n);
  return { lvP: f(), aoP: f(), laP: f(), rvP: f(), paP: f(), raP: f(), jvp: f(), lvV: f(), rvV: f(), laV: f(), raV: f(), eLv: f(), eRv: f(), eLa: f(), eRa: f(), qMv: f(), qAv: f(), qTv: f(), qPv: f(), valves: new Uint8Array(n) };
}

/** Integrate the circulation; records one sample per millisecond from `from` (n samples). */
function integrate(P: Params, act: Activation, from: number, n: number, dtMs: number): { tr: Trace; valveEvents: ValveEvent[]; closes: CloseInfo[]; peakMvFlow: number } {
  const dt = dtMs / 1000;
  const tr = newTrace(n);
  const valveEvents: ValveEvent[] = [];
  const closes: CloseInfo[] = [];
  const vPress = (v: Ventricle, e: number, V: number): number => e * v.ees * (V - v.v0) + (1 - e) * v.a * (Math.exp(Math.min(12, v.k * (V - v.v0))) - 1) + P.ppc;
  const aPress = (a: Atrium, e: number, V: number, shift: number): number => {
    const x = V - a.v0 - shift;
    return a.emin * x + e * (a.emax - a.emin) * Math.max(0, x) + P.ppc;
  };
  // Initial state: chamber volumes; vessel pressures (stressed volume = C·P).
  let Vlv = 120;
  let Vrv = 130;
  let Vla = 60;
  let Vra = 52;
  let Pao = 88;
  let Psa = 86;
  let Ppa = 14;
  let Ppv = 8;
  let Psv = Math.max(2, (P.totalStressed - (Vlv + Vrv + Vla + Vra + P.cAo * Pao + P.cSa * Psa + P.cPa * Ppa + P.cPv * Ppv)) / P.cSv);
  let Qav = 0;
  let Qpv = 0;
  let Qc = 0;
  let avOpen = false;
  let pvOpen = false;
  let mvOpen = true;
  let tvOpen = true;
  let lvEdv = Vlv;
  let rvEdv = Vrv;
  let mvT = -1e9;
  let tvT = -1e9;
  let avT = -1e9;
  let pvT = -1e9;
  let cBulge = 0;
  let mvRecent = 0;
  let tvRecent = 0;
  let peakMvFlow = 300;
  let prevErv = 0;
  const tEnd = from + n;
  const steps = Math.floor((tEnd - act.t0) / dtMs);
  const perMs = Math.round(1 / dtMs);
  const decayRecent = Math.exp(-dtMs / 45);
  const decayBulge = Math.exp(-dtMs / 35);
  const last = act.len - 1;
  for (let s = 0; s <= steps; s++) {
    const t = act.t0 + s * dtMs;
    // Activation by linear interpolation of the 1-ms grid.
    const x = s * dtMs;
    const i0 = Math.min(last - 1, Math.floor(x));
    const fr = x - i0;
    const eLv = act.lv[i0] + (act.lv[i0 + 1] - act.lv[i0]) * fr;
    const eRv = act.rv[i0] + (act.rv[i0 + 1] - act.rv[i0]) * fr;
    const eLa = act.la[i0] + (act.la[i0 + 1] - act.la[i0]) * fr;
    const eRa = act.ra[i0] + (act.ra[i0 + 1] - act.ra[i0]) * fr;
    // Descent of the AV plane during ejection enlarges the atria (x descent of the JVP).
    const Plv = vPress(P.lv, eLv, Vlv);
    const Prv = vPress(P.rv, eRv, Vrv);
    const Pla = aPress(P.la, eLa, Vla, 0.3 * Math.max(0, lvEdv - Vlv));
    const Pra = aPress(P.ra, eRa, Vra, 0.32 * Math.max(0, rvEdv - Vrv));

    // AV valves: pressure-driven with a little hysteresis (no chatter at equal pressures).
    const mvNow: boolean = mvOpen ? Pla >= Plv : Pla > Plv + 0.4 && t - mvT > 25;
    const tvNow: boolean = tvOpen ? Pra >= Prv : Pra > Prv + 0.3 && t - tvT > 25;
    const Qmv = mvNow ? (Pla - Plv) / P.rMv : 0;
    const Qtv = tvNow ? (Pra - Prv) / P.rTv : 0;
    if (mvNow !== mvOpen) {
      if (t >= from) valveEvents.push({ t, valve: 'mitral', kind: mvNow ? 'open' : 'close' });
      mvT = t;
      if (!mvNow) {
        closes.push({ t, valve: 'mitral', flow: mvRecent, p: Plv, dpdt: 0 });
        lvEdv = Vlv;
      }
      mvOpen = mvNow;
    }
    if (tvNow !== tvOpen) {
      if (t >= from) valveEvents.push({ t, valve: 'tricuspid', kind: tvNow ? 'open' : 'close' });
      tvT = t;
      if (!tvNow) {
        closes.push({ t, valve: 'tricuspid', flow: tvRecent, p: Prv, dpdt: 0 });
        rvEdv = Vrv;
      }
      tvOpen = tvNow;
    }
    mvRecent = Math.max(Qmv, mvRecent * decayRecent);
    tvRecent = Math.max(Qtv, tvRecent * decayRecent);
    if (Qmv > peakMvFlow && t > from) peakMvFlow = Qmv;

    // Semilunar valves cannot re-open until the ventricle has relaxed after closing.
    if (!avOpen && Plv > Pao + 0.5 && t - avT > 150) {
      avOpen = true;
      if (t >= from) valveEvents.push({ t, valve: 'aortic', kind: 'open' });
    }
    if (avOpen) {
      Qav += ((Plv - Pao - P.rAv * Qav) / P.lAv) * dt;
      if (Qav <= 0) {
        Qav = 0;
        avOpen = false;
        avT = t;
        if (t >= from) valveEvents.push({ t, valve: 'aortic', kind: 'close' });
        closes.push({ t, valve: 'aortic', flow: 0, p: Pao, dpdt: 0 });
      }
    }
    if (!pvOpen && Prv > Ppa + 0.5 && t - pvT > 150) {
      pvOpen = true;
      if (t >= from) valveEvents.push({ t, valve: 'pulmonary', kind: 'open' });
    }
    if (pvOpen) {
      Qpv += ((Prv - Ppa - P.rPv * Qpv) / P.lPv) * dt;
      if (Qpv <= 0) {
        Qpv = 0;
        pvOpen = false;
        pvT = t;
        if (t >= from) valveEvents.push({ t, valve: 'pulmonary', kind: 'close' });
        closes.push({ t, valve: 'pulmonary', flow: 0, p: Ppa, dpdt: 0 });
      }
    }
    Qc += ((Pao - Psa - P.rC * Qc) / P.lC) * dt;
    const Qsys = (Psa - Psv) / P.rSys;
    const dv = Psv - Pra;
    const Qvr = dv > 0 ? dv / P.rVr : dv / (P.rVr * 6); // venous valves limit reflux
    const Qpul = (Ppa - Ppv) / P.rPul;
    const Qpvla = (Ppv - Pla) / P.rPvLa;

    // Tricuspid leaflets bulge into the RA during isovolumetric contraction → c wave.
    if (!tvOpen && !pvOpen && eRv > prevErv) cBulge = Math.min(3, cBulge + 0.0012 * Math.max(0, Prv - Pra) * (dtMs / 0.1));
    else cBulge *= decayBulge;
    prevErv = eRv;

    if (s % perMs === 0) {
      const i = act.t0 + s / perMs - from;
      if (i >= 0 && i < n) {
        tr.lvP[i] = Plv;
        tr.aoP[i] = Pao;
        tr.laP[i] = Pla;
        tr.rvP[i] = Prv;
        tr.paP[i] = Ppa;
        tr.raP[i] = Pra;
        tr.jvp[i] = Pra + cBulge;
        tr.lvV[i] = Vlv;
        tr.rvV[i] = Vrv;
        tr.laV[i] = Vla;
        tr.raV[i] = Vra;
        tr.eLv[i] = eLv;
        tr.eRv[i] = eRv;
        tr.eLa[i] = eLa;
        tr.eRa[i] = eRa;
        tr.qMv[i] = Qmv;
        tr.qAv[i] = Qav;
        tr.qTv[i] = Qtv;
        tr.qPv[i] = Qpv;
        tr.valves[i] = (mvOpen ? 1 : 0) | (tvOpen ? 2 : 0) | (avOpen ? 4 : 0) | (pvOpen ? 8 : 0);
      }
    }
    Vlv += (Qmv - Qav) * dt;
    Vrv += (Qtv - Qpv) * dt;
    Vla += (Qpvla - Qmv) * dt;
    Vra += (Qvr - Qtv) * dt;
    Pao += ((Qav - Qc) / P.cAo) * dt;
    Psa += ((Qc - Qsys) / P.cSa) * dt;
    Psv += ((Qsys - Qvr) / P.cSv) * dt;
    Ppa += ((Qpv - Qpul) / P.cPa) * dt;
    Ppv += ((Qpul - Qpvla) / P.cPv) * dt;
    if (Vlv < P.lv.v0 * 0.5) Vlv = P.lv.v0 * 0.5;
    if (Vrv < P.rv.v0 * 0.5) Vrv = P.rv.v0 * 0.5;
  }
  return { tr, valveEvents, closes, peakMvFlow };
}

/** Simulate the mechanics for a run (≈ 20–40 ms for a 10-s strip). */
export function simulateHemo(run: EcgRun): HemoResult {
  const p = run.physio;
  const sig = run.sig;
  const P = paramsFor(p);
  const fs = 1000;
  const from = Math.round(sig.from);
  const n = Math.round((sig.n * 1000) / sig.fs);
  const tStart = from - 3000;
  const act = buildActivation(run, P, tStart, from + n);
  const arrest = p.rhythm.ventMechanism === 'asystole' || act.ventFib.some(([a]) => a <= from + 1000);

  // Arterial baroreflex (steady state): systemic resistance adjusts toward a normal mean arterial
  // pressure, within physiological limits. Not applied in cardiac arrest.
  if (!arrest) {
    const pre = integrate(P, act, from, n, 0.5);
    let m = 0;
    for (let i = Math.floor(n / 3); i < n; i++) m += pre.tr.aoP[i];
    m /= n - Math.floor(n / 3);
    const target = 93 + 0.25 * Math.max(0, p.age - 45) + 8 * Math.max(0, p.autonomic);
    if (m > 20) P.rSys *= Math.max(0.6, Math.min(1.8, Math.pow(target / m, 0.9)));
  }
  const { tr, valveEvents, closes, peakMvFlow } = integrate(P, act, from, n, 0.2);
  const out = tr;
  const mechA = act.mechA;
  const mechV = act.mechV;
  const tEnd = from + n;
  const ventFibAt = (t: number): boolean => act.ventFib.some(([a, b]) => t >= a && t <= b);

  // ---- cycle phase per sample
  const phase: CyclePhase[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = from + i;
    const v = out.valves[i];
    const mv = (v & 1) !== 0;
    const av = (v & 4) !== 0;
    const dE = i > 0 ? out.eLv[i] - out.eLv[i - 1] : 0;
    if ((ventFibAt(t) || p.rhythm.ventMechanism === 'asystole') && !av && out.eLv[i] < 0.05) phase[i] = 'noOutput';
    else if (av) phase[i] = 'rapidEjection';
    else if (!mv) phase[i] = dE >= 0 && out.eLv[i] < 0.98 ? 'isoContraction' : 'isoRelaxation';
    else if (out.eLa[i] > 0.05 && out.eLv[i] < 0.05) phase[i] = 'atrialSystole';
    else if (out.qMv[i] > 0.35 * peakMvFlow) phase[i] = 'rapidFilling';
    else phase[i] = 'diastasis';
  }
  // Split ejection into rapid / reduced at the beat's own peak outflow.
  for (let i = 0; i < n; ) {
    if ((out.valves[i] & 4) === 0) {
      i++;
      continue;
    }
    let j = i;
    let peak = 0;
    let peakAt = i;
    while (j < n && (out.valves[j] & 4) !== 0) {
      if (out.qAv[j] > peak) {
        peak = out.qAv[j];
        peakAt = j;
      }
      j++;
    }
    for (let k = i; k < j; k++) phase[k] = k <= peakAt || out.qAv[k] > 0.55 * peak ? 'rapidEjection' : 'reducedEjection';
    i = j;
  }
  // Rapid filling continues until the early inflow wave has largely decelerated.
  for (let i = 1; i < n; i++) if (phase[i] === 'diastasis' && phase[i - 1] === 'isoRelaxation') phase[i] = 'rapidFilling';

  // ---- heart sounds
  const sounds: SoundEvent[] = [];
  // S1: the AV valves are tensed shut as ventricular pressure rises after each QRS. It is loud when
  // the leaflets are still wide open as systole begins (short PR, high flow, brisk dP/dt) and soft
  // after a long PR, when they have already floated almost shut.
  const lastOpenFlow = (qs: Float32Array, bit: number, i: number): number => {
    let j = i;
    while (j > 0 && (out.valves[j] & bit) === 0 && i - j < 400) j--;
    let m = 0;
    for (let k = Math.max(0, j - 70); k <= j; k++) m = Math.max(m, qs[k]);
    return i - j < 400 ? m : 0;
  };
  for (const b of mechV) {
    if (b.t < from || b.t > tEnd - 100) continue;
    for (const [bit, press, flow, comp, k] of [
      [1, out.lvP, out.qMv, 'M1', 1],
      [2, out.rvP, out.qTv, 'T1', 0.55],
    ] as [number, Float32Array, Float32Array, 'M1' | 'T1', number][]) {
      const i0 = Math.round(b.t + P.emd - from);
      let at = -1;
      let dpMax = 0;
      for (let i = Math.max(1, i0); i < Math.min(n, i0 + 160); i++) {
        const d = (press[i] - press[i - 1]) * 1000;
        if (at < 0 && (out.valves[i] & bit) === 0 && d > (bit === 1 ? 250 : 60)) at = i;
        if (at >= 0) {
          dpMax = Math.max(dpMax, d);
          if (i - at > 40) break;
        }
      }
      if (at < 0) continue;
      const leaflet = Math.min(1, lastOpenFlow(flow, bit, at) / Math.max(100, 0.45 * peakMvFlow * (bit === 1 ? 1 : 1.1)));
      const dp = Math.min(1.4, Math.max(0.25, dpMax / (bit === 1 ? 1300 : 350)));
      sounds.push({ t: from + at, kind: 'S1', component: comp, amp: (0.3 + 0.75 * leaflet) * dp * k });
    }
  }
  for (const c of closes) {
    if (c.t < from || c.t > tEnd) continue;
    if (c.valve === 'mitral' || c.valve === 'tricuspid') continue;
    {
      // Closing pressure determines S2 component intensity (loud P2 in pulmonary hypertension).
      const amp = c.valve === 'aortic' ? Math.min(1.5, Math.max(0.2, c.p / 100)) : Math.min(1.4, Math.max(0.15, (c.p / 25) * 0.5));
      sounds.push({ t: c.t, kind: 'S2', component: c.valve === 'aortic' ? 'A2' : 'P2', amp });
    }
  }
  // S3: rapid deceleration of a large early inflow when atrial pressure is high.
  for (const ev of valveEvents) {
    if (ev.valve !== 'mitral' || ev.kind !== 'open') continue;
    const i0 = Math.round(ev.t - from);
    if (i0 < 0 || i0 >= n) continue;
    let peakQ = 0;
    let at = i0;
    for (let i = i0; i < Math.min(n, i0 + 160); i++)
      if (out.qMv[i] > peakQ) {
        peakQ = out.qMv[i];
        at = i;
      }
    const lap = out.laP[i0];
    if (lap > 18 && peakQ > 250 && out.eLa[i0] < 0.05) sounds.push({ t: from + at + 30, kind: 'S3', component: 'S3', amp: Math.min(1, 0.35 + (lap - 18) / 16) });
  }
  // S4: atrial contraction into a stiff ventricle (needs an atrial contraction — never in AF).
  for (const a of mechA) {
    if (a.gain < 0.5) continue;
    const i = Math.round(a.laOn + ATP - from);
    const iPre = Math.round(a.laOn - from);
    if (iPre < 0 || i >= n) continue;
    if ((out.valves[i] & 1) === 0 || (out.valves[iPre] & 1) === 0) continue;
    const rise = out.lvP[i] - out.lvP[iPre];
    if (rise > 5) sounds.push({ t: from + i, kind: 'S4', component: 'S4', amp: Math.min(1, (rise - 5) / 6 + 0.3) });
  }
  sounds.sort((a, b) => a.t - b.t);

  // Atrial contractions that occur while the tricuspid valve is shut → cannon a waves.
  let cannon = 0;
  let atrialBeats = 0;
  for (const a of mechA) {
    if (a.gain < 0.5) continue;
    const i = Math.round(a.raOn + ATP - from);
    if (i < 300 || i >= n) continue;
    atrialBeats++;
    if ((out.valves[i] & 2) === 0) cannon++;
  }

  // ---- phonocardiogram (damped low-frequency vibrations)
  const pcg = new Float32Array(n);
  const addSound = (t0: number, amp: number, f: number, dur: number, ph: number): void => {
    const i0 = Math.round(t0 - from);
    for (let k = 0; k < dur; k++) {
      const i = i0 + k;
      if (i < 0 || i >= n) continue;
      const u = k / dur;
      const env = Math.sin(Math.PI * Math.min(1, u * 2.2)) * Math.exp(-3.2 * u);
      pcg[i] += amp * env * Math.sin(2 * Math.PI * f * (k / 1000) + ph);
    }
  };
  for (const s of sounds) {
    if (s.kind === 'S1') addSound(s.t + 6, s.amp, 55, 60, 0.3);
    else if (s.kind === 'S2') addSound(s.t + 3, s.amp, 85, 45, 1.1);
    else addSound(s.t, s.amp * 0.55, 30, 70, 2);
  }

  // ---- per-beat haemodynamics
  const beats: BeatHemo[] = [];
  const vTimes = mechV.map((b) => b.t).filter((t) => t >= from - 50 && t < tEnd);
  for (let k = 0; k < vTimes.length; k++) {
    const t0 = vTimes[k];
    const t1 = k + 1 < vTimes.length ? vTimes[k + 1] : tEnd;
    const i0 = Math.max(0, Math.round(t0 - from));
    const i1 = Math.min(n - 1, Math.round(t1 - from));
    if (i1 - i0 < 30) continue;
    // End-diastole = mitral closure (or QRS onset if the valve was already shut).
    let ied = i0;
    for (let i = i0; i < Math.min(n, i0 + 90); i++)
      if ((out.valves[i] & 1) === 0) {
        ied = i;
        break;
      }
    const edv = out.lvV[ied];
    let esv = Infinity;
    let rvEs = Infinity;
    let sbp = -Infinity;
    let dbp = Infinity;
    let ejected = false;
    for (let i = i0; i <= i1; i++) {
      esv = Math.min(esv, out.lvV[i]);
      rvEs = Math.min(rvEs, out.rvV[i]);
      sbp = Math.max(sbp, out.aoP[i]);
      dbp = Math.min(dbp, out.aoP[i]);
      if (out.valves[i] & 4) ejected = true;
    }
    const sv = ejected ? Math.max(0, edv - esv) : 0;
    beats.push({ t: t0, edv, esv, sv, ef: edv > 0 ? (100 * sv) / edv : 0, sbp, dbp, ejected, lvedp: out.lvP[ied], rvSv: Math.max(0, out.rvV[ied] - rvEs) });
  }

  // ---- summary (skip the first 0.8 s and beats whose systole runs past the end of the strip)
  const iStart = Math.min(n - 1, 800);
  let mean = 0;
  let laMean = 0;
  let raMean = 0;
  let paMax = -Infinity;
  let paMin = Infinity;
  let cnt = 0;
  for (let i = iStart; i < n; i++) {
    mean += out.aoP[i];
    laMean += out.laP[i];
    raMean += out.raP[i];
    if (out.paP[i] > paMax) paMax = out.paP[i];
    if (out.paP[i] < paMin) paMin = out.paP[i];
    cnt++;
  }
  mean /= Math.max(1, cnt);
  laMean /= Math.max(1, cnt);
  raMean /= Math.max(1, cnt);
  const shown = beats.filter((b) => b.t >= from + 800 && b.t <= tEnd - 450);
  const ej = shown.filter((b) => b.ejected);
  const spanS = Math.max(0.5, (Math.min(tEnd - 450, shown.length ? shown[shown.length - 1].t + 1 : tEnd) - (from + 800)) / 1000);
  const rrSpan = shown.length >= 2 ? (shown[shown.length - 1].t - shown[0].t) / 1000 : spanS;
  const hr = shown.length >= 2 ? ((shown.length - 1) / rrSpan) * 60 : 0;
  const pulseRate = shown.length ? (ej.length / shown.length) * hr : 0;
  const svMean = ej.length ? ej.reduce((s, b) => s + b.sv, 0) / ej.length : 0;
  const summary: HemoSummary = {
    hr: Math.round(hr),
    pulseRate: Math.round(pulseRate),
    sbp: Math.round(ej.length ? ej.reduce((s, b) => s + b.sbp, 0) / ej.length : mean),
    dbp: Math.round(ej.length ? ej.reduce((s, b) => s + b.dbp, 0) / ej.length : mean),
    map: Math.round(mean),
    sv: Math.round(svMean),
    co: Math.round((svMean * pulseRate) / 100) / 10,
    ef: Math.round(ej.length ? ej.reduce((s, b) => s + b.ef, 0) / ej.length : 0),
    lvedv: Math.round(shown.length ? shown.reduce((s, b) => s + b.edv, 0) / shown.length : out.lvV[n - 1]),
    lvedp: Math.round(shown.length ? shown.reduce((s, b) => s + b.lvedp, 0) / shown.length : out.lvP[n - 1]),
    rap: Math.round(raMean),
    pasp: Math.round(paMax),
    padp: Math.round(paMin),
    pawp: Math.round(laMean),
    pulseDeficit: Math.max(0, Math.round(hr - pulseRate)),
  };

  return { fs, from, n, ...out, phase, pcg, valveEvents, sounds, beats, summary, notes: mechanicalNotes(run, summary, sounds, beats, mechA.length > 0, cannon, atrialBeats) };
}

/** Plain-language interpretation of the mechanical picture for the current rhythm. */
function mechanicalNotes(run: EcgRun, s: HemoSummary, sounds: SoundEvent[], beats: BeatHemo[], hasAtrialContraction: boolean, cannon: number, atrialBeats: number): string[] {
  const p = run.physio;
  const out: string[] = [];
  const cont = run.sim.continuous;
  if (cont.some((c) => c.kind === 'vf' || c.kind === 'vflutter') || p.rhythm.ventMechanism === 'asystole') {
    out.push('No organised ventricular contraction: no stroke volume and no pulse — this is cardiac arrest. Pressures settle toward the mean systemic filling pressure.');
    return out;
  }
  if (cont.some((c) => c.kind === 'fib')) out.push('Atrial fibrillation: no atrial contraction, so there is no a wave in the JVP, no S4 and no atrial kick; beat-to-beat filling (and pulse volume) varies with each R–R interval.');
  else if (cont.some((c) => c.kind === 'flutter')) out.push('Atrial flutter: the atria contract weakly at the flutter rate — small, rapid "flutter waves" may be seen in the JVP.');
  else if (!hasAtrialContraction) out.push('No atrial activity: no a waves and no atrial contribution to ventricular filling.');
  if (s.pulseDeficit >= 5) out.push(`Pulse deficit ≈ ${s.pulseDeficit}/min: some QRS complexes come so early that the ventricle has not filled enough to open the aortic valve — they appear on the ECG but are not felt at the wrist.`);
  // AV dissociation / retrograde atrial activation → cannon a waves
  if (cannon > 0) out.push(`${cannon === atrialBeats ? 'Every' : `${cannon} of ${atrialBeats}`} atrial contraction${cannon === 1 ? '' : 's'} ${cannon === 1 ? 'occurs' : 'occur'} while the tricuspid valve is shut (AV dissociation, or retrograde/simultaneous atrial activation): the right atrium contracts against a closed valve and pushes blood back into the neck veins — cannon a waves in the JVP.`);
  const a2 = sounds.filter((x) => x.component === 'A2');
  const p2 = sounds.filter((x) => x.component === 'P2');
  if (a2.length && p2.length) {
    const splits: number[] = [];
    for (const a of a2) {
      const q = p2.find((x) => Math.abs(x.t - a.t) < 120);
      if (q) splits.push(q.t - a.t);
    }
    if (splits.length) {
      const m = splits.reduce((x, y) => x + y, 0) / splits.length;
      if (m < -10) out.push(`Reversed (paradoxical) splitting of S2: P2 precedes A2 by ≈ ${Math.round(-m)} ms because the left ventricle is activated — and therefore finishes ejecting — late (LBBB, RV pacing, RV-origin ectopy).`);
      else if (m > 45) out.push(`Wide splitting of S2 (A2–P2 ≈ ${Math.round(m)} ms): the right ventricle is activated late (RBBB / LV-origin ectopy) or ejects against a high pulmonary resistance.`);
    }
  }
  if (sounds.some((x) => x.kind === 'S4')) out.push('S4: atrial contraction into a stiff, non-compliant ventricle (hypertrophy, ischaemia, HCM) produces a late-diastolic sound just before S1.');
  if (sounds.some((x) => x.kind === 'S3')) out.push('S3: high atrial pressure and rapid early filling decelerating in a failing or overfilled ventricle.');
  const s1 = sounds.filter((x) => x.component === 'M1').map((x) => x.amp);
  if (s1.length >= 4) {
    const mx = Math.max(...s1);
    const mn = Math.min(...s1);
    if (mx - mn > 0.35) out.push('Variable intensity of S1: the PR interval varies (AV dissociation, Wenckebach, AF), so the mitral leaflets are at a different position each time systole starts.');
  }
  const svs = beats.filter((b) => b.ejected).map((b) => b.sv);
  if (s.sbp > 0 && s.sbp < 90) out.push(`Hypotension (≈ ${s.sbp}/${s.dbp} mmHg): too little filling time or contractility for an adequate stroke volume.`);
  if (svs.length >= 3 && Math.max(...svs) - Math.min(...svs) > 25 && !cont.some((c) => c.kind === 'fib')) out.push('Stroke volume varies beat to beat with the preceding filling time (Frank–Starling).');
  if (p.alternans > 0.2) out.push('Large pericardial effusion with raised intrapericardial pressure: all diastolic pressures rise toward the pericardial pressure and stroke volume falls (tamponade physiology).');
  return out;
}
