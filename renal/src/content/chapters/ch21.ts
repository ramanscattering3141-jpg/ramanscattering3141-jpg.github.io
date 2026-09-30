import type { ChapterContent } from './types';

export const chapter: ChapterContent = {
  n: 21,
  title: 'Respiratory alkalosis',
  thesis:
    'A primary fall in PCO₂ is defended in two stages: within ten minutes hydrogen ions leave the cells and consume bicarbonate, about 2 mmol/L per 10 mmHg; over two to three days the kidney stops reclaiming bicarbonate and stops excreting the daily acid load, taking the total to about 4 mmol/L per 10 mmHg. The chronic defence is so good that the pH is almost normal, which is why chronic hypocapnia is nearly always symptomless — and why the important clinical fact about it is usually not the alkalosis at all, but what caused the hyperventilation.',
  concepts: [
    {
      heading: 'Two stages, ten minutes and three days',
      body: [
        'Hypocapnia lowers the extracellular hydrogen ion concentration, and within about ten minutes hydrogen ions move out of the cells to oppose it — from protein, phosphate and haemoglobin buffers, and from an alkalaemia-driven rise in cellular lactic acid production. Those hydrogen ions consume bicarbonate, so the plasma bicarbonate falls about 2 mmol/L for every 10 mmHg fall in PCO₂. Take the PCO₂ to 20 acutely and the bicarbonate goes to 20 and the pH to 7.63, against 7.70 with no buffering at all. Like the acute response to hypercapnia, it is a poor return.',
        'The renal response begins within two hours and is complete in two to three days: hydrogen secretion falls, bicarbonate appears in the urine and ammonium excretion falls, and both effects lower the plasma bicarbonate — the second by preventing the daily acid load from leaving. Together with the cell buffers this brings the total to about 4 mmol/L per 10 mmHg. The same PCO₂ of 20 now gives a bicarbonate of 16 and a pH of 7.53.',
        'Gennari\'s dogs show how the kidney does it, and it is not the same way it handles chronic hypercapnia. Adaptation to hypocapnia was linked to cation excretion rather than to chloride retention: on a normal salt intake the animals excreted sodium, and when sodium was restricted they excreted potassium instead. Recovery ran the same way in reverse, through cation retention.',
        'Chronic respiratory alkalosis is the only acid–base disorder in which compensation can return the pH essentially to normal. That has a practical corollary: a bicarbonate of 10 mmol/L or less is never the compensation for hypocapnia — it is a metabolic acidosis.',
      ],
      chain: [
        'Alveolar ventilation exceeds CO₂ production',
        'PCO₂ falls; H⁺ concentration falls',
        'Within 10 min: H⁺ leaves the cells, consuming HCO₃⁻ — 2 mmol/L per 10 mmHg',
        'Over 2–3 days: renal H⁺ secretion and NH₄⁺ excretion fall; HCO₃⁻ is lost in the urine',
        'Total ≈ 4 mmol/L per 10 mmHg; pH almost restored',
      ],
      points: ['Acute: −2 mmol/L HCO₃⁻ per 10 mmHg', 'Chronic: −4 mmol/L HCO₃⁻ per 10 mmHg', 'A bicarbonate ≤ 10 is never pure chronic hypocapnia'],
      cite: { refs: ['gennari1972', 'arbus1969'], rose: [21, 11], evidence: 'experimental' },
      route: '/respiratory',
    },
    {
      heading: 'Hypoxaemia, and the alkalosis that limits the response to it',
      body: [
        'The peripheral chemoreceptors in the carotid and aortic bodies respond to hypoxaemia; the central ones respond to the pH of the cerebral interstitium. Hypoxaemia therefore drives ventilation, but the hypocapnia it produces raises the cerebral pH and inhibits the central chemoreceptors, so the response is self-limiting. That is why in a normal subject hypoxaemia does not substantially increase ventilation until the PO₂ is below 50 to 60 mmHg, whereas if the PCO₂ is held constant — or cannot fall because of lung disease — ventilation begins to rise from a PO₂ of 70 to 80 mmHg.',
        'Persistent hypoxaemia escapes the limit. The renal compensation lowers the bicarbonate, the pH returns toward normal, the alkalaemic inhibition is removed, and ventilation can rise further. This is the physiology of acclimatisation to altitude, and it is the reason a chronic hypoxaemic stimulus produces more hyperventilation than an acute one of the same size.',
      ],
      points: ['Acute hypoxic drive: PO₂ below 50–60 mmHg', 'With a fixed or raised PCO₂: from PO₂ 70–80 mmHg', 'The renal compensation removes the brake on the hypoxic drive'],
      cite: { rose: [21, 20], evidence: 'physiology' },
      route: '/respiratory',
    },
    {
      heading: 'Lungs that hyperventilate without being hypoxic',
      body: [
        'Respiratory alkalosis is common in pneumonia, pulmonary embolism and interstitial fibrosis, and giving oxygen frequently does not correct it — so hypoxaemia is not the whole explanation. The additional drive comes from mechanoreceptors in the airways, lung and chest wall signalling through the vagus: juxtacapillary receptors in the alveolar interstitium activated by oedema, fibrosis or vascular congestion, and irritant receptors in the airway epithelium activated by inhaled irritants and probably by local inflammation. Vagal blockade abolishes the hyperventilation in animals.',
        'These receptors contribute little in health, and their effect in disease can be frankly maladaptive: patients with diffuse interstitial fibrosis are breathless out of proportion to their hypoxaemia, largely because of the increased ventilatory drive itself.',
        'The other route to hyperventilation is direct stimulation of the respiratory centre. Rose\'s list is worth carrying: psychogenic hyperventilation; hepatic failure, through retained amines; Gram-negative septicaemia, through bacterial toxins, where respiratory alkalosis is an early finding and should raise the possibility when nothing else explains it; salicylate intoxication; pregnancy and the luteal phase, through progesterone; neurological disease; and the period after a metabolic acidosis has been corrected with bicarbonate.',
        'That last one has a neat mechanism. Giving bicarbonate raises the arterial pH, the peripheral chemoreceptors sense it and ventilation falls, so the PCO₂ rises. Carbon dioxide crosses the blood–brain barrier quickly and bicarbonate does not, so the brain senses only the higher PCO₂ and the cerebrospinal fluid pH paradoxically falls — which keeps the hyperventilation going.',
      ],
      points: ['Oxygen often fails to correct it in lung disease', 'Early respiratory alkalosis is a clue to Gram-negative sepsis', 'Progesterone explains pregnancy and the luteal phase'],
      cite: { rose: [21], evidence: 'clinical' },
      route: '/respiratory',
    },
    {
      heading: 'Symptoms belong to the acute form',
      body: [
        'Light-headedness, altered consciousness, perioral and peripheral paraesthesiae, cramps, carpopedal spasm indistinguishable from that of hypocalcaemia, syncope, and supraventricular and ventricular arrhythmias in the critically ill. These come from increased neural excitability and from a fall in cerebral blood flow — 35 to 40 per cent if the PCO₂ falls by 20 mmHg.',
        'They are a feature of acute hypocapnia below a PCO₂ of 25 to 30 mmHg, where the cerebral pH rises substantially. Chronic respiratory alkalosis is nearly symptomless, because the pH is so well protected; and metabolic alkalosis causes less than either, because bicarbonate crosses the blood–brain barrier poorly so the cerebrospinal fluid pH rises less.',
        'One laboratory finding is worth recognising: severe respiratory alkalosis shifts phosphate into cells and the plasma phosphate can fall to 0.15–0.5 mmol/L. The mechanism is thought to be stimulation of glycolysis by the intracellular alkalosis, forming phosphorylated intermediates.',
        'Not everything the patient complains of is the alkalosis. In psychogenic hyperventilation, headache, breathlessness and chest tightness are commonly emotional in origin rather than consequences of the pH.',
      ],
      points: ['Symptoms below a PCO₂ of 25–30 mmHg, acute only', 'Cerebral blood flow falls 35–40% for a 20 mmHg fall in PCO₂', 'Plasma phosphate can fall to 0.15–0.5 mmol/L'],
      cite: { rose: [21], evidence: 'clinical' },
      route: '/respiratory',
    },
    {
      heading: 'Diagnosis, and the salicylate case',
      body: [
        'An alkaline pH with a low PCO₂ is respiratory alkalosis. What is harder is deciding whether it is acute, chronic, or mixed. At a PCO₂ of 20, the expected bicarbonate is about 20 acutely and about 16 chronically — so 16 to 20 is the range for an uncomplicated disorder, and values outside it mean a superimposed metabolic disorder.',
        'Even inside it, ambiguity remains. A bicarbonate of 16 at a PCO₂ of 20 fits uncomplicated chronic respiratory alkalosis, and equally fits acute respiratory alkalosis plus a metabolic acidosis. Rose\'s case: a stuporous five-year-old who has been playing with a bottle of aspirin. Salicylate stimulates the respiratory centre directly and also causes a metabolic acidosis, and the combination pulls the bicarbonate below the value the acute hypocapnia alone would explain.',
        'Treatment is of the cause, not of the pH. There is no place for respiratory depressants or for infusing acid. In a severely symptomatic patient with acute hypocapnia, rebreathing raises the inspired PCO₂ and relieves the symptoms — but monitor the pH, because the compensatory fall in bicarbonate persists and can leave the patient acidaemic as the PCO₂ returns to normal.',
      ],
      points: ['At PCO₂ 20: bicarbonate 16–20 is uncomplicated', 'Salicylate: respiratory alkalosis and metabolic acidosis together', 'Treat the cause; rebreathing only for acute symptoms'],
      cite: { rose: [21, 17, 19], evidence: 'clinical' },
      route: '/mixed',
      equation: 'respComp',
    },
  ],
  numbers: [
    { label: 'Acute compensation', value: '−2 mmol/L HCO₃⁻ per 10 mmHg', note: 'cell buffers; complete in ~10 min' },
    { label: 'Chronic compensation', value: '−4 mmol/L HCO₃⁻ per 10 mmHg', note: 'begins in 2 h, complete in 2–3 days' },
    { label: 'PCO₂ 20 acutely', value: 'HCO₃⁻ 20, pH 7.63' },
    { label: 'PCO₂ 20 chronically', value: 'HCO₃⁻ 16, pH 7.53' },
    { label: 'Symptom threshold', value: 'PCO₂ below 25–30 mmHg, acute' },
    { label: 'Cerebral blood flow', value: '−35 to −40% for a 20 mmHg fall in PCO₂' },
    { label: 'Plasma phosphate', value: 'can fall to 0.15–0.5 mmol/L', note: 'shift into cells; normal 0.8–1.45' },
  ],
  equations: ['respComp', 'hh', 'hplus'],
  clinical: [
    'A new respiratory alkalosis with no obvious cause should raise the question of Gram-negative sepsis.',
    'Chronic respiratory alkalosis is the one disorder in which compensation can restore the pH to normal — so a bicarbonate of 10 or less is a metabolic acidosis, whatever the PCO₂.',
    'Tetany and carpopedal spasm in an anxious hyperventilating patient look like hypocalcaemia; measure the ionised calcium before treating.',
    'In salicylate poisoning, expect both a respiratory alkalosis and a metabolic acidosis, and check whether the bicarbonate is lower than the hypocapnia alone would explain.',
    'If you use rebreathing, monitor the pH: the compensatory fall in bicarbonate persists after the PCO₂ comes back up.',
    'Pregnancy and the luteal phase both lower the PCO₂ through progesterone — a normal PCO₂ in late pregnancy may not be normal.',
  ],
  pathology: [
    {
      name: 'Salicylate intoxication',
      broken: 'Direct stimulation of the medullary respiratory centre, and uncoupling of oxidative phosphorylation',
      consequence: 'Acute respiratory alkalosis plus a high anion gap metabolic acidosis. The bicarbonate falls further than the hypocapnia alone would explain.',
      route: '/mixed',
    },
    {
      name: 'Gram-negative septicaemia',
      broken: 'Bacterial toxins stimulate ventilation',
      consequence: 'Respiratory alkalosis is often the earliest acid–base abnormality, well before the lactic acidosis of shock.',
      route: '/respiratory',
    },
    {
      name: 'Hepatic failure',
      broken: 'Retained amines stimulate the respiratory centre',
      consequence: 'Chronic respiratory alkalosis, often combined with the metabolic alkalosis of diuretic therapy for ascites.',
      route: '/edema',
    },
    {
      name: 'Interstitial lung disease',
      broken: 'Juxtacapillary and irritant mechanoreceptors signalling through the vagus',
      consequence: 'Hyperventilation and breathlessness out of proportion to the hypoxaemia, and not corrected by oxygen.',
      route: '/respiratory',
    },
    {
      name: 'High altitude',
      broken: 'Hypoxaemia drives ventilation; the renal compensation then removes the alkalaemic brake on it',
      consequence: 'Chronic respiratory alkalosis with a nearly normal pH and a bicarbonate appropriate to the PCO₂. The mechanism of acclimatisation.',
      route: '/respiratory',
    },
    {
      name: 'Over-ventilation on a ventilator',
      broken: 'Set minute ventilation exceeds CO₂ production',
      consequence: 'Iatrogenic hypocapnia; correct it by increasing dead space or reducing tidal volume or rate, not by treating the pH.',
      route: '/respiratory',
    },
  ],
  questions: [
    {
      q: 'A patient has a PCO₂ of 20 mmHg and a bicarbonate of 16 mmol/L. What is the disorder?',
      options: [
        'Uncomplicated chronic respiratory alkalosis',
        'Acute respiratory alkalosis with a metabolic acidosis',
        'Either — the numbers fit both, and only the history separates them',
        'Metabolic acidosis alone',
      ],
      answer: 2,
      explanation:
        'A 4 mmol/L fall per 10 mmHg gives exactly 16 for chronic hypocapnia. But an acute hypocapnia would predict 20, so a bicarbonate of 16 also fits acute hypocapnia plus a 4 mmol/L metabolic acidosis — which is Rose\'s salicylate case.',
      route: '/mixed',
    },
    {
      q: 'Why does acute hypoxaemia stimulate ventilation so much less than sustained hypoxaemia of the same degree?',
      options: [
        'The carotid bodies fatigue',
        'The hypocapnia it produces raises the cerebral pH and inhibits the central chemoreceptors; the renal compensation later removes that brake',
        'Haemoglobin adapts',
        'It does not — the responses are the same',
      ],
      answer: 1,
      explanation:
        'This is why ventilation rises from a PO₂ of 70–80 mmHg when the PCO₂ is held constant, but only below 50–60 mmHg when it is free to fall. It is also the physiology of acclimatisation to altitude.',
      route: '/respiratory',
    },
    {
      q: 'Why is chronic respiratory alkalosis nearly always symptomless when acute hypocapnia of the same degree causes tetany?',
      options: [
        'The patient gets used to it',
        'The renal compensation restores the pH almost to normal, and it is the rise in cerebral pH that causes the symptoms',
        'The calcium rises',
        'Chronic hypocapnia is always milder',
      ],
      answer: 1,
      explanation:
        'Chronic respiratory alkalosis is the only acid–base disorder in which compensation can return the pH essentially to normal. The same logic explains why metabolic alkalosis causes fewer neurological symptoms: bicarbonate crosses the blood–brain barrier poorly.',
      route: '/respiratory',
    },
    {
      q: 'After bicarbonate is given for a metabolic acidosis, the patient keeps hyperventilating. Why?',
      options: [
        'The bicarbonate was not enough',
        'The rise in PCO₂ that follows the reduced ventilation crosses into the brain faster than the bicarbonate, so the cerebrospinal fluid pH paradoxically falls and the drive persists',
        'Anxiety',
        'The kidney is compensating',
      ],
      answer: 1,
      explanation:
        'The same asymmetry — CO₂ crosses the blood–brain barrier easily, bicarbonate does not — explains why an abrupt fall in PCO₂ in chronic hypercapnia can cause seizures, and why neurological symptoms are worse in respiratory than in metabolic acid–base disorders.',
      route: '/respiratory',
    },
  ],
  updates: [
    {
      topic: 'Hypocapnia as a target in head injury',
      text: 'The chapter notes that respiratory alkalosis reduces cerebral blood flow by 35 to 40 per cent when the PCO₂ falls by 20 mmHg. For years that was used deliberately, hyperventilating head-injured patients to lower intracranial pressure. Practice reversed once it became clear that the same fall in cerebral blood flow can cause ischaemia in an already injured brain, and that the effect wanes within hours as the cerebrospinal bicarbonate adapts. Prophylactic hyperventilation is no longer recommended; brief hyperventilation is kept for acute herniation while definitive treatment is arranged. The physiological fact in the chapter is unchanged — only the judgement about whether to exploit it.',
      cite: { rose: [21], evidence: 'guideline', update: 'The same physiology, an opposite clinical conclusion.' },
    },
    {
      topic: 'Respiratory alkalosis as an early sepsis sign',
      text: 'The chapter singles out Gram-negative septicaemia as a cause of otherwise unexplained hyperventilation. Modern sepsis scoring has made the observation operational: a respiratory rate of 22 or more is one of the three bedside criteria in qSOFA, and tachypnoea remains among the earliest abnormalities in sepsis — often before the lactate rises or the blood pressure falls. The chapter\'s advice, to think of sepsis when hyperventilation has no other explanation, is now built into the screening.',
      cite: { rose: [21], evidence: 'guideline', update: 'A clinical clue turned into a screening criterion.' },
    },
  ],
  modules: ['/respiratory', '/mixed', '/acid-base'],
};
