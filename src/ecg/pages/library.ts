import { h, p, ul } from '../ui/dom';
import { bullets, dxLink, dxTile, header, jump, openInSimulator, presetPhysio, refList, section, slug, whyBox } from '../ui/common';
import { eponymsForDx } from '../content/eponyms';
import { EcgPanel } from '../ui/panel';
import { button, segmented, toggle } from '../ui/controls';
import { isReviewed, setReviewed } from '../ui/progress';
import { ALL_DX, SECTION_CATS, dxByCategory, presetLabel, resolveDx } from '../content/index';
import { CATEGORY_LABEL, type Category, type Dx, type Management } from '../content/types';
import { PRESETS } from '../engine/presets';
import { randomVariation } from '../engine/variability';
import type { Physio } from '../engine/params';

export function renderLibrary(root: HTMLElement): void {
  root.append(header('D · Rhythm Library', 'Rhythm library', 'Grouped by where the rhythm originates and what mechanism drives it. Depth follows clinical frequency × importance × conceptual value: core rhythms first.'));
  root.append(
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'Mechanism labs'),
      h(
        'div',
        { class: 'grid' },
        h('a', { class: 'tile', href: '#/rhythms/avnrt-lab' }, h('h3', null, 'AVNRT circuit lab'), h('p', null, 'Manipulate fast/slow pathway conduction and refractoriness; initiate and terminate re-entry.')),
        h('a', { class: 'tile', href: '#/rhythms/avrt-lab' }, h('h3', null, 'Accessory pathway lab'), h('p', null, 'WPW, orthodromic/antidromic AVRT, concealed pathways, pathway location and delta-wave polarity, pre-excited AF.')),
        h('a', { class: 'tile', href: '#/rhythms/flutter-lab' }, h('h3', null, 'Flutter & AF conduction lab'), h('p', null, '2:1 → 3:1 → variable block; AF filtering by the AV node.')),
        h('a', { class: 'tile', href: '#/sandbox/hierarchy' }, h('h3', null, 'Pacemaker hierarchy'), h('p', null, 'Disable higher pacemakers and watch escapes emerge.')),
        h('a', { class: 'tile', href: '#/sandbox/adenosine' }, h('h3', null, 'Adenosine demonstrator'), h('p', null, 'Rhythm mechanism vs drug site of action.')),
      ),
    ),
  );
  for (const cat of SECTION_CATS.rhythm) {
    const list = dxByCategory([cat]);
    if (!list.length) continue;
    root.append(h('h2', null, CATEGORY_LABEL[cat]), h('div', { class: 'grid' }, ...list.map(dxTile)));
  }
}

const SECTION_META: Record<string, { kicker: string; title: string; intro: string }> = {
  structural: { kicker: 'F · Structural / Physiological ECG Changes', title: 'Hypertrophy, cardiomyopathy, pericardial, pulmonary and positional patterns', intro: 'How chamber mass, myocardial disease, fluid, inflammation, pressure load — and the position of the heart and electrodes — reshape the vectors, and therefore the voltages, axis and ST–T.' },
  inherited: { kicker: 'I · Inherited / Primary Electrical Syndromes', title: 'Repolarisation and J-wave disorders', intro: 'Channelopathies change the action potential in specific layers of the ventricle; the ECG pattern follows from which current and which layer. Use the ST/T/QT lab and the action-potential explorer alongside.' },
};

export function renderSection(root: HTMLElement, key: string): void {
  const meta = SECTION_META[key];
  root.append(header(meta.kicker, meta.title, meta.intro));
  if (key === 'structural') root.append(h('p', null, h('a', { class: 'btn btn-primary', href: '#/sandbox/qrs' }, 'Open the QRS / hypertrophy lab →'), ' ', h('a', { class: 'btn', href: '#/sandbox/p' }, 'P-wave lab →'), ' ', h('a', { class: 'btn', href: '#/tools/leads' }, 'Lead reversal & artefact lab →')));
  if (key === 'inherited') root.append(h('p', null, h('a', { class: 'btn btn-primary', href: '#/sandbox/st' }, 'Open the ST/T/QT lab →'), ' ', h('a', { class: 'btn', href: '#/fundamentals/ap' }, 'Action-potential explorer →'), ' ', h('a', { class: 'btn', href: '#/rhythms/avrt-lab' }, 'WPW / accessory pathways →')));
  for (const cat of SECTION_CATS[key]) {
    const list = dxByCategory([cat]);
    if (list.length) root.append(h('h2', null, CATEGORY_LABEL[cat]), h('div', { class: 'grid' }, ...list.map(dxTile)));
  }
  if (key === 'inherited') {
    const extra = ['wpw', 'torsades', 'bidirectionalVT', 'hypothermia'].map((id) => resolveDx(id)).filter((d): d is Dx => !!d);
    root.append(h('h2', null, 'Related'), h('div', { class: 'grid' }, ...extra.map(dxTile)));
  }
}

