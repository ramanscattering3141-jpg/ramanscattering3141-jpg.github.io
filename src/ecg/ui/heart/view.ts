// The beating 3-D heart: a rotatable anatomical model driven, millisecond by millisecond, by the
// same simulation that draws the ECG.
//
// What you see is computed, not animated by hand. For every beat the activation sequence is the
// geodesic arrival time through the actual wall from that beat's entry points (Purkinje sites
// chosen by the bundle-branch state, an ectopic focus, an accessory pathway, the pacing lead, or
// combinations for fusion), scaled to the beat's QRS (or P) duration; repolarisation follows the
// beat's own T-wave vector; each region contracts after its own activation, so dyssynchrony is
// visible; valves open and close from the haemodynamic model; the impulse runs down the
// conduction system on the timing of the conduction simulation; and the heart-vector arrow is the
// summed dipole that is projected onto the leads to write the ECG.
//
// Frames: anatomy is in the engine body frame (x = patient's left, y = inferior, z = anterior, cm).
// The scene's heart group maps it to three.js (y up) and centres it; dextrocardia mirrors it.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import type { EcgRun } from '../../engine';
import type { HemoResult } from '../../engine/hemo';
import { LEADS, TWELVE, type LeadId } from '../../engine/leads';
import { VENT_SITE, AP_SITE } from '../../engine/morphology';
import type { Territory } from '../../engine/params';
import { h } from '../dom';
import { type Anatomy, type V3, buildAnatomy, comb, cross, dot, isAtrial, len, lerp, norm, project, sub, REGION_NAME, SEG_NAMES, CORONARY_NAME, Region } from './anatomy';
import { anatomyKey, computeAnatomy, computeMap, computeZones, type AnatomyResult, type BeatJob, type GridMeta, type MapResult } from './compute';
import { atrialApd, atrialKey, apInsertion, NEVER, ventKey } from './volume';
import { MYO_FRAG, MYO_VERT, TRACT_FRAG, TRACT_VERT } from './shaders';
import './heart.css';

// ------------------------------------------------------------------ worker
interface Pending {
  onAnatomy?: (r: AnatomyMsg) => void;
  onMap?: (m: MapResult) => void;
}
interface AnatomyMsg {
  key: string;
  meta: GridMeta;
  mesh: AnatomyResult['mesh'];
  info: Uint8Array;
  depth: Float32Array;
  near: Int32Array;
  zones: Uint8Array;
}
let worker: Worker | null | undefined;
let reqId = 0;
const pending = new Map<number, Pending>();
function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./heart.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent): void => {
      const m = e.data as { id: number; type: string } & Record<string, unknown>;
      const p = pending.get(m.id);
      if (!p) return;
      if (m.type === 'anatomy') {
        pending.delete(m.id);
        p.onAnatomy?.(m as unknown as AnatomyMsg);
      } else if (m.type === 'map') p.onMap?.(m.map as MapResult);
      else if (m.type === 'mapsDone' || m.type === 'error') pending.delete(m.id);
    };
    worker.onerror = (): void => {
      worker = null;
    };
  } catch {
    worker = null;
  }
  return worker;
}
/** Strip the run to plain data the worker needs (signals are large and unused there). */
function slimRun(run: EcgRun): EcgRun {
  return { physio: run.physio, sim: run.sim, m: run.m, sig: { ...run.sig, leads: {}, vcg: [new Float32Array(0), new Float32Array(0), new Float32Array(0)] } };
}

// ------------------------------------------------------------------ helpers
const toThree = (v: V3): THREE.Vector3 => new THREE.Vector3(v[0], v[1], v[2]);

type View = 'section' | 'anterior' | 'lao' | 'rao' | 'left' | 'posterior' | 'inferior';
const VIEW_LABEL: Record<View, string> = {
  section: 'Face the cut',
  anterior: 'Front',
  lao: 'LAO 45°',
  rao: 'RAO 30°',
  left: 'Left side',
  posterior: 'Back',
  inferior: 'From below',
};
const VIEW_DIR: Record<Exclude<View, 'section'>, [number, number, number]> = {
  anterior: [0, 0, 1],
  lao: [0.71, 0, 0.71],
  rao: [-0.5, 0, 0.87],
  left: [1, 0, 0],
  posterior: [0, 0, -1],
  inferior: [0, -1, 0.0001],
};

export type ColourMode = 'state' | 'voltage' | 'isochrone' | 'refractory' | 'coronary' | 'lead';
const MODES: [ColourMode, string, string][] = [
  ['state', 'Electrical state', 'resting · wavefront · depolarised · repolarising'],
  ['voltage', 'Membrane potential', 'each cell’s voltage in mV'],
  ['isochrone', 'Activation map', 'when each region is reached in this beat'],
  ['refractory', 'Refractoriness', 'the vulnerable period during the T wave'],
  ['coronary', 'Coronary territories', 'LAD, circumflex, right coronary'],
  ['lead', 'What a lead sees', 'the wall facing the chosen lead'],
];
type Cut = 'none' | 'four' | 'short';
const CUTS: [Cut, string][] = [
  ['four', 'Four-chamber cut'],
  ['short', 'Short-axis cut'],
  ['none', 'Whole heart'],
];

interface TractObj {
  id: string;
  kind: string;
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  curve: THREE.CatmullRomCurve3;
  base: THREE.Color;
  blocked: boolean;
}
interface ValveObj {
  id: string;
  bit: number;
  group: THREE.Group;
  rest: V3;
  leaflets: { pivot: THREE.Group; axis: THREE.Vector3; sign: number }[];
  ring: THREE.Mesh;
}
interface MapEntry {
  tex: THREE.Data3DTexture;
  data: Float32Array;
  maxAct: number;
}

export interface Heart3DOptions {
  height?: number;
  compact?: boolean;
}

export class Heart3D {
  readonly root: HTMLDivElement;
  private host: HTMLDivElement;
  private renderer: THREE.WebGLRenderer;
  private labelRenderer: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private group = new THREE.Group();
  private overlay = new THREE.Group();
  private uniforms: Record<string, THREE.IUniform>;
  private myoMat: THREE.ShaderMaterial;
  private myo: THREE.Mesh | null = null;
  private tracts: TractObj[] = [];
  private valves: ValveObj[] = [];
  private vessels = new THREE.Group();
  private coronaries = new THREE.Group();
  private extras = new THREE.Group();
  private labels: { obj: CSS2DObject; rest: V3; kind: string }[] = [];
  private comets: THREE.Sprite[] = [];
  private focusMarker: THREE.Mesh | null = null;
  private run: EcgRun | null = null;
  private hemo: HemoResult | null = null;
  private A: Anatomy | null = null;
  private anatKey = '';
  private meta: GridMeta | null = null;
  private info: Uint8Array | null = null;
  private zones: Uint8Array | null = null;
  private infoTex: THREE.Data3DTexture | null = null;
  private emptyTex: THREE.Data3DTexture | null = null;
  private maps = new Map<string, MapEntry>();
  private vKeys: string[] = [];
  private aKeys: (string | null)[] = [];
  private runToken = 0;
  private t = 0;
  private lead: LeadId = 'II';
  private mode: ColourMode = 'state';
  private cut: Cut = 'four';
  private show = { system: true, vector: true, axis: false, labels: true, motion: true, valves: true, vessels: true, coronary: false, allLeads: false };
  private arrow = new THREE.Group();
  private shaft: THREE.Mesh;
  private head: THREE.Mesh;
  private loop: THREE.Line;
  private axisGroup = new THREE.Group();
  private proj: THREE.Mesh;
  private projLabel: CSS2DObject;
  private gizmo: SVGSVGElement;
  private legend: HTMLDivElement;
  private hud: HTMLDivElement;
  private loading: HTMLDivElement;
  private inspector: HTMLDivElement;
  private apCanvas: HTMLCanvasElement;
  private pick: V3 | null = null;
  private pickMarker: THREE.Mesh;
  private ro: ResizeObserver;
  private raf = 0;
  private disposed = false;
  private pendingRender = false;
  private compact: boolean;
  private mirror = 1;
  private view: View = 'section';
  private bar: HTMLDivElement;
  private hudKey = '';
  private hudTime: HTMLSpanElement | null = null;

