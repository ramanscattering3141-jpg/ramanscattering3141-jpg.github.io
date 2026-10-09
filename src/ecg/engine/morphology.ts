// Beat morphology from physiology.
//
// Every waveform is the projection of a time-varying cardiac dipole (the "heart vector")
// onto each lead axis. A beat is described as a sum of activation or repolarisation
// COMPONENTS, each a wavefront with a timing, direction and strength:
//
//   heartVector(t) = Σ amp_i · shape_i((t − t0_i)/dur_i) · dir_i
//
// Normal ventricular activation follows Durrer et al. (Circulation 1970): the septum is
// activated first from its LEFT side (left→right, anterior), then the apex and free walls,
// with the thick LV free wall dominating (leftward, inferior, posterior), and the
// postero-basal regions last. Conduction abnormalities re-order, delay or re-direct these
// components; that is WHY each abnormality has its characteristic QRS.

import type { ApLocation, AtrialSite, Bundle, Physio, Territory, VentSite } from './params';
import type { VentEvent } from './rhythm';
import type { LeadId } from './leads';
import { add, blend, clamp, len, norm, rotFrontal, rotHorizontal, scale, smoothstep, sub, vec, type Vec3, ZERO } from './vec';
import { atrialAmpFactor, atrialWidthFactor, hyperKT, hypoK, qtAtRR, qtcEffective, ventricularWidthFactor, voltageFactor } from './derived';
import { mulberry32 } from './random';

export type Shape = 'bump' | 'tskew' | 'plateau' | 'spike' | 'sag' | 'decay' | 'ramp';

export interface Comp {
  t0: number;
  dur: number;
  dir: Vec3;
  amp: number;
  shape: Shape;
  tag: string;
}

/** Non-dipolar, lead-specific potential (used for effects of structures very close to one electrode, e.g. RVOT epicardium in Brugada). */
export interface LocalTerm {
  weights: Partial<Record<LeadId, number>>;
  t0: number;
  dur: number;
  kind: 'brugada1' | 'brugada2' | 'epsilon';
  amp: number;
}

export interface BeatMorph {
  comps: Comp[];
  local: LocalTerm[];
  qrsDur: number;
  qt: number;
  tStart: number;
  tEnd: number;
  /** Mean QRS area vector (for axis). */
  qrsArea: Vec3;
  notes: string[];
}

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export function shapeAt(s: Shape, u: number): number {
  if (u <= 0 || u >= 1) return 0;
  switch (s) {
    case 'bump': {
      const x = Math.sin(Math.PI * u);
      return x * x;
    }
    case 'tskew': {
      const x = Math.sin(Math.PI * Math.pow(u, 1.45));
      return x * x;
    }
    case 'plateau':
      return smoothstep(0, 0.1, u) * (1 - smoothstep(0.55, 1, u));
    case 'spike':
      return u < 0.5 ? u * 2 : (1 - u) * 2;
    case 'sag':
      // Digoxin "reverse tick": gradual sagging depression that recovers into the T wave.
      return Math.sin(Math.PI * Math.pow(u, 0.75));
    case 'ramp':
      // Pre-excitation delta wave: slow, slurred rise until the His–Purkinje impulse arrives, then fades.
      return u < 0.7 ? Math.pow(u / 0.7, 1.3) : Math.pow(1 - (u - 0.7) / 0.3, 2);
    case 'decay':
      // Maximal at the J point, then returning steadily toward baseline (upsloping ST segment).
      return u < 0.1 ? smoothstep(0, 0.1, u) : Math.pow(1 - (u - 0.1) / 0.9, 1.3);
    default:
      return 0;
  }
}

/** ∫shape du for area calculations. */
const SHAPE_AREA: Record<Shape, number> = { bump: 0.5, tskew: 0.5, plateau: 0.7, spike: 0.5, sag: 0.62, decay: 0.44, ramp: 0.4 };

export function areaVector(comps: Comp[]): Vec3 {
  let a: Vec3 = ZERO;
  for (const c of comps) a = add(a, scale(c.dir, c.amp * c.dur * SHAPE_AREA[c.shape]));
  return a;
}

// ---------------------------------------------------------------------------
// Anatomical directions (x left, y inferior, z anterior)
// ---------------------------------------------------------------------------

const D = {
  septal: norm(vec(-0.55, 0.3, 0.78)),
  apical: norm(vec(0.3, 0.82, 0.42)),
  lvFree: norm(vec(0.8, 0.42, -0.45)),
  basal: norm(vec(-0.3, -0.62, -0.7)),
  rvFree: norm(vec(-0.72, 0.3, 0.62)),
  rvLate: norm(vec(-0.62, 0.12, 0.78)), // unopposed late RV activation in RBBB
  tNormal: norm(vec(0.55, 0.68, 0.35)),
  cavity: norm(vec(-0.75, -0.55, 0.25)), // toward aVR / ventricular cavity
  lv: norm(vec(0.75, 0.35, -0.55)),
  // Hypertrophied basal septum: its (normally small) left→right initial force becomes large and
  // points rightward, superior and anterior — away from the lateral and inferior leads.
  hcmSeptal: norm(vec(-0.62, -0.42, 0.66)),
  // Takotsubo: apical/mid-ventricular ballooning; repolarisation abnormality centred on the apex.
  apex: norm(vec(0.35, 0.55, 0.75)),
};

