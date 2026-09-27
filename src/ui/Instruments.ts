// Cockpit instruments drawn on canvas.
//   • GA aircraft: classic "six-pack" (airspeed, attitude, altimeter, turn
//     coordinator, heading indicator, vertical speed) + tachometer, fuel, GPS.
//   • Glass cockpits: Primary Flight Display (attitude, speed/altitude tapes,
//     flight director, FMA, ILS deviation), Navigation Display (route map) and
//     an engine/systems display.
// Headings are TRUE (the simulator has no magnetic variation model).

import type { FlightTelemetry, FlightDynamics } from '../aircraft/FlightDynamics';
import type { Autopilot } from '../aircraft/Autopilot';
import type { GpsState, ApproachState, FlightPlan } from '../navigation/Navigation';
import { KT, FT, FPM, NM, DEG, clamp, wrap180, wrap360 } from '../core/math';
import { distance, bearing } from '../core/geodesy';
import { fmtDuration } from '../sim/Scoring';

export interface InstrumentData {
  t: FlightTelemetry;
  fdm: FlightDynamics;
  ap: Autopilot;
  gps: GpsState;
  app: ApproachState | null;
  plan: FlightPlan;
  simRate: number;
}

const C = {
  sky: '#2f7fd0', ground: '#8a5a2b', white: '#f4f6f8', green: '#3ce36a', magenta: '#ff4fe0', cyan: '#3fd8ff',
  amber: '#ffb020', red: '#ff3b3b', bg: '#0b0f14', panel: '#1b1f25', dim: '#8a94a3', yellow: '#ffe14d',
};

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = '#101317';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3a414b'; ctx.lineWidth = r * 0.06;
  ctx.beginPath(); ctx.arc(x, y, r * 0.97, 0, Math.PI * 2); ctx.stroke();
}