  constructor(opts: Heart3DOptions = {}) {
    this.compact = !!opts.compact;
    this.host = h('div', { class: 'hv-canvas', style: `height:${opts.height ?? 420}px` });
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.localClippingEnabled = true;
    this.renderer.domElement.setAttribute('role', 'img');
    this.renderer.domElement.setAttribute('aria-label', 'Beating 3-D heart driven by the simulation. Drag to rotate, scroll or pinch to zoom, click the heart muscle to inspect it.');
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'hv-labels';
    this.gizmo = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.gizmo.setAttribute('class', 'hv-gizmo');
    this.gizmo.setAttribute('viewBox', '-40 -40 80 80');
    this.gizmo.setAttribute('aria-hidden', 'true');
    this.hud = h('div', { class: 'hv-hud' });
    this.loading = h('div', { class: 'hv-loading' }, h('span', { class: 'hv-spin', 'aria-hidden': 'true' }), h('span', null, 'Building the 3-D heart…'));
    this.legend = h('div', { class: 'hv-legend' });
    this.host.append(this.renderer.domElement, this.labelRenderer.domElement, this.gizmo, this.hud, this.legend, this.loading);

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 200);
    this.camera.position.set(0, 0, 30);
    this.scene.add(this.camera);
    this.controls = new OrbitControls(this.camera, this.labelRenderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 70;
    this.controls.addEventListener('change', () => this.requestRender());
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(6, 10, 14);
    this.camera.add(key);
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x302830, 1.0));
    this.scene.add(this.group, this.overlay);
    this.group.add(this.vessels, this.coronaries, this.extras);

    this.uniforms = this.makeUniforms();
    this.myoMat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: MYO_VERT, fragmentShader: MYO_FRAG, glslVersion: THREE.GLSL3, side: THREE.DoubleSide });

    // Heart-vector arrow, its loop, and the lead-axis projection.
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true });
    const haloMat = new THREE.MeshBasicMaterial({ color: 0x0b1018, depthTest: false, transparent: true, opacity: 0.85 });
    this.shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 1, 14), arrowMat);
    this.head = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.95, 20), arrowMat);
    const halo = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1, 14), haloMat);
    halo.name = 'halo';
    for (const m of [halo, this.shaft, this.head]) m.renderOrder = 60;
    this.arrow.add(halo, this.shaft, this.head);
    this.loop = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffd54a, depthTest: false, transparent: true, opacity: 0.95 }));
    this.loop.renderOrder = 58;
    this.proj = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1, 12), new THREE.MeshBasicMaterial({ color: 0x22c55e, depthTest: false, transparent: true, opacity: 0.85 }));
    this.proj.renderOrder = 59;
    this.projLabel = new CSS2DObject(h('span', { class: 'hv-lab proj' }));
    this.overlay.add(this.arrow, this.loop, this.axisGroup, this.proj, this.projLabel);
    this.pickMarker = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshBasicMaterial({ color: '#00e5ff', depthTest: false }));
    this.pickMarker.renderOrder = 70;
    this.pickMarker.visible = false;

    this.apCanvas = h('canvas', { class: 'hv-ap', width: 360, height: 130, 'aria-label': 'Action potential of the selected spot' });
    this.inspector = h('div', { class: 'hv-insp' });
    this.bar = this.buildBar();
    this.root = h('div', { class: `hv ${this.compact ? 'compact' : ''}` }, this.bar, this.host, this.inspector);
    this.setupPicking();
    this.updateLegend();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.host);
  }

  static supported(): boolean {
    try {
      const c = document.createElement('canvas');
      return !!c.getContext('webgl2');
    } catch {
      return false;
    }
  }

  private makeUniforms(): Record<string, THREE.IUniform> {
    const u = (value: unknown): THREE.IUniform => ({ value });
    return {
      uT: u(0),
      uVcur: u(null),
      uVprev: u(null),
      uAcur: u(null),
      uAprev: u(null),
      uInfo: u(null),
      uVcurT: u(-1e6),
      uVprevT: u(-1e6),
      uAcurT: u(-1e6),
      uAprevT: u(-1e6),
      uGmin: u(new THREE.Vector3()),
      uGsize: u(new THREE.Vector3(1, 1, 1)),
      uACont: u(0),
      uVCont: u(0),
      uFlT0: u(0),
      uFlCL: u(200),
      uFlDir: u(1),
      uTVc: u(new THREE.Vector3()),
      uE1: u(new THREE.Vector3(1, 0, 0)),
      uE2: u(new THREE.Vector3(0, 1, 0)),
      uB: u(new THREE.Vector3()),
      uAx: u(new THREE.Vector3(0, 1, 0)),
      uSx: u(new THREE.Vector3(1, 0, 0)),
      uApexU: u(8),
      uCentre: u(new THREE.Vector3()),
      uMotion: u(1),
      uAmpV: u(1),
      uAmpA: u(1),
      uRAc: u(new THREE.Vector3()),
      uLAc: u(new THREE.Vector3()),
      uIsch: u(0),
      uLvP: u(0),
      uMode: u(0),
      uCut: u(new THREE.Vector4(0, 0, 1, 0)),
      uCutOn: u(1),
      uCutW: u(new THREE.Vector4(0, 0, 1, 0)),
      uInvGroup: u(new THREE.Matrix4()),
      uLeadAx: u(new THREE.Vector3(0, 1, 0)),
      uVmax: u(80),
      uAmax: u(100),
      uIschView: u(1),
    };
  }

  // ------------------------------------------------------------------ toolbar
  private buildBar(): HTMLDivElement {
    const seg = <T extends string>(label: string, items: [T, string][], value: T, on: (v: T) => void): HTMLElement => {
      const wrap = h('div', { class: 'hv-seg', role: 'group', 'aria-label': label });
      const btns = items.map(([v, t]) => {
        const b = h('button', { type: 'button', class: v === value ? 'on' : '', 'aria-pressed': String(v === value) }, t);
        b.addEventListener('click', () => {
          btns.forEach((x) => {
            x.classList.toggle('on', x === b);
            x.setAttribute('aria-pressed', String(x === b));
          });
          on(v);
        });
        return b;
      });
      wrap.append(...btns);
      return wrap;
    };
    const cut = seg<Cut>('Cut', CUTS, this.cut, (v) => this.setCut(v));
    const mode = h('select', { class: 'hv-sel', 'aria-label': 'Colour the heart by' }, ...MODES.map(([k, l]) => h('option', { value: k }, l)));
    mode.addEventListener('change', () => this.setMode(mode.value as ColourMode));
    const view = h('select', { class: 'hv-sel', 'aria-label': 'Viewpoint' }, ...(Object.keys(VIEW_LABEL) as View[]).map((k) => h('option', { value: k }, VIEW_LABEL[k])));
    view.addEventListener('change', () => this.setView(view.value as View));
    const chip = (label: string, key: keyof typeof this.show, title: string): HTMLButtonElement => {
      const b = h('button', { type: 'button', class: `hv-chip ${this.show[key] ? 'on' : ''}`, 'aria-pressed': String(this.show[key]), title }, label);
      b.addEventListener('click', () => {
        this.show[key] = !this.show[key];
        b.classList.toggle('on', this.show[key]);
        b.setAttribute('aria-pressed', String(this.show[key]));
        this.applyVisibility();
        if (key === 'allLeads' || key === 'axis') this.buildAxes();
        this.setTime(this.t);
      });
      return b;
    };
    const chips = h(
      'div',
      { class: 'hv-chips', role: 'group', 'aria-label': 'Show' },
      chip('Conduction system', 'system', 'SA node, AV node, His bundle, bundle branches and Purkinje fibres'),
      chip('Heart vector', 'vector', 'The instantaneous heart vector and its loop'),
      chip('Lead axis', 'axis', 'The selected lead’s axis and the projection it records'),
      chip('Labels', 'labels', 'Names of chambers and structures'),
      chip('Beating', 'motion', 'Regional contraction from local activation'),
      chip('Valves', 'valves', 'Valves open and close from the pressure model'),
      chip('Great vessels', 'vessels', 'Aorta, pulmonary artery, venae cavae, pulmonary veins'),
      chip('Coronary arteries', 'coronary', 'LAD, circumflex and right coronary artery (culprit marked in infarction)'),
    );
    return h('div', { class: 'hv-bar' }, h('div', { class: 'hv-row' }, cut, h('label', { class: 'hv-ctl' }, h('span', null, 'Colour'), mode), h('label', { class: 'hv-ctl' }, h('span', null, 'Camera'), view)), chips);
  }

  setMode(m: ColourMode): void {
    this.mode = m;
    this.uniforms.uMode.value = MODES.findIndex(([k]) => k === m);
    this.updateLegend();
    this.requestRender();
  }

  setCut(c: Cut): void {
    this.cut = c;
    this.updateCut();
    if (this.view === 'section') this.setView('section');
    this.applyVisibility();
    this.requestRender();
  }

  setView(v: View): void {
    this.view = v;
    const d = this.camera.position.distanceTo(this.controls.target) || 30;
    let dir: THREE.Vector3;
    let up = new THREE.Vector3(0, 1, 0);
    if (v === 'section') {
      const A = this.A;
      if (A && this.cut !== 'none') {
        const n = this.cutPlane().n;
        dir = this.bodyDirToWorld(n);
        if (this.cut === 'short') up = this.bodyDirToWorld(comb([A.w, 1]));
      } else dir = new THREE.Vector3(0, 0, 1);
    } else {
      const vd = VIEW_DIR[v];
      dir = new THREE.Vector3(vd[0], vd[1], vd[2]);
      if (v === 'inferior') up = new THREE.Vector3(0, 0, 1);
    }
    dir.normalize();
    // Keep "up" perpendicular to the view direction.
    up = up.sub(dir.clone().multiplyScalar(up.dot(dir))).normalize();
    if (up.lengthSq() < 0.1) up = new THREE.Vector3(0, 0, -1);
    this.controls.target.set(0, 0, 0);
    this.camera.position.copy(dir.multiplyScalar(d));
    this.camera.up.copy(up);
    this.camera.lookAt(0, 0, 0);
    this.controls.update();
    this.requestRender();
  }

  setLead(lead: LeadId): void {
    this.lead = lead;
    const ax = LEADS[lead].axis as unknown as V3;
    (this.uniforms.uLeadAx.value as THREE.Vector3).set(ax[0], ax[1], ax[2]).normalize();
    this.buildAxes();
    if (this.mode === 'lead') this.updateLegend();
    this.setTime(this.t);
  }

  // ------------------------------------------------------------------ runs
  setRun(run: EcgRun, hemo?: HemoResult | null): void {
    this.run = run;
    this.hemo = hemo ?? null;
    const token = ++this.runToken;
    this.mirror = run.physio.dextrocardia ? -1 : 1;
    // Distinct activation sequences in this strip (beats with identical entry and timing share a map).
    this.vKeys = run.sig.beats.map((b) => ventKey(run, b));
    this.aKeys = run.sim.atrial.map((a) => (a.kind === 'flutter' ? null : atrialKey(run, a)));
    const key = anatomyKey(run.physio);
    if (key !== this.anatKey) {
      this.loading.style.display = '';
      this.clearMaps();
    }
    const onAnatomy = (r: AnatomyMsg): void => {
      if (this.disposed || token !== this.runToken) return;
      if (r.key !== this.anatKey) this.buildScene(run, r);
      this.zones = r.zones;
      this.applyZones();
      this.buildRunExtras(run);
      this.loading.style.display = 'none';
      this.requestMaps(run, token);
      this.setTime(this.t);
    };
    const w = getWorker();
    if (w) {
      const id = ++reqId;
      pending.set(id, { onAnatomy });
      w.postMessage({ id, type: 'anatomy', run: slimRun(run) });
    } else {
      // Synchronous fallback (no module workers): yield first so the page can paint.
      setTimeout(() => {
        if (token !== this.runToken) return;
        const { result } = computeAnatomy(run.physio);
        onAnatomy({ key: result.key, meta: result.meta, mesh: result.mesh, info: result.info.slice(), depth: result.depth, near: result.near, zones: computeZones(run) });
      }, 30);
    }
    this.setTime(this.t);
  }

  private requestMaps(run: EcgRun, token: number): void {
    const jobs: BeatJob[] = [];
    const seen = new Set<string>();
    const first = (k: string, kind: 'v' | 'a', index: number): void => {
      const id = `${kind}:${k}`;
      if (seen.has(id) || this.maps.has(id)) return;
      seen.add(id);
      jobs.push({ key: k, kind, index });
    };
    // The beat at the current time first, so the view is populated quickly.
    const bi = this.beatAt(this.t);
    if (bi >= 0) first(this.vKeys[bi], 'v', bi);
    this.vKeys.forEach((k, i) => first(k, 'v', i));
    this.aKeys.forEach((k, i) => k && first(k, 'a', i));
    if (!jobs.length) return;
    const onMap = (m: MapResult): void => {
      if (this.disposed || token !== this.runToken) return;
      this.addMap(m);
      this.setTime(this.t);
    };
    const w = getWorker();
    if (w) {
      const id = ++reqId;
      pending.set(id, { onMap });
      w.postMessage({ id, type: 'maps', run: slimRun(run), jobs });
    } else {
      let i = 0;
      const zones = this.zones ?? computeZones(run);
      const step = (): void => {
        if (token !== this.runToken || i >= jobs.length) return;
        onMap(computeMap(run, jobs[i++], zones));
        setTimeout(step, 0);
      };
      step();
    }
  }

  private clearMaps(): void {
    for (const m of this.maps.values()) m.tex.dispose();
    this.maps.clear();
  }

  private addMap(m: MapResult): void {
    const meta = this.meta;
    if (!meta) return;
    const tex = new THREE.Data3DTexture(m.half, meta.nx, meta.ny, meta.nz);
    tex.format = THREE.RGFormat;
    tex.type = THREE.HalfFloatType;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.unpackAlignment = 2;
    tex.needsUpdate = true;
    this.maps.set(`${m.kind}:${m.key}`, { tex, data: m.data, maxAct: m.maxAct });
    // Keep the cache bounded (polymorphic rhythms produce many distinct beats).
    if (this.maps.size > 40) {
      const k = this.maps.keys().next().value!;
      this.maps.get(k)!.tex.dispose();
      this.maps.delete(k);
    }
  }

  // ------------------------------------------------------------------ scene
  private buildScene(run: EcgRun, r: AnatomyMsg): void {
    this.anatKey = r.key;
    this.clearMaps();
    const A = buildAnatomy(run.physio);
    this.A = A;
    this.meta = r.meta;
    this.info = r.info;
    const { nx, ny, nz, h: gh, min } = r.meta;
    this.infoTex?.dispose();
    this.infoTex = new THREE.Data3DTexture(this.info, nx, ny, nz);
    this.infoTex.format = THREE.RGBAFormat;
    this.infoTex.type = THREE.UnsignedByteType;
    this.infoTex.minFilter = THREE.NearestFilter;
    this.infoTex.magFilter = THREE.NearestFilter;
    this.infoTex.unpackAlignment = 1;
    this.infoTex.needsUpdate = true;
    this.emptyTex?.dispose();
    const empty = new Uint16Array(2 * 8).fill(0x7064); // half(9000)… (NEVER)
    this.emptyTex = new THREE.Data3DTexture(empty, 2, 2, 2);
    this.emptyTex.format = THREE.RGFormat;
    this.emptyTex.type = THREE.HalfFloatType;
    this.emptyTex.unpackAlignment = 2;
    this.emptyTex.needsUpdate = true;
    const U = this.uniforms;
    U.uInfo.value = this.infoTex;
    (U.uGmin.value as THREE.Vector3).set(min[0] - gh / 2, min[1] - gh / 2, min[2] - gh / 2);
    (U.uGsize.value as THREE.Vector3).set(nx * gh, ny * gh, nz * gh);
    (U.uB.value as THREE.Vector3).copy(toThree(A.B));
    (U.uAx.value as THREE.Vector3).copy(toThree(A.a));
    (U.uSx.value as THREE.Vector3).copy(toThree(A.s));
    U.uApexU.value = A.apexU;
    (U.uCentre.value as THREE.Vector3).copy(toThree(A.centre));
    const tv = A.valves.find((v) => v.id === 'tricuspid')!;
    (U.uTVc.value as THREE.Vector3).copy(toThree(tv.c));
    (U.uE1.value as THREE.Vector3).copy(toThree(A.s));
    (U.uE2.value as THREE.Vector3).copy(toThree(A.w));
    const raC = comb([A.landmarks.raLabel, 1], [[1, 0, 0], 0.4]);
    const laC = comb([A.landmarks.laLabel, 1], [[-1, 0, 0], 0.4]);
    (U.uRAc.value as THREE.Vector3).copy(toThree(raC));
    (U.uLAc.value as THREE.Vector3).copy(toThree(laC));

    // Myocardium mesh with per-vertex region and wall depth.
    if (this.myo) {
      this.group.remove(this.myo);
      this.myo.geometry.dispose();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(r.mesh.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(r.mesh.normal, 3));
    g.setIndex(new THREE.BufferAttribute(r.mesh.index, 1));
    const nv = r.mesh.pos.length / 3;
    const reg = new Float32Array(nv);
    const dep = new Float32Array(nv);
    for (let i = 0; i < nv; i++) {
      const vi = this.voxelIndex([r.mesh.pos[i * 3], r.mesh.pos[i * 3 + 1], r.mesh.pos[i * 3 + 2]]);
      reg[i] = this.info[vi * 4];
      dep[i] = r.depth[vi];
    }
    g.setAttribute('aRegion', new THREE.BufferAttribute(reg, 1));
    g.setAttribute('aDepth', new THREE.BufferAttribute(dep, 1));
    g.computeBoundingSphere();
    this.myo = new THREE.Mesh(g, this.myoMat);
    this.myo.renderOrder = 1;
    this.group.add(this.myo);

    // Centre the heart on its electrical centre; body (y down) → three (y up); mirror in dextrocardia.
    const c = A.centre;
    const m = new THREE.Matrix4().makeScale(this.mirror, -1, 1).multiply(new THREE.Matrix4().makeTranslation(-c[0], -c[1], -c[2]));
    this.group.matrixAutoUpdate = false;
    this.group.matrix.copy(m);
    this.group.updateMatrixWorld(true);
    (U.uInvGroup.value as THREE.Matrix4).copy(m.clone().invert());

    this.buildStatic(A);
    this.updateCut();
    this.setView(this.view);
  }

  private voxelIndex(p: V3): number {
    const g = this.meta!;
    const i = Math.max(0, Math.min(g.nx - 1, Math.round((p[0] - g.min[0]) / g.h)));
    const j = Math.max(0, Math.min(g.ny - 1, Math.round((p[1] - g.min[1]) / g.h)));
    const k = Math.max(0, Math.min(g.nz - 1, Math.round((p[2] - g.min[2]) / g.h)));
    return i + g.nx * (j + g.ny * k);
  }

  private bodyDirToWorld(v: V3): THREE.Vector3 {
    return new THREE.Vector3(v[0] * this.mirror, -v[1], v[2]).normalize();
  }

  private clearGroup(g: THREE.Group): void {
    for (const o of [...g.children]) {
      g.remove(o);
      o.traverse((x) => {
        const m = x as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((y) => y.dispose());
        else mat?.dispose?.();
        if (x instanceof CSS2DObject) x.element.remove();
      });
    }
  }

  /** Anatomy-dependent objects: vessels, valves, conduction system, labels. */
  private buildStatic(A: Anatomy): void {
    this.clearGroup(this.vessels);
    for (const tr of this.tracts) {
      tr.mesh.parent?.remove(tr.mesh);
      tr.mesh.geometry.dispose();
      tr.mat.dispose();
    }
    this.tracts = [];
    for (const v of this.valves) this.group.remove(v.group);
    this.valves = [];
    for (const l of this.labels) {
      l.obj.parent?.remove(l.obj);
      l.obj.element.remove();
    }
    this.labels = [];
    // Great vessels
    const vesselColor = { artery: '#b84a4a', pa: '#5468b0', vein: '#4d5f9a', pv: '#b85656' };
    for (const v of A.vessels) {
      const curve = new THREE.CatmullRomCurve3(v.pts.map(toThree));
      const mat = new THREE.MeshStandardMaterial({ color: v.id.includes('pulmonary veins') ? vesselColor.pv : vesselColor[v.kind], roughness: 0.55, metalness: 0.0, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, v.r, 24, false), mat);
      mesh.name = v.id;
      this.vessels.add(mesh);
    }
    // Valves
    for (const v of A.valves) this.addValve(v.id, v.bit, v.c, v.n, v.r, v.leaflets);
    // Conduction system
    for (const t of A.tracts) this.addTract(t.id, t.kind, t.pts, t.radius);
    // Labels
    const L = A.landmarks;
    this.addLabel('Right atrium', L.raLabel, 'chamber');
    this.addLabel('Left atrium', L.laLabel, 'chamber');
    this.addLabel('Right ventricle', L.rvLabel, 'chamber');
    this.addLabel('Left ventricle', L.lvLabel, 'chamber');
    this.addLabel('SA node', comb([L.SA, 1], [[-1, 0, 0], 0.5], [[0, -1, 0], 0.4]), 'sys');
    this.addLabel('AV node', comb([L.AVN, 1], [[-1, 0, 0], 0.7]), 'sys');
    this.addLabel('His bundle', comb([L.His, 1], [A.a, 0.3], [A.s, 0.8]), 'sys');
    this.addLabel('Left bundle', comb([L.lbSplit, 1], [A.s, -0.7]), 'sys');
    this.addLabel('Right bundle', comb([L.His, 1], [A.a, 1.9], [A.s, 1.35]), 'sys');
    this.addLabel('Purkinje fibres', comb([L.lvApexEndo, 1], [A.a, -0.2], [A.s, -1.4]), 'sys');
    this.addLabel('Aorta', L.aoLabel, 'vessel');
    this.addLabel('Pulmonary artery', L.paLabel, 'vessel');
    this.addLabel('SVC', L.svcLabel, 'vessel');
  }

  /** Run-dependent objects: dual pathways, accessory pathway, pacing lead, focus, coronary culprit, blocked tracts. */
  private buildRunExtras(run: EcgRun): void {
    const A = this.A;
    if (!A) return;
    this.clearGroup(this.extras);
    this.clearGroup(this.coronaries);
    for (const tr of [...this.tracts]) {
      if (['fast', 'slow', 'ap', 'lead'].includes(tr.id)) {
        tr.mesh.parent?.remove(tr.mesh);
        tr.mesh.geometry.dispose();
        tr.mat.dispose();
        this.tracts.splice(this.tracts.indexOf(tr), 1);
      }
    }
    for (const l of this.labels.filter((x) => x.kind === 'run')) {
      l.obj.parent?.remove(l.obj);
      l.obj.element.remove();
    }
    this.labels = this.labels.filter((x) => x.kind !== 'run');
    const p = run.physio;
    const R = p.rhythm;
    const bundle = p.bundle;
    const rbBlk = bundle.startsWith('rbbb') || bundle === 'incompleteRbbb';
    const lbBlk = bundle === 'lbbb';
    const lafBlk = lbBlk || bundle === 'lafb' || bundle === 'rbbb+lafb';
    const lpfBlk = lbBlk || bundle === 'lpfb' || bundle === 'rbbb+lpfb';
    const avBlk = R.nodalBlock === 'complete' || !R.avnConducts;
    for (const tr of this.tracts) {
      const id = tr.id.replace(/-p\d+$/, '');
      tr.blocked = (id === 'rb' && rbBlk) || (id === 'lb' && lbBlk) || (id === 'laf' && lafBlk) || (id === 'lpf' && lpfBlk) || (id === 'sept' && lbBlk) || (id === 'avn' && avBlk) || (id === 'his' && R.infranodal === 'complete');
    }
    const L = A.landmarks;
    const onRA = (q: V3): V3 => project(A.cavRA, q, 0.1);
    if (R.dualPathway) {
      this.addTract('fast', 'fast', [onRA(comb([L.AVN, 1], [A.a, -1.1], [A.w, 0.5])), onRA(comb([L.AVN, 1], [A.a, -0.5], [A.w, 0.25])), L.AVN], 0.1, '#4ade80');
      this.addTract('slow', 'slow', [onRA(comb([L.AVN, 1], [A.a, -0.1], [A.w, -1.5])), onRA(comb([L.AVN, 1], [A.a, -0.05], [A.w, -0.7])), L.AVN], 0.1, '#60a5fa');
      this.addLabel('fast pathway', comb([L.AVN, 1], [A.a, -1.3], [A.w, 0.8]), 'run');
      this.addLabel('slow pathway', comb([L.AVN, 1], [A.a, 0.1], [A.w, -1.9]), 'run');
    }
    if (R.ap.present) {
      const ins = apInsertion(A, R.ap.location);
      const atr = comb([ins, 1], [A.a, -0.8]);
      this.addTract('ap', 'ap', [atr, comb([ins, 1], [A.a, -0.3]), ins], 0.14, R.ap.antegrade ? '#c084fc' : '#9ca3af');
      this.addLabel(R.ap.antegrade ? 'Accessory pathway' : 'Concealed accessory pathway', comb([ins, 1], [A.a, -0.9], [norm(sub(ins, A.centre)), 0.6]), 'run');
      void AP_SITE;
    }
    if (R.pacer.mode !== 'none') {
      const svc = A.vessels.find((v) => v.id === 'superior vena cava')!.pts;
      const tv = A.valves.find((v) => v.id === 'tricuspid')!.c;
      this.addTract('lead', 'lead', [svc[2], svc[0], comb([tv, 1], [A.a, -0.8]), tv, A.sites.rvApex], 0.08, '#cbd5e1');
      this.addLabel(`Pacing lead (${R.pacer.mode})`, comb([A.sites.rvApex, 1], [A.s, 1.2]), 'run');
    }
    const vm = R.ventMechanism;
    const focusSite = vm !== 'none' && vm !== 'vf' && vm !== 'vflutter' && vm !== 'asystole' ? R.vtSite : R.pvc.pattern !== 'none' ? R.pvc.site : null;
    this.focusMarker = null;
    if (focusSite) {
      const fp = A.sites[focusSite] ?? A.sites.rvApex;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 14), new THREE.MeshBasicMaterial({ color: '#ff3b5c', depthTest: false, transparent: true }));
      m.position.copy(toThree(fp));
      m.renderOrder = 65;
      this.extras.add(m);
      this.focusMarker = m;
      this.addLabel(`Focus: ${VENT_SITE[focusSite].label.replace(/ \(.*\)$/, '')}`, comb([fp, 1], [norm(sub(fp, A.centre)), 1.3]), 'run');
    }
    this.buildCoronaries(A, run);
    this.applyVisibility();
  }

  private addLabel(text: string, at: V3, kind: string): void {
    const el = h('span', { class: `hv-lab ${kind}` }, text);
    const obj = new CSS2DObject(el);
    obj.position.copy(toThree(at));
    this.group.add(obj);
    this.labels.push({ obj, rest: at, kind });
  }

  private addTract(id: string, kind: string, pts: V3[], radius: number, color?: string): void {
    const curve = new THREE.CatmullRomCurve3(pts.map(toThree));
    const n = kind === 'purkinje' ? 10 : 40;
    const geom = new THREE.TubeGeometry(curve, n, radius, kind === 'purkinje' ? 5 : 10, false);
    const base = new THREE.Color(color ?? (kind === 'purkinje' ? '#f3e2b3' : '#fff3cf'));
    const mat = new THREE.ShaderMaterial({
      uniforms: { ...this.uniforms, uColor: { value: base.clone() }, uProg: { value: 0 }, uState: { value: 0 }, uOpacity: { value: 1 } },
      vertexShader: TRACT_VERT,
      fragmentShader: TRACT_FRAG,
      glslVersion: THREE.GLSL3,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.renderOrder = kind === 'purkinje' ? 40 : 45;
    this.group.add(mesh);
    this.tracts.push({ id, kind, mesh, mat, curve, base, blocked: false });
  }

  private addValve(id: string, bit: number, c: V3, n0: V3, radius: number, nLeaf: number): void {
    const n = norm(n0);
    let u = norm(cross(n, [0, 1, 0]));
    if (len(cross(n, [0, 1, 0])) < 0.3) u = norm(cross(n, [1, 0, 0]));
    const v = norm(cross(n, u));
    const group = new THREE.Group();
    group.position.copy(toThree(c));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.07, 10, 40), new THREE.MeshStandardMaterial({ color: '#f1e3c8', roughness: 0.5 }));
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), toThree(n));
    group.add(ring);
    const at = (a: number): THREE.Vector3 => toThree(comb([u, radius * Math.cos(a)], [v, radius * Math.sin(a)]));
    const leaflets: ValveObj['leaflets'] = [];
    for (let k = 0; k < nLeaf; k++) {
      const a0 = (2 * Math.PI * k) / nLeaf;
      const a1 = (2 * Math.PI * (k + 1)) / nLeaf;
      const p0 = at(a0);
      const p1 = at(a1);
      const mid = p0.clone().add(p1).multiplyScalar(0.5);
      const pivot = new THREE.Group();
      pivot.position.copy(mid);
      const steps = 10;
      const arr: number[] = [];
      const tip = new THREE.Vector3().sub(mid).add(toThree(n).multiplyScalar(radius * 0.18));
      for (let s = 0; s < steps; s++) {
        const q0 = at(a0 + ((a1 - a0) * s) / steps).sub(mid);
        const q1 = at(a0 + ((a1 - a0) * (s + 1)) / steps).sub(mid);
        arr.push(q0.x, q0.y, q0.z, q1.x, q1.y, q1.z, tip.x, tip.y, tip.z);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      g.computeVertexNormals();
      const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#f6ead2', roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.88 }));
      pivot.add(mesh);
      group.add(pivot);
      const axis = p1.clone().sub(p0).normalize();
      const test = tip.clone().applyAxisAngle(axis, 0.6);
      const sign = test.clone().sub(tip).dot(toThree(n)) >= 0 ? 1 : -1;
      leaflets.push({ pivot, axis, sign });
    }
    this.group.add(group);
    this.valves.push({ id, bit, group, rest: c, leaflets, ring });
  }

  /** Coronary arteries on the epicardium, with the culprit occlusion in acute or old infarction. */
  private buildCoronaries(A: Anatomy, run: EcgRun): void {
    const onEpi = (q: V3): V3 => project(A.sdfV, q, 0.12);
    const at = (u: number, th: number, r = 3.4): V3 => {
      const t = (th * Math.PI) / 180;
      return comb([A.B, 1], [A.a, u], [A.s, r * Math.cos(t)], [A.w, r * Math.sin(t)]);
    };
    const ao = A.valves.find((v) => v.id === 'aortic')!.c;
    const lm = comb([ao, 1], [A.w, 0.4], [A.s, -0.9], [A.a, 0.1]);
    const lad: V3[] = [lm];
    for (let k = 0; k <= 10; k++) lad.push(onEpi(at(0.4 + (A.apexU - 0.6) * (k / 10), 72 - 10 * (k / 10), 4.2)));
    lad.push(onEpi(at(A.apexU + 0.2, 0, 0.3)));
    const lcx: V3[] = [lm];
    for (let k = 0; k <= 9; k++) lcx.push(onEpi(at(0.35, 110 + (110 * k) / 9, 3.6)));
    const rca: V3[] = [onEpi(comb([ao, 1], [A.s, 1.0], [A.a, 0.2]))];
    for (let k = 0; k <= 9; k++) rca.push(onEpi(at(0.55, 60 - (150 * k) / 9, 5.2)));
    const pda: V3[] = [rca[rca.length - 1]];
    for (let k = 1; k <= 6; k++) pda.push(onEpi(at(0.6 + (A.apexU * 0.65 * k) / 6, -95, 4.0)));
    const isch = run.physio.ischemia;
    const acute = ['hyperacute', 'stemi', 'deWinter', 'wellens'].includes(isch.stage);
    const showCulprit = isch.stage !== 'none' && isch.stage !== 'takotsubo' && isch.stage !== 'subendocardial';
    const CULPRIT: Partial<Record<Territory, { art: string; u: number; label: string }>> = {
      proxLAD: { art: 'LAD', u: 0.12, label: 'proximal LAD occlusion' },
      anteroseptal: { art: 'LAD', u: 0.25, label: 'LAD occlusion (septal branches)' },
      anterior: { art: 'LAD', u: 0.4, label: 'mid-LAD occlusion' },
      anterolateral: { art: 'LAD', u: 0.3, label: 'LAD / diagonal occlusion' },
      wrapLAD: { art: 'LAD', u: 0.4, label: 'occlusion of a “wraparound” LAD' },
      highLateral: { art: 'LCx', u: 0.25, label: 'first diagonal or obtuse marginal occlusion' },
      lateral: { art: 'LCx', u: 0.35, label: 'circumflex occlusion' },
      lcx: { art: 'LCx', u: 0.18, label: 'proximal circumflex occlusion' },
      posterior: { art: 'LCx', u: 0.65, label: 'circumflex / posterolateral occlusion' },
      inferior: { art: 'RCA', u: 0.55, label: 'mid-RCA occlusion' },
      proxRCA: { art: 'RCA', u: 0.12, label: 'proximal RCA occlusion (before the RV branches)' },
      rv: { art: 'RCA', u: 0.12, label: 'proximal RCA occlusion (RV branches)' },
    };
    const cul = showCulprit ? CULPRIT[isch.territory] : undefined;
    const artery = (name: string, pts: V3[], r: number): void => {
      const curve = new THREE.CatmullRomCurve3(pts.map(toThree));
      const tube = (c: THREE.Curve<THREE.Vector3>, col: string, rr: number): void => {
        const m = new THREE.Mesh(new THREE.TubeGeometry(c, 60, rr, 8, false), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, emissive: col, emissiveIntensity: 0.2 }));
        this.coronaries.add(m);
      };
      if (!cul || cul.art !== name) {
        tube(curve, '#e04848', r);
        return;
      }
      const sp = curve.getSpacedPoints(80);
      const k = Math.max(2, Math.round(cul.u * 80));
      tube(new THREE.CatmullRomCurve3(sp.slice(0, k + 1)), '#e04848', r);
      tube(new THREE.CatmullRomCurve3(sp.slice(k)), acute ? '#5a2a2a' : '#7a6a6a', r * 0.85);
      const occ = new THREE.Mesh(new THREE.SphereGeometry(r * 2.6, 14, 10), new THREE.MeshBasicMaterial({ color: acute ? '#ffd54a' : '#bdbdbd', depthTest: false }));
      occ.position.copy(sp[k]);
      occ.renderOrder = 66;
      this.coronaries.add(occ);
      const el = h('span', { class: 'hv-lab culprit' }, `✕ ${cul.label}${acute ? '' : ' (old)'}`);
      const o = new CSS2DObject(el);
      o.position.copy(sp[k]);
      this.coronaries.add(o);
    };
    artery('LAD', lad, 0.12);
    artery('LCx', lcx, 0.11);
    artery('RCA', [...rca, ...pda.slice(1)], 0.12);
  }

  private cutPlane(): { n: V3; d: number } {
    const A = this.A!;
    if (this.cut === 'short') {
      const u0 = A.apexU * 0.42;
      return { n: A.a.map((x) => -x) as V3, d: -(dot(A.B, A.a) + u0) };
    }
    const mv = A.valves.find((v) => v.id === 'mitral')!.c;
    const tv = A.valves.find((v) => v.id === 'tricuspid')!.c;
    let n = norm(cross(A.a, sub(tv, mv)));
    if (n[2] < 0) n = n.map((x) => -x) as V3;
    // The plane through both AV valves and the apex; the anterior half is removed.
    const p0 = lerp(mv, tv, 0.5);
    return { n, d: dot(n, p0) + 0.15 };
  }

  private updateCut(): void {
    const U = this.uniforms;
    if (!this.A || this.cut === 'none') {
      U.uCutOn.value = 0;
      for (const m of this.vesselMaterials()) m.clippingPlanes = [];
      return;
    }
    const { n, d } = this.cutPlane();
    U.uCutOn.value = 1;
    (U.uCut.value as THREE.Vector4).set(n[0], n[1], n[2], d);
    // World-space plane (keeps the side where n·p ≤ d).
    const plane = new THREE.Plane(new THREE.Vector3(n[0], n[1], n[2]), -d).applyMatrix4(this.group.matrix);
    (U.uCutW.value as THREE.Vector4).set(plane.normal.x, plane.normal.y, plane.normal.z, -plane.constant);
    const clip = new THREE.Plane(plane.normal.clone().negate(), -plane.constant);
    for (const m of this.vesselMaterials()) {
      m.clippingPlanes = [clip];
      m.needsUpdate = true;
    }
  }

  private vesselMaterials(): THREE.Material[] {
    const out: THREE.Material[] = [];
    const add = (o: THREE.Object3D): void =>
      o.traverse((x) => {
        const m = (x as THREE.Mesh).material as THREE.Material | undefined;
        if (m && !(m instanceof THREE.ShaderMaterial)) out.push(m);
      });
    add(this.vessels);
    for (const v of this.valves) add(v.group);
    add(this.coronaries);
    return out;
  }

  private applyZones(): void {
    if (!this.info || !this.zones || !this.infoTex) return;
    for (let n = 0; n < this.zones.length; n++) this.info[n * 4 + 1] = this.zones[n];
    this.infoTex.needsUpdate = true;
    const isch = this.run!.physio.ischemia;
    this.uniforms.uIsch.value = isch.stage === 'none' ? 0 : isch.stage === 'aneurysm' ? 3 : isch.stage === 'takotsubo' ? 4 : ['hyperacute', 'stemi', 'deWinter', 'wellens', 'subendocardial', 'evolving'].includes(isch.stage) ? 1 : 2;
  }

  private applyVisibility(): void {
    const cutSide = (q: V3): boolean => {
      if (!this.A || this.cut === 'none') return true;
      const { n, d } = this.cutPlane();
      return dot(n, q) <= d + 0.4;
    };
    for (const tr of this.tracts) tr.mesh.visible = this.show.system || tr.kind === 'ap' || tr.kind === 'lead';
    for (const c of this.comets) c.visible = false;
    for (const v of this.valves) v.group.visible = this.show.valves;
    this.vessels.visible = this.show.vessels;
    this.coronaries.visible = this.show.coronary;
    for (const l of this.labels) {
      const ok = this.show.labels && (l.kind !== 'sys' || this.show.system) && (l.kind !== 'vessel' || this.show.vessels) && (l.kind === 'sys' || l.kind === 'run' || cutSide(l.rest));
      l.obj.visible = ok;
    }
    this.axisGroup.visible = this.show.axis;
    this.uniforms.uMotion.value = this.show.motion ? 1 : 0;
    this.requestRender();
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
      const a = new THREE.Vector3(...(LEADS[id].axis as unknown as [number, number, number]));
      a.set(a.x * this.mirror * this.mirror, -a.y, a.z).normalize();
      const g = new THREE.BufferGeometry().setFromPoints([a.clone().multiplyScalar(-9.5), a.clone().multiplyScalar(9.5)]);
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: strong ? 0x4ade80 : 0x94a3b8, transparent: true, opacity: strong ? 0.95 : 0.4, depthTest: false }));
      line.renderOrder = 57;
      this.axisGroup.add(line);
      const lab = new CSS2DObject(h('span', { class: `hv-lab lead ${strong ? 'strong' : ''}` }, `${id} +`));
      lab.position.copy(a.clone().multiplyScalar(10.2));
      this.axisGroup.add(lab);
    };
    if (this.show.allLeads) for (const id of TWELVE) if (id !== this.lead) add(id, false);
    add(this.lead, true);
    this.axisGroup.visible = this.show.axis;
  }

  // ------------------------------------------------------------------ time
  private beatAt(t: number): number {
    const run = this.run;
    if (!run) return -1;
    const beats = run.sig.beats;
    let bi = -1;
    for (let i = 0; i < beats.length; i++) if (beats[i].ev.t <= t + 0.001) bi = i;
    return bi;
  }

  private atrialAt(t: number): number {
    const at = this.run!.sim.atrial;
    let ai = -1;
    for (let i = 0; i < at.length; i++) if (at[i].kind !== 'flutter' && at[i].t <= t) ai = i;
    return ai;
  }

  private mapFor(kind: 'v' | 'a', key: string | null | undefined): MapEntry | null {
    return key ? (this.maps.get(`${kind}:${key}`) ?? null) : null;
  }

  setTime(t: number): void {
    this.t = t;
    const run = this.run;
    if (!run || !this.A || !this.emptyTex) {
      this.renderHud();
      return;
    }
    const U = this.uniforms;
    U.uT.value = t;
    const beats = run.sig.beats;
    const bi = this.beatAt(t);
    const empty = this.emptyTex;
    const cur = bi >= 0 ? this.mapFor('v', this.vKeys[bi]) : null;
    const prv = bi >= 1 ? this.mapFor('v', this.vKeys[bi - 1]) : null;
    U.uVcur.value = cur?.tex ?? empty;
    U.uVcurT.value = bi >= 0 && cur ? beats[bi].ev.t : -1e6;
    U.uVprev.value = prv?.tex ?? empty;
    U.uVprevT.value = bi >= 1 && prv ? beats[bi - 1].ev.t : -1e6;
    U.uVmax.value = bi >= 0 ? beats[bi].morph.qrsDur : 80;
    const ai = this.atrialAt(t);
    let aj = ai - 1;
    while (aj >= 0 && run.sim.atrial[aj].kind === 'flutter') aj--;
    const acur = ai >= 0 ? this.mapFor('a', this.aKeys[ai]) : null;
    const aprv = aj >= 0 ? this.mapFor('a', this.aKeys[aj]) : null;
    U.uAcur.value = acur?.tex ?? empty;
    U.uAcurT.value = ai >= 0 && acur ? run.sim.atrial[ai].t : -1e6;
    U.uAprev.value = aprv?.tex ?? empty;
    U.uAprevT.value = aj >= 0 && aprv ? run.sim.atrial[aj].t : -1e6;
    U.uAmax.value = acur?.maxAct ?? 100;
    const cont = run.sim.continuous.filter((c) => t >= c.t0 && t <= c.t1);
    const ac = cont.find((c) => c.kind === 'flutter' || c.kind === 'fib');
    const vc = cont.find((c) => c.kind === 'vf' || c.kind === 'vflutter');
    U.uACont.value = ac ? (ac.kind === 'flutter' ? 1 : 2) : 0;
    U.uVCont.value = vc ? 1 : 0;
    if (ac?.kind === 'flutter') {
      U.uFlT0.value = ac.t0;
      U.uFlCL.value = ac.cl ?? 200;
      U.uFlDir.value = ac.reverse ? -1 : 1;
    }
    // Contraction strength of this beat from the haemodynamic model (no ejection → no shortening).
    const hm = this.hemo;
    let amp = 1;
    if (hm) {
      const hb = hm.beats.filter((x) => x.t <= t + 1).pop();
      if (hb) amp = Math.max(0.15, Math.min(1.25, (hb.ejected ? hb.ef : 10) / 58));
      const i = Math.max(0, Math.min(hm.n - 1, Math.round(t - hm.from)));
      U.uLvP.value = Math.min(1, hm.lvP[i] / 110);
    }
    U.uAmpV.value = amp;
    U.uAmpA.value = 1;
    this.updateTracts();
    this.updateValves();
    this.updateOverlay();
    this.renderHud();
    if (this.pick) this.renderInspector();
    this.requestRender();
  }

  /** CPU copy of the vertex-shader deformation, for objects drawn outside the shader (valves, comets). */
  private deformCPU(p: V3): V3 {
    const U = this.uniforms;
    if (!this.show.motion || !this.meta || !this.info) return p;
    const vi = this.voxelIndex(p);
    const region = this.info[vi * 4];
    if (!region) return p;
    const t = this.t;
    const actRep = (atrial: boolean): [number, number] => {
      const cur = atrial ? this.mapFor('a', this.aKeys[this.atrialAt(t)]) : this.mapFor('v', this.vKeys[this.beatAt(t)]);
      const T0 = (atrial ? U.uAcurT.value : U.uVcurT.value) as number;
      const a = cur ? T0 + cur.data[vi * 2] : Infinity;
      if (cur && t >= a) return [a, T0 + cur.data[vi * 2 + 1]];
      return [Infinity, Infinity];
    };
    const contraction = ([a, r]: [number, number]): number => {
      const tau = t - a;
      if (!Number.isFinite(a) || tau < 0) return 0;
      const ss = (e0: number, e1: number, x: number): number => {
        const k = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
        return k * k * (3 - 2 * k);
      };
      const apd = r - a;
      return ss(12, 150, tau) * (1 - ss(apd + 10, apd + 140, tau));
    };
    const A = this.A!;
    if (isAtrial(region)) {
      if ((U.uACont.value as number) > 0.5) return p;
      const c = region === Region.RA ? (U.uRAc.value as THREE.Vector3) : (U.uLAc.value as THREE.Vector3);
      const e = contraction(actRep(true));
      const k = 1 - 0.12 * e;
      return [c.x + (p[0] - c.x) * k, c.y + (p[1] - c.y) * k, c.z + (p[2] - c.z) * k];
    }
    if ((U.uVCont.value as number) > 0.5) return p;
    const e = contraction(actRep(false)) * (U.uAmpV.value as number);
    const u = dot(sub(p, A.B), A.a);
    const axisPt = comb([A.B, 1], [A.a, u]);
    let q: V3;
    if (region >= Region.RVFree) q = comb([p, 1], [A.s, -e * 0.36]);
    else q = comb([axisPt, 1], [sub(p, axisPt), 1 - e * 0.18]);
    return comb([q, 1], [A.a, e * 0.085 * Math.max(0, A.apexU - u)]);
  }

  private updateValves(): void {
    const hm = this.hemo;
    for (const v of this.valves) {
      let target = 0;
      if (hm) {
        const i = Math.max(0, Math.min(hm.n - 1, Math.round(this.t - hm.from)));
        const open = (hm.valves[i] & v.bit) !== 0;
        const q = v.id === 'mitral' ? hm.qMv[i] : v.id === 'tricuspid' ? hm.qTv[i] : v.id === 'aortic' ? hm.qAv[i] : hm.qPv[i];
        const ref = v.id === 'aortic' || v.id === 'pulmonary' ? 250 : 180;
        target = open ? Math.min(1, 0.45 + q / ref) : 0;
      }
      const ang = (v.id === 'aortic' || v.id === 'pulmonary' ? 1.2 : 1.05) * target;
      for (const l of v.leaflets) l.pivot.setRotationFromAxisAngle(l.axis, l.sign * ang);
      (v.ring.material as THREE.MeshStandardMaterial).color.set(target > 0.05 ? '#a7f3d0' : '#f1e3c8');
      const d = this.deformCPU(v.rest);
      v.group.position.set(d[0], d[1], d[2]);
    }
  }

  // ------------------------------------------------------------------ conduction-system animation
  private updateTracts(): void {
    const run = this.run!;
    const t = this.t;
    const R = run.physio.rhythm;
    const hv = R.hv;
    const on = new Map<string, number>();
    const bad = new Set<string>();
    const done = new Set<string>();
    for (const a of run.sim.atrial) {
      if (a.kind === 'flutter') continue;
      const sinus = a.site === 'sinus' || a.site === 'highRA' || a.site === 'crista';
      if (sinus && t >= a.t && t < a.t + 75) for (const id of ['internodal', 'internodal2', 'bachmann']) on.set(id, (t - a.t) / 75);
      else if (sinus && t >= a.t + 75 && t < a.t + 160) for (const id of ['internodal', 'internodal2', 'bachmann']) done.add(id);
    }
    for (const sg of run.sim.ladder) {
      const lo = Math.min(sg.t0, sg.t1);
      const hi = Math.max(sg.t0, sg.t1);
      if (t < lo || t > hi + (sg.blocked ? 160 : 40)) continue;
      const u = sg.dir === 'ante' ? (t - sg.t0) / Math.max(1, sg.t1 - sg.t0) : 1 - (t - sg.t1) / Math.max(1, sg.t0 - sg.t1);
      const id = sg.row === 'AP' ? 'ap' : sg.path.includes('fast') && R.dualPathway ? 'fast' : sg.path.includes('slow') && R.dualPathway ? 'slow' : 'avn';
      if (t > hi) {
        if (sg.blocked) bad.add(id);
        else done.add(id);
        continue;
      }
      const infra = sg.blocked && run.sim.log.some((l) => l.kind === 'block' && l.node === 'HIS' && l.t >= lo - 20 && l.t <= hi + 60);
      if (sg.blocked && infra) on.set(id, 1);
      else on.set(id, Math.max(0, Math.min(1, u)));
      if (id === 'fast' || id === 'slow') on.set('avn', Math.max(0, Math.min(1, u)));
    }
    for (const lg of run.sim.log) if (lg.kind === 'block' && lg.node === 'HIS' && t >= lg.t && t < lg.t + 220) bad.add('his');
    for (const b of run.sim.ventricular) {
      if (b.route !== 'his' && !(Number.isFinite(b.hisDelay) && b.hisDelay < 100)) continue;
      const t0 = b.route === 'his' ? b.t : b.t + b.hisDelay;
      if (t >= t0 - hv && t < t0 - hv * 0.4) on.set('his', (t - (t0 - hv)) / (hv * 0.6));
      if (t >= t0 - hv * 0.5 && t < t0 + 6) for (const id of ['lb', 'laf', 'lpf', 'sept', 'rb']) on.set(id, (t - (t0 - hv * 0.5)) / (hv * 0.5 + 6));
      if (t >= t0 - 4 && t < t0 + 24) for (const tr of this.tracts) if (tr.kind === 'purkinje') on.set(tr.id, (t - (t0 - 4)) / 28);
      if (t >= t0 + 6 && t < t0 + 90) for (const id of ['his', 'lb', 'laf', 'lpf', 'sept', 'rb']) done.add(id);
    }
    for (const s of run.sim.spikes) if (s.chamber === 'V' && t >= s.t && t < s.t + 40) on.set('lead', 1);
    let ci = 0;
    for (const tr of this.tracts) {
      const u = on.get(tr.id);
      const active = u !== undefined && !tr.blocked;
      const U = tr.mat.uniforms;
      const showBlocked = tr.blocked && tr.kind !== 'purkinje';
      U.uState.value = bad.has(tr.id) || showBlocked ? 2 : active ? 1 : done.has(tr.id) ? 3 : 0;
      U.uProg.value = active ? Math.max(0, Math.min(1, u!)) : 0;
      U.uOpacity.value = tr.blocked && tr.kind === 'purkinje' ? 0.35 : 1;
      if (active && tr.kind !== 'purkinje' && tr.id !== 'bachmann' && tr.id !== 'internodal2' && tr.mesh.visible) {
        const c = this.comet(ci++);
        const p = tr.curve.getPointAt(Math.max(0, Math.min(1, u!)));
        const d = this.deformCPU([p.x, p.y, p.z]);
        c.position.set(d[0], d[1], d[2]);
        c.visible = true;
      }
    }
    for (; ci < this.comets.length; ci++) this.comets[ci].visible = false;
    // Ectopic focus pulses when it fires.
    if (this.focusMarker) {
      const fired = run.sim.ventricular.some((v) => (v.route === 'focus' || v.route === 'paced') && t >= v.t - 2 && t < v.t + 40);
      this.focusMarker.scale.setScalar(fired ? 1.8 : 1);
      (this.focusMarker.material as THREE.MeshBasicMaterial).color.set(fired ? '#ffffff' : '#ff3b5c');
    }
  }

  private comet(i: number): THREE.Sprite {
    while (this.comets.length <= i) {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d')!;
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.25, 'rgba(255,245,180,0.95)');
      gr.addColorStop(0.6, 'rgba(255,200,80,0.35)');
      gr.addColorStop(1, 'rgba(255,180,60,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true, blending: THREE.AdditiveBlending }));
      s.scale.set(1.3, 1.3, 1);
      s.renderOrder = 80;
      s.visible = false;
      this.group.add(s);
      this.comets.push(s);
    }
    return this.comets[i];
  }

  private updateOverlay(): void {
    const run = this.run;
    if (!run) return;
    const sig = run.sig;
    const i = Math.max(0, Math.min(sig.n - 1, Math.round(((this.t - sig.from) * sig.fs) / 1000)));
    const S = 4.6;
    const v = new THREE.Vector3(sig.vcg[0][i], -sig.vcg[1][i], sig.vcg[2][i]);
    const mag = v.length();
    this.arrow.visible = this.show.vector && mag > 0.015;
    if (this.arrow.visible) {
      const Lh = Math.max(1.2, mag * S);
      const shaftL = Math.max(0.1, Lh - 0.9);
      this.arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize());
      this.shaft.scale.set(1, shaftL, 1);
      this.shaft.position.set(0, shaftL / 2, 0);
      const halo = this.arrow.getObjectByName('halo')!;
      halo.scale.set(1, shaftL, 1);
      halo.position.set(0, shaftL / 2, 0);
      this.head.position.set(0, shaftL + 0.45, 0);
    }
    const from = Math.max(0, i - 400);
    let start = from;
    for (let k = i; k > from; k--) {
      if (Math.hypot(sig.vcg[0][k], sig.vcg[1][k], sig.vcg[2][k]) < 0.012) {
        start = k;
        break;
      }
    }
    const pts: THREE.Vector3[] = [];
    for (let k = start; k <= i; k += 2) pts.push(new THREE.Vector3(sig.vcg[0][k] * S, -sig.vcg[1][k] * S, sig.vcg[2][k] * S));
    this.loop.geometry.dispose();
    this.loop.geometry = new THREE.BufferGeometry().setFromPoints(pts.length > 1 ? pts : [new THREE.Vector3(), new THREE.Vector3()]);
    this.loop.visible = this.show.vector;
    const axv = LEADS[this.lead].axis as unknown as V3;
    const ax = new THREE.Vector3(axv[0], -axv[1], axv[2]).normalize();
    const pr = v.dot(ax);
    const ln = Math.abs(pr) * S;
    this.proj.visible = this.show.axis && ln > 0.05;
    if (this.proj.visible) {
      this.proj.scale.set(1, ln, 1);
      this.proj.position.copy(ax.clone().multiplyScalar((pr * S) / 2));
      this.proj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ax.clone().multiplyScalar(Math.sign(pr) || 1));
      (this.proj.material as THREE.MeshBasicMaterial).color.set(pr >= 0 ? '#22c55e' : '#f43f5e');
    }
    const val = sig.leads[this.lead]?.[i] ?? 0;
    this.projLabel.visible = this.show.axis;
    this.projLabel.position.copy(ax.clone().multiplyScalar(pr * S + Math.sign(pr || 1) * 1.2));
    this.projLabel.element.textContent = `${this.lead}: ${val >= 0 ? '+' : ''}${val.toFixed(2)} mV`;
    this.projLabel.element.className = `hv-lab proj ${val >= 0 ? 'pos' : 'neg'}`;
  }

  // ------------------------------------------------------------------ HUD, legend, inspector
  private renderHud(): void {
    const run = this.run;
    if (!run) {
      this.hud.replaceChildren();
      return;
    }
    const t = this.t;
    const items: [string, string][] = [];
    const bi = this.beatAt(t);
    const b = bi >= 0 ? run.sig.beats[bi] : null;
    const cont = run.sim.continuous.filter((c) => t >= c.t0 && t <= c.t1);
    const ac = run.sim.atrial.filter((a) => a.kind !== 'flutter' && a.t <= t).pop();
    if (cont.some((c) => c.kind === 'vf' || c.kind === 'vflutter')) items.push(['vf', 'Ventricles fibrillating — no organised activation']);
    else if (b && t - b.ev.t < b.morph.qrsDur) items.push(['depol', `Ventricles depolarising · ${Math.round(t - b.ev.t)} of ${Math.round(b.morph.qrsDur)} ms`]);
    else if (b && t - b.ev.t < b.morph.tStart) items.push(['plateau', 'Ventricles depolarised (plateau)']);
    else if (b && t - b.ev.t < b.morph.tEnd + 20) items.push(['repol', 'Ventricles repolarising']);
    if (cont.some((c) => c.kind === 'fib')) items.push(['af', 'Atria fibrillating']);
    else if (cont.some((c) => c.kind === 'flutter')) items.push(['af', 'Atrial flutter circuit']);
    else if (ac && t - ac.t < 110) items.push(['adepol', `Atria depolarising${ac.kind === 'retro' ? ' (retrograde)' : ac.kind === 'ectopic' ? ' (ectopic focus)' : ''}`]);
    if (!items.length) items.push(['rest', 'Electrical diastole — tissue resting']);
    const key = items.map((x) => x.join(':')).join('|');
    if (key !== this.hudKey) {
      this.hudKey = key;
      this.hudTime = h('span', { class: 'hv-time' });
      this.hud.replaceChildren(...items.map(([cls, txt]) => h('span', { class: `hv-pill ${cls}` }, txt)), this.hudTime);
    }
    if (this.hudTime) this.hudTime.textContent = `${Math.round(t)} ms`;
  }

  private updateLegend(): void {
    const sw = (c: string, text: string): HTMLElement => h('span', { class: 'hv-leg' }, h('i', { style: `background:${c}` }), text);
    const m = this.mode;
    let items: HTMLElement[];
    if (m === 'voltage') items = [h('span', { class: 'hv-leg' }, h('i', { class: 'grad volt' }), '−90 mV resting → +30 mV upstroke')];
    else if (m === 'isochrone') items = [h('span', { class: 'hv-leg' }, h('i', { class: 'grad iso' }), 'reached first (red) → last (blue); lines every 10 ms')];
    else if (m === 'refractory') items = [sw('#cc2933', 'absolutely refractory'), sw('#ffc22e', 'relatively refractory (vulnerable)'), sw('#26a899', 'excitable')];
    else if (m === 'coronary') items = [sw('#4085f5', 'LAD'), sw('#1ab8a3', 'circumflex'), sw('#fa9e1c', 'right coronary (right-dominant)')];
    else if (m === 'lead') items = [sw('#1abf8c', `facing ${this.lead}`), sw('#e6408c', `facing away (mirror image in ${this.lead})`)];
    else items = [sw('#b36e6e', 'resting'), sw('#fffacc', 'wavefront'), sw('#ff9e21', 'depolarised'), sw('#52d1f5', 'repolarising'), sw('#5c5c63', 'scar')];
    this.legend.replaceChildren(...items);
  }

  private setupPicking(): void {
    const el = this.labelRenderer.domElement;
    let down: { x: number; y: number } | null = null;
    el.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    el.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 || !this.myo) return;
      down = null;
      const r = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, this.camera);
      const inv = (this.uniforms.uInvGroup.value as THREE.Matrix4).clone();
      // With a cut, the first visible point may be on the cut face itself.
      let hitRest: V3 | null = null;
      const hits = ray.intersectObject(this.myo, false);
      for (const hit of hits) {
        const q = hit.point.clone().applyMatrix4(inv);
        const rest: V3 = [q.x, q.y, q.z];
        if ((this.uniforms.uCutOn.value as number) > 0.5) {
          const c = this.uniforms.uCut.value as THREE.Vector4;
          if (c.x * rest[0] + c.y * rest[1] + c.z * rest[2] > c.w) continue;
          const front = hit.face ? hit.face.normal.clone().transformDirection(this.myo.matrixWorld).dot(ray.ray.direction) < 0 : true;
          if (!front) {
            const cw = this.uniforms.uCutW.value as THREE.Vector4;
            const n = new THREE.Vector3(cw.x, cw.y, cw.z);
            const tt = (cw.w - n.dot(ray.ray.origin)) / n.dot(ray.ray.direction);
            const pw = ray.ray.origin.clone().add(ray.ray.direction.clone().multiplyScalar(tt)).applyMatrix4(inv);
            hitRest = [pw.x, pw.y, pw.z];
            break;
          }
        }
        hitRest = rest;
        break;
      }
      if (!hitRest) return;
      this.pick = hitRest;
      this.renderInspector();
      this.requestRender();
    });
  }

  private renderInspector(): void {
    const pk = this.pick;
    if (!pk || !this.run || !this.A || !this.info || !this.meta) {
      this.pickMarker.visible = false;
      this.inspector.classList.remove('on');
      return;
    }
    if (!this.pickMarker.parent) this.group.add(this.pickMarker);
    const d = this.deformCPU(pk);
    this.pickMarker.position.set(d[0], d[1], d[2]);
    this.pickMarker.visible = true;
    const A = this.A;
    const vi = this.voxelIndex(pk);
    const region = this.info[vi * 4];
    const zone = this.info[vi * 4 + 1];
    const cor = this.info[vi * 4 + 2];
    const seg = this.info[vi * 4 + 3];
    const t = this.t;
    const outward = norm(sub(pk, A.centre));
    const facing = (Object.keys(LEADS) as LeadId[]).filter((id) => dot(norm(LEADS[id].axis as unknown as V3), outward) > 0.55);
    const mirror = (Object.keys(LEADS) as LeadId[]).filter((id) => dot(norm(LEADS[id].axis as unknown as V3), outward) < -0.6);
    const atrial = isAtrial(region);
    let name = REGION_NAME[region] || 'blood pool';
    if ((region === Region.LVFree || region === Region.Septum) && seg) name = `LV ${SEG_NAMES[seg]} (AHA segment ${seg})`;
    const info: [string, string][] = [];
    if (!atrial && cor) info.push(['Blood supply', `${CORONARY_NAME[cor]}${cor === 3 ? ' (in a right-dominant circulation; supply varies)' : ''}`]);
    info.push(['Leads facing it', facing.length ? facing.join(', ') : 'none directly']);
    if (mirror.length) info.push(['Seen in mirror image by', mirror.join(', ')]);
    let vt: { act: number; rep: number } | null = null;
    if (zone === 2) info.push(['State', 'Scar: no action potential and no contraction — electrically silent, so leads facing it record Q waves']);
    else {
      const kind = atrial ? 'a' : 'v';
      const run = this.run;
      const idxNow = atrial ? this.atrialAt(t) : this.beatAt(t);
      const keys = atrial ? this.aKeys : this.vKeys;
      const T0 = atrial ? (idxNow >= 0 ? run.sim.atrial[idxNow].t : 0) : idxNow >= 0 ? run.sig.beats[idxNow].ev.t : 0;
      const mp = idxNow >= 0 ? this.mapFor(kind, keys[idxNow]) : null;
      if (mp && mp.data[vi * 2] < NEVER) {
        vt = { act: T0 + mp.data[vi * 2], rep: T0 + mp.data[vi * 2 + 1] };
        info.push(['This beat', `activated ${Math.round(mp.data[vi * 2])} ms after ${atrial ? 'the start of the P wave' : 'QRS onset'} · repolarised at ${Math.round(mp.data[vi * 2 + 1])} ms · action potential ${Math.round(vt.rep - vt.act)} ms`]);
      }
    }
    this.inspector.classList.add('on');
    this.inspector.replaceChildren(
      h('div', { class: 'hv-insp-head' }, h('h4', null, name), h('button', { type: 'button', class: 'hv-x', 'aria-label': 'Close', onclick: () => ((this.pick = null), this.renderInspector(), this.requestRender()) }, '×')),
      h('dl', null, ...info.map(([k, v]) => h('div', null, h('dt', null, k), h('dd', null, v)))),
      ...(vt ? [this.apCanvas, h('p', { class: 'hv-note' }, 'Action potential of this spot in the current beat (orange line = now). Epicardial cells have shorter action potentials than endocardial cells, so the epicardium repolarises first — which is why the T wave points the same way as the QRS.')] : []),
    );
    if (vt) this.drawAp(vt, atrial ? 2 : 0);
    void atrialApd;
  }

  private drawAp(vt: { act: number; rep: number }, kind: number): void {
    const cv = this.apCanvas;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const W = cv.width;
    const H = cv.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0e1622';
    ctx.fillRect(0, 0, W, H);
    ctx.font = '11px system-ui, sans-serif';
    const apd = vt.rep - vt.act;
    const t0 = vt.act - 40;
    const t1 = vt.act + apd + 120;
    const X = (tt: number): number => 34 + ((tt - t0) / (t1 - t0)) * (W - 42);
    const Y = (mv: number): number => H - 18 - ((mv + 95) / 130) * (H - 28);
    ctx.strokeStyle = '#26323f';
    ctx.fillStyle = '#93a3b5';
    for (const mv of [-80, -40, 0]) {
      ctx.beginPath();
      ctx.moveTo(32, Y(mv));
      ctx.lineTo(W - 6, Y(mv));
      ctx.stroke();
      ctx.fillText(`${mv}`, 4, Y(mv) + 4);
    }
    const apV = (dt: number): number => {
      const rest = kind === 2 ? -80 : -86;
      if (dt < 0 || dt > apd + 400) return rest;
      const peak = kind === 2 ? 22 : 30;
      const plateau = kind === 2 ? -5 : 15;
      const notch = kind === 2 ? 0 : 10;
      const p3 = Math.max(40, (kind === 2 ? 0.55 : 0.3) * apd);
      if (dt < 1.5) return rest + ((peak - rest) * dt) / 1.5;
      if (dt < 12) return peak + ((notch - peak) * (dt - 1.5)) / 10.5;
      const p3s = apd - p3;
      if (dt < p3s) {
        const u = (dt - 12) / Math.max(1, p3s - 12);
        return notch + (plateau - notch) * Math.min(1, u * 3) - 12 * u * u;
      }
      if (dt < apd) {
        const u = (dt - p3s) / p3;
        const top = plateau - 12;
        return top - (top - rest) * (0.5 - 0.5 * Math.cos(Math.PI * u));
      }
      return rest;
    };
    ctx.strokeStyle = '#7cc4ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let tt = t0; tt <= t1; tt++) {
      const y = Y(apV(tt - vt.act));
      if (tt === t0) ctx.moveTo(X(tt), y);
      else ctx.lineTo(X(tt), y);
    }
    ctx.stroke();
    ctx.fillStyle = '#e6edf5';
    const ph = (tt: number, s: string): void => ctx.fillText(s, X(tt) - 3, Y(apV(tt - vt.act)) - 7);
    ph(vt.act + 0.8, '0');
    ph(vt.act + 8, '1');
    ph(vt.act + apd * 0.45, '2');
    ph(vt.act + apd * 0.9, '3');
    ph(vt.act + apd + 60, '4');
    if (this.t >= t0 && this.t <= t1) {
      ctx.strokeStyle = '#ff9f1c';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(X(this.t), 4);
      ctx.lineTo(X(this.t), H - 16);
      ctx.stroke();
    }
    ctx.fillStyle = '#93a3b5';
    ctx.fillText('mV', 4, 12);
    ctx.fillText(`phase numbers · APD ${Math.round(apd)} ms`, X(vt.act + apd / 2) - 60, H - 3);
  }

  // ------------------------------------------------------------------ render loop
  private resize(): void {
    const w = this.host.clientWidth || 300;
    const hh = this.host.clientHeight || 300;
    this.renderer.setSize(w, hh, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${hh}px`;
    this.labelRenderer.setSize(w, hh);
    this.camera.aspect = w / hh;
    // Fit the heart: narrower canvases need a wider field of view.
    this.camera.fov = w / hh < 1 ? 30 / Math.max(0.55, w / hh) : 30;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  requestRender(): void {
    if (this.pendingRender || this.disposed) return;
    this.pendingRender = true;
    this.raf = requestAnimationFrame(() => {
      this.pendingRender = false;
      if (this.disposed) return;
      const moving = this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.labelRenderer.render(this.scene, this.camera);
      this.declutter();
      this.drawGizmo();
      if (moving) this.requestRender();
    });
  }

  /** Hide lower-priority labels that collide with higher-priority ones on screen. */
  private declutter(): void {
    const rank: Record<string, number> = { chamber: 0, run: 1, culprit: 1, sys: 2, vessel: 3 };
    const items = this.labels
      .filter((l) => l.obj.visible)
      .map((l) => ({ el: l.obj.element, r: rank[l.kind] ?? 2 }))
      .sort((a, b) => a.r - b.r);
    const placed: DOMRect[] = [];
    for (const it of items) {
      it.el.style.visibility = '';
      const b = it.el.getBoundingClientRect();
      if (!b.width) continue;
      const hit = placed.some((p) => b.left < p.right + 2 && b.right > p.left - 2 && b.top < p.bottom + 1 && b.bottom > p.top - 1);
      if (hit) it.el.style.visibility = 'hidden';
      else placed.push(b);
    }
  }

  private drawGizmo(): void {
    const q = this.camera.quaternion.clone().invert();
    const axes: [string, THREE.Vector3, string][] = [
      [this.mirror < 0 ? 'R' : 'L', new THREE.Vector3(1, 0, 0), '#f87171'],
      ['Sup', new THREE.Vector3(0, 1, 0), '#4ade80'],
      ['Ant', new THREE.Vector3(0, 0, 1), '#60a5fa'],
    ];
    const g = this.gizmo;
    while (g.firstChild) g.removeChild(g.firstChild);
    for (const [lab, v, col] of axes) {
      const p = v.clone().applyQuaternion(q);
      const x = p.x * 24;
      const y = -p.y * 24;
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      ln.setAttribute('x1', '0');
      ln.setAttribute('y1', '0');
      ln.setAttribute('x2', String(x));
      ln.setAttribute('y2', String(y));
      ln.setAttribute('stroke', col);
      ln.setAttribute('stroke-width', '3');
      ln.setAttribute('stroke-linecap', 'round');
      ln.setAttribute('opacity', p.z < -0.2 ? '0.35' : '1');
      const tx = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tx.setAttribute('x', String(x * 1.32));
      tx.setAttribute('y', String(y * 1.32 + 4));
      tx.setAttribute('text-anchor', 'middle');
      tx.setAttribute('font-size', '11');
      tx.setAttribute('font-weight', '600');
      tx.setAttribute('fill', col);
      tx.textContent = lab;
      g.append(ln, tx);
    }
  }

  destroy(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.clearMaps();
    this.infoTex?.dispose();
    this.emptyTex?.dispose();
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
}
