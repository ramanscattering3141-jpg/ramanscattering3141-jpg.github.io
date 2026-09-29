// Minimal 3D vector helpers for the cardiac dipole model.
//
// Body-fixed coordinate frame used everywhere in the ECG engine:
//   x → patient's LEFT
//   y → INFERIOR (toward the feet)
//   z → ANTERIOR (toward the chest wall)
// With this frame the standard hexaxial angle θ of a frontal-plane vector is
// atan2(y, x): 0° = lead I direction, +90° = aVF, −90° = superior.

export type Vec3 = readonly [number, number, number];

export const vec = (x: number, y: number, z: number): Vec3 => [x, y, z];
export const ZERO: Vec3 = [0, 0, 0];

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);

export function norm(a: Vec3): Vec3 {
  const l = len(a);
  return l < 1e-12 ? ZERO : [a[0] / l, a[1] / l, a[2] / l];
}

/** Weighted blend of two directions, renormalised. */
export function blend(a: Vec3, b: Vec3, t: number): Vec3 {
  return norm(add(scale(a, 1 - t), scale(b, t)));
}

/** Unit vector in the frontal plane at hexaxial angle `deg` (0 = lead I, +90 = aVF). */
export function frontal(deg: number, z = 0): Vec3 {
  const r = (deg * Math.PI) / 180;
  return norm([Math.cos(r), Math.sin(r), z]);
}

/** Unit vector in the horizontal plane: 0° = patient's left (V6), 90° = anterior (≈V2). */
export function horizontal(deg: number, y = 0): Vec3 {
  const r = (deg * Math.PI) / 180;
  return norm([Math.cos(r), y, Math.sin(r)]);
}

/** Rotate in the frontal plane (about the antero-posterior axis). Positive = clockwise on the hexaxial wheel (toward inferior/right). */
export function rotFrontal(a: Vec3, deg: number): Vec3 {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [a[0] * c - a[1] * s, a[0] * s + a[1] * c, a[2]];
}

/** Rotate in the horizontal plane (about the vertical axis). Positive = toward anterior (counter-clockwise viewed from below). */
export function rotHorizontal(a: Vec3, deg: number): Vec3 {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [a[0] * c - a[2] * s, a[1], a[0] * s + a[2] * c];
}

/** Frontal-plane hexaxial angle of a vector in degrees (−180, 180]. */
export function frontalAngle(a: Vec3): number {
  return (Math.atan2(a[1], a[0]) * 180) / Math.PI;
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** 0 below e0, 1 above e1, smooth in between. */
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
