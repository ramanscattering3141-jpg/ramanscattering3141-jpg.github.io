// Rotatable 3-D heart driven by the simulation.
//
// Geometry is a simplified anatomical model (ellipsoidal ventricles and atria, great vessels
// and the conduction system as tubes). What is physiological is the TIMING: for every beat the
// model derives per-vertex activation times from the beat's real entry points (Purkinje sites
// chosen by the bundle-branch state, an ectopic focus, the accessory-pathway insertion, the
// pacing lead, or combinations for fusion), scaled to that beat's QRS duration; repolarisation
// order follows that beat's own T-wave vector. The heart-vector arrow is the same summed dipole
// that is projected onto the leads to draw the ECG.
//
// Frames: the ECG engine uses x = patient's left, y = inferior, z = anterior. Three.js uses
// y = up, so engine (x, y, z) → three (x, −y, z). Default camera looks from the front.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import type { EcgRun } from '../engine';
import { LEADS, TWELVE, type LeadId } from '../engine/leads';
import { AP_SITE, VENT_SITE, TERRITORY, buildP, territoryVector } from '../engine/morphology';
import type { AtrialSite } from '../engine/params';
import type { BeatInfo } from '../engine/synth';
import { h } from './dom';

type V3 = [number, number, number];
const T = (e: readonly number[]): THREE.Vector3 => new THREE.Vector3(e[0], -e[1], e[2]);
const vnorm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const vadd = (...vs: V3[]): V3 => vs.reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], [0, 0, 0] as V3);
const vscale = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k];
const vdot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vcross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vsub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

// ---------------------------------------------------------------- anatomy (engine frame)
const AXIS: V3 = vnorm([0.5, 0.6, 0.45]); // base → apex: leftward, inferior, anterior
const SEPT0: V3 = vnorm([-0.75, -0.05, 0.65]);
const SEPT: V3 = vnorm(vsub(SEPT0, vscale(AXIS, vdot(SEPT0, AXIS)))); // LV → RV, ⟂ long axis
let W: V3 = vnorm(vcross(AXIS, SEPT));
if (W[2] < 0) W = vscale(W, -1); // θ = +90° is anterior

interface Anatomy {
  cL: V3;
  cR: V3;
  lvLen: number;
  lvRad: number;
  rvLen: number;
  rvRadS: number;
  rvRadW: number;
  cRA: V3;
  cLA: V3;
  raR: V3;
  laR: V3;
  center: V3;
}

function anatomy(run: EcgRun): Anatomy {
  const p = run.physio;
  const lvK = Math.pow(Math.max(0.7, p.lvMass), 0.28);
  const rvK = Math.pow(Math.max(0.7, p.rvMass), 0.3);
  const cL: V3 = [0.12, 0.12, -0.12];
  const cR = vadd(cL, vscale(SEPT, 0.46 * Math.max(1, lvK * 0.95)), vscale(AXIS, -0.1));
  const ra = Math.pow(p.raSize, 0.35);
  const la = Math.pow(p.laSize, 0.35);
  return {
    cL,
    cR,
    lvLen: 1.0 * lvK,
    lvRad: 0.6 * lvK,
    rvLen: 0.82,
    rvRadS: 0.36 * rvK,
    rvRadW: 0.6 * rvK,
    cRA: [-0.62, -0.62, 0.1],
    cLA: [0.08, -0.78, -0.5],
    raR: [0.4 * ra, 0.38 * ra, 0.36 * ra],
    laR: [0.44 * la, 0.32 * la, 0.34 * la],
    center: vadd(cL, vscale(SEPT, 0.2), vscale(AXIS, -0.3)),
  };
}

/** Point in the LV frame: z ∈ [−1 (base), 1 (apex)], θ in degrees (0 = septum, +90 = anterior), rf = fraction of epicardial radius. */
function lvPoint(A: Anatomy, z: number, thDeg: number, rf: number): V3 {
  const th = (thDeg * Math.PI) / 180;
  const R = A.lvRad * Math.sqrt(Math.max(0, 1 - z * z)) * rf;
  return vadd(A.cL, vscale(AXIS, z * A.lvLen), vscale(SEPT, R * Math.cos(th)), vscale(W, R * Math.sin(th)));
}
function rvPoint(A: Anatomy, z: number, thDeg: number, rf: number): V3 {
  const th = (thDeg * Math.PI) / 180;
  const k = Math.sqrt(Math.max(0, 1 - z * z)) * rf;
  return vadd(A.cR, vscale(AXIS, z * A.rvLen), vscale(SEPT, A.rvRadS * k * Math.cos(th)), vscale(W, A.rvRadW * k * Math.sin(th)));
}

interface Shell {
  name: string;
  side: 'L' | 'R' | 'A';
  endo: number; // 0 epicardium … 1 endocardium
  mesh: THREE.Mesh;
  pos: V3[]; // engine-frame positions (un-mirrored)
  colors: Float32Array;
}

