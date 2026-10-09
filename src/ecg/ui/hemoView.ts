// Mechanics & haemodynamics panel: a live Wiggers diagram (pressures, LV volume, ECG, heart
// sounds, JVP), a pressure–volume loop, haemodynamic read-outs and audible heart sounds — all
// computed by engine/hemo.ts from the same electrical simulation that draws the ECG.

import type { EcgRun } from '../engine';
import { simulateHemo, PHASE_LABEL, PHASE_TEXT, type CyclePhase, type HemoResult } from '../engine/hemo';
import { css, h, rich } from './dom';

const WINDOW_MS = 2400;

const PHASE_COLOR: Record<CyclePhase, string> = {
  atrialSystole: '#c39bd3',
  isoContraction: '#f1948a',
  rapidEjection: '#e74c3c',
  reducedEjection: '#f5b7b1',
  isoRelaxation: '#85c1e9',
  rapidFilling: '#5dade2',
  diastasis: '#d6eaf8',
  noOutput: '#bdbdbd',
};

interface Track {
  key: string;
  label: string;
  h: number; // relative height
}

export class HemoView {
  readonly el: HTMLDivElement;
  hemo: HemoResult | null = null;
  onSeek: ((t: number) => void) | null = null;
  private run: EcgRun | null = null;
  private t = 0;
  private wig: HTMLCanvasElement;
  private pv: HTMLCanvasElement;
  private tiles: HTMLDivElement;
  private phaseBox: HTMLDivElement;
  private notesBox: HTMLDivElement;
  private valveBox: HTMLDivElement;
  private right = false;
  private ro: ResizeObserver;
  private audio: AudioContext | null = null;
  private src: AudioBufferSourceNode | null = null;
  private listenBtn: HTMLButtonElement;
  private lastPhaseKey = '';

  constructor() {
    this.wig = h('canvas', { class: 'hemo-wig', role: 'img', 'aria-label': 'Wiggers diagram: pressures, LV volume, ECG, heart sounds and jugular venous pulse over time' });
    this.pv = h('canvas', { class: 'hemo-pv', role: 'img', 'aria-label': 'Left-ventricular pressure–volume loop' });
    this.tiles = h('div', { class: 'hemo-tiles' });
    this.phaseBox = h('div', { class: 'hemo-phase', 'aria-live': 'polite' });
    this.valveBox = h('div', { class: 'hemo-valves' });
    this.notesBox = h('div', { class: 'hemo-notes' });
    const rightCb = h('input', { type: 'checkbox' });
    rightCb.addEventListener('change', () => {
      this.right = rightCb.checked;
      this.draw();
    });
    this.listenBtn = h('button', { class: 'btn', type: 'button' }, '🔊 Listen (real time)');
    this.listenBtn.addEventListener('click', () => this.toggleListen());
    this.wig.addEventListener('click', (e) => {
      if (!this.run || !this.onSeek) return;
      const r = this.wig.getBoundingClientRect();
      const { t0 } = this.windowRange();
      const x = (e.clientX - r.left - 46) / Math.max(1, r.width - 56);
      this.onSeek(t0 + Math.max(0, Math.min(1, x)) * WINDOW_MS);
    });
    this.el = h(
      'div',
      { class: 'hemo' },
      h('div', { class: 'hemo-top' }, this.phaseBox, this.valveBox),
      this.tiles,
      h('div', { class: 'hemo-row' }, h('div', { class: 'hemo-wig-wrap' }, this.wig), h('div', { class: 'hemo-pv-wrap' }, this.pv, h('div', { class: 'hemo-cap' }, 'LV pressure–volume loop (current beat; dashed line = end-systolic pressure–volume relation)'))),
      h('div', { class: 'btn-row hemo-ctl' }, this.listenBtn, h('label', { class: 'h3d-tog' }, rightCb, ' Show right-heart pressures (RV, PA, RA)'), h('span', { class: 'hemo-cap' }, 'Click the diagram to jump to that moment.')),
      this.notesBox,
      h(
        'p',
        { class: 'ref-meta' },
        'Lumped-parameter circulation (time-varying elastance chambers, pressure-driven valves, systemic and pulmonary circuits, baroreflex-adjusted resistance) driven by the simulated electrical activation. Values are physiologically realistic for a resting adult but are model outputs, not patient measurements.',
      ),
    );
    this.ro = new ResizeObserver(() => this.draw());
    this.ro.observe(this.wig);
  }

