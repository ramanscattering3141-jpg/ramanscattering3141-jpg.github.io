// In-flight user interface: HUD, cockpit instrument panel with autopilot control
// panel, moving map, pause menu, help, crash and landing reports.

import { h, clear, toast } from './dom';
import { drawSixPack, drawPFD, drawND, drawEngineDisplay, type InstrumentData } from './Instruments';
import type { FlightSession } from '../sim/FlightSession';
import { KT, FT, FPM, NM, clamp, wrap360 } from '../core/math';
import { fmtDuration } from '../sim/Scoring';
import { ACTION_LABELS, prettyKey, type Action, type Input } from '../input/Input';
import { CAMERA_LABELS, type CameraMode } from '../camera/CameraSystem';

export interface FlightUIHandlers {
  onResume(): void;
  onRestart(): void;
  onPlanner(): void;
  onSettings(): void;
  onCamera(m: CameraMode): void;
  onContinueAfterLanding(): void;
}

export class FlightUI {
  root: HTMLElement;
  private hud: HTMLElement;
  private hudFields: Record<string, HTMLElement> = {};
  private panel: HTMLElement;
  private canvas: HTMLCanvasElement;
  private mcp: HTMLElement;
  private mapCanvas: HTMLCanvasElement;
  private overlay: HTMLElement;
  private msg: HTMLElement;
  private camBadge: HTMLElement;
  private drawAcc = 0;
  private ndRange = 40;
  private mapRangeNm = 200;
  private coast: number[][] | null = null;
  private borders: number[][] | null = null;
  showHud = true;
  showPanel = false;
  showMap = false;
  private session: FlightSession | null = null;
  private lastMessage = '';

  constructor(parent: HTMLElement, private input: Input, private handlers: FlightUIHandlers, private dataBase: string) {
    this.root = h('div', { class: 'flight-ui hidden' });
    this.hud = h('div', { class: 'hud' });
    for (const [k, l] of [['ias', 'IAS'], ['alt', 'ALT'], ['hdg', 'HDG'], ['vs', 'V/S'], ['thr', 'THR'], ['flaps', 'FLAPS'], ['gear', 'GEAR'], ['fuel', 'FUEL'], ['dist', 'DEST'], ['ap', 'AP']]) {
      const v = h('div', { class: 'v' }, '--');
      this.hudFields[k] = v;
      this.hud.append(h('div', { class: `cell c-${k}` }, h('div', { class: 'k' }, l), v));
    }
    this.canvas = h('canvas', { class: 'instruments' });
    this.mcp = h('div', { class: 'mcp' });
    this.panel = h('div', { class: 'panel hidden' }, this.canvas, this.mcp);
    this.mapCanvas = h('canvas', { class: 'map hidden', width: 420, height: 420 });
    this.mapCanvas.addEventListener('wheel', e => { this.mapRangeNm = clamp(this.mapRangeNm * (e.deltaY > 0 ? 1.4 : 0.7), 10, 5000); e.preventDefault(); }, { passive: false });
    this.overlay = h('div', { class: 'overlay hidden' });
    this.msg = h('div', { class: 'flight-msg' });
    this.camBadge = h('div', { class: 'cam-badge' });
    const topbar = h('div', { class: 'topbar' },
      ...(['cockpit', 'chase', 'wing', 'free', 'tower'] as CameraMode[]).map((m, i) => h('button', { class: 'chip', title: `${CAMERA_LABELS[m]} camera (${i + 1})`, onclick: () => handlers.onCamera(m) }, CAMERA_LABELS[m])),
      h('button', { class: 'chip', title: 'Instrument panel (O)', onclick: () => this.togglePanel() }, 'Panel'),
      h('button', { class: 'chip', title: 'Map (M)', onclick: () => this.toggleMap() }, 'Map'),
      h('button', { class: 'chip', title: 'Help (H)', onclick: () => this.showHelp() }, 'Help'),
      h('button', { class: 'chip', title: 'Pause (Esc)', onclick: () => handlers.onResume() }, '❚❚'),
    );
    this.root.append(this.hud, topbar, this.camBadge, this.msg, this.panel, this.mapCanvas, this.overlay);
    parent.append(this.root);
  }

