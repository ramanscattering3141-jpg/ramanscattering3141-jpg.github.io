// The integrated model: body state -> plasma -> hormones -> kidney -> excretion -> body state.
//
// `evaluate` runs one steady-state pass for a given body state (what the interactive panels
// show). `stepDay` integrates balance forward in time, which is what makes creatinine rise
// gradually after a fall in GFR and what lets the sandbox reach a new steady state.

import { clamp } from './math';
import { acidBase, derivePlasma, initialBody, respiratoryPCO2, type BodyState, type PlasmaDerived } from './body';
import { evaluateRegulation, type RegulationState } from './regulation';
import { runKidney } from './kidney';
import type { KidneyResult, Params } from './types';

export interface SimState {
  body: BodyState;
  /** simulated time in days since the scenario started */
  day: number;
}

export interface Evaluation {
  params: Params;
  body: BodyState;
  plasma: PlasmaDerived;
  reg: RegulationState;
  kidney: KidneyResult;
  /** daily balances actually achieved */
  balance: {
    naIn: number;
    naOut: number;
    kIn: number;
    kOut: number;
    waterIn: number;
    waterOut: number;
    acidIn: number;
    acidOut: number;
    clIn: number;
    clOut: number;
  };
  derived: {
    eGFR: number;
    creatClearance: number;
    bunCrRatio: number;
    FENa: number;
    FEUrea: number;
    TTKG: number;
    urineAnionGap: number;
    urineOsmGap: number;
    maxUrineOsm: number;
    minUrineOsm: number;
    ecfLiters: number;
    tbwLiters: number;
    /** oedema formation threshold indicator */
    edemaLiters: number;
    naDeficitOrExcess: number;
    waterDeficit: number;
    acidBase: { pH: number; PCO2: number; HCO3: number; label: string; compensation: string };
  };
}

const CREAT_VOL_FRACTION = 0.6; // creatinine distributes in total body water
const UREA_VOL_FRACTION = 1.0;

/** Creatinine generation (mg/day) from age, sex and muscle mass (Cockcroft–Gault style). */
export function creatinineGeneration(p: Params) {
  const base = p.female ? 22 - p.ageY / 9 : 28 - 0.2 * p.ageY; // mg/kg/day (Rose ch. 2)
  return clamp(base, 6, 30) * p.weightKg * p.muscleMass;
}

/** Urea generation (mmol/day) from protein intake and catabolism. */
export function ureaGeneration(p: Params) {
  // ~1 g protein -> 0.16 g N; urea N is the bulk of nitrogen excretion
  const gN = p.proteinIntake * 0.16;
  return clamp((gN / 28) * 1000 * 0.85, 30, 1400);
}

/** Endogenous acid production (mEq/day): sulfur amino acids + organic acids. */
export function acidProduction(p: Params) {
  const diet = clamp(0.8 * p.proteinIntake - 10, 10, 160);
  const organic = (p.lacticAcid + p.ketoAcid + p.toxicAcid) * 24;
  return diet + p.extraAcid + organic - p.drugs.sodiumBicarbonate - p.drugs.potassiumCitrate;
}

