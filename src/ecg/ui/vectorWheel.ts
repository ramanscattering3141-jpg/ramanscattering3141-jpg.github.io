// Interactive dual-plane (frontal + horizontal) vector explorer. The learner drags the
// cardiac vector; each lead's deflection is recomputed as the projection on its axis.

import { LEADS, TWELVE, type LeadId } from '../engine/leads';
import { dot, len, type Vec3 } from '../engine/vec';
import { h, s } from './dom';

export class VectorExplorer {
  readonly el: HTMLDivElement;
  private v: [number, number, number];
  private frontal: SVGSVGElement;
  private horiz: SVGSVGElement;
  private minis: Map<LeadId, SVGPathElement> = new Map();
  private readout: HTMLDivElement;
  onChange?: (v: Vec3) => void;

  constructor(initial: Vec3 = [0.6, 0.75, -0.2], opts: { horizontal?: boolean; leads?: LeadId[] } = {}) {
    this.v = [initial[0], initial[1], initial[2]];
    this.frontal = this.wheel('frontal');
    this.horiz = this.wheel('horizontal');
    this.readout = h('div', { class: 'ref-meta', 'aria-live': 'polite' });
    const leads = opts.leads ?? TWELVE;
    const grid = h('div', { class: 'mini-grid' });
    for (const id of leads) {
      const path = s('path', { d: '' });
      grid.append(h('div', { class: 'mini' }, id, s('svg', { viewBox: '0 0 100 60', preserveAspectRatio: 'none' }, s('line', { x1: 0, y1: 30, x2: 100, y2: 30, class: 'base' }), path)));
      this.minis.set(id, path);
    }
    const wheels = h('div', { class: 'vec-wrap' }, h('div', null, h('h3', null, 'Frontal plane (limb leads)'), this.frontal), opts.horizontal === false ? null : h('div', null, h('h3', null, 'Horizontal plane (chest leads)'), this.horiz));
    this.el = h('div', null, wheels, this.readout, h('h3', null, 'What each lead records'), grid);
    this.update();
  }

  get vector(): Vec3 {
    return [this.v[0], this.v[1], this.v[2]];
  }

  set(v: Vec3): void {
    this.v = [v[0], v[1], v[2]];
    this.update();
  }