  attach(s: FlightSession) {
    this.session = s;
    this.buildMcp();
    this.root.classList.remove('hidden');
    this.hideOverlay();
  }

  detach() {
    this.session = null;
    this.root.classList.add('hidden');
  }

  togglePanel(force?: boolean) {
    this.showPanel = force ?? !this.showPanel;
    this.panel.classList.toggle('hidden', !this.showPanel);
  }
  toggleHud() {
    this.showHud = !this.showHud;
    this.hud.classList.toggle('hidden', !this.showHud);
  }
  toggleMap() {
    this.showMap = !this.showMap;
    this.mapCanvas.classList.toggle('hidden', !this.showMap);
    if (this.showMap && !this.coast) {
      fetch(`${this.dataBase}/geo/coastline.json`).then(r => r.json()).then(d => { this.coast = d.lines; }).catch(() => { this.coast = []; });
      fetch(`${this.dataBase}/geo/borders.json`).then(r => r.json()).then(d => { this.borders = d.lines; }).catch(() => { this.borders = []; });
    }
  }

  setCameraLabel(m: CameraMode) {
    this.camBadge.textContent = `${CAMERA_LABELS[m]} view`;
    this.camBadge.classList.remove('fade');
    void this.camBadge.offsetWidth;
    this.camBadge.classList.add('fade');
  }

