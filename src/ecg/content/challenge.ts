// Challenge-mode question bank. Levels 1–2 are generated from the simulator; levels 3–5
// use curated, mechanism-based items tied to a preset so the ECG is always regenerated
// (with patient variability) rather than being a fixed picture.

export interface QItem {
  preset: string;
  q: string;
  correct: string;
  wrong: string[];
  explain: string;
  dx?: string;
}

export const LEVEL_INFO: Record<number, { title: string; text: string }> = {
  1: { title: 'Level 1 — ECG recognition', text: 'Identify the rhythm: sinus rhythms, AF, flutter, AV blocks, VT, VF and more.' },
  2: { title: 'Level 2 — ECG interpretation', text: 'Axis, intervals, morphology and conduction abnormalities from 12-lead ECGs.' },
  3: { title: 'Level 3 — Mechanistic interpretation', text: 'Why does this ECG look like this?' },
  4: { title: 'Level 4 — Electrophysiology', text: 'Which circuit or electrophysiological abnormality generates this rhythm?' },
  5: { title: 'Level 5 — Clinical management', text: 'What should be done — and why?' },
};

/** Level 1 pool: preset → accepted diagnosis label (options are drawn from other labels). */
export const L1: [string, string][] = [
  ['nsr', 'Normal sinus rhythm'],
  ['sinusBrady', 'Sinus bradycardia'],
  ['sinusTach', 'Sinus tachycardia'],
  ['af', 'Atrial fibrillation'],
  ['afRvr', 'Atrial fibrillation'],
  ['flutter21', 'Atrial flutter'],
  ['flutter41', 'Atrial flutter'],
  ['avb1', 'First-degree AV block'],
  ['mobitz1', 'Second-degree AV block, Mobitz I'],
  ['mobitz2', 'Second-degree AV block, Mobitz II'],
  ['chbJunctional', 'Complete heart block'],
  ['chbVentricular', 'Complete heart block'],
  ['monoVT', 'Ventricular tachycardia'],
  ['vf', 'Ventricular fibrillation'],
  ['avnrt', 'Supraventricular tachycardia (AVNRT)'],
  ['junctionalEscape', 'Junctional escape rhythm'],
  ['pvcBigeminy', 'Ventricular bigeminy'],
  ['mat', 'Multifocal atrial tachycardia'],
  ['torsades', 'Torsades de pointes'],
  ['vvi', 'Ventricular paced rhythm'],
];

/** Level 2 pool: preset + question kind. */
export const L2: { preset: string; kind: 'axis' | 'qrs' | 'conduction' | 'pr' | 'qt' | 'morph'; answer?: string }[] = [
  { preset: 'lafb', kind: 'axis' },
  { preset: 'lpfb', kind: 'axis' },
  { preset: 'nsr', kind: 'axis' },
  { preset: 'rvh', kind: 'axis' },
  { preset: 'rbbb', kind: 'conduction', answer: 'Right bundle branch block' },
  { preset: 'lbbb', kind: 'conduction', answer: 'Left bundle branch block' },
  { preset: 'lafb', kind: 'conduction', answer: 'Left anterior fascicular block' },
  { preset: 'bifascicular', kind: 'conduction', answer: 'RBBB + left anterior fascicular block' },
  { preset: 'wpw', kind: 'conduction', answer: 'Ventricular pre-excitation (WPW pattern)' },
  { preset: 'avb1', kind: 'pr' },
  { preset: 'wpw', kind: 'pr' },
  { preset: 'lqts', kind: 'qt' },
  { preset: 'hyperCa', kind: 'qt' },
  { preset: 'hypoCa', kind: 'qt' },
  { preset: 'lvh', kind: 'morph', answer: 'Left ventricular hypertrophy with strain' },
  { preset: 'stemiInferior', kind: 'morph', answer: 'Inferior ST-elevation MI' },
  { preset: 'pericarditis', kind: 'morph', answer: 'Acute pericarditis' },
  { preset: 'hyperK7', kind: 'morph', answer: 'Hyperkalaemia' },
  { preset: 'brugada1', kind: 'morph', answer: 'Brugada type 1 pattern' },
  { preset: 'ivcd', kind: 'qrs' },
  { preset: 'rbbb', kind: 'qrs' },
];

