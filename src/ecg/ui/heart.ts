// Animated conduction-system schematic (frontal view: patient's right on the viewer's left).
// Driven entirely by the simulator's event log, so what lights up is what the model did.

import type { EcgRun } from '../engine';
import { AP_SITE, VENT_SITE, P_SITE } from '../engine/morphology';
import type { Bundle } from '../engine/params';
import { s, h } from './dom';

const X = (x: number): number => 150 + 105 * x;
const Y = (y: number): number => 150 + 105 * y;

const NODES = {
  SA: [88, 62],
  AVN: [138, 132],
  HIS: [146, 150],
  RBend: [110, 238],
  LBsplit: [160, 168],
  LAFend: [205, 175],
  LPFend: [196, 238],
  apex: [160, 262],
};

export class HeartView {
  readonly el: SVGSVGElement;
  private dyn: SVGGElement;
  private run: EcgRun | null = null;
  private wrap: HTMLDivElement;
  private caption: HTMLDivElement;
  private clipId = '';
  private waves: SVGGElement = s('g');

  constructor() {
    this.dyn = s('g');
    this.el = s('svg', { viewBox: '0 0 300 300', class: 'heart-svg', role: 'img', 'aria-label': 'Conduction system schematic' });
    this.caption = h('div', { class: 'heart-caption' });
    this.wrap = h('div', { class: 'heart-wrap' });
    this.wrap.append(this.el, this.caption);
  }

  get root(): HTMLDivElement {
    return this.wrap;
  }

  setRun(run: EcgRun): void {
    this.run = run;
    this.drawStatic();
    this.setTime(0);
  }