/** Epicardial surface normal for each ischaemic territory (injury current points toward injured epicardium). */
export const TERRITORY: Record<Territory, { dirs: [Vec3, number][]; label: string; artery: string; leads: string }> = {
  anteroseptal: { dirs: [[norm(vec(-0.35, 0.1, 0.93)), 1]], label: 'Anteroseptal', artery: 'LAD (septal branches)', leads: 'V1–V3' },
  anterior: { dirs: [[norm(vec(0.15, 0.2, 0.97)), 1]], label: 'Anterior', artery: 'mid LAD', leads: 'V2–V4' },
  anterolateral: { dirs: [[norm(vec(0.75, 0.05, 0.65)), 1]], label: 'Anterolateral', artery: 'LAD / diagonal', leads: 'V3–V6, I, aVL' },
  highLateral: { dirs: [[norm(vec(0.8, -0.55, -0.15)), 1]], label: 'High lateral', artery: 'first diagonal or obtuse marginal', leads: 'I, aVL (± V5–V6)' },
  lateral: { dirs: [[norm(vec(0.95, 0.05, -0.2)), 1]], label: 'Lateral', artery: 'LCx', leads: 'I, aVL, V5–V6' },
  inferior: { dirs: [[norm(vec(0.1, 0.98, -0.12)), 1]], label: 'Inferior', artery: 'RCA (≈80%) or LCx', leads: 'II, III, aVF' },
  posterior: { dirs: [[norm(vec(0.15, 0.2, -0.96)), 1]], label: 'Posterior (inferobasal)', artery: 'LCx or RCA (PDA/posterolateral)', leads: 'reciprocal ST depression V1–V3; ST elevation V7–V9' },
  rv: { dirs: [[norm(vec(-0.85, 0.35, 0.4)), 1]], label: 'Right ventricle', artery: 'proximal RCA', leads: 'V1, V4R (with inferior STE, III > II)' },
  proxLAD: { dirs: [[norm(vec(-0.35, 0.1, 0.93)), 0.8], [norm(vec(0.15, 0.2, 0.97)), 1], [norm(vec(0.8, -0.55, 0.2)), 2]], label: 'Proximal LAD (anterior + septal + high lateral)', artery: 'proximal LAD', leads: 'V1–V4, I, aVL; reciprocal inferior STD' },
  wrapLAD: { dirs: [[norm(vec(0.15, 0.2, 0.97)), 1], [norm(vec(0.3, 0.9, 0.3)), 0.7]], label: '"Wraparound" LAD (anterior + inferoapical)', artery: 'LAD wrapping the apex', leads: 'V2–V5 and II, III, aVF' },
  proxRCA: { dirs: [[norm(vec(0.1, 0.98, -0.12)), 1], [norm(vec(-0.85, 0.35, 0.4)), 1.0], [norm(vec(0.15, 0.2, -0.96)), 0.15]], label: 'Proximal RCA (inferior + RV ± posterior)', artery: 'proximal RCA', leads: 'II, III, aVF, V1, V4R' },
  lcx: { dirs: [[norm(vec(0.95, 0.05, -0.2)), 0.8], [norm(vec(0.15, 0.2, -0.96)), 1]], label: 'LCx (lateral + posterior)', artery: 'circumflex', leads: 'I, aVL, V5–V6; STD V1–V3' },
  diffuseSubendo: { dirs: [[D.cavity, 1]], label: 'Diffuse subendocardial ischaemia', artery: 'left main / multivessel / supply–demand', leads: 'STE aVR (± V1), diffuse STD' },
};

export function territoryVector(t: Territory): Vec3 {
  let v: Vec3 = ZERO;
  for (const [d, w] of TERRITORY[t].dirs) v = add(v, scale(d, w));
  return norm(v);
}

/** Position of an ectopic ventricular origin (unit-ish vector from the heart's centre). */
export const VENT_SITE: Record<VentSite, { pos: Vec3; width: number; label: string; rv: boolean }> = {
  rvApex: { pos: vec(-0.1, 0.72, 0.55), width: 1, label: 'RV apex', rv: true },
  rvot: { pos: vec(-0.35, -0.72, 0.55), width: 0.95, label: 'RV outflow tract', rv: true },
  lvot: { pos: vec(0.05, -0.75, -0.3), width: 0.9, label: 'LV outflow tract / aortic cusps', rv: false },
  lvApex: { pos: vec(0.45, 0.75, 0.2), width: 1, label: 'LV apex', rv: false },
  lvLateral: { pos: vec(0.95, 0.1, -0.2), width: 1.05, label: 'LV lateral wall', rv: false },
  lvInferobasal: { pos: vec(0.35, 0.6, -0.7), width: 1.1, label: 'LV inferobasal (typical post-inferior-MI scar)', rv: false },
  septal: { pos: vec(-0.2, -0.3, 0.4), width: 0.75, label: 'high septum', rv: true },
  fascicularPosterior: { pos: vec(0.2, 0.7, -0.3), width: 0.75, label: 'left posterior fascicle', rv: false },
  fascicularAnterior: { pos: vec(0.4, -0.6, 0.2), width: 0.75, label: 'left anterior fascicle', rv: false },
};

/** Ventricular insertion of accessory pathways. */
export const AP_SITE: Record<ApLocation, { pos: Vec3; label: string }> = {
  leftLateral: { pos: vec(0.9, 0.05, -0.35), label: 'left lateral (mitral annulus)' },
  leftPosterior: { pos: vec(0.55, 0.35, -0.75), label: 'left posterior / posterolateral' },
  posteroseptal: { pos: vec(-0.35, 0.8, -0.2), label: 'posteroseptal' },
  rightFreeWall: { pos: vec(-0.9, 0.2, 0.3), label: 'right free wall (tricuspid annulus)' },
  anteroseptal: { pos: vec(-0.4, -0.6, 0.6), label: 'anteroseptal' },
  midseptal: { pos: vec(-0.4, 0.3, 0.3), label: 'midseptal' },
};

