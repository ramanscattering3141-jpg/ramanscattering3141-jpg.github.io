// Ground-truth measurements derived from the model (not from signal processing), used for
// the interval read-outs, challenge-mode answer keys and "before → after" comparisons.
//
// Conventions (as a careful reader would measure a 10-s strip):
//  - Ventricular rate: mean of all R–R intervals (every QRS counts, ectopic or not). When the strip
//    contains an abrupt, sustained change of rhythm (e.g. a PAC initiating AVNRT), the rate, atrial
//    rate and AV relation describe the sustained rhythm that dominates the strip.
//  - PR: P-wave onset → QRS onset of conducted (antegrade) beats; not reported when P waves cannot
//    be identified (flutter, fibrillation, P waves abolished by hyperkalaemia).
//  - QRS duration and axis: a representative beat of the dominant rhythm — premature ectopic beats
//    and aberrantly conducted beats are not the "dominant" morphology.
//  - QT: a representative supraventricular/paced beat with a typical preceding R–R (never the beat
//    after a premature cycle); QTc Bazett = QT/√RR and Fridericia = QT/∛RR with RR in seconds.

import { axisOf } from './morphology';
import type { Physio } from './params';
import type { SimResult, VentEvent } from './rhythm';
import type { EcgSignal } from './synth';
import { atrialAmpFactor } from './derived';

export type Regularity =
  | 'regular'
  | 'regular with premature beats'
  | 'regular with pauses'
  | 'regular after abrupt onset'
  | 'regularly irregular'
  | 'irregular'
  | 'irregularly irregular'
  | 'n/a';

export interface Measurements {
  ventRate: number | null; // bpm
  atrialRate: number | null;
  rrCV: number; // coefficient of variation of RR
  regularity: Regularity;
  pr: number | null; // median PR for conducted beats (ms)
  prRange: [number, number] | null;
  qrs: number | null;
  qt: number | null;
  qtcBazett: number | null;
  qtcFridericia: number | null;
  axis: number | null;
  axisLabel: string;
  avRelation: string;
  conductedFraction: number;
  dominant: string;
  /** Time (ms) of the representative beat used for QRS duration and axis (null if none). */
  repBeatT: number | null;
}

const median = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};
const mean = (a: number[]): number => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

export function axisLabel(ax: number | null): string {
  if (ax === null) return 'indeterminate';
  if (ax >= -30 && ax <= 90) return 'normal';
  if (ax < -30 && ax >= -90) return 'left axis deviation';
  if (ax > 90 && ax <= 180) return 'right axis deviation';
  return 'extreme (northwest) axis';
}

interface RegResult {
  regularity: Regularity;
  /** Indices (into the R–R array) of the sustained rhythm after an abrupt change. */
  segment: [number, number] | null;
}

/**
 * Classify R–R regularity. `premAdj[i]` is true when R–R interval i begins or ends on a premature
 * (ectopic) beat; `chaotic` marks mechanisms that are irregularly irregular by nature (AF, MAT,
 * polymorphic VT); `patterned` marks strips whose irregularity comes from a repeating mechanism
 * (ectopy, non-conducted atrial impulses, variable flutter block) rather than gradual (phasic)
 * variation of the pacemaker rate, which is simply "irregular".
 */
