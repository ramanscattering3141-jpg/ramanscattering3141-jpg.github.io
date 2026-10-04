// Event-driven conduction simulator.
//
// The heart is modelled as a small graph of excitable elements, each with its own
// conduction time and refractory period:
//
//   SA node ─► ATRIA ─► (upper common pathway) ─┬─ FAST pathway ─┬─ (lower common pathway) ─► HIS ─► VENTRICLES
//                 ▲                              └─ SLOW pathway ─┘                                     │
//                 └──────────── ACCESSORY PATHWAY (optional) ◄──────────────────────────────────────────┘
//
// Automatic foci (sinus node, ectopic atrial focus, AV junction, ventricular escape,
// VT circuit, pacemaker) fire into the graph. An impulse arriving at an element that is
// still refractory is blocked (optionally with concealed penetration); otherwise it
// conducts after a delay that can depend on how recovered the tissue is (decremental
// conduction in the AV node). Wavefronts travelling in opposite directions in the same
// pathway collide and extinguish. Re-entry (AVNRT, AVRT), Wenckebach periodicity, AV
// dissociation, capture/fusion beats, Ashman aberrancy, compensatory pauses and the
// response to adenosine are NOT scripted: they emerge from these rules.

import type { ApLocation, AtrialSite, InterventionKind, Physio, RhythmParams, VentSite } from './params';
import { effectiveSinusRate } from './params';
import { apErpAdd, avnModifiers, hvAdd, qtAtRR, qtcEffective } from './derived';
import { gauss, mulberry32, type Rng } from './random';
import { clamp } from './vec';

export type AtrialKind = 'sinus' | 'ectopic' | 'retro' | 'flutter' | 'paced';
export interface AtrialEvent {
  t: number;
  kind: AtrialKind;
  site: AtrialSite;
  label: string;
  conducted: boolean;
  via?: 'fast' | 'slow' | 'ap';
}

export type VRoute = 'his' | 'ap' | 'focus' | 'paced';
export interface VentEvent {
  t: number;
  route: VRoute;
  aberrant: 'none' | 'rbbb';
  /** ms from first ventricular activation (via AP, focus or pacing) until the His–Purkinje impulse arrived; Infinity if it never did. */
  hisDelay: number;
  site?: VentSite;
  apLocation?: ApLocation;
  label: string;
  /** Index into atrial events of the P wave that produced this QRS (for PR measurement); −1 if none. */
  atrialIndex: number;
  /** Beat index within a polymorphic run (torsades twisting). */
  polyIndex: number;
  junctional: boolean;
  mechanism: string;
}

export interface Spike {
  t: number;
  chamber: 'A' | 'V' | 'shock';
  captured: boolean;
}

export type LadderPath = 'avn' | 'fast' | 'slow' | 'ap' | 'retro-fast' | 'retro-slow' | 'retro-ap' | 'retro-avn';
export interface LadderSeg {
  row: 'AV' | 'AP';
  t0: number;
  t1: number;
  dir: 'ante' | 'retro';
  path: LadderPath;
  blocked: boolean;
}

export type NodeId = 'SA' | 'A' | 'FP' | 'SP' | 'AVN' | 'HIS' | 'V' | 'AP' | 'JX' | 'SHOCK' | 'PM';
export interface NodeLog {
  t: number;
  node: NodeId;
  kind: 'activate' | 'block' | 'fire';
  note?: string;
}

export interface Continuous {
  kind: 'flutter' | 'fib' | 'vf' | 'vflutter';
  t0: number;
  t1: number;
  cl?: number;
  reverse?: boolean;
}

export interface SimResult {
  duration: number;
  atrial: AtrialEvent[];
  ventricular: VentEvent[];
  spikes: Spike[];
  ladder: LadderSeg[];
  log: NodeLog[];
  continuous: Continuous[];
  interventions: { t: number; kind: InterventionKind }[];
}

// ---------------------------------------------------------------------------
// Geometry-derived conduction times
// ---------------------------------------------------------------------------

/** Intra-atrial conduction time (ms) from an atrial origin to the AV-node input. */
export function atriaToNode(site: AtrialSite): number {
  switch (site) {
    case 'sinus':
    case 'highRA':
    case 'crista':
      return 38;
    case 'lowRA':
      return 14;
    case 'leftAtrial':
      return 55;
    case 'lowLA':
      return 35;
    default:
      return 20;
  }
}

/** Atrial conduction time from an origin to the atrial insertion of the accessory pathway. */
function atriaToAP(site: AtrialSite, loc: ApLocation): number {
  const left = loc === 'leftLateral' || loc === 'leftPosterior';
  const fromLeft = site === 'leftAtrial' || site === 'lowLA' || site === 'retroLeftLateral';
  if (left) return fromLeft ? 15 : 72;
  if (loc === 'rightFreeWall') return fromLeft ? 65 : site === 'retroRightFree' ? 10 : 35;
  return fromLeft ? 45 : 30; // septal pathways
}

/** Time (ms) for a ventricular wavefront to reach the pathway's ventricular insertion. */
function ventToAP(loc: ApLocation, route: VRoute): number {
  if (route !== 'his') return 60;
  switch (loc) {
    case 'leftLateral':
      return 75;
    case 'leftPosterior':
      return 65;
    case 'rightFreeWall':
      return 60;
    default:
      return 45;
  }
}

export function apRetroSite(loc: ApLocation): AtrialSite {
  switch (loc) {
    case 'leftLateral':
    case 'leftPosterior':
      return 'retroLeftLateral';
    case 'rightFreeWall':
      return 'retroRightFree';
    case 'posteroseptal':
      return 'retroPosteroseptal';
    default:
      return 'retroSeptal';
  }
}

// ---------------------------------------------------------------------------
// Event queue (binary heap, stable for equal times)
// ---------------------------------------------------------------------------

