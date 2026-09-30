// Side-by-side comparisons; each difference is explained by mechanism.

export interface Comparison {
  id: string;
  a: string; // preset
  b: string;
  title: string;
  leads?: ('I' | 'II' | 'III' | 'aVR' | 'aVL' | 'aVF' | 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6')[];
  points: { feature: string; a: string; b: string; why: string }[];
}

export const COMPARISONS: Comparison[] = [
  {
    id: 'avnrt-avrt',
    a: 'avnrt',
    b: 'orthoAvrt',
    title: 'AVNRT vs orthodromic AVRT',
    leads: ['II', 'V1'],
    points: [
      { feature: 'Retrograde P timing', a: 'Hidden in/at end of QRS (RP < 70 ms)', b: 'In the ST segment (RP ≥ 70 ms)', why: 'In AVNRT atria and ventricles are activated in parallel from the node; in AVRT the impulse must cross the ventricle and the pathway before reaching the atria.' },
      { feature: 'Retrograde P axis', a: 'Septal (negative inferior, positive V1)', b: 'Depends on pathway site (left lateral → negative in I)', why: 'Atrial activation starts where the retrograde limb inserts.' },
      { feature: 'Sinus-rhythm ECG', a: 'Normal', b: 'Pre-excited if manifest AP; normal if concealed', why: 'Only an antegradely conducting pathway pre-excites.' },
      { feature: 'Adenosine', a: 'Terminates', b: 'Terminates', why: 'Both circuits include the AV node.' },
    ],
  },
  {
    id: 'af-flutter',
    a: 'af',
    b: 'flutter41',
    title: 'Atrial fibrillation vs atrial flutter',
    leads: ['II', 'V1'],
    points: [
      { feature: 'Atrial activity', a: 'Chaotic f waves of varying shape', b: 'Identical sawtooth F waves at ~300/min', why: 'Many wandering wavelets vs one stable macro-re-entrant circuit.' },
      { feature: 'Ventricular rhythm', a: 'Irregularly irregular', b: 'Regular (fixed ratio) or patterned', why: 'Random bombardment + concealed conduction vs a regular input filtered at a fixed ratio.' },
      { feature: 'Cure', a: 'Pulmonary-vein isolation (triggers/substrate)', b: 'Cavotricuspid-isthmus ablation', why: 'Target the mechanism: triggers/substrate vs a critical isthmus.' },
    ],
  },
  {
    id: 'vt-svt',
    a: 'monoVT',
    b: 'pacAberrant',
    title: 'VT vs supraventricular beat with aberrancy',
    leads: ['II', 'V1', 'V6'],
    points: [
      { feature: 'Initial QRS', a: 'Slurred, slow (cell-to-cell from the exit site)', b: 'Sharp (Purkinje activates the septum normally)', why: 'Aberrancy only delays one bundle; the initial activation still uses the fast system.' },
      { feature: 'Morphology', a: 'Atypical; concordance; northwest axis', b: 'Typical RBBB (rSR′) or LBBB pattern', why: 'Only a true bundle-branch pattern reproduces typical BBB shapes.' },
      { feature: 'AV relationship', a: 'AV dissociation; capture/fusion', b: 'Premature P′ precedes each aberrant QRS', why: 'VT does not depend on the atria.' },
    ],
  },
  {
    id: 'rbbb-lbbb',
    a: 'rbbb',
    b: 'lbbb',
    title: 'RBBB vs LBBB',
    leads: ['I', 'V1', 'V6'],
    points: [
      { feature: 'V1', a: 'rSR′ (terminal positive)', b: 'QS or rS (deep negative)', why: 'Late RV activation moves toward V1; slow LV activation moves away from it.' },
      { feature: 'I / V6', a: 'Wide S wave', b: 'Broad notched R, no septal q', why: 'Late rightward forces vs leftward forces throughout.' },
      { feature: 'Septal activation', a: 'Normal (left→right)', b: 'Reversed (right→left)', why: 'The septum is activated by whichever bundle still conducts.' },
      { feature: 'ST–T', a: 'Discordant in V1–V3', b: 'Discordant in all leads', why: 'Secondary repolarisation follows the delayed segment.' },
    ],
  },
  {
    id: 'mobitz',
    a: 'mobitz1',
    b: 'mobitz2',
    title: 'Mobitz I vs Mobitz II',
    leads: ['II'],
    points: [
      { feature: 'PR before block', a: 'Progressively lengthens', b: 'Constant', why: 'Decremental Ca²⁺-dependent nodal cells vs all-or-none Na⁺-dependent His–Purkinje cells.' },
      { feature: 'Level', a: 'AV node', b: 'His–Purkinje', why: '' },
      { feature: 'QRS', a: 'Usually narrow', b: 'Often wide (bundle-branch disease)', why: 'Infranodal disease commonly affects the bundles too.' },
      { feature: 'Atropine', a: 'Improves', b: 'Ineffective / may worsen', why: 'Vagolysis speeds the node and the sinus rate; the diseased His–Purkinje system then sees more impulses.' },
    ],
  },
  {
    id: 'escapes',
    a: 'chbJunctional',
    b: 'chbVentricular',
    title: 'Junctional vs ventricular escape',
    leads: ['II', 'V1'],
    points: [
      { feature: 'QRS width', a: 'Narrow', b: 'Wide', why: 'The junctional impulse uses the His–Purkinje system; the ventricular focus spreads cell-to-cell.' },
      { feature: 'Rate', a: '40–60/min', b: '20–40/min', why: 'Pacemaker hierarchy: automaticity slows down the conduction system.' },
      { feature: 'Level of block implied', a: 'AV node', b: 'Below the His bundle', why: 'Only pacemakers below the block can escape.' },
    ],
  },
  {
    id: 'wpw-normal',
    a: 'nsr',
    b: 'wpw',
    title: 'Normal vs WPW',
    leads: ['II', 'V1', 'V6'],
    points: [
      { feature: 'PR', a: '120–200 ms', b: '< 120 ms', why: 'The pathway bypasses the AV-nodal delay.' },
      { feature: 'QRS start', a: 'Sharp', b: 'Slurred delta wave', why: 'Early muscle-to-muscle activation near the pathway.' },
      { feature: 'QRS width', a: 'Narrow', b: 'Wide (fusion)', why: 'Two wavefronts: pathway and His–Purkinje.' },
    ],
  },
  {
    id: 'hyperk-normal',
    a: 'nsr',
    b: 'hyperK7',
    title: 'Normal vs hyperkalaemia',
    points: [
      { feature: 'T wave', a: 'Asymmetric, moderate', b: 'Tall, narrow, symmetric', why: 'Increased IKr → fast synchronous repolarisation.' },
      { feature: 'P wave', a: 'Normal', b: 'Flattened', why: 'Atrial myocytes are most K⁺-sensitive (Na⁺-channel inactivation).' },
      { feature: 'QRS', a: 'Narrow', b: 'Widening', why: 'Depolarised resting potential → fewer available Na⁺ channels → slower conduction.' },
    ],
  },
  {
    id: 'peri-stemi',
    a: 'pericarditis',
    b: 'stemiInferior',
    title: 'Pericarditis vs STEMI',
    points: [
      { feature: 'Distribution', a: 'Diffuse (many territories)', b: 'One territory', why: 'Diffuse epicardial inflammation vs one occluded artery.' },
      { feature: 'Reciprocal change', a: 'Only aVR (± V1)', b: 'Yes (e.g. aVL in inferior STEMI)', why: 'A diffuse ST vector points toward the apex; a regional vector has an opposite wall.' },
      { feature: 'PR segment', a: 'Depressed (elevated in aVR)', b: 'Usually normal', why: 'Atrial epicardial injury current.' },
      { feature: 'Q waves', a: 'No', b: 'Develop', why: 'Inflammation does not necrose full-thickness myocardium.' },
    ],
  },
  {
    id: 'lvh-normal',
    a: 'nsr',
    b: 'lvh',
    title: 'Normal vs LVH',
    points: [
      { feature: 'Voltage', a: 'Normal', b: 'Tall R V5–V6, deep S V1–V2', why: 'Larger LV dipole.' },
      { feature: 'ST–T lateral', a: 'Concordant', b: 'Strain (STD/TWI)', why: 'Abnormal repolarisation of thick myocardium.' },
    ],
  },
  {
    id: 'rvh-normal',
    a: 'nsr',
    b: 'rvh',
    title: 'Normal vs RVH',
    points: [
      { feature: 'Axis', a: 'Normal', b: 'Right', why: 'RV forces dominate.' },
      { feature: 'V1', a: 'rS', b: 'Dominant R', why: 'Anterior-rightward RV forces toward V1.' },
    ],
  },
  {
    id: 'paced-intrinsic',
    a: 'nsr',
    b: 'vvi',
    title: 'Paced vs intrinsic rhythm',
    points: [
      { feature: 'QRS', a: 'Narrow', b: 'Wide LBBB-like, superior axis', why: 'Activation from the RV apex without Purkinje engagement.' },
      { feature: 'Preceding event', a: 'Sinus P', b: 'Pacing spike', why: '' },
    ],
  },
];
