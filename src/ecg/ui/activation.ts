// Beat-by-beat activation stepper: shows how individual activation components (septum,
// apex, free walls, delayed regions) sum into the heart vector, trace the vector loop and
// write each lead's QRS. Used for normal activation and for every conduction abnormality.

import { buildVentBeat, type Comp } from '../engine/morphology';
import { shapeAt } from '../engine/morphology';
import { makePhysio, type Bundle, type Physio, type PhysioPatch, type VentSite } from '../engine/params';
import type { VentEvent } from '../engine/rhythm';
import { LEADS, type LeadId } from '../engine/leads';
import { h, s } from './dom';
import { slider } from './controls';

export type ActMode = { kind: 'bundle'; bundle: Bundle } | { kind: 'focus'; site: VentSite } | { kind: 'ap'; hisDelay: number };

const LEAD_SET: LeadId[] = ['I', 'aVF', 'aVL', 'III', 'V1', 'V6'];

function eventFor(mode: ActMode): VentEvent {
  const base: VentEvent = { t: 0, route: 'his', aberrant: 'none', hisDelay: 0, label: '', atrialIndex: -1, polyIndex: 0, junctional: false, mechanism: 'conducted' };
  if (mode.kind === 'focus') return { ...base, route: 'focus', site: mode.site, hisDelay: Infinity, mechanism: 'pvc' };
  if (mode.kind === 'ap') return { ...base, route: 'ap', apLocation: 'rightFreeWall', hisDelay: mode.hisDelay, mechanism: 'ap' };
  return base;
}

export class ActivationStepper {
  readonly el: HTMLDivElement;
  private t = 0;
  private comps: Comp[] = [];
  private qrsDur = 90;
  private frontal: SVGSVGElement;
  private horiz: SVGSVGElement;
  private leadsSvg: SVGSVGElement;
  private list: HTMLOListElement;
  private tSlider: HTMLDivElement;
  private p: Physio;
  private mode: ActMode;

  constructor(mode: ActMode, patch?: PhysioPatch) {
    this.mode = mode;
    this.p = makePhysio({ ...(patch ?? {}), noise: 0, bundle: mode.kind === 'bundle' ? mode.bundle : 'normal' });
    this.frontal = s('svg', { viewBox: '-110 -110 220 220', class: 'vec-svg', 'aria-label': 'Frontal-plane vector loop' });
    this.horiz = s('svg', { viewBox: '-110 -110 220 220', class: 'vec-svg', 'aria-label': 'Horizontal-plane vector loop' });
    this.leadsSvg = s('svg', { viewBox: '0 0 600 200', style: 'width:100%;height:auto;background:var(--ecg-paper);border:1px solid var(--line);border-radius:8px', 'aria-label': 'QRS written so far in six leads' });
    this.list = h('ol', { class: 'why' });
    this.tSlider = h('div');
    this.el = h(
      'div',
      null,
      this.tSlider,
      h('div', { class: 'vec-wrap' }, h('div', null, h('h3', null, 'Frontal plane'), this.frontal), h('div', null, h('h3', null, 'Horizontal plane'), this.horiz)),
      h('h3', null, 'QRS written so far'),
      this.leadsSvg,
      h('h3', null, 'Activation components (active now highlighted)'),
      this.list,
    );
    this.rebuild();
  }

  setMode(mode: ActMode): void {
    this.mode = mode;
    this.p = makePhysio({ noise: 0, bundle: mode.kind === 'bundle' ? mode.bundle : 'normal' });
    this.rebuild();
  }

  private rebuild(): void {
    const beat = buildVentBeat(this.p, eventFor(this.mode), { rr: 850, index: 0, seed: 1 });
    this.qrsDur = beat.qrsDur;
    this.comps = beat.comps.filter((c) => c.t0 < beat.qrsDur);
    this.t = Math.min(this.t, this.qrsDur + 10);
    this.tSlider.replaceChildren(
      slider({ label: 'Time from QRS onset', min: 0, max: Math.ceil(this.qrsDur + 15), step: 1, value: this.t, unit: 'ms', help: 'Step through ventricular activation. The red arrow is the instantaneous heart vector; the line behind it is the vector loop.', onInput: (v) => ((this.t = v), this.draw()) }),
    );
    this.draw();
  }