// ---------------------------------------------------------------------------
// Atrial activation (P wave)
// ---------------------------------------------------------------------------

export const P_SITE: Record<AtrialSite, { ra: Vec3; la: Vec3; order: 'RA' | 'LA' | 'both'; label: string }> = {
  // Normal LA vector: leftward, slightly inferior and posterior → small terminal negativity in V1
  // (< 1 mm × 40 ms, i.e. P-terminal force below the 0.04 mm·s LAE threshold).
  sinus: { ra: norm(vec(0.25, 0.85, 0.45)), la: norm(vec(0.8, 0.35, -0.18)), order: 'RA', label: 'sinus node (high right atrium)' },
  highRA: { ra: norm(vec(0.25, 0.85, 0.45)), la: norm(vec(0.8, 0.35, -0.18)), order: 'RA', label: 'high right atrium' },
  crista: { ra: norm(vec(0.1, 0.9, 0.4)), la: norm(vec(0.75, 0.4, -0.5)), order: 'RA', label: 'crista terminalis' },
  lowRA: { ra: norm(vec(0.3, -0.85, 0.35)), la: norm(vec(0.75, -0.45, -0.45)), order: 'RA', label: 'low right atrium (near coronary sinus)' },
  leftAtrial: { ra: norm(vec(-0.6, 0.45, 0.5)), la: norm(vec(-0.75, 0.4, 0.45)), order: 'LA', label: 'left atrium' },
  lowLA: { ra: norm(vec(-0.55, -0.6, 0.4)), la: norm(vec(-0.6, -0.6, 0.45)), order: 'LA', label: 'low left atrium' },
  retroSeptal: { ra: norm(vec(0.0, -0.9, 0.38)), la: norm(vec(0.15, -0.9, 0.3)), order: 'both', label: 'retrograde from AV node (septal)' },
  retroPosteroseptal: { ra: norm(vec(0.1, -0.92, 0.25)), la: norm(vec(0.2, -0.9, 0.2)), order: 'both', label: 'retrograde via posteroseptal pathway' },
  retroLeftLateral: { ra: norm(vec(-0.75, -0.45, 0.35)), la: norm(vec(-0.8, -0.35, 0.35)), order: 'LA', label: 'retrograde via left lateral pathway (eccentric)' },
  retroRightFree: { ra: norm(vec(0.8, -0.35, -0.3)), la: norm(vec(0.8, -0.3, -0.4)), order: 'RA', label: 'retrograde via right free-wall pathway' },
};

export interface PMorph {
  comps: Comp[];
  pDur: number;
}

export function buildP(p: Physio, site: AtrialSite): PMorph {
  const w = atrialWidthFactor(p);
  const ampK = atrialAmpFactor(p) * voltageFactor(p) * (1 + 0.15 * Math.max(0, p.autonomic));
  const s = P_SITE[site];
  const ra = Math.pow(p.raSize, 1.3);
  const la = p.laSize;
  const rot = (d: Vec3): Vec3 => rotHorizontal(rotFrontal(d, p.anatomicalAxis * 0.6), p.horizontalRotation * 0.5);
  const comps: Comp[] = [];
  let pDur: number;
  if (s.order === 'RA') {
    const raDur = 55 * w * (0.85 + 0.15 * p.raSize);
    const laOn = (32 + p.interatrialDelay) * w;
    const laDur = 52 * w * (0.8 + 0.35 * la);
    comps.push({ t0: 0, dur: raDur, dir: rot(s.ra), amp: 0.14 * ra * ampK, shape: 'bump', tag: 'RA' });
    comps.push({ t0: laOn, dur: laDur, dir: rot(s.la), amp: 0.085 * la * ampK, shape: 'bump', tag: 'LA' });
    pDur = Math.max(raDur, laOn + laDur);
  } else if (s.order === 'LA') {
    const laDur = 55 * w * (0.8 + 0.3 * la);
    comps.push({ t0: 0, dur: laDur, dir: rot(s.la), amp: 0.09 * la * ampK, shape: 'bump', tag: 'LA' });
    comps.push({ t0: 30 * w, dur: 55 * w, dir: rot(s.ra), amp: 0.07 * ra * ampK, shape: 'bump', tag: 'RA' });
    pDur = Math.max(laDur, 85 * w);
  } else {
    // Retrograde septal activation: both atria depolarise simultaneously from the septum → short P.
    const dur = 70 * w;
    comps.push({ t0: 0, dur, dir: rot(norm(add(s.ra, s.la))), amp: 0.14 * ampK, shape: 'bump', tag: 'retro' });
    pDur = dur;
  }
  // Pericarditis: atrial epicardial injury current depresses the PR segment (elevates it in aVR).
  if (p.pericarditis >= 1 && p.pericarditis < 2.5) {
    const k = p.pericarditis < 2 ? 1 : 0.4;
    comps.push({ t0: pDur * 0.8, dur: 150, dir: norm(vec(-0.45, -0.85, -0.1)), amp: 0.045 * k, shape: 'plateau', tag: 'PR depression' });
  }
  // Atrial repolarisation (Ta) — small wave opposite to P, mostly hidden in PR/QRS.
  comps.push({ t0: pDur, dur: 220, dir: scale(norm(add(s.ra, s.la)), -1), amp: 0.012 * ampK * ra, shape: 'bump', tag: 'Ta' });
  return { comps, pDur };
}

// ---------------------------------------------------------------------------
// Ventricular activation (QRS)
// ---------------------------------------------------------------------------

