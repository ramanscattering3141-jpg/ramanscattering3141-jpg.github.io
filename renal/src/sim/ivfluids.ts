// Intravenous fluids in health and illness: where an infused litre goes, minute by minute.
//
// A teaching model, separate from the whole-body renal engine. Three water compartments (plasma,
// interstitium, cells) for the round-numbers 100 kg person of the body-water module (5 / 15 / 40 L),
// joined by:
//   · Starling filtration plasma → interstitium, with lymph returning fluid and albumin
//     (the revised Starling view: filtration is continuous and lymph is the main way back;
//     absorption from the interstitium is only transient and weak — Levick & Michel 2010,
//     Woodcock & Woodcock 2012);
//   · an interstitial compliance curve: stiff near normal (pressure rises, lymph speeds up), then
//     slack, so that beyond ~2–3 L fluid pools as oedema (Rose ch. 7 and 16; Guyton);
//   · osmotic equilibrium with cells, so hypotonic fluid enters cells and hypertonic fluid draws water out;
//   · a Guyton circulation — venous return (mean systemic filling pressure − right atrial pressure)
//     meeting a Frank–Starling cardiac function curve — so a bolus raises cardiac output only while the
//     heart is on the steep part of its curve;
//   · a kidney that excretes excess isotonic fluid slowly (≈⅓ of 2 L saline by 6 h in volunteers —
//     Lobo 2001) and free water fast unless ADH is held up by non-osmotic stimuli.
// Every patient state changes named parameters of this one model. Numbers are illustrative.

export type FluidId = 'saline' | 'ringer' | 'plasmalyte' | 'd5w' | 'albumin5' | 'albumin25' | 'saline3' | 'rbc';

export interface Fluid {
  id: FluidId;
  name: string;
  short: string;
  /** mmol/L */
  na: number;
  cl: number;
  /** albumin, g/L */
  alb: number;
  /** red-cell fraction of the bag */
  hct: number;
  /** typical volume of one unit or bolus, L */
  unit: number;
  note: string;
}

export const FLUIDS: Fluid[] = [
  { id: 'saline', name: '0.9% saline', short: 'Saline', na: 154, cl: 154, alb: 0, hct: 0, unit: 1, note: 'Na⁺ and Cl⁻ 154 mmol/L: isotonic, but more chloride than plasma (≈104), so large volumes cause a hyperchloraemic acidosis.' },
  { id: 'ringer', name: 'Ringer’s lactate', short: 'Ringer’s', na: 130, cl: 109, alb: 0, hct: 0, unit: 1, note: 'Na⁺ 130, Cl⁻ 109, lactate 28 (metabolised to bicarbonate). Slightly hypotonic: a little water enters cells.' },
  { id: 'plasmalyte', name: 'Plasma-Lyte 148 (balanced)', short: 'Plasma-Lyte', na: 140, cl: 98, alb: 0, hct: 0, unit: 1, note: 'Na⁺ 140, Cl⁻ 98, acetate and gluconate (metabolised to bicarbonate). The closest crystalloid to plasma.' },
  { id: 'd5w', name: '5% dextrose (D5W)', short: 'D5W', na: 0, cl: 0, alb: 0, hct: 0, unit: 1, note: 'The glucose is metabolised, so this is free water: two-thirds ends up inside cells. It is not a volume expander.' },
  { id: 'albumin5', name: '5% albumin', short: '5% albumin', na: 145, cl: 110, alb: 50, hct: 0, unit: 0.5, note: 'Iso-oncotic colloid: stays in plasma while the capillary barrier holds. Na⁺ ≈145; chloride varies by product (≈110 assumed).' },
  { id: 'albumin25', name: '25% albumin', short: '25% albumin', na: 145, cl: 100, alb: 250, hct: 0, unit: 0.1, note: 'Hyperoncotic: 100 mL draws roughly 3–4 times its volume from the interstitium into plasma — but only if there is interstitial fluid to draw and the barrier holds.' },
  { id: 'saline3', name: '3% saline', short: '3% saline', na: 513, cl: 513, alb: 0, hct: 0, unit: 0.15, note: 'Na⁺ 513 mmol/L: pulls water out of cells. For symptomatic hyponatraemia and raised intracranial pressure, not for volume.' },
  { id: 'rbc', name: 'Packed red cells', short: 'Red cells', na: 140, cl: 104, alb: 5, hct: 0.6, unit: 0.3, note: 'One unit ≈300 mL at a haematocrit of ≈0.6. The red cells never leave the circulation.' },
];

