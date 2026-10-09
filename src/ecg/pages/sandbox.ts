import { h, p, ul, debounce } from '../ui/dom';
import { header, openInSimulator, presetPhysio, refList, whyList } from '../ui/common';
import { EcgPanel } from '../ui/panel';
import { VectorExplorer } from '../ui/vectorWheel';
import { button, segmented, select, slider, toggle } from '../ui/controls';
import { COMPARISONS } from '../content/comparisons';
import { presetLabel } from '../content/index';
import { applyPatch, clone, makePhysio, type AtrialSite, type Physio, type PhysioPatch, type Territory, type VentSite } from '../engine/params';
import type { Measurements } from '../engine/measure';
import { frontal } from '../engine/vec';
import { AP_SITE, VENT_SITE, TERRITORY } from '../engine/morphology';

export function renderSandbox(root: HTMLElement, parts: string[]): (() => void) | void {
  const sub = parts[0];
  const map: Record<string, (r: HTMLElement) => (() => void) | void> = { one: changeOne, build: buildOwn, adenosine: adenosineDemo, compare: compare, axis: axisLab, p: pLab, qrs: qrsLab, st: stLab, hierarchy: hierarchy };
  if (sub && map[sub]) return map[sub](root);
  root.append(header('N · Physiology Sandbox', 'Experiment with the heart', 'Change physiology → predict the ECG → observe → explain. Every tool here runs the same conduction and waveform engine as the rest of the app.'));
  const tiles: [string, string, string][] = [
    ['one', 'Change one variable', 'Before → change → after, with a table of exactly what changed and why.'],
    ['build', 'Build your own arrhythmia', 'Pick pacemaker, conduction, mechanism, rates and refractoriness.'],
    ['adenosine', 'Adenosine physiology demonstrator', 'Rhythm mechanism vs drug site of action.'],
    ['compare', 'ECG comparison mode', 'Disease A vs disease B with mechanistic explanations.'],
    ['hierarchy', 'Pacemaker hierarchy', 'Disable pacemakers and watch escapes emerge.'],
    ['axis', 'Axis lab', 'Rotate the vector through 360° and see each limb lead respond.'],
    ['p', 'P-wave lab', 'Atrial mass, conduction, origin → P morphology.'],
    ['qrs', 'QRS lab', 'Mass, sequence, velocity, infarct, pathway, focus → QRS.'],
    ['st', 'ST/T/QT lab', 'Injury, ions, drugs, autonomic tone → ST, T and QT.'],
  ];
  root.append(h('div', { class: 'grid' }, ...tiles.map(([k, t, d]) => h('a', { class: 'tile', href: `#/sandbox/${k}` }, h('h3', null, t), h('p', null, d)))));
}

// ---------------------------------------------------------------------------------------------
// Change one variable
// ---------------------------------------------------------------------------------------------

interface Experiment {
  id: string;
  label: string;
  base: string;
  basePatch?: PhysioPatch;
  change: PhysioPatch;
  explain: string;
  leads?: ('II' | 'V1' | 'V6' | 'I' | 'aVF' | 'V2' | 'V5')[];
}

const EXPERIMENTS: Experiment[] = [
  { id: 'avnErp', label: 'Increase AV-nodal refractory period', base: 'nsr', basePatch: { rhythm: { sinusRate: 80, sinusArrhythmia: 0, avnDecrement: 300, avnTau: 250, junctionalRate: 36 } }, change: { rhythm: { avnERP: 520 } }, explain: 'Each P now arrives while the node is still partly refractory: conduction slows progressively until one P is blocked — Wenckebach periodicity emerges from a single refractoriness change.', leads: ['II'] },
  { id: 'pacerSite', label: 'Move the ventricular pacemaker from the apex to the septum', base: 'ventEscape', basePatch: { rhythm: { ventEscapeSite: 'rvApex' } }, change: { rhythm: { ventEscapeSite: 'septal' } }, explain: 'A septal origin engages more of the conduction system and activates both ventricles more symmetrically: the QRS narrows and the axis turns inferior.', leads: ['II', 'V1'] },
  { id: 'k', label: 'Increase potassium (4.2 → 7.2 mmol/L)', base: 'nsr', change: { K: 7.2 }, explain: 'Faster phase 3 (peaked T) plus a less negative resting potential (Na⁺-channel inactivation → P flattening, PR and QRS prolongation).', leads: ['II', 'V2'] },
  { id: 'rb', label: 'Block the right bundle', base: 'nsr', change: { bundle: 'rbbb' }, explain: 'The RV is now activated late through the septum: a terminal rightward-anterior vector adds R′ in V1 and wide S in I/V6, and the QRS widens.', leads: ['V1', 'V6'] },
  { id: 'ap', label: 'Add an accessory pathway (right free wall)', base: 'nsr', change: { rhythm: { ap: { present: true, location: 'rightFreeWall' } } }, explain: 'The pathway bypasses the nodal delay: short PR, delta wave, wide fused QRS, secondary ST–T change.', leads: ['II', 'V1'] },
  { id: 'lv', label: 'Increase LV mass', base: 'nsr', change: { lvMass: 1.9 }, explain: 'A larger LV dipole raises lateral R and right precordial S voltage; thick walls repolarise abnormally (strain).', leads: ['V1', 'V5'] },
  { id: 'axis', label: 'Shift the mean QRS axis 30° left', base: 'nsr', change: { axisShift: -30 }, explain: 'Rotating the ventricular vector superiorly makes II/III/aVF less positive and aVL/I more positive.', leads: ['I', 'aVF'] },
  { id: 'vagal', label: 'Increase vagal tone', base: 'nsr', change: { autonomic: -0.8 }, explain: 'Acetylcholine slows sinus phase 4 (bradycardia) and AV-nodal conduction (longer PR); the QT lengthens as the rate slows.', leads: ['II'] },
  { id: 'ikr', label: 'Block IKr (QT-prolonging drug)', base: 'nsr', change: { drugs: { qtDrug: 1 } }, explain: 'Slower phase 3 → later, broader T → long QT.', leads: ['II', 'V2'] },
  { id: 'ca', label: 'Lower calcium (2.35 → 1.7 mmol/L)', base: 'nsr', change: { Ca: 1.7 }, explain: 'Longer plateau (phase 2) → longer ST segment → long QT with a normal T wave.', leads: ['II'] },
  { id: 'rca', label: 'Occlude the proximal RCA', base: 'nsr', change: { ischemia: { territory: 'proxRCA', stage: 'stemi', extent: 0.9 } }, explain: 'Injury current toward the inferior/right wall → STE II, III, aVF (III > II), reciprocal STD in I/aVL.', leads: ['II', 'V1'] },
  { id: 'slow', label: 'Slow the slow pathway (AVNRT)', base: 'avnrt', change: { rhythm: { slowAH: 340 } }, explain: 'Slower slow-pathway conduction lengthens the circuit → the tachycardia cycle length increases (slower AVNRT).', leads: ['II', 'V1'] },
  { id: 'apErp', label: 'Shorten the accessory-pathway refractory period during AF', base: 'preexAf', basePatch: { rhythm: { ap: { erp: 330 } } }, change: { rhythm: { ap: { erp: 200 } } }, explain: 'Only the pathway’s refractory period limits pre-excited AF: shorter ERP → faster, more dangerous ventricular rates.', leads: ['II'] },
];

