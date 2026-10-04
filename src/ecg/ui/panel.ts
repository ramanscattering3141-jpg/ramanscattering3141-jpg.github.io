// Composite "live ECG" panel: ECG paper + measurements + conduction animation (3-D heart or
// 2-D schematic) + slow-motion playback with a time-resolved explanation of what the heart is
// doing and which part of the ECG it is writing.
// Used by diagnosis pages, labs, the simulator and the case/challenge generators.

import { runEcg, type EcgRun, type LeadId, type Physio } from '../engine';
import { explainAt, type Moment } from '../engine/explain';
import { TWELVE } from '../engine/leads';
import { EcgView, type EcgViewOptions } from './ecgView';
import { HeartView } from './heart';
import { ExplainerView } from './explainer';
import { h } from './dom';
import { button, segmented } from './controls';
import type { Heart3D } from './heart3d';

export interface PanelOptions extends Partial<EcgViewOptions> {
  duration?: number;
  heart?: boolean;
  /** Start with the 3-D heart (falls back to the 2-D schematic without WebGL). Default true. */
  heart3d?: boolean;
  /** Larger heart (dedicated 3-D page). */
  large?: boolean;
  measurements?: boolean;
  compact?: boolean;
  layoutToggle?: boolean;
  onRun?: (run: EcgRun) => void;
}

const SPEEDS: [string, string][] = [
  ['1', '1× (real time)'],
  ['0.5', '0.5×'],
  ['0.25', '0.25×'],
  ['0.1', '0.1×'],
  ['0.05', '0.05×'],
  ['0.02', '0.02×'],
  ['0.01', '0.01× (1 ms per 0.1 s)'],
];

