// LITFL-style reference pages: an A–Z index of everything in the library, named signs and
// eponyms, normal values and variants, and STEMI equivalents / mimics.

import { h, p, ul } from '../ui/dom';
import { dxLink, header, presetPhysio, refList } from '../ui/common';
import { EcgPanel } from '../ui/panel';
import { ALL_DX, resolveDx } from '../content/index';
import { CATEGORY_LABEL } from '../content/types';
import { FINDINGS } from '../content/findings';
import { GLOSSARY } from '../content/glossary';
import { EPONYMS, KIND_LABEL, eponymById, type Eponym, type EponymKind } from '../content/eponyms';
import { NORMAL_VALUES, NORMAL_VARIANTS, STEMI_EQUIVALENTS, STEMI_MIMICS, type OmiRow } from '../content/reference';
import { PRESETS } from '../engine/presets';

// ------------------------------------------------------------------ A–Z library
interface AzItem {
  title: string;
  sub: string;
  href: string;
  kind: 'Diagnosis' | 'Finding' | 'Sign / eponym' | 'Term';
  cat?: string;
}

function firstSentence(s: string): string {
  const m = s.match(/^(.+?[.!?])(\s|$)/);
  return (m ? m[1] : s).slice(0, 220);
}

function azItems(): AzItem[] {
  const out: AzItem[] = [];
  for (const d of ALL_DX) {
    out.push({ title: d.name, sub: firstSentence(d.definition), href: `#/dx/${d.id}`, kind: 'Diagnosis', cat: CATEGORY_LABEL[d.category] });
    for (const a of d.aliases ?? []) if (a.length > 3 && !/^[a-z]/.test(a)) out.push({ title: a, sub: `→ ${d.name}`, href: `#/dx/${d.id}`, kind: 'Diagnosis', cat: CATEGORY_LABEL[d.category] });
  }
  for (const f of FINDINGS) out.push({ title: f.name, sub: `Why does it look like this? ${f.aliases.slice(0, 3).join(', ')}`, href: `#/why/${f.id}`, kind: 'Finding' });
  for (const e of EPONYMS) out.push({ title: e.name, sub: e.def, href: `#/eponyms/${e.id}`, kind: 'Sign / eponym' });
  for (const g of GLOSSARY) out.push({ title: g.term, sub: firstSentence(g.def), href: `#/glossary/${g.id}`, kind: 'Term' });
  const seen = new Set<string>();
  return out
    .filter((x) => {
      const k = `${x.title.toLowerCase()}|${x.href}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title)));
}

function sortKey(s: string): string {
  return s
    .replace(/^[^A-Za-z0-9]+/, '')
    .replace(/^(the|a|an) /i, '')
    .toLowerCase();
}

export function renderAZ(root: HTMLElement): void {
  root.append(header('ECG Library', 'ECG library A–Z', 'Every diagnosis, ECG finding, named sign and term in the lab, in one alphabetical index. Each entry opens a page that explains the mechanism and, where possible, generates the ECG from physiology.'));
  const items = azItems();
  const filter = h('input', { type: 'search', placeholder: 'Filter (e.g. "block", "Brugada", "T wave")', 'aria-label': 'Filter the index', class: 'az-filter' });
  const kinds: AzItem['kind'][] = ['Diagnosis', 'Finding', 'Sign / eponym', 'Term'];
  const on = new Set<AzItem['kind']>(kinds);
  const chips = h(
    'div',
    { class: 'az-chips' },
    ...kinds.map((k) => {
      const b = h('button', { type: 'button', class: 'chip on', 'aria-pressed': 'true' }, k);
      b.addEventListener('click', () => {
        if (on.has(k)) on.delete(k);
        else on.add(k);
        b.classList.toggle('on', on.has(k));
        b.setAttribute('aria-pressed', String(on.has(k)));
        draw();
      });
      return b;
    }),
  );
  const letters = h('nav', { class: 'az-letters', 'aria-label': 'Jump to letter' });
  const list = h('div', { class: 'az-list' });
  const count = h('p', { class: 'ref-meta' });
  const draw = (): void => {
    const q = filter.value.trim().toLowerCase();
    const shown = items.filter((x) => on.has(x.kind) && (!q || x.title.toLowerCase().includes(q) || x.sub.toLowerCase().includes(q)));
    count.textContent = `${shown.length} entries`;
    const groups = new Map<string, AzItem[]>();
    for (const x of shown) {
      const c = sortKey(x.title).charAt(0).toUpperCase();
      const key = /[A-Z]/.test(c) ? c : '#';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(x);
    }
    letters.replaceChildren(...[...groups.keys()].map((k) => h('a', { href: `#/az`, 'data-l': k, onclick: (e: Event) => (e.preventDefault(), document.getElementById(`az-${k}`)?.scrollIntoView({ behavior: 'smooth' })) }, k)));
    list.replaceChildren(
      ...[...groups.entries()].map(([k, xs]) =>
        h(
          'section',
          { class: 'az-group', id: `az-${k}` },
          h('h2', null, k),
          h(
            'ul',
            { class: 'az-ul' },
            ...xs.map((x) => h('li', null, h('a', { href: x.href }, x.title), ' ', h('span', { class: `pill az-${x.kind === 'Sign / eponym' ? 'sign' : x.kind.toLowerCase()}` }, x.kind), x.cat ? h('span', { class: 'az-cat' }, ` ${x.cat}`) : null, h('div', { class: 'az-sub' }, x.sub))),
          ),
        ),
      ),
    );
  };
  filter.addEventListener('input', draw);
  root.append(h('section', { class: 'card' }, h('div', { class: 'az-tools' }, filter, chips), count, letters), list);
  draw();
}

// ------------------------------------------------------------------ eponyms
function eponymCard(e: Eponym, full: boolean): HTMLElement {
  const d = e.dx ? resolveDx(e.dx) : undefined;
  const links: HTMLElement[] = [];
  if (d) links.push(h('a', { class: 'btn', href: `#/dx/${d.id}` }, `${d.name} →`));
  if (e.preset && PRESETS[e.preset]) links.push(h('a', { class: 'btn', href: `#/heart3d?preset=${e.preset}` }, 'See it in the 3-D heart'), h('a', { class: 'btn', href: `#/simulator?preset=${e.preset}` }, 'Open in simulator'));
  if (e.tool) links.push(h('a', { class: 'btn', href: e.tool }, 'Interactive tool →'));
  return h(
    'article',
    { class: 'card epo', id: `epo-${e.id}` },
    h('div', { class: 'epo-head' }, h(full ? 'h2' : 'h3', null, full ? e.name : h('a', { href: `#/eponyms/${e.id}` }, e.name)), h('span', { class: 'pill' }, KIND_LABEL[e.kind])),
    e.aka?.length ? p(`Also: ${e.aka.join(', ')}`, 'ref-meta') : null,
    p(e.def),
    h('h4', null, 'ECG'),
    ul(e.ecg),
    h('h4', null, 'Why it matters'),
    p(e.significance),
    links.length ? h('div', { class: 'btn-row' }, ...links) : null,
  );
}

export function renderEponyms(root: HTMLElement, parts: string[]): (() => void) | void {
  const one = parts[0] ? eponymById(parts[0]) : undefined;
  if (one) {
    root.append(header('Named signs & eponyms', one.name, one.def));
    root.append(eponymCard(one, true));
    let panel: EcgPanel | null = null;
    if (one.preset && PRESETS[one.preset]) {
      panel = new EcgPanel({ duration: 10000, heart: true });
      root.append(h('section', { class: 'card' }, h('h2', null, 'Generated example'), p(PRESETS[one.preset].physiology), panel.el));
      panel.show(presetPhysio(one.preset));
    }
    root.append(refList(one.refs), h('p', null, h('a', { href: '#/eponyms' }, '← All named signs and eponyms')));
    return () => panel?.destroy();
  }
  root.append(header('ECG Library', 'Named signs, criteria & eponyms', 'The named patterns, signs, criteria and phenomena of electrocardiography — what each one is, how to recognise it, and why it happens.'));
  const kinds = Object.keys(KIND_LABEL) as EponymKind[];
  let sel: EponymKind | 'all' = 'all';
  const host = h('div', { class: 'epo-grid' });
  const draw = (): void => host.replaceChildren(...EPONYMS.filter((e) => sel === 'all' || e.kind === sel).map((e) => eponymCard(e, false)));
  const chips = h(
    'div',
    { class: 'az-chips' },
    ...(['all', ...kinds] as const).map((k) => {
      const b = h('button', { type: 'button', class: `chip ${k === 'all' ? 'on' : ''}` }, k === 'all' ? 'All' : KIND_LABEL[k as EponymKind]);
      b.addEventListener('click', () => {
        sel = k as EponymKind | 'all';
        chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === b));
        draw();
      });
      return b;
    }),
  );
  root.append(chips, host);
  draw();
  root.append(refList(Array.from(new Set(EPONYMS.flatMap((e) => e.refs)))));
}

