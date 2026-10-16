// Quick-reference content: normal adult ECG values, normal variants, and the "STEMI equivalents"
// (occlusion-MI patterns) and STEMI mimics. Every row links to the diagnosis page or simulator
// preset where the finding is generated and explained.

export interface NormalRow {
  item: string;
  normal: string;
  abnormal: string;
  links: { label: string; href: string }[];
}

export const NORMAL_VALUES: NormalRow[] = [
  {
    item: 'Heart rate',
    normal: '60–100/min at rest (some authorities use 50–90/min).',
    abnormal: '< 60/min bradycardia; > 100/min tachycardia. Rate alone is not a diagnosis — find the pacemaker.',
    links: [
      { label: 'Sinus bradycardia', href: '#/dx/sinusBrady' },
      { label: 'Sinus tachycardia', href: '#/dx/sinusTach' },
    ],
  },
  {
    item: 'P wave',
    normal: 'Duration < 120 ms; amplitude < 2.5 mm in lead II; upright in I, II and aVF and inverted in aVR (sinus origin); often biphasic in V1.',
    abnormal: '≥ 120 ms or notched (left atrial abnormality / interatrial block); ≥ 2.5 mm in II (right atrial abnormality); inverted in the inferior leads (low atrial or junctional origin).',
    links: [
      { label: 'Atrial enlargement', href: '#/dx/atrialEnlargement' },
      { label: 'P-wave lab', href: '#/sandbox/p' },
    ],
  },
  {
    item: 'PR interval',
    normal: '120–200 ms, constant.',
    abnormal: '< 120 ms: pre-excitation, or low atrial / junctional rhythm. > 200 ms: first-degree AV block. Varying: Wenckebach, AV dissociation.',
    links: [
      { label: 'First-degree AV block', href: '#/dx/avb1' },
      { label: 'WPW', href: '#/dx/wpw' },
    ],
  },
  {
    item: 'QRS duration',
    normal: '≤ 110 ms in adults (usually 70–100 ms).',
    abnormal: '110–119 ms: incomplete bundle-branch block or nonspecific delay; ≥ 120 ms: complete bundle-branch block, ventricular origin, pacing, pre-excitation, hyperkalaemia or sodium-channel blockade.',
    links: [
      { label: 'Why is the QRS wide?', href: '#/why/wide-qrs' },
      { label: 'Bundle-branch lab', href: '#/conduction/bbb' },
    ],
  },
  {
    item: 'Frontal QRS axis',
    normal: '−30° to +90°.',
    abnormal: '−30° to −90°: left axis deviation (e.g. left anterior fascicular block, inferior infarction, ventricular pacing). +90° to +180°: right axis deviation (e.g. RV hypertrophy or strain, left posterior fascicular block, lateral infarction; can be normal in children and thin adults). −90° to ±180°: extreme axis.',
    links: [
      { label: 'Axis lab', href: '#/sandbox/axis' },
      { label: 'Lead explorer', href: '#/fundamentals/leads' },
    ],
  },
  {
    item: 'Q waves',
    normal: 'Small, narrow "septal" q waves in I, aVL and V5–V6 (left-to-right septal activation); Q waves in III and aVR can be normal.',
    abnormal: 'Pathological (UDMI 2018): any Q > 20 ms or a QS complex in V2–V3; or Q ≥ 30 ms and ≥ 1 mm deep (or QS) in two contiguous leads of another group (in the absence of conduction defects and LVH).',
    links: [{ label: 'Old myocardial infarction', href: '#/dx/oldMI' }],
  },
  {
    item: 'R-wave progression',
    normal: 'R grows from V1 to V5; the transition zone (R = S) lies at V3–V4.',
    abnormal: 'Poor R-wave progression (R ≤ 3 mm in V3): old anterior MI, LVH, LBBB, lead misplacement, COPD, or a normal variant. Early transition / dominant R in V1: RBBB, RVH, posterior MI, WPW, dextrocardia.',
    links: [
      { label: 'Poor R-wave progression', href: '#/dx/poorR' },
      { label: 'Dominant R in V1', href: '#/ddx' },
    ],
  },
  {
    item: 'QRS voltage',
    normal: 'At least one limb lead ≥ 5 mm and at least one precordial lead ≥ 10 mm.',
    abnormal: 'Low voltage: all limb leads < 5 mm or all precordial leads < 10 mm (effusion, obesity, emphysema, infiltration, hypothyroidism). High voltage: see LVH criteria (Sokolow–Lyon, Cornell).',
    links: [
      { label: 'Low voltage', href: '#/dx/lowVoltage' },
      { label: 'LVH', href: '#/dx/lvh' },
    ],
  },
  {
    item: 'ST segment',
    normal: 'Isoelectric with the TP/PR baseline; slight J-point elevation in V2–V3 is normal, more in young men.',
    abnormal: 'New J-point elevation (UDMI 2018) in two contiguous leads: ≥ 1 mm in all leads other than V2–V3; in V2–V3 ≥ 2 mm in men ≥ 40 y, ≥ 2.5 mm in men < 40 y, ≥ 1.5 mm in women. New horizontal or downsloping depression ≥ 0.5 mm in two contiguous leads.',
    links: [
      { label: 'STEMI', href: '#/dx/stemi' },
      { label: 'STEMI equivalents & mimics', href: '#/omi' },
    ],
  },
  {
    item: 'T wave',
    normal: 'Upright in I, II and V3–V6; inverted in aVR; variable in III, aVL, aVF and V1 (and in V2 in some young adults). Usually < 5 mm in the limb leads and < 10 mm in the precordial leads.',
    abnormal: 'Inversion where it is normally upright, peaking (hyperkalaemia, hyperacute ischaemia), flattening (hypokalaemia, ischaemia), biphasic V2–V3 (Wellens).',
    links: [
      { label: 'Why are the T waves inverted?', href: '#/why/t-inversion' },
      { label: 'ST/T/QT lab', href: '#/sandbox/st' },
    ],
  },
  {
    item: 'QT / QTc',
    normal: 'QTc < 450 ms in men and < 460 ms in women (AHA/ACCF/HRS 2009).',
    abnormal: 'Prolonged ≥ 450 ms (men) / ≥ 460 ms (women); ≥ 500 ms (or a rise ≥ 60 ms) marks a high risk of torsades. Short: ≤ 390 ms; short-QT syndrome usually ≤ 360 ms.',
    links: [
      { label: 'QTc calculator', href: '#/tools/qtc' },
      { label: 'Long QT syndrome', href: '#/dx/lqts' },
    ],
  },
  {
    item: 'U wave',
    normal: 'Small deflection after the T wave, in the same direction as the T wave, best seen in V2–V3, more visible at slow heart rates.',
    abnormal: 'Prominent: hypokalaemia, bradycardia, some drugs. Inverted U waves: ischaemia or LV hypertrophy.',
    links: [{ label: 'Hypokalaemia', href: '#/dx/hypoK' }],
  },
];