  // ---------------- autopilot control panel ----------------
  private buildMcp() {
    const s = this.session!;
    const ap = s.ap;
    clear(this.mcp);
    const glass = s.config.aircraft.cockpit === 'glass';
    const btn = (text: string, title: string, fn: () => void, active?: () => boolean) => {
      const b = h('button', { class: 'mcp-btn', title, onclick: () => { fn(); this.refreshMcp(); } }, text);
      if (active) (b as HTMLButtonElement & { active?: () => boolean }).active = active;
      return b;
    };
    const knob = (name: string, value: () => string, dec: () => void, inc: () => void, title: string) => {
      const v = h('div', { class: 'mcp-val' }, value());
      const wrap = h('div', { class: 'mcp-knob', title },
        h('div', { class: 'mcp-name' }, name),
        h('div', { class: 'mcp-row' }, h('button', { class: 'mcp-adj', onclick: () => { dec(); v.textContent = value(); } }, '−'), v, h('button', { class: 'mcp-adj', onclick: () => { inc(); v.textContent = value(); } }, '+')),
      );
      wrap.addEventListener('wheel', e => { e.preventDefault(); (e.deltaY < 0 ? inc : dec)(); v.textContent = value(); }, { passive: false });
      (wrap as HTMLElement & { refresh?: () => void }).refresh = () => { v.textContent = value(); };
      return wrap;
    };
    const T = ap.targets;
    const def = s.config.aircraft;
    this.mcp.append(
      btn('A/P', 'Autopilot engage/disengage (Q)', () => ap.engage(), () => ap.engaged),
      btn('FD', 'Flight director', () => { ap.fd = !ap.fd; }, () => ap.fd),
      btn('A/THR', 'Autothrottle (Shift+Q)', () => ap.setAthr(), () => ap.athr),
      knob(T.speedIsMach ? 'MACH' : 'SPD', () => (T.speedIsMach ? T.mach.toFixed(2) : String(T.speedKt)), () => { if (T.speedIsMach) T.mach = Math.max(0.3, +(T.mach - 0.01).toFixed(2)); else T.speedKt = Math.max(40, T.speedKt - 5); }, () => { if (T.speedIsMach) T.mach = Math.min(def.spec.mmo ?? 0.9, +(T.mach + 0.01).toFixed(2)); else T.speedKt = Math.min(def.spec.vmoKt, T.speedKt + 5); }, 'Selected speed (scroll or ±)'),
      ...(glass && def.spec.mmo ? [btn('IAS/M', 'Toggle IAS / Mach target', () => { T.speedIsMach = !T.speedIsMach; this.buildMcp(); }, () => T.speedIsMach)] : []),
      knob('HDG', () => String(Math.round(T.heading)).padStart(3, '0'), () => { T.heading = wrap360(T.heading - 5); }, () => { T.heading = wrap360(T.heading + 5); }, 'Selected heading (scroll or ±)'),
      btn('HDG', 'Heading select mode', () => ap.setLateral('HDG'), () => ap.lateral === 'HDG'),
      btn(glass ? 'LNAV' : 'NAV', 'Follow the GPS flight plan', () => ap.setLateral('NAV'), () => ap.lateral === 'NAV'),
      btn(glass ? 'APP' : 'APR', 'Arm approach: localizer + glideslope to the destination runway', () => ap.armApproach(), () => ap.locArmed || ap.gsArmed || ap.lateral === 'LOC'),
      knob('ALT', () => String(T.altitudeFt), () => { T.altitudeFt = Math.max(0, T.altitudeFt - (T.altitudeFt > 10000 ? 1000 : 500)); }, () => { T.altitudeFt = Math.min(def.spec.ceilingFt, T.altitudeFt + (T.altitudeFt >= 10000 ? 1000 : 500)); }, 'Selected altitude (scroll or ±)'),
      btn('ALT', 'Altitude hold', () => { T.altitudeFt = Math.round(s.fdm.telemetry.alt / FT / 100) * 100; ap.setVertical('ALT'); this.buildMcp(); }, () => ap.vertical === 'ALT'),
      knob('V/S', () => String(T.vsFpm), () => { T.vsFpm = clamp(T.vsFpm - 100, -6000, 6000); }, () => { T.vsFpm = clamp(T.vsFpm + 100, -6000, 6000); }, 'Selected vertical speed (scroll or ±)'),
      btn('V/S', 'Vertical speed mode', () => { const keep = T.vsFpm; ap.setVertical('VS'); if (keep !== 0) T.vsFpm = keep; else T.vsFpm = T.altitudeFt > s.fdm.telemetry.alt / FT ? 1000 : -1000; this.buildMcp(); }, () => ap.vertical === 'VS'),
      ...(glass ? [btn('FLCH', 'Level change: climb/descend at selected speed', () => ap.setVertical('FLCH'), () => ap.vertical === 'FLCH')] : []),
    );
    this.refreshMcp();
  }

  private refreshMcp() {
    for (const el of Array.from(this.mcp.children)) {
      const b = el as HTMLElement & { active?: () => boolean; refresh?: () => void };
      if (b.active) b.classList.toggle('on', b.active());
      b.refresh?.();
    }
  }

