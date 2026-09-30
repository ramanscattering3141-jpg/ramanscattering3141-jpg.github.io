// Buffer chemistry for Rose & Post chapters 10 and 11: the open bicarbonate system, the
// non-bicarbonate buffers of cells and bone, and where an acid or base load actually ends up.

/** [H+] in nanomol/L from the bicarbonate system (the clinical form of Henderson–Hasselbalch). */
export const hFromHco3 = (hco3: number, pco2: number) => (24 * pco2) / Math.max(hco3, 0.5);
export const pHFrom = (hco3: number, pco2: number) => 6.1 + Math.log10(Math.max(hco3, 0.1) / (0.03 * Math.max(pco2, 1)));
export const hco3From = (pH: number, pco2: number) => 0.03 * pco2 * Math.pow(10, pH - 6.1);

export interface LoadInput {
  /** mmol/kg of strong acid (+) or base (−) added */
  load: number;
  weightKg: number;
  /** starting plasma bicarbonate, mmol/L */
  hco3: number;
  /** if true the PCO2 is held (ventilated, or the closed-system thought experiment) */
  fixedPco2: boolean;
  /** the PCO2 held, or the starting one */
  pco2: number;
  /** allow the respiratory response (Winter's) to act */
  respiratoryCompensation: boolean;
  /** allow cells and bone to take part */
  cellBuffering: boolean;
}

export const LOAD_DEFAULT: LoadInput = {
  load: 0,
  weightKg: 70,
  hco3: 24,
  fixedPco2: false,
  pco2: 40,
  respiratoryCompensation: true,
  cellBuffering: true,
};

export interface LoadResult {
  /** total mmol of acid added */
  mmol: number;
  /** share taken up by extracellular bicarbonate */
  extracellular: number;
  /** share taken up by cells and bone */
  cellular: number;
  hco3: number;
  pco2: number;
  pH: number;
  h: number;
  /** plasma K+ shift from the transcellular exchange, mmol/L */
  kShift: number;
  /** what the pH would have been with no buffering at all */
  pHUnbuffered: number;
}

/**
 * Where an acid load goes. Rose ch. 10: about 43% of an acute acid load is taken up by
 * extracellular bicarbonate and 57% by cells and bone, the latter share rising as the plasma
 * bicarbonate falls (cells and bone have an almost limitless capacity, extracellular bicarbonate
 * does not).
 */
export function acidLoad(i: LoadInput): LoadResult {
  const mmol = i.load * i.weightKg;
  const ecfVolume = i.weightKg * 0.2; // L
  const tbw = i.weightKg * 0.6;
  // The extracellular share falls as bicarbonate is consumed: with little left, cells and bone
  // must take more. At a normal bicarbonate the split is ~43/57.
  const ecfShare = i.cellBuffering ? Math.max(0.12, 0.43 * Math.min(1, i.hco3 / 24)) : 1;
  const extracellular = mmol * ecfShare;
  const cellular = mmol - extracellular;
  const hco3 = Math.max(1, i.hco3 - extracellular / ecfVolume);
  // Respiratory compensation: Winter's relation for acidosis, the 0.7 rule for alkalosis.
  const compensated = hco3 < 24 ? 1.5 * hco3 + 8 : 40 + 0.7 * (hco3 - 24);
  const pco2 = i.fixedPco2 ? i.pco2 : i.respiratoryCompensation ? Math.max(10, Math.min(70, compensated)) : i.pco2;
  const pH = pHFrom(hco3, pco2);
  // Acidaemia moves K+ out of cells with the H+ that enters them; the effect is larger for
  // mineral (non-organic) acids, and is the reverse in alkalaemia (Rose ch. 10, 12).
  const kShift = i.cellBuffering ? (cellular / Math.max(tbw, 1)) * 0.11 : 0;
  const pHUnbuffered = i.load === 0 ? pHFrom(i.hco3, i.pco2) : pHFrom(Math.max(0.05, i.hco3 - mmol / ecfVolume), i.pco2);
  return { mmol, extracellular, cellular, hco3, pco2, pH, h: hFromHco3(hco3, pco2), kShift, pHUnbuffered };
}

/**
 * How much strong acid a litre of the bicarbonate system can absorb before [H+] reaches a target,
 * with the PCO2 either allowed to rise (closed) or held (open). This is the book's eleven-fold
 * demonstration of why an open buffer system is so much more powerful.
 */
export function bufferCapacity(hco3: number, pco2: number, targetH: number, open: boolean) {
  const co2 = 0.03 * pco2;
  if (open) {
    // [H+] = 800 * co2 / (hco3 - x)  ->  x = hco3 - 800*co2/targetH
    return Math.max(0, hco3 - (800 * co2) / targetH);
  }
  // Closed: every mmol of HCO3- consumed appears as dissolved CO2.
  // targetH = 800 * (co2 + x) / (hco3 - x)
  return Math.max(0, (targetH * hco3 - 800 * co2) / (targetH + 800));
}

export interface TitrationPoint {
  added: number;
  pH: number;
}

/** Titration curve of a weak-acid buffer (the phosphate example in Fig. 10-2). */
export function titration(pKa: number, totalBuffer: number, from = -20, to = 20, step = 0.5): TitrationPoint[] {
  const out: TitrationPoint[] = [];
  for (let added = from; added <= to; added += step) {
    // start half-titrated, so pH = pKa at zero added acid
    const acid = totalBuffer / 2 + added;
    const base = totalBuffer / 2 - added;
    if (acid <= 0.01 || base <= 0.01) continue;
    out.push({ added, pH: pKa + Math.log10(base / acid) });
  }
  return out;
}
