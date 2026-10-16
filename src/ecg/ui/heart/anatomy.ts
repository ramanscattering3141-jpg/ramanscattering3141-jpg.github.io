// Anatomy of the 3-D heart, defined as signed-distance functions (SDFs).
//
// Frame: the ECG engine's body frame — x = patient's left, y = inferior, z = anterior — in
// centimetres, so the activation sequence can be compared directly with the heart vector and the
// lead axes. The ventricles are built around the LV long axis (base → apex: leftward, inferior,
// anterior); the RV is a crescent wrapped around the septal side; the atria sit above and behind
// the AV plane, separated from the ventricles by the insulating fibrous ring. Sizes follow an
// adult heart (LV ≈ 8 cm long, wall ≈ 1 cm; RV free wall ≈ 4 mm; atrial walls ≈ 2–3 mm) and
// scale with the simulated LV/RV mass and atrial size.

import type { Physio } from '../../engine/params';

export type V3 = [number, number, number];

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const lerp = (a: V3, b: V3, u: number): V3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
/** Sum of scaled vectors: comb([v, k], …). */
export const comb = (...terms: [V3, number][]): V3 => terms.reduce<V3>((acc, [v, k]) => [acc[0] + v[0] * k, acc[1] + v[1] * k, acc[2] + v[2] * k], [0, 0, 0]);

const clamp = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x));

/** Polynomial smooth minimum (union) of two distances. */
function smin(a: number, b: number, k: number): number {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
}

/** Ellipsoid in an orthonormal frame (e0, e1, e2) with semi-axes r. Approximate SDF (exact on the surface). */
interface Ellipsoid {
  c: V3;
  e: [V3, V3, V3];
  r: V3;
}
function sdEllipsoid(p: V3, E: Ellipsoid): number {
  const d = sub(p, E.c);
  const q: V3 = [dot(d, E.e[0]), dot(d, E.e[1]), dot(d, E.e[2])];
  const k0 = Math.hypot(q[0] / E.r[0], q[1] / E.r[1], q[2] / E.r[2]);
  const k1 = Math.hypot(q[0] / (E.r[0] * E.r[0]), q[1] / (E.r[1] * E.r[1]), q[2] / (E.r[2] * E.r[2]));
  if (k1 < 1e-9) return -Math.min(E.r[0], E.r[1], E.r[2]);
  return (k0 * (k0 - 1)) / k1;
}
const grow = (E: Ellipsoid, t: number): Ellipsoid => ({ c: E.c, e: E.e, r: [E.r[0] + t, E.r[1] + t, E.r[2] + t] });

/** Capsule (segment a–b, radius r). */
function sdCapsule(p: V3, a: V3, b: V3, r: number): number {
  const pa = sub(p, a);
  const ba = sub(b, a);
  const h = clamp(dot(pa, ba) / dot(ba, ba), 0, 1);
  return len(sub(pa, mul(ba, h))) - r;
}

const BODY: [V3, V3, V3] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

// ---------------------------------------------------------------- regions
export const enum Region {
  None = 0,
  LVFree = 1,
  Septum = 2,
  RVFree = 3,
  RVOT = 4,
  RA = 5,
  LA = 6,
}
export const REGION_NAME = ['', 'LV free wall', 'interventricular septum', 'RV free wall', 'RV outflow tract', 'right atrium', 'left atrium'];
export const isAtrial = (r: number): boolean => r === Region.RA || r === Region.LA;
export const isVentricular = (r: number): boolean => r >= Region.LVFree && r <= Region.RVOT;

export interface ValveDef {
  id: 'mitral' | 'tricuspid' | 'aortic' | 'pulmonary';
  bit: number;
  c: V3;
  /** Direction of forward flow through the valve. */
  n: V3;
  r: number;
  leaflets: number;
}

export interface Tract {
  id: string;
  pts: V3[];
  radius: number;
  kind: 'node' | 'atrial' | 'his' | 'branch' | 'purkinje' | 'ap' | 'lead';
}

