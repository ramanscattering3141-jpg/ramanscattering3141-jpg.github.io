// Shared types for the integrated renal / whole-body physiology engine.
//
// Conventions
//   flows:          mL/min (renal), L/day (whole body)
//   concentrations: mmol/L (mEq/L for monovalent ions); glucose & BUN & creatinine in mg/dL
//                   internally, as in Rose & Post — the UI converts everything to SI (see src/units.ts)
//   renal loads:    mmol/min (creatinine mg/min, glucose mg/min)
//   hormones:       dimensionless "relative to normal" (1 = normal) unless stated

export type SegmentId = 'PT' | 'DTL' | 'ATL' | 'TAL' | 'DCT' | 'CNT' | 'CCD' | 'OMCD' | 'IMCD';

export const SEGMENTS: SegmentId[] = ['PT', 'DTL', 'ATL', 'TAL', 'DCT', 'CNT', 'CCD', 'OMCD', 'IMCD'];

export type SoluteId =
  | 'Na'
  | 'K'
  | 'Cl'
  | 'HCO3'
  | 'glucose'
  | 'aa'
  | 'urea'
  | 'Pi'
  | 'Ca'
  | 'Mg'
  | 'creat'
  | 'NH4'
  | 'water';

export const SOLUTES: SoluteId[] = ['Na', 'K', 'Cl', 'HCO3', 'glucose', 'aa', 'urea', 'Pi', 'Ca', 'Mg', 'creat', 'NH4', 'water'];

/** Transporter / channel activity multipliers. 1 = normal, 0 = absent, >1 = gain of function. */
export interface Transporters {
  NHE3: number;
  CA: number; // carbonic anhydrase (proximal)
  NBCe1: number; // basolateral Na-3HCO3 (proximal); defect = proximal RTA
  SGLT2: number;
  SGLT1: number;
  NaPi2: number;
  AAtransport: number; // Na-amino acid cotransport (Fanconi when low)
  OCT2: number; // organic cation secretion (creatinine)
  AQP1: number;
  NKCC2: number;
  ROMK: number;
  ClCKb: number; // basolateral Cl channel / barttin
  claudin16: number; // paracellular Ca/Mg (TAL)
  CaSR: number; // calcium-sensing receptor gain (>1 = activating, ADH-like hypocalcemia)
  NCC: number;
  TRPV5: number;
  TRPM6: number;
  ENaC: number;
  BK: number;
  HATPase: number; // alpha-intercalated cell H-ATPase (distal RTA when low)
  pendrin: number;
  HKATPase: number;
  AQP2: number;
  V2R: number;
  UTA: number; // IMCD urea transporters UT-A1/A3
  RhCG: number; // collecting duct NH3 transport
  NaKATPase: number; // whole-epithelium pump capacity
}

export interface Drugs {
  furosemide: number; // 0..1 intensity of NKCC2 blockade (dose-dependent)
  thiazide: number;
  acetazolamide: number;
  amiloride: number; // ENaC blocker (also triamterene)
  spironolactone: number; // MR antagonist
  mannitol: number; // g/day infused
  sglt2i: number;
  acei: number;
  arb: number;
  aliskiren: number;
  nsaid: number;
  betaBlocker: number;
  ccb: number; // dihydropyridine afferent dilator
  trimethoprim: number; // ENaC + creatinine secretion blocker
  lithium: number; // blunts AQP2 (NDI)
  tolvaptan: number; // V2 antagonist
  desmopressin: number; // V2 agonist, pg/mL-equivalent ADH floor
  fludrocortisone: number; // MR agonist, aldo-equivalent units
  albuterol: number;
  insulinDrip: number; // extra insulin effect (0..3)
  sodiumBicarbonate: number; // oral/IV mEq/day
  potassiumChloride: number; // mEq/day
  potassiumCitrate: number; // mEq/day
}

