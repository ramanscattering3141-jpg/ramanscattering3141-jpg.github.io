// ECG paper renderer: standard 3×4 12-lead layout with rhythm strip (6×2 on narrow screens),
// stacked strips, conduction ladder diagram, beat annotations and on-screen calipers.
// Geometry is in millimetres of ECG paper; the grid is drawn in device pixels so it stays crisp.

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

/** Below this width (CSS px) a 12-lead is printed as 6 rows × 2 columns so it fits a phone. */
const NARROW_PX = 600;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const INTERVENTION_LABEL: Record<string, string> = { adenosine: 'adenosine', vagal: 'vagal manoeuvre', shock: 'shock', avnBlocker: 'AV-nodal blocker', atropine: 'atropine' };

interface Strip {
  lead: LeadId;
  x0: number; // mm
  y0: number; // mm baseline
  top: number; // mm, top of the row band
  bottom: number; // mm, bottom of the row band
  t0: number; // ms
  t1: number;
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
  private calMm = 8;
  private strips: Strip[] = [];
  private ladderY = 0;
  private laneY: number | null = null;
  private laneMm = 0;
  private rhythmStrip: Strip | null = null;
  private cursor: number | null = null;
  private seg: { t0: number; t1: number; label: string } | null = null;
  /** Called with a time (ms) when the user taps the tracing without dragging. */
  onSeek: ((t: number) => void) | null = null;
  private cal: { x0: number; x1: number; y: number } | null = null;
  private ro: ResizeObserver;
  private lastW = 0;
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
    this.ro = new ResizeObserver(() => {
      // Only re-lay out when the width changes (height follows from the layout itself).
      const w = this.el.clientWidth;
      if (w !== this.lastW) this.layout();
    });
    this.ro.observe(this.el);
    this.bindCalipers();
  }

  setRun(run: EcgRun): void {
    this.run = run;
    this.over.setAttribute('aria-label', `Simulated ECG: ventricular rate ${run.m.ventRate ?? 'not measurable'}${run.m.ventRate ? '/min' : ''}, ${run.m.regularity}, QRS ${run.m.qrs ?? 'not measurable'}${run.m.qrs ? ' ms' : ''}`);
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

  setReadoutHint(text: string): void {
    this.readout.textContent = text;
  }

  // ------------------------------------------------------------------ layout
  /** Font size in mm that is at least `minPx` CSS pixels on screen. */
  private fontMm(mm: number, minPx: number): number {
    return Math.max(mm, minPx / this.pxmm);
  }

  private layout(): void {
    const run = this.run;
    if (!run) return;
    const o = this.o;
    const dur = run.sim.duration;
    const mmPerMs = o.speed / 1000;
    const avail = Math.max(280, this.el.clientWidth || 800);
    this.lastW = this.el.clientWidth;
    this.calMm = Math.max(8, 200 * mmPerMs + 3);
    const cal = this.calMm;
    this.strips = [];
    this.rhythmStrip = null;
    this.laneY = null;
    const rowMm = o.rowMm;
    const add = (lead: LeadId, x0: number, top: number, t0: number, t1: number): Strip => {
      const st: Strip = { lead, x0, top, y0: top + rowMm * 0.55, bottom: top + rowMm, t0, t1 };
      this.strips.push(st);
      return st;
    };

    // Width first: it fixes the scale (px per mm), which in turn sizes the text lanes.
    const colMs = dur / 4;
    const colMm = colMs * mmPerMs;
    const narrow = o.layout === '12' && avail < NARROW_PX && !o.showLadder;
    let minPx = o.minPxPerMm;
    if (o.layout === '12') this.wMm = cal + (narrow ? 2 : 4) * colMm + 2;
    else this.wMm = cal + dur * mmPerMs + 2;
    if (narrow) minPx = Math.min(minPx, 2.2);
    this.pxmm = Math.max(minPx, avail / this.wMm);

    let y = 0;
    if (o.layout === '12') {
      if (!narrow) {
        LAYOUT_3x4.forEach((row, r) => row.forEach((lead, c) => add(lead, cal + c * colMm, r * rowMm, c * colMs, (c + 1) * colMs)));
        y = 3 * rowMm;
        if (o.showRhythm && o.rhythmLead) {
          this.rhythmStrip = add(o.rhythmLead, cal, y, 0, dur);
          y += rowMm;
        }
      } else {
        // 6 × 2: limb leads on the left, chest leads on the right. Each lead keeps the time window
        // it has in the standard 3 × 4 printout, and the rhythm strip wraps onto two lines.
        LAYOUT_3x4.forEach((row, r) => row.forEach((lead, c) => add(lead, cal + Math.floor(c / 2) * colMm, (r + 3 * (c % 2)) * rowMm, c * colMs, (c + 1) * colMs)));
        y = 6 * rowMm;
        if (o.showRhythm && o.rhythmLead) {
          this.rhythmStrip = add(o.rhythmLead, cal, y, 0, dur / 2);
          add(o.rhythmLead, cal, y + rowMm, dur / 2, dur);
          y += 2 * rowMm;
        }
      }
    } else {
      const leads = o.leads ?? ['II'];
      if (o.showLabels) {
        // Annotation lane above the first strip: beat labels on one line, P-wave markers below.
        const fs = this.fontMm(2.5, 11);
        this.laneMm = 2 * fs + 3.4;
        this.laneY = 0;
        y = this.laneMm;
      }
      leads.forEach((lead, i) => {
        const st = add(lead, cal, y, 0, dur);
        if (i === leads.length - 1) this.rhythmStrip = st;
        y += rowMm;
      });
    }
    // Tall complexes in the top row and deep ones in the bottom row get extra paper, so a trace is
    // never cut off at the edge of the printout (rows in between may overlap, as on real paper).
    const firstTop = Math.min(...this.strips.map((st) => st.top));
    const lastBottom = Math.max(...this.strips.map((st) => st.bottom));
    let padTop = 0;
    let padBottom = 0;
    for (const st of this.strips) {
      const [lo, hi] = this.sigRange(st.lead, st.t0, st.t1);
      if (st.top === firstTop && this.laneY === null) padTop = Math.max(padTop, hi * o.gain - (st.y0 - st.top) + 1);
      if (st.bottom === lastBottom) padBottom = Math.max(padBottom, -lo * o.gain - (st.bottom - st.y0) + 1);
    }
    padTop = Math.min(20, Math.ceil(padTop));
    padBottom = Math.min(20, Math.ceil(padBottom));
    if (padTop > 0) {
      for (const st of this.strips) {
        st.top += padTop;
        st.y0 += padTop;
        st.bottom += padTop;
      }
      y += padTop;
    }
    y += padBottom;
    this.ladderY = y;
    if (o.showLadder) y += this.ladderHeight();
    this.hMm = y + 1;

    const wPx = Math.round(this.wMm * this.pxmm);
    const hPx = Math.round(this.hMm * this.pxmm);
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    for (const c of [this.base, this.over]) {
      c.width = Math.round(wPx * dpr);
      c.height = Math.round(hPx * dpr);
      c.style.width = `${wPx}px`;
      c.style.height = `${hPx}px`;
    }
    this.drawBase();
    this.drawOverlay();
  }

  private ladderRows(): string[] {
    return this.run?.physio.rhythm.ap.present ? ['A', 'AV', 'V', 'AP'] : ['A', 'AV', 'V'];
  }

  private ladderHeight(): number {
    return 2 + this.ladderRows().length * 6 + this.fontMm(2.4, 11) + 3;
  }

  // ------------------------------------------------------------------ drawing
  /** Pink millimetre grid, drawn in device pixels so every line is a whole number of pixels wide. */
  private drawGrid(ctx: CanvasRenderingContext2D, dpr: number): void {
    const k = dpr * this.pxmm; // device px per mm
    const W = this.base.width;
    const H = this.base.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = css('--ecg-paper') || '#fffaf8';
    ctx.fillRect(0, 0, W, H);
    const thin = 1;
    const thick = dpr >= 1.5 ? Math.max(2, Math.round(dpr * 0.8)) : 1;
    const lines = (stepMm: number, skipEvery: number, width: number, color: string, alpha: number): void => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.globalAlpha = alpha;
      const off = width % 2 ? 0.5 : 0;
      ctx.beginPath();
      for (let i = 0; i * stepMm <= this.wMm; i++) {
        if (skipEvery && i % skipEvery === 0) continue;
        const x = Math.round(i * stepMm * k) + off;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
      }
      for (let i = 0; i * stepMm <= this.hMm; i++) {
        if (skipEvery && i % skipEvery === 0) continue;
        const y = Math.round(i * stepMm * k) + off;
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    // Where 1 mm is only a few device pixels, the minor grid is faded so it does not turn into a wash.
    lines(1, 5, thin, css('--ecg-minor') || '#f3d2cd', k < 3.2 ? 0.55 : 1);
    lines(5, 0, thick, css('--ecg-major') || '#e4a39b', 1);
  }

  /** Minimum and maximum of a lead's signal (mV) between two times. */
  private sigRange(lead: LeadId, t0: number, t1: number): [number, number] {
    const sig = this.run!.sig;
    const data = sig.leads[lead];
    if (!data) return [0, 0];
    const i0 = Math.max(0, Math.floor(((t0 - sig.from) * sig.fs) / 1000));
    const i1 = Math.min(sig.n - 1, Math.ceil(((t1 - sig.from) * sig.fs) / 1000));
    let lo = 0;
    let hi = 0;
    for (let i = i0; i <= i1; i++) {
      if (data[i] < lo) lo = data[i];
      if (data[i] > hi) hi = data[i];
    }
    return [lo, hi];
  }

  /** Text with a halo of paper colour, so grid lines and nearby trace never cut through it. */
  private haloText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, fs: number): void {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineWidth = fs * 0.32;
    ctx.strokeStyle = css('--ecg-paper') || '#fffaf8';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /** Lead name at the start of a strip, placed in whichever corner of the row the trace leaves free. */
  private drawLeadLabel(ctx: CanvasRenderingContext2D, st: Strip, ink: string): void {
    const fs = this.fontMm(3.2, 12);
    ctx.font = `600 ${fs}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const w = ctx.measureText(st.lead).width;
    const x = st.x0 + 1;
    const mmPerMs = this.o.speed / 1000;
    const [lo, hi] = this.sigRange(st.lead, st.t0 + (x - 0.5 - st.x0) / mmPerMs, st.t0 + (x + w + 0.5 - st.x0) / mmPerMs);
    const traceTop = st.y0 - hi * this.o.gain;
    const traceBot = st.y0 - lo * this.o.gain;
    const clear = (base: number): boolean => traceTop > base + 0.8 || traceBot < base - fs * 0.8 - 0.8;
    const top = st.top + fs * 0.85 + 0.8;
    const bottom = st.bottom - 1;
    const y = clear(top) ? top : clear(bottom) ? bottom : top;
    this.haloText(ctx, st.lead, x, y, ink, fs);
  }

  private drawBase(): void {
    const run = this.run!;
    const ctx = this.base.getContext('2d')!;
    const dpr = this.base.width / parseFloat(this.base.style.width);
    this.drawGrid(ctx, dpr);
    ctx.setTransform(dpr * this.pxmm, 0, 0, dpr * this.pxmm, 0, 0);
    const ink = css('--ecg-ink') || '#1a1a1a';
    const o = this.o;
    const mmPerMs = o.speed / 1000;
    const sig = run.sig;
    const hl = new Set(o.highlight ?? []);
    const traceW = Math.max(0.24, 1.3 / this.pxmm);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // Calibration pulse (1 mV, 200 ms) at the start of every printed row.
    const rows = new Set(this.strips.filter((s) => s.x0 <= this.calMm + 0.01).map((s) => s.y0));
    const pw = 200 * mmPerMs;
    ctx.strokeStyle = ink;
    ctx.lineWidth = traceW;
    for (const y0 of rows) {
      ctx.beginPath();
      ctx.moveTo(0.6, y0);
      ctx.lineTo(1.5, y0);
      ctx.lineTo(1.5, y0 - o.gain);
      ctx.lineTo(1.5 + pw, y0 - o.gain);
      ctx.lineTo(1.5 + pw, y0);
      ctx.lineTo(this.calMm - 0.8, y0);
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
        ctx.fillRect(st.x0, st.top, (st.t1 - st.t0) * mmPerMs, st.bottom - st.top);
      }
      ctx.strokeStyle = ink;
      ctx.lineWidth = isHl ? traceW * 1.35 : traceW;
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
      // Column boundary marker (as on a printed 12-lead).
      if (st.x0 > this.calMm + 0.01) {
        ctx.lineWidth = traceW;
        ctx.beginPath();
        ctx.moveTo(st.x0, st.y0 - 2.5);
        ctx.lineTo(st.x0, st.y0 + 2.5);
        ctx.stroke();
      }
    }
    // Lead names last, so their halo sits above every trace.
    const named = new Set<string>();
    for (const st of this.strips) {
      const key = `${st.lead}@${st.y0}`;
      if (named.has(key)) continue;
      named.add(key);
      this.drawLeadLabel(ctx, st, ink);
    }
    if (o.showLabels && this.laneY !== null) this.drawLabels(ctx);
    if (o.showLadder && this.rhythmStrip) this.drawLadder(ctx, this.rhythmStrip);
    this.scaleTag.textContent = `${o.speed} mm/s · ${o.gain} mm/mV · simulated`;
  }

  private tx(st: Strip, t: number): number {
    return st.x0 + (t - st.t0) * (this.o.speed / 1000);
  }

  /** Beat and P-wave annotations in their own lane above the strips, never on the trace. */
  private drawLabels(ctx: CanvasRenderingContext2D): void {
    const run = this.run!;
    const st = this.strips[0];
    if (!st || this.laneY === null) return;
    const fs = this.fontMm(2.5, 11);
    const lane = this.laneY;
    const row1 = lane + fs + 0.6;
    const row2 = lane + 2 * fs + 1.4;
    ctx.font = `600 ${fs}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    // Separate the lane from the first strip with a faint rule.
    ctx.strokeStyle = css('--line') || '#d9dee5';
    ctx.lineWidth = Math.max(0.1, 1 / this.pxmm);
    ctx.beginPath();
    ctx.moveTo(this.calMm, lane + this.laneMm - 0.3);
    ctx.lineTo(this.wMm, lane + this.laneMm - 0.3);
    ctx.stroke();
    const used: [number, number][][] = [[], []];
    const place = (row: 0 | 1, x: number, text: string, color: string): boolean => {
      const w = ctx.measureText(text).width;
      const a = x - w / 2 - 0.6;
      const b = x + w / 2 + 0.6;
      if (a < this.calMm - 1 || b > this.wMm) return false;
      if (used[row].some(([p, q]) => a < q && b > p)) return false;
      used[row].push([a, b]);
      this.haloText(ctx, text, x, row ? row2 : row1, color, fs);
      return true;
    };
    const inRange = (t: number): boolean => t >= st.t0 && t <= st.t1;
    const danger = css('--danger') || '#c62828';
    const accent = css('--accent') || '#0b63c5';
    // Line 1, in order of priority: interventions, pacing spikes, then named beats.
    for (const iv of run.sim.interventions) if (inRange(iv.t)) place(0, this.tx(st, iv.t), `▼ ${INTERVENTION_LABEL[iv.kind] ?? iv.kind}`, danger);
    // Captured pacing spikes are already named by their beat (Ap / Vp); only shocks and failures are flagged.
    for (const sp of run.sim.spikes) if (inRange(sp.t) && (sp.chamber === 'shock' || !sp.captured)) place(0, this.tx(st, sp.t), sp.chamber === 'shock' ? '⚡ shock' : 'no capture', danger);
    for (const v of run.sim.ventricular) {
      if (!inRange(v.t)) continue;
      const short = abbreviate(v.label);
      if (short) place(0, this.tx(st, v.t), short, accent);
    }
    // Line 2: atrial activations, each with a small pointer down towards its P wave.
    const pColor = css('--accent-2') || '#a15c00';
    ctx.fillStyle = pColor;
    for (const a of run.sim.atrial) {
      if (!inRange(a.t) || a.kind === 'flutter') continue;
      const x = this.tx(st, a.t);
      if (!place(1, x, a.kind === 'retro' || a.kind === 'ectopic' ? 'P′' : a.kind === 'paced' ? 'Ap' : 'P', pColor)) continue;
      ctx.fillStyle = pColor;
      ctx.beginPath();
      ctx.moveTo(x - 0.7, row2 + 0.7);
      ctx.lineTo(x + 0.7, row2 + 0.7);
      ctx.lineTo(x, row2 + 1.7);
      ctx.fill();
    }
    ctx.textAlign = 'left';
  }

  private drawLadder(ctx: CanvasRenderingContext2D, st: Strip): void {
    const run = this.run!;
    const y0 = this.ladderY + 2;
    const hasAP = run.physio.rhythm.ap.present;
    const rowH = 6;
    const rows = this.ladderRows();
    const ink = css('--ecg-ink') || '#1a1a1a';
    const bg = css('--panel') || '#ffffff';
    const fs = this.fontMm(2.6, 11.5);
    const legendFs = this.fontMm(2.4, 11);
    ctx.fillStyle = bg;
    ctx.fillRect(0, y0 - 1, this.wMm, this.hMm - y0 + 1);
    ctx.strokeStyle = css('--line') || '#d9dee5';
    ctx.lineWidth = Math.max(0.1, 1 / this.pxmm);
    rows.forEach((_, i) => {
      ctx.beginPath();
      ctx.moveTo(0, y0 + i * rowH);
      ctx.lineTo(this.wMm, y0 + i * rowH);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(0, y0 + rows.length * rowH);
    ctx.lineTo(this.wMm, y0 + rows.length * rowH);
    ctx.stroke();
    // Row names sit in the calibration margin, clear of every ladder line.
    ctx.font = `600 ${fs}px ${FONT}`;
    ctx.fillStyle = css('--muted') || ink;
    ctx.textBaseline = 'middle';
    rows.forEach((r, i) => ctx.fillText(r, 0.8, y0 + i * rowH + rowH / 2));
    ctx.textBaseline = 'alphabetic';
    const color: Record<string, string> = {
      avn: css('--lad-avn') || '#555',
      fast: css('--lad-fast') || '#1565c0',
      slow: css('--lad-slow') || '#ef6c00',
      ap: css('--lad-ap') || '#8e24aa',
    };
    const colorOf = (s: LadderSeg): string => (s.path.includes('ap') ? color.ap : s.path.includes('fast') ? color.fast : s.path.includes('slow') ? color.slow : color.avn);
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.calMm - 0.5, y0, this.wMm, rows.length * rowH);
    ctx.clip();
    const lw = Math.max(0.3, 1.6 / this.pxmm);
    ctx.lineWidth = lw;
    // A row: atrial activations
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
    ctx.restore();
    // Legend in its own band under the ladder.
    ctx.font = `500 ${legendFs}px ${FONT}`;
    const legend: [string, string][] = run.physio.rhythm.dualPathway ? [['fast pathway', color.fast], ['slow pathway', color.slow]] : [['AV node', color.avn]];
    if (hasAP) legend.push(['accessory pathway (dashed)', color.ap]);
    legend.push(['⊥ = blocked', ink]);
    const ly = y0 + rows.length * rowH + legendFs + 1.2;
    let lx = this.calMm;
    for (const [t, c] of legend) {
      const isKey = !t.startsWith('⊥');
      if (isKey) {
        ctx.fillStyle = c;
        ctx.fillRect(lx, ly - legendFs * 0.35 - 0.4, 3.5, 0.8);
      }
      ctx.fillStyle = css('--ink') || ink;
      const tx = isKey ? lx + 4.5 : lx;
      ctx.fillText(t, tx, ly);
      lx = tx + ctx.measureText(t).width + 4;
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
      ctx.lineWidth = Math.max(0.25, 1.5 / this.pxmm);
      ctx.beginPath();
      for (const st of this.strips) {
        if (this.cursor < st.t0 || this.cursor > st.t1) continue;
        const x = this.tx(st, this.cursor);
        ctx.moveTo(x, st.top + 0.5);
        ctx.lineTo(x, st.bottom - 0.5);
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
      ctx.lineWidth = Math.max(0.22, 1.4 / this.pxmm);
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
      this.tag(ctx, txt, Math.min(x0, x1), y - 4.6, c);
      this.readout.textContent = `Caliper: ${txt}`;
    }
  }

  /** Small label on a solid background (used for the live segment name and the caliper reading). */
  private tag(ctx: CanvasRenderingContext2D, text: string, x: number, yBottom: number, color: string): void {
    const fs = this.fontMm(2.6, 12);
    ctx.font = `600 ${fs}px ${FONT}`;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    const w = ctx.measureText(text).width;
    const padX = 0.8;
    const bx = Math.max(0.2, Math.min(x, this.wMm - w - 2 * padX - 0.2));
    const by = Math.max(0.2, yBottom - fs - 0.6);
    ctx.fillStyle = css('--panel') || '#fff';
    ctx.globalAlpha = 0.94;
    ctx.fillRect(bx, by, w + 2 * padX, fs + 0.9);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.1, 1 / this.pxmm);
    ctx.strokeRect(bx, by, w + 2 * padX, fs + 0.9);
    ctx.fillStyle = color;
    ctx.fillText(text, bx + padX, by + fs * 0.88);
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
      ctx.fillRect(this.tx(st, a), st.top + 0.5, (b - a) * mmPerMs, st.bottom - st.top - 1);
      const data = sig.leads[st.lead];
      const e = Math.min(b, cursor);
      if (!data || e <= a) continue;
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(0.45, 2.2 / this.pxmm);
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
    }
    // Name of the segment being written: one tag, at the top of the rhythm strip (right of the lead name).
    const st = this.rhythmStrip ?? this.strips[this.strips.length - 1];
    if (st && seg.t1 > st.t0 && seg.t0 < st.t1) {
      const fsLead = this.fontMm(3.2, 12);
      const x = Math.max(this.tx(st, Math.max(seg.t0, st.t0)), st.x0 + fsLead * 2.6);
      this.tag(ctx, seg.label, x, st.top + this.fontMm(2.6, 12) + 1.6, accent);
    }
  }

  private timeAt(x: number, y: number): number | null {
    for (const st of this.strips) {
      const x1 = this.tx(st, st.t1);
      if (x < st.x0 || x > x1) continue;
      if (y < st.top || y > st.bottom) continue;
      return st.t0 + (x - st.x0) / (this.o.speed / 1000);
    }
    return null;
  }

  private bindCalipers(): void {
    let dragging = false;
    const hint = 'Drag across the tracing to measure an interval; tap to jump the playback cursor there.';
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
        this.readout.textContent = this.onSeek ? hint : 'Drag across the tracing to measure an interval.';
        this.drawOverlay();
      }
    };
    this.over.addEventListener('pointerup', end);
    this.over.addEventListener('pointercancel', end);
    this.readout.textContent = 'Drag across the tracing to measure an interval.';
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
