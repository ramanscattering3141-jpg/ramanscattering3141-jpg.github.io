// The reader's unit preference for the numbers they type in. The lab thinks in SI (Canadian) units
// throughout; with "US" selected, the equation cards and the laboratory interpreter show and
// accept conventional units (mg/dL, g/dL, BUN) and convert them back to SI before calculating.
// Electrolytes (Na⁺, K⁺, Cl⁻, HCO₃⁻) are the same number in both systems, so they never change.

import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { CA_MMOL_PER_MGDL, CREAT_UMOL_PER_MGDL, GLUCOSE_MMOL_PER_MGDL, MG_MMOL_PER_MGDL, PI_MMOL_PER_MGDL, UREA_MMOL_PER_BUN } from '../units';

export type UnitSystem = 'si' | 'us';

export const UnitsContext = createContext<{ units: UnitSystem; setUnits: (u: UnitSystem) => void }>({ units: 'si', setUnits: () => {} });
export const useUnits = () => useContext(UnitsContext);

export function loadUnits(): UnitSystem {
  try {
    return localStorage.getItem('renal-units') === 'us' ? 'us' : 'si';
  } catch {
    return 'si';
  }
}

export function saveUnits(u: UnitSystem) {
  try {
    if (u === 'si') localStorage.removeItem('renal-units');
    else localStorage.setItem('renal-units', u);
  } catch {
    /* storage unavailable */
  }
}

/** Analytes whose conventional unit differs from SI. `perUs` is SI units per one US unit. */
export type Analyte = 'glucose' | 'urea' | 'creat' | 'ucreat' | 'ca' | 'mg' | 'pi' | 'alb';

const TABLE: Record<Analyte, { si: string; us: string; perUs: number; usLabel?: (l: string) => string; digits: number }> = {
  glucose: { si: 'mmol/L', us: 'mg/dL', perUs: GLUCOSE_MMOL_PER_MGDL, digits: 0 },
  // Urea (mmol/L) ↔ blood urea nitrogen (mg/dL)
  urea: { si: 'mmol/L', us: 'mg/dL', perUs: UREA_MMOL_PER_BUN, usLabel: (l) => l.replace(/urea/i, (m) => (m[0] === 'U' ? 'Urea nitrogen' : 'urea nitrogen')), digits: 0 },
  creat: { si: 'µmol/L', us: 'mg/dL', perUs: CREAT_UMOL_PER_MGDL, digits: 2 },
  // Urine creatinine: MW 113.1, so 1 mg/dL = 0.0884 mmol/L
  ucreat: { si: 'mmol/L', us: 'mg/dL', perUs: 0.0884, digits: 0 },
  ca: { si: 'mmol/L', us: 'mg/dL', perUs: CA_MMOL_PER_MGDL, digits: 1 },
  mg: { si: 'mmol/L', us: 'mg/dL', perUs: MG_MMOL_PER_MGDL, digits: 1 },
  pi: { si: 'mmol/L', us: 'mg/dL', perUs: PI_MMOL_PER_MGDL, digits: 1 },
  alb: { si: 'g/L', us: 'g/dL', perUs: 10, digits: 1 },
};

/** Which analyte an equation variable measures, from its key and SI unit (undefined = no conversion). */
export function analyteOf(key: string, unit: string | undefined): Analyte | undefined {
  if (!unit) return undefined;
  if (unit === 'µmol/L') return 'creat';
  if (unit === 'g/L' && /alb/i.test(key)) return 'alb';
  if (unit !== 'mmol/L') return undefined;
  if (/^u?glu/.test(key)) return 'glucose';
  if (/^(p|u)?urea$/.test(key)) return 'urea';
  if (key === 'ucr') return 'ucreat';
  if (/^(p|u)?ca$/.test(key)) return 'ca';
  if (/^(p|u)mg$/.test(key)) return 'mg';
  if (/^(p|u)po4$/.test(key)) return 'pi';
  return undefined;
}

/** Convert an SI value for display in the chosen system. */
export function toDisplay(a: Analyte | undefined, siValue: number, u: UnitSystem): number {
  return a && u === 'us' ? siValue / TABLE[a].perUs : siValue;
}

/** Convert a displayed value back to SI. */
export function fromDisplay(a: Analyte | undefined, shown: number, u: UnitSystem): number {
  return a && u === 'us' ? shown * TABLE[a].perUs : shown;
}

export function unitLabel(a: Analyte | undefined, siUnit: string | undefined, u: UnitSystem): string | undefined {
  return a && u === 'us' ? TABLE[a].us : siUnit;
}

export function varLabel(a: Analyte | undefined, label: string, u: UnitSystem): string {
  const fn = a && u === 'us' ? TABLE[a].usLabel : undefined;
  return fn ? fn(label) : label;
}

/** A slider range and step in display units, with a sensible number of decimals. */
export function displayRange(a: Analyte | undefined, min: number, max: number, step: number, u: UnitSystem) {
  if (!a || u === 'si') return { min, max, step, digits: decimals(step) };
  const lo = toDisplay(a, min, u);
  const hi = toDisplay(a, max, u);
  const d = TABLE[a].digits;
  const st = Math.pow(10, -d);
  return { min: round(lo, d), max: round(hi, d), step: st, digits: d };
}

const decimals = (step: number) => (Number.isInteger(step) ? 0 : Math.min(3, (String(step).split('.')[1] ?? '').length));
export const round = (x: number, d: number) => Math.round(x * Math.pow(10, d)) / Math.pow(10, d);