export interface Params {
  // --- Patient
  weightKg: number;
  female: boolean;
  ageY: number;
  muscleMass: number; // relative (creatinine generation)
  // --- Intake (per day)
  naIntake: number; // mEq/d
  kIntake: number; // mEq/d
  waterIntake: number; // L/d (drinking, before thirst)
  thirstIntact: boolean;
  proteinIntake: number; // g/d
  extraAcid: number; // mEq/d (e.g. NH4Cl load)
  // --- Losses (per day)
  vomiting: number; // L/d gastric fluid
  diarrhea: number; // L/d secretory stool
  insensible: number; // L/d
  // --- IV fluids (per day)
  ivNS: number; // L/d 0.9% saline
  ivD5W: number; // L/d
  ivHypertonic: number; // L/d 3% saline
  // --- Systemic
  cardiacFunction: number; // 1 normal; <1 heart failure
  vasodilation: number; // 0..0.6 splanchnic/systemic (cirrhosis, sepsis)
  portalHypertension: number; // 0..1 ascites sequestration tendency
  capillaryLeak: number; // 0..1
  albumin: number; // g/dL
  venousCongestion: number; // mmHg added to renal venous pressure
  paco2Offset: number; // mmHg primary respiratory disturbance (+ hypoventilation)
  respChronic: boolean; // informational: renal compensation develops over days in the dynamic model
  insulin: number; // relative
  beta2: number; // relative adrenergic tone on K uptake
  glucocorticoid: number; // 1 normal, 0 absent (adrenal insufficiency)
  glucose: number; // mg/dL plasma (clamped by user)
  lacticAcid: number; // mEq/h production of an organic acid (lactate)
  ketoAcid: number; // mEq/h
  toxicAcid: number; // mEq/h (formate/glycolate; not metabolized)
  toxicAlcoholOsm: number; // mOsm/kg added to plasma (osmolal gap)
  // --- Hormone control
  adhAutonomous: number; // pg/mL floor independent of osmolality (SIADH)
  adhNonosmotic: number; // 0..1 nausea/pain/drugs
  centralDI: number; // 0..1 loss of ADH secretion
  osmostatShift: number; // mOsm/kg shift of osmotic threshold (reset osmostat)
  aldoAutonomous: number; // relative aldo floor (primary aldosteronism)
  aldoSynthesis: number; // 1 normal; 0 = adrenal/aldosterone deficiency
  cortisolMR: number; // 0..1 cortisol access to MR (AME / licorice)
  reninAutonomous: number; // relative renin floor (renin-secreting tumor)
  snsOverride: number; // multiplier on sympathetic tone
  pthMode: 'auto' | 'high' | 'low';
  // --- Renal structure / disease
  nephronFraction: number; // 0.05..1 both kidneys
  stenosisL: number; // 0..0.95 lumen reduction
  stenosisR: number;
  obstructionL: number; // 0..1
  obstructionR: number;
  obstructionChronic: boolean;
  /** mmHg; 0 = off. A servo-controlled aortic occluder that stops renal perfusion pressure rising above this (Hall 1984; Rose Fig. 8-9) */
  renalPressureClamp: number;
  tubularInjury: number; // 0..1 (ATN)
  kfFactor: number; // glomerular surface area / permeability (GN < 1)
  proteinuria: number; // g/day
  afferentTone: number; // manual multiplier
  efferentTone: number; // manual multiplier
  myogenic: number; // 0..1
  tgf: number; // 0..1
  distalAdaptation: number; // 1..2 hypertrophy after chronic loop diuretic
  // --- Molecules
  transporters: Transporters;
  drugs: Drugs;
}

export const DEFAULT_TRANSPORTERS: Transporters = {
  NHE3: 1,
  CA: 1,
  NBCe1: 1,
  SGLT2: 1,
  SGLT1: 1,
  NaPi2: 1,
  AAtransport: 1,
  OCT2: 1,
  AQP1: 1,
  NKCC2: 1,
  ROMK: 1,
  ClCKb: 1,
  claudin16: 1,
  CaSR: 1,
  NCC: 1,
  TRPV5: 1,
  TRPM6: 1,
  ENaC: 1,
  BK: 1,
  HATPase: 1,
  pendrin: 1,
  HKATPase: 1,
  AQP2: 1,
  V2R: 1,
  UTA: 1,
  RhCG: 1,
  NaKATPase: 1,
};

