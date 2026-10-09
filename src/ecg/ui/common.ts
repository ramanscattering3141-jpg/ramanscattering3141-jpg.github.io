// Shared page-building helpers.

import { h, p, rich, ul } from './dom';
import { LEVEL_LABEL, type Dx, type WhyStep } from '../content/types';
import { SOURCES } from '../content/sources';
import { resolveDx } from '../content/index';
import { applyPatch, makePhysio, type Physio, type PhysioPatch } from '../engine/params';
import { PRESETS } from '../engine/presets';
import { isReviewed } from './progress';

export function header(kicker: string, title: string, intro?: string): HTMLElement {
  return h('header', null, h('div', { class: 'kicker' }, kicker), h('h1', null, title), intro ? p(intro, 'lead') : null);
}

export function whyList(steps: WhyStep[], normal = false): HTMLOListElement {
  return h('ol', { class: `why ${normal ? 'normal' : ''}` }, ...steps.map((s) => h('li', null, h('span', { class: 'lvl' }, LEVEL_LABEL[s.level]), rich(s.text))));
}

export function whyBox(title: string, steps: WhyStep[], normalText?: string | WhyStep[]): HTMLElement {
  const box = h('section', { class: 'why-box', 'aria-label': 'Why does it look like this?' }, h('h2', null, `WHY does it look like this? — ${title}`));
  if (normalText) {
    box.append(h('h3', null, 'Normal'));
    if (typeof normalText === 'string') box.append(p(normalText));
    else box.append(whyList(normalText, true));
    box.append(h('h3', null, 'Abnormal'));
  }
  box.append(whyList(steps));
  return box;
}

export function refList(ids: string[]): HTMLElement {
  const items = ids
    .map((id) => SOURCES[id])
    .filter(Boolean)
    .map((s) =>
      h(
        'li',
        null,
        h('strong', null, s.title),
        h('div', { class: 'ref-meta' }, `${s.authors}. ${s.venue}. `, s.doi ? h('a', { href: `https://doi.org/${s.doi}`, target: '_blank', rel: 'noopener' }, `doi:${s.doi}`) : null, s.pmid ? ` · PMID ${s.pmid}` : '', ` · verified ${s.verified}`),
        s.note ? h('div', { class: 'ref-meta' }, s.note) : null,
      ),
    );
  return h('section', { class: 'refs' }, h('h3', null, 'References'), h('ol', null, ...items));
}

export function dxLink(key: string): HTMLElement {
  const d = resolveDx(key);
  if (d) return h('a', { href: `#/dx/${d.id}` }, d.name);
  return h('span', null, key);
}

export function dxTile(d: Dx): HTMLAnchorElement {
  return h(
    'a',
    { class: 'tile', href: `#/dx/${d.id}` },
    h('span', { class: `pill tier ${d.tier === 1 ? 'core' : ''}` }, d.tier === 1 ? 'core' : d.tier === 2 ? 'important' : 'advanced'),
    isReviewed(d.id) ? h('span', { class: 'pill done', title: 'You marked this as reviewed' }, '✓ reviewed') : null,
    h('h3', null, d.name),
    h('p', null, d.definition.length > 150 ? `${d.definition.slice(0, 147)}…` : d.definition),
  );
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function section(title: string, ...children: (Node | string | null)[]): HTMLElement {
  return h('section', { class: 'card', id: `sec-${slug(title)}` }, h('h2', null, title), ...children);
}

/** In-page "jump to" link that scrolls without changing the hash route. */
export function jump(label: string, id: string): HTMLAnchorElement {
  return h('a', { href: '#', class: 'jump', onclick: (e: Event) => (e.preventDefault(), document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })) }, label);
}

export function bullets(items: string[] | undefined): HTMLElement | null {
  return items && items.length ? ul(items) : null;
}

export function loopBanner(): HTMLElement {
  const steps = ['Change physiology', 'Predict ECG', 'Observe ECG', 'Explain ECG', 'Diagnose rhythm', 'Choose treatment', 'Understand why it works'];
  const el = h('div', { class: 'loop', 'aria-label': 'Learning loop' });
  steps.forEach((s, i) => {
    el.append(h('span', null, s));
    if (i < steps.length - 1) el.append(h('i', null, '→'));
  });
  return el;
}

/** Physio for a preset id (optionally with extra patch). */
export function presetPhysio(id: string, extra?: PhysioPatch): Physio {
  const base = makePhysio(PRESETS[id]?.patch);
  return extra ? applyPatch(base, extra) : base;
}

const SIM_KEY = 'ecg.sim.state';
/** Open the full simulator with a given physiology. */
export function openInSimulator(p: Physio): void {
  try {
    sessionStorage.setItem(SIM_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
  location.hash = '#/simulator?from=state';
}
export function takeSimState(): Physio | null {
  try {
    const v = sessionStorage.getItem(SIM_KEY);
    // Merge over current defaults so states saved by an older version gain any new fields.
    return v ? makePhysio(JSON.parse(v) as PhysioPatch) : null;
  } catch {
    return null;
  }
}

export function disclaimer(): HTMLElement {
  return h(
    'div',
    { class: 'footer' },
    'Educational simulator. ECGs are generated from a simplified physiological model and are not patient recordings; morphology in real patients varies. Clinical content summarises the cited guidelines (verified 2026-09-28) and is not a substitute for current official guidance, local protocols or clinical judgement.',
  );
}
