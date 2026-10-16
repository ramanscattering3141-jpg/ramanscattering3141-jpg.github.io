// Where is the impulse right now? A step-by-step state of the cardiac conduction pathway at time t,
// read from the conduction simulation (the same events that drive the 3-D heart and the ECG).

import type { EcgRun } from '../../engine';
import { buildP, VENT_SITE, AP_SITE } from '../../engine/morphology';

export type StepState = 'idle' | 'now' | 'done' | 'blocked' | 'bypassed' | 'chaos';
export interface Step {
  id: 'sa' | 'atria' | 'avn' | 'ap' | 'his' | 'bb' | 'purk' | 'qrs' | 'st' | 't';
  label: string;
  ecg: string;
  state: StepState;
  note?: string;
}

const pDurCache = new WeakMap<EcgRun, Map<string, number>>();
function pDur(run: EcgRun, site: Parameters<typeof buildP>[1]): number {
  let m = pDurCache.get(run);
  if (!m) {
    m = new Map();
    pDurCache.set(run, m);
  }
  let v = m.get(site);
  if (v === undefined) {
    v = buildP(run.physio, site).pDur;
    m.set(site, v);
  }
  return v;
}

export function pathwayAt(run: EcgRun, t: number): Step[] {
  const { sim, sig, physio: p } = run;
  const R = p.rhythm;
  const hv = R.hv;
  const steps: Step[] = [
    { id: 'sa', label: 'Sinus node', ecg: '', state: 'idle' },
    { id: 'atria', label: 'Atria', ecg: 'P', state: 'idle' },
    { id: 'avn', label: 'AV node', ecg: 'PR', state: 'idle' },
    ...(R.ap.present ? [{ id: 'ap' as const, label: 'Accessory pathway', ecg: 'δ', state: 'idle' as StepState }] : []),
    { id: 'his', label: 'His bundle', ecg: 'PR', state: 'idle' },
    { id: 'bb', label: 'Bundle branches', ecg: 'PR', state: 'idle' },
    { id: 'purk', label: 'Purkinje fibres', ecg: 'QRS', state: 'idle' },
    { id: 'qrs', label: 'Ventricles depolarise', ecg: 'QRS', state: 'idle' },
    { id: 'st', label: 'Plateau', ecg: 'ST', state: 'idle' },
    { id: 't', label: 'Repolarisation', ecg: 'T', state: 'idle' },
  ];
  const S = (id: Step['id']): Step | undefined => steps.find((s) => s.id === id);
  const set = (id: Step['id'], state: StepState, note?: string): void => {
    const s = S(id);
    if (!s) return;
    // "now" and "blocked" win over weaker states.
    const rank: Record<StepState, number> = { idle: 0, done: 1, bypassed: 2, chaos: 3, now: 4, blocked: 5 };
    if (rank[state] >= rank[s.state]) {
      s.state = state;
      if (note) s.note = note;
    }
  };

  // Sinus node and atria
  const sinusFire = sim.log.find((l) => l.node === 'SA' && l.kind === 'fire' && t >= l.t && t < l.t + 25);
  if (sinusFire) set('sa', 'now', 'fires');
  const saBlock = sim.log.find((l) => l.node === 'SA' && l.kind === 'block' && t >= l.t && t < l.t + 250);
  if (saBlock) set('sa', 'blocked', saBlock.note ?? 'no discharge');
  const cont = sim.continuous.filter((c) => t >= c.t0 && t <= c.t1);
  const fib = cont.find((c) => c.kind === 'fib');
  const flut = cont.find((c) => c.kind === 'flutter');
  if (fib) set('atria', 'chaos', 'fibrillating');
  else if (flut) set('atria', 'chaos', `flutter circuit, ${Math.round(60000 / (flut.cl ?? 200))}/min`);
  if (fib || flut) set('sa', 'bypassed', 'suppressed');
  const lastA = [...sim.atrial].reverse().find((a) => a.kind !== 'flutter' && a.t <= t);
  if (lastA) {
    const dur = pDur(run, lastA.site);
    const origin = lastA.kind === 'sinus' ? '' : lastA.kind === 'retro' ? 'retrograde' : lastA.kind === 'paced' ? 'paced' : 'ectopic focus';
    if (t - lastA.t <= dur) set('atria', 'now', origin || undefined);
    else if (t - lastA.t < 600) set('atria', 'done', origin || undefined);
    if (lastA.kind === 'sinus' && t - lastA.t < 600) set('sa', 'done');
    if (lastA.kind !== 'sinus' && t - lastA.t < 600 && !sinusFire) set('sa', 'bypassed', lastA.kind === 'retro' ? 'atria activated from below' : 'not the origin');
  }

  // AV node / accessory pathway (ladder)
  for (const sg of sim.ladder) {
    const lo = Math.min(sg.t0, sg.t1);
    const hi = Math.max(sg.t0, sg.t1);
    if (t < lo || t > hi + 400) continue;
    const id = sg.row === 'AP' ? 'ap' : 'avn';
    const path = sg.path.includes('fast') ? 'fast pathway' : sg.path.includes('slow') ? 'slow pathway' : '';
    const dirNote = sg.dir === 'retro' ? `retrograde${path ? `, ${path}` : ''}` : path;
    if (t <= hi) set(id, sg.blocked && t > hi - 10 ? 'blocked' : 'now', sg.blocked ? 'impulse blocked here' : dirNote || undefined);
    else if (sg.blocked && t < hi + 260) set(id, 'blocked', 'impulse blocked here');
    else if (!sg.blocked) set(id, 'done', dirNote || undefined);
  }

  // Ventricular beat in progress (or the next one, during the PR interval)
  const beats = sig.beats;
  let bi = -1;
  for (let i = 0; i < beats.length; i++) if (beats[i].ev.t <= t) bi = i;
  const next = beats[bi + 1];
  const b = bi >= 0 ? beats[bi] : null;
  const vf = cont.find((c) => c.kind === 'vf' || c.kind === 'vflutter');
  if (vf) {
    set('qrs', 'chaos', vf.kind === 'vf' ? 'fibrillating — no output' : 'very rapid circuit');
    for (const id of ['his', 'bb', 'purk', 'st', 't'] as const) set(id, 'bypassed');
    return steps;
  }
  // His–Purkinje timing for a conducted beat whose His activation falls near t.
  for (const v of [b?.ev, next?.ev]) {
    if (!v) continue;
    const t0 = v.route === 'his' ? v.t : Number.isFinite(v.hisDelay) && v.hisDelay < 120 ? v.t + v.hisDelay : NaN;
    if (!Number.isFinite(t0)) continue;
    if (t >= t0 - hv && t < t0 - hv * 0.4) set('his', 'now');
    else if (t >= t0 - hv * 0.4 && t < t0 + 400) set('his', 'done');
    if (t >= t0 - hv * 0.5 && t < t0 + 6) set('bb', 'now');
    else if (t >= t0 + 6 && t < t0 + 400) set('bb', 'done');
    if (t >= t0 - 4 && t < t0 + 24) set('purk', 'now');
    else if (t >= t0 + 24 && t < t0 + 400) set('purk', 'done');
  }
  const hisBlock = sim.log.find((l) => l.kind === 'block' && l.node === 'HIS' && t >= l.t && t < l.t + 260);
  if (hisBlock) set('his', 'blocked', 'block below the AV node');
  const bundle = p.bundle;
  const bbNote = bundle === 'rbbb' || bundle === 'incompleteRbbb' ? 'right bundle blocked' : bundle === 'lbbb' ? 'left bundle blocked' : bundle === 'lafb' ? 'left anterior fascicle blocked' : bundle === 'lpfb' ? 'left posterior fascicle blocked' : bundle === 'rbbb+lafb' ? 'right bundle + left anterior fascicle blocked' : bundle === 'rbbb+lpfb' ? 'right bundle + left posterior fascicle blocked' : '';
  const bbs = S('bb');
  if (bbs && bbNote && (bbs.state === 'now' || bbs.state === 'done')) bbs.note = bbNote;
  if (b) {
    const rel = t - b.ev.t;
    const m = b.morph;
    const route = b.ev.route;
    const origin =
      route === 'his'
        ? b.ev.aberrant === 'rbbb'
          ? 'aberrant (functional RBBB)'
          : b.ev.junctional
            ? 'junctional beat'
            : ''
        : route === 'ap'
          ? `pre-excited via ${AP_SITE[b.ev.apLocation ?? R.ap.location].label}`
          : route === 'paced'
            ? 'paced from the RV lead'
            : `from a focus: ${b.ev.site ? VENT_SITE[b.ev.site].label : 'ventricle'}`;
    if (rel < m.qrsDur) set('qrs', 'now', origin || undefined);
    else if (rel < m.tEnd + 200) set('qrs', 'done', origin || undefined);
    if (rel >= m.qrsDur && rel < m.tStart) set('st', 'now');
    else if (rel >= m.tStart && rel < m.tEnd + 200) set('st', 'done');
    if (rel >= m.tStart && rel < m.tEnd) set('t', 'now');
    else if (rel >= m.tEnd && rel < m.tEnd + 200) set('t', 'done');
    if ((route === 'focus' || route === 'paced') && rel < m.tEnd + 200 && !(Number.isFinite(b.ev.hisDelay) && b.ev.hisDelay < 70)) {
      for (const id of ['his', 'bb', 'purk'] as const) set(id, 'bypassed', id === 'his' ? 'not used by this beat' : undefined);
    }
    if (route === 'ap' && rel < m.qrsDur) set('ap', 'now', 'pre-excites the ventricle');
  }
  return steps;
}
