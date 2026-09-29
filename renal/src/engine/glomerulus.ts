// Glomerular hemodynamics: a lumped whole-kidney version of the Deen–Robertson–Brenner
// ultrafiltration model (Rose ch. 2; Deen 1972). Blood flows through a preglomerular
// (afferent) resistance, a glomerular capillary with constant hydraulic pressure along its
// length, an efferent arteriole and then the peritubular capillaries/veins. Plasma oncotic
// pressure rises along the capillary as protein-free fluid is filtered, so filtration can stop
// before the efferent end ("filtration equilibrium").

import { bisect } from './math';

export interface GlomerularInput {
  /** Pressure at the renal artery entering the kidney (MAP minus any stenosis drop), mmHg */
  Pa: number;
  /** Renal venous pressure, mmHg (raised by venous congestion) */
  Pv: number;
  /** Preglomerular (afferent) resistance, mmHg·min/mL of blood */
  Ra: number;
  /** Efferent arteriolar resistance, mmHg·min/mL */
  Re: number;
  /** Peritubular capillary + venous resistance, mmHg·min/mL */
  Rpost: number;
  /** Ultrafiltration coefficient (Lp·S), mL/min/mmHg */
  Kf: number;
  /** Hydraulic pressure in Bowman's space, mmHg */
  Pbs: number;
  /** Plasma protein concentration, g/dL */
  Cp: number;
  /** Hematocrit (fraction) */
  Hct: number;
}

export interface ProfilePoint {
  x: number;
  Pgc: number;
  Pbs: number;
  pi: number;
  nfp: number;
}

export interface GlomerularResult {
  RBF: number;
  RPF: number;
  GFR: number;
  FF: number;
  Pgc: number;
  /** Peritubular capillary hydraulic pressure */
  Pptc: number;
  piAff: number;
  piEff: number;
  nfpAff: number;
  nfpEff: number;
  meanNFP: number;
  /** true when the net filtration pressure falls below ~0.5 mmHg before the efferent end */
  equilibrium: boolean;
  /** fraction of capillary length at which equilibrium was reached (1 if never) */
  xEq: number;
  profile: ProfilePoint[];
  /** total renal vascular resistance */
  RVR: number;
}

/**
 * Oncotic pressure (mmHg) from protein concentration (g/dL). Landis–Pappenheimer polynomial,
 * scaled by 0.9 so that a normal plasma protein of 7 g/dL gives ~23 mmHg (Rose Table 2-1).
 */
export function oncotic(C: number): number {
  return 0.9 * (2.1 * C + 0.16 * C * C + 0.009 * C * C * C);
}

const N_STEPS = 120;

/** Integrate filtration along the capillary for a given afferent plasma flow and Pgc. */
export function filterAlongCapillary(QP0: number, Pgc: number, Pbs: number, Cp: number, Kf: number, keepProfile = false) {
  let Q = QP0;
  const dx = 1 / N_STEPS;
  const profile: ProfilePoint[] = [];
  let xEq = 1;
  let nfpSum = 0;
  const nfpAt = (q: number) => Pgc - Pbs - oncotic((Cp * QP0) / Math.max(q, 1e-6));
  for (let i = 0; i < N_STEPS; i++) {
    const n1 = Math.max(0, nfpAt(Q));
    if (keepProfile) profile.push({ x: i * dx, Pgc, Pbs, pi: oncotic((Cp * QP0) / Q), nfp: nfpAt(Q) });
    nfpSum += n1;
    if (n1 <= 0.5 && xEq === 1) xEq = i * dx;
    // midpoint (RK2) step of dQ/dx = -Kf * nfp
    const Qm = Q - 0.5 * dx * Kf * n1;
    const n2 = Math.max(0, nfpAt(Qm));
    Q = Math.max(Q - dx * Kf * n2, QP0 * 0.02);
  }
  if (keepProfile) profile.push({ x: 1, Pgc, Pbs, pi: oncotic((Cp * QP0) / Q), nfp: nfpAt(Q) });
  return { GFR: QP0 - Q, QPout: Q, profile, xEq, meanNFP: nfpSum / N_STEPS };
}

export function solveGlomerulus(inp: GlomerularInput): GlomerularResult {
  const { Pa, Pv, Ra, Re, Rpost, Kf, Pbs, Cp, Hct } = inp;
  const pf = 1 - Hct;
  const residual = (Pgc: number) => {
    const QBa = Math.max(0, (Pa - Pgc) / Ra);
    const f = filterAlongCapillary(QBa * pf, Pgc, Pbs, Cp, Kf);
    const QBe = QBa - f.GFR;
    const Pptc = Pv + QBe * Rpost;
    return Pgc - (Pptc + QBe * Re);
  };
  const Pgc = bisect(residual, Pv + 1e-3, Math.max(Pv + 1e-3, Pa - 1e-3), 1e-5, 90);
  const RBF = Math.max(0, (Pa - Pgc) / Ra);
  const RPF = RBF * pf;
  const f = filterAlongCapillary(RPF, Pgc, Pbs, Cp, Kf, true);
  const GFR = f.GFR;
  const QBe = RBF - GFR;
  const Pptc = Pv + QBe * Rpost;
  const piAff = oncotic(Cp);
  const piEff = oncotic((Cp * RPF) / Math.max(RPF - GFR, 1e-6));
  return {
    RBF,
    RPF,
    GFR,
    FF: RPF > 0 ? GFR / RPF : 0,
    Pgc,
    Pptc,
    piAff,
    piEff,
    nfpAff: Pgc - Pbs - piAff,
    nfpEff: Pgc - Pbs - piEff,
    meanNFP: f.meanNFP,
    equilibrium: f.xEq < 0.999,
    xEq: f.xEq,
    profile: f.profile,
    RVR: RBF > 0 ? (Pa - Pv) / RBF : Infinity,
  };
}

/** Reference (normal adult, both kidneys) glomerular parameters; calibrated in tests. */
export const GLOM_REF = {
  Pa: 93,
  Pv: 4,
  Ra: 0.0431,
  Re: 0.0225,
  Rpost: 0.0158,
  Kf: 34,
  Pbs: 10,
  Cp: 7.0,
  Hct: 0.45,
};
