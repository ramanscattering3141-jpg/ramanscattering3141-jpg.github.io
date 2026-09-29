import { h, p, ul, debounce } from '../ui/dom';
import { dxTile, header, presetPhysio, refList, whyList } from '../ui/common';
import { EcgPanel } from '../ui/panel';
import { ActivationStepper } from '../ui/activation';
import { button, segmented, slider } from '../ui/controls';
import { dxByCategory, resolveDx } from '../content/index';
import { CATEGORY_LABEL } from '../content/types';
import { managementBlock } from './library';
import type { Bundle, Physio } from '../engine/params';

export function renderConduction(root: HTMLElement, parts: string[]): (() => void) | void {
  if (parts[0] === 'av') return avLab(root);
  if (parts[0] === 'bbb') return bbbLab(root);
  root.append(header('E · Conduction Disorders', 'When conduction slows, blocks or reroutes', 'Two questions explain every conduction disorder: WHERE is the problem (AV node, His–Purkinje, a bundle, a fascicle) and HOW does activation reroute around it?'));
  root.append(
    h(
      'div',
      { class: 'grid' },
      h('a', { class: 'tile', href: '#/conduction/av' }, h('h3', null, 'AV block lab'), h('p', null, '1°, Mobitz I, Mobitz II, 2:1, high-grade, complete — choose the level of block and the escape pacemaker.')),
      h('a', { class: 'tile', href: '#/conduction/bbb' }, h('h3', null, 'Bundle-branch & fascicular block lab'), h('p', null, 'Normal activation → blocked pathway → rerouting → vector → leads, step by step.')),
      h('a', { class: 'tile', href: '#/sandbox/hierarchy' }, h('h3', null, 'Pacemaker hierarchy'), h('p', null, 'Why junctional escapes are narrow and ventricular escapes wide.')),
    ),
  );
  for (const cat of ['avblock', 'ivcd', 'pacing'] as const) root.append(h('h2', null, CATEGORY_LABEL[cat]), h('div', { class: 'grid' }, ...dxByCategory([cat]).map(dxTile)));
}

type Block = 'none' | 'avb1' | 'mobitz1' | 'mobitz2' | 'avb21' | 'highGrade' | 'chb';

