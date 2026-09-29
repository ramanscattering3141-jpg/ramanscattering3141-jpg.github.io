export * from './params';
export * from './rhythm';
export * from './synth';
export * from './measure';
export * from './leads';
export { buildVentBeat, buildP, TERRITORY, VENT_SITE, AP_SITE, P_SITE, axisOf, territoryVector, patternQRS, focusQRS } from './morphology';

import { makePhysio, type Physio, type PhysioPatch } from './params';
import { simulate, type SimResult } from './rhythm';
import { synthesize, type EcgSignal } from './synth';
import { measure, type Measurements } from './measure';
import type { LeadId } from './leads';

export interface EcgRun {
  physio: Physio;
  sim: SimResult;
  sig: EcgSignal;
  m: Measurements;
}

/** Full pipeline: physiology → conduction simulation → waveform synthesis → measurements. */
export function runEcg(p: Physio, duration = 10000, leads?: LeadId[]): EcgRun {
  const sim = simulate(p, { duration });
  const sig = synthesize(p, sim, { from: 0, to: duration, leads });
  const m = measure(p, sim, sig);
  return { physio: p, sim, sig, m };
}

export function runPatch(patch: PhysioPatch, duration = 10000): EcgRun {
  return runEcg(makePhysio(patch), duration);
}
export { explainAt, beatAt, heading, type Moment, type Phase, type PhaseId, type ActiveComp } from './explain';