  private vecAt(t: number): [number, number, number] {
    let x = 0;
    let y = 0;
    let z = 0;
    for (const c of this.comps) {
      const k = c.amp * shapeAt(c.shape, (t - c.t0) / c.dur);
      x += c.dir[0] * k;
      y += c.dir[1] * k;
      z += c.dir[2] * k;
    }
    return [x, y, z];
  }

  private draw(): void {
    const loop: [number, number, number][] = [];
    for (let t = 0; t <= this.qrsDur + 12; t += 2) loop.push(this.vecAt(t));
    const now = this.vecAt(this.t);
    const K = 60;
    for (const [svg, plane] of [
      [this.frontal, 'f'],
      [this.horiz, 'h'],
    ] as const) {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.append(s('circle', { r: 95, fill: 'none', stroke: 'var(--line)' }));
      const axes: LeadId[] = plane === 'f' ? ['I', 'II', 'III', 'aVR', 'aVL', 'aVF'] : ['V1', 'V2', 'V3', 'V4', 'V5', 'V6'];
      for (const id of axes) {
        const a = LEADS[id].axis;
        const [ax, ay] = plane === 'f' ? [a[0], a[1]] : [a[0], -a[2]];
        const n = Math.hypot(ax, ay);
        svg.append(s('line', { x1: 0, y1: 0, x2: (ax / n) * 95, y2: (ay / n) * 95, class: 'vec-axis pos' }), s('text', { x: (ax / n) * 100 - 8, y: (ay / n) * 100 + 4, class: 'vec-lab', 'font-size': 9 }, id));
      }
      const pt = (v: [number, number, number]): [number, number] => (plane === 'f' ? [v[0] * K, v[1] * K] : [v[0] * K, -v[2] * K]);
      const full = loop.map(pt);
      svg.append(s('polyline', { points: full.map((q) => q.join(',')).join(' '), fill: 'none', stroke: 'var(--muted)', 'stroke-width': 1.2, 'stroke-dasharray': '3 2' }));
      const upto = loop.slice(0, Math.floor(this.t / 2) + 1).map(pt);
      svg.append(s('polyline', { points: upto.map((q) => q.join(',')).join(' '), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2.2 }));
      const [x, y] = pt(now);
      svg.append(s('line', { x1: 0, y1: 0, x2: x, y2: y, stroke: 'var(--danger)', 'stroke-width': 3.5 }), s('circle', { cx: x, cy: y, r: 4, fill: 'var(--danger)' }));
    }
    // Leads
    const g = this.leadsSvg;
    while (g.firstChild) g.removeChild(g.firstChild);
    LEAD_SET.forEach((id, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x0 = 20 + col * 195;
      const y0 = 55 + row * 95;
      g.append(s('line', { x1: x0, y1: y0, x2: x0 + 170, y2: y0, stroke: 'var(--ecg-major)', 'stroke-width': 0.6 }), s('text', { x: x0, y: y0 - 38, class: 'vec-lab' }, id));
      const L = LEADS[id];
      let d = '';
      for (let t = 0; t <= this.t && t <= this.qrsDur + 12; t += 1) {
        const v = this.vecAt(t);
        const val = L.gain * (v[0] * L.axis[0] + v[1] * L.axis[1] + v[2] * L.axis[2]);
        d += `${t === 0 ? 'M' : 'L'}${x0 + t * 1.3} ${y0 - val * 26} `;
      }
      g.append(s('path', { d, fill: 'none', stroke: 'var(--ecg-ink)', 'stroke-width': 1.8 }));
    });
    // Component list
    this.list.replaceChildren(
      ...this.comps.map((c) => {
        const active = this.t >= c.t0 && this.t <= c.t0 + c.dur;
        const li = h('li', { style: active ? 'background:var(--accent-soft);border-radius:6px' : 'opacity:0.7' }, h('span', { class: 'lvl' }, `${Math.round(c.t0)}–${Math.round(c.t0 + c.dur)} ms`), c.tag);
        return li;
      }),
    );
  }
}