function avLab(root: HTMLElement): () => void {
  root.append(header('E · Conduction Disorders', 'AV block lab', 'Choose a block, then choose WHERE it is. The ladder diagram shows each P wave’s fate in the AV row.'));
  let block: Block = 'mobitz1';
  let level: 'nodal' | 'infranodal' = 'nodal';
  let rate = 78;
  let atropine = false;
  const panel = new EcgPanel({ heart: true, layout: 'strips', leads: ['II', 'V1'], showLadder: true, showLabels: true, duration: 12000 });
  const explain = h('div', { class: 'callout' });
  const build = (): Physio => {
    const map: Record<Block, string> = { none: 'nsr', avb1: 'avb1', mobitz1: 'mobitz1', mobitz2: 'mobitz2', avb21: 'avb21', highGrade: 'highGrade', chb: level === 'nodal' ? 'chbJunctional' : 'chbVentricular' };
    const p0 = presetPhysio(map[block]);
    p0.rhythm.sinusRate = rate;
    if (atropine) p0.rhythm.interventions = [{ t: 0, kind: 'atropine' }];
    return p0;
  };
  const text = (): Record<Block, string> => ({
    none: 'Normal: each P conducts with a constant PR.',
    avb1: 'Every P conducts, slowly: PR > 200 ms. Usually nodal.',
    mobitz1: 'Progressive PR prolongation: each P arrives earlier in the node’s recovery (the previous PR was longer, so the RP interval shrank) until one finds the node refractory.',
    mobitz2: 'Constant PR, then a sudden dropped beat: all-or-none failure in diseased His–Purkinje tissue (note the bundle-branch block).',
    avb21: '2:1 — with only one conducted beat between drops you cannot see whether the PR would have prolonged. Try atropine: nodal 2:1 tends to improve; infranodal does not.',
    highGrade: 'Two or more consecutive P waves blocked, but conducted beats keep a fixed PR (so not complete block).',
    chb: level === 'nodal' ? 'Block in the AV node: the junction BELOW the block escapes at 40–60/min and uses the His–Purkinje system → NARROW QRS. P waves march through independently.' : 'Block below the His bundle: only a ventricular pacemaker can escape — slow (20–40/min) and WIDE (cell-to-cell activation). Atropine speeds the P waves but cannot help the ventricles.',
  });
  const rerun = debounce(() => {
    panel.stop();
    const run = panel.show(build());
    explain.replaceChildren(p(text()[block]), p(`Model: atrial rate ${run.m.atrialRate ?? '—'}/min, ventricular rate ${run.m.ventRate ?? '—'}/min, ${run.m.avRelation}.`, 'ref-meta'));
  }, 80);
  const levelSeg = h('div');
  const renderLevel = (): void => {
    levelSeg.replaceChildren(block === 'chb' ? segmented<'nodal' | 'infranodal'>([['nodal', 'Level: AV node → junctional escape'], ['infranodal', 'Level: infra-Hisian → ventricular escape']], level, (v) => ((level = v), rerun()), 'Where is the block?') : h('span'));
  };
  root.append(
    h(
      'section',
      { class: 'card' },
      segmented<Block>(
        [
          ['none', 'Normal'],
          ['avb1', '1°'],
          ['mobitz1', 'Mobitz I'],
          ['mobitz2', 'Mobitz II'],
          ['avb21', '2:1'],
          ['highGrade', 'High-grade'],
          ['chb', 'Complete'],
        ],
        block,
        (v) => {
          block = v;
          renderLevel();
          rerun();
        },
        'Block',
      ),
      levelSeg,
      slider({ label: 'Sinus rate', min: 40, max: 140, step: 1, value: rate, unit: '/min', help: 'Faster atrial rates stress the conduction system: nodal block worsens gradually, infranodal block worsens abruptly.', onInput: (v) => ((rate = v), rerun()) }),
      h('div', { class: 'btn-row' }, button('Toggle atropine', () => ((atropine = !atropine), rerun()), 'btn-primary')),
      explain,
      panel.el,
    ),
  );
  renderLevel();
  const d = resolveDx('chb');
  root.append(
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'Why the level of block matters'),
      whyList([
        { level: 'cell', text: 'AV-nodal cells: Ca²⁺-dependent, slow, decremental, richly vagally innervated → gradual (Wenckebach) block that atropine improves.' },
        { level: 'cell', text: 'His–Purkinje cells: Na⁺-dependent, fast, all-or-none, little vagal innervation → sudden (Mobitz II) block; atropine does not help and may worsen it by increasing the atrial rate.' },
        { level: 'conduction', text: 'The escape pacemaker must lie below the block: nodal block → junctional escape (narrow, 40–60); infranodal block → ventricular escape (wide, 20–40, unreliable).' },
        { level: 'clinical', text: 'Hence Mobitz II, high-grade and complete block not due to reversible causes are pacing indications even without symptoms.' },
      ]),
    ),
  );
  if (d?.management) root.append(h('section', { class: 'card' }, h('h2', null, 'Management'), managementBlock(d.management)));
  root.append(refList(['brady2018', 'acls2025', 'pacing2023']));
  rerun();
  return () => panel.destroy();
}

const BBB_STEPS: Record<string, { normal: string; blocked: string; reroute: string; vector: string; wide: string; leads: string; clinical: string }> = {
  rbbb: { normal: 'Both bundles activate the septum (from the left) and both ventricles within ~80–100 ms.', blocked: 'Right bundle.', reroute: 'Septum and LV activate normally via the left bundle; the RV is reached late by slow transseptal muscle conduction.', vector: 'Normal initial and middle forces, then a late unopposed rightward/anterior vector.', wide: 'The late RV activation adds ~40+ ms of slow myocardial conduction.', leads: 'V1 faces the late vector → R′; I/V6 face away → wide S. T waves discordant in V1–V3.', clinical: 'Often benign alone; consider PE, RV strain, ischaemia when new.' },
  lbbb: { normal: 'Septum activated left→right (septal q in I/V6, r in V1).', blocked: 'Left bundle (main trunk).', reroute: 'Septum activated right→left from the right bundle; the LV is activated slowly through myocardium from septum to lateral wall.', vector: 'Leftward-posterior vector throughout, prolonged, often notched (two walls).', wide: 'The whole LV depends on slow muscle conduction → QRS 140–160 ms.', leads: 'I/aVL/V5–V6: broad notched R without q; V1–V3: QS/rS. Discordant ST–T everywhere.', clinical: 'Usually structural heart disease; dyssynchrony; complicates MI diagnosis (Sgarbossa).' },
  lafb: { normal: 'Both fascicles start LV activation simultaneously (inferior-posterior and superior-anterior).', blocked: 'Left anterior fascicle.', reroute: 'LV activated first via the posterior fascicle (inferior wall), then late spread to the anterosuperior wall.', vector: 'Initial inferior-rightward, then dominant superior-leftward forces.', wide: 'Only a small area activated late → QRS barely widens (< 120 ms).', leads: 'aVL/I qR; II/III/aVF rS; axis −45° to −90°.', clinical: 'Common; with RBBB → bifascicular block.' },
  lpfb: { normal: 'As above.', blocked: 'Left posterior fascicle.', reroute: 'LV activated first via the anterior fascicle, then late spread inferiorly/posteriorly.', vector: 'Initial superior-leftward, then dominant inferior-rightward.', wide: 'Minimal widening.', leads: 'I rS, III/aVF qR; axis ≈ +120°.', clinical: 'Rare alone; diagnosis of exclusion (RVH, PE, lateral MI).' },
  'rbbb+lafb': { normal: 'Three fascicles (RB, LAF, LPF).', blocked: 'Right bundle + left anterior fascicle.', reroute: 'Everything depends on the left posterior fascicle.', vector: 'LAFB superior-leftward forces + RBBB late rightward-anterior forces.', wide: 'RBBB widening.', leads: 'rSR′ V1, wide S in I/V6, left axis.', clinical: 'Syncope → evaluate for intermittent complete block.' },
  ivcd: { normal: 'Normal activation.', blocked: 'No single pathway — diffuse slowing.', reroute: 'Same sequence, slower everywhere.', vector: 'Normal direction, stretched in time.', wide: 'Global conduction slowing (fibrosis, hyperkalaemia, Na⁺-channel block).', leads: 'Wide but non-specific morphology.', clinical: 'Check K⁺ and drugs when acute.' },
};

