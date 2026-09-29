import { h, p, ul } from '../ui/dom';
import { header, presetPhysio, refList, whyList } from '../ui/common';
import { VectorExplorer } from '../ui/vectorWheel';
import { AP_DEFAULT, drawAP, naAvailability, restingPotential, sinoatrialAP, ventricularAP, type ApParams } from '../ui/apPlot';
import { slider, segmented } from '../ui/controls';
import { LEADS, TWELVE } from '../engine/leads';
import { EcgPanel } from '../ui/panel';

export function renderFundamentals(root: HTMLElement, parts: string[]): (() => void) | void {
  const sub = parts[0];
  if (sub === 'leads') return leads(root);
  if (sub === 'ap') return actionPotentials(root);
  if (sub === 'systematic') return systematic(root);
  root.append(
    header('A · ECG Fundamentals', 'What is an ECG?', 'An ECG records, at the skin, the tiny voltage differences produced as waves of depolarisation and repolarisation sweep through the heart. Everything on the tracing follows from three facts: how cells change their voltage, which way the wavefront travels, and where the electrode is looking from.'),
    h(
      'div',
      { class: 'grid' },
      h('a', { class: 'tile', href: '#/fundamentals/ap' }, h('h3', null, '1. Membranes, ions and action potentials'), h('p', null, 'Resting potential, ion gradients, phases 0–4, pacemaker vs working cells — interactive.')),
      h('a', { class: 'tile', href: '#/fundamentals/leads' }, h('h3', null, '2. Vectors, electrodes and the 12 leads'), h('p', null, 'Rotate the activation vector and watch each lead turn positive or negative.')),
      h('a', { class: 'tile', href: '#/fundamentals/systematic' }, h('h3', null, '3. Systematic interpretation'), h('p', null, 'Rate → rhythm → axis → P → PR → QRS → ST/T → QT, with the physiology behind each step.')),
      h('a', { class: 'tile', href: '#/physiology' }, h('h3', null, '4. Why each wave looks the way it does'), h('p', null, 'From the conduction system to P, QRS, T and U.')),
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'Core ideas in one page'),
      whyList([
        { level: 'cell', text: 'Resting myocytes are negative inside (≈ −90 mV) because the membrane is mostly permeable to K⁺ and K⁺ is concentrated inside (Na⁺/K⁺-ATPase).' },
        { level: 'cell', text: 'Depolarisation (phase 0) is a rapid inward Na⁺ current in working myocardium, or a slower inward Ca²⁺ current in sinus- and AV-nodal cells.' },
        { level: 'conduction', text: 'Depolarisation spreads cell-to-cell through gap junctions; the border between depolarised and resting tissue is a moving electrical dipole.' },
        { level: 'vector', text: 'At each instant the dipoles of the whole heart sum to a single "heart vector" with a direction and a size.' },
        { level: 'lead', text: 'A lead is a line of sight with a positive pole: it records the projection of the heart vector on that line (a dot product).' },
        { level: 'waveform', text: 'Wavefront toward the positive pole → upward deflection; away → downward; perpendicular → small or biphasic.' },
        { level: 'waveform', text: 'Repolarisation is the reverse charge moving; a repolarisation wave moving AWAY from a lead also writes upward — which is why the T wave is normally upright even though repolarisation ends where depolarisation began.' },
      ]),
    ),
    refList(['ecgStd1', 'ionChannels2009', 'durrer1970']),
  );
}

