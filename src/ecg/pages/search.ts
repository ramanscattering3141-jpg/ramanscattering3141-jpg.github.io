import { h, p } from '../ui/dom';
import { header } from '../ui/common';
import { search } from '../content/index';
import { SOURCES } from '../content/sources';

export function renderSearch(root: HTMLElement, _parts: string[], q: URLSearchParams): void {
  const query = q.get('q') ?? '';
  root.append(header('Search', query ? `Results for “${query}”` : 'Search', 'Search by diagnosis, ECG finding, symptom, drug, mechanism, anatomy or treatment — e.g. "wide QRS", "regular narrow tachycardia", "adenosine", "syncope", "digoxin", "re-entry".'));
  const input = h('input', { type: 'search', value: query, placeholder: 'Search…', 'aria-label': 'Search query' });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') location.hash = `#/search?q=${encodeURIComponent(input.value.trim())}`;
  });
  root.append(h('div', { class: 'search-big card' }, input));
  if (!query) return;
  const hits = search(query);
  if (!hits.length) {
    root.append(p('No results. Try a finding ("ST elevation"), a drug ("amiodarone") or a mechanism ("re-entry").'));
    return;
  }
  const groups: [string, string][] = [
    ['finding', 'ECG findings — why they happen'],
    ['diagnosis', 'Diagnoses'],
    ['page', 'Interactive pages & tools'],
    ['term', 'Glossary'],
  ];
  for (const [k, title] of groups) {
    const list = hits.filter((x) => x.kind === k);
    if (!list.length) continue;
    root.append(h('h2', null, title), h('div', { class: 'grid' }, ...list.map((x) => h('a', { class: 'tile', href: x.href }, h('h3', null, x.title), h('p', null, x.subtitle)))));
  }
  if (/adenosine/i.test(query)) root.append(h('div', { class: 'callout warn' }, p('Situations where adenosine should not be relied upon: irregular or polymorphic wide-complex tachycardia (including pre-excited AF), VT due to scar (no effect), and AF/flutter/atrial tachycardia (reveals the atrial rhythm rather than treating it). See the [adenosine demonstrator](#/sandbox/adenosine) and [ACLS reference](#/acls).')));
}

export function renderSources(root: HTMLElement): void {
  root.append(header('Evidence', 'Sources & evidence policy', 'Every clinically consequential module cites one or more records below. Each record was checked against PubMed (PMID, DOI, journal, volume, pages) on the verification date shown. Where a newer guideline exists it is used as the primary source (e.g. 2025 AHA ACLS, 2023 ACC/AHA/ACCP/HRS AF, 2025 ESC myocarditis & pericarditis, 2026 AHA/ACC PE).'));
  const kinds: [string, string][] = [
    ['guideline', 'Guidelines'],
    ['consensus', 'Consensus documents'],
    ['statement', 'Scientific statements / standards'],
    ['primary', 'Primary literature'],
    ['review', 'Reviews'],
  ];
  for (const [k, t] of kinds) {
    const list = Object.values(SOURCES).filter((s) => s.kind === k).sort((a, b) => b.year - a.year);
    root.append(
      h('h2', null, t),
      h(
        'div',
        { class: 'table-scroll card' },
        h(
          'table',
          { class: 't' },
          h('thead', null, h('tr', null, h('th', null, 'Organisation / authors'), h('th', null, 'Title'), h('th', null, 'Year'), h('th', null, 'Journal'), h('th', null, 'DOI / URL'), h('th', null, 'Verified'))),
          h('tbody', null, ...list.map((s) => h('tr', null, h('td', null, s.authors), h('td', null, s.title, s.note ? h('div', { class: 'ref-meta' }, s.note) : null), h('td', null, String(s.year)), h('td', null, s.venue), h('td', null, s.doi ? h('a', { href: `https://doi.org/${s.doi}`, target: '_blank', rel: 'noopener' }, s.doi) : null, s.url ? h('div', null, h('a', { href: s.url, target: '_blank', rel: 'noopener' }, 'official page')) : null, s.pmid ? h('div', { class: 'ref-meta' }, `PMID ${s.pmid}`) : null), h('td', null, s.verified)))),
        ),
      ),
    );
  }
  root.append(h('section', { class: 'card' }, h('h2', null, 'Guideline currency check (2026-09-28)'), p('Searches of PubMed and the web found no replacement for the 2015 ACC/AHA/HRS SVT guideline, the 2017 AHA/ACC/HRS ventricular-arrhythmia guideline, or the 2018 ACC/AHA/HRS bradycardia guideline; the 2019 ESC SVT and 2022 ESC VA guidelines are included as the most recent European documents. The 2025 AHA CPR/ECC guidelines replace the 2020 ACLS algorithms.')));
}
