import type { ChapterContent } from './types';

export const chapter: ChapterContent = {
  n: 20,
  title: 'Respiratory acidosis',
  thesis:
    'Carbon dioxide is the most powerful stimulus to breathing there is, so hypercapnia almost never means too much CO₂ was made — it means alveolar ventilation failed. Against an acute rise the body has almost nothing: bicarbonate cannot buffer carbonic acid, so only the cell buffers respond and the bicarbonate rises about 1 mmol/L per 10 mmHg. Given days, the kidney raises it by 3.5 per 10 and the pH is nearly restored — an elegant compensation that comes with a sting, because in protecting the pH it removes the drive to breathe.',
  concepts: [
    {
      heading: 'Why there is no acute defence',
      body: [
        'Bicarbonate is the body\'s main extracellular buffer and it is useless here, because it cannot buffer carbonic acid — adding bicarbonate to H₂CO₃ simply produces more bicarbonate and more carbonic acid. Everything therefore falls to the cell buffers, mainly haemoglobin and protein, which take up hydrogen ion and release bicarbonate into the plasma.',
        'The yield is about 1 mmol/L of bicarbonate for every 10 mmHg rise in PCO₂. Take the PCO₂ acutely to 80 and the bicarbonate goes to 28 and the pH to 7.17 — against 7.10 if nothing had happened at all. That is a poor return, and it is the reason acute hypercapnia is dangerous in a way that acute hypocapnia is not.',
        'A pH below 7.00 usually means the respiratory acidosis has metabolic company: acute pulmonary oedema with lactic acidosis is the classic combination.',
      ],
      chain: [
        'Alveolar ventilation falls',
        'PCO₂ rises; CO₂ + H₂O → H₂CO₃ → H⁺ + HCO₃⁻',
        'HCO₃⁻ cannot buffer H₂CO₃ — no extracellular defence',
        'H⁺ is taken up by haemoglobin and cell protein, releasing HCO₃⁻',
        '≈ 1 mmol/L HCO₃⁻ per 10 mmHg; pH falls steeply',
      ],
      points: ['Acute: HCO₃⁻ rises 1 mmol/L per 10 mmHg', 'PCO₂ 80 acutely → HCO₃⁻ 28, pH 7.17', 'pH < 7.00 suggests an added metabolic acidosis'],
      cite: { refs: ['arbus1969'], rose: [20, 11], evidence: 'physiology' },
      route: '/respiratory',
    },
    {
      heading: 'The renal compensation, and its price',
      body: [
        'Sustained hypercapnia raises renal hydrogen secretion — presumably through a fall in tubular cell pH — so the maximum bicarbonate reabsorptive capacity rises and a new steady state is reached after three to five days at about 3.5 mmol/L of bicarbonate per 10 mmHg of PCO₂. At a PCO₂ of 80 that means a bicarbonate near 38 and a pH of 7.30 instead of 7.17. Some patients tolerate a PCO₂ of 90 to 110 with a pH above 7.25 and no symptoms, provided oxygenation is maintained.',
        'It also means alkali therapy is both unnecessary and futile: the pH is already defended, and exogenous bicarbonate is promptly excreted without raising the steady-state level.',
        'The price is in the control of breathing. Two statements are commonly made about chronic hypercapnia — that the respiratory centre becomes insensitive to CO₂, and that hypoxaemia becomes the main drive. Both need qualifying. The apparent insensitivity is largely arithmetic: a given rise in PCO₂ produces a smaller rise in hydrogen ion concentration when the bicarbonate is high. Lower the bicarbonate with ammonium chloride and the slope of ventilation against PCO₂ returns toward normal, limited then by the mechanics of the diseased lung rather than by responsiveness to pH.',
        'Lowering the bicarbonate also raises baseline ventilation, so the PCO₂ falls and the PO₂ rises. The renal compensation protects the extracellular pH and, in doing so, removes the acidaemic stimulus to breathe — which makes both the hypoxaemia and the hypercapnia worse than they need to be. Diuretic-induced metabolic alkalosis does the same thing, and correcting it can measurably improve how the patient feels.',
      ],
      points: ['Chronic: HCO₃⁻ rises 3.5 mmol/L per 10 mmHg after 3–5 days', 'PCO₂ 80 chronically → HCO₃⁻ 38, pH 7.30', 'Exogenous alkali is excreted without raising the steady state'],
      cite: { refs: ['schwartz1965'], rose: [20, 11], evidence: 'experimental' },
      route: '/respiratory',
    },
    {
      heading: 'Hypoxaemia comes first, and why that matters',
      body: [
        'Every hypercapnic patient breathing room air is hypoxaemic, because the partial pressures in the alveolus must add to atmospheric. But hypoxaemia usually appears earlier and is more prominent, for two reasons: carbon dioxide crosses the alveolar capillary about twenty times as fast as oxygen; and increasing ventilation in the better parts of the lung excretes more CO₂ but cannot take up more oxygen, because haemoglobin there is already nearly saturated.',
        'So in asthma the sequence is hypoxaemia and hyperventilation first, with hypocapnia; as airway resistance rises the maximum minute ventilation falls and the PCO₂ climbs back toward normal. A "normal" PCO₂ of 40 in an acutely breathless asthmatic is therefore an ominous finding, not a reassuring one. More generally, in intrinsic lung disease even a few millimetres of hypercapnia means advanced dysfunction or a second insult to ventilatory drive.',
        'The relation between PO₂ and ventilation is also different once the PCO₂ is high. In a normal subject, hypoxaemia does not stimulate breathing much until the PO₂ falls below 50 to 60 mmHg, because the hypocapnic alkalosis it produces suppresses the respiratory centre. In chronic hypercapnia that fall in PCO₂ does not happen, so ventilation is being stimulated from a PO₂ of 80 mmHg downwards.',
        'That is why oxygen has to be given carefully — but not why the PCO₂ rises when it is given. Measured directly, oxygen reduces minute ventilation by only about 7 per cent, accounting for 5 mmHg of a 23 mmHg rise in PCO₂. Most of the rise comes from worsening ventilation–perfusion matching as hypoxic pulmonary vasoconstriction is released, and from the Haldane effect.',
      ],
      points: [
        'CO₂ diffuses ~20× faster than O₂ across the alveolar capillary',
        'A normal PCO₂ in an acute severe asthmatic means exhaustion',
        'Oxygen-induced hypercapnia is mostly V/Q mismatch and the Haldane effect, not hypoventilation',
      ],
      cite: { rose: [20], evidence: 'experimental' },
      route: '/respiratory',
    },
    {
      heading: 'Reading the numbers: three histories, one blood gas',
      body: [
        'Because the acute and chronic responses differ, a single set of arterial values will usually fit more than one story. Take a pH of 7.30, a PCO₂ of 70 and a bicarbonate of 31. The acute rule predicts 27, the chronic rule predicts 35, and 31 sits between them. It could be a metabolic acidosis complicating chronic hypercapnia — a patient with chronic bronchitis who develops diarrhoea. It could be acute on chronic hypercapnia — the same patient with pneumonia. It could be metabolic alkalosis with acute hypercapnia — five days of vomiting, then an asthma attack.',
        'The reverse case is just as ambiguous. A high PCO₂ with an alkaline pH is usually metabolic alkalosis on top of chronic hypercapnia — diuretics for cor pulmonale — but it can be acute hypocapnia superimposed on chronic hypercapnia, which is what mechanical ventilation produces and is called posthypercapnic alkalosis; or it can be an ordinary metabolic alkalosis whose respiratory compensation is a high PCO₂.',
        'And a set of values inside the confidence band is not proof of a simple disorder. Rose\'s example: stable chronic hypercapnia, then vomiting, then aspiration pneumonia. Three disorders, and the final blood gas is indistinguishable from uncomplicated severe chronic hypercapnia.',
        'The alveolar–arterial oxygen gradient adds one thing the acid–base numbers cannot. It is always raised in hypercapnia from intrinsic lung disease; a normal gradient effectively excludes lung disease and points to central hypoventilation, a chest wall or muscle problem — or to a primary metabolic alkalosis whose compensation is the hypercapnia.',
      ],
      points: ['Acute: HCO₃⁻ 24–29 for any PCO₂', 'Between the bands: three possible stories, and only the history separates them', 'A normal A–a gradient excludes intrinsic lung disease'],
      cite: { rose: [20, 17], evidence: 'clinical' },
      route: '/mixed',
      equation: 'aagrad',
    },
    {
      heading: 'Treatment: ventilate, and do not correct too fast',
      body: [
        'Reversing hypercapnia means increasing effective alveolar ventilation — treating the underlying disease, or ventilating. Bicarbonate has a narrow role: small doses over five to ten minutes if the PCO₂ cannot be brought under control in a severely acidaemic patient, and specifically in status asthmaticus, where raising the plasma bicarbonate lets the pH be held at a higher PCO₂ and therefore at a lower minute ventilation and lower transpulmonary pressures — which may reduce the risk of pneumothorax.',
        'Its hazards are worth knowing. It worsens pulmonary congestion in oedema. It does not protect the central nervous system, because bicarbonate does not readily cross the blood–brain barrier. It generates CO₂, which a failing circulation cannot excrete — during cardiac arrest the arterial gas can improve while the tissues become more acid, so mixed venous blood is the better guide. And a metabolic alkalosis often follows once the PCO₂ normalises.',
        'The mirror-image danger is correcting the PCO₂ too fast. Carbon dioxide leaves the brain quickly and bicarbonate does not, so an abrupt normalisation produces a sharp rise in cerebrospinal fluid pH and can cause seizures and coma. These improve if the PCO₂ is allowed back up. Since the renal compensation had already protected the arterial pH, there was never anything to gain from speed.',
        'For a superimposed metabolic alkalosis in an oedematous patient, acetazolamide lowers the bicarbonate and increases the urine output at the same time; a urine pH above 7.0 confirms it is working. Two cautions: aim for the bicarbonate that is appropriate to the PCO₂, not for 24, or the patient becomes severely acidaemic; and expect a transient rise in PCO₂ of 3 to 7 mmHg before the diuresis, from partial inhibition of red-cell carbonic anhydrase.',
      ],
      points: ['Lower a chronic PCO₂ gradually', 'Target the bicarbonate appropriate to the PCO₂, not 24', 'Acetazolamide 250–375 mg once or twice daily; urine pH > 7.0 confirms the effect'],
      cite: { rose: [20, 15, 18], evidence: 'clinical' },
      route: '/respiratory',
    },
  ],
  numbers: [
    { label: 'CO₂ production', value: '~15 000 mmol/day', note: 'excreted entirely by the lung' },
    { label: 'Normal PCO₂', value: '40 ± 4 mmHg' },
    { label: 'Acute compensation', value: '+1 mmol/L HCO₃⁻ per 10 mmHg', note: 'cell buffers only' },
    { label: 'Chronic compensation', value: '+3.5 mmol/L HCO₃⁻ per 10 mmHg', note: 'complete in 3–5 days' },
    { label: 'Ventilatory response to CO₂', value: '1–4 L/min per 1 mmHg', note: 'in normal subjects' },
    { label: 'Hypoxic drive threshold', value: 'PO₂ < 50–60 mmHg normally; < 80 if the PCO₂ is high' },
    { label: 'Oxygen target in chronic disease', value: 'PO₂ 60–65 mmHg', note: 'saturation above 90%' },
    { label: 'A–a gradient', value: '5–10 mmHg under 30 years; 15–20 in the elderly' },
  ],
  equations: ['respComp', 'aagrad', 'hh', 'hplus'],
  clinical: [
    'A normal PCO₂ in an acutely breathless asthmatic means the patient is tiring, not improving.',
    'Do not correct a chronic PCO₂ quickly: the cerebrospinal fluid pH rises far faster than the arterial pH and can cause seizures.',
    'Oxygen-induced hypercapnia is real but mostly not from hypoventilation — do not withhold oxygen from a hypoxaemic patient, titrate it.',
    'A superimposed metabolic alkalosis suppresses ventilation and worsens both the hypoxaemia and the hypercapnia. Look for the diuretic.',
    'Calculate the A–a gradient: if it is normal, the lungs are not the problem.',
    'During cardiopulmonary resuscitation, arterial blood can look far better than the tissues are; mixed venous blood is the better guide.',
  ],
  pathology: [
    {
      name: 'Acute exacerbation of COPD',
      broken: 'Alveolar ventilation, mostly through ventilation–perfusion mismatch',
      consequence: 'Acute-on-chronic hypercapnia: a bicarbonate between the acute and chronic bands with a falling pH. Needs ventilation, not alkali.',
      route: '/respiratory',
    },
    {
      name: 'Severe asthma',
      broken: 'Airway resistance rises until maximum minute ventilation falls below what is needed',
      consequence: 'Hypocapnia gives way to a normal and then a high PCO₂ — the sign of exhaustion. Bicarbonate has a specific role here: it lets the pH be held at a lower minute ventilation.',
      route: '/respiratory',
    },
    {
      name: 'Opiate or sedative overdose',
      broken: 'The medullary respiratory centre',
      consequence: 'Acute respiratory acidosis with a normal A–a gradient — which is what distinguishes it from lung disease.',
      route: '/respiratory',
    },
    {
      name: 'Obesity hypoventilation (Pickwickian) syndrome',
      broken: 'Chest wall mechanics plus, in those who become hypercapnic, a blunted central response to both CO₂ and hypoxia',
      consequence: 'Chronic hypercapnia with daytime somnolence. Most morbidly obese patients do not become hypercapnic, and among those who do the degree of obesity does not predict it.',
      route: '/respiratory',
    },
    {
      name: 'Obstructive sleep apnoea',
      broken: 'Passive pharyngeal collapse during inspiration',
      consequence: 'Repeated nocturnal hypoxaemia and hypercapnia with arousals. Chronic hypercapnia is unusual, because the CO₂ retained at night is excreted while awake.',
      route: '/respiratory',
    },
    {
      name: 'Posthypercapnic alkalosis',
      broken: 'The PCO₂ is normalised faster than the kidney can excrete the compensatory bicarbonate',
      consequence: 'Alkalaemia with a high bicarbonate, and a sharp rise in cerebrospinal fluid pH that can cause seizures. Prevented by lowering the PCO₂ slowly and by chloride repletion.',
      route: '/metabolic-alkalosis',
    },
  ],
  questions: [
    {
      q: 'Why does bicarbonate provide almost no acute buffering in respiratory acidosis?',
      options: [
        'There is not enough of it',
        'Bicarbonate cannot buffer carbonic acid — the reaction simply regenerates both',
        'It is all excreted by the kidney',
        'The pH is too low for it to work',
      ],
      answer: 1,
      explanation:
        'A buffer must be the conjugate base of a different acid. So everything falls to haemoglobin and cell protein, and the yield is only about 1 mmol/L of bicarbonate per 10 mmHg of PCO₂.',
      route: '/respiratory',
    },
    {
      q: 'A patient with chronic hypercapnia has a smaller ventilatory response to inhaled CO₂ than a normal subject. Has the respiratory centre lost its sensitivity to pH?',
      options: [
        'Yes, the chemoreceptors are damaged',
        'Not necessarily: with a high bicarbonate, the same rise in PCO₂ produces a smaller rise in hydrogen ion concentration. Lower the bicarbonate and the slope returns toward normal.',
        'Yes, because of the hypoxaemia',
        'The response is actually larger',
      ],
      answer: 1,
      explanation:
        'The increase in ventilation per unit rise in hydrogen ion concentration is the same before and after ammonium chloride. What is left is the mechanical limit of the diseased lung.',
      route: '/respiratory',
    },
    {
      q: 'A patient with COPD is given oxygen and the PCO₂ rises by 23 mmHg. How much of that is from reduced minute ventilation?',
      options: ['All of it', 'About 5 mmHg — most of the rise is worsening V/Q matching and the Haldane effect', 'None', 'It cannot be measured'],
      answer: 1,
      explanation:
        'Minute ventilation fell by only about 7 per cent in the study Rose cites. Releasing hypoxic pulmonary vasoconstriction sends blood to poorly ventilated areas, raising dead space; and oxygenated haemoglobin carries less CO₂.',
      route: '/respiratory',
    },
    {
      q: 'A patient with chronic bronchitis is started on a diuretic for cor pulmonale and becomes more breathless and more hypoxaemic. Why?',
      options: [
        'The diuretic caused pulmonary oedema',
        'A diuretic-induced metabolic alkalosis removed the acidaemic drive to breathe, so ventilation fell and both the PCO₂ and the hypoxaemia worsened',
        'The diuretic is a respiratory depressant',
        'Hypokalaemia caused muscle weakness alone',
      ],
      answer: 1,
      explanation:
        'The pH stimulus is intact in chronic hypercapnia; raising the pH suppresses ventilation. Acetazolamide, which lowers the bicarbonate while continuing the diuresis, can reverse it — aiming for the bicarbonate appropriate to the PCO₂, not for 24.',
      route: '/respiratory',
    },
  ],
  updates: [
    {
      topic: 'Non-invasive ventilation',
      text: 'The chapter\'s options for an acute exacerbation are treating the underlying disease or intubating. Non-invasive pressure support through a face mask has since become the first-line treatment. In Brochard\'s randomised trial of 85 patients admitted to intensive care with an acute exacerbation of chronic obstructive pulmonary disease, intubation was needed in 26 per cent with non-invasive ventilation against 74 per cent with standard treatment; complications occurred in 16 per cent against 48; hospital stay was 23 days against 35; and in-hospital mortality was 9 per cent against 29. The physiology is exactly the chapter\'s — the problem is alveolar ventilation, so supply it — but the delivery avoids the complications of an endotracheal tube.',
      cite: { refs: ['brochard1995niv'], rose: [20], evidence: 'clinical', update: 'A better way to do what the chapter says to do.' },
    },
    {
      topic: 'Bicarbonate during cardiac arrest',
      text: 'The chapter warns that bicarbonate given during resuscitation generates CO₂ a failing circulation cannot clear, so the arterial gas improves while the tissues become more acid, and recommends mixed venous blood as the guide. Resuscitation guidelines have since removed routine bicarbonate from cardiac arrest, keeping it for specific indications such as hyperkalaemia and tricyclic overdose. Monitoring moved to end-tidal CO₂, which reflects the pulmonary blood flow that compressions generate and rises abruptly — from about 1.3 to 3.7 per cent in Falk\'s series — when spontaneous circulation returns.',
      cite: { refs: ['falk1988etco2'], rose: [20, 19], evidence: 'guideline', update: 'The physiology became a monitoring standard.' },
    },
    {
      topic: 'Permissive hypercapnia',
      text: 'The chapter\'s observation that patients tolerate a PCO₂ of 90 to 110 with a pH above 7.25, provided oxygenation is maintained, prefigured a change in ventilator practice. Accepting a high PCO₂ rather than ventilating hard enough to normalise it — permissive hypercapnia — is now standard in severe asthma and acute respiratory distress syndrome, because the lung injury caused by large tidal volumes and high transpulmonary pressures matters more than the number on the blood gas. The chapter\'s suggestion of bicarbonate in status asthmaticus, to hold the pH at a lower minute ventilation, is the same idea.',
      cite: { rose: [20], evidence: 'clinical', update: 'The chapter\'s tolerance for hypercapnia became a ventilation strategy.' },
    },
  ],
  modules: ['/respiratory', '/mixed', '/acid-base'],
};