export interface Patient {
  id: string;
  name: string;
  /** one-line description */
  summary: string;
  /** starting deviations from the normal 5 / 15 / 40 L (L) */
  dPlasma: number;
  dIsf: number;
  /** whole blood lost before treatment (L) — removes red cells too */
  bleed: number;
  /** starting plasma albumin, g/L */
  albumin: number;
  /** capillary filtration coefficient × normal */
  kf: number;
  /** reflection coefficient for albumin (0.9 normal) */
  sigma: number;
  /** albumin leak (transcapillary escape) × normal */
  albLeak: number;
  /** lymph capacity × normal */
  lymph: number;
  /** extra venous capacitance (L) — venodilation pools blood that no longer fills the heart */
  venodilation: number;
  /** systemic vascular resistance × normal */
  svr: number;
  /** resistance to venous return × normal (falls with arterial dilation) */
  rvr: number;
  /** cardiac function: maximum output (L/min) and the right-atrial pressure where it starts to rise */
  coMax: number;
  raZero: number;
  /** how gently the cardiac curve rises (mmHg); larger = flatter, less preload-responsive */
  cardiacSlope: number;
  /** renal excretion of excess isotonic fluid × normal (sodium avidity, AKI, anaesthesia) */
  renalNa: number;
  /** the kidney defends the patient's current (expanded) volume rather than the normal one: sodium avidity
   *  driven by low effective arterial volume (heart failure, cirrhosis) or primary retention (nephrotic) */
  retains: boolean;
  /** free-water excretion × normal (ADH held up by non-osmotic stimuli lowers it) */
  renalWater: number;
  /** venous congestion lowers GFR (heart failure) */
  congestionSensitive: boolean;
  /** starting plasma Na⁺ */
  na: number;
}

const NORMAL_PATIENT: Omit<Patient, 'id' | 'name' | 'summary'> = {
  dPlasma: 0,
  dIsf: 0,
  bleed: 0,
  albumin: 40,
  kf: 1,
  sigma: 0.9,
  albLeak: 1,
  lymph: 1,
  venodilation: 0,
  svr: 1,
  rvr: 1,
  coMax: 10,
  raZero: -1,
  cardiacSlope: 4.2,
  renalNa: 1,
  retains: false,
  renalWater: 1,
  congestionSensitive: false,
  na: 140,
};