export function managementBlock(m: Management): HTMLElement {
  const rows: [string, HTMLElement | string][] = [
    ['1. Recognition', m.recognition],
    ['2. Mechanism', m.mechanism],
    ['3. Stable vs unstable', m.stability],
    ['4. Immediate management', ul(m.immediate)],
    ['5. Definitive management', ul(m.definitive)],
    ['6. Contraindications / cautions', ul(m.cautions)],
    ['7. Why each treatment works', ul(m.whyWorks)],
    ['8. Why certain treatments do not work', ul(m.whyNot)],
  ];
  return h('div', { class: 'table-scroll' }, h('table', { class: 't' }, h('tbody', null, ...rows.map(([k, v]) => h('tr', null, h('th', { style: 'width:190px' }, k), h('td', null, typeof v === 'string' ? p(v) : v))))));
}

/** LITFL-style summary at the top of each diagnosis page. */
function atAGlance(d: Dx): HTMLElement {
  const signs = eponymsForDx(d.id);
  const col = (title: string, body: HTMLElement | null): HTMLElement | null => (body ? h('div', { class: 'glance-col' }, h('h3', null, title), body) : null);
  const diffs = d.differential.slice(0, 5);
  const jumps: [string, string][] = [
    ...(d.preset ? [['Interactive ECG', 'sec-interactive-ecg'] as [string, string]] : []),
    ['Why', 'sec-why'],
    ['Mechanism', `sec-${slug('Electrophysiological mechanism')}`],
    ['ECG findings', `sec-${slug('ECG findings')}`],
    ['Differential', `sec-${slug('Differential diagnosis')}`],
    ...(d.presentation || d.causes || d.complications ? [['Clinical', `sec-${slug('Clinical')}`] as [string, string]] : []),
    ...(d.management ? [['Management', `sec-${slug('Management — mechanism-linked')}`] as [string, string]] : d.acute || d.longTerm || d.cautions ? [['Management', `sec-${slug('Management')}`] as [string, string]] : []),
    ...(d.pearls ? [['Pearls', `sec-${slug('Pearls')}`] as [string, string]] : []),
    ['References', 'sec-references'],
  ];
  return h(
    'section',
    { class: 'card glance', 'aria-label': 'At a glance' },
    h('h2', null, 'At a glance'),
    h(
      'div',
      { class: 'glance-grid' },
      col('Key ECG features', ul(d.ecg.slice(0, 5))),
      col('Common causes', d.causes?.length ? ul(d.causes.slice(0, 6)) : null),
      col('Don’t confuse with', diffs.length ? h('ul', null, ...diffs.map((x) => h('li', null, dxLink(x.dx)))) : null),
      col('Named signs', signs.length ? h('ul', null, ...signs.map((e) => h('li', null, h('a', { href: `#/eponyms/${e.id}` }, e.name)))) : null),
    ),
    h('nav', { class: 'glance-jump', 'aria-label': 'On this page' }, h('span', null, 'On this page: '), ...jumps.map(([l, id]) => jump(l, id))),
  );
}