// ------------------------------------------------------------------ normal values
export function renderNormal(root: HTMLElement): () => void {
  root.append(header('A · ECG Fundamentals', 'Normal values & normal variants', 'The adult reference values used throughout the lab, what an abnormal value points to, and the normal variants that are most often mistaken for disease.'));
  root.append(
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'Normal adult values'),
      h(
        'div',
        { class: 'table-scroll' },
        h(
          'table',
          { class: 't' },
          h('thead', null, h('tr', null, h('th', null, 'Measure'), h('th', null, 'Normal'), h('th', null, 'Abnormal → think of'), h('th', null, 'Explore'))),
          h('tbody', null, ...NORMAL_VALUES.map((r) => h('tr', null, h('th', null, r.item), h('td', null, r.normal), h('td', null, r.abnormal), h('td', null, ...r.links.flatMap((l, i) => [i ? h('br') : null, h('a', { href: l.href }, l.label)]))))),
        ),
      ),
      p('Paper speed 25 mm/s and calibration 10 mm/mV: one small square = 40 ms and 0.1 mV; one large square = 200 ms and 0.5 mV. Intervals are measured from the earliest onset to the latest offset across simultaneously recorded leads.', 'ref-meta'),
    ),
  );
  root.append(h('section', { class: 'card' }, h('h2', null, 'Normal variants'), h('div', { class: 'grid' }, ...NORMAL_VARIANTS.map((v) => h('a', { class: 'tile', href: v.href }, h('h3', null, v.name), h('p', null, v.text))))));
  const panel = new EcgPanel({ duration: 10000, heart: true });
  root.append(h('section', { class: 'card' }, h('h2', null, 'A normal 12-lead ECG, generated from physiology'), p('Use the caliper (drag across the tracing) to measure each interval, then compare with the model measurements underneath.'), panel.el));
  panel.show(presetPhysio('nsr'));
  root.append(refList(['ecgStd1', 'ecgStd3', 'ecgStd4', 'ecgStd5', 'ecgStd6', 'udmi2018', 'athlete2017']));
  return () => panel.destroy();
}