export const PATIENTS: Patient[] = [
  { id: 'healthy', name: 'Healthy volunteer', summary: 'Normal volume, normal barrier, a kidney free to excrete. The reference case (Lobo 2001).', ...NORMAL_PATIENT },
  {
    id: 'hypovolaemic',
    name: 'Hypovolaemia (GI losses)',
    summary: '3 L of isotonic fluid lost from the ECF: low capillary pressure, so infused crystalloid stays in plasma longer.',
    ...NORMAL_PATIENT,
    dPlasma: -0.7,
    dIsf: -2.3,
    venodilation: -0.3, // sympathetic venoconstriction recruits unstressed volume
    svr: 1.15,
    renalNa: 0.6,
  },
  {
    id: 'haemorrhage',
    name: 'Haemorrhage (1.5 L)',
    summary: 'Whole blood lost: red cells and plasma together. Crystalloid restores volume but dilutes the haemoglobin.',
    ...NORMAL_PATIENT,
    bleed: 1.5,
    venodilation: -0.8,
    svr: 1.3,
    renalNa: 0.5,
  },
  {
    id: 'sepsis',
    name: 'Septic shock',
    summary: 'Leaky capillaries (glycocalyx damage), albumin escaping >3× faster, venodilation, low vascular resistance, a stressed kidney and non-osmotic ADH.',
    ...NORMAL_PATIENT,
    albumin: 28,
    kf: 2.5,
    sigma: 0.55,
    albLeak: 3.5,
    lymph: 0.8,
    venodilation: 0.2,
    svr: 0.72,
    rvr: 0.75,
    coMax: 9,
    cardiacSlope: 5,
    renalNa: 0.3,
    renalWater: 0.1,
    dPlasma: -0.3,
    dIsf: 0.8,
  },
  {
    id: 'hf',
    name: 'Decompensated heart failure',
    summary: 'A flat cardiac function curve, high venous pressure, already oedematous, and a kidney retaining sodium; congestion itself lowers GFR.',
    ...NORMAL_PATIENT,
    dPlasma: 1.0,
    dIsf: 3.5,
    albumin: 35,
    venodilation: -0.8, // sympathetic venoconstriction
    svr: 1.3,
    coMax: 6,
    raZero: 6,
    cardiacSlope: 10,
    renalNa: 0.25,
    retains: true,
    renalWater: 0.3,
    congestionSensitive: true,
    na: 134,
  },
  {
    id: 'cirrhosis',
    name: 'Cirrhosis with ascites',
    summary: 'Low albumin, splanchnic vasodilation and pooling, low vascular resistance, and a kidney avidly retaining sodium and water.',
    ...NORMAL_PATIENT,
    albumin: 25,
    dPlasma: 1.0,
    dIsf: 5,
    venodilation: 0.6, // splanchnic pooling
    svr: 0.5,
    rvr: 0.6,
    renalNa: 0.15,
    retains: true,
    renalWater: 0.25,
    na: 132,
  },
  {
    id: 'nephrotic',
    name: 'Nephrotic syndrome',
    summary: 'Albumin 18 g/L but an intact barrier; interstitial protein has fallen in parallel, and the kidney retains sodium on its own (overfill).',
    ...NORMAL_PATIENT,
    albumin: 18,
    dIsf: 4,
    renalNa: 0.3,
    retains: true,
  },
  {
    id: 'aki',
    name: 'Oliguric AKI',
    summary: 'Normal barrier and heart, but a kidney that excretes almost nothing: every litre given stays in the body.',
    ...NORMAL_PATIENT,
    renalNa: 0.02,
    renalWater: 0.02,
  },
  {
    id: 'postop',
    name: 'After major surgery',
    summary: 'Anaesthesia and stress: renal clearance of infused fluid falls to 10–20% of normal (Hahn 2010), ADH is high, the barrier is mildly leaky.',
    ...NORMAL_PATIENT,
    kf: 1.4,
    albLeak: 2,
    renalNa: 0.2,
    renalWater: 0.1,
  },
];

export interface Plan {
  fluid: FluidId;
  /** total volume, L */
  volume: number;
  /** infusion time, minutes */
  minutes: number;
  /** a background maintenance infusion of 5% dextrose, L/day (0 = none) */
  maintenance: number;
  /** noradrenaline: raises vascular resistance and venous tone */
  pressor: boolean;
  /** loop diuretic: releases the kidney's sodium avidity */
  diuretic: boolean;
  /** hours to simulate */
  hours: number;
}

export interface Snapshot {
  t: number; // hours
  plasma: number;
  isf: number;
  icf: number;
  urine: number; // cumulative, L
  infused: number; // cumulative, L
  na: number;
  cl: number;
  hco3: number;
  albumin: number;
  hb: number; // g/L
  co: number; // L/min
  map: number;
  cvp: number;
  pc: number; // capillary pressure
  filtration: number; // L/h
  lymphFlow: number; // L/h
  urineRate: number; // L/h
  oedema: number; // interstitial excess over normal, L
}