export interface Anatomy {
  key: string;
  /** LV frame: base centre, long axis (base → apex), septal direction (LV → RV) and the anterior-wall direction. */
  B: V3;
  a: V3;
  s: V3;
  w: V3;
  apexU: number;
  /** Heart centre used for the vector arrow and the lead axes. */
  centre: V3;
  bounds: { min: V3; max: V3 };
  /** Ventricular and atrial myocardium (negative inside the wall). */
  sdfV: (p: V3) => number;
  sdfA: (p: V3) => number;
  /** Cavities (negative inside the blood pool) for depth (endo → epi) estimates. */
  cavLV: (p: V3) => number;
  cavRV: (p: V3) => number;
  cavRA: (p: V3) => number;
  cavLA: (p: V3) => number;
  region: (p: V3) => Region;
  /** LV long-axis coordinate (0 base … apexU apex) and short-axis angle (0 = septum, +90 anterior, ±180 lateral, −90 inferior). */
  lvCoords: (p: V3) => { u: number; th: number; r: number };
  valves: ValveDef[];
  vessels: { id: string; pts: V3[]; r: number; kind: 'artery' | 'vein' | 'pa' }[];
  landmarks: Record<string, V3>;
  tracts: Tract[];
  /** Ventricular breakthrough sites used by the activation solver. */
  sites: Record<string, V3>;
}

// The LV long axis and short-axis frame (fixed; dextrocardia is a mirror at render time).
const A0: V3 = norm([0.5, 0.6, 0.45]);
const S0: V3 = (() => {
  const s = norm([-0.75, -0.05, 0.65]);
  return norm(sub(s, mul(A0, dot(s, A0))));
})();
const W0: V3 = (() => {
  const w = norm(cross(A0, S0));
  return w[2] < 0 ? mul(w, -1) : w;
})();

/** Step a point along the SDF gradient until it lies on the iso-surface `target`. */
export function project(f: (p: V3) => number, p: V3, target = 0, iters = 24): V3 {
  let q = p;
  const e = 0.01;
  for (let i = 0; i < iters; i++) {
    const d = f(q) - target;
    if (Math.abs(d) < 0.002) break;
    const g: V3 = [(f([q[0] + e, q[1], q[2]]) - f([q[0] - e, q[1], q[2]])) / (2 * e), (f([q[0], q[1] + e, q[2]]) - f([q[0], q[1] - e, q[2]])) / (2 * e), (f([q[0], q[1], q[2] + e]) - f([q[0], q[1], q[2] - e])) / (2 * e)];
    const gl = len(g) || 1;
    q = sub(q, mul(g, d / (gl * gl)));
  }
  return q;
}

