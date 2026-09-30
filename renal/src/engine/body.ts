// Whole-body state: body fluid compartments, plasma composition, acid-base and the
// internal distribution of potassium.
//
// Rose ch. 7/9: the plasma Na concentration is set by the ratio of exchangeable solute
// (Na + K salts) to total body water, not by total body sodium (Edelman 1958).

import { clamp } from './math';
import type { Params, Plasma } from './types';

/** Landis–Pappenheimer: oncotic pressure of plasma protein, c in g/dL, with the Gibbs–Donnan excess. */
const oncotic = (c: number) => 2.1 * c + 0.16 * c * c + 0.009 * c * c * c;

/**
 * The transcapillary oncotic gradient in muscle and subcutaneous tissue, relative to normal, at a
 * given plasma albumin. This — not the plasma albumin itself — is what opposes filtration.
 *
 * The distinction matters, and it is the reason hypoalbuminaemia alone is a weaker cause of oedema
 * than it appears (Rose ch. 16, Fig. 16-3). Less albumin in the plasma means less entering the
 * interstitium, so interstitial oncotic pressure falls in parallel and the gradient is largely
 * preserved: nephrotic patients whose plasma albumin has halved can have a nearly normal
 * transcapillary gradient. The interstitial protein reservoir is finite, though — it can fall only
 * to about 1 mmHg — so once it is exhausted further falls are unopposed, which is why oedema
 * attributable to hypoalbuminaemia alone is mostly seen below about 1.5–2.0 g/dL.
 *
 * @param albuminGdl plasma albumin, g/dL (the engine's internal unit)
 * @param chronic    false for acute hypoalbuminaemia — rapid infusion of large volumes of saline,
 *                   where the interstitium has had no time to adapt, so the gradient falls at once
 *                   and oedema can appear before filling pressures are restored.
 */
export function oncoticGradientRel(albuminGdl: number, chronic = true) {
  const globulins = 3; // g/dL, roughly constant
  const reference = 4.0; // the engine's normal plasma albumin, so a normal body scores exactly 1
  const pip0 = oncotic(reference + globulins);
  const pip = oncotic(clamp(albuminGdl, 0.4, 6) + globulins);
  const pii0 = 8; // normal interstitial oncotic pressure, mmHg (Rose Table 16-1)
  const adapt = chronic ? Math.min(pii0 - 1, 0.8 * Math.max(0, pip0 - pip)) : 0;
  return clamp((pip - (pii0 - adapt)) / (pip0 - pii0), 0.05, 1.3);
}

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
  /** retained organic anions (lactate, ketoacid anions, formate, glycolate), mEq/L of ECF */
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
export function ecfVolume(b: BodyState, p: CompartmentParams) {
  return extracellular(b, p).ecf;
}

/** What the compartment calculation needs to know about the patient. */
export type CompartmentParams = Pick<Params, 'weightKg' | 'female' | 'glucose'>;

/** Exchangeable K⁺ of a normal body, mmol: about 45 mmol/kg in men, less in women (less water). */
export function normalKStore(p: Pick<Params, 'weightKg' | 'female'>) {
  return 44.85 * p.weightKg * (p.female ? 0.5 / 0.6 : 1);
}

/**
 * Sodium that has moved into cells in place of lost potassium, mmol.
 *
 * Cells losing K⁺ do not simply shrink their cation content: Na⁺ and H⁺ enter in its place
 * (Rose ch. 18, 27). The book gives no ratio; a third of the deficit replaced by Na⁺ is used here,
 * alongside a fifth by H⁺ (see the integrator). The sodium that enters is sodium the
 * extracellular fluid no longer has, so a K⁺ deficit contracts the ECF a little and the kidney
 * retains dietary NaCl to restore it. Leaving this out made every K⁺ loss — which the urine
 * carries largely as KCl — a pure chloride loss from the ECF, with nothing to replace it. The H⁺
 * third is applied to the bicarbonate pool in the integrator (it is the reason K⁺ depletion
 * generates and maintains a metabolic alkalosis).
 */