function c(t0: number, dur: number, dir: Vec3, amp: number, tag: string, shape: Shape = 'bump'): Comp {
  return { t0, dur, dir, amp, shape, tag };
}

/** Normal-sequence activation for the given ventricular masses. */
function normalPattern(p: Physio, w: number): Comp[] {
  const lv = p.lvMass;
  const rv = p.rvMass;
  const lvDur = 46 * (1 + 0.12 * Math.max(0, lv - 1));
  const rvH = clamp((rv - 1) / 2, 0, 1);
  return [
    c(0, 26 * w, D.septal, 0.24, 'septum (left→right)'),
    ...(p.hcm > 0 ? [c(0, 30 * w, D.hcmSeptal, 0.95 * p.hcm, 'hypertrophied septum (exaggerated initial forces → deep narrow Q)')] : []),
    c(10 * w, 34 * w, D.apical, 0.7 * Math.sqrt(lv), 'apex / anteroseptal'),
    // A hypertrophied RV wall takes longer to activate: its (rightward-anterior) force peaks after
    // the initial septal/apical forces, giving rS in I/V6 (not Q waves) and a tall, late R in V1.
    c((16 + 10 * rvH) * w, (34 + 16 * rvH) * w, D.rvFree, 0.26 * Math.pow(rv, 1.7), 'RV free wall'),
    c(22 * w, lvDur * w, D.lvFree, 1.25 * lv, 'LV free wall'),
    c((50 + 8 * Math.max(0, lv - 1)) * w, 36 * w, D.basal, 0.4 * Math.sqrt(lv), 'posterobasal LV'),
    ...(rv > 1.6 ? [c(46 * w, 40 * w, D.rvLate, 0.22 * Math.pow(rv - 1, 1.3), 'hypertrophied RV (late anterior-rightward)')] : []),
  ];
}

function rbbbComps(w: number, rvLateOn: number, incomplete: boolean): Comp[] {
  return incomplete
    ? [c(rvLateOn * w, 62 * w, D.rvLate, 0.4, 'delayed RV activation (incomplete RBBB)')]
    : [c(rvLateOn * w, 76 * w, D.rvLate, 0.72, 'late, slow RV activation via myocardium (RBBB)')];
}

export function patternQRS(p: Physio, bundle: Bundle, w: number): Comp[] {
  const lv = p.lvMass;
  const N = normalPattern(p, w);
  switch (bundle) {
    case 'normal':
      return N;
    case 'ivcd':
      return normalPattern(p, w * 1.45).map((x) => ({ ...x, amp: x.amp * 0.85 }));
    case 'rbbb':
    case 'incompleteRbbb': {
      // Left side and septum (from the intact left bundle) activate normally; the RV is activated
      // late, slowly, cell-to-cell → unopposed terminal rightward/anterior forces.
      const inc = bundle === 'incompleteRbbb';
      return [...N.filter((x) => x.tag !== 'RV free wall').map((x) => (x.tag === 'posterobasal LV' ? { ...x, amp: x.amp * 0.6 } : x)), ...rbbbComps(w, inc ? 56 : 62, inc)];
    }
    case 'lbbb':
      // Septum activated from the RIGHT side (right→left): lost septal q in I/V6; the LV is
      // activated slowly through working myocardium → broad, notched, leftward-posterior forces.
      return [
        // Overlapping slow wavefronts → one broad R with a mid-QRS notch/slur (not separate spikes).
        c(0, 50 * w, norm(vec(0.7, 0.15, -0.45)), 0.45, 'septum (right→left)'),
        c(6 * w, 30 * w, D.rvFree, 0.22, 'RV free wall'),
        c(16 * w, 74 * w, norm(vec(0.55, 0.3, -0.72)), 1.0 * lv, 'LV septal→anterior wall (slow)'),
        c(56 * w, 86 * w, norm(vec(0.88, 0.02, -0.42)), 1.1 * lv, 'LV lateral wall (last, slow)'),
      ];
    case 'lafb':
    case 'rbbb+lafb': {
      // Initial activation via the posterior fascicle (inferior/rightward), then the
      // anterosuperior LV activated late → superior-leftward forces (left axis deviation).
      const L = [
        c(0, 26 * w, norm(vec(-0.25, 0.9, 0.35)), 0.5, 'initial inferior (via LPF)'),
        c(14 * w, 32 * w, D.rvFree, 0.24, 'RV free wall'),
        c(24 * w, 58 * w, norm(vec(0.62, -0.72, -0.3)), 1.3 * lv, 'anterosuperior LV (late)'),
        c(62 * w, 30 * w, D.basal, 0.25, 'posterobasal LV'),
      ];
      return bundle === 'lafb' ? L : [...L.filter((x) => x.tag !== 'RV free wall'), ...rbbbComps(w, 66, false)];
    }
    case 'lpfb':
    case 'rbbb+lpfb': {
      const L = [
        c(0, 26 * w, norm(vec(0.6, -0.72, 0.3)), 0.42, 'initial superior-leftward (via LAF)'),
        c(14 * w, 32 * w, D.rvFree, 0.24, 'RV free wall'),
        c(24 * w, 58 * w, norm(vec(-0.25, 0.95, -0.25)), 1.3 * lv, 'inferoposterior LV (late)'),
        c(62 * w, 30 * w, D.basal, 0.2, 'posterobasal LV'),
      ];
      return bundle === 'lpfb' ? L : [...L.filter((x) => x.tag !== 'RV free wall'), ...rbbbComps(w, 66, false)];
    }
    default:
      return N;
  }
}