function measureTable(a: Measurements, b: Measurements): HTMLElement {
  const rows: [string, string, string][] = [
    ['Ventricular rate', `${a.ventRate ?? '—'}`, `${b.ventRate ?? '—'}`],
    ['Atrial rate', `${a.atrialRate ?? '—'}`, `${b.atrialRate ?? '—'}`],
    ['Rhythm', a.regularity, b.regularity],
    ['PR (ms)', a.prRange ? `${a.prRange[0]}–${a.prRange[1]}` : '—', b.prRange ? `${b.prRange[0]}–${b.prRange[1]}` : '—'],
    ['QRS (ms)', `${a.qrs ?? '—'}`, `${b.qrs ?? '—'}`],
    ['QT / QTc (ms)', a.qt ? `${a.qt} / ${a.qtcBazett}` : '—', b.qt ? `${b.qt} / ${b.qtcBazett}` : '—'],
    ['Axis', a.axis === null ? '—' : `${a.axis}°`, b.axis === null ? '—' : `${b.axis}°`],
    ['AV relation', a.avRelation, b.avRelation],
  ];
  return h('table', { class: 't diff-table' }, h('thead', null, h('tr', null, h('th', null, ''), h('th', null, 'Before'), h('th', null, 'After'))), h('tbody', null, ...rows.map(([k, x, y]) => h('tr', null, h('th', null, k), h('td', null, x), h('td', { class: x !== y ? 'changed' : '' }, y)))));
}

function changeOne(root: HTMLElement): () => void {
  root.append(header('N · Physiology Sandbox', 'Change exactly one variable', 'Choose an experiment. Predict what the ECG will do before you look. Then compare before and after.'));
  const a = new EcgPanel({ duration: 8000, layout: 'strips', leads: ['II', 'V1'], compact: true, measurements: false, showLadder: true });
  const b = new EcgPanel({ duration: 8000, layout: 'strips', leads: ['II', 'V1'], compact: true, measurements: false, showLadder: true });
  const table = h('div', { class: 'table-scroll' });
  const explain = h('div', { class: 'callout' });
  const predict = h('div', { class: 'callout warn' });
  const reveal = h('div', { class: 'answer' });
  const run = (e: Experiment): void => {
    const before = presetPhysio(e.base, e.basePatch);
    const after = applyPatch(clone(before), e.change);
    const leads = e.leads ?? ['II', 'V1'];
    a.view.setOptions({ leads });
    b.view.setOptions({ leads });
    const ra = a.show(before);
    const rb = b.show(after);
    table.replaceChildren(measureTable(ra.m, rb.m));
    explain.replaceChildren(p(`**What changed physiologically:** ${e.label}.`), p(`**Why the ECG changed:** ${e.explain}`));
    predict.replaceChildren(p(`**Predict first:** ${e.label}. What will happen to the rate, PR, QRS, ST/T and QT? Commit to an answer, then reveal.`));
    reveal.classList.remove('show');
  };
  const sel = select({ label: 'Experiment', value: EXPERIMENTS[0].id, options: EXPERIMENTS.map((e) => [e.id, e.label] as [string, string]), onChange: (v) => run(EXPERIMENTS.find((e) => e.id === v)!) });
  reveal.append(h('div', { class: 'grid-2' }, h('div', null, h('h3', null, 'Before'), a.el), h('div', null, h('h3', null, 'After'), b.el)), table, explain);
  root.append(h('section', { class: 'card' }, sel, predict, button('Reveal before → after', () => reveal.classList.add('show'), 'btn-primary'), reveal));
  run(EXPERIMENTS[0]);
  return () => {
    a.destroy();
    b.destroy();
  };
}

// ---------------------------------------------------------------------------------------------
// Build your own arrhythmia
// ---------------------------------------------------------------------------------------------

