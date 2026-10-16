// Segment-by-segment fate of one solute, as the flow simulator draws it.
//
// The engine reports, for each segment, how much of a solute enters and leaves. From that the
// simulator needs three things that must stay consistent with each other:
//   - the share of a reference load each segment takes back (or adds), for the bars and bands
//   - the chance that a particle present at the start of a segment leaves in it, for the animation
//   - the share that reaches the urine
// The reference load is the filtered load, except for a solute that is barely filtered (NH4+,
// which the tubule makes and secretes): then it is everything that enters the tubular fluid,
// filtered plus added, so the numbers stay finite and still add up.

import { SEGMENTS, type ParamPatch, type SegmentFlux, type SegmentId, type SoluteId } from '../engine/types';
import { depletedBody } from '../engine/scenarios';
import { initialBody } from '../engine/body';
import type { Evaluation } from '../engine/simulate';
import { acute, makeParams } from './hooks';

export interface FlowScenario {
  id: string;
  label: string;
  patch: ParamPatch;
  /** litres of isotonic fluid already lost */
  depleted?: number;
  /** plasma HCO3- already lowered to this, mmol/L */
  hco3?: number;
}

export const FLOW_SCENARIOS: FlowScenario[] = [
  { id: 'normal', label: 'Normal', patch: {} },
  { id: 'loop', label: 'Loop diuretic', patch: { drugs: { furosemide: 1 } } },
  { id: 'thiazide', label: 'Thiazide', patch: { drugs: { thiazide: 1 } } },
  { id: 'sglt2i', label: 'SGLT2 inhibitor', patch: { drugs: { sglt2i: 1 } } },
  { id: 'dm', label: 'Glucose 22 mmol/L', patch: { glucose: 400 } }, // engine glucose is mg/dL
  { id: 'volume', label: 'Volume depletion', patch: {}, depleted: 3 },
  { id: 'aldo', label: 'High aldosterone', patch: { aldoAutonomous: 5 } },
  { id: 'acid', label: 'Metabolic acidosis', patch: {}, hco3: 13 },
  { id: 'noadh', label: 'No ADH (central DI)', patch: { centralDI: 1 } },
];

/** The kidney in the first hours of a scenario, before body balances have shifted. */
export function flowEvaluation(id: string): Evaluation {
  const sc = FLOW_SCENARIOS.find((s) => s.id === id) ?? FLOW_SCENARIOS[0];
  const p = makeParams(sc.patch);
  let body = sc.depleted ? depletedBody(p, sc.depleted) : undefined;
  if (sc.hco3) body = { ...(body ?? initialBody(p)), hco3: sc.hco3 };
  return acute(p, body);
}

export interface SegmentFate {
  id: SegmentId;
  /** amount reabsorbed (positive) or added (negative), as a share of the reference load */
  delta: number;
  /** amount leaving the segment, as a share of the reference load */
  out: number;
  /** probability that a particle entering this segment is reabsorbed in it (0 where it adds) */
  hazard: number;
}

export interface SoluteFate {
  /** 'filtered': shares are of the filtered load; 'entered': of everything entering the tubule */
  basis: 'filtered' | 'entered';
  /** reference load in engine units (per minute) */
  ref: number;
  /** filtered load in engine units (per minute) */
  filtered: number;
  /** filtered load as a share of the reference (1 unless the basis is 'entered') */
  filteredShare: number;
  segments: SegmentFate[];
  /** amount in the final urine, as a share of the reference load */
  excreted: number;
  /** amount in the final urine in engine units (per minute) */
  excretedAmount: number;
}

/** Below this, a filtered load is treated as nothing (a solute made and secreted by the tubule). */
const NEGLIGIBLE_FILTRATION = 0.02;

export function soluteFate(segs: Record<SegmentId, SegmentFlux>, solute: SoluteId): SoluteFate {
  const filtered = Math.max(0, segs.PT.in[solute]);
  const added = SEGMENTS.reduce((s, id) => s + Math.max(0, segs[id].out[solute] - segs[id].in[solute]), 0);
  const basis = filtered < NEGLIGIBLE_FILTRATION * (filtered + added) ? 'entered' : 'filtered';
  const ref = Math.max(basis === 'filtered' ? filtered : filtered + added, 1e-12);
  const segments = SEGMENTS.map((id) => {
    const inn = Math.max(0, segs[id].in[solute]);
    const out = Math.max(0, segs[id].out[solute]);
    const delta = (inn - out) / ref;
    return { id, delta, out: out / ref, hazard: inn > 0 && out < inn ? (inn - out) / inn : 0 };
  });
  const excretedAmount = Math.max(0, segs.IMCD.out[solute]);
  return { basis, ref, filtered, filteredShare: filtered / ref, segments, excreted: excretedAmount / ref, excretedAmount };
}

/**
 * Expected share of the reference load reaching the urine if particles enter at the glomerulus
 * (filteredShare) and where segments add, and leave with each segment's hazard. Equals `excreted`
 * when the animation is faithful to the engine; used by the tests.
 */
export function animatedExcretion(f: SoluteFate): number {
  let a = f.filteredShare;
  for (const s of f.segments) {
    if (s.delta > 0) a *= 1 - s.hazard;
    else a -= s.delta;
  }
  return a;
}

/** Index of the segment in which a particle starting at segment `from` is reabsorbed, or -1 if excreted. */
export function planExit(f: SoluteFate, from: number, rand: () => number = Math.random): number {
  for (let i = from; i < f.segments.length; i++) {
    const h = f.segments[i].hazard;
    if (h > 0 && rand() < h) return i;
  }
  return -1;
}

/** Engine units per minute -> a daily amount with its unit, for display. */
export function perDay(solute: SoluteId, perMin: number): string {
  const day = perMin * 1440;
  if (solute === 'water') return `${fmtAmount(day / 1000)} L/day`;
  if (solute === 'glucose') return `${fmtAmount(day / 180.16)} mmol/day`; // engine glucose is mg/min
  if (solute === 'creat') return `${fmtAmount(day / 113.12)} mmol/day`; // engine creatinine is mg/min
  return `${fmtAmount(day)} mmol/day`;
}

function fmtAmount(x: number): string {
  if (x >= 100) return x.toFixed(0);
  if (x >= 10) return x.toFixed(1);
  if (x >= 0.1) return x.toFixed(2);
  if (x >= 0.001) return x.toFixed(3);
  return x > 0 ? '<0.001' : '0';
}

/** A share as a percentage, with more digits for small values so 0.02% does not read as 0. */
export function fmtPct(f: number): string {
  const p = f * 100;
  if (p >= 10) return `${p.toFixed(0)}%`;
  if (p >= 1) return `${p.toFixed(1)}%`;
  if (p >= 0.1) return `${p.toFixed(2)}%`;
  if (p >= 0.01) return `${p.toFixed(3)}%`;
  return p > 0 ? '<0.01%' : '0%';
}