export function evaluate(body: BodyState, params: Params, prevReg?: RegulationState): Evaluation {
  const plasma = derivePlasma(body, params);
  const stenosisDrop = (s: number, MAP: number) => MAP * 0.62 * Math.pow(clamp(s, 0, 0.95), 2.2);

  let reg = evaluateRegulation(
    {
      params,
      pvRel: plasma.pvRel,
      Na: plasma.Na,
      K: plasma.K,
      effOsm: plasma.effOsm,
      Pi: plasma.Pi,
      ionizedCa: plasma.ionizedCa,
      mdSignal: 1,
      stenosisDrop: [0, 0],
      nephronFraction: params.nephronFraction,
    },
    prevReg,
  );

  let kidney = runKidney({
    params,
    plasma,
    hormones: reg.hormones,
    MAP: reg.MAP,
    ureaProduction: ureaGeneration(params) / 1440,
  });

  // Close the loop between the kidney's macula densa signal and the hormone system. The two
  // subsystems feed back on each other, so the iterate is damped to stop it ringing.
  let mdBlend = kidney.maculaDensa;
  for (let i = 0; i < 10; i++) {
    mdBlend = 0.55 * mdBlend + 0.45 * kidney.maculaDensa;
    const regNext = evaluateRegulation(
      {
        params,
        pvRel: plasma.pvRel,
        Na: plasma.Na,
        K: plasma.K,
        effOsm: plasma.effOsm,
        Pi: plasma.Pi,
        ionizedCa: plasma.ionizedCa,
        mdSignal: mdBlend,
        stenosisDrop: [stenosisDrop(params.stenosisL, reg.MAP), stenosisDrop(params.stenosisR, reg.MAP)],
        nephronFraction: params.nephronFraction,
      },
      reg,
    );
    const kidneyNext = runKidney({
      params,
      plasma,
      hormones: regNext.hormones,
      MAP: regNext.MAP,
      ureaProduction: ureaGeneration(params) / 1440,
    });
    const converged = Math.abs(kidneyNext.GFR - kidney.GFR) < 0.3 && Math.abs(regNext.MAP - reg.MAP) < 0.2;
    reg = regNext;
    kidney = kidneyNext;
    if (converged) break;
  }

  const p = params;
  const d = p.drugs;
  // ---- intake / output balances (per day)
  const naIn = p.naIntake + p.ivNS * 154 + p.ivHypertonic * 513 + d.sodiumBicarbonate;
  const kIn = p.kIntake + d.potassiumChloride + d.potassiumCitrate;
  const waterIn = p.waterIntake + p.ivNS + p.ivD5W + p.ivHypertonic + 0.3; // 0.3 L metabolic water
  const gastricNa = p.vomiting * 60;
  const gastricK = p.vomiting * 10;
  const gastricCl = p.vomiting * 110;
  const stoolNa = p.diarrhea * 60;
  const stoolK = p.diarrhea * 35;
  const stoolCl = p.diarrhea * 45;
  const stoolHCO3 = p.diarrhea * 35;
  const naOut = kidney.urine.exc.Na + gastricNa + stoolNa + 10;
  const kOut = kidney.urine.exc.K + gastricK + stoolK + 10;
  const waterOut = kidney.urine.exc.water + p.insensible + p.vomiting + p.diarrhea;
  const clIn = p.naIntake + p.ivNS * 154 + p.ivHypertonic * 513 + d.potassiumChloride;
  const clOut = kidney.urine.exc.Cl + gastricCl + stoolCl + 10;
  const acidIn = acidProduction(p) + p.vomiting * -110 + stoolHCO3;
  const acidOut = kidney.urine.exc.NAE;

  // ---- derived clinical indices
  const scr = plasma.creat;
  const kappa = p.female ? 0.7 : 0.9;
  const alpha = p.female ? -0.241 : -0.302;
  const eGFR =
    142 *
    Math.pow(Math.min(scr / kappa, 1), alpha) *
    Math.pow(Math.max(scr / kappa, 1), -1.2) *
    Math.pow(0.9938, p.ageY) *
    (p.female ? 1.012 : 1);
  const bunCrRatio = plasma.BUN / Math.max(scr, 0.05);
  const urineAnionGap = kidney.urine.Na + kidney.urine.K - kidney.urine.Cl;
  const urineOsmGap = kidney.urine.osm - (2 * (kidney.urine.Na + kidney.urine.K) + kidney.urine.urea + kidney.urine.glucose / 18);
  const ttkg =
    kidney.urine.osm > plasma.osm
      ? kidney.urine.K / Math.max(plasma.K, 0.5) / Math.max(kidney.urine.osm / plasma.osm, 0.5)
      : NaN;

  const { pH } = acidBase(body.hco3, respiratoryPCO2(body.hco3, p));
  const label = describeAcidBase(body.hco3, plasma.PCO2, pH, plasma.agCorrected);

  return {
    params,
    body,
    plasma,
    reg,
    kidney,
    balance: { naIn, naOut, kIn, kOut, waterIn, waterOut, acidIn, acidOut, clIn, clOut },
    derived: {
      eGFR,
      creatClearance: kidney.creatClearance,
      bunCrRatio,
      FENa: kidney.FE.Na * 100,
      FEUrea: kidney.FE.urea * 100,
      TTKG: ttkg,
      urineAnionGap,
      urineOsmGap,
      maxUrineOsm: kidney.medullaTarget,
      minUrineOsm: 50,
      ecfLiters: plasma.ecf,
      tbwLiters: body.tbw,
      edemaLiters: body.edema,
      naDeficitOrExcess: body.naE - 41 * p.weightKg,
      waterDeficit: body.tbw * (plasma.Na / 140 - 1),
      acidBase: { pH, PCO2: plasma.PCO2, HCO3: body.hco3, label: label.primary, compensation: label.compensation },
    },
  };
}

