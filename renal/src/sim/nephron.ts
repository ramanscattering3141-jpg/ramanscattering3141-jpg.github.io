// Direct access to the tubular model for the transport laboratories: run the nephron with chosen
// filtration, peritubular forces and hormone levels, independently of the rest of the body.

import { runNephron, type NephronResult } from '../engine/nephron';
import { applyPatch, DEFAULT_PARAMS, type ParamPatch, type Hormones, type Plasma } from '../engine/types';
import { NORMAL } from './hooks';

export interface NephronSetup {
  patch?: ParamPatch;
  plasma?: Partial<Plasma>;
  hormones?: Partial<Hormones>;
  GFR?: number;
  FF?: number;
  piPtc?: number;
  Pptc?: number;
  vasaRecta?: number;
  perfusion?: number;
  nephronFraction?: number;
  ureaProduction?: number;
}

export function nephronRun(s: NephronSetup = {}): NephronResult {
  const n = NORMAL();
  const params = applyPatch(DEFAULT_PARAMS, s.patch ?? {});
  const plasma = { ...n.plasma, ...(s.plasma ?? {}) };
  const hormones = { ...n.reg.hormones, ...(s.hormones ?? {}) };
  const GFR = s.GFR ?? n.kidney.GFR;
  const base = {
    params,
    plasma,
    hormones,
    GFR,
    nephronFraction: s.nephronFraction ?? params.nephronFraction,
    FF: s.FF ?? n.kidney.FF,
    Pptc: s.Pptc ?? n.kidney.Pptc,
    piPtc: s.piPtc ?? n.kidney.piPtc,
    vasaRecta: s.vasaRecta ?? n.kidney.vasaRectaFlow,
    perfusionPressure: s.perfusion ?? n.reg.MAP,
    ureaProduction: s.ureaProduction ?? 0.28,
  };
  // Two passes so ammonium supply matches ammoniagenesis, as in the full kidney model.
  const first = runNephron(base);
  return runNephron({ ...base, nh4Supply: first.ammoniagenesis / 1440 });
}

/** Hormone and haemodynamic settings for a volume state from −1 (depleted) to +1 (expanded). */
export function volumeState(v: number): Pick<NephronSetup, 'hormones' | 'FF' | 'piPtc' | 'Pptc' | 'perfusion'> {
  const at1 = Math.exp(-1.3 * v);
  const sns = Math.exp(-0.8 * v);
  const aldo = Math.exp(-1.4 * v);
  const anp = Math.exp(1.0 * v);
  return {
    hormones: { at1, angII: at1, sns, aldo, mr: aldo, anp },
    FF: 0.21 - 0.04 * v,
    piPtc: 33.5 - 5 * v,
    Pptc: 20 + 3 * v,
    perfusion: 93 + 4 * v,
  };
}