export function buildAnatomy(p: Physio): Anatomy {
  const lvK = Math.pow(clamp(p.lvMass, 0.7, 2.6), 0.75);
  const rvK = Math.pow(clamp(p.rvMass, 0.7, 3.5), 0.6);
  const rvDil = 1 + 0.35 * clamp(p.rvStrain, 0, 1) + 0.08 * Math.max(0, p.rvMass - 1);
  const raK = Math.pow(clamp(p.raSize, 0.7, 2.5), 0.35);
  const laK = Math.pow(clamp(p.laSize, 0.7, 2.5), 0.35);
  const hcm = clamp(p.hcm ?? 0, 0, 1);
  const key = [lvK, rvK, rvDil, raK, laK, hcm].map((x) => x.toFixed(3)).join('|');

  const a = A0;
  const s = S0;
  const w = W0;
  const B: V3 = [0, 0, 0];
  const at = (u: number, sk: number, wk: number): V3 => comb([B, 1], [a, u], [s, sk], [w, wk]);
  const lvFrame: [V3, V3, V3] = [a, s, w];

  // ---- LV: a bullet-shaped (half-ellipsoid) shell, truncated at the base plane u = 0.
  const wallLV = 0.95 * lvK;
  const cavR = 1.95 * Math.pow(lvK, -0.15);
  const lvCav: Ellipsoid = { c: at(0.7, 0, 0), e: lvFrame, r: [6.5, cavR, cavR] };
  const lvOut: Ellipsoid = { c: at(0.7, 0, 0), e: lvFrame, r: [6.5 + 0.8 * lvK, cavR + wallLV, cavR + wallLV] };
  const apexU = 0.7 + lvOut.r[0];

  // ---- RV: crescent wrapped around the septal side; does not reach the apex.
  const rvCav: Ellipsoid = { c: at(2.2, 2.05 * rvDil, -0.15), e: lvFrame, r: [4.5, 2.25 * rvDil, 3.05 * rvDil] };
  const wallRV = 0.42 * rvK;
  const rvOut = grow(rvCav, wallRV);
  // Infundibulum (RV outflow tract) rising in front of the aortic root to the pulmonary valve.
  const rvotA = at(1.2, 2.4 * rvDil, 1.4);
  const pv = at(-2.05, 1.05, 1.75);
  const rvotR = 1.05;

  // ---- valves at the base
  const mitral = at(-0.05, -0.55, -0.25);
  const aorticC = at(-0.5, 0.55, 0.55);
  const tricuspid = at(0.25, 2.65 * rvDil, -0.35);

  // ---- atria (body-frame ellipsoids above and behind the AV plane)
  const laC = comb([mitral, 1], [a, -2.35], [[0, 0, -1], 0.35]);
  const raC = comb([tricuspid, 1], [a, -2.15], [[-1, 0, 0], 0.35], [[0, 0, -1], 0.15]);
  const laCav: Ellipsoid = { c: laC, e: BODY, r: [2.25 * laK, 1.65 * laK, 1.75 * laK] };
  const raCav: Ellipsoid = { c: raC, e: BODY, r: [1.75 * raK, 2.2 * raK, 1.85 * raK] };
  const wallA = 0.33;
  const laaC = comb([laC, 1], [[1, 0, 0], 2.05 * laK], [[0, -1, 0], 0.55], [[0, 0, 1], 1.35]);
  const raaC = comb([raC, 1], [[1, 0, 0], 0.95 * raK], [[0, -1, 0], 1.65 * raK], [[0, 0, 1], 1.55 * raK]);
  const laa: Ellipsoid = { c: laaC, e: BODY, r: [1.05, 0.62, 0.75] };
  const raa: Ellipsoid = { c: raaC, e: BODY, r: [1.15, 0.72, 0.85] };

  const uOf = (q: V3): number => dot(sub(q, B), a);
  // The AV plane: ventricles below u = 0 (the tricuspid annulus sits slightly more apically),
  // atria above u = −0.35; the fibrous ring between them is not myocardium.
  const basePlaneV = (q: V3): number => -uOf(q) + 0.0;
  const basePlaneA = (q: V3): number => uOf(q) + 0.32;

  const sdRvot = (q: V3, r: number): number => sdCapsule(q, rvotA, pv, r);
  const cavLV = (q: V3): number => Math.max(sdEllipsoid(q, lvCav), -uOf(q) - 2);
  const cavRVraw = (q: V3): number => smin(sdEllipsoid(q, rvCav), sdRvot(q, rvotR - 0.38), 0.6);
  const outLV = (q: V3): number => {
    let d = sdEllipsoid(q, lvOut);
    // HCM: asymmetric septal bulge.
    if (hcm > 0) d = smin(d, sdEllipsoid(q, { c: at(2.2, 1.6, 0.2), e: lvFrame, r: [2.6, 0.7 + 0.5 * hcm, 1.7] }), 0.5);
    return d;
  };
  const cavRV = (q: V3): number => Math.max(cavRVraw(q), -(outLV(q) - 0.02));
  const outRV = (q: V3): number => smin(sdEllipsoid(q, rvOut), sdRvot(q, rvotR), 0.6);

  const sdfV = (q: V3): number => {
    const outer = smin(outLV(q), outRV(q), 0.45);
    let d = Math.max(outer, -sdEllipsoid(q, lvCav), -cavRV(q));
    // Base: everything above the AV plane is removed except the infundibulum up to the pulmonary valve.
    const inRvot = sdRvot(q, rvotR + 0.15) < 0 && uOf(q) < 0.6;
    if (!inRvot) d = Math.max(d, basePlaneV(q));
    else d = Math.max(d, -dot(sub(q, pv), norm(sub(rvotA, pv))) - 0.05);
    // Openings of the outflow tracts and inflow valves.
    d = Math.max(d, -(len(sub(q, aorticC)) - 1.05));
    return d;
  };

  const cavRA = (q: V3): number => smin(sdEllipsoid(q, raCav), sdEllipsoid(q, grow(raa, -wallA)), 0.5);
  const cavLA = (q: V3): number => smin(sdEllipsoid(q, laCav), sdEllipsoid(q, grow(laa, -wallA)), 0.45);
  const sdfA = (q: V3): number => {
    const outer = smin(smin(sdEllipsoid(q, grow(raCav, wallA)), sdEllipsoid(q, raa), 0.55), smin(sdEllipsoid(q, grow(laCav, wallA)), sdEllipsoid(q, laa), 0.5), 0.35);
    let d = Math.max(outer, -cavRA(q), -cavLA(q));
    d = Math.max(d, basePlaneA(q));
    // Keep the aortic root and the outflow tract clear of atrial tissue.
    d = Math.max(d, -(len(sub(q, aorticC)) - 1.15), -sdRvot(q, rvotR + 0.1));
    return d;
  };

  const lvCoords = (q: V3): { u: number; th: number; r: number } => {
    const d = sub(q, B);
    const u = dot(d, a);
    const ps = dot(d, s);
    const pw = dot(d, w);
    return { u, th: (Math.atan2(pw, ps) * 180) / Math.PI, r: Math.hypot(ps, pw) };
  };

  const A_cavLV = cavLV;
  const region = (q: V3): Region => {
    if (sdfA(q) < 0.0) return uOf(q) < -0.3 ? (cavRA(q) < cavLA(q) ? Region.RA : Region.LA) : Region.None;
    if (sdfV(q) >= 0.0) return Region.None;
    if (sdRvot(q, rvotR + 0.1) < 0 && uOf(q) < 1.1 && outLV(q) > 0) return Region.RVOT;
    if (outLV(q) > 0.0) return cavRV(q) < A_cavLV(q) + 0.4 ? Region.RVFree : Region.LVFree;
    // Inside the LV shell: septum where the RV cavity lies on the other side.
    const toRv = cavRVraw(q);
    return toRv < wallLV + 0.6 && dot(sub(q, B), s) > 0 ? Region.Septum : Region.LVFree;
  };

  // ---- vessels (not myocardium; drawn as tubes)
  const up: V3 = [0, -1, 0];
  const aoDir = norm(comb([up, 1], [a, -0.35], [[0, 0, 1], 0.25], [[-1, 0, 0], 0.15]));
  const ao0 = aorticC;
  const vessels: Anatomy['vessels'] = [
    { id: 'aorta', kind: 'artery', r: 1.3, pts: [ao0, comb([ao0, 1], [aoDir, 2.2]), comb([ao0, 1], [aoDir, 4.2], [[-1, 0, 0], 0.2]), comb([ao0, 1], [up, 5.9], [[1, 0, 0], 0.9], [[0, 0, -1], 1.3]), comb([ao0, 1], [up, 5.7], [[1, 0, 0], 2.3], [[0, 0, -1], 3.0]) ] },
    { id: 'pulmonary trunk', kind: 'pa', r: 1.15, pts: [pv, comb([pv, 1], [up, 1.5], [[1, 0, 0], 0.55], [[0, 0, -1], 0.35]), comb([pv, 1], [up, 2.6], [[1, 0, 0], 0.8], [[0, 0, -1], 1.6])] },
    { id: 'left pulmonary artery', kind: 'pa', r: 0.8, pts: [comb([pv, 1], [up, 2.6], [[1, 0, 0], 0.8], [[0, 0, -1], 1.6]), comb([pv, 1], [up, 2.8], [[1, 0, 0], 2.4], [[0, 0, -1], 2.6])] },
    { id: 'right pulmonary artery', kind: 'pa', r: 0.8, pts: [comb([pv, 1], [up, 2.6], [[1, 0, 0], 0.8], [[0, 0, -1], 1.6]), comb([pv, 1], [up, 2.7], [[1, 0, 0], -2.2], [[0, 0, -1], 2.9])] },
    { id: 'superior vena cava', kind: 'vein', r: 0.95, pts: [comb([raC, 1], [up, 1.6 * raK], [[-1, 0, 0], 0.15]), comb([raC, 1], [up, 3.6 * raK], [[-1, 0, 0], 0.25], [[0, 0, -1], 0.2]), comb([raC, 1], [up, 6.0], [[-1, 0, 0], 0.3], [[0, 0, -1], 0.3])] },
    { id: 'inferior vena cava', kind: 'vein', r: 1.05, pts: [comb([raC, 1], [up, -1.7 * raK], [[0, 0, -1], 0.6]), comb([raC, 1], [up, -3.6], [[0, 0, -1], 0.9])] },
  ];
  for (const [sx, sy] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ] as const) {
    const p0 = comb([laC, 1], [[1, 0, 0], sx * 1.35 * laK], [[0, 1, 0], sy * 0.75], [[0, 0, -1], 1.25 * laK]);
    vessels.push({ id: sx < 0 ? 'right pulmonary veins' : 'left pulmonary veins', kind: 'vein', r: 0.48, pts: [p0, comb([p0, 1], [[1, 0, 0], sx * 1.3], [[0, 0, -1], 1.0], [[0, 1, 0], sy * 0.3])] });
  }

  const valves: ValveDef[] = [
    { id: 'mitral', bit: 1, c: mitral, n: a, r: 1.45, leaflets: 2 },
    { id: 'tricuspid', bit: 2, c: tricuspid, n: a, r: 1.5 * Math.sqrt(rvDil), leaflets: 3 },
    { id: 'aortic', bit: 4, c: aorticC, n: aoDir, r: 1.05, leaflets: 3 },
    { id: 'pulmonary', bit: 8, c: pv, n: norm(sub(pv, rvotA)), r: 1.0, leaflets: 3 },
  ];

  // ---- landmarks on surfaces
  const onRA = (g: V3, off = 0): V3 => project(cavRA, g, off);
  const onLVendo = (g: V3, off = 0.06): V3 => project(cavLV, g, off);
  const onRVendo = (g: V3, off = 0.06): V3 => project(cavRV, g, off);
  const outerV = (q: V3): number => smin(outLV(q), outRV(q), 0.45);
  const svcBase = comb([raC, 1], [up, 1.75 * raK], [[-1, 0, 0], 0.15]);
  const SA = project(sdfA, comb([svcBase, 1], [[-1, 0, 0], 0.75], [[0, 0, 1], 0.55], [up, -0.25]), -0.08);
  // AV node: RA side of the atrial septum just above the septal tricuspid leaflet (Koch's triangle).
  const crux = comb([B, 1], [s, 1.3], [w, -0.75], [a, -0.45]);
  const AVN = onRA(comb([crux, 1], [a, -0.25]), 0.08);
  const hisTop = onLVendo(comb([B, 1], [s, 1.6], [w, 0.0], [a, 0.55]), 0.12);
  const hisEnd = onLVendo(comb([B, 1], [s, 1.9], [w, 0.25], [a, 1.35]), 0.12);
  const lbSplit = onLVendo(comb([B, 1], [s, 1.9], [w, 0.1], [a, 2.1]), 0.1);
  const lafEnd = onLVendo(at(4.3, -0.9, 1.4), 0.08); // anterolateral papillary muscle
  const lpfEnd = onLVendo(at(4.6, -0.6, -1.5), 0.08); // posteromedial papillary muscle
  const septEnd = onLVendo(at(3.6, 1.9, 0), 0.08);
  const rbMid = onRVendo(at(2.6, 2.0, 0.35), 0.06);
  const rbSeptal = onRVendo(at(4.0, 2.1, 0.45), 0.06);
  const rbFree = onRVendo(at(4.6, 3.9 * rvDil, 0.9), 0.06); // anterior papillary muscle (via the moderator band)
  const rvApex = onRVendo(at(5.6, 2.4 * rvDil, 0.4), 0.06);
  const lvApexEndo = onLVendo(at(apexU - 1.2, 0, 0), 0.06);
  const bachLA = project(sdfA, comb([laC, 1], [[0, -1, 0], 1.2 * laK], [[0, 0, 1], 0.9], [[-1, 0, 0], 0.2]), -0.08);
  const bachMid = project(sdfA, lerp(SA, bachLA, 0.5), -0.08);
  const intMid = project(sdfA, comb([raC, 1], [[1, 0, 0], 0.9 * raK], [[0, 0, 1], 0.8 * raK], [up, 0.2]), -0.08);
  const intPost = project(sdfA, comb([raC, 1], [[1, 0, 0], 0.6 * raK], [[0, 0, -1], 1.2 * raK], [up, -0.2]), -0.08);

  const landmarks: Record<string, V3> = {
    SA,
    AVN,
    His: hisTop,
    lbSplit,
    lafEnd,
    lpfEnd,
    septEnd,
    rbFree,
    rvApex,
    lvApexEndo,
    crux,
    raLabel: comb([raC, 1], [[-1, 0, 0], 0.4]),
    laLabel: comb([laC, 1], [[1, 0, 0], 0.4]),
    rvLabel: at(4.3, 2.95 * rvDil, -0.6),
    lvLabel: at(3.1, -1.05, -0.6),
    apex: at(apexU, 0, 0),
    aoLabel: vessels[0].pts[2],
    paLabel: vessels[1].pts[1],
    svcLabel: vessels[4].pts[1],
  };

  // Purkinje fibres: short branching runs from the fascicle ends over the endocardium.
  const tracts: Tract[] = [
    { id: 'internodal', kind: 'atrial', radius: 0.07, pts: [SA, intMid, AVN] },
    { id: 'internodal2', kind: 'atrial', radius: 0.06, pts: [SA, intPost, AVN] },
    { id: 'bachmann', kind: 'atrial', radius: 0.07, pts: [SA, bachMid, bachLA] },
    { id: 'avn', kind: 'node', radius: 0.14, pts: [comb([AVN, 1], [a, -0.25], [s, 0.15]), AVN, lerp(AVN, hisTop, 0.6)] },
    { id: 'his', kind: 'his', radius: 0.12, pts: [lerp(AVN, hisTop, 0.6), hisTop, hisEnd] },
    { id: 'lb', kind: 'branch', radius: 0.11, pts: [hisEnd, lbSplit] },
    { id: 'laf', kind: 'branch', radius: 0.085, pts: [lbSplit, onLVendo(at(3.2, 0.6, 1.5), 0.1), lafEnd] },
    { id: 'lpf', kind: 'branch', radius: 0.085, pts: [lbSplit, onLVendo(at(3.3, 0.8, -1.4), 0.1), lpfEnd] },
    { id: 'sept', kind: 'branch', radius: 0.07, pts: [lbSplit, septEnd] },
    { id: 'rb', kind: 'branch', radius: 0.1, pts: [onRVendo(comb([hisTop, 1], [s, 0.9]), 0.06), rbMid, rbSeptal, lerp(rbSeptal, rbFree, 0.5), rbFree] },
  ];
  const rng = mulberry(11);
  const purk = (id: string, from: V3, surf: (q: V3) => number, centre: V3, n: number, spread: number, uMin: number): void => {
    for (let k = 0; k < n; k++) {
      const g = comb([centre, 1], [a, (rng() - 0.35) * spread], [s, (rng() - 0.5) * spread], [w, (rng() - 0.5) * spread]);
      if (uOf(g) < uMin) continue;
      const end = project(surf, g, 0.07);
      const mid = project(surf, lerp(from, end, 0.5), 0.07);
      tracts.push({ id: `${id}-p${k}`, kind: 'purkinje', radius: 0.035, pts: [from, mid, end] });
    }
  };
  purk('laf', lafEnd, cavLV, at(4.5, -1.2, 1.2), 7, 3.2, 1.8);
  purk('lpf', lpfEnd, cavLV, at(4.8, -0.9, -1.3), 7, 3.2, 1.8);
  purk('sept', septEnd, cavLV, at(4.6, 1.2, 0), 6, 2.8, 2.2);
  purk('rb', rbFree, cavRV, at(4.4, 3.0, 0.6), 7, 3.0, 2.0);

  const sites: Record<string, V3> = {
    lvSeptal: onLVendo(at(2.6, 1.85, 0.05), 0.12),
    laf: lafEnd,
    lpf: lpfEnd,
    rbFree,
    rbSeptal,
    rvApex: onRVendo(at(5.4, 2.4 * rvDil, 0.4), 0.15),
    rvot: project(sdfV, comb([rvotA, 1], [sub(pv, rvotA), 0.55]), -0.15),
    lvot: project(sdfV, comb([aorticC, 1], [a, 0.7], [s, -0.2]), -0.15),
    lvApex: project(sdfV, at(apexU - 0.5, 0, 0), -0.2),
    lvLateral: project(sdfV, at(3.2, -2.6, 0.3), -0.2),
    lvInferobasal: project(sdfV, at(1.2, -0.8, -2.4), -0.2),
    septal: project(sdfV, at(0.9, 1.7, 0.3), -0.15),
    fascicularPosterior: lpfEnd,
    fascicularAnterior: lafEnd,
  };

  // Bounding box from a coarse scan of both SDFs.
  const lo: V3 = [Infinity, Infinity, Infinity];
  const hi: V3 = [-Infinity, -Infinity, -Infinity];
  for (let x = -9; x <= 10; x += 0.5)
    for (let y = -9; y <= 10; y += 0.5)
      for (let z = -9; z <= 9; z += 0.5) {
        const q: V3 = [x, y, z];
        if (Math.min(sdfV(q), sdfA(q)) < 0.3) {
          for (let i = 0; i < 3; i++) {
            lo[i] = Math.min(lo[i], q[i]);
            hi[i] = Math.max(hi[i], q[i]);
          }
        }
      }
  const margin = 0.8;
  const bounds = { min: [lo[0] - margin, lo[1] - margin, lo[2] - margin] as V3, max: [hi[0] + margin, hi[1] + margin, hi[2] + margin] as V3 };
  // The electrical centre of the ventricles (where the heart-vector arrow starts).
  const centre = at(2.6, 0.6, 0.1);

  void outerV;
  return { key, B, a, s, w, apexU, centre, bounds, sdfV, sdfA, cavLV, cavRV, cavRA, cavLA, region, lvCoords, valves, vessels, landmarks, tracts, sites };
}