  // ---------------- per-frame ----------------
  update(dt: number) {
    const s = this.session;
    if (!s || s.status === 'loading') return;
    const t = s.fdm.telemetry;
    const f = this.hudFields;
    const metric = false;
    f.ias.textContent = metric ? `${Math.round(t.ias * 3.6)} km/h` : `${Math.round(t.ias / KT)} kt`;
    f.ias.className = `v ${t.overspeed ? 'warn' : t.stallWarning ? 'caution' : ''}`;
    f.alt.textContent = `${Math.round(t.alt / FT).toLocaleString()} ft`;
    f.hdg.textContent = `${String(Math.round(t.heading) % 360).padStart(3, '0')}° T`;
    f.vs.textContent = `${t.vs >= 0 ? '+' : ''}${Math.round(t.vs / FPM / 10) * 10} fpm`;
    f.thr.textContent = `${Math.round(t.throttle * 100)}%${t.reverse ? ' REV' : ''}${t.engines.every(e => e.status !== 'running') ? ' OFF' : ''}`;
    f.flaps.textContent = t.flapLabel + (t.spoilers > 0.05 ? ' SPD BRK' : '');
    f.gear.textContent = !s.config.aircraft.gear.retractable ? 'FIXED' : t.gearPos > 0.99 ? 'DOWN' : t.gearPos < 0.01 ? 'UP' : 'MOVING';
    f.gear.className = `v ${t.gearPos > 0.99 ? 'ok' : t.gearPos > 0.01 ? 'caution' : ''}`;
    const fuelPct = (t.fuelKg / s.fdm.maxFuelKg) * 100;
    f.fuel.textContent = `${fuelPct.toFixed(0)}%`;
    f.fuel.className = `v ${fuelPct < 8 ? 'warn' : ''}`;
    const g = s.gpsState;
    f.dist.textContent = g.hasPlan ? `${(g.distToDestM / NM).toFixed(g.distToDestM < 20 * NM ? 1 : 0)} NM${g.eteDestS ? ' · ' + fmtDuration(g.eteDestS) : ''}` : '--';
    const ap = s.ap;
    f.ap.textContent = ap.engaged ? `${ap.lateral === 'NAV' ? 'LNAV' : ap.lateral} ${ap.vertical === 'VS' ? 'V/S' : ap.vertical}${ap.athr ? ' A/T' : ''}` : ap.athr ? 'A/T' : 'OFF';
    f.ap.className = `v ${ap.engaged ? 'ok' : ''}`;

    const warn = t.stalled || t.stallWarning ? 'STALL' : t.overspeed ? 'OVERSPEED' : t.flapOverspeed ? 'FLAP OVERSPEED' : t.parkingBrake && t.throttle > 0.3 && t.onGround ? 'PARKING BRAKE SET' : t.engines.every(e => e.status !== 'running') && !t.onGround ? 'ENGINES OFF' : '';
    const m = warn || s.message || ap.message;
    if (m !== this.lastMessage) {
      this.msg.textContent = m;
      this.msg.className = `flight-msg ${warn ? 'warn' : 'info'}`;
      this.lastMessage = m;
      if (!warn && m) setTimeout(() => { if (s.message === m) s.message = ''; if (ap.message === m) ap.message = ''; }, 4000);
    }

    this.drawAcc += dt;
    if (this.drawAcc > 1 / 30) {
      this.drawAcc = 0;
      if (this.showPanel) { this.drawPanel(s); this.refreshMcp(); }
      if (this.showMap) this.drawMap(s);
    }
  }

  private drawPanel(s: FlightSession) {
    const c = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = c.clientWidth, H = c.clientHeight;
    if (!W || !H) return;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const d: InstrumentData = { t: s.fdm.telemetry, fdm: s.fdm, ap: s.ap, gps: s.gpsState, app: s.approach, plan: s.plan, simRate: s.simRate };
    if (s.config.aircraft.cockpit === 'ga') drawSixPack(ctx, W, H, d);
    else {
      ctx.fillStyle = '#23272e'; ctx.fillRect(0, 0, W, H);
      const gap = 6;
      const pw = Math.min(W * 0.38, H * 1.25);
      drawPFD(ctx, gap, gap, pw, H - gap * 2, d);
      // Auto-range the ND around the next waypoint / approach.
      const want = s.gpsState.hasPlan ? s.gpsState.distToWptM / NM : 40;
      const ranges = [5, 10, 20, 40, 80, 160, 320, 640];
      this.ndRange = ranges.find(r => r >= want * 1.15) ?? 640;
      const nw = Math.min((W - pw) * 0.6, H * 1.3);
      drawND(ctx, pw + gap * 2, gap, nw, H - gap * 2, d, this.ndRange);
      drawEngineDisplay(ctx, pw + nw + gap * 3, gap, W - pw - nw - gap * 4, H - gap * 2, d);
    }
  }

