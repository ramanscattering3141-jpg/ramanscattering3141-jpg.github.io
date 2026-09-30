// The water-restriction test (Rose ch. 24, Fig. 24-6), run on the full engine.
//
// The protocol is Rose's: settle the patient on free access to water, stop all intake, measure
// every hour, and stop the restriction when the plasma osmolality reaches 295-300 mOsm/kg, when the
// urine osmolality has plateaued (less than a 30 mOsm/kg rise in two consecutive hourly
// specimens), or when 3-5% of body weight has been lost. Then give desmopressin and keep
// measuring. The stopping rules matter: in complete central diabetes insipidus the urine can run
// at 700-800 mL/h, and restriction continued past them causes severe volume depletion.

import { DEFAULT_PARAMS, applyPatch, type ParamPatch } from '../engine/types';
import { runToSteadyState, simulate, type Evaluation } from '../engine/simulate';
import type { BodyState } from '../engine/body';

export interface DeprivationSample {
  /** hours since water was stopped */
  hour: number;
  /** measured plasma osmolality, mOsm/kg */
  posm: number;
  /** urine osmolality, mOsm/kg */
  uosm: number;
  /** urine flow, mL/h */
  uflow: number;
  /** plasma Na+, mmol/L */
  na: number;
  /** body weight lost, % */
  weightLoss: number;
  /** desmopressin has been given */
  dDAVP: boolean;
}

export type StopReason = 'posm' | 'plateau' | 'weight' | 'time';

export interface DeprivationResult {
  /** the patient on free access to water */
  baseline: Evaluation;
  samples: DeprivationSample[];
  /** the last sample before desmopressin */
  deprived: DeprivationSample;
  /** two hours after desmopressin */
  afterDDAVP: DeprivationSample;
  /** why restriction was stopped */
  stoppedBy: StopReason;
  /** % rise in urine osmolality with desmopressin */
  riseWithDDAVP: number;
}

const POSM_STOP = 297; // mOsm/kg: within Rose's 295-300
const PLATEAU = 30; // mOsm/kg per hour
const WEIGHT_STOP = 5; // % of body weight
const MAX_HOURS = 18;
const DDAVP_HOURS = 2;
const HOUR = 1 / 24;
const STEP = 0.01; // days; the integrator sub-steps within it as fast as the stores move

function sample(ev: Evaluation, hour: number, weightLoss: number, dDAVP: boolean): DeprivationSample {
  return {
    hour,
    posm: ev.plasma.osm,
    uosm: ev.kidney.urine.osm,
    uflow: (ev.kidney.urine.volumePerDay * 1000) / 24,
    na: ev.plasma.Na,
    weightLoss,
    dDAVP,
  };
}

/** Run the water-restriction test on a patient described by a parameter patch. */
export function waterDeprivationTest(patch: ParamPatch): DeprivationResult {
  const free = applyPatch(DEFAULT_PARAMS, patch);
  const settled = runToSteadyState(free, 14, 0.25);
  const weightKg = free.weightKg;
  const tbw0 = settled.state.body.tbw;

  const dry = applyPatch(DEFAULT_PARAMS, { ...patch, waterIntake: 0, thirstIntact: false });
  const withDDAVP = applyPatch(DEFAULT_PARAMS, {
    ...patch,
    waterIntake: 0,
    thirstIntact: false,
    drugs: { ...(patch.drugs ?? {}), desmopressin: 1 },
  });

  // Weight lost is water lost: total body water is the only store that changes within hours.
  const lossOf = (b: BodyState) => (Math.max(0, tbw0 - b.tbw) / weightKg) * 100;

  const samples: DeprivationSample[] = [sample(settled.ev, 0, 0, false)];
  let body = settled.state.body;
  let stoppedBy: StopReason = 'time';
  for (let hour = 1; hour <= MAX_HOURS; hour++) {
    const r = simulate(dry, HOUR, STEP, body);
    body = r.state.body;
    const s = sample(r.final, hour, lossOf(body), false);
    samples.push(s);
    const [a, b] = [samples[samples.length - 3], samples[samples.length - 2]];
    if (s.posm >= POSM_STOP && hour >= 2) {
      stoppedBy = 'posm';
      break;
    }
    if (hour >= 3 && a && b && b.uosm - a.uosm < PLATEAU && s.uosm - b.uosm < PLATEAU) {
      stoppedBy = 'plateau';
      break;
    }
    if (s.weightLoss >= WEIGHT_STOP) {
      stoppedBy = 'weight';
      break;
    }
  }
  const deprived = samples[samples.length - 1];

  for (let h = 1; h <= DDAVP_HOURS; h++) {
    const r = simulate(withDDAVP, HOUR, STEP, body);
    body = r.state.body;
    samples.push(sample(r.final, deprived.hour + h, lossOf(body), true));
  }
  const afterDDAVP = samples[samples.length - 1];

  return {
    baseline: settled.ev,
    samples,
    deprived,
    afterDDAVP,
    stoppedBy,
    riseWithDDAVP: ((afterDDAVP.uosm - deprived.uosm) / Math.max(deprived.uosm, 1)) * 100,
  };
}

