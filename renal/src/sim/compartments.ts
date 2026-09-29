// Teaching models for Rose & Post chapter 7: osmotic equilibrium between the intracellular and
// extracellular fluid, and Starling forces between plasma and interstitium. Both are simple,
// closed-form or bisection solutions so that every step can be shown to the learner.

export interface CompartmentInput {
  weight: number;
  /** fraction of weight that is water */
  waterFraction: number;
  /** starting plasma Na⁺, mmol/L; the baseline osmolality is 2 × Na⁺ */
  na0: number;
  /** NaCl added (+) or removed (−) from the ECF, mmol (each mmol = 2 mOsm) */
  nacl: number;
  /** pure water added (+) or lost (−), L */
  water: number;
  /** isotonic saline added (+) or lost as isotonic fluid (−), L */
  saline: number;
  /** K⁺ lost from cells (as a salt), mmol (each mmol = 2 mOsm of intracellular solute) */
  kLoss: number;
  /** glucose added to the ECF, mmol */
  glucose: number;
  /** insulin present: glucose enters cells and is metabolised (so it behaves like water) */
  insulin: boolean;
  /** urea added, mmol (crosses cell membranes) */
  urea: number;
  /** mannitol added, mmol (confined to the ECF) */
  mannitol: number;
}

export const COMPARTMENT_DEFAULT: CompartmentInput = {
  weight: 70,
  waterFraction: 0.6,
  na0: 140,
  nacl: 0,
  water: 0,
  saline: 0,
  kLoss: 0,
  glucose: 0,
  insulin: false,
  urea: 0,
  mannitol: 0,
};

export interface CompartmentResult {
  tbw0: number;
  icf0: number;
  ecf0: number;
  tbw: number;
  icf: number;
  ecf: number;
  plasma: number;
  interstitial: number;
  /** effective osmolality (tonicity) */
  effOsm: number;
  /** measured osmolality (includes urea) */
  posm: number;
  na: number;
  /** extracellular glucose, mmol/L */
  glucoseConc: number;
  /** urea, mmol/L */
  ureaConc: number;
  /** water shifted out of cells (+) or into cells (−), L */
  shift: number;
  steps: string[];
}

export function compartments(i: CompartmentInput): CompartmentResult {
  const tbw0 = i.weight * i.waterFraction;
  const icf0 = tbw0 * 0.6;
  const ecf0 = tbw0 - icf0;
  const osm0 = 2 * i.na0;
  const icfSolute0 = icf0 * osm0;
  const ecfSolute0 = ecf0 * osm0;

  // Glucose with insulin is taken up and metabolised; it adds nothing that stays osmotically active.
  const effGlucose = i.insulin ? 0 : i.glucose;
  const tbw = Math.max(5, tbw0 + i.water + i.saline);
  const ecfSolute = Math.max(1, ecfSolute0 + 2 * i.nacl + i.saline * osm0 + effGlucose + i.mannitol);
  const icfSolute = Math.max(1, icfSolute0 - 2 * i.kLoss);
  const effOsm = (ecfSolute + icfSolute) / tbw;
  const ecf = ecfSolute / effOsm;
  const icf = icfSolute / effOsm;
  const ureaConc = i.urea / tbw;
  const glucoseConc = effGlucose / ecf;
  // Na⁺ salts are the only other extracellular osmoles in this model
  const na = (effOsm - glucoseConc - i.mannitol / ecf) / 2;
  const steps = [
    `Starting: TBW ${tbw0.toFixed(1)} L (ICF ${icf0.toFixed(1)}, ECF ${ecf0.toFixed(1)}), osmolality ${osm0.toFixed(0)} mOsm/kg`,
    `Effective solute: ECF ${ecfSolute0.toFixed(0)} → ${ecfSolute.toFixed(0)} mOsm; ICF ${icfSolute0.toFixed(0)} → ${icfSolute.toFixed(0)} mOsm`,
    `New effective osmolality = ${(ecfSolute + icfSolute).toFixed(0)} ÷ ${tbw.toFixed(1)} L = ${effOsm.toFixed(1)} mOsm/kg`,
    `ECF = ${ecfSolute.toFixed(0)} ÷ ${effOsm.toFixed(1)} = ${ecf.toFixed(2)} L;  ICF = ${icfSolute.toFixed(0)} ÷ ${effOsm.toFixed(1)} = ${icf.toFixed(2)} L`,
    i.urea ? `Urea (${i.urea} mmol) spreads through all ${tbw.toFixed(1)} L: +${ureaConc.toFixed(1)} mOsm/kg measured, no water moves` : '',
    icf0 - icf >= 0 ? `Water leaving cells: ${(icf0 - icf).toFixed(2)} L` : `Water entering cells: ${(icf - icf0).toFixed(2)} L`,
  ].filter(Boolean);
  return {
    tbw0,
    icf0,
    ecf0,
    tbw,
    icf,
    ecf,
    plasma: ecf * 0.25,
    interstitial: ecf * 0.75,
    effOsm,
    posm: effOsm + ureaConc,
    na,
    glucoseConc,
    ureaConc,
    shift: icf0 - icf,
    steps,
  };
}

// ------------------------------------------------------------------------------------------------
// Starling forces and the oedema safety factors

export type Organ = 'muscle' | 'lung' | 'liver';