function bbbLab(root: HTMLElement): () => void {
  root.append(header('E · Conduction Disorders', 'Bundle-branch & fascicular block lab', 'For each block: normal activation → what is blocked → how activation reroutes → how the vector changes → why the QRS widens → why particular leads turn positive or negative → clinical significance.'));
  let bundle: Bundle = 'rbbb';
  const panel = new EcgPanel({ heart: true, duration: 6000 });
  const stepper = new ActivationStepper({ kind: 'bundle', bundle });
  const steps = h('div');
  const render = (): void => {
    panel.stop();
    const pp = presetPhysio('nsr');
    pp.bundle = bundle;
    panel.show(pp);
    stepper.setMode({ kind: 'bundle', bundle });
    const s = BBB_STEPS[bundle] ?? BBB_STEPS.ivcd;
    steps.replaceChildren(
      whyList([
        { level: 'conduction', text: `1. Normal activation — ${s.normal}` },
        { level: 'conduction', text: `2. Blocked pathway — ${s.blocked}` },
        { level: 'conduction', text: `3. Rerouting — ${s.reroute}` },
        { level: 'vector', text: `4. Vector change — ${s.vector}` },
        { level: 'waveform', text: `5. Why the QRS widens — ${s.wide}` },
        { level: 'lead', text: `6. Why particular leads change polarity — ${s.leads}` },
        { level: 'clinical', text: `7. Clinical significance — ${s.clinical}` },
      ]),
    );
  };
  root.append(
    h(
      'section',
      { class: 'card' },
      segmented<Bundle>(
        [
          ['rbbb', 'RBBB'],
          ['lbbb', 'LBBB'],
          ['lafb', 'LAFB'],
          ['lpfb', 'LPFB'],
          ['rbbb+lafb', 'RBBB + LAFB'],
          ['ivcd', 'Nonspecific IVCD'],
        ],
        bundle,
        (v) => ((bundle = v), render()),
        'Block',
      ),
      steps,
      panel.el,
    ),
    h('section', { class: 'card' }, h('h2', null, 'Step through the activation'), p('Drag the time slider: watch the late (rerouted) component appear and write the terminal part of the QRS.'), stepper.el),
    h('section', { class: 'card' }, h('h2', null, 'Criteria (AHA/ACCF/HRS 2009)'), ul(['**RBBB**: QRS ≥ 120 ms; rsr′/rsR′/rSR′ in V1–V2; S wave in I and V6 longer than R or > 40 ms; R-peak time in V1 > 50 ms.', '**LBBB**: QRS ≥ 120 ms; broad notched/slurred R in I, aVL, V5–V6; absent q in I, V5–V6; R-peak time > 60 ms in V5–V6; ST–T usually opposite to QRS.', '**LAFB**: axis −45° to −90°; qR in aVL with R-peak time ≥ 45 ms; rS in II, III, aVF; QRS < 120 ms.', '**LPFB**: axis +90° to +180°; rS in I and aVL; qR in III and aVF; QRS < 120 ms; exclude other causes of RAD.', '**Nonspecific IVCD**: QRS > 110 ms without RBBB/LBBB criteria.'])),
    refList(['ecgStd3', 'durrer1970']),
  );
  render();
  return () => panel.destroy();
}
