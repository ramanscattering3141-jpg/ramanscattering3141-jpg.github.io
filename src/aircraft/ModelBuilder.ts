// Procedural 3D aircraft models.
//
// Rather than shipping third-party model files (licensing!), every aircraft is
// generated from its data: fuselage length/diameter, wing span/area/sweep/taper,
// engine count & position, gear geometry and livery colours. The result is a
// glTF 2.0 asset built in memory. Moving parts (gear legs, flaps, ailerons,
// elevators, rudder, propeller) are separate nodes pivoting on their hinge lines
// so they can be animated from the simulation state.
//
// Model coordinates: x forward, y left, z up, origin at the centre of gravity
// (Cesium is told the glTF is Z-up/X-forward so no axis conversion is applied).

import type { AircraftDefinition } from './types';
import { DEG, type Vec3, cross, norm, sub } from '../core/math';

class Mesh {
  pos: number[] = [];
  col: number[] = [];
  uv: number[] = [];
  idx: number[] = [];
  vert(p: Vec3, c: Vec3, uv: [number, number] = [0, 0]) {
    this.pos.push(p[0], p[1], p[2]);
    this.col.push(c[0], c[1], c[2]);
    this.uv.push(uv[0], uv[1]);
    return this.pos.length / 3 - 1;
  }
  tri(a: number, b: number, c: number) {
    this.idx.push(a, b, c);
  }
  quad(a: number, b: number, c: number, d: number) {
    this.idx.push(a, b, c, a, c, d);
  }
  /** Grid of vertices rows×cols joined into quads; `wrap` closes the ring. */
  grid(rows: Vec3[][], color: (r: number, c: number, p: Vec3) => Vec3, wrap: boolean, flip = false) {
    const base: number[][] = rows.map((row, r) => row.map((p, c) => this.vert(p, color(r, c, p))));
    for (let r = 0; r < rows.length - 1; r++) {
      const n = rows[r].length;
      for (let c = 0; c < (wrap ? n : n - 1); c++) {
        const c2 = (c + 1) % n;
        if (flip) this.quad(base[r][c], base[r][c2], base[r + 1][c2], base[r + 1][c]);
        else this.quad(base[r][c], base[r + 1][c], base[r + 1][c2], base[r][c2]);
      }
    }
    return base;
  }
  /** Fan-closes a ring of vertex indices around a centre point. */
  cap(ring: number[], center: Vec3, c: Vec3, flip = false) {
    const m = this.vert(center, c);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      if (flip) this.tri(m, b, a); else this.tri(m, a, b);
    }
  }
  normals(): Float32Array {
    const n = new Float32Array(this.pos.length);
    const P = this.pos;
    for (let i = 0; i < this.idx.length; i += 3) {
      const [a, b, c] = [this.idx[i], this.idx[i + 1], this.idx[i + 2]];
      const pa: Vec3 = [P[a * 3], P[a * 3 + 1], P[a * 3 + 2]];
      const pb: Vec3 = [P[b * 3], P[b * 3 + 1], P[b * 3 + 2]];
      const pc: Vec3 = [P[c * 3], P[c * 3 + 1], P[c * 3 + 2]];
      const fn = cross(sub(pb, pa), sub(pc, pa));
      for (const v of [a, b, c]) { n[v * 3] += fn[0]; n[v * 3 + 1] += fn[1]; n[v * 3 + 2] += fn[2]; }
    }
    for (let v = 0; v < n.length; v += 3) {
      const l = Math.hypot(n[v], n[v + 1], n[v + 2]) || 1;
      n[v] /= l; n[v + 1] /= l; n[v + 2] /= l;
    }
    return n;
  }
}

export interface PartNode {
  name: string;
  mesh: Mesh;
  /** Hinge / pivot point in model coordinates (node translation) */
  pivot: Vec3;
  /** Rotation axis (model coordinates, unit) for animation */
  axis: Vec3;
}

export interface BuiltModel {
  gltf: object;
  parts: { name: string; pivot: Vec3; axis: Vec3 }[];
  lights: { navLeft: Vec3; navRight: Vec3; tail: Vec3; beaconTop: Vec3; beaconBottom: Vec3; landing: Vec3 };
  /** Model-space height of the wheel bottoms (negative z) */
  wheelBottomZ: number;
}

const hex = (h: string): Vec3 => {
  const v = parseInt(h.replace('#', ''), 16);
  // glTF vertex colours are linear; convert from sRGB.
  const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return [lin((v >> 16) & 255), lin((v >> 8) & 255), lin(v & 255)];
};

/** NACA 4-digit symmetric thickness distribution (fraction of chord). */
const naca = (x: number, t: number) => 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
const CHORD = [0, 0.005, 0.015, 0.03, 0.05, 0.08, 0.12, 0.17, 0.23, 0.3, 0.38, 0.46, 0.55, 0.64, 0.72, 0.8, 0.87, 0.93, 0.97, 1];