function buildOwn(root: HTMLElement): () => void {
  root.append(header('N · Physiology Sandbox', 'Build your own arrhythmia', 'Choose where the rhythm starts, how it is conducted, what drives it, and the rates and refractory periods. The engine builds the rhythm — then tells you what you made.'));
  const cfg = { pacemaker: 'sinus' as 'sinus' | 'atrial' | 'junctional' | 'ventricular', conduction: 'normal' as 'normal' | 'slowed' | 'blocked' | 'alternate', mechanism: 'automaticity' as 'automaticity' | 'triggered' | 'reentry', atrialRate: 80, ventRate: 40, atrialERP: 220, avnERP: 150, ventRefr: 410 };
  const panel = new EcgPanel({ heart: true, duration: 10000, layout: 'strips', leads: ['II', 'V1'], showLadder: true, showLabels: true });
  const out = h('div', { class: 'callout' });
  let current: Physio = makePhysio();
  const build = (): { p: Physio; name: string; why: string } => {
    const pp = makePhysio({ noise: 0.1 });
    const R = pp.rhythm;
    R.atrialERP = cfg.atrialERP;
    R.avnERP = cfg.avnERP;
    pp.qtcBase = cfg.ventRefr;
    let name = '';
    let why = '';
    switch (cfg.pacemaker) {
      case 'sinus':
        R.sinusRate = cfg.atrialRate;
        name = cfg.atrialRate > 100 ? 'Sinus tachycardia' : cfg.atrialRate < 60 ? 'Sinus bradycardia' : 'Sinus rhythm';
        why = 'Sinus-node automaticity sets the rate.';
        break;
      case 'atrial':
        if (cfg.mechanism === 'reentry' && cfg.atrialRate >= 350) {
          R.atrialMechanism = 'fibrillation';
          R.afMeanCL = Math.max(110, 60000 / cfg.atrialRate);
          name = 'Atrial fibrillation';
          why = 'Very rapid multiple-wavelet re-entry: no organised P waves; the AV node filters the input.';
        } else if (cfg.mechanism === 'reentry' && cfg.atrialRate >= 220) {
          R.atrialMechanism = 'flutter';
          R.flutterCL = 60000 / cfg.atrialRate;
          name = 'Atrial flutter';
          why = 'A macro-re-entrant atrial circuit at this rate produces continuous flutter waves; the AV node sets the conduction ratio.';
        } else {
          R.atrialMechanism = 'focalAT';
          R.focalATRate = cfg.atrialRate;
          R.focalATSite = 'lowRA';
          name = cfg.atrialRate > 100 ? 'Focal atrial tachycardia' : 'Ectopic atrial rhythm';
          why = `A single atrial focus (${cfg.mechanism === 'reentry' ? 'micro-re-entry' : cfg.mechanism}) drives the atria with non-sinus P waves.`;
        }
        break;
      case 'junctional':
        R.sinusRate = Math.min(cfg.atrialRate, 45);
        if (cfg.mechanism === 'reentry') {
          R.dualPathway = true;
          R.triggerPAC = { at: 1500, coupling: 300, site: 'leftAtrial' };
          R.sinusRate = cfg.atrialRate;
          name = 'AV nodal re-entrant tachycardia';
          why = 'Re-entry using fast and slow AV-nodal pathways, started by a premature beat.';
        } else {
          R.junctionalRate = cfg.ventRate;
          R.junctionalAccelerated = cfg.ventRate > 60;
          name = cfg.ventRate > 100 ? 'Junctional tachycardia' : cfg.ventRate > 60 ? 'Accelerated junctional rhythm' : 'Junctional escape rhythm';
          why = 'The AV junction is the fastest available pacemaker: narrow QRS, retrograde or dissociated P waves.';
        }
        break;
      case 'ventricular':
        R.sinusRate = cfg.atrialRate;
        R.vtSite = 'lvInferobasal';
        R.vtRate = cfg.ventRate;
        if (cfg.mechanism === 'automaticity') {
          if (cfg.ventRate <= 45) {
            R.junctionalEnabled = false;
            R.nodalBlock = 'complete';
            R.ventEscapeRate = cfg.ventRate;
            name = 'Ventricular escape rhythm (with AV block)';
            why = 'Only a ventricular pacemaker remains: slow and wide.';
          } else {
            R.ventMechanism = cfg.ventRate > 110 ? 'monoVT' : 'aivr';
            name = cfg.ventRate > 110 ? 'Ventricular tachycardia (automatic)' : 'Accelerated idioventricular rhythm';
            why = 'Enhanced ventricular automaticity competes with, and overtakes, the sinus node.';
          }
        } else if (cfg.mechanism === 'triggered') {
          if (cfg.ventRefr >= 480) {
            R.ventMechanism = 'torsades';
            R.vtRate = Math.max(180, cfg.ventRate);
            R.vtStart = 3000;
            R.vtDuration = 5000;
            name = 'Torsades de pointes';
            why = 'Long repolarisation (high ventricular refractoriness / QTc) + triggered activity → EAD-driven polymorphic VT.';
          } else {
            R.ventMechanism = 'monoVT';
            R.vtSite = 'rvot';
            R.vtAdenosineSensitive = true;
            name = 'Idiopathic outflow-tract VT (triggered)';
            why = 'cAMP-mediated DADs from the RV outflow tract: LBBB-like, inferior axis.';
          }
        } else {
          R.ventMechanism = cfg.ventRate > 280 ? 'vf' : cfg.ventRate > 240 ? 'vflutter' : 'monoVT';
          name = cfg.ventRate > 280 ? 'Ventricular fibrillation' : cfg.ventRate > 240 ? 'Ventricular flutter' : 'Monomorphic VT (re-entry)';
          why = 'Ventricular re-entry: AV dissociation with the independent sinus rhythm; faster circuits degenerate.';
        }
        break;
    }
    if (cfg.conduction === 'slowed') R.avnAHmin = 260;
    if (cfg.conduction === 'blocked' && cfg.pacemaker !== 'ventricular') {
      R.nodalBlock = 'complete';
      name += ' + complete AV block';
      why += ' The AV node blocks every impulse, so a junctional/ventricular escape drives the ventricles.';
    }
    if (cfg.conduction === 'alternate') {
      R.ap.present = true;
      R.ap.location = 'leftLateral';
      if (cfg.pacemaker === 'sinus' && cfg.mechanism === 'reentry') {
        R.triggerPAC = { at: 1500, coupling: 330, site: 'leftAtrial' };
        name = 'Orthodromic AVRT';
        why = 'A premature beat blocks in the pathway, conducts down the node and returns up the pathway: AV re-entry.';
      } else if (R.atrialMechanism === 'fibrillation') {
        R.ap.erp = 220;
        name = 'Pre-excited atrial fibrillation';
        why = 'AF conducted over a non-decremental accessory pathway.';
      } else name += ' with pre-excitation';
    }
    return { p: pp, name, why };
  };
  const rerun = debounce(() => {
    const b = build();
    current = b.p;
    panel.stop();
    const r = panel.show(b.p);
    out.replaceChildren(p(`**You built:** ${b.name}.`), p(b.why), p(`Model: ventricular ${r.m.ventRate ?? '—'}/min, atrial ${r.m.atrialRate ?? '—'}/min, QRS ${r.m.qrs ?? '—'} ms, ${r.m.avRelation}.`, 'ref-meta'));
  }, 80);
  root.append(
    h(
      'section',
      { class: 'card' },
      h(
        'div',
        { class: 'grid' },
        segmented<'sinus' | 'atrial' | 'junctional' | 'ventricular'>([['sinus', 'Sinus'], ['atrial', 'Atrial'], ['junctional', 'Junctional'], ['ventricular', 'Ventricular']], cfg.pacemaker, (v) => ((cfg.pacemaker = v), rerun()), 'Pacemaker'),
        segmented<'normal' | 'slowed' | 'blocked' | 'alternate'>([['normal', 'Normal'], ['slowed', 'Slowed'], ['blocked', 'Blocked'], ['alternate', 'Alternate pathway']], cfg.conduction, (v) => ((cfg.conduction = v), rerun()), 'AV conduction'),
        segmented<'automaticity' | 'triggered' | 'reentry'>([['automaticity', 'Automaticity'], ['triggered', 'Triggered activity'], ['reentry', 'Re-entry']], cfg.mechanism, (v) => ((cfg.mechanism = v), rerun()), 'Mechanism'),
      ),
      h(
        'div',
        { class: 'grid' },
        slider({ label: 'Atrial rate', min: 30, max: 500, step: 5, value: cfg.atrialRate, unit: '/min', onInput: (v) => ((cfg.atrialRate = v), rerun()) }),
        slider({ label: 'Ventricular focus rate', min: 20, max: 320, step: 5, value: cfg.ventRate, unit: '/min', onInput: (v) => ((cfg.ventRate = v), rerun()) }),
        slider({ label: 'Atrial refractoriness', min: 120, max: 350, step: 5, value: cfg.atrialERP, unit: 'ms', onInput: (v) => ((cfg.atrialERP = v), rerun()) }),
        slider({ label: 'AV-nodal refractoriness', min: 80, max: 700, step: 5, value: cfg.avnERP, unit: 'ms', onInput: (v) => ((cfg.avnERP = v), rerun()) }),
        slider({ label: 'Ventricular refractoriness (QTc)', min: 300, max: 600, step: 5, value: cfg.ventRefr, unit: 'ms', onInput: (v) => ((cfg.ventRefr = v), rerun()) }),
      ),
      h('div', { class: 'btn-row' }, button('Open in full simulator →', () => openInSimulator(current), 'btn-primary')),
      out,
      panel.el,
    ),
  );
  rerun();
  return () => panel.destroy();
}

