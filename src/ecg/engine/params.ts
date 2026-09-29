// The physiological state that drives every ECG in the app. Nothing in the app swaps
// pre-drawn pictures: rhythms come from the conduction simulator (rhythm.ts) and every
// waveform is synthesised from activation/repolarisation vectors (morphology.ts).

export type AtrialSite = 'sinus' | 'highRA' | 'lowRA' | 'leftAtrial' | 'lowLA' | 'crista' | 'retroSeptal' | 'retroLeftLateral' | 'retroRightFree' | 'retroPosteroseptal';
export type VentSite = 'rvApex' | 'rvot' | 'lvot' | 'lvApex' | 'lvLateral' | 'lvInferobasal' | 'septal' | 'fascicularPosterior' | 'fascicularAnterior';
export type ApLocation = 'leftLateral' | 'leftPosterior' | 'posteroseptal' | 'rightFreeWall' | 'anteroseptal' | 'midseptal';
export type Territory = 'anteroseptal' | 'anterior' | 'anterolateral' | 'highLateral' | 'lateral' | 'inferior' | 'posterior' | 'rv' | 'proxLAD' | 'wrapLAD' | 'proxRCA' | 'lcx' | 'diffuseSubendo';
export type IschemiaStage = 'none' | 'hyperacute' | 'stemi' | 'evolving' | 'old' | 'subendocardial' | 'wellens' | 'deWinter' | 'aneurysm' | 'takotsubo';
export type LeadReversal = 'none' | 'raLa' | 'raLl' | 'laLl';
export type ArtifactKind = 'none' | 'tremor' | 'motion';
export type Electrode = 'RA' | 'LA' | 'LL';
export type Bundle = 'normal' | 'rbbb' | 'incompleteRbbb' | 'lbbb' | 'lafb' | 'lpfb' | 'rbbb+lafb' | 'rbbb+lpfb' | 'ivcd';
export type AtrialMechanism = 'sinus' | 'focalAT' | 'mat' | 'flutter' | 'fibrillation' | 'none';
export type VentMechanism = 'none' | 'monoVT' | 'polyVT' | 'torsades' | 'vflutter' | 'vf' | 'aivr' | 'bidirectional' | 'asystole';
export type EctopyPattern = 'none' | 'single' | 'bigeminy' | 'trigeminy' | 'couplet' | 'random' | 'run';
export type PacerMode = 'none' | 'AAI' | 'VVI' | 'DDD' | 'VOO' | 'DOO';
export type PacerFault = 'none' | 'failCapture' | 'failSense' | 'oversense';
export type InterventionKind = 'adenosine' | 'vagal' | 'shock' | 'avnBlocker' | 'atropine';

export interface Intervention {
  /** ms from strip start */
  t: number;
  kind: InterventionKind;
}

export interface RhythmParams {
  seed: number;
  // --- Sinus node ---
  sinusRate: number; // bpm (intrinsic, before autonomic/drug modulation)
  sinusArrhythmia: number; // 0..1 respiratory modulation depth
  sinusEnabled: boolean; // false = sinus arrest (no sinus impulses)
  sinusPause: { at: number; duration: number } | null; // single sinus arrest/pause episode
  saExitBlockEvery: number; // 0 = none; N = every Nth sinus discharge fails to exit (2:1 SA exit block if 2)
  // --- Atrial mechanism ---
  atrialMechanism: AtrialMechanism;
  focalATRate: number;
  focalATSite: AtrialSite;
  matRate: number; // mean
  flutterCL: number; // ms (≈200 for typical flutter, atrial rate 300/min)
  flutterReverse: boolean; // clockwise (reverse typical) flutter
  afMeanCL: number; // mean interval (ms) between fibrillatory wavefronts reaching the AV node
  afCoarse: number; // 0..1 amplitude of f waves
  atrialERP: number; // ms
  // --- AV node ---
  avnConducts: boolean;
  avnAHmin: number; // ms minimum nodal conduction time
  avnERP: number; // ms recovery time (from previous nodal exit) below which the node blocks
  avnDecrement: number; // ms extra delay at the edge of refractoriness
  avnTau: number; // ms recovery time-constant
  concealed: boolean; // blocked impulses partially penetrate (concealed conduction)
  dualPathway: boolean;
  fastAH: number;
  fastERP: number;
  slowAH: number;
  slowERP: number;
  retroFastTime: number; // ms retrograde fast-pathway conduction
  // --- His–Purkinje ---
  hv: number; // ms
  infranodal: 'none' | 'mobitz2' | 'complete';
  infranodalRatio: number; // e.g. 3 → 3:2 (every 3rd P blocked); for high-grade use highGradeRatio
  highGrade: number; // 0 = off; N = only 1 of every N P waves conducts (N≥3 ⇒ high-grade AV block)
  nodalBlock: 'none' | 'complete'; // complete block located in the AV node
  rbERPbase: number; // right bundle refractoriness intercept (Ashman phenomenon)
  vaDelay: number; // ms from ventricular activation to retrograde His activation
  // --- Accessory pathway ---
  ap: {
    present: boolean;
    location: ApLocation;
    antegrade: boolean; // manifest (delta wave) if true; concealed if false
    retrograde: boolean;
    erp: number; // ms
    time: number; // ms conduction time through the pathway
  };
  // --- Escape / automatic foci ---
  junctionalRate: number;
  junctionalEnabled: boolean;
  junctionalAccelerated: boolean; // enhanced automaticity: the junction competes with sinus
  ventEscapeRate: number;
  ventEscapeEnabled: boolean;
  ventEscapeSite: VentSite;
  // --- Premature beats ---
  pac: { pattern: EctopyPattern; coupling: number; site: AtrialSite; every: number };
  pvc: { pattern: EctopyPattern; coupling: number; site: VentSite; retrograde: boolean; multifocal: boolean };
  /** One programmed premature atrial beat used to initiate re-entry (AVNRT / AVRT). */
  triggerPAC: { at: number; coupling: number; site: AtrialSite } | null;
  // --- Sustained ventricular mechanisms ---
  ventMechanism: VentMechanism;
  vtRate: number;
  vtSite: VentSite;
  vtAdenosineSensitive: boolean; // e.g. cAMP-mediated triggered-activity RVOT VT
  vtStart: number; // ms (0 = from start)
  vtDuration: number; // ms (0 = sustained)
  // --- Pacemaker ---
  pacer: { mode: PacerMode; lowerRate: number; avDelay: number; fault: PacerFault; bipolar: boolean };
  interventions: Intervention[];
}