export function renderDx(root: HTMLElement, parts: string[]): (() => void) | void {
  const d = resolveDx(parts[0] ?? '');
  if (!d) {
    root.append(header('Library', 'Not found'), h('a', { href: '#/rhythms' }, 'Back to library'));
    return;
  }
  root.append(header(CATEGORY_LABEL[d.category as Category], d.name, d.definition));
  const reviewed = toggle('Mark as reviewed (saved in this browser)', isReviewed(d.id), (v) => setReviewed(d.id, v));
  root.append(h('div', null, h('span', { class: `pill ${d.tier === 1 ? 'core' : ''}` }, d.tier === 1 ? 'core curriculum' : d.tier === 2 ? 'important' : 'advanced'), ...(d.aliases ?? []).slice(0, 6).map((a) => h('span', { class: 'pill' }, a))), h('div', { class: 'btn-row' }, reviewed, h('a', { href: '#/path' }, 'Learning path & progress →')));
  root.append(atAGlance(d));

  let panel: EcgPanel | null = null;
  if (d.preset) {
    const presets = [d.preset, ...(d.altPresets ?? [])];
    let current = presets[0];
    let phys: Physio = presetPhysio(current);
    panel = new EcgPanel({ heart: true, duration: 10000 });
    const note = h('div', { class: 'callout' }, p(PRESETS[current]?.physiology ?? ''));
    const show = (): void => {
      panel!.stop();
      panel!.show(phys);
      note.replaceChildren(p(PRESETS[current]?.physiology ?? ''));
    };
    const controls = h(
      'div',
      { class: 'btn-row' },
      presets.length > 1
        ? segmented(
            presets.map((x) => [x, presetLabel(x)] as [string, string]),
            current,
            (v) => {
              current = v;
              phys = presetPhysio(v);
              show();
            },
            'Variant',
          )
        : null,
      button('🎲 Patient variability', () => {
        phys = randomVariation(presetPhysio(current));
        show();
      }),
      button('Open in simulator →', () => openInSimulator(phys), 'btn-primary'),
    );
    root.append(h('section', { class: 'card', id: 'sec-interactive-ecg' }, h('h2', null, 'Interactive ECG (generated from physiology)'), controls, note, panel.el));
    show();
  }

  const wb = whyBox(d.name, d.why, d.normal);
  wb.id = 'sec-why';
  root.append(wb);
  root.append(section('Electrophysiological mechanism', p(d.mechanism)));
  root.append(section('ECG findings', ul(d.ecg)));
  if (d.epidemiology) root.append(section('Epidemiology', p(d.epidemiology)));
  root.append(
    section(
      'Differential diagnosis',
      h('div', { class: 'table-scroll' }, h('table', { class: 't' }, h('thead', null, h('tr', null, h('th', null, 'Consider'), h('th', null, 'How to tell (mechanism)'))), h('tbody', null, ...d.differential.map((x) => h('tr', null, h('td', null, dxLink(x.dx)), h('td', null, x.how)))))),
    ),
  );
  if (d.presentation || d.causes || d.complications) root.append(section('Clinical', d.presentation ? p(d.presentation) : null, d.causes ? h('h3', null, 'Causes') : null, bullets(d.causes), d.complications ? h('h3', null, 'Complications') : null, bullets(d.complications)));
  if (d.management) root.append(section('Management — mechanism-linked', managementBlock(d.management)));
  else if (d.acute || d.longTerm || d.cautions) root.append(section('Management', d.acute ? h('h3', null, 'Acute') : null, bullets(d.acute), d.longTerm ? h('h3', null, 'Long-term') : null, bullets(d.longTerm), d.cautions ? h('h3', null, 'Cautions') : null, bullets(d.cautions)));
  if (d.pearls) root.append(section('Pearls', ul(d.pearls)));
  root.append(section('Practice', h('div', { class: 'btn-row' }, h('a', { class: 'btn', href: `#/cases?dx=${d.id}` }, 'Generate a case with this diagnosis'), h('a', { class: 'btn', href: '#/challenge' }, 'Challenge mode'), h('a', { class: 'btn', href: '#/sandbox/compare' }, 'Compare with a look-alike'))));
  const rl = refList(Array.from(new Set([...d.refs, ...(d.management?.refs ?? [])])));
  rl.id = 'sec-references';
  root.append(rl);
  const related = ALL_DX.filter((x) => x.category === d.category && x.id !== d.id).slice(0, 6);
  if (related.length) root.append(h('h2', null, 'Related'), h('div', { class: 'grid' }, ...related.map(dxTile)));
  return () => panel?.destroy();
}