// ---------------------------------------------------------------------------------------------
// Adenosine demonstrator
// ---------------------------------------------------------------------------------------------

const ADENOSINE: { id: string; preset: string; label: string; mech: string; result: string }[] = [
  { id: 'avnrt', preset: 'avnrt', label: 'AVNRT', mech: 'Rhythm mechanism: re-entry WITHIN the AV node (slow and fast pathways).', result: 'Adenosine’s site of action (AV-nodal A1 receptors) is part of the circuit → transient nodal block → the loop cannot complete → termination, usually followed by sinus rhythm after a brief pause.' },
  { id: 'avrt', preset: 'orthoAvrt', label: 'Orthodromic AVRT', mech: 'Rhythm mechanism: macro-re-entry through AV node (antegrade) and accessory pathway (retrograde).', result: 'The AV node is one limb of the circuit → blocking it interrupts re-entry → termination. The pathway itself is not the target (usually adenosine-insensitive).' },
  { id: 'sinus', preset: 'sinusTach', label: 'Sinus tachycardia', mech: 'Rhythm mechanism: accelerated sinus-node automaticity (driven by catecholamines).', result: 'Adenosine blocks AV-nodal conduction for a few seconds, so some P waves are not conducted, and briefly slows the sinus node — but the underlying sinus drive persists and the tachycardia resumes.' },
  { id: 'af', preset: 'afRvr', label: 'Atrial fibrillation', mech: 'Rhythm mechanism: chaotic atrial wavelets; the AV node only filters them.', result: 'Transient AV block slows the ventricular response and reveals the fibrillatory baseline; the atrial mechanism is untouched, so AF continues.' },
  { id: 'flutter', preset: 'flutter21', label: 'Atrial flutter', mech: 'Rhythm mechanism: macro-re-entry in the right atrium; the AV node is a bystander filter.', result: 'Higher-grade AV block unmasks the sawtooth flutter waves (a diagnostic effect); the flutter circuit continues.' },
  { id: 'avb', preset: 'mobitz1', label: 'Second-degree AV block', mech: 'Rhythm mechanism: impaired AV conduction.', result: 'Further AV-nodal suppression does not correct the conduction disease — it transiently worsens the block (more dropped beats).' },
  { id: 'chb', preset: 'chbVentricular', label: 'Complete heart block', mech: 'Rhythm mechanism: no atrioventricular conduction; ventricles driven by an independent escape pacemaker.', result: 'The ventricles are already electrically dissociated from the atria, so AV-nodal blockade cannot restore AV conduction; P waves may briefly slow (sinus effect) while the escape rhythm continues.' },
  { id: 'vt', preset: 'monoVT', label: 'Ventricular tachycardia (scar)', mech: 'Rhythm mechanism: re-entry within ventricular scar — outside the AV node.', result: 'No effect on the tachycardia (the circuit does not include the AV node). The exception is idiopathic outflow-tract VT from cAMP-mediated triggered activity, which may terminate.' },
  { id: 'rvot', preset: 'rvotVT', label: 'Idiopathic RVOT VT', mech: 'Rhythm mechanism: cAMP-mediated triggered activity in RV outflow-tract myocytes.', result: 'Adenosine lowers cAMP (A1/Gi) → the triggered activity stops → termination. A reminder that "terminates with adenosine" does not prove SVT.' },
  { id: 'preexaf', preset: 'preexAf', label: 'Pre-excited AF (danger)', mech: 'Rhythm mechanism: AF conducted over an accessory pathway as well as the AV node.', result: 'Blocking the AV node leaves the pathway as the only route and removes concealed retrograde invasion of it → rates can rise and QRS become wider. AV-nodal blockers are potentially harmful here.' },
];