export const DEFAULT_DRUGS: Drugs = {
  furosemide: 0,
  thiazide: 0,
  acetazolamide: 0,
  amiloride: 0,
  spironolactone: 0,
  mannitol: 0,
  sglt2i: 0,
  acei: 0,
  arb: 0,
  aliskiren: 0,
  nsaid: 0,
  betaBlocker: 0,
  ccb: 0,
  trimethoprim: 0,
  lithium: 0,
  tolvaptan: 0,
  desmopressin: 0,
  fludrocortisone: 0,
  albuterol: 0,
  insulinDrip: 0,
  sodiumBicarbonate: 0,
  potassiumChloride: 0,
  potassiumCitrate: 0,
};

export const DEFAULT_PARAMS: Params = {
  weightKg: 70,
  female: false,
  ageY: 40,
  muscleMass: 1,
  naIntake: 150,
  kIntake: 80,
  waterIntake: 2.0,
  thirstIntact: true,
  proteinIntake: 80,
  extraAcid: 0,
  vomiting: 0,
  diarrhea: 0,
  insensible: 0.8,
  ivNS: 0,
  ivD5W: 0,
  ivHypertonic: 0,
  cardiacFunction: 1,
  vasodilation: 0,
  portalHypertension: 0,
  capillaryLeak: 0,
  albumin: 4.0,
  venousCongestion: 0,
  paco2Offset: 0,
  respChronic: true,
  insulin: 1,
  beta2: 1,
  glucocorticoid: 1,
  glucose: 95,
  lacticAcid: 0,
  ketoAcid: 0,
  toxicAcid: 0,
  toxicAlcoholOsm: 0,
  adhAutonomous: 0,
  adhNonosmotic: 0,
  centralDI: 0,
  osmostatShift: 0,
  aldoAutonomous: 0,
  aldoSynthesis: 1,
  cortisolMR: 0,
  reninAutonomous: 0,
  snsOverride: 1,
  pthMode: 'auto',
  nephronFraction: 1,
  stenosisL: 0,
  stenosisR: 0,
  obstructionL: 0,
  obstructionR: 0,
  obstructionChronic: false,
  tubularInjury: 0,
  kfFactor: 1,
  proteinuria: 0.1,
  afferentTone: 1,
  efferentTone: 1,
  myogenic: 1,
  tgf: 1,
  distalAdaptation: 1,
  renalPressureClamp: 0,
  transporters: { ...DEFAULT_TRANSPORTERS },
  drugs: { ...DEFAULT_DRUGS },
};

export function cloneParams(p: Params): Params {
  return { ...p, transporters: { ...p.transporters }, drugs: { ...p.drugs } };
}

/** Deep-ish merge of a partial parameter patch (transporters & drugs merged key-wise). */
export interface ParamPatch extends Partial<Omit<Params, 'transporters' | 'drugs'>> {
  transporters?: Partial<Transporters>;
  drugs?: Partial<Drugs>;
}

export function applyPatch(base: Params, patch: ParamPatch): Params {
  const out = cloneParams(base);
  const { transporters, drugs, ...rest } = patch;
  Object.assign(out, rest);
  if (transporters) Object.assign(out.transporters, transporters);
  if (drugs) Object.assign(out.drugs, drugs);
  return out;
}

/** Plasma composition used as the input to the kidney. */
export interface Plasma {
  Na: number;
  K: number;
  Cl: number;
  HCO3: number;
  glucose: number; // mg/dL
  BUN: number; // mg/dL
  creat: number; // mg/dL
  Pi: number; // mmol/L (x3.1 = mg/dL)
  Ca: number; // total mmol/L
  Mg: number; // mmol/L
  albumin: number; // g/dL
  pH: number;
  PCO2: number;
  organicAnions: number; // mmol/L unmeasured anions above baseline (AG contributors)
  osm: number; // measured plasma osmolality mOsm/kg
  effOsm: number; // effective (tonicity)
  mannitol: number; // mmol/L
}