export function describeAcidBase(hco3: number, pco2: number, pH: number, agCorrected: number) {
  const acidemic = pH < 7.36;
  const alkalemic = pH > 7.44;
  let primary = 'Normal acid–base status';
  if (acidemic && hco3 < 22) primary = agCorrected > 16 ? 'High anion gap metabolic acidosis' : 'Normal anion gap (hyperchloremic) metabolic acidosis';
  else if (acidemic && pco2 > 45) primary = 'Respiratory acidosis';
  else if (alkalemic && hco3 > 26) primary = 'Metabolic alkalosis';
  else if (alkalemic && pco2 < 35) primary = 'Respiratory alkalosis';
  else if (!acidemic && !alkalemic && (hco3 < 21 || hco3 > 28)) primary = 'Mixed disorder (normal pH with abnormal HCO₃⁻/PCO₂)';

  let compensation = '';
  if (hco3 < 22) {
    const expected = 40 + 1.2 * (hco3 - 24);
    compensation =
      pco2 > expected + 3
        ? `PCO₂ ${pco2.toFixed(0)} exceeds the expected ${expected.toFixed(0)}: superimposed respiratory acidosis`
        : pco2 < expected - 3
          ? `PCO₂ ${pco2.toFixed(0)} is below the expected ${expected.toFixed(0)}: superimposed respiratory alkalosis`
          : `PCO₂ ${pco2.toFixed(0)} matches the expected ${expected.toFixed(0)} (appropriate respiratory compensation)`;
  } else if (hco3 > 26) {
    const expected = 40 + 0.7 * (hco3 - 24);
    compensation =
      pco2 < expected - 3
        ? `PCO₂ ${pco2.toFixed(0)} is below the expected ${expected.toFixed(0)}: superimposed respiratory alkalosis`
        : pco2 > expected + 3
          ? `PCO₂ ${pco2.toFixed(0)} exceeds the expected ${expected.toFixed(0)}: superimposed respiratory acidosis`
          : `PCO₂ ${pco2.toFixed(0)} matches the expected ${expected.toFixed(0)} (appropriate respiratory compensation)`;
  }
  return { primary, compensation };
}

/**
 * Advance the body state by dt days. The balance equations are stiff (urine output can change
 * several-fold within hours), so the caller's step is broken into short sub-steps.
 */
export function stepDay(state: SimState, params: Params, dt = 1, prevReg?: RegulationState): { state: SimState; ev: Evaluation } {
  const MAX_SUBSTEP = 0.05; // days (~72 min)
  const n = Math.max(1, Math.ceil(dt / MAX_SUBSTEP));
  let cur = state;
  let reg = prevReg;
  let ev!: Evaluation;
  for (let i = 0; i < n; i++) {
    const r = substep(cur, params, dt / n, reg);
    cur = r.state;
    ev = r.ev;
    reg = r.ev.reg;
  }
  return { state: cur, ev };
}

