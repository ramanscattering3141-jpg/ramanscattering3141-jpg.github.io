// ECG paper renderer: standard 3×4 12-lead layout with rhythm strip, stacked strips,
// conduction ladder diagram, annotations and on-screen calipers.

import { LAYOUT_3x4, type LeadId } from '../engine/leads';
import type { EcgRun } from '../engine';
import type { LadderSeg } from '../engine/rhythm';
import { css, h } from './dom';

export type Layout = '12' | 'strips';

export interface EcgViewOptions {
  layout: Layout;
  leads?: LeadId[]; // for 'strips'
  rhythmLead?: LeadId; // bottom strip of 12-lead layout (null to hide)
  showRhythm?: boolean;
  showLadder?: boolean;
  showLabels?: boolean;
  speed?: number; // mm/s
  gain?: number; // mm/mV
  rowMm?: number; // height of a row in mm
  minPxPerMm?: number;
  highlight?: LeadId[];
  caption?: string;
}

const DEF: Required<Omit<EcgViewOptions, 'leads' | 'highlight' | 'caption'>> = {
  layout: '12',
  rhythmLead: 'II',
  showRhythm: true,
  showLadder: false,
  showLabels: false,
  speed: 25,
  gain: 10,
  rowMm: 28,
  minPxPerMm: 3,
};

interface Strip {
  lead: LeadId;
  x0: number; // mm
  y0: number; // mm baseline
  t0: number; // ms
  t1: number;
  label: boolean;
}

export class EcgView {
  readonly el: HTMLDivElement;
  private base: HTMLCanvasElement;
  private over: HTMLCanvasElement;
  private scroller: HTMLDivElement;
  private run: EcgRun | null = null;
  private o: EcgViewOptions & typeof DEF;
  private pxmm = 3;
  private wMm = 0;
  private hMm = 0;
  private strips: Strip[] = [];
  private ladderY = 0;
  private rhythmStrip: Strip | null = null;
  private cursor: number | null = null;
  private seg: { t0: number; t1: number; label: string } | null = null;
  /** Called with a time (ms) when the user taps the tracing without dragging. */
  onSeek: ((t: number) => void) | null = null;
  private cal: { x0: number; x1: number; y: number } | null = null;
  private ro: ResizeObserver;
  private readout: HTMLSpanElement;
  private scaleTag: HTMLSpanElement;

  constructor(opts: EcgViewOptions) {
    this.o = { ...DEF, ...opts };
    this.base = h('canvas', { class: 'ecg-base', 'aria-hidden': 'true' });
    this.over = h('canvas', { class: 'ecg-over' });
    this.readout = h('span', { 'aria-live': 'polite' });
    // Paper speed and gain sit under the tracing (not on the canvas), so they stay visible when a
    // wide tracing scrolls horizontally on a narrow screen.
    this.scaleTag = h('span', { class: 'ecg-scale' });
    this.scroller = h('div', { class: 'ecg-scroll' }, h('div', { class: 'ecg-stack' }, this.base, this.over));
    this.el = h('div', { class: 'ecg-view' }, this.scroller, h('div', { class: 'ecg-readout' }, this.readout, this.scaleTag));
    this.over.setAttribute('role', 'img');
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(this.el);
    this.bindCalipers();
  }

  setRun(run: EcgRun): void {
    this.run = run;
    this.over.setAttribute('aria-label', `Simulated ECG: ventricular rate ${run.m.ventRate ?? 'n/a'}/min, ${run.m.regularity}, QRS ${run.m.qrs ?? 'n/a'} ms`);
    this.layout();
  }

  setOptions(opts: Partial<EcgViewOptions>): void {
    this.o = { ...this.o, ...opts };
    this.layout();
  }

  setCursor(t: number | null): void {
    this.cursor = t;
    this.drawOverlay();
  }

  /** Highlight the ECG segment currently being written (drawn from its start up to the cursor). */
  setSegment(seg: { t0: number; t1: number; label: string } | null): void {
    this.seg = seg;
    this.drawOverlay();
  }

  setCursorAndSegment(t: number | null, seg: { t0: number; t1: number; label: string } | null): void {
    this.cursor = t;
    this.seg = seg;
    this.drawOverlay();
  }

  destroy(): void {
    this.ro.disconnect();
  }