  private wheel(plane: 'frontal' | 'horizontal'): SVGSVGElement {
    const svg = s('svg', { viewBox: '-130 -130 260 260', class: 'vec-svg', role: 'application', 'aria-label': `${plane} plane vector — drag the red arrow or use arrow keys`, tabindex: '0' });
    svg.append(s('defs', null, s('marker', { id: 'arrowhead', viewBox: '0 0 10 10', refX: 6, refY: 5, markerWidth: 4, markerHeight: 4, orient: 'auto-start-reverse' }, s('path', { d: 'M0 0 L10 5 L0 10z', fill: 'var(--danger)' }))));
    svg.append(s('circle', { cx: 0, cy: 0, r: 100, fill: 'none', stroke: 'var(--line)' }));
    const ids = TWELVE.filter((id) => LEADS[id].plane === plane);
    for (const id of ids) {
      const a = LEADS[id].axis;
      const [x, y] = plane === 'frontal' ? [a[0], a[1]] : [a[0], -a[2]];
      const n = Math.hypot(x, y) || 1;
      svg.append(s('line', { x1: (-x / n) * 100, y1: (-y / n) * 100, x2: (x / n) * 100, y2: (y / n) * 100, class: 'vec-axis' }));
      svg.append(s('line', { x1: 0, y1: 0, x2: (x / n) * 100, y2: (y / n) * 100, class: 'vec-axis pos' }));
      svg.append(s('text', { x: (x / n) * 116 - 9, y: (y / n) * 116 + 4, class: 'vec-lab' }, `${id}+`));
    }
    if (plane === 'frontal') {
      for (const [deg, lab] of [[0, '0°'], [90, '+90°'], [180, '±180°'], [-90, '−90°']] as const) {
        const r = (deg * Math.PI) / 180;
        svg.append(s('text', { x: Math.cos(r) * 78 - 10, y: Math.sin(r) * 78 + 4, class: 'ref-meta', 'font-size': 8, fill: 'var(--muted)' }, lab));
      }
    } else {
      svg.append(s('text', { x: -125, y: -118, class: 'ref-meta', 'font-size': 8, fill: 'var(--muted)' }, '↑ anterior'));
      svg.append(s('text', { x: -125, y: 125, class: 'ref-meta', 'font-size': 8, fill: 'var(--muted)' }, '↓ posterior'));
    }
    const arrow = s('line', { x1: 0, y1: 0, x2: 0, y2: 0, class: 'vec-arrow', 'data-arrow': '1' });
    const handle = s('circle', { r: 9, class: 'vec-handle', 'data-handle': '1' });
    svg.append(arrow, handle);
    const toSvg = (e: PointerEvent): [number, number] => {
      const r = svg.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * 260 - 130, ((e.clientY - r.top) / r.height) * 260 - 130];
    };
    let drag = false;
    const apply = (px: number, py: number): void => {
      const mag = Math.min(1.25, Math.hypot(px, py) / 80);
      const ang = Math.atan2(py, px);
      if (plane === 'frontal') {
        this.v[0] = Math.cos(ang) * mag;
        this.v[1] = Math.sin(ang) * mag;
      } else {
        this.v[0] = Math.cos(ang) * mag;
        this.v[2] = -Math.sin(ang) * mag;
      }
      this.update();
    };
    svg.addEventListener('pointerdown', (e) => {
      drag = true;
      svg.setPointerCapture(e.pointerId);
      apply(...toSvg(e));
    });
    svg.addEventListener('pointermove', (e) => {
      if (drag) apply(...toSvg(e));
    });
    svg.addEventListener('pointerup', () => (drag = false));
    svg.addEventListener('keydown', (e) => {
      const step = (5 * Math.PI) / 180;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const sign = e.key === 'ArrowRight' ? 1 : -1;
      const [a, b] = plane === 'frontal' ? [this.v[0], this.v[1]] : [this.v[0], -this.v[2]];
      const mag = Math.hypot(a, b) || 0.8;
      const ang = Math.atan2(b, a) + sign * step;
      apply(Math.cos(ang) * mag * 80, Math.sin(ang) * mag * 80);
    });
    return svg;
  }

  private update(): void {
    for (const [svg, plane] of [
      [this.frontal, 'frontal'],
      [this.horiz, 'horizontal'],
    ] as const) {
      const [x, y] = plane === 'frontal' ? [this.v[0], this.v[1]] : [this.v[0], -this.v[2]];
      const arrow = svg.querySelector('[data-arrow]')!;
      const handle = svg.querySelector('[data-handle]')!;
      arrow.setAttribute('x2', String(x * 80));
      arrow.setAttribute('y2', String(y * 80));
      handle.setAttribute('cx', String(x * 80));
      handle.setAttribute('cy', String(y * 80));
    }
    const v = this.v as unknown as Vec3;
    for (const [id, path] of this.minis) {
      const a = dot(v, LEADS[id].axis) * (LEADS[id].plane === 'horizontal' ? 1.2 : 1);
      // Draw a stylised complex whose net area equals the projection.
      let d = 'M0 30';
      for (let i = 0; i <= 100; i += 2) {
        const u = (i - 30) / 40;
        const sh = u > 0 && u < 1 ? Math.sin(Math.PI * u) ** 2 : 0;
        d += ` L${i} ${30 - a * 24 * sh}`;
      }
      path.setAttribute('d', d);
    }
    const ang = Math.round((Math.atan2(this.v[1], this.v[0]) * 180) / Math.PI);
    const pos = TWELVE.filter((id) => dot(v, LEADS[id].axis) > 0.15 * len(v));
    const neg = TWELVE.filter((id) => dot(v, LEADS[id].axis) < -0.15 * len(v));
    this.readout.textContent = `Frontal angle ${ang}° · ${this.v[2] >= 0 ? 'anterior' : 'posterior'} component ${Math.abs(this.v[2]).toFixed(2)} · Positive in: ${pos.join(', ') || '—'} · Negative in: ${neg.join(', ') || '—'}`;
    this.onChange?.(v);
  }
}
