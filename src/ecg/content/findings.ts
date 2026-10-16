// "WHY DOES IT LOOK LIKE THIS?" — causal chains for ECG FINDINGS (as opposed to diagnoses).
// Each finding contrasts the normal mechanism with the abnormal one and lists the
// diagnoses (ids) that produce it. Every chain can be explored in a linked lab/preset.

import type { WhyStep } from './types';

export interface Finding {
  id: string;
  name: string;
  aliases: string[];
  normal: WhyStep[];
  abnormal: WhyStep[];
  causes: { id: string; note: string }[];
  demo: { a: string; b: string; label: string }; // preset ids for a normal-vs-abnormal comparison
  lab?: string; // route to an interactive lab
}

export const FINDINGS: Finding[] = [
  {
    id: 'wide-qrs',
    name: 'Wide QRS',
    aliases: ['broad QRS', 'QRS prolongation', 'wide complex'],
    normal: [
      { level: 'conduction', text: 'His bundle → bundle branches → Purkinje network (2–4 m/s) reach the endocardium of both ventricles almost simultaneously.' },
      { level: 'vector', text: 'Many regions depolarise at once and forces largely cancel; activation finishes in ~80–100 ms.' },
      { level: 'waveform', text: 'Narrow QRS.' },
    ],
    abnormal: [
      { level: 'conduction', text: 'Activation that does not use the Purkinje network (ventricular origin, pacing, accessory pathway, bundle-branch block) spreads cell-to-cell at ~0.3–1 m/s.' },
      { level: 'cell', text: 'Or Purkinje/myocardial conduction itself slows: fewer available Na⁺ channels (hyperkalaemia, Na⁺-channel blockers), scar, hypothermia.' },
      { level: 'vector', text: 'Regions are activated sequentially instead of simultaneously → the dipole persists longer and points in unusual directions.' },
      { level: 'waveform', text: 'Prolonged depolarisation → QRS ≥ 120 ms, with repolarisation following the abnormal sequence (discordant ST–T).' },
    ],
    causes: [
      { id: 'monoVT', note: 'ventricular origin — re-entry exits a scar' },
      { id: 'rbbb', note: 'late RV activation' },
      { id: 'lbbb', note: 'slow LV activation from the septum' },
      { id: 'hyperK', note: 'Na⁺-channel inactivation' },
      { id: 'tca', note: 'Na⁺-channel blockade' },
      { id: 'paced', note: 'RV pacing bypasses the His–Purkinje system' },
      { id: 'wpw', note: 'pre-excitation (fusion)' },
      { id: 'orthoAvrt', note: 'antidromic AVRT: fully pre-excited' },
      { id: 'pvc', note: 'ectopic ventricular beat' },
      { id: 'ventEscape', note: 'ventricular escape' },
      { id: 'ivcd', note: 'diffuse conduction delay' },
    ],
    demo: { a: 'nsr', b: 'lbbb', label: 'Normal vs LBBB' },
    lab: '#/sandbox/qrs',
  },
  {
    id: 'narrow-qrs',
    name: 'Narrow QRS',
    aliases: ['normal QRS width', 'supraventricular'],
    normal: [{ level: 'conduction', text: 'Narrow QRS means the ventricles were activated through the His–Purkinje system — the impulse came from above the bifurcation of the His bundle (sinus, atrial, junctional, AVNRT, orthodromic AVRT).' }],
    abnormal: [
      { level: 'diagnosis', text: 'So a narrow-complex tachycardia is (almost always) supraventricular; the question becomes WHERE above the ventricles: sinus node, atrial tissue, AV node, or AV node + accessory pathway.' },
      { level: 'clinical', text: 'Exception: fascicular VT and high-septal VT can be relatively narrow (~120–140 ms).' },
    ],
    causes: [
      { id: 'sinusTach', note: 'sinus node' },
      { id: 'avnrt', note: 'AV-nodal circuit' },
      { id: 'orthoAvrt', note: 'AV node + pathway circuit' },
      { id: 'flutter', note: 'atrial macro-re-entry' },
      { id: 'focalAT', note: 'atrial focus' },
      { id: 'junctionalEscape', note: 'junctional pacemaker' },
    ],
    demo: { a: 'junctionalEscape', b: 'ventEscape', label: 'Junctional (narrow) vs ventricular (wide) escape' },
    lab: '#/sandbox/hierarchy',
  },
  {
    id: 'st-elevation',
    name: 'ST elevation',
    aliases: ['STE', 'injury current', 'J point elevation'],
    normal: [
      { level: 'cell', text: 'During the plateau (phase 2) all ventricular cells sit at roughly the same voltage.' },
      { level: 'vector', text: 'No voltage difference → no current → no vector.' },
      { level: 'waveform', text: 'Isoelectric ST segment.' },
    ],
    abnormal: [
      { level: 'cell', text: 'Injured cells (ischaemia, inflammation) have a less negative resting potential and a lower plateau; or epicardial cells lose their plateau (Brugada) or repolarise early (early repolarisation).' },
      { level: 'vector', text: 'A voltage difference between injured and healthy tissue during the ST segment creates an "injury current"; with epicardial/transmural injury the ST vector points toward the injured surface.' },
      { level: 'lead', text: 'Leads facing it record ST elevation; opposite leads record reciprocal ST depression.' },
      { level: 'diagnosis', text: 'Pattern distinguishes causes: territorial + reciprocal (STEMI); diffuse + PR depression (pericarditis); V1–V2 coved (Brugada); discordant to a wide or high-voltage QRS (LBBB, paced, LVH); J notch (early repolarisation).' },
    ],
    causes: [
      { id: 'stemi', note: 'transmural ischaemia — territorial with reciprocal STD' },
      { id: 'pericarditis', note: 'diffuse epicardial inflammation' },
      { id: 'earlyRepol', note: 'epicardial Ito notch' },
      { id: 'brugada', note: 'RVOT epicardial dome loss (local)' },
      { id: 'lbbb', note: 'secondary (discordant) change' },
      { id: 'lvh', note: 'discordant STE in V1–V3' },
      { id: 'nste', note: 'STE in aVR with diffuse STD' },
      { id: 'hyperK', note: 'pseudo-infarction pattern' },
    ],
    demo: { a: 'stemiAnterior', b: 'pericarditis', label: 'STEMI vs pericarditis' },
    lab: '#/ischemia',
  },
  {
    id: 'st-depression',
    name: 'ST depression',
    aliases: ['STD', 'subendocardial ischaemia', 'strain'],
    normal: [{ level: 'waveform', text: 'Isoelectric ST (no current during phase 2).' }],
    abnormal: [
      { level: 'cell', text: 'Subendocardial injury (supply–demand ischaemia) → injury current toward the cavity; or the reciprocal of STE elsewhere; or secondary to abnormal activation (LVH strain, BBB); or drugs/electrolytes (digoxin, hypokalaemia).' },
      { level: 'vector', text: 'ST vector points away from the recording lead (toward the cavity / aVR, or toward the opposite wall).' },
      { level: 'waveform', text: 'ST depression; its distribution rarely localises the culprit artery (except posterior MI in V1–V3).' },
    ],
    causes: [
      { id: 'nste', note: 'subendocardial ischaemia' },
      { id: 'stemiPosterior', note: 'posterior STEMI (V1–V3)' },
      { id: 'stemi', note: 'reciprocal change' },
      { id: 'lvh', note: 'strain' },
      { id: 'digoxinEffect', note: 'scooped ST' },
      { id: 'hypoK', note: 'with U waves' },
      { id: 'rbbb', note: 'secondary in V1–V3' },
    ],
    demo: { a: 'nsr', b: 'subendo', label: 'Normal vs diffuse subendocardial ischaemia' },
    lab: '#/ischemia',
  },
  {
    id: 't-inversion',
    name: 'T-wave inversion',
    aliases: ['TWI', 'negative T', 'T wave'],
    normal: [
      { level: 'cell', text: 'Epicardial action potentials are SHORTER than endocardial ones, so although the endocardium depolarises first, the epicardium repolarises first.' },
      { level: 'vector', text: 'Repolarisation proceeds epicardium → endocardium; a repolarisation wave moving AWAY from a lead gives a POSITIVE deflection.' },
      { level: 'waveform', text: 'T wave concordant with the QRS (upright where the QRS is upright). Normal exceptions: aVR, often V1, III.' },
    ],
    abnormal: [
      { level: 'cell', text: 'Primary change: repolarisation itself is altered (ischaemia/reperfusion, myocarditis, cardiomyopathy, drugs, CNS events, long QT).' },
      { level: 'cell', text: 'Secondary change: repolarisation follows an abnormal activation sequence (BBB, pacing, pre-excitation, ventricular beats, hypertrophy) → T opposite the QRS.' },
      { level: 'waveform', text: 'Inverted T waves in the affected leads.' },
    ],
    causes: [
      { id: 'wellens', note: 'reperfused LAD' },
      { id: 'stemi', note: 'evolving MI' },
      { id: 'pe', note: 'RV strain V1–V4, III' },
      { id: 'lvh', note: 'strain' },
      { id: 'rbbb', note: 'secondary in V1–V3' },
      { id: 'lbbb', note: 'secondary lateral' },
      { id: 'pericarditis', note: 'stage 3' },
      { id: 'brugada', note: 'type 1 in V1–V2' },
    ],
    demo: { a: 'nsr', b: 'wellens', label: 'Normal vs Wellens' },
    lab: '#/sandbox/st',
  },
  {
    id: 'peaked-t',
    name: 'Tall peaked T waves',
    aliases: ['tented T', 'hyperacute T'],
    normal: [{ level: 'waveform', text: 'T wave rises slowly and falls faster (asymmetric) — repolarisation is spread over ~150–200 ms.' }],
    abnormal: [
      { level: 'cell', text: 'Hyperkalaemia increases IKr → rapid, synchronous repolarisation → tall, NARROW, symmetric T.' },
      { level: 'cell', text: 'Hyperacute ischaemia: early injury alters repolarisation of the territory → tall BROAD T waves limited to a territory.' },
      { level: 'waveform', text: 'Shape (narrow vs broad) and distribution (diffuse vs territorial) separate them.' },
    ],
    causes: [
      { id: 'hyperK', note: 'narrow-based, diffuse' },
      { id: 'stemi', note: 'hyperacute T — broad, territorial' },
      { id: 'earlyRepol', note: 'benign tall T in the young' },
      { id: 'sqts', note: 'short QT' },
    ],
    demo: { a: 'hyperK6', b: 'hyperacute', label: 'Hyperkalaemia vs hyperacute T' },
    lab: '#/electrolytes',
  },
  {
    id: 'q-waves',
    name: 'Pathological Q waves',
    aliases: ['Q wave', 'infarct Q'],
    normal: [{ level: 'vector', text: 'Small septal q waves (< 30 ms) in I, aVL, V5–V6: the septum is activated left→right first, moving away from left-sided leads.' }],
    abnormal: [
      { level: 'cell', text: 'Necrotic (scarred) myocardium generates no depolarising forces.' },
      { level: 'vector', text: 'The initial vector is dominated by the opposite wall → points AWAY from the scar.' },
      { level: 'waveform', text: 'Broad/deep initial negative deflection in leads facing the scar.' },
    ],
    causes: [
      { id: 'oldMI', note: 'prior infarction' },
      { id: 'stemi', note: 'evolving MI' },
      { id: 'lbbb', note: 'QS in V1–V3' },
      { id: 'wpw', note: 'negative delta mimics Q' },
    ],
    demo: { a: 'nsr', b: 'oldInferior', label: 'Normal vs old inferior MI' },
  },
  {
    id: 'long-qt',
    name: 'Long QT',
    aliases: ['QT prolongation', 'QTc'],
    normal: [{ level: 'cell', text: 'QT ≈ ventricular action-potential duration (phase 0 → end of phase 3); shortens as heart rate rises.' }],
    abnormal: [
      { level: 'cell', text: 'Less outward K⁺ current (IKr block, LQT1/2, hypokalaemia) or more inward current (late Na⁺, LQT3) → longer plateau and phase 3 → wider, later T.' },
      { level: 'cell', text: 'Low Ca²⁺ lengthens phase 2 → longer ST with a normal T.' },
      { level: 'clinical', text: 'Prolonged, heterogeneous repolarisation → EADs → torsades de pointes.' },
    ],
    causes: [
      { id: 'qtDrug', note: 'IKr blockers' },
      { id: 'lqts', note: 'congenital' },
      { id: 'hypoK', note: 'low K⁺ (QU)' },
      { id: 'hypoCa', note: 'long ST' },
      { id: 'magnesium', note: 'low Mg²⁺' },
      { id: 'hypothermia', note: 'slowed kinetics' },
    ],
    demo: { a: 'nsr', b: 'qtDrug', label: 'Normal vs drug-induced long QT' },
    lab: '#/sandbox/st',
  },
  {
    id: 'short-pr',
    name: 'Short PR',
    aliases: ['short PR interval', 'pre-excitation'],
    normal: [{ level: 'conduction', text: 'PR (120–200 ms) = atrial conduction + AV-nodal delay (the largest part) + His–Purkinje conduction.' }],
    abnormal: [
      { level: 'conduction', text: 'An accessory pathway bypasses the nodal delay (WPW) → short PR + delta wave.' },
      { level: 'conduction', text: 'Low atrial/junctional origin shortens the path to the node (ectopic P close to the QRS, often inverted inferiorly).' },
      { level: 'conduction', text: 'Enhanced AV-nodal conduction (sympathetic tone, young age) → short PR without delta.' },
    ],
    causes: [
      { id: 'wpw', note: 'pre-excitation' },
      { id: 'junctionalEscape', note: 'junctional rhythm with retrograde P' },
      { id: 'sinusTach', note: 'catecholamine-accelerated AV node' },
    ],
    demo: { a: 'nsr', b: 'wpw', label: 'Normal vs WPW' },
    lab: '#/sandbox/qrs',
  },
  {
    id: 'long-pr',
    name: 'Long PR',
    aliases: ['first degree AV block', 'PR prolongation'],
    normal: [{ level: 'conduction', text: 'AV-nodal delay allows atrial contraction to complete ventricular filling.' }],
    abnormal: [{ level: 'cell', text: 'Slower Ca²⁺-dependent nodal conduction (vagal tone, AV-nodal drugs, ischaemia, degeneration) or His–Purkinje disease.' }, { level: 'waveform', text: 'PR > 200 ms; progressive lengthening indicates decremental nodal conduction (Wenckebach).' }],
    causes: [
      { id: 'avb1', note: 'fixed prolongation' },
      { id: 'mobitz1', note: 'progressive prolongation' },
      { id: 'avnBlockers', note: 'drug effect' },
      { id: 'hyperK', note: 'K⁺ > ~7' },
    ],
    demo: { a: 'nsr', b: 'avb1', label: 'Normal vs 1° AV block' },
    lab: '#/conduction/av',
  },
  {
    id: 'absent-p',
    name: 'Absent P waves',
    aliases: ['no P waves', 'fibrillatory waves', 'hidden P'],
    normal: [{ level: 'vector', text: 'A coordinated atrial wavefront from the sinus node produces a single atrial vector → P wave.' }],
    abnormal: [
      { level: 'conduction', text: 'No coordinated atrial activation (AF), atria activated simultaneously with the QRS (AVNRT, junctional), no atrial activity (sinus arrest), or atrial myocytes inexcitable (severe hyperkalaemia — sinoventricular rhythm).' },
    ],
    causes: [
      { id: 'af', note: 'chaotic wavelets' },
      { id: 'avnrt', note: 'P hidden in QRS' },
      { id: 'junctionalEscape', note: 'retrograde P hidden' },
      { id: 'hyperK', note: 'atrial paralysis' },
      { id: 'sinusPause', note: 'no sinus discharge' },
    ],
    demo: { a: 'nsr', b: 'af', label: 'Sinus vs AF' },
  },
  {
    id: 'sawtooth',
    name: 'Sawtooth flutter waves',
    aliases: ['F waves', 'flutter waves'],
    normal: [{ level: 'waveform', text: 'Discrete P waves separated by an isoelectric baseline — atrial activation lasts ~100 ms of each cycle.' }],
    abnormal: [
      { level: 'conduction', text: 'A macro-re-entrant circuit keeps some part of the atria activated at every instant.' },
      { level: 'vector', text: 'The atrial vector rotates continuously; in CCW flutter it points superiorly most of the cycle.' },
      { level: 'waveform', text: 'Continuous sawtooth, negative in II, III, aVF.' },
    ],
    causes: [{ id: 'flutter', note: 'typical CTI-dependent flutter' }],
    demo: { a: 'focalAT', b: 'flutter41', label: 'Focal AT vs flutter 4:1' },
  },
  {
    id: 'av-dissociation',
    name: 'AV dissociation',
    aliases: ['P waves marching through', 'independent atrial and ventricular rhythms'],
    normal: [{ level: 'conduction', text: 'Each atrial impulse drives one ventricular beat.' }],
    abnormal: [
      { level: 'conduction', text: 'Atria and ventricles are driven by different pacemakers: either because conduction is blocked (complete heart block: atrial rate > ventricular) or because a lower pacemaker is faster (VT, accelerated junctional rhythm: ventricular rate ≥ atrial).' },
      { level: 'diagnosis', text: 'AV dissociation is a finding, not a diagnosis — compare the atrial and ventricular rates.' },
    ],
    causes: [
      { id: 'chb', note: 'block (atrial rate faster)' },
      { id: 'monoVT', note: 'ventricular rate faster' },
      { id: 'accelJunctional', note: 'isorhythmic dissociation' },
      { id: 'paced', note: 'VVI pacing' },
    ],
    demo: { a: 'chbJunctional', b: 'monoVT', label: 'Complete heart block vs VT' },
  },
  {
    id: 'lad',
    name: 'Left axis deviation',
    aliases: ['LAD', 'left axis'],
    normal: [{ level: 'vector', text: 'Mean frontal QRS vector −30° to +90° (dominated by LV free-wall forces pointing leftward and inferior).' }],
    abnormal: [
      { level: 'vector', text: 'Forces rotated superiorly: late activation of the anterosuperior LV (LAFB), inferior-wall scar (loss of inferior forces), RV apical pacing (activation spreads upward from the apex), some pre-excitation, LVH (mild).' },
      { level: 'lead', text: 'Lead II becomes predominantly negative (axis < −30°).' },
    ],
    causes: [
      { id: 'lafb', note: 'most common' },
      { id: 'oldMI', note: 'inferior MI' },
      { id: 'paced', note: 'RV apical pacing' },
      { id: 'lvh', note: 'mild shift' },
      { id: 'wpw', note: 'posteroseptal AP' },
    ],
    demo: { a: 'nsr', b: 'lafb', label: 'Normal vs LAFB' },
    lab: '#/sandbox/axis',
  },
  {
    id: 'rad',
    name: 'Right axis deviation',
    aliases: ['RAD', 'right axis'],
    normal: [{ level: 'vector', text: 'LV dominance keeps the axis ≤ +90° in adults.' }],
    abnormal: [{ level: 'vector', text: 'More rightward forces (RVH, acute RV strain), loss of leftward forces (lateral MI), late inferior-rightward activation (LPFB), vertical heart (COPD, tall thin), lead reversal, dextrocardia.' }],
    causes: [
      { id: 'rvh', note: 'RV mass' },
      { id: 'pe', note: 'acute RV strain' },
      { id: 'lpfb', note: 'exclusion diagnosis' },
      { id: 'copd', note: 'vertical heart' },
    ],
    demo: { a: 'nsr', b: 'rvh', label: 'Normal vs RVH' },
    lab: '#/sandbox/axis',
  },
  {
    id: 'u-wave',
    name: 'Prominent U waves',
    aliases: ['U wave'],
    normal: [{ level: 'cell', text: 'Small U waves (< 1/4 of T) reflect late repolarisation (possibly Purkinje/M-cell or mechano-electrical), best seen in V2–V3 at slow rates.' }],
    abnormal: [{ level: 'cell', text: 'Hypokalaemia slows late repolarisation → large U waves merging with T.' }],
    causes: [{ id: 'hypoK', note: 'classic' }, { id: 'qtDrug', note: 'with IKr block' }, { id: 'sinusBrady', note: 'slow rates' }],
    demo: { a: 'nsr', b: 'hypoK', label: 'Normal vs hypokalaemia' },
    lab: '#/electrolytes',
  },
  {
    id: 'low-voltage',
    name: 'Low voltage',
    aliases: ['small complexes'],
    normal: [{ level: 'lead', text: 'Surface amplitude depends on the size of the cardiac dipole and on what lies between heart and electrode.' }],
    abnormal: [{ level: 'lead', text: 'Effusion, obesity, emphysema, oedema increase attenuation; infiltration (amyloid), extensive scar, hypothyroidism reduce the source.' }],
    causes: [{ id: 'lowVoltage', note: 'effusion/alternans' }, { id: 'copd', note: 'hyperinflation' }],
    demo: { a: 'nsr', b: 'lowVolt', label: 'Normal vs large effusion' },
  },
];

export const findingById = (id: string): Finding | undefined => FINDINGS.find((f) => f.id === id);