function substep(state: SimState, params: Params, dt: number, prevReg?: RegulationState): { state: SimState; ev: Evaluation } {
  const ev = evaluate(state.body, params, prevReg);
  const b = { ...state.body };
  const p = params;
  const k = ev.kidney;

  // Exchangeable stores can never go negative.
  b.naE = Math.max(50, b.naE + (ev.balance.naIn - ev.balance.naOut) * dt);
  b.kE = Math.max(50, b.kE + (ev.balance.kIn - ev.balance.kOut) * dt);
  b.clE = Math.max(50, b.clE + (ev.balance.clIn - ev.balance.clOut) * dt);

  // Water: intake minus renal + extrarenal losses; thirst defends tonicity when intact.
  let waterIn = ev.balance.waterIn;
  if (p.thirstIntact) {
    const thirstDrive = clamp((ev.plasma.effOsm - 288) / 5, 0, 3) + clamp((0.95 - ev.reg.eabv) * 6, 0, 2);
    waterIn += thirstDrive * 1.2;
  }
  b.tbw += (waterIn - ev.balance.waterOut) * dt;
  b.tbw = clamp(b.tbw, p.weightKg * 0.25, p.weightKg * 1.1);

  // Oedema: ECF expansion beyond ~3 L above normal, or altered Starling forces, moves fluid
  // into the interstitium instead of the plasma (Rose ch. 16).
  const ecfNormal = p.weightKg * (p.female ? 0.5 : 0.6) / 3;
  const excessEcf = Math.max(0, b.tbw * b.ecfFraction - ecfNormal);
  const leakTendency = clamp(
    0.35 + 0.5 * clamp(1 - p.cardiacFunction, 0, 1) + 0.4 * p.portalHypertension + 0.5 * p.capillaryLeak + 0.4 * clamp((3.5 - p.albumin) / 2, 0, 1) + 0.02 * p.venousCongestion,
    0,
    0.95,
  );
  b.edema = clamp(excessEcf * leakTendency, 0, 40);

  // Acid-base: net acid balance changes the bicarbonate pool (ECF + cell buffering).
  // Bone is a large, slowly exchangeable alkali reservoir: in chronic acidosis it releases
  // carbonate, which is why uraemic and distal-RTA acidosis plateaus instead of falling without
  // limit (at the cost of bone disease).
  const bufferVolume = b.tbw * 0.5;
  const boneAlkali = clamp(3.5 * (22 - b.hco3), 0, 90);
  const netAcid = ev.balance.acidIn - ev.balance.acidOut - boneAlkali;
  b.hco3 = clamp(b.hco3 - (netAcid * dt) / Math.max(bufferVolume, 5), 3, 60);
  // Contraction alkalosis: losing Cl-rich, HCO3-poor fluid concentrates the bicarbonate pool.
  const ecfBefore = ev.plasma.ecf;
  const ecfAfter = b.tbw * b.ecfFraction + b.edema;
  if (ecfAfter > 0.5 && Math.abs(ecfAfter - ecfBefore) > 1e-6) {
    b.hco3 = clamp(b.hco3 * Math.pow(ecfBefore / ecfAfter, 0.55), 3, 60);
  }

  // Creatinine kinetics. This is why serum creatinine lags a change in GFR: the new steady
  // state is only reached once the plasma level has risen enough for excretion to match
  // generation again, which takes days at a low clearance (Rose ch. 2).
  //   generation G (mg/day); excretion = CrCl (mL/min) x 1440 x Scr (mg/dL) / 100 (mg/day)
  //   d[Scr]/dt = (G - excretion) / (Vd in dL)
  const vdCreatDl = b.tbw * CREAT_VOL_FRACTION * 10;
  const creatGen = creatinineGeneration(p);
  const creatExcreted = (k.creatClearance * 1440 * b.creat) / 100;
  b.creat = clamp(b.creat + ((creatGen - creatExcreted) / Math.max(vdCreatDl, 20)) * dt, 0.1, 40);

  // Urea: generation from protein catabolism, excretion from the kidney model.
  //   BUN (mg/dL) = urea (mmol/L) x 2.8; Vd is total body water.
  const vdUreaL = b.tbw * UREA_VOL_FRACTION;
  const ureaBalanceMmol = ureaGeneration(p) - k.urine.exc.urea;
  const bunDelta = (ureaBalanceMmol * 2.8) / (Math.max(vdUreaL, 5) * 10);
  b.bun = clamp(b.bun + bunDelta * dt, 2, 300);

  // Phosphate, calcium, magnesium: intake vs excretion with bone/gut buffering.
  const piIntake = clamp(p.proteinIntake * 0.15, 5, 80); // mmol/day absorbed
  const piOut = k.urine.exc.Pi;
  b.pi = clamp(b.pi + ((piIntake - piOut) / Math.max(b.tbw * 0.4, 5)) * dt * 0.5, 0.2, 5);
  const caIntake = 25 * clamp(ev.reg.hormones.calcitriol, 0.1, 3);
  const caOut = k.urine.exc.Ca + 20;
  const boneBuffer = clamp(ev.reg.hormones.pth, 0.1, 20);
  b.ca = clamp(b.ca + (((caIntake - caOut) / 100) * dt + 0.02 * (boneBuffer - 1) * dt) * 0.3, 1.2, 4.0);
  const mgIntake = 12;
  b.mg = clamp(b.mg + ((mgIntake - k.urine.exc.Mg) / 200) * dt, 0.2, 2.5);

  return { state: { body: b, day: state.day + dt }, ev };
}

