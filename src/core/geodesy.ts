// WGS84 geodesy: conversions between geodetic (lat, lon, height) and Earth-Centred
// Earth-Fixed (ECEF) Cartesian coordinates, local East-North-Up frames, and
// great-circle navigation maths.
//
// Why ECEF for the simulation state?
//   The aircraft's position is stored in ECEF metres as 64-bit floats. That is a
//   single, continuous, singularity-free coordinate system for the whole planet:
//   there is no map edge, no longitude wrap-around and no pole problem. Doubles
//   give sub-millimetre precision at Earth radius (~6.4e6 m), so the physics never
//   jitters. Rendering precision (32-bit GPU floats) is handled by Cesium, which
//   renders relative to the camera.
//
//   Forces are most naturally expressed in a *local* tangent frame (East-North-Up)
//   at the aircraft's current position; `enuBasis` builds that frame each step.

import { DEG, RAD, type Vec3, cross, norm, dot, clamp, wrap360 } from './math';

export const WGS84_A = 6378137.0;
export const WGS84_F = 1 / 298.257223563;
export const WGS84_B = WGS84_A * (1 - WGS84_F);
export const WGS84_E2 = WGS84_F * (2 - WGS84_F);
const EP2 = (WGS84_A * WGS84_A - WGS84_B * WGS84_B) / (WGS84_B * WGS84_B);
/** Mean Earth radius used for great-circle navigation. */
export const R_EARTH = 6371008.8;

export interface Geodetic {
  lat: number; // degrees
  lon: number; // degrees
  h: number; // metres above the WGS84 ellipsoid (≈ above mean sea level for this sim)
}

export function geodeticToEcef(latDeg: number, lonDeg: number, h: number): Vec3 {
  const lat = latDeg * DEG, lon = lonDeg * DEG;
  const sl = Math.sin(lat), cl = Math.cos(lat);
  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sl * sl);
  return [(N + h) * cl * Math.cos(lon), (N + h) * cl * Math.sin(lon), (N * (1 - WGS84_E2) + h) * sl];
}

/**
 * ECEF → geodetic using Bowring's method with one refinement iteration, which is
 * accurate to well under a millimetre for any altitude an aircraft can reach.
 */
export function ecefToGeodetic(p: Vec3): Geodetic {
  const [x, y, z] = p;
  const lon = Math.atan2(y, x);
  const r = Math.hypot(x, y);
  let beta = Math.atan2(z * WGS84_A, r * WGS84_B);
  let lat = Math.atan2(z + EP2 * WGS84_B * Math.sin(beta) ** 3, r - WGS84_E2 * WGS84_A * Math.cos(beta) ** 3);
  // one refinement step
  beta = Math.atan2((1 - WGS84_F) * Math.sin(lat), Math.cos(lat));
  lat = Math.atan2(z + EP2 * WGS84_B * Math.sin(beta) ** 3, r - WGS84_E2 * WGS84_A * Math.cos(beta) ** 3);
  const sl = Math.sin(lat);
  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sl * sl);
  const h = Math.abs(lat) < 1.4 ? r / Math.cos(lat) - N : z / sl - N * (1 - WGS84_E2);
  return { lat: lat * RAD, lon: lon * RAD, h };
}

export interface EnuBasis {
  east: Vec3;
  north: Vec3;
  up: Vec3;
}

/** Unit vectors of the local East-North-Up frame expressed in ECEF. `up` is the ellipsoid normal. */
export function enuBasis(latDeg: number, lonDeg: number): EnuBasis {
  const lat = latDeg * DEG, lon = lonDeg * DEG;
  const sl = Math.sin(lat), cl = Math.cos(lat), so = Math.sin(lon), co = Math.cos(lon);
  return {
    east: [-so, co, 0],
    north: [-sl * co, -sl * so, cl],
    up: [cl * co, cl * so, sl],
  };
}

export const enuToEcefVec = (b: EnuBasis, e: number, n: number, u: number): Vec3 => [
  b.east[0] * e + b.north[0] * n + b.up[0] * u,
  b.east[1] * e + b.north[1] * n + b.up[1] * u,
  b.east[2] * e + b.north[2] * n + b.up[2] * u,
];
export const ecefToEnuVec = (b: EnuBasis, v: Vec3): Vec3 => [dot(v, b.east), dot(v, b.north), dot(v, b.up)];