export interface StarlingInput {
  organ: Organ;
  /** venous pressure, mmHg (normal ≈ 8 in the model) */
  venous: number;
  /** mean arterial pressure, mmHg */
  map: number;
  /** plasma albumin, g/L */
  albumin: number;
  /** capillary permeability to protein (1 = normal) */
  permeability: number;
  /** chronic (interstitial protein has adapted) vs acute hypoalbuminaemia */
  chronic: boolean;
  autoregulation: boolean;
  lymph: boolean;
  oncoticBuffer: boolean;
  pressureBuffer: boolean;
  /** baseline interstitial oncotic pressure in subcutaneous tissue/muscle, mmHg (8 in Table 7-2; 12–15 in some human studies) */
  interstitialOncotic: number;
}

export const STARLING_DEFAULT: StarlingInput = {
  organ: 'muscle',
  venous: 8,
  map: 93,
  albumin: 42,
  permeability: 1,
  chronic: true,
  autoregulation: true,
  lymph: true,
  oncoticBuffer: true,
  pressureBuffer: true,
  interstitialOncotic: 8,
};

/** Landis–Pappenheimer: oncotic pressure of plasma protein (c in g/dL, as in the original fit), including the Gibbs–Donnan excess. */
export const oncotic = (c: number) => 2.1 * c + 0.16 * c * c + 0.009 * c * c * c;

// Baseline values follow Table 7-2 (muscle and alveoli); the liver sinusoid is protein-permeable.
const ORGAN: Record<Organ, { pc: number; pi: number; pii: number; sigma: number }> = {
  muscle: { pc: 17.3, pi: -3, pii: 8, sigma: 0.95 },
  lung: { pc: 8, pi: -2, pii: 18, sigma: 0.75 },
  liver: { pc: 7, pi: 3, pii: 22, sigma: 0.05 },
};

export interface StarlingResult {
  pc: number;
  pi: number;
  pip: number;
  pii: number;
  sigma: number;
  /** net filtration pressure, mmHg */
  nfp: number;
  /** filtration relative to normal */
  jv: number;
  /** lymph flow relative to normal */
  lymph: number;
  /** interstitial volume relative to normal */
  volume: number;
  oedema: boolean;
  /** contributions of each safety factor, mmHg of opposing force added */
  safety: { lymph: number; oncotic: number; pressure: number };
}

export function starling(s: StarlingInput): StarlingResult {
  const o = ORGAN[s.organ];
  // total protein (g/dL for the fit) = albumin + ~30 g/L of globulins
  const pip0 = oncotic(4.2 + 3);
  const pip = oncotic(s.albumin / 10 + 3);
  // Arteriolar autoregulation keeps arterial pressure off the capillary; venous pressure is transmitted.
  const arterialShare = s.autoregulation ? 0.03 : 0.25;
  const pc = o.pc + 0.8 * (s.venous - 8) + arterialShare * (s.map - 93);
  const sigma = Math.max(0, Math.min(1, o.sigma / Math.pow(s.permeability, 0.8)));
  // Chronic hypoalbuminaemia: less protein leaks, so interstitial oncotic pressure falls in parallel.
  // It can fall only so far (to ~1 mmHg), so the gradient is lost once albumin is very low.
  const piiBase = s.organ === 'muscle' ? s.interstitialOncotic : o.pii;
  const adapt = s.chronic ? Math.min(piiBase - 1, 0.8 * Math.max(0, pip0 - pip)) : 0;
  const pii0 = (piiBase - adapt) * Math.min(3, Math.pow(s.permeability, 0.5));
  const nfp0 = o.pc - o.pi - o.sigma * (pip0 - piiBase);
  const kf = 1 / Math.max(0.3, nfp0);

  const at = (v: number) => {
    // interstitial hydraulic pressure: stiff while negative, very compliant once positive
    const pi = s.pressureBuffer ? (v < 1.12 ? o.pi + 4 * ((v - 1) / 0.12) : o.pi + 4 + 1.2 * (v - 1.12)) : o.pi;
    const piiWash = s.oncoticBuffer ? pii0 * Math.max(0.25, 1 - 1.6 * (v - 1)) : pii0;
    const pii = Math.max(0, piiWash);
    const jv = kf * (pc - pi - sigma * (pip - pii));
    const lymph = s.lymph ? Math.min(2.8, 1 + 15 * Math.max(0, v - 1)) : 1 + 1.5 * Math.max(0, v - 1);
    return { pi, pii, jv, lymph };
  };
  // interstitial volume settles where filtration equals lymph return
  let lo = 0.8;
  let hi = 4;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    const r = at(mid);
    if (r.jv > r.lymph) lo = mid;
    else hi = mid;
  }
  const v = (lo + hi) / 2;
  const r = at(v);
  const unbuffered = at(1);
  return {
    pc,
    pi: r.pi,
    pip,
    pii: r.pii,
    sigma,
    nfp: pc - r.pi - sigma * (pip - r.pii),
    jv: Math.max(0, r.jv),
    lymph: r.lymph,
    volume: v,
    oedema: v > 1.1,
    safety: {
      lymph: Math.max(0, r.lymph - 1),
      oncotic: Math.max(0, sigma * (unbuffered.pii - r.pii)),
      pressure: Math.max(0, r.pi - unbuffered.pi),
    },
  };
}
