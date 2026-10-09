// Rotatable, beating 3-D heart driven by the simulation.
//
// Anatomy is procedural but follows real topography: a thick-walled conical LV, a crescentic RV
// wrapped around its septal side with an infundibulum (RV outflow tract) rising to the pulmonary
// valve, atria with appendages, the great vessels, all four valves and the coronary arteries in
// their grooves. What is physiological is the TIMING and the MECHANICS: for every beat the model
// derives per-vertex activation times from the beat's real entry points (Purkinje sites chosen by
// the bundle-branch state, an ectopic focus, the accessory-pathway insertion, the pacing lead, or
// combinations for fusion), scaled to that beat's QRS duration; repolarisation order follows the
// beat's own T-wave vector; each region then CONTRACTS when it is activated (so dyssynchrony in
// LBBB or pacing is visible), and the valves open and close from the haemodynamic model
// (engine/hemo.ts). The heart-vector arrow is the same summed dipole that is projected onto the
// leads to draw the ECG.
//
// Frames: the ECG engine uses x = patient's left, y = inferior, z = anterior. Three.js uses
// y = up, so engine (x, y, z) → three (x, −y, z). Default camera looks from the front.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import type { EcgRun } from '../engine';
import type { HemoResult } from '../engine/hemo';
import { LEADS, TWELVE, type LeadId } from '../engine/leads';
import { AP_SITE, VENT_SITE, buildP, territoryVector } from '../engine/morphology';
import type { AtrialSite, Territory } from '../engine/params';
import type { BeatInfo } from '../engine/synth';
import { h } from './dom';

type V3 = [number, number, number];
const T = (e: readonly number[]): THREE.Vector3 => new THREE.Vector3(e[0], -e[1], e[2]);
const vnorm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const vadd = (...vs: V3[]): V3 => vs.reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], [0, 0, 0] as V3);
const vscale = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k];
const vdot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vcross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vsub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vlerp = (a: V3, b: V3, u: number): V3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];

// ---------------------------------------------------------------- anatomy (engine frame)
const AXIS: V3 = vnorm([0.5, 0.6, 0.45]); // base → apex: leftward, inferior, anterior
const SEPT0: V3 = vnorm([-0.75, -0.05, 0.65]);
const SEPT: V3 = vnorm(vsub(SEPT0, vscale(AXIS, vdot(SEPT0, AXIS)))); // LV → RV, ⟂ long axis
let W: V3 = vnorm(vcross(AXIS, SEPT));
if (W[2] < 0) W = vscale(W, -1); // θ = +90° is the anterior wall

// RV free wall spans this arc of the LV circumference (θ measured from the septum toward anterior).
const RV_TH_MIN = -100; // posterior (inferior) interventricular groove
const RV_TH_MAX = 66; // anterior interventricular groove
const RV_Z_APEX = 0.62; // the RV stops short of the apex, which is formed by the LV

interface Anatomy {
  cL: V3;
  lvLen: number;
  lvRad: number;
  lvEndoRf: number;
  rvGap: number;
  cRA: V3;
  cLA: V3;
  raR: V3;
  laR: V3;
  center: V3;
  aoV: V3;
  pvV: V3;
  mvV: V3;
  tvV: V3;
}

function lvPoint(A: Anatomy, z: number, thDeg: number, rf: number): V3 {
  const th = (thDeg * Math.PI) / 180;
  const R = A.lvRad * Math.sqrt(Math.max(0, 1 - z * z)) * rf;
  return vadd(A.cL, vscale(AXIS, z * A.lvLen), vscale(SEPT, R * Math.cos(th)), vscale(W, R * Math.sin(th)));
}

/** Point on the RV free wall: the LV epicardium pushed outward by the crescentic RV cavity. */
function rvPoint(A: Anatomy, z: number, thDeg: number, rf: number): V3 {
  const mid = (RV_TH_MIN + RV_TH_MAX) / 2;
  const half = (RV_TH_MAX - RV_TH_MIN) / 2;
  const w = Math.max(0, Math.cos((((thDeg - mid) / half) * Math.PI) / 2));
  const zt = Math.max(0, Math.min(1, (RV_Z_APEX - z) / (RV_Z_APEX + 0.95)));
  const prof = Math.pow(Math.sin((Math.PI / 2) * Math.min(1, zt * 1.5)), 0.8);
  const base = lvPoint(A, z, thDeg, 1.0);
  const axisPt = vadd(A.cL, vscale(AXIS, z * A.lvLen));
  const out = vnorm(vsub(base, axisPt));
  return vadd(base, vscale(out, A.rvGap * Math.pow(w, 0.55) * prof * rf));
}

function anatomy(run: EcgRun): Anatomy {
  const p = run.physio;
  const lvK = Math.pow(Math.max(0.7, p.lvMass), 0.28);
  const rvK = Math.pow(Math.max(0.7, p.rvMass), 0.3) * (1 + 0.45 * p.rvStrain);
  const cL: V3 = [0.12, 0.12, -0.12];
  const ra = Math.pow(p.raSize, 0.35);
  const la = Math.pow(p.laSize, 0.35);
  const A: Anatomy = {
    cL,
    lvLen: 1.0 * Math.pow(lvK, 0.5),
    lvRad: 0.6 * lvK,
    lvEndoRf: Math.max(0.42, 0.66 / Math.pow(lvK, 1.6) + 0.04 * p.hcm * 0),
    rvGap: 0.4 * rvK,
    cRA: [-0.78, -0.55, -0.12],
    cLA: [-0.05, -0.72, -0.72],
    raR: [0.36 * ra, 0.38 * ra, 0.34 * ra],
    laR: [0.42 * la, 0.3 * la, 0.32 * la],
    center: [0, 0, 0],
    aoV: [0, 0, 0],
    pvV: [0, 0, 0],
    mvV: [0, 0, 0],
    tvV: [0, 0, 0],
  };
  A.center = vadd(cL, vscale(SEPT, 0.18), vscale(AXIS, -0.3));
  // Valve centres: the aortic valve sits centrally (wedged between the AV valves), the mitral
  // posterolateral to it, the tricuspid anterior-rightward, the pulmonary valve highest and most
  // anterior-leftward (the RVOT crosses in front of the aortic root).
  A.aoV = vadd(lvPoint(A, -0.9, 35, 0.32), vscale(AXIS, -0.1));
  A.mvV = lvPoint(A, -0.84, -150, 0.42);
  A.tvV = vadd(rvPoint(A, -0.88, 0, 0.55), vscale(AXIS, -0.02));
  A.pvV = vadd(A.aoV, [0.24, -0.3, 0.3]);
  return A;
}

// AHA 17-segment model of the LV (Cerqueira et al. 2002) and the usual coronary supply.
const SEG_NAMES = ['', 'basal anterior', 'basal anteroseptal', 'basal inferoseptal', 'basal inferior', 'basal inferolateral', 'basal anterolateral', 'mid anterior', 'mid anteroseptal', 'mid inferoseptal', 'mid inferior', 'mid inferolateral', 'mid anterolateral', 'apical anterior', 'apical septal', 'apical inferior', 'apical lateral', 'apex'];
type Coronary = 0 | 1 | 2 | 3; // none, LAD, LCx, RCA
const COR_NAME = ['—', 'LAD', 'LCx', 'RCA'];
function lvSegment(z: number, thDeg: number): number {
  let th = ((thDeg % 360) + 360) % 360; // 0 septum (centre), 90 anterior, 180 lateral, 270 inferior
  if (z > 0.86) return 17;
  if (z > 0.35) {
    if (th >= 45 && th < 135) return 13;
    if (th >= 135 && th < 225) return 16;
    if (th >= 225 && th < 315) return 15;
    return 14;
  }
  const base = z < -0.35 ? 0 : 6;
  th = (th + 360) % 360;
  // anteroseptal 0–60, anterior 60–120, anterolateral 120–180, inferolateral 180–240, inferior 240–300, inferoseptal 300–360
  const k = Math.floor(th / 60);
  const map = [2, 1, 6, 5, 4, 3];
  return base + map[k];
}
function segmentCoronary(seg: number): Coronary {
  if ([1, 2, 7, 8, 13, 14, 17].includes(seg)) return 1;
  if ([3, 4, 9, 10, 15].includes(seg)) return 3;
  return 2;
}
/** Artery (and where along it) occluded for each ischaemic territory. u = fraction along the artery path. */
const CULPRIT: Partial<Record<Territory, { art: 'LAD' | 'LCx' | 'RCA' | 'D1'; u: number; label: string }>> = {
  proxLAD: { art: 'LAD', u: 0.08, label: 'proximal LAD occlusion' },
  anteroseptal: { art: 'LAD', u: 0.22, label: 'LAD occlusion (septal branches)' },
  anterior: { art: 'LAD', u: 0.35, label: 'mid-LAD occlusion' },
  anterolateral: { art: 'LAD', u: 0.25, label: 'LAD / diagonal occlusion' },
  wrapLAD: { art: 'LAD', u: 0.35, label: 'occlusion of a "wraparound" LAD' },
  highLateral: { art: 'D1', u: 0.3, label: 'first diagonal (or obtuse marginal) occlusion' },
  lateral: { art: 'LCx', u: 0.3, label: 'circumflex occlusion' },
  lcx: { art: 'LCx', u: 0.2, label: 'proximal circumflex occlusion' },
  posterior: { art: 'LCx', u: 0.55, label: 'circumflex / posterolateral occlusion' },
  inferior: { art: 'RCA', u: 0.45, label: 'mid-RCA occlusion' },
  proxRCA: { art: 'RCA', u: 0.1, label: 'proximal RCA occlusion (before the RV branches)' },
  rv: { art: 'RCA', u: 0.1, label: 'proximal RCA occlusion (RV branches)' },
};

interface Shell {
  name: string;
  side: 'L' | 'R' | 'A';
  chamber: 'LV' | 'RV' | 'RVOT' | 'RA' | 'LA';
  endo: number; // 0 epicardium … 1 endocardium
  mesh: THREE.Mesh;
  pos: V3[]; // engine-frame rest positions
  rest: Float32Array; // three-frame rest positions
  colors: Float32Array;
  lz: Float32Array; // LV-frame long-axis coordinate (−1 base … 1 apex)
  th: Float32Array; // LV-frame angle (deg)
  seg: Uint8Array; // AHA segment (LV) or 0
  cor: Uint8Array; // coronary supply
  scar: Uint8Array; // 1 = scar / non-contracting
}