export const CELL_NA_PER_K = 1 / 3;
/** Share replaced by H⁺ (the rest leaves the cells with Cl⁻); see the integrator. */
export const CELL_H_PER_K = 0.2;
export function cellSodiumForPotassium(b: BodyState, p: Pick<Params, 'weightKg' | 'female'>) {
  return CELL_NA_PER_K * clamp(normalKStore(p) - b.kE, 0, 0.6 * normalKStore(p));
}

/** The engine's normal plasma glucose, mg/dL: glucose above it is excess extracellular solute. */
export const NORMAL_GLUCOSE = 95;

/**
 * Plasma sodium and ECF volume once any excess glucose has drawn water out of the cells.
 *
 * Without insulin, glucose enters most cells slowly, so a rise in its plasma level is a rise in
 * extracellular solute alone. Water follows it out of the cells until the osmolality is the same
 * on both sides: the extracellular fluid expands, its sodium is diluted, and the total osmolality
 * still ends up higher than before (Rose ch. 22, 25; Fig. 22-1). This is translocational
 * hyponatraemia, and it happens within minutes, before the kidney has done anything.
 *
 * It is solved here as an ideal two-compartment osmometer. The cells keep their solute, total
 * body water is fixed, and the glucose is confined to the ECF. That calculation is Katz's, and it
 * gives a fall of about 1.6–1.7 mmol/L of sodium for every 100 mg/dL (5.6 mmol/L) of glucose.
 * Hillier's clamp study (hillier1999) found the fall to be steeper above about 400 mg/dL, roughly
 * 2.4 per 100 mg/dL overall; the pages say that the model sits at the lower, physical figure.
 */