/** Activation spreading cell-to-cell from an ectopic origin (PVC, VT, pacing, full pre-excitation). */
export function focusQRS(pos: Vec3, w: number, rvSite: boolean, lvMass = 1): Comp[] {
  const away = norm(scale(pos, -1));
  const main = rvSite ? blend(away, D.lv, 0.3) : away;
  const terminal = norm(rotFrontal(main, 50));
  return [
    c(0, 60 * w, away, 0.5, 'slow initial spread from origin (no Purkinje)'),
    c(30 * w, 88 * w, main, 1.5 * Math.sqrt(lvMass), 'bulk ventricular activation'),
    c(96 * w, 56 * w, terminal, 0.45, 'last regions activated'),
  ];
}

// ---------------------------------------------------------------------------
// Ventricular beat (QRS + ST + T + U)
// ---------------------------------------------------------------------------

export interface BeatContext {
  rr: number; // preceding RR (ms)
  index: number; // beat number (for alternans / polymorphic variation)
  seed: number;
}

function globalTransform(p: Physio, d: Vec3, frac = 1): Vec3 {
  const massShift = -10 * Math.max(0, p.lvMass - 1) + 0 * Math.max(0, p.rvMass - 1) + 22 * p.rvStrain;
  return rotHorizontal(rotFrontal(d, (p.anatomicalAxis + p.axisShift + massShift) * frac), p.horizontalRotation * frac);
}

function transformAll(p: Physio, comps: Comp[], frac = 1): Comp[] {
  return comps.map((x) => ({ ...x, dir: globalTransform(p, x.dir, frac) }));
}

function qrsEnd(comps: Comp[]): number {
  let e = 0;
  for (const x of comps) e = Math.max(e, x.t0 + x.dur * 0.93);
  return e;
}