export function classifyRegularity(rrs: number[], premAdj: boolean[], chaotic: boolean, patterned = true): RegResult {
  const n = rrs.length;
  if (n < 3) return { regularity: 'n/a', segment: null };
  const m = mean(rrs);
  const sd = Math.sqrt(rrs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
  if (sd / m < 0.06) return { regularity: 'regular', segment: null };
  if (chaotic) return { regularity: 'irregularly irregular', segment: null };
  const med = median(rrs);
  const inN = rrs.map((r) => Math.abs(r - med) <= 0.1 * med);
  const nN = inN.filter(Boolean).length;
  const out = rrs.map((_, i) => i).filter((i) => !inN[i]);
  if (nN >= 0.6 * n) {
    if (out.every((i) => premAdj[i])) return { regularity: 'regular with premature beats', segment: null };
    const firstN = inN.indexOf(true);
    const lastN = inN.lastIndexOf(true);
    const contiguous = inN.slice(firstN, lastN + 1).every(Boolean);
    const before = out.every((i) => i < firstN);
    if (contiguous && out.length >= 2 && (before || out.every((i) => i > lastN))) {
      // The preceding (or following) rhythm must itself be regular: ignore premature beats and
      // the single transition interval that joins it to the sustained rhythm.
      const cvOf = (a: number[]): number => (a.length > 1 ? Math.sqrt(a.reduce((x, y) => x + (y - mean(a)) ** 2, 0) / (a.length - 1)) / mean(a) : 0);
      let other = out.filter((i) => !premAdj[i]);
      if (other.length >= 3 && cvOf(other.map((i) => rrs[i])) >= 0.08) other = other.filter((i) => i !== (before ? firstN - 1 : lastN + 1));
      const ov = other.map((i) => rrs[i]);
      const om = median(ov);
      // Long cycles that are exact multiples of the sustained cycle are pauses (dropped beats), not another rhythm.
      const multiples = ov.every((r) => r > 1.5 * med && Math.abs(r / med - Math.round(r / med)) < 0.1);
      if (ov.length >= 2 && cvOf(ov) < 0.08 && Math.abs(om - med) > 0.2 * med && !multiples) return { regularity: 'regular after abrupt onset', segment: [firstN, lastN] };
    }
    if (out.every((i) => premAdj[i] || rrs[i] > 1.2 * med)) {
      // Recurring pauses after the same number of beats = group beating (Wenckebach, periodic block).
      const pauses = out.filter((i) => !premAdj[i]);
      const gaps = pauses.slice(1).map((x, k) => x - pauses[k]);
      if (pauses.length >= 2 && gaps.every((g) => g === gaps[0] && g >= 2)) return { regularity: 'regularly irregular', segment: null };
      return { regularity: 'regular with pauses', segment: null };
    }
  }
  if (!patterned) return { regularity: 'irregular', segment: null };
  const sorted = [...rrs].sort((a, b) => a - b);
  const clusters: number[] = [];
  for (const r of sorted) if (!clusters.length || r - clusters[clusters.length - 1] > 0.08 * r) clusters.push(r);
  return { regularity: clusters.length <= 3 && n >= 5 ? 'regularly irregular' : 'irregular', segment: null };
}

export function measure(p: Physio, sim: SimResult, sig: EcgSignal): Measurements {
  const dur = sim.duration;
  const vsAll = sim.ventricular.filter((v) => v.t >= 0 && v.t < dur);
  const atrAll = sim.atrial.filter((a) => a.t >= 0 && a.t < dur);
  const fl = sim.continuous.find((c) => c.kind === 'flutter' && c.t1 > 0 && c.t0 < dur);
  const af = sim.continuous.find((c) => c.kind === 'fib' && c.t1 > 0 && c.t0 < dur);
  const cont = sim.continuous.find((c) => (c.kind === 'vf' || c.kind === 'vflutter') && c.t1 > 0 && c.t0 < dur);
  // P waves too small to identify (hyperkalaemia abolishes atrial depolarisation voltage first).
  const pVisible = atrialAmpFactor(p) >= 0.2;

  const isPAC = (v: VentEvent): boolean => v.atrialIndex >= 0 && sim.atrial[v.atrialIndex]?.kind === 'ectopic' && /premature/.test(sim.atrial[v.atrialIndex].label);
  const isPremature = (v: VentEvent): boolean => v.mechanism === 'pvc' || ((v.route === 'his' || v.route === 'ap') && isPAC(v));

  const rrAll: number[] = [];
  const premAdj: boolean[] = [];
  for (let i = 1; i < vsAll.length; i++) {
    rrAll.push(vsAll[i].t - vsAll[i - 1].t);
    premAdj.push(isPremature(vsAll[i]) || isPremature(vsAll[i - 1]));
  }
  const meanAll = mean(rrAll);
  const sdAll = rrAll.length > 1 ? Math.sqrt(rrAll.reduce((a, b) => a + (b - meanAll) ** 2, 0) / (rrAll.length - 1)) : 0;
  const rrCV = rrAll.length > 1 ? sdAll / meanAll : 0;

  // Dominant beat morphology: the most common mechanism among visible beats (premature beats are
  // never the dominant rhythm unless nothing else is present).
  const counts = new Map<string, number>();
  for (const b of sig.beats) if (b.ev.t >= 0 && b.ev.t < dur) counts.set(b.ev.mechanism, (counts.get(b.ev.mechanism) ?? 0) + 1);
  if (counts.size > 1) counts.delete('pvc');
  let dominant = '';
  let best = -1;
  for (const [k, c] of counts) if (c > best) {
    best = c;
    dominant = k;
  }
  const chaotic = !!af || p.rhythm.atrialMechanism === 'mat' || dominant === 'polymorphic VT' || dominant === 'torsades de pointes';
  const droppedP = atrAll.some((a) => a.kind !== 'retro' && !a.conducted);
  const reg = classifyRegularity(rrAll, premAdj, chaotic, !!fl || droppedP || premAdj.some(Boolean) || vsAll.some((v) => v.mechanism !== vsAll[0].mechanism));
  const regularity: Measurements['regularity'] = reg.regularity;

  // After an abrupt sustained change the read-out describes the sustained rhythm.
  const seg = reg.segment;
  const vs = seg ? vsAll.slice(seg[0], seg[1] + 2) : vsAll;
  const tFrom = seg ? vs[0].t - 1 : 0;
  const tTo = seg ? vs[vs.length - 1].t + 1 : dur;
  const rrs = seg ? rrAll.slice(seg[0], seg[1] + 1) : rrAll;
  const meanRR = mean(rrs);
  let ventRate: number | null = rrs.length ? Math.round(60000 / meanRR) : vsAll.length === 1 ? Math.round(60000 / dur) : null;
  if (cont) ventRate = null;

  const atr = atrAll.filter((a) => a.t >= tFrom && a.t <= tTo);
  let as = atr.filter((a) => a.kind !== 'retro');
  const retro = atr.filter((a) => a.kind === 'retro');
  // A sustained re-entrant/junctional rhythm after an abrupt onset is described by its own
  // (retrograde) atrial activation, not by the initiating premature beat.
  if (seg && retro.length >= 2 * as.length) as = [];

  let atrialRate: number | null = null;
  if (fl) atrialRate = Math.round(60000 / (fl.cl ?? 200));
  else if (af || cont || !pVisible) atrialRate = null;
  else if (atr.length > 1) {
    const aa: number[] = [];
    for (let i = 1; i < atr.length; i++) aa.push(atr[i].t - atr[i - 1].t);
    atrialRate = Math.round(60000 / mean(aa));
  }

  // PR is read from every antegradely conducted beat on the strip (including the beats before an
  // abrupt onset: the PR "jump" of a PAC that initiates AVNRT is part of the diagnosis).
  const prs: number[] = [];
  let conducted = 0;
  for (const v of vsAll) {
    if (v.atrialIndex >= 0 && (v.route === 'his' || v.route === 'ap') && !v.junctional) {
      const a = sim.atrial[v.atrialIndex];
      if (a && a.kind !== 'retro') prs.push(v.t - a.t);
    }
  }
  for (const a of as) if (a.conducted) conducted++;
  const organisedP = !fl && !af && pVisible;
  const pr = prs.length && organisedP ? Math.round(median(prs)) : null;
  const prRange: [number, number] | null = prs.length && organisedP ? [Math.round(Math.min(...prs)), Math.round(Math.max(...prs))] : null;

  const visBeats = sig.beats.filter((b) => b.ev.t >= 0 && b.ev.t < dur);
  const domBeats = visBeats.filter((b) => b.ev.mechanism === dominant);
  const domNormal = domBeats.filter((b) => b.ev.aberrant === 'none' && !isPremature(b.ev));
  const domPool = domNormal.length ? domNormal : domBeats;
  // Representative beat: the one of median QRS width (in a stable order, so with a constant
  // morphology it is simply the middle beat). Rhythms whose width varies beat to beat (pre-excited
  // AF, fusion) are then described by a typical complex rather than an arbitrary one.
  const byWidth = [...domPool].sort((a, b) => a.morph.qrsDur - b.morph.qrsDur);
  const mid = byWidth.length ? (new Set(byWidth.map((b) => Math.round(b.morph.qrsDur))).size === 1 ? domPool[Math.floor(domPool.length / 2)] : byWidth[Math.floor(byWidth.length / 2)]) : undefined;
  const qrs = mid ? Math.round(mid.morph.qrsDur) : null;

  // QT is only meaningful for organised non-tachyarrhythmic beats: prefer supraventricular/paced
  // beats conducted normally after a typical (not premature, not post-pause) cycle.
  const qtOK = ['conducted', 'junction', 'ap', 'paced', 'escape', 'AIVR'];
  let qtPool = visBeats.filter((b) => qtOK.includes(b.ev.mechanism) && b.ev.aberrant === 'none' && !isPremature(b.ev));
  if (qtOK.includes(dominant) && qtPool.some((b) => b.ev.mechanism === dominant)) qtPool = qtPool.filter((b) => b.ev.mechanism === dominant);
  let qtBeat = qtPool[Math.floor(qtPool.length / 2)];
  if (qtPool.length > 2) {
    const mr = median(qtPool.map((b) => b.rr));
    const typical = qtPool.filter((b) => Math.abs(b.rr - mr) <= 0.1 * mr);
    if (typical.length) qtBeat = typical[Math.floor(typical.length / 2)];
  }
  const qt = qtBeat ? Math.round(qtBeat.morph.qt) : null;
  const rrForQT = qtBeat ? qtBeat.rr : meanRR;
  const qtcB = qt && rrForQT ? Math.round(qt / Math.sqrt(rrForQT / 1000)) : null;
  const qtcF = qt && rrForQT ? Math.round(qt / Math.cbrt(rrForQT / 1000)) : null;

  // Polymorphic and bidirectional VT have no single frontal axis (it changes beat to beat).
  const polymorphic = dominant === 'torsades de pointes' || dominant === 'polymorphic VT' || dominant === 'bidirectional VT';
  // Dextrocardia mirrors the real heart vector (x → −x); cable reversal does not change the heart.
  const area = mid ? (p.dextrocardia ? ([-mid.morph.qrsArea[0], mid.morph.qrsArea[1], mid.morph.qrsArea[2]] as const) : mid.morph.qrsArea) : null;
  const axis = area && !polymorphic && !cont ? Math.round(axisOf(area)) : null;

  let avRelation = 'n/a';
  if (af) avRelation = 'no organised atrial activity (fibrillatory waves)';
  else if (fl) avRelation = atrialRate && ventRate ? `flutter with ~${Math.max(1, Math.round(atrialRate / ventRate))}:1 conduction` : 'flutter';
  else if (cont) avRelation = 'n/a';
  else if (!pVisible && vs.length) avRelation = 'no visible P waves';
  else {
    const paced = vs.filter((v) => v.route === 'paced');
    let tracked: { v: VentEvent; d: number; paced: boolean }[] = [];
    if (paced.length >= 0.8 * vs.length && paced.length > 0) {
      for (const v of paced) {
        const prev = [...as].reverse().find((a) => a.t < v.t && v.t - a.t <= p.rhythm.pacer.avDelay + 60);
        if (prev) tracked.push({ v, d: v.t - prev.t, paced: prev.kind === 'paced' });
      }
      if (tracked.length < 0.8 * paced.length) tracked = [];
    }
    if (tracked.length) {
      const d = Math.round(median(tracked.map((x) => x.d)));
      avRelation = tracked.filter((x) => x.paced).length > tracked.length / 2 ? `AV sequential pacing (AV delay ${d} ms)` : `atrial-tracked ventricular pacing (AV delay ${d} ms)`;
    } else if (as.length && vs.length) {
      const frac = conducted / as.length;
      if (frac > 0.95 && pr !== null && prRange && prRange[1] - prRange[0] < 40) avRelation = '1:1 AV conduction';
      else if (frac > 0.95) avRelation = '1:1 with varying PR';
      else if (conducted === 0) avRelation = 'AV dissociation (no P wave conducts)';
      else avRelation = `${conducted} of ${as.length} P waves conducted`;
    } else if (!as.length && retro.length && vs.length) {
      const rp: number[] = [];
      for (const a of retro) {
        const v = [...vs].reverse().find((x) => x.t <= a.t + 60);
        if (v) rp.push(a.t - v.t);
      }
      const rpm = rp.length ? Math.round(median(rp)) : null;
      const vsAfter = vs.filter((v) => v.t > retro[0].t - 200);
      const oneToOne = retro.length >= vsAfter.length - 1;
      avRelation = `${oneToOne ? '1:1 VA conduction' : 'intermittent VA conduction'}: retrograde P′${rpm !== null ? ` (RP′ ${rpm} ms)` : ''}`;
    } else if (!atr.length && vs.length) avRelation = 'no visible atrial activity';
    else if (as.length && !vs.length) avRelation = 'P waves without QRS complexes (ventricular standstill)';
    if (seg) avRelation = `after abrupt onset: ${avRelation}`;
  }

  return {
    ventRate,
    atrialRate,
    rrCV,
    regularity,
    pr,
    prRange,
    qrs,
    qt,
    qtcBazett: qtcB,
    qtcFridericia: qtcF,
    axis,
    axisLabel: axisLabel(axis),
    avRelation,
    conductedFraction: as.length ? conducted / as.length : 0,
    dominant,
    repBeatT: mid ? mid.ev.t : null,
  };
}