function adenosineDemo(root: HTMLElement): () => void {
  root.append(header('N · Physiology Sandbox', 'Adenosine physiology demonstrator', 'Adenosine acts on A1 receptors (IK,Ado) — mainly the AV node (and sinus node) — for a few seconds. What happens depends on whether the AV node is PART of the rhythm’s mechanism or merely a filter downstream of it.'));
  let cur = ADENOSINE[0];
  let given = false;
  const panel = new EcgPanel({ heart: true, duration: 12000, layout: 'strips', leads: ['II', 'V1'], showLadder: true, showLabels: true });
  const mech = h('div', { class: 'callout' });
  const res = h('div', { class: 'callout warn' });
  const run = (): void => {
    const pp = presetPhysio(cur.preset);
    if (given) pp.rhythm.interventions = [{ t: 4000, kind: 'adenosine' }];
    panel.stop();
    panel.show(pp);
    mech.replaceChildren(p(`**${cur.mech}**`), p('**Drug site of action:** AV node (A1 receptors → K⁺ channel opening → hyperpolarisation → transient block) and sinus node (transient slowing); little effect on His–Purkinje tissue, accessory pathways or ventricular myocardium.'));
    res.replaceChildren(given ? p(`**Result:** ${cur.result}`) : p('Press **Give adenosine** (delivered at t = 4 s; time course compressed).'));
  };
  root.append(
    h(
      'section',
      { class: 'card' },
      segmented(ADENOSINE.map((a) => [a.id, a.label] as [string, string]), cur.id, (v) => {
        cur = ADENOSINE.find((a) => a.id === v)!;
        given = false;
        run();
      }, 'Rhythm'),
      h('div', { class: 'btn-row' }, button('💉 Give adenosine', () => ((given = true), run()), 'btn-primary'), button('Reset', () => ((given = false), run()))),
      mech,
      res,
      panel.el,
    ),
    h('section', { class: 'card' }, h('h2', null, 'Principle'), whyList([{ level: 'cell', text: 'A1-receptor activation opens IK,Ado (same channel as IK,ACh) and reduces cAMP → AV-nodal cells hyperpolarise and conduction fails for seconds.' }, { level: 'conduction', text: 'If the AV node is inside the circuit (AVNRT, AVRT) → termination. If it is downstream of the mechanism (sinus tachycardia, most atrial tachycardias, flutter, AF) → transient AV block that reveals atrial activity (a minority of focal ATs, being cAMP-mediated, terminate). If the problem is below the node or already dissociated (infranodal block, CHB, VT) → no benefit.' }, { level: 'treatment', text: '2025 AHA: adenosine for regular narrow-complex tachycardia; in wide-complex tachycardia only if regular and monomorphic; not for irregular wide-complex tachycardia (e.g. pre-excited AF).' }])),
    refList(['svt2015', 'acls2025']),
  );
  run();
  return () => panel.destroy();
}

// ---------------------------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------------------------

function compare(root: HTMLElement): () => void {
  root.append(header('N · Physiology Sandbox', 'ECG comparison mode', 'Normal vs abnormal, or disease A vs disease B — each difference explained by mechanism.'));
  const a = new EcgPanel({ duration: 8000, compact: true });
  const b = new EcgPanel({ duration: 8000, compact: true });
  const tbl = h('div', { class: 'table-scroll' });
  const ta = h('h3');
  const tb = h('h3');
  const show = (id: string): void => {
    const c = COMPARISONS.find((x) => x.id === id)!;
    ta.textContent = presetLabel(c.a);
    tb.textContent = presetLabel(c.b);
    a.view.setOptions({ highlight: c.leads });
    b.view.setOptions({ highlight: c.leads });
    a.show(presetPhysio(c.a));
    b.show(presetPhysio(c.b));
    tbl.replaceChildren(h('table', { class: 't' }, h('thead', null, h('tr', null, h('th', null, 'Feature'), h('th', null, presetLabel(c.a)), h('th', null, presetLabel(c.b)), h('th', null, 'Mechanistic reason'))), h('tbody', null, ...c.points.map((pt) => h('tr', null, h('th', null, pt.feature), h('td', null, pt.a), h('td', null, pt.b), h('td', null, pt.why))))));
  };
  root.append(h('section', { class: 'card' }, select({ label: 'Comparison', value: COMPARISONS[0].id, options: COMPARISONS.map((c) => [c.id, c.title] as [string, string]), onChange: show }), tbl, h('div', { class: 'grid-2' }, h('div', null, ta, a.el), h('div', null, tb, b.el))));
  show(COMPARISONS[0].id);
  return () => {
    a.destroy();
    b.destroy();
  };
}

// ---------------------------------------------------------------------------------------------
// Axis lab
// ---------------------------------------------------------------------------------------------

function axisLab(root: HTMLElement): () => void {
  root.append(header('N · Physiology Sandbox', 'Axis lab', 'Part 1: drag an idealised vector through 360°. Part 2: rotate the ventricular forces of a simulated heart and read the axis from real limb leads. Part 3: produce axis shifts by physiology.'));
  const ex = new VectorExplorer(frontal(60), { horizontal: false, leads: ['I', 'II', 'III', 'aVR', 'aVL', 'aVF'] });
  root.append(h('section', { class: 'card' }, h('h2', null, '1. Idealised vector'), ex.el, ul(['**Normal**: −30° to +90° (I and II positive).', '**Left axis deviation**: −30° to −90° (I positive, II negative).', '**Right axis deviation**: +90° to +180° (I negative, aVF positive).', '**Extreme / northwest**: −90° to ±180° (I and aVF negative) — think VT, hyperkalaemia, lead reversal.', 'Quick method: find the most isoelectric limb lead — the axis is perpendicular to it.'])));
  const phys = presetPhysio('nsr', { noise: 0.05 });
  const panel = new EcgPanel({ duration: 5000, layout: 'strips', leads: ['I', 'II', 'III', 'aVR', 'aVL', 'aVF'], rowMm: 18, layoutToggle: false });
  const out = h('div', { class: 'callout' });
  const rerun = debounce(() => {
    const r = panel.show(phys);
    out.replaceChildren(p(`Model axis: **${r.m.axis}°** — ${r.m.axisLabel}.`));
  }, 60);
  root.append(
    h(
      'section',
      { class: 'card' },
      h('h2', null, '2. Rotate the simulated heart'),
      slider({ label: 'Rotate ventricular forces', min: -180, max: 180, step: 5, value: 0, unit: '°', onInput: (v) => ((phys.axisShift = v), rerun()) }),
      h('h3', null, '3. Or change the physiology'),
      h(
        'div',
        { class: 'btn-row' },
        ...(
          [
            ['Normal', {}],
            ['LAFB', { bundle: 'lafb' }],
            ['LPFB', { bundle: 'lpfb' }],
            ['RVH', { rvMass: 3 }],
            ['LVH', { lvMass: 1.9 }],
            ['Inferior MI (old)', { ischemia: { territory: 'inferior', stage: 'old', extent: 1 } }],
            ['RV apical pacing', { rhythm: { nodalBlock: 'complete', junctionalEnabled: false, pacer: { mode: 'VVI', lowerRate: 70 } } }],
            ['Vertical heart (COPD)', { anatomicalAxis: 30, habitus: 0.7 }],
          ] as [string, PhysioPatch][]
        ).map(([t, pt]) =>
          button(t, () => {
            Object.assign(phys, presetPhysio('nsr', { noise: 0.05, ...pt }));
            rerun();
          }),
        ),
      ),
      out,
      panel.el,
    ),
  );
  rerun();
  return () => panel.destroy();
}

