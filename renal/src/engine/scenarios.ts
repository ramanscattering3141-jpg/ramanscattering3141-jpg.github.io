// Helpers that set up a body state directly, for "what does the kidney do right now in a patient
// who is already volume depleted?" questions that should not have to wait for a simulated loss.

import { initialBody, type BodyState } from './body';
import type { Params } from './types';

/** Remove (or, if negative, add) litres of isotonic extracellular fluid. */
export function withIsotonicChange(body: BodyState, litres: number): BodyState {
  return {
    ...body,
    tbw: body.tbw - litres,
    naE: body.naE - litres * 140,
    clE: body.clE - litres * 104,
  };
}

/** Remove (or add) litres of pure water. */
export function withWaterChange(body: BodyState, litres: number): BodyState {
  return { ...body, tbw: body.tbw - litres };
}

export function depletedBody(p: Params, litres: number): BodyState {
  return withIsotonicChange(initialBody(p), litres);
}

/**
 * Add (litres > 0) or remove (litres < 0) fluid of a given Na+ concentration, as NaCl. Pure water
 * is naConc 0, isotonic saline 154 (≈140 of it osmotically active as plasma-water Na+), sweat
 * ~30–60, diarrhoeal fluid 40–140. Salt without water is litres 0 with extraNa.
 */
export function withFluid(body: BodyState, litres: number, naConc: number, extraNa = 0): BodyState {
  const na = litres * naConc + extraNa;
  return {
    ...body,
    tbw: Math.max(5, body.tbw + litres),
    naE: Math.max(50, body.naE + na),
    clE: Math.max(50, body.clE + na),
  };
}