  setRun(run: EcgRun, hemo?: HemoResult): void {
    this.stopListen();
    this.run = run;
    this.hemo = hemo ?? simulateHemo(run);
    this.lastPhaseKey = '';
    this.renderTiles();
    const notes = this.hemo.notes;
    this.notesBox.replaceChildren(...(notes.length ? [h('h4', null, 'What the mechanics show for this rhythm'), h('ul', null, ...notes.map((n) => h('li', null, rich(n))))] : []));
    this.setTime(this.t);
  }

  setTime(t: number): void {
    this.t = t;
    const hm = this.hemo;
    if (!hm) return;
    const i = this.idx(t);
    const ph = hm.phase[i];
    const v = hm.valves[i];
    const key = `${ph}`;
    if (key !== this.lastPhaseKey) {
      this.lastPhaseKey = key;
      this.phaseBox.replaceChildren(h('span', { class: 'hemo-chip', style: `background:${PHASE_COLOR[ph]}` }, PHASE_LABEL[ph]), h('p', null, PHASE_TEXT[ph]));
    }
    const valve = (name: string, open: boolean): HTMLElement => h('span', { class: `hemo-valve ${open ? 'open' : 'shut'}` }, `${name}: ${open ? 'open' : 'closed'}`);
    this.valveBox.replaceChildren(valve('Mitral', (v & 1) !== 0), valve('Aortic', (v & 4) !== 0), valve('Tricuspid', (v & 2) !== 0), valve('Pulmonary', (v & 8) !== 0), h('span', { class: 'hemo-live' }, `LV ${hm.lvP[i].toFixed(0)} mmHg · Ao ${hm.aoP[i].toFixed(0)} · LA ${hm.laP[i].toFixed(0)} · LV vol ${hm.lvV[i].toFixed(0)} mL`));
    this.draw();
  }

  destroy(): void {
    this.stopListen();
    this.ro.disconnect();
    void this.audio?.close();
  }

  // ------------------------------------------------------------------ helpers
  private idx(t: number): number {
    const hm = this.hemo!;
    return Math.max(0, Math.min(hm.n - 1, Math.round(((t - hm.from) * hm.fs) / 1000)));
  }

  private windowRange(): { t0: number; t1: number } {
    const dur = this.run?.sim.duration ?? 10000;
    let t0 = this.t - WINDOW_MS * 0.4;
    t0 = Math.max(0, Math.min(dur - WINDOW_MS, t0));
    return { t0, t1: t0 + WINDOW_MS };
  }

