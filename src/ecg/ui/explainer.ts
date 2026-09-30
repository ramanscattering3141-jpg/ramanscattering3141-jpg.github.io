// "What is happening now?" box shown next to the heart while playing / stepping.

import type { Moment } from '../engine/explain';
import { h, rich } from './dom';

export class ExplainerView {
  readonly el: HTMLDivElement;
  private head: HTMLDivElement;
  private live: HTMLDivElement;
  private body: HTMLDivElement;
  private key = '';

  constructor() {
    this.head = h('div', { class: 'xp-head' });
    this.live = h('div', { class: 'xp-live' });
    this.body = h('div', { class: 'xp-body', 'aria-live': 'polite' });
    this.el = h('div', { class: 'xp' }, this.head, this.live, this.body);
  }

  render(m: Moment): void {
    const v = m.vector;
    const mag = Math.hypot(v[0], v[1], v[2]);
    this.live.textContent = `t = ${Math.round(m.t)} ms · heart vector ${mag.toFixed(2)} mV · ${m.lead} = ${m.value >= 0 ? '+' : ''}${m.value.toFixed(2)} mV`;
    // Only rebuild the text when the situation changes (keeps it readable while playing).
    const key = [m.phase.id, m.phase.t0.toFixed(0), ...m.conduction, ...m.why, ...m.comps.map((c) => c.tag)].join('|');
    if (key === this.key) {
      this.updateBars(m);
      return;
    }
    this.key = key;
    this.head.replaceChildren(h('span', { class: `xp-phase ph-${m.phase.id}` }, m.phase.label));
    const comps = h(
      'div',
      { class: 'xp-comps' },
      ...m.comps.map((c) =>
        h(
          'div',
          { class: 'xp-comp' },
          h('div', { class: 'xp-bar' }, h('i', { style: `width:${Math.round(c.weight * 100)}%` })),
          h('div', null, h('strong', null, c.tag), ` — ${c.chamber}, vector ${c.heading}`),
          h('div', { class: 'xp-leads' }, c.toward.length ? `→ upward in ${c.toward.join(', ')}` : '', c.toward.length && c.away.length ? ' · ' : '', c.away.length ? `downward in ${c.away.join(', ')}` : ''),
        ),
      ),
    );
    this.body.replaceChildren(
      ...(m.conduction.length ? [h('ul', { class: 'xp-cond' }, ...m.conduction.map((t) => h('li', null, rich(t))))] : []),
      ...m.why.map((t) => h('p', { class: 'xp-why' }, rich(t))),
      ...(m.comps.length ? [h('div', { class: 'xp-sub' }, 'Wavefronts writing the ECG right now (the same dipoles the tracing is computed from):'), comps] : []),
    );
  }

  private updateBars(m: Moment): void {
    const bars = this.body.querySelectorAll<HTMLElement>('.xp-bar i');
    m.comps.forEach((c, i) => {
      if (bars[i]) bars[i].style.width = `${Math.round(c.weight * 100)}%`;
    });
  }
}