interface QEvent {
  t: number;
  seq: number;
  fn: () => void;
}
const less = (a: QEvent, b: QEvent): boolean => (a.t === b.t ? a.seq < b.seq : a.t < b.t);

class Queue {
  private h: QEvent[] = [];
  private seq = 0;
  push(t: number, fn: () => void): void {
    const h = this.h;
    h.push({ t, seq: this.seq++, fn });
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (less(h[p], h[i])) break;
      [h[p], h[i]] = [h[i], h[p]];
      i = p;
    }
  }
  pop(): QEvent | undefined {
    const h = this.h;
    if (!h.length) return undefined;
    const top = h[0];
    const last = h.pop()!;
    if (h.length) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < h.length && less(h[l], h[m])) m = l;
        if (r < h.length && less(h[r], h[m])) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]];
        i = m;
      }
    }
    return top;
  }
  get size(): number {
    return this.h.length;
  }
}

// ---------------------------------------------------------------------------
// Intervention time courses (compressed so they fit a 10–20 s strip)
// ---------------------------------------------------------------------------

function bump(t: number, onset: number, peak: number, end: number): number {
  if (t <= onset || t >= end) return 0;
  if (t <= peak) {
    const u = (t - onset) / (peak - onset);
    return u * u * (3 - 2 * u);
  }
  const u = (t - peak) / (end - peak);
  return 1 - u * u * (3 - 2 * u);
}

export interface Effects {
  avnErp: number; // ms added to AV-nodal refractoriness
  avnAh: number; // ms added to nodal conduction time
  saScale: number; // multiplier on sinus cycle length
  junctionScale: number;
  adenosineLevel: number;
}