function ellipsoidShell(fn: (z: number, th: number) => V3, nz: number, nth: number, z0: number, z1: number): { geom: THREE.BufferGeometry; pos: V3[] } {
  const pos: V3[] = [];
  const arr: number[] = [];
  for (let i = 0; i <= nz; i++) {
    const z = z0 + ((z1 - z0) * i) / nz;
    for (let j = 0; j <= nth; j++) {
      const th = (360 * j) / nth;
      const p = fn(Math.min(0.9999, z), th);
      pos.push(p);
      const t = T(p);
      arr.push(t.x, t.y, t.z);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < nz; i++) {
    for (let j = 0; j < nth; j++) {
      const a = i * (nth + 1) + j;
      const b = a + nth + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  geom.setIndex(idx);
  geom.computeVertexNormals();
  return { geom, pos };
}

function blobShell(c: V3, r: V3, nz = 28, nth = 40): { geom: THREE.BufferGeometry; pos: V3[] } {
  return ellipsoidShell(
    (z, thDeg) => {
      const th = (thDeg * Math.PI) / 180;
      const k = Math.sqrt(Math.max(0, 1 - z * z));
      return [c[0] + r[0] * k * Math.cos(th), c[1] + r[1] * z, c[2] + r[2] * k * Math.sin(th)];
    },
    nz,
    nth,
    -1,
    1,
  );
}

// ---------------------------------------------------------------- colours
const C = {
  rest: new THREE.Color('#b8615f'),
  front: new THREE.Color('#fff4a3'),
  depol: new THREE.Color('#ff8f1f'),
  repol: new THREE.Color('#5aa9ff'),
  scar: new THREE.Color('#8c8c8c'),
  injury: new THREE.Color('#b24fe0'),
};
const tmp = new THREE.Color();

function stateColor(out: THREE.Color, t: number, a: number, r: number): THREE.Color {
  const dt = t - a;
  if (dt < 0) return out.copy(C.rest);
  if (dt < 10) return out.copy(C.front).lerp(C.depol, dt / 10);
  if (t < r - 45) return out.copy(C.depol);
  if (t < r) return out.copy(C.depol).lerp(C.repol, (t - (r - 45)) / 45);
  if (t < r + 140) return out.copy(C.repol).lerp(C.rest, (t - r) / 140);
  return out.copy(C.rest);
}

// ---------------------------------------------------------------- conduction system
interface Tract {
  id: string;
  curve: THREE.CatmullRomCurve3;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  blocked: boolean;
  base: THREE.Color;
}

type View = 'anterior' | 'lao' | 'rao' | 'left' | 'posterior' | 'superior' | 'inferior';
const VIEWS: Record<View, { label: string; pos: V3; up: V3 }> = {
  anterior: { label: 'Anterior (frontal)', pos: [0, 0, 1], up: [0, 1, 0] },
  lao: { label: 'LAO 45°', pos: [0.71, 0, 0.71], up: [0, 1, 0] },
  rao: { label: 'RAO 30°', pos: [-0.5, 0, 0.87], up: [0, 1, 0] },
  left: { label: 'Left lateral', pos: [1, 0, 0], up: [0, 1, 0] },
  posterior: { label: 'Posterior', pos: [0, 0, -1], up: [0, 1, 0] },
  superior: { label: 'From above', pos: [0, 1, 0.0001], up: [0, 0, -1] },
  inferior: { label: 'From the feet (horizontal plane, CT view)', pos: [0, -1, 0.0001], up: [0, 0, 1] },
};

export interface Heart3DOptions {
  height?: number;
}

export class Heart3D {
  readonly root: HTMLDivElement;
  private host: HTMLDivElement;
  private renderer: THREE.WebGLRenderer;
  private labelRenderer: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private heart = new THREE.Group();
  private overlay = new THREE.Group();
  private shells: Shell[] = [];
  private tracts: Tract[] = [];
  private dots: THREE.Mesh[] = [];
  private labels: CSS2DObject[] = [];
  private run: EcgRun | null = null;
  private A: Anatomy | null = null;
  private t = 0;
  private lead: LeadId = 'II';
  private wallMode: 'solid' | 'cut' | 'glass' = 'glass';
  private show = { system: true, vector: true, axis: true, labels: true, allLeads: false };
  private clip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  private beatCache = new Map<number, { act: Float32Array[]; rep: Float32Array[] }>();
  private atrialCache = new Map<number, Float32Array[]>();
  private arrow = new THREE.Group();
  private shaft: THREE.Mesh;
  private head: THREE.Mesh;
  private loop: THREE.Line;
  private axisGroup = new THREE.Group();
  private proj: THREE.Mesh;
  private projLabel: CSS2DObject;
  private gizmo: SVGSVGElement;
  private ro: ResizeObserver;
  private raf = 0;
  private disposed = false;

  constructor(opts: Heart3DOptions = {}) {
    this.host = h('div', { class: 'h3d-canvas', style: `height:${opts.height ?? 360}px` });
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.localClippingEnabled = true;
    this.renderer.domElement.setAttribute('role', 'img');
    this.renderer.domElement.setAttribute('aria-label', '3-D heart: drag to rotate, scroll or pinch to zoom');
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'h3d-labels';
    this.gizmo = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.gizmo.setAttribute('class', 'h3d-gizmo');
    this.gizmo.setAttribute('viewBox', '-40 -40 80 80');
    this.gizmo.setAttribute('aria-hidden', 'true');
    this.host.append(this.renderer.domElement, this.labelRenderer.domElement, this.gizmo);

    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
    this.camera.position.set(0, 0, 6.2);
    this.scene.add(this.camera);
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(1.5, 2, 3);
    this.camera.add(key);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x404050, 1.1));
    this.controls = new OrbitControls(this.camera, this.labelRenderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 12;
    this.controls.addEventListener('change', () => this.requestRender());
    this.scene.add(this.heart, this.overlay);

    // Heart vector, vector loop, lead axis and its projection.
    // Heart-vector arrow: a solid white shaft + head drawn on top of everything, with a dark halo.
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false });
    const haloMat = new THREE.MeshBasicMaterial({ color: 0x111111, depthTest: false });
    this.shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 12), arrowMat);
    this.head = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 16), arrowMat);
    const halo = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1, 12), haloMat);
    this.shaft.renderOrder = 41;
    this.head.renderOrder = 41;
    halo.renderOrder = 40;
    halo.name = 'halo';
    this.arrow.add(halo, this.shaft, this.head);
    this.loop = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffd400, depthTest: false, transparent: true, opacity: 0.9 }));
    this.loop.renderOrder = 29;
    this.proj = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 10), new THREE.MeshBasicMaterial({ color: 0x2e7d32, depthTest: false, transparent: true, opacity: 0.75 }));
    this.proj.renderOrder = 31;
    const pl = h('span', { class: 'h3d-lab proj' });
    this.projLabel = new CSS2DObject(pl);
    this.overlay.add(this.arrow, this.loop, this.axisGroup, this.proj, this.projLabel);

    this.root = h('div', { class: 'h3d' }, this.buildToolbar(), this.host, h('div', { class: 'h3d-legend' }, legendItem(C.rest, 'resting (phase 4)'), legendItem(C.front, 'wavefront'), legendItem(C.depol, 'depolarised (plateau)'), legendItem(C.repol, 'repolarising'), legendItem(C.scar, 'scar'), legendItem(C.injury, 'ischaemic / injured')));
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.host);
    this.setView('anterior');
  }

  /** Throws if WebGL is unavailable (callers fall back to the 2-D schematic). */
  static supported(): boolean {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      return false;
    }
  }

  private buildToolbar(): HTMLElement {
    const view = h('select', { 'aria-label': 'Viewpoint', class: 'h3d-sel' }, ...Object.entries(VIEWS).map(([k, v]) => h('option', { value: k }, v.label)));
    view.addEventListener('change', () => this.setView(view.value as View));
    const walls = h('select', { 'aria-label': 'Wall display', class: 'h3d-sel' }, h('option', { value: 'glass' }, 'Walls: transparent (see inside)'), h('option', { value: 'solid' }, 'Walls: solid'), h('option', { value: 'cut' }, 'Walls: cut away toward viewer'));
    walls.addEventListener('change', () => {
      this.wallMode = walls.value as typeof this.wallMode;
      this.applyMaterials();
      this.requestRender();
    });
    const tog = (label: string, key: keyof typeof this.show): HTMLLabelElement => {
      const cb = h('input', { type: 'checkbox', checked: this.show[key] });
      cb.addEventListener('change', () => {
        this.show[key] = cb.checked;
        this.applyMaterials();
        this.updateOverlay();
        this.requestRender();
      });
      return h('label', { class: 'h3d-tog' }, cb, ' ', label);
    };
    return h('div', { class: 'h3d-bar' }, view, walls, tog('Conduction system', 'system'), tog('Heart vector', 'vector'), tog('Lead axis', 'axis'), tog('All 12 axes', 'allLeads'), tog('Labels', 'labels'));
  }

  setView(v: View): void {
    const d = this.camera.position.length() || 6.2;
    const cfg = VIEWS[v];
    this.camera.position.set(cfg.pos[0] * d, cfg.pos[1] * d, cfg.pos[2] * d);
    this.camera.up.set(cfg.up[0], cfg.up[1], cfg.up[2]);
    this.controls.target.set(0, 0, 0);
    this.camera.lookAt(0, 0, 0);
    this.controls.update();
    this.requestRender();
  }

  setLead(lead: LeadId): void {
    this.lead = lead;
    this.buildAxes();
    this.updateOverlay();
    this.requestRender();
  }

  setRun(run: EcgRun): void {
    this.run = run;
    this.beatCache.clear();
    this.atrialCache.clear();
    this.build();
    this.setTime(this.t);
  }

  setTime(t: number): void {
    this.t = t;
    if (!this.run) return;
    this.colour();
    this.updateTracts();
    this.updateOverlay();
    this.requestRender();
  }

  destroy(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.clearHeart();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose?.();
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  // ------------------------------------------------------------------ build
  private clearHeart(): void {
    for (const o of [...this.heart.children]) {
      this.heart.remove(o);
      o.traverse((x) => {
        const m = x as THREE.Mesh;
        m.geometry?.dispose?.();
        (m.material as THREE.Material | undefined)?.dispose?.();
        if (x instanceof CSS2DObject) x.element.remove();
      });
    }
    this.shells = [];
    this.tracts = [];
    this.dots = [];
    this.labels = [];
  }

  private label(text: string, at: V3, cls = ''): void {
    const el = h('span', { class: `h3d-lab ${cls}` }, text);
    const o = new CSS2DObject(el);
    o.position.copy(T(at));
    this.heart.add(o);
    this.labels.push(o);
  }

  private shellMat(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0, side: THREE.DoubleSide });
  }

  private addShell(name: string, side: Shell['side'], endo: number, g: { geom: THREE.BufferGeometry; pos: V3[] }): void {
    const colors = new Float32Array(g.pos.length * 3);
    g.geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mesh = new THREE.Mesh(g.geom, this.shellMat());
    mesh.name = name;
    this.heart.add(mesh);
    this.shells.push({ name, side, endo, mesh, pos: g.pos, colors });
  }

  private tube(id: string, pts: V3[], radius: number, color: string, blocked = false): Tract {
    const curve = new THREE.CatmullRomCurve3(pts.map(T));
    const geom = new THREE.TubeGeometry(curve, Math.max(12, pts.length * 10), radius, 8, false);
    const base = new THREE.Color(blocked ? '#d32f2f' : color);
    const mat = new THREE.MeshBasicMaterial({ color: base.clone(), transparent: true });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.renderOrder = 20;
    this.heart.add(mesh);
    const tr = { id, curve, mesh, mat, blocked, base };
    this.tracts.push(tr);
    return tr;
  }

  private vessel(pts: V3[], radius: number, color: string): void {
    const curve = new THREE.CatmullRomCurve3(pts.map(T));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, radius, 16, false), new THREE.MeshStandardMaterial({ color, roughness: 0.7, side: THREE.DoubleSide }));
    mesh.name = 'vessel';
    this.heart.add(mesh);
  }

  private build(): void {
    const run = this.run!;
    this.clearHeart();
    const A = anatomy(run);
    this.A = A;
    const p = run.physio;
    const R = p.rhythm;

    // Chambers
    this.addShell('LV epicardium', 'L', 0, ellipsoidShell((z, th) => lvPoint(A, z, th, 1), 44, 56, -0.82, 1));
    this.addShell('LV endocardium', 'L', 1, ellipsoidShell((z, th) => lvPoint({ ...A, cL: vadd(A.cL, vscale(AXIS, 0.06)) }, z, th, 0.66), 36, 48, -0.8, 0.9));
    this.addShell('RV', 'R', 0.5, ellipsoidShell((z, th) => rvPoint(A, z, th, 1), 40, 56, -0.9, 1));
    this.addShell('RA', 'A', 0.5, blobShell(A.cRA, A.raR));
    this.addShell('LA', 'A', 0.5, blobShell(A.cLA, A.laR));
    // Great vessels (context only)
    this.vessel([[0.02, -0.5, 0.0], [0.0, -1.2, 0.05], [0.2, -1.55, -0.2], [0.4, -1.4, -0.55], [0.45, -0.7, -0.75]], 0.17, '#c85a5a');
    this.vessel([vadd(A.cR, vscale(AXIS, -0.75), [0.05, -0.05, 0.08]), [0.05, -1.1, 0.45], [0.35, -1.3, 0.2]], 0.16, '#6f86c9');
    this.vessel([[-0.6, -1.6, 0.02], [-0.6, -0.95, 0.06]], 0.14, '#6f86c9');
    this.vessel([[-0.55, -0.3, -0.12], [-0.55, 0.35, -0.2]], 0.15, '#6f86c9');

    // Conduction system
    const SA: V3 = vadd(A.cRA, [-0.16, -0.33, 0.14]);
    const his = lvPoint(A, -0.74, 0, 0.98);
    const AVN: V3 = vadd(his, [-0.1, -0.14, -0.02]);
    const split = lvPoint(A, -0.5, 0, 0.7);
    const lafEnd = lvPoint(A, 0.35, 100, 0.68);
    const lpfEnd = lvPoint(A, 0.4, -100, 0.68);
    const septEnd = lvPoint(A, 0.2, 0, 0.7);
    const rbEnd = rvPoint(A, 0.35, 0, 0.85);
    const bundle = p.bundle;
    const rbBlk = bundle.startsWith('rbbb') || bundle === 'incompleteRbbb';
    const lbBlk = bundle === 'lbbb';
    const lafBlk = lbBlk || bundle === 'lafb' || bundle === 'rbbb+lafb';
    const lpfBlk = lbBlk || bundle === 'lpfb' || bundle === 'rbbb+lpfb';
    const nodeBlk = R.nodalBlock === 'complete' || !R.avnConducts;
    const sys = '#f5e6a1';
    const sa = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffe082', transparent: true }));
    sa.position.copy(T(SA));
    sa.renderOrder = 21;
    sa.name = 'SA';
    this.heart.add(sa);
    this.tube('internodal', [SA, vadd(A.cRA, [0.05, 0.05, 0.12]), AVN], 0.02, sys);
    this.tube('bachmann', [SA, vadd(A.cRA, [0.35, -0.3, 0.0]), vadd(A.cLA, [0.0, -0.22, 0.18])], 0.02, sys);
    if (R.dualPathway) {
      this.tube('fast', [vadd(AVN, [-0.1, -0.12, 0.05]), vadd(AVN, [-0.03, -0.08, 0.04]), AVN], 0.03, '#66bb6a');
      this.tube('slow', [vadd(AVN, [-0.22, 0.06, -0.12]), vadd(AVN, [-0.1, 0.05, -0.06]), AVN], 0.03, '#42a5f5');
      this.label('fast', vadd(AVN, [-0.14, -0.16, 0.06]), 'small');
      this.label('slow', vadd(AVN, [-0.26, 0.1, -0.12]), 'small');
    }
    this.tube('avn', [vadd(AVN, [-0.06, -0.04, 0]), AVN, his], 0.045, sys, nodeBlk);
    this.tube('his', [his, vadd(his, vscale(AXIS, 0.12)), split], 0.035, sys, R.infranodal === 'complete');
    this.tube('lb', [split, lvPoint(A, -0.3, 0, 0.7)], 0.03, sys, lbBlk);
    this.tube('laf', [split, lvPoint(A, -0.1, 55, 0.7), lafEnd], 0.025, sys, lafBlk);
    this.tube('lpf', [split, lvPoint(A, 0.0, -55, 0.7), lpfEnd], 0.025, sys, lpfBlk);
    this.tube('sept', [split, septEnd], 0.02, sys, lbBlk);
    this.tube('rb', [his, lvPoint(A, -0.45, 0, 1.12), lvPoint(A, 0.15, 0, 1.12), rbEnd], 0.028, sys, rbBlk);
    const rng = mulberry(7);
    const purk = (id: string, from: V3, z: number, th: number, lv: boolean, blocked: boolean): void => {
      for (let k = 0; k < 6; k++) {
        const zz = Math.max(-0.6, Math.min(0.92, z + (rng() - 0.5) * 0.6));
        const tt = th + (rng() - 0.5) * 80;
        const end = lv ? lvPoint(A, zz, tt, 0.68) : rvPoint(A, zz, tt, 0.85);
        this.tube(`${id}-p${k}`, [from, vscale(vadd(from, end), 0.5), end], 0.008, '#f3d98b', blocked);
      }
    };
    purk('laf', lafEnd, 0.35, 100, true, lafBlk);
    purk('lpf', lpfEnd, 0.4, -100, true, lpfBlk);
    purk('sept', septEnd, 0.3, 0, true, lbBlk);
    purk('rb', rbEnd, 0.4, 20, false, rbBlk);
    if (R.ap.present) {
      const base = vadd(A.cL, vscale(AXIS, -0.78 * A.lvLen), vscale(SEPT, 0.25));
      const d = AP_SITE[R.ap.location].pos as unknown as V3;
      const perp = vnorm(vsub(d, vscale(AXIS, vdot(d, AXIS))));
      const ring = vadd(base, vscale(perp, 0.62));
      this.tube('ap', [vadd(ring, vscale(AXIS, -0.22)), ring, vadd(ring, vscale(AXIS, 0.16))], 0.035, R.ap.antegrade ? '#ab47bc' : '#9e9e9e');
      this.label(R.ap.antegrade ? 'Accessory pathway' : 'AP (concealed)', vadd(ring, vscale(perp, 0.2)), 'ap');
    }
    if (R.pacer.mode !== 'none') {
      const rvApex = rvPoint(A, 0.8, 0, 0.6);
      this.tube('lead', [[-0.62, -1.9, 0.05], [-0.6, -0.95, 0.08], vadd(A.cRA, [0.1, 0.25, 0.05]), rvPoint(A, -0.4, 10, 0.5), rvApex], 0.018, '#90a4ae');
      this.label(`pacing lead (${R.pacer.mode})`, rvApex, 'small');
    }
    const focus = R.ventMechanism !== 'none' && !['vf', 'vflutter', 'asystole'].includes(R.ventMechanism) ? R.vtSite : R.pvc.pattern !== 'none' ? R.pvc.site : null;
    if (focus) {
      const fp = this.ventSurfacePoint(VENT_SITE[focus].pos as unknown as V3);
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), new THREE.MeshBasicMaterial({ color: '#e53935', depthTest: false }));
      m.position.copy(T(fp));
      m.renderOrder = 25;
      this.heart.add(m);
      this.label(`focus: ${VENT_SITE[focus].label}`, fp, 'focus');
    }
    // Moving impulse dots (one per possible concurrent path)
    for (let k = 0; k < 4; k++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false }));
      d.renderOrder = 26;
      d.visible = false;
      this.heart.add(d);
      this.dots.push(d);
    }

    // Labels
    this.label('RA', vadd(A.cRA, [-0.45, 0, 0.1]));
    this.label('LA', vadd(A.cLA, [0.5, -0.05, 0]));
    this.label('RV', rvPoint(A, 0.05, 0, 1.12));
    this.label('LV', lvPoint(A, 0.2, 180, 1.15));
    this.label('SA node', vadd(SA, [-0.15, -0.12, 0]), 'sys');
    this.label('AV node', vadd(AVN, [-0.2, 0, 0.05]), 'sys');
    this.label('His', vadd(his, [0.08, -0.08, 0]), 'sys small');
    this.label(rbBlk ? '✕ RB' : 'RB', lvPoint(A, 0.1, 0, 1.2), `sys small ${rbBlk ? 'blk' : ''}`);
    this.label(lafBlk ? '✕ LAF' : 'LAF', lvPoint(A, 0.0, 70, 0.9), `sys small ${lafBlk ? 'blk' : ''}`);
    this.label(lpfBlk ? '✕ LPF' : 'LPF', lvPoint(A, 0.1, -70, 0.9), `sys small ${lpfBlk ? 'blk' : ''}`);

    // Mirror-image heart in dextrocardia; centre the heart on the vector origin.
    this.heart.scale.set(p.dextrocardia ? -1 : 1, 1, 1);
    const c = T(A.center);
    this.heart.position.set(p.dextrocardia ? c.x : -c.x, -c.y, -c.z);
    this.buildAxes();
    this.applyMaterials();
  }

  private ventSurfacePoint(dir: V3): V3 {
    const A = this.A!;
    const target = vadd(A.center, vscale(dir, 1.2));
    let best: V3 = A.cL;
    let bd = Infinity;
    for (const s of this.shells) {
      if (s.side === 'A' || s.endo === 1) continue;
      for (const p of s.pos) {
        const d = (p[0] - target[0]) ** 2 + (p[1] - target[1]) ** 2 + (p[2] - target[2]) ** 2;
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
    }
    return best;
  }

  private buildAxes(): void {
    for (const o of [...this.axisGroup.children]) {
      this.axisGroup.remove(o);
      if (o instanceof CSS2DObject) o.element.remove();
      const m = o as THREE.Line;
      m.geometry?.dispose?.();
      (m.material as THREE.Material | undefined)?.dispose?.();
    }
    const add = (id: LeadId, strong: boolean): void => {
      const a = T(LEADS[id].axis).normalize();
      const g = new THREE.BufferGeometry().setFromPoints([a.clone().multiplyScalar(-2.1), a.clone().multiplyScalar(2.1)]);
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: strong ? 0x2e7d32 : 0x8a8a8a, transparent: true, opacity: strong ? 0.95 : 0.35, depthTest: false }));
      line.renderOrder = 28;
      this.axisGroup.add(line);
      const lab = new CSS2DObject(h('span', { class: `h3d-lab lead ${strong ? 'strong' : ''}` }, `${id} +`));
      lab.position.copy(a.clone().multiplyScalar(2.25));
      this.axisGroup.add(lab);
    };
    if (this.show.allLeads) for (const id of TWELVE) if (id !== this.lead) add(id, false);
    add(this.lead, true);
  }

  private applyMaterials(): void {
    const cut = this.wallMode === 'cut';
    const glass = this.wallMode === 'glass';
    for (const s of this.shells) {
      const m = s.mesh.material as THREE.MeshStandardMaterial;
      m.clippingPlanes = cut ? [this.clip] : [];
      m.transparent = glass;
      m.opacity = glass ? (s.endo === 1 ? 0.5 : 0.28) : 1;
      m.depthWrite = !glass;
      m.needsUpdate = true;
      if (s.endo === 1) s.mesh.visible = this.wallMode !== 'solid';
    }
    this.heart.traverse((o) => {
      if (o.name === 'vessel') {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
        m.clippingPlanes = cut ? [this.clip] : [];
        m.transparent = glass;
        m.opacity = glass ? 0.25 : 1;
        m.depthWrite = !glass;
        m.needsUpdate = true;
      }
    });
    for (const tr of this.tracts) {
      tr.mesh.visible = this.show.system;
      tr.mat.depthTest = !this.show.system ? true : false;
      tr.mat.needsUpdate = true;
    }
    const sa = this.heart.getObjectByName('SA');
    if (sa) sa.visible = this.show.system;
    for (const l of this.labels) l.visible = this.show.labels;
    this.axisGroup.visible = this.show.axis;
    this.buildAxes();
  }

  // ------------------------------------------------------------------ timing
  private beats(): BeatInfo[] {
    return this.run!.sig.beats;
  }

  private beatTimes(bi: number): { act: Float32Array[]; rep: Float32Array[] } {
    const hit = this.beatCache.get(bi);
    if (hit) return hit;
    const run = this.run!;
    const A = this.A!;
    const b = this.beats()[bi];
    const p = run.physio;
    const ev = b.ev;
    type Src = { pos: V3; t: number; side: 'L' | 'R' | 'both'; fast: boolean };
    const src: Src[] = [];
    const hisSources = (t0: number): void => {
      let bundle = p.bundle as string;
      if (ev.aberrant === 'rbbb' && !bundle.startsWith('rbbb')) bundle = bundle === 'lafb' ? 'rbbb+lafb' : bundle === 'lpfb' ? 'rbbb+lpfb' : bundle === 'lbbb' ? 'lbbb' : 'rbbb';
      const rb = !(bundle.startsWith('rbbb'));
      const lb = bundle !== 'lbbb';
      const laf = lb && bundle !== 'lafb' && bundle !== 'rbbb+lafb';
      const lpf = lb && bundle !== 'lpfb' && bundle !== 'rbbb+lpfb';
      const incomplete = bundle === 'incompleteRbbb';
      if (lb) src.push({ pos: lvPoint(A, -0.2, 0, 0.7), t: t0, side: 'L', fast: true });
      if (laf) src.push({ pos: lvPoint(A, 0.35, 100, 0.68), t: t0 + 6, side: 'L', fast: true });
      if (lpf) src.push({ pos: lvPoint(A, 0.4, -100, 0.68), t: t0 + 6, side: 'L', fast: true });
      if (!laf && lb) src.push({ pos: lvPoint(A, 0.3, 100, 0.68), t: t0 + 26, side: 'L', fast: false });
      if (!lpf && lb) src.push({ pos: lvPoint(A, 0.4, -100, 0.68), t: t0 + 26, side: 'L', fast: false });
      if (rb) src.push({ pos: rvPoint(A, 0.35, 0, 0.85), t: t0 + (incomplete ? 26 : 8), side: 'R', fast: true });
      if (rb) src.push({ pos: lvPoint(A, -0.3, 0, 1.08), t: t0 + (incomplete ? 22 : 6), side: 'R', fast: true });
      // A side without its bundle is reached by slow cell-to-cell spread through the septum.
      if (!rb) src.push({ pos: lvPoint(A, 0.0, 0, 1.08), t: t0 + 24, side: 'R', fast: false });
      if (!lb) {
        src.push({ pos: lvPoint(A, -0.1, 0, 0.72), t: t0 + 16, side: 'L', fast: false });
        src.push({ pos: lvPoint(A, -0.1, 0, 1.0), t: t0 + 12, side: 'L', fast: false });
      }
    };
    if (ev.route === 'his') hisSources(0);
    else if (ev.route === 'ap') {
      const d = AP_SITE[ev.apLocation ?? p.rhythm.ap.location].pos as unknown as V3;
      src.push({ pos: this.ventSurfacePoint(d), t: 0, side: 'both', fast: false });
      if (Number.isFinite(ev.hisDelay)) hisSources(ev.hisDelay);
    } else {
      const site = ev.route === 'paced' ? 'rvApex' : (ev.site ?? 'rvApex');
      if (site === 'fascicularPosterior') src.push({ pos: lvPoint(A, 0.4, -100, 0.68), t: 0, side: 'L', fast: true }, { pos: lvPoint(A, 0.0, 0, 1.08), t: 22, side: 'R', fast: false });
      else if (site === 'fascicularAnterior') src.push({ pos: lvPoint(A, 0.35, 100, 0.68), t: 0, side: 'L', fast: true }, { pos: lvPoint(A, 0.0, 0, 1.08), t: 22, side: 'R', fast: false });
      else src.push({ pos: this.ventSurfacePoint(VENT_SITE[site].pos as unknown as V3), t: 0, side: 'both', fast: false });
      if (Number.isFinite(ev.hisDelay) && ev.hisDelay < 70) hisSources(ev.hisDelay);
    }
    // Scar does not activate.
    const isch = p.ischemia;
    const scar = (isch.stage === 'old' || isch.stage === 'evolving' || isch.stage === 'aneurysm') && isch.territory !== 'diffuseSubendo';
    const tdir = territoryVector(isch.territory) as unknown as V3;
    const vFast = 0.042;
    const vSlow = 0.011;
    const act: Float32Array[] = [];
    let maxT = 1;
    for (const s of this.shells) {
      const arr = new Float32Array(s.pos.length);
      if (s.side === 'A') {
        arr.fill(NaN);
        act.push(arr);
        continue;
      }
      for (let i = 0; i < s.pos.length; i++) {
        const v = s.pos[i];
        if (scar && vdot(vnorm(vsub(v, A.center)), tdir) > 0.62 && s.endo < 1) {
          arr[i] = NaN;
          continue;
        }
        let best = Infinity;
        for (const q of src) {
          if (q.side !== 'both' && q.side !== s.side) continue;
          const d = Math.hypot(v[0] - q.pos[0], v[1] - q.pos[1], v[2] - q.pos[2]);
          const tt = q.t + d / (q.fast ? vFast : vSlow) + (1 - s.endo) * (q.fast ? 16 : 6);
          if (tt < best) best = tt;
        }
        arr[i] = best;
        if (best > maxT && Number.isFinite(best)) maxT = best;
      }
      act.push(arr);
    }
    const scale = (b.morph.qrsDur * 0.95) / maxT;
    // Repolarisation: regions the T vector points toward repolarise first (and epicardium before endocardium).
    const tComp = b.morph.comps.find((c) => c.tag === 'T wave');
    const td: V3 | null = tComp ? vnorm(tComp.dir as unknown as V3) : null;
    const rep: Float32Array[] = [];
    this.shells.forEach((s, si) => {
      const a = act[si];
      const r = new Float32Array(s.pos.length);
      for (let i = 0; i < s.pos.length; i++) {
        if (!Number.isFinite(a[i])) {
          r[i] = NaN;
          continue;
        }
        a[i] *= scale;
        const dirv = vnorm(vsub(s.pos[i], A.center));
        let f = 0.5 + 0.2 * (s.endo - 0.5);
        if (td) f -= 0.38 * vdot(dirv, td);
        f = Math.max(0.04, Math.min(0.96, f));
        r[i] = b.morph.tStart + (b.morph.tEnd - b.morph.tStart) * f;
      }
      rep.push(r);
    });
    const out = { act, rep };
    this.beatCache.set(bi, out);
    return out;
  }

  private atrialTimes(ai: number): Float32Array[] {
    const hit = this.atrialCache.get(ai);
    if (hit) return hit;
    const run = this.run!;
    const A = this.A!;
    const a = run.sim.atrial[ai];
    const siteOf = (s: AtrialSite): V3 => {
      switch (s) {
        case 'lowRA':
          return vadd(A.cRA, [0.1, 0.3, -0.05]);
        case 'leftAtrial':
          return vadd(A.cLA, [0.1, -0.25, 0.1]);
        case 'lowLA':
          return vadd(A.cLA, [0.0, 0.25, 0.0]);
        case 'retroSeptal':
        case 'retroPosteroseptal':
          return vadd(A.cRA, [0.35, 0.3, -0.1]);
        case 'retroLeftLateral':
          return vadd(A.cLA, [0.4, 0.1, -0.1]);
        case 'retroRightFree':
          return vadd(A.cRA, [-0.38, 0.05, 0]);
        default:
          return vadd(A.cRA, [-0.16, -0.33, 0.14]);
      }
    };
    const o = siteOf(a.site);
    const pDur = buildP(run.physio, a.site).pDur;
    const out: Float32Array[] = [];
    let maxT = 1;
    for (const s of this.shells) {
      const arr = new Float32Array(s.pos.length).fill(NaN);
      if (s.side === 'A') {
        for (let i = 0; i < s.pos.length; i++) {
          const v = s.pos[i];
          arr[i] = Math.hypot(v[0] - o[0], v[1] - o[1], v[2] - o[2]);
          if (arr[i] > maxT) maxT = arr[i];
        }
      }
      out.push(arr);
    }
    const k = pDur / maxT;
    for (const arr of out) for (let i = 0; i < arr.length; i++) if (Number.isFinite(arr[i])) arr[i] *= k;
    this.atrialCache.set(ai, out);
    return out;
  }

  private colour(): void {
    const run = this.run!;
    const t = this.t;
    const beats = this.beats();
    let bi = -1;
    for (let i = 0; i < beats.length; i++) if (beats[i].ev.t <= t + 0.001) bi = i;
    const cur = bi >= 0 ? this.beatTimes(bi) : null;
    const prv = bi >= 1 ? this.beatTimes(bi - 1) : null;
    const cont = run.sim.continuous.filter((c) => t >= c.t0 && t <= c.t1);
    const atrialCont = cont.find((c) => c.kind === 'flutter' || c.kind === 'fib');
    const ventCont = cont.find((c) => c.kind === 'vf' || c.kind === 'vflutter');
    // Latest atrial events up to t (current and previous for repolarisation).
    let ai = -1;
    const at = run.sim.atrial;
    for (let i = 0; i < at.length; i++) if (at[i].kind !== 'flutter' && at[i].t <= t) ai = i;
    const aCur = ai >= 0 && t - at[ai].t < 900 ? this.atrialTimes(ai) : null;
    const isch = run.physio.ischemia;
    const tdir = territoryVector(isch.territory) as unknown as V3;
    const injured = isch.stage !== 'none' && isch.stage !== 'old';
    const scarStage = (isch.stage === 'old' || isch.stage === 'evolving' || isch.stage === 'aneurysm') && isch.territory !== 'diffuseSubendo';
    const A = this.A!;
    this.shells.forEach((s, si) => {
      const col = s.colors;
      for (let i = 0; i < s.pos.length; i++) {
        const v = s.pos[i];
        if (s.side === 'A') {
          if (atrialCont) {
            if (atrialCont.kind === 'flutter') {
              const cl = atrialCont.cl ?? 200;
              const ang = Math.atan2(vdot(vsub(v, A.cRA), W), vdot(vsub(v, A.cRA), SEPT));
              const ph = ((((t - atrialCont.t0) / cl - (atrialCont.reverse ? -1 : 1) * ang / (2 * Math.PI)) % 1) + 1) % 1;
              if (ph < 0.08) tmp.copy(C.front);
              else if (ph < 0.55) tmp.copy(C.depol);
              else if (ph < 0.7) tmp.copy(C.repol);
              else tmp.copy(C.rest);
            } else {
              const q = Math.sin(0.045 * t + 7 * v[0]) + Math.sin(0.052 * t + 6 * v[1] + 1) + Math.sin(0.061 * t + 8 * v[2] + 2);
              if (q > 2.1) tmp.copy(C.front);
              else if (q > 0.9) tmp.copy(C.depol);
              else tmp.copy(C.rest);
            }
          } else if (aCur && Number.isFinite(aCur[si][i])) {
            const ta = at[ai].t + aCur[si][i];
            stateColor(tmp, t, ta, ta + 190);
          } else tmp.copy(C.rest);
        } else if (ventCont) {
          const q = Math.sin(0.04 * t + 6 * v[0]) + Math.sin(0.047 * t + 5 * v[1] + 1) + Math.sin(0.055 * t + 7 * v[2] + 2);
          if (q > 2.0) tmp.copy(C.front);
          else if (q > 0.8) tmp.copy(C.depol);
          else tmp.copy(C.rest);
        } else {
          const aC = cur ? cur.act[si][i] : NaN;
          const isScar = !Number.isFinite(aC) && !!cur && scarStage;
          if (isScar) tmp.copy(C.scar);
          else if (cur && t >= beats[bi].ev.t + aC) stateColor(tmp, t, beats[bi].ev.t + aC, beats[bi].ev.t + cur.rep[si][i]);
          else if (prv && Number.isFinite(prv.act[si][i])) stateColor(tmp, t, beats[bi - 1].ev.t + prv.act[si][i], beats[bi - 1].ev.t + prv.rep[si][i]);
          else tmp.copy(C.rest);
          if (injured && !isScar) {
            const inj = isch.territory === 'diffuseSubendo' || isch.stage === 'subendocardial' ? s.endo > 0.9 : vdot(vnorm(vsub(v, A.center)), tdir) > 0.6;
            if (inj) tmp.lerp(C.injury, 0.4);
          }
        }
        col[i * 3] = tmp.r;
        col[i * 3 + 1] = tmp.g;
        col[i * 3 + 2] = tmp.b;
      }
      (s.mesh.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    });
  }

  private updateTracts(): void {
    const run = this.run!;
    const t = this.t;
    const R = run.physio.rhythm;
    const hv = R.hv;
    const on = new Map<string, number>(); // tract id → progress u (0..1)
    const bad = new Set<string>();
    for (const a of run.sim.atrial) {
      if (t >= a.t && t < a.t + 70 && (a.site === 'sinus' || a.site === 'highRA' || a.site === 'crista')) {
        on.set('internodal', (t - a.t) / 70);
        on.set('bachmann', (t - a.t) / 70);
      }
    }
    for (const sg of run.sim.ladder) {
      const lo = Math.min(sg.t0, sg.t1);
      const hi = Math.max(sg.t0, sg.t1);
      if (t < lo || t > hi + (sg.blocked ? 150 : 0)) continue;
      const u = sg.dir === 'ante' ? (t - sg.t0) / Math.max(1, sg.t1 - sg.t0) : 1 - (t - sg.t1) / Math.max(1, sg.t0 - sg.t1);
      const id = sg.row === 'AP' ? 'ap' : sg.path.includes('fast') && R.dualPathway ? 'fast' : sg.path.includes('slow') && R.dualPathway ? 'slow' : 'avn';
      const infra = sg.blocked && run.sim.log.some((l) => l.kind === 'block' && l.node === 'HIS' && l.t >= lo - 20 && l.t <= hi + 60);
      if (sg.blocked && infra) on.set(id, 1);
      else if (sg.blocked && t > hi) bad.add(id);
      else on.set(id, Math.max(0, Math.min(1, u)));
      if (id === 'fast' || id === 'slow') on.set('avn', Math.max(0, Math.min(1, u)));
    }
    for (const lg of run.sim.log) if (lg.kind === 'block' && lg.node === 'HIS' && t >= lg.t && t < lg.t + 200) bad.add('his');
    for (const b of run.sim.ventricular) {
      if (b.route !== 'his' && !(Number.isFinite(b.hisDelay) && b.hisDelay < 100)) continue;
      const t0 = b.route === 'his' ? b.t : b.t + b.hisDelay;
      if (t >= t0 - hv && t < t0 - hv * 0.4) on.set('his', (t - (t0 - hv)) / (hv * 0.6));
      if (t >= t0 - hv * 0.5 && t < t0 + 6) for (const id of ['lb', 'laf', 'lpf', 'sept', 'rb']) on.set(id, (t - (t0 - hv * 0.5)) / (hv * 0.5 + 6));
      if (t >= t0 - 6 && t < t0 + 22) for (const id of ['laf', 'lpf', 'sept', 'rb']) for (let k = 0; k < 6; k++) on.set(`${id}-p${k}`, (t - (t0 - 6)) / 28);
    }
    for (const s of run.sim.spikes) if (s.chamber === 'V' && t >= s.t && t < s.t + 40) on.set('lead', 1);
    let di = 0;
    for (const tr of this.tracts) {
      const u = on.get(tr.id);
      const active = u !== undefined && !tr.blocked;
      if (bad.has(tr.id)) tr.mat.color.set('#ff1744');
      else if (active) tr.mat.color.set('#ffffff');
      else tr.mat.color.copy(tr.base);
      tr.mat.opacity = active || bad.has(tr.id) ? 1 : 0.85;
      if (active && !tr.id.includes('-p') && tr.id !== 'bachmann' && di < this.dots.length && this.show.system) {
        const d = this.dots[di++];
        d.visible = true;
        d.position.copy(tr.curve.getPointAt(Math.max(0, Math.min(1, u!))));
      }
    }
    for (; di < this.dots.length; di++) this.dots[di].visible = false;
    const sa = this.heart.getObjectByName('SA') as THREE.Mesh | undefined;
    if (sa) {
      const fired = run.sim.log.some((l) => l.node === 'SA' && l.kind === 'fire' && t >= l.t && t < l.t + 50);
      (sa.material as THREE.MeshBasicMaterial).color.set(fired ? '#ffffff' : '#ffe082');
      sa.scale.setScalar(fired ? 1.6 : 1);
    }
  }

  private updateOverlay(): void {
    const run = this.run;
    if (!run) return;
    const sig = run.sig;
    const i = Math.max(0, Math.min(sig.n - 1, Math.round(((this.t - sig.from) * sig.fs) / 1000)));
    const v = new THREE.Vector3(sig.vcg[0][i], -sig.vcg[1][i], sig.vcg[2][i]);
    const mag = v.length();
    const S = 1.25;
    this.arrow.visible = this.show.vector && mag > 0.015;
    if (this.arrow.visible) {
      const L = Math.max(0.25, mag * S);
      const shaftL = Math.max(0.03, L - 0.2);
      this.arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize());
      this.shaft.scale.set(1, shaftL, 1);
      this.shaft.position.set(0, shaftL / 2, 0);
      const halo = this.arrow.getObjectByName('halo')!;
      halo.scale.set(1, shaftL, 1);
      halo.position.set(0, shaftL / 2, 0);
      this.head.position.set(0, shaftL + 0.11, 0);
    }
    // Vector loop since the start of the current wave (last ≤ 400 ms).
    const from = Math.max(0, i - 400);
    let start = from;
    for (let k = i; k > from; k--) {
      const m = Math.hypot(sig.vcg[0][k], sig.vcg[1][k], sig.vcg[2][k]);
      if (m < 0.012) {
        start = k;
        break;
      }
    }
    const pts: THREE.Vector3[] = [];
    for (let k = start; k <= i; k += 2) pts.push(new THREE.Vector3(sig.vcg[0][k] * S, -sig.vcg[1][k] * S, sig.vcg[2][k] * S));
    this.loop.geometry.dispose();
    this.loop.geometry = new THREE.BufferGeometry().setFromPoints(pts.length > 1 ? pts : [new THREE.Vector3(), new THREE.Vector3()]);
    this.loop.visible = this.show.vector;
    // Projection of the vector on the selected lead axis = the voltage that lead records.
    const ax = T(LEADS[this.lead].axis).normalize();
    const pr = v.dot(ax);
    const len = Math.abs(pr) * S;
    this.proj.visible = this.show.axis && len > 0.01;
    if (this.proj.visible) {
      this.proj.scale.set(1, len, 1);
      this.proj.position.copy(ax.clone().multiplyScalar((pr * S) / 2));
      this.proj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ax.clone().multiplyScalar(Math.sign(pr) || 1));
      (this.proj.material as THREE.MeshBasicMaterial).color.set(pr >= 0 ? '#2e7d32' : '#c62828');
    }
    const val = sig.leads[this.lead]?.[i] ?? 0;
    this.projLabel.visible = this.show.axis;
    this.projLabel.position.copy(ax.clone().multiplyScalar(pr * S + Math.sign(pr || 1) * 0.25));
    this.projLabel.element.textContent = `${this.lead}: ${val >= 0 ? '+' : ''}${val.toFixed(2)} mV`;
    this.projLabel.element.className = `h3d-lab proj ${val >= 0 ? 'pos' : 'neg'}`;
  }

  // ------------------------------------------------------------------ render
  private resize(): void {
    const w = this.host.clientWidth || 300;
    const hgt = this.host.clientHeight || 300;
    this.renderer.setSize(w, hgt, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${hgt}px`;
    this.labelRenderer.setSize(w, hgt);
    this.camera.aspect = w / hgt;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  private pending = false;
  requestRender(): void {
    if (this.pending || this.disposed) return;
    this.pending = true;
    this.raf = requestAnimationFrame(() => {
      this.pending = false;
      if (this.disposed) return;
      const moving = this.controls.update();
      // Cut away the half of the heart that faces the viewer.
      const toCam = this.camera.position.clone().sub(this.controls.target).normalize();
      this.clip.normal.copy(toCam.clone().negate());
      this.clip.constant = 0.02;
      this.renderer.render(this.scene, this.camera);
      this.labelRenderer.render(this.scene, this.camera);
      this.drawGizmo();
      if (moving) this.requestRender();
    });
  }

  private drawGizmo(): void {
    const q = this.camera.quaternion.clone().invert();
    const axes: [string, THREE.Vector3, string][] = [
      ['L', new THREE.Vector3(1, 0, 0), '#e53935'],
      ['Sup', new THREE.Vector3(0, 1, 0), '#43a047'],
      ['Ant', new THREE.Vector3(0, 0, 1), '#1e88e5'],
    ];
    const g = this.gizmo;
    while (g.firstChild) g.removeChild(g.firstChild);
    for (const [lab, v, col] of axes) {
      const p = v.clone().applyQuaternion(q);
      const x = p.x * 26;
      const y = -p.y * 26;
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      ln.setAttribute('x1', '0');
      ln.setAttribute('y1', '0');
      ln.setAttribute('x2', String(x));
      ln.setAttribute('y2', String(y));
      ln.setAttribute('stroke', col);
      ln.setAttribute('stroke-width', '3');
      ln.setAttribute('opacity', p.z < -0.2 ? '0.35' : '1');
      const tx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tx.setAttribute('x', String(x * 1.25));
      tx.setAttribute('y', String(y * 1.25 + 4));
      tx.setAttribute('text-anchor', 'middle');
      tx.setAttribute('font-size', '11');
      tx.setAttribute('fill', col);
      tx.textContent = lab;
      g.append(ln, tx);
    }
  }
}

function legendItem(c: THREE.Color, text: string): HTMLElement {
  return h('span', { class: 'h3d-leg' }, h('i', { style: `background:#${c.getHexString()}` }), text);
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

void TERRITORY;
