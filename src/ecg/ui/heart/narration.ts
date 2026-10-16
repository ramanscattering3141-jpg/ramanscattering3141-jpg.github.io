// "What is happening now?" — the phase being written, where the impulse is in the conduction
// pathway, and why the ECG looks the way it does at this instant.

import type { EcgRun } from '../../engine';
import type { Moment, PhaseId } from '../../engine/explain';
import { h, rich } from '../dom';
import { pathwayAt, type Step } from './pathway';
import './narration.css';

const PHASE_CLASS: Record<PhaseId, string> = {
  P: 'dep',
  PR: 'pr',
  QRS: 'dep',
  ST: 'plat',
  T: 'rep',
  U: 'rep',
  TP: 'rest',
  F: 'chaos',
  VF: 'chaos',
  blockedP: 'block',
};

const STATE_TEXT: Record<Step['state'], string> = {
  idle: 'waiting',
  now: 'active now',
  done: 'done',
  blocked: 'blocked',
  bypassed: 'not used',
  chaos: 'chaotic',
};

export class NarrationView {
  readonly el: HTMLDivElement;
  private head: HTMLDivElement;
  private track: HTMLOListElement;
  private live: HTMLDivElement;
  private body: HTMLDivElement;
  private detail: HTMLDetailsElement;
  private detailBody: HTMLDivElement;
  private key = '';
  private trackKey = '';

  constructor() {
    this.head = h('div', { class: 'nv-head' });
    this.track = h('ol', { class: 'nv-track', 'aria-label': 'Where the impulse is' });
    this.live = h('div', { class: 'nv-live' });
    this.body = h('div', { class: 'nv-body', 'aria-live': 'polite' });
    this.detailBody = h('div', { class: 'nv-comps' });
    this.detail = h('details', { class: 'nv-detail' }, h('summary', null, 'Wavefronts writing the ECG right now'), this.detailBody);
    this.el = h('div', { class: 'nv' }, this.head, this.track, this.body, this.detail, this.live);
  }

  render(m: Moment, run: EcgRun): void {
    const v = m.vector;
    const mag = Math.hypot(v[0], v[1], v[2]);
    this.live.textContent = `t = ${Math.round(m.t)} ms · heart vector ${mag.toFixed(2)} mV · ${m.lead} ${m.value >= 0 ? '+' : ''}${m.value.toFixed(2)} mV`;
    const steps = pathwayAt(run, m.t);
    const tk = steps.map((s) => `${s.id}:${s.state}:${s.note ?? ''}`).join('|');
    if (tk !== this.trackKey) {
      this.trackKey = tk;
      this.track.replaceChildren(
        ...steps.map((s) =>
          h(
            'li',
            { class: `nv-step ${s.state}`, title: `${s.label}: ${STATE_TEXT[s.state]}${s.note ? ` — ${s.note}` : ''}` },
            h('span', { class: 'nv-dot', 'aria-hidden': 'true' }, s.state === 'blocked' ? '✕' : s.state === 'chaos' ? '≈' : ''),
            h('span', { class: 'nv-lab' }, s.label, s.note ? h('small', null, s.note) : null),
            s.ecg ? h('span', { class: 'nv-ecg' }, s.ecg) : null,
            h('span', { class: 'sr-only' }, ` — ${STATE_TEXT[s.state]}`),
          ),
        ),
      );
    }
    const key = [m.phase.id, m.phase.t0.toFixed(0), ...m.conduction, ...m.why, ...m.comps.map((c) => c.tag)].join('|');
    if (key === this.key) {
      this.updateBars(m);
      return;
    }
    this.key = key;
    const [title, sub] = m.phase.label.split(' — ');
    this.head.replaceChildren(h('span', { class: `nv-chip ${PHASE_CLASS[m.phase.id]}` }, m.phase.id === 'blockedP' ? 'P' : m.phase.id === 'F' ? 'f' : m.phase.id), h('div', null, h('div', { class: 'nv-title' }, title), sub ? h('div', { class: 'nv-sub' }, sub) : null));
    this.body.replaceChildren(
      ...(m.conduction.length ? [h('h5', null, 'What is happening'), h('ul', { class: 'nv-cond' }, ...m.conduction.map((t) => h('li', null, rich(t))))] : []),
      ...(m.why.length ? [h('h5', null, 'Why the ECG looks like this'), ...m.why.map((t) => h('p', { class: 'nv-why' }, rich(t)))] : []),
    );
    this.detail.style.display = m.comps.length ? '' : 'none';
    this.detailBody.replaceChildren(
      h('p', { class: 'nv-note' }, 'The same dipoles the tracing is computed from. A wavefront heading toward a lead’s positive pole writes an upward deflection.'),
      ...m.comps.map((c) =>
        h(
          'div',
          { class: 'nv-comp' },
          h('div', { class: 'nv-bar' }, h('i', { style: `width:${Math.round(c.weight * 100)}%` })),
          h('div', null, h('strong', null, c.tag), ` — ${c.chamber}, heading ${c.heading}`),
          h('div', { class: 'nv-leads' }, c.toward.length ? `upward in ${c.toward.join(', ')}` : '', c.toward.length && c.away.length ? ' · ' : '', c.away.length ? `downward in ${c.away.join(', ')}` : ''),
        ),
      ),
    );
  }

  private updateBars(m: Moment): void {
    const bars = this.detailBody.querySelectorAll<HTMLElement>('.nv-bar i');
    m.comps.forEach((c, i) => {
      if (bars[i]) bars[i].style.width = `${Math.round(c.weight * 100)}%`;
    });
  }
}
