// Canadian (SI) units for everything the learner sees.
//
// Rose & Post, and the physiology engine that follows it, work in conventional US units
// (creatinine and BUN in mg/dL, glucose in mg/dL, albumin in g/dL). The engine keeps those
// internally so its equations stay recognisably the book's; every number that reaches the screen
// is converted here first. Pressures and blood gases stay in mmHg, as Canadian laboratories
// report them; electrolytes are already mmol/L.

/** creatinine: 1 mg/dL = 88.4 µmol/L */
export const CREAT_UMOL_PER_MGDL = 88.4;
/** urea: BUN 1 mg/dL = 0.357 mmol/L urea (÷ 2.8) */
export const UREA_MMOL_PER_BUN = 1 / 2.8;
/** glucose: 1 mg/dL = 0.0555 mmol/L (÷ 18) */
export const GLUCOSE_MMOL_PER_MGDL = 1 / 18;
/** calcium: 1 mg/dL = 0.25 mmol/L */
export const CA_MMOL_PER_MGDL = 0.25;
/** phosphate: 1 mg/dL = 0.323 mmol/L */
export const PI_MMOL_PER_MGDL = 0.323;
/** magnesium: 1 mg/dL = 0.411 mmol/L */
export const MG_MMOL_PER_MGDL = 0.411;
/** urate: 1 mg/dL = 59.48 µmol/L */
export const URATE_UMOL_PER_MGDL = 59.48;

export const si = {
  creat: (mgdl: number) => mgdl * CREAT_UMOL_PER_MGDL,
  urea: (bun: number) => bun * UREA_MMOL_PER_BUN,
  glucose: (mgdl: number) => mgdl * GLUCOSE_MMOL_PER_MGDL,
  /** g/dL → g/L */
  albumin: (gdl: number) => gdl * 10,
  /** g/dL → g/L (haemoglobin, total protein) */
  gL: (gdl: number) => gdl * 10,
  calcium: (mgdl: number) => mgdl * CA_MMOL_PER_MGDL,
  phosphate: (mgdl: number) => mgdl * PI_MMOL_PER_MGDL,
  magnesium: (mgdl: number) => mgdl * MG_MMOL_PER_MGDL,
  urate: (mgdl: number) => mgdl * URATE_UMOL_PER_MGDL,
  /** vasopressin pg/mL → pmol/L (MW 1084) */
  adh: (pgml: number) => pgml * 0.923,
  /** creatinine mg/day → mmol/day (113.12 g/mol) */
  creatPerDay: (mgPerDay: number) => mgPerDay / 113.12,
  /** glucose mg/min → mmol/min */
  glucoseRate: (mgPerMin: number) => mgPerMin / 180.16,
  /**
   * Urea : creatinine ratio as usually quoted in SI (urea mmol/L ÷ creatinine mmol/L).
   * A BUN/creatinine ratio of 20 corresponds to about 80.
   */
  ureaCreatRatio: (bun: number, creatMgdl: number) => (bun / 2.8) / (Math.max(creatMgdl, 0.01) * 0.0884),
};

/** SI → the engine's internal conventional units (for sliders that set engine parameters). */
export const conv = {
  creat: (umol: number) => umol / CREAT_UMOL_PER_MGDL,
  bun: (ureaMmol: number) => ureaMmol / UREA_MMOL_PER_BUN,
  glucose: (mmol: number) => mmol / GLUCOSE_MMOL_PER_MGDL,
  /** g/L → g/dL */
  albumin: (gL: number) => gL / 10,
};

export const UNIT = {
  creat: 'µmol/L',
  urea: 'mmol/L',
  glucose: 'mmol/L',
  albumin: 'g/L',
  protein: 'g/L',
  calcium: 'mmol/L',
  phosphate: 'mmol/L',
  magnesium: 'mmol/L',
  urate: 'µmol/L',
  hb: 'g/L',
  acr: 'mg/mmol',
} as const;