function gridShell(fn: (z: number, th: number) => V3, nz: number, nth: number, z0: number, z1: number, th0 = 0, th1 = 360): { geom: THREE.BufferGeometry; pos: V3[]; zs: number[]; ths: number[] } {
  const pos: V3[] = [];
  const zs: number[] = [];
  const ths: number[] = [];
  const arr: number[] = [];
  for (let i = 0; i <= nz; i++) {
    const z = z0 + ((z1 - z0) * i) / nz;
    for (let j = 0; j <= nth; j++) {
      const th = th0 + ((th1 - th0) * j) / nth;
      const p = fn(Math.min(0.9999, z), th);
      pos.push(p);
      zs.push(z);
      ths.push(th);
      const t = T(p);
      arr.push(t.x, t.y, t.z);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < nz; i++) {
    for (let j = 0; j < nth; j++) {
      const a = i * (nth + 1) + j;
      const b = a + nth + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  geom.setIndex(idx);
  geom.computeVertexNormals();
  return { geom, pos, zs, ths };
}

function blobShell(c: V3, r: V3, nz = 26, nth = 36): { geom: THREE.BufferGeometry; pos: V3[]; zs: number[]; ths: number[] } {
  return gridShell(
    (z, thDeg) => {
      const th = (thDeg * Math.PI) / 180;
      const k = Math.sqrt(Math.max(0, 1 - z * z));
      return [c[0] + r[0] * k * Math.cos(th), c[1] + r[1] * z, c[2] + r[2] * k * Math.sin(th)];
    },
    nz,
    nth,
    -1,
    1,
  );
}

/** A tapered tube shell between two points (used for the RV outflow tract). */
function coneShell(a: V3, b: V3, ra: number, rb: number, n = 18, m = 28): { geom: THREE.BufferGeometry; pos: V3[]; zs: number[]; ths: number[] } {
  const ax = vnorm(vsub(b, a));
  let u = vnorm(vcross(ax, [0, 1, 0]));
  if (!Number.isFinite(u[0])) u = [1, 0, 0];
  const v = vnorm(vcross(ax, u));
  return gridShell(
    (z, thDeg) => {
      const s = (z + 1) / 2;
      const th = (thDeg * Math.PI) / 180;
      const r = ra + (rb - ra) * s;
      return vadd(vlerp(a, b, s), vscale(u, r * Math.cos(th)), vscale(v, r * Math.sin(th)));
    },
    n,
    m,
    -1,
    1,
  );
}

// ---------------------------------------------------------------- colours
const C = {
  rest: new THREE.Color('#b8615f'),
  front: new THREE.Color('#fff4a3'),
  depol: new THREE.Color('#ff8f1f'),
  repol: new THREE.Color('#5aa9ff'),
  scar: new THREE.Color('#8c8c8c'),
  injury: new THREE.Color('#b24fe0'),
  arp: new THREE.Color('#d32f2f'),
  rrp: new THREE.Color('#ffa000'),
  excitable: new THREE.Color('#43a047'),
  lad: new THREE.Color('#1e88e5'),
  lcx: new THREE.Color('#43a047'),
  rca: new THREE.Color('#fb8c00'),
  atrium: new THREE.Color('#9e8a88'),
  facing: new THREE.Color('#2e7d32'),
  away: new THREE.Color('#c62828'),
  neutral: new THREE.Color('#8d7f7d'),
};
const CORC = [C.atrium, C.lad, C.lcx, C.rca];
const tmp = new THREE.Color();

function stateColor(out: THREE.Color, t: number, a: number, r: number): THREE.Color {
  const dt = t - a;
  if (dt < 0) return out.copy(C.rest);
  if (dt < 10) return out.copy(C.front).lerp(C.depol, dt / 10);
  if (t < r - 45) return out.copy(C.depol);
  if (t < r) return out.copy(C.depol).lerp(C.repol, (t - (r - 45)) / 45);
  if (t < r + 140) return out.copy(C.repol).lerp(C.rest, (t - r) / 140);
  return out.copy(C.rest);
}

/** Diverging colour map for membrane potential (−90 mV blue → +30 mV red). */
function voltageColor(out: THREE.Color, mv: number): THREE.Color {
  const u = Math.max(0, Math.min(1, (mv + 90) / 120));
  const stops: [number, string][] = [
    [0, '#1a237e'],
    [0.2, '#1e88e5'],
    [0.45, '#26c6da'],
    [0.7, '#ffee58'],
    [0.85, '#fb8c00'],
    [1, '#d50000'],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (u <= stops[i][0]) {
      const [a0, c0] = stops[i - 1];
      const [a1, c1] = stops[i];
      return out.set(c0).lerp(tmp2.set(c1), (u - a0) / (a1 - a0));
    }
  }
  return out.set('#d50000');
}
const tmp2 = new THREE.Color();

/** Rainbow for activation isochrones (early red → late violet), with 10-ms bands. */
function isoColor(out: THREE.Color, act: number, maxAct: number): THREE.Color {
  const u = Math.max(0, Math.min(1, act / Math.max(1, maxAct)));
  out.setHSL(0.78 * u, 0.85, 0.52);
  const band = (act / 10) % 1;
  if (band < 0.12) out.multiplyScalar(0.55);
  return out;
}

// ---------------------------------------------------------------- action potential (shape model)
type ApKind = 'ventEndo' | 'ventEpi' | 'atrial';
interface ApState {
  mv: number;
  phase: 0 | 1 | 2 | 3 | 4;
  refractory: 'absolute' | 'relative' | 'excitable';
}

/** Membrane potential `dt` ms after local activation for an AP of duration `apd`. */
function apState(dt: number, apd: number, kind: ApKind): ApState {
  const rest = kind === 'atrial' ? -80 : -86;
  if (!Number.isFinite(dt) || dt < 0 || dt > apd + 400) return { mv: rest, phase: 4, refractory: 'excitable' };
  const peak = kind === 'atrial' ? 22 : 30;
  const plateau = kind === 'ventEpi' ? 8 : kind === 'atrial' ? -5 : 15;
  const notch = kind === 'ventEpi' ? -2 : kind === 'atrial' ? 0 : 10;
  const p3 = Math.max(40, (kind === 'atrial' ? 0.55 : 0.3) * apd);
  if (dt < 1.5) return { mv: rest + ((peak - rest) * dt) / 1.5, phase: 0, refractory: 'absolute' };
  if (dt < 12) return { mv: peak + ((notch - peak) * (dt - 1.5)) / 10.5, phase: 1, refractory: 'absolute' };
  const p3start = apd - p3;
  if (dt < p3start) {
    const u = (dt - 12) / Math.max(1, p3start - 12);
    return { mv: notch + (plateau - notch) * Math.min(1, u * 3) - 12 * u * u, phase: 2, refractory: 'absolute' };
  }
  if (dt < apd) {
    const u = (dt - p3start) / p3;
    const top = plateau - 12;
    const mv = top - (top - rest) * (0.5 - 0.5 * Math.cos(Math.PI * u));
    return { mv, phase: 3, refractory: mv > -60 ? 'absolute' : 'relative' };
  }
  return { mv: rest, phase: 4, refractory: dt < apd + 20 ? 'relative' : 'excitable' };
}

const PHASE_CURRENTS: Record<number, { name: string; vent: string; atrial: string }> = {
  0: { name: 'Phase 0 — rapid depolarisation', vent: 'Fast Na⁺ channels open (INa): Na⁺ rushes in. Its rate of rise sets conduction velocity — and therefore QRS width.', atrial: 'Fast Na⁺ current (INa) — this is what writes the P wave.' },
  1: { name: 'Phase 1 — early repolarisation (notch)', vent: 'INa inactivates; transient outward K⁺ current (Ito) — larger in epicardium (the basis of the J point, J waves and Brugada pattern).', atrial: 'Ito and the ultra-rapid delayed rectifier (IKur, atrial-specific).' },
  2: { name: 'Phase 2 — plateau', vent: 'Inward L-type Ca²⁺ current (ICa,L) balances outward IKs/IKr; Ca²⁺ entry triggers contraction. All ventricular cells are at similar voltage → isoelectric ST segment.', atrial: 'Short, low plateau (ICa,L vs IKur/IKs) — the atrial ST segment (Ta wave) is tiny and usually hidden in the QRS.' },
  3: { name: 'Phase 3 — repolarisation', vent: 'ICa,L inactivates; delayed rectifiers IKr (hERG — the target of QT-prolonging drugs) and IKs, then IK1, return the cell to rest → the T wave.', atrial: 'IKr, IKs, IK1 (and IK,ACh with vagal tone, which shortens atrial refractoriness).' },
  4: { name: 'Phase 4 — resting potential', vent: 'IK1 clamps the membrane near the K⁺ equilibrium potential (≈ −85 mV); the Na⁺/K⁺-ATPase and Na⁺/Ca²⁺ exchanger restore ion gradients and relax the cell → TP segment.', atrial: 'IK1 (weaker than in ventricle) and IK,ACh hold the resting potential.' },
};

// ---------------------------------------------------------------- conduction system
interface Tract {
  id: string;
  curve: THREE.CatmullRomCurve3;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  blocked: boolean;
  base: THREE.Color;
}

interface Leaflet {
  pivot: THREE.Group;
  axis: THREE.Vector3;
  sign: number;
}
interface Valve {
  id: 'mitral' | 'tricuspid' | 'aortic' | 'pulmonary';
  bit: number;
  ring: THREE.Mesh;
  leaflets: Leaflet[];
  open: number; // 0..1 (smoothed)
}

type View = 'anterior' | 'lao' | 'rao' | 'left' | 'posterior' | 'superior' | 'inferior';
const VIEWS: Record<View, { label: string; pos: V3; up: V3 }> = {
  anterior: { label: 'Anterior (frontal)', pos: [0, 0, 1], up: [0, 1, 0] },
  lao: { label: 'LAO 45°', pos: [0.71, 0, 0.71], up: [0, 1, 0] },
  rao: { label: 'RAO 30°', pos: [-0.5, 0, 0.87], up: [0, 1, 0] },
  left: { label: 'Left lateral', pos: [1, 0, 0], up: [0, 1, 0] },
  posterior: { label: 'Posterior', pos: [0, 0, -1], up: [0, 1, 0] },
  superior: { label: 'From above', pos: [0, 1, 0.0001], up: [0, 0, -1] },
  inferior: { label: 'From the feet (horizontal plane, CT view)', pos: [0, -1, 0.0001], up: [0, 0, 1] },
};

export type ColourMode = 'state' | 'voltage' | 'isochrone' | 'refractory' | 'coronary' | 'lead';
const MODES: [ColourMode, string][] = [
  ['state', 'Colour: electrical state'],
  ['voltage', 'Colour: membrane potential (mV)'],
  ['isochrone', 'Colour: activation map (isochrones)'],
  ['refractory', 'Colour: refractoriness (vulnerable period)'],
  ['coronary', 'Colour: coronary territories (AHA 17-segment)'],
  ['lead', 'Colour: what the selected lead “sees”'],
];

export interface Heart3DOptions {
  height?: number;
}

interface Pick {
  shell: number;
  vi: number;
}

export class Heart3D {
  readonly root: HTMLDivElement;
  private host: HTMLDivElement;
  private renderer: THREE.WebGLRenderer;
  private labelRenderer: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private heart = new THREE.Group();
  private overlay = new THREE.Group();
  private shells: Shell[] = [];
  private tracts: Tract[] = [];
  private valves: Valve[] = [];
  private coronaries = new THREE.Group();
  private dots: THREE.Mesh[] = [];
  private labels: CSS2DObject[] = [];
  private run: EcgRun | null = null;
  private hemo: HemoResult | null = null;
  private A: Anatomy | null = null;
  private t = 0;
  private lead: LeadId = 'II';
  private wallMode: 'solid' | 'cut' | 'glass' = 'glass';
  private colourMode: ColourMode = 'state';
  private show = { system: true, vector: true, axis: true, labels: true, allLeads: false, motion: true, valves: true, coronary: true };
  private clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  private beatCache = new Map<number, { act: Float32Array[]; rep: Float32Array[]; maxAct: number }>();
  private atrialCache = new Map<number, Float32Array[]>();
  private arrow = new THREE.Group();
  private shaft: THREE.Mesh;
  private head: THREE.Mesh;
  private loop: THREE.Line;
  private axisGroup = new THREE.Group();
  private proj: THREE.Mesh;
  private projLabel: CSS2DObject;
  private gizmo: SVGSVGElement;
  private legend: HTMLDivElement;
  private inspector: HTMLDivElement;
  private apCanvas: HTMLCanvasElement;
  private pick: Pick | null = null;
  private pickMarker: THREE.Mesh;
  private ro: ResizeObserver;
  private raf = 0;
  private disposed = false;
  private lastMotionT = NaN;

  constructor(opts: Heart3DOptions = {}) {
    this.host = h('div', { class: 'h3d-canvas', style: `height:${opts.height ?? 360}px` });
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.localClippingEnabled = true;
    this.renderer.domElement.setAttribute('role', 'img');
    this.renderer.domElement.setAttribute('aria-label', '3-D heart: drag to rotate, scroll or pinch to zoom, click the heart muscle to inspect its action potential');
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'h3d-labels';
    this.gizmo = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.gizmo.setAttribute('class', 'h3d-gizmo');
    this.gizmo.setAttribute('viewBox', '-40 -40 80 80');
    this.gizmo.setAttribute('aria-hidden', 'true');
    this.host.append(this.renderer.domElement, this.labelRenderer.domElement, this.gizmo);

    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
    this.camera.position.set(0, 0, 6.6);
    this.scene.add(this.camera);
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(1.5, 2, 3);
    this.camera.add(key);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404050, 1.1));
    this.controls = new OrbitControls(this.camera, this.labelRenderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 12;
    this.controls.addEventListener('change', () => this.requestRender());
    this.scene.add(this.heart, this.overlay);

    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false });
    const haloMat = new THREE.MeshBasicMaterial({ color: 0x111111, depthTest: false });
    this.shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 12), arrowMat);
    this.head = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 16), arrowMat);
    const halo = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1, 12), haloMat);
    this.shaft.renderOrder = 41;
    this.head.renderOrder = 41;
    halo.renderOrder = 40;
    halo.name = 'halo';
    this.arrow.add(halo, this.shaft, this.head);
    this.loop = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffd400, depthTest: false, transparent: true, opacity: 0.9 }));
    this.loop.renderOrder = 29;
    this.proj = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 10), new THREE.MeshBasicMaterial({ color: 0x2e7d32, depthTest: false, transparent: true, opacity: 0.75 }));
    this.proj.renderOrder = 31;
    const pl = h('span', { class: 'h3d-lab proj' });
    this.projLabel = new CSS2DObject(pl);
    this.overlay.add(this.arrow, this.loop, this.axisGroup, this.proj, this.projLabel);
    this.pickMarker = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), new THREE.MeshBasicMaterial({ color: '#00e5ff', depthTest: false }));
    this.pickMarker.renderOrder = 45;
    this.pickMarker.visible = false;

    this.legend = h('div', { class: 'h3d-legend' });
    this.apCanvas = h('canvas', { class: 'h3d-ap', width: 320, height: 120, 'aria-label': 'Action potential of the selected region' });
    this.inspector = h('div', { class: 'h3d-insp' }, h('p', { class: 'h3d-hint' }, 'Click any part of the heart muscle to inspect it: its AHA segment and coronary supply, when it is activated and repolarised in this beat, its action potential and the ion currents flowing right now, and which leads face it.'));
    this.root = h('div', { class: 'h3d' }, this.buildToolbar(), this.host, this.legend, this.inspector);
    this.setupPicking();
    this.updateLegend();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.host);
    this.setView('anterior');
  }

  /** Throws if WebGL is unavailable (callers fall back to the 2-D schematic). */
  static supported(): boolean {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      return false;
    }
  }

  private buildToolbar(): HTMLElement {
    const view = h('select', { 'aria-label': 'Viewpoint', class: 'h3d-sel' }, ...Object.entries(VIEWS).map(([k, v]) => h('option', { value: k }, v.label)));
    view.addEventListener('change', () => this.setView(view.value as View));
    const walls = h('select', { 'aria-label': 'Wall display', class: 'h3d-sel' }, h('option', { value: 'glass' }, 'Walls: transparent (see inside)'), h('option', { value: 'solid' }, 'Walls: solid'), h('option', { value: 'cut' }, 'Walls: cut away toward viewer'));
    walls.addEventListener('change', () => {
      this.wallMode = walls.value as typeof this.wallMode;
      this.applyMaterials();
      this.requestRender();
    });
    const mode = h('select', { 'aria-label': 'Colour the heart by', class: 'h3d-sel' }, ...MODES.map(([k, l]) => h('option', { value: k }, l)));
    mode.addEventListener('change', () => {
      this.colourMode = mode.value as ColourMode;
      this.updateLegend();
      if (this.run) this.colour();
      this.requestRender();
    });
    const tog = (label: string, key: keyof typeof this.show): HTMLLabelElement => {
      const cb = h('input', { type: 'checkbox', checked: this.show[key] });
      cb.addEventListener('change', () => {
        this.show[key] = cb.checked;
        this.applyMaterials();
        if (key === 'motion' && this.run) this.deform();
        this.updateOverlay();
        this.requestRender();
      });
      return h('label', { class: 'h3d-tog' }, cb, ' ', label);
    };
    return h(
      'div',
      { class: 'h3d-bar' },
      view,
      walls,
      mode,
      tog('Contraction', 'motion'),
      tog('Valves', 'valves'),
      tog('Coronary arteries', 'coronary'),
      tog('Conduction system', 'system'),
      tog('Heart vector', 'vector'),
      tog('Lead axis', 'axis'),
      tog('All 12 axes', 'allLeads'),
      tog('Labels', 'labels'),
    );
  }

  setView(v: View): void {
    const d = this.camera.position.length() || 6.6;
    const cfg = VIEWS[v];
    this.camera.position.set(cfg.pos[0] * d, cfg.pos[1] * d, cfg.pos[2] * d);
    this.camera.up.set(cfg.up[0], cfg.up[1], cfg.up[2]);
    this.controls.target.set(0, 0, 0);
    this.camera.lookAt(0, 0, 0);
    this.controls.update();
    this.requestRender();
  }

  setLead(lead: LeadId): void {
    this.lead = lead;
    this.buildAxes();
    this.updateOverlay();
    if (this.run && this.colourMode === 'lead') {
      this.colour();
      this.updateLegend();
    }
    this.requestRender();
  }

  setRun(run: EcgRun, hemo?: HemoResult | null): void {
    this.run = run;
    this.hemo = hemo ?? null;
    this.beatCache.clear();
    this.atrialCache.clear();
    this.build();
    this.updateLegend();
    if (this.pick && this.pick.shell >= this.shells.length) this.pick = null;
    this.setTime(this.t);
  }

  setTime(t: number): void {
    this.t = t;
    if (!this.run) return;
    this.deform();
    this.colour();
    this.updateTracts();
    this.updateValves();
    this.updateOverlay();
    this.renderInspector();
    this.requestRender();
  }

  destroy(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.clearHeart();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  // ------------------------------------------------------------------ build
  private clearHeart(): void {
    for (const o of [...this.heart.children]) {
      this.heart.remove(o);
      o.traverse((x) => {
        const m = x as THREE.Mesh;
        m.geometry?.dispose?.();
        (m.material as THREE.Material | undefined)?.dispose?.();
        if (x instanceof CSS2DObject) x.element.remove();
      });
    }
    this.coronaries = new THREE.Group();
    this.shells = [];
    this.tracts = [];
    this.valves = [];
    this.dots = [];
    this.labels = [];
  }

  private label(text: string, at: V3, cls = '', parent: THREE.Object3D = this.heart): void {
    const el = h('span', { class: `h3d-lab ${cls}` }, text);
    const o = new CSS2DObject(el);
    o.position.copy(T(at));
    parent.add(o);
    this.labels.push(o);
  }

  private addShell(name: string, side: Shell['side'], chamber: Shell['chamber'], endo: number, g: { geom: THREE.BufferGeometry; pos: V3[] }): Shell {
    const A = this.A!;
    const n = g.pos.length;
    const colors = new Float32Array(n * 3);
    g.geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const posAttr = g.geom.getAttribute('position') as THREE.BufferAttribute;
    posAttr.setUsage(THREE.DynamicDrawUsage);
    const mesh = new THREE.Mesh(g.geom, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, side: THREE.DoubleSide }));
    mesh.name = name;
    this.heart.add(mesh);
    const lz = new Float32Array(n);
    const th = new Float32Array(n);
    const seg = new Uint8Array(n);
    const cor = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const r = vsub(g.pos[i], A.cL);
      const z = vdot(r, AXIS) / A.lvLen;
      const perp = vsub(r, vscale(AXIS, z * A.lvLen));
      const ang = (Math.atan2(vdot(perp, W), vdot(perp, SEPT)) * 180) / Math.PI;
      lz[i] = z;
      th[i] = ang;
      if (chamber === 'LV') {
        seg[i] = lvSegment(z, ang);
        cor[i] = segmentCoronary(seg[i]);
      } else if (chamber === 'RV' || chamber === 'RVOT') {
        // RV free wall: RCA (acute marginal branches); anterior paraseptal strip and the infundibulum
        // partly from the LAD (conus branches arise from either) — shown as RCA except the anterior strip.
        cor[i] = ang > RV_TH_MAX - 20 && chamber === 'RV' ? 1 : 3;
      } else cor[i] = 0;
    }
    const sh: Shell = { name, side, chamber, endo, mesh, pos: g.pos, rest: Float32Array.from(posAttr.array as Float32Array), colors, lz, th, seg, cor, scar: new Uint8Array(n) };
    this.shells.push(sh);
    return sh;
  }

  private tube(id: string, pts: V3[], radius: number, color: string, blocked = false): Tract {
    const curve = new THREE.CatmullRomCurve3(pts.map(T));
    const geom = new THREE.TubeGeometry(curve, Math.max(12, pts.length * 10), radius, 8, false);
    const base = new THREE.Color(blocked ? '#d32f2f' : color);
    const mat = new THREE.MeshBasicMaterial({ color: base.clone(), transparent: true });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.renderOrder = 20;
    this.heart.add(mesh);
    const tr = { id, curve, mesh, mat, blocked, base };
    this.tracts.push(tr);
    return tr;
  }

  private vessel(pts: V3[], radius: number, color: string, name = 'vessel'): void {
    const curve = new THREE.CatmullRomCurve3(pts.map(T));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, radius, 18, false), new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide }));
    mesh.name = name;
    this.heart.add(mesh);
  }

  private artery(name: string, pts: V3[], radius: number, culprit: { u: number; label: string } | null, acute: boolean): void {
    const curve = new THREE.CatmullRomCurve3(pts.map(T));
    const add = (c: THREE.Curve<THREE.Vector3>, col: string, r: number): void => {
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(c, 40, r, 8, false), new THREE.MeshStandardMaterial({ color: col, roughness: 0.45, emissive: col, emissiveIntensity: 0.15 }));
      mesh.renderOrder = 18;
      this.coronaries.add(mesh);
    };
    if (!culprit) {
      add(curve, '#d84343', radius);
      return;
    }
    // Patent proximal part, occluded/under-perfused distal part, marker at the occlusion.
    const cut = Math.max(0.02, Math.min(0.98, culprit.u));
    const pts2 = curve.getSpacedPoints(60);
    const k = Math.round(cut * 60);
    if (k >= 2) add(new THREE.CatmullRomCurve3(pts2.slice(0, k + 1)), '#d84343', radius);
    add(new THREE.CatmullRomCurve3(pts2.slice(k)), acute ? '#5a2a2a' : '#7a6a6a', radius * 0.85);
    const m = new THREE.Mesh(new THREE.SphereGeometry(radius * 2.4, 12, 10), new THREE.MeshBasicMaterial({ color: acute ? '#ffeb3b' : '#bdbdbd', depthTest: false }));
    m.position.copy(pts2[k]);
    m.renderOrder = 30;
    this.coronaries.add(m);
    const lab = new CSS2DObject(h('span', { class: 'h3d-lab focus' }, `✕ ${culprit.label}${acute ? '' : ' (old)'}`));
    lab.position.copy(pts2[k]);
    this.coronaries.add(lab);
    this.labels.push(lab);
    void name;
  }

  private valve(id: Valve['id'], bit: number, c: V3, normal: V3, radius: number, nLeaf: number, flow: V3): void {
    const n = vnorm(normal);
    let u = vnorm(vcross(n, [0, 1, 0]));
    if (!Number.isFinite(u[0]) || Math.hypot(...u) < 0.5) u = vnorm(vcross(n, [1, 0, 0]));
    const v = vnorm(vcross(n, u));
    const ringAt = (a: number): V3 => vadd(c, vscale(u, radius * Math.cos(a)), vscale(v, radius * Math.sin(a)));
    const tc = T(c);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.11, 8, 36), new THREE.MeshStandardMaterial({ color: '#f5efe6', roughness: 0.5 }));
    ring.position.copy(tc);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), T(n).normalize());
    ring.renderOrder = 22;
    this.heart.add(ring);
    const leaflets: Leaflet[] = [];
    const flowT = T(flow).normalize();
    for (let k = 0; k < nLeaf; k++) {
      const a0 = (2 * Math.PI * k) / nLeaf;
      const a1 = (2 * Math.PI * (k + 1)) / nLeaf;
      const p0 = T(ringAt(a0));
      const p1 = T(ringAt(a1));
      const mid = p0.clone().add(p1).multiplyScalar(0.5);
      const pivot = new THREE.Group();
      pivot.position.copy(mid);
      const pts: THREE.Vector3[] = [];
      const steps = 8;
      for (let s = 0; s <= steps; s++) pts.push(T(ringAt(a0 + ((a1 - a0) * s) / steps)).sub(mid));
      const tip = tc.clone().sub(mid);
      const arr: number[] = [];
      for (let s = 0; s < steps; s++) arr.push(pts[s].x, pts[s].y, pts[s].z, pts[s + 1].x, pts[s + 1].y, pts[s + 1].z, tip.x, tip.y, tip.z);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#fff3e0', roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
      mesh.renderOrder = 23;
      pivot.add(mesh);
      this.heart.add(pivot);
      const axis = p1.clone().sub(p0).normalize();
      // Choose the rotation sign that swings the free edge downstream (with the flow).
      const test = tip.clone().applyAxisAngle(axis, 0.6);
      const sign = test.clone().sub(tip).dot(flowT) >= 0 ? 1 : -1;
      leaflets.push({ pivot, axis, sign });
    }
    this.valves.push({ id, bit, ring, leaflets, open: 0 });
  }

  private build(): void {
    const run = this.run!;
    this.clearHeart();
    const A = anatomy(run);
    this.A = A;
    const p = run.physio;
    const R = p.rhythm;

    // ---- chambers
    const lvEpi = this.addShell('LV epicardium', 'L', 'LV', 0, gridShell((z, th) => lvPoint(A, z, th, 1), 44, 56, -0.84, 1));
    this.addShell('LV endocardium', 'L', 'LV', 1, gridShell((z, th) => lvPoint({ ...A, cL: vadd(A.cL, vscale(AXIS, 0.07)) }, z, th, A.lvEndoRf), 34, 48, -0.82, 0.9));
    this.addShell('RV free wall', 'R', 'RV', 0.5, gridShell((z, th) => rvPoint(A, z, th, 1), 36, 40, -0.92, RV_Z_APEX, RV_TH_MIN, RV_TH_MAX));
    const infStart = rvPoint(A, -0.7, 40, 0.55);
    this.addShell('RV outflow tract', 'R', 'RVOT', 0.5, coneShell(infStart, A.pvV, 0.27 * Math.sqrt(A.rvGap / 0.4), 0.15));
    this.addShell('Right atrium', 'A', 'RA', 0.5, blobShell(A.cRA, A.raR));
    this.addShell('Left atrium', 'A', 'LA', 0.5, blobShell(A.cLA, A.laR));
    // Atrial appendages: the RA appendage hooks around the aortic root anteriorly; the LA appendage
    // lies on the left, beside the pulmonary trunk.
    this.addShell('Right atrial appendage', 'A', 'RA', 0.5, coneShell(vadd(A.cRA, [0.2, -0.22, 0.22]), vadd(A.cRA, [0.48, -0.42, 0.42]), 0.15, 0.06, 10, 18));
    this.addShell('Left atrial appendage', 'A', 'LA', 0.5, coneShell(vadd(A.cLA, [0.32, -0.02, 0.2]), vadd(A.cLA, [0.62, 0.05, 0.42]), 0.13, 0.05, 10, 18));

    // ---- scar / non-contracting myocardium
    const isch = p.ischemia;
    const scarStage = (isch.stage === 'old' || isch.stage === 'evolving' || isch.stage === 'aneurysm') && isch.territory !== 'diffuseSubendo';
    const tdir = territoryVector(isch.territory) as unknown as V3;
    if (scarStage) for (const s of this.shells) if (s.side !== 'A' && s.endo < 1) for (let i = 0; i < s.pos.length; i++) if (vdot(vnorm(vsub(s.pos[i], A.center)), tdir) > 0.62) s.scar[i] = 1;

    // ---- great vessels (context; drawn semi-transparent in glass mode)
    const ao = A.aoV;
    this.vessel([ao, vadd(ao, [-0.1, -0.42, 0.12]), vadd(ao, [-0.06, -0.9, 0.06]), vadd(ao, [0.2, -1.12, -0.25]), vadd(ao, [0.45, -0.95, -0.55]), vadd(ao, [0.52, -0.4, -0.7]), vadd(ao, [0.52, 0.5, -0.72])], 0.16, '#c64b4b');
    const pv = A.pvV;
    const bif = vadd(pv, [0.1, -0.42, -0.36]);
    this.vessel([pv, vadd(pv, [0.06, -0.24, -0.08]), bif], 0.15, '#5f79c4');
    this.vessel([bif, vadd(bif, [0.25, -0.02, -0.15]), vadd(bif, [0.55, 0.05, -0.25])], 0.11, '#5f79c4');
    this.vessel([bif, vadd(bif, [-0.3, 0.06, -0.12]), vadd(bif, [-0.8, 0.12, -0.15])], 0.11, '#5f79c4');
    this.vessel([vadd(A.cRA, [0.05, -0.32, 0.02]), vadd(A.cRA, [0.08, -0.85, 0.0]), vadd(A.cRA, [0.1, -1.3, -0.02])], 0.13, '#5f79c4');
    this.vessel([vadd(A.cRA, [0.08, 0.3, -0.12]), vadd(A.cRA, [0.1, 0.7, -0.2]), vadd(A.cRA, [0.12, 1.05, -0.25])], 0.14, '#5f79c4');
    for (const [dx, dy] of [
      [-0.3, -0.12],
      [-0.28, 0.14],
      [0.32, -0.12],
      [0.3, 0.14],
    ] as [number, number][]) {
      const s0 = vadd(A.cLA, [dx, dy, -0.18]);
      this.vessel([s0, vadd(s0, [dx * 0.9, dy * 0.3, -0.12]), vadd(s0, [dx * 1.6, dy * 0.4, -0.18])], 0.07, '#b45a5a');
    }

    // ---- valves (normal = direction of forward flow through the valve)
    this.valve('mitral', 1, A.mvV, AXIS, 0.21, 2, AXIS);
    this.valve('tricuspid', 2, A.tvV, AXIS, 0.2, 3, AXIS);
    const aoDir = vnorm(vsub(vadd(ao, [-0.1, -0.42, 0.12]), ao));
    this.valve('aortic', 4, ao, aoDir, 0.14, 3, aoDir);
    const pvDir = vnorm(vsub(vadd(pv, [0.06, -0.24, -0.08]), pv));
    this.valve('pulmonary', 8, pv, pvDir, 0.135, 3, pvDir);

    // ---- coronary arteries (on the epicardium, in their grooves)
    const acute = isch.stage === 'hyperacute' || isch.stage === 'stemi' || isch.stage === 'deWinter' || isch.stage === 'wellens';
    const showCulprit = isch.stage !== 'none' && isch.stage !== 'takotsubo' && isch.stage !== 'subendocardial';
    const cul = showCulprit ? CULPRIT[isch.territory] : undefined;
    const on = (art: string): { u: number; label: string } | null => (cul && cul.art === art ? { u: cul.u, label: cul.label } : null);
    const lad: V3[] = [];
    for (let k = 0; k <= 12; k++) {
      const z = -0.86 + (1.9 * k) / 12;
      lad.push(z < 0.97 ? lvPoint(A, z, RV_TH_MAX + 2, 1.05) : lvPoint(A, 0.99, RV_TH_MAX - 30, 1.05));
    }
    if (p.ischemia.territory === 'wrapLAD') lad.push(lvPoint(A, 0.9, -120, 1.05));
    const lm = vadd(ao, vscale(W, 0.2), vscale(SEPT, -0.12));
    this.artery('LAD', [lm, ...lad], 0.03, on('LAD'), acute);
    this.artery('D1', [lvPoint(A, -0.55, RV_TH_MAX + 2, 1.05), lvPoint(A, -0.3, 110, 1.05), lvPoint(A, 0.1, 140, 1.05)], 0.02, on('D1'), acute);
    this.artery('D2', [lvPoint(A, 0.0, RV_TH_MAX + 2, 1.05), lvPoint(A, 0.3, 115, 1.05)], 0.017, null, acute);
    const lcx: V3[] = [lm];
    for (let k = 0; k <= 10; k++) lcx.push(lvPoint(A, -0.8, RV_TH_MAX + 20 + (170 * k) / 10, 1.06));
    this.artery('LCx', lcx, 0.027, on('LCx'), acute);
    this.artery('OM1', [lvPoint(A, -0.8, 165, 1.06), lvPoint(A, -0.3, 175, 1.05), lvPoint(A, 0.25, 180, 1.05)], 0.019, null, acute);
    const rcaPts: V3[] = [vadd(ao, vscale(SEPT, 0.18), vscale(W, -0.04))];
    for (let k = 0; k <= 10; k++) rcaPts.push(rvPoint(A, -0.9, RV_TH_MAX - 10 - ((RV_TH_MAX - RV_TH_MIN) * k) / 10, 1.08));
    for (let k = 1; k <= 7; k++) rcaPts.push(lvPoint(A, -0.86 + (1.35 * k) / 7, RV_TH_MIN - 2, 1.05));
    this.artery('RCA', rcaPts, 0.03, on('RCA'), acute);
    this.artery('AM', [rvPoint(A, -0.9, 5, 1.08), rvPoint(A, -0.3, 0, 1.06), rvPoint(A, 0.2, -10, 1.06)], 0.017, null, acute);
    this.heart.add(this.coronaries);

    // ---- conduction system
    const SA: V3 = vadd(A.cRA, [0.08, -0.34, 0.12]);
    const his = lvPoint(A, -0.76, 8, 0.98);
    const AVN: V3 = vadd(his, [-0.12, -0.12, -0.04]);
    const split = lvPoint(A, -0.52, 0, 0.75);
    const er = A.lvEndoRf + 0.02;
    const lafEnd = lvPoint(A, 0.35, 100, er);
    const lpfEnd = lvPoint(A, 0.4, -100, er);
    const septEnd = lvPoint(A, 0.2, 0, er);
    const rbEnd = rvPoint(A, 0.3, 0, 0.6);
    const bundle = p.bundle;
    const rbBlk = bundle.startsWith('rbbb') || bundle === 'incompleteRbbb';
    const lbBlk = bundle === 'lbbb';
    const lafBlk = lbBlk || bundle === 'lafb' || bundle === 'rbbb+lafb';
    const lpfBlk = lbBlk || bundle === 'lpfb' || bundle === 'rbbb+lpfb';
    const nodeBlk = R.nodalBlock === 'complete' || !R.avnConducts;
    const sys = '#f5e6a1';
    const sa = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffe082', transparent: true }));
    sa.position.copy(T(SA));
    sa.renderOrder = 21;
    sa.name = 'SA';
    this.heart.add(sa);
    this.tube('internodal', [SA, vadd(A.cRA, [0.2, 0.0, 0.05]), AVN], 0.02, sys);
    this.tube('bachmann', [SA, vadd(A.cRA, [0.45, -0.3, -0.15]), vadd(A.cLA, [-0.1, -0.22, 0.05])], 0.02, sys);
    if (R.dualPathway) {
      this.tube('fast', [vadd(AVN, [-0.1, -0.12, 0.05]), vadd(AVN, [-0.03, -0.08, 0.04]), AVN], 0.03, '#66bb6a');
      this.tube('slow', [vadd(AVN, [-0.22, 0.06, -0.12]), vadd(AVN, [-0.1, 0.05, -0.06]), AVN], 0.03, '#42a5f5');
      this.label('fast', vadd(AVN, [-0.14, -0.16, 0.06]), 'small');
      this.label('slow', vadd(AVN, [-0.26, 0.1, -0.12]), 'small');
    }
    this.tube('avn', [vadd(AVN, [-0.06, -0.04, 0]), AVN, his], 0.045, sys, nodeBlk);
    this.tube('his', [his, vadd(his, vscale(AXIS, 0.12)), split], 0.035, sys, R.infranodal === 'complete');
    this.tube('lb', [split, lvPoint(A, -0.3, 0, er)], 0.03, sys, lbBlk);
    this.tube('laf', [split, lvPoint(A, -0.1, 55, er), lafEnd], 0.025, sys, lafBlk);
    this.tube('lpf', [split, lvPoint(A, 0.0, -55, er), lpfEnd], 0.025, sys, lpfBlk);
    this.tube('sept', [split, septEnd], 0.02, sys, lbBlk);
    this.tube('rb', [his, lvPoint(A, -0.45, 0, 1.08), lvPoint(A, 0.1, 0, 1.08), rbEnd], 0.028, sys, rbBlk);
    const rng = mulberry(7);
    const purk = (id: string, from: V3, z: number, th: number, lv: boolean, blocked: boolean): void => {
      for (let k = 0; k < 6; k++) {
        const zz = Math.max(-0.6, Math.min(lv ? 0.92 : RV_Z_APEX - 0.05, z + (rng() - 0.5) * 0.6));
        const tt = th + (rng() - 0.5) * 80;
        const end = lv ? lvPoint(A, zz, tt, er) : rvPoint(A, zz, tt, 0.6);
        this.tube(`${id}-p${k}`, [from, vscale(vadd(from, end), 0.5), end], 0.008, '#f3d98b', blocked);
      }
    };
    purk('laf', lafEnd, 0.35, 100, true, lafBlk);
    purk('lpf', lpfEnd, 0.4, -100, true, lpfBlk);
    purk('sept', septEnd, 0.3, 0, true, lbBlk);
    purk('rb', rbEnd, 0.3, 10, false, rbBlk);
    if (R.ap.present) {
      const d = AP_SITE[R.ap.location].pos as unknown as V3;
      const ring = this.ringPoint(d);
      const outv = vnorm(vsub(ring, vadd(A.cL, vscale(AXIS, -0.8 * A.lvLen))));
      this.tube('ap', [vadd(ring, vscale(AXIS, -0.2)), ring, vadd(ring, vscale(AXIS, 0.16))], 0.035, R.ap.antegrade ? '#ab47bc' : '#9e9e9e');
      this.label(R.ap.antegrade ? 'Accessory pathway' : 'AP (concealed)', vadd(ring, vscale(outv, 0.2)), 'ap');
    }
    if (R.pacer.mode !== 'none') {
      const rvApex = rvPoint(A, 0.45, 0, 0.45);
      this.tube('lead', [vadd(A.cRA, [0.1, -1.3, -0.02]), vadd(A.cRA, [0.1, -0.5, 0.0]), A.tvV, rvPoint(A, -0.2, 10, 0.5), rvApex], 0.018, '#90a4ae');
      this.label(`pacing lead (${R.pacer.mode})`, rvApex, 'small');
    }
    const focus = R.ventMechanism !== 'none' && !['vf', 'vflutter', 'asystole'].includes(R.ventMechanism) ? R.vtSite : R.pvc.pattern !== 'none' ? R.pvc.site : null;
    if (focus) {
      const fp = this.ventSurfacePoint(VENT_SITE[focus].pos as unknown as V3);
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), new THREE.MeshBasicMaterial({ color: '#e53935', depthTest: false }));
      m.position.copy(T(fp));
      m.renderOrder = 25;
      this.heart.add(m);
      this.label(`focus: ${VENT_SITE[focus].label}`, fp, 'focus');
    }
    for (let k = 0; k < 4; k++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false }));
      d.renderOrder = 26;
      d.visible = false;
      this.heart.add(d);
      this.dots.push(d);
    }
    this.heart.add(this.pickMarker);

    // ---- labels
    this.label('RA', vadd(A.cRA, [-0.42, 0.05, 0.05]));
    this.label('LA', vadd(A.cLA, [0.05, -0.3, -0.2]));
    this.label('RV', rvPoint(A, -0.1, 30, 1.15));
    this.label('LV', lvPoint(A, 0.25, 185, 1.15));
    this.label('Ao', vadd(ao, [-0.05, -0.95, 0.12]), 'small');
    this.label('PA', vadd(pv, [0.12, -0.3, 0.05]), 'small');
    this.label('SA node', vadd(SA, [-0.15, -0.12, 0]), 'sys');
    this.label('AV node', vadd(AVN, [-0.2, 0, 0.05]), 'sys');
    this.label('His', vadd(his, [0.08, -0.08, 0]), 'sys small');
    this.label(rbBlk ? '✕ RB' : 'RB', lvPoint(A, 0.1, 0, 1.2), `sys small ${rbBlk ? 'blk' : ''}`);
    this.label(lafBlk ? '✕ LAF' : 'LAF', lvPoint(A, 0.0, 70, 0.9), `sys small ${lafBlk ? 'blk' : ''}`);
    this.label(lpfBlk ? '✕ LPF' : 'LPF', lvPoint(A, 0.1, -70, 0.9), `sys small ${lpfBlk ? 'blk' : ''}`);
    this.label('LAD', lvPoint(A, -0.1, RV_TH_MAX + 6, 1.18), 'cor small');
    this.label('LCx', lvPoint(A, -0.8, 170, 1.2), 'cor small');
    this.label('RCA', rvPoint(A, -0.9, 20, 1.22), 'cor small');

    // Mirror-image heart in dextrocardia; centre the heart on the vector origin.
    this.heart.scale.set(p.dextrocardia ? -1 : 1, 1, 1);
    const c = T(A.center);
    this.heart.position.set(p.dextrocardia ? c.x : -c.x, -c.y, -c.z);
    void lvEpi;
    this.buildAxes();
    this.applyMaterials();
  }

  /** Point on the AV ring (base of the ventricles) in the direction of `dir`. */
  private ringPoint(dir: V3): V3 {
    const A = this.A!;
    const perp = vnorm(vsub(dir, vscale(AXIS, vdot(dir, AXIS))));
    const th = (Math.atan2(vdot(perp, W), vdot(perp, SEPT)) * 180) / Math.PI;
    const inRv = th > RV_TH_MIN + 10 && th < RV_TH_MAX - 10 && vdot(dir, SEPT) > 0.3;
    return inRv ? rvPoint(A, -0.86, th, 0.95) : lvPoint(A, -0.8, th, 1.0);
  }

  private ventSurfacePoint(dir: V3): V3 {
    const A = this.A!;
    const target = vadd(A.center, vscale(dir, 1.2));
    let best: V3 = A.cL;
    let bd = Infinity;
    for (const s of this.shells) {
      if (s.side === 'A' || s.endo === 1) continue;
      for (const p of s.pos) {
        const d = (p[0] - target[0]) ** 2 + (p[1] - target[1]) ** 2 + (p[2] - target[2]) ** 2;
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
    }
    return best;
  }

  private buildAxes(): void {
    for (const o of [...this.axisGroup.children]) {
      this.axisGroup.remove(o);
      if (o instanceof CSS2DObject) o.element.remove();
      const m = o as THREE.Line;
      m.geometry?.dispose?.();
      (m.material as THREE.Material | undefined)?.dispose?.();
    }
    const add = (id: LeadId, strong: boolean): void => {
      const a = T(LEADS[id].axis).normalize();
      const g = new THREE.BufferGeometry().setFromPoints([a.clone().multiplyScalar(-2.1), a.clone().multiplyScalar(2.1)]);
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: strong ? 0x2e7d32 : 0x8a8a8a, transparent: true, opacity: strong ? 0.95 : 0.35, depthTest: false }));
      line.renderOrder = 28;
      this.axisGroup.add(line);
      const lab = new CSS2DObject(h('span', { class: `h3d-lab lead ${strong ? 'strong' : ''}` }, `${id} +`));
      lab.position.copy(a.clone().multiplyScalar(2.25));
      this.axisGroup.add(lab);
    };
    if (this.show.allLeads) for (const id of TWELVE) if (id !== this.lead) add(id, false);
    add(this.lead, true);
  }

  private applyMaterials(): void {
    const cut = this.wallMode === 'cut';
    const glass = this.wallMode === 'glass';
    for (const s of this.shells) {
      const m = s.mesh.material as THREE.MeshStandardMaterial;
      m.clippingPlanes = cut ? [this.clip] : [];
      m.transparent = glass;
      m.opacity = glass ? (s.endo === 1 ? 0.5 : 0.3) : 1;
      m.depthWrite = !glass;
      m.needsUpdate = true;
      if (s.endo === 1) s.mesh.visible = this.wallMode !== 'solid';
    }
    this.heart.traverse((o) => {
      if (o.name === 'vessel') {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
        m.clippingPlanes = cut ? [this.clip] : [];
        m.transparent = glass;
        m.opacity = glass ? 0.22 : 1;
        m.depthWrite = !glass;
        m.needsUpdate = true;
      }
    });
    for (const tr of this.tracts) {
      tr.mesh.visible = this.show.system;
      tr.mat.depthTest = !this.show.system;
      tr.mat.needsUpdate = true;
    }
    const sa = this.heart.getObjectByName('SA');
    if (sa) sa.visible = this.show.system;
    for (const v of this.valves) {
      v.ring.visible = this.show.valves;
      for (const l of v.leaflets) l.pivot.visible = this.show.valves;
    }
    this.coronaries.visible = this.show.coronary;
    for (const l of this.labels) {
      const isCor = l.element.classList.contains('cor') || l.parent === this.coronaries;
      l.visible = this.show.labels && (!isCor || this.show.coronary);
    }
    this.axisGroup.visible = this.show.axis;
    this.buildAxes();
  }

  // ------------------------------------------------------------------ timing
  private beats(): BeatInfo[] {
    return this.run!.sig.beats;
  }

  private beatAt(t: number): number {
    const beats = this.beats();
    let bi = -1;
    for (let i = 0; i < beats.length; i++) if (beats[i].ev.t <= t + 0.001) bi = i;
    return bi;
  }

  private beatTimes(bi: number): { act: Float32Array[]; rep: Float32Array[]; maxAct: number } {
    const hit = this.beatCache.get(bi);
    if (hit) return hit;
    const run = this.run!;
    const A = this.A!;
    const b = this.beats()[bi];
    const p = run.physio;
    const ev = b.ev;
    type Src = { pos: V3; t: number; side: 'L' | 'R' | 'both'; fast: boolean };
    const src: Src[] = [];
    const er = A.lvEndoRf;
    const hisSources = (t0: number): void => {
      let bundle = p.bundle as string;
      if (ev.aberrant === 'rbbb' && !bundle.startsWith('rbbb')) bundle = bundle === 'lafb' ? 'rbbb+lafb' : bundle === 'lpfb' ? 'rbbb+lpfb' : bundle === 'lbbb' ? 'lbbb' : 'rbbb';
      const rb = !bundle.startsWith('rbbb');
      const lb = bundle !== 'lbbb';
      const laf = lb && bundle !== 'lafb' && bundle !== 'rbbb+lafb';
      const lpf = lb && bundle !== 'lpfb' && bundle !== 'rbbb+lpfb';
      const incomplete = bundle === 'incompleteRbbb';
      if (lb) src.push({ pos: lvPoint(A, -0.2, 0, er), t: t0, side: 'L', fast: true });
      if (laf) src.push({ pos: lvPoint(A, 0.35, 100, er), t: t0 + 6, side: 'L', fast: true });
      if (lpf) src.push({ pos: lvPoint(A, 0.4, -100, er), t: t0 + 6, side: 'L', fast: true });
      if (!laf && lb) src.push({ pos: lvPoint(A, 0.3, 100, er), t: t0 + 26, side: 'L', fast: false });
      if (!lpf && lb) src.push({ pos: lvPoint(A, 0.4, -100, er), t: t0 + 26, side: 'L', fast: false });
      if (rb) src.push({ pos: rvPoint(A, 0.3, 0, 0.5), t: t0 + (incomplete ? 26 : 8), side: 'R', fast: true });
      if (rb) src.push({ pos: lvPoint(A, -0.3, 0, 1.0), t: t0 + (incomplete ? 22 : 6), side: 'R', fast: true });
      // A side without its bundle is reached by slow cell-to-cell spread through the septum.
      if (!rb) src.push({ pos: lvPoint(A, 0.0, 0, 1.0), t: t0 + 24, side: 'R', fast: false });
      if (!lb) {
        src.push({ pos: lvPoint(A, -0.1, 0, er + 0.04), t: t0 + 16, side: 'L', fast: false });
        src.push({ pos: lvPoint(A, -0.1, 0, 1.0), t: t0 + 12, side: 'L', fast: false });
      }
    };
    if (ev.route === 'his') hisSources(0);
    else if (ev.route === 'ap') {
      const d = AP_SITE[ev.apLocation ?? p.rhythm.ap.location].pos as unknown as V3;
      src.push({ pos: this.ventSurfacePoint(d), t: 0, side: 'both', fast: false });
      if (Number.isFinite(ev.hisDelay)) hisSources(ev.hisDelay);
    } else {
      const site = ev.route === 'paced' ? 'rvApex' : (ev.site ?? 'rvApex');
      if (site === 'fascicularPosterior') src.push({ pos: lvPoint(A, 0.4, -100, er), t: 0, side: 'L', fast: true }, { pos: lvPoint(A, 0.0, 0, 1.0), t: 22, side: 'R', fast: false });
      else if (site === 'fascicularAnterior') src.push({ pos: lvPoint(A, 0.35, 100, er), t: 0, side: 'L', fast: true }, { pos: lvPoint(A, 0.0, 0, 1.0), t: 22, side: 'R', fast: false });
      else src.push({ pos: this.ventSurfacePoint(VENT_SITE[site].pos as unknown as V3), t: 0, side: 'both', fast: false });
      if (Number.isFinite(ev.hisDelay) && ev.hisDelay < 70) hisSources(ev.hisDelay);
    }
    const vFast = 0.042;
    const vSlow = 0.011;
    const act: Float32Array[] = [];
    let maxT = 1;
    for (const s of this.shells) {
      const arr = new Float32Array(s.pos.length);
      if (s.side === 'A') {
        arr.fill(NaN);
        act.push(arr);
        continue;
      }
      for (let i = 0; i < s.pos.length; i++) {
        const v = s.pos[i];
        if (s.scar[i]) {
          arr[i] = NaN;
          continue;
        }
        let best = Infinity;
        for (const q of src) {
          if (q.side !== 'both' && q.side !== s.side) continue;
          const d = Math.hypot(v[0] - q.pos[0], v[1] - q.pos[1], v[2] - q.pos[2]);
          const tt = q.t + d / (q.fast ? vFast : vSlow) + (1 - s.endo) * (q.fast ? 16 : 6);
          if (tt < best) best = tt;
        }
        arr[i] = best;
        if (best > maxT && Number.isFinite(best)) maxT = best;
      }
      act.push(arr);
    }
    const scale = (b.morph.qrsDur * 0.95) / maxT;
    const tComp = b.morph.comps.find((c) => c.tag === 'T wave');
    const td: V3 | null = tComp ? vnorm(tComp.dir as unknown as V3) : null;
    const rep: Float32Array[] = [];
    let maxAct = 0;
    this.shells.forEach((s, si) => {
      const a = act[si];
      const r = new Float32Array(s.pos.length);
      for (let i = 0; i < s.pos.length; i++) {
        if (!Number.isFinite(a[i])) {
          r[i] = NaN;
          continue;
        }
        a[i] *= scale;
        if (a[i] > maxAct) maxAct = a[i];
        // Repolarisation: regions the T vector points toward repolarise first (epicardium before endocardium).
        const dirv = vnorm(vsub(s.pos[i], A.center));
        let f = 0.5 + 0.2 * (s.endo - 0.5);
        if (td) f -= 0.38 * vdot(dirv, td);
        f = Math.max(0.04, Math.min(0.96, f));
        // Cells finish repolarising between the T-wave peak (earliest: epicardium of the regions the
        // T vector points to) and the end of the T wave (latest) — the spread is the dispersion of
        // repolarisation that the T wave records.
        r[i] = b.morph.tStart + (b.morph.tEnd - b.morph.tStart) * (0.45 + 0.55 * f);
      }
      rep.push(r);
    });
    const out = { act, rep, maxAct };
    this.beatCache.set(bi, out);
    return out;
  }

  private atrialTimes(ai: number): Float32Array[] {
    const hit = this.atrialCache.get(ai);
    if (hit) return hit;
    const run = this.run!;
    const A = this.A!;
    const a = run.sim.atrial[ai];
    const siteOf = (s: AtrialSite): V3 => {
      switch (s) {
        case 'lowRA':
          return vadd(A.cRA, [0.15, 0.3, -0.1]);
        case 'leftAtrial':
          return vadd(A.cLA, [0.1, -0.2, 0.05]);
        case 'lowLA':
          return vadd(A.cLA, [0.0, 0.25, 0.0]);
        case 'retroSeptal':
        case 'retroPosteroseptal':
          return vadd(A.cRA, [0.35, 0.28, -0.12]);
        case 'retroLeftLateral':
          return vadd(A.cLA, [0.4, 0.1, -0.05]);
        case 'retroRightFree':
          return vadd(A.cRA, [-0.36, 0.05, 0]);
        default:
          return vadd(A.cRA, [0.08, -0.34, 0.12]);
      }
    };
    const o = siteOf(a.site);
    const pDur = buildP(run.physio, a.site).pDur;
    const out: Float32Array[] = [];
    let maxT = 1;
    for (const s of this.shells) {
      const arr = new Float32Array(s.pos.length).fill(NaN);
      if (s.side === 'A') {
        for (let i = 0; i < s.pos.length; i++) {
          const v = s.pos[i];
          arr[i] = Math.hypot(v[0] - o[0], v[1] - o[1], v[2] - o[2]);
          if (arr[i] > maxT) maxT = arr[i];
        }
      }
      out.push(arr);
    }
    const k = pDur / maxT;
    for (const arr of out) for (let i = 0; i < arr.length; i++) if (Number.isFinite(arr[i])) arr[i] *= k;
    this.atrialCache.set(ai, out);
    return out;
  }

  /** Activation / repolarisation (absolute ms) of a vertex for the beat in progress at time t. */
  private vertexTimes(si: number, i: number, t: number): { act: number; rep: number; atrial: boolean } | null {
    const run = this.run!;
    const s = this.shells[si];
    if (s.side === 'A') {
      const at = run.sim.atrial;
      let ai = -1;
      for (let k = 0; k < at.length; k++) if (at[k].kind !== 'flutter' && at[k].t <= t) ai = k;
      if (ai < 0) return null;
      const a = at[ai].t + this.atrialTimes(ai)[si][i];
      const apd = this.atrialApd();
      return { act: a, rep: a + apd, atrial: true };
    }
    const bi = this.beatAt(t);
    if (bi < 0) return null;
    const beats = this.beats();
    const cur = this.beatTimes(bi);
    const a = beats[bi].ev.t + cur.act[si][i];
    if (!Number.isFinite(a)) return null;
    if (t >= a || bi === 0) return { act: a, rep: beats[bi].ev.t + cur.rep[si][i], atrial: false };
    const prv = this.beatTimes(bi - 1);
    const ap = beats[bi - 1].ev.t + prv.act[si][i];
    return Number.isFinite(ap) ? { act: ap, rep: beats[bi - 1].ev.t + prv.rep[si][i], atrial: false } : { act: a, rep: beats[bi].ev.t + cur.rep[si][i], atrial: false };
  }

  private atrialApd(): number {
    const p = this.run!.physio;
    // Atrial APD ≈ 150–250 ms; shorter with vagal tone and at fast rates.
    return Math.max(110, 200 - 40 * Math.max(0, -p.autonomic) - 20 * Math.max(0, p.autonomic));
  }

  // ------------------------------------------------------------------ mechanics
  /** Regional contraction from local activation; valves and volumes from the haemodynamic model. */
  private deform(): void {
    const run = this.run!;
    const hm = this.hemo;
    const A = this.A!;
    const t = this.t;
    if (t === this.lastMotionT && this.show.motion) return;
    this.lastMotionT = t;
    const motion = this.show.motion && !!hm;
    const idx = (tt: number): number => (hm ? Math.max(0, Math.min(hm.n - 1, Math.round(tt - hm.from))) : 0);
    const vf = run.sim.continuous.some((c) => (c.kind === 'vf' || c.kind === 'vflutter') && t >= c.t0 && t <= c.t1);
    const isch = run.physio.ischemia;
    const tdir = territoryVector(isch.territory) as unknown as V3;
    const acuteIsch = ['hyperacute', 'stemi', 'deWinter'].includes(isch.stage);
    const aneurysm = isch.stage === 'aneurysm';
    const tako = isch.stage === 'takotsubo';
    const bi = this.beatAt(t);
    const timesNow = bi >= 0 ? this.beatTimes(bi) : null;
    // Beat-specific contraction amplitude from the model's ejection fraction.
    let ampBeat = 1;
    if (hm) {
      const b = hm.beats.filter((x) => x.t <= t + 1).pop();
      if (b) ampBeat = Math.max(0, Math.min(1.25, (b.ejected ? b.ef : 0) / 58));
    }
    const lvP = hm ? hm.lvP[idx(t)] : 0;
    for (let si = 0; si < this.shells.length; si++) {
      const s = this.shells[si];
      const posAttr = s.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      if (!motion) {
        arr.set(s.rest);
        posAttr.needsUpdate = true;
        s.mesh.geometry.computeVertexNormals();
        s.mesh.geometry.computeBoundingSphere();
        continue;
      }
      const isAtrium = s.side === 'A';
      const centre = isAtrium ? (s.chamber === 'RA' ? A.cRA : A.cLA) : null;
      const meanAct = timesNow ? 0.5 * timesNow.maxAct : 40;
      for (let i = 0; i < s.pos.length; i++) {
        const p0 = s.pos[i];
        let q: V3;
        if (isAtrium) {
          const e = s.chamber === 'RA' ? hm!.eRa[idx(t)] : hm!.eLa[idx(t)];
          // Atria shrink when they contract and are stretched (expand) as the AV plane descends in ventricular systole.
          const ev = (s.chamber === 'RA' ? hm!.eRv[idx(t)] : hm!.eLv[idx(t)]) * ampBeat;
          const k = 1 - 0.13 * e + 0.05 * ev;
          q = vadd(centre!, vscale(vsub(p0, centre!), k));
        } else {
          // Local contraction state: the chamber's activation curve shifted by this region's own
          // activation delay — early-activated regions shorten first (e.g. the septal "flash" in LBBB).
          const curve = s.chamber === 'LV' ? hm!.eLv : hm!.eRv;
          const a = timesNow ? timesNow.act[si][i] : NaN;
          const local = curve[idx(t - (Number.isFinite(a) ? a - meanAct : 0))];
          let e: number;
          if (s.scar[i]) e = aneurysm ? -0.35 * Math.min(1, lvP / 110) : 0; // aneurysm bulges outward in systole (dyskinesis)
          else {
            let amp = ampBeat;
            if (acuteIsch && vdot(vnorm(vsub(p0, A.center)), tdir) > 0.6) amp *= 0.2; // ischaemic hypokinesis
            if (tako && s.chamber === 'LV') amp *= s.lz[i] > 0.15 ? 0.05 : 1.3; // apical ballooning, hyperkinetic base
            e = local * amp;
          }
          // Radial shortening toward the LV long axis (more at the endocardium = wall thickening) and
          // longitudinal shortening (the base descends toward the apex).
          const axisPt = vadd(A.cL, vscale(AXIS, s.lz[i] * A.lvLen));
          const radial = vsub(p0, axisPt);
          const kr = s.chamber === 'LV' ? (s.endo > 0.5 ? 0.22 : 0.09) : 0.17;
          const kl = 0.11 * (1 - s.lz[i]) * 0.5 * A.lvLen;
          q = vadd(axisPt, vscale(radial, 1 - kr * e), vscale(AXIS, kl * e));
        }
        if (vf && !isAtrium) {
          const w = 0.012 * Math.sin(0.05 * t + 9 * p0[0]) * Math.sin(0.043 * t + 7 * p0[1] + 1);
          q = vadd(q, vscale(vnorm(vsub(p0, A.center)), w));
        }
        arr[i * 3] = q[0];
        arr[i * 3 + 1] = -q[1];
        arr[i * 3 + 2] = q[2];
      }
      posAttr.needsUpdate = true;
      s.mesh.geometry.computeVertexNormals();
      s.mesh.geometry.computeBoundingSphere();
    }
  }

  private updateValves(): void {
    const hm = this.hemo;
    for (const v of this.valves) {
      let target = 0;
      if (hm) {
        const i = Math.max(0, Math.min(hm.n - 1, Math.round(this.t - hm.from)));
        const open = (hm.valves[i] & v.bit) !== 0;
        const q = v.id === 'mitral' ? hm.qMv[i] : v.id === 'tricuspid' ? hm.qTv[i] : v.id === 'aortic' ? hm.qAv[i] : hm.qPv[i];
        const ref = v.id === 'aortic' || v.id === 'pulmonary' ? 250 : 180;
        target = open ? Math.min(1, 0.45 + q / ref) : 0;
      }
      v.open = target;
      const ang = (v.id === 'aortic' || v.id === 'pulmonary' ? 1.25 : 1.1) * v.open;
      for (const l of v.leaflets) l.pivot.setRotationFromAxisAngle(l.axis, l.sign * ang);
      (v.ring.material as THREE.MeshStandardMaterial).color.set(v.open > 0.05 ? '#c8e6c9' : '#f5efe6');
    }
  }

  // ------------------------------------------------------------------ colouring
  private colour(): void {
    const run = this.run!;
    const t = this.t;
    const beats = this.beats();
    const bi = this.beatAt(t);
    const cur = bi >= 0 ? this.beatTimes(bi) : null;
    const prv = bi >= 1 ? this.beatTimes(bi - 1) : null;
    const cont = run.sim.continuous.filter((c) => t >= c.t0 && t <= c.t1);
    const atrialCont = cont.find((c) => c.kind === 'flutter' || c.kind === 'fib');
    const ventCont = cont.find((c) => c.kind === 'vf' || c.kind === 'vflutter');
    let ai = -1;
    const at = run.sim.atrial;
    for (let i = 0; i < at.length; i++) if (at[i].kind !== 'flutter' && at[i].t <= t) ai = i;
    const aCur = ai >= 0 && t - at[ai].t < 900 ? this.atrialTimes(ai) : null;
    const isch = run.physio.ischemia;
    const tdir = territoryVector(isch.territory) as unknown as V3;
    const injured = isch.stage !== 'none' && isch.stage !== 'old';
    const A = this.A!;
    const mode = this.colourMode;
    const leadAx = vnorm(LEADS[this.lead].axis as unknown as V3);
    const aApd = this.atrialApd();
    this.shells.forEach((s, si) => {
      const col = s.colors;
      for (let i = 0; i < s.pos.length; i++) {
        const v = s.pos[i];
        const outward = vnorm(vsub(v, A.center));
        if (mode === 'coronary') {
          tmp.copy(s.scar[i] ? C.scar : CORC[s.cor[i]]);
          if (s.side !== 'A' && s.seg[i] && (s.seg[i] % 2 === 0) !== (s.seg[i] > 12)) tmp.multiplyScalar(0.88);
        } else if (mode === 'lead') {
          if (s.side === 'A') tmp.copy(C.atrium);
          else {
            const f = vdot(outward, leadAx);
            if (f > 0.35) tmp.copy(C.neutral).lerp(C.facing, Math.min(1, (f - 0.35) / 0.45));
            else if (f < -0.35) tmp.copy(C.neutral).lerp(C.away, Math.min(1, (-f - 0.35) / 0.45));
            else tmp.copy(C.neutral);
          }
        } else if (s.side === 'A') {
          if (atrialCont) {
            if (atrialCont.kind === 'flutter') {
              const cl = atrialCont.cl ?? 200;
              const cRA = A.cRA;
              const ang = Math.atan2(vdot(vsub(v, cRA), W), vdot(vsub(v, cRA), SEPT));
              const ph = ((((t - atrialCont.t0) / cl - ((atrialCont.reverse ? -1 : 1) * ang) / (2 * Math.PI)) % 1) + 1) % 1;
              if (mode === 'voltage') voltageColor(tmp, apState(ph * cl, cl * 0.7, 'atrial').mv);
              else if (mode === 'refractory') tmp.copy(ph < 0.55 ? C.arp : ph < 0.7 ? C.rrp : C.excitable);
              else if (ph < 0.08) tmp.copy(C.front);
              else if (ph < 0.55) tmp.copy(C.depol);
              else if (ph < 0.7) tmp.copy(C.repol);
              else tmp.copy(C.rest);
            } else {
              const q = Math.sin(0.045 * t + 7 * v[0]) + Math.sin(0.052 * t + 6 * v[1] + 1) + Math.sin(0.061 * t + 8 * v[2] + 2);
              if (mode === 'voltage') voltageColor(tmp, -80 + 55 * Math.max(0, (q + 0.5) / 3.5));
              else if (mode === 'refractory') tmp.copy(q > 0.9 ? C.arp : q > 0.2 ? C.rrp : C.excitable);
              else if (q > 2.1) tmp.copy(C.front);
              else if (q > 0.9) tmp.copy(C.depol);
              else tmp.copy(C.rest);
            }
          } else if (aCur && Number.isFinite(aCur[si][i])) {
            const ta = at[ai].t + aCur[si][i];
            if (mode === 'voltage') voltageColor(tmp, apState(t - ta, aApd, 'atrial').mv);
            else if (mode === 'refractory') this.refColor(apState(t - ta, aApd, 'atrial'));
            else if (mode === 'isochrone') isoColor(tmp, aCur[si][i], 100);
            else stateColor(tmp, t, ta, ta + aApd);
          } else if (mode === 'voltage') voltageColor(tmp, -80);
          else if (mode === 'refractory') tmp.copy(C.excitable);
          else tmp.copy(C.rest);
        } else if (ventCont) {
          const q = Math.sin(0.04 * t + 6 * v[0]) + Math.sin(0.047 * t + 5 * v[1] + 1) + Math.sin(0.055 * t + 7 * v[2] + 2);
          if (mode === 'voltage') voltageColor(tmp, -85 + 100 * Math.max(0, (q + 0.6) / 3.6));
          else if (mode === 'refractory') tmp.copy(q > 0.8 ? C.arp : q > 0.1 ? C.rrp : C.excitable);
          else if (q > 2.0) tmp.copy(C.front);
          else if (q > 0.8) tmp.copy(C.depol);
          else tmp.copy(C.rest);
        } else {
          const aC = cur ? cur.act[si][i] : NaN;
          const isScar = !!s.scar[i];
          if (isScar) tmp.copy(C.scar);
          else if (mode === 'isochrone') {
            if (cur && Number.isFinite(aC)) isoColor(tmp, aC, cur.maxAct);
            else tmp.copy(C.rest);
          } else {
            const vt = this.vertexTimes(si, i, t);
            const kind: ApKind = s.endo > 0.6 ? 'ventEndo' : 'ventEpi';
            if (mode === 'voltage') voltageColor(tmp, vt ? apState(t - vt.act, vt.rep - vt.act, kind).mv : -86);
            else if (mode === 'refractory') {
              if (vt) this.refColor(apState(t - vt.act, vt.rep - vt.act, kind));
              else tmp.copy(C.excitable);
            } else if (cur && t >= beats[bi].ev.t + aC) stateColor(tmp, t, beats[bi].ev.t + aC, beats[bi].ev.t + cur.rep[si][i]);
            else if (prv && Number.isFinite(prv.act[si][i])) stateColor(tmp, t, beats[bi - 1].ev.t + prv.act[si][i], beats[bi - 1].ev.t + prv.rep[si][i]);
            else tmp.copy(C.rest);
          }
          if (injured && !isScar && mode === 'state') {
            const inj = isch.territory === 'diffuseSubendo' || isch.stage === 'subendocardial' ? s.endo > 0.9 : vdot(outward, tdir) > 0.6;
            if (inj) tmp.lerp(C.injury, 0.4);
          }
        }
        col[i * 3] = tmp.r;
        col[i * 3 + 1] = tmp.g;
        col[i * 3 + 2] = tmp.b;
      }
      (s.mesh.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    });
  }

  private refColor(st: ApState): void {
    tmp.copy(st.refractory === 'absolute' ? C.arp : st.refractory === 'relative' ? C.rrp : C.excitable);
  }

  private updateLegend(): void {
    const item = (c: THREE.Color | string, text: string): HTMLElement => h('span', { class: 'h3d-leg' }, h('i', { style: `background:${typeof c === 'string' ? c : `#${c.getHexString()}`}` }), text);
    const m = this.colourMode;
    let items: HTMLElement[];
    if (m === 'voltage') items = [h('span', { class: 'h3d-leg' }, h('i', { class: 'grad volt' }), 'membrane potential −90 mV (blue, resting) → +30 mV (red, upstroke)'), item(C.scar, 'scar')];
    else if (m === 'isochrone') {
      const mx = this.run && this.beatAt(this.t) >= 0 ? Math.round(this.beatTimes(this.beatAt(this.t)).maxAct) : 0;
      items = [h('span', { class: 'h3d-leg' }, h('i', { class: 'grad iso' }), `activation time in this beat: earliest (red) → latest (violet, ${mx} ms); dark bands every 10 ms are isochrones`), item(C.scar, 'scar (not activated)')];
    } else if (m === 'refractory') items = [item(C.arp, 'absolutely refractory (no stimulus can excite)'), item(C.rrp, 'relatively refractory — the vulnerable period (T wave): a premature stimulus here can start re-entry (R-on-T)'), item(C.excitable, 'excitable')];
    else if (m === 'coronary') items = [item(C.lad, 'LAD'), item(C.lcx, 'LCx'), item(C.rca, 'RCA (right-dominant circulation; supply varies between people)'), item(C.scar, 'scar'), h('span', { class: 'h3d-leg' }, 'click a segment for its AHA number')];
    else if (m === 'lead') items = [item(C.facing, `myocardium facing ${this.lead}’s positive pole — activation spreading toward it writes an upward deflection; injury here raises the ST segment in ${this.lead}`), item(C.away, `facing away (seen “in the mirror”: reciprocal changes in ${this.lead})`), h('span', { class: 'h3d-leg' }, `${this.lead}: ${LEADS[this.lead].views}`)];
    else items = [item(C.rest, 'resting (phase 4)'), item(C.front, 'wavefront'), item(C.depol, 'depolarised (plateau)'), item(C.repol, 'repolarising'), item(C.scar, 'scar'), item(C.injury, 'ischaemic / injured')];
    this.legend.replaceChildren(...items);
  }

  // ------------------------------------------------------------------ conduction-system animation
  private updateTracts(): void {
    const run = this.run!;
    const t = this.t;
    const R = run.physio.rhythm;
    const hv = R.hv;
    const on = new Map<string, number>();
    const bad = new Set<string>();
    for (const a of run.sim.atrial) {
      if (t >= a.t && t < a.t + 70 && (a.site === 'sinus' || a.site === 'highRA' || a.site === 'crista')) {
        on.set('internodal', (t - a.t) / 70);
        on.set('bachmann', (t - a.t) / 70);
      }
    }
    for (const sg of run.sim.ladder) {
      const lo = Math.min(sg.t0, sg.t1);
      const hi = Math.max(sg.t0, sg.t1);
      if (t < lo || t > hi + (sg.blocked ? 150 : 0)) continue;
      const u = sg.dir === 'ante' ? (t - sg.t0) / Math.max(1, sg.t1 - sg.t0) : 1 - (t - sg.t1) / Math.max(1, sg.t0 - sg.t1);
      const id = sg.row === 'AP' ? 'ap' : sg.path.includes('fast') && R.dualPathway ? 'fast' : sg.path.includes('slow') && R.dualPathway ? 'slow' : 'avn';
      const infra = sg.blocked && run.sim.log.some((l) => l.kind === 'block' && l.node === 'HIS' && l.t >= lo - 20 && l.t <= hi + 60);
      if (sg.blocked && infra) on.set(id, 1);
      else if (sg.blocked && t > hi) bad.add(id);
      else on.set(id, Math.max(0, Math.min(1, u)));
      if (id === 'fast' || id === 'slow') on.set('avn', Math.max(0, Math.min(1, u)));
    }
    for (const lg of run.sim.log) if (lg.kind === 'block' && lg.node === 'HIS' && t >= lg.t && t < lg.t + 200) bad.add('his');
    for (const b of run.sim.ventricular) {
      if (b.route !== 'his' && !(Number.isFinite(b.hisDelay) && b.hisDelay < 100)) continue;
      const t0 = b.route === 'his' ? b.t : b.t + b.hisDelay;
      if (t >= t0 - hv && t < t0 - hv * 0.4) on.set('his', (t - (t0 - hv)) / (hv * 0.6));
      if (t >= t0 - hv * 0.5 && t < t0 + 6) for (const id of ['lb', 'laf', 'lpf', 'sept', 'rb']) on.set(id, (t - (t0 - hv * 0.5)) / (hv * 0.5 + 6));
      if (t >= t0 - 6 && t < t0 + 22) for (const id of ['laf', 'lpf', 'sept', 'rb']) for (let k = 0; k < 6; k++) on.set(`${id}-p${k}`, (t - (t0 - 6)) / 28);
    }
    for (const s of run.sim.spikes) if (s.chamber === 'V' && t >= s.t && t < s.t + 40) on.set('lead', 1);
    let di = 0;
    for (const tr of this.tracts) {
      const u = on.get(tr.id);
      const active = u !== undefined && !tr.blocked;
      if (bad.has(tr.id)) tr.mat.color.set('#ff1744');
      else if (active) tr.mat.color.set('#ffffff');
      else tr.mat.color.copy(tr.base);
      tr.mat.opacity = active || bad.has(tr.id) ? 1 : 0.85;
      if (active && !tr.id.includes('-p') && tr.id !== 'bachmann' && di < this.dots.length && this.show.system) {
        const d = this.dots[di++];
        d.visible = true;
        d.position.copy(tr.curve.getPointAt(Math.max(0, Math.min(1, u!))));
      }
    }
    for (; di < this.dots.length; di++) this.dots[di].visible = false;
    const sa = this.heart.getObjectByName('SA') as THREE.Mesh | undefined;
    if (sa) {
      const fired = run.sim.log.some((l) => l.node === 'SA' && l.kind === 'fire' && t >= l.t && t < l.t + 50);
      (sa.material as THREE.MeshBasicMaterial).color.set(fired ? '#ffffff' : '#ffe082');
      sa.scale.setScalar(fired ? 1.6 : 1);
    }
  }

  private updateOverlay(): void {
    const run = this.run;
    if (!run) return;
    const sig = run.sig;
    const i = Math.max(0, Math.min(sig.n - 1, Math.round(((this.t - sig.from) * sig.fs) / 1000)));
    const v = new THREE.Vector3(sig.vcg[0][i], -sig.vcg[1][i], sig.vcg[2][i]);
    const mag = v.length();
    const S = 1.25;
    this.arrow.visible = this.show.vector && mag > 0.015;
    if (this.arrow.visible) {
      const L = Math.max(0.25, mag * S);
      const shaftL = Math.max(0.03, L - 0.2);
      this.arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize());
      this.shaft.scale.set(1, shaftL, 1);
      this.shaft.position.set(0, shaftL / 2, 0);
      const halo = this.arrow.getObjectByName('halo')!;
      halo.scale.set(1, shaftL, 1);
      halo.position.set(0, shaftL / 2, 0);
      this.head.position.set(0, shaftL + 0.11, 0);
    }
    const from = Math.max(0, i - 400);
    let start = from;
    for (let k = i; k > from; k--) {
      const m = Math.hypot(sig.vcg[0][k], sig.vcg[1][k], sig.vcg[2][k]);
      if (m < 0.012) {
        start = k;
        break;
      }
    }
    const pts: THREE.Vector3[] = [];
    for (let k = start; k <= i; k += 2) pts.push(new THREE.Vector3(sig.vcg[0][k] * S, -sig.vcg[1][k] * S, sig.vcg[2][k] * S));
    this.loop.geometry.dispose();
    this.loop.geometry = new THREE.BufferGeometry().setFromPoints(pts.length > 1 ? pts : [new THREE.Vector3(), new THREE.Vector3()]);
    this.loop.visible = this.show.vector;
    const ax = T(LEADS[this.lead].axis).normalize();
    const pr = v.dot(ax);
    const len = Math.abs(pr) * S;
    this.proj.visible = this.show.axis && len > 0.01;
    if (this.proj.visible) {
      this.proj.scale.set(1, len, 1);
      this.proj.position.copy(ax.clone().multiplyScalar((pr * S) / 2));
      this.proj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ax.clone().multiplyScalar(Math.sign(pr) || 1));
      (this.proj.material as THREE.MeshBasicMaterial).color.set(pr >= 0 ? '#2e7d32' : '#c62828');
    }
    const val = sig.leads[this.lead]?.[i] ?? 0;
    this.projLabel.visible = this.show.axis;
    this.projLabel.position.copy(ax.clone().multiplyScalar(pr * S + Math.sign(pr || 1) * 0.25));
    this.projLabel.element.textContent = `${this.lead}: ${val >= 0 ? '+' : ''}${val.toFixed(2)} mV`;
    this.projLabel.element.className = `h3d-lab proj ${val >= 0 ? 'pos' : 'neg'}`;
  }

  // ------------------------------------------------------------------ picking / inspector
  private setupPicking(): void {
    const el = this.labelRenderer.domElement;
    let down: { x: number; y: number } | null = null;
    el.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    el.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      down = null;
      const r = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, this.camera);
      const meshes = this.shells.filter((s) => s.mesh.visible).map((s) => s.mesh);
      const hits = ray.intersectObjects(meshes, false).filter((x) => {
        if (this.wallMode !== 'cut') return true;
        return this.clip.distanceToPoint(x.point) >= 0;
      });
      if (!hits.length || !hits[0].face) return;
      const si = this.shells.findIndex((s) => s.mesh === hits[0].object);
      const f = hits[0].face;
      // Nearest of the face's vertices to the hit point.
      const posA = this.shells[si].mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const local = this.shells[si].mesh.worldToLocal(hits[0].point.clone());
      let best = f.a;
      let bd = Infinity;
      for (const vi of [f.a, f.b, f.c]) {
        const d = local.distanceToSquared(new THREE.Vector3(posA.getX(vi), posA.getY(vi), posA.getZ(vi)));
        if (d < bd) {
          bd = d;
          best = vi;
        }
      }
      this.pick = { shell: si, vi: best };
      this.renderInspector();
      this.requestRender();
    });
  }

  private regionName(s: Shell, i: number): string {
    if (s.chamber === 'LV') {
      const seg = s.seg[i];
      return `LV ${SEG_NAMES[seg]} (AHA segment ${seg}) — ${s.endo > 0.5 ? 'endocardium' : 'epicardium'}`;
    }
    if (s.chamber === 'RV') {
      const th = s.th[i];
      const where = th > 25 ? 'anterior' : th < -50 ? 'inferior' : 'lateral';
      return `RV free wall, ${where}${s.lz[i] > 0.2 ? ' (apical trabecular part)' : ''}`;
    }
    if (s.chamber === 'RVOT') return 'RV outflow tract (infundibulum)';
    return s.name;
  }

  private renderInspector(): void {
    const pk = this.pick;
    if (!pk || !this.run || !this.shells[pk.shell]) {
      this.pickMarker.visible = false;
      return;
    }
    const s = this.shells[pk.shell];
    const i = pk.vi;
    const posA = s.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    this.pickMarker.position.set(posA.getX(i), posA.getY(i), posA.getZ(i));
    this.pickMarker.visible = true;
    const t = this.t;
    const A = this.A!;
    const outward = vnorm(vsub(s.pos[i], A.center));
    const facing = (Object.keys(LEADS) as LeadId[]).filter((id) => vdot(vnorm(LEADS[id].axis as unknown as V3), outward) > 0.55);
    const mirror = (Object.keys(LEADS) as LeadId[]).filter((id) => vdot(vnorm(LEADS[id].axis as unknown as V3), outward) < -0.6);
    const vt = s.scar[i] ? null : this.vertexTimes(pk.shell, i, t);
    const kind: ApKind = s.side === 'A' ? 'atrial' : s.endo > 0.6 ? 'ventEndo' : 'ventEpi';
    const rows: HTMLElement[] = [];
    rows.push(h('h4', null, this.regionName(s, i)));
    const cor = s.cor[i];
    const info: [string, string][] = [];
    if (s.side !== 'A') info.push(['Blood supply', cor ? `${COR_NAME[cor]}${cor === 3 ? ' (in a right-dominant circulation)' : ''}` : '—']);
    info.push(['Leads facing it', facing.length ? facing.join(', ') : 'none directly']);
    if (mirror.length) info.push(['Seen in mirror image by', mirror.join(', ')]);
    if (s.scar[i]) info.push(['State', 'Scar: no action potential, no contraction (electrically silent → Q waves in leads facing it)']);
    let st: ApState | null = null;
    if (vt) {
      const beatT = s.side === 'A' ? null : this.beats()[this.beatAt(t)]?.ev.t;
      const apd = vt.rep - vt.act;
      st = apState(t - vt.act, apd, kind);
      if (beatT !== null && beatT !== undefined) info.push(['This beat', `activated ${Math.round(vt.act - beatT)} ms after QRS onset · repolarised at ${Math.round(vt.rep - beatT)} ms · action-potential duration ${Math.round(apd)} ms`]);
      else info.push(['This beat', `activated ${Math.round(vt.act - (this.run.sim.atrial.filter((a) => a.t <= t && a.kind !== 'flutter').pop()?.t ?? vt.act))} ms after P-wave onset · APD ≈ ${Math.round(apd)} ms`]);
      info.push(['Now', `${st.mv.toFixed(0)} mV · ${PHASE_CURRENTS[st.phase].name} · ${st.refractory === 'absolute' ? 'absolutely refractory' : st.refractory === 'relative' ? 'relatively refractory (vulnerable)' : 'excitable'}`]);
    }
    rows.push(h('dl', { class: 'h3d-dl' }, ...info.map(([k, v]) => h('div', null, h('dt', null, k), h('dd', null, v)))));
    if (st) {
      const pc = PHASE_CURRENTS[st.phase];
      rows.push(h('p', { class: 'h3d-cur' }, h('strong', null, 'Ion currents now: '), kind === 'atrial' ? pc.atrial : pc.vent));
    }
    this.inspector.replaceChildren(...rows, this.apCanvas, h('p', { class: 'h3d-hint' }, 'The action potential of this spot during the current beat (cursor = now). Endocardial cells have a longer plateau than epicardial cells; that is why repolarisation runs epicardium → endocardium and the T wave is upright.'));
    this.drawAp(vt, kind);
  }

  private drawAp(vt: { act: number; rep: number } | null, kind: ApKind): void {
    const cv = this.apCanvas;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const W2 = cv.width;
    const H2 = cv.height;
    ctx.clearRect(0, 0, W2, H2);
    const dark = matchMedia('(prefers-color-scheme: dark)').matches || document.documentElement.getAttribute('data-theme') === 'dark';
    ctx.fillStyle = dark ? '#161d25' : '#ffffff';
    ctx.fillRect(0, 0, W2, H2);
    ctx.font = '10px system-ui, sans-serif';
    if (!vt) {
      ctx.fillStyle = dark ? '#aaa' : '#666';
      ctx.fillText('No action potential (scar or no activation yet).', 10, H2 / 2);
      return;
    }
    const apd = vt.rep - vt.act;
    const t0 = vt.act - 40;
    const t1 = vt.act + apd + 120;
    const X = (tt: number): number => 30 + ((tt - t0) / (t1 - t0)) * (W2 - 36);
    const Y = (mv: number): number => H2 - 14 - ((mv + 95) / 130) * (H2 - 22);
    ctx.strokeStyle = dark ? '#2b3643' : '#e3e7ec';
    for (const mv of [-80, -40, 0]) {
      ctx.beginPath();
      ctx.moveTo(28, Y(mv));
      ctx.lineTo(W2 - 4, Y(mv));
      ctx.stroke();
      ctx.fillStyle = dark ? '#9aa7b6' : '#5b6776';
      ctx.fillText(`${mv}`, 2, Y(mv) + 3);
    }
    ctx.strokeStyle = dark ? '#6cb2ff' : '#0b5cad';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let tt = t0; tt <= t1; tt += 1) {
      const mv = apState(tt - vt.act, apd, kind).mv;
      if (tt === t0) ctx.moveTo(X(tt), Y(mv));
      else ctx.lineTo(X(tt), Y(mv));
    }
    ctx.stroke();
    // Phase labels
    ctx.fillStyle = dark ? '#e6ebf1' : '#16202b';
    const ph = (tt: number, s2: string): void => {
      ctx.fillText(s2, X(tt) - 3, Y(apState(tt - vt.act, apd, kind).mv) - 6);
    };
    ph(vt.act + 0.8, '0');
    ph(vt.act + 8, '1');
    ph(vt.act + apd * 0.45, '2');
    ph(vt.act + apd * 0.88, '3');
    ph(vt.act + apd + 60, '4');
    // Cursor
    if (this.t >= t0 && this.t <= t1) {
      ctx.strokeStyle = '#ff9800';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(X(this.t), 4);
      ctx.lineTo(X(this.t), H2 - 12);
      ctx.stroke();
    }
    ctx.fillStyle = dark ? '#9aa7b6' : '#5b6776';
    ctx.fillText('mV', 2, 10);
    ctx.fillText(`${Math.round(apd)} ms`, X(vt.act + apd / 2) - 12, H2 - 2);
  }

  // ------------------------------------------------------------------ render
  private resize(): void {
    const w = this.host.clientWidth || 300;
    const hgt = this.host.clientHeight || 300;
    this.renderer.setSize(w, hgt, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${hgt}px`;
    this.labelRenderer.setSize(w, hgt);
    this.camera.aspect = w / hgt;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  private pending = false;
  requestRender(): void {
    if (this.pending || this.disposed) return;
    this.pending = true;
    this.raf = requestAnimationFrame(() => {
      this.pending = false;
      if (this.disposed) return;
      const moving = this.controls.update();
      const toCam = this.camera.position.clone().sub(this.controls.target).normalize();
      this.clip.normal.copy(toCam.clone().negate());
      this.clip.constant = 0.02;
      this.renderer.render(this.scene, this.camera);
      this.labelRenderer.render(this.scene, this.camera);
      this.drawGizmo();
      if (moving) this.requestRender();
    });
  }

  private drawGizmo(): void {
    const q = this.camera.quaternion.clone().invert();
    const axes: [string, THREE.Vector3, string][] = [
      ['L', new THREE.Vector3(1, 0, 0), '#e53935'],
      ['Sup', new THREE.Vector3(0, 1, 0), '#43a047'],
      ['Ant', new THREE.Vector3(0, 0, 1), '#1e88e5'],
    ];
    const g = this.gizmo;
    while (g.firstChild) g.removeChild(g.firstChild);
    for (const [lab, v, col] of axes) {
      const p = v.clone().applyQuaternion(q);
      const x = p.x * 26;
      const y = -p.y * 26;
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      ln.setAttribute('x1', '0');
      ln.setAttribute('y1', '0');
      ln.setAttribute('x2', String(x));
      ln.setAttribute('y2', String(y));
      ln.setAttribute('stroke', col);
      ln.setAttribute('stroke-width', '3');
      ln.setAttribute('opacity', p.z < -0.2 ? '0.35' : '1');
      const tx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tx.setAttribute('x', String(x * 1.25));
      tx.setAttribute('y', String(y * 1.25 + 4));
      tx.setAttribute('text-anchor', 'middle');
      tx.setAttribute('font-size', '11');
      tx.setAttribute('fill', col);
      tx.textContent = lab;
      g.append(ln, tx);
    }
  }
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
