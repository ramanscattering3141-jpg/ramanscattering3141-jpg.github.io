// Hyperglycaemic crises (Rose ch. 25) on the full engine, with the plasma glucose free to move.
//
// The engine treats the plasma glucose as a setting. Here it becomes a state: each hour the
// glucose changes by hepatic production minus tissue uptake minus what the kidney excretes, and
// that urinary term is read from the engine itself. That closes the loop the chapter is built on —
// the kidney caps the glucose by excreting it, so a patient with a normal GFR rarely passes
// 44 mmol/L (800 mg/dL) while an older patient with a reduced GFR climbs past 55, and a patient on
// dialysis can go higher still without an osmotic diuresis at all.
//
// Ketogenesis follows insulin with a much lower threshold than glucose uptake does (lipolysis is
// suppressed by about a tenth of the insulin needed to clear glucose), so a partial deficiency gives
// hyperglycaemia without ketoacidosis, and any dose of insulin that lowers the glucose also stops
// the ketones.

import { DEFAULT_PARAMS, applyPatch, type ParamPatch, type Params } from '../engine/types';
import { runToSteadyState, simulate, type Evaluation } from '../engine/simulate';
import { normalKStore, type BodyState } from '../engine/body';

export type CrisisKind = 'dka' | 'hhs' | 'dialysis';

export interface CrisisSpec {
  kind: CrisisKind;
  /** hours of decompensation before presentation */
  hours: number;
}

export interface Rx {
  /** isotonic saline in the first 4 h, L/h */
  bolusRate: number;
  /** after the first 4 h: 'ns' keeps isotonic saline, 'half' switches to half-isotonic */
  later: 'ns' | 'half';
  /** L/h after the first 4 h */
  laterRate: number;
  insulin: boolean;
  /** KCl added to each litre, mmol/L, once the plasma K⁺ is below `kBelow` */
  kcl: number;
  kBelow: number;
  /** sodium bicarbonate 100 mmol over 2 h if the pH is below 7.0 */
  bicarbonate: boolean;
}

export interface CrisisPoint {
  hour: number;
  glucose: number; // mmol/L
  Na: number;
  naCorrected: number; // Hillier, 2.4 per 5.6 mmol/L
  K: number;
  Cl: number;
  HCO3: number;
  pH: number;
  anionGap: number;
  effOsm: number;
  urea: number; // mmol/L
  creat: number; // µmol/L
  urineL: number; // L/day
  urineNaK: number; // mmol/L
  kDeficit: number; // mmol
  waterDeficit: number; // L of total body water lost since the start
  ecf: number;
  MAP: number;
  ketones: number; // retained organic anions, mmol/L
}

export interface CrisisResult {
  points: CrisisPoint[];
  presentation: CrisisPoint;
  outOfRange?: string;
}

const G_NORMAL = 95 / 18; // mmol/L, the engine's normal glucose
const GRAMS_TO_MMOL = 1000 / 180;

interface Patient {
  base: ParamPatch;
  /** endogenous insulin while ill, relative */
  insulin: number;
  /** insulin sensitivity of glucose uptake (diabetes and hyperosmolality make it ~0.4) */
  sensitivity: number;
  /** net ketoacid production at no insulin, mmol/h (after the ketone utilisation that continues) */
  ketoMax: number;
  /** the patch while ill: what is eaten and drunk */
  ill: ParamPatch;
}