export function extracellular(b: BodyState, p: CompartmentParams) {
  const glucoseMgDl = p.glucose;
  const na0 = edelmanNa(b.naE, b.kE, b.tbw);
  const ecfNa = b.naE - NA_NON_ECF_PER_KG * p.weightKg - cellSodiumForPotassium(b, p);
  const v0 = clamp(ecfNa / Math.max(na0, 80), 0.08 * b.tbw, 0.75 * b.tbw);
  const g = Math.max(0, (glucoseMgDl - NORMAL_GLUCOSE) / 18); // excess glucose, mmol/L of ECF
  if (g < 1e-6) return { na: na0, ecf: v0, shifted: 0 };
  const t = Math.max(b.tbw, 1);
  const s0 = 2 * na0; // effective osmolality carried by the cations before the glucose
  // Glucose mass M in the ECF such that, after water has moved, its concentration there is g:
  //   g (s0 v0 + M) = M (s0 + M / t)   ⇒   M²/t + M (s0 − g) − g s0 v0 = 0
  const m = (t / 2) * (-(s0 - g) + Math.sqrt((s0 - g) * (s0 - g) + (4 * g * s0 * v0) / t));
  const osm = s0 + m / t;
  const v = clamp((s0 * v0 + m) / osm, 0.08 * b.tbw, 0.75 * b.tbw);
  return { na: (na0 * v0) / v, ecf: v, shifted: v - v0 };
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
  // Insulin is permissive in one direction and therapeutic in the other. Its absence raises the
  // plasma K⁺ only modestly, about 0.4–0.5 mmol/L, because the kidney excretes the excess (Rose
  // ch. 12); a pharmacological dose drives K⁺ into cells hard enough to lower it by 0.5–1.5
  // (Rose ch. 28). A single logarithmic gain made severe insulin deficiency raise the K⁺ by 2.5
  // and the kidney then wasted a thousand mmol in two days of ketoacidosis.
  const insulinEffect = clamp(p.insulin + p.drugs.insulinDrip, 0.05, 5);
  const insulinShift = insulinEffect < 1 ? -0.3 * Math.log(insulinEffect) : -1.1 * Math.log(insulinEffect);
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
/**
 * Arterial PCO2, from the ventilatory response to pH.
 *
 * The obvious implementation — Rose's empirical rule, PCO2 = 40 + 1.2 × (HCO3 − 24) for acidosis
 * and 0.7 × for alkalosis — is written in terms of bicarbonate, and that turns into positive
 * feedback the moment the primary disturbance is respiratory. A primary hypocapnia lowers the
 * bicarbonate through renal compensation; the rule reads that fall as a metabolic acidosis and
 * lowers the PCO2 further; the bicarbonate falls again. The model ran away to a bicarbonate of 6.
 *
 * The respiratory centre responds to pH, not to bicarbonate, so that is what is modelled here and
 * solved self-consistently (PCO2 appears on both sides). The gain is asymmetric — acidaemia drives
 * ventilation harder than alkalaemia suppresses it, since hypoventilation is limited by hypoxia —
 * and the two gains are chosen to reproduce Rose's empirical rules for the metabolic disorders:
 * a bicarbonate of 12 gives a PCO2 near 26, and a bicarbonate of 34 gives one near 47.
 *
 * `paco2Offset` is then a primary change in ventilatory drive rather than a guaranteed change in
 * the PCO2 achieved: the resulting acidaemia or alkalaemia pushes back through the same reflex, so
 * the PCO2 moves by rather less than the offset. That is what happens in a patient too.
 */
export function acuteBufferShift(pco2: number) {
  const d = pco2 - 40;
  return d > 0 ? 0.1 * d : 0.2 * d;
}

export function respiratoryPCO2(hco3Stored: number, p: Params) {
  // pH falls as PCO2 rises, and the drive falls with it, so `want(mid) − mid` decreases
  // monotonically and a bisection converges on the single crossing.
  let lo = 5;
  let hi = 150;
  for (let i = 0; i < 44; i++) {
    const mid = 0.5 * (lo + hi);
    const pH = 6.1 + Math.log10(Math.max(hco3Stored + acuteBufferShift(mid), 1) / (0.03 * mid));
    const gain = pH < 7.4 ? 4.2 : 2.0;
    const want = 40 * Math.exp(gain * (pH - 7.4)) + p.paco2Offset;
    if (want > mid) lo = mid;
    else hi = mid;
  }
  return clamp(0.5 * (lo + hi), 8, 130);
}

/** Negative charge on albumin, mEq/L per g/dL — most of the normal anion gap (Rose ch. 19). */
export const NORMAL_GAP_PER_ALBUMIN = 2.43;

/** Share of an accumulated organic anion that displaces chloride rather than bicarbonate. */
export const ORGANIC_CL_DISPLACEMENT = 0.4;

export interface PlasmaDerived extends Plasma {
  anionGap: number;
  normalAnionGap: number;
  agCorrected: number;
  deltaRatio: number;
  osmolalGap: number;
  ecf: number;
  plasmaVolume: number;
  pvRel: number;
  ionizedCa: number;
}

export function derivePlasma(b: BodyState, p: Params): PlasmaDerived {
  // Sodium diluted by any water that excess glucose has drawn out of the cells.
  const shifted = extracellular(b, p);
  const na = shifted.na;
  const pco2 = respiratoryPCO2(b.hco3, p);
  // b.hco3 is the metabolic pool the kidney adjusts; what a blood gas reports also includes the
  // immediate non-renal buffering of the prevailing PCO2.
  const hco3Plasma = clamp(b.hco3 + acuteBufferShift(pco2), 2, 60);
  const { pH } = acidBase(hco3Plasma, pco2);
  const glucose = p.glucose;
  // Effective osmolality (tonicity): urea is an ineffective osmole.
  const effOsm = 2 * na + glucose / 18;
  const k = plasmaPotassium(b.kE, p.weightKg, p, pH, effOsm);
  const bunOsm = b.bun / 2.8;
  const osm = effOsm + bunOsm + p.toxicAlcoholOsm;
  // Total ECF includes any oedema; what supports the circulation is the rest of it.
  const ecf = shifted.ecf;
  const circulatingEcf = Math.max(ecf - b.edema, 0.3 * ecf);
  const albumin = clamp(p.albumin - 0.8 * clamp(p.proteinuria / 8, 0, 1), 1, 5.5);
  // Plasma chloride. This model tracks chloride by mass balance — intake, gastrointestinal loss
  // and what the kidney excretes — rather than deriving it from extracellular electroneutrality,
  // because chloride has to be free to be a cause: it is the chloride, not the volume, that a
  // chloride-depletion alkalosis needs back (Rose ch. 18). The price is that the model's plasma
  // chloride is stiffer than a patient's. Where a retained acid has no anion of its own to leave
  // behind — distal and type 4 renal tubular acidosis, an ammonium chloride load, diarrhoea — a
  // real patient replaces the lost bicarbonate with chloride and keeps a normal anion gap; here
  // chloride moves only part of the way, so the calculated gap runs several mEq/L high. The urine
  // anion gap, which is the test the chapter actually teaches for these disorders, is reproduced.
  //
  // An organic anion that has accumulated occupies part of the extracellular anion space. Most of
  // it is matched by the bicarbonate its acid consumed; the rest — the part whose H⁺ was buffered
  // inside cells, so that the bicarbonate fell by less — has to displace chloride to keep the fluid
  // electroneutral. That is what makes the anion gap rise by more than the bicarbonate falls in
  // lactic acidosis (Rose ch. 19). Displacing chloride by the whole anion counted it twice: the
  // ketoacidosis gap ran near 45, and when insulin cleared the ketones the chloride came back on top
  // of the regenerated bicarbonate, driving the gap negative.
  const cl = clamp(b.clE / Math.max(ecf, 1) - ORGANIC_CL_DISPLACEMENT * clamp(b.organicAnions, 0, 45), 60, 130);
  // Computed on the reported plasma bicarbonate, as a laboratory would.
  const anionGap = na - cl - hco3Plasma;
  const agCorrected = anionGap + 2.5 * (4 - albumin);
  // Rose ch. 19: the Δ anion gap / Δ bicarbonate ratio needs a baseline gap, and that baseline
  // has to be adjusted downwards in hypoalbuminaemia — about 2.5 mEq/L for every 1 g/dL — or the
  // rise in the gap is underestimated. Stating the normal gap as the albumin charge does both at
  // once, and lands on this model's own normal gap of 9.7 at an albumin of 4.0 g/dL.
  const normalAnionGap = clamp(NORMAL_GAP_PER_ALBUMIN * albumin, 2, 16);
  const deltaRatio = hco3Plasma < 23 ? (anionGap - normalAnionGap) / Math.max(24 - hco3Plasma, 0.1) : 0;
  const calcOsm = 2 * na + glucose / 18 + b.bun / 2.8;
  const plasmaVolumeNormal = p.weightKg * 0.043;
  const oncoticHold = oncoticGradientRel(albumin);
  const plasmaVolume = clamp(circulatingEcf * 0.215 * (0.55 + 0.45 * oncoticHold) * (1 - 0.5 * clamp(p.capillaryLeak, 0, 0.8)), 0.8, 8);
  const ionizedCa = clamp(b.ca * 0.5 * (1 + 0.15 * (7.4 - pH) / 0.1), 0.5, 2.0);

  return {
    Na: na,
    K: k,
    Cl: cl,
    HCO3: hco3Plasma,
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
    normalAnionGap,
    agCorrected,
    deltaRatio,
    osmolalGap: osm - calcOsm,
    ecf,
    plasmaVolume,
    pvRel: plasmaVolume / plasmaVolumeNormal,
    ionizedCa,
  };
}