interface SurfaceSpec {
  rootLE: Vec3; // model coords of root leading edge
  span: number; // semi-span along the surface
  rootChord: number;
  taper: number;
  sweepDeg: number;
  dihedralDeg: number;
  tc: number;
  vertical?: boolean;
  side: 1 | -1; // +1 = left (+y), -1 = right
}

/** Point on a lifting surface at spanwise fraction s and chord fraction x, thickness side ±1. */
function surfacePoint(sp: SurfaceSpec, s: number, x: number, upper: number): Vec3 {
  const chord = sp.rootChord * (1 + (sp.taper - 1) * s);
  const d = s * sp.span;
  const xle = sp.rootLE[0] - d * Math.tan(sp.sweepDeg * DEG);
  const px = xle - x * chord;
  const th = naca(Math.min(1, x), sp.tc * (1 - 0.25 * s)) * chord * upper;
  if (sp.vertical) return [px, sp.rootLE[1] + th, sp.rootLE[2] + d];
  const dz = d * Math.tan(sp.dihedralDeg * DEG);
  return [px, sp.rootLE[1] + sp.side * d, sp.rootLE[2] + dz + th];
}

function addSurface(mesh: Mesh, sp: SurfaceSpec, s0: number, s1: number, x0: number, x1: number, color: Vec3, capTip: boolean, pivot: Vec3 = [0, 0, 0]) {
  const chordPts = CHORD.filter(c => c >= x0 && c <= x1);
  if (chordPts[0] !== x0) chordPts.unshift(x0);
  if (chordPts[chordPts.length - 1] !== x1) chordPts.push(x1);
  const spans = [0, 0.2, 0.4, 0.6, 0.8, 1].map(f => s0 + (s1 - s0) * f);
  const rel = (p: Vec3): Vec3 => [p[0] - pivot[0], p[1] - pivot[1], p[2] - pivot[2]];
  // One closed ring per spanwise station: upper surface LE→TE then lower TE→LE.
  const rings = spans.map(s => {
    const up = chordPts.map(x => rel(surfacePoint(sp, s, x, 1)));
    const lo = [...chordPts].reverse().map(x => rel(surfacePoint(sp, s, x, -1)));
    return [...up, ...lo];
  });
  const flip = sp.vertical ? false : sp.side < 0;
  const g = mesh.grid(rings, () => color, true, sp.vertical ? true : flip);
  if (capTip) {
    const tipRing = g[g.length - 1];
    const c = rel(surfacePoint(sp, s1, (x0 + x1) / 2, 0));
    mesh.cap(tipRing, c, color, sp.vertical ? false : !flip);
    mesh.cap(g[0], rel(surfacePoint(sp, s0, (x0 + x1) / 2, 0)), color, sp.vertical ? true : flip);
  }
}

/** Lofted body of revolution along x (fuselage, nacelle, spinner). */
function loft(mesh: Mesh, stations: { x: number; ry: number; rz: number; zc: number; zTop?: number }[], seg: number, color: (p: Vec3, ang: number, x: number) => Vec3, offset: Vec3 = [0, 0, 0], closeEnds = true) {
  const rings = stations.map(st => {
    const ring: Vec3[] = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const s = Math.sin(a), c = Math.cos(a);
      const rz = s > 0 && st.zTop !== undefined ? st.zTop : st.rz;
      ring.push([st.x + offset[0], offset[1] + c * st.ry, offset[2] + st.zc + s * rz]);
    }
    return ring;
  });
  const g = mesh.grid(rings, (_r, c, p) => color(p, (c / seg) * Math.PI * 2, p[0]), true, true);
  if (closeEnds) {
    const f = stations[0], l = stations[stations.length - 1];
    mesh.cap(g[0], [f.x + offset[0], offset[1], offset[2] + f.zc], color([f.x, 0, f.zc], Math.PI / 2, f.x), true);
    mesh.cap(g[g.length - 1], [l.x + offset[0], offset[1], offset[2] + l.zc], color([l.x, 0, l.zc], Math.PI / 2, l.x), false);
  }
  return g;
}

/** Body of revolution with texture coordinates (a seam column is duplicated so UVs wrap cleanly). */
function loftUV(mesh: Mesh, stations: { x: number; ry: number; rz: number; zc: number; zTop?: number }[], seg: number,
  uvAt: (x: number, ang: number) => [number, number], color: (p: Vec3, ang: number, x: number) => Vec3) {
  const idx: number[][] = stations.map(st => {
    const row: number[] = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const sn = Math.sin(a), cs = Math.cos(a);
      const rz = sn > 0 && st.zTop !== undefined ? st.zTop : st.rz;
      const p: Vec3 = [st.x, cs * st.ry, st.zc + sn * rz];
      row.push(mesh.vert(p, color(p, a, st.x), uvAt(st.x, a)));
    }
    return row;
  });
  for (let r = 0; r < idx.length - 1; r++) for (let c = 0; c < seg; c++) mesh.quad(idx[r][c], idx[r][c + 1], idx[r + 1][c + 1], idx[r + 1][c]);
  const capAt = (row: number[], st: (typeof stations)[number], flip: boolean) => {
    const m = mesh.vert([st.x, 0, st.zc], color([st.x, 0, st.zc], Math.PI / 2, st.x), uvAt(st.x, Math.PI / 2));
    for (let c = 0; c < seg; c++) flip ? mesh.tri(m, row[c + 1], row[c]) : mesh.tri(m, row[c], row[c + 1]);
  };
  capAt(idx[0], stations[0], true);
  capAt(idx[idx.length - 1], stations[stations.length - 1], false);
}