export function effectsAt(t: number, list: { t: number; kind: InterventionKind; gain?: number }[]): Effects {
  const e: Effects = { avnErp: 0, avnAh: 0, saScale: 1, junctionScale: 1, adenosineLevel: 0 };
  for (const iv of list) {
    const dt = t - iv.t;
    if (dt < 0) continue;
    const g = iv.gain ?? 1;
    switch (iv.kind) {
      case 'adenosine': {
        // A1 receptor → IK,Ado (IK,ACh) activation → hyperpolarised, less excitable AV-nodal and sinus cells.
        const a = bump(dt, 1200, 2600, 8000);
        e.avnErp += 4000 * a;
        e.avnAh += 250 * a;
        e.saScale *= 1 + 1.4 * a;
        e.adenosineLevel = Math.max(e.adenosineLevel, a);
        break;
      }
      case 'vagal': {
        const a = bump(dt, 300, 1300, 5000) * g;
        e.avnErp += 260 * a;
        e.avnAh += 70 * a;
        e.saScale *= 1 + 0.45 * a;
        break;
      }
      case 'avnBlocker': {
        const a = clamp((dt - 800) / 3000, 0, 1);
        e.avnErp += 170 * a;
        e.avnAh += 60 * a;
        e.saScale *= 1 + 0.12 * a;
        break;
      }
      case 'atropine': {
        // Vagolytic: speeds the sinus node and AV node; no effect on diseased His–Purkinje tissue.
        const a = clamp((dt - 1500) / 3000, 0, 1);
        e.avnErp -= 110 * a;
        e.avnAh -= 20 * a;
        e.saScale *= 1 - 0.38 * a;
        e.junctionScale *= 1 - 0.2 * a;
        break;
      }
      default:
        break;
    }
  }
  return e;
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

export interface SimOptions {
  duration: number; // ms shown
  warmup?: number; // ms simulated before t = 0 (not displayed, establishes steady state)
}

type HisSrc = { k: 'ante'; aIdx: number; t0: number; via: 'fast' | 'slow' | 'avn' } | { k: 'jx' } | { k: 'retro' };
type VSrc =
  | { k: 'his'; aIdx: number; junctional: boolean; aberrant: VentEvent['aberrant'] }
  | { k: 'ap'; aIdx: number }
  | { k: 'focus'; site: VentSite; label: string; mech: string; poly: number }
  | { k: 'paceV' };
type ASrc = { k: 'sa' } | { k: 'ectA'; site: AtrialSite; label: string } | { k: 'flutter' } | { k: 'fib' } | { k: 'paceA' } | { k: 'ucp'; via: 'fast' | 'slow' | 'avn' } | { k: 'ap' };

interface Path {
  lastEntry: number;
  lastExit: number;
  busy: number;
  dir: 'ante' | 'retro';
  tok: number;
}
const newPath = (): Path => ({ lastEntry: -1e9, lastExit: -1e9, busy: -1e9, dir: 'ante', tok: 0 });

export function simulate(p: Physio, opts: SimOptions): SimResult {
  const R: RhythmParams = p.rhythm;
  const rng: Rng = mulberry32(R.seed * 7919 + 13);
  const warm = opts.warmup ?? 4000;
  const T0 = -warm;
  const T1 = opts.duration + 400;
  const q = new Queue();

  const ivs = R.interventions.map((i) => ({ ...i, gain: i.kind === 'vagal' ? 0.45 + 0.9 * rng() : 1 }));
  const res: SimResult = { duration: opts.duration, atrial: [], ventricular: [], spikes: [], ladder: [], log: [], continuous: [], interventions: R.interventions.slice() };
  const log = (t: number, node: NodeId, kind: NodeLog['kind'], note?: string): void => {
    if (t >= -1500 && t <= T1) res.log.push({ t, node, kind, note });
  };
  const ladder = (s: LadderSeg): void => {
    if (s.t1 >= -1500 || s.t0 >= -1500) res.ladder.push(s);
  };

  const shocks = R.interventions.filter((i) => i.kind === 'shock').map((i) => i.t).sort((a, b) => a - b);
  const firstShock = shocks.length ? shocks[0] : Infinity;
  const avnMods = avnModifiers(p);
  const qtc = qtcEffective(p);
  const hv = R.hv + hvAdd(p);
  const apErp = R.ap.erp + apErpAdd(p);
  const vm = R.ventMechanism;

  // Mechanism windows (a shock converts re-entrant/fibrillatory rhythms to sinus).
  const atrialContinuousUntil = R.atrialMechanism === 'flutter' || R.atrialMechanism === 'fibrillation' ? firstShock : -Infinity;
  const vtStart = R.vtStart;
  const vtEnd = Math.min(R.vtDuration > 0 ? R.vtStart + R.vtDuration : Infinity, firstShock);
  const ventContinuous = vm === 'vf' || vm === 'vflutter';

  if (R.atrialMechanism === 'flutter' && atrialContinuousUntil > T0) res.continuous.push({ kind: 'flutter', t0: T0, t1: Math.min(T1, atrialContinuousUntil), cl: R.flutterCL, reverse: R.flutterReverse });
  if (R.atrialMechanism === 'fibrillation' && atrialContinuousUntil > T0) res.continuous.push({ kind: 'fib', t0: T0, t1: Math.min(T1, atrialContinuousUntil) });
  if (ventContinuous) res.continuous.push({ kind: vm === 'vf' ? 'vf' : 'vflutter', t0: Math.max(T0, vtStart), t1: Math.min(T1, vtEnd) });

  // ---------------- State ----------------
  const A = { last: -1e9, refr: -1e9, site: 'sinus' as AtrialSite };
  const FP = newPath();
  const SP = newPath();
  const AP = newPath();
  const HIS = { last: -1e9, prevCycle: 800, lastRB: -1e9, rbCycle: 800, anteCount: 0, highCount: 0 };
  const V = { last: -1e9, refr: -1e9, cur: null as VentEvent | null };
  let conductedSinceEctopy = 0;
  let polyIdx = 0;
  let vtTerminated = false;
  const tokens = { sa: 0, jx: 0, ve: 0, pmA: 0, pmV: 0 };
  let saCount = 0;
  let lastVForPacer = -1e9;
  let pacerAwaitV = false;

  const inAtrialContinuous = (t: number): boolean => t < atrialContinuousUntil;
  const inVentContinuous = (t: number): boolean => ventContinuous && t >= vtStart && t < vtEnd;
  const ventStandstill = vm === 'asystole';
  const dual = R.dualPathway;
  const nodalBlocked = !R.avnConducts || R.nodalBlock === 'complete';

  // ---------------- Atria ----------------
  function atriaArrive(t: number, src: ASrc): void {
    if (inAtrialContinuous(t) && src.k !== 'flutter' && src.k !== 'fib') {
      log(t, 'A', 'block', 'atria already fibrillating / fluttering');
      return;
    }
    if (src.k === 'fib') {
      // A fibrillatory wavefront reaches the AV-node input and (if present) the accessory pathway.
      nodeInput(t + 5 + rng() * 10, -1);
      if (R.ap.present) apArrive(t + 5 + rng() * 15, 'ante', -1);
      return;
    }
    // Local refractoriness near the entry point (retrograde entry via an accessory pathway
    // meets atrial tissue that was activated later than the atrial origin).
    const localRefr = src.k === 'ap' ? A.last + atriaToAP(A.site, R.ap.location) + R.atrialERP : A.refr;
    if (t < localRefr) {
      log(t, 'A', 'block', 'atrial myocardium refractory');
      return;
    }
    let site: AtrialSite = 'sinus';
    let kind: AtrialKind = 'sinus';
    let label = 'sinus P';
    let via: AtrialEvent['via'];
    switch (src.k) {
      case 'ectA':
        site = src.site;
        kind = 'ectopic';
        label = src.label;
        break;
      case 'flutter':
        site = 'lowRA';
        kind = 'flutter';
        label = 'flutter wave';
        break;
      case 'paceA':
        site = 'highRA';
        kind = 'paced';
        label = 'atrial-paced P';
        break;
      case 'ucp':
        site = 'retroSeptal';
        kind = 'retro';
        label = 'retrograde P (via AV node)';
        via = src.via === 'slow' ? 'slow' : 'fast';
        break;
      case 'ap':
        site = apRetroSite(R.ap.location);
        kind = 'retro';
        label = 'retrograde P (via accessory pathway)';
        via = 'ap';
        break;
      default:
        break;
    }
    A.last = t;
    A.site = site;
    A.refr = t + (src.k === 'flutter' ? R.flutterCL * 0.8 : R.atrialERP);
    const idx = res.atrial.length;
    res.atrial.push({ t, kind, site, label, conducted: false, via });
    log(t, 'A', 'activate', label);
    onAtrialSensed(t, src.k === 'paceA');

    const cv = src.k === 'flutter' ? 1 : 1 / clamp(p.atrialCV, 0.3, 2);
    if (src.k !== 'ucp') nodeInput(t + atriaToNode(site) * cv, idx);
    if (src.k !== 'ap' && R.ap.present) apArrive(t + atriaToAP(site, R.ap.location) * cv, 'ante', idx);
    // Any non-sinus atrial activation invades and resets the sinus node.
    if (src.k !== 'sa' && src.k !== 'flutter') resetSA(t + 45);
    if (kind === 'sinus') maybeScheduleAtrialEctopy(t);
  }

  function nodeInput(t: number, aIdx: number): void {
    pathArrive('fp', t, 'ante', aIdx, t);
    if (dual) pathArrive('sp', t, 'ante', aIdx, t);
  }

  // ---------------- AV-nodal pathways ----------------
  function pathArrive(which: 'fp' | 'sp', t: number, dir: 'ante' | 'retro', aIdx: number, t0: number): void {
    q.push(t, () => pathArriveNow(which, t, dir, aIdx, t0));
  }

  function pathArriveNow(which: 'fp' | 'sp', t: number, dir: 'ante' | 'retro', aIdx: number, t0: number): void {
    const P = which === 'fp' ? FP : SP;
    const eff = effectsAt(t, ivs);
    const base = which === 'fp' ? (dual ? R.fastAH : R.avnAHmin) : R.slowAH;
    const erp0 = which === 'fp' ? (dual ? R.fastERP : R.avnERP) : R.slowERP;
    const dec = which === 'fp' ? (dual ? 60 : R.avnDecrement) : 90;
    let erp = Math.max(60, erp0 + avnMods.erpAdd + eff.avnErp);
    if (dir === 'retro') erp *= 0.62;
    const node: NodeId = dual ? (which === 'fp' ? 'FP' : 'SP') : 'AVN';
    const pathName: LadderPath = dual ? (which === 'fp' ? 'fast' : 'slow') : 'avn';
    if (nodalBlocked) {
      log(t, node, 'block', 'AV node not conducting (complete nodal block)');
      if (dir === 'ante' && which === 'fp' && aIdx >= 0) ladder({ row: 'AV', t0, t1: t + 40, dir, path: 'avn', blocked: true });
      return;
    }
    // Collision: a wavefront entering against one already travelling in the pathway extinguishes both.
    if (t < P.busy) {
      if (P.dir !== dir) {
        P.tok++;
        P.busy = t;
        P.lastEntry = t;
        P.lastExit = t;
        log(t, node, 'block', 'collision of antegrade and retrograde wavefronts');
      } else log(t, node, 'block', 'pathway still conducting');
      return;
    }
    // Dual-pathway refractoriness is timed from the previous activation (classic A1–A2 testing);
    // single-node refractoriness from the previous exit (the RP dependence that creates Wenckebach).
    const ref = dual ? P.lastEntry : P.lastExit;
    const recovery = t - ref;
    if (recovery < erp) {
      // Concealed conduction: a late-arriving blocked impulse partly penetrates and re-sets refractoriness.
      if (R.concealed && dir === 'ante' && recovery > erp * 0.55) {
        if (dual) P.lastEntry = Math.max(P.lastEntry, t - erp * 0.45);
        else P.lastExit = Math.max(P.lastExit, t - erp * 0.45);
      }
      log(t, node, 'block', dir === 'ante' ? 'antegrade block (refractory)' : 'retrograde block (refractory)');
      if (dir === 'ante' && aIdx >= 0 && (which === 'fp' || !dual)) ladder({ row: 'AV', t0, t1: t + 30, dir, path: pathName, blocked: true });
      return;
    }
    let delay: number;
    if (dir === 'ante') delay = (base + dec * Math.exp(-(recovery - erp) / R.avnTau)) * avnMods.ahScale + eff.avnAh;
    else delay = (which === 'fp' ? R.retroFastTime : R.slowAH * 0.85) + 0.4 * dec * Math.exp(-(recovery - erp) / R.avnTau);
    delay = Math.max(20, delay);
    const tok = ++P.tok;
    P.dir = dir;
    P.busy = t + delay;
    P.lastEntry = t;
    P.lastExit = t + delay;
    log(t, node, 'activate', `${dir === 'ante' ? 'antegrade' : 'retrograde'} conduction, ${Math.round(delay)} ms`);
    q.push(t + delay, () => {
      if (tok !== P.tok) return; // extinguished by collision
      const via: 'fast' | 'slow' | 'avn' = dual ? (which === 'fp' ? 'fast' : 'slow') : 'avn';
      if (dir === 'ante') lcpArrive(t + delay, aIdx, t0, via);
      else ucpRetro(t + delay, which, t, via);
    });
  }

  // Retrograde exit at the top of a pathway: activates the atria and can turn around into the other pathway.
  function ucpRetro(t: number, from: 'fp' | 'sp', tEntry: number, via: 'fast' | 'slow' | 'avn'): void {
    ladder({ row: 'AV', t0: t, t1: tEntry, dir: 'retro', path: dual ? (from === 'fp' ? 'retro-fast' : 'retro-slow') : 'retro-avn', blocked: false });
    q.push(t + 12, () => atriaArrive(t + 12, { k: 'ucp', via }));
    if (dual) pathArrive(from === 'fp' ? 'sp' : 'fp', t + 4, 'ante', -1, t + 4);
  }

  // Lower common pathway → His bundle, and retrograde into the other nodal pathway.
  function lcpArrive(t: number, aIdx: number, t0: number, via: 'fast' | 'slow' | 'avn'): void {
    hisArrive(t, { k: 'ante', aIdx, t0, via });
    if (dual) pathArrive(via === 'slow' ? 'fp' : 'sp', t + 3, 'retro', -1, t + 3);
  }

  // ---------------- His bundle ----------------
  function hisArrive(t: number, src: HisSrc): void {
    const hisErp = clamp(120 + 0.2 * HIS.prevCycle, 180, 400);
    const pathName: LadderPath = src.k === 'ante' ? (src.via === 'avn' ? 'avn' : src.via) : 'avn';
    if (t - HIS.last < hisErp) {
      log(t, 'HIS', 'block', 'His bundle refractory');
      if (src.k === 'ante' && src.aIdx >= 0) ladder({ row: 'AV', t0: src.t0, t1: t, dir: 'ante', path: pathName, blocked: true });
      return;
    }
    let blockedBelow = R.infranodal === 'complete';
    if (src.k === 'ante' && !blockedBelow) {
      if (R.highGrade >= 2) {
        HIS.highCount++;
        if (HIS.highCount % R.highGrade !== 0) blockedBelow = true;
      } else if (R.infranodal === 'mobitz2') {
        HIS.anteCount++;
        if (HIS.anteCount % Math.max(2, R.infranodalRatio) === 0) blockedBelow = true;
      }
    }
    HIS.prevCycle = clamp(t - HIS.last, 250, 2500);
    HIS.last = t;
    resetJunction(t);
    log(t, 'HIS', 'activate', src.k === 'jx' ? 'junctional focus' : src.k === 'retro' ? 'retrograde' : 'antegrade');
    if (src.k === 'ante' && src.aIdx >= 0) {
      ladder({ row: 'AV', t0: src.t0, t1: t + (blockedBelow ? 15 : hv), dir: 'ante', path: pathName, blocked: blockedBelow });
      if (!blockedBelow) {
        const a = res.atrial[src.aIdx];
        a.conducted = true;
        if (dual) a.via = src.via === 'slow' ? 'slow' : 'fast';
      }
    }
    if (src.k === 'retro' || src.k === 'jx') {
      // Retrograde into the node → atria (retrograde P waves).
      pathArrive('fp', t + 5, 'retro', -1, t + 5);
      if (dual) pathArrive('sp', t + 5, 'retro', -1, t + 5);
      if (src.k === 'retro') return;
    }
    if (blockedBelow) {
      log(t + 10, 'HIS', 'block', 'infra-Hisian block');
      return;
    }
    // Right-bundle refractoriness depends on the preceding cycle: long–short sequences produce
    // functional RBBB aberrancy (Ashman phenomenon).
    const rbErp = Math.min(520, R.rbERPbase + 0.45 * HIS.rbCycle);
    const aberrant: VentEvent['aberrant'] = t - HIS.lastRB < rbErp ? 'rbbb' : 'none';
    HIS.rbCycle = clamp(t - HIS.lastRB, 250, 2500);
    HIS.lastRB = t;
    const aIdx = src.k === 'ante' ? src.aIdx : -1;
    const junctional = src.k === 'jx';
    q.push(t + hv, () => ventArrive(t + hv, { k: 'his', aIdx, junctional, aberrant }));
  }

  // ---------------- Accessory pathway ----------------
  function apArrive(t: number, dir: 'ante' | 'retro', aIdx: number): void {
    if (!R.ap.present) return;
    q.push(t, () => {
      const P = AP;
      if (t < P.busy) {
        if (P.dir !== dir) {
          P.tok++;
          P.busy = t;
          P.lastExit = t;
          log(t, 'AP', 'block', 'collision in accessory pathway');
        }
        return;
      }
      const refractory = t - P.lastExit < apErp;
      const capable = dir === 'ante' ? R.ap.antegrade : R.ap.retrograde;
      if (refractory) {
        log(t, 'AP', 'block', `${dir} block in accessory pathway (refractory)`);
        if (dir === 'ante' && aIdx >= 0 && R.ap.antegrade) ladder({ row: 'AP', t0: t - 10, t1: t + 12, dir, path: 'ap', blocked: true });
        return;
      }
      if (!capable) {
        // Concealed pathway: the wavefront penetrates but cannot exit — it still leaves the pathway refractory.
        P.lastExit = t;
        log(t, 'AP', 'block', dir === 'ante' ? 'concealed antegrade penetration (no antegrade conduction)' : 'no retrograde conduction');
        return;
      }
      const d = R.ap.time;
      const tok = ++P.tok;
      P.dir = dir;
      P.busy = t + d;
      P.lastExit = t + d;
      log(t, 'AP', 'activate', dir === 'ante' ? 'antegrade (pre-excitation)' : 'retrograde');
      ladder({ row: 'AP', t0: dir === 'ante' ? t : t + d, t1: dir === 'ante' ? t + d : t, dir, path: dir === 'ante' ? 'ap' : 'retro-ap', blocked: false });
      q.push(t + d, () => {
        if (tok !== P.tok) return;
        if (dir === 'ante') {
          if (aIdx >= 0) res.atrial[aIdx].conducted = true;
          ventArrive(t + d, { k: 'ap', aIdx });
        } else atriaArrive(t + d, { k: 'ap' });
      });
    });
  }

  // ---------------- Ventricles ----------------
  function ventArrive(t: number, src: VSrc): void {
    if (ventStandstill) {
      log(t, 'V', 'block', 'ventricular standstill');
      return;
    }
    if (inVentContinuous(t)) {
      log(t, 'V', 'block', 'ventricles fibrillating');
      return;
    }
    const route: VRoute = src.k === 'his' ? 'his' : src.k === 'ap' ? 'ap' : src.k === 'paceV' ? 'paced' : 'focus';
    const cur = V.cur;
    // Fusion: a second wavefront arriving while the first is still activating the ventricles.
    if (cur && t >= cur.t) {
      const dt = t - cur.t;
      const window = cur.route === 'ap' ? 200 : cur.route === 'his' ? 25 : 70;
      if (dt < window && route !== cur.route) {
        if (route === 'his' && cur.route !== 'his') {
          cur.hisDelay = Math.min(cur.hisDelay, dt);
          if (src.k === 'his' && cur.atrialIndex < 0) cur.atrialIndex = src.aIdx;
          if (cur.route === 'paced') cur.label = 'fusion (paced + intrinsic)';
          else if (cur.route === 'focus') cur.label = 'fusion beat';
        }
        log(t, 'V', 'block', 'fused with ongoing activation');
        return;
      }
    }
    if (t < V.refr) {
      log(t, 'V', 'block', 'ventricular myocardium refractory');
      return;
    }
    const rr = clamp(t - V.last, 200, 4000);
    V.last = t;
    // Refractoriness follows action-potential restitution: at very short cycle lengths (fast VT,
    // torsades) the APD shortens to well below the resting QT, so it cannot exceed ~80% of the
    // cycle that produced this beat.
    // Within a sustained ventricular tachycardia the tissue is driven at the VT cycle, so that is
    // the cycle its action potentials adapt to (even for the first beat after a long pause).
    const sustainedVT = src.k === 'focus' && ['VT', 'torsades de pointes', 'polymorphic VT', 'bidirectional VT'].includes(src.mech);
    const cycle = sustainedVT ? Math.min(rr, 60000 / R.vtRate) : rr;
    V.refr = t + Math.max(160, Math.min(0.72 * qtAtRR(qtc, rr) * (route === "his" ? 1 : 1.05), 0.8 * cycle));
    let ev: VentEvent;
    if (src.k === 'his') {
      ev = {
        t,
        route,
        aberrant: src.aberrant,
        hisDelay: 0,
        label: src.junctional ? 'junctional QRS' : src.aberrant !== 'none' ? 'aberrantly conducted QRS (functional RBBB)' : 'conducted QRS',
        atrialIndex: src.aIdx,
        polyIndex: 0,
        junctional: src.junctional,
        mechanism: src.junctional ? 'junction' : 'conducted',
      };
    } else if (src.k === 'ap') {
      ev = { t, route, aberrant: 'none', hisDelay: Infinity, apLocation: R.ap.location, label: 'pre-excited QRS', atrialIndex: src.aIdx, polyIndex: 0, junctional: false, mechanism: 'ap' };
    } else if (src.k === 'focus') {
      ev = { t, route, aberrant: 'none', hisDelay: Infinity, site: src.site, label: src.label, atrialIndex: -1, polyIndex: src.poly, junctional: false, mechanism: src.mech };
    } else {
      ev = { t, route: 'paced', aberrant: 'none', hisDelay: Infinity, site: 'rvApex', label: 'ventricular-paced QRS', atrialIndex: -1, polyIndex: 0, junctional: false, mechanism: 'paced' };
    }
    V.cur = ev;
    res.ventricular.push(ev);
    log(t, 'V', 'activate', ev.label);
    resetVentEscape(t);
    onVentSensed(t, route);

    if (route === 'focus' || route === 'paced') {
      if (R.pvc.retrograde) hisArriveLater(t + R.vaDelay * 0.6);
      else {
        // Concealed retrograde penetration of the His–Purkinje system/AV node: the wavefront
        // reaches the node ~VA ms after the ectopic beat and leaves it refractory. A sinus P wave
        // falling within the ectopic beat's ST–T is therefore blocked (fully compensatory pause);
        // one arriving after it conducts, with a longer PR (interpolated PVC at slow sinus rates).
        FP.lastExit = Math.max(FP.lastExit, t + R.vaDelay + 160);
        if (dual) {
          FP.lastEntry = Math.max(FP.lastEntry, t + R.vaDelay);
          SP.lastEntry = Math.max(SP.lastEntry, t + R.vaDelay);
        }
        HIS.last = Math.max(HIS.last, t + 60);
        resetJunction(t + 40);
      }
    }
    if (route === 'ap' && R.avnConducts) hisArriveLater(t + R.vaDelay);
    if (R.ap.present && route !== 'ap') apArrive(t + ventToAP(R.ap.location, route), 'retro', -1);
    if (route === 'his' || route === 'ap') {
      conductedSinceEctopy++;
      maybeSchedulePVC(t);
    }
  }
  function hisArriveLater(t: number): void {
    q.push(t, () => hisArrive(t, { k: 'retro' }));
  }

  // ---------------- Automatic foci ----------------
  function sinusCL(t: number): number {
    const eff = effectsAt(t, ivs);
    const base = 60000 / effectiveSinusRate(p);
    const resp = 1 + R.sinusArrhythmia * Math.sin((2 * Math.PI * t) / 4200);
    return base * resp * eff.saScale * (1 + 0.012 * gauss(rng));
  }
  function scheduleSA(at: number): void {
    const tok = ++tokens.sa;
    q.push(at, () => {
      if (tok === tokens.sa) fireSA(at);
    });
  }
  function resetSA(t: number): void {
    if (R.sinusEnabled) scheduleSA(t + sinusCL(t));
  }
  function fireSA(t: number): void {
    if (!R.sinusEnabled) return;
    if (inAtrialContinuous(t)) {
      scheduleSA(atrialContinuousUntil + 900);
      return;
    }
    for (const s of shocks) {
      if (t >= s && t - s < 700) {
        scheduleSA(s + 700 + rng() * 150);
        return;
      }
    }
    const pause = R.sinusPause;
    if (pause && t >= pause.at && t < pause.at + pause.duration) {
      log(t, 'SA', 'block', 'sinus arrest (no discharge)');
      scheduleSA(pause.at + pause.duration);
      return;
    }
    saCount++;
    log(t, 'SA', 'fire');
    scheduleSA(t + sinusCL(t));
    if (R.saExitBlockEvery >= 2 && saCount % R.saExitBlockEvery === 0) {
      log(t, 'SA', 'block', 'sinoatrial exit block (discharge fails to reach atria)');
      return;
    }
    atriaArrive(t + 1, { k: 'sa' });
  }

  function junctionCL(t: number): number {
    const eff = effectsAt(t, ivs);
    return (60000 / R.junctionalRate) * (1 - 0.25 * p.autonomic) * eff.junctionScale * (1 + 0.01 * gauss(rng));
  }
  function resetJunction(t: number): void {
    if (!R.junctionalEnabled) return;
    const tok = ++tokens.jx;
    const at = t + junctionCL(t);
    q.push(at, () => {
      if (tok !== tokens.jx) return;
      log(at, 'JX', 'fire', R.junctionalAccelerated ? 'accelerated junctional focus' : 'junctional escape focus');
      hisArrive(at, { k: 'jx' });
      if (tok === tokens.jx) resetJunction(at);
    });
  }

  const aivr = vm === 'aivr';
  function resetVentEscape(t: number): void {
    const aivrActive = aivr && t >= vtStart - 2000 && t < vtEnd;
    if (!R.ventEscapeEnabled && !aivrActive) return;
    const tok = ++tokens.ve;
    const rate = aivrActive ? R.vtRate : R.ventEscapeRate;
    const at = t + (60000 / rate) * (1 + 0.012 * gauss(rng));
    q.push(at, () => {
      if (tok !== tokens.ve) return;
      const site = aivrActive ? R.vtSite : R.ventEscapeSite;
      log(at, 'V', 'fire', aivrActive ? 'accelerated idioventricular focus' : 'ventricular escape focus');
      ventArrive(at, { k: 'focus', site, label: aivrActive ? 'idioventricular beat' : 'ventricular escape', mech: aivrActive ? 'AIVR' : 'escape', poly: 0 });
      if (tok === tokens.ve) resetVentEscape(at);
    });
  }

  // ---------------- Ectopy ----------------
  let sinusPCount = 0;
  let triggerDone = false;
  function maybeScheduleAtrialEctopy(tP: number): void {
    sinusPCount++;
    if (R.triggerPAC && !triggerDone && tP >= R.triggerPAC.at) {
      triggerDone = true;
      const tr = R.triggerPAC;
      const at = tP + tr.coupling;
      q.push(at, () => atriaArrive(at, { k: 'ectA', site: tr.site, label: 'premature atrial complex (trigger)' }));
      return;
    }
    const pac = R.pac;
    if (pac.pattern === 'none' || tP < -1000) return;
    let fire = false;
    switch (pac.pattern) {
      case 'bigeminy':
        fire = true;
        break;
      case 'trigeminy':
        fire = sinusPCount % 2 === 0;
        break;
      case 'single':
        fire = sinusPCount % Math.max(3, pac.every) === 0;
        break;
      case 'random':
        fire = rng() < 0.18;
        break;
      case 'couplet':
      case 'run':
        fire = sinusPCount % 6 === 0;
        break;
      default:
        break;
    }
    if (!fire) return;
    const c = pac.coupling * (1 + 0.03 * gauss(rng));
    const n = pac.pattern === 'couplet' ? 2 : pac.pattern === 'run' ? 4 : 1;
    for (let i = 0; i < n; i++) {
      const at = tP + c + i * c * 0.8;
      q.push(at, () => atriaArrive(at, { k: 'ectA', site: pac.site, label: 'premature atrial complex' }));
    }
  }

  let pvcToggle = 0;
  function maybeSchedulePVC(tV: number): void {
    const pvc = R.pvc;
    if (pvc.pattern === 'none' || tV < -1500) return;
    let fire = false;
    let n = 1;
    switch (pvc.pattern) {
      case 'bigeminy':
        fire = true;
        break;
      case 'trigeminy':
        fire = conductedSinceEctopy >= 2;
        break;
      case 'single':
        fire = conductedSinceEctopy >= 5;
        break;
      case 'couplet':
        fire = conductedSinceEctopy >= 4;
        n = 2;
        break;
      case 'run':
        fire = conductedSinceEctopy >= 5;
        n = 5;
        break;
      case 'random':
        fire = rng() < 0.2;
        break;
      default:
        break;
    }
    if (!fire) return;
    conductedSinceEctopy = 0;
    const c = pvc.coupling * (1 + 0.02 * gauss(rng));
    for (let i = 0; i < n; i++) {
      const at = tV + c + i * c * 0.8;
      const site: VentSite = pvc.multifocal ? (pvcToggle++ % 2 === 0 ? pvc.site : pvc.site === 'lvLateral' ? 'rvot' : 'lvLateral') : pvc.site;
      q.push(at, () => ventArrive(at, { k: 'focus', site, label: n >= 3 ? 'NSVT beat' : 'premature ventricular complex', mech: 'pvc', poly: 0 }));
    }
  }

  // ---------------- Pacemaker ----------------
  const pm = R.pacer;
  const pmInterval = 60000 / Math.max(30, pm.lowerRate);
  const failSense = pm.fault === 'failSense';
  function pacerSpike(t: number, chamber: 'A' | 'V'): void {
    let captured = pm.fault !== 'failCapture' || rng() < 0.3;
    // A stimulus falling in refractory tissue cannot capture, whatever its output.
    if (chamber === 'V' && (t < V.refr || inVentContinuous(t))) captured = false;
    if (chamber === 'A' && t < A.refr) captured = false;
    res.spikes.push({ t, chamber, captured });
    log(t, 'PM', 'fire', `${chamber === 'A' ? 'atrial' : 'ventricular'} pacing stimulus${captured ? '' : ' — no capture'}`);
    if (!captured) return;
    if (chamber === 'A') atriaArrive(t + 2, { k: 'paceA' });
    else ventArrive(t + 2, { k: 'paceV' });
  }
  const oversensing = (t: number): boolean => pm.fault === 'oversense' && Math.sin(t / 1300) > 0.35;
  function scheduleAPace(from: number): void {
    const tok = ++tokens.pmA;
    const at = from + pmInterval;
    q.push(at, () => {
      if (tok !== tokens.pmA) return;
      if (oversensing(at)) {
        log(at, 'PM', 'block', 'output inhibited — oversensing');
        scheduleAPace(at);
        return;
      }
      pacerSpike(at, 'A');
      if (pm.mode === 'DDD') armVPace(at);
      scheduleAPace(at);
    });
  }
  function armVPace(tA: number): void {
    const tok = ++tokens.pmV;
    pacerAwaitV = true;
    const at = tA + pm.avDelay;
    q.push(at, () => {
      if (tok !== tokens.pmV) return;
      pacerAwaitV = false;
      if (oversensing(at)) return;
      pacerSpike(at, 'V');
    });
  }
  function scheduleVPace(from: number): void {
    const tok = ++tokens.pmV;
    const at = from + pmInterval;
    q.push(at, () => {
      if (tok !== tokens.pmV) return;
      if (oversensing(at)) {
        log(at, 'PM', 'block', 'output inhibited — oversensing');
        scheduleVPace(at);
        return;
      }
      pacerSpike(at, 'V');
      scheduleVPace(at);
    });
  }
  function onAtrialSensed(t: number, paced: boolean): void {
    if (paced || failSense) return;
    if (pm.mode === 'AAI' || pm.mode === 'DDD') scheduleAPace(t);
    if (pm.mode === 'DDD' && t - lastVForPacer > 250) armVPace(t);
  }
  function onVentSensed(t: number, route: VRoute): void {
    lastVForPacer = t;
    if (failSense) return;
    if (pm.mode === 'VVI') scheduleVPace(t);
    if (pm.mode === 'DDD' && route !== 'paced' && pacerAwaitV) {
      tokens.pmV++;
      pacerAwaitV = false;
    }
  }

  // ---------------- Kick-off ----------------
  if (R.sinusEnabled && R.atrialMechanism !== 'none') scheduleSA(T0 + rng() * 600);
  resetJunction(T0 + 200);
  resetVentEscape(T0 + 400);

  if (R.atrialMechanism === 'focalAT') {
    const cl = 60000 / R.focalATRate;
    for (let t = T0 + 300; t < T1; t += cl * (1 + 0.015 * gauss(rng))) {
      const tt = t;
      q.push(tt, () => atriaArrive(tt, { k: 'ectA', site: R.focalATSite, label: 'ectopic atrial P' }));
    }
  }
  if (R.atrialMechanism === 'mat') {
    const sites: AtrialSite[] = ['sinus', 'lowRA', 'leftAtrial', 'crista', 'lowLA'];
    const base = 60000 / R.matRate;
    for (let t = T0 + 300; t < T1; t += base * (0.72 + 0.56 * rng())) {
      const tt = t;
      const site = sites[Math.floor(rng() * sites.length)];
      q.push(tt, () => atriaArrive(tt, { k: 'ectA', site, label: 'multifocal atrial P' }));
    }
  }
  if (R.atrialMechanism === 'flutter') {
    for (let t = T0 + 100; t < Math.min(T1, atrialContinuousUntil); t += R.flutterCL) {
      const tt = t;
      q.push(tt, () => atriaArrive(tt, { k: 'flutter' }));
    }
  }
  if (R.atrialMechanism === 'fibrillation') {
    for (let t = T0 + 50; t < Math.min(T1, atrialContinuousUntil); t += Math.max(95, R.afMeanCL + 45 * gauss(rng))) {
      const tt = t;
      q.push(tt, () => atriaArrive(tt, { k: 'fib' }));
    }
  }

  // Sustained ventricular re-entry / triggered activity.
  if (vm === 'monoVT' || vm === 'polyVT' || vm === 'torsades' || vm === 'bidirectional') {
    const cl = 60000 / R.vtRate;
    let i = 0;
    for (let t = Math.max(T0 + 500, vtStart); t < Math.min(T1, vtEnd); i++) {
      const tt = t;
      const idx = i;
      q.push(tt, () => {
        if (R.vtAdenosineSensitive && effectsAt(tt, ivs).adenosineLevel > 0.5) vtTerminated = true;
        if (vtTerminated) return;
        const mech = vm === 'monoVT' ? 'VT' : vm === 'bidirectional' ? 'bidirectional VT' : vm === 'torsades' ? 'torsades de pointes' : 'polymorphic VT';
        const site: VentSite = vm === 'bidirectional' ? (idx % 2 === 0 ? 'fascicularPosterior' : 'fascicularAnterior') : R.vtSite;
        ventArrive(tt, { k: 'focus', site, label: mech, mech, poly: polyIdx++ });
      });
      const jitter = vm === 'monoVT' || vm === 'bidirectional' ? 0.008 : 0.1;
      t += cl * (1 + jitter * gauss(rng));
    }
  }

  if (pm.mode === 'AAI' || pm.mode === 'DDD') scheduleAPace(T0 + 200);
  if (pm.mode === 'VVI') scheduleVPace(T0 + 300);
  if (pm.mode === 'VOO' || pm.mode === 'DOO') {
    for (let t = T0 + 250; t < T1; t += pmInterval) {
      const tt = t;
      q.push(tt, () => {
        if (pm.mode === 'DOO') {
          pacerSpike(tt, 'A');
          q.push(tt + pm.avDelay, () => pacerSpike(tt + pm.avDelay, 'V'));
        } else pacerSpike(tt, 'V');
      });
    }
  }

  // A shock depolarises all excitable tissue simultaneously, extinguishing every re-entrant wavefront.
  for (const s of shocks) {
    q.push(s, () => {
      res.spikes.push({ t: s, chamber: 'shock', captured: true });
      log(s, 'SHOCK', 'fire', 'shock depolarises all excitable tissue');
      for (const P of [FP, SP, AP]) {
        P.tok++;
        P.busy = s;
        P.lastEntry = s + 100;
        P.lastExit = s + 100;
      }
      A.refr = s + 250;
      V.refr = s + 300;
      V.last = s;
      HIS.last = s;
      resetJunction(s + 300);
      resetVentEscape(s + 300);
      if (R.sinusEnabled) scheduleSA(s + 700 + rng() * 150);
    });
  }

  // ---------------- Run ----------------
  let guard = 0;
  while (q.size && guard++ < 300000) {
    const e = q.pop()!;
    if (e.t > T1) break;
    e.fn();
  }

  // Atrial events are kept unfiltered because ventricular events reference them by index.
  res.ventricular = res.ventricular.filter((v) => v.t >= -2500);
  return res;
}

/** Ventricular events inside [0, duration). */
export const visibleV = (s: SimResult): VentEvent[] => s.ventricular.filter((v) => v.t >= 0 && v.t < s.duration);
export const visibleA = (s: SimResult): AtrialEvent[] => s.atrial.filter((a) => a.t >= 0 && a.t < s.duration);