/**
 * Normal gravity on the ellipsoid (Somigliana formula) with the free-air height
 * correction. This is *effective* gravity: it already includes the centrifugal
 * term of Earth's rotation, and it points along the ellipsoid normal (-up). Using
 * it lets the simulation treat the ECEF frame as if it were inertial without an
 * aircraft parked on a runway slowly sliding sideways.
 */
export function normalGravity(latDeg: number, h: number): number {
  const s2 = Math.sin(latDeg * DEG) ** 2;
  const g0 = (9.7803253359 * (1 + 0.00193185265241 * s2)) / Math.sqrt(1 - WGS84_E2 * s2);
  return g0 - 3.086e-6 * h;
}

// --- Great-circle navigation (spherical Earth, adequate for flight planning) ---------

/** Great-circle distance in metres. */
export function distance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = lat1 * DEG, p2 = lat2 * DEG;
  const dp = p2 - p1, dl = (lon2 - lon1) * DEG;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial true bearing in degrees from point 1 to point 2. */
export function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = lat1 * DEG, p2 = lat2 * DEG, dl = (lon2 - lon1) * DEG;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return wrap360(Math.atan2(y, x) * RAD);
}

/** Point reached travelling `dist` metres from (lat, lon) on initial bearing `brg`. */
export function destination(lat: number, lon: number, brg: number, dist: number): [number, number] {
  const d = dist / R_EARTH, b = brg * DEG, p1 = lat * DEG, l1 = lon * DEG;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [p2 * RAD, ((l2 * RAD + 540) % 360) - 180];
}

/** Point at fraction f along the great circle from 1 to 2. */
export function intermediate(lat1: number, lon1: number, lat2: number, lon2: number, f: number): [number, number] {
  const d = distance(lat1, lon1, lat2, lon2) / R_EARTH;
  if (d < 1e-9) return [lat1, lon1];
  const p1 = lat1 * DEG, l1 = lon1 * DEG, p2 = lat2 * DEG, l2 = lon2 * DEG;
  const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
  const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
  const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
  const z = A * Math.sin(p1) + B * Math.sin(p2);
  return [Math.atan2(z, Math.hypot(x, y)) * RAD, Math.atan2(y, x) * RAD];
}

/**
 * Signed cross-track distance (m) of point P from the great circle A→B
 * (positive = right of course) and along-track distance from A.
 */
export function crossTrack(latA: number, lonA: number, latB: number, lonB: number, lat: number, lon: number) {
  const d13 = distance(latA, lonA, lat, lon) / R_EARTH;
  const t13 = bearing(latA, lonA, lat, lon) * DEG;
  const t12 = bearing(latA, lonA, latB, lonB) * DEG;
  const xt = Math.asin(clamp(Math.sin(d13) * Math.sin(t13 - t12), -1, 1));
  const at = Math.acos(clamp(Math.cos(d13) / Math.cos(xt), -1, 1)) * Math.sign(Math.cos(t13 - t12) || 1);
  return { xtk: xt * R_EARTH, atk: at * R_EARTH };
}

/** Builds an orthonormal body→ECEF rotation from heading/pitch/roll (degrees) at a location. */
export function hprToBodyAxes(latDeg: number, lonDeg: number, hdg: number, pitch: number, roll: number) {
  const b = enuBasis(latDeg, lonDeg);
  const h = hdg * DEG, p = pitch * DEG, r = roll * DEG;
  // Forward axis in ENU: heading measured clockwise from north.
  const fwdEnu: Vec3 = [Math.sin(h) * Math.cos(p), Math.cos(h) * Math.cos(p), Math.sin(p)];
  const fwd = norm(enuToEcefVec(b, fwdEnu[0], fwdEnu[1], fwdEnu[2]));
  // Right wing (level) then rotated by roll about forward.
  const rightLevel = norm(cross(fwd, b.up));
  const downLevel = cross(fwd, rightLevel);
  const right: Vec3 = [
    rightLevel[0] * Math.cos(r) + downLevel[0] * Math.sin(r),
    rightLevel[1] * Math.cos(r) + downLevel[1] * Math.sin(r),
    rightLevel[2] * Math.cos(r) + downLevel[2] * Math.sin(r),
  ];
  const down = cross(fwd, right);
  return { fwd, right, down, basis: b };
}