// Normal reference values for the 100 kg person.
const PV0 = 5;
const ISF0 = 15;
const ICF0 = 40;
const HCT0 = 0.42;
const RBC0 = (PV0 * HCT0) / (1 - HCT0);
const HB_PER_HCT = 340; // g/L of haemoglobin per unit haematocrit (Hb 140 at Hct 0.42 → MCHC ≈ 333)
const ALB_ISF0 = 17; // g/L: interstitial albumin ≈ 40% of plasma, giving π ≈ 8 mmHg (Rose Table 7-2)
const LYMPH0 = 8 / 24; // L/h: ≈8 L/day of capillary filtrate returns as lymph (Levick & Michel 2010)
const PIF0 = -1; // mmHg, subcutaneous interstitial pressure
const STRESSED0 = 1.4; // L of blood volume that stretches the vessels (the rest is "unstressed")
const CVASC = 0.2; // L/mmHg, whole-circulation compliance
const RVR = 1.0; // mmHg·min/L, resistance to venous return
const SVR0 = (93 - 2) / 5.1; // mmHg·min/L
// Whole-body capillary filtration coefficient. Large, so that crystalloid distributes between plasma
// and interstitium within tens of minutes, as volume kinetics shows (Hahn 2010); the resting net
// filtration pressure is correspondingly small (≈1 mmHg), as in the revised Starling principle.
const KF0 = 0.4; // L/h per mmHg

/** Colloid osmotic pressure from albumin (g/L), with globulins in proportion (Landis–Pappenheimer). */
export function oncotic(albGL: number): number {
  const tp = Math.max(0, (albGL * 1.7) / 10); // total protein, g/dL
  return 2.1 * tp + 0.16 * tp * tp + 0.009 * tp * tp * tp;
}

/** Interstitial pressure from volume: stiff close to normal, then slack (Guyton's curve). */
function interstitialPressure(isf: number): number {
  const e = isf - ISF0;
  if (e >= 0) return PIF0 + 4 * (1 - Math.exp(-e / 1.6));
  return Math.max(-9, PIF0 + e * 1.2);
}

/** Right-atrial pressure where venous return meets the cardiac function curve, and the flow there. */
function circulation(bloodVolume: number, p: Patient, pressor: boolean, mapSet?: number) {
  const unstressed = 8.62 - STRESSED0 + p.venodilation - (pressor ? 0.3 : 0);
  const pmsf = Math.max(0.5, (bloodVolume - unstressed) / CVASC);
  const heart = (ra: number) => Math.max(0, p.coMax * (1 - Math.exp(-(ra - p.raZero) / p.cardiacSlope)));
  let lo = -5;
  let hi = pmsf;
  for (let i = 0; i < 50; i++) {
    const ra = (lo + hi) / 2;
    const vr = (pmsf - ra) / (RVR * p.rvr);
    if (heart(ra) > vr) hi = ra;
    else lo = ra;
  }
  const cvp = (lo + hi) / 2;
  const co = Math.max(0.3, (pmsf - cvp) / (RVR * p.rvr));
  const raw = cvp + co * SVR0 * p.svr * (pressor ? 1.5 : 1);
  // The baroreflex adjusts vascular resistance to hold pressure near where it started (about half the change).
  const map = mapSet === undefined ? raw : mapSet + (raw - mapSet) * 0.5;
  return { cvp, co, map, pmsf };
}

interface State {
  pv: number;
  isf: number;
  icf: number;
  rbc: number;
  albP: number; // g in plasma
  albI: number; // g in interstitium
  naE: number; // mmol of Na⁺ in the ECF
  clE: number; // mmol of Cl⁻ in the ECF
  icfOsm: number; // mOsm inside cells
  urine: number;
  infused: number;
}