function leads(root: HTMLElement): () => void {
  root.append(header('A · ECG Fundamentals', 'Vectors, electrodes and the 12 leads', 'Drag the red arrow (the instantaneous cardiac vector) in either plane. Each lead’s deflection is simply the projection of that vector on the lead axis: that is all a lead "sees".'));
  const ex = new VectorExplorer([0.55, 0.75, -0.25]);
  const presets = segmented<'normal' | 'lad' | 'rad' | 'nw' | 'ant' | 'post'>(
    [
      ['normal', 'Normal (+55°)'],
      ['lad', 'Left axis (−60°)'],
      ['rad', 'Right axis (+120°)'],
      ['nw', 'Extreme (−150°)'],
      ['ant', 'Anterior'],
      ['post', 'Posterior'],
    ],
    'normal',
    (v) => {
      const map: Record<string, [number, number, number]> = { normal: [0.55, 0.78, -0.25], lad: [0.45, -0.8, -0.2], rad: [-0.45, 0.8, -0.1], nw: [-0.8, -0.45, 0.1], ant: [0.2, 0.3, 0.9], post: [0.2, 0.3, -0.9] };
      ex.set(map[v]);
    },
    'Try',
  );
  root.append(h('section', { class: 'card' }, presets, ex.el));
  const rows = TWELVE.map((id) => {
    const L = LEADS[id];
    return h('tr', null, h('td', null, h('strong', null, id)), h('td', null, L.plane === 'frontal' ? `${L.angle}° (frontal)` : `${L.angle}° (horizontal)`), h('td', null, L.placement), h('td', null, L.views));
  });
  root.append(
    h('section', { class: 'card' }, h('h2', null, 'What each lead is viewing'), h('div', { class: 'table-scroll' }, h('table', { class: 't' }, h('thead', null, h('tr', null, h('th', null, 'Lead'), h('th', null, 'Axis'), h('th', null, 'Electrodes'), h('th', null, 'Looks at'))), h('tbody', null, ...rows)))),
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'Why the leads are arranged this way'),
      ul([
        '**Bipolar limb leads** (I, II, III) measure between two limbs (Einthoven’s triangle): I = LA − RA, II = LL − RA, III = LL − LA; hence I + III = II.',
        '**Augmented limb leads** (aVR, aVL, aVF) compare one limb with the average of the other two, filling the gaps at 30° intervals → the hexaxial reference system.',
        '**Precordial leads** (V1–V6) measure each chest electrode against Wilson’s central terminal and look at the heart in the horizontal plane — from the right ventricle/septum (V1–V2) round to the lateral LV (V5–V6).',
        '**Contiguous leads** view neighbouring regions: inferior (II, III, aVF), lateral (I, aVL, V5–V6), septal/anterior (V1–V4). Ischaemic changes are judged in contiguous groups.',
        '**aVR** looks into the cavity from the right shoulder: almost everything normal is negative in aVR, and ST elevation there means the injury vector points toward the cavity/RV outflow.',
        'Precordial electrodes sit close to the heart, so they are also influenced by local ("proximity") potentials — the reason Brugada changes appear only in V1–V2.',
      ]),
    ),
  );
  const panel = new EcgPanel({ duration: 10000 });
  root.append(h('section', { class: 'card' }, h('h2', null, 'Put it together: a normal 12-lead'), p('Normal activation (septum left→right, apex, LV free wall, base) produces rS in V1 and qR in V6 — the septal and LV vectors projected on each lead.'), panel.el));
  panel.show(presetPhysio('nsr'));
  root.append(refList(['ecgStd1', 'durrer1970']));
  return () => panel.destroy();
}

function actionPotentials(root: HTMLElement): void {
  root.append(header('A · ECG Fundamentals', 'Membranes, ions and action potentials', 'The ECG is the sum of millions of action potentials. Change the extracellular environment or block a channel and see the action potential — and its ECG counterpart — change.'));
  const pp: ApParams = { ...AP_DEFAULT };
  const canvas = h('canvas', { class: 'ap-canvas', 'aria-label': 'Action potential plot' });
  const sa = h('canvas', { class: 'ap-canvas', style: 'height:180px', 'aria-label': 'Sinus node action potential plot' });
  const info = h('div', { class: 'kv' });
  const redraw = (): void => {
    drawAP(canvas, [
      { c: ventricularAP(pp, false), label: 'endocardial', color: '#1565c0' },
      { c: ventricularAP(pp, true), label: 'epicardial', color: '#c62828' },
    ]);
    drawAP(sa, [{ c: sinoatrialAP(pp), label: 'sinus-node cell', color: '#2e7d32' }], false);
    const rmp = restingPotential(pp.K, pp.ischemia);
    info.replaceChildren(
      h('dt', null, 'Resting potential'),
      h('dd', null, `${rmp.toFixed(0)} mV (E_K ≈ 61.5·log10([K⁺]o/140))`),
      h('dt', null, 'Na⁺ channels available'),
      h('dd', null, `${Math.round(naAvailability(rmp) * (1 - 0.7 * pp.naBlock) * 100)}% → phase-0 slope → conduction velocity → QRS width`),
      h('dt', null, 'Epi vs endo APD'),
      h('dd', null, 'Epicardium repolarises first → repolarisation travels epi→endo → upright T in leads facing the epicardium.'),
    );
  };
  const ctl = h(
    'div',
    { class: 'grid' },
    slider({ label: 'Extracellular K⁺', min: 2, max: 9, step: 0.1, value: pp.K, unit: 'mmol/L', help: 'High K⁺ depolarises the resting membrane (Na⁺-channel inactivation) and speeds phase 3.', onInput: (v) => ((pp.K = v), redraw()) }),
    slider({ label: 'Calcium', min: 1.5, max: 3.6, step: 0.05, value: pp.Ca, unit: 'mmol/L', help: 'Low Ca²⁺ prolongs the plateau (long ST); high Ca²⁺ shortens it.', onInput: (v) => ((pp.Ca = v), redraw()) }),
    slider({ label: 'Na⁺-channel block', min: 0, max: 1, step: 0.05, value: 0, help: 'Class I drugs / TCAs: slower phase 0 → slower conduction → wide QRS.', onInput: (v) => ((pp.naBlock = v), redraw()) }),
    slider({ label: 'IKr (hERG) block', min: 0, max: 1, step: 0.05, value: 0, help: 'Slows phase 3 → long QT.', onInput: (v) => ((pp.ikrBlock = v), redraw()) }),
    slider({ label: 'Epicardial Ito', min: 0, max: 2.2, step: 0.05, value: 1, help: 'A deep phase-1 notch → J waves; with low INa the epicardial dome can be lost (Brugada).', onInput: (v) => ((pp.ito = v), redraw()) }),
    slider({ label: 'Sympathetic tone', min: -1, max: 1, step: 0.05, value: 0, help: 'Steeper phase 4 in the sinus node (faster rate); shorter APD.', onInput: (v) => ((pp.sympathetic = v), redraw()) }),
    slider({ label: 'Ischaemia', min: 0, max: 1, step: 0.05, value: 0, help: 'Less negative resting potential, shorter lower plateau → injury currents (ST shift).', onInput: (v) => ((pp.ischemia = v), redraw()) }),
  );
  root.append(
    h('section', { class: 'card' }, h('h2', null, 'Ventricular action potential (endocardium vs epicardium)'), canvas, info, ctl),
    h('section', { class: 'card' }, h('h2', null, 'Pacemaker (sinus-node) action potential'), p('No stable resting potential: If ("funny") and T-type Ca²⁺ currents depolarise the cell during phase 4 until L-type Ca²⁺ channels fire a slow upstroke. The phase-4 slope sets the heart rate; the Ca²⁺-dependent upstroke explains why nodal tissue conducts slowly and responds to CCBs, β-blockers, adenosine and vagal tone.'), sa),
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'Phase → ECG correspondence'),
      h('div', { class: 'table-scroll' }, h('table', { class: 't' }, h('thead', null, h('tr', null, h('th', null, 'Phase'), h('th', null, 'Main currents'), h('th', null, 'ECG counterpart'))), h('tbody', null, ...[
        ['0 — upstroke', 'INa (working myocardium); ICa,L (nodal cells)', 'QRS (ventricles), P (atria); slope determines conduction velocity → QRS width'],
        ['1 — early repolarisation', 'Ito', 'J point; J/Osborn waves, Brugada, early repolarisation'],
        ['2 — plateau', 'ICa,L vs IKs/IKr', 'ST segment (isoelectric because all cells are at similar voltage)'],
        ['3 — repolarisation', 'IKr, IKs, IK1', 'T wave; its duration sets the QT'],
        ['4 — rest / diastolic depolarisation', 'IK1 (working cells); If, ICa,T (pacemakers)', 'TP segment; heart rate (pacemaker slope)'],
      ].map((r) => h('tr', null, ...r.map((c) => h('td', null, c))))))),
    ),
    refList(['ionChannels2009', 'ecgStd4']),
  );
  requestAnimationFrame(redraw);
  window.addEventListener('resize', redraw, { once: true });
}

