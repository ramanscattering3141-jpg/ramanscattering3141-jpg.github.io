// The equation registry. Every equation is live: the explorer, the chapter pages and the
// laboratory interpreter all render from these definitions. Formulas and coefficients follow the
// textbook's summary (Rose & Post ch. 30) unless a modern source is cited.

import type { Citation } from './sources';

export interface EqVar {
  key: string;
  label: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  value: number;
}

export interface EqResult {
  value: number;
  unit?: string;
  digits?: number;
  /** a short interpretation of this particular result */
  read?: string;
}

export interface EquationDef {
  id: string;
  name: string;
  /** display formula */
  formula: string;
  group: 'Units & osmolality' | 'Filtration & clearance' | 'Water & sodium' | 'Acid–base' | 'Potassium' | 'Minerals' | 'Respiratory';
  vars: EqVar[];
  compute: (v: Record<string, number>) => EqResult;
  /** substitute numbers into the formula for display */
  show: (v: Record<string, number>) => string;
  explain: string;
  caveat?: string;
  chapters: number[];
  route?: string;
  cite?: Citation;
  keywords?: string[];
}

const f = (x: number, d = 0) => (Number.isFinite(x) ? x.toFixed(d) : '—');

export const EQUATIONS: EquationDef[] = [
  // ------------------------------------------------------------------ units & osmolality
  {
    id: 'units',
    name: 'US units (mg/dL) → SI (mmol/L)',
    formula: 'mmol/L = (mg/dL × 10) ÷ molecular weight',
    group: 'Units & osmolality',
    vars: [
      { key: 'mg', label: 'Concentration', unit: 'mg/dL', min: 0, max: 1000, step: 1, value: 180 },
      { key: 'mw', label: 'Molecular weight', unit: 'g/mol', min: 1, max: 400, step: 0.1, value: 180 },
    ],
    compute: (v) => ({ value: (v.mg * 10) / v.mw, unit: 'mmol/L', digits: 2 }),
    show: (v) => `(${f(v.mg)} × 10) ÷ ${f(v.mw, 1)}`,
    explain: 'Canadian laboratories report in SI units; Rose & Post and most US sources use mg/dL. The factor of 10 converts per-decilitre to per-litre. Glucose (MW 180): mg/dL ÷ 18 = mmol/L. Blood urea nitrogen (two nitrogens, 28 g/mol): mg/dL ÷ 2.8 = urea mmol/L. Creatinine: mg/dL × 88.4 = µmol/L. Calcium: mg/dL × 0.25 = mmol/L. Albumin: g/dL × 10 = g/L.',
    chapters: [1, 30],
    keywords: ['conversion', 'millimole', 'milliequivalent'],
  },
  {
    id: 'posm',
    name: 'Calculated plasma osmolality',
    formula: 'Posm ≈ 2 × [Na⁺] + [glucose] + [urea]   (all mmol/L)',
    group: 'Units & osmolality',
    vars: [
      { key: 'na', label: 'Na⁺', unit: 'mmol/L', min: 100, max: 180, step: 1, value: 140 },
      { key: 'glu', label: 'Glucose', unit: 'mmol/L', min: 2, max: 80, step: 0.1, value: 5 },
      { key: 'urea', label: 'Urea', unit: 'mmol/L', min: 1, max: 70, step: 0.5, value: 5 },
    ],
    compute: (v) => {
      const val = 2 * v.na + v.glu + v.urea;
      return { value: val, unit: 'mOsm/kg', read: val < 275 ? 'Hypo-osmolal' : val > 295 ? 'Hyperosmolal' : 'Normal range (≈275–290)' };
    },
    show: (v) => `2 × ${f(v.na)} + ${f(v.glu, 1)} + ${f(v.urea, 1)}`,
    explain: 'Sodium is doubled to account for its accompanying anions. In SI units glucose and urea are added directly (the book, in mg/dL, divides glucose by 18 and BUN by 2.8). Urea counts toward measured osmolality but not toward tonicity, because it crosses cell membranes.',
    chapters: [1, 7, 22],
    route: '/body-water',
    keywords: ['osmolality', 'plasma osmolality', 'serum osmolality'],
  },
  {
    id: 'effosm',
    name: 'Effective osmolality (tonicity)',
    formula: 'Effective Posm ≈ 2 × [Na⁺] + [glucose]   (mmol/L)',
    group: 'Units & osmolality',
    vars: [
      { key: 'na', label: 'Na⁺', unit: 'mmol/L', min: 100, max: 180, step: 1, value: 140 },
      { key: 'glu', label: 'Glucose', unit: 'mmol/L', min: 2, max: 80, step: 0.1, value: 5 },
    ],
    compute: (v) => ({ value: 2 * v.na + v.glu, unit: 'mOsm/kg' }),
    show: (v) => `2 × ${f(v.na)} + ${f(v.glu, 1)}`,
    explain: 'Only solutes confined to the extracellular fluid move water across cell membranes. Tonicity, not measured osmolality, determines cell volume and the risk of cerebral oedema or demyelination.',
    chapters: [7, 22],
    route: '/body-water',
    keywords: ['tonicity'],
  },
  {
    id: 'osmgap',
    name: 'Plasma osmolal gap',
    formula: 'Osmolal gap = measured Posm − (2 × Na⁺ + glucose + urea)',
    group: 'Units & osmolality',
    vars: [
      { key: 'meas', label: 'Measured Posm', unit: 'mOsm/kg', min: 240, max: 400, step: 1, value: 290 },
      { key: 'na', label: 'Na⁺', unit: 'mmol/L', min: 100, max: 180, step: 1, value: 140 },
      { key: 'glu', label: 'Glucose', unit: 'mmol/L', min: 2, max: 80, step: 0.1, value: 5 },
      { key: 'urea', label: 'Urea', unit: 'mmol/L', min: 1, max: 70, step: 0.5, value: 5 },
    ],
    compute: (v) => {
      const gap = v.meas - (2 * v.na + v.glu + v.urea);
      return { value: gap, unit: 'mOsm/kg', read: gap > 10 ? 'Raised: an unmeasured osmole (ethanol, methanol, ethylene glycol, mannitol…)' : 'Not raised (normal ≈ <10)' };
    },
    show: (v) => `${f(v.meas)} − (2 × ${f(v.na)} + ${f(v.glu, 1)} + ${f(v.urea, 1)})`,
    explain: 'A gap between what the osmometer counts and what the three main solutes account for means another osmole is present. With a high anion gap acidosis, it points to methanol or ethylene glycol.',
    caveat: 'A normal osmolal gap does not exclude toxic alcohol ingestion, particularly late, once the parent alcohol has been metabolised to its acids.',
    chapters: [19, 22],
    route: '/metabolic-acidosis',
    cite: { rose: [19], evidence: 'clinical', refs: ['kraut2018toxic'] },
    keywords: ['toxic alcohol', 'methanol', 'ethylene glycol'],
  },
  {
    id: 'glucoseNa',
    name: 'Sodium in hyperglycaemia',
    formula: 'Corrected Na⁺ ≈ Na⁺ + 0.29 × (glucose − 5.5)  (Rose: 1.6 per 5.5 mmol/L)  — or 0.43 × (Hillier: 2.4 per 5.5)',
    group: 'Units & osmolality',
    vars: [
      { key: 'na', label: 'Measured Na⁺', unit: 'mmol/L', min: 100, max: 170, step: 1, value: 128 },
      { key: 'glu', label: 'Glucose', unit: 'mmol/L', min: 5.5, max: 80, step: 0.5, value: 44 },
    ],
    compute: (v) => {
      const corr = v.na + (1.6 / 5.55) * (v.glu - 5.55);
      const hill = v.na + (2.4 / 5.55) * (v.glu - 5.55);
      return { value: corr, unit: 'mmol/L', digits: 0, read: `Corrected ≈ ${f(corr)} (1.6 per 5.5 mmol/L); ≈ ${f(hill)} with the 2.4 factor` };
    },
    show: (v) => `${f(v.na)} + 0.29 × (${f(v.glu, 1)} − 5.5)`,
    explain: 'Glucose confined to the extracellular fluid draws water out of cells, diluting the sodium. The corrected value predicts the sodium once the glucose is normalised — and so whether the patient is truly water-depleted.',
    caveat: 'The textbook uses a fall of 1.6 mmol/L in Na⁺ for every 5.5 mmol/L (100 mg/dL) rise in glucose. An experimental study in volunteers found an average of 2.4, with 1.6 holding up to a glucose of ~22 mmol/L; both are used.',
    chapters: [25, 30],
    route: '/hyperglycemia',
    cite: { rose: [25, 30], evidence: 'physiology', refs: ['hillier1999'], update: 'In volunteers made acutely hyperglycaemic, Hillier et al. (1999) measured an average fall of 2.4 mmol/L per 5.5 mmol/L (100 mg/dL) of glucose, with the 1.6 factor accurate up to ~22 mmol/L (400 mg/dL) and underestimating above it.' },
    keywords: ['corrected sodium', 'pseudohyponatremia', 'translocational'],
  },

  // ------------------------------------------------------------------ filtration & clearance
  {
    id: 'nfp',
    name: 'Net filtration pressure (Starling)',
    formula: 'NFP = (Pgc − Pbs) − (πgc − πbs)',
    group: 'Filtration & clearance',
    vars: [
      { key: 'pgc', label: 'Glomerular capillary pressure', unit: 'mmHg', min: 20, max: 80, step: 1, value: 45 },
      { key: 'pbs', label: "Bowman's space pressure", unit: 'mmHg', min: 0, max: 50, step: 1, value: 10 },
      { key: 'pi', label: 'Capillary oncotic pressure', unit: 'mmHg', min: 10, max: 45, step: 1, value: 25 },
    ],
    compute: (v) => {
      const n = v.pgc - v.pbs - v.pi;
      return { value: n, unit: 'mmHg', read: n <= 0 ? 'No net filtration — equilibrium reached' : 'Net outward force' };
    },
    show: (v) => `(${f(v.pgc)} − ${f(v.pbs)}) − (${f(v.pi)} − 0)`,
    explain: 'Bowman’s space fluid is protein-free, so its oncotic pressure is zero. Capillary oncotic pressure rises along the capillary as filtrate leaves, so the net pressure falls from afferent to efferent end and may reach zero (filtration equilibrium).',
    chapters: [2],
    route: '/gfr',
    keywords: ['Starling forces', 'ultrafiltration'],
  },
  {
    id: 'starling',
    name: 'Starling forces at a systemic capillary',
    formula: 'Net = (Pcap − Pif) − σ(πcap − πif)',
    group: 'Filtration & clearance',
    vars: [
      { key: 'pcap', label: 'Capillary hydraulic pressure', unit: 'mmHg', min: 5, max: 45, step: 0.5, value: 17.3 },
      { key: 'pif', label: 'Interstitial hydraulic pressure', unit: 'mmHg', min: -6, max: 12, step: 0.5, value: -3 },
      { key: 'picap', label: 'Plasma oncotic pressure', unit: 'mmHg', min: 5, max: 35, step: 0.5, value: 28 },
      { key: 'piif', label: 'Interstitial oncotic pressure', unit: 'mmHg', min: 0, max: 22, step: 0.5, value: 8 },
      { key: 'sigma', label: 'Reflection coefficient σ', unit: '', min: 0, max: 1, step: 0.05, value: 0.95 },
    ],
    compute: (v) => {
      const n = v.pcap - v.pif - v.sigma * (v.picap - v.piif);
      return {
        value: n,
        unit: 'mmHg',
        read:
          n > 15
            ? 'Beyond the ~15 mmHg the safety factors can absorb — oedema forms'
            : n > 0.3
              ? 'Filtration raised, but within the safety margin; lymph flow carries it'
              : n < 0
                ? 'Net absorption'
                : 'Normal: a small outward gradient returned by the lymphatics',
      };
    },
    show: (v) => `(${f(v.pcap)} − ${f(v.pif)}) − ${f(v.sigma)}(${f(v.picap)} − ${f(v.piif)})`,
    explain:
      'The normal muscle capillary sits at about +0.3 mmHg, and the filtrate is returned by the lymphatics. Oedema needs roughly a 15 mmHg rise, because lymph flow increases, interstitial oncotic pressure washes out and interstitial hydraulic pressure rises. σ is the reflection coefficient: 1 if the wall is impermeable to protein, 0 if freely permeable — near 0 in the hepatic sinusoid, which is why portal hypertension so readily produces ascites, and reduced by capillary injury in burns and sepsis.',
    chapters: [7, 16],
    route: '/edema',
    keywords: ['Starling', 'oedema', 'oncotic', 'reflection coefficient', 'capillary'],
  },
  {
    id: 'gfrKf',
    name: 'GFR from Kf',
    formula: 'GFR = Kf × mean NFP',
    group: 'Filtration & clearance',
    vars: [
      { key: 'kf', label: 'Kf (both kidneys)', unit: 'mL/min/mmHg', min: 2, max: 30, step: 0.5, value: 12.5 },
      { key: 'nfp', label: 'Mean NFP', unit: 'mmHg', min: 0, max: 30, step: 0.5, value: 10 },
    ],
    compute: (v) => ({ value: v.kf * v.nfp, unit: 'mL/min' }),
    show: (v) => `${f(v.kf, 1)} × ${f(v.nfp, 1)}`,
    explain: 'Kf is the product of the capillary wall’s hydraulic permeability and its filtering surface area. Mesangial contraction (angiotensin II) and glomerular disease reduce it.',
    chapters: [2],
    route: '/gfr',
    keywords: ['filtration coefficient'],
  },
  {
    id: 'ff',
    name: 'Filtration fraction',
    formula: 'FF = GFR ÷ RPF',
    group: 'Filtration & clearance',
    vars: [
      { key: 'gfr', label: 'GFR', unit: 'mL/min', min: 10, max: 200, step: 1, value: 125 },
      { key: 'rpf', label: 'Renal plasma flow', unit: 'mL/min', min: 100, max: 1200, step: 5, value: 625 },
    ],
    compute: (v) => {
      const ff = v.gfr / v.rpf;
      return { value: ff * 100, unit: '%', digits: 1, read: ff > 0.25 ? 'High: efferent constriction or reduced plasma flow' : ff < 0.15 ? 'Low: efferent dilation or high plasma flow' : 'Normal ≈ 20%' };
    },
    show: (v) => `${f(v.gfr)} ÷ ${f(v.rpf)}`,
    explain: 'The filtration fraction sets the protein concentration — and oncotic pressure — in the peritubular capillary, which in turn modulates proximal sodium reabsorption.',
    chapters: [2, 3],
    route: '/arterioles',
  },
  {
    id: 'clearance',
    name: 'Renal clearance',
    formula: 'Cx = (Ux × V) ÷ Px',
    group: 'Filtration & clearance',
    vars: [
      { key: 'u', label: 'Urine concentration (e.g. creatinine)', unit: 'µmol/L', min: 500, max: 40000, step: 100, value: 11000 },
      { key: 'v', label: 'Urine flow', unit: 'mL/min', min: 0.2, max: 20, step: 0.1, value: 1 },
      { key: 'p', label: 'Plasma concentration', unit: 'µmol/L', min: 20, max: 1500, step: 1, value: 88 },
    ],
    compute: (v) => ({ value: (v.u * v.v) / v.p, unit: 'mL/min', digits: 1 }),
    show: (v) => `(${f(v.u)} × ${f(v.v, 1)}) ÷ ${f(v.p)}`,
    explain: 'U and P must be in the same unit — any unit will do. Clearance is the volume of plasma completely cleared of a substance per minute. For a substance that is filtered but neither reabsorbed nor secreted (inulin), clearance equals GFR. Higher than GFR means net secretion; lower means net reabsorption.',
    chapters: [2, 30],
    route: '/clearance',
    keywords: ['inulin', 'PAH', 'creatinine clearance'],
  },
  {
    id: 'crcl24',
    name: 'Creatinine clearance (timed urine)',
    formula: 'CrCl = (Ucr × 1000 × V) ÷ (Pcr × 1440)   [Ucr mmol/L, Pcr µmol/L, V mL/day]',
    group: 'Filtration & clearance',
    vars: [
      { key: 'ucr', label: 'Urine creatinine', unit: 'mmol/L', min: 1, max: 35, step: 0.1, value: 8.8 },
      { key: 'vol', label: '24-h urine volume', unit: 'mL', min: 200, max: 6000, step: 50, value: 1440 },
      { key: 'pcr', label: 'Plasma creatinine', unit: 'µmol/L', min: 30, max: 1300, step: 1, value: 88 },
    ],
    compute: (v) => ({ value: (v.ucr * 1000 * v.vol) / (v.pcr * 1440), unit: 'mL/min', digits: 0, read: `Creatinine excreted: ${((v.ucr * v.vol) / 1000).toFixed(1)} mmol/day` }),
    show: (v) => `(${f(v.ucr, 1)} × 1000 × ${f(v.vol)}) ÷ (${f(v.pcr)} × 1440)`,
    explain: 'A 24-hour collection measures creatinine excretion directly. Because some creatinine is secreted, creatinine clearance overestimates GFR — by 10–20% normally, and much more as GFR falls.',
    caveat: 'Check completeness: daily creatinine excretion should be about 0.18–0.22 mmol/kg in men and 0.13–0.18 mmol/kg in women (20–25 and 15–20 mg/kg).',
    chapters: [2],
    route: '/creatinine',
  },
  {
    id: 'cockcroft',
    name: 'Cockcroft–Gault',
    formula: 'CrCl ≈ (140 − age) × weight × 1.23 ÷ Pcr (µmol/L)   [1.04 instead of 1.23 if female]',
    group: 'Filtration & clearance',
    vars: [
      { key: 'age', label: 'Age', unit: 'years', min: 18, max: 95, step: 1, value: 60 },
      { key: 'wt', label: 'Weight', unit: 'kg', min: 30, max: 150, step: 1, value: 70 },
      { key: 'pcr', label: 'Plasma creatinine', unit: 'µmol/L', min: 30, max: 1300, step: 1, value: 106 },
      { key: 'female', label: 'Female (0/1)', min: 0, max: 1, step: 1, value: 0 },
    ],
    compute: (v) => ({ value: ((140 - v.age) * v.wt * (v.female ? 1.04 : 1.23)) / v.pcr, unit: 'mL/min', digits: 0 }),
    show: (v) => `(140 − ${f(v.age)}) × ${f(v.wt)} × ${v.female ? '1.04' : '1.23'} ÷ ${f(v.pcr)}`,
    explain: 'Creatinine production falls with age and rises with muscle mass (approximated by weight). The formula estimates creatinine clearance, not GFR, and assumes a steady state.',
    chapters: [2],
    route: '/creatinine',
    cite: { rose: [2], evidence: 'clinical', refs: ['cockcroft1976'] },
  },
  {
    id: 'ckdepi',
    name: 'eGFR (CKD-EPI 2021, race-free)',
    formula: 'eGFR = 142 × min(Scr/κ,1)^α × max(Scr/κ,1)^−1.200 × 0.9938^age [× 1.012 female];  κ = 62 µmol/L (F), 80 µmol/L (M)',
    group: 'Filtration & clearance',
    vars: [
      { key: 'scr', label: 'Serum creatinine', unit: 'µmol/L', min: 30, max: 1300, step: 1, value: 88 },
      { key: 'age', label: 'Age', unit: 'years', min: 18, max: 95, step: 1, value: 50 },
      { key: 'female', label: 'Female (0/1)', min: 0, max: 1, step: 1, value: 0 },
    ],
    compute: (v) => {
      // the published coefficients use mg/dL (κ 0.7/0.9); µmol/L ÷ 88.4 converts
      const scr = v.scr / 88.4;
      const k = v.female ? 0.7 : 0.9;
      const a = v.female ? -0.241 : -0.302;
      const e = 142 * Math.pow(Math.min(scr / k, 1), a) * Math.pow(Math.max(scr / k, 1), -1.2) * Math.pow(0.9938, v.age) * (v.female ? 1.012 : 1);
      const stage = e >= 90 ? 'G1' : e >= 60 ? 'G2' : e >= 45 ? 'G3a' : e >= 30 ? 'G3b' : e >= 15 ? 'G4' : 'G5';
      return { value: e, unit: 'mL/min/1.73 m²', read: `KDIGO GFR category ${stage} (valid only in a steady state)` };
    },
    show: (v) => `142 × f(${f(v.scr)} µmol/L) × 0.9938^${f(v.age)}${v.female ? ' × 1.012' : ''}`,
    explain: 'The 2021 equation estimates GFR from creatinine, age and sex without a race coefficient. Like every creatinine equation, it assumes the creatinine is stable.',
    caveat: 'Not valid during acute kidney injury, when creatinine has not reached a steady state.',
    chapters: [2],
    route: '/creatinine',
    cite: { evidence: 'guideline', refs: ['inker2021ckdepi', 'kdigo2024ckd'], update: 'The textbook predates estimating equations in routine use; KDIGO now recommends CKD-EPI 2021 for adults.' },
    keywords: ['eGFR', 'CKD-EPI', 'estimated GFR'],
  },
  {
    id: 'fena',
    name: 'Fractional excretion of sodium',
    formula: 'FENa (%) = (UNa × Pcr) ÷ (PNa × Ucr × 1000) × 100   [Pcr µmol/L, Ucr mmol/L]',
    group: 'Filtration & clearance',
    vars: [
      { key: 'una', label: 'Urine Na⁺', unit: 'mmol/L', min: 1, max: 250, step: 1, value: 20 },
      { key: 'pcr', label: 'Plasma creatinine', unit: 'µmol/L', min: 30, max: 1300, step: 1, value: 265 },
      { key: 'pna', label: 'Plasma Na⁺', unit: 'mmol/L', min: 110, max: 170, step: 1, value: 140 },
      { key: 'ucr', label: 'Urine creatinine', unit: 'mmol/L', min: 0.5, max: 35, step: 0.1, value: 7 },
    ],
    compute: (v) => {
      const fe = ((v.una * v.pcr) / (v.pna * v.ucr * 1000)) * 100;
      return { value: fe, unit: '%', digits: 2, read: fe < 1 ? '<1%: avid sodium retention (consistent with reduced effective volume)' : fe > 2 ? '>2%: tubular sodium wasting or a natriuretic stimulus' : 'Indeterminate (1–2%)' };
    },
    show: (v) => `(${f(v.una)} × ${f(v.pcr)}) ÷ (${f(v.pna)} × ${f(v.ucr, 1)} × 1000) × 100`,
    explain: 'The fraction of filtered sodium that escapes reabsorption. Creatinine corrects for urine concentration by water reabsorption, so FENa is independent of urine volume. The factor of 1000 reconciles µmol/L (plasma) with mmol/L (urine).',
    caveat: 'Diuretics, CKD, contrast, pigment injury, sepsis and early obstruction all break the rule. FENa supports a judgement about volume; it does not diagnose ATN.',
    chapters: [13, 14],
    route: '/fractional-excretion',
    cite: { rose: [13], evidence: 'clinical', refs: ['espinel1976', 'miller1978'] },
    keywords: ['FENa', 'prerenal', 'ATN'],
  },
  {
    id: 'feurea',
    name: 'Fractional excretion of urea',
    formula: 'FEUrea (%) = (Uurea × Pcr) ÷ (Purea × Ucr × 1000) × 100   [urea mmol/L, Pcr µmol/L, Ucr mmol/L]',
    group: 'Filtration & clearance',
    vars: [
      { key: 'uurea', label: 'Urine urea', unit: 'mmol/L', min: 20, max: 700, step: 5, value: 215 },
      { key: 'pcr', label: 'Plasma creatinine', unit: 'µmol/L', min: 30, max: 1300, step: 1, value: 265 },
      { key: 'purea', label: 'Plasma urea', unit: 'mmol/L', min: 2, max: 70, step: 0.5, value: 21.5 },
      { key: 'ucr', label: 'Urine creatinine', unit: 'mmol/L', min: 0.5, max: 35, step: 0.1, value: 7 },
    ],
    compute: (v) => {
      const fe = ((v.uurea * v.pcr) / (v.purea * v.ucr * 1000)) * 100;
      return { value: fe, unit: '%', digits: 1, read: fe < 35 ? '<35%: consistent with reduced effective volume' : fe > 50 ? '>50%: more in keeping with tubular injury' : 'Indeterminate' };
    },
    show: (v) => `(${f(v.uurea)} × ${f(v.pcr)}) ÷ (${f(v.purea, 1)} × ${f(v.ucr, 1)} × 1000) × 100`,
    explain: 'Urea reabsorption is largely passive and follows water, so it is less directly affected by loop and thiazide diuretics than sodium is.',
    caveat: 'Performance in studies has been inconsistent; treat as supporting evidence only.',
    chapters: [13],
    route: '/fractional-excretion',
    cite: { evidence: 'clinical', refs: ['carvounis2002'] },
  },

  // ------------------------------------------------------------------ water & sodium
  {
    id: 'cosm',
    name: 'Osmolar clearance',
    formula: 'Cosm = (Uosm × V) ÷ Posm',
    group: 'Water & sodium',
    vars: [
      { key: 'uosm', label: 'Urine osmolality', unit: 'mOsm/kg', min: 40, max: 1300, step: 5, value: 600 },
      { key: 'v', label: 'Urine volume', unit: 'L/day', min: 0.3, max: 20, step: 0.1, value: 1.5 },
      { key: 'posm', label: 'Plasma osmolality', unit: 'mOsm/kg', min: 240, max: 350, step: 1, value: 285 },
    ],
    compute: (v) => ({ value: (v.uosm * v.v) / v.posm, unit: 'L/day', digits: 2 }),
    show: (v) => `(${f(v.uosm)} × ${f(v.v, 1)}) ÷ ${f(v.posm)}`,
    explain: 'The volume of urine that would carry today’s solute excretion if it were isosmotic to plasma.',
    chapters: [9, 30],
    route: '/free-water',
  },
  {
    id: 'ch2o',
    name: 'Free-water clearance',
    formula: 'CH₂O = V − Cosm = V × (1 − Uosm/Posm)',
    group: 'Water & sodium',
    vars: [
      { key: 'uosm', label: 'Urine osmolality', unit: 'mOsm/kg', min: 40, max: 1300, step: 5, value: 600 },
      { key: 'v', label: 'Urine volume', unit: 'L/day', min: 0.3, max: 20, step: 0.1, value: 1.5 },
      { key: 'posm', label: 'Plasma osmolality', unit: 'mOsm/kg', min: 240, max: 350, step: 1, value: 285 },
    ],
    compute: (v) => {
      const c = v.v * (1 - v.uosm / v.posm);
      return { value: c, unit: 'L/day', digits: 2, read: c > 0 ? 'Positive: solute-free water is being excreted (dilute urine)' : c < 0 ? 'Negative: water is being retained (concentrated urine)' : 'Isosmotic urine' };
    },
    show: (v) => `${f(v.v, 1)} × (1 − ${f(v.uosm)}/${f(v.posm)})`,
    explain: 'Any urine can be split into an isosmotic part that carries all the solute and a part that is pure water. A dilute urine adds free water to the body’s losses; a concentrated one means free water has been reabsorbed.',
    chapters: [9, 23, 30],
    route: '/free-water',
    keywords: ['CH2O', 'free water'],
  },
  {
    id: 'efwc',
    name: 'Electrolyte-free water clearance',
    formula: 'CeH₂O = V × [1 − (UNa + UK) ÷ PNa]',
    group: 'Water & sodium',
    vars: [
      { key: 'una', label: 'Urine Na⁺', unit: 'mmol/L', min: 0, max: 300, step: 1, value: 60 },
      { key: 'uk', label: 'Urine K⁺', unit: 'mmol/L', min: 0, max: 150, step: 1, value: 40 },
      { key: 'v', label: 'Urine volume', unit: 'L/day', min: 0.3, max: 20, step: 0.1, value: 1.5 },
      { key: 'pna', label: 'Plasma Na⁺', unit: 'mmol/L', min: 100, max: 180, step: 1, value: 125 },
    ],
    compute: (v) => {
      const c = v.v * (1 - (v.una + v.uk) / v.pna);
      return { value: c, unit: 'L/day', digits: 2, read: c > 0 ? 'Urine is losing electrolyte-free water: this urine will raise the plasma Na⁺' : 'Urine is more concentrated in Na⁺+K⁺ than plasma: it will lower the plasma Na⁺' };
    },
    show: (v) => `${f(v.v, 1)} × [1 − (${f(v.una)} + ${f(v.uk)}) ÷ ${f(v.pna)}]`,
    explain: 'Urea in the urine does not affect the plasma sodium, because it does not hold water outside cells. What matters for the sodium is whether the urine’s Na⁺ + K⁺ concentration is above or below plasma.',
    chapters: [23, 24],
    route: '/free-water',
    cite: { rose: [23], evidence: 'physiology' },
  },
  {
    id: 'edelman',
    name: 'Plasma sodium (Edelman)',
    formula: '[Na⁺]p ≈ (Na⁺e + K⁺e) ÷ TBW',
    group: 'Water & sodium',
    vars: [
      { key: 'na', label: 'Exchangeable Na⁺', unit: 'mmol', min: 1000, max: 5000, step: 10, value: 3080 },
      { key: 'k', label: 'Exchangeable K⁺', unit: 'mmol', min: 1000, max: 5000, step: 10, value: 3150 },
      { key: 'tbw', label: 'Total body water', unit: 'L', min: 20, max: 70, step: 0.5, value: 42 },
    ],
    compute: (v) => ({ value: 1.11 * ((v.na + v.k) / v.tbw) - 25.6, unit: 'mmol/L', digits: 0 }),
    show: (v) => `1.11 × (${f(v.na)} + ${f(v.k)}) ÷ ${f(v.tbw, 1)} − 25.6`,
    explain: 'Plasma sodium is a ratio: the exchangeable cations (the osmoles that hold water in cells and extracellular fluid) divided by total body water. Potassium lost from cells lowers the plasma sodium just as sodium loss does; giving potassium raises it.',
    chapters: [7, 23],
    route: '/body-water',
    cite: { rose: [7], evidence: 'physiology', refs: ['edelman1958', 'rose1986'] },
  },
  {
    id: 'nadeficit',
    name: 'Sodium deficit (hyponatraemia)',
    formula: 'Na⁺ deficit = TBW × (target Na⁺ − current Na⁺)',
    group: 'Water & sodium',
    vars: [
      { key: 'wt', label: 'Lean weight', unit: 'kg', min: 30, max: 150, step: 1, value: 70 },
      { key: 'frac', label: 'Water fraction', min: 0.4, max: 0.65, step: 0.05, value: 0.6 },
      { key: 'na', label: 'Current Na⁺', unit: 'mmol/L', min: 100, max: 135, step: 1, value: 115 },
      { key: 'target', label: 'Target Na⁺', unit: 'mmol/L', min: 105, max: 140, step: 1, value: 123 },
    ],
    compute: (v) => ({ value: v.wt * v.frac * (v.target - v.na), unit: 'mmol', digits: 0, read: 'Sodium distributes (osmotically) through total body water, not just the ECF' }),
    show: (v) => `${f(v.wt)} × ${f(v.frac, 2)} × (${f(v.target)} − ${f(v.na)})`,
    explain: 'Sodium added to the ECF raises its osmolality, drawing water out of cells until osmolality is uniform — so the whole body water is the space of distribution.',
    caveat: 'This ignores ongoing losses and a urine water diuresis, which can overcorrect the sodium dangerously once the cause of ADH release resolves. Correction limits apply.',
    chapters: [23, 30],
    route: '/hyponatremia',
    cite: { rose: [23], evidence: 'physiology', refs: ['spasovski2014', 'verbalis2013'] },
  },
  {
    id: 'adrogue',
    name: 'Change in Na⁺ per litre infused (Adrogué–Madias)',
    formula: 'ΔNa⁺ = (infusate Na⁺ + K⁺ − serum Na⁺) ÷ (TBW + 1)',
    group: 'Water & sodium',
    vars: [
      { key: 'inf', label: 'Infusate Na⁺+K⁺', unit: 'mmol/L', min: 0, max: 513, step: 1, value: 513 },
      { key: 'na', label: 'Serum Na⁺', unit: 'mmol/L', min: 100, max: 180, step: 1, value: 115 },
      { key: 'tbw', label: 'Total body water', unit: 'L', min: 20, max: 60, step: 0.5, value: 42 },
    ],
    compute: (v) => ({ value: (v.inf - v.na) / (v.tbw + 1), unit: 'mmol/L per litre', digits: 1 }),
    show: (v) => `(${f(v.inf)} − ${f(v.na)}) ÷ (${f(v.tbw, 1)} + 1)`,
    explain: 'A litre of fluid changes the sodium by the difference between its tonicity and the patient’s, diluted into total body water plus the added litre. 3% saline is 513 mmol/L; 0.9% is 154; D5W is 0.',
    caveat: 'It assumes no simultaneous urine output — which is precisely what changes when volume is restored or ADH switches off.',
    chapters: [23, 24],
    route: '/hyponatremia',
    cite: { evidence: 'clinical', refs: ['adrogue2000hypo', 'adrogue2000hyper'] },
  },
  {
    id: 'waterdeficit',
    name: 'Water deficit (hypernatraemia)',
    formula: 'Water deficit = TBW × ([Na⁺]/140 − 1)',
    group: 'Water & sodium',
    vars: [
      { key: 'wt', label: 'Lean weight', unit: 'kg', min: 30, max: 150, step: 1, value: 70 },
      { key: 'frac', label: 'Water fraction', min: 0.4, max: 0.65, step: 0.05, value: 0.5 },
      { key: 'na', label: 'Serum Na⁺', unit: 'mmol/L', min: 140, max: 190, step: 1, value: 160 },
    ],
    compute: (v) => ({ value: v.wt * v.frac * (v.na / 140 - 1), unit: 'L', digits: 1 }),
    show: (v) => `${f(v.wt)} × ${f(v.frac, 2)} × (${f(v.na)}/140 − 1)`,
    explain: 'Assumes the body’s solute is unchanged and only water has been lost; the fraction of body weight that is water is lower in the elderly and in women, and lower still after water loss.',
    caveat: 'It estimates only the pure-water deficit; any accompanying isotonic loss (diarrhoea, osmotic diuresis) must be replaced separately.',
    chapters: [24, 30],
    route: '/water-disorders',
    cite: { rose: [24], evidence: 'physiology' },
  },

  // ------------------------------------------------------------------ acid–base
  {
    id: 'hh',
    name: 'Henderson–Hasselbalch',
    formula: 'pH = 6.10 + log([HCO₃⁻] ÷ (0.03 × PCO₂))',
    group: 'Acid–base',
    vars: [
      { key: 'hco3', label: 'HCO₃⁻', unit: 'mmol/L', min: 2, max: 60, step: 0.5, value: 24 },
      { key: 'pco2', label: 'PCO₂', unit: 'mmHg', min: 10, max: 120, step: 1, value: 40 },
    ],
    compute: (v) => {
      const pH = 6.1 + Math.log10(v.hco3 / (0.03 * v.pco2));
      return { value: pH, digits: 2, read: pH < 7.35 ? 'Acidaemia' : pH > 7.45 ? 'Alkalaemia' : 'Normal pH (7.35–7.45)' };
    },
    show: (v) => `6.10 + log(${f(v.hco3, 1)} ÷ (0.03 × ${f(v.pco2)}))`,
    explain: 'The pH depends on the ratio of bicarbonate to dissolved CO₂, not on either alone. The kidney controls the numerator; the lungs control the denominator.',
    chapters: [10, 17],
    route: '/acid-base',
    cite: { rose: [10], evidence: 'physiology' },
    keywords: ['pH', 'pKa', 'bicarbonate buffer'],
  },
  {
    id: 'hplus',
    name: 'Hydrogen ion concentration',
    formula: '[H⁺] (nEq/L) = 24 × PCO₂ ÷ [HCO₃⁻]',
    group: 'Acid–base',
    vars: [
      { key: 'hco3', label: 'HCO₃⁻', unit: 'mmol/L', min: 2, max: 60, step: 0.5, value: 24 },
      { key: 'pco2', label: 'PCO₂', unit: 'mmHg', min: 10, max: 120, step: 1, value: 40 },
    ],
    compute: (v) => {
      const h = (24 * v.pco2) / v.hco3;
      return { value: h, unit: 'nEq/L', digits: 0, read: `pH ≈ ${(9 - Math.log10(h)).toFixed(2)}` };
    },
    show: (v) => `24 × ${f(v.pco2)} ÷ ${f(v.hco3, 1)}`,
    explain: 'The Henderson form avoids logarithms. At pH 7.40, [H⁺] is 40 nEq/L; around the normal range, each 0.1 rise in pH multiplies [H⁺] by about 0.8 and each 0.1 fall multiplies it by about 1.25.',
    chapters: [10, 30],
    route: '/acid-base',
  },
  {
    id: 'ag',
    name: 'Anion gap',
    formula: 'AG = Na⁺ − (Cl⁻ + HCO₃⁻)',
    group: 'Acid–base',
    vars: [
      { key: 'na', label: 'Na⁺', unit: 'mmol/L', min: 110, max: 170, step: 1, value: 140 },
      { key: 'cl', label: 'Cl⁻', unit: 'mmol/L', min: 70, max: 130, step: 1, value: 104 },
      { key: 'hco3', label: 'HCO₃⁻', unit: 'mmol/L', min: 2, max: 50, step: 1, value: 24 },
      { key: 'alb', label: 'Albumin', unit: 'g/L', min: 10, max: 55, step: 1, value: 40 },
    ],
    compute: (v) => {
      const ag = v.na - v.cl - v.hco3;
      const corr = ag + 0.25 * (40 - v.alb);
      return { value: ag, unit: 'mmol/L', read: `Albumin-corrected ≈ ${corr.toFixed(0)}. ${corr > 14 ? 'Raised: unmeasured anions (lactate, ketones, uraemic anions, toxins).' : 'Not raised.'}` };
    },
    show: (v) => `${f(v.na)} − (${f(v.cl)} + ${f(v.hco3)})`,
    explain: 'Plasma is electroneutral, so the gap between measured cations and measured anions represents unmeasured anions — mostly albumin normally. When an acid other than HCl is added, its anion replaces the bicarbonate consumed, so the gap widens.',
    caveat: 'The normal range depends on the laboratory (about 3–10 with modern analysers vs 12 ± 2 in the textbook era). Correct for low albumin: each 10 g/L fall lowers the gap by about 2.5 mmol/L.',
    chapters: [17, 19],
    route: '/metabolic-acidosis',
    cite: { rose: [19], evidence: 'clinical', refs: ['kraut2007ag', 'figge1998'], update: 'Ion-selective electrodes have lowered the normal anion gap to around 3–10 mmol/L in many laboratories; the textbook’s 12 ± 2 reflects older methods.' },
    keywords: ['AG', 'unmeasured anions'],
  },
  {
    id: 'deltaratio',
    name: 'Delta ratio (Δ/Δ)',
    formula: 'ΔAG/ΔHCO₃⁻ = (AG − 12) ÷ (24 − HCO₃⁻)',
    group: 'Acid–base',
    vars: [
      { key: 'ag', label: 'Anion gap', unit: 'mmol/L', min: 4, max: 45, step: 1, value: 26 },
      { key: 'hco3', label: 'HCO₃⁻', unit: 'mmol/L', min: 2, max: 30, step: 1, value: 10 },
    ],
    compute: (v) => {
      const r = (v.ag - 12) / Math.max(24 - v.hco3, 0.1);
      return {
        value: r,
        digits: 2,
        read: r < 0.8 ? '<1: bicarbonate fell more than the gap rose — a coexisting normal-gap acidosis' : r > 2 ? '>2: the gap rose more than bicarbonate fell — a coexisting metabolic alkalosis' : '1–2: consistent with a pure high-anion-gap acidosis (lactic acidosis tends toward 1.6)',
      };
    },
    show: (v) => `(${f(v.ag)} − 12) ÷ (24 − ${f(v.hco3)})`,
    explain: 'In a pure high-gap acidosis each mmol of acid adds one anion and removes one bicarbonate, so the two change roughly one-for-one. Buffering by cells and bone (and renal loss of the anion, as with ketones) shifts the ratio.',
    caveat: 'A rough guide: the normal ranges of both terms are wide, so the ratio is imprecise near its boundaries.',
    chapters: [17, 19],
    route: '/mixed',
    cite: { rose: [17, 19], evidence: 'clinical', refs: ['rastegar2007'] },
    keywords: ['delta gap', 'delta delta'],
  },
  {
    id: 'winters',
    name: 'Respiratory compensation for metabolic acidosis',
    formula: 'Expected ΔPCO₂ ≈ 1.2 × ΔHCO₃⁻   (≈ Winter: PCO₂ = 1.5 × HCO₃⁻ + 8 ± 2)',
    group: 'Acid–base',
    vars: [{ key: 'hco3', label: 'HCO₃⁻', unit: 'mmol/L', min: 3, max: 24, step: 0.5, value: 12 }],
    compute: (v) => {
      const rose = 40 - 1.2 * (24 - v.hco3);
      const winter = 1.5 * v.hco3 + 8;
      return { value: rose, unit: 'mmHg', digits: 0, read: `Winter’s formula: ${winter.toFixed(0)} ± 2 mmHg` };
    },
    show: (v) => `40 − 1.2 × (24 − ${f(v.hco3, 1)})`,
    explain: 'Acidaemia stimulates the respiratory centre, lowering PCO₂ over 12–24 hours. A PCO₂ above the expected value means a coexisting respiratory acidosis; below it, a respiratory alkalosis.',
    chapters: [17, 30],
    route: '/mixed',
    cite: { rose: [17], evidence: 'clinical', refs: ['albert1967'] },
  },
  {
    id: 'alkComp',
    name: 'Respiratory compensation for metabolic alkalosis',
    formula: 'Expected ΔPCO₂ ≈ 0.6–0.7 × ΔHCO₃⁻',
    group: 'Acid–base',
    vars: [{ key: 'hco3', label: 'HCO₃⁻', unit: 'mmol/L', min: 24, max: 60, step: 0.5, value: 34 }],
    compute: (v) => ({ value: 40 + 0.6 * (v.hco3 - 24), unit: 'mmHg', digits: 0, read: `With 0.7: ${(40 + 0.7 * (v.hco3 - 24)).toFixed(0)} mmHg` }),
    show: (v) => `40 + 0.6 × (${f(v.hco3, 1)} − 24)`,
    explain: 'Hypoventilation is limited by hypoxaemia, so compensation is smaller than for acidosis, but PCO₂ values above 50–55 mmHg can be pure compensation.',
    chapters: [17, 18, 30],
    route: '/metabolic-alkalosis',
    cite: { rose: [17, 30], evidence: 'clinical', update: 'The textbook uses 0.6 mmHg per mmol/L; later summaries (Adrogué & Madias) often quote 0.7.', refs: ['adrogue2010rules'] },
  },
  {
    id: 'respComp',
    name: 'Renal compensation for respiratory disorders',
    formula: 'ΔHCO₃⁻ per 10 mmHg ΔPCO₂: acidosis 1 (acute) / 3.5 (chronic); alkalosis 2 (acute) / 4 (chronic)',
    group: 'Acid–base',
    vars: [
      { key: 'pco2', label: 'PCO₂', unit: 'mmHg', min: 15, max: 100, step: 1, value: 60 },
      { key: 'chronic', label: 'Chronic (0/1)', min: 0, max: 1, step: 1, value: 1 },
    ],
    compute: (v) => {
      const d = v.pco2 - 40;
      const k = d > 0 ? (v.chronic ? 0.35 : 0.1) : v.chronic ? 0.4 : 0.2;
      const hco3 = 24 + k * d;
      const pH = 6.1 + Math.log10(hco3 / (0.03 * v.pco2));
      return { value: hco3, unit: 'mmol/L', digits: 1, read: `Expected pH ≈ ${pH.toFixed(2)}` };
    },
    show: (v) => `24 + ${v.pco2 > 40 ? (v.chronic ? '0.35' : '0.1') : v.chronic ? '0.4' : '0.2'} × (${f(v.pco2)} − 40)`,
    explain: 'Acutely, only cell buffers change bicarbonate, and only a little. Over 3–5 days the kidney adjusts H⁺ secretion and ammonium excretion, producing a much larger change.',
    chapters: [20, 21, 30],
    route: '/respiratory',
    cite: { rose: [20, 21], evidence: 'clinical' },
  },
  {
    id: 'uag',
    name: 'Urine anion gap',
    formula: 'UAG = UNa⁺ + UK⁺ − UCl⁻',
    group: 'Acid–base',
    vars: [
      { key: 'una', label: 'Urine Na⁺', unit: 'mmol/L', min: 0, max: 200, step: 1, value: 40 },
      { key: 'uk', label: 'Urine K⁺', unit: 'mmol/L', min: 0, max: 150, step: 1, value: 30 },
      { key: 'ucl', label: 'Urine Cl⁻', unit: 'mmol/L', min: 0, max: 250, step: 1, value: 110 },
    ],
    compute: (v) => {
      const g = v.una + v.uk - v.ucl;
      return { value: g, unit: 'mmol/L', read: g < 0 ? 'Negative: chloride exceeds Na⁺+K⁺, implying ample NH₄⁺ (appropriate renal response, e.g. diarrhoea)' : 'Positive: little NH₄⁺ — impaired renal acid excretion (e.g. distal RTA), unless another anion is present' };
    },
    show: (v) => `${f(v.una)} + ${f(v.uk)} − ${f(v.ucl)}`,
    explain: 'Ammonium is excreted with chloride but is not measured. When NH₄⁺ excretion is high, urine chloride exceeds sodium plus potassium and the gap turns negative.',
    caveat: 'Unreliable when the urine contains other unmeasured anions (ketones, hippurate, bicarbonate) or when urine Na⁺ is very low. The urine osmolal gap is an alternative.',
    chapters: [19],
    route: '/ammonium',
    cite: { rose: [19], evidence: 'clinical', refs: ['batlle1988'] },
    keywords: ['UAG', 'urine net charge', 'ammonium'],
  },
  {
    id: 'uosmgap',
    name: 'Urine osmolal gap',
    formula: 'UOG = Uosm − [2(UNa + UK) + Uurea + Uglucose];  NH₄⁺ ≈ UOG ÷ 2',
    group: 'Acid–base',
    vars: [
      { key: 'uosm', label: 'Urine osmolality', unit: 'mOsm/kg', min: 50, max: 1200, step: 5, value: 500 },
      { key: 'una', label: 'Urine Na⁺', unit: 'mmol/L', min: 0, max: 200, step: 1, value: 40 },
      { key: 'uk', label: 'Urine K⁺', unit: 'mmol/L', min: 0, max: 150, step: 1, value: 30 },
      { key: 'uurea', label: 'Urine urea', unit: 'mmol/L', min: 0, max: 600, step: 5, value: 200 },
      { key: 'uglu', label: 'Urine glucose', unit: 'mmol/L', min: 0, max: 200, step: 1, value: 0 },
    ],
    compute: (v) => {
      const g = v.uosm - (2 * (v.una + v.uk) + v.uurea + v.uglu);
      return { value: g, unit: 'mOsm/kg', read: `Estimated urine NH₄⁺ ≈ ${(g / 2).toFixed(0)} mmol/L ${g / 2 < 20 ? '(low)' : ''}` };
    },
    show: (v) => `${f(v.uosm)} − [2(${f(v.una)} + ${f(v.uk)}) + ${f(v.uurea)} + ${f(v.uglu)}]`,
    explain: 'Ammonium salts are the main osmoles the calculation leaves out, so half the gap estimates urine ammonium (the other half being its accompanying anion).',
    chapters: [19],
    route: '/ammonium',
    cite: { evidence: 'clinical', refs: ['kamel2021'] },
  },
  {
    id: 'nae',
    name: 'Net acid excretion',
    formula: 'NAE = titratable acid + NH₄⁺ − HCO₃⁻',
    group: 'Acid–base',
    vars: [
      { key: 'ta', label: 'Titratable acid', unit: 'mmol/day', min: 0, max: 150, step: 1, value: 25 },
      { key: 'nh4', label: 'NH₄⁺', unit: 'mmol/day', min: 0, max: 400, step: 1, value: 40 },
      { key: 'hco3', label: 'Urine HCO₃⁻', unit: 'mmol/day', min: 0, max: 200, step: 1, value: 1 },
    ],
    compute: (v) => ({ value: v.ta + v.nh4 - v.hco3, unit: 'mmol/day', read: 'Must equal net endogenous acid production (≈1 mmol/kg/day on a Western diet) for acid–base balance' }),
    show: (v) => `${f(v.ta)} + ${f(v.nh4)} − ${f(v.hco3)}`,
    explain: 'Each H⁺ excreted bound to a buffer, and each NH₄⁺, represents one new bicarbonate returned to the blood. Bicarbonate lost in the urine subtracts.',
    chapters: [11],
    route: '/titratable-acid',
    cite: { rose: [11], evidence: 'physiology' },
  },
  {
    id: 'hco3deficit',
    name: 'Bicarbonate deficit (severe acidosis)',
    formula: 'HCO₃⁻ deficit ≈ space × lean weight × (target − current HCO₃⁻); space 0.5 (HCO₃⁻ > 10) to 0.7+ (HCO₃⁻ < 10)',
    group: 'Acid–base',
    vars: [
      { key: 'wt', label: 'Lean weight', unit: 'kg', min: 30, max: 150, step: 1, value: 70 },
      { key: 'hco3', label: 'Current HCO₃⁻', unit: 'mmol/L', min: 2, max: 20, step: 0.5, value: 6 },
      { key: 'target', label: 'Target HCO₃⁻', unit: 'mmol/L', min: 8, max: 24, step: 1, value: 10 },
    ],
    compute: (v) => {
      const space = v.hco3 < 10 ? 0.7 : 0.5;
      return { value: space * v.wt * (v.target - v.hco3), unit: 'mmol', digits: 0, read: `Apparent space used: ${space} × body weight` };
    },
    show: (v) => `${v.hco3 < 10 ? '0.7' : '0.5'} × ${f(v.wt)} × (${f(v.target)} − ${f(v.hco3, 1)})`,
    explain: 'When bicarbonate is very low, cells and bone buffer almost all additional H⁺, so the apparent space in which administered bicarbonate distributes is large. Only a partial correction is aimed for.',
    chapters: [19, 30],
    route: '/metabolic-acidosis',
    cite: { rose: [19, 30], evidence: 'physiology' },
  },

  // ------------------------------------------------------------------ potassium
  {
    id: 'ttkg',
    name: 'Transtubular K⁺ gradient',
    formula: 'TTKG = (UK ÷ PK) ÷ (Uosm ÷ Posm)',
    group: 'Potassium',
    vars: [
      { key: 'uk', label: 'Urine K⁺', unit: 'mmol/L', min: 1, max: 200, step: 1, value: 40 },
      { key: 'pk', label: 'Plasma K⁺', unit: 'mmol/L', min: 1.5, max: 9, step: 0.1, value: 4.2 },
      { key: 'uosm', label: 'Urine osmolality', unit: 'mOsm/kg', min: 290, max: 1200, step: 5, value: 600 },
      { key: 'posm', label: 'Plasma osmolality', unit: 'mOsm/kg', min: 250, max: 340, step: 1, value: 290 },
    ],
    compute: (v) => {
      const t = v.uk / v.pk / (v.uosm / v.posm);
      return { value: t, digits: 1, read: `Low (<3) in hypokalaemia means appropriate renal conservation; below ~7 in hyperkalaemia suggests reduced aldosterone effect` };
    },
    show: (v) => `(${f(v.uk)} ÷ ${f(v.pk, 1)}) ÷ (${f(v.uosm)} ÷ ${f(v.posm)})`,
    explain: 'An estimate of the K⁺ concentration at the end of the cortical collecting duct, relative to plasma, correcting for water removed further downstream. It is a surrogate for the aldosterone effect.',
    caveat: 'Its originators withdrew it: urea recycling in the medulla violates its central assumption. The urine K⁺/creatinine ratio is now preferred.',
    chapters: [12, 27, 28],
    route: '/potassium',
    cite: { rose: [12, 27], evidence: 'clinical', refs: ['kamel2011ttkg'], update: 'Kamel & Halperin (2011) recommended abandoning the TTKG because medullary urea recycling invalidates its assumption; the urine K⁺/creatinine ratio is used instead.' },
    keywords: ['TTKG'],
  },
  {
    id: 'ukcr',
    name: 'Urine K⁺/creatinine ratio',
    formula: 'UK/Ucr (mmol/mmol)',
    group: 'Potassium',
    vars: [
      { key: 'uk', label: 'Urine K⁺', unit: 'mmol/L', min: 1, max: 200, step: 1, value: 30 },
      { key: 'ucr', label: 'Urine creatinine', unit: 'mmol/L', min: 0.5, max: 35, step: 0.1, value: 8.8 },
    ],
    compute: (v) => {
      const r = v.uk / v.ucr;
      return { value: r, digits: 1, unit: 'mmol/mmol', read: r < 1.5 ? 'Low: kidney conserving K⁺ — loss is extrarenal or intake is low' : r > 2.5 ? 'High: renal K⁺ wasting' : 'Intermediate' };
    },
    show: (v) => `${f(v.uk)} ÷ ${f(v.ucr, 1)}`,
    explain: 'Creatinine excretion is roughly constant, so the ratio in a spot urine tracks daily K⁺ excretion. In hypokalaemia a low ratio says the kidney is responding appropriately.',
    chapters: [27],
    route: '/hypokalemia',
    cite: { evidence: 'clinical', refs: ['kamel2011ttkg'] },
  },

  // ------------------------------------------------------------------ minerals & respiratory
  {
    id: 'correctedCa',
    name: 'Calcium corrected for albumin',
    formula: 'Corrected Ca (mmol/L) = measured Ca + 0.02 × (40 − albumin in g/L)',
    group: 'Minerals',
    vars: [
      { key: 'ca', label: 'Total calcium', unit: 'mmol/L', min: 1.2, max: 4, step: 0.01, value: 1.95 },
      { key: 'alb', label: 'Albumin', unit: 'g/L', min: 10, max: 55, step: 1, value: 22 },
    ],
    compute: (v) => ({ value: v.ca + 0.02 * (40 - v.alb), unit: 'mmol/L', digits: 2, read: 'Only an estimate: measure ionised calcium when it matters' }),
    show: (v) => `${f(v.ca, 2)} + 0.02 × (40 − ${f(v.alb)})`,
    explain: 'About 40% of plasma calcium is bound to albumin. Low albumin lowers the total without changing the physiologically active ionised calcium.',
    chapters: [1, 30],
    route: '/minerals',
    cite: { rose: [30], evidence: 'clinical' },
  },
  {
    id: 'aagrad',
    name: 'Alveolar–arterial O₂ gradient (room air)',
    formula: 'A–a = (150 − 1.25 × PaCO₂) − PaO₂',
    group: 'Respiratory',
    vars: [
      { key: 'pco2', label: 'PaCO₂', unit: 'mmHg', min: 15, max: 100, step: 1, value: 40 },
      { key: 'po2', label: 'PaO₂', unit: 'mmHg', min: 30, max: 120, step: 1, value: 90 },
    ],
    compute: (v) => {
      const g = 150 - 1.25 * v.pco2 - v.po2;
      return { value: g, unit: 'mmHg', digits: 0, read: g > 20 ? 'Widened: a lung (V/Q or diffusion) problem, not pure hypoventilation' : 'Normal for a young adult (<10–20): hypoxaemia, if present, is explained by hypoventilation' };
    },
    show: (v) => `(150 − 1.25 × ${f(v.pco2)}) − ${f(v.po2)}`,
    explain: 'Distinguishes respiratory acidosis from central hypoventilation (normal gradient) from that due to intrinsic lung disease (widened gradient).',
    chapters: [20, 30],
    route: '/respiratory',
    cite: { rose: [20, 30], evidence: 'physiology' },
  },
];

export const equationById = new Map(EQUATIONS.map((e) => [e.id, e]));
export const initialValues = (e: EquationDef) => Object.fromEntries(e.vars.map((v) => [v.key, v.value]));
