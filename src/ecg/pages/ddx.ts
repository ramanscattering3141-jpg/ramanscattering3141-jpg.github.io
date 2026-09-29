import { h, ul } from '../ui/dom';
import { dxLink, header, presetPhysio, refList } from '../ui/common';
import { EcgPanel } from '../ui/panel';
import { DDX } from '../content/differentials';
import { presetLabel } from '../content/index';

export function renderDdx(root: HTMLElement, parts: string[]): (() => void) | void {
  const prob = DDX.find((d) => d.id === parts[0]);
  if (!prob) {
    root.append(header('Differential diagnosis engine', 'Start from what you see', 'Choose a presenting ECG pattern. The engine lists the candidate diagnoses and the features that discriminate them — each tied to its mechanism and a live example.'));
    root.append(h('div', { class: 'grid' }, ...DDX.map((d) => h('a', { class: 'tile', href: `#/ddx/${d.id}` }, h('h3', null, d.title), h('p', null, `${d.candidates.length} candidates`)))));
    return;
  }
  root.append(header('Differential diagnosis engine', prob.title, prob.intro));
  const panel = new EcgPanel({ duration: 8000, heart: true });
  const cap = h('h3');
  const show = (preset: string): void => {
    cap.textContent = `Example: ${presetLabel(preset)}`;
    panel.stop();
    panel.show(presetPhysio(preset));
  };
  const table = h(
    'table',
    { class: 't' },
    h('thead', null, h('tr', null, h('th', null, 'Candidate'), ...prob.features.map((f) => h('th', null, f.label)), h('th', null, ''))),
    h(
      'tbody',
      null,
      ...prob.candidates.map((c) => {
        const btn = h('button', { class: 'btn', type: 'button' }, 'Show ECG');
        btn.addEventListener('click', () => show(c.preset));
        return h('tr', null, h('td', null, dxLink(c.id), h('div', { class: 'ref-meta' }, presetLabel(c.preset))), ...prob.features.map((f) => h('td', null, c.features[f.key] ?? '—')), h('td', null, btn));
      }),
    ),
  );
  root.append(h('section', { class: 'card' }, h('div', { class: 'table-scroll' }, table)), h('section', { class: 'card' }, cap, panel.el), h('section', { class: 'card' }, h('h2', null, 'Pearls'), ul(prob.pearls)), h('p', null, 'Other patterns: ', ...DDX.filter((d) => d.id !== prob.id).flatMap((d, i) => [i ? ' · ' : '', h('a', { href: `#/ddx/${d.id}` }, d.title)])), refList(prob.refs));
  show(prob.candidates[0].preset);
  return () => panel.destroy();
}