export function buildVentBeat(p: Physio, ev: VentEvent, ctx: BeatContext): BeatMorph {
  const w = ventricularWidthFactor(p);
  const vf = voltageFactor(p);
  const notes: string[] = [];
  let bundle: Bundle = p.bundle;
  if (ev.route === 'his' && ev.aberrant === 'rbbb') bundle = bundle === 'lafb' ? 'rbbb+lafb' : bundle === 'lpfb' ? 'rbbb+lpfb' : bundle.startsWith('rbbb') || bundle === 'lbbb' ? bundle : 'rbbb';

  // Reference: normal activation for this heart (same masses) — used to separate PRIMARY
  // from SECONDARY repolarisation changes.
  const ref = transformAll(p, normalPattern(p, w));
  let act: Comp[];
  let activationNormal = false;

  if (ev.route === 'his') {
    act = transformAll(p, patternQRS(p, bundle, w));
    activationNormal = bundle === 'normal';
  } else if (ev.route === 'ap') {
    const loc = ev.apLocation ?? p.rhythm.ap.location;
    const full = transformAll(p, focusQRS(AP_SITE[loc].pos, w, false, p.lvMass), 0.5);
    const hd = ev.hisDelay;
    if (!Number.isFinite(hd) || hd >= 170) act = full;
    else {
      // Fusion: the pathway pre-excites the ventricle near its insertion (slurred delta wave)
      // until the His–Purkinje impulse arrives and rapidly activates the rest.
      const f = clamp(hd / 170, 0, 1);
      const delta = { ...full[0], dur: (hd + 14) / 0.7, amp: 0.38 + 0.4 * f, shape: 'ramp' as Shape, tag: 'delta wave (pre-excited myocardium)' };
      // The pre-excited wavefront has already crossed the septum: no normal septal q in the remainder.
      const rest = transformAll(p, patternQRS(p, bundle, w * (0.78 - 0.15 * f)))
        .filter((x) => x.tag !== 'septum (left→right)')
        .map((x) => ({ ...x, t0: x.t0 + hd, amp: x.amp * (1 - 0.6 * f) }));
      act = [delta, ...(f > 0.5 ? [{ ...full[1], amp: full[1].amp * (f - 0.5) }] : []), ...rest];
    }
  } else {
    const site = ev.site ?? 'rvApex';
    const S = VENT_SITE[site];
    let raw: Comp[];
    // Fascicular origin: the impulse exits from one fascicle (no initial activation via the other),
    // then spreads partly through Purkinje fibres → RBBB-like, relatively narrow (~120–130 ms) QRS.
    if (site === 'fascicularPosterior') raw = patternQRS(p, 'rbbb+lafb', w * 1.1).filter((x) => x.tag !== 'initial inferior (via LPF)');
    else if (site === 'fascicularAnterior') raw = patternQRS(p, 'rbbb+lpfb', w * 1.1).filter((x) => x.tag !== 'initial superior-leftward (via LAF)');
    else raw = focusQRS(S.pos, w * S.width, S.rv, p.lvMass);
    // The QRS starts when the first wavefront leaves the focus (ev.t = QRS onset).
    const first = Math.min(...raw.map((x) => x.t0));
    if (first > 0) raw = raw.map((x) => ({ ...x, t0: x.t0 - first }));
    let comps = transformAll(p, raw, 0.4);
    if (ev.mechanism === 'torsades de pointes' || ev.mechanism === 'polymorphic VT') {
      // Continuously changing activation sequence: the mean vector rotates and waxes/wanes.
      const r = mulberry32(ctx.seed + ev.polyIndex * 101);
      const ang = ev.mechanism === 'torsades de pointes' ? ev.polyIndex * 34 : (r() - 0.5) * 300;
      const env = ev.mechanism === 'torsades de pointes' ? 0.35 + 0.65 * Math.abs(Math.cos((ev.polyIndex * Math.PI) / 9)) : 0.5 + 0.6 * r();
      comps = comps.map((x) => ({ ...x, dir: rotFrontal(rotHorizontal(x.dir, ang * 0.4), ang), amp: x.amp * env }));
    }
    const hd = ev.hisDelay;
    if (Number.isFinite(hd) && hd < 70) {
      const f = hd / 70; // later His arrival → more of the ventricle from the ectopic focus
      const rest = transformAll(p, patternQRS(p, bundle, w)).map((x) => ({ ...x, t0: x.t0 + hd, amp: x.amp * (1 - 0.7 * f) }));
      comps = [...comps.map((x) => ({ ...x, amp: x.amp * (0.35 + 0.65 * f) })), ...rest];
      notes.push('fusion');
    }
    act = comps;
  }

  // Scar: myocardium that no longer depolarises removes forces that pointed toward it, so the
  // net initial vector points AWAY from the infarct → Q waves in overlying leads.
  const isch = p.ischemia;
  const qStages = isch.stage === 'evolving' || isch.stage === 'old' || isch.stage === 'stemi' || isch.stage === 'aneurysm';
  if (qStages && isch.territory !== 'diffuseSubendo') {
    const n = territoryVector(isch.territory);
    const qAmp = (isch.stage === 'stemi' ? 0.25 : isch.stage === 'evolving' ? 0.5 : isch.stage === 'aneurysm' ? 0.7 : 0.85) * isch.extent;
    act = act.map((x) => {
      const d = Math.max(0, x.dir[0] * n[0] + x.dir[1] * n[1] + x.dir[2] * n[2]);
      return { ...x, amp: x.amp * (1 - 0.55 * isch.extent * d * (isch.stage === 'stemi' ? 0.5 : 1)) };
    });
    // Established Q waves (evolving/old/aneurysm) are pathological: ≥ 30–40 ms wide.
    act.push(c(0, (isch.stage === 'stemi' ? 38 : 50) * w, scale(n, -1), qAmp, 'loss of forces from infarcted wall (Q wave)'));
  }

  // RV pressure load (acute PE): rightward terminal forces (S in I), small q in III.
  if (p.rvStrain > 0) {
    act.push(c(8, 26 * w, norm(vec(-0.55, -0.85, 0.1)), 0.18 * p.rvStrain, 'altered initial forces (q in III)'));
    act.push(c(64 * w, 34 * w, norm(vec(-0.8, 0.25, 0.55)), 0.35 * p.rvStrain, 'delayed RV activation (S in I, R′ in V1)'));
  }
  // ARVC: fibrofatty replacement slows RV free-wall/outflow activation → terminal activation
  // delay in V1–V3 (the epsilon wave itself is a local term added below).
  if (p.arvc > 0 && ev.route === 'his') act.push(c(60 * w, 52 * w, D.rvLate, 0.2 * p.arvc, 'delayed RV free-wall activation (terminal activation delay)'));
  // Sodium-channel blockade (TCA): disproportionate slowing of terminal rightward forces → R in aVR.
  if (p.drugs.naBlocker > 0.2) act.push(c(qrsEnd(act) - 34 * w, 42 * w, norm(vec(-0.75, -0.55, 0.2)), 0.42 * p.drugs.naBlocker, 'slowed terminal rightward activation (R in aVR)'));

  // Voltage (habitus, effusion) and electrical alternans.
  const alt = p.alternans > 0 ? 1 + (ctx.index % 2 === 0 ? 0.3 : -0.3) * p.alternans : 1;
  act = act.map((x) => ({ ...x, amp: x.amp * vf * alt }));
  const qrsDur = qrsEnd(act);
  const area = areaVector(act);
  const refArea = areaVector(ref.map((x) => ({ ...x, amp: x.amp * vf })));

  // ------------------- Repolarisation -------------------
  const qtc = qtcEffective(p);
  // Takotsubo (subacute phase): repolarisation of the stunned apex is markedly prolonged.
  const tako = isch.stage === 'takotsubo' ? isch.extent : 0;
  let qt = qtAtRR(qtc, ctx.rr) + Math.max(0, qrsDur - 95) * 0.9 + 75 * tako;
  const hk = hyperKT(p.K);
  const lk = hypoK(p.K);
  let tDur = 175 * (1 + 0.3 * p.drugs.qtDrug + 0.25 * p.hypothermia + 0.3 * tako) * (1 - 0.28 * hk) * clamp(Math.pow(ctx.rr / 1000, 0.3), 0.75, 1.15);
  let tStart = qt - tDur;
  // Severe hyperkalaemia: the ST segment vanishes and a broad T wave starts at the end of the very
  // wide QRS, so QRS and T merge (→ sine-wave pattern at the extreme).
  const sine = smoothstep(7.6, 8.8, p.K);
  if (sine > 0) {
    // Repolarisation still ends on time; it just starts (and merges with the QRS) earlier.
    const tEnd0 = tStart + tDur;
    tStart = Math.min(tStart, qrsDur + 40 * (1 - sine) - 8 * sine);
    tDur = tEnd0 - tStart;
  }
  const minST = qrsDur + 12 * (1 - sine) - 8 * sine;
  if (tStart < minST) {
    tStart = minST;
    tDur = Math.max(90, qt - tStart);
  }
  qt = tStart + tDur;

  const comps: Comp[] = [...act];
  const local: LocalTerm[] = [];
  const Tn = scale(globalTransform(p, D.tNormal, 0.7), 0.3 * vf);
  const refMag = Math.max(1e-6, len(refArea));
  // Secondary repolarisation: when activation is abnormal, repolarisation follows the altered
  // sequence and the T wave points OPPOSITE to the abnormal part of the QRS (discordance).
  // Minor re-routing that barely prolongs activation (fascicular block) changes the T wave little;
  // bundle-branch block, ectopy and pre-excitation (QRS ≥ ~120 ms) produce full discordance.
  const deltaArea = sub(area, refArea);
  const secK = clamp((qrsDur - 85) / 35, 0.25, 1);
  const secT = scale(deltaArea, (-0.95 * 0.3 * vf * secK) / refMag);
  const secST = scale(deltaArea, (-0.12 * 0.3 * vf) / refMag);
  // With grossly abnormal activation (BBB, ectopy, pacing, pre-excitation) repolarisation follows the
  // altered activation sequence, so the T wave is dominated by the secondary (discordant) vector.
  let T: Vec3 = activationNormal ? Tn : add(scale(Tn, 1 - 0.5 * secK), secT);
  let ST: Vec3 = activationNormal ? ZERO : secST;
  let tShape: Shape = 'tskew';
  let stShape: Shape = 'plateau';

  // Hypertrophy "strain": subendocardial ischaemia/altered repolarisation of thick walls.
  if (p.lvMass > 1.45) {
    const k = Math.min(1, (p.lvMass - 1.45) / 0.5);
    const lvD = globalTransform(p, D.lv);
    T = add(T, scale(lvD, -0.6 * k * vf));
    ST = add(ST, scale(lvD, -0.1 * k * vf));
    notes.push('LV strain');
  }
  if (p.rvMass > 1.9 || p.rvStrain > 0.3) {
    const k = Math.min(1, Math.max((p.rvMass - 1.9) / 1.2, p.rvStrain));
    // RV "strain": T inversion in the right precordial leads (V1–V3/V4) and the inferior leads (III, aVF).
    T = add(T, scale(norm(vec(-0.25, 0.45, 0.85)), -0.5 * k * vf));
  }
  // ARVC: abnormal RV repolarisation → T inversion in the right precordial leads (V1–V3 ±V4).
  if (p.arvc > 0) T = add(T, scale(norm(vec(-0.45, 0.1, 0.9)), -0.38 * p.arvc * vf));

  // Ischaemia / injury (primary ST–T changes): injury current directed toward the injured
  // (epicardial) surface elevates ST in leads facing it and depresses it in opposite leads.
  if (isch.stage !== 'none') {
    const e = isch.extent;
    const n = territoryVector(isch.territory);
    switch (isch.stage) {
      case 'hyperacute':
        T = add(T, scale(n, 0.5 * e));
        ST = add(ST, scale(n, 0.05 * e));
        tDur *= 1.1;
        tShape = 'bump';
        break;
      case 'stemi':
        ST = add(ST, scale(n, 0.24 * e));
        // Isolated posterior injury is seen only "in the mirror" by V1–V3: horizontal ST depression
        // while their (normally anterior) T waves stay upright.
        T = add(T, scale(n, (isch.territory === 'posterior' ? 0.04 : 0.28) * e));
        break;
      case 'evolving':
        ST = add(ST, scale(n, 0.1 * e));
        T = add(T, scale(n, -0.42 * e));
        tShape = 'bump';
        break;
      case 'old':
        T = add(T, scale(n, -0.12 * e));
        break;
      case 'subendocardial':
        ST = add(ST, scale(D.cavity, 0.13 * e));
        T = add(T, scale(isch.territory === 'diffuseSubendo' ? D.tNormal : n, -0.14 * e));
        break;
      case 'wellens': {
        const a = territoryVector('anterior');
        T = add(scale(T, 0.4), scale(a, -0.55 * e));
        ST = add(ST, scale(a, 0.02));
        tShape = 'bump';
        break;
      }
      case 'deWinter':
        // Proximal LAD occlusion without the usual transmural ST vector: J-point depression
        // toward the precordium that slopes up into tall, symmetric (hyperacute) T waves, with
        // a small ST vector toward the cavity (STE in aVR).
        ST = add(ST, add(scale(n, -0.15 * e), scale(D.cavity, 0.08 * e)));
        T = add(T, scale(n, 0.62 * e));
        tShape = 'bump';
        stShape = 'decay';
        break;
      case 'aneurysm':
        // Persistent STE over a dyskinetic scar weeks after MI, with established Q waves and
        // relatively small T waves (T/QRS amplitude ratio low).
        ST = add(ST, scale(n, 0.14 * e));
        T = scale(T, 0.25);
        break;
      case 'takotsubo':
        // Subacute phase: deep, widespread, symmetric T inversion (apex-centred, sparing aVR
        // which inverts the vector) with QT prolongation; no reciprocal ST depression.
        T = add(scale(T, 0.25), scale(D.apex, -0.6 * e));
        tShape = 'bump';
        break;
      default:
        break;
    }
  }

  // Pericarditis: diffuse epicardial inflammation → ST vector toward the apex/left (diffuse STE,
  // reciprocal only in aVR ± V1); later stages flatten and invert T.
  if (p.pericarditis > 0) {
    // Diffuse epicardial injury: ST vector ≈ +45–50° frontal, anterior → STE in I, II, aVL, aVF, V2–V6; STD only in aVR (± V1).
    const pv = norm(vec(0.55, 0.6, 0.45));
    if (p.pericarditis < 2) ST = add(ST, scale(pv, 0.17 * vf));
    else if (p.pericarditis < 3) T = scale(T, 0.35);
    else if (p.pericarditis < 4) T = add(scale(T, 0.2), scale(pv, -0.18));
  }
  if (p.myocarditis > 0) {
    ST = add(ST, scale(norm(vec(0.4, 0.7, 0.5)), 0.06 * p.myocarditis));
    T = add(T, scale(D.tNormal, -0.28 * p.myocarditis));
  }

  // Electrolytes.
  if (hk > 0) {
    T = scale(T, 1 + 1.6 * hk);
    tShape = 'bump';
  }
  if (lk > 0) {
    T = scale(T, 1 - 0.8 * lk);
    ST = add(ST, scale(norm(Tn), -0.07 * lk));
  }
  if (p.drugs.digoxin > 0) {
    const d = Math.min(1.3, p.drugs.digoxin);
    const qrsDir = norm(area);
    ST = add(ST, scale(qrsDir, -0.11 * d * vf));
    T = scale(T, 1 - 0.35 * d);
  }
  if (p.drugs.qtDrug > 0) T = scale(T, 1 - 0.25 * p.drugs.qtDrug);
  if (p.earlyRepol > 0) {
    const erDir = globalTransform(p, norm(vec(0.55, 0.7, 0.4)));
    comps.push(c(qrsDur - 12, 30, erDir, 0.1 * p.earlyRepol * vf, 'J-point notch/slur (early repolarisation)'));
    ST = add(ST, scale(erDir, 0.07 * p.earlyRepol * vf));
    T = scale(T, 1 + 0.25 * p.earlyRepol);
  }
  if (p.hypothermia > 0) {
    comps.push(c(qrsDur - 18, 60, norm(area), 0.45 * p.hypothermia * vf, 'Osborn (J) wave'));
  }

  // ST segment (injury/secondary) from the J point through the early T wave.
  const stMag = len(ST);
  if (stMag > 1e-4) {
    if (p.drugs.digoxin > 0 && stMag > 0.02) comps.push({ t0: qrsDur - 6, dur: tStart - qrsDur + tDur * 0.75, dir: norm(ST), amp: stMag, shape: 'sag', tag: 'ST segment' });
    else {
      // The ST shift (injury current / secondary repolarisation) is already fully present at the J
      // point, where ST deviation is measured: the onset ramp (first 10 % of the span) ends there.
      const end = tStart + tDur * 0.85;
      const span = (end - qrsDur + 4) / 0.9;
      comps.push({ t0: end - span, dur: span, dir: norm(ST), amp: stMag, shape: stShape, tag: 'ST segment (injury / secondary)' });
    }
  }
  const tMag = len(T);
  if (tMag > 1e-4) comps.push({ t0: tStart, dur: tDur, dir: norm(T), amp: tMag, shape: tShape, tag: 'T wave' });

  // U wave (late repolarisation; prominent in hypokalaemia and bradycardia).
  const uAmp = (0.025 + 0.24 * lk + (ctx.rr > 1100 ? 0.015 : 0) + 0.04 * p.drugs.qtDrug * lk) * vf;
  comps.push({ t0: tStart + tDur - 25, dur: 150, dir: norm(Tn), amp: uAmp, shape: 'bump', tag: 'U wave' });

  // Brugada: RVOT epicardial action-potential dome loss creates a transmural gradient seen only
  // by the right precordial electrodes that overlie the RVOT → modelled as a local potential.
  let brugada = p.brugada;
  if (brugada === 2 && p.drugs.naBlocker > 0.5) brugada = 1;
  if (brugada) {
    local.push({ weights: { V1: 1, V2: 0.9, V3: 0.25 }, t0: qrsDur - 10, dur: qt - qrsDur + 20, kind: brugada === 1 ? 'brugada1' : 'brugada2', amp: (brugada === 1 ? 0.32 : 0.5) * vf });
  }
  // ARVC epsilon wave: low-amplitude late potentials from slowly activated islands of surviving
  // RV myocardium, recorded only by the electrodes overlying the RV (V1–V3).
  if (p.arvc > 0.3 && ev.route === 'his') {
    local.push({ weights: { V1: 1, V2: 0.85, V3: 0.4, V4R: 0.9 }, t0: qrsDur - 4, dur: 42, kind: 'epsilon', amp: 0.13 * p.arvc * vf });
  }

  // QT is measured to the end of the T wave actually drawn (stage-specific T broadening included).
  return { comps, local, qrsDur, qt: tStart + tDur, tStart, tEnd: tStart + tDur, qrsArea: area, notes };
}