export interface Hormones {
  /** plasma renin activity, relative */
  renin: number;
  angI: number;
  angII: number;
  /** AT1-receptor signalling (angII after ARB) */
  at1: number;
  aldo: number;
  /** mineralocorticoid-receptor activation (aldo x (1-MRA) + cortisol/fludrocortisone) */
  mr: number;
  adh: number; // pg/mL
  /** collecting-duct water permeability (0..1) */
  aqp2: number;
  sns: number;
  anp: number;
  pg: number; // renal vasodilator prostaglandin level
  pth: number;
  calcitriol: number;
  fgf23: number;
  insulin: number;
}

export interface SegmentFlux {
  /** amount delivered into the segment (mmol/min; water mL/min; glucose & creat mg/min) */
  in: Record<SoluteId, number>;
  /** amount leaving the segment */
  out: Record<SoluteId, number>;
  /** tubular fluid osmolality leaving the segment */
  osmOut: number;
}

export interface KidneySide {
  GFR: number;
  RPF: number;
  RBF: number;
  FF: number;
  Pgc: number;
  Pptc: number;
  piEff: number;
  Pa: number;
  Ra: number;
  Re: number;
  Kf: number;
  Pbs: number;
  nephrons: number;
  mdSignal: number;
  urineFlow: number; // mL/min
}

export interface Urine {
  flow: number; // mL/min
  volumePerDay: number; // L/day
  osm: number;
  Na: number; // mmol/L
  K: number;
  Cl: number;
  HCO3: number;
  urea: number; // mmol/L
  creat: number; // mg/dL
  glucose: number; // mg/dL
  NH4: number; // mmol/L
  Pi: number;
  Ca: number;
  Mg: number;
  pH: number;
  TA: number; // mmol/L
  /** excretion rates per day */
  exc: {
    Na: number;
    K: number;
    Cl: number;
    HCO3: number;
    urea: number; // mmol/d
    creat: number; // mg/d
    glucose: number; // g/d
    NH4: number;
    TA: number;
    NAE: number;
    Pi: number;
    Ca: number;
    Mg: number;
    osm: number; // mOsm/d
    water: number; // L/d
    electrolyteFreeWater: number; // L/d
    freeWater: number; // L/d (CH2O)
  };
}

export interface KidneyResult {
  GFR: number;
  RPF: number;
  RBF: number;
  FF: number;
  Pgc: number;
  Pptc: number;
  piPtc: number;
  sides: [KidneySide, KidneySide];
  segments: Record<SegmentId, SegmentFlux>;
  /** fraction of filtered load excreted */
  FE: Record<'Na' | 'K' | 'Cl' | 'HCO3' | 'urea' | 'Pi' | 'Ca' | 'Mg' | 'glucose' | 'urate', number>;
  urine: Urine;
  medullaTarget: number; // papillary interstitial osmolality target
  medullaOM: number;
  gNaCl: number;
  gUrea: number;
  /** macula densa NaCl uptake signal (relative to normal) that drives feedback and renin */
  maculaDensa: number;
  /** chloride delivered past the macula densa, relative to normal */
  mdDelivery: number;
  ammoniagenesis: number; // mmol/day
  /** lumen-negative voltage index in CNT/CCD (relative) */
  distalVoltage: number;
  /** TAL lumen-positive voltage index (relative) */
  talVoltage: number;
  distalNaDelivery: number; // mmol/min to CNT
  distalFlow: number; // mL/min into CNT
  kSecretion: number; // mmol/min
  hSecretionDistal: number; // mmol/min
  pendrinSecretion: number; // mmol/min
  freeWaterClearance: number; // mL/min
  osmolarClearance: number; // mL/min
  creatSecretion: number; // mg/min
  creatClearance: number; // mL/min
  ureaClearance: number;
  singleNephronGFR: number; // nL/min
  vasaRectaFlow: number; // relative
  glucoseReabsorbed: number; // mg/min
  glucoseTm: number; // mg/min
}
