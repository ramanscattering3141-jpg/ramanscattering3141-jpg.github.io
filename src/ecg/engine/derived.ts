// Derived electrophysiological quantities: how drugs, electrolytes, autonomic tone and
// temperature modify conduction and repolarisation. Each function is deliberately simple
// and monotonic so that the causal direction is always physiologically correct; the
// magnitudes are educational approximations, not patient-specific predictions.

import type { Physio } from './params';
import { clamp, smoothstep } from './vec';

/** Effective QTc (ms) before rate adaptation, including drug/electrolyte/temperature effects. */
export function qtcEffective(p: Physio): number {
  let q = p.qtcBase;
  if (p.sex === 'F') q += 8;
  q += 85 * p.drugs.qtDrug; // IKr block prolongs phase 3
  q += 45 * p.drugs.amiodarone;
  q += 15 * p.drugs.naBlocker;
  q -= 25 * Math.min(1.2, p.drugs.digoxin); // digoxin shortens ventricular APD
  // Calcium acts mainly on the plateau (phase 2) → ST-segment length.
  if (p.Ca < 2.15) q += (2.15 - p.Ca) * 260;
  if (p.Ca > 2.6) q -= (p.Ca - 2.6) * 150;
  // Hypokalaemia prolongs repolarisation (and the apparent Q–U interval).
  if (p.K < 3.5) q += (3.5 - p.K) * 35;
  if (p.K > 5.5) q -= Math.min(40, (p.K - 5.5) * 15);
  if (p.Mg < 0.7) q += (0.7 - p.Mg) * 90;
  q += 90 * p.hypothermia;
  if (p.ischemia.stage === 'wellens' || p.ischemia.stage === 'evolving') q += 25 * p.ischemia.extent;
  q -= 35 * Math.max(0, p.autonomic) * 0.5;
  return clamp(q, 260, 720);
}

/** Rate-adapted QT (ms) using the Fridericia relation QT = QTc·(RR/1000)^(1/3). */
export function qtAtRR(qtc: number, rr: number): number {
  return qtc * Math.cbrt(clamp(rr, 250, 3000) / 1000);
}

/** Multiplier on ventricular activation time (1 = normal ~90 ms QRS). */
export function ventricularWidthFactor(p: Physio): number {
  let f = 1 / clamp(p.ventricularCV, 0.3, 2);
  f *= 1 + 0.85 * p.drugs.naBlocker; // slowed phase 0 upstroke → slower conduction
  f *= 1 + 0.08 * p.drugs.amiodarone;
  // Hyperkalaemia: depolarised resting potential inactivates Na channels → slower conduction.
  if (p.K > 6.5) f *= 1 + (p.K - 6.5) * 0.32;
  if (p.K > 8) f *= 1 + (p.K - 8) * 0.2; // pre-terminal: very wide, bizarre QRS (≥ 180 ms at K⁺ > 9)
  f *= 1 + 0.25 * p.hypothermia;
  f *= 1 + 0.12 * p.myocarditis;
  f *= 1 + 0.06 * Math.max(0, p.lvMass - 1);
  if (p.Mg > 2) f *= 1 + (p.Mg - 2) * 0.12; // marked hypermagnesaemia slows conduction
  return clamp(f, 0.6, 3.2);
}

/** Atrial conduction multiplier (P-wave duration). */
export function atrialWidthFactor(p: Physio): number {
  let f = 1 / clamp(p.atrialCV, 0.3, 2);
  if (p.K > 6) f *= 1 + (p.K - 6) * 0.12;
  f *= 1 + 0.25 * p.drugs.naBlocker;
  return f;
}

/** P-wave amplitude multiplier: hyperkalaemia flattens then abolishes P waves (atrial myocytes are especially K-sensitive). */
export function atrialAmpFactor(p: Physio): number {
  return p.K > 6.2 ? clamp(1 - (p.K - 6.2) / 2.2, 0, 1) : 1;
}

export interface AvnMods {
  ahScale: number;
  erpAdd: number;
}

/** Tonic (non-bolus) modifiers of AV-nodal conduction. */
export function avnModifiers(p: Physio): AvnMods {
  const d = p.drugs;
  let ahScale = 1 + 0.35 * d.betaBlocker + 0.4 * d.ccb + 0.25 * Math.min(1.5, d.digoxin) + 0.25 * d.amiodarone;
  let erpAdd = 110 * d.betaBlocker + 130 * d.ccb + 90 * Math.min(1.5, d.digoxin) + 80 * d.amiodarone;
  // Sympathetic tone speeds and shortens nodal refractoriness; vagal tone does the opposite.
  ahScale *= 1 - 0.25 * p.autonomic;
  erpAdd += -90 * p.autonomic;
  ahScale *= 1 + 0.4 * p.hypothermia;
  if (p.K > 7) erpAdd += (p.K - 7) * 90;
  if (p.Mg > 2) {
    ahScale *= 1 + (p.Mg - 2) * 0.25;
    erpAdd += (p.Mg - 2) * 60;
  }
  return { ahScale: clamp(ahScale, 0.5, 3), erpAdd };
}

/** Drug effect on His–Purkinje conduction time (HV, ms added). */
export function hvAdd(p: Physio): number {
  return 25 * p.drugs.naBlocker + (p.K > 7 ? (p.K - 7) * 20 : 0);
}

/** Accessory-pathway refractoriness change (class I/III drugs lengthen it; AV-nodal blockers do not). */
export function apErpAdd(p: Physio): number {
  return 120 * p.drugs.naBlocker + 100 * p.drugs.amiodarone;
}

/** Overall ECG voltage multiplier (body habitus, effusion, infiltration, obesity). */
export function voltageFactor(p: Physio): number {
  return clamp(p.habitus, 0.3, 1.6) * (1 - 0.65 * p.lowVoltage) * (1 - 0.25 * p.myocarditis);
}

/** 0..1 severity of hyperkalaemic T-wave peaking. */
export const hyperKT = (K: number): number => smoothstep(5.2, 7.5, K);
/** 0..1 severity of hypokalaemic changes. */
export const hypoK = (K: number): number => smoothstep(3.6, 2.2, K) * 1;
