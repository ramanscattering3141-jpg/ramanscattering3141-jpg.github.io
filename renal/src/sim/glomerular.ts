// Page-level wrappers around the glomerular and kidney models for the filtration laboratories.

import { GLOM_REF, oncotic, solveGlomerulus, type GlomerularResult } from '../engine/glomerulus';
import { runKidney } from '../engine/kidney';
import { applyPatch, DEFAULT_PARAMS, type ParamPatch } from '../engine/types';
import type { KidneyResult } from '../engine/types';
import { NORMAL } from './hooks';

export interface GlomControls {
  map: number; // renal artery pressure, mmHg
  aff: number; // afferent resistance multiplier
  eff: number; // efferent resistance multiplier
  protein: number; // plasma protein g/dL
  pbs: number; // Bowman's space pressure mmHg
  lp: number; // hydraulic conductivity multiplier
  area: number; // surface area multiplier
  venous: number; // renal venous pressure
}

export const GLOM_DEFAULT: GlomControls = { map: 93, aff: 1, eff: 1, protein: 7, pbs: 10, lp: 1, area: 1, venous: 4 };

/** The isolated glomerulus: pure Starling physics with the arteriolar tones held where you set them. */
export function isolatedGlomerulus(c: GlomControls): GlomerularResult {
  return solveGlomerulus({
    ...GLOM_REF,
    Pa: c.map,
    Pv: c.venous,
    Ra: GLOM_REF.Ra * c.aff,
    Re: GLOM_REF.Re * c.eff,
    Kf: GLOM_REF.Kf * c.lp * c.area,
    Pbs: c.pbs,
    Cp: c.protein,
  });
}

/**
 * The intact kidney at a given renal perfusion pressure: the same manual changes, but with
 * myogenic autoregulation and tubuloglomerular feedback free to respond, and the tubule producing
 * urine. Hormones are held at their normal values so the effect of the kidney's own control
 * systems can be seen in isolation.
 */
export function intactKidney(c: GlomControls, extra: ParamPatch = {}): KidneyResult {
  const n = NORMAL();
  const params = applyPatch(DEFAULT_PARAMS, {
    afferentTone: c.aff,
    efferentTone: c.eff,
    kfFactor: c.lp * c.area,
    venousCongestion: c.venous - 4,
    // Pbs above normal is represented as downstream (obstructive) pressure
    obstructionL: Math.max(0, (c.pbs - 10) / 45),
    obstructionR: Math.max(0, (c.pbs - 10) / 45),
    ...extra,
  });
  const plasma = { ...n.plasma, albumin: Math.max(1, c.protein - 3) };
  return runKidney({ params, plasma, hormones: n.reg.hormones, MAP: c.map, ureaProduction: 0.28 });
}

export { oncotic, GLOM_REF };