/**
 * Paints a livery texture for the fuselage (fictional "World Flight" scheme):
 * cheatline, belly, tail colour, passenger windows, doors, cockpit windows,
 * titles and registration. Returns a PNG data URI.
 */
function liveryTexture(def: AircraftDefinition, d: { L: number; R: number; isGA: boolean; noseLen: number; tailLen: number; xNose: number; cockpitX0: number; cockpitX1: number }): string | null {
  const W = d.isGA ? 2048 : 4096, H = d.isGA ? 512 : 1024;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  const g = def.geometry;
  const X = (xm: number) => ((d.xNose - xm) / d.L) * W; // model x (m) → px
  const U = (metresFromNose: number) => (metresFromNose / d.L) * W;
  const Y = (deg: number) => (deg / 360) * H; // circumference angle → px
  const degPerM = 360 / (2 * Math.PI * d.R);
  // base paint + subtle vertical shading
  ctx.fillStyle = g.colors.body; ctx.fillRect(0, 0, W, H);
  // belly (bottom quarter, 225°–315°)
  ctx.fillStyle = '#c3c7cd'; ctx.fillRect(0, Y(222), W, Y(96));
  // tail colour sweeping up the rear upper fuselage
  const tailStart = d.L - d.tailLen * (d.isGA ? 0.45 : 0.55);
  ctx.fillStyle = g.colors.tail;
  ctx.beginPath(); ctx.moveTo(U(tailStart), Y(55)); ctx.lineTo(W, Y(20)); ctx.lineTo(W, Y(160)); ctx.lineTo(U(tailStart), Y(125)); ctx.closePath(); ctx.fill();
  // cheatlines both sides (just below the window line)
  const stripe = (a0: number, a1: number) => { ctx.fillStyle = g.colors.accent; ctx.fillRect(U(d.noseLen * 0.6), Y(a0), U(d.L - d.noseLen * 0.6 - d.tailLen * 0.35), Y(a1 - a0)); };
  stripe(333, 346); stripe(194, 207);
  ctx.fillStyle = '#e8b04a'; ctx.fillRect(U(d.noseLen * 0.6), Y(347), U(d.L * 0.6), Y(1.5)); ctx.fillRect(U(d.noseLen * 0.6), Y(191.5), U(d.L * 0.6), Y(1.5));
  const glassGrad = (x0: number, y0: number, x1: number, y1: number) => { const gr = ctx.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, '#26313f'); gr.addColorStop(0.5, '#0f151d'); gr.addColorStop(1, '#3a4656'); return gr; };
  // cockpit windows: side panes on both sides + windscreen over the top-front
  const cx0 = X(d.cockpitX1), cx1 = X(d.cockpitX0);
  ctx.fillStyle = glassGrad(cx0, 0, cx1, 0);
  for (const [a0, a1] of d.isGA ? [[18, 70], [110, 162]] : [[22, 48], [132, 158]]) {
    ctx.beginPath(); ctx.moveTo(cx0, Y(a0 + (a1 - a0) * 0.35)); ctx.lineTo(cx1 * 0.97 + cx0 * 0.03, Y(a0)); ctx.lineTo(cx1, Y(a1)); ctx.lineTo(cx0 + (cx1 - cx0) * 0.25, Y(a1)); ctx.closePath(); ctx.fill();
    // window frames
    ctx.strokeStyle = g.colors.body; ctx.lineWidth = Math.max(2, W / 900);
    for (let k = 1; k < 3; k++) { const xx = cx0 + (cx1 - cx0) * k / 3; ctx.beginPath(); ctx.moveTo(xx, Y(a0)); ctx.lineTo(xx, Y(a1)); ctx.stroke(); }
  }
  ctx.fillStyle = glassGrad(cx0, 0, cx1, 0);
  ctx.fillRect(cx0 - (cx1 - cx0) * 0.15, Y(d.isGA ? 70 : 52), (cx1 - cx0) * 0.55, Y(d.isGA ? 40 : 76));
  if (d.isGA) {
    // large cabin side windows
    for (const [a0, a1] of [[14, 62], [118, 166]]) {
      ctx.fillStyle = glassGrad(cx1, 0, cx1 + U(1.6), 0);
      ctx.beginPath(); ctx.roundRect(cx1 + U(0.1), Y(a0), U(1.5), Y(a1 - a0), U(0.2)); ctx.fill();
      ctx.beginPath(); ctx.roundRect(cx1 + U(1.75), Y(a0 + 6), U(0.9), Y(a1 - a0 - 12), U(0.2)); ctx.fill();
    }
  } else {
    // passenger windows (≈0.53 m pitch) with front/rear doors and overwing exits skipped
    const winW = U(0.24), winH = Y(0.36 * degPerM);
    const first = d.xNose - d.cockpitX0 + 2.6, last = d.L - d.tailLen * 0.78;
    const doors = [first - 1.6, last + 1.4];
    const exits = [d.L * 0.47, d.L * 0.5];
    for (const [side, aMid] of [[0, 17], [1, 163]] as const) {
      // doors
      for (const dm of doors) {
        ctx.strokeStyle = '#8c939c'; ctx.lineWidth = Math.max(2, W / 1200);
        // A door reaches ~0.4 m above the window line and ~1.45 m below it. On the left side
        // "down" is a smaller angle; on the right side it is a larger one.
        const aTop = side ? aMid - 0.4 * degPerM : aMid + 0.4 * degPerM;
        const aBot = side ? aMid + 1.45 * degPerM : aMid - 1.45 * degPerM;
        ctx.beginPath(); ctx.roundRect(U(dm - 0.45), Y(Math.min(aTop, aBot)), U(0.9), Y(Math.abs(aBot - aTop)), U(0.12)); ctx.stroke();
      }
      for (let m = first; m < last; m += 0.53) {
        if (doors.some(dm => Math.abs(m - dm) < 0.8)) continue;
        const exit = exits.some(e => Math.abs(m - e) < 0.35);
        ctx.fillStyle = exit ? '#48525e' : glassGrad(0, Y(aMid) - winH, 0, Y(aMid) + winH);
        ctx.beginPath(); ctx.roundRect(U(m) - winW / 2, Y(aMid) - winH / 2, winW, winH, winW * 0.45); ctx.fill();
      }
      if (g.hump) {
        // 747 upper-deck windows
        for (let m = d.xNose - d.cockpitX0 + 1.5; m < d.L * 0.34; m += 0.53) {
          ctx.fillStyle = '#1a222d';
          ctx.beginPath(); ctx.roundRect(U(m) - winW / 2, Y(side ? 128 : 52) - winH / 2, winW, winH, winW * 0.45); ctx.fill();
        }
      }
    }
  }
  // titles and registration (fictional)
  const text = (str: string, um: number, aDeg: number, sizeM: number, side: 0 | 1, color: string, weight = 800) => {
    ctx.save();
    ctx.translate(U(um), Y(aDeg));
    // Left side is seen with the nose to the viewer's left but v runs upward → flip vertically;
    // right side reads tail→nose → flip horizontally.
    ctx.scale(side ? -1 : 1, side ? 1 : -1);
    ctx.fillStyle = color;
    ctx.font = `${weight} ${Math.max(10, Y(sizeM * degPerM))}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // Horizontal pixels are stretched differently from vertical ones; compensate.
    const sx = (W / d.L) / (H / (2 * Math.PI * d.R));
    ctx.scale(sx, 1);
    ctx.fillText(str, 0, 0);
    ctx.restore();
  };
  if (!d.isGA) {
    text('WORLD FLIGHT', d.L * 0.3, 35, 0.75, 0, g.colors.accent);
    text('WORLD FLIGHT', d.L * 0.3, 145, 0.75, 1, g.colors.accent);
  }
  const reg = `WF-${def.id.toUpperCase()}`;
  text(reg, d.L * (d.isGA ? 0.62 : 0.8), d.isGA ? 20 : 8, d.isGA ? 0.35 : 0.45, 0, '#20242b', 700);
  text(reg, d.L * (d.isGA ? 0.62 : 0.8), d.isGA ? 160 : 172, d.isGA ? 0.35 : 0.45, 1, '#20242b', 700);
  return cv.toDataURL('image/png');
}

function cylinder(mesh: Mesh, a: Vec3, b: Vec3, r: number, color: Vec3, seg = 12) {
  const axis = norm(sub(b, a));
  const ref: Vec3 = Math.abs(axis[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = norm(cross(axis, ref)), v = cross(axis, u);
  const ring = (c: Vec3) => {
    const out: Vec3[] = [];
    for (let i = 0; i < seg; i++) {
      const t = (i / seg) * Math.PI * 2;
      out.push([c[0] + (u[0] * Math.cos(t) + v[0] * Math.sin(t)) * r, c[1] + (u[1] * Math.cos(t) + v[1] * Math.sin(t)) * r, c[2] + (u[2] * Math.cos(t) + v[2] * Math.sin(t)) * r]);
    }
    return out;
  };
  const g = mesh.grid([ring(a), ring(b)], () => color, true, true);
  mesh.cap(g[0], a, color, true);
  mesh.cap(g[1], b, color, false);
}

function box(mesh: Mesh, c: Vec3, half: Vec3, color: Vec3) {
  const [x, y, z] = c, [hx, hy, hz] = half;
  const P = (sx: number, sy: number, sz: number): Vec3 => [x + sx * hx, y + sy * hy, z + sz * hz];
  const faces: Vec3[][] = [
    [P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1)],
    [P(-1, 1, -1), P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1)],
    [P(-1, 1, -1), P(1, 1, -1), P(1, -1, -1), P(-1, -1, -1)].reverse(),
    [P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)],
    [P(-1, 1, -1), P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1)],
    [P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1)],
  ];
  for (const f of faces) {
    const i = f.map(p => mesh.vert(p, color));
    mesh.quad(i[0], i[1], i[2], i[3]);
  }
}

export function buildAircraftModel(def: AircraftDefinition): BuiltModel {
  const g = def.geometry, spec = def.spec;
  const L = spec.lengthM, b = spec.wingspanM, R = g.fuselageDiameterM / 2;
  const isGA = def.category === 'general aviation' || def.category === 'turboprop';
  const body = hex(g.colors.body), accent = hex(g.colors.accent), tailC = hex(g.colors.tail);
  const belly = hex('#c9ccd1'), glass = hex('#1b2230'), metal = hex('#8b9097'), dark = hex('#2a2d31'), tyre = hex('#151515');
  const xNose = 0.48 * L, xTail = -0.52 * L;
  const parts: PartNode[] = [];
  const main = new Mesh();

  // ---------------- fuselage ----------------
  const noseLen = isGA ? 0.2 * L : 0.13 * L;
  const tailLen = isGA ? 0.5 * L : 0.3 * L;
  const stations: { x: number; ry: number; rz: number; zc: number; zTop?: number }[] = [];
  const N = isGA ? 48 : 80;
  for (let i = 0; i <= N; i++) {
    const x = xNose - (i / N) * L;
    const fromNose = xNose - x, fromTail = x - xTail;
    let r = R, zc = 0;
    if (fromNose < noseLen) {
      const u = fromNose / noseLen;
      r = R * (isGA ? 0.55 + 0.45 * Math.sqrt(u) : Math.sqrt(1 - (1 - u) ** 2) * 0.97 + 0.03);
      zc = isGA ? -0.1 * R * (1 - u) : -0.25 * R * (1 - u) ** 2;
    } else if (fromTail < tailLen) {
      const u = fromTail / tailLen; // 0 at tail tip, 1 at start of taper
      r = R * (0.1 + 0.9 * Math.pow(u, isGA ? 0.8 : 0.9));
      zc = R * (isGA ? 0.35 : 0.55) * (1 - u) ** 1.3;
    }
    let zTop: number | undefined;
    if (g.hump && fromNose > 0.03 * L && fromNose < 0.4 * L) {
      const u = (fromNose - 0.03 * L) / (0.37 * L);
      zTop = r * (1 + 0.42 * Math.sin(Math.min(1, u * 1.6) * Math.PI / 2) * (u < 0.8 ? 1 : 1 - (u - 0.8) / 0.2 * 0.9));
    }
    stations.push({ x, ry: r * (isGA ? 0.92 : 1), rz: r * (isGA ? 1.1 : 1.02), zc, zTop });
  }
  const cockpitX0 = xNose - (isGA ? 0.3 : 0.1) * L, cockpitX1 = xNose - (isGA ? 0.17 : 0.055) * L;
  // The fuselage is its own UV-mapped mesh painted with a generated livery texture:
  // u runs nose → tail, v runs around the circumference (0 = left side, ¼ = top).
  const fuselage = new Mesh();
  const livery = typeof document !== 'undefined' ? liveryTexture(def, { L, R, isGA, noseLen, tailLen, xNose, cockpitX0, cockpitX1 }) : null;
  loftUV(fuselage, stations, isGA ? 40 : 56, (x, ang) => [(xNose - x) / L, ang / (Math.PI * 2)], livery ? () => [1, 1, 1] : (p, ang, x) => {
    const sn = Math.sin(ang), zRel = p[2] / R;
    if (x > cockpitX0 && x < cockpitX1 && sn > 0.25 && sn < 0.85) return glass;
    if (zRel < -0.25 && zRel > -0.42) return accent;
    if (sn < -0.55) return belly;
    if (x < xTail + tailLen * 0.6 && sn > 0.2) return tailC;
    return body;
  });

  // ---------------- wing ----------------
  const cr = (2 * spec.wingAreaM2) / (b * (1 + g.taper));
  const ymac = (b / 6) * (1 + 2 * g.taper) / (1 + g.taper);
  const cmac = (2 / 3) * cr * (1 + g.taper + g.taper ** 2) / (1 + g.taper);
  const wingZ = g.wingPosition === 'high' ? R * 1.0 : -R * 0.55;
  const rootLEx = 0.25 * cmac + ymac * Math.tan(g.sweepDeg * DEG) + 0.02 * L;
  const semi = b / 2;
  const wingLeft: SurfaceSpec = { rootLE: [rootLEx, 0, wingZ], span: semi, rootChord: cr, taper: g.taper, sweepDeg: g.sweepDeg, dihedralDeg: g.dihedralDeg, tc: isGA ? 0.15 : 0.12, side: 1 };
  const wingRight: SurfaceSpec = { ...wingLeft, side: -1 };
  const flapEnd = 0.62, ailStart = 0.66, ailEnd = 0.95, hingeX = 0.74;
  for (const sp of [wingLeft, wingRight]) {
    addSurface(main, sp, 0, 1, 0, hingeX, body, true);
    // fixed trailing edge between flap and aileron, and outboard of the aileron
    addSurface(main, sp, flapEnd, ailStart, hingeX, 1, body, false);
    addSurface(main, sp, ailEnd, 1, hingeX, 1, body, false);
    const tag = sp.side > 0 ? 'l' : 'r';
    const flapPivot = surfacePoint(sp, 0, hingeX, 0);
    const flapTip = surfacePoint(sp, flapEnd, hingeX, 0);
    const fm = new Mesh();
    addSurface(fm, sp, 0.02, flapEnd, hingeX, 1, belly, true, flapPivot);
    parts.push({ name: `flap_${tag}`, mesh: fm, pivot: flapPivot, axis: norm(sub(flapTip, flapPivot)) });
    const aPivot = surfacePoint(sp, ailStart, hingeX, 0);
    const aTip = surfacePoint(sp, ailEnd, hingeX, 0);
    const am = new Mesh();
    addSurface(am, sp, ailStart, ailEnd, hingeX, 1, body, true, aPivot);
    parts.push({ name: `aileron_${tag}`, mesh: am, pivot: aPivot, axis: norm(sub(aTip, aPivot)) });
    if (g.winglets) {
      const tip = surfacePoint(sp, 1, 0, 0);
      const ct = cr * g.taper;
      addSurface(main, { rootLE: [tip[0] + 0.0 * ct, tip[1], tip[2]], span: ct * 1.1, rootChord: ct * 0.9, taper: 0.35, sweepDeg: 40, dihedralDeg: 0, tc: 0.08, vertical: true, side: sp.side }, 0, 1, 0, 1, tailC, true);
    }
    // Wing root fairing / GA wing strut
    if (g.wingPosition === 'high') {
      const strutTop = surfacePoint(sp, 0.55, 0.3, -1);
      cylinder(main, [strutTop[0], strutTop[1], strutTop[2]], [rootLEx - cr * 0.35, sp.side * R * 0.9, -R * 0.6], 0.05 * R + 0.03, body, 8);
    }
  }

  // ---------------- tail ----------------
  const tailRootX = xTail + (isGA ? 0.2 : 0.17) * L;
  const finRootChord = isGA ? 0.16 * L : 0.14 * L;
  const finHeight = isGA ? 1.2 * R * 1.4 + 0.5 : Math.max(2.2 * R, 0.13 * L);
  const finRootZ = R * 0.55;
  const fin: SurfaceSpec = { rootLE: [tailRootX + finRootChord * 0.3, 0, finRootZ], span: finHeight, rootChord: finRootChord, taper: isGA ? 0.55 : 0.35, sweepDeg: isGA ? 30 : 38, dihedralDeg: 0, tc: 0.1, vertical: true, side: 1 };
  addSurface(main, fin, 0, 1, 0, 0.7, tailC, true);
  const rPivot = surfacePoint(fin, 0.05, 0.7, 0), rTip = surfacePoint(fin, 0.95, 0.7, 0);
  const rm = new Mesh();
  addSurface(rm, fin, 0.05, 0.95, 0.7, 1, tailC, true, rPivot);
  parts.push({ name: 'rudder', mesh: rm, pivot: rPivot, axis: norm(sub(rTip, rPivot)) });

  const hSpan = b * (isGA ? 0.3 : 0.34) / 2;
  const hRootChord = finRootChord * (isGA ? 0.85 : 0.8);
  const tTail = g.tail === 't-tail';
  const hRoot: Vec3 = tTail ? surfacePoint(fin, 0.97, 0, 0) : [tailRootX + hRootChord * 0.05, 0, finRootZ * 0.35];
  for (const side of [1, -1] as const) {
    const hs: SurfaceSpec = { rootLE: [hRoot[0] + (tTail ? -finRootChord * 0.05 : 0), 0, hRoot[2]], span: hSpan, rootChord: tTail ? hRootChord * 0.7 : hRootChord, taper: 0.45, sweepDeg: isGA ? 5 : 33, dihedralDeg: isGA ? 0 : 6, tc: 0.1, side };
    addSurface(main, hs, 0, 1, 0, 0.7, tailC, true);
    const ePivot = surfacePoint(hs, 0.02, 0.7, 0), eTip = surfacePoint(hs, 1, 0.7, 0);
    const em = new Mesh();
    addSurface(em, hs, 0.02, 1, 0.7, 1, tailC, true, ePivot);
    parts.push({ name: `elevator_${side > 0 ? 'l' : 'r'}`, mesh: em, pivot: ePivot, axis: norm(sub(eTip, ePivot)) });
  }

  // ---------------- engines ----------------
  const eng = def.engine;
  if (eng.kind === 'turbofan') {
    const d = 0.55 + 0.125 * Math.sqrt(spec.thrustKN ?? 100);
    const len = d * (def.category === 'business jet' ? 2.4 : 1.9);
    for (const yBody of eng.positionsY) {
      const y = -yBody; // body +y (right) → model −y
      let cx: number, cz: number;
      if (g.engineMount === 'tail') {
        cx = xTail + 0.3 * L; cz = R * 0.45;
        const pylonY = Math.sign(y) * (R * 0.95);
        box(main, [cx, (pylonY + y) / 2, cz], [len * 0.25, Math.abs(y - pylonY) / 2, d * 0.08], body);
      } else {
        const s = Math.abs(y) / semi;
        const le = surfacePoint(Math.sign(y) > 0 ? wingLeft : wingRight, s, 0, 0);
        cx = le[0] + len * 0.55;
        cz = le[2] - d * 0.62;
        box(main, [le[0] + len * 0.05, y, le[2] - d * 0.25], [len * 0.35, d * 0.05, d * 0.25], body);
      }
      loft(main, [
        { x: len * 0.5, ry: d * 0.46, rz: d * 0.46, zc: 0 },
        { x: len * 0.42, ry: d * 0.5, rz: d * 0.5, zc: 0 },
        { x: len * 0.1, ry: d * 0.5, rz: d * 0.5, zc: 0 },
        { x: -len * 0.3, ry: d * 0.4, rz: d * 0.4, zc: 0 },
        { x: -len * 0.5, ry: d * 0.25, rz: d * 0.25, zc: 0 },
      ], 20, (_p, _a, x) => (x > len * 0.49 ? dark : x < -len * 0.35 ? metal : g.engineMount === 'tail' ? body : accent), [cx, y, cz]);
      // fan face
      cylinder(main, [cx + len * 0.49, y, cz], [cx + len * 0.47, y, cz], d * 0.44, dark, 16);
    }
  } else {
    // Propeller aircraft: spinner and blades on a rotating node.
    const pivot: Vec3 = [xNose + 0.02 * L, 0, -0.05 * R];
    const pm = new Mesh();
    const spinR = R * (isGA ? 0.28 : 0.35);
    loft(pm, [
      { x: 0.35 * spinR * 3, ry: 0.02, rz: 0.02, zc: 0 },
      { x: 0.15 * spinR * 3, ry: spinR * 0.8, rz: spinR * 0.8, zc: 0 },
      { x: 0, ry: spinR, rz: spinR, zc: 0 },
    ], 16, () => (def.id === 'pc12' ? body : metal));
    const blades = def.id === 'pc12' ? 5 : 2;
    const propR = def.id === 'pc12' ? 1.34 : 0.95;
    for (let k = 0; k < blades; k++) {
      const a = (k / blades) * Math.PI * 2;
      const dir: Vec3 = [0, Math.cos(a), Math.sin(a)];
      const tip: Vec3 = [0, dir[1] * propR, dir[2] * propR];
      box(pm, [-0.05, tip[1] / 2, tip[2] / 2], [0.03, Math.abs(tip[1] / 2) + 0.06 * Math.abs(dir[2]), Math.abs(tip[2] / 2) + 0.06 * Math.abs(dir[1])], dark);
    }
    parts.push({ name: 'prop', mesh: pm, pivot, axis: [1, 0, 0] });
  }

  // ---------------- landing gear ----------------
  const gd = def.gear;
  const H = gd.heightM;
  const wheelR = Math.min(0.62, 0.17 + 0.042 * Math.sqrt(spec.mtowKg / 1000));
  const wheelW = wheelR * 0.55;
  const heavy = spec.mtowKg > 150000;
  const bellyZ = -R * 0.85;
  const makeGear = (name: string, x: number, y: number, nose: boolean) => {
    const m = new Mesh();
    const top: Vec3 = [x, y, g.wingPosition === 'low' && !nose ? wingZ : bellyZ];
    const wheelZ = -H + wheelR;
    const rel = (p: Vec3): Vec3 => [p[0] - top[0], p[1] - top[1], p[2] - top[2]];
    cylinder(m, rel(top), rel([x, y, wheelZ]), Math.max(0.05, wheelR * 0.18), metal, 8);
    const wheels: Vec3[] = [];
    const pairs = nose ? 1 : heavy ? 2 : 1;
    for (let k = 0; k < pairs; k++) {
      const dx = pairs > 1 ? (k === 0 ? 1 : -1) * wheelR * 1.15 : 0;
      for (const side of nose || spec.mtowKg > 20000 ? [1, -1] : [0]) wheels.push([x + dx, y + side * (wheelW * 0.8 + 0.05), wheelZ]);
    }
    if (pairs > 1) box(m, rel([x, y, wheelZ]), [wheelR * 1.3, 0.08, 0.1], metal);
    for (const w of wheels) cylinder(m, rel([w[0], w[1] - wheelW / 2, w[2]]), rel([w[0], w[1] + wheelW / 2, w[2]]), wheelR, tyre, 14);
    // Nose gear retracts forward (rotation about y), mains retract inboard (about x).
    parts.push({ name, mesh: m, pivot: top, axis: nose ? [0, 1, 0] : [Math.sign(y) || 1, 0, 0] });
  };
  makeGear('gear_nose', gd.noseX, 0, true);
  makeGear('gear_l', gd.mainX, gd.mainHalfTrack, false);
  makeGear('gear_r', gd.mainX, -gd.mainHalfTrack, false);
  if (def.id === 'b744') {
    // 747 body gears (visual only; the physics uses the wing gear points)
    makeGear('gear_bl', gd.mainX - 3.2, 1.9, false);
    makeGear('gear_br', gd.mainX - 3.2, -1.9, false);
  }

  const tipL = surfacePoint(wingLeft, 1, 0.3, 0), tipR = surfacePoint(wingRight, 1, 0.3, 0);
  return {
    gltf: toGltf(main, parts, fuselage, livery),
    parts: parts.map(p => ({ name: p.name, pivot: p.pivot, axis: p.axis })),
    lights: {
      navLeft: tipL, navRight: tipR, tail: [xTail + 0.01 * L, 0, stations[stations.length - 1].zc],
      beaconTop: [0, 0, (g.hump ? 1.4 : 1.02) * R], beaconBottom: [0, 0, -R * 1.02], landing: [gd.noseX, 0, bellyZ],
    },
    wheelBottomZ: -H,
  };
}

// ---------------- glTF serialisation ----------------

function toGltf(main: Mesh, parts: PartNode[], fuselage: Mesh, livery: string | null) {
  const meshes = [
    { name: 'airframe', mesh: main, pivot: [0, 0, 0] as Vec3, textured: false },
    { name: 'fuselage', mesh: fuselage, pivot: [0, 0, 0] as Vec3, textured: !!livery },
    ...parts.map(p => ({ name: p.name, mesh: p.mesh, pivot: p.pivot, textured: false })),
  ];
  const chunks: ArrayBuffer[] = [];
  let offset = 0;
  const bufferViews: object[] = [], accessors: object[] = [], gltfMeshes: object[] = [], nodes: object[] = [];
  const addView = (data: ArrayBufferView, target: number) => {
    const bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    const pad = (4 - (bytes.byteLength % 4)) % 4;
    chunks.push(bytes);
    if (pad) chunks.push(new ArrayBuffer(pad));
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.byteLength, target });
    offset += bytes.byteLength + pad;
    return bufferViews.length - 1;
  };
  meshes.forEach((m, i) => {
    const pos = new Float32Array(m.mesh.pos);
    const nrm = m.mesh.normals();
    const idx = new Uint32Array(m.mesh.idx);
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < pos.length; k += 3) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], pos[k + a]); max[a] = Math.max(max[a], pos[k + a]); }
    const count = pos.length / 3;
    const aPos = accessors.push({ bufferView: addView(pos, 34962), componentType: 5126, count, type: 'VEC3', min, max }) - 1;
    const aNrm = accessors.push({ bufferView: addView(nrm, 34962), componentType: 5126, count, type: 'VEC3' }) - 1;
    const attributes: Record<string, number> = { POSITION: aPos, NORMAL: aNrm };
    if (m.textured) attributes.TEXCOORD_0 = accessors.push({ bufferView: addView(new Float32Array(m.mesh.uv), 34962), componentType: 5126, count, type: 'VEC2' }) - 1;
    else attributes.COLOR_0 = accessors.push({ bufferView: addView(new Float32Array(m.mesh.col), 34962), componentType: 5126, count, type: 'VEC3' }) - 1;
    const aIdx = accessors.push({ bufferView: addView(idx, 34963), componentType: 5125, count: idx.length, type: 'SCALAR' }) - 1;
    gltfMeshes.push({ name: m.name, primitives: [{ attributes, indices: aIdx, material: m.textured ? 1 : 0 }] });
    nodes.push({ name: m.name, mesh: i, translation: m.pivot });
  });
  const total = new Uint8Array(offset);
  let o = 0;
  for (const c of chunks) { total.set(new Uint8Array(c), o); o += c.byteLength; }
  let bin = '';
  for (let k = 0; k < total.length; k += 0x8000) bin += String.fromCharCode(...total.subarray(k, k + 0x8000));
  const materials: object[] = [
    { name: 'paint', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0.25, roughnessFactor: 0.42 }, doubleSided: true },
    { name: 'livery', pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0.18, roughnessFactor: 0.32 }, doubleSided: true },
  ];
  return {
    asset: { version: '2.0', generator: 'world-flight-sim procedural aircraft' },
    scene: 0,
    scenes: [{ nodes: [nodes.length] }],
    nodes: [...nodes, { name: 'root', children: nodes.map((_, i) => i) }],
    meshes: gltfMeshes,
    materials,
    ...(livery ? { textures: [{ source: 0, sampler: 0 }], images: [{ uri: livery }], samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 33071 }] } : {}),
    accessors,
    bufferViews,
    buffers: [{ byteLength: offset, uri: `data:application/octet-stream;base64,${btoa(bin)}` }],
  };
}