export const L2_CONDUCTION_OPTIONS = ['Right bundle branch block', 'Left bundle branch block', 'Left anterior fascicular block', 'Left posterior fascicular block', 'RBBB + left anterior fascicular block', 'Ventricular pre-excitation (WPW pattern)', 'No conduction abnormality'];
export const L2_MORPH_OPTIONS = ['Left ventricular hypertrophy with strain', 'Inferior ST-elevation MI', 'Acute pericarditis', 'Hyperkalaemia', 'Brugada type 1 pattern', 'Early repolarisation', 'Right ventricular hypertrophy', 'Hypokalaemia'];

export const L3: QItem[] = [
  { preset: 'lbbb', dx: 'lbbb', q: 'Why are the QRS complexes wide with broad notched R waves in I and V6?', correct: 'The LV is activated slowly, cell-to-cell from the septum toward the lateral wall, because the left bundle is blocked', wrong: ['The RV is activated late through the septum', 'An accessory pathway pre-excites the lateral LV', 'Hyperkalaemia has inactivated sodium channels throughout the ventricles'], explain: 'Without the left bundle the septum is activated right→left and the LV depends on slow myocardial conduction; the prolonged leftward-posterior vector writes broad R in leftward leads.' },
  { preset: 'rbbb', dx: 'rbbb', q: 'Why is there a terminal R′ in V1?', correct: 'Late, unopposed activation of the right ventricle produces a terminal rightward-anterior vector toward V1', wrong: ['Retrograde atrial activation superimposed on the QRS', 'Loss of posterior forces after posterior infarction', 'Early activation of the LV lateral wall via an accessory pathway'], explain: 'The RV is reached last via transseptal spread; nothing opposes that final rightward/anterior force.' },
  { preset: 'hyperK6', dx: 'hyperK', q: 'Why are the T waves tall, narrow and peaked?', correct: 'Higher extracellular K⁺ increases IKr conductance, making phase-3 repolarisation faster and more synchronous', wrong: ['Transmural injury current toward the anterior wall', 'Prolonged plateau from low calcium', 'Delayed repolarisation of the Purkinje system'], explain: 'Fast, synchronous repolarisation compresses the T wave in time and raises its peak.' },
  { preset: 'stemiInferior', dx: 'stemi', q: 'Why is there ST depression in aVL?', correct: 'It is the reciprocal view of an inferiorly directed injury vector', wrong: ['There is a second infarct in the high lateral wall', 'It is a secondary repolarisation change from bundle-branch block', 'Digoxin effect'], explain: 'aVL (−30°) is nearly opposite III (+120°), so an injury vector pointing inferiorly is recorded as ST depression in aVL.' },
  { preset: 'wpw', dx: 'wpw', q: 'Why is the PR short with a slurred QRS upstroke?', correct: 'An accessory pathway bypasses the AV-nodal delay and activates ventricular muscle early and slowly near its insertion', wrong: ['Enhanced AV-nodal conduction from catecholamines', 'A junctional rhythm with retrograde P waves', 'Right bundle branch block'], explain: 'Short PR = no nodal delay; delta wave = early slow muscle-to-muscle activation; fusion with normal activation completes the QRS.' },
  { preset: 'lafb', dx: 'lafb', q: 'Why is the axis about −50°?', correct: 'With the anterior fascicle blocked, the anterosuperior LV is activated last, so late dominant forces point superiorly and leftward', wrong: ['The RV hypertrophied', 'An inferior infarct removed inferior forces', 'The heart is vertically positioned'], explain: 'Initial activation via the posterior fascicle is inferior; the late, unopposed superior-leftward activation dominates the mean axis.' },
  { preset: 'chbJunctional', dx: 'chb', q: 'Why is the escape QRS narrow in this complete heart block?', correct: 'The escape pacemaker is in the AV junction, above the bifurcation, so it uses the His–Purkinje system', wrong: ['The escape is ventricular but from the septum', 'Some P waves are still conducting', 'The block is in the bundle branches'], explain: 'A block within the AV node leaves the junction below it free to escape at 40–60/min with normal ventricular activation.' },
  { preset: 'pericarditis', dx: 'pericarditis', q: 'Why is the PR segment depressed?', correct: 'Atrial epicardial inflammation creates an atrial injury current during the PR segment', wrong: ['First-degree AV block', 'A retrograde P wave hidden in the PR segment', 'Hypokalaemia'], explain: 'Inflammation of the atrial epicardium creates a current during atrial repolarisation → PR depression (elevation in aVR).' },
  { preset: 'lvh', dx: 'lvh', q: 'Why are the lateral ST segments depressed with inverted T waves?', correct: 'Thick myocardium repolarises abnormally (relative subendocardial ischaemia, altered transmural gradient), turning the repolarisation vector away from the LV', wrong: ['Posterior STEMI', 'Digoxin toxicity', 'Right bundle branch block'], explain: 'This is the "strain" pattern — secondary/primary repolarisation changes of hypertrophy, discordant to the tall R waves.' },
  { preset: 'stemiPosterior', dx: 'stemiPosterior', q: 'Why is there ST depression with tall R waves in V1–V3?', correct: 'The injury current points posteriorly — away from V1–V3 — so the anterior leads see a mirror image of posterior STE and Q waves', wrong: ['Anterior subendocardial ischaemia only', 'Right ventricular hypertrophy', 'Brugada pattern'], explain: 'Posterior leads (V7–V9) would show ST elevation; V1–V3 see it from the front.' },
  { preset: 'tca', dx: 'tca', q: 'Why is there a tall terminal R wave in aVR?', correct: 'Sodium-channel blockade slows conduction, delaying the last-activated rightward-superior regions', wrong: ['Left main occlusion', 'Right ventricular hypertrophy', 'Dextrocardia'], explain: 'Slowed phase 0 widens the QRS and disproportionately delays terminal rightward forces → R in aVR, S in I.' },
  { preset: 'hypoCa', dx: 'hypoCa', q: 'Why is the QT long with a normal-looking T wave?', correct: 'Low Ca²⁺ prolongs the action-potential plateau (phase 2), lengthening the ST segment', wrong: ['IKr block slowing phase 3', 'Hypothermia', 'Bundle-branch block'], explain: 'Calcium acts on phase 2 → long ST; K⁺ channel problems widen the T wave itself.' },
];

