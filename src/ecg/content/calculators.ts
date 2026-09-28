// Pure clinical calculators used by the Tools page. Educational: they reproduce published
// formulas and decision rules and cite them; they are not a substitute for clinical judgement.

export interface QtcResult {
  rr: number; // ms
  bazett: number;
  fridericia: number;
  framingham: number;
  hodges: number;
}

/** QT correction formulas. QT in ms, heart rate in beats/min. */
export function qtc(qtMs: number, hr: number): QtcResult {
  const rrS = 60 / hr;
  return {
    rr: Math.round(rrS * 1000),
    bazett: Math.round(qtMs / Math.sqrt(rrS)),
    fridericia: Math.round(qtMs / Math.cbrt(rrS)),
    framingham: Math.round(qtMs + 154 * (1 - rrS)),
    hodges: Math.round(qtMs + 1.75 * (hr - 60)),
  };
}

export interface ChadsInput {
  chf: boolean;
  htn: boolean;
  age: number;
  dm: boolean;
  strokeTia: boolean;
  vascular: boolean;
  female: boolean;
}

/** CHA₂DS₂-VASc (Lip et al., Chest 2010) and CHA₂DS₂-VA (sex removed; 2024 ESC AF guideline). */
export function chadsVasc(x: ChadsInput): { vasc: number; va: number } {
  const age = x.age >= 75 ? 2 : x.age >= 65 ? 1 : 0;
  const va = (x.chf ? 1 : 0) + (x.htn ? 1 : 0) + age + (x.dm ? 1 : 0) + (x.strokeTia ? 2 : 0) + (x.vascular ? 1 : 0);
  return { vasc: va + (x.female ? 1 : 0), va };
}

/**
 * Anticoagulation guidance text for a CHA₂DS₂-VASc score, following the 2023 ACC/AHA/ACCP/HRS
 * AF guideline (annual stroke risk ≥ 2% ≈ score ≥ 2 men / ≥ 3 women → recommended; 1–2% ≈ 1 men /
 * 2 women → reasonable) with the 2024 ESC CHA₂DS₂-VA thresholds alongside.
 */
export function chadsAdvice(x: ChadsInput): { acc: string; esc: string } {
  const { vasc, va } = chadsVasc(x);
  const nonSex = x.female ? vasc - 1 : vasc;
  const acc = nonSex >= 2 ? 'Oral anticoagulation recommended (estimated annual thromboembolic risk ≥ 2%).' : nonSex === 1 ? 'Oral anticoagulation is reasonable (estimated annual risk 1–2%); shared decision-making.' : 'Low risk: anticoagulation not indicated on the score alone.';
  const esc = va >= 2 ? 'CHA₂DS₂-VA ≥ 2: oral anticoagulation recommended.' : va === 1 ? 'CHA₂DS₂-VA = 1: oral anticoagulation should be considered.' : 'CHA₂DS₂-VA = 0: no anticoagulation for stroke prevention on the score alone.';
  return { acc, esc };
}

export interface SgarbossaInput {
  /** Concordant ST elevation ≥ 1 mm in any lead with a positive QRS. */
  concordantSTE: boolean;
  /** Concordant ST depression ≥ 1 mm in V1, V2 or V3. */
  concordantSTDV1V3: boolean;
  /** Discordant ST elevation ≥ 5 mm (original criterion 3). */
  discordantSTE5: boolean;
  /** Most discordant lead: ST deviation (mm, signed) and preceding R or S amplitude (mm, signed). */
  discordantST?: number;
  discordantRS?: number;
}

export function sgarbossa(x: SgarbossaInput): { score: number; original: boolean; smithRatio: number | null; smith: boolean } {
  const score = (x.concordantSTE ? 5 : 0) + (x.concordantSTDV1V3 ? 3 : 0) + (x.discordantSTE5 ? 2 : 0);
  let smithRatio: number | null = null;
  if (x.discordantST !== undefined && x.discordantRS !== undefined && x.discordantRS !== 0) smithRatio = x.discordantST / x.discordantRS;
  // Smith-modified rule: criterion 3 replaced by ST/S ratio ≤ −0.25 (proportionally excessive discordance).
  const smithDisc = smithRatio !== null && smithRatio <= -0.25 && Math.abs(x.discordantST ?? 0) >= 1;
  return { score, original: score >= 3, smithRatio, smith: x.concordantSTE || x.concordantSTDV1V3 || smithDisc };
}

export interface WctStep {
  id: string;
  question: string;
  ifYes: 'VT' | 'next';
  why: string;
}

/** Brugada 1991 four-step algorithm. */
export const BRUGADA_WCT: WctStep[] = [
  { id: 'rs', question: 'Is an RS complex ABSENT from all precordial leads (V1–V6)?', ifYes: 'VT', why: 'Concordant precordial complexes (all positive or all negative) imply activation starting from the base or apex of the ventricle itself — impossible with bundle-branch conduction.' },
  { id: 'rsInterval', question: 'Is the R-to-S interval (onset of R to nadir of S) > 100 ms in any precordial lead?', ifYes: 'VT', why: 'Aberrant conduction still uses Purkinje fibres initially, so the first part of the QRS is fast; VT starts in muscle, so initial activation is slow.' },
  { id: 'avd', question: 'Is there AV dissociation (P waves unrelated to QRS, capture or fusion beats)?', ifYes: 'VT', why: 'The atria beating independently prove the tachycardia arises below the AV node (though VA conduction can exist in VT, so its absence does not exclude VT).' },
  { id: 'morph', question: 'Do V1–V2 and V6 meet the morphology criteria for VT (e.g. RBBB-type: monophasic R or qR in V1, R/S < 1 or QS in V6; LBBB-type: R in V1–V2 > 30 ms, > 60 ms to S nadir, notched S; any Q in V6)?', ifYes: 'VT', why: 'Aberrancy reproduces the typical bundle-branch shapes (rsR′ in V1, qRs in V6); deviations imply a myocardial origin.' },
];

/** Vereckei 2008 aVR algorithm. */
export const VERECKEI_AVR: WctStep[] = [
  { id: 'initialR', question: 'Is there an initial R wave in aVR?', ifYes: 'VT', why: 'aVR looks from the right shoulder: initial activation toward it means the ventricles are activated from the apex/inferior wall upward — not via the normal septal route.' },
  { id: 'initial40', question: 'Is the width of an initial r or q wave > 40 ms?', ifYes: 'VT', why: 'A slow initial deflection means activation starts in muscle rather than in the fast Purkinje network.' },
  { id: 'notch', question: 'Is there a notch on the descending limb of a negative-onset, predominantly negative QRS?', ifYes: 'VT', why: 'Notching reflects slow, cell-to-cell early activation.' },
  { id: 'vivt', question: 'Is vi/vt ≤ 1 (voltage change in the initial 40 ms ≤ that in the terminal 40 ms)?', ifYes: 'VT', why: 'In aberrancy the initial activation is fast (large vi) and the delay is terminal; in VT the initial activation is slow (small vi).' },
];

export function runWct(steps: WctStep[], answers: boolean[]): { result: 'VT' | 'SVT with aberrancy' | 'incomplete'; stoppedAt: number } {
  for (let i = 0; i < steps.length; i++) {
    if (answers[i] === undefined) return { result: 'incomplete', stoppedAt: i };
    if (answers[i]) return { result: 'VT', stoppedAt: i };
  }
  return { result: 'SVT with aberrancy', stoppedAt: steps.length - 1 };
}
