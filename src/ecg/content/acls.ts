// ACLS ECG reference based on the 2025 AHA Adult ALS guideline and algorithms
// (Wigginton et al., Circulation 2025). This is a teaching summary: always use the
// official, current AHA algorithm and local protocols at the bedside.

export interface AclsCard {
  id: string;
  group: 'arrest' | 'tachy' | 'brady';
  title: string;
  presets: string[];
  recognition: string[];
  action: string[];
  drugs?: string[];
  electrical?: string[];
  why: string;
  dx?: string;
}

export const ACLS_NOTE =
  'Summary of the 2025 AHA Adult Advanced Life Support guideline and algorithms (Cardiac Arrest; Tachyarrhythmia With a Pulse; Bradycardia With a Pulse). Doses are those commonly printed on the algorithms; verify against the current official AHA algorithm and your institution’s protocols. Educational use only.';

export const ACLS: AclsCard[] = [
  {
    id: 'vf-pvt',
    group: 'arrest',
    title: 'Cardiac arrest — VF / pulseless VT (shockable)',
    presets: ['vf', 'pulselessVT'],
    dx: 'vf',
    recognition: ['Unresponsive, no normal breathing, no pulse', 'VF: chaotic waveform, no QRS; pVT: regular wide-complex tachycardia without pulse'],
    action: ['Start high-quality CPR (rate 100–120/min, depth ≥ 5 cm, full recoil, minimise interruptions); give oxygen, attach monitor/defibrillator', 'Shock as soon as possible, then resume CPR immediately for 2 min; rhythm check every 2 min', 'IV/IO access; advanced airway with capnography when appropriate', 'Treat reversible causes (Hs & Ts)'],
    drugs: ['Epinephrine 1 mg IV/IO every 3–5 min', 'Amiodarone 300 mg IV/IO bolus, second dose 150 mg — or lidocaine 1–1.5 mg/kg, then 0.5–0.75 mg/kg (shock-refractory VF/pVT)'],
    electrical: ['Biphasic: manufacturer recommendation (e.g. initial 120–200 J); if unknown, use maximum available. Subsequent doses equivalent or higher', 'Refractory VF: vector change (anterior–posterior pads) or double sequential external defibrillation may be considered (Class 2b, 2025)'],
    why: 'Defibrillation simultaneously depolarises a critical mass of myocardium, extinguishing all re-entrant wavelets; CPR generates the coronary perfusion that makes that reset succeed; epinephrine raises coronary perfusion pressure; antiarrhythmics raise the fibrillation threshold.',
  },
  {
    id: 'pea-asystole',
    group: 'arrest',
    title: 'Cardiac arrest — PEA / asystole (non-shockable)',
    presets: ['pea', 'asystole'],
    dx: 'pea',
    recognition: ['PEA: organised electrical activity, no pulse', 'Asystole: flat line (confirm in 2 leads, check gain/leads)'],
    action: ['High-quality CPR', 'Epinephrine as soon as possible', 'Rhythm check every 2 min; shock only if the rhythm becomes shockable', 'Search for and treat reversible causes: Hypovolaemia, Hypoxia, Hydrogen ion (acidosis), Hypo/Hyperkalaemia, Hypothermia; Tension pneumothorax, Tamponade, Toxins, Thrombosis (pulmonary, coronary)'],
    drugs: ['Epinephrine 1 mg IV/IO every 3–5 min'],
    electrical: ['No defibrillation; transcutaneous pacing is not recommended for asystolic arrest'],
    why: 'There is no chaotic rhythm to reset: electricity is present (PEA) or absent (asystole), but output is missing. Only CPR, vasopressor support and correcting the cause restore circulation.',
  },
  {
    id: 'unstable-tachy',
    group: 'tachy',
    title: 'Tachyarrhythmia with a pulse — UNSTABLE',
    presets: ['afRvr', 'monoVT', 'flutter21'],
    recognition: ['Persistent tachyarrhythmia causing: hypotension, acutely altered mental status, signs of shock, ischaemic chest discomfort, or acute heart failure', 'At rates < 150/min the tachycardia is less likely to be the primary cause of instability (unless ventricular function is impaired) — look for another cause'],
    action: ['Synchronised cardioversion (sedation if possible)', 'If regular narrow-complex: adenosine may be considered while preparing for cardioversion', 'Expert consultation'],
    electrical: ['Synchronised cardioversion; use device-specific energy recommendations to maximise first-shock success', 'AF/atrial flutter: initial 200 J biphasic with incremental increases as needed (2025 AHA)', 'Polymorphic VT/unstable irregular wide: treat as VF (unsynchronised defibrillation)'],
    why: 'Synchronisation delivers the shock on the R wave, avoiding the vulnerable period of the T wave (which could induce VF). Depolarising the whole heart terminates re-entry (AVNRT, AVRT, flutter, AF, VT).',
  },
  {
    id: 'regular-narrow',
    group: 'tachy',
    title: 'Stable regular NARROW-complex tachycardia',
    presets: ['avnrt', 'orthoAvrt', 'flutter21', 'sinusTach'],
    dx: 'avnrt',
    recognition: ['QRS < 120 ms, regular', 'Most commonly AVNRT/AVRT; also sinus tachycardia, flutter with fixed block, atrial tachycardia'],
    action: ['Vagal manoeuvres', 'Adenosine if vagal manoeuvres fail', 'β-blocker or calcium-channel blocker', 'Expert consultation'],
    drugs: ['Adenosine 6 mg rapid IV push with saline flush; 12 mg second dose if required', 'Diltiazem / verapamil or β-blocker (e.g. metoprolol) IV if needed'],
    why: 'AV-node-dependent circuits stop when the node blocks for a moment. If the rhythm continues with AV block (flutter waves or P waves march on), the node was a bystander — the diagnosis is revealed.',
  },
  {
    id: 'irregular-narrow',
    group: 'tachy',
    title: 'Stable IRREGULAR narrow-complex tachycardia',
    presets: ['afRvr', 'mat', 'flutterVariable'],
    dx: 'af',
    recognition: ['Probable AF, flutter with variable block, or MAT'],
    action: ['Rate control: β-blocker or calcium-channel blocker (avoid non-DHP CCB in HFrEF)', 'Treat underlying causes', 'Assess stroke risk/anticoagulation (AF, flutter)', 'Expert consultation for rhythm control'],
    why: 'Irregular atrial input is filtered by the AV node — slowing the node slows the ventricles. Adenosine would only transiently unmask atrial activity.',
  },
  {
    id: 'regular-wide',
    group: 'tachy',
    title: 'Stable regular WIDE-complex tachycardia',
    presets: ['monoVT', 'rvotVT', 'antiAvrt'],
    dx: 'monoVT',
    recognition: ['QRS ≥ 120 ms, regular, monomorphic', 'VT until proven otherwise; SVT with aberrancy/pre-excitation are alternatives'],
    action: ['Expert consultation', 'Adenosine only if regular and monomorphic', 'Antiarrhythmic infusion', 'Synchronised cardioversion if it becomes unstable or drugs fail'],
    drugs: ['Adenosine 6 mg → 12 mg (regular, monomorphic only)', 'Procainamide 20–50 mg/min until arrhythmia suppressed, hypotension, QRS widens > 50%, or max 17 mg/kg; maintenance 1–4 mg/min (avoid with prolonged QT or HF)', 'Amiodarone 150 mg IV over 10 min, repeat as needed; maintenance 1 mg/min for first 6 h', 'Sotalol 100 mg (1.5 mg/kg) IV over 5 min (avoid if QT prolonged)'],
    why: 'Adenosine can diagnose/terminate AV-node-dependent SVT with aberrancy and adenosine-sensitive idiopathic VT without harming most monomorphic VT; antiarrhythmics act on the ventricular circuit itself.',
  },
  {
    id: 'irregular-wide',
    group: 'tachy',
    title: 'Stable IRREGULAR wide-complex tachycardia',
    presets: ['preexAf', 'torsades', 'af'],
    dx: 'preexAf',
    recognition: ['AF with aberrancy/BBB, pre-excited AF, or polymorphic VT/torsades'],
    action: ['Expert consultation', 'Pre-excited AF: avoid AV-nodal blockers (adenosine, β-blockers, CCB, digoxin, amiodarone); use procainamide/ibutilide or cardioversion', 'Torsades: magnesium; defibrillate if unstable', 'Polymorphic VT: defibrillation if unstable'],
    why: 'The three causes have opposite pharmacology: AV-nodal blockers help AF with BBB but can accelerate pre-excited AF; QT-prolonging antiarrhythmics worsen torsades.',
  },
  {
    id: 'bradycardia',
    group: 'brady',
    title: 'Bradycardia with a pulse',
    presets: ['sinusBrady', 'mobitz2', 'chbVentricular'],
    dx: 'chb',
    recognition: ['Heart rate typically < 50/min', 'Assess for hypotension, altered mental status, shock, ischaemic chest discomfort, acute heart failure', 'Identify: sinus bradycardia, AV block (Mobitz I/II, high-grade, complete), escape rhythms'],
    action: ['Identify and treat underlying cause; maintain airway, oxygen if hypoxaemic; monitor, 12-lead ECG, IV access', 'Unstable: atropine', 'If atropine ineffective: transcutaneous pacing and/or dopamine or epinephrine infusion', 'Consider expert consultation and transvenous pacing'],
    drugs: ['Atropine 1 mg IV bolus; repeat every 3–5 min; maximum 3 mg', 'Dopamine infusion 5–20 mcg/kg/min, titrate to response', 'Epinephrine infusion 2–10 mcg/min, titrate to response'],
    electrical: ['Transcutaneous pacing: confirm electrical AND mechanical capture (pulse)', 'Transvenous pacing for persistent unstable bradycardia'],
    why: 'Atropine removes vagal brake on sinus and AV-nodal cells — useful for sinus bradycardia and nodal block, ineffective for infranodal block (Mobitz II, complete block with wide escape) or transplanted hearts; pacing bypasses the failing tissue.',
  },
];