  private drawMap(s: FlightSession) {
    const c = this.mapCanvas, ctx = c.getContext('2d')!;
    const W = c.width, H = c.height;
    const t = s.fdm.telemetry;
    ctx.fillStyle = '#0c2238'; ctx.fillRect(0, 0, W, H);
    const kmPerPx = (this.mapRangeNm * 1.852 * 2) / W;
    const cosLat = Math.cos((t.lat * Math.PI) / 180);
    const proj = (lon: number, lat: number): [number, number] => {
      let dLon = lon - t.lon;
      if (dLon > 180) dLon -= 360; if (dLon < -180) dLon += 360;
      return [W / 2 + (dLon * 111.32 * cosLat) / kmPerPx, H / 2 - ((lat - t.lat) * 110.57) / kmPerPx];
    };
    const drawLines = (lines: number[][] | null, color: string, w: number) => {
      if (!lines) return;
      ctx.strokeStyle = color; ctx.lineWidth = w;
      for (const l of lines) {
        ctx.beginPath();
        let started = false, px = 0;
        for (let i = 0; i < l.length; i += 2) {
          const [x, y] = proj(l[i], l[i + 1]);
          if (!started || Math.abs(x - px) > W) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
          px = x;
        }
        ctx.stroke();
      }
    };
    drawLines(this.coast, '#7fb0d8', 1.2);
    drawLines(this.borders, '#c9a85a', 0.8);
    const wps = s.plan.waypoints;
    ctx.strokeStyle = '#ff4fe0'; ctx.lineWidth = 2.5; ctx.beginPath();
    wps.forEach((w, i) => { const [x, y] = proj(w.lon, w.lat); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke();
    for (const a of [s.config.departure, s.config.destination]) {
      const [x, y] = proj(a.lon, a.lat);
      ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '600 12px system-ui'; ctx.fillText(a.icao || a.ident, x + 8, y - 6);
    }
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate((t.heading * Math.PI) / 180);
    ctx.fillStyle = '#ffe14d'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, H - 24, W, 24);
    ctx.fillStyle = '#fff'; ctx.font = '12px system-ui';
    ctx.fillText(`${t.lat.toFixed(3)}°, ${t.lon.toFixed(3)}°  ·  range ${Math.round(this.mapRangeNm)} NM (scroll to zoom)`, 8, H - 8);
  }

  // ---------------- overlays ----------------
  private hideOverlay() {
    this.overlay.classList.add('hidden');
    clear(this.overlay);
  }

  get overlayOpen() {
    return !this.overlay.classList.contains('hidden');
  }

  closeOverlay() {
    this.hideOverlay();
  }

  private showOverlay(...content: (Node | string)[]) {
    clear(this.overlay);
    this.overlay.append(h('div', { class: 'card' }, ...content));
    this.overlay.classList.remove('hidden');
  }

  showPause() {
    const s = this.session!;
    this.showOverlay(
      h('h2', {}, 'Paused'),
      h('p', { class: 'muted' }, `${s.config.aircraft.name} · ${s.config.departure.icao || s.config.departure.ident} → ${s.config.destination.icao || s.config.destination.ident}`),
      h('div', { class: 'btn-col' },
        h('button', { class: 'btn primary', onclick: () => this.handlers.onResume() }, 'Resume (Esc)'),
        h('button', { class: 'btn', onclick: () => this.handlers.onRestart() }, 'Restart flight'),
        h('button', { class: 'btn', onclick: () => this.handlers.onSettings() }, 'Settings'),
        h('button', { class: 'btn', onclick: () => this.showHelp() }, 'Controls'),
        h('button', { class: 'btn', onclick: () => this.handlers.onPlanner() }, 'End flight → Flight planner'),
      ),
    );
  }

  showHelp() {
    const groups: [string, Action[]][] = [
      ['Flight controls', ['pitchDown', 'pitchUp', 'rollLeft', 'rollRight', 'yawLeft', 'yawRight', 'throttleUp', 'throttleDown', 'throttleFull', 'throttleIdle', 'trimDown', 'trimUp']],
      ['Aircraft', ['flapsDown', 'flapsUp', 'gear', 'brakes', 'parkingBrake', 'spoilers', 'reverse', 'engines']],
      ['Autopilot', ['apToggle', 'athrToggle']],
      ['View & sim', ['camNext', 'camCockpit', 'camChase', 'camWing', 'camFree', 'camTower', 'lookReset', 'hud', 'panel', 'map', 'mouseYoke', 'simRateUp', 'simRateDown', 'pause', 'help']],
    ];
    this.showOverlay(
      h('h2', {}, 'Controls'),
      h('div', { class: 'help-grid' }, ...groups.map(([title, acts]) => h('div', {},
        h('h3', {}, title),
        h('table', {}, ...acts.map(a => h('tr', {}, h('td', { class: 'keys' }, this.input.bindings[a].map(prettyKey).join(' / ')), h('td', {}, ACTION_LABELS[a]))))),
      )),
      h('p', { class: 'muted' }, 'Mouse: right-drag to look around (cockpit/chase), wheel to zoom. Gamepad: left stick = pitch/roll, right stick = rudder, triggers = throttle, A = brakes, B/X = flaps, Y = camera, D-pad up = gear. All keys can be changed in Settings → Controls.'),
      h('p', { class: 'muted' }, 'Tip: on the runway, set flaps for take-off, release the parking brake (P), apply full throttle (Shift+R), and pull back gently (↓) at the rotation speed shown in the planner.'),
      h('div', { class: 'btn-row' }, h('button', { class: 'btn primary', onclick: () => (this.session?.paused ? this.showPause() : this.handlers.onResume()) }, 'Close')),
    );
  }

  showCrash(reason: string, part = '') {
    const texts: Record<string, string> = {
      terrain: 'The aircraft struck the terrain.', water: 'The aircraft hit the water.', 'gear-collapse': 'The landing gear collapsed on a very hard landing.',
      'tail-strike': 'Tail strike — the tail hit the runway (too much pitch on rotation or flare).', overspeed: 'Structural failure from excessive speed.', 'belly-landing': 'Gear-up landing: the aircraft landed on its belly.',
    };
    this.showOverlay(
      h('h2', { class: 'bad' }, 'Crash'),
      h('p', {}, texts[reason] ?? reason),
      part && reason === 'terrain' ? h('p', { class: 'muted' }, `First contact: ${part}.`) : '',
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn primary', onclick: () => this.handlers.onRestart() }, 'Restart flight'),
        h('button', { class: 'btn', onclick: () => this.handlers.onPlanner() }, 'Flight planner'),
      ),
    );
  }