export const L4: QItem[] = [
  { preset: 'avnrt', dx: 'avnrt', q: 'Which circuit generates this tachycardia?', correct: 'Re-entry within the AV node: antegrade slow pathway, retrograde fast pathway', wrong: ['Atrium → AV node → ventricle → accessory pathway → atrium', 'Macro-re-entry around the tricuspid annulus', 'A single automatic focus in the low right atrium'], explain: 'Retrograde P hidden at the end of the QRS (atria and ventricles activated in parallel from the node) indicates typical slow–fast AVNRT.' },
  { preset: 'orthoAvrt', dx: 'orthoAvrt', q: 'Which circuit generates this tachycardia?', correct: 'Atrium → AV node → His–Purkinje → ventricle → accessory pathway → atrium', wrong: ['Atrium → accessory pathway → ventricle → AV node → atrium', 'Slow pathway down, fast pathway up', 'Scar-related ventricular re-entry'], explain: 'Narrow QRS + retrograde P separated from the QRS (RP ≥ 70 ms) + pre-excitation in sinus rhythm = orthodromic AVRT.' },
  { preset: 'antiAvrt', dx: 'orthoAvrt', q: 'What is the circuit of this wide-complex tachycardia?', correct: 'Antegrade over the accessory pathway, retrograde through the His bundle and AV node', wrong: ['Antegrade AV node, retrograde accessory pathway', 'Bundle-branch re-entry', 'Triggered activity from the RV outflow tract'], explain: 'Maximal pre-excitation from the pathway insertion makes the QRS wide: antidromic AVRT.' },
  { preset: 'flutter21', dx: 'flutter', q: 'What mechanism produces the atrial activity?', correct: 'Macro-re-entry around the tricuspid annulus using the cavotricuspid isthmus', wrong: ['Multiple wandering wavelets', 'Enhanced automaticity of a pulmonary-vein focus', 'Dual AV-nodal pathways'], explain: 'Continuous sawtooth waves at ~300/min, negative inferiorly = typical CTI-dependent flutter.' },
  { preset: 'af', dx: 'af', q: 'Why is the ventricular response irregularly irregular?', correct: 'Random atrial wavefronts reach the AV node; refractoriness and concealed conduction filter them unpredictably', wrong: ['Intermittent infranodal block', 'Alternating conduction via two accessory pathways', 'Sinus arrhythmia'], explain: 'Blocked impulses that partially penetrate the node reset its recovery (concealed conduction).' },
  { preset: 'mobitz1', dx: 'mobitz1', q: 'What causes the progressive PR prolongation?', correct: 'Decremental AV-nodal conduction: each impulse arrives earlier in the node’s recovery period', wrong: ['All-or-none failure of the His–Purkinje system', 'Sinoatrial exit block', 'Concealed junctional extrasystoles only'], explain: 'Shortening RP intervals move each beat up the nodal recovery curve until block occurs.' },
  { preset: 'mobitz2', dx: 'mobitz2', q: 'Where is the conduction failure most likely located?', correct: 'In the His–Purkinje system (infranodal)', wrong: ['In the AV node', 'In the sinoatrial junction', 'In an accessory pathway'], explain: 'Constant PR with sudden block and bundle-branch block indicate infranodal all-or-none conduction.' },
  { preset: 'monoVT', dx: 'monoVT', q: 'What is the most likely mechanism?', correct: 'Re-entry through a protected channel in myocardial scar', wrong: ['Early afterdepolarisations from a long QT', 'Delayed afterdepolarisations from digoxin', 'AV-nodal re-entry with aberrancy'], explain: 'Prior infarction + monomorphic wide-complex tachycardia with AV dissociation → scar-related re-entry.' },
  { preset: 'torsades', dx: 'torsades', q: 'What initiates this arrhythmia?', correct: 'Early afterdepolarisations (triggered activity) during a prolonged action potential, often after a pause', wrong: ['Delayed afterdepolarisations from Ca²⁺ overload', 'Scar-based macro-re-entry', 'Enhanced automaticity after reperfusion'], explain: 'Long QT + short–long–short sequence + twisting polymorphic VT = EAD-triggered torsades.' },
  { preset: 'rvotVT', dx: 'monoVT', q: 'What is the likely mechanism of this VT in a structurally normal heart (LBBB-like, inferior axis)?', correct: 'cAMP-mediated triggered activity (DADs) from the RV outflow tract', wrong: ['Scar re-entry after inferior MI', 'Bundle-branch re-entry', 'Early afterdepolarisations from hypokalaemia'], explain: 'Idiopathic RVOT VT is triggered activity; it is often adenosine-sensitive.' },
  { preset: 'accelJunctional', dx: 'accelJunctional', q: 'What is the mechanism?', correct: 'Enhanced automaticity of the AV junction exceeding the sinus rate', wrong: ['AV-nodal re-entry', 'Complete AV block', 'Retrograde conduction over a concealed pathway'], explain: 'A gradually accelerating narrow rhythm competing with sinus (isorhythmic dissociation) is automatic.' },
  { preset: 'preexAf', dx: 'preexAf', q: 'What limits the ventricular rate here?', correct: 'The refractory period of the accessory pathway', wrong: ['AV-nodal decremental conduction', 'The sinus-node rate', 'His–Purkinje refractoriness alone'], explain: 'The pathway conducts non-decrementally; only its refractory period limits conduction.' },
];