  // ------------------------------------------------------------------ layout
  private layout(): void {
    const run = this.run;
    if (!run) return;
    const o = this.o;
    const dur = run.sim.duration;
    const mmPerMs = o.speed / 1000;
    this.strips = [];
    let y = 0;
    const calMm = 6;
    if (o.layout === '12') {
      const colMs = dur / 4;
      const colMm = colMs * mmPerMs;
      LAYOUT_3x4.forEach((row, r) => {
        row.forEach((lead, c) => {
          this.strips.push({ lead, x0: calMm + c * colMm, y0: y + o.rowMm * (r + 0.55), t0: c * colMs, t1: (c + 1) * colMs, label: true });
        });
      });
      y += o.rowMm * 3;
      this.wMm = calMm + 4 * colMm + 2;
      if (o.showRhythm && o.rhythmLead) {
        const st: Strip = { lead: o.rhythmLead, x0: calMm, y0: y + o.rowMm * 0.55, t0: 0, t1: dur, label: true };
        this.strips.push(st);
        this.rhythmStrip = st;
        y += o.rowMm;
      } else this.rhythmStrip = null;
    } else {
      const leads = o.leads ?? ['II'];
      this.wMm = calMm + dur * mmPerMs + 2;
      leads.forEach((lead, i) => {
        const st: Strip = { lead, x0: calMm, y0: y + o.rowMm * 0.55, t0: 0, t1: dur, label: true };
        this.strips.push(st);
        if (i === leads.length - 1) this.rhythmStrip = st;
        y += o.rowMm;
      });
    }
    this.ladderY = y;
    if (o.showLadder) y += run.physio.rhythm.ap.present ? 30 : 24;
    this.hMm = y + 1;

    const avail = Math.max(280, this.el.clientWidth || 800);
    this.pxmm = Math.max(o.minPxPerMm, avail / this.wMm);
    const wPx = Math.round(this.wMm * this.pxmm);
    const hPx = Math.round(this.hMm * this.pxmm);
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    for (const c of [this.base, this.over]) {
      c.width = Math.round(wPx * dpr);
      c.height = Math.round(hPx * dpr);
      c.style.width = `${wPx}px`;
      c.style.height = `${hPx}px`;
    }
    this.drawBase();
    this.drawOverlay();
  }