  showReport() {
    const s = this.session!;
    const r = s.report;
    const res = s.missionResult;
    this.showOverlay(
      h('h2', { class: res?.passed ? 'good' : '' }, res?.text ?? 'Flight complete'),
      s.config.mission ? h('p', {}, `Mission: ${s.config.mission.title} — ${res?.passed ? 'PASSED' : 'NOT PASSED'}`) : null as unknown as string,
      r ? h('table', { class: 'report' },
        ...r.items.map(i => h('tr', {}, h('td', {}, i.label), h('td', { class: 'score' }, `${Math.round(i.score)}`), h('td', { class: 'muted' }, i.detail))),
        h('tr', { class: 'total' }, h('td', {}, 'Overall'), h('td', { class: 'score' }, `${Math.round(r.total)}`), h('td', {}, '')),
      ) : '',
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn primary', onclick: () => this.handlers.onPlanner() }, 'New flight'),
        h('button', { class: 'btn', onclick: () => this.handlers.onContinueAfterLanding() }, 'Keep flying'),
        h('button', { class: 'btn', onclick: () => this.handlers.onRestart() }, 'Fly again'),
      ),
    );
  }

  showLoading(text: string) {
    this.showOverlay(h('div', { class: 'spinner' }), h('p', {}, text));
  }

  notify(text: string) {
    toast(text);
  }
}