// ------------------------------------------------------------------ STEMI equivalents & mimics
function omiTable(rows: OmiRow[]): HTMLElement {
  return h(
    'div',
    { class: 'table-scroll' },
    h(
      'table',
      { class: 't' },
      h('thead', null, h('tr', null, h('th', null, 'Pattern'), h('th', null, 'ECG'), h('th', null, 'Why'), h('th', null, 'See it'))),
      h(
        'tbody',
        null,
        ...rows.map((r) =>
          h(
            'tr',
            null,
            h('th', null, r.name, r.dx ? h('div', { class: 'ref-meta' }, dxLink(r.dx)) : null),
            h('td', null, r.criteria),
            h('td', null, r.why),
            h('td', null, r.preset && PRESETS[r.preset] ? h('a', { href: `#/simulator?preset=${r.preset}` }, 'Simulator') : null, r.preset && PRESETS[r.preset] ? h('br') : null, r.preset && PRESETS[r.preset] ? h('a', { href: `#/heart3d?preset=${r.preset}` }, '3-D heart') : null, r.tool ? h('a', { href: r.tool }, 'Tool') : null),
          ),
        ),
      ),
    ),
  );
}

export function renderOmi(root: HTMLElement): () => void {
  root.append(header('G · Ischaemia & Infarction', 'STEMI equivalents, occlusion-MI patterns and mimics', 'ST elevation is neither necessary nor sufficient for acute coronary occlusion. Some occlusions show other patterns; many conditions raise the ST segment without an occlusion. Learn both lists — and always interpret the ECG with the clinical picture, serial ECGs and troponin.'));
  root.append(
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'Patterns that can indicate acute coronary occlusion without classic ST elevation'),
      p('Guidelines (ACC/AHA 2025, ESC 2023) treat some of these — notably isolated posterior MI and LBBB or a paced rhythm with criteria for superimposed infarction — as indications for the same emergency reperfusion pathway as STEMI, and describe widespread ST depression with ST elevation in aVR/V1 as a marker of left-main or multivessel ischaemia. Others (de Winter T waves, hyperacute T waves, the Aslanger pattern) come from the occlusion-MI (OMI) literature. Wellens is a warning of imminent occlusion, not an occlusion.'),
      omiTable(STEMI_EQUIVALENTS),
    ),
    h('section', { class: 'card' }, h('h2', null, 'Common STEMI mimics'), p('Clues that favour a mimic: concave ST shape, ST elevation proportional to a large or wide QRS, no reciprocal change (other than aVR), PR depression, a stable pattern on serial ECGs, and a matching clinical context. None is absolute.'), omiTable(STEMI_MIMICS)),
  );
  const a = new EcgPanel({ duration: 6000, compact: true });
  const b = new EcgPanel({ duration: 6000, compact: true });
  const opts = [...STEMI_EQUIVALENTS, ...STEMI_MIMICS].filter((r) => r.preset && PRESETS[r.preset]);
  const mk = (initial: string, panel: EcgPanel): HTMLSelectElement => {
    const s = h('select', { 'aria-label': 'Pattern to display' }, ...opts.map((r) => h('option', { value: r.preset!, selected: r.preset === initial }, r.name)));
    s.addEventListener('change', () => panel.show(presetPhysio(s.value)));
    return s;
  };
  root.append(h('section', { class: 'card' }, h('h2', null, 'Compare side by side'), h('div', { class: 'grid-2' }, h('div', null, mk('hyperacute', a), a.el), h('div', null, mk('earlyRepol', b), b.el))));
  a.show(presetPhysio('hyperacute'));
  b.show(presetPhysio('earlyRepol'));
  root.append(refList(['acs2025', 'escAcs2023', 'udmi2018', 'dewinter2008', 'wellens1982', 'sgarbossa1996', 'smith2012', 'escPeri2015', 'erp2015', 'takotsubo2018']));
  return () => {
    a.destroy();
    b.destroy();
  };
}