function initial(p: Patient): State {
  const pv = PV0 + p.dPlasma - p.bleed * (1 - HCT0);
  const rbc = RBC0 - p.bleed * HCT0;
  const isf = ISF0 + p.dIsf;
  const ecf = pv + isf;
  const osm = 2 * p.na;
  // Interstitial albumin falls with plasma albumin (chronically the interstitium adapts), is diluted in
  // oedema fluid, and is higher where the barrier leaks.
  const albIsf = ALB_ISF0 * (p.albumin / 40) * Math.pow(ISF0 / (ISF0 + p.dIsf), 0.7) * Math.pow(p.albLeak, 0.35);
  return {
    pv,
    isf,
    icf: ICF0 * (280 / osm),
    rbc,
    albP: p.albumin * pv,
    albI: albIsf * isf,
    naE: p.na * ecf,
    clE: (104 - (140 - p.na) * 0.7) * ecf,
    icfOsm: ICF0 * 280,
    urine: 0,
    infused: 0,
  };
}

const PI_P0 = oncotic(40);
const PI_I0 = oncotic(ALB_ISF0);
// The capillary pressure offset is set so the normal person filters exactly what lymph returns.
const PC_OFFSET = LYMPH0 / KF0 + PIF0 + 0.9 * (PI_P0 - PI_I0) - (2 + 0.16 * (93 - 2));
const ALB_ESCAPE0 = (LYMPH0 * ALB_ISF0) / (40 * PV0); // fraction of plasma albumin leaving per hour

interface Ctx {
  p: Patient;
  plan: Plan;
  fluid: Fluid;
  /** the blood volume the kidney defends, L */
  defended: number;
  /** the osmolality below which free water is excreted */
  osmSet: number;
  /** this patient's own capillary-pressure shift that makes their starting state a steady state (mmHg) */
  pcAdj: number;
  /** filtration at the start, L/h: albumin escape is partly carried by filtered fluid */
  filt0: number;
  /** fraction of plasma albumin escaping per hour at the start (steady state with lymphatic return) */
  albK: number;
  /** the interstitial volume the kidney regards as normal for this patient */
  isfSet: number;
  /** the arterial pressure the baroreflex defends (the patient's own, before treatment) */
  mapSet?: number;
}

interface Flows {
  circ: ReturnType<typeof circulation>;
  pc: number;
  filtration: number;
  lymphFlow: number;
  albOut: number;
  albBack: number;
  isoRate: number;
  waterRate: number;
  osm: number;
}

function flows(s: State, c: Ctx, renal: boolean): Flows {
  const { p, plan } = c;
  const circ = circulation(s.pv + s.rbc, p, plan.pressor, c.mapSet);
  const albI = s.albI / s.isf;
  const piP = oncotic(s.albP / s.pv);
  const piI = oncotic(albI);
  const pif = interstitialPressure(s.isf);
  // Capillary pressure: venous pressure plus a small share of the arterial pressure (precapillary
  // autoregulation keeps most of it away).
  const pc = circ.cvp + PC_OFFSET + c.pcAdj + 0.16 * Math.max(0, circ.map - circ.cvp);
  let nfp = pc - pif - p.sigma * (piP - piI);
  // "No absorption": reversal is weak and transient; filtration is the rule.
  if (nfp < 0) nfp *= 0.25;
  // Perfused capillary surface: sympathetic constriction in an underfilled circulation closes capillaries,
  // so less of an infusion is filtered early (the "context sensitivity" of volume kinetics).
  // Only where arterioles are constricted: a vasoplegic (septic, cirrhotic) circulation has lost this.
  const recruit = p.svr > 1 ? 0.15 + 0.85 * Math.min(1, (circ.pmsf / 7) ** 3) : 1;
  const filtration = KF0 * p.kf * recruit * nfp; // L/h
  // Lymph rises steeply with interstitial pressure, then saturates at about six times normal.
  const dp = pif - PIF0;
  const lymphFlow = LYMPH0 * p.lymph * (dp >= 0 ? 1 + 5 * (1 - Math.exp((-2 * dp) / 5)) : Math.max(0.3, 1 + 0.25 * dp));
  // Albumin escape: part diffusive, part carried with filtered fluid (so more filtration, more loss —
  // why saline lowers plasma albumin by more than dilution, Lobo 2001).
  const albOut = c.albK * s.albP * (0.4 + (0.6 * Math.max(0, filtration)) / Math.max(0.05, c.filt0)); // g/h
  const albBack = lymphFlow * albI; // g/h
  const osm = (2 * s.naE + s.icfOsm) / (s.pv + s.isf + s.icf);
  let isoRate = 0;
  let waterRate = 0;
  if (renal) {
    // Isotonic excretion answers the excess blood volume over what the kidney defends and needs
    // perfusion; free water answers a fall in osmolality unless ADH is held up.
    const perfusion = Math.max(0, Math.min(1, (circ.map - 55) / 25));
    const congestion = p.congestionSensitive ? Math.max(0.3, 1 - Math.max(0, circ.cvp - 12) * 0.06) : 1;
    const avidity = plan.diuretic ? Math.max(p.renalNa, 0.02) * 4 + 0.4 : p.renalNa;
    const defended = plan.diuretic ? Math.min(c.defended, PV0 + RBC0) : c.defended;
    // The kidney senses the circulation above all, but the whole extracellular fluid in the end.
    const signal = s.pv + s.rbc - defended + 0.6 * (s.isf - c.isfSet);
    isoRate = Math.max(0, signal) * 0.1 * avidity * perfusion * congestion; // L/h
    if (plan.diuretic && p.renalNa > 0.05) isoRate += 0.12 * perfusion * congestion; // obligatory natriuresis
    waterRate = Math.max(0, c.osmSet - osm) * 0.13 * p.renalWater * perfusion; // L/h
  }
  return { circ, pc, filtration, lymphFlow, albOut, albBack, isoRate, waterRate, osm };
}