export class EcgPanel {
  readonly el: HTMLDivElement;
  readonly view: EcgView;
  heart: HeartView | null = null;
  heart3d: Heart3D | null = null;
  run: EcgRun | null = null;
  private meas: HTMLDivElement;
  private raf = 0;
  private playing = false;
  private t = 0;
  private speed = 0.1;
  private last = 0;
  private lead: LeadId = 'II';
  private loopBeat = false;
  private playBtn: HTMLButtonElement | null = null;
  private scrub: HTMLInputElement | null = null;
  private timeOut: HTMLOutputElement | null = null;
  private heartSlot: HTMLDivElement | null = null;
  private explainer: ExplainerView | null = null;
  private mode: '3d' | '2d' = '2d';
  private opts: PanelOptions;
  private destroyed = false;

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
    let top: HTMLElement | null = null;
    let playback: HTMLElement | null = null;
    if (opts.heart) {
      this.heartSlot = h('div', { class: 'heart-slot' });
      this.explainer = new ExplainerView();
      const want3d = opts.heart3d !== false;
      tools.append(
        segmented<'3d' | '2d'>(
          [
            ['3d', '3-D heart'],
            ['2d', '2-D schematic'],
          ],
          want3d ? '3d' : '2d',
          (v) => void this.setMode(v),
          'Heart',
        ),
      );
      const leadSel = h('select', { 'aria-label': 'Lead to project onto' }, ...TWELVE.map((l) => h('option', { value: l, selected: l === this.lead }, l)));
      leadSel.addEventListener('change', () => {
        this.lead = leadSel.value as LeadId;
        this.heart3d?.setLead(this.lead);
        this.view.setOptions({ highlight: [this.lead] });
        this.setTime(this.t);
      });
      tools.append(h('div', { class: 'ctl' }, h('span', { class: 'ctl-lab' }, 'Explain lead'), leadSel));
      playback = this.buildPlayback();
      top = h('div', { class: `heart-row ${opts.large ? 'large' : ''}` }, this.heartSlot, this.explainer.el);
      this.heart = new HeartView();
      this.view.onSeek = (t) => {
        this.stop();
        this.setTime(t);
      };
      this.mode = '2d';
      this.heartSlot.append(this.heart.root);
      if (want3d) void this.setMode('3d');
    }
    const body = h('div', { class: 'panel-body' }, top, playback, h('div', { class: 'panel-ecg' }, this.view.el));
    this.el = h('div', { class: `ecg-panel ${opts.compact ? 'compact' : ''}` }, tools, body, opts.measurements === false ? null : this.meas);
    if (opts.heart) {
      this.el.tabIndex = -1;
      this.el.addEventListener('keydown', (e) => {
        const tg = e.target as HTMLElement;
        if (tg instanceof HTMLInputElement || tg instanceof HTMLSelectElement || tg instanceof HTMLButtonElement || tg instanceof HTMLTextAreaElement) return;
        this.handleKey(e);
      });
    }
  }

  private buildPlayback(): HTMLElement {
    this.playBtn = button('▶ Play', () => this.toggle(), 'btn-primary');
    const speed = h('select', { 'aria-label': 'Playback speed' }, ...SPEEDS.map(([v, t]) => h('option', { value: v, selected: Number(v) === this.speed }, t)));
    speed.addEventListener('change', () => (this.speed = Number(speed.value)));
    const step = (ms: number, label: string, title: string): HTMLButtonElement => {
      const b = button(label, () => {
        this.stop();
        this.setTime(this.t + ms);
      });
      b.title = title;
      b.setAttribute('aria-label', title);
      return b;
    };
    const beatJump = (dir: 1 | -1): HTMLButtonElement => {
      const b = button(dir > 0 ? 'Next beat ⏭' : '⏮ Prev beat', () => {
        this.stop();
        const run = this.run;
        if (!run) return;
        // Jump to 60 ms before the next/previous QRS so the P wave and PR are included.
        const starts = run.sig.beats.map((x) => x.ev.t).filter((x) => x >= 0);
        const cur = this.t + 61;
        const target = dir > 0 ? starts.find((x) => x > cur + 1) : [...starts].reverse().find((x) => x < cur - 1);
        if (target !== undefined) this.setTime(Math.max(0, target - 260));
      });
      return b;
    };
    this.scrub = h('input', { type: 'range', min: 0, max: 10000, step: 1, value: 0, 'aria-label': 'Time in strip (ms)', class: 'scrub' });
    this.scrub.addEventListener('input', () => {
      this.stop();
      this.setTime(Number(this.scrub!.value));
    });
    this.timeOut = h('output', { class: 'pb-time' }, '0 ms');
    const loop = h('input', { type: 'checkbox' });
    loop.addEventListener('change', () => (this.loopBeat = loop.checked));
    return h(
      'div',
      { class: 'playback' },
      h('div', { class: 'pb-row' }, this.playBtn, h('label', { class: 'pb-speed' }, 'Speed ', speed), beatJump(-1), step(-10, '−10 ms', 'Step back 10 ms'), step(-1, '−1 ms', 'Step back 1 ms'), step(1, '+1 ms', 'Step forward 1 ms'), step(10, '+10 ms', 'Step forward 10 ms'), beatJump(1), h('label', { class: 'pb-loop' }, loop, ' Loop this beat')),
      h('div', { class: 'pb-row' }, this.scrub, this.timeOut),
      h('div', { class: 'pb-hint' }, 'Tip: click anywhere on the ECG to jump there. Keyboard: Space play/pause, ← → step 1 ms (Shift: 10 ms).'),
    );
  }

  private async setMode(m: '3d' | '2d'): Promise<void> {
    if (!this.heartSlot) return;
    if (m === '3d') {
      try {
        const mod = await import('./heart3d');
        if (this.destroyed || !mod.Heart3D.supported()) throw new Error('no webgl');
        if (!this.heart3d) {
          this.heart3d = new mod.Heart3D({ height: this.opts.large ? 520 : 380 });
          this.heart3d.setLead(this.lead);
        }
        this.heartSlot.replaceChildren(this.heart3d.root);
        this.mode = '3d';
        if (this.run) this.heart3d.setRun(this.run);
        this.heart3d.setTime(this.t);
        return;
      } catch {
        m = '2d';
      }
    }
    this.mode = '2d';
    if (this.heart) this.heartSlot.replaceChildren(this.heart.root);
    this.heart?.setTime(this.t);
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
    this.heart3d?.setRun(run);
    this.renderMeasurements();
    this.opts.onRun?.(run);
    if (this.scrub) this.scrub.max = String(run.sim.duration);
    if (!this.playing) {
      if (this.opts.heart) {
        // Park the cursor just before the first complete beat so the explanation is meaningful.
        const first = run.sig.beats.find((b) => b.ev.t >= 300);
        this.setTime(first ? Math.max(0, first.ev.t - 260) : 0);
      } else {
        this.view.setCursor(null);
        this.t = 0;
      }
    }
  }

  /** Move every view to time t (ms) and update the explanation. */
  setTime(t: number): void {
    const run = this.run;
    if (!run) return;
    const dur = run.sim.duration;
    this.t = Math.max(0, Math.min(dur, t));
    let m: Moment | null = null;
    if (this.explainer) {
      m = explainAt(run, this.t, this.lead);
      this.explainer.render(m);
    }
    this.view.setCursorAndSegment(this.t, m ? { t0: m.phase.t0, t1: m.phase.t1, label: m.phase.id === 'blockedP' ? 'blocked P' : m.phase.id } : null);
    if (this.mode === '3d') this.heart3d?.setTime(this.t);
    else this.heart?.setTime(this.t);
    if (this.scrub) this.scrub.value = String(Math.round(this.t));
    if (this.timeOut) this.timeOut.textContent = `${Math.round(this.t)} ms`;
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
      ['Frontal QRS axis', m.axis === null ? 'indeterminate' : `${m.axis}° (${m.axisLabel})${m.trueAxis !== m.axis ? ` — recorded with swapped cables; true axis ${m.trueAxis}°` : ''}`],
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
    const loopStart = this.t;
    const beatEnd = (): number => {
      const run = this.run!;
      const b = run.sig.beats.find((x) => x.ev.t > loopStart + 260);
      return b ? b.ev.t + b.morph.tEnd + 80 : run.sim.duration;
    };
    const end = this.loopBeat ? beatEnd() : Infinity;
    const step = (now: number): void => {
      if (!this.playing || !this.run) return;
      const dt = Math.min(100, now - this.last);
      this.last = now;
      let t = this.t + dt * this.speed;
      if (t > Math.min(end, this.run.sim.duration)) t = this.loopBeat ? loopStart : 0;
      this.setTime(t);
      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  stop(): void {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    if (this.playBtn) this.playBtn.textContent = '▶ Play';
  }

  /** Keyboard control while the panel has focus. */
  handleKey(e: KeyboardEvent): void {
    if (!this.opts.heart) return;
    if (e.key === ' ') {
      e.preventDefault();
      this.toggle();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      this.stop();
      this.setTime(this.t + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1));
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.stop();
    this.view.destroy();
    this.heart3d?.destroy();
    this.heart3d = null;
  }

  static leads(ids: LeadId[]): LeadId[] {
    return ids;
  }
}
