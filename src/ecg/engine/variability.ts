// Realistic inter-patient variation: the same diagnosis never looks exactly the same.

import { clone, type Physio } from './params';
import { gauss, mulberry32 } from './random';
import { clamp } from './vec';

export function randomVariation(p: Physio, seed = Math.floor(Math.random() * 1e9)): Physio {
  const r = mulberry32(seed);
  const q = clone(p);
  const g = (sd: number): number => gauss(r) * sd;
  q.age = clamp(Math.round(q.age + g(10)), 18, 92);
  q.habitus = clamp(q.habitus * (1 + g(0.14)), 0.45, 1.45);
  q.anatomicalAxis = clamp(q.anatomicalAxis + g(12), -45, 45);
  q.horizontalRotation = clamp(q.horizontalRotation + g(10), -40, 40);
  q.autonomic = clamp(q.autonomic + g(0.15), -1, 1);
  q.lvMass = clamp(q.lvMass * (1 + g(0.06)), 0.7, 2.4);
  q.rvMass = clamp(q.rvMass * (1 + g(0.06)), 0.7, 3.5);
  q.ventricularCV = clamp(q.ventricularCV * (1 + g(0.05)), 0.4, 1.5);
  q.raSize = clamp(q.raSize * (1 + g(0.06)), 0.8, 2.5);
  q.laSize = clamp(q.laSize * (1 + g(0.08)), 0.8, 2.5);
  q.qtcBase = clamp(q.qtcBase + g(12), 280, 620);
  q.noise = clamp(q.noise + g(0.08), 0, 0.8);
  q.rhythm.sinusRate = clamp(q.rhythm.sinusRate * (1 + g(0.08)), 20, 190);
  q.rhythm.avnAHmin = clamp(q.rhythm.avnAHmin * (1 + g(0.12)), 40, 400);
  q.rhythm.seed = Math.floor(r() * 1e6);
  if (q.sex && r() < 0.5) q.sex = q.sex === 'M' ? 'F' : 'M';
  return q;
}