/** One step of dt hours: infusion, capillary exchange, urine, osmotic equilibrium. */
function step(s: State, c: Ctx, f: Flows, dt: number, infusing: boolean) {
  const { plan, fluid } = c;
  const rate = infusing ? plan.volume / (plan.minutes / 60) : 0; // L/h
  const vIn = rate * dt;
  const maint = (plan.maintenance / 24) * dt; // 5% dextrose: free water
  s.pv += vIn * (1 - fluid.hct) + maint;
  s.rbc += vIn * fluid.hct;
  s.albP += vIn * fluid.alb;
  s.naE += vIn * (1 - fluid.hct) * fluid.na;
  s.clE += vIn * (1 - fluid.hct) * fluid.cl;
  s.infused += vIn + maint;

  const jv = (f.filtration - f.lymphFlow) * dt;
  s.pv -= jv;
  s.isf += jv;
  s.albP = Math.max(1, s.albP + (f.albBack - f.albOut) * dt);
  s.albI = Math.max(1, s.albI + (f.albOut - f.albBack) * dt);

  // Urine: the isotonic part carries Na⁺ and Cl⁻ at plasma concentration; free water carries none.
  const total = Math.min(1.5, f.isoRate + f.waterRate);
  if (total > 0) {
    const scale = total / (f.isoRate + f.waterRate);
    const iso = Math.min(f.isoRate * scale * dt, Math.max(0, s.pv - 1.5));
    const water = Math.min(f.waterRate * scale * dt, Math.max(0, s.pv - 1.5 - iso));
    const ecf = s.pv + s.isf;
    s.naE -= iso * (s.naE / ecf);
    s.clE -= iso * (s.clE / ecf);
    s.pv -= iso + water;
    s.urine += iso + water;
  }

  // Osmotic equilibrium with cells (instant on this time scale).
  const tbw = s.pv + s.isf + s.icf;
  const icfNew = s.icfOsm / ((2 * s.naE + s.icfOsm) / tbw);
  const dIcf = icfNew - s.icf;
  const ecf = s.pv + s.isf;
  s.pv -= dIcf * (s.pv / ecf);
  s.isf -= dIcf * (s.isf / ecf);
  s.icf = icfNew;
}

