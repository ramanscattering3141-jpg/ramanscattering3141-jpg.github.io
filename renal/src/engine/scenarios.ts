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
