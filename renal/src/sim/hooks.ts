// Hooks that connect the interface to the physiology engine.
//
//   useAcute     one pass of the model on a normal body: what the kidney does in the first
//                minutes, before any balance has shifted (haemodynamics, transport, hormones)
//   useSteady    the new steady state after days of the disturbance (serum Na, K, HCO3 …)
//   useCourse    the time course between the two
//
// Steady states and time courses run in a worker and are cached by their parameters, so moving a
// slider back to a value already visited is instant.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { evaluate, runToSteadyState, simulate, type Evaluation, type SimState, type TrajectoryPoint } from '../engine/simulate';
import { initialBody, type BodyState } from '../engine/body';
import type { Job } from './worker';
import { applyPatch, DEFAULT_PARAMS, type ParamPatch, type Params } from '../engine/types';

export const paramsKey = (p: Params, extra = '') => JSON.stringify(p) + extra;

export function makeParams(patch: ParamPatch = {}): Params {
  return applyPatch(DEFAULT_PARAMS, patch);
}

const acuteCache = new Map<string, Evaluation>();
export function acute(p: Params, body?: BodyState): Evaluation {
  const key = paramsKey(p, body ? JSON.stringify(body) : '');
  let ev = acuteCache.get(key);
  if (!ev) {
    ev = evaluate(body ?? initialBody(p), p);
    if (acuteCache.size > 400) acuteCache.clear();
    acuteCache.set(key, ev);
  }
  return ev;
}

export function useAcute(p: Params, body?: BodyState): Evaluation {
  const key = paramsKey(p, body ? JSON.stringify(body) : '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => acute(p, body), [key]);
}

// ---------------------------------------------------------------- worker plumbing
type JobSpec =
  | { kind: 'steady'; params: Params; days: number; start?: BodyState }
  | { kind: 'trajectory'; params: Params; days: number; dt: number; start?: BodyState }
  | { kind: 'step'; from: Params; to: Params; days: number; dt: number; settleDays?: number };

type SteadyResult = { state: SimState; ev: Evaluation };
type CourseResult = { points: TrajectoryPoint[]; final: Evaluation; state: SimState };

// A small pool: independent steady states (a family of curves, several scenarios side by side)
// compute in parallel instead of queueing behind one another.
let pool: Worker[] | null | undefined;
const busy = new Map<Worker, number>();
let nextId = 1;
const pending = new Map<number, (r: unknown) => void>();

function getWorker(): Worker | null {
  if (pool === undefined) {
    try {
      const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
      pool = [];
      for (let i = 0; i < n; i++) {
        const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
        busy.set(w, 0);
        w.onmessage = (e: MessageEvent<{ id: number; result?: unknown; error?: string }>) => {
          busy.set(w, Math.max(0, (busy.get(w) ?? 1) - 1));
          const cb = pending.get(e.data.id);
          pending.delete(e.data.id);
          if (cb) cb(e.data.result ?? null);
        };
        pool.push(w);
      }
    } catch {
      pool = null;
    }
  }
  if (!pool || pool.length === 0) return null;
  // least-loaded worker
  let best = pool[0];
  for (const w of pool) if ((busy.get(w) ?? 0) < (busy.get(best) ?? 0)) best = w;
  busy.set(best, (busy.get(best) ?? 0) + 1);
  return best;
}

function run<T>(job: JobSpec): Promise<T> {
  const w = getWorker();
  if (!w) {
    // No worker (very old browser): compute on the main thread.
    return new Promise((resolve) =>
      setTimeout(() => {
        if (job.kind === 'steady') resolve(runToSteadyState(job.params, job.days, 0.5, job.start) as T);
        else if (job.kind === 'trajectory') resolve(simulate(job.params, job.days, job.dt, job.start) as T);
        else {
          const settled = runToSteadyState(job.from, job.settleDays ?? 60);
          resolve({ ...simulate(job.to, job.days, job.dt, settled.state.body), before: settled.ev } as T);
        }
      }, 0),
    );
  }
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve as (r: unknown) => void);
    w.postMessage({ ...job, id } as Job);
  });
}