export interface Drugs {
  betaBlocker: number; // 0..1
  ccb: number; // non-dihydropyridine, 0..1
  digoxin: number; // 0..1 therapeutic effect, >1 toxic
  naBlocker: number; // class I / TCA sodium-channel blockade 0..1
  qtDrug: number; // IKr blockade 0..1
  amiodarone: number; // 0..1
}

export interface Physio {
  // Patient / body
  age: number;
  sex: 'M' | 'F';
  habitus: number; // 0.5 (obesity, effusion, emphysema → low voltage) .. 1.4 (thin, young)
  anatomicalAxis: number; // deg rotation of the heart in the frontal plane (vertical heart +, horizontal heart −)
  horizontalRotation: number; // deg: + counter-clockwise (early transition), − clockwise (late transition)
  autonomic: number; // −1 (vagal) .. +1 (sympathetic)
  noise: number; // 0..1 muscle/baseline artefact
  // Atria
  raSize: number; // 1 = normal
  laSize: number;
  atrialCV: number; // conduction velocity multiplier
  interatrialDelay: number; // ms extra Bachmann bundle delay
  // Ventricles
  lvMass: number;
  rvMass: number;
  ventricularCV: number; // myocardial conduction velocity multiplier (1 = normal, <1 slower)
  axisShift: number; // deg additional rotation of ventricular forces
  bundle: Bundle;
  // Repolarisation
  qtcBase: number; // ms intrinsic QTc
  earlyRepol: number; // 0..1
  brugada: 0 | 1 | 2; // type 1 coved / type 2 saddleback
  // Metabolic
  K: number; // mmol/L
  Ca: number; // mmol/L total (2.1–2.6 normal)
  Mg: number; // mmol/L (0.7–1.0 normal)
  drugs: Drugs;
  // Structural / inflammatory
  ischemia: { territory: Territory; stage: IschemiaStage; extent: number };
  pericarditis: number; // 0 none, 1..4 stage
  myocarditis: number; // 0..1
  rvStrain: number; // 0..1 acute RV pressure load (PE)
  lowVoltage: number; // 0..1 (effusion / infiltration)
  alternans: number; // 0..1 beat-to-beat QRS amplitude alternation (swinging heart in large effusion)
  hypothermia: number; // 0..1 (Osborn waves)
  // Cardiomyopathies
  hcm: number; // 0..1 asymmetric septal hypertrophy (exaggerated septal forces → deep narrow Q waves)
  arvc: number; // 0..1 fibrofatty RV myocardium (epsilon wave, right-precordial T inversion, terminal delay)
  // Recording / anatomy (not physiology of the heart itself)
  dextrocardia: boolean; // mirror-image heart position
  leadReversal: LeadReversal; // limb-electrode cable swap
  artifact: { kind: ArtifactKind; electrode: Electrode; amp: number };
  rhythm: RhythmParams;
}