  // ------------------------------------------------------------------ drawing
  private drawBase(): void {
    const run = this.run!;
    const ctx = this.base.getContext('2d')!;
    const dpr = this.base.width / parseFloat(this.base.style.width);
    ctx.setTransform(dpr * this.pxmm, 0, 0, dpr * this.pxmm, 0, 0);
    const paper = css('--ecg-paper') || '#fff7f5';
    const minor = css('--ecg-minor') || '#f6c9c4';
    const major = css('--ecg-major') || '#e8958d';
    const ink = css('--ecg-ink') || '#1a1a1a';
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, this.wMm, this.hMm);
    // grid
    ctx.lineWidth = 0.06;
    ctx.strokeStyle = minor;
    ctx.beginPath();
    for (let x = 0; x <= this.wMm; x += 1) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.hMm);
    }
    for (let y = 0; y <= this.hMm; y += 1) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.wMm, y);
    }
    ctx.stroke();
    ctx.lineWidth = 0.14;
    ctx.strokeStyle = major;
    ctx.beginPath();
    for (let x = 0; x <= this.wMm; x += 5) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.hMm);
    }
    for (let y = 0; y <= this.hMm; y += 5) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.wMm, y);
    }
    ctx.stroke();

    const o = this.o;
    const mmPerMs = o.speed / 1000;
    const sig = run.sig;
    const hl = new Set(o.highlight ?? []);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // calibration pulses (1 mV, 200 ms) at the start of each row
    const rows = new Set(this.strips.map((s) => s.y0));
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.28;
    for (const y0 of rows) {
      ctx.beginPath();
      ctx.moveTo(0.5, y0);
      ctx.lineTo(1.5, y0);
      ctx.lineTo(1.5, y0 - o.gain);
      ctx.lineTo(1.5 + 200 * mmPerMs, y0 - o.gain);
      ctx.lineTo(1.5 + 200 * mmPerMs, y0);
      ctx.lineTo(5.5, y0);
      ctx.stroke();
    }
    for (const st of this.strips) {
      const data = sig.leads[st.lead];
      if (!data) continue;
      const i0 = Math.max(0, Math.round(((st.t0 - sig.from) * sig.fs) / 1000));
      const i1 = Math.min(sig.n - 1, Math.round(((st.t1 - sig.from) * sig.fs) / 1000));
      const isHl = hl.has(st.lead);
      if (isHl) {
        ctx.fillStyle = css('--ecg-hl') || 'rgba(255,200,0,0.18)';
        ctx.fillRect(st.x0, st.y0 - o.rowMm * 0.55, (st.t1 - st.t0) * mmPerMs, o.rowMm);
      }
      ctx.strokeStyle = ink;
      ctx.lineWidth = isHl ? 0.36 : 0.26;
      ctx.beginPath();
      // On a dense canvas, pairs of samples are drawn as their min and max (in time order) rather
      // than dropping every other sample, so 1–2 ms events (pacing spikes) are never lost.
      const step = this.pxmm * mmPerMs * (1000 / sig.fs) < 0.5 ? 2 : 1;
      const xAt = (i: number): number => st.x0 + (sig.from + (i * 1000) / sig.fs - st.t0) * mmPerMs;
      ctx.moveTo(xAt(i0), st.y0 - data[i0] * o.gain);
      for (let i = i0 + 1; i <= i1; i += step) {
        if (step === 2 && i + 1 <= i1) {
          const a = data[i];
          const b = data[i + 1];
          const x = xAt(i);
          ctx.lineTo(x, st.y0 - a * o.gain);
          ctx.lineTo(x, st.y0 - b * o.gain);
        } else ctx.lineTo(xAt(i), st.y0 - data[i] * o.gain);
      }
      ctx.stroke();
      if (st.label) {
        ctx.fillStyle = ink;
        ctx.font = `600 ${3.2}px system-ui, sans-serif`;
        ctx.fillText(st.lead, st.x0 + 1, st.y0 - o.rowMm * 0.55 + 4.2);
      }
      if (o.layout === '12' && st !== this.rhythmStrip && st.t0 > 0) {
        ctx.strokeStyle = ink;
        ctx.lineWidth = 0.3;
        ctx.beginPath();
        ctx.moveTo(st.x0, st.y0 - 2.5);
        ctx.lineTo(st.x0, st.y0 + 2.5);
        ctx.stroke();
      }
    }
    if (o.showLabels && this.rhythmStrip) this.drawLabels(ctx, this.rhythmStrip);
    if (o.showLadder && this.rhythmStrip) this.drawLadder(ctx, this.rhythmStrip);
    this.scaleTag.textContent = `${o.speed} mm/s · ${o.gain} mm/mV · simulated`;
  }

  private tx(st: Strip, t: number): number {
    return st.x0 + (t - st.t0) * (this.o.speed / 1000);
  }

  private drawLabels(ctx: CanvasRenderingContext2D, st: Strip): void {
    const run = this.run!;
    ctx.font = `600 2.4px system-ui, sans-serif`;
    const top = st.y0 - this.o.rowMm * 0.55 + 8;
    for (const v of run.sim.ventricular) {
      if (v.t < st.t0 || v.t > st.t1) continue;
      const short = abbreviate(v.label);
      if (!short) continue;
      ctx.fillStyle = css('--accent') || '#0b63c5';
      ctx.fillText(short, this.tx(st, v.t) - 1, top);
    }
    for (const a of run.sim.atrial) {
      if (a.t < st.t0 || a.t > st.t1 || a.kind === 'flutter') continue;
      ctx.fillStyle = css('--accent-2') || '#a15c00';
      const x = this.tx(st, a.t);
      ctx.beginPath();
      ctx.moveTo(x, top + 2.2);
      ctx.lineTo(x + 1.2, top + 4);
      ctx.lineTo(x - 1.2 + 2.4, top + 4);
      ctx.fill();
      ctx.fillText(a.kind === 'retro' ? "P'" : a.kind === 'ectopic' ? "P'" : a.kind === 'paced' ? 'Ap' : 'P', x - 0.6, top + 7);
    }
    for (const sp of run.sim.spikes) {
      if (sp.t < st.t0 || sp.t > st.t1) continue;
      ctx.fillStyle = css('--danger') || '#c62828';
      ctx.fillText(sp.chamber === 'shock' ? '⚡' : sp.captured ? sp.chamber : `${sp.chamber}✕`, this.tx(st, sp.t) - 0.8, top - 3);
    }
    for (const iv of run.sim.interventions) {
      if (iv.t < st.t0 || iv.t > st.t1) continue;
      ctx.fillStyle = css('--danger') || '#c62828';
      ctx.fillText(`▼ ${iv.kind}`, this.tx(st, iv.t), top - 5);
    }
  }

  private drawLadder(ctx: CanvasRenderingContext2D, st: Strip): void {
    const run = this.run!;
    const y0 = this.ladderY + 2;
    const hasAP = run.physio.rhythm.ap.present;
    const rowH = 6;
    const rows = hasAP ? ['A', 'AV', 'V', 'AP'] : ['A', 'AV', 'V'];
    const ink = css('--ecg-ink') || '#1a1a1a';
    const bg = css('--panel') || '#ffffff';
    ctx.fillStyle = bg;
    ctx.globalAlpha = 0.92;
    ctx.fillRect(0, y0 - 1, this.wMm, rows.length * rowH + 2);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.12;
    ctx.font = `600 2.6px system-ui, sans-serif`;
    ctx.fillStyle = ink;
    rows.forEach((r, i) => {
      ctx.beginPath();
      ctx.moveTo(0, y0 + i * rowH);
      ctx.lineTo(this.wMm, y0 + i * rowH);
      ctx.stroke();
      ctx.fillText(r, 0.8, y0 + i * rowH + 4);
    });
    ctx.beginPath();
    ctx.moveTo(0, y0 + 3 * rowH);
    ctx.lineTo(this.wMm, y0 + 3 * rowH);
    ctx.stroke();
    const color: Record<string, string> = {
      avn: css('--lad-avn') || '#555',
      fast: css('--lad-fast') || '#1565c0',
      slow: css('--lad-slow') || '#ef6c00',
      ap: css('--lad-ap') || '#8e24aa',
    };
    const colorOf = (s: LadderSeg): string => (s.path.includes('ap') ? color.ap : s.path.includes('fast') ? color.fast : s.path.includes('slow') ? color.slow : color.avn);
    // A row: atrial activations
    ctx.lineWidth = 0.35;
    for (const a of run.sim.atrial) {
      if (a.t < 0 || a.t > st.t1) continue;
      const x = this.tx(st, a.t);
      ctx.strokeStyle = a.kind === 'retro' ? color.fast : ink;
      if (a.via === 'ap') ctx.strokeStyle = color.ap;
      ctx.beginPath();
      if (a.kind === 'retro') {
        ctx.moveTo(x, y0 + rowH);
        ctx.lineTo(x + 1.5, y0);
      } else {
        ctx.moveTo(x, y0);
        ctx.lineTo(x + 0.8, y0 + rowH);
      }
      ctx.stroke();
    }
    // AV row
    for (const s of run.sim.ladder) {
      if (s.row !== 'AV') continue;
      if (s.t1 < 0 && s.t0 < 0) continue;
      ctx.strokeStyle = colorOf(s);
      const top = y0 + rowH;
      const bot = y0 + 2 * rowH;
      const xa = this.tx(st, s.t0);
      const xb = this.tx(st, s.t1);
      ctx.beginPath();
      if (s.dir === 'ante') {
        if (s.blocked) {
          const xm = xa + (xb - xa) * 0.6;
          ctx.moveTo(xa, top);
          ctx.lineTo(xm, top + rowH * 0.6);
          ctx.moveTo(xm - 1, top + rowH * 0.6);
          ctx.lineTo(xm + 1, top + rowH * 0.6);
        } else {
          ctx.moveTo(xa, top);
          ctx.lineTo(xb, bot);
        }
      } else {
        // retrograde: from ventricle side (t1 = entry at bottom) up to atria (t0 = exit at top)
        ctx.moveTo(xb, bot);
        ctx.lineTo(xa, top);
      }
      ctx.stroke();
    }
    // V row
    for (const v of run.sim.ventricular) {
      if (v.t < 0 || v.t > st.t1) continue;
      const x = this.tx(st, v.t);
      const top = y0 + 2 * rowH;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      if (v.route === 'his') {
        ctx.moveTo(x, top);
        ctx.lineTo(x + 0.6, top + rowH);
      } else {
        // ectopic / paced / pre-excited: origin within the ventricle, spreading both ways
        ctx.arc(x, top + rowH * 0.6, 0.5, 0, Math.PI * 2);
        ctx.moveTo(x, top + rowH * 0.6);
        ctx.lineTo(x + 1.5, top);
        ctx.moveTo(x, top + rowH * 0.6);
        ctx.lineTo(x + 1.5, top + rowH);
      }
      ctx.stroke();
    }
    // AP row
    if (hasAP) {
      for (const s of run.sim.ladder) {
        if (s.row !== 'AP') continue;
        const top = y0 + 3 * rowH;
        const bot = y0 + 4 * rowH;
        ctx.strokeStyle = color.ap;
        ctx.setLineDash([0.8, 0.5]);
        ctx.beginPath();
        const xa = this.tx(st, s.t0);
        const xb = this.tx(st, s.t1);
        if (s.blocked) {
          ctx.moveTo(xa, top);
          ctx.lineTo(xa + 0.8, top + 2.5);
          ctx.moveTo(xa - 0.4, top + 2.5);
          ctx.lineTo(xa + 1.6, top + 2.5);
        } else if (s.dir === 'ante') {
          ctx.moveTo(xa, top);
          ctx.lineTo(xb, bot);
        } else {
          ctx.moveTo(xb, bot);
          ctx.lineTo(xa, top);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    // Legend
    ctx.font = `500 2.2px system-ui, sans-serif`;
    const legend: [string, string][] = run.physio.rhythm.dualPathway ? [['fast pathway', color.fast], ['slow pathway', color.slow]] : [['AV node', color.avn]];
    if (hasAP) legend.push(['accessory pathway', color.ap]);
    let lx = this.wMm - 60;
    for (const [t, c] of legend) {
      ctx.fillStyle = c;
      ctx.fillRect(lx, y0 + 3 * rowH + (hasAP ? rowH : 0) + 2, 3, 0.8);
      ctx.fillStyle = ink;
      ctx.fillText(t, lx + 4, y0 + 3 * rowH + (hasAP ? rowH : 0) + 3);
      lx += 20;
    }
  }

  private drawOverlay(): void {
    const ctx = this.over.getContext('2d');
    if (!ctx || !this.run) return;
    const dpr = this.over.width / Math.max(1, parseFloat(this.over.style.width));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.over.width, this.over.height);
    ctx.setTransform(dpr * this.pxmm, 0, 0, dpr * this.pxmm, 0, 0);
    if (this.seg && this.cursor !== null) this.drawSegment(ctx, this.seg, this.cursor);
    if (this.cursor !== null) {
      ctx.strokeStyle = css('--accent') || '#0b63c5';
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      for (const st of this.strips) {
        if (this.cursor < st.t0 || this.cursor > st.t1) continue;
        const x = this.tx(st, this.cursor);
        ctx.moveTo(x, st.y0 - this.o.rowMm * 0.5);
        ctx.lineTo(x, st.y0 + this.o.rowMm * 0.45);
        if (st === this.rhythmStrip && this.o.showLadder) {
          ctx.moveTo(x, this.ladderY);
          ctx.lineTo(x, this.hMm);
        }
      }
      ctx.stroke();
    }
    if (this.cal) {
      const { x0, x1, y } = this.cal;
      const c = css('--danger') || '#c62828';
      ctx.strokeStyle = c;
      ctx.fillStyle = c;
      ctx.lineWidth = 0.25;
      ctx.beginPath();
      ctx.moveTo(x0, y - 4);
      ctx.lineTo(x0, y + 4);
      ctx.moveTo(x1, y - 4);
      ctx.lineTo(x1, y + 4);
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
      const ms = Math.abs(x1 - x0) / (this.o.speed / 1000);
      const txt = `${Math.round(ms)} ms${ms > 150 ? ` · ${Math.round(60000 / ms)}/min` : ''}`;
      ctx.font = `600 2.8px system-ui, sans-serif`;
      ctx.fillText(txt, Math.min(x0, x1), y - 4.8);
      this.readout.textContent = `Caliper: ${txt}`;
    }
  }

  private drawSegment(ctx: CanvasRenderingContext2D, seg: { t0: number; t1: number; label: string }, cursor: number): void {
    const run = this.run!;
    const sig = run.sig;
    const o = this.o;
    const mmPerMs = o.speed / 1000;
    const accent = css('--accent') || '#0b63c5';
    for (const st of this.strips) {
      const a = Math.max(seg.t0, st.t0);
      const b = Math.min(seg.t1, st.t1);
      if (b <= a) continue;
      ctx.fillStyle = css('--seg-band') || 'rgba(11,99,197,0.10)';
      ctx.fillRect(this.tx(st, a), st.y0 - o.rowMm * 0.5, (b - a) * mmPerMs, o.rowMm * 0.95);
      const data = sig.leads[st.lead];
      const e = Math.min(b, cursor);
      if (!data || e <= a) continue;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 0.55;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const i0 = Math.max(0, Math.round(((a - sig.from) * sig.fs) / 1000));
      const i1 = Math.min(sig.n - 1, Math.round(((e - sig.from) * sig.fs) / 1000));
      for (let i = i0; i <= i1; i++) {
        const t = sig.from + (i * 1000) / sig.fs;
        const x = st.x0 + (t - st.t0) * mmPerMs;
        const y = st.y0 - data[i] * o.gain;
        if (i === i0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      if (st === this.rhythmStrip) {
        ctx.font = `600 2.6px system-ui, sans-serif`;
        ctx.fillStyle = accent;
        ctx.fillText(seg.label, Math.min(this.tx(st, a), this.wMm - 40), st.y0 - o.rowMm * 0.5 + 3);
      }
    }
  }

  private timeAt(x: number, y: number): number | null {
    for (const st of this.strips) {
      const x1 = this.tx(st, st.t1);
      if (x < st.x0 || x > x1) continue;
      if (y < st.y0 - this.o.rowMm * 0.55 || y > st.y0 + this.o.rowMm * 0.45) continue;
      return st.t0 + (x - st.x0) / (this.o.speed / 1000);
    }
    return null;
  }

  private bindCalipers(): void {
    let dragging = false;
    const pos = (e: PointerEvent): { x: number; y: number } => {
      const r = this.over.getBoundingClientRect();
      return { x: (e.clientX - r.left) / this.pxmm, y: (e.clientY - r.top) / this.pxmm };
    };
    this.over.addEventListener('pointerdown', (e) => {
      const p0 = pos(e);
      dragging = true;
      this.cal = { x0: p0.x, x1: p0.x, y: p0.y };
      this.over.setPointerCapture(e.pointerId);
      this.drawOverlay();
    });
    this.over.addEventListener('pointermove', (e) => {
      if (!dragging || !this.cal) return;
      this.cal.x1 = pos(e).x;
      this.drawOverlay();
    });
    const end = (): void => {
      dragging = false;
      if (this.cal && Math.abs(this.cal.x1 - this.cal.x0) < 0.6) {
        const t = this.onSeek ? this.timeAt(this.cal.x0, this.cal.y) : null;
        if (t !== null) this.onSeek!(t);
        this.cal = null;
        this.readout.textContent = 'Drag across the tracing to measure an interval.';
        this.drawOverlay();
      }
    };
    this.over.addEventListener('pointerup', end);
    this.over.addEventListener('pointercancel', end);
    this.readout.textContent = 'Drag across the tracing to measure an interval.';
  }

  setReadoutHint(text: string): void {
    this.readout.textContent = text;
  }
}

function abbreviate(label: string): string {
  if (label.startsWith('conducted QRS') || label === 'pre-excited QRS') return '';
  if (label.startsWith('aberrant')) return 'aberrant';
  if (label.startsWith('premature ventricular')) return 'PVC';
  if (label === 'junctional QRS') return 'J';
  if (label === 'ventricular escape') return 'V-esc';
  if (label.startsWith('ventricular-paced') || label === 'ventricular paced') return 'Vp';
  if (label.startsWith('fusion')) return 'fusion';
  if (label === 'idioventricular beat') return 'IVR';
  if (label === 'NSVT beat') return 'VT';
  if (label === 'VT' || label.includes('VT')) return 'VT';
  if (label === 'torsades de pointes') return 'TdP';
  return '';
}
