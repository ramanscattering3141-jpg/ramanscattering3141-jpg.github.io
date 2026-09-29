// "What is happening at this instant?" — a time-resolved explanation of the simulated ECG.
//
// Every ECG sample in this app is the projection of the summed dipole components of the
// atrial and ventricular beats (morphology.ts). This module looks up which components are
// active at time t, where the impulse is in the conduction system (ladder/log), which ECG
// segment is being written, and phrases that as a causal explanation. It uses the very same
// data that generated the waveform, so the explanation cannot drift from the tracing.

import type { EcgRun } from './index';
import type { BeatInfo } from './synth';
import { buildP, shapeAt, VENT_SITE, AP_SITE, TERRITORY, type Comp } from './morphology';
import { LEADS, TWELVE, type LeadId } from './leads';
import type { AtrialEvent } from './rhythm';
import { norm, type Vec3 } from './vec';

export type PhaseId = 'P' | 'PR' | 'QRS' | 'ST' | 'T' | 'U' | 'TP' | 'F' | 'VF' | 'blockedP';

export interface Phase {
  id: PhaseId;
  label: string;
  /** Interval of the ECG segment currently being written (ms). */
  t0: number;
  t1: number;
}

export interface ActiveComp {
  tag: string;
  chamber: 'atria' | 'ventricles';
  /** Fraction of the summed instantaneous dipole magnitude. */
  weight: number;
  dir: Vec3;
  /** Plain-language direction, e.g. "leftward, inferior, posterior". */
  heading: string;
  toward: LeadId[];
  away: LeadId[];
}

export interface Moment {
  t: number;
  phase: Phase;
  /** The ventricular beat whose QRS–T window contains t (or the next one during P/PR). */
  beat: BeatInfo | null;
  /** Time of the atrial event producing the current P wave, if any. */
  atrial: AtrialEvent | null;
  comps: ActiveComp[];
  /** Where the impulse is / what it is doing (conduction system level). */
  conduction: string[];
  /** Why this segment looks the way it does for this rhythm (mechanism level). */
  why: string[];
  /** Instantaneous heart vector (mV, body frame x left, y inferior, z anterior). */
  vector: Vec3;
  /** Recorded value in the selected lead (mV). */
  value: number;
  lead: LeadId;
}

const PHASE_LABEL: Record<PhaseId, string> = {
  P: 'P wave — atrial depolarisation',
  PR: 'PR segment — AV-nodal and His–Purkinje conduction',
  QRS: 'QRS complex — ventricular depolarisation',
  ST: 'ST segment — ventricular plateau (phase 2)',
  T: 'T wave — ventricular repolarisation (phase 3)',
  U: 'U wave / end of repolarisation',
  TP: 'TP segment — electrical diastole (phase 4)',
  F: 'Atrial flutter / fibrillation waves',
  VF: 'Ventricular fibrillation / flutter',
  blockedP: 'Non-conducted P wave',
};

export function heading(d: Vec3): string {
  const v = norm(d);
  const out: string[] = [];
  if (Math.abs(v[0]) > 0.35) out.push(v[0] > 0 ? 'leftward' : 'rightward');
  if (Math.abs(v[1]) > 0.35) out.push(v[1] > 0 ? 'inferior' : 'superior');
  if (Math.abs(v[2]) > 0.35) out.push(v[2] > 0 ? 'anterior' : 'posterior');
  return out.join(', ') || 'small';
}

function leadsFacing(d: Vec3): { toward: LeadId[]; away: LeadId[] } {
  const v = norm(d);
  const toward: LeadId[] = [];
  const away: LeadId[] = [];
  for (const id of TWELVE) {
    const a = LEADS[id].axis;
    const k = v[0] * a[0] + v[1] * a[1] + v[2] * a[2];
    if (k > 0.55) toward.push(id);
    else if (k < -0.55) away.push(id);
  }
  return { toward, away };
}