function needle(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, w: number, color = C.white) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(0, -len); ctx.lineTo(w, 0); ctx.lineTo(0, len * 0.15); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color = C.white, align: CanvasTextAlign = 'center', weight = 600) {
  ctx.fillStyle = color; ctx.font = `${weight} ${size}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

// ------------------------------------------------------------------------------------------
// GA six-pack
// ------------------------------------------------------------------------------------------

export function drawSixPack(ctx: CanvasRenderingContext2D, W: number, H: number, d: InstrumentData) {
  const { t, fdm } = d;
  const def = fdm.def;
  ctx.fillStyle = '#23272e'; ctx.fillRect(0, 0, W, H);
  const r = Math.min(H / 4.3, W / 11.5);
  const left = Math.max(r * 0.2, (W - r * 2.25 * 3 - r * 6.2) / 2);
  const gx = (i: number) => left + r * 1.1 + i * r * 2.25;
  const row1 = r * 1.12, row2 = r * 3.3;

  // Airspeed indicator
  {
    const x = gx(0), y = row1; ring(ctx, x, y, r);
    const vne = def.spec.vmoKt, vs0 = def.spec.stallKt ?? def.perf.vrefKt / 1.3, vs1 = vs0 * 1.2, vno = vne * 0.79;
    const vfe = Math.max(...def.flaps.map(f => f.maxKt));
    const max = vne * 1.15;
    const a = (kt: number) => -Math.PI * 0.75 + (clamp(kt, 0, max) / max) * Math.PI * 1.6;
    const arc = (k0: number, k1: number, rr: number, col: string, w: number) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(x, y, rr, a(k0) - Math.PI / 2, a(k1) - Math.PI / 2); ctx.stroke(); };
    arc(vs0, vfe, r * 0.78, C.white, r * 0.07);
    arc(vs1, vno, r * 0.86, C.green, r * 0.08);
    arc(vno, vne, r * 0.86, C.yellow, r * 0.08);
    arc(vne, vne + 2, r * 0.86, C.red, r * 0.12);
    for (let k = 0; k <= max; k += 10) {
      const ang = a(k) - Math.PI / 2;
      const inner = k % 20 === 0 ? 0.74 : 0.8;
      ctx.strokeStyle = C.white; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(ang) * r * inner, y + Math.sin(ang) * r * inner); ctx.lineTo(x + Math.cos(ang) * r * 0.9, y + Math.sin(ang) * r * 0.9); ctx.stroke();
      if (k % (max > 250 ? 40 : 20) === 0) label(ctx, String(k), x + Math.cos(ang) * r * 0.6, y + Math.sin(ang) * r * 0.6, r * 0.14);
    }
    label(ctx, 'KNOTS', x, y + r * 0.35, r * 0.11, C.dim);
    needle(ctx, x, y, a(t.ias / KT), r * 0.82, r * 0.05);
  }
  // Attitude indicator
  {
    const x = gx(1), y = row1; ring(ctx, x, y, r);
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r * 0.9, 0, Math.PI * 2); ctx.clip();
    ctx.translate(x, y); ctx.rotate(-t.roll * DEG);
    const ppd = r * 0.035;
    const off = t.pitch * ppd;
    ctx.fillStyle = C.sky; ctx.fillRect(-r * 2, -r * 3 + off, r * 4, r * 3);
    ctx.fillStyle = C.ground; ctx.fillRect(-r * 2, off, r * 4, r * 3);
    ctx.strokeStyle = C.white; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-r * 2, off); ctx.lineTo(r * 2, off); ctx.stroke();
    for (let p = -20; p <= 20; p += 5) {
      if (!p) continue;
      const yy = off - p * ppd, w = p % 10 === 0 ? r * 0.3 : r * 0.15;
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-w, yy); ctx.lineTo(w, yy); ctx.stroke();
    }
    ctx.restore();
    // roll scale
    ctx.strokeStyle = C.white; ctx.lineWidth = 2;
    for (const b of [-60, -30, -20, -10, 0, 10, 20, 30, 60]) {
      const ang = (b - 90) * DEG;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(ang) * r * 0.9, y + Math.sin(ang) * r * 0.9); ctx.lineTo(x + Math.cos(ang) * r * (b % 30 === 0 ? 0.78 : 0.83), y + Math.sin(ang) * r * (b % 30 === 0 ? 0.78 : 0.83)); ctx.stroke();
    }
    ctx.save(); ctx.translate(x, y); ctx.rotate(-t.roll * DEG);
    ctx.fillStyle = C.amber; ctx.beginPath(); ctx.moveTo(0, -r * 0.77); ctx.lineTo(-r * 0.06, -r * 0.66); ctx.lineTo(r * 0.06, -r * 0.66); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = C.amber; ctx.lineWidth = r * 0.05;
    ctx.beginPath(); ctx.moveTo(x - r * 0.45, y); ctx.lineTo(x - r * 0.15, y); ctx.lineTo(x - r * 0.08, y + r * 0.08); ctx.moveTo(x + r * 0.45, y); ctx.lineTo(x + r * 0.15, y); ctx.lineTo(x + r * 0.08, y + r * 0.08); ctx.stroke();
    ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(x, y, r * 0.03, 0, Math.PI * 2); ctx.fill();
  }
  // Altimeter
  {
    const x = gx(2), y = row1; ring(ctx, x, y, r);
    const ft = t.alt / FT;
    for (let i = 0; i < 50; i++) {
      const ang = (i / 50) * Math.PI * 2 - Math.PI / 2;
      ctx.strokeStyle = C.white; ctx.lineWidth = i % 5 ? 1 : 2;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(ang) * r * (i % 5 ? 0.82 : 0.75), y + Math.sin(ang) * r * (i % 5 ? 0.82 : 0.75)); ctx.lineTo(x + Math.cos(ang) * r * 0.9, y + Math.sin(ang) * r * 0.9); ctx.stroke();
      if (i % 5 === 0) label(ctx, String(i / 5), x + Math.cos(ang) * r * 0.62, y + Math.sin(ang) * r * 0.62, r * 0.16);
    }
    label(ctx, `${Math.round(ft).toLocaleString()} FT`, x, y + r * 0.33, r * 0.12, C.dim);
    needle(ctx, x, y, ((ft % 100000) / 10000) * Math.PI * 2, r * 0.45, r * 0.03, C.dim);
    needle(ctx, x, y, ((ft % 10000) / 10000) * Math.PI * 2, r * 0.55, r * 0.07);
    needle(ctx, x, y, ((ft % 1000) / 1000) * Math.PI * 2, r * 0.85, r * 0.04);
  }
  // Turn coordinator
  {
    const x = gx(0), y = row2; ring(ctx, x, y, r);
    const rate = clamp(-(d.fdm.omega[2] ?? 0) / DEG, -6, 6); // deg/s; standard rate = 3°/s
    label(ctx, 'L', x - r * 0.62, y + r * 0.2, r * 0.14); label(ctx, 'R', x + r * 0.62, y + r * 0.2, r * 0.14);
    label(ctx, '2 MIN', x, y + r * 0.62, r * 0.1, C.dim);
    ctx.save(); ctx.translate(x, y); ctx.rotate(-rate / 3 * 20 * DEG);
    ctx.strokeStyle = C.white; ctx.lineWidth = r * 0.06;
    ctx.beginPath(); ctx.moveTo(-r * 0.6, 0); ctx.lineTo(r * 0.6, 0); ctx.moveTo(0, 0); ctx.lineTo(0, -r * 0.15); ctx.stroke();
    ctx.restore();
    // inclinometer ball
    ctx.fillStyle = '#222'; ctx.fillRect(x - r * 0.45, y + r * 0.3, r * 0.9, r * 0.18);
    ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(x + clamp(-t.beta * 0.06, -0.38, 0.38) * r, y + r * 0.39, r * 0.08, 0, Math.PI * 2); ctx.fill();
  }
  // Heading indicator
  {
    const x = gx(1), y = row2; ring(ctx, x, y, r);
    ctx.save(); ctx.translate(x, y); ctx.rotate(-t.heading * DEG);
    for (let hdg = 0; hdg < 360; hdg += 5) {
      ctx.save(); ctx.rotate(hdg * DEG);
      ctx.strokeStyle = C.white; ctx.lineWidth = hdg % 10 ? 1 : 2;
      ctx.beginPath(); ctx.moveTo(0, -r * 0.88); ctx.lineTo(0, -r * (hdg % 10 ? 0.82 : 0.76)); ctx.stroke();
      if (hdg % 30 === 0) label(ctx, ({ 0: 'N', 90: 'E', 180: 'S', 270: 'W' } as Record<number, string>)[hdg] ?? String(hdg / 10), 0, -r * 0.62, r * 0.15);
      ctx.restore();
    }
    // heading bug
    ctx.save(); ctx.rotate(d.ap.targets.heading * DEG); ctx.fillStyle = C.cyan; ctx.fillRect(-r * 0.06, -r * 0.92, r * 0.12, r * 0.08); ctx.restore();
    ctx.restore();
    ctx.fillStyle = C.amber; ctx.beginPath(); ctx.moveTo(x, y - r * 0.4); ctx.lineTo(x - r * 0.12, y + r * 0.2); ctx.lineTo(x, y + r * 0.1); ctx.lineTo(x + r * 0.12, y + r * 0.2); ctx.fill();
    label(ctx, `${String(Math.round(t.heading) % 360).padStart(3, '0')}°T`, x, y + r * 0.5, r * 0.12, C.dim);
  }
  // Vertical speed
  {
    const x = gx(2), y = row2; ring(ctx, x, y, r);
    const a = (fpm: number) => Math.PI + (clamp(fpm, -2000, 2000) / 2000) * Math.PI * 0.85;
    for (const f of [-2000, -1500, -1000, -500, 0, 500, 1000, 1500, 2000]) {
      const ang = a(f) - Math.PI / 2 + Math.PI / 2;
      label(ctx, String(Math.abs(f / 100)), x + Math.cos(ang) * r * 0.65, y + Math.sin(ang) * r * 0.65, r * 0.13);
    }
    label(ctx, 'VERT SPEED', x + r * 0.15, y - r * 0.28, r * 0.09, C.dim);
    label(ctx, '100 FT/MIN', x + r * 0.15, y + r * 0.28, r * 0.09, C.dim);
    needle(ctx, x, y, a(t.vs / FPM) - Math.PI / 2, r * 0.82, r * 0.05);
  }
  // Right side: engine, fuel, systems & GPS
  const bx = gx(3) - r * 0.9, bw = Math.min(W - bx - r * 0.2, r * 5.2);
  ctx.fillStyle = '#0d1117'; ctx.fillRect(bx, r * 0.15, bw, H - r * 0.3);
  const e = t.engines[0];
  let yy = r * 0.45;
  const line = (k: string, v: string, col = C.white) => { label(ctx, k, bx + bw * 0.05, yy, r * 0.15, C.dim, 'left'); label(ctx, v, bx + bw * 0.95, yy, r * 0.17, col, 'right'); yy += r * 0.3; };
  const engLabel = def.engine.kind === 'piston' ? 'RPM' : def.engine.kind === 'turboprop' ? 'TRQ %' : 'N1 %';
  line(engLabel, e.status === 'running' ? e.display.toFixed(0) : e.status.toUpperCase(), e.status === 'running' ? C.green : C.amber);
  line('THROTTLE', `${Math.round(t.throttle * 100)}%${t.reverse ? ' REV' : ''}`);
  line('FUEL', `${(t.fuelKg / def.fuelDensity / 3.785).toFixed(1)} gal`, t.fuelKg < fdm.maxFuelKg * 0.1 ? C.amber : C.white);
  line('FLOW', `${(t.fuelFlowKgH / def.fuelDensity / 3.785).toFixed(1)} gph`);
  line('FLAPS', t.flapLabel);
  line('GEAR', def.gear.retractable ? (t.gearPos > 0.99 ? 'DOWN' : t.gearPos < 0.01 ? 'UP' : 'TRANSIT') : 'FIXED', t.gearPos > 0.99 ? C.green : C.amber);
  line('TRIM', `${(fdm.trimPos * 100).toFixed(0)}`);
  if (t.parkingBrake) line('PARK BRK', 'SET', C.amber);
  // GPS box
  yy += r * 0.1;
  const g = d.gps;
  if (g.hasPlan && g.activeWaypoint) {
    line('GPS WPT', g.activeWaypoint.ident, C.magenta);
    line('DIS / BRG', `${(g.distToWptM / NM).toFixed(1)} NM ${String(Math.round(g.bearingToWpt)).padStart(3, '0')}°`);
    line('DTK / XTK', `${String(Math.round(g.desiredTrack)).padStart(3, '0')}° ${(g.crossTrackM / NM).toFixed(2)}`);
    line('DEST', `${(g.distToDestM / NM).toFixed(0)} NM ${g.eteDestS ? fmtDuration(g.eteDestS) : '--'}`);
  }
}

// ------------------------------------------------------------------------------------------
// Glass cockpit
// ------------------------------------------------------------------------------------------

export function drawPFD(ctx: CanvasRenderingContext2D, x0: number, y0: number, W: number, H: number, d: InstrumentData) {
  const { t, ap, fdm } = d;
  const def = fdm.def;
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0, W, H); ctx.clip();
  ctx.fillStyle = C.bg; ctx.fillRect(x0, y0, W, H);
  const cx = x0 + W * 0.5, cy = y0 + H * 0.47;
  const ar = Math.min(W * 0.28, H * 0.33);
  const ppd = ar / 22;

  // Attitude
  ctx.save();
  ctx.beginPath(); ctx.rect(cx - ar, cy - ar, ar * 2, ar * 2); ctx.clip();
  ctx.translate(cx, cy); ctx.rotate(-t.roll * DEG);
  const off = t.pitch * ppd;
  ctx.fillStyle = C.sky; ctx.fillRect(-ar * 3, -ar * 4 + off, ar * 6, ar * 4);
  ctx.fillStyle = C.ground; ctx.fillRect(-ar * 3, off, ar * 6, ar * 4);
  ctx.strokeStyle = C.white; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-ar * 3, off); ctx.lineTo(ar * 3, off); ctx.stroke();
  for (let p = -30; p <= 30; p += 2.5) {
    if (!p) continue;
    const yy = off - p * ppd;
    if (Math.abs(yy) > ar * 0.8) continue;
    const w = p % 10 === 0 ? ar * 0.28 : p % 5 === 0 ? ar * 0.16 : ar * 0.07;
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-w, yy); ctx.lineTo(w, yy); ctx.stroke();
    if (p % 10 === 0) { label(ctx, String(Math.abs(p)), -w - ar * 0.1, yy, ar * 0.08); label(ctx, String(Math.abs(p)), w + ar * 0.1, yy, ar * 0.08); }
  }
  ctx.restore();
  // roll arc
  ctx.strokeStyle = C.white; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, ar * 0.95, (-90 - 60) * DEG, (-90 + 60) * DEG); ctx.stroke();
  for (const b of [-60, -45, -30, -20, -10, 10, 20, 30, 45, 60]) {
    const ang = (b - 90) * DEG, l = Math.abs(b) % 30 === 0 ? 0.08 : 0.04;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(ang) * ar * 0.95, cy + Math.sin(ang) * ar * 0.95); ctx.lineTo(cx + Math.cos(ang) * ar * (0.95 + l), cy + Math.sin(ang) * ar * (0.95 + l)); ctx.stroke();
  }
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-t.roll * DEG);
  ctx.fillStyle = Math.abs(t.roll) > 35 ? C.amber : C.white;
  ctx.beginPath(); ctx.moveTo(0, -ar * 0.94); ctx.lineTo(-ar * 0.05, -ar * 0.85); ctx.lineTo(ar * 0.05, -ar * 0.85); ctx.fill();
  // slip indicator
  ctx.fillRect(-ar * 0.05 + clamp(-t.beta, -8, 8) * ar * 0.01, -ar * 0.83, ar * 0.1, ar * 0.025);
  ctx.restore();
  // Flight director (magenta bars)
  if (ap.fd && !t.onGround) {
    ctx.strokeStyle = C.magenta; ctx.lineWidth = 3;
    const py = clamp((t.pitch - ap.fdPitch) * ppd, -ar * 0.6, ar * 0.6);
    const bx = clamp((ap.fdBank - t.roll) * ar * 0.02, -ar * 0.6, ar * 0.6);
    ctx.beginPath(); ctx.moveTo(cx - ar * 0.5, cy + py); ctx.lineTo(cx + ar * 0.5, cy + py); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + bx, cy - ar * 0.5); ctx.lineTo(cx + bx, cy + ar * 0.5); ctx.stroke();
  }
  // Aircraft symbol
  ctx.fillStyle = '#000'; ctx.strokeStyle = C.yellow; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx - ar * 0.55, cy); ctx.lineTo(cx - ar * 0.2, cy); ctx.lineTo(cx - ar * 0.2, cy + ar * 0.08); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + ar * 0.55, cy); ctx.lineTo(cx + ar * 0.2, cy); ctx.lineTo(cx + ar * 0.2, cy + ar * 0.08); ctx.stroke();
  ctx.fillStyle = C.yellow; ctx.fillRect(cx - 3, cy - 3, 6, 6);

  // Speed tape
  const tw = W * 0.14, th = ar * 2;
  const sx = cx - ar - tw - W * 0.02, sy = cy - ar;
  ctx.fillStyle = '#3a4250'; ctx.fillRect(sx, sy, tw, th);
  const ias = t.ias / KT, ppk = th / 80;
  ctx.save(); ctx.beginPath(); ctx.rect(sx, sy, tw, th); ctx.clip();
  const vsw = Math.sqrt((2 * t.massKg * 9.81) / (1.225 * def.spec.wingAreaM2 * (def.aero.clMaxClean + def.aero.dClMaxFlaps * t.flapsFrac))) / KT;
  // low-speed (red/black) and overspeed barber poles
  const barber = (k0: number, k1: number, col: string) => { const y1 = cy - (k1 - ias) * ppk, y2 = cy - (k0 - ias) * ppk; ctx.fillStyle = col; ctx.fillRect(sx + tw - 8, y1, 8, y2 - y1); };
  barber(0, vsw, C.red);
  barber(vsw, vsw * 1.2, C.amber);
  barber(def.spec.vmoKt, def.spec.vmoKt + 200, C.red);
  for (let k = Math.floor((ias - 45) / 10) * 10; k < ias + 45; k += 10) {
    if (k < 0) continue;
    const yy = cy - (k - ias) * ppk;
    ctx.strokeStyle = C.white; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(sx + tw - 12, yy); ctx.lineTo(sx + tw - 2, yy); ctx.stroke();
    if (k % 20 === 0) label(ctx, String(k), sx + tw * 0.42, yy, ar * 0.085);
  }
  // selected speed bug
  const sel = ap.targets.speedIsMach ? ap.targets.mach * (t.tas / Math.max(t.mach, 0.01)) / KT * (t.ias / Math.max(t.tas, 1)) : ap.targets.speedKt;
  ctx.fillStyle = C.magenta; ctx.fillRect(sx + tw - 10, cy - (sel - ias) * ppk - 5, 10, 10);
  ctx.restore();
  ctx.fillStyle = '#000'; ctx.fillRect(sx - 2, cy - ar * 0.09, tw * 0.85, ar * 0.18);
  ctx.strokeStyle = C.white; ctx.lineWidth = 1.5; ctx.strokeRect(sx - 2, cy - ar * 0.09, tw * 0.85, ar * 0.18);
  label(ctx, String(Math.round(ias)), sx + tw * 0.4, cy, ar * 0.11, t.overspeed ? C.red : t.stallWarning ? C.amber : C.white);
  label(ctx, ap.targets.speedIsMach ? `M.${Math.round(ap.targets.mach * 1000).toString().padStart(3, '0')}` : String(Math.round(ap.targets.speedKt)), sx + tw / 2, sy - ar * 0.08, ar * 0.09, C.magenta);
  if (t.mach > 0.4) label(ctx, `M ${t.mach.toFixed(3).slice(1)}`, sx + tw / 2, sy + th + ar * 0.08, ar * 0.09, C.white);

  // Altitude tape
  const ax = cx + ar + W * 0.02, aw = W * 0.15;
  ctx.fillStyle = '#3a4250'; ctx.fillRect(ax, sy, aw, th);
  const alt = t.alt / FT, ppf = th / 1000;
  ctx.save(); ctx.beginPath(); ctx.rect(ax, sy, aw, th); ctx.clip();
  for (let f = Math.floor((alt - 550) / 100) * 100; f < alt + 550; f += 100) {
    const yy = cy - (f - alt) * ppf;
    ctx.strokeStyle = C.white; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(ax, yy); ctx.lineTo(ax + 10, yy); ctx.stroke();
    if (f % 200 === 0) label(ctx, String(f), ax + aw * 0.55, yy, ar * 0.075);
  }
  // ground (radio altitude reference)
  const gy = cy - (t.groundElev / FT - alt) * ppf;
  ctx.fillStyle = C.amber; ctx.fillRect(ax, gy, aw, th);
  ctx.fillStyle = C.cyan; ctx.fillRect(ax, cy - (ap.targets.altitudeFt - alt) * ppf - 5, 10, 10);
  ctx.restore();
  ctx.fillStyle = '#000'; ctx.fillRect(ax + 4, cy - ar * 0.09, aw * 0.95, ar * 0.18);
  ctx.strokeStyle = C.white; ctx.strokeRect(ax + 4, cy - ar * 0.09, aw * 0.95, ar * 0.18);
  label(ctx, String(Math.round(alt / 10) * 10), ax + aw * 0.5, cy, ar * 0.1);
  label(ctx, String(Math.round(ap.targets.altitudeFt)), ax + aw / 2, sy - ar * 0.08, ar * 0.09, C.cyan);
  // Vertical speed
  const vx = ax + aw + W * 0.015, vs = t.vs / FPM;
  ctx.fillStyle = '#2b313b'; ctx.fillRect(vx, cy - ar * 0.8, W * 0.035, ar * 1.6);
  const vsy = cy - clamp(Math.sign(vs) * Math.sqrt(Math.abs(vs) / 6000), -1, 1) * ar * 0.75;
  ctx.strokeStyle = C.white; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(vx + W * 0.035, cy); ctx.lineTo(vx + 2, vsy); ctx.stroke();
  if (Math.abs(vs) > 400) label(ctx, String(Math.round(vs / 100) * 100), vx + W * 0.018, vs > 0 ? cy - ar * 0.88 : cy + ar * 0.88, ar * 0.07);

  // Heading scale
  const hy = y0 + H * 0.92;
  ctx.fillStyle = '#2b313b'; ctx.fillRect(cx - ar, hy - H * 0.05, ar * 2, H * 0.1);
  ctx.save(); ctx.beginPath(); ctx.rect(cx - ar, hy - H * 0.05, ar * 2, H * 0.1); ctx.clip();
  const ppdh = ar / 25;
  for (let hh = Math.floor(t.heading / 5) * 5 - 30; hh <= t.heading + 30; hh += 5) {
    const xx = cx + wrap180(hh - t.heading) * ppdh;
    ctx.strokeStyle = C.white; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(xx, hy - H * 0.05); ctx.lineTo(xx, hy - H * (hh % 10 ? 0.035 : 0.02)); ctx.stroke();
    if (hh % 10 === 0) label(ctx, String(wrap360(hh) / 10).padStart(2, '0'), xx, hy + H * 0.012, ar * 0.075);
  }
  ctx.fillStyle = C.cyan; ctx.fillRect(cx + wrap180(ap.targets.heading - t.heading) * ppdh - 5, hy - H * 0.05, 10, 8);
  ctx.fillStyle = C.green; ctx.beginPath(); const tx = cx + wrap180(t.track - t.heading) * ppdh; ctx.arc(tx, hy - H * 0.04, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = C.yellow; ctx.fillRect(cx - 1, hy - H * 0.06, 2, H * 0.03);
  label(ctx, `${String(Math.round(t.heading) % 360).padStart(3, '0')} T`, cx, hy - H * 0.075, ar * 0.08);

  // ILS / approach deviations
  if (d.app && d.app.inRange) {
    const a = d.app;
    ctx.strokeStyle = C.white; ctx.lineWidth = 1.5;
    for (const k of [-2, -1, 1, 2]) {
      ctx.beginPath(); ctx.arc(cx + k * ar * 0.3, cy + ar * 1.08, 3, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + ar * 1.08, cy + k * ar * 0.3, 3, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = C.magenta;
    const lx = cx - clamp(a.locDots, -2.3, 2.3) * ar * 0.3;
    ctx.beginPath(); ctx.moveTo(lx, cy + ar * 1.02); ctx.lineTo(lx + 8, cy + ar * 1.08); ctx.lineTo(lx, cy + ar * 1.14); ctx.lineTo(lx - 8, cy + ar * 1.08); ctx.fill();
    const gsy = cy + clamp(a.gsDots, -2.3, 2.3) * ar * 0.3;
    ctx.beginPath(); ctx.moveTo(cx + ar * 1.02, gsy); ctx.lineTo(cx + ar * 1.08, gsy - 8); ctx.lineTo(cx + ar * 1.14, gsy); ctx.lineTo(cx + ar * 1.08, gsy + 8); ctx.fill();
    label(ctx, `RW${a.runway.ident} ${(a.distThresholdM / NM).toFixed(1)}NM`, cx - ar, y0 + H * 0.1, ar * 0.07, C.magenta, 'left');
  }
  // Radio altitude
  if (t.agl < 2500 * FT && !t.onGround) label(ctx, String(Math.round(t.agl / FT / 10) * 10), cx, cy + ar * 0.72, ar * 0.12, t.agl < 500 * FT ? C.amber : C.green);

  // FMA
  const fy = y0 + H * 0.035;
  ctx.fillStyle = '#000'; ctx.fillRect(x0, y0, W, H * 0.075);
  const cols = [
    ap.athr ? (ap.vertical === 'FLCH' ? (ap.targets.altitudeFt > t.alt / FT ? 'THR' : 'IDLE') : ap.targets.speedIsMach ? 'MACH' : 'SPD') : '',
    ap.lateral === 'ROLL' ? '' : ap.lateral === 'NAV' ? 'LNAV' : ap.lateral,
    ap.vertical === 'PITCH' ? '' : ap.vertical === 'VS' ? 'V/S' : ap.vertical === 'GS' ? 'G/S' : ap.vertical === 'FLCH' ? 'FLCH SPD' : ap.vertical,
    ap.engaged ? 'A/P' : ap.fd ? 'FD' : '',
  ];
  cols.forEach((s, i) => label(ctx, s, x0 + W * (0.14 + i * 0.24), fy, ar * 0.09, C.green));
  const armed = [ap.locArmed ? 'LOC' : '', ap.gsArmed ? 'G/S' : ''].filter(Boolean).join(' ');
  if (armed) label(ctx, armed, x0 + W * 0.5, fy + H * 0.05, ar * 0.075, C.white);
  // Warnings
  const warn = t.stalled ? 'STALL' : t.stallWarning ? 'STALL' : t.overspeed ? 'OVERSPEED' : !t.onGround && t.agl < 500 * FT && t.vs < -8 && t.gearPos < 0.5 && def.gear.retractable ? 'GEAR' : !t.onGround && t.vs / FPM < -(t.agl / FT) * 1.2 && t.agl < 2500 * FT && t.agl > 100 * FT ? 'PULL UP' : '';
  if (warn && Math.floor(performance.now() / 400) % 2) label(ctx, warn, cx, cy - ar * 0.55, ar * 0.16, C.red, 'center', 800);
  ctx.restore();
}

export function drawND(ctx: CanvasRenderingContext2D, x0: number, y0: number, W: number, H: number, d: InstrumentData, rangeNm: number) {
  const { t, gps, plan, ap } = d;
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0, W, H); ctx.clip();
  ctx.fillStyle = C.bg; ctx.fillRect(x0, y0, W, H);
  const cx = x0 + W / 2, cy = y0 + H * 0.82;
  const R = Math.min(W * 0.46, H * 0.72);
  const ppm = R / (rangeNm * NM);
  // compass arc
  ctx.strokeStyle = C.white; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  for (let hh = 0; hh < 360; hh += 5) {
    const rel = wrap180(hh - t.heading);
    if (Math.abs(rel) > 55) continue;
    const a = (rel - 90) * DEG;
    const l = hh % 10 ? 8 : 14;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.lineTo(cx + Math.cos(a) * (R - l), cy + Math.sin(a) * (R - l)); ctx.stroke();
    if (hh % 30 === 0) label(ctx, String(hh / 10), cx + Math.cos(a) * (R - 26), cy + Math.sin(a) * (R - 26), 13);
  }
  ctx.setLineDash([4, 6]); ctx.strokeStyle = '#6c7686';
  ctx.beginPath(); ctx.arc(cx, cy, R / 2, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.setLineDash([]);
  label(ctx, String(rangeNm / 2), cx - R / 2 - 14, cy - 10, 11, C.dim);
  // heading bug & track line
  const hb = (wrap180(ap.targets.heading - t.heading) - 90) * DEG;
  ctx.fillStyle = C.cyan; ctx.beginPath(); ctx.arc(cx + Math.cos(hb) * R, cy + Math.sin(hb) * R, 6, 0, Math.PI * 2); ctx.fill();
  const tr = (wrap180(t.track - t.heading) - 90) * DEG;
  ctx.strokeStyle = C.green; ctx.setLineDash([8, 6]); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(tr) * R, cy + Math.sin(tr) * R); ctx.stroke(); ctx.setLineDash([]);
  // route
  const proj = (lat: number, lon: number) => {
    const dist = distance(t.lat, t.lon, lat, lon);
    const brg = bearing(t.lat, t.lon, lat, lon);
    const a = (wrap180(brg - t.heading) - 90) * DEG;
    return [cx + Math.cos(a) * dist * ppm, cy + Math.sin(a) * dist * ppm];
  };
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
  const wps = plan.waypoints;
  for (let i = 1; i < wps.length; i++) {
    const [ax, ay] = proj(wps[i - 1].lat, wps[i - 1].lon), [bx, by] = proj(wps[i].lat, wps[i].lon);
    ctx.strokeStyle = i === plan.activeLeg ? C.magenta : C.white; ctx.lineWidth = i === plan.activeLeg ? 3 : 2;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  }
  wps.forEach((w, i) => {
    const [px, py] = proj(w.lat, w.lon);
    ctx.strokeStyle = i === plan.activeLeg ? C.magenta : C.white; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px, py - 7); ctx.lineTo(px + 7, py); ctx.lineTo(px, py + 7); ctx.lineTo(px - 7, py); ctx.closePath(); ctx.stroke();
    label(ctx, w.ident, px + 10, py - 10, 12, i === plan.activeLeg ? C.magenta : C.white, 'left');
  });
  // localizer course line
  if (d.app?.inRange) {
    const rw = d.app.runway;
    const [ax, ay] = proj(rw.lat, rw.lon);
    const back = (wrap180(rw.headingTrue + 180 - t.heading) - 90) * DEG;
    ctx.strokeStyle = C.magenta; ctx.setLineDash([10, 6]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + Math.cos(back) * R * 2, ay + Math.sin(back) * R * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
  // own aircraft
  ctx.strokeStyle = C.yellow; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx, cy - 14); ctx.lineTo(cx, cy + 12); ctx.moveTo(cx - 12, cy - 2); ctx.lineTo(cx + 12, cy - 2); ctx.moveTo(cx - 6, cy + 10); ctx.lineTo(cx + 6, cy + 10); ctx.stroke();
  // header data
  label(ctx, `GS ${Math.round(t.gs / KT)}  TAS ${Math.round(t.tas / KT)}`, x0 + 10, y0 + 16, 13, C.white, 'left');
  label(ctx, `${String(Math.round(t.windFromDeg)).padStart(3, '0')}°/${Math.round(t.windKt)}`, x0 + 10, y0 + 34, 13, C.white, 'left');
  const wa = (wrap180(t.windFromDeg + 180 - t.heading) - 90) * DEG;
  ctx.strokeStyle = C.white; ctx.lineWidth = 2; const wx = x0 + 22, wy = y0 + 60;
  ctx.beginPath(); ctx.moveTo(wx - Math.cos(wa) * 10, wy - Math.sin(wa) * 10); ctx.lineTo(wx + Math.cos(wa) * 10, wy + Math.sin(wa) * 10); ctx.stroke();
  if (gps.hasPlan && gps.activeWaypoint) {
    label(ctx, gps.activeWaypoint.ident, x0 + W - 10, y0 + 16, 14, C.magenta, 'right');
    label(ctx, `${(gps.distToWptM / NM).toFixed(1)} NM`, x0 + W - 10, y0 + 34, 13, C.white, 'right');
    label(ctx, `DEST ${(gps.distToDestM / NM).toFixed(0)} NM`, x0 + W - 10, y0 + 52, 12, C.white, 'right');
    label(ctx, `ETE ${gps.eteDestS ? fmtDuration(gps.eteDestS) : '--'}`, x0 + W - 10, y0 + 68, 12, C.white, 'right');
    if (gps.distToTodM > 0 && gps.distToTodM < 60 * NM) label(ctx, `T/D ${(gps.distToTodM / NM).toFixed(0)} NM`, x0 + W - 10, y0 + 84, 12, C.green, 'right');
  }
  label(ctx, `RNG ${rangeNm}`, cx, y0 + H - 12, 12, C.dim);
  if (d.simRate !== 1) label(ctx, `SIM ×${d.simRate}`, x0 + 10, y0 + H - 12, 12, C.amber, 'left');
  ctx.restore();
}

export function drawEngineDisplay(ctx: CanvasRenderingContext2D, x0: number, y0: number, W: number, H: number, d: InstrumentData) {
  const { t, fdm } = d;
  const def = fdm.def;
  ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, W, H); ctx.clip();
  ctx.fillStyle = C.bg; ctx.fillRect(x0, y0, W, H);
  const n = t.engines.length;
  const gw = W / Math.max(n, 2);
  const r = Math.min(gw * 0.36, H * 0.14);
  t.engines.forEach((e, i) => {
    const x = x0 + gw * (i + 0.5) + (n === 1 ? gw / 2 : 0), y = y0 + r * 1.35;
    ctx.strokeStyle = '#6c7686'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r, Math.PI * 0.8, Math.PI * 2.1); ctx.stroke();
    const f = clamp(e.display / (def.engine.kind === 'piston' ? 2700 : 110), 0, 1);
    ctx.strokeStyle = e.status === 'running' ? C.green : e.status === 'failed' ? C.red : C.amber; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(x, y, r, Math.PI * 0.8, Math.PI * 0.8 + f * Math.PI * 1.3); ctx.stroke();
    label(ctx, e.status === 'running' ? e.display.toFixed(def.engine.kind === 'piston' ? 0 : 1) : e.status.toUpperCase(), x, y + r * 0.15, r * 0.35, e.status === 'running' ? C.white : C.amber);
    label(ctx, `FF ${Math.round(e.fuelFlowKgH)}`, x, y + r * 0.8, r * 0.26, C.dim);
  });
  label(ctx, def.engine.kind === 'turbofan' ? 'N1 %' : def.engine.kind === 'turboprop' ? 'TORQUE %' : 'RPM', x0 + W / 2, y0 + r * 2.55, 12, C.dim);
  let yy = y0 + r * 3.05;
  const row = (k: string, v: string, col = C.white) => { label(ctx, k, x0 + 10, yy, 13, C.dim, 'left'); label(ctx, v, x0 + W - 10, yy, 14, col, 'right'); yy += Math.min(20, H * 0.075); };
  row('FUEL', `${Math.round(t.fuelKg).toLocaleString()} kg`, t.fuelKg < fdm.maxFuelKg * 0.08 ? C.amber : C.white);
  row('FUEL FLOW', `${Math.round(t.fuelFlowKgH).toLocaleString()} kg/h`);
  row('GROSS WT', `${(t.massKg / 1000).toFixed(1)} t`);
  row('THRUST LVR', `${Math.round(t.throttle * 100)}%${t.reverse ? ' REV' : ''}`, t.reverse ? C.amber : C.white);
  row('FLAPS', t.flapLabel, t.flapOverspeed ? C.red : C.white);
  row('SPOILERS', t.spoilers > 0.05 ? `${Math.round(t.spoilers * 100)}%` : 'RET', t.spoilers > 0.05 ? C.amber : C.white);
  row('GEAR', t.gearPos > 0.99 ? 'DOWN ●●●' : t.gearPos < 0.01 ? 'UP' : 'TRANSIT', t.gearPos > 0.99 ? C.green : t.gearPos < 0.01 ? C.white : C.amber);
  row('TRIM', (fdm.trimPos * 10).toFixed(1));
  row('OAT', `${Math.round(t.oat)}°C`);
  if (t.parkingBrake) row('PARK BRAKE', 'SET', C.amber);
  if (t.engines.some(e => e.status === 'failed')) row('ENGINE', 'FAIL', C.red);
  ctx.restore();
}