/** Run to (approximate) steady state: used for "what does this state look like at equilibrium". */
export function runToSteadyState(params: Params, days = 40, dt = 0.5, start?: BodyState) {
  let state: SimState = { body: start ? { ...start } : initialBody(params), day: 0 };
  let ev = evaluate(state.body, params);
  for (let i = 0; i < Math.round(days / dt); i++) {
    const next = stepDay(state, params, dt, ev.reg);
    state = next.state;
    ev = next.ev;
  }
  return { state, ev };
}

/** Simulate a time course and return the trajectory (for the dynamic charts). */
export interface TrajectoryPoint {
  day: number;
  Na: number;
  K: number;
  HCO3: number;
  pH: number;
  creat: number;
  eGFR: number;
  GFR: number;
  BUN: number;
  urineVolume: number;
  urineOsm: number;
  weightChange: number;
  MAP: number;
  ecf: number;
  edema: number;
  aldo: number;
  adh: number;
  renin: number;
}

export function simulate(params: Params, days: number, dt = 0.25, start?: BodyState): { points: TrajectoryPoint[]; final: Evaluation; state: SimState } {
  let state: SimState = { body: start ? { ...start } : initialBody(params), day: 0 };
  let ev = evaluate(state.body, params);
  const tbw0 = state.body.tbw;
  const points: TrajectoryPoint[] = [];
  const steps = Math.max(1, Math.round(days / dt));
  for (let i = 0; i <= steps; i++) {
    points.push({
      day: state.day,
      Na: ev.plasma.Na,
      K: ev.plasma.K,
      HCO3: ev.body.hco3,
      pH: ev.plasma.pH,
      creat: ev.body.creat,
      eGFR: ev.derived.eGFR,
      GFR: ev.kidney.GFR,
      BUN: ev.body.bun,
      urineVolume: ev.kidney.urine.volumePerDay,
      urineOsm: ev.kidney.urine.osm,
      weightChange: state.body.tbw - tbw0,
      MAP: ev.reg.MAP,
      ecf: ev.plasma.ecf,
      edema: state.body.edema,
      aldo: ev.reg.hormones.aldo,
      adh: ev.reg.hormones.adh,
      renin: ev.reg.hormones.renin,
    });
    if (i === steps) break;
    const next = stepDay(state, params, dt, ev.reg);
    state = next.state;
    ev = next.ev;
  }
  return { points, final: ev, state };
}