/**
 * The patient before treatment, exactly as the scenario describes them, made a steady state: interstitial
 * albumin is set where its escape equals its lymphatic return, and the capillary pressure is shifted by
 * whatever this patient needs for filtration to equal lymph flow (venous congestion, for example).
 */
function settled(p: Patient, plan: Plan): { s: State; c: Ctx } {
  const fluid = FLUIDS.find((f) => f.id === plan.fluid)!;
  const s = initial(p);
  const c: Ctx = { p, plan, fluid, defended: PV0 + RBC0, osmSet: 280, pcAdj: 0, filt0: LYMPH0, albK: ALB_ESCAPE0, isfSet: ISF0 };
  c.mapSet = circulation(s.pv + s.rbc, p, false).map;
  const lymph0 = flows(s, c, false).lymphFlow;
  // Albumin escape balances its lymphatic return at the start; a leaky barrier shows up as a faster turnover.
  c.albK = (lymph0 * (s.albI / s.isf)) / s.albP;
  let lo = -60;
  let hi = 60;
  for (let i = 0; i < 60; i++) {
    c.pcAdj = (lo + hi) / 2;
    c.filt0 = Math.max(0.05, lymph0);
    const f = flows(s, c, false);
    if (f.filtration > f.lymphFlow) hi = c.pcAdj;
    else lo = c.pcAdj;
  }
  c.filt0 = Math.max(0.05, flows(s, c, false).filtration);
  c.osmSet = (2 * s.naE + s.icfOsm) / (s.pv + s.isf + s.icf);
  if (p.retains) {
    c.defended = s.pv + s.rbc;
    c.isfSet = s.isf;
  }
  return { s, c };
}

/** Run the model. With `plan.volume = 0` it gives the course without the fluid, for comparison. */
export function simulate(p: Patient, plan: Plan): Snapshot[] {
  const { s, c } = settled(p, plan);
  const dt = 1 / 60; // one minute
  const steps = Math.round(plan.hours * 60);
  const out: Snapshot[] = [];
  for (let k = 0; k <= steps; k++) {
    const t = k * dt;
    const f = flows(s, c, true);
    if (k % 5 === 0) {
      const albP = s.albP / s.pv;
      const na = s.naE / (s.pv + s.isf);
      const cl = s.clE / (s.pv + s.isf);
      out.push({
        t,
        plasma: s.pv,
        isf: s.isf,
        icf: s.icf,
        urine: s.urine,
        infused: s.infused,
        na,
        cl,
        hco3: na - cl + 1 - (0.28 * albP + 1.8),
        albumin: albP,
        hb: (s.rbc / (s.rbc + s.pv)) * HB_PER_HCT,
        co: f.circ.co,
        map: f.circ.map,
        cvp: f.circ.cvp,
        pc: f.pc,
        filtration: f.filtration,
        lymphFlow: f.lymphFlow,
        urineRate: Math.min(1.5, f.isoRate + f.waterRate),
        oedema: Math.max(0, s.isf - ISF0),
      });
    }
    if (k === steps) break;
    step(s, c, f, dt, plan.volume > 0 && t < plan.minutes / 60);
  }
  return out;
}

export interface Fate {
  t: number;
  plasma: number;
  isf: number;
  icf: number;
  urine: number;
}

/** Where the infused fluid is, as litres attributable to it: the run with fluid minus the run without. */
export function fateOf(withFluid: Snapshot[], without: Snapshot[]): Fate[] {
  return withFluid.map((a, i) => {
    const b = without[Math.min(i, without.length - 1)];
    return { t: a.t, plasma: a.plasma - b.plasma, isf: a.isf - b.isf, icf: a.icf - b.icf, urine: a.urine - b.urine };
  });
}

/** Share of the infused volume still in plasma at a given hour. */
export function plasmaShareAt(fate: Fate[], infusedVolume: number, hour: number) {
  const f = fate.find((x) => x.t >= hour) ?? fate[fate.length - 1];
  return infusedVolume > 0 ? f.plasma / infusedVolume : 0;
}