  private drawStatic(): void {
    const run = this.run!;
    const R = run.physio.rhythm;
    const el = this.el;
    while (el.firstChild) el.removeChild(el.firstChild);
    const CH = 'M70 60 Q55 95 70 130 Q95 150 130 138 L132 70 Q105 45 70 60Z M150 70 L150 138 Q190 150 222 125 Q235 90 215 62 Q180 48 150 70Z M72 150 Q70 215 120 262 Q140 275 158 268 L150 150 Q110 142 72 150Z M150 150 L158 268 Q200 262 228 210 Q245 165 222 145 Q185 138 150 150Z';
    const clipId = `hc${Math.floor(Math.random() * 1e9)}`;
    this.clipId = clipId;
    const defs = s('defs', null, s('radialGradient', { id: 'glow' }, s('stop', { offset: '0%', 'stop-color': 'var(--act)', 'stop-opacity': '0.9' }), s('stop', { offset: '100%', 'stop-color': 'var(--act)', 'stop-opacity': '0' })), s('clipPath', { id: clipId }, s('path', { d: CH })));
    el.appendChild(defs);
    // Chambers
    el.appendChild(s('path', { class: 'ch ra', d: 'M70 60 Q55 95 70 130 Q95 150 130 138 L132 70 Q105 45 70 60Z' }));
    el.appendChild(s('path', { class: 'ch la', d: 'M150 70 L150 138 Q190 150 222 125 Q235 90 215 62 Q180 48 150 70Z' }));
    el.appendChild(s('path', { class: 'ch rv', d: 'M72 150 Q70 215 120 262 Q140 275 158 268 L150 150 Q110 142 72 150Z' }));
    el.appendChild(s('path', { class: 'ch lv', d: 'M150 150 L158 268 Q200 262 228 210 Q245 165 222 145 Q185 138 150 150Z' }));
    el.appendChild(s('text', { x: 80, y: 105, class: 'ch-l' }, 'RA'));
    el.appendChild(s('text', { x: 190, y: 105, class: 'ch-l' }, 'LA'));
    el.appendChild(s('text', { x: 100, y: 210, class: 'ch-l' }, 'RV'));
    el.appendChild(s('text', { x: 190, y: 215, class: 'ch-l' }, 'LV'));
    // Conduction system
    const sys = s('g', { class: 'cs' });
    sys.appendChild(s('path', { d: `M${NODES.SA} Q110 100 ${NODES.AVN}`, class: 'cs-int' }));
    sys.appendChild(s('path', { d: `M${NODES.SA} Q150 70 200 80`, class: 'cs-int' }));
    if (R.dualPathway) {
      sys.appendChild(s('path', { d: 'M126 122 Q126 134 138 140', class: 'cs-fast', id: 'fp' }));
      sys.appendChild(s('path', { d: 'M118 132 Q124 148 140 144', class: 'cs-slow', id: 'sp' }));
      sys.appendChild(s('text', { x: 100, y: 120, class: 'cs-l fast' }, 'fast'));
      sys.appendChild(s('text', { x: 96, y: 150, class: 'cs-l slow' }, 'slow'));
    }
    sys.appendChild(s('circle', { cx: NODES.SA[0], cy: NODES.SA[1], r: 6, class: 'node sa' }));
    sys.appendChild(s('ellipse', { cx: NODES.AVN[0], cy: NODES.AVN[1], rx: 7, ry: 5, class: 'node avn' }));
    const bundle: Bundle = run.physio.bundle;
    const rbBlocked = bundle.startsWith('rbbb') || bundle === 'incompleteRbbb';
    const lbBlocked = bundle === 'lbbb';
    const lafBlocked = bundle === 'lafb' || bundle === 'rbbb+lafb' || lbBlocked;
    const lpfBlocked = bundle === 'lpfb' || bundle === 'rbbb+lpfb' || lbBlocked;
    sys.appendChild(s('path', { d: `M${NODES.AVN} L${NODES.HIS}`, class: 'cs-his' }));
    sys.appendChild(s('path', { d: `M${NODES.HIS} Q128 190 ${NODES.RBend}`, class: `cs-b ${rbBlocked ? 'blocked' : ''}` }));
    sys.appendChild(s('path', { d: `M${NODES.HIS} L${NODES.LBsplit}`, class: `cs-b ${lbBlocked ? 'blocked' : ''}` }));
    sys.appendChild(s('path', { d: `M${NODES.LBsplit} Q185 165 ${NODES.LAFend}`, class: `cs-b ${lafBlocked ? 'blocked' : ''}` }));
    sys.appendChild(s('path', { d: `M${NODES.LBsplit} Q175 205 ${NODES.LPFend}`, class: `cs-b ${lpfBlocked ? 'blocked' : ''}` }));
    for (const [x, y, lab] of [[112, 196, rbBlocked ? '✕ RB' : 'RB'], [172, 160, lbBlocked ? '✕ LB' : ''], [207, 170, lafBlocked && !lbBlocked ? '✕ LAF' : 'LAF'], [190, 250, lpfBlocked && !lbBlocked ? '✕ LPF' : 'LPF']] as const) {
      if (lab) sys.appendChild(s('text', { x, y, class: `cs-l ${String(lab).startsWith('✕') ? 'blk' : ''}` }, String(lab)));
    }
    sys.appendChild(s('text', { x: 66, y: 56, class: 'cs-l' }, 'SA'));
    sys.appendChild(s('text', { x: 148, y: 128, class: 'cs-l' }, 'AVN'));
    sys.appendChild(s('text', { x: 152, y: 152, class: 'cs-l' }, 'His'));
    if (R.nodalBlock === 'complete' || !R.avnConducts) sys.appendChild(s('text', { x: 128, y: 136, class: 'blk-mark' }, '✕'));
    if (R.infranodal === 'complete') sys.appendChild(s('text', { x: 142, y: 164, class: 'blk-mark' }, '✕'));
    el.appendChild(sys);
    // Accessory pathway
    if (R.ap.present) {
      const site = AP_SITE[R.ap.location].pos;
      const vx = X(site[0]);
      const vy = Math.max(152, Y(site[1] * 0.4) + 10);
      const ay = vy - 26;
      el.appendChild(s('path', { d: `M${vx} ${ay} L${vx} ${vy}`, class: `ap-line ${R.ap.antegrade ? '' : 'concealed'}` }));
      el.appendChild(s('text', { x: vx + 4, y: ay + 10, class: 'cs-l ap' }, R.ap.antegrade ? 'AP' : 'AP (concealed)'));
    }
    // Ectopic ventricular focus / pacing lead
    const vm = R.ventMechanism;
    const focusSite = vm !== 'none' && vm !== 'vf' && vm !== 'vflutter' && vm !== 'asystole' ? R.vtSite : R.pvc.pattern !== 'none' ? R.pvc.site : null;
    if (focusSite) {
      const pos = VENT_SITE[focusSite].pos;
      el.appendChild(s('circle', { cx: X(pos[0] * 0.8), cy: 205 + 55 * pos[1], r: 5, class: 'focus' }));
    }
    if (R.pacer.mode !== 'none') {
      el.appendChild(s('path', { d: 'M40 20 Q60 40 70 60 L78 140 Q100 230 125 258', class: 'lead-wire' }));
      el.appendChild(s('text', { x: 18, y: 16, class: 'cs-l' }, `pacemaker ${R.pacer.mode}`));
    }
    this.waves = s('g', { 'clip-path': `url(#${this.clipId})` });
    el.appendChild(this.waves);
    this.dyn = s('g', { class: 'dyn' });
    el.appendChild(this.dyn);
  }

