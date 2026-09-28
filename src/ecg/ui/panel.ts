// Composite "live ECG" panel: ECG paper + measurements + optional conduction animation.
// Used by diagnosis pages, labs, the simulator and the case/challenge generators.

import { runEcg, type EcgRun, type LeadId, type Physio } from '../engine';
import { EcgView, type EcgViewOptions } from './ecgView';
import { HeartView } from './heart';
import { h } from './dom';
import { button, segmented } from './controls';

export interface PanelOptions extends Partial<EcgViewOptions> {
  duration?: number;
  heart?: boolean;
  measurements?: boolean;
  compact?: boolean;
  layoutToggle?: boolean;
  onRun?: (run: EcgRun) => void;
}

export class EcgPanel {
  readonly el: HTMLDivElement;
  readonly view: EcgView;
  heart: HeartView | null = null;
  run: EcgRun | null = null;
  private meas: HTMLDivElement;
  private raf = 0;
  private playing = false;
  private t = 0;
  private speed = 0.25;
  private last = 0;
  private playBtn: HTMLButtonElement | null = null;
  private opts: PanelOptions;

  constructor(opts: PanelOptions = {}) {
    this.opts = opts;
    this.view = new EcgView({ layout: opts.layout ?? '12', ...opts });
    this.meas = h('div', { class: 'meas' });
    const tools = h('div', { class: 'panel-tools' });
    if (opts.layoutToggle !== false) {
      tools.append(
        segmented<'12' | 'strip'>(
          [
            ['12', '12-lead'],
            ['strip', 'Rhythm strip + ladder'],
          ],
          opts.layout === 'strips' ? 'strip' : '12',
          (v) => this.view.setOptions(v === '12' ? { layout: '12', showLadder: false, showLabels: false } : { layout: 'strips', leads: opts.leads ?? ['II', 'V1'], showLadder: true, showLabels: true }),
          'View',
        ),
      );
    }
    if (opts.heart) {
      this.heart = new HeartView();
      this.playBtn = button('▶ Animate conduction', () => this.toggle(), 'btn-primary');
      tools.append(
        this.playBtn,
        segmented<'0.1' | '0.25' | '1'>(
          [
            ['0.1', '0.1×'],
            ['0.25', '0.25×'],
            ['1', '1×'],
          ],
          '0.25',
          (v) => (this.speed = parseFloat(v)),
          'Speed',
        ),
      );
    }
    const body = h('div', { class: `panel-body ${opts.heart ? 'with-heart' : ''}` }, h('div', { class: 'panel-ecg' }, this.view.el), this.heart ? this.heart.root : null);
    this.el = h('div', { class: `ecg-panel ${opts.compact ? 'compact' : ''}` }, tools, body, opts.measurements === false ? null : this.meas);
  }

  setDuration(ms: number): void {
    this.opts.duration = ms;
  }

  show(p: Physio): EcgRun {
    const run = runEcg(p, this.opts.duration ?? 10000);
    this.setRun(run);
    return run;
  }

  setRun(run: EcgRun): void {
    this.run = run;
    this.view.setRun(run);
    this.heart?.setRun(run);
    this.renderMeasurements();
    this.opts.onRun?.(run);
    if (!this.playing) {
      this.view.setCursor(null);
      this.t = 0;
    }
  }

  private renderMeasurements(): void {
    const m = this.run!.m;
    const f = (v: number | null, u = ''): string => (v === null || Number.isNaN(v) ? '—' : `${v}${u}`);
    const items: [string, string][] = [
      ['Ventricular rate', f(m.ventRate, '/min')],
      ['Atrial rate', f(m.atrialRate, '/min')],
      ['Rhythm', m.regularity],
      ['PR', m.prRange && m.prRange[1] - m.prRange[0] > 20 ? `${m.prRange[0]}–${m.prRange[1]} ms` : f(m.pr, ' ms')],
      ['QRS', f(m.qrs, ' ms')],
      ['QT / QTc (Bazett · Fridericia)', m.qt ? `${m.qt} / ${m.qtcBazett} · ${m.qtcFridericia} ms` : '—'],
      ['Frontal QRS axis', m.axis === null ? 'indeterminate' : `${m.axis}° (${m.axisLabel})`],
      ['AV relationship', m.avRelation],
    ];
    this.meas.replaceChildren(h('div', { class: 'meas-title' }, 'Model measurements (ground truth from the simulation)'), h('dl', null, ...items.map(([k, v]) => h('div', { class: 'meas-item' }, h('dt', null, k), h('dd', null, v)))));
  }

  toggle(): void {
    if (this.playing) this.stop();
    else this.play();
  }

  play(): void {
    if (!this.run) return;
    this.playing = true;
    if (this.playBtn) this.playBtn.textContent = '❚❚ Pause';
    this.last = performance.now();
    const step = (now: number): void => {
      if (!this.playing || !this.run) return;
      const dt = Math.min(100, now - this.last);
      this.last = now;
      this.t += dt * this.speed;
      if (this.t > this.run.sim.duration) this.t = 0;
      this.view.setCursor(this.t);
      this.heart?.setTime(this.t);
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  stop(): void {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    if (this.playBtn) this.playBtn.textContent = '▶ Animate conduction';
  }

  destroy(): void {
    this.stop();
    this.view.destroy();
  }

  static leads(ids: LeadId[]): LeadId[] {
    return ids;
  }
}