const steadyCache = new Map<string, SteadyResult>();
const steadyInflight = new Map<string, Promise<SteadyResult>>();

export function steady(p: Params, days = 40, start?: BodyState): Promise<SteadyResult> {
  const key = paramsKey(p, `|${days}|${start ? JSON.stringify(start) : ''}`);
  const hit = steadyCache.get(key);
  if (hit) return Promise.resolve(hit);
  let inflight = steadyInflight.get(key);
  if (!inflight) {
    inflight = run<SteadyResult>({ kind: 'steady', params: p, days, start }).then((r) => {
      if (steadyCache.size > 300) steadyCache.clear();
      steadyCache.set(key, r);
      steadyInflight.delete(key);
      return r;
    });
    steadyInflight.set(key, inflight);
  }
  return inflight;
}

/** Debounced, cancellable async value keyed on a string. */
function useAsync<T>(key: string, compute: () => Promise<T>, delay = 90): { value: T | undefined; busy: boolean } {
  const [value, setValue] = useState<T | undefined>(undefined);
  const [busy, setBusy] = useState(true);
  const latest = useRef(key);
  useEffect(() => {
    latest.current = key;
    setBusy(true);
    const t = setTimeout(() => {
      compute().then((v) => {
        if (latest.current === key) {
          setValue(v);
          setBusy(false);
        }
      });
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { value, busy };
}

export function useSteady(p: Params, days = 40, start?: BodyState) {
  const key = paramsKey(p, `|${days}|${start ? JSON.stringify(start) : ''}`);
  const r = useAsync(key, () => steady(p, days, start));
  return { ev: r.value?.ev, state: r.value?.state, busy: r.busy };
}

const courseCache = new Map<string, CourseResult>();
export function course(p: Params, days: number, dt = 0.25, start?: BodyState): Promise<CourseResult> {
  const key = paramsKey(p, `|${days}|${dt}|${start ? JSON.stringify(start) : ''}`);
  const hit = courseCache.get(key);
  if (hit) return Promise.resolve(hit);
  return run<CourseResult>({ kind: 'trajectory', params: p, days, dt, start }).then((r) => {
    if (courseCache.size > 100) courseCache.clear();
    courseCache.set(key, r);
    return r;
  });
}

type StepResult = CourseResult & { before: Evaluation };
const stepCache = new Map<string, StepResult>();

/**
 * Settle the body on one set of parameters, then switch to another and record the transition —
 * the shape of most teaching experiments (a change of diet, a drug started). Both halves run in
 * one worker job so the two never race.
 */
export function useStep(from: Params, to: Params, days: number, dt = 0.25, settleDays = 60) {
  const key = paramsKey(from, `|${paramsKey(to)}|${days}|${dt}|${settleDays}`);
  const r = useAsync(key, () => {
    const hit = stepCache.get(key);
    if (hit) return Promise.resolve(hit);
    return run<StepResult>({ kind: 'step', from, to, days, dt, settleDays }).then((v) => {
      if (stepCache.size > 100) stepCache.clear();
      stepCache.set(key, v);
      return v;
    });
  }, 120);
  return { points: r.value?.points, before: r.value?.before, final: r.value?.final, state: r.value?.state, busy: r.busy };
}

export function useCourse(p: Params, days: number, dt = 0.25, start?: BodyState) {
  const key = paramsKey(p, `|${days}|${dt}|${start ? JSON.stringify(start) : ''}`);
  const r = useAsync(key, () => course(p, days, dt, start), 120);
  return { points: r.value?.points, final: r.value?.final, state: r.value?.state, busy: r.busy };
}

/** The normal reference state, used for "change from normal" deltas everywhere. */
export const NORMAL = (() => {
  let cached: Evaluation | undefined;
  return () => (cached ??= evaluate(initialBody(DEFAULT_PARAMS), DEFAULT_PARAMS));
})();

export function useNormalSteady() {
  return useSteady(DEFAULT_PARAMS);
}
