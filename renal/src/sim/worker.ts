// Runs the slow parts of the engine (steady-state searches and time courses) off the main
// thread so sliders stay responsive.

import { runToSteadyState, simulate } from '../engine/simulate';
import type { BodyState } from '../engine/body';
import type { Params } from '../engine/types';

export type Job =
  | { id: number; kind: 'steady'; params: Params; days: number; start?: BodyState }
  | { id: number; kind: 'trajectory'; params: Params; days: number; dt: number; start?: BodyState }
  /** settle on one set of parameters, then switch to another and record the transition */
  | { id: number; kind: 'step'; from: Params; to: Params; days: number; dt: number; settleDays?: number };

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
      const settled = runToSteadyState(job.from, job.settleDays ?? 60);
      const r = simulate(job.to, job.days, job.dt, settled.state.body);
      (self as unknown as Worker).postMessage({ id: job.id, result: { ...r, before: settled.ev } });
    }
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: job.id, error: String(err) });
  }
};