function systematic(root: HTMLElement): () => void {
  root.append(header('A · ECG Fundamentals', 'Systematic interpretation', 'Read every ECG in the same order, and for each step ask what physiology produces the value you see.'));
  const steps: [string, string, string][] = [
    ['Rate', '300 ÷ large squares between R waves (regular) or QRS count × 6 in a 10-s strip (irregular).', 'Rate = the fastest pacemaker that reaches the ventricles, filtered by AV-nodal refractoriness.'],
    ['Rhythm', 'Regular? P before every QRS? QRS after every P? P morphology sinus?', 'Where does activation start, and does every atrial impulse get through the node?'],
    ['Axis', 'Lead I and aVF (then II) positivity; isoelectric lead is perpendicular to the axis.', 'Direction of the mean ventricular vector (mass, conduction, infarcts).'],
    ['P wave', 'Upright II, ≤ 120 ms, ≤ 2.5 mm; biphasic V1 with small terminal negativity.', 'Atrial origin and atrial size/conduction.'],
    ['PR', '120–200 ms; constant?', 'Mostly AV-nodal delay; short with pre-excitation, long with nodal slowing.'],
    ['QRS', '< 110–120 ms; morphology in V1/V6; Q waves; voltage.', 'Speed and sequence of ventricular activation; mass; scar.'],
    ['ST segment', 'Isoelectric? Elevation/depression, shape, distribution, reciprocity.', 'Voltage gradients during the plateau (injury currents).'],
    ['T wave', 'Concordant with QRS? Shape (peaked, flat, inverted).', 'Sequence and speed of repolarisation; primary vs secondary change.'],
    ['QT / QTc', 'QTc (Bazett overcorrects at fast rates; Fridericia preferred there). Long > 450 (M) / 460 (F); short < 340–360.', 'Action-potential duration (K⁺, Ca²⁺ channels, drugs, genes).'],
  ];
  root.append(h('section', { class: 'card' }, h('div', { class: 'table-scroll' }, h('table', { class: 't' }, h('thead', null, h('tr', null, h('th', null, 'Step'), h('th', null, 'What to measure'), h('th', null, 'Physiology it reflects'))), h('tbody', null, ...steps.map((r) => h('tr', null, h('td', null, h('strong', null, r[0])), h('td', null, r[1]), h('td', null, r[2]))))))));
  const panel = new EcgPanel({ duration: 10000 });
  root.append(h('section', { class: 'card' }, h('h2', null, 'Practice on a live tracing'), p('Use the caliper (drag across the tracing) to measure PR, QRS and QT, then compare with the model’s ground-truth measurements below.'), panel.el));
  panel.show(presetPhysio('avb1'));
  root.append(refList(['ecgStd1', 'ecgStd4']));
  return () => panel.destroy();
}
