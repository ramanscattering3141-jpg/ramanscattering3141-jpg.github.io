import { h, p, s, debounce } from '../ui/dom';
import { dxTile, header, presetPhysio, refList, whyList } from '../ui/common';
import { EcgView } from '../ui/ecgView';
import { segmented, slider } from '../ui/controls';
import { runEcg, TWELVE, type LeadId } from '../engine';
import { TERRITORY } from '../engine/morphology';
import type { IschemiaStage, Territory } from '../engine/params';
import { dxByCategory } from '../content/index';

const ARTERIES: [Territory, string][] = [
  ['proxLAD', 'Proximal LAD'],
  ['anterior', 'Mid LAD'],
  ['anteroseptal', 'LAD septal'],
  ['wrapLAD', 'Wraparound LAD'],
  ['highLateral', 'Diagonal / OM (high lateral)'],
  ['lcx', 'Circumflex'],
  ['lateral', 'Lateral wall'],
  ['proxRCA', 'Proximal RCA'],
  ['inferior', 'Inferior (distal RCA/LCx)'],
  ['posterior', 'Posterior wall'],
  ['rv', 'Right ventricle'],
  ['diffuseSubendo', 'Diffuse subendocardial'],
];

const WALL_OF: Record<Territory, string[]> = {
  anteroseptal: ['septal', 'anterior'],
  anterior: ['anterior'],
  anterolateral: ['anterior', 'lateral'],
  highLateral: ['lateral'],
  lateral: ['lateral'],
  inferior: ['inferior'],
  posterior: ['posterior'],
  rv: ['rv'],
  proxLAD: ['septal', 'anterior', 'lateral'],
  wrapLAD: ['anterior', 'inferior'],
  proxRCA: ['inferior', 'rv', 'posterior'],
  lcx: ['lateral', 'posterior'],
  diffuseSubendo: ['septal', 'anterior', 'lateral', 'inferior', 'posterior'],
};

function wallDiagram(t: Territory, stage: IschemiaStage): SVGSVGElement {
  const hit = new Set(WALL_OF[t]);
  const col = stage === 'old' ? '#8d6e63' : stage === 'subendocardial' || stage === 'wellens' ? '#1e88e5' : '#e53935';
  const seg = (a0: number, a1: number, r0: number, r1: number): string => {
    const p1 = [Math.cos(a0) * r1, Math.sin(a0) * r1];
    const p2 = [Math.cos(a1) * r1, Math.sin(a1) * r1];
    const p3 = [Math.cos(a1) * r0, Math.sin(a1) * r0];
    const p4 = [Math.cos(a0) * r0, Math.sin(a0) * r0];
    return `M${p1} A${r1} ${r1} 0 0 1 ${p2} L${p3} A${r0} ${r0} 0 0 0 ${p4} Z`;
  };
  const d2r = (d: number): number => (d * Math.PI) / 180;
  const walls: [string, number, number][] = [
    ['anterior', -135, -45],
    ['lateral', -45, 30],
    ['posterior', 30, 90],
    ['inferior', 90, 150],
    ['septal', 150, 225],
  ];
  const svg = s('svg', { viewBox: '-125 -100 250 200', style: 'width:220px;max-width:100%', role: 'img', 'aria-label': 'Short-axis view of ventricular walls; affected walls highlighted' });
  const sub = stage === 'subendocardial';
  for (const [name, a0, a1] of walls) {
    const on = hit.has(name);
    svg.append(s('path', { d: seg(d2r(a0), d2r(a1), 42, 72), fill: on && !sub ? col : 'var(--panel-2)', stroke: 'var(--line)' }));
    if (on && sub) svg.append(s('path', { d: seg(d2r(a0), d2r(a1), 42, 52), fill: col }));
    const am = d2r((a0 + a1) / 2);
    svg.append(s('text', { x: Math.cos(am) * 86, y: Math.sin(am) * 86 + 4, class: 'vec-lab', 'font-size': 9, 'text-anchor': 'middle' }, name));
  }
  svg.append(s('path', { d: 'M-60 -55 Q-105 0 -60 55 Q-80 0 -60 -55Z', fill: hit.has('rv') ? col : 'var(--panel-2)', stroke: 'var(--line)' }), s('text', { x: -112, y: 4, class: 'vec-lab', 'font-size': 9 }, 'RV'));
  svg.append(s('text', { x: -18, y: 4, class: 'vec-lab', 'font-size': 9 }, 'LV cavity'));
  return svg;
}