export const L5: QItem[] = [
  { preset: 'avnrt', dx: 'avnrt', q: 'Haemodynamically stable. Vagal manoeuvres failed. Next step?', correct: 'Adenosine 6 mg rapid IV push with flush (12 mg if needed)', wrong: ['IV amiodarone infusion', 'Immediate unsynchronised defibrillation', 'Atropine 1 mg'], explain: 'Adenosine transiently blocks the AV node, which is part of the circuit (2015 ACC/AHA/HRS; 2025 AHA).' },
  { preset: 'preexAf', dx: 'preexAf', q: 'Stable young patient. Which drug is appropriate?', correct: 'IV procainamide (or ibutilide), or elective cardioversion', wrong: ['IV diltiazem', 'IV adenosine', 'IV metoprolol'], explain: 'AV-nodal blockers (and IV amiodarone) can accelerate conduction over the pathway — potentially harmful.' },
  { preset: 'monoVT', dx: 'monoVT', q: 'BP 70/40, confused, pulse present. Next step?', correct: 'Synchronised cardioversion', wrong: ['IV verapamil', 'Adenosine then observe', 'Atropine'], explain: 'Unstable tachyarrhythmia with a pulse → synchronised cardioversion (2025 AHA).' },
  { preset: 'vf', dx: 'vf', q: 'Unresponsive, pulseless. First priority?', correct: 'High-quality CPR and immediate defibrillation', wrong: ['Amiodarone 300 mg first', 'Synchronised cardioversion', 'Transcutaneous pacing'], explain: 'Defibrillation extinguishes the fibrillatory wavelets; CPR maintains perfusion between shocks.' },
  { preset: 'torsades', dx: 'torsades', q: 'Recurrent self-terminating runs, patient awake. Best immediate drug?', correct: 'IV magnesium sulfate, stop QT-prolonging drugs, correct K⁺', wrong: ['IV procainamide', 'IV sotalol', 'IV amiodarone loading'], explain: 'Mg²⁺ suppresses EADs; class IA/III drugs prolong QT further.' },
  { preset: 'chbVentricular', dx: 'chb', q: 'HR 32, hypotensive, atropine 1 mg had no effect. Next step?', correct: 'Transcutaneous pacing and/or dopamine or epinephrine infusion; arrange transvenous pacing', wrong: ['Adenosine', 'Repeat atropine every minute to 6 mg', 'Synchronised cardioversion'], explain: 'Infranodal block does not respond to atropine; pacing bypasses it (2025 AHA bradycardia algorithm).' },
  { preset: 'hyperK8', dx: 'hyperK', q: 'K⁺ 8.4 mmol/L with this ECG. First drug?', correct: 'IV calcium (gluconate or chloride)', wrong: ['IV amiodarone', 'Oral potassium binder only', 'Adenosine'], explain: 'Calcium stabilises the membrane within minutes; then shift (insulin–glucose, β₂-agonist) and remove K⁺.' },
  { preset: 'afRvr', dx: 'af', q: 'Stable AF with RVR, LVEF normal, no pre-excitation. First-line acute rate control?', correct: 'IV/oral β-blocker or diltiazem', wrong: ['IV adenosine', 'Immediate DC cardioversion without anticoagulation for AF of unknown duration', 'Atropine'], explain: 'Rate control acts on the AV-nodal filter; cardioversion of AF of unknown duration requires anticoagulation or TEE unless unstable.' },
  { preset: 'stemiAnterior', dx: 'stemi', q: 'Chest pain 40 min, this ECG, PCI-capable centre. Management?', correct: 'Emergency primary PCI (with antiplatelet/anticoagulant therapy)', wrong: ['Serial troponins then decide', 'Fibrinolysis despite timely PCI availability', 'Exercise stress test'], explain: 'STEMI with timely PCI access → primary PCI (2025 ACC/AHA ACS).' },
  { preset: 'mat', dx: 'mat', q: 'COPD exacerbation with this rhythm. Most effective strategy?', correct: 'Treat the exacerbation/hypoxia and correct K⁺/Mg²⁺; rate control if needed', wrong: ['DC cardioversion', 'Start anticoagulation for AF', 'Catheter ablation now'], explain: 'MAT is triggered/automatic from multiple foci driven by the illness; cardioversion does not work.' },
  { preset: 'flutter21', dx: 'flutter', q: 'Recurrent symptomatic typical flutter. Definitive therapy?', correct: 'Cavotricuspid isthmus ablation', wrong: ['Pulmonary-vein isolation alone', 'Long-term adenosine', 'Permanent pacemaker'], explain: 'A line of block across the CTI interrupts the macro-re-entrant circuit (Class I, 2015 SVT guideline).' },
  { preset: 'mobitz2', dx: 'mobitz2', q: 'Asymptomatic Mobitz II with RBBB, no reversible cause. Long-term?', correct: 'Permanent pacemaker', wrong: ['Observation only', 'Atropine as needed', 'β-blocker'], explain: 'Acquired Mobitz II not due to reversible causes is a Class I pacing indication regardless of symptoms (2018 ACC/AHA/HRS).' },
];