export interface Variant {
  name: string;
  text: string;
  href: string;
}

export const NORMAL_VARIANTS: Variant[] = [
  { name: 'Sinus arrhythmia', text: 'Heart rate rises with inspiration and falls with expiration (vagal modulation); P waves are identical. Most marked in the young.', href: '#/dx/sinusArrhythmia' },
  { name: 'Early repolarisation pattern', text: 'J-point elevation with a terminal QRS notch or slur, concave ST elevation and tall T waves, typically in young men and athletes; stable over time and without reciprocal change (apart from aVR).', href: '#/dx/earlyRepol' },
  { name: 'Persistent juvenile T-wave pattern', text: 'T inversion in V1–V3 is normal in children; it may persist into early adulthood. T inversion in V1 is normal at any age.', href: '#/dx/athlete' },
  { name: 'The athlete’s ECG', text: 'Training-related findings that need no further work-up: sinus bradycardia, sinus arrhythmia, first-degree AV block, Mobitz I in sleep, junctional or ectopic atrial rhythm, incomplete RBBB, isolated QRS voltage criteria for LVH, early repolarisation, and (in Black athletes) T inversion in V1–V4 preceded by J-point elevation with convex ST elevation.', href: '#/dx/athlete' },
  { name: 'rSr′ in V1 with a normal QRS duration', text: 'A small terminal r′ in V1 with QRS < 110 ms is common in healthy people (incomplete RBBB pattern or lead placement too high).', href: '#/dx/rbbb' },
  { name: 'Isolated Q or T inversion in lead III', text: 'Q waves and T inversion confined to lead III often change with respiration and position; significant only when also present in II and aVF.', href: '#/dx/oldMI' },
];

