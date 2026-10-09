// Feature-based differential diagnosis engine: pick a presenting ECG pattern, see the
// candidate diagnoses and the features that discriminate between them.

export interface DdxCandidate {
  id: string; // diagnosis id (or preset id)
  preset: string;
  features: Record<string, string>; // feature → expected value
}

export interface DdxProblem {
  id: string;
  title: string;
  intro: string;
  features: { key: string; label: string }[];
  candidates: DdxCandidate[];
  pearls: string[];
  refs: string[];
}

export const DDX: DdxProblem[] = [
  {
    id: 'regular-narrow',
    title: 'Regular narrow-complex tachycardia',
    intro: 'A narrow QRS means the ventricles are activated via the His–Purkinje system; the task is to locate the driver above the ventricles and decide whether the AV node is part of the mechanism.',
    features: [
      { key: 'p', label: 'P waves / atrial activity' },
      { key: 'rp', label: 'RP relationship' },
      { key: 'onset', label: 'Onset / offset' },
      { key: 'rate', label: 'Typical rate' },
      { key: 'vagal', label: 'Vagal manoeuvre / adenosine' },
    ],
    candidates: [
      { id: 'sinusTach', preset: 'sinusTach', features: { p: 'Sinus P before each QRS', rp: 'Long RP (normal PR)', onset: 'Gradual', rate: '100–150 (varies with physiology)', vagal: 'Transient slowing / transient AV block; resumes' } },
      { id: 'avnrt', preset: 'avnrt', features: { p: 'Hidden or pseudo-r′ V1 / pseudo-S inferior', rp: 'Very short (< 70 ms) or none', onset: 'Abrupt (PAC with PR jump)', rate: '140–250', vagal: 'Often TERMINATES' } },
      { id: 'orthoAvrt', preset: 'orthoAvrt', features: { p: 'Retrograde P′ in ST segment', rp: 'Short RP but ≥ 70 ms', onset: 'Abrupt', rate: '150–250', vagal: 'Often TERMINATES' } },
      { id: 'flutter', preset: 'flutter21', features: { p: 'Sawtooth F waves ~300/min (one hidden in QRS/T)', rp: 'n/a (2:1)', onset: 'Abrupt', rate: '~150 fixed', vagal: 'Increases block → UNMASKS flutter waves; continues' } },
      { id: 'focalAT', preset: 'focalAT', features: { p: 'Non-sinus P′ with isoelectric baseline', rp: 'Long RP', onset: 'Abrupt or warm-up', rate: '100–250', vagal: 'AV block with continuing P′ (some foci terminate)' } },
      { id: 'accelJunctional', preset: 'junctionalTach', features: { p: 'Retrograde P or AV dissociation', rp: 'Variable', onset: 'Gradual (warm-up)', rate: '100–140', vagal: 'Usually no termination' } },
    ],
    pearls: ['Run a rhythm strip during vagal manoeuvres/adenosine: termination → AV-node-dependent (AVNRT/AVRT); unmasked atrial activity → flutter/AT; transient slowing → sinus.', 'A heart rate fixed at ~150/min is 2:1 flutter until proven otherwise.', 'Termination ending with a P wave (the last atrial impulse blocked in the AV node) favours AVNRT/AVRT — AT rarely stops at the same moment as AV block; termination ending with a QRS is less specific (focal AT, atypical AVNRT, or AVRT/AVNRT with retrograde block).'],
    refs: ['svt2015', 'acls2025'],
  },
  {
    id: 'irregular-narrow',
    title: 'Irregular narrow-complex tachycardia',
    intro: 'Irregularity comes either from the atrial source (chaotic or multifocal) or from variable filtering in the AV node.',
    features: [
      { key: 'p', label: 'Atrial activity' },
      { key: 'pattern', label: 'Irregularity' },
      { key: 'setting', label: 'Typical setting' },
    ],
    candidates: [
      { id: 'af', preset: 'afRvr', features: { p: 'No P waves, fibrillatory baseline', pattern: 'Irregularly irregular', setting: 'Common; any age, esp. elderly' } },
      { id: 'mat', preset: 'mat', features: { p: '≥ 3 distinct P morphologies, isoelectric baseline', pattern: 'Irregular, varying PR', setting: 'Acute lung disease, hypoxia' } },
      { id: 'flutter', preset: 'flutterVariable', features: { p: 'Identical F waves at fixed rate', pattern: 'Regularly irregular / patterned', setting: 'Structural heart disease, post-surgery' } },
      { id: 'pac', preset: 'pac', features: { p: 'Sinus P + early P′', pattern: 'Sinus with premature beats', setting: 'Common' } },
      { id: 'sinusArrhythmia', preset: 'sinusArrhythmia', features: { p: 'Identical sinus P', pattern: 'Phasic with respiration', setting: 'Young, healthy' } },
    ],
    pearls: ['Look in V1 and II for atrial activity at double gain if needed.', 'MAT is not AF — cardioversion and anticoagulation for "AF" do not apply.'],
    refs: ['af2023', 'svt2015'],
  },
  {
    id: 'regular-wide',
    title: 'Regular wide-complex tachycardia',
    intro: 'Wide means ventricular activation did not use the normal His–Purkinje sequence — either the rhythm starts in the ventricle, or a supraventricular impulse is conducted abnormally (BBB/aberrancy, pre-excitation, drug/metabolic slowing). "Wide = VT" is not an absolute rule, but VT is the most common cause, especially with structural heart disease, and the safe default.',
    features: [
      { key: 'history', label: 'Clinical clues' },
      { key: 'av', label: 'AV relationship' },
      { key: 'morph', label: 'QRS morphology' },
      { key: 'adenosine', label: 'Adenosine (only if regular & monomorphic)' },
    ],
    candidates: [
      { id: 'monoVT', preset: 'monoVT', features: { history: 'Prior MI / cardiomyopathy, age > 35', av: 'AV dissociation, capture/fusion beats', morph: 'Very wide (> 140–160 ms), concordance, northwest axis, initial R in aVR, atypical BBB shape', adenosine: 'No effect (except idiopathic RVOT VT)' } },
      { id: 'orthoAvrt', preset: 'pacAberrant', features: { history: 'Known SVT, young, pre-existing BBB', av: '1:1', morph: 'Typical RBBB/LBBB morphology, rapid initial deflection', adenosine: 'Terminates AVNRT/AVRT with aberrancy' } },
      { id: 'orthoAvrt', preset: 'antiAvrt', features: { history: 'Known WPW, young', av: '1:1 retrograde', morph: 'Fully pre-excited — can be identical to VT', adenosine: 'May terminate (AV node is the retrograde limb) — risk of pre-excited AF' } },
      { id: 'tca', preset: 'tca', features: { history: 'Overdose, anticholinergic toxidrome', av: 'Sinus P may be visible', morph: 'Wide QRS + terminal R in aVR', adenosine: 'Not indicated' } },
      { id: 'hyperK', preset: 'hyperK8', features: { history: 'Kidney failure, drugs', av: 'P flattened/absent', morph: 'Very wide, peaked T, sine wave', adenosine: 'Not indicated — give calcium' } },
      { id: 'paced', preset: 'dddTracking', features: { history: 'Device', av: 'P-tracking', morph: 'Pacing spikes', adenosine: 'Not indicated' } },
    ],
    pearls: ['When in doubt, treat as VT; synchronised cardioversion is appropriate for any unstable regular wide-complex tachycardia.', 'Adenosine may be considered only for REGULAR, MONOMORPHIC wide-complex tachycardia (2025 AHA).', 'Never give verapamil/diltiazem for undiagnosed wide-complex tachycardia.', 'Algorithms (Brugada 1991, aVR/Vereckei 2008) raise accuracy but none is perfect.'],
    refs: ['acls2025', 'va2017', 'brugadaWct1991', 'vereckei2008', 'wellens1978'],
  },
  {
    id: 'irregular-wide',
    title: 'Irregular wide-complex tachycardia',
    intro: 'Irregular + wide = AF with bundle-branch block/aberrancy, pre-excited AF, or polymorphic VT/torsades. The management of each is different — and AV-nodal blockers, used for rate control in AF with aberrancy, are dangerous in pre-excited AF.',
    features: [
      { key: 'morph', label: 'QRS morphology' },
      { key: 'rate', label: 'Rate' },
      { key: 'qt', label: 'Baseline QT' },
      { key: 'rx', label: 'Treatment direction' },
    ],
    candidates: [
      { id: 'af', preset: 'af', features: { morph: 'Constant typical BBB morphology', rate: 'Usually < 200', qt: 'Normal', rx: 'As AF (rate/rhythm control, anticoagulation)' } },
      { id: 'preexAf', preset: 'preexAf', features: { morph: 'Varying width/morphology (fusion), occasional narrow beats', rate: 'Often > 200, shortest RR < 250 ms', qt: 'n/a', rx: 'Cardioversion / procainamide or ibutilide — NO AV-nodal blockers' } },
      { id: 'torsades', preset: 'torsades', features: { morph: 'Twisting axis, sinusoidal amplitude', rate: '160–250', qt: 'LONG', rx: 'Magnesium, defibrillation, stop QT drugs, increase rate' } },
      { id: 'polyVT', preset: 'polyVT', features: { morph: 'Changing morphology', rate: '150–300', qt: 'Normal', rx: 'Defibrillation, treat ischaemia' } },
    ],
    pearls: ['Irregular wide-complex tachycardia: do NOT give adenosine (2025 AHA limits adenosine to regular monomorphic wide-complex tachycardia).', 'Unstable → unsynchronised defibrillation if polymorphic/pulseless; synchronised cardioversion for pre-excited AF with a pulse.'],
    refs: ['acls2025', 'af2023', 'svt2015', 'tdp2010'],
  },
  {
    id: 'bradycardia',
    title: 'Bradycardia',
    intro: 'Slow ventricular rates arise from a slow pacemaker (sinus node) or from failure to conduct (AV block) — with escape pacemakers filling in.',
    features: [
      { key: 'p', label: 'P waves' },
      { key: 'rel', label: 'P–QRS relationship' },
      { key: 'qrs', label: 'QRS' },
      { key: 'atropine', label: 'Atropine' },
    ],
    candidates: [
      { id: 'sinusBrady', preset: 'sinusBrady', features: { p: 'Sinus', rel: '1:1, normal PR', qrs: 'Narrow', atropine: 'Usually effective' } },
      { id: 'mobitz1', preset: 'mobitz1', features: { p: 'Sinus', rel: 'Progressive PR → drop', qrs: 'Narrow', atropine: 'Improves (nodal)' } },
      { id: 'mobitz2', preset: 'mobitz2', features: { p: 'Sinus', rel: 'Constant PR → sudden drop', qrs: 'Often wide', atropine: 'Ineffective / may worsen' } },
      { id: 'chb', preset: 'chbJunctional', features: { p: 'Sinus, faster than QRS', rel: 'None (dissociation)', qrs: 'Narrow (junctional) or wide (ventricular)', atropine: 'May help nodal block; not infranodal' } },
      { id: 'junctionalEscape', preset: 'junctionalEscape', features: { p: 'Absent/retrograde', rel: 'Retrograde', qrs: 'Narrow', atropine: 'May speed sinus' } },
      { id: 'hyperK', preset: 'hyperK8', features: { p: 'Flattened/absent', rel: 'Variable', qrs: 'Wide', atropine: 'Treat K⁺ (calcium)' } },
      { id: 'pacBlocked', preset: 'pacBlocked', features: { p: 'Premature P′ in T waves', rel: 'Non-conducted PACs', qrs: 'Narrow', atropine: 'Not indicated' } },
    ],
    pearls: ['Always look for P waves hidden in T waves.', 'Treat the patient, not the rate: athletes and sleeping patients can have slow rates.'],
    refs: ['brady2018', 'acls2025'],
  },
  {
    id: 'st-elevation-ddx',
    title: 'ST elevation',
    intro: 'ST elevation arises whenever a voltage gradient exists during the plateau. Distribution, shape, reciprocal changes and QRS context identify the cause.',
    features: [
      { key: 'dist', label: 'Distribution' },
      { key: 'shape', label: 'Shape' },
      { key: 'recip', label: 'Reciprocal change' },
      { key: 'other', label: 'Other clues' },
    ],
    candidates: [
      { id: 'stemi', preset: 'stemiInferior', features: { dist: 'Coronary territory', shape: 'Convex/straight, evolves', recip: 'Yes (opposite wall)', other: 'Q waves, symptoms, wall-motion abnormality' } },
      { id: 'pericarditis', preset: 'pericarditis', features: { dist: 'Diffuse', shape: 'Concave', recip: 'Only aVR ± V1', other: 'PR depression, pleuritic pain, rub' } },
      { id: 'earlyRepol', preset: 'earlyRepol', features: { dist: 'Inferolateral / precordial', shape: 'Concave with J notch/slur', recip: 'No', other: 'Young, stable over time' } },
      { id: 'brugada', preset: 'brugada1', features: { dist: 'V1–V2', shape: 'Coved with negative T', recip: 'No', other: 'Syncope/VF at rest, fever' } },
      { id: 'lbbb', preset: 'lbbb', features: { dist: 'V1–V3 (discordant)', shape: 'Proportional to S wave', recip: 'Discordant STD laterally', other: 'QRS ≥ 120; apply Sgarbossa/Smith' } },
      { id: 'lvh', preset: 'lvh', features: { dist: 'V1–V3', shape: 'Discordant to deep S', recip: 'Lateral strain', other: 'High voltage' } },
      { id: 'hyperK', preset: 'hyperK8', features: { dist: 'V1–V2 or diffuse', shape: 'Pseudo-infarct', recip: 'Variable', other: 'Peaked T, wide QRS, renal failure' } },
    ],
    pearls: ['Reciprocal ST depression strongly favours acute occlusion.', 'Serial ECGs: STEMI evolves in minutes–hours; early repolarisation does not.'],
    refs: ['udmi2018', 'acs2025', 'escMyoPeri2025', 'erp2015', 'escVa2022'],
  },
  {
    id: 'dominant-r-v1',
    title: 'Dominant R wave in V1',
    intro: 'V1 normally shows rS because LV forces point away from it. A dominant R means more forces point anteriorly/rightward, or posterior forces were lost.',
    features: [
      { key: 'qrs', label: 'QRS width' },
      { key: 'clue', label: 'Key clue' },
    ],
    candidates: [
      { id: 'rbbb', preset: 'rbbb', features: { qrs: '≥ 120 ms', clue: 'rSR′, wide S in I/V6' } },
      { id: 'rvh', preset: 'rvh', features: { qrs: 'Normal', clue: 'Right axis, RAE, RV strain' } },
      { id: 'stemiPosterior', preset: 'stemiPosterior', features: { qrs: 'Normal', clue: 'Horizontal STD V1–V3, upright T; STE V7–V9' } },
      { id: 'wpw', preset: 'orthoAvrt', features: { qrs: 'Wide with delta', clue: 'Short PR (left-sided pathway)' } },
      { id: 'Normal variant / lead misplacement', preset: 'nsr', features: { qrs: 'Normal', clue: 'Children, dextrocardia, misplaced leads' } },
    ],
    pearls: ['Posterior MI is the diagnosis you cannot afford to miss — record posterior leads.'],
    refs: ['ecgStd3', 'ecgStd5', 'udmi2018'],
  },
];
