// Whole-body state: body fluid compartments, plasma composition, acid-base and the
// internal distribution of potassium.
//
// Rose ch. 7/9: the plasma Na concentration is set by the ratio of exchangeable solute
// (Na + K salts) to total body water, not by total body sodium (Edelman 1958).

import { clamp } from './math';
import type { Params, Plasma } from './types';

export interface BodyState {
  /** exchangeable sodium, mmol */
  naE: number;
  /** exchangeable potassium, mmol */
  kE: number;
  /** total body water, L */
  tbw: number;
  /** legacy field, no longer used: the ECF volume is derived from extracellular sodium (see ecfVolume) */
  ecfFraction: number;
  /** total body bicarbonate stores expressed as ECF [HCO3], mmol/L */
  hco3: number;
  /** unmeasured organic anions (lactate, ketones, toxins), mmol/L of ECF */
  organicAnions: number;
  /** total body chloride, mmol */
  clE: number;
  /** serum creatinine, mg/dL */
  creat: number;
  /** blood urea nitrogen, mg/dL */
  bun: number;
  /** plasma phosphate, mmol/L */
  pi: number;
  /** total calcium, mmol/L */
  ca: number;
  /** magnesium, mmol/L */
  mg: number;
  /** interstitial fluid sequestered as oedema/ascites, L */
  edema: number;
}

// Edelman 1958 regression: [Na]p = 1.11 x (Na_e + K_e)/TBW - 25.6
export const EDELMAN_SLOPE = 1.11;
export const EDELMAN_INTERCEPT = -25.6;

/** Normal starting state for a 70 kg adult. */
export function initialBody(p: Params): BodyState {
  // The stores are the ones the model itself settles at on a normal diet (150 mmol Na+, 80 mmol
  // K+ a day), so a scenario does not open with a transient of the model's own making. Women
  // have less body water per kg and proportionally smaller exchangeable stores, so the same
  // plasma Na+ (Edelman).
  const waterScale = p.female ? 0.5 / 0.6 : 1;
  const tbw = p.weightKg * 0.5969 * waterScale;
  const naE = 43.69 * p.weightKg * waterScale; // exchangeable Na, mmol
  const kE = 44.85 * p.weightKg * waterScale;
  return {
    naE,
    kE,
    tbw,
    ecfFraction: 1 / 3,
    hco3: 23.6,
    organicAnions: 0,
    clE: 105.8 * (tbw / 3),
    // The starting creatinine is the level this model settles at for a normal adult, so a
    // scenario does not open with a spurious creatinine transient of its own.
    creat: p.female ? 0.58 : 0.66,
    bun: 13.2,
    pi: 1.15,
    ca: 2.35,
    mg: 0.85,
    edema: 0,
  };
}

/**
 * Exchangeable sodium that is not in the extracellular fluid (cell and bone surface), mmol/kg.
 * About 44 mmol/kg of sodium is exchangeable; ~28 of it is extracellular (14 L × 140 mmol/L).
 */
export const NA_NON_ECF_PER_KG = 16;

/**
 * Extracellular volume from extracellular sodium. Sodium is effectively confined to the
 * extracellular fluid, so the ECF volume is its sodium content divided by its concentration
 * (Rose ch. 7–8). This is why losing isotonic fluid shrinks the ECF litre for litre, while
 * losing pure water shrinks it only by the ECF's share of body water.
 */
export function ecfVolume(b: BodyState, weightKg: number) {
  const na = edelmanNa(b.naE, b.kE, b.tbw);
  return clamp((b.naE - NA_NON_ECF_PER_KG * weightKg) / Math.max(na, 80), 0.08 * b.tbw, 0.75 * b.tbw);
}

/**
 * Serum sodium from exchangeable cation / total body water (Edelman regression).
 * This is the relationship that makes "total body sodium" and "serum sodium" different things.
 */
export function edelmanNa(naE: number, kE: number, tbw: number) {
  return EDELMAN_SLOPE * ((naE + kE) / Math.max(tbw, 1)) + EDELMAN_INTERCEPT;
}