export interface OmiRow {
  name: string;
  criteria: string;
  why: string;
  dx?: string;
  preset?: string;
  tool?: string;
}

export const STEMI_EQUIVALENTS: OmiRow[] = [
  { name: 'Posterior MI', criteria: 'Horizontal ST depression in V1–V3 (often maximal in V2–V3) with upright T waves; later a tall, broad R in V1–V2. Confirm with posterior leads: ST elevation ≥ 0.5 mm in V7–V9 (≥ 1 mm in men < 40 y).', why: 'V1–V3 view the posterior wall in mirror image; the injury current points posteriorly, away from them.', dx: 'stemiPosterior', preset: 'stemiPosterior' },
  { name: 'LBBB or ventricular pacing with Sgarbossa / Smith criteria', criteria: 'Concordant ST elevation ≥ 1 mm, concordant ST depression ≥ 1 mm in V1–V3, or discordant ST elevation ≥ 25% of the preceding S-wave depth (Smith).', why: 'The secondary repolarisation changes of LBBB and pacing are normally discordant and proportional to the QRS; disproportion or concordance indicates superimposed injury.', dx: 'lbbb', tool: '#/tools/sgarbossa' },
  { name: 'Widespread ST depression with ST elevation in aVR (± V1)', criteria: 'ST depression ≥ 1 mm in many leads (classically ≥ 8) with ST elevation in aVR and/or V1.', why: 'Diffuse subendocardial ischaemia: left-main or multivessel disease, or severe supply–demand mismatch. Not a single occluded territory.', dx: 'nste', preset: 'subendo' },
  { name: 'de Winter T waves', criteria: 'Upsloping ST depression at the J point in V1–V6 with tall, symmetrical T waves; often slight ST elevation in aVR.', why: 'Proximal LAD occlusion without precordial ST elevation.', dx: 'deWinter', preset: 'deWinter' },
  { name: 'Hyperacute T waves', criteria: 'Broad, tall, symmetrical T waves disproportionate to the QRS in one coronary territory, often with subtle reciprocal change.', why: 'The earliest stage of occlusion, before ST elevation develops; repeat the ECG every few minutes.', dx: 'stemi', preset: 'hyperacute' },
  { name: 'Right-ventricular infarction', criteria: 'With inferior STEMI: ST elevation in V1 and in right-sided leads (V3R–V4R ≥ 0.5 mm; ≥ 1 mm in men < 30 y), ST elevation III > II.', why: 'Proximal RCA occlusion; preload-dependent hypotension — avoid nitrates, give fluids.', dx: 'stemi', preset: 'stemiInferior' },
  { name: 'High lateral MI ("South African flag")', criteria: 'ST elevation in I, aVL and V2 — sometimes < 1 mm — with reciprocal ST depression in III.', why: 'First diagonal or obtuse marginal occlusion; small leads, easily missed.', dx: 'stemi', preset: 'stemiLateral' },
  { name: 'Aslanger pattern', criteria: 'ST elevation in III only, ST depression in V4–V6 (not V2) with positive terminal T waves, ST in V1 higher than V2.', why: 'Inferior occlusion with concomitant disease elsewhere masking the usual pattern.', dx: 'stemi' },
  { name: 'Wellens pattern (pre-infarction)', criteria: 'Biphasic (type A) or deeply inverted (type B) T waves in V2–V3 in a now pain-free patient, with little or no ST elevation and preserved R waves.', why: 'Not an acute occlusion: a reperfused, critically narrowed proximal LAD at high risk of re-occlusion. Needs urgent angiography; avoid stress testing.', dx: 'wellens', preset: 'wellens' },
];

