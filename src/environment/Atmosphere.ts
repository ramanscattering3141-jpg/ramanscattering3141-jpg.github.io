// International Standard Atmosphere (ISA, ICAO Doc 7488) up to 20 km, with an
// optional temperature deviation from standard (ISA + ΔT).

export const RHO0 = 1.225; // kg/m³
export const P0 = 101325; // Pa
export const T0 = 288.15; // K
export const A0 = 340.294; // m/s
const R = 287.05287;
const G0 = 9.80665;
const GAMMA = 1.4;

export interface AirData {
  temperature: number; // K
  pressure: number; // Pa
  density: number; // kg/m³
  speedOfSound: number; // m/s
}

export function isa(altitudeM: number, deltaT = 0): AirData {
  const h = Math.max(-500, Math.min(altitudeM, 20000));
  let Tstd: number, p: number;
  if (h <= 11000) {
    Tstd = T0 - 0.0065 * h;
    p = P0 * Math.pow(Tstd / T0, G0 / (0.0065 * R));
  } else {
    Tstd = 216.65;
    p = 22632.06 * Math.exp((-G0 * (h - 11000)) / (R * Tstd));
  }
  const T = Tstd + deltaT;
  const density = p / (R * T);
  return { temperature: T, pressure: p, density, speedOfSound: Math.sqrt(GAMMA * R * T) };
}

/**
 * Calibrated airspeed from true airspeed. Uses the compressible impact-pressure
 * relation so the airspeed indicator reads correctly at jet cruise altitudes
 * (CAS ≈ EAS would under-read by ~10 kt at FL350).
 */
export function tasToCas(tas: number, air: AirData): number {
  const M = tas / air.speedOfSound;
  const qc = air.pressure * (Math.pow(1 + 0.2 * M * M, 3.5) - 1);
  return A0 * Math.sqrt(5 * (Math.pow(qc / P0 + 1, 2 / 7) - 1));
}

export function casToTas(cas: number, air: AirData): number {
  const qc = P0 * (Math.pow(1 + 0.2 * (cas / A0) ** 2, 3.5) - 1);
  const M = Math.sqrt(5 * (Math.pow(qc / air.pressure + 1, 2 / 7) - 1));
  return M * air.speedOfSound;
}

export function machToTas(mach: number, air: AirData) {
  return mach * air.speedOfSound;
}
