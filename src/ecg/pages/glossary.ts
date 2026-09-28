import { h, p } from '../ui/dom';
import { header } from '../ui/common';
import { GLOSSARY } from '../content/glossary';

export function renderGlossary(root: HTMLElement, parts: string[]): void {
  root.append(header('Reference', 'Glossary', 'Core electrophysiology and ECG vocabulary, each defined by mechanism and linked to the page where you can experiment with it.'));
  const filter = h('input', { type: 'search', placeholder: 'Filter terms…', 'aria-label': 'Filter glossary', class: 'glossary-filter' });
  const list = h('dl', { class: 'glossary' });
  const sorted = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term));
  const draw = (): void => {
    const q = filter.value.trim().toLowerCase();
    list.replaceChildren(
      ...sorted
        .filter((g) => !q || g.term.toLowerCase().includes(q) || g.def.toLowerCase().includes(q) || (g.aka ?? []).some((a) => a.toLowerCase().includes(q)))
        .map((g) => h('div', { class: `gl-item ${parts[0] === g.id ? 'hit' : ''}`, id: `g-${g.id}` }, h('dt', null, g.term, g.aka?.length ? h('span', { class: 'ref-meta' }, ` (${g.aka.join(', ')})`) : null), h('dd', null, p(g.def), g.see ? h('a', { href: g.see }, 'Explore →') : null))),
    );
  };
  filter.addEventListener('input', draw);
  root.append(h('section', { class: 'card' }, filter, list));
  draw();
  if (parts[0]) requestAnimationFrame(() => document.getElementById(`g-${parts[0]}`)?.scrollIntoView({ block: 'center' }));
}
