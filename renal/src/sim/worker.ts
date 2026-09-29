// Runs the slow parts of the engine (steady-state searches and time courses) off the main
// thread so sliders stay responsive.

import { runToSteadyState, simulate, stepCourse } from '../engine/simulate';
import type { BodyState } from '../engine/body';
import type { Params } from '../engine/types';

export type Job =
  | { id: number; kind: 'steady'; params: Params; days: number; start?: BodyState }
  | { id: number; kind: 'trajectory'; params: Params; days: number; dt: number; start?: BodyState }
  /**
   * Settle on one set of parameters, then switch to another and record the transition.
   *
   * `fineDays` records the first part of the transition at `dt` and the remainder at `coarseDt`.
   * Most of what a perturbation has to teach happens in the first hours — a diuretic's peak
   * natriuresis and its braking, the early urine chemistry — while the following fortnight only
   * drifts towards a new steady state. Recording the whole run at the fine interval costs several
   * seconds because the integrator cannot take a substep longer than the recording interval.
   */
  | { id: number; kind: 'step'; from: Params; to: Params; days: number; dt: number; settleDays?: number; fineDays?: number; coarseDt?: number };

self.onmessage = (e: MessageEvent<Job>) => {
  const job = e.data;
  try {
    if (job.kind === 'steady') {
      const r = runToSteadyState(job.params, job.days, 0.5, job.start);
      (self as unknown as Worker).postMessage({ id: job.id, result: r });
    } else if (job.kind === 'trajectory') {
      const r = simulate(job.params, job.days, job.dt, job.start);
      (self as unknown as Worker).postMessage({ id: job.id, result: r });
    } else {
      const r = stepCourse(job.from, job.to, job.days, job.dt, job.settleDays, job.fineDays, job.coarseDt);
      (self as unknown as Worker).postMessage({ id: job.id, result: r });
    }
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: job.id, error: String(err) });
  }
};