  /** Render activity at simulation time t (ms). */
  setTime(t: number): void {
    const run = this.run;
    if (!run) return;
    const g = this.dyn;
    while (g.firstChild) g.removeChild(g.firstChild);
    const W = this.waves;
    while (W.firstChild) W.removeChild(W.firstChild);
    const sim = run.sim;
    const notes: string[] = [];
    // Continuous mechanisms
    for (const c of sim.continuous) {
      if (t < c.t0 || t > c.t1) continue;
      if (c.kind === 'fib') {
        for (let i = 0; i < 7; i++) {
          const ph = Math.sin(t / 37 + i * 1.7);
          const x = i % 2 ? 90 + 22 * Math.sin(t / 90 + i) : 190 + 20 * Math.cos(t / 80 + i);
          const y = 90 + 25 * Math.sin(t / 70 + i * 2.1);
          W.appendChild(s('circle', { cx: x, cy: y, r: 10 + 6 * ph, class: 'wave' }));
        }
        notes.push('Atria: multiple chaotic wavelets (fibrillation)');
      } else if (c.kind === 'flutter') {
        const ph = ((t - c.t0) % (c.cl ?? 200)) / (c.cl ?? 200);
        const a = (c.reverse ? -1 : 1) * ph * Math.PI * 2;
        g.appendChild(s('circle', { cx: 100 + 28 * Math.cos(a), cy: 100 + 30 * Math.sin(a), r: 8, class: 'wave strong' }));
        g.appendChild(s('ellipse', { cx: 100, cy: 100, rx: 28, ry: 30, class: 'circuit' }));
        notes.push('Atria: macro-re-entry around the tricuspid annulus (flutter)');
      } else {
        for (let i = 0; i < 5; i++) {
          const x = 110 + 90 * ((Math.sin(t / 60 + i * 1.3) + 1) / 2);
          const y = 180 + 70 * ((Math.cos(t / 75 + i * 2.1) + 1) / 2);
          W.appendChild(s('circle', { cx: x, cy: y, r: 9, class: 'wave danger' }));
        }
        notes.push(c.kind === 'vf' ? 'Ventricles: fibrillation — no organised activation' : 'Ventricles: single very rapid circuit (ventricular flutter)');
      }
    }
    // Sinus node firing
    for (const lg of sim.log) {
      if (lg.node === 'SA' && lg.kind === 'fire' && t >= lg.t && t < lg.t + 60) g.appendChild(s('circle', { cx: NODES.SA[0], cy: NODES.SA[1], r: 10, class: 'pulse' }));
    }
    // Atrial activation: expanding wavefront from the origin
    for (const a of sim.atrial) {
      if (a.kind === 'flutter') continue;
      const dt = t - a.t;
      if (dt < 0 || dt > 110) continue;
      const origin = atrialOrigin(a.site);
      W.appendChild(s('circle', { cx: origin[0], cy: origin[1], r: 6 + dt * 0.75, class: 'wave', opacity: String(1 - dt / 130) }));
      W.appendChild(s('path', { d: 'M70 60 Q55 95 70 130 Q95 150 130 138 L132 70 Q105 45 70 60Z M150 70 L150 138 Q190 150 222 125 Q235 90 215 62 Q180 48 150 70Z', class: 'ch-act', opacity: String(0.45 * (1 - dt / 110)) }));
      notes.push(`Atria: ${a.label}`);
    }
    // AV conduction dots
    for (const sg of sim.ladder) {
      const lo = Math.min(sg.t0, sg.t1);
      const hi = Math.max(sg.t0, sg.t1);
      if (t < lo || t > hi) continue;
      const u = (t - sg.t0) / Math.max(1, sg.t1 - sg.t0);
      let x: number;
      let y: number;
      if (sg.row === 'AP') {
        const site = AP_SITE[run.physio.rhythm.ap.location].pos;
        x = X(site[0]);
        const vy = Math.max(152, Y(site[1] * 0.4) + 10);
        y = sg.dir === 'ante' ? vy - 26 + 26 * Math.min(1, Math.max(0, (t - sg.t0) / Math.max(1, sg.t1 - sg.t0))) : vy - 26 * Math.min(1, Math.max(0, (t - sg.t1) / Math.max(1, sg.t0 - sg.t1)));
        notes.push(`Accessory pathway: ${sg.dir === 'ante' ? 'antegrade' : 'retrograde'} conduction`);
      } else if (sg.dir === 'ante') {
        const k = Math.min(1, Math.max(0, u));
        x = 128 + (NODES.HIS[0] - 128) * k;
        y = 120 + (NODES.HIS[1] - 120) * k;
        notes.push(`AV node: ${sg.blocked ? 'impulse BLOCKED' : `antegrade conduction (${sg.path})`}`);
      } else {
        const k = Math.min(1, Math.max(0, (t - sg.t1) / Math.max(1, sg.t0 - sg.t1)));
        x = NODES.HIS[0] - (NODES.HIS[0] - 128) * k;
        y = NODES.HIS[1] - (NODES.HIS[1] - 120) * k;
        notes.push(`AV node: retrograde conduction (${sg.path.replace('retro-', '')})`);
      }
      g.appendChild(s('circle', { cx: x, cy: y, r: 5, class: `dot ${sg.blocked ? 'blocked' : sg.path.includes('slow') ? 'slow' : sg.path.includes('ap') ? 'ap' : 'fast'}` }));
    }
    // Blocks
    for (const lg of sim.log) {
      if (lg.kind !== 'block' || t < lg.t || t > lg.t + 250) continue;
      const pos = lg.node === 'AP' ? null : lg.node === 'HIS' ? NODES.HIS : lg.node === 'FP' || lg.node === 'SP' || lg.node === 'AVN' ? NODES.AVN : null;
      if (pos) g.appendChild(s('text', { x: pos[0] - 5, y: pos[1] + 5, class: 'blk-flash' }, '✕'));
    }
    // Ventricular activation
    for (const v of sim.ventricular) {
      const dt = t - v.t;
      if (dt < 0 || dt > 140) continue;
      let origins: number[][];
      if (v.route === 'his') {
        const b = run.physio.bundle;
        const rb = !(b.startsWith('rbbb') || v.aberrant === 'rbbb');
        const lb = b !== 'lbbb';
        origins = [...(rb ? [NODES.RBend] : []), ...(lb && b !== 'lafb' && b !== 'rbbb+lafb' ? [NODES.LAFend] : []), ...(lb && b !== 'lpfb' && b !== 'rbbb+lpfb' ? [NODES.LPFend] : [])];
        if (!origins.length) origins = [NODES.RBend];
        if (dt < 30) g.appendChild(s('path', { d: `M${NODES.HIS} Q128 190 ${NODES.RBend} M${NODES.HIS} L${NODES.LBsplit} Q185 165 ${NODES.LAFend} M${NODES.LBsplit} Q175 205 ${NODES.LPFend}`, class: 'cs-live' }));
      } else if (v.route === 'ap') {
        const site = AP_SITE[v.apLocation ?? 'leftLateral'].pos;
        origins = [[X(site[0]), Math.max(152, Y(site[1] * 0.4) + 10)]];
      } else {
        const pos = VENT_SITE[v.site ?? 'rvApex'].pos;
        origins = [[X(pos[0] * 0.8), 205 + 55 * pos[1]]];
      }
      const speed = v.route === 'his' ? 1.3 : 0.75;
      for (const o of origins) W.appendChild(s('circle', { cx: o[0], cy: o[1], r: 4 + dt * speed, class: 'wave v', opacity: String(1 - dt / 160) }));
      g.appendChild(s('path', { d: 'M72 150 Q70 215 120 262 Q140 275 158 268 L150 150 Q110 142 72 150Z M150 150 L158 268 Q200 262 228 210 Q245 165 222 145 Q185 138 150 150Z', class: 'ch-act v', opacity: String(0.4 * (1 - dt / 140)) }));
      notes.push(`Ventricles: ${v.label}`);
    }
    for (const sp of sim.spikes) {
      if (t >= sp.t && t < sp.t + 40) g.appendChild(s('text', { x: 30, y: 40, class: 'blk-flash' }, sp.chamber === 'shock' ? '⚡ shock' : `⚡ ${sp.chamber} pace${sp.captured ? '' : ' (no capture)'}`));
    }
    this.caption.textContent = notes.length ? [...new Set(notes)].slice(0, 3).join(' · ') : 'Electrical diastole (phase 4): pacemaker cells depolarising toward threshold';
  }
}

function atrialOrigin(site: string): [number, number] {
  switch (site) {
    case 'lowRA':
      return [110, 132];
    case 'leftAtrial':
    case 'retroLeftLateral':
      return [210, 100];
    case 'lowLA':
      return [195, 130];
    case 'retroSeptal':
    case 'retroPosteroseptal':
      return [132, 128];
    case 'retroRightFree':
      return [66, 110];
    default:
      return NODES.SA as [number, number];
  }
}

void P_SITE;
