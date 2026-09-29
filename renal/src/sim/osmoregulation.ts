// The osmoregulatory loop as Rose & Post describe it (ch. 6, 9): osmoreceptors set ADH and
// thirst from effective osmolality, with a separate, less sensitive baroreceptor input. These are
// the same response curves the full engine uses, exposed on their own so a page can draw them and
// let the learner move along them.

import { clamp } from '../engine/math';

export interface OsmoInput {
  /** effective plasma osmolality (tonicity), mOsm/kg */
  effOsm: number;
  /** effective arterial blood volume, 1 = normal; below ~0.9 the baroreceptor input takes over */
  eabv: number;
  /** shift of the osmotic threshold, mOsm/kg (pregnancy ≈ −10, reset osmostat) */
  osmostatShift: number;
  /** 0–1 loss of ADH secretion (central diabetes insipidus) */
  centralDI: number;
  /** pg/mL floor independent of osmolality (SIADH) */
  autonomous: number;
  /** 0–1 nausea, pain, drugs */
  nonosmotic: number;
  /** 1 = normal cortisol; 0 = adrenal insufficiency (loses cortisol's restraint on ADH) */
  glucocorticoid: number;
}

export const OSMO_DEFAULT: OsmoInput = {
  // the engine's own normal: 2 x Na+ 140 + glucose 5.3 mmol/L
  effOsm: 285.3,
  eabv: 1,
  osmostatShift: 0,
  centralDI: 0,
  autonomous: 0,
  nonosmotic: 0,
  glucocorticoid: 1,
};

export interface OsmoResult {
  /** plasma ADH, pg/mL */
  adh: number;
  /** the osmotic component alone */
  osmotic: number;
  /** the baroreceptor (volume) component alone */
  baro: number;
  /** nausea/pain/drugs and loss of cortisol restraint */
  other: number;
  /** osmotic threshold for ADH release, mOsm/kg */
  threshold: number;
  /** threshold for thirst, a few mOsm/kg higher */
  thirstThreshold: number;
  /** collecting-duct water permeability, 0–1 */
  aqp2: number;
  /** extra water drunk because of thirst, L/day */
  thirst: number;
}

/** ADH, thirst and aquaporin-2 for one osmolality and volume state. */
export function osmoregulation(i: OsmoInput): OsmoResult {
  // Volume depletion lowers the osmotic threshold and steepens the slope (Rose Fig. 6-6): the
  // osmostat is not abandoned, it is reset in favour of defending volume.
  const volSignal = Math.min(i.eabv, 1);
  const deficit = Math.max(0, 0.95 - volSignal);
  const threshold = 280 + i.osmostatShift - 25 * deficit;
  const slope = 0.38 * (1 + 3 * (deficit / 0.1));
  const osmotic = slope * Math.max(0, i.effOsm - threshold);
  // The baroreceptor limb is insensitive until pressure actually falls, and then exponential.
  const baro = 0.6 * (Math.exp(8 * deficit) - 1);
  const other = 4 * i.nonosmotic + 3 * (1 - i.glucocorticoid);
  const adh = Math.max(i.autonomous, (1 - i.centralDI) * (osmotic + baro + other));
  // Collecting-duct permeability saturates: half-maximal near 2 pg/mL, near-maximal by 5.
  const aqp2 = clamp((Math.pow(adh, 1.4) / (Math.pow(adh, 1.4) + Math.pow(0.666, 1.4))) * 1.12, 0, 1);
  // Thirst has a threshold a few mOsm/kg above ADH's, and a volume limb of its own. Past its
  // threshold it is steep, about 3 L/day for each mOsm/kg, which is what lets a patient with
  // complete diabetes insipidus drink 15 L/day and keep the sodium high-normal (Rose ch. 24). This
  // matches the engine's thirstDrive.
  const thirstThreshold = threshold + 5;
  const thirst = clamp((i.effOsm - thirstThreshold - 3) * 3, 0, 40) + 1.2 * clamp(deficit * 12, 0, 2);
  return { adh, osmotic, baro, other, threshold, thirstThreshold, aqp2, thirst };
}

/** Urine volume from solute load and concentrating ability — Rose Table 9-2 and Fig. 9-1. */
export function urineVolume(solutePerDay: number, uosm: number) {
  return solutePerDay / Math.max(uosm, 1);
}

export interface FreeWaterInput {
  /** urine volume, L/day */
  volume: number;
  uosm: number;
  posm: number;
  /** urine Na⁺, mmol/L */
  una: number;
  /** urine K⁺, mmol/L */
  uk: number;
  /** plasma Na⁺, mmol/L */
  pna: number;
}

export interface FreeWaterResult {
  /** osmolal clearance, L/day */
  cosm: number;
  /** free-water clearance (positive = water leaving the body), L/day */
  ch2o: number;
  /** electrolyte-free water clearance, L/day */
  efwc: number;
  /** what the plasma Na+ will do */
  verdict: 'rising' | 'falling' | 'steady';
}

/**
 * Both ways of splitting a urine. CH2O uses total solute and answers "is the urine dilute?";
 * the electrolyte-free version substitutes urinary Na+ + K+ for total solute and plasma Na+ for
 * plasma osmolality, and answers the question that matters for the plasma sodium (Rose ch. 9).
 */
export function freeWater(i: FreeWaterInput): FreeWaterResult {
  const cosm = (i.uosm * i.volume) / Math.max(i.posm, 1);
  const ch2o = i.volume - cosm;
  const efwc = i.volume * (1 - (i.una + i.uk) / Math.max(i.pna, 1));
  return { cosm, ch2o, efwc, verdict: efwc > 0.05 ? 'rising' : efwc < -0.05 ? 'falling' : 'steady' };
}
