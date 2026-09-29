import type { ChapterContent } from './types';

export const chapter: ChapterContent = {
  n: 17,
  title: 'Introduction to simple and mixed acid–base disorders',
  thesis:
    'Four primary disturbances, each with a compensation that moves the same way as the primary change and never quite finishes the job. That last part is what makes diagnosis possible: because compensation returns the pH towards normal but rarely to normal, a normal pH with an abnormal PCO₂ and bicarbonate is itself a finding. So is a PCO₂ of 40 in a patient who ought to be hyperventilating. The method is to predict what the compensation should be and measure how far the patient is from it.',
  concepts: [
    {
      heading: 'Why bicarbonate and PCO₂ are the pair that matters',
      body: [
        'The extracellular hydrogen ion concentration is about 40 nanomol/L — a millionth of the millimolar concentrations of sodium, potassium and chloride. It is defended so closely because H⁺ is small and reactive enough to bind strongly to charged groups on proteins, so small changes alter enzyme activity. The range compatible with life is roughly 16 to 160 nanomol/L, a pH of 7.80 to 6.80.',
        'The bicarbonate–CO₂ pair is the principal extracellular buffer not because it is the strongest, but because its two components are independently regulated: the kidney sets the bicarbonate by varying H⁺ secretion, and the lungs set the PCO₂ by varying ventilation. A buffer whose ratio can be adjusted from both ends is far more useful than one that cannot.',
        'Written as hydrogen ion concentration rather than pH, the relation is easy to use at the bedside: [H⁺] = 24 × PCO₂ ÷ [HCO₃⁻], in nanomol/L. At a PCO₂ of 40 and a bicarbonate of 24 that gives 40 nanomol/L, which is a pH of 7.40. To convert, start there and multiply by 0.8 for every 0.10 the pH rises, or by 1.25 for every 0.10 it falls.',
      ],
      points: ['Normal [H⁺] ≈ 40 nmol/L; life spans 16–160', '[H⁺] = 24 × PCO₂ ÷ [HCO₃⁻]', 'From pH 7.40: ×0.8 per +0.10, ×1.25 per −0.10'],
      equation: 'hplus',
      cite: { rose: [17, 10, 11], evidence: 'physiology' },
      route: '/mixed-disorders',
    },
    {
      heading: 'The four disorders, and why the bicarbonate alone tells you nothing',
      body: [
        'Metabolic acidosis is a primary fall in bicarbonate, compensated by hyperventilation. Metabolic alkalosis is a primary rise, compensated by hypoventilation. Respiratory acidosis is a primary rise in PCO₂, compensated by renal bicarbonate generation; respiratory alkalosis a primary fall, compensated by renal bicarbonate loss. In every case the compensation moves the same way as the primary change, because what is being defended is the ratio.',
        'It follows that a bicarbonate measured on a routine electrolyte panel cannot diagnose anything by itself. A high value occurs in metabolic alkalosis, where it is the problem, and in respiratory acidosis, where it is the solution. Only the pH distinguishes them.',
        'The metabolic and respiratory disorders also differ in their timing. Ventilatory compensation begins within minutes and is complete within 12 to 24 hours, so metabolic disorders have no meaningful acute and chronic forms. Renal compensation takes days, so respiratory disorders do — and in chronic respiratory acidosis the pH is far better protected than in acute, which is why the same PCO₂ means different things depending on how long it has been there.',
      ],
      chain: [
        'Primary change in either PCO₂ or bicarbonate',
        'pH moves',
        'The other component is adjusted in the same direction',
        'The ratio, and so the pH, is partly restored',
        'Never completely — which is what makes the residual measurable',
      ],
      cite: { rose: [17], evidence: 'physiology' },
      route: '/mixed-disorders',
    },
    {
      heading: 'The expected compensations',
      body: [
        'These are empirical, derived from observations in patients with each disorder rather than from theory, and they are the whole basis of the diagnostic method. For a metabolic acidosis the PCO₂ falls about 1.2 mmHg for every 1 mmol/L fall in bicarbonate; for a metabolic alkalosis it rises about 0.7 mmHg per 1 mmol/L.',
        'For the respiratory disorders there are two values each, because the immediate buffering and the later renal response are different processes. In acute respiratory acidosis the bicarbonate rises about 1 mmol/L per 10 mmHg rise in PCO₂, and in chronic about 3.5. In acute respiratory alkalosis it falls about 2 mmol/L per 10 mmHg, and in chronic about 4.',
        'The approach here uses these in vivo responses rather than in vitro constructs such as base deficit, whole blood buffer base or standard bicarbonate, which Rose regards as offering no advantage and frequently causing confusion.',
      ],
      points: [
        'Metabolic acidosis: PCO₂ ↓ 1.2 per 1 mmol/L ↓ HCO₃⁻',
        'Metabolic alkalosis: PCO₂ ↑ 0.7 per 1 mmol/L ↑ HCO₃⁻',
        'Acute respiratory acidosis: HCO₃⁻ ↑ 1 per 10 mmHg',
        'Chronic respiratory acidosis: HCO₃⁻ ↑ 3.5 per 10 mmHg',
        'Acute respiratory alkalosis: HCO₃⁻ ↓ 2 per 10 mmHg',
        'Chronic respiratory alkalosis: HCO₃⁻ ↓ 4 per 10 mmHg',
      ],
      equation: 'winters',
      cite: { rose: [17], evidence: 'clinical' },
      route: '/mixed-disorders',
    },
    {
      heading: 'Finding the second disorder',
      body: [
        'A patient who has taken an overdose of salicylate has a pH of 7.45, a PCO₂ of 20 and a bicarbonate of 13. The pH is high, so they are alkalaemic; only the low PCO₂ can explain that, so the primary problem is a respiratory alkalosis, acute given the history. Acutely, a fall in PCO₂ from 40 to 20 should lower the bicarbonate by 2 per 10 mmHg — from 24 to 20. The measured 13 is far lower than that, so there is a metabolic acidosis as well. That combination is characteristic of salicylate poisoning.',
        'A normal pH is not reassuring when the other two numbers are abnormal. A patient with a pH of 7.40, a PCO₂ of 60 and a bicarbonate of 37 has a respiratory acidosis and a metabolic alkalosis together — most often a diuretic given to someone with severe chronic lung disease. Compensation alone would not have brought the pH all the way back.',
        'And a PCO₂ of 40 is not always normal. A patient whose bicarbonate has fallen from 24 to 8 should have dropped their PCO₂ by about 19 mmHg, to 21, giving a pH near 7.20. If the PCO₂ is still 40, it is inappropriately high by 19 mmHg and the patient has a respiratory acidosis on top of the metabolic one — and a far lower pH than the bicarbonate alone would suggest.',
      ],
      chain: [
        'Start with the pH: acidaemic or alkalaemic?',
        'Which of PCO₂ and bicarbonate could explain it? That is the primary disorder',
        'Predict the compensation for that disorder',
        'Compare the prediction with the measurement',
        'A difference is a second disorder',
      ],
      cite: { rose: [17, 19], evidence: 'clinical' },
      route: '/mixed-disorders',
    },
    {
      heading: 'Potassium moves with acid–base, but not always',
      body: [
        'More than half the excess hydrogen ions in a metabolic acidosis are buffered inside cells, and electroneutrality is partly maintained by potassium moving out. Plasma potassium therefore rises relative to total body stores — sometimes to overt hyperkalaemia, sometimes only to a normal value in a patient who is in fact depleted, which declares itself when the acidaemia is corrected and the potassium falls further.',
        'The average is a rise of about 0.6 mmol/L for every 0.1 fall in pH, but the reported range is 0.2 to 1.7. That range is the point: the fall in potassium that treatment will produce cannot be predicted, so it has to be measured.',
        'The important exceptions are lactic acidosis and ketoacidosis, where a fall in pH is much less likely to raise the potassium. The hyperkalaemia commonly seen in diabetic ketoacidosis relates to insulin deficiency and hyperosmolality rather than to the acidaemia, and why organic acidoses behave differently is not well understood.',
        'The relation also runs the other way. A rise in plasma potassium causes a mild metabolic acidosis: potassium entering cells is balanced partly by hydrogen ions leaving them, and the resulting rise in renal tubular cell pH reduces ammonium and so net acid excretion. In hypoaldosteronism the mild acidosis is primarily a consequence of the hyperkalaemia.',
      ],
      points: [
        'Metabolic acidosis: plasma K⁺ up ~0.6 mmol/L per 0.1 pH fall (range 0.2–1.7)',
        'Not in lactic acidosis or ketoacidosis',
        'Hyperkalaemia itself causes a mild metabolic acidosis',
        'Respiratory disorders shift potassium very little',
      ],
      cite: { rose: [17, 12], evidence: 'clinical' },
      route: '/potassium',
    },
    {
      heading: 'What can go wrong with the measurement',
      body: [
        'Blood must be drawn anaerobically and measured quickly or cooled, since continued glycolysis by leucocytes and red cells produces organic acids that lower the pH and bicarbonate in the syringe. Air bubbles occupying more than 1–2% of the sample equilibrate with it and underestimate the PCO₂.',
        'Heparin dilution is a real hazard in intensive care. Sampling from an indwelling arterial line flushed with heparin without discarding the first 8–10 mL can give values as absurd as a pH of 6.50 and a PCO₂ of 3.5. In a heparinised syringe the anticoagulant should be less than 5% of the sample volume.',
        'Most importantly, arterial values do not always reflect the tissues. In severe circulatory failure or cardiac arrest, pulmonary blood flow is low, so the blood that does reach the lungs is well cleared of CO₂ while venous return is slow. In one study, patients undergoing cardiopulmonary resuscitation with a mean arterial pH of 7.42 and PCO₂ of 32 had mixed venous values of 7.14 and 74. If the venous values are closer to the cellular truth, the arterial gas is actively misleading.',
      ],
      cite: { rose: [17], evidence: 'clinical' },
      route: '/mixed-disorders',
    },
  ],
  numbers: [
    { label: 'Normal arterial [H⁺]', value: '37–43 nmol/L (pH 7.37–7.43)' },
    { label: 'Normal arterial PCO₂', value: '36–44 mmHg' },
    { label: 'Normal arterial HCO₃⁻', value: '22–26 mmol/L' },
    { label: 'Venous, for comparison', value: 'pH 7.32–7.38, PCO₂ 42–50, HCO₃⁻ 23–27' },
    { label: 'Range compatible with life', value: '[H⁺] 16–160 nmol/L (pH 7.80–6.80)' },
    { label: 'Metabolic acidosis compensation', value: 'PCO₂ ↓ 1.2 mmHg per 1 mmol/L ↓ HCO₃⁻' },
    { label: 'Metabolic alkalosis compensation', value: 'PCO₂ ↑ 0.7 mmHg per 1 mmol/L ↑ HCO₃⁻' },
    { label: 'Acute respiratory acidosis', value: 'HCO₃⁻ ↑ 1 mmol/L per 10 mmHg' },
    { label: 'Chronic respiratory acidosis', value: 'HCO₃⁻ ↑ 3.5 mmol/L per 10 mmHg' },
    { label: 'Acute respiratory alkalosis', value: 'HCO₃⁻ ↓ 2 mmol/L per 10 mmHg' },
    { label: 'Chronic respiratory alkalosis', value: 'HCO₃⁻ ↓ 4 mmol/L per 10 mmHg' },
    { label: 'Ventilatory compensation is complete in', value: '12–24 h' },
    { label: 'Renal compensation takes', value: 'days' },
    { label: 'K⁺ rise per 0.1 fall in pH', value: '~0.6 mmol/L (range 0.2–1.7)' },
    { label: 'Blood to discard from an arterial line', value: 'first 8–10 mL' },
  ],
  equations: ['hh', 'hplus', 'winters', 'respComp', 'alkComp', 'ag'],
  clinical: [
    'Read the pH first. It tells you which direction the primary disorder is in; the other two numbers tell you which one it is.',
    'A bicarbonate on its own diagnoses nothing — a high value is metabolic alkalosis or compensated respiratory acidosis, and only the pH separates them.',
    'Predict the expected compensation and compare. A measured value that differs from the prediction is a second disorder, not a variation.',
    'A normal pH with an abnormal PCO₂ and bicarbonate is a mixed disorder until proven otherwise: compensation returns the pH towards normal, rarely to it.',
    'A PCO₂ of 40 in a patient with a bicarbonate of 8 is a respiratory acidosis, however normal it looks.',
    'Acute and chronic matter only for the respiratory disorders, because only the renal compensation is slow.',
    'Expect the plasma potassium to fall as a metabolic acidosis is corrected, but do not predict by how much — measure it.',
    'In cardiac arrest or severe shock, an arterial gas can look acceptable while the tissues are profoundly acidotic. Consider a mixed venous sample.',
  ],
  pathology: [
    { name: 'Salicylate poisoning', broken: 'Respiratory centre stimulated and metabolism deranged', consequence: 'Respiratory alkalosis and metabolic acidosis together; bicarbonate far below the predicted compensation', route: '/mixed-disorders' },
    { name: 'COPD on a diuretic', broken: 'Ventilation, plus chloride and potassium depletion', consequence: 'Respiratory acidosis with metabolic alkalosis — pH can be normal', route: '/mixed-disorders' },
    { name: 'Shock with sepsis', broken: 'Tissue perfusion and the respiratory centre', consequence: 'Lactic acidosis with respiratory alkalosis', route: '/mixed-disorders' },
    { name: 'Cardiac arrest', broken: 'Pulmonary blood flow', consequence: 'Arterial gas near normal while mixed venous pH is 7.14 — the arterial sample misleads', route: '/mixed-disorders' },
    { name: 'Vomiting with renal failure', broken: 'Acid loss and acid excretion together', consequence: 'Metabolic alkalosis and metabolic acidosis — bicarbonate may be normal, the anion gap is not', route: '/mixed-disorders' },
    { name: 'Hypoaldosteronism', broken: 'Aldosterone, hence K⁺ and H⁺ secretion', consequence: 'Hyperkalaemia with a mild metabolic acidosis, largely caused by the hyperkalaemia', route: '/rta' },
  ],
  questions: [
    {
      q: 'pH 7.45, PCO₂ 20 mmHg, HCO₃⁻ 13 mmol/L. What is the disorder?',
      options: ['Pure respiratory alkalosis', 'Respiratory alkalosis with a metabolic acidosis', 'Pure metabolic acidosis', 'Metabolic alkalosis'],
      answer: 1,
      explanation:
        'The high pH must come from the low PCO₂, so the primary disorder is respiratory alkalosis. Acutely a fall of 20 mmHg should drop the bicarbonate by 4, to 20. It is 13, so something else is consuming bicarbonate. This is the classical salicylate pattern.',
      route: '/mixed-disorders',
    },
    {
      q: 'pH 7.40, PCO₂ 60 mmHg, HCO₃⁻ 37 mmol/L. A normal pH — is anything wrong?',
      options: ['No, the pH is normal', 'Yes: respiratory acidosis and metabolic alkalosis together', 'Chronic respiratory acidosis alone', 'Laboratory error'],
      answer: 1,
      explanation:
        'Compensation returns the pH towards normal but rarely to it. A normal pH with a PCO₂ of 60 and a bicarbonate of 37 means two disorders pulling in opposite directions — classically a diuretic given to someone with chronic lung disease.',
      route: '/mixed-disorders',
    },
    {
      q: 'A patient’s bicarbonate has fallen to 8 mmol/L and the PCO₂ is 40 mmHg. Comment.',
      options: ['Appropriate compensation', 'The PCO₂ is inappropriately high by about 19 mmHg — there is a respiratory acidosis as well', 'The bicarbonate must be wrong', 'A metabolic alkalosis is developing'],
      answer: 1,
      explanation:
        'A 16 mmol/L fall in bicarbonate should lower the PCO₂ by about 19 mmHg, to 21. Staying at 40 makes the acidaemia far worse than the bicarbonate alone predicts. A normal-looking number is not a normal finding.',
      route: '/mixed-disorders',
    },
    {
      q: 'A PCO₂ of 60 mmHg is found in two patients. In one the bicarbonate is 26, in the other 45. What does the difference tell you?',
      options: [
        'Nothing useful',
        'How long it has been there: about 1 mmol/L per 10 mmHg is acute buffering, about 3.5 is established renal compensation',
        'The second has a metabolic alkalosis',
        'The first is sicker',
      ],
      answer: 1,
      explanation:
        'Only the respiratory disorders have an acute and a chronic form, because only the renal response is slow. The first patient has acute hypercapnia and will be markedly acidaemic; the second has had it for days and is much better protected.',
      route: '/respiratory',
    },
    {
      q: 'Why is a plasma bicarbonate on a routine electrolyte panel not enough to diagnose an acid–base disorder?',
      options: [
        'It is measured inaccurately',
        'A high value occurs both in metabolic alkalosis, where it is the problem, and in respiratory acidosis, where it is the compensation — only the pH separates them',
        'It is affected by the anion gap',
        'It only measures dissolved CO₂',
      ],
      answer: 1,
      explanation: 'The compensation always moves in the same direction as the primary change, so the bicarbonate alone cannot say which is which.',
      route: '/mixed-disorders',
    },
    {
      q: 'A patient in metabolic acidosis has a plasma potassium of 4.0 mmol/L. What happens when the acidaemia is corrected?',
      options: ['Nothing', 'It is likely to fall, possibly a long way — the 4.0 already conceals a deficit', 'It will rise', 'It becomes unmeasurable'],
      answer: 1,
      explanation:
        'Acidaemia shifts potassium out of cells, so a normal plasma value in an acidotic patient usually means a depleted total body store. The average shift is 0.6 mmol/L per 0.1 pH but the range is 0.2 to 1.7, so it must be measured rather than predicted.',
      route: '/potassium',
    },
  ],
  updates: [
    {
      topic: 'The physicochemical (Stewart) approach',
      text: 'An alternative framework treats the pH as determined by three independent variables — the strong ion difference, the total weak acid concentration and the PCO₂ — with bicarbonate as a dependent variable rather than a cause. It is arithmetically equivalent to the traditional approach for the same data and identifies the same disturbances; its advocates argue it handles the effect of albumin and unmeasured ions more transparently, and its critics that it renames rather than resolves. Rose’s bedside method, of predicting the compensation and measuring the difference, remains the one most clinicians use, and nothing in this chapter is overturned by the alternative.',
      cite: { rose: [17], evidence: 'reasoning', update: 'An alternative formalism, not a correction.' },
    },
    {
      topic: 'Correcting the anion gap for albumin',
      text: 'The anion gap is generated largely by the negative charge on albumin, so hypoalbuminaemia lowers it and can conceal a raised gap in exactly the patients — critically ill, nephrotic, cirrhotic — most likely to have one. Adding roughly 2.5 mmol/L to the gap for every 10 g/L the albumin falls below normal is now routine, and the model reports both the raw and corrected values.',
      cite: { rose: [17, 19], evidence: 'clinical', update: 'Not in the chapter; now standard practice.' },
    },
  ],
  modules: ['/mixed-disorders', '/acid-base', '/bicarbonate', '/respiratory'],
};