export function renderIschemia(root: HTMLElement): () => void {
  root.append(header('G · Ischaemia & Infarction', 'Myocardial injury simulator', 'Select a culprit artery / territory and a stage. The model creates an injury current directed toward the injured epicardium (transmural) or toward the ventricular cavity (subendocardial), removes forces from infarcted myocardium, and projects everything onto the 12 leads.'));
  let terr: Territory = 'proxLAD';
  let stage: IschemiaStage = 'stemi';
  let extent = 0.9;
  const view = new EcgView({ layout: '12' });
  const EXTRA: LeadId[] = ['V4R', 'V7', 'V8', 'V9'];
  const ALL: LeadId[] = [...TWELVE, ...EXTRA];
  const right = new EcgView({ layout: 'strips', leads: EXTRA, rowMm: 16, showRhythm: false });
  const table = h('div', { class: 'table-scroll' });
  const explain = h('div', { class: 'callout' });
  const diagram = h('div');
  const rerun = debounce(() => {
    const pp = presetPhysio('nsr', { ischemia: { territory: terr, stage, extent }, noise: 0.05 });
    const run = runEcg(pp, 10000, ALL);
    // ST at J+60 for the beat in the middle of the strip
    const b = run.sig.beats[Math.floor(run.sig.beats.length / 2)];
    const idx = Math.round(b.ev.t + b.morph.qrsDur + 60 - run.sig.from);
    const baseIdx = Math.round(b.ev.t - 30 - run.sig.from);
    const st: Record<string, number> = {};
    for (const l of ALL) st[l] = (run.sig.leads[l]![idx] - run.sig.leads[l]![baseIdx]) * 10;
    const elevated = (TWELVE as LeadId[]).filter((l) => st[l] >= (l === 'V2' || l === 'V3' ? 2 : 1));
    const depressed = (TWELVE as LeadId[]).filter((l) => st[l] <= -0.5);
    view.setOptions({ highlight: elevated });
    view.setRun(run);
    right.setRun(run);
    diagram.replaceChildren(wallDiagram(terr, stage));
    table.replaceChildren(
      h('table', { class: 't' }, h('thead', null, h('tr', null, h('th', null, 'Lead'), ...ALL.map((l) => h('th', null, l)))), h('tbody', null, h('tr', null, h('td', null, 'ST (mm) at J+60'), ...ALL.map((l) => h('td', { style: st[l] >= (EXTRA.includes(l) && l !== 'V4R' ? 0.5 : l === 'V2' || l === 'V3' ? 2 : 1) ? 'color:var(--danger);font-weight:700' : st[l] <= -0.5 ? 'color:var(--accent);font-weight:700' : '' }, st[l].toFixed(1)))))),
    );
    const T = TERRITORY[terr];
    const stageText: Record<IschemiaStage, string> = {
      none: 'No ischaemia.',
      hyperacute: 'Hyperacute phase: repolarisation of the territory changes first → broad, tall T waves before obvious ST elevation.',
      stemi: 'Transmural injury: the ST (injury) vector points toward the injured epicardium → STE in leads facing it, reciprocal STD opposite.',
      evolving: 'Evolving infarct: necrosis removes depolarising forces (Q waves), residual STE, T waves invert.',
      old: 'Old infarct: scar generates no forces → pathological Q waves; ST usually back to baseline.',
      subendocardial: 'Subendocardial ischaemia: the injury vector points toward the cavity → diffuse ST depression, ST elevation in aVR (± V1). ST depression does not localise the artery.',
      wellens: 'Reperfused LAD: deep symmetric T inversion in V2–V3 with preserved R waves.',
      deWinter: 'de Winter pattern: the ST vector points slightly AWAY from the anterior wall (J-point depression) while the T waves become hyperacute — an LAD occlusion without precordial ST elevation (often slight STE in aVR).',
      aneurysm: 'LV aneurysm: established Q/QS waves with ST elevation that persists for weeks over dyskinetic scar; T waves are small relative to the QRS.',
      takotsubo: 'Takotsubo (subacute): apex-centred repolarisation delay → deep widespread T inversion and QT prolongation, not confined to one coronary territory (the territory selector has little effect).',
    };
    const posterior = (['V7', 'V8', 'V9'] as LeadId[]).map((l) => `${l} ${st[l].toFixed(1)}`).join(', ');
    explain.replaceChildren(
      p(`**${T.label}** (${T.artery}; classic leads ${T.leads}). ${stageText[stage]}`),
      p(`Model result (UDMI thresholds for a man ≥ 40 y: STE ≥ 2 mm in V2–V3, ≥ 1 mm elsewhere) — ST elevation: ${elevated.join(', ') || 'none'}; ST depression: ${depressed.join(', ') || 'none'}; V4R ${st.V4R.toFixed(1)} mm; posterior ${posterior} mm (≥ 0.5 mm in V7–V9 is significant).`, 'ref-meta'),
    );
  }, 60);
  root.append(
    h(
      'section',
      { class: 'card' },
      segmented<Territory>(ARTERIES, terr, (v) => ((terr = v), rerun()), 'Culprit / territory'),
      segmented<IschemiaStage>(
        [
          ['hyperacute', 'Hyperacute'],
          ['stemi', 'Acute injury (STEMI)'],
          ['evolving', 'Evolving'],
          ['old', 'Old (Q waves)'],
          ['subendocardial', 'Subendocardial'],
          ['wellens', 'Wellens'],
          ['deWinter', 'de Winter'],
          ['aneurysm', 'LV aneurysm'],
          ['takotsubo', 'Takotsubo'],
        ],
        stage,
        (v) => ((stage = v), rerun()),
        'Stage',
      ),
      slider({ label: 'Extent of injury', min: 0.2, max: 1, step: 0.05, value: extent, onInput: (v) => ((extent = v), rerun()) }),
      h('div', { class: 'grid-2' }, h('div', null, diagram, explain), h('div', null, h('h3', null, 'Right-sided (V4R) and posterior (V7–V9) leads'), right.el, p('Posterior leads face the inferobasal wall directly: the ST depression that V1–V3 show in posterior MI appears here as ST elevation (smaller voltages — the electrodes are farther away).', 'ref-meta'))),
      view.el,
      table,
    ),
  );
  root.append(
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'From ischaemic cell to lead-specific ST change'),
      whyList([
        { level: 'cell', text: 'Oxygen deprivation → ATP falls → K⁺ leaks out (IK,ATP) → resting potential less negative; action potential shorter with a lower plateau.' },
        { level: 'vector', text: 'Diastolic and systolic injury currents flow between injured and healthy myocardium; on the ECG (baseline-referenced) the net effect is an ST vector pointing toward the injured region.' },
        { level: 'lead', text: 'Leads facing the injured surface: ST elevation. Leads on the opposite side see the same vector from behind: reciprocal ST depression.' },
        { level: 'waveform', text: 'Transmural (epicardial) injury → STE in the territory. Subendocardial injury → vector toward the cavity → STD in most leads, STE in aVR.' },
        { level: 'cell', text: 'Necrosis → no depolarisation in that region → the initial QRS vector points away → Q waves; ischaemic repolarisation → T inversion.' },
      ]),
    ),
  );
  root.append(h('h2', null, 'Ischaemia library'), h('div', { class: 'grid' }, ...dxByCategory(['ischemia']).map(dxTile)));
  root.append(refList(['udmi2018', 'ecgStd6', 'acs2025', 'sgarbossa1996', 'smith2012', 'dewinter2008', 'takotsubo2018']));
  rerun();
  return () => {
    view.destroy();
    right.destroy();
  };
}