// ---------------------------------------------------------------------------------------------
// P / QRS / ST labs
// ---------------------------------------------------------------------------------------------

function labShell(root: HTMLElement, title: string, intro: string, initial: Physio, controls: (p: Physio, rerun: () => void) => HTMLElement, leads: ('I' | 'II' | 'III' | 'aVR' | 'aVL' | 'aVF' | 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6')[], explain: (p: Physio, m: Measurements) => string): () => void {
  root.append(header('N · Physiology Sandbox', title, intro));
  const phys = initial;
  const panel = new EcgPanel({ duration: 6000, layout: 'strips', leads, rowMm: 22 });
  const out = h('div', { class: 'callout' });
  const rerun = debounce(() => {
    const r = panel.show(phys);
    out.replaceChildren(p(explain(phys, r.m)));
  }, 60);
  root.append(h('div', { class: 'sim-layout' }, h('aside', { class: 'card sim-controls' }, controls(phys, rerun)), h('div', null, out, panel.el)));
  rerun();
  return () => panel.destroy();
}

function pLab(root: HTMLElement): () => void {
  return labShell(
    root,
    'P-wave lab',
    'The P wave is the sum of right-atrial (early, anterior-inferior) and left-atrial (late, leftward-posterior) activation. Change mass, conduction and origin.',
    presetPhysio('nsr', { noise: 0.03, rhythm: { sinusRate: 60 } }),
    (pp, rerun) =>
      h(
        'div',
        null,
        slider({ label: 'Right atrial mass/size', min: 0.8, max: 2.5, step: 0.05, value: pp.raSize, unit: '×', onInput: (v) => ((pp.raSize = v), rerun()) }),
        slider({ label: 'Left atrial mass/size', min: 0.8, max: 2.5, step: 0.05, value: pp.laSize, unit: '×', onInput: (v) => ((pp.laSize = v), rerun()) }),
        slider({ label: 'Atrial conduction velocity', min: 0.5, max: 1.5, step: 0.05, value: pp.atrialCV, unit: '×', onInput: (v) => ((pp.atrialCV = v), rerun()) }),
        slider({ label: 'Interatrial (Bachmann) delay', min: 0, max: 80, step: 1, value: pp.interatrialDelay, unit: 'ms', onInput: (v) => ((pp.interatrialDelay = v), rerun()) }),
        select<AtrialSite | 'mat' | 'flutter' | 'af'>({
          label: 'Atrial origin / mechanism',
          value: 'sinus',
          options: [
            ['sinus', 'Sinus node'],
            ['lowRA', 'Low right atrium (ectopic)'],
            ['leftAtrial', 'Left atrium (ectopic)'],
            ['lowLA', 'Low left atrium'],
            ['crista', 'Crista terminalis'],
            ['mat', 'Multifocal (MAT)'],
            ['flutter', 'Flutter circuit'],
            ['af', 'Fibrillation'],
          ],
          onChange: (v) => {
            const R = pp.rhythm;
            R.atrialMechanism = 'sinus';
            if (v === 'mat') R.atrialMechanism = 'mat';
            else if (v === 'flutter') {
              R.atrialMechanism = 'flutter';
              R.avnERP = 640;
              R.avnDecrement = 40;
              R.concealed = false;
            } else if (v === 'af') R.atrialMechanism = 'fibrillation';
            else if (v !== 'sinus') {
              R.atrialMechanism = 'focalAT';
              R.focalATRate = 75;
              R.focalATSite = v as AtrialSite;
            }
            rerun();
          },
        }),
      ),
    ['II', 'V1', 'I'],
    (pp) => {
      const out: string[] = [];
      if (pp.raSize > 1.4) out.push('Larger RA → taller early component → peaked P in II (P pulmonale), prominent initial positive P in V1.');
      if (pp.laSize > 1.4 || pp.interatrialDelay > 25) out.push('Larger/later LA → broad notched P in II and deep terminal negative P in V1 (the LA lies posteriorly, away from V1).');
      if (pp.atrialCV < 0.85) out.push('Slower atrial conduction → longer P duration.');
      if (pp.rhythm.atrialMechanism === 'focalAT') out.push('Ectopic origin → a different activation sequence → different P axis (e.g. low atrial focus → inverted P in II).');
      if (pp.rhythm.atrialMechanism === 'mat') out.push('Multiple foci → multiple P shapes and variable PR.');
      if (pp.rhythm.atrialMechanism === 'flutter') out.push('Macro-re-entry → continuous sawtooth atrial activity.');
      if (pp.rhythm.atrialMechanism === 'fibrillation') out.push('Fibrillation → no coherent atrial vector → no P wave.');
      return out.join(' ') || 'Normal sinus P: RA then LA activation, mean vector ≈ +50°.';
    },
  );
}

function qrsLab(root: HTMLElement): () => void {
  return labShell(
    root,
    'QRS lab',
    'The QRS is the projection of the ventricular activation sequence. Change mass, sequence, velocity, scar, pathway or origin.',
    presetPhysio('nsr', { noise: 0.03 }),
    (pp, rerun) =>
      h(
        'div',
        null,
        slider({ label: 'LV mass', min: 0.7, max: 2.4, step: 0.05, value: pp.lvMass, unit: '×', onInput: (v) => ((pp.lvMass = v), rerun()) }),
        slider({ label: 'RV mass', min: 0.7, max: 3.5, step: 0.05, value: pp.rvMass, unit: '×', onInput: (v) => ((pp.rvMass = v), rerun()) }),
        slider({ label: 'Myocardial conduction velocity', min: 0.4, max: 1.5, step: 0.05, value: pp.ventricularCV, unit: '×', onInput: (v) => ((pp.ventricularCV = v), rerun()) }),
        slider({ label: 'Axis rotation', min: -90, max: 90, step: 5, value: pp.axisShift, unit: '°', onInput: (v) => ((pp.axisShift = v), rerun()) }),
        select({ label: 'Activation sequence (bundles)', value: pp.bundle, options: [['normal', 'normal'], ['rbbb', 'RBBB'], ['lbbb', 'LBBB'], ['lafb', 'LAFB'], ['lpfb', 'LPFB'], ['rbbb+lafb', 'RBBB + LAFB'], ['ivcd', 'IVCD']], onChange: (v) => ((pp.bundle = v), rerun()) }),
        select<Territory | 'none'>({ label: 'Infarcted myocardium (old)', value: 'none', options: [['none', 'none'], ...(['anterior', 'inferior', 'lateral', 'posterior', 'anteroseptal'] as Territory[]).map((t) => [t, TERRITORY[t].label] as [Territory, string])], onChange: (v) => ((pp.ischemia = v === 'none' ? { territory: 'anterior', stage: 'none', extent: 0.8 } : { territory: v, stage: 'old', extent: 0.9 }), rerun()) }),
        toggle('Accessory pathway', pp.rhythm.ap.present, (v) => ((pp.rhythm.ap.present = v), rerun())),
        select({ label: 'Pathway location', value: pp.rhythm.ap.location, options: Object.entries(AP_SITE).map(([k, v]) => [k, v.label]) as [string, string][], onChange: (v) => ((pp.rhythm.ap.location = v as typeof pp.rhythm.ap.location), rerun()) }),
        select<VentSite | 'none'>({ label: 'Ventricular ectopic focus (bigeminy)', value: 'none', options: [['none', 'none'], ...Object.entries(VENT_SITE).map(([k, v]) => [k, v.label] as [VentSite, string])], onChange: (v) => ((pp.rhythm.pvc = { ...pp.rhythm.pvc, pattern: v === 'none' ? 'none' : 'bigeminy', site: v === 'none' ? 'rvot' : v }), rerun()) }),
        select<VentSite | 'none'>({ label: 'Ventricular rhythm (focus drives heart)', value: 'none', options: [['none', 'none'], ...Object.entries(VENT_SITE).map(([k, v]) => [k, v.label] as [VentSite, string])], onChange: (v) => ((pp.rhythm.ventMechanism = v === 'none' ? 'none' : 'aivr'), (pp.rhythm.vtRate = 85), v !== 'none' && (pp.rhythm.vtSite = v), rerun()) }),
      ),
    ['I', 'aVF', 'V1', 'V6'],
    (pp, m) => `QRS ${m.qrs} ms, axis ${m.axis ?? '—'}° (${m.axisLabel}). ${pp.lvMass > 1.4 ? 'LV mass ↑ → larger leftward-posterior vector (tall R V6, deep S V1). ' : ''}${pp.rvMass > 1.8 ? 'RV mass ↑ → rightward-anterior forces (R in V1, right axis). ' : ''}${pp.bundle !== 'normal' ? 'Altered activation sequence → re-directed and delayed forces. ' : ''}${pp.ventricularCV < 0.85 ? 'Slower conduction stretches every component → wider QRS. ' : ''}${pp.rhythm.ap.present ? 'Pathway pre-excites the ventricle near its insertion → delta wave. ' : ''}${pp.ischemia.stage === 'old' ? 'Scar removes forces → Q waves over the infarct. ' : ''}`,
  );
}

function stLab(root: HTMLElement): () => void {
  return labShell(
    root,
    'ST / T / QT lab',
    'The ST segment and T wave reflect the plateau and repolarisation. Change injury, ions, drugs, autonomic tone and hypertrophy — and read the QT/QTc.',
    presetPhysio('nsr', { noise: 0.03 }),
    (pp, rerun) =>
      h(
        'div',
        null,
        select({ label: 'Ischaemia / injury', value: 'none', options: [['none', 'none'], ['hyperacute', 'hyperacute (anterior)'], ['stemi', 'transmural injury (anterior)'], ['subendocardial', 'subendocardial (diffuse)'], ['wellens', 'Wellens'], ['evolving', 'evolving (anterior)']], onChange: (v) => ((pp.ischemia = { territory: v === 'subendocardial' ? 'diffuseSubendo' : 'anterior', stage: v as never, extent: 0.9 }), rerun()) }),
        slider({ label: 'Repolarisation (IKr block)', min: 0, max: 1, step: 0.05, value: 0, onInput: (v) => ((pp.drugs.qtDrug = v), rerun()) }),
        slider({ label: 'Intrinsic QTc', min: 280, max: 600, step: 5, value: pp.qtcBase, unit: 'ms', onInput: (v) => ((pp.qtcBase = v), rerun()) }),
        slider({ label: 'Potassium', min: 2, max: 9, step: 0.1, value: pp.K, unit: 'mmol/L', onInput: (v) => ((pp.K = v), rerun()) }),
        slider({ label: 'Calcium', min: 1.4, max: 3.8, step: 0.05, value: pp.Ca, unit: 'mmol/L', onInput: (v) => ((pp.Ca = v), rerun()) }),
        slider({ label: 'Autonomic tone', min: -1, max: 1, step: 0.05, value: 0, onInput: (v) => ((pp.autonomic = v), rerun()) }),
        slider({ label: 'Digoxin', min: 0, max: 1.3, step: 0.05, value: 0, onInput: (v) => ((pp.drugs.digoxin = v), rerun()) }),
        slider({ label: 'LV mass (strain)', min: 1, max: 2.4, step: 0.05, value: 1, onInput: (v) => ((pp.lvMass = v), rerun()) }),
        slider({ label: 'Pericarditis stage', min: 0, max: 4, step: 1, value: 0, onInput: (v) => ((pp.pericarditis = v), rerun()) }),
        slider({ label: 'Early repolarisation', min: 0, max: 1, step: 0.05, value: 0, onInput: (v) => ((pp.earlyRepol = v), rerun()) }),
        select({ label: 'Brugada', value: '0', options: [['0', 'none'], ['1', 'type 1'], ['2', 'type 2']], onChange: (v) => ((pp.brugada = Number(v) as 0 | 1 | 2), rerun()) }),
      ),
    ['II', 'V1', 'V2', 'V5'],
    (pp, m) => `QT ${m.qt} ms, QTc ${m.qtcBazett} (Bazett) / ${m.qtcFridericia} (Fridericia) at ${m.ventRate}/min. ${pp.K > 5.5 ? 'High K⁺ → fast synchronous repolarisation (peaked T). ' : pp.K < 3.5 ? 'Low K⁺ → slow repolarisation (flat T, U wave). ' : ''}${pp.Ca < 2.15 ? 'Low Ca²⁺ → long plateau (long ST). ' : pp.Ca > 2.6 ? 'High Ca²⁺ → short plateau (short ST). ' : ''}${pp.drugs.qtDrug > 0 ? 'IKr block → slow phase 3 (long, broad T). ' : ''}${pp.ischemia.stage !== 'none' ? 'Injury current shifts the ST vector toward the injured surface (or toward the cavity for subendocardial injury). ' : ''}${pp.drugs.digoxin > 0 ? 'Digoxin: short APD, sagging ST. ' : ''}${pp.lvMass > 1.45 ? 'Hypertrophy: lateral strain. ' : ''}`,
  );
}

// ---------------------------------------------------------------------------------------------
// Pacemaker hierarchy
// ---------------------------------------------------------------------------------------------

function hierarchy(root: HTMLElement): () => void {
  root.append(header('N · Physiology Sandbox', 'Pacemaker hierarchy & escape rhythms', 'SA node → atrial tissue → AV junction (node–His) → ventricular Purkinje fibres: each level is slower. The fastest pacemaker that reaches the ventricles resets (overdrive-suppresses) the slower ones. Disable higher pacemakers and watch the next level escape.'));
  const st = { sa: true, atrial: false, junction: true, vent: true, block: 'none' as 'none' | 'nodal' | 'infra', saRate: 72, atrialRate: 55, jRate: 45, vRate: 32, site: 'lvApex' as VentSite };
  const panel = new EcgPanel({ heart: true, duration: 12000, layout: 'strips', leads: ['II', 'V1'], showLadder: true, showLabels: true });
  const out = h('div', { class: 'callout' });
  const rerun = debounce(() => {
    const pp = presetPhysio('nsr', { noise: 0.05 });
    const R = pp.rhythm;
    R.sinusEnabled = st.sa;
    R.sinusRate = st.saRate;
    if (st.atrial) {
      R.atrialMechanism = st.sa && st.saRate > st.atrialRate ? 'sinus' : 'focalAT';
      R.focalATRate = st.atrialRate;
      R.focalATSite = 'lowRA';
    }
    R.junctionalEnabled = st.junction;
    R.junctionalRate = st.jRate;
    R.ventEscapeEnabled = st.vent;
    R.ventEscapeRate = st.vRate;
    R.ventEscapeSite = st.site;
    if (st.block === 'nodal') R.nodalBlock = 'complete';
    if (st.block === 'infra') R.infranodal = 'complete';
    panel.stop();
    const r = panel.show(pp);
    const dom = r.m.dominant;
    const who = dom === 'conducted' ? (st.atrial && (!st.sa || st.saRate < st.atrialRate) ? 'an ectopic atrial focus' : 'the sinus node') : dom === 'junction' ? 'the AV junction' : dom === 'escape' ? 'a ventricular escape focus' : 'nothing (asystole)';
    out.replaceChildren(p(`**Driving the ventricles:** ${who}${r.m.ventRate ? ` at ${r.m.ventRate}/min, QRS ${r.m.qrs} ms` : ''}.`), p(dom === 'junction' ? 'Junctional escape uses the His–Purkinje system → narrow QRS; retrograde P waves appear if the node conducts backwards.' : dom === 'escape' ? 'Ventricular escape spreads cell-to-cell → wide QRS; the morphology depends on the focus location (change it below).' : dom === 'conducted' ? 'Every lower pacemaker is depolarised and reset before it reaches threshold, and overdrive suppression further depresses its automaticity.' : 'No pacemaker below the failure — this is why ventricular standstill is lethal and pacing is needed.'));
  }, 80);
  root.append(
    h(
      'section',
      { class: 'card' },
      h(
        'div',
        { class: 'grid' },
        toggle('SA node', st.sa, (v) => ((st.sa = v), rerun())),
        slider({ label: 'SA rate', min: 20, max: 120, step: 1, value: st.saRate, unit: '/min', onInput: (v) => ((st.saRate = v), rerun()) }),
        toggle('Ectopic atrial pacemaker', st.atrial, (v) => ((st.atrial = v), rerun())),
        slider({ label: 'Atrial focus rate', min: 30, max: 90, step: 1, value: st.atrialRate, unit: '/min', onInput: (v) => ((st.atrialRate = v), rerun()) }),
        toggle('AV junction pacemaker', st.junction, (v) => ((st.junction = v), rerun())),
        slider({ label: 'Junctional rate', min: 25, max: 70, step: 1, value: st.jRate, unit: '/min', onInput: (v) => ((st.jRate = v), rerun()) }),
        toggle('Ventricular pacemaker', st.vent, (v) => ((st.vent = v), rerun())),
        slider({ label: 'Ventricular rate', min: 15, max: 45, step: 1, value: st.vRate, unit: '/min', onInput: (v) => ((st.vRate = v), rerun()) }),
        select<VentSite>({ label: 'Ventricular focus location', value: st.site, options: Object.entries(VENT_SITE).map(([k, v]) => [k as VentSite, v.label]), onChange: (v) => ((st.site = v), rerun()) }),
        segmented<'none' | 'nodal' | 'infra'>([['none', 'No block'], ['nodal', 'Block in AV node'], ['infra', 'Block below His']], st.block, (v) => ((st.block = v), rerun()), 'AV conduction'),
      ),
      out,
      panel.el,
    ),
    h('section', { class: 'card' }, h('h2', null, 'Why escapes differ'), whyList([{ level: 'cell', text: 'Phase-4 slope falls down the conduction system: SA 60–100, junction 40–60, ventricle 20–40/min.' }, { level: 'conduction', text: 'Junctional escape enters the His bundle → both bundles → Purkinje → synchronous activation → narrow QRS.' }, { level: 'conduction', text: 'Ventricular escape starts in the distal Purkinje network below the block → spreads largely cell-to-cell through myocardium → wide QRS whose vector points away from the focus.' }, { level: 'clinical', text: 'The lower the escape, the slower and less reliable it is — hence the urgency of pacing in infranodal block.' }])),
    refList(['brady2018', 'ionChannels2009']),
  );
  rerun();
  return () => panel.destroy();
}