/** Evaluate a local (non-dipolar) term at time u ms after its onset. */
export function localAt(term: LocalTerm, u: number): number {
  if (u < 0 || u > term.dur) return 0;
  const x = u / term.dur;
  if (term.kind === 'epsilon') {
    // Two or three small notches just after the QRS.
    return term.amp * Math.sin(Math.PI * x) * (0.55 + 0.45 * Math.sin(2 * Math.PI * 3 * x));
  }
  if (term.kind === 'brugada1') {
    // Coved: high take-off at J, slow convex descent, terminal negative T.
    const rise = smoothstep(0, 0.04, x);
    const cove = Math.cos((Math.PI / 2) * Math.min(1, x / 0.72));
    const neg = -0.55 * Math.sin(Math.PI * clamp((x - 0.6) / 0.4, 0, 1));
    return term.amp * (rise * cove + neg);
  }
  // Saddleback: J elevation, trough, then positive T.
  const j = smoothstep(0, 0.04, x) * Math.exp(-x / 0.12);
  const saddle = 0.25 * smoothstep(0.1, 0.3, x) * (1 - smoothstep(0.85, 1, x));
  return term.amp * (0.7 * j + saddle);
}

/** Mean frontal-plane axis (degrees) of a QRS area vector. */
export function axisOf(area: Vec3): number {
  return (Math.atan2(area[1], area[0]) * 180) / Math.PI;
}