export function defaultRhythm(): RhythmParams {
  return {
    seed: 1,
    sinusRate: 72,
    sinusArrhythmia: 0.04,
    sinusEnabled: true,
    sinusPause: null,
    saExitBlockEvery: 0,
    atrialMechanism: 'sinus',
    focalATRate: 150,
    focalATSite: 'lowRA',
    matRate: 115,
    flutterCL: 200,
    flutterReverse: false,
    afMeanCL: 160,
    afCoarse: 0.5,
    atrialERP: 220,
    avnConducts: true,
    avnAHmin: 75,
    avnERP: 150,
    avnDecrement: 120,
    avnTau: 60,
    concealed: true,
    dualPathway: false,
    fastAH: 70,
    fastERP: 400,
    slowAH: 260,
    slowERP: 230,
    retroFastTime: 45,
    hv: 45,
    infranodal: 'none',
    infranodalRatio: 3,
    highGrade: 0,
    nodalBlock: 'none',
    rbERPbase: 120,
    vaDelay: 120,
    ap: { present: false, location: 'leftLateral', antegrade: true, retrograde: true, erp: 280, time: 45 },
    junctionalRate: 42,
    junctionalEnabled: true,
    junctionalAccelerated: false,
    ventEscapeRate: 32,
    ventEscapeEnabled: true,
    ventEscapeSite: 'lvInferobasal',
    pac: { pattern: 'none', coupling: 480, site: 'leftAtrial', every: 5 },
    pvc: { pattern: 'none', coupling: 440, site: 'rvot', retrograde: false, multifocal: false },
    triggerPAC: null,
    ventMechanism: 'none',
    vtRate: 170,
    vtSite: 'lvInferobasal',
    vtAdenosineSensitive: false,
    vtStart: 0,
    vtDuration: 0,
    pacer: { mode: 'none', lowerRate: 60, avDelay: 160, fault: 'none', bipolar: true },
    interventions: [],
  };
}

export function defaultPhysio(): Physio {
  return {
    age: 45,
    sex: 'M',
    habitus: 1,
    anatomicalAxis: 0,
    horizontalRotation: 0,
    autonomic: 0,
    noise: 0.15,
    raSize: 1,
    laSize: 1,
    atrialCV: 1,
    interatrialDelay: 0,
    lvMass: 1,
    rvMass: 1,
    ventricularCV: 1,
    axisShift: 0,
    bundle: 'normal',
    qtcBase: 410,
    earlyRepol: 0,
    brugada: 0,
    K: 4.2,
    Ca: 2.35,
    Mg: 0.85,
    drugs: { betaBlocker: 0, ccb: 0, digoxin: 0, naBlocker: 0, qtDrug: 0, amiodarone: 0 },
    ischemia: { territory: 'anterior', stage: 'none', extent: 0.7 },
    pericarditis: 0,
    myocarditis: 0,
    rvStrain: 0,
    lowVoltage: 0,
    alternans: 0,
    hypothermia: 0,
    hcm: 0,
    arvc: 0,
    dextrocardia: false,
    leadReversal: 'none',
    artifact: { kind: 'none', electrode: 'RA', amp: 0.6 },
    rhythm: defaultRhythm(),
  };
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K] };
export type PhysioPatch = DeepPartial<Physio>;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Deep-merge a partial patch into a physio object, returning a new object. */
export function applyPatch<T>(base: T, patch: DeepPartial<T> | undefined): T {
  if (!patch) return clone(base);
  const out = clone(base) as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (v === undefined) continue;
    const cur = out[k];
    out[k] = isPlainObject(v) && isPlainObject(cur) ? applyPatch(cur, v) : clone(v);
  }
  return out as T;
}

export function clone<T>(v: T): T {
  return v === null || typeof v !== 'object' ? v : (JSON.parse(JSON.stringify(v)) as T);
}

export function makePhysio(patch?: PhysioPatch): Physio {
  return applyPatch(defaultPhysio(), patch);
}

/** Effective sinus rate after autonomic tone, drugs, temperature and electrolytes. */
export function effectiveSinusRate(p: Physio): number {
  const r = p.rhythm.sinusRate;
  const auto = p.autonomic >= 0 ? 1 + 0.9 * p.autonomic : 1 + 0.45 * p.autonomic;
  const drug = 1 - 0.28 * p.drugs.betaBlocker - 0.15 * p.drugs.ccb - 0.12 * Math.min(1, p.drugs.digoxin) - 0.2 * p.drugs.amiodarone;
  const cold = 1 - 0.45 * p.hypothermia;
  const k = p.K > 7.5 ? 1 - Math.min(0.5, (p.K - 7.5) * 0.25) : 1;
  return Math.max(20, r * auto * drug * cold * k);
}