/** Explanation cache per run (P-wave components per site, beat lookup). */
const pCache = new WeakMap<EcgRun, Map<string, { comps: Comp[]; pDur: number }>>();
function pMorph(run: EcgRun, site: AtrialEvent['site']): { comps: Comp[]; pDur: number } {
  let m = pCache.get(run);
  if (!m) {
    m = new Map();
    pCache.set(run, m);
  }
  let v = m.get(site);
  if (!v) {
    v = buildP(run.physio, site);
    m.set(site, v);
  }
  return v;
}

/** Index of the ventricular beat (in sig.beats) whose window [t, next beat) contains time t. */
export function beatAt(run: EcgRun, t: number): BeatInfo | null {
  const beats = run.sig.beats;
  let best: BeatInfo | null = null;
  for (const b of beats) {
    if (b.ev.t <= t) best = b;
    else break;
  }
  return best;
}

export function explainAt(run: EcgRun, t: number, lead: LeadId = 'II'): Moment {
  const { sim, sig, physio: p } = run;
  const i = Math.max(0, Math.min(sig.n - 1, Math.round(((t - sig.from) * sig.fs) / 1000)));
  const vector: Vec3 = [sig.vcg[0][i], sig.vcg[1][i], sig.vcg[2][i]];
  const value = sig.leads[lead]?.[i] ?? 0;
  const conduction: string[] = [];
  const why: string[] = [];
  const active: { c: Comp; w: number; chamber: 'atria' | 'ventricles' }[] = [];

  // ---- Ventricular beat context
  const beat = beatAt(run, t);
  const next = sig.beats.find((b) => b.ev.t > t) ?? null;
  let phase: Phase | null = null;
  if (beat) {
    const rel = t - beat.ev.t;
    const m = beat.morph;
    for (const c of m.comps) {
      const w = c.amp * shapeAt(c.shape, (rel - c.t0) / c.dur);
      if (w > 1e-4) active.push({ c, w, chamber: 'ventricles' });
    }
    if (rel < m.qrsDur) phase = { id: 'QRS', label: PHASE_LABEL.QRS, t0: beat.ev.t, t1: beat.ev.t + m.qrsDur };
    else if (rel < m.tStart) phase = { id: 'ST', label: PHASE_LABEL.ST, t0: beat.ev.t + m.qrsDur, t1: beat.ev.t + m.tStart };
    else if (rel < m.tEnd) phase = { id: 'T', label: PHASE_LABEL.T, t0: beat.ev.t + m.tStart, t1: beat.ev.t + m.tEnd };
    else if (rel < m.tEnd + 120) phase = { id: 'U', label: PHASE_LABEL.U, t0: beat.ev.t + m.tEnd, t1: beat.ev.t + m.tEnd + 120 };
  }
  // Previous beat's T wave can overlap the next P wave; include its components too.
  const prev = beat ? sig.beats[sig.beats.indexOf(beat) - 1] : undefined;
  if (prev) {
    const rel = t - prev.ev.t;
    for (const c of prev.morph.comps) {
      const w = c.amp * shapeAt(c.shape, (rel - c.t0) / c.dur);
      if (w > 1e-4) active.push({ c, w, chamber: 'ventricles' });
    }
  }

  // ---- Atrial activity
  let atrial: AtrialEvent | null = null;
  for (const a of sim.atrial) {
    if (a.kind === 'flutter' || a.t > t) continue;
    const pm = pMorph(run, a.site);
    const rel = t - a.t;
    if (rel > pm.pDur + 260) continue;
    for (const c of pm.comps) {
      const w = c.amp * shapeAt(c.shape, (rel - c.t0) / c.dur);
      if (w > 1e-4) active.push({ c, w, chamber: 'atria' });
    }
    if (rel <= pm.pDur) atrial = a;
  }
  const inQrs = phase?.id === 'QRS';
  if (atrial) {
    const pm = pMorph(run, atrial.site);
    if (inQrs) conduction.push('A P wave is being written at the same time — it is hidden inside the QRS.');
    else phase = { id: 'P', label: PHASE_LABEL.P, t0: atrial.t, t1: atrial.t + pm.pDur };
    conduction.push(`Atria: ${atrial.label}.`);
    why.push(atrialWhy(atrial));
  }

  // ---- Continuous mechanisms
  for (const c of sim.continuous) {
    if (t < c.t0 || t > c.t1) continue;
    if (c.kind === 'flutter' || c.kind === 'fib') {
      if (!phase || phase.id === 'TP' || phase.id === 'U') phase = { id: 'F', label: PHASE_LABEL.F, t0: t - 100, t1: t + 100 };
      if (c.kind === 'flutter') {
        conduction.push(`Atria: macro-re-entry around the tricuspid annulus (cycle ${Math.round(c.cl ?? 200)} ms).`);
        why.push('Flutter waves: the circuit is always active somewhere, so there is no isoelectric baseline between waves (sawtooth). Typical counter-clockwise flutter travels UP the septum → negative waves in II, III, aVF.');
      } else {
        conduction.push('Atria: multiple wandering wavelets (fibrillation) — no organised P wave.');
        why.push('Fibrillation: hundreds of small wavefronts cancel each other → low, irregular f waves; the AV node filters them irregularly (concealed conduction) → irregularly irregular QRS.');
      }
    } else {
      phase = { id: 'VF', label: PHASE_LABEL.VF, t0: t - 100, t1: t + 100 };
      conduction.push(c.kind === 'vf' ? 'Ventricles: chaotic wavelets — no coordinated activation, no output.' : 'Ventricles: one very rapid circuit — sine-wave pattern.');
    }
  }

  // ---- Conduction system (ladder)
  const hisBlocks = sim.log.filter((l) => l.kind === 'block' && l.node === 'HIS').map((l) => l.t);
  for (const sg of sim.ladder) {
    const lo = Math.min(sg.t0, sg.t1);
    const hi = Math.max(sg.t0, sg.t1);
    if (t < lo || t > hi + (sg.blocked ? 120 : 0)) continue;
    // A blocked A→V segment whose impulse was logged as failing in the His–Purkinje system is an
    // infranodal block (e.g. Mobitz II), not an AV-nodal one.
    const infra = sg.blocked && hisBlocks.some((x) => x >= lo - 20 && x <= hi + 60);
    if (sg.row === 'AP') conduction.push(sg.blocked ? 'Accessory pathway: impulse blocked.' : `Accessory pathway: ${sg.dir === 'ante' ? 'antegrade (atrium → ventricle)' : 'retrograde (ventricle → atrium)'} conduction.`);
    else if (infra) continue;
    else if (sg.blocked) conduction.push(`AV node${pathName(sg.path)}: impulse BLOCKED — it dies in the node, so no QRS follows this P.`);
    else if (sg.dir === 'ante') conduction.push(`AV node${pathName(sg.path)}: antegrade conduction (slow, Ca²⁺-dependent) — this delay is the PR segment.`);
    else conduction.push(`AV node${pathName(sg.path)}: retrograde conduction back to the atria.`);
  }
  for (const lg of sim.log) {
    if (lg.kind !== 'block' || t < lg.t || t > lg.t + 200) continue;
    if (lg.node === 'HIS') conduction.push(`His–Purkinje: ${lg.note ?? 'block'} — the impulse passed the AV node but failed below it (infranodal block).`);
    else if (lg.node === 'SA') conduction.push(`Sinus node: ${lg.note ?? 'no discharge'}.`);
    else if (lg.node === 'PM') conduction.push(`Pacemaker: ${lg.note}.`);
    else if (lg.node === 'V' && lg.note) conduction.push(`Ventricles: ${lg.note}.`);
    else if (lg.node === 'A' && lg.note) conduction.push(`Atria: ${lg.note}.`);
  }
  for (const s of sim.spikes) if (t >= s.t && t < s.t + 30) conduction.push(s.chamber === 'shock' ? '⚡ Shock: the whole myocardium is depolarised at once.' : `⚡ Pacing stimulus (${s.chamber === 'A' ? 'atrium' : 'ventricle'})${s.captured ? '' : ' — NO capture'}.`);

  // ---- PR segment, blocked P, diastole
  if (!phase) {
    const lastA = [...sim.atrial].reverse().find((a) => a.t <= t && a.kind !== 'flutter');
    if (lastA && next && next.ev.atrialIndex === sim.atrial.indexOf(lastA)) {
      phase = { id: 'PR', label: PHASE_LABEL.PR, t0: lastA.t + pMorph(run, lastA.site).pDur, t1: next.ev.t };
      why.push(`PR segment: the impulse is inside the AV node and His–Purkinje system. These structures are too small to generate a surface voltage, so the baseline is flat; the node’s slow Ca²⁺-dependent conduction is what makes it long${run.m.pr && run.m.pr > 200 ? ` (here prolonged: PR ≈ ${run.m.pr} ms)` : ''}.`);
      if (next.ev.route === 'ap') why.push('Pre-excitation: part of the ventricle is already activated through the accessory pathway, so the PR is short and the QRS starts with a slurred delta wave.');
    } else if (lastA && !lastA.conducted && t - lastA.t < 600) {
      phase = { id: 'blockedP', label: PHASE_LABEL.blockedP, t0: lastA.t, t1: lastA.t + pMorph(run, lastA.site).pDur };
      why.push('This P wave is not followed by a QRS: the atrial impulse was blocked (AV node refractory or diseased, or infranodal block) — see the conduction line above.');
    } else phase = { id: 'TP', label: PHASE_LABEL.TP, t0: t - 50, t1: t + 50 };
  }

  // ---- Mechanism of the segment for this beat
  if (beat) why.push(...ventricularWhy(run, beat, phase.id));

  // ---- Components
  const total = active.reduce((s, a) => s + a.w, 0) || 1;
  const merged = new Map<string, { c: Comp; w: number; chamber: 'atria' | 'ventricles' }>();
  for (const a of active) {
    const k = `${a.chamber}:${a.c.tag}`;
    const cur = merged.get(k);
    if (cur) cur.w += a.w;
    else merged.set(k, { ...a });
  }
  const mirror = p.dextrocardia;
  const comps: ActiveComp[] = [...merged.values()]
    .filter((a) => a.w / total > 0.06 && !/^(Ta|U wave)$/.test(a.c.tag))
    .sort((a, b) => b.w - a.w)
    .slice(0, 4)
    .map((a) => {
      const dir: Vec3 = mirror ? [-a.c.dir[0], a.c.dir[1], a.c.dir[2]] : a.c.dir;
      return { tag: a.c.tag, chamber: a.chamber, weight: a.w / total, dir, heading: heading(dir), ...leadsFacing(dir) };
    });

  return { t, phase, beat, atrial, comps, conduction: [...new Set(conduction)], why: [...new Set(why.filter(Boolean))], vector, value, lead };
}

