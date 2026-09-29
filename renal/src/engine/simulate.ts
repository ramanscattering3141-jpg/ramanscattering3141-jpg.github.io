// The integrated model: body state -> plasma -> hormones -> kidney -> excretion -> body state.
//
// `evaluate` runs one steady-state pass for a given body state (what the interactive panels
// show). `stepDay` integrates balance forward in time, which is what makes creatinine rise
// gradually after a fall in GFR and what lets the sandbox reach a new steady state.

import { clamp } from './math';
import {
  derivePlasma,
  ecfVolume,
  edelmanNa,
  initialBody,
  oncoticGradientRel,
  type BodyState,
  type PlasmaDerived,
} from './body';
import { evaluateRegulation, type RegulationState } from './regulation';
import { runKidney } from './kidney';
import type { KidneyResult, Params } from './types';

export interface SimState {
  body: BodyState;
  /** simulated time in days since the scenario started */
  day: number;
  /**
   * Set when the body composition has run into one of the model's limits (for example total
   * body water at the ceiling). Beyond that point the equations no longer describe a living
   * patient, so the simulation is held there and the interface says so rather than reporting
   * numbers that look precise and are meaningless.
   */
  outOfRange?: string;
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
/** Renal clearance of the retained organic anions, L/day at a normal GFR. */
const ORG_CLEARANCE_SLOW = 1.5; // lactate: reabsorbed by the proximal Na+-lactate cotransporter, and the
//                                hypoperfusion that produces it leaves little urine to lose it in
const ORG_CLEARANCE_KETO = 5; // ketoacid anions: filtered beyond the tubule's capacity and readily lost
/** Rate at which an organic anion no longer being produced is metabolised back to bicarbonate. */
const ORG_METABOLISM = 1.5; // per day
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

export function evaluate(body: BodyState, params: Params, prevReg?: RegulationState, prevKidney?: KidneyResult): Evaluation {
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

  // Both fixed points are seeded from the previous evaluation. Between sub-steps the body has
  // barely changed, so the solve collapses from ~10 damped passes to one or two.
  const mdSeed = prevKidney?.maculaDensa;
  let kidney = runKidney({
    params,
    plasma,
    hormones: reg.hormones,
    MAP: reg.MAP,
    ureaProduction: ureaGeneration(params) / 1440,
    mdSeed,
  });

  // Close the loop between the kidney's macula densa signal and the hormone system. The two
  // subsystems feed back on each other, so the iterate is damped to stop it ringing.
  let mdBlend = mdSeed ?? kidney.maculaDensa;
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
      mdSeed: kidney.maculaDensa,
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
  // Diarrhoeal fluid carries as much as 50 mmol/L of base (Rose ch. 19) — bicarbonate plus the
  // organic anions that are metabolised back to it. That figure is also what makes the stool
  // electroneutral against its cations (Na 60 + K 35 against Cl 45 + base 50), which is why the
  // acidosis of diarrhoea comes out hyperchloraemic with a normal anion gap.
  const stoolHCO3 = p.diarrhea * 50;
  const naOut = kidney.urine.exc.Na + gastricNa + stoolNa + 10;
  const kOut = kidney.urine.exc.K + gastricK + stoolK + 10;
  const waterOut = kidney.urine.exc.water + p.insensible + p.vomiting + p.diarrhea;
  // An exogenous acid load is given as ammonium chloride or hydrochloric acid, so it brings its
  // own chloride: that is why it is the archetypal normal-anion-gap (hyperchloraemic) acidosis
  // (Rose Table 19-4). Organic acids bring an organic anion instead, and raise the gap.
  const clIn = p.naIntake + p.ivNS * 154 + p.ivHypertonic * 513 + d.potassiumChloride + Math.max(0, p.extraAcid);
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

  // The interpretation is made on the numbers a blood gas reports, not on the metabolic pool.
  const label = describeAcidBase(plasma.HCO3, plasma.PCO2, plasma.pH, plasma.agCorrected);

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
      acidBase: { pH: plasma.pH, PCO2: plasma.PCO2, HCO3: plasma.HCO3, label: label.primary, compensation: label.compensation },
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

  // For a primary respiratory disturbance the question is whether the *bicarbonate* is where it
  // should be, and the answer depends on how long it has been going on: 1 mmol/L per 10 mmHg
  // acutely against 3.5 chronically for hypercapnia, 2 against 4 for hypocapnia (Rose ch. 20-21).
  // A single set of numbers cannot say which, so both bands are quoted.
  let compensation = '';
  if (primary === 'Respiratory acidosis' || primary === 'Respiratory alkalosis') {
    const d = (pco2 - 40) / 10;
    const [acute, chronic] = pco2 > 40 ? [24 + 1 * d, 24 + 3.5 * d] : [24 + 2 * d, 24 + 4 * d];
    const lo = Math.min(acute, chronic);
    const hi = Math.max(acute, chronic);
    compensation =
      hco3 > hi + 2
        ? `HCO₃⁻ ${hco3.toFixed(0)} is above the ${lo.toFixed(0)}–${hi.toFixed(0)} expected at this PCO₂: superimposed metabolic alkalosis`
        : hco3 < lo - 2
          ? `HCO₃⁻ ${hco3.toFixed(0)} is below the ${lo.toFixed(0)}–${hi.toFixed(0)} expected at this PCO₂: superimposed metabolic acidosis`
          : `HCO₃⁻ ${hco3.toFixed(0)} lies in the ${lo.toFixed(0)}–${hi.toFixed(0)} expected at this PCO₂ (acute to chronic)`;
  } else if (hco3 < 22) {
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
/**
 * Extra water drunk because of thirst, L/day. Thirst rises steeply above its osmotic threshold
 * (a few mOsm/kg above ADH's) and with marked hypovolaemia; with access to water it can match
 * almost any loss, which is why hypernatraemia is uncommon unless thirst or access is impaired
 * (Rose ch. 6, 7, 24).
 */
export function thirstDrive(ev: Evaluation) {
  // Osmotic thirst plus a baroreceptor term. Angiotensin II is dipsogenic too, and it is the
  // reason patients with heart failure and cirrhosis are intensely thirsty at a normal arterial
  // pressure — which is what makes water restriction so hard to achieve in them (Rose ch. 6, 9,
  // 23). It is deliberately not modelled: adding it takes the oedematous states past the point
  // where water intake outruns excretion, and the model then has no steady state to show. What
  // the drive does to a real patient is a matter of how much they actually drink, which is not
  // something this model can know; the pages say so rather than inventing a number for it.
  //
  // The osmotic term is steep. Thirst begins a few mOsm/kg above the ADH threshold and, once
  // crossed, drives whatever intake it takes: a patient with complete central diabetes insipidus
  // passes 10-15 L/day or more and still holds the plasma sodium in the high-normal range, 140-145
  // (Rose ch. 24). About 3 L/day for each mOsm/kg above threshold lets 15 L/day of extra intake
  // arrive at an effective osmolality near 293. A shallow gain here produced sodium near 185 in
  // untreated diabetes insipidus with thirst intact, which is the opposite of the book's point that
  // hypernatraemia is a disorder of thirst or access to water.
  const osmotic = clamp((ev.plasma.effOsm - 288) * 3, 0, 40);
  return osmotic + 1.2 * clamp((0.95 - ev.reg.eabv) * 6, 0, 2);
}

/**
 * Hours of action of one dose, for the agents short enough that it matters. The potassium-sparing
 * agents and spironolactone act long enough to be treated as continuous.
 */
const DOSE_HOURS = { furosemide: 6, thiazide: 12, acetazolamide: 8 } as const;

/**
 * The drug exposure at a given moment, when the diuretic is given as intermittent doses rather
 * than continuously.
 *
 * This is what makes a diuretic's net effect so much smaller than its peak. A single morning dose
 * of a loop diuretic acts for about six hours; for the other eighteen the drug is gone while the
 * volume deficit it created is still driving sodium retention, so excretion falls below intake and
 * cancels much of the earlier loss (Rose ch. 15, Fig. 15-1). Modelled as an exponential decay
 * reaching about 5% of peak at the end of the stated duration, which is smooth enough not to make
 * the integrator stiff at each dose.
 */
export function dosedParams(params: Params, day: number): Params {
  const n = params.diureticDoses;
  if (!n || n <= 0) return params;
  const interval = 24 / n; // hours between doses
  const hour = (((day * 24) % interval) + interval) % interval;
  let changed = false;
  const drugs = { ...params.drugs };
  for (const key of ['furosemide', 'thiazide', 'acetazolamide'] as const) {
    if (!params.drugs[key]) continue;
    const decay = Math.exp((-Math.log(20) * hour) / DOSE_HOURS[key]);
    drugs[key] = params.drugs[key] * decay;
    changed = true;
  }
  return changed ? { ...params, drugs } : params;
}

export function stepDay(
  state: SimState,
  params: Params,
  dt = 1,
  prevReg?: RegulationState,
  /** sub-step size the previous call ended on, so a long run does not restart the ramp */
  h0?: number,
): { state: SimState; ev: Evaluation; rate: number; h: number } {
  const MIN_SUBSTEP = 0.005; // days (~7 min): the shortest step the fast responses need
  const MAX_SUBSTEP = 0.2; // days: safe once nothing is moving quickly any more
  let cur = state;
  let reg = prevReg;
  let ev!: Evaluation;
  let rate = 0;
  let remaining = dt;
  // The stores move at very different speeds depending on the disturbance: minutes-to-hours
  // after a diuretic, days once the new steady state is approached. Sizing each sub-step from
  // how fast the fastest store is actually changing keeps the integrator stable during the
  // transient without paying for tiny steps for the rest of the run.
  let h = Math.min(remaining, h0 ?? MIN_SUBSTEP * 4);
  let guard = 0;
  while (remaining > 1e-9 && guard++ < 2000) {
    h = Math.min(h, remaining);
    const r = substep(cur, dosedParams(params, cur.day), h, reg, ev?.kidney);
    // Reject a step that turned out to move a store by more than ~4% and redo it smaller. Without
    // this, the first sub-step after a sudden change (a drug started, a hormone switched on) can
    // be taken at the large step size the quiet period before it allowed, which overshoots and
    // makes the excretion curves ring for a day or two afterwards.
    // r.ev is the evaluation the step started from; compare the plasma it produced with the
    // plasma the new body implies. Tonicity and plasma K+ are what the fast loops (ADH and
    // thirst, distal K+ and Na+ transport) respond to, and they move much further than the
    // stores do, so a step that is safe for the stores can still set those loops oscillating.
    const after = derivePlasma(r.state.body, params);
    const kJump = Math.abs(after.K - r.ev.plasma.K);
    const osmJump = Math.abs(after.effOsm - r.ev.plasma.effOsm);
    if ((r.rate * h > 0.015 || kJump > 0.1 || osmJump > 1) && h > MIN_SUBSTEP) {
      h = Math.max(MIN_SUBSTEP, h / 2);
      continue;
    }
    cur = r.state;
    ev = r.ev;
    reg = r.ev.reg;
    rate = r.rate;
    remaining -= h;
    if (cur.outOfRange) break;
    // Aim for at most a 1.5% relative change in any store per sub-step, and grow the step back
    // only gently. Growing it quickly after a rejected step just alternates between a step that
    // is too long and one that is rejected, which is what makes a fast loop (water balance) ring.
    const wanted = r.rate > 1e-9 ? 0.015 / r.rate : MAX_SUBSTEP;
    h = clamp(Math.min(wanted, h * 1.15), MIN_SUBSTEP, MAX_SUBSTEP);
  }
  if (!ev) {
    ev = evaluate(cur.body, params, prevReg);
  }
  return { state: cur, ev, rate, h };
}

function substep(state: SimState, params: Params, dt: number, prevReg?: RegulationState, prevKidney?: KidneyResult): { state: SimState; ev: Evaluation; rate: number } {
  const ev = evaluate(state.body, params, prevReg, prevKidney);
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
    waterIn += thirstDrive(ev);
  }
  const tbwWanted = b.tbw + (waterIn - ev.balance.waterOut) * dt;
  const tbwFloor = p.weightKg * 0.32;
  const tbwCeiling = p.weightKg * 1.05;
  b.tbw = clamp(tbwWanted, tbwFloor, tbwCeiling);
  // Running into the water limits means the disturbance has no steady state: water is being
  // retained (or lost) faster than the kidney can compensate, and a real patient would have
  // been treated or died before this point. Record it instead of letting the sodium store go on
  // accumulating in a body of fixed size, which would produce a spurious rise in serum sodium.
  let outOfRange = state.outOfRange;
  if (!outOfRange && tbwWanted > tbwCeiling) {
    outOfRange = 'Water retention outstrips excretion: total body water has reached the limit of what the model can represent.';
  } else if (!outOfRange && tbwWanted < tbwFloor) {
    outOfRange = 'Water losses outstrip intake: total body water has fallen to the limit of what the model can represent.';
  }

  // Oedema (Rose ch. 7, 16): with normal Starling forces the safety factors — lymph flow, a
  // falling interstitial oncotic pressure and a rising interstitial hydraulic pressure — absorb
  // the first ~3 L of extracellular expansion, which stays part of the circulating ECF and so
  // keeps signalling the volume sensors. Raised venous pressure (heart failure), portal
  // hypertension, leaky capillaries or hypoalbuminaemia erode that margin and send more of any
  // excess into the interstitium, where it no longer supports the circulation.
  const ecfNormal = p.weightKg * (p.female ? 0.5 : 0.6) / 3;
  const ecfNow = ecfVolume(b, p.weightKg);
  const excessEcf = Math.max(0, ecfNow - ecfNormal);
  // The albumin term is the loss of transcapillary oncotic gradient, not the fall in plasma
  // albumin: interstitial oncotic pressure falls in parallel and largely preserves the gradient,
  // so moderate hypoalbuminaemia contributes far less than its number suggests (Rose ch. 16).
  const oncoticLoss = 1 - oncoticGradientRel(p.albumin);
  const starlingStress = clamp(
    0.6 * clamp(1 - p.cardiacFunction, 0, 1) + 0.5 * p.portalHypertension + 0.6 * p.capillaryLeak + 0.7 * oncoticLoss + 0.025 * p.venousCongestion,
    0,
    0.95,
  );
  const safetyMargin = 3 * (1 - starlingStress);
  const leakTendency = clamp(0.45 + starlingStress, 0.45, 0.95);
  b.edema = clamp(Math.max(0, excessEcf - safetyMargin) * leakTendency, 0, 40);

  // Acid-base: net acid balance changes the bicarbonate pool (ECF + cell buffering).
  // Bone is a large, slowly exchangeable alkali reservoir: in chronic acidosis it releases
  // carbonate, which is why uraemic and distal-RTA acidosis plateaus instead of falling without
  // limit (at the cost of bone disease).
  const bufferVolume = b.tbw * 0.5;
  const boneAlkali = clamp(3.5 * (22 - b.hco3), 0, 90);
  const netAcid = ev.balance.acidIn - ev.balance.acidOut - boneAlkali;
  b.hco3 = clamp(b.hco3 - (netAcid * dt) / Math.max(bufferVolume, 5), 3, 60);

  // The organic anion left behind by an organic acid load (Rose ch. 19). Every acid arrives with
  // an anion, and what happens to that anion is what decides whether the acidosis has a high or a
  // normal anion gap. Chloride-borne acids are handled by the chloride balance above; this pool
  // is for the anions the kidney clears slowly enough that they accumulate — lactate, ketoacid
  // anions, formate, glycolate.
  //
  // How slowly differs between them, and that difference is what sets the Δ anion gap / Δ
  // bicarbonate ratio. Ketoacid anions are filtered beyond the tubule's reabsorptive capacity and
  // lost in the urine readily enough to keep the ratio near 1:1; lactate is reclaimed by a
  // proximal Na+-lactate cotransporter, and the hypoperfusion that produces it leaves little
  // urine to lose it in, so it accumulates and pushes the ratio toward 1.6:1.
  const gfrRel = clamp(ev.kidney.GFR / 125, 0.02, 1.6);
  const organicGenerated = (p.lacticAcid + p.ketoAcid + p.toxicAcid) * 24;
  const organicClearance =
    (organicGenerated > 0
      ? (ORG_CLEARANCE_SLOW * (p.lacticAcid + p.toxicAcid) + ORG_CLEARANCE_KETO * p.ketoAcid) / (p.lacticAcid + p.ketoAcid + p.toxicAcid)
      : ORG_CLEARANCE_SLOW) * gfrRel;
  // Once production falls away, what the kidney has not excreted is metabolised back to
  // bicarbonate — which is why lactic acidosis and ketoacidosis correct themselves when the
  // underlying problem is treated, and why giving bicarbonate for them risks an overshoot.
  const organicSustained = clamp(organicGenerated / Math.max(organicClearance, 0.5), 0, 60);
  const organicMetabolised = Math.max(0, b.organicAnions - organicSustained) * ORG_METABOLISM;
  b.organicAnions = clamp(
    b.organicAnions + ((organicGenerated - b.organicAnions * organicClearance) / Math.max(ecfNow, 1) - organicMetabolised) * dt,
    0,
    60,
  );
  b.hco3 = clamp(b.hco3 + (organicMetabolised * ecfNow * dt) / Math.max(bufferVolume, 5), 3, 60);

  // Contraction alkalosis: losing Cl-rich, HCO3-poor fluid concentrates the bicarbonate pool.
  const ecfBefore = ev.plasma.ecf;
  const ecfAfter = ecfNow;
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

  // How fast is the fastest store moving, as a fraction of itself per day? The integrator uses
  // this to choose its next step, and `runToSteadyState` uses it to know when to stop.
  const rate = Math.max(
    Math.abs(ev.balance.naIn - ev.balance.naOut) / Math.max(b.naE, 1),
    Math.abs(ev.balance.kIn - ev.balance.kOut) / Math.max(b.kE, 1),
    Math.abs(ev.balance.clIn - ev.balance.clOut) / Math.max(b.clE, 1),
    Math.abs(waterIn - ev.balance.waterOut) / Math.max(b.tbw, 1),
    Math.abs(netAcid) / Math.max(bufferVolume * b.hco3, 1),
    Math.abs(creatGen - creatExcreted) / Math.max(vdCreatDl * b.creat, 1),
    Math.abs(bunDelta) / Math.max(b.bun, 1),
  );

  // A disturbance with no steady state eventually takes the body somewhere no patient survives.
  // The equations keep producing numbers there, so the limits are stated explicitly: past them
  // the trajectory is held and the interface says the disturbance is lethal rather than
  // reporting a serum sodium of 57 as though it were a finding.
  //
  // The test is the direction of travel, not the value alone. A treatment simulation starts from
  // the severe state it is treating - a sodium of 185 in untreated diabetes insipidus, a
  // bicarbonate of 4 in untreated ketoacidosis - and the first thing it does is move back towards
  // normal. Stopping such a run at its first step would report a successful treatment as a lethal
  // disturbance. Only a body still moving away from life is out of range.
  if (!outOfRange) {
    const naPrev = edelmanNa(state.body.naE, state.body.kE, state.body.tbw);
    const naNext = edelmanNa(b.naE, b.kE, b.tbw);
    if (naNext < 100 && naNext <= naPrev) outOfRange = 'Serum sodium has fallen below 100 mmol/L, which is not survivable: the disturbance has no steady state and would have been treated long before this.';
    else if (naNext > 185 && naNext >= naPrev) outOfRange = 'Serum sodium has risen above 185 mmol/L, which is not survivable: the disturbance has no steady state.';
    else if (b.hco3 <= 4 && b.hco3 <= state.body.hco3) outOfRange = 'Bicarbonate has been consumed almost completely: the acid load exceeds anything the kidney and buffers can offset.';
    else if (b.hco3 >= 55 && b.hco3 >= state.body.hco3) outOfRange = 'Bicarbonate has risen beyond what the model can represent.';
  }

  return { state: { body: b, day: state.day + dt, outOfRange }, ev, rate };
}

/** Run to (approximate) steady state: used for "what does this state look like at equilibrium". */
export function runToSteadyState(params: Params, days = 40, dt = 0.5, start?: BodyState) {
  let state: SimState = { body: start ? { ...start } : initialBody(params), day: 0 };
  let ev = evaluate(state.body, params);
  const steps = Math.round(days / dt);
  let h: number | undefined;
  for (let i = 0; i < steps; i++) {
    const next = stepDay(state, params, dt, ev.reg, h);
    state = next.state;
    ev = next.ev;
    h = next.h;
    // Stop once every store is within a thousandth of a per cent of balance. Ongoing losses
    // (a diuretic, diarrhoea) hold the rate above this, so those runs still use the full time.
    if (next.rate < 1e-5 && i > 4) break;
    if (state.outOfRange) break;
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
  anp: number;
  /** urinary Na+ excretion, mmol/day */
  urineNa: number;
  /** urinary K+ excretion, mmol/day */
  urineK: number;
  /** change in exchangeable Na+ since the start, mmol (cumulative balance) */
  naBalance: number;
  /** urinary Cl- excretion, mmol/day */
  urineCl: number;
  /** fractional excretion of Na+, per cent */
  fena: number;
  /** fractional excretion of urea, per cent */
  feurea: number;
  urinePH: number;
  /** arterial PCO2, mmHg */
  PCO2: number;
  /** plasma chloride, mmol/L */
  Cl: number;
  /** plasma anion gap, mmol/L */
  anionGap: number;
  /** urine anion gap Na+ + K+ - Cl-, mmol/L — a proxy for ammonium excretion (Rose Fig. 19-1) */
  urineAnionGap: number;
  /** urinary NH4+ excretion, mmol/day */
  urineNH4: number;
  /** net acid excretion, mmol/day */
  nae: number;
}

export function simulate(params: Params, days: number, dt = 0.25, start?: BodyState): { points: TrajectoryPoint[]; final: Evaluation; state: SimState } {
  let state: SimState = { body: start ? { ...start } : initialBody(params), day: 0 };
  let ev = evaluate(state.body, params);
  const tbw0 = state.body.tbw;
  const naE0 = state.body.naE;
  const points: TrajectoryPoint[] = [];
  const steps = Math.max(1, Math.round(days / dt));
  let h: number | undefined;
  for (let i = 0; i <= steps; i++) {
    points.push({
      day: state.day,
      Na: ev.plasma.Na,
      K: ev.plasma.K,
      // the plasma bicarbonate a blood gas would report, which includes the immediate non-renal
      // buffering of the prevailing PCO2 — not the metabolic pool the kidney adjusts
      HCO3: ev.plasma.HCO3,
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
      anp: ev.reg.hormones.anp,
      urineNa: ev.kidney.urine.exc.Na,
      urineK: ev.kidney.urine.exc.K,
      naBalance: state.body.naE - naE0,
      urineCl: ev.kidney.urine.exc.Cl,
      fena: ev.derived.FENa,
      feurea: ev.derived.FEUrea,
      urinePH: ev.kidney.urine.pH,
      PCO2: ev.plasma.PCO2,
      Cl: ev.plasma.Cl,
      anionGap: ev.plasma.anionGap,
      urineAnionGap: ev.derived.urineAnionGap,
      urineNH4: ev.kidney.urine.exc.NH4,
      nae: ev.kidney.urine.exc.NAE,
    });
    if (i === steps || state.outOfRange) break;
    const next = stepDay(state, params, dt, ev.reg, h);
    state = next.state;
    ev = next.ev;
    h = next.h;
  }
  return { points, final: ev, state };
}

/**
 * Settle the body on one set of parameters, then switch to another and record the transition —
 * the shape of most teaching experiments (a diet changed, a drug started, an injury sustained).
 *
 * With `fineDays` and `coarseDt`, the first part is recorded at `dt` and the remainder at the
 * coarser interval. That matters for speed as well as detail: the integrator cannot take a
 * substep longer than the recording interval, so recording a fortnight at half-hourly resolution
 * costs several seconds, while the information a perturbation carries is nearly all in its first
 * hours. The cumulative fields (`naBalance`, `weightChange`) restart at zero in each `simulate`
 * call, so the second phase is offset to stay continuous with the first.
 */
export function stepCourse(
  from: Params,
  to: Params,
  days: number,
  dt: number,
  settleDays = 60,
  fineDays?: number,
  coarseDt?: number,
): { points: TrajectoryPoint[]; final: Evaluation; state: SimState; before: Evaluation } {
  const settled = runToSteadyState(from, settleDays);
  if (!fineDays || !coarseDt || fineDays >= days) {
    const r = simulate(to, days, dt, settled.state.body);
    return { ...r, before: settled.ev };
  }
  const fine = simulate(to, fineDays, dt, settled.state.body);
  const rest = simulate(to, days - fineDays, coarseDt, fine.state.body);
  const last = fine.points[fine.points.length - 1];
  const points = fine.points.concat(
    rest.points.slice(1).map((p) => ({
      ...p,
      day: p.day + fineDays,
      naBalance: p.naBalance + last.naBalance,
      weightChange: p.weightChange + last.weightChange,
    })),
  );
  return { points, final: rest.final, state: rest.state, before: settled.ev };
}