const PATIENTS: Record<CrisisKind, Patient> = {
  // Young type 1 diabetic who has stopped insulin during an intercurrent illness: eating little,
  // drinking some, vomiting a little.
  dka: {
    base: { ageY: 22 },
    insulin: 0.04,
    sensitivity: 0.45,
    ketoMax: 17,
    ill: { naIntake: 30, kIntake: 20, proteinIntake: 30, waterIntake: 2.2, thirstIntact: false },
  },
  // Older patient with type 2 diabetes and mildly reduced renal function; insulin reduced but
  // present, so no ketoacidosis; confused and drinking little.
  hhs: {
    base: { ageY: 72, nephronFraction: 0.4, naIntake: 100, kIntake: 60, proteinIntake: 60 },
    insulin: 0.3,
    sensitivity: 0.45,
    ketoMax: 11,
    ill: { naIntake: 20, kIntake: 15, proteinIntake: 20, waterIntake: 0.9, thirstIntact: false },
  },
  // Diabetic patient on dialysis between sessions: almost no filtration, on a restricted diet.
  dialysis: {
    base: { ageY: 60, nephronFraction: 0.06, naIntake: 70, kIntake: 35, proteinIntake: 55, waterIntake: 0.9 },
    insulin: 0.1,
    sensitivity: 0.45,
    ketoMax: 0,
    ill: { naIntake: 70, kIntake: 35, proteinIntake: 55, waterIntake: 0.9 },
  },
};

/** Hepatic glucose output, g/day: doubles or more in uncontrolled diabetes, suppressed by insulin. */
function production(insulinEffect: number) {
  return 200 * Math.max(0.5, 2.4 - 1.4 * insulinEffect);
}

/** Tissue uptake, g/day: brain and red cells take glucose regardless; muscle and fat need insulin. */
function uptake(g: number, insulinEffect: number, sensitivity: number) {
  const independent = (130 * g) / (g + 3);
  const insulinDependent = 22 * insulinEffect * sensitivity * g * (15.3 / (g + 10));
  return independent + insulinDependent;
}

function ketoRate(p: Patient, insulinEffect: number) {
  return p.ketoMax * Math.max(0, 1 - insulinEffect / 0.25);
}

function point(ev: Evaluation, hour: number, glucose: number, body: BodyState, tbw0: number, params: Params): CrisisPoint {
  const u = ev.kidney.urine;
  return {
    hour,
    glucose,
    Na: ev.plasma.Na,
    naCorrected: ev.plasma.Na + (2.4 * Math.max(0, glucose - 5.6)) / 5.6,
    K: ev.plasma.K,
    Cl: ev.plasma.Cl,
    HCO3: ev.plasma.HCO3,
    pH: ev.plasma.pH,
    anionGap: ev.plasma.anionGap,
    effOsm: ev.plasma.effOsm,
    urea: ev.body.bun / 2.8,
    creat: ev.body.creat * 88.4,
    urineL: u.volumePerDay,
    urineNaK: u.Na + u.K,
    kDeficit: normalKStore(params) - body.kE,
    waterDeficit: tbw0 - body.tbw,
    ecf: ev.plasma.ecf,
    MAP: ev.reg.MAP,
    ketones: body.organicAnions,
  };
}

interface Clock {
  body: BodyState;
  glucose: number;
  ev: Evaluation;
  hour: number;
  outOfRange?: string;
}

/**
 * Advance one chunk: set the glucose and ketogenesis from the current state, run the engine, then
 * move the glucose by production − uptake − urinary loss (+ any dextrose infused).
 */
function advance(c: Clock, patient: Patient, patch: ParamPatch, hours: number, endogenousInsulin: number, dripInsulin: number, dextroseGPerDay: number): Clock {
  const insulinEffect = endogenousInsulin + dripInsulin;
  const params = applyPatch(DEFAULT_PARAMS, {
    ...patient.base,
    ...patch,
    glucose: c.glucose * 18,
    insulin: endogenousInsulin,
    ketoAcid: ketoRate(patient, insulinEffect),
    drugs: { ...(patch.drugs ?? {}), insulinDrip: dripInsulin },
  });
  const r = simulate(params, hours / 24, Math.min(hours / 24, 1 / 96), c.body);
  const ev = r.final;
  const renal = ev.kidney.urine.exc.glucose; // g/day
  const net = production(insulinEffect) + dextroseGPerDay - uptake(c.glucose, insulinEffect, patient.sensitivity) - renal; // g/day
  const vd = Math.max(ev.plasma.ecf * 1.25, 6);
  const glucose = Math.min(120, Math.max(3.5, c.glucose + (net * GRAMS_TO_MMOL * (hours / 24)) / vd));
  return { body: r.state.body, glucose, ev, hour: c.hour + hours, outOfRange: r.state.outOfRange };
}