/** The patients of Rose Fig. 24-6, as parameter patches. */
export const DEPRIVATION_PATIENTS: { id: string; label: string; patch: ParamPatch; note: string }[] = [
  { id: 'normal', label: 'Normal', patch: {}, note: 'Maximal ADH effect once the plasma osmolality reaches 285-295: desmopressin adds nothing.' },
  { id: 'cdi', label: 'Complete central DI', patch: { centralDI: 1 }, note: 'No ADH. The urine stays dilute until desmopressin supplies it.' },
  { id: 'pcdi', label: 'Partial central DI', patch: { centralDI: 0.7 }, note: 'Some ADH, not enough. The urine concentrates partly, and desmopressin adds more.' },
  { id: 'ndi', label: 'Nephrogenic DI (lithium)', patch: { drugs: { lithium: 1 } }, note: 'ADH is high but the collecting duct cannot answer it, so desmopressin cannot either.' },
  { id: 'pndi', label: 'Partial nephrogenic DI', patch: { drugs: { lithium: 0.55 } }, note: 'A blunted response to ADH that desmopressin barely improves.' },
  { id: 'polydipsia', label: 'Primary polydipsia', patch: { waterIntake: 12 }, note: 'The kidney is normal and ADH secretion intact. Stop the water and the urine concentrates.' },
];

// ---------------------------------------------------------------- correcting hypernatraemia

export type HypernatraemiaCause = 'losses' | 'cdi';

export interface Regimen {
  /** how the water was lost: unreplaced losses with a normal kidney, or central DI without thirst */
  cause: HypernatraemiaCause;
  /** 5% dextrose in water, L/day */
  d5w: number;
  /** quarter-isotonic saline, L/day (750 mL free water + 250 mL isotonic saline per litre) */
  quarterSaline: number;
  desmopressin: boolean;
}

export interface CorrectionResult {
  startNa: number;
  /** total body water at the start, L */
  tbw: number;
  /** Rose's estimate: TBW × (Na/140 − 1), L */
  deficit: number;
  /** days without water it took to get there */
  daysWithoutWater: number;
  points: { hour: number; na: number; uflow: number }[];
  /** the largest fall in any 24 h window, mmol/L */
  worstDay: number;
  outOfRange?: string;
}

const TARGET_START_NA = 165;
const startCache = new Map<HypernatraemiaCause, { body: BodyState; days: number; na: number }>();

function hypernatraemicStart(cause: HypernatraemiaCause) {
  const hit = startCache.get(cause);
  if (hit) return hit;
  const base: ParamPatch = cause === 'cdi' ? { centralDI: 1 } : {};
  let body = runToSteadyState(applyPatch(DEFAULT_PARAMS, base), 14, 0.25).state.body;
  const dry = applyPatch(DEFAULT_PARAMS, { ...base, thirstIntact: false, waterIntake: 0 });
  // Large steps while the sodium is far from the target, small ones as it approaches. Central
  // DI without thirst loses 700-800 mL/h, so it needs half-hour steps throughout.
  let na = 0;
  let days = 0;
  while (days < 30) {
    const far = cause !== 'cdi' && na < TARGET_START_NA - 6;
    const chunk = far ? 0.5 : cause === 'cdi' ? 1 / 48 : 1 / 24;
    const r = simulate(dry, chunk, chunk / 4, body);
    body = r.state.body;
    na = r.final.plasma.Na;
    days += chunk;
    if (na >= TARGET_START_NA) break;
  }
  const out = { body, days, na };
  startCache.set(cause, out);
  return out;
}

/** Withhold water until the sodium reaches about 165, then treat for three days. */
export function hypernatraemiaCorrection(rx: Regimen): CorrectionResult {
  const start = hypernatraemicStart(rx.cause);
  const base: ParamPatch = rx.cause === 'cdi' ? { centralDI: 1 } : {};
  const treat = applyPatch(DEFAULT_PARAMS, {
    ...base,
    thirstIntact: false,
    waterIntake: 0,
    ivD5W: rx.d5w + 0.75 * rx.quarterSaline,
    ivNS: 0.25 * rx.quarterSaline,
    drugs: rx.desmopressin ? { desmopressin: 1 } : {},
  });
  const r = simulate(treat, 3, 1 / 24, start.body);
  const points = r.points.map((p) => ({ hour: p.day * 24, na: p.Na, uflow: (p.urineVolume * 1000) / 24 }));
  let worstDay = 0;
  for (const p of points) {
    const later = points.find((q) => q.hour >= p.hour + 24 - 1e-6);
    if (later) worstDay = Math.max(worstDay, p.na - later.na);
  }
  return {
    startNa: start.na,
    tbw: start.body.tbw,
    deficit: start.body.tbw * (start.na / 140 - 1),
    daysWithoutWater: start.days,
    points,
    worstDay,
    outOfRange: r.state.outOfRange,
  };
}