export const STEMI_MIMICS: OmiRow[] = [
  { name: 'Early repolarisation', criteria: 'Concave ST elevation mainly V2–V5 with a J notch or slur, tall T waves, no reciprocal depression (apart from aVR), unchanged on serial ECGs.', why: 'Earlier repolarisation of the epicardium (Ito) — a normal variant in most people.', dx: 'earlyRepol', preset: 'earlyRepol' },
  { name: 'Acute pericarditis', criteria: 'Diffuse concave ST elevation not confined to a territory, PR depression (PR elevation in aVR), Spodick sign; reciprocal depression only in aVR (± V1); no Q waves.', why: 'Inflammation of the epicardium all around the heart: the injury vector has no single direction except away from the cavity.', dx: 'pericarditis', preset: 'pericarditis' },
  { name: 'Left ventricular hypertrophy', criteria: 'ST elevation in V1–V3 discordant to deep S waves, with lateral "strain" (ST depression and T inversion) and high voltage.', why: 'Secondary repolarisation change from a thick wall: proportional to the QRS.', dx: 'lvh', preset: 'lvh' },
  { name: 'LBBB and ventricular pacing', criteria: 'Discordant ST elevation in V1–V3 proportional to the S wave.', why: 'Abnormal activation sequence → abnormal repolarisation sequence. Use Sgarbossa / Smith criteria.', dx: 'lbbb', tool: '#/tools/sgarbossa' },
  { name: 'Brugada pattern', criteria: 'Coved ST elevation ≥ 2 mm with T inversion confined to V1–V2.', why: 'Loss of the epicardial action-potential dome in the RV outflow tract.', dx: 'brugada', preset: 'brugada1' },
  { name: 'Hyperkalaemia', criteria: 'Peaked T waves, widening QRS; can produce ST elevation in V1–V2 (Brugada-like) that resolves with treatment.', why: 'Depolarised resting membrane slows conduction and alters repolarisation.', dx: 'hyperK', preset: 'hyperK8' },
  { name: 'LV aneurysm', criteria: 'Persistent ST elevation with QS waves weeks after an infarction; T waves small relative to the QRS.', why: 'A dyskinetic, thin scar — not acute injury.', dx: 'lvAneurysm', preset: 'lvAneurysm' },
  { name: 'Takotsubo syndrome', criteria: 'Anterior or widespread ST elevation in the acute phase, often without reciprocal change; then deep T inversion and QT prolongation.', why: 'Catecholamine-mediated stunning of the apex and mid-ventricle; the ECG cannot exclude ACS — coronary angiography is needed.', dx: 'takotsubo', preset: 'takotsubo' },
  { name: 'Acute pulmonary embolism', criteria: 'Sinus tachycardia, T inversion V1–V4 and III, RBBB, S1Q3T3; occasionally ST elevation in V1 or aVR.', why: 'Acute RV pressure overload and RV ischaemia.', dx: 'pe', preset: 'pe' },
  { name: 'Hypothermia', criteria: 'Osborn (J) waves, bradycardia, long intervals, shivering artefact.', why: 'Exaggerated epicardial phase-1 notch.', dx: 'hypothermia', preset: 'hypothermia' },
];