const onsetCache = new Map<string, { clock: Clock; points: CrisisPoint[]; tbw0: number; params: Params }>();

function onset(spec: CrisisSpec) {
  const key = JSON.stringify(spec);
  const hit = onsetCache.get(key);
  if (hit) return hit;
  const patient = PATIENTS[spec.kind];
  const wellParams = applyPatch(DEFAULT_PARAMS, patient.base);
  const well = runToSteadyState(wellParams, 30);
  const tbw0 = well.state.body.tbw;
  let clock: Clock = { body: well.state.body, glucose: G_NORMAL, ev: well.ev, hour: 0 };
  const points: CrisisPoint[] = [point(well.ev, 0, G_NORMAL, well.state.body, tbw0, wellParams)];
  const chunk = spec.hours > 48 ? 3 : 1;
  while (clock.hour < spec.hours - 1e-9 && !clock.outOfRange) {
    clock = advance(clock, patient, patient.ill, chunk, patient.insulin, 0, 0);
    points.push(point(clock.ev, clock.hour, clock.glucose, clock.body, tbw0, wellParams));
  }
  const out = { clock, points, tbw0, params: wellParams };
  onsetCache.set(key, out);
  return out;
}

/** Untreated decompensation from a well patient to the moment of presentation. */
export function hyperglycemicCrisis(spec: CrisisSpec): CrisisResult {
  const o = onset(spec);
  return { points: o.points, presentation: o.points[o.points.length - 1], outOfRange: o.clock.outOfRange };
}

/** Treat the presenting patient for 48 hours with the chosen regimen. */
export function treatCrisis(spec: CrisisSpec, rx: Rx): CrisisResult {
  const o = onset(spec);
  const patient = PATIENTS[spec.kind];
  let clock: Clock = { ...o.clock, hour: 0 };
  const points: CrisisPoint[] = [point(clock.ev, 0, clock.glucose, clock.body, o.tbw0, o.params)];
  let bicarbHours = 0;
  let dextrose = false;
  for (let h = 0; h < 48 && !clock.outOfRange; h++) {
    const early = h < 4;
    const rate = early ? rx.bolusRate : rx.laterRate; // L/h
    const half = !early && rx.later === 'half';
    // Once the glucose is below about 14 mmol/L (250 mg/dL) the fluid carries 5% dextrose and the
    // insulin is halved, so that insulin can continue to clear the ketones without hypoglycaemia.
    if (clock.glucose < 13.9) dextrose = true;
    const litresPerDay = rate * 24;
    const k = clock.ev.plasma.K < rx.kBelow ? rx.kcl * litresPerDay : 0;
    if (rx.bicarbonate && clock.ev.plasma.pH < 7.0 && bicarbHours === 0) bicarbHours = 2;
    const bicarb = bicarbHours > 0 ? 50 * 24 : 0; // 50 mmol/h for 2 h
    if (bicarbHours > 0) bicarbHours--;
    const patch: ParamPatch = {
      ...patient.ill,
      waterIntake: 0,
      naIntake: 0,
      kIntake: 0,
      vomiting: 0,
      ivNS: half ? litresPerDay / 2 : litresPerDay,
      ivD5W: half ? litresPerDay / 2 : 0,
      drugs: { potassiumChloride: k, sodiumBicarbonate: bicarb },
    };
    // An insulin infusion takes an hour or two to reach its full effect on hepatic glucose output.
    const onsetFactor = 1 - Math.exp(-(h + 0.5) / 1.5);
    const drip = rx.insulin ? (dextrose ? 0.75 : 1.5) * onsetFactor : 0;
    // Dextrose goes into the maintenance fluid, not the resuscitation bolus: 5% at up to 150 mL/h.
    const dextroseG = dextrose ? 50 * 24 * Math.min(early ? 0.15 : rate, 0.15) : 0;
    clock = advance(clock, patient, patch, 1, patient.insulin, drip, dextroseG);
    points.push(point(clock.ev, clock.hour, clock.glucose, clock.body, o.tbw0, o.params));
  }
  return { points, presentation: points[0], outOfRange: clock.outOfRange };
}
