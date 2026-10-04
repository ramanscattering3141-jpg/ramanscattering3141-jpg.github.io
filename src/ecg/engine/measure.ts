// Ground-truth measurements derived from the model (not from signal processing), used for
// the interval read-outs, challenge-mode answer keys and "before → after" comparisons.

import { axisOf } from './morphology';
import type { Physio } from './params';
import type { SimResult } from './rhythm';
import type { EcgSignal } from './synth';
import { qtcEffective } from './derived';

export interface Measurements {
  ventRate: number | null; // bpm
  atrialRate: number | null;
  rrCV: number; // coefficient of variation of RR
  regularity: 'regular' | 'regularly irregular' | 'irregular' | 'irregularly irregular' | 'n/a';
  pr: number | null; // median PR for conducted beats (ms)
  prRange: [number, number] | null;
  qrs: number | null;
  qt: number | null;
  qtcBazett: number | null;
  qtcFridericia: number | null;
  /** Frontal axis as it appears on the recorded leads (what a reader measures). */
  axis: number | null;
  axisLabel: string;
  /** The heart's own axis; differs from `axis` only when limb cables are swapped. */
  trueAxis: number | null;
  avRelation: string;
  conductedFraction: number;
  dominant: string;
}

const median = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};

export function axisLabel(ax: number | null): string {
  if (ax === null) return 'indeterminate';
  if (ax >= -30 && ax <= 90) return 'normal';
  if (ax < -30 && ax >= -90) return 'left axis deviation';
  if (ax > 90 && ax <= 180) return 'right axis deviation';
  return 'extreme (northwest) axis';
}