export function mulberry(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x = (x + 0x6d2b79f5) >>> 0;
    let t = x;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// AHA 17-segment model of the LV (Cerqueira et al. 2002) and the usual coronary supply.
export const SEG_NAMES = ['', 'basal anterior', 'basal anteroseptal', 'basal inferoseptal', 'basal inferior', 'basal inferolateral', 'basal anterolateral', 'mid anterior', 'mid anteroseptal', 'mid inferoseptal', 'mid inferior', 'mid inferolateral', 'mid anterolateral', 'apical anterior', 'apical septal', 'apical inferior', 'apical lateral', 'apex'];
export function lvSegment(uFrac: number, thDeg: number): number {
  // th: 0 septum, +90 anterior, ±180 lateral, −90 inferior.
  const th = (((thDeg % 360) + 360) % 360);
  if (uFrac > 0.9) return 17;
  if (uFrac > 0.62) {
    if (th >= 45 && th < 135) return 13;
    if (th >= 135 && th < 225) return 16;
    if (th >= 225 && th < 315) return 15;
    return 14;
  }
  const base = uFrac < 0.32 ? 0 : 6;
  // anteroseptal 30–90, anterior 90–150, anterolateral 150–210, inferolateral 210–270, inferior 270–330, inferoseptal 330–30
  const k = Math.floor((((th - 30) % 360) + 360) % 360 / 60);
  return base + [2, 1, 6, 5, 4, 3][k];
}
export function segmentCoronary(seg: number): 1 | 2 | 3 {
  if ([1, 2, 7, 8, 13, 14, 17].includes(seg)) return 1;
  if ([3, 4, 9, 10, 15].includes(seg)) return 3;
  return 2;
}
export const CORONARY_NAME = ['—', 'LAD', 'LCx', 'RCA'];