  private renderTiles(): void {
    const s = this.hemo!.summary;
    const arrest = s.pulseRate === 0;
    const tile = (k: string, v: string, sub = '', warn = false): HTMLElement => h('div', { class: `hemo-tile ${warn ? 'warn' : ''}` }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v), sub ? h('div', { class: 's' }, sub) : null);
    this.tiles.replaceChildren(
      tile('Blood pressure', arrest ? 'no pulse' : `${s.sbp}/${s.dbp}`, arrest ? `mean ${s.map} mmHg` : `MAP ${s.map} mmHg`, arrest || s.sbp < 90),
      tile('Heart rate / pulse', `${s.hr} / ${s.pulseRate}`, s.pulseDeficit > 0 ? `pulse deficit ${s.pulseDeficit}/min` : 'per min', s.pulseDeficit >= 5),
      tile('Stroke volume', `${s.sv} mL`, `EF ${s.ef}% · EDV ${s.lvedv} mL`, s.sv < 40),
      tile('Cardiac output', `${s.co.toFixed(1)} L/min`, '', s.co < 3.5),
      tile('LVEDP', `${s.lvedp} mmHg`, `PAWP ≈ ${s.pawp}`, s.lvedp > 18),
      tile('CVP (RA)', `${s.rap} mmHg`, `PA ${s.pasp}/${s.padp}`, s.rap > 10 || s.pasp > 35),
    );
  }

  private draw(): void {
    const hm = this.hemo;
    const run = this.run;
    const cv = this.wig;
    const w = cv.clientWidth || 600;
    const tracks: Track[] = [
      { key: 'press', label: 'Pressure, mmHg', h: 3.2 },
      { key: 'vol', label: 'LV vol, mL', h: 1.4 },
      { key: 'ecg', label: 'ECG II', h: 1.1 },
      { key: 'pcg', label: 'Sounds', h: 0.95 },
      { key: 'jvp', label: 'JVP', h: 1.2 },
    ];
    const H = 430;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(H * dpr);
      cv.style.height = `${H}px`;
    }
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = css('--panel') || '#fff';
    const ink = css('--ink') || '#111';
    const muted = css('--muted') || '#666';
    const line = css('--line') || '#ddd';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, H);
    if (!hm || !run) return;
    const { t0, t1 } = this.windowRange();
    const L = 46;
    const R = w - 10;
    const X = (t: number): number => L + ((t - t0) / (t1 - t0)) * (R - L);
    const top0 = 18;
    const total = tracks.reduce((a, b) => a + b.h, 0);
    const avail = H - top0 - 18;
    let y = top0;
    const box: Record<string, [number, number]> = {};
    for (const tr of tracks) {
      const hh = (tr.h / total) * avail;
      box[tr.key] = [y, y + hh];
      y += hh;
    }
    const i0 = this.idx(t0);
    const i1 = this.idx(t1);
    // Phase band
    for (let i = i0; i < i1; i++) {
      ctx.fillStyle = PHASE_COLOR[hm.phase[i]];
      ctx.fillRect(X(hm.from + i), 4, Math.max(1, X(hm.from + i + 1) - X(hm.from + i)) + 0.5, 9);
    }
    ctx.font = '11px system-ui, sans-serif';
    // Track frames and labels
    for (const tr of tracks) {
      const [a, b] = box[tr.key];
      ctx.strokeStyle = line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(L, b - 0.5);
      ctx.lineTo(R, b - 0.5);
      ctx.stroke();
      ctx.fillStyle = muted;
      ctx.save();
      ctx.translate(11, (a + b) / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillText(tr.label, 0, 0);
      ctx.restore();
    }
    const plot = (arr: Float32Array, key: string, lo: number, hi: number, color: string, width = 1.6, dash: number[] = []): void => {
      const [a, b] = box[key];
      const Y = (v: number): number => b - 4 - ((v - lo) / (hi - lo)) * (b - a - 8);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash);
      ctx.beginPath();
      const step = Math.max(1, Math.floor((i1 - i0) / (R - L)));
      for (let i = i0; i <= i1; i += step) {
        const xx = X(hm.from + i);
        const yy = Y(Math.max(lo - (hi - lo) * 0.05, Math.min(hi + (hi - lo) * 0.05, arr[i])));
        if (i === i0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };
    const axis = (key: string, lo: number, hi: number, ticks: number[]): void => {
      const [a, b] = box[key];
      ctx.fillStyle = muted;
      ctx.textAlign = 'right';
      for (const v of ticks) {
        const yy = b - 4 - ((v - lo) / (hi - lo)) * (b - a - 8);
        ctx.fillText(String(v), L - 4, yy + 3);
        ctx.strokeStyle = line;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(L, yy);
        ctx.lineTo(R, yy);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.textAlign = 'left';
    };
    // Pressures
    let pmax = 40;
    for (let i = i0; i <= i1; i++) pmax = Math.max(pmax, hm.aoP[i], hm.lvP[i]);
    pmax = Math.ceil((pmax + 10) / 20) * 20;
    axis('press', 0, pmax, pmax > 100 ? [0, 40, 80, 120].filter((v) => v < pmax) : [0, 20, 40, 60].filter((v) => v < pmax));
    const cAo = css('--danger') || '#c62828';
    const cLv = css('--accent') || '#1565c0';
    const cLa = css('--lad-ap') || '#8e24aa';
    if (this.right) {
      plot(hm.paP, 'press', 0, pmax, '#2e7d32', 1.3);
      plot(hm.rvP, 'press', 0, pmax, '#00897b', 1.3, [5, 3]);
      plot(hm.raP, 'press', 0, pmax, '#ef6c00', 1.3, [2, 2]);
    }
    plot(hm.laP, 'press', 0, pmax, cLa, 1.4, [4, 3]);
    plot(hm.aoP, 'press', 0, pmax, cAo, 2);
    plot(hm.lvP, 'press', 0, pmax, cLv, 2);
    // Legend
    const leg: [string, string, number[]][] = [
      ['Aorta', cAo, []],
      ['LV', cLv, []],
      ['LA', cLa, [4, 3]],
    ];
    if (this.right) leg.push(['PA', '#2e7d32', []], ['RV', '#00897b', [5, 3]], ['RA', '#ef6c00', [2, 2]]);
    let lx = L + 6;
    const ly = box.press[0] + 10;
    for (const [name, col, dash] of leg) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + 16, ly);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ink;
      ctx.fillText(name, lx + 19, ly + 4);
      lx += 26 + ctx.measureText(name).width + 6;
    }
    // Volume
    let vmin = 1e9;
    let vmax = -1e9;
    for (let i = i0; i <= i1; i++) {
      vmin = Math.min(vmin, hm.lvV[i]);
      vmax = Math.max(vmax, hm.lvV[i]);
    }
    const vlo = Math.max(0, Math.floor((vmin - 10) / 20) * 20);
    const vhi = Math.ceil((vmax + 10) / 20) * 20;
    axis('vol', vlo, vhi, [vlo, vhi]);
    plot(hm.lvV, 'vol', vlo, vhi, cLv, 1.8);
    // ECG
    const lead = run.sig.leads.II ?? Object.values(run.sig.leads)[0];
    if (lead) {
      const eFrom = Math.round(((t0 - run.sig.from) * run.sig.fs) / 1000);
      const [a, b] = box.ecg;
      const mid = (a + b) / 2 + 6;
      const k = (b - a) / 3.2;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const n = Math.round(((t1 - t0) * run.sig.fs) / 1000);
      for (let j = 0; j <= n; j += 2) {
        const i = eFrom + j;
        if (i < 0 || i >= lead.length) continue;
        const xx = X(run.sig.from + (i * 1000) / run.sig.fs);
        const yy = mid - Math.max(-1.6, Math.min(1.6, lead[i])) * k;
        if (j === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    }
    // PCG
    plot(hm.pcg, 'pcg', -1.6, 1.6, ink, 1);
    ctx.fillStyle = ink;
    ctx.font = 'bold 11px system-ui, sans-serif';
    for (const s of hm.sounds) {
      if (s.t < t0 || s.t > t1) continue;
      if (s.component === 'T1') continue;
      let lab: string = s.component;
      let dy = 0;
      if (s.component === 'M1') lab = 'S1';
      else if (s.component === 'A2' || s.component === 'P2') {
        const other = hm.sounds.find((x) => x.component === (s.component === 'A2' ? 'P2' : 'A2') && Math.abs(x.t - s.t) < 150);
        const gap = other ? Math.abs(other.t - s.t) : 999;
        if (gap < 30) {
          if (s.component === 'P2') continue;
          lab = 'S2';
        } else dy = s.component === 'P2' ? 10 : 0;
      }
      ctx.fillText(lab, X(s.t) - 6, box.pcg[0] + 11 + dy);
    }
    ctx.font = '11px system-ui, sans-serif';
    // JVP with a / c / v labels
    let jmin = 1e9;
    let jmax = -1e9;
    for (let i = i0; i <= i1; i++) {
      jmin = Math.min(jmin, hm.jvp[i]);
      jmax = Math.max(jmax, hm.jvp[i]);
    }
    const jlo = Math.floor(jmin - 1);
    const jhi = Math.max(jlo + 6, Math.ceil(jmax + 1));
    plot(hm.jvp, 'jvp', jlo, jhi, '#ef6c00', 1.8);
    this.labelJvp(ctx, X, box.jvp, jlo, jhi, i0, i1);
    // Valve events (left heart; right heart too when shown)
    const VL: Record<string, string> = { 'mitral-close': 'MC', 'aortic-open': 'AO', 'aortic-close': 'AC', 'mitral-open': 'MO', 'tricuspid-close': 'TC', 'pulmonary-open': 'PO', 'pulmonary-close': 'PC', 'tricuspid-open': 'TO' };
    for (const ev of hm.valveEvents) {
      if (ev.t < t0 || ev.t > t1) continue;
      const right = ev.valve === 'tricuspid' || ev.valve === 'pulmonary';
      if (right && !this.right) continue;
      const xx = X(ev.t);
      ctx.strokeStyle = right ? '#00897b' : muted;
      ctx.globalAlpha = 0.6;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(xx, box.press[0]);
      ctx.lineTo(xx, box.vol[1]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = right ? '#00897b' : muted;
      ctx.fillText(VL[`${ev.valve}-${ev.kind}`], xx + 2, box.vol[1] - 3 - (right ? 11 : 0));
    }
    // Cursor
    const cx = X(this.t);
    ctx.strokeStyle = css('--accent-2') || '#a15c00';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, 2);
    ctx.lineTo(cx, H - 16);
    ctx.stroke();
    // Time axis
    ctx.fillStyle = muted;
    ctx.textAlign = 'center';
    for (let tt = Math.ceil(t0 / 200) * 200; tt <= t1; tt += 200) ctx.fillText(`${(tt / 1000).toFixed(1)} s`, X(tt), H - 4);
    ctx.textAlign = 'left';
    this.drawPv();
  }

  private labelJvp(ctx: CanvasRenderingContext2D, X: (t: number) => number, b: [number, number], lo: number, hi: number, i0: number, i1: number): void {
    const hm = this.hemo!;
    const Y = (v: number): number => b[1] - 4 - ((v - lo) / (hi - lo)) * (b[1] - b[0] - 8);
    const put = (i: number, s: string, below = false): void => {
      if (i < i0 || i > i1) return;
      ctx.fillStyle = '#ef6c00';
      ctx.fillText(s, X(hm.from + i) - 3, Y(hm.jvp[i]) + (below ? 12 : -4));
    };
    const argmax = (a: number, z: number): number => {
      let m = a;
      for (let i = a; i <= z; i++) if (hm.jvp[i] > hm.jvp[m]) m = i;
      return m;
    };
    const argmin = (a: number, z: number): number => {
      let m = a;
      for (let i = a; i <= z; i++) if (hm.jvp[i] < hm.jvp[m]) m = i;
      return m;
    };
    ctx.font = 'bold 11px system-ui, sans-serif';
    // a wave: peak of right-atrial contraction
    for (let i = Math.max(1, i0); i < i1 - 1; i++) {
      if (hm.eRa[i] >= 0.98 && hm.eRa[i] >= hm.eRa[i - 1] && hm.eRa[i] > hm.eRa[i + 1]) {
        const m = argmax(Math.max(i0, i - 50), Math.min(i1, i + 40));
        const cannon = (hm.valves[m] & 2) === 0;
        put(m, cannon ? 'cannon a' : 'a');
      }
    }
    // c, x, v, y from tricuspid events
    for (const ev of hm.valveEvents) {
      if (ev.valve !== 'tricuspid') continue;
      const i = Math.round(ev.t - hm.from);
      if (i < i0 || i > i1) continue;
      if (ev.kind === 'close') {
        const c = argmax(i, Math.min(i1, i + 50));
        if (hm.eRa[c] < 0.3) put(c, 'c');
      } else {
        const v = argmax(Math.max(i0, i - 60), i);
        if (hm.eRa[v] < 0.3) put(v, 'v');
        const y = argmin(i, Math.min(i1, i + 160));
        put(y, 'y', true);
      }
    }
    ctx.font = '11px system-ui, sans-serif';
  }

  private drawPv(): void {
    const hm = this.hemo;
    const run = this.run;
    const cv = this.pv;
    const W = cv.clientWidth || 220;
    const H = 220;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      cv.style.height = `${H}px`;
    }
    const ctx = cv.getContext('2d');
    if (!ctx || !hm || !run) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = css('--panel') || '#fff';
    ctx.fillRect(0, 0, W, H);
    const muted = css('--muted') || '#666';
    const line = css('--line') || '#ddd';
    const cLv = css('--accent') || '#1565c0';
    // Current beat = from the last QRS before the cursor to the next QRS.
    const vt = run.sim.ventricular.map((v) => v.t).filter((x) => x >= hm.from);
    let a = vt.filter((x) => x <= this.t).pop();
    let z = vt.find((x) => x > this.t);
    if (a === undefined) a = Math.max(hm.from, this.t - 900);
    if (z === undefined) z = Math.min(hm.from + hm.n - 1, a + 1200);
    if (z - a > 2500) z = a + 2500;
    const ia = this.idx(a);
    const iz = this.idx(z);
    const ic = this.idx(this.t);
    let vmax = 160;
    let pmax = 140;
    for (let i = ia; i <= iz; i++) {
      vmax = Math.max(vmax, hm.lvV[i] + 10);
      pmax = Math.max(pmax, hm.lvP[i] + 10);
    }
    const L = 34;
    const B = H - 22;
    const X = (v: number): number => L + (v / vmax) * (W - L - 8);
    const Y = (pp: number): number => B - (Math.max(0, pp) / pmax) * (B - 8);
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(L, 6);
    ctx.lineTo(L, B);
    ctx.lineTo(W - 6, B);
    ctx.stroke();
    ctx.fillStyle = muted;
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('mmHg', 2, 12);
    ctx.fillText('LV volume (mL)', W - 86, H - 6);
    for (const v of [0, 50, 100, 150]) if (v < vmax) ctx.fillText(String(v), X(v) - 6, B + 12);
    for (const pp of [0, 50, 100]) if (pp < pmax) ctx.fillText(String(pp), 6, Y(pp) + 3);
    // ESPVR
    ctx.strokeStyle = muted;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(X(hm.lvV0), Y(0));
    const vEnd = Math.min(vmax, hm.lvV0 + pmax / hm.lvEes);
    ctx.lineTo(X(vEnd), Y((vEnd - hm.lvV0) * hm.lvEes));
    ctx.stroke();
    ctx.setLineDash([]);
    // Loop
    ctx.strokeStyle = cLv;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = ia; i <= iz; i++) {
      const xx = X(hm.lvV[i]);
      const yy = Y(hm.lvP[i]);
      if (i === ia) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    ctx.fillStyle = css('--accent-2') || '#a15c00';
    ctx.beginPath();
    ctx.arc(X(hm.lvV[ic]), Y(hm.lvP[ic]), 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // ------------------------------------------------------------------ audio
  private toggleListen(): void {
    if (this.src) {
      this.stopListen();
      return;
    }
    const hm = this.hemo;
    if (!hm) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audio ??= new AC();
      const ac = this.audio;
      const sr = ac.sampleRate;
      const dur = hm.n / hm.fs;
      const buf = ac.createBuffer(1, Math.ceil(dur * sr), sr);
      const d = buf.getChannelData(0);
      const burst = (t: number, amp: number, f: number, len: number): void => {
        const s0 = Math.round(((t - hm.from) / 1000) * sr);
        const n = Math.round((len / 1000) * sr);
        for (let k = 0; k < n; k++) {
          const i = s0 + k;
          if (i < 0 || i >= d.length) continue;
          const tt = k / sr;
          const env = Math.min(1, k / (0.004 * sr)) * Math.exp(-tt / (len / 4000));
          // Fundamental plus overtones so the low-pitched sounds are audible on small speakers.
          d[i] += amp * env * (0.6 * Math.sin(2 * Math.PI * f * tt) + 0.3 * Math.sin(2 * Math.PI * f * 2.7 * tt + 0.5) + 0.15 * Math.sin(2 * Math.PI * f * 5.1 * tt + 1.2));
        }
      };
      for (const s of hm.sounds) {
        if (s.kind === 'S1') burst(s.t, 0.45 * s.amp, 55, 110);
        else if (s.kind === 'S2') burst(s.t, 0.4 * s.amp, 75, 80);
        else burst(s.t, 0.35 * s.amp, 35, 120);
      }
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.connect(ac.destination);
      const offset = Math.max(0, Math.min(dur - 0.1, (this.t - hm.from) / 1000));
      src.start(0, offset);
      src.onended = () => {
        if (this.src === src) this.stopListen();
      };
      this.src = src;
      this.listenBtn.textContent = '■ Stop sound';
    } catch {
      this.listenBtn.textContent = 'Audio unavailable';
    }
  }

  private stopListen(): void {
    try {
      this.src?.stop();
    } catch {
      /* already stopped */
    }
    this.src = null;
    if (this.listenBtn) this.listenBtn.textContent = '🔊 Listen (real time)';
  }
}