export function measure(p: Physio, sim: SimResult, sig: EcgSignal): Measurements {
  const dur = sim.duration;
  const vs = sim.ventricular.filter((v) => v.t >= 0 && v.t < dur);
  const as = sim.atrial.filter((a) => a.t >= 0 && a.t < dur && a.kind !== 'retro');
  const rrs: number[] = [];
  for (let i = 1; i < vs.length; i++) rrs.push(vs[i].t - vs[i - 1].t);
  const cont = sim.continuous.find((c) => (c.kind === 'vf' || c.kind === 'vflutter') && c.t1 > 0 && c.t0 < dur);
  const meanRR = rrs.length ? rrs.reduce((a, b) => a + b, 0) / rrs.length : NaN;
  const sd = rrs.length > 1 ? Math.sqrt(rrs.reduce((a, b) => a + (b - meanRR) ** 2, 0) / (rrs.length - 1)) : 0;
  const rrCV = rrs.length > 1 ? sd / meanRR : 0;
  let ventRate: number | null = rrs.length ? Math.round(60000 / meanRR) : vs.length === 1 ? Math.round(vs.length * (60000 / dur)) : null;
  if (cont) ventRate = null;

  let atrialRate: number | null = null;
  const fl = sim.continuous.find((c) => c.kind === 'flutter');
  const af = sim.continuous.find((c) => c.kind === 'fib');
  if (fl) atrialRate = Math.round(60000 / (fl.cl ?? 200));
  else if (af) atrialRate = null;
  else if (as.length > 1) {
    const aa: number[] = [];
    for (let i = 1; i < as.length; i++) aa.push(as[i].t - as[i - 1].t);
    atrialRate = Math.round(60000 / (aa.reduce((a, b) => a + b, 0) / aa.length));
  }

  // Regularity classification: "regularly irregular" if RR takes a few repeating values (group beating, bigeminy).
  let regularity: Measurements['regularity'] = 'n/a';
  if (rrs.length >= 3) {
    if (rrCV < 0.06) regularity = 'regular';
    else {
      const sorted = [...rrs].sort((a, b) => a - b);
      const clusters: number[] = [];
      for (const r of sorted) if (!clusters.length || r - clusters[clusters.length - 1] > 0.08 * r) clusters.push(r);
      regularity = clusters.length <= 3 && rrs.length >= 5 ? 'regularly irregular' : rrCV > 0.1 ? 'irregularly irregular' : 'irregular';
    }
  }

  const prs: number[] = [];
  let conducted = 0;
  for (const v of vs) {
    if (v.atrialIndex >= 0 && (v.route === 'his' || v.route === 'ap') && !v.junctional) {
      const a = sim.atrial[v.atrialIndex];
      if (a && a.kind !== 'retro') prs.push(v.t - a.t);
    }
  }
  for (const a of as) if (a.conducted) conducted++;
  const organisedP = !fl && !af;
  const pr = prs.length && organisedP ? Math.round(median(prs)) : null;
  const prRange: [number, number] | null = prs.length && organisedP ? [Math.round(Math.min(...prs)), Math.round(Math.max(...prs))] : null;

  // Dominant beat morphology: the most common mechanism among visible beats.
  const counts = new Map<string, number>();
  for (const b of sig.beats) if (b.ev.t >= 0) counts.set(b.ev.mechanism, (counts.get(b.ev.mechanism) ?? 0) + 1);
  let dominant = '';
  let best = -1;
  for (const [k, c] of counts) if (c > best) {
    best = c;
    dominant = k;
  }
  // Within the dominant mechanism, measure a typical beat: occasional aberrant (functionally
  // blocked) conducted beats must not stand in for the underlying conduction.
  const domAll = sig.beats.filter((b) => b.ev.mechanism === dominant && b.ev.t >= 0);
  const domTypical = domAll.filter((b) => b.ev.aberrant === 'none');
  const domBeats = domTypical.length >= domAll.length / 2 ? domTypical : domAll;
  const mid = domBeats[Math.floor(domBeats.length / 2)];
  const qrs = mid ? Math.round(mid.morph.qrsDur) : null;
  // QT is only meaningful for organised non-tachyarrhythmic beats: prefer supraventricular/paced beats.
  const qtAll = sig.beats.filter((b) => b.ev.t >= 0 && ['conducted', 'junction', 'ap', 'paced', 'escape', 'AIVR'].includes(b.ev.mechanism));
  const qtTypical = qtAll.filter((b) => b.ev.aberrant === 'none' && b.ev.mechanism === dominant);
  const qtPool = qtTypical.length ? qtTypical : qtAll;
  const qtBeat = qtPool[Math.floor(qtPool.length / 2)];
  const qt = qtBeat ? Math.round(qtBeat.morph.qt) : null;
  const rrForQT = qtBeat ? qtBeat.rr : meanRR;
  const qtcB = qt && rrForQT ? Math.round(qt / Math.sqrt(rrForQT / 1000)) : null;
  const qtcF = qt && rrForQT ? Math.round(qt / Math.cbrt(rrForQT / 1000)) : null;
  const polymorphic = dominant === 'torsades de pointes' || dominant === 'polymorphic VT';
  // Dextrocardia mirrors the real heart vector (x → −x); cable reversal does not change the heart.
  const area = mid ? (p.dextrocardia ? ([-mid.morph.qrsArea[0], mid.morph.qrsArea[1], mid.morph.qrsArea[2]] as const) : mid.morph.qrsArea) : null;
  const trueAxis = area && !polymorphic && !cont ? Math.round(axisOf(area)) : null;
  // A limb-cable swap reflects every frontal-plane vector about a fixed line: RA↔LA about +90°
  // (lead I inverted, II↔III), LA↔LL about +30° (I↔II, III inverted), RA↔LL about −30°.
  const mirror = { none: null, raLa: 90, laLl: 30, raLl: -30 }[p.leadReversal ?? 'none'];
  const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
  const axis = trueAxis === null || mirror === null ? trueAxis : Math.round(wrap(2 * mirror - trueAxis));

  let avRelation = 'n/a';
  if (af) avRelation = 'no organised atrial activity (fibrillatory waves)';
  else if (fl) avRelation = atrialRate && ventRate ? `flutter with ~${Math.max(1, Math.round(atrialRate / ventRate))}:1 conduction` : 'flutter';
  else if (as.length && vs.length) {
    const frac = conducted / as.length;
    if (frac > 0.95 && pr !== null && prRange && prRange[1] - prRange[0] < 40) avRelation = '1:1 AV conduction';
    else if (frac > 0.95) avRelation = '1:1 with varying PR';
    else if (conducted === 0) avRelation = 'AV dissociation (no P wave conducts)';
    else avRelation = `${conducted} of ${as.length} P waves conducted`;
  } else if (!as.length && vs.length) avRelation = 'no visible atrial activity';

  void qtcEffective;
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
    trueAxis,
    avRelation,
    conductedFraction: as.length ? conducted / as.length : 0,
    dominant,
  };
}
