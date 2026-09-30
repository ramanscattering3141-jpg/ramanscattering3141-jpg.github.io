// Worked patient examples for the equation registry. Each case loads its numbers into the
// equation's sliders, then walks through what the result means for that patient. `values` must use
// the equation's own variable keys and stay inside their slider ranges (checked by
// tests/renal/content.test.ts). Patients are illustrative composites, not real people.

import type { PatientCase } from './equations';

export const EQUATION_CASES: Record<string, PatientCase> = {
  // ------------------------------------------------------------------ water & sodium
  edelman: {
    title: 'Thiazide hyponatraemia with hypokalaemia',
    story: 'A 68-year-old woman (60 kg, about 36 L of body water) started hydrochlorothiazide three weeks ago. Na⁺ 124 mmol/L, K⁺ 2.6 mmol/L. She has lost both sodium and potassium in her urine and kept water.',
    values: { na: 2600, k: 2250, tbw: 36 },
    steps: [
      'The equation gives a plasma Na⁺ of about 124: her exchangeable Na⁺ plus K⁺, spread through 36 L of water.',
      'Potassium lost from cells counts as much as sodium lost from the ECF. When K⁺ leaves a cell, Na⁺ (and H⁺) move in to keep it electrically neutral, and water follows the osmoles.',
      'Now move exchangeable K⁺ from 2250 up to 2550 mmol (a 300 mmol replacement). The plasma Na⁺ rises by about 9 mmol/L with no sodium given at all.',
      'That is why KCl belongs in the sodium calculation, and why replacing K⁺ alongside saline can overcorrect a chronic hyponatraemia.',
    ],
    takeaway: 'Plasma Na⁺ reflects (Na⁺ + K⁺) ÷ water. Count every mmol of KCl you give as if it were NaCl.',
  },
  furst: {
    title: 'SIADH: will fluid restriction work?',
    story: 'A 72-year-old woman with small-cell lung cancer. Na⁺ 122 mmol/L, clinically euvolaemic, urine osmolality 540 mOsm/kg, urine Na⁺ 90 and K⁺ 45 mmol/L. The team writes “fluid restrict 1 L/day”.',
    values: { una: 90, uk: 45, pna: 122 },
    steps: [
      'Furst ratio = (90 + 45) ÷ 122 ≈ 1.1, which is above 1.',
      'Her urine is saltier than her plasma, so it carries no electrolyte-free water. Even a strict restriction only slows the fall; it cannot raise the Na⁺.',
      'Options that work: add solute (oral urea 15–30 g/day, or salt tablets with a low-dose loop diuretic to lower urine concentration) or a vaptan. Treat the cause.',
      'Now set urine Na⁺ to 40 and K⁺ to 20, as after furosemide. The ratio falls to about 0.5, and a 1 L restriction becomes realistic.',
    ],
    takeaway: 'Calculate before you restrict. A ratio above 1 means fluid restriction alone will fail.',
  },
  efwc: {
    title: 'Why the Na⁺ keeps falling on 1.2 L of urine',
    story: 'The same SIADH patient passes 1.2 L of urine a day: Na⁺ 90, K⁺ 45 mmol/L, plasma Na⁺ 122 mmol/L.',
    values: { una: 90, uk: 45, v: 1.2, pna: 122 },
    steps: [
      'Electrolyte-free water clearance = 1.2 × [1 − 135/122] ≈ −0.13 L/day.',
      'A negative value means the urine takes more electrolyte than water compared with plasma: it lowers the Na⁺ further.',
      'Try urine Na⁺ 60, K⁺ 25 and volume 2.5 L (loop diuretic plus salt). Clearance becomes about +0.8 L/day of free water, so the Na⁺ rises if intake stays level.',
    ],
    takeaway: 'Urea and total osmolality do not matter for the Na⁺; only urine Na⁺ + K⁺ against plasma Na⁺ does.',
  },
  adrogue: {
    title: 'Seizing after a marathon',
    story: 'A 60-kg woman (body water about 30 L) collapses after a marathon, having drunk water at every station. Na⁺ 112 mmol/L, one seizure. This is acute hyponatraemia with cerebral oedema.',
    values: { inf: 513, na: 112, tbw: 30 },
    steps: [
      'One litre of 3% saline (513 mmol/L) would raise her Na⁺ by (513 − 112) ÷ 31 ≈ 13 mmol/L.',
      'She does not need a litre. The aim is a rise of about 5 mmol/L in the first hour to stop the seizures. European guidance uses 150 mL of 3% saline over 20 minutes, repeated as needed: each bolus gives about 2 mmol/L here.',
      'The formula ignores urine. Once she is resuscitated and ADH switches off, a water diuresis can raise the Na⁺ much faster than predicted: check the Na⁺ every 2–4 hours.',
    ],
    takeaway: 'Adrogué–Madias predicts the effect of one litre. Scale it to the volume you actually give, and measure because urine output breaks its assumptions.',
  },
  nadeficit: {
    title: 'Chronic hyponatraemia in an older woman',
    story: 'An 80-year-old, 55-kg woman with chronic hyponatraemia (Na⁺ 115 mmol/L) and mild confusion. Target for the first 24 hours: +8 mmol/L, to 123.',
    values: { wt: 55, frac: 0.5, na: 115, target: 123 },
    steps: [
      'Sodium needed = 55 × 0.5 × (123 − 115) ≈ 220 mmol.',
      'In 3% saline (513 mmol/L) that is about 430 mL over 24 hours, before any urine losses.',
      'Because this is chronic, the brain has adapted. A rise above 10 mmol/L in the first 24 hours risks osmotic demyelination, and she is high risk (older, likely low K⁺ and poor intake).',
      'Plan the rescue in advance: if the Na⁺ overshoots, give D5W and consider desmopressin to stop the water diuresis.',
    ],
    takeaway: 'The deficit sets a ceiling on what to give. Correction limits and ongoing urine output decide the pace.',
  },
  maxuv: {
    title: 'Beer potomania',
    story: 'A 55-year-old man drinks about 4 L of beer a day and eats almost nothing. Na⁺ 114 mmol/L, urine osmolality 60 mOsm/kg. His ADH is appropriately suppressed.',
    values: { sol: 150, umin: 50 },
    steps: [
      'With only ~150 mOsm/day of solute, he can excrete at most 150 ÷ 50 = 3 L of urine a day.',
      'Four litres of beer in, three out (plus about 0.5 L insensible): roughly 0.5 L of water retained daily. That is enough to drive the Na⁺ down over a couple of weeks.',
      'The danger is treatment: saline and a meal raise his solute to 600+ mOsm/day, and capacity jumps above 12 L. Set solute to 600 to see it. A brisk water diuresis can then raise the Na⁺ by more than 10 mmol/L overnight.',
    ],
    takeaway: 'Low solute limits water excretion. Feeding the patient removes the limit, so watch for overcorrection.',
  },
  unauk: {
    title: 'Cirrhotic ascites that is not going away',
    story: 'A 58-year-old man with alcohol-related cirrhosis on spironolactone 100 mg and furosemide 40 mg. His weight is rising. A 24-hour urine collection is impractical on the ward. Spot urine: Na⁺ 70, K⁺ 35 mmol/L.',
    values: { una: 70, uk: 35 },
    steps: [
      'Na⁺/K⁺ = 70 ÷ 35 = 2.0, which is above 1: he is probably excreting more than 78 mmol of Na⁺ a day.',
      'If he eats the prescribed 88 mmol (2 g) of sodium, that output should be losing weight. Since he is gaining, the likeliest explanation is sodium intake: diet, salty foods, or IV fluids and antibiotics given in saline.',
      'Contrast: set urine Na⁺ to 12 and K⁺ to 48 (ratio 0.25). Now aldosterone is winning: raise the diuretics (spironolactone 200 mg with furosemide 80 mg), watching K⁺ and creatinine.',
    ],
    takeaway: 'Above 1 with rising weight suggests too much salt going in; below 1 means the diuretic is not yet enough.',
  },
  ch2o: {
    title: 'Central diabetes insipidus after pituitary surgery',
    story: 'On day 2 after pituitary surgery a patient passes 8 L/day of urine at 90 mOsm/kg. Plasma osmolality 300 mOsm/kg.',
    values: { uosm: 90, v: 8, posm: 300 },
    steps: [
      'Free-water clearance = 8 × (1 − 90/300) = 5.6 L/day of solute-free water.',
      'If thirst is intact and water is available, he drinks to match. If he is sedated or thirst is damaged, the Na⁺ climbs fast.',
      'Desmopressin concentrates the urine: set Uosm to 600 and volume to 1.5 L. Free-water clearance becomes negative, meaning water is retained.',
    ],
    takeaway: 'Positive free-water clearance is water the patient must drink or be given to keep the Na⁺ steady.',
  },
  waterdeficit: {
    title: 'Hypernatraemia in a nursing-home resident',
    story: 'An 85-year-old, 50-kg woman with dementia, found drowsy. Na⁺ 158 mmol/L. Water deficit from poor intake and fever.',
    values: { wt: 50, frac: 0.4, na: 158 },
    steps: [
      'Body water in an older, dehydrated woman is about 40% of weight: 20 L.',
      'Deficit = 20 × (158/140 − 1) ≈ 2.6 L of pure water.',
      'Add ongoing losses (insensible ~1 L/day with fever) and replace over 24–48 hours with enteral water or D5W, rechecking the Na⁺. Traditional guidance is no more than about 10–12 mmol/L per day in chronic hypernatraemia; recent data suggest faster correction may be safe in adults.',
    ],
    takeaway: 'The deficit is a minimum. Always add the losses that continue while you are replacing it.',
  },
  // ------------------------------------------------------------------ units & osmolality
  osmgap: {
    title: 'Intoxicated, acidotic and unconscious',
    story: 'A 40-year-old man found unresponsive. Measured osmolality 330 mOsm/kg, Na⁺ 138, glucose 6, urea 5 mmol/L; HCO₃⁻ 10 mmol/L with a high anion gap.',
    values: { meas: 330, na: 138, glu: 6, urea: 5 },
    steps: [
      'Calculated osmolality = 2 × 138 + 6 + 5 = 287. Gap = 330 − 287 = 43 mOsm/kg.',
      'A gap this large means unmeasured osmoles: ethanol, methanol, ethylene glycol, isopropanol, mannitol.',
      'Ethanol raises the gap by about 1 mOsm/kg per mmol/L. If his ethanol level does not explain the gap, and he is acidotic, treat as toxic alcohol: fomepizole and dialysis.',
      'A normal gap does not rule it out: late in poisoning the parent alcohol has been metabolised into acids.',
    ],
    takeaway: 'High osmolal gap plus high anion gap acidosis: toxic alcohol until proven otherwise.',
  },
  nacorr: {
    title: 'The hidden hypernatraemia of DKA',
    story: 'A 19-year-old in diabetic ketoacidosis: glucose 45 mmol/L, measured Na⁺ 128 mmol/L.',
    values: { na: 128, glu: 45, k: 2.4 },
    steps: [
      'Glucose pulls water out of cells and dilutes the Na⁺. Corrected Na⁺ ≈ 128 + 2.4 × (45 − 5.6)/5.6 ≈ 145.',
      'She has lost more water than salt through the osmotic diuresis: she is really hypernatraemic.',
      'As insulin lowers the glucose, the measured Na⁺ should rise. If it falls instead, she is getting too much free water, which increases the risk of cerebral oedema (especially in children).',
    ],
    takeaway: 'In hyperglycaemia, track the corrected Na⁺, not the measured one.',
  },
  // ------------------------------------------------------------------ filtration
  fena: {
    title: 'Vomiting and a rising creatinine',
    story: 'A 70-year-old with three days of vomiting. Creatinine 265 µmol/L (baseline 90). Urine Na⁺ 12, urine creatinine 10 mmol/L, plasma Na⁺ 138 mmol/L. No diuretics.',
    values: { una: 12, pcr: 265, pna: 138, ucr: 10 },
    steps: [
      'FENa = (12 × 265) ÷ (138 × 10 × 1000) × 100 ≈ 0.2%.',
      'The tubules are avidly conserving sodium: the kidney is responding to low perfusion (pre-renal), not failing to reabsorb (as in established ATN, where FENa is often above 2%).',
      'Expect a response to fluids. If creatinine does not fall within 24–48 hours, rethink.',
      'Caveats: diuretics raise FENa; contrast nephropathy, myoglobinuria and early obstruction can give low values despite tubular injury.',
    ],
    takeaway: 'A low FENa means the tubules are working. It does not tell you that the kidney is safe.',
  },
  feurea: {
    title: 'The same patient, but on furosemide',
    story: 'She takes furosemide for heart failure, so her FENa is 1.8% and uninterpretable. Urine urea 150, plasma urea 25 mmol/L; creatinine 265 µmol/L, urine creatinine 8 mmol/L.',
    values: { uurea: 150, pcr: 265, purea: 25, ucr: 8 },
    steps: [
      'FEUrea = (150 × 265) ÷ (25 × 8 × 1000) × 100 ≈ 20%.',
      'Urea is reabsorbed proximally, where loop diuretics do not act, so FEUrea stays interpretable. Below 35% suggests pre-renal physiology; above 50% suggests tubular injury.',
    ],
    takeaway: 'On diuretics, use FEUrea instead of FENa, and still read it in context.',
  },
  ureacr: {
    title: 'Melaena and a high urea',
    story: 'A 66-year-old with melaena. Urea 28 mmol/L, creatinine 160 µmol/L.',
    values: { urea: 28, cr: 160 },
    steps: [
      'Ratio = 28 ÷ 160 × 1000 = 175, well above 100.',
      'Two things push it up here: blood digested in the gut is a protein load (more urea made), and volume depletion increases urea reabsorption.',
      'A disproportionately high urea in a patient without known kidney disease is a clue to upper GI bleeding.',
    ],
    takeaway: 'A high ratio says “more urea made or more reabsorbed”. Look for both.',
  },
  upcr: {
    title: 'Frothy urine and swollen ankles',
    story: 'A 40-year-old with two weeks of leg oedema. Spot urine protein 3 g/L, urine creatinine 7.5 mmol/L. Albumin 22 g/L.',
    values: { prot: 3, ucr: 7.5 },
    steps: [
      'UPCR = 3000 ÷ 7.5 = 400 mg/mmol, about 4 g/day.',
      'Above ~300 mg/mmol with low albumin and oedema: nephrotic syndrome. Next come a lipid profile, a thrombosis risk assessment, serology (PLA2R, ANA, hepatitis B/C, HIV) and a kidney biopsy.',
      'Follow the UPCR to judge treatment response; a fall to below 30 is a common target for complete remission.',
    ],
    takeaway: 'A spot UPCR replaces a 24-hour collection for most decisions, as long as muscle mass is roughly average.',
  },
  // ------------------------------------------------------------------ acid–base
  ag: {
    title: 'Sepsis with a “normal” anion gap',
    story: 'A 70-year-old in septic shock. Na⁺ 138, Cl⁻ 108, HCO₃⁻ 18 mmol/L, albumin 20 g/L.',
    values: { na: 138, cl: 108, hco3: 18, alb: 20 },
    steps: [
      'Raw anion gap = 138 − (108 + 18) = 12: apparently normal.',
      'Albumin is the main unmeasured anion. At 20 g/L it has fallen by 20, which lowers the gap by about 5. Corrected gap ≈ 17: raised.',
      'The hidden anion is likely lactate: measure it. Without the correction, a lactic acidosis would be missed.',
    ],
    takeaway: 'Always correct the anion gap for albumin in sick, hypoalbuminaemic patients.',
  },
  deltaratio: {
    title: 'DKA plus vomiting',
    story: 'A patient in DKA has vomited for two days. Anion gap 30, HCO₃⁻ 18 mmol/L.',
    values: { ag: 30, hco3: 18 },
    steps: [
      'Δ/Δ = (30 − 12) ÷ (24 − 18) = 3.',
      'The gap rose far more than the bicarbonate fell: something added bicarbonate back. That is a coexisting metabolic alkalosis from the vomiting.',
      'Clinically this means the HCO₃⁻ underestimates the severity of the ketoacidosis, and she will need chloride and potassium.',
    ],
    takeaway: 'Δ/Δ above 2: hidden metabolic alkalosis. Below 1: hidden normal-gap acidosis.',
  },
  winters: {
    title: 'The tired DKA patient',
    story: 'A young man in DKA: HCO₃⁻ 10 mmol/L, PCO₂ 34 mmHg, drowsy.',
    values: { hco3: 10 },
    steps: [
      'Expected PCO₂ ≈ 1.5 × 10 + 8 = 23 ± 2 mmHg.',
      'His measured PCO₂ of 34 is far above that: he is not compensating. He has a coexisting respiratory acidosis (fatigue, reduced consciousness, opioids).',
      'He is at risk of respiratory arrest. If he is intubated, set the ventilator to match his compensation (a low PCO₂), or the pH will fall sharply.',
    ],
    takeaway: 'A “normal” PCO₂ in severe metabolic acidosis is abnormal.',
  },
  alkComp: {
    title: 'Vomiting with a high PCO₂: lung disease or compensation?',
    story: 'A patient with pyloric obstruction: HCO₃⁻ 40 mmol/L, PCO₂ 50 mmHg, no lung history.',
    values: { hco3: 40 },
    steps: [
      'Expected PCO₂ ≈ 40 + 0.6–0.7 × 16 ≈ 50–51 mmHg.',
      'His PCO₂ matches: this is appropriate respiratory compensation, not a second disorder.',
      'Treat with saline and KCl. The PCO₂ will fall as the bicarbonate does.',
    ],
    takeaway: 'Hypoventilation to 50–55 mmHg can be pure compensation for metabolic alkalosis.',
  },
  respComp: {
    title: 'COPD: acute or chronic?',
    story: 'A patient with COPD has a PCO₂ of 60 mmHg and HCO₃⁻ 31 mmol/L, and says he has been “about the same” for months.',
    values: { pco2: 60, chronic: 1 },
    steps: [
      'Chronic compensation: HCO₃⁻ ≈ 24 + 0.35 × 20 = 31 mmol/L, which matches.',
      'Set “Chronic” to 0: acutely you would expect only 26 mmol/L. His 31 says the kidney has had days to respond.',
      'If a similar patient arrived with PCO₂ 80 and HCO₃⁻ 31, the extra rise is acute on chronic: a sign of decompensation.',
    ],
    takeaway: 'Compare the HCO₃⁻ with both the acute and chronic predictions to date a respiratory disorder.',
  },
  uag: {
    title: 'Normal-gap acidosis: gut or kidney?',
    story: 'A 34-year-old woman with Sjögren’s syndrome and kidney stones. HCO₃⁻ 15 mmol/L, normal anion gap, K⁺ 3.1 mmol/L. Urine Na⁺ 45, K⁺ 35, Cl⁻ 60 mmol/L; urine pH 6.5.',
    values: { una: 45, uk: 35, ucl: 60 },
    steps: [
      'UAG = 45 + 35 − 60 = +20: positive.',
      'A positive gap means little unmeasured NH₄⁺. In an acidotic patient that is an inappropriately low ammonium excretion: the kidney is the problem.',
      'With a urine pH above 5.5, stones, hypokalaemia and Sjögren’s, this is distal (type 1) RTA.',
      'Compare diarrhoea: set urine Cl⁻ to 110. The gap turns negative, meaning plenty of NH₄⁺ and a kidney responding appropriately.',
    ],
    takeaway: 'Negative UAG: “neGUTive” (gut losses). Positive: the kidney cannot excrete acid.',
  },
  fehco3: {
    title: 'Myeloma and a non-gap acidosis',
    story: 'A 64-year-old with multiple myeloma: HCO₃⁻ 16 mmol/L, glycosuria with normal blood glucose, low phosphate. During IV bicarbonate the plasma HCO₃⁻ reaches 22 mmol/L; urine HCO₃⁻ 100, urine creatinine 2.5 mmol/L, plasma creatinine 90 µmol/L.',
    values: { uhco3: 100, pcr: 90, phco3: 22, ucr: 2.5 },
    steps: [
      'FEHCO₃ = (100 × 90) ÷ (22 × 2.5 × 1000) × 100 ≈ 16%.',
      'Above 15% while plasma HCO₃⁻ is raised: the proximal tubule cannot reclaim bicarbonate. That is proximal (type 2) RTA.',
      'With glycosuria and phosphaturia, it is part of a Fanconi syndrome, here from filtered light chains injuring the proximal tubule.',
      'Treatment needs large alkali doses (because most of it is excreted) and K⁺ replacement, plus treatment of the myeloma.',
    ],
    takeaway: 'Proximal RTA shows itself only when you raise the bicarbonate.',
  },
  // ------------------------------------------------------------------ potassium
  ukcr: {
    title: 'Hypokalaemia: where is the potassium going?',
    story: 'A 28-year-old woman with K⁺ 2.9 mmol/L, normal blood pressure, no vomiting admitted. Spot urine K⁺ 12, urine creatinine 9 mmol/L.',
    values: { uk: 12, ucr: 9 },
    steps: [
      'UK/Ucr = 12 ÷ 9 ≈ 1.3 mmol/mmol: low. The kidney is conserving K⁺ appropriately.',
      'So the loss is extrarenal (diarrhoea, laxatives) or intake is low. Check the acid–base status: a metabolic acidosis would fit laxatives or diarrhoea.',
      'If the ratio were above 2.5, the kidney would be wasting K⁺: then think diuretics, vomiting (via aldosterone), or mineralocorticoid excess.',
    ],
    takeaway: 'First ask whether the kidney is losing K⁺. The spot K⁺/creatinine ratio answers that without a 24-hour collection.',
  },
  kdeficit: {
    title: 'Chronic diarrhoea',
    story: 'A 70-kg man with three weeks of diarrhoea. K⁺ 2.8 mmol/L, no acidosis-driven shift, normal kidney function.',
    values: { k: 2.8, wt: 70 },
    steps: [
      'Estimated deficit ≈ 300 × 1.2 ≈ 360 mmol (range about 240–480).',
      'Replace mostly by mouth, e.g. KCl 20–40 mmol three or four times a day, over several days. Intravenous KCl is usually limited to about 10 mmol/h through a peripheral line.',
      'Check and replace magnesium: low Mg²⁺ keeps ROMK open, so the kidney keeps wasting K⁺.',
      'Contrast: in DKA the plasma K⁺ is often normal or high despite a large deficit, because acidosis and insulin lack shift K⁺ out of cells. There the formula does not apply.',
    ],
    takeaway: 'The estimate sizes the problem; the plasma K⁺ response guides the dose.',
  },
  fek: {
    title: 'Hyperkalaemia on co-trimoxazole',
    story: 'A 60-year-old on lisinopril is given trimethoprim-sulfamethoxazole for a UTI. K⁺ 6.2 mmol/L, creatinine 95 µmol/L (unchanged). Urine K⁺ 25, urine creatinine 9 mmol/L.',
    values: { uk: 25, pcr: 95, pk: 6.2, ucr: 9 },
    steps: [
      'FEK = (25 × 95) ÷ (6.2 × 9 × 1000) × 100 ≈ 4%.',
      'With a near-normal GFR and a high K⁺, the kidney should be excreting K⁺ vigorously. 4% is inappropriately low.',
      'Two drugs explain it: trimethoprim blocks ENaC, like amiloride, removing the lumen-negative voltage, and the ACE inhibitor lowers aldosterone.',
      'Stop the trimethoprim and choose another antibiotic.',
    ],
    takeaway: 'Hyperkalaemia with a good GFR and low K⁺ excretion: look for a drug blocking the distal secretory machinery.',
  },
  // ------------------------------------------------------------------ minerals
  correctedCa: {
    title: 'Low calcium in cirrhosis',
    story: 'A patient with cirrhosis has total calcium 1.95 mmol/L and albumin 22 g/L. No symptoms, normal ECG.',
    values: { ca: 1.95, alb: 22 },
    steps: [
      'Corrected Ca ≈ 1.95 + 0.02 × (40 − 22) = 2.31 mmol/L: normal.',
      'The total is low because less calcium is bound to albumin; the ionised (active) fraction is probably normal.',
      'The correction is unreliable in critical illness, CKD and acid–base disturbances: when it matters, measure ionised calcium directly.',
    ],
    takeaway: 'Do not treat a low total calcium without checking albumin, and ideally ionised calcium.',
  },
  femg: {
    title: 'Hypomagnesaemia on a proton-pump inhibitor',
    story: 'A 67-year-old on omeprazole for years presents with tremor, K⁺ 3.0 and Mg²⁺ 0.40 mmol/L. Urine Mg²⁺ 0.3, urine creatinine 8 mmol/L, plasma creatinine 80 µmol/L.',
    values: { umg: 0.3, pcr: 80, pmg: 0.4, ucr: 8 },
    steps: [
      'FEMg = (0.3 × 80) ÷ (0.7 × 0.4 × 8 × 1000) × 100 ≈ 1.1%.',
      'Below 2%: the kidney is conserving magnesium. The loss is gastrointestinal: PPIs reduce intestinal Mg²⁺ absorption through TRPM6/7.',
      'Compare cisplatin: set urine Mg²⁺ to 3 and the FEMg rises to about 11%, which means renal wasting.',
      'Stop or switch the PPI, replace Mg²⁺, and the K⁺ will then correct.',
    ],
    takeaway: 'FEMg splits hypomagnesaemia into gut and kidney causes in one spot sample.',
  },
  fepo4: {
    title: 'Hypophosphataemia after IV iron',
    story: 'A 35-year-old with iron-deficiency anaemia received ferric carboxymaltose two weeks ago. Now tired, with phosphate 0.45 mmol/L. Urine phosphate 10, urine creatinine 7 mmol/L, plasma creatinine 70 µmol/L.',
    values: { upo4: 10, pcr: 70, ppo4: 0.45, ucr: 7 },
    steps: [
      'FEPO₄ = (10 × 70) ÷ (0.45 × 7 × 1000) × 100 ≈ 22%.',
      'Despite a very low plasma phosphate, the kidney is dumping it: renal wasting.',
      'Ferric carboxymaltose raises intact FGF23, which removes NaPi-II transporters from the proximal tubule and lowers calcitriol. It is often prolonged.',
      'Contrast refeeding: phosphate moves into cells, the kidney conserves it, and FEPO₄ is low.',
    ],
    takeaway: 'High FEPO₄ in hypophosphataemia means a hormone (PTH, FGF23) or a damaged proximal tubule.',
  },
  cccr: {
    title: 'Mild hypercalcaemia before parathyroid surgery',
    story: 'A 45-year-old with total calcium 2.75 mmol/L, PTH at the upper limit of normal, no stones, and a mother with “high calcium”. 24-hour urine: calcium 1.0 mmol/L, creatinine 8 mmol/L; plasma creatinine 80 µmol/L.',
    values: { uca: 1, pcr: 80, pca: 2.75, ucr: 8 },
    steps: [
      'CCCR = (1.0 × 80) ÷ (2.75 × 8 × 1000) ≈ 0.004.',
      'Below 0.01: familial hypocalciuric hypercalcaemia is likely, not primary hyperparathyroidism.',
      'FHH is benign and parathyroidectomy does not cure it. Confirm with CASR gene testing and screen relatives.',
      'Check first that she is not on a thiazide or lithium, and that vitamin D is replete, since all three lower urine calcium.',
    ],
    takeaway: 'Measure the calcium/creatinine clearance ratio before referring anyone for parathyroid surgery.',
  },
};