/** Internal K distribution: insulin, β2 tone, tonicity and pH move K across cell membranes. */
export function plasmaPotassium(kE: number, weightKg: number, p: Params, pH: number, effOsm: number) {
  const totalNormal = 45 * weightKg;
  const storeRatio = clamp(kE / totalNormal, 0.35, 1.8);
  // Roughly 1 mmol/L plasma change per ~200-400 mmol total body deficit in the mid range
  const k = 4.2 * Math.pow(storeRatio, 2.1);
  const insulinShift = -1.1 * Math.log(clamp(p.insulin + p.drugs.insulinDrip, 0.1, 5));
  const betaShift = -0.55 * Math.log(clamp(p.beta2 + 1.5 * p.drugs.albuterol, 0.1, 5)) + 0.35 * p.drugs.betaBlocker;
  // Mineral acidosis shifts K out of cells (~0.6 mmol/L per 0.1 pH); organic acidoses much less.
  const mineralFraction = clamp(1 - p.lacticAcid / 8 - p.ketoAcid / 8, 0, 1);
  const pHShift = 0.6 * mineralFraction * ((7.4 - pH) / 0.1);
  const tonicityShift = 0.35 * clamp((effOsm - 285) / 10, -1.5, 4);
  return clamp(k + insulinShift + betaShift + pHShift + tonicityShift, 1.2, 9.5);
}

/** Henderson–Hasselbalch; [H+] in nmol/L = 24 × PCO2 / [HCO3] (Rose ch. 17). */
export function acidBase(hco3: number, pco2: number) {
  const h = (24 * pco2) / Math.max(hco3, 1);
  const pH = 6.1 + Math.log10(Math.max(hco3, 0.5) / (0.03 * Math.max(pco2, 5)));
  return { pH: clamp(pH, 6.5, 7.9), hPlus: h };
}

/**
 * Respiratory response. Metabolic acidosis: PCO2 falls 1.2 mmHg per 1 mmol/L fall in HCO3;
 * metabolic alkalosis: PCO2 rises 0.7 per 1 mmol/L rise (Rose Table 17-3). A primary
 * respiratory disturbance is applied as an offset.
 */
export function respiratoryPCO2(hco3: number, p: Params) {
  const delta = hco3 - 24;
  const compensated = 40 + (delta < 0 ? 1.2 * delta : 0.7 * delta);
  return clamp(compensated + p.paco2Offset, 8, 130);
}

export interface PlasmaDerived extends Plasma {
  anionGap: number;
  agCorrected: number;
  deltaRatio: number;
  osmolalGap: number;
  ecf: number;
  plasmaVolume: number;
  pvRel: number;
  ionizedCa: number;
}

export function derivePlasma(b: BodyState, p: Params): PlasmaDerived {
  const na = edelmanNa(b.naE, b.kE, b.tbw);
  const pco2 = respiratoryPCO2(b.hco3, p);
  const { pH } = acidBase(b.hco3, pco2);
  const glucose = p.glucose;
  // Effective osmolality (tonicity): urea is an ineffective osmole.
  const effOsm = 2 * na + glucose / 18;
  const k = plasmaPotassium(b.kE, p.weightKg, p, pH, effOsm);
  const bunOsm = b.bun / 2.8;
  const osm = effOsm + bunOsm + p.toxicAlcoholOsm;
  // Total ECF includes any oedema; what supports the circulation is the rest of it.
  const ecf = ecfVolume(b, p.weightKg);
  const circulatingEcf = Math.max(ecf - b.edema, 0.3 * ecf);
  const cl = clamp(b.clE / Math.max(ecf, 1), 60, 130);
  const anionGap = na - cl - b.hco3;
  const albumin = clamp(p.albumin - 0.8 * clamp(p.proteinuria / 8, 0, 1), 1, 5.5);
  const agCorrected = anionGap + 2.5 * (4 - albumin);
  const deltaRatio = b.hco3 < 23 ? (agCorrected - 12) / Math.max(24 - b.hco3, 0.1) : 0;
  const calcOsm = 2 * na + glucose / 18 + b.bun / 2.8;
  const plasmaVolumeNormal = p.weightKg * 0.043;
  const oncoticHold = clamp(albumin / 4, 0.45, 1.3);
  const plasmaVolume = clamp(circulatingEcf * 0.215 * (0.55 + 0.45 * oncoticHold) * (1 - 0.5 * clamp(p.capillaryLeak, 0, 0.8)), 0.8, 8);
  const ionizedCa = clamp(b.ca * 0.5 * (1 + 0.15 * (7.4 - pH) / 0.1), 0.5, 2.0);

  return {
    Na: na,
    K: k,
    Cl: cl,
    HCO3: b.hco3,
    glucose,
    BUN: b.bun,
    creat: b.creat,
    Pi: b.pi,
    Ca: b.ca,
    Mg: b.mg,
    albumin,
    pH,
    PCO2: pco2,
    organicAnions: b.organicAnions,
    osm,
    effOsm,
    mannitol: 0,
    anionGap,
    agCorrected,
    deltaRatio,
    osmolalGap: osm - calcOsm,
    ecf,
    plasmaVolume,
    pvRel: plasmaVolume / plasmaVolumeNormal,
    ionizedCa,
  };
}