function pathName(path: string): string {
  if (path.includes('fast')) return ' (fast pathway)';
  if (path.includes('slow')) return ' (slow pathway)';
  return '';
}

function atrialWhy(a: AtrialEvent): string {
  if (a.kind === 'retro') return 'Retrograde P: the atria are activated from the AV junction or an accessory pathway, bottom-to-top → the P vector points superiorly (negative in II, III, aVF).';
  if (a.kind === 'paced') return 'Paced P: the atrial lead depolarises the atrium from its tip.';
  if (a.site === 'sinus' || a.site === 'highRA' || a.site === 'crista') return 'Sinus P: activation starts high in the right atrium and spreads down and to the left (RA first, then LA via Bachmann’s bundle) → vector leftward-inferior → upright P in I and II.';
  if (a.site === 'lowRA' || a.site === 'lowLA') return 'Low atrial focus: activation spreads upward → inverted P in II, III, aVF.';
  if (a.site === 'leftAtrial') return 'Left atrial focus: activation spreads rightward → negative P in I/aVL, positive (dome) P in V1.';
  return '';
}

function ventricularWhy(run: EcgRun, beat: BeatInfo, ph: PhaseId): string[] {
  const p = run.physio;
  const ev = beat.ev;
  const out: string[] = [];
  const bundle = ev.route === 'his' && ev.aberrant === 'rbbb' && !p.bundle.startsWith('rbbb') ? 'rbbb' : p.bundle;
  if (ph === 'QRS') {
    if (ev.route === 'his') {
      if (ev.junctional) out.push('Junctional beat: the impulse starts in the AV junction but still uses the His–Purkinje system → normal-width QRS; the atria are activated retrogradely or not at all.');
      if (ev.aberrant === 'rbbb') out.push('Aberrant conduction (Ashman): the premature impulse found the right bundle still refractory after a long preceding cycle → functional RBBB for this beat only.');
      const BB: Record<string, string> = {
        normal: 'His → bundle branches → Purkinje network activate the endocardium almost simultaneously → fast, narrow QRS. The septum goes first (left→right: small q in I/V6, small r in V1), then the thick LV free wall dominates (tall R in V5–V6).',
        rbbb: 'Right bundle blocked: the septum and LV activate normally (first part of the QRS unchanged), then the RV is activated late, cell-to-cell from the left → a terminal rightward/anterior force: R′ in V1, broad S in I and V6.',
        incompleteRbbb: 'Incomplete right-bundle delay: late RV activation adds a small terminal r′ in V1.',
        lbbb: 'Left bundle blocked: the septum is activated from the RIGHT side (right→left, so no septal q in I/V6) and the LV is activated slowly through working muscle → broad, notched R in I/V5–V6, QS in V1.',
        lafb: 'Left anterior fascicle blocked: the LV is entered through the posterior fascicle (initial inferior force: q in I/aVL, r in II/III), then the anterosuperior wall activates last → left axis deviation.',
        lpfb: 'Left posterior fascicle blocked: initial superior-leftward activation, then the inferoposterior wall last → right axis deviation.',
        'rbbb+lafb': 'Bifascicular block: RBBB (late RV) plus LAFB (late anterosuperior LV) — only the posterior fascicle conducts.',
        'rbbb+lpfb': 'Bifascicular block: RBBB plus LPFB — only the anterior fascicle conducts.',
        ivcd: 'Diffusely slow myocardial conduction: normal sequence, stretched in time → wide QRS without a bundle-branch pattern.',
      };
      out.push(BB[bundle] ?? BB.normal);
    } else if (ev.route === 'ap') {
      const loc = AP_SITE[ev.apLocation ?? p.rhythm.ap.location].label;
      out.push(Number.isFinite(ev.hisDelay) && ev.hisDelay < 170 ? `Delta wave: the accessory pathway (${loc}) activates the ventricle near its insertion ${Math.round(ev.hisDelay)} ms before the His impulse arrives; that muscle conducts slowly (slurred upstroke). Then the normal system takes over → fusion QRS.` : `Fully pre-excited QRS: the whole ventricle is activated from the accessory pathway insertion (${loc}) through muscle → wide QRS.`);
    } else if (ev.route === 'paced') {
      out.push('Paced beat: the stimulus depolarises myocardium at the lead tip (RV apex); activation spreads cell-to-cell away from the apex → wide, LBBB-like QRS with a superior axis.');
    } else {
      const site = ev.site ? VENT_SITE[ev.site].label : 'a ventricular focus';
      out.push(`Ectopic ventricular activation from ${site}: no Purkinje network at the start, so activation creeps cell-to-cell → wide, bizarre QRS pointing away from the origin.`);
      if (Number.isFinite(ev.hisDelay) && ev.hisDelay < 70) out.push('Fusion: a conducted sinus impulse arrived through the His bundle during this beat and activated part of the ventricles → intermediate morphology.');
    }
    const isch = p.ischemia;
    if ((isch.stage === 'old' || isch.stage === 'evolving' || isch.stage === 'aneurysm') && isch.territory !== 'diffuseSubendo') out.push(`Scar in the ${TERRITORY[isch.territory].label.toLowerCase()} territory generates no forces: the early vector points AWAY from it → Q waves in ${TERRITORY[isch.territory].leads.split(';')[0]}.`);
    if (p.hcm > 0.2) out.push('Hypertrophied septum: the first (septal) force is exaggerated → deep, narrow Q waves in the lateral/inferior leads.');
    if (p.K > 6.5) out.push('Hyperkalaemia: a less negative resting potential inactivates Na⁺ channels → slower phase 0 → wider QRS.');
    if (p.drugs.naBlocker > 0.3) out.push('Na⁺-channel blockade slows conduction, especially the terminal rightward forces → wide QRS, R in aVR.');
  } else if (ph === 'ST') {
    const isch = p.ischemia;
    if (isch.stage === 'stemi' || isch.stage === 'hyperacute' || isch.stage === 'evolving' || isch.stage === 'aneurysm') out.push(`ST segment: healthy cells sit at the plateau, but the injured ${TERRITORY[isch.territory].label.toLowerCase()} myocardium has a lower plateau/shortened action potential. The injury current points TOWARD the injured epicardium → ST elevation in leads facing it (${TERRITORY[isch.territory].leads}), reciprocal depression opposite.`);
    else if (isch.stage === 'subendocardial' || isch.stage === 'deWinter') out.push('ST segment: the injury is subendocardial, so the injury current points toward the cavity → ST depression in most leads, elevation in aVR.');
    else if (p.pericarditis >= 1 && p.pericarditis < 2) out.push('ST segment: diffuse epicardial inflammation → an ST vector toward the apex → concave ST elevation in most leads, depression in aVR.');
    else if (p.brugada) out.push('ST segment: loss of the RVOT epicardial action-potential dome creates a transmural voltage gradient seen only by V1–V2 → coved/saddleback ST elevation.');
    else if (p.drugs.digoxin > 0) out.push('ST segment: digoxin shortens the plateau and changes its slope → sagging ("reverse tick") ST depression.');
    else if (ev.route !== 'his' || p.bundle !== 'normal') out.push('ST segment: after abnormal activation, repolarisation also follows an abnormal sequence → secondary ST deviation OPPOSITE to the main QRS deflection.');
    else out.push('ST segment: every ventricular cell is at its plateau (phase 2, Ca²⁺ in ≈ K⁺ out) at nearly the same voltage → no gradient → isoelectric.');
  } else if (ph === 'T') {
    if (p.K > 5.8) out.push('T wave: high extracellular K⁺ increases IKr conductance → phase 3 faster and more synchronous → tall, narrow, peaked T.');
    else if (p.K < 3.3) out.push('T wave: low K⁺ reduces repolarising currents → flat T, and late repolarisation appears as a U wave.');
    else if (ev.route !== 'his' || p.bundle !== 'normal') out.push('T wave (secondary): repolarisation follows the abnormal activation order, so the T vector points opposite to the abnormal part of the QRS → discordant T.');
    else if (p.ischemia.stage === 'wellens' || p.ischemia.stage === 'evolving' || p.ischemia.stage === 'takotsubo') out.push('T wave (primary): the ischaemic/stunned region repolarises LATE, so the repolarisation vector points away from it → deep inverted T waves over that region.');
    else out.push('T wave: the epicardium has a shorter action potential and repolarises FIRST, although it depolarised last. So the repolarisation vector points in the same direction as depolarisation → upright T in leads with an upright QRS.');
    if (p.qtcBase > 470 || p.drugs.qtDrug > 0.3) out.push('Long QT: reduced repolarising K⁺ current (or drug IKr block) prolongs phase 3 → the T wave ends late; early afterdepolarisations can trigger torsades.');
  } else if (ph === 'TP' || ph === 'U') {
    out.push('Electrical diastole: ventricular cells are at their resting potential (phase 4); pacemaker cells in the sinus node slowly depolarise toward threshold.');
  }
  return out;
}
