import type { ChapterContent } from './types';

export const chapter: ChapterContent = {
  n: 19,
  title: 'Metabolic acidosis',
  thesis:
    'An acid load is met by four defences in sequence — extracellular bicarbonate, the cell and bone buffers, hyperventilation, and finally renal excretion — and only the last of them actually removes the acid. Because the buffering is so effective, the plasma bicarbonate never tells you how much acid arrived; and because the anion of that acid may be retained or excreted, the anion gap tells you which acid it was. Almost the whole diagnostic apparatus of the chapter is a way of asking those two questions: how much, and what anion.',
  concepts: [
    {
      heading: 'Four defences, only one of which is a cure',
      body: [
        'Extracellular bicarbonate takes the first hit. Add 12 mmol of hydrogen ion to each litre of extracellular fluid and, if nothing else happened, the bicarbonate would fall from 24 to 12 mmol/L — but the free hydrogen ion concentration would rise only from 40 to 80 nmol/L. More than 99.99 per cent of the added acid has disappeared onto bicarbonate. That is what a buffer is for, and it is why the plasma bicarbonate is a measure of how much buffer has been spent rather than of how acid the blood is.',
        'The cells and bone take most of the rest. On average 55 to 60 per cent of an acid load ends up buffered outside the extracellular fluid, on protein, phosphate and bone carbonate, and the proportion rises as the extracellular bicarbonate is depleted. So the same 12 mmol/L load lowers the plasma bicarbonate by 5 mmol/L, not 12.',
        'Hyperventilation is third. It begins within an hour or two and is maximal by 12 to 24 hours, and it works by raising tidal volume rather than rate — which is what makes Kussmaul breathing visible from the end of the bed.',
        'Renal excretion is the only one that ends the problem. The kidney has to reclaim the filtered bicarbonate and then excrete the acid as titratable acid and ammonium; nothing else removes the hydrogen ion from the body.',
      ],
      chain: [
        'H⁺ added',
        'Extracellular HCO₃⁻ buffers it (seconds)',
        'Cell and bone buffers take 55–60% (hours)',
        'Ventilation rises, PCO₂ falls (1–24 h)',
        'Kidney excretes the H⁺ as NH₄⁺ and titratable acid (days)',
      ],
      points: [
        '55–60% of an acid load is buffered outside the extracellular fluid',
        'Ventilation can reach 30 L/min against a normal 5–6',
        'The pH of 6.80 is about the limit compatible with life',
      ],
      cite: { rose: [19, 10, 11], evidence: 'physiology' },
      route: '/metabolic-acidosis',
    },
    {
      heading: 'The compensation that stops helping',
      body: [
        'The rule is that the PCO₂ falls 1.2 mmHg for every 1 mmol/L fall in bicarbonate, to a floor of 10 to 15 mmHg. A bicarbonate of 9 should therefore come with a PCO₂ near 22 and a pH of 7.23, not a pH of 6.98 — and a measured PCO₂ far from the predicted value is the definition of a mixed disorder.',
        'But hypocapnia also raises the renal tubular cell pH, which reduces hydrogen secretion and bicarbonate reabsorption. Over a few days the kidney lets bicarbonate go in the urine and the plasma bicarbonate falls further. Rose works the arithmetic: an uncompensated bicarbonate of 19 at a PCO₂ of 40 gives a pH of 7.29; acutely, a 6 mmHg fall in PCO₂ raises the pH to 7.37; chronically, the bicarbonate falls to 16 and the pH is back to 7.29.',
        'So respiratory compensation buys nothing in the long run. Fortunately the acidoses that are severe enough to matter — lactic acidosis, ketoacidosis, ingestions — are acute, and there the hypocapnia is genuinely protective.',
      ],
      points: ['PCO₂ ≈ 40 + 1.2 × (HCO₃⁻ − 24)', 'Floor of 10–15 mmHg', 'The chronic pH is the same with or without the compensation'],
      cite: { rose: [19, 17], evidence: 'physiology' },
      route: '/metabolic-acidosis',
      equation: 'winters',
    },
    {
      heading: 'The anion gap asks what the acid was',
      body: [
        'Sodium minus chloride minus bicarbonate is not a real gap; it is the difference between the unmeasured anions and the unmeasured cations, and in health almost all of it is the negative charge on albumin. The other unmeasured ions — potassium, calcium and magnesium on one side, phosphate, sulfate and organic anions on the other — very nearly cancel. Modern autoanalysers read chloride higher than the older ones, so the normal range is now about 5 to 11 rather than the 12 of the older literature, and the number from your own laboratory is the one to use.',
        'Because albumin is most of it, the gap must be corrected downwards in hypoalbuminaemia: about 2.5 mmol/L for every 1 g/dL below normal. A gap of 15 in someone with an albumin of 20 g/L is not mildly raised, it is markedly raised, because their baseline was about 3.',
        'Now the diagnosis. Add hydrochloric acid and chloride replaces the bicarbonate one for one: the gap does not move, and the acidosis is hyperchloraemic. Add lactic or ketoacid and the anion stays behind unmeasured: the gap rises. That is the whole of it — the gap is a question about the anion, not about the acid.',
      ],
      chain: [
        'Acid arrives with an anion',
        'H⁺ consumes bicarbonate',
        'If the anion is chloride → gap unchanged (hyperchloraemic)',
        'If the anion is retained (lactate, ketoacid, sulfate) → gap rises',
        'If the anion is excreted as fast as it arrives (hippurate, D-lactate) → gap normal despite an organic acid',
      ],
      points: ['Normal gap ≈ 5–11 on modern analysers', 'Subtract 2.5 per 1 g/dL fall in albumin', 'Above 25 there is almost always lactate, ketones, renal failure or an ingestion'],
      cite: { rose: [19], evidence: 'clinical' },
      route: '/metabolic-acidosis',
      equation: 'ag',
    },
    {
      heading: 'Δ gap over Δ bicarbonate, and why it is not 1:1',
      body: [
        'If the anion simply replaced the bicarbonate, the gap would rise exactly as much as the bicarbonate fell. It does not, because most of the hydrogen ion is buffered inside cells while the anion, being charged, cannot easily cross the lipid membrane and stays outside. The bicarbonate therefore falls less than the anion accumulates, and the ratio runs above one — about 1.6 to 1 in lactic acidosis.',
        'Ketoacidosis usually sits nearer 1:1, for a reason worth understanding: the filtered ketoacid load exceeds the tubule\'s capacity to reabsorb it, so the anions are lost in the urine, which lowers the gap and offsets the cell buffering. The better the renal function, the more anion is lost and the lower the ratio. It is higher when the glomerular filtration rate is down, from underlying disease or from the osmotic diuresis.',
        'Losing the anion in the urine is not harmless, though — it is exactly equivalent to losing bicarbonate, because each anion, had it been retained, would have been metabolised back into one. This is why a normal anion gap acidosis appears during the treatment of ketoacidosis: insulin clears the ketones, the gap returns to normal, but the bicarbonate comes back only part of the way.',
        'Between 1 and 2 is the uncomplicated range. Below 1 suggests a normal-gap acidosis superimposed on a high-gap one. Above 2 suggests a coexisting metabolic alkalosis that has held the bicarbonate up — a ratio of 3:1 in a vomiting patient with lactic acidosis is Rose\'s worked case.',
      ],
      points: ['Lactic acidosis ≈ 1.6:1', 'Ketoacidosis ≈ 1:1 because the anions are excreted', '< 1 → added hyperchloraemic acidosis; > 2 → added metabolic alkalosis'],
      cite: { rose: [19], evidence: 'clinical' },
      route: '/mixed',
    },
    {
      heading: 'The urine anion gap: a bedside ammonium assay',
      body: [
        'When the gap in the blood is normal, the question becomes whether the kidney is answering the acid load or causing it — and the answer is in how much ammonium is in the urine. Most laboratories do not measure it, but ammonium is excreted with chloride, so it can be inferred: urine sodium plus potassium minus chloride. If ammonium excretion is high, chloride exceeds the measured cations and the figure is negative.',
        'Batlle\'s 1988 study gives the numbers. Normal subjects given ammonium chloride for three days had a urine anion gap of −27 mmol/L and a urine pH of 4.9. Patients with diarrhoea also had a negative gap, −20 mmol/L, even though their urine pH was above 5.3. Every patient with a distal acidification defect had a positive gap: +23 in classic distal renal tubular acidosis, +30 in the hyperkalaemic form, +39 in selective aldosterone deficiency.',
        'That diarrhoea result is the point of the test. Hypokalaemia stimulates renal ammonia production, and the ammonia diffusing into the urine raises its pH — so a patient with diarrhoea and hypokalaemia can have an alkaline urine that looks like distal renal tubular acidosis. The urine anion gap separates them, because ammonium excretion is not impaired in diarrhoea.',
        'Two situations defeat it. In a high anion gap acidosis the unmeasured ketoacid or lactate anions in the urine make the gap positive whatever the ammonium is doing. And with avid sodium retention — urine sodium at or below 25 mmol/L — the tubule reabsorbs the chloride too, so no ammonium chloride is excreted and the gap fails to go negative; the volume depletion has itself produced a reversible distal acidification defect. Where the gap is uninterpretable, the urine osmolal gap estimates ammonium directly, roughly half the difference between measured and calculated urine osmolality.',
      ],
      points: [
        'Urine anion gap = Na⁺ + K⁺ − Cl⁻, a proxy for ammonium',
        'Negative → the kidney is excreting the acid (gut cause)',
        'Positive → the kidney is the problem',
        'Invalid in high-gap acidosis and when urine Na⁺ ≤ 25 mmol/L',
      ],
      cite: { refs: ['batlle1988'], rose: [19], evidence: 'clinical' },
      route: '/rta',
    },
    {
      heading: 'Renal failure: why the gap is high — or is not',
      body: [
        'The dietary acid load is mostly sulfuric acid from sulfur-containing amino acids. Excreting it requires two separate things: the hydrogen ion leaves as ammonium, a tubular function, while the sulfate leaves by filtration with only partial reabsorption. In a progressive renal disease both filtration and tubular function fall together, so both the acid and its anion are retained and the gap rises. Phosphate, urate and hippurate join the sulfate.',
        'Where tubular function is disproportionately impaired, the picture inverts. Sulfate reabsorption falls too, so sulfate excretion is maintained; the sodium leaving with it is replaced by sodium chloride reabsorption; and the result is retention of hydrogen and chloride with a normal anion gap. That is why the renal tubular acidoses, where filtration is intact, are hyperchloraemic while uraemic acidosis is not.',
        'The acidosis of renal failure is also notable for what it does not do: it plateaus. Bone carbonate is an enormous slowly exchangeable alkali reserve, and it buffers the retained acid at the cost of the skeleton. The bicarbonate settles around 12 to 20 mmol/L and stops falling, which is why patients survive years of positive acid balance.',
      ],
      points: ['Dietary acid ≈ 50–100 mmol/day, mostly H₂SO₄', 'Ammonium excretion per remaining nephron is normal in renal failure — there are just too few nephrons', 'Urine pH can still be lowered below 5.3 in renal failure'],
      cite: { rose: [19, 6], evidence: 'physiology' },
      route: '/ckd',
    },
    {
      heading: 'Three renal tubular acidoses, three different lesions',
      body: [
        'Type 1 is a failure of distal acidification. The collecting tubule cannot lower the urine pH below about 5.3, so both titratable acid and ammonium excretion fall, the dietary acid load is retained day after day, and the bicarbonate can fall below 10 mmol/L. Three lesions produce it: a defective H⁺-ATPase — absent from the intercalated cells altogether in some patients with Sjögren\'s syndrome, mutated in the inherited forms, often alongside mutations in the AE1 chloride–bicarbonate exchanger; a voltage defect, where reduced sodium reabsorption in the cortical collecting tubule removes the luminal electronegativity that both hydrogen and potassium secretion depend on, which is the hyperkalaemic variant seen in obstruction and sickle cell disease; and increased back-diffusion of hydrogen, documented only with amphotericin B.',
        'Type 2 is a lowered proximal threshold, not a proportional loss. Below the new threshold everything filtered is still reclaimed and the urine can be acidified normally; above it, bicarbonate pours out. That makes the disorder self-limiting, settling at a plasma bicarbonate of 14 to 20 mmol/L — the distal nephron mops up a good deal of what escapes, which is why even total abolition of proximal reabsorption only brings the bicarbonate to 11 or 12. It also makes it hard to treat: alkali given is promptly excreted, so 10 to 15 mmol/kg a day may be needed against the 1 to 2 that suffices in type 1.',
        'Type 4 is aldosterone deficiency or resistance. Distal hydrogen secretion falls, but the acidosis is usually mild and the urine can still be acidified — because the defect is ammonium production rather than acidification. The hyperkalaemia does much of that: a high tubular potassium concentration competes with ammonium for the potassium site on the Na⁺-K⁺-2Cl⁻ carrier in the loop, so medullary ammonium recycling fails. Correcting the potassium often corrects the acidosis.',
      ],
      points: [
        'Type 1: urine pH > 5.3, HCO₃⁻ may be < 10, K⁺ usually low, stones and nephrocalcinosis',
        'Type 2: HCO₃⁻ 14–20, FE HCO₃⁻ > 15% once the plasma level is normalised, rickets or osteomalacia',
        'Type 4: hyperkalaemic, HCO₃⁻ usually > 15, urine pH usually < 5.3',
      ],
      cite: { rose: [19, 11, 28], evidence: 'clinical' },
      route: '/rta',
    },
    {
      heading: 'Why type 1 makes stones and type 2 does not',
      body: [
        'Chronic acidaemia releases calcium and phosphate from bone during buffering and directly reduces their tubular reabsorption, so both are hypercalciuric and hyperphosphaturic, in proportion to how low the bicarbonate is. What differs is the urine they are excreted into. Type 1 has a persistently high urine pH, which favours calcium phosphate precipitation, and low citrate excretion, which removes the chelator that normally keeps calcium in solution. Type 2 can acidify the urine, and the unreabsorbed amino acids and organic anions of a leaky proximal tubule form soluble complexes with calcium.',
        'The hypocitraturia has its own logic. Acidosis and hypokalaemia both lower proximal tubular cell pH; an acid cell metabolises citrate, so cell citrate falls, the gradient for reabsorbing filtered citrate becomes more favourable, and citrate excretion falls. A low luminal pH also converts filtered citrate³⁻ into the more readily reabsorbed citrate²⁻.',
        'This is why potassium citrate, not sodium bicarbonate, is the preferred alkali in type 1: correcting the hypokalaemia raises citrate excretion further, and the natriuresis that a sodium salt causes would raise calcium excretion instead.',
      ],
      cite: { rose: [19, 3], evidence: 'clinical' },
      route: '/rta',
    },
    {
      heading: 'How much bicarbonate, and why not more',
      body: [
        'The aim in severe acidaemia is a pH of about 7.20, the level at which arrhythmias become less likely and the myocardium regains its response to catecholamines — not a normal pH. Once the respiratory compensation is working, very little bicarbonate is needed to get there: Rose\'s patient with a pH of 7.05 needs the bicarbonate raised from 6 to about 10.',
        'The apparent space of distribution is not the extracellular fluid. It is about 50 per cent of lean body weight at a normal plasma bicarbonate and rises as the bicarbonate falls, because an ever greater share of the buffering is being done by cells and bone; below 8 to 10 mmol/L it can exceed 70 per cent of body weight. Rose\'s working approximation is a space of (0.4 + 2.6 / [HCO₃⁻]) times lean body weight.',
        'Overshooting has real costs. Bicarbonate reduces ventilation and raises the PCO₂; carbon dioxide crosses the blood–brain barrier far faster than bicarbonate does, so the brain senses only the rise and the cerebrospinal fluid pH falls. Raising the arterial pH also shifts the oxyhaemoglobin curve left. And in lactic acidosis and ketoacidosis the retained anions will be metabolised back to bicarbonate once the underlying problem is treated, so alkali given early produces an alkalosis later.',
        'Measuring the pH fifteen minutes after an infusion overestimates what has been achieved: the bicarbonate equilibrates through the extracellular fluid within fifteen minutes but takes two to four hours to equilibrate with the cell and bone buffers.',
      ],
      points: ['Target pH 7.20, not 7.40', 'HCO₃⁻ space ≈ (0.4 + 2.6 / [HCO₃⁻]) × lean body weight', 'Equilibration with cell and bone buffers takes 2–4 h'],
      cite: { rose: [19], evidence: 'physiology' },
      route: '/metabolic-acidosis',
      equation: 'hco3deficit',
    },
  ],
  numbers: [
    { label: 'Dietary acid load', value: '50–100 mmol/day', note: 'mostly sulfuric acid from sulfur amino acids' },
    { label: 'Buffered outside the ECF', value: '55–60%', note: 'higher as the bicarbonate falls' },
    { label: 'Respiratory compensation', value: '1.2 mmHg per 1 mmol/L', note: 'floor 10–15 mmHg' },
    { label: 'Normal anion gap', value: '5–11 mmol/L', note: 'modern analysers; subtract 2.5 per 1 g/dL albumin' },
    { label: 'Δ gap / Δ HCO₃⁻', value: '1 to 2', note: '≈1.6 in lactic acidosis, ≈1 in ketoacidosis' },
    { label: 'Maximum NH₄⁺ excretion', value: '> 250 mmol/day', note: 'against 30–60 normally' },
    { label: 'Maximum net acid excretion', value: '~500 mmol/day', note: 'five times normal' },
    { label: 'Titratable acid', value: '10–40 mmol/day', note: 'capped by filtered phosphate' },
    { label: 'Minimum urine pH', value: '4.5–5.0', note: '> 5.3 during acidaemia defines a distal defect' },
    { label: 'Urine anion gap on NH₄Cl', value: '−27 mmol/L', note: 'Batlle 1988; +23 to +39 in renal tubular acidosis' },
    { label: 'Alkali needed', value: '1–2 mmol/kg/day in type 1; 10–15 in type 2', note: 'type 2 alkali is promptly re-excreted' },
  ],
  equations: ['ag', 'deltaratio', 'winters', 'hco3deficit', 'uag', 'uosmgap', 'nae', 'fehco3'],
  clinical: [
    'A bicarbonate of 10 mmol/L or less is metabolic acidosis: the renal compensation to chronic hypocapnia never goes that low.',
    'Calculate the anion gap on every set of electrolytes, and correct it for the albumin before deciding it is normal.',
    'In a normal-gap acidosis, the urine anion gap decides between a gut and a renal cause — unless the urine sodium is at or below 25 mmol/L, when it is uninterpretable.',
    'A urine pH above 5.3 during acidaemia means a distal acidification defect, infection with a urea-splitting organism, hypokalaemia, or volume depletion — not necessarily type 1 renal tubular acidosis.',
    'In organic acidoses, alkali is usually unnecessary: metabolism of the anion regenerates the bicarbonate. Giving it invites an overshoot.',
    'In diabetic ketoacidosis the presenting potassium is usually normal or high despite a large deficit; insulin will unmask it, so watch it hourly.',
    'Kussmaul breathing may be the only physical sign of a severe acidosis.',
  ],
  pathology: [
    {
      name: 'Lactic acidosis',
      broken: 'Pyruvate cannot be oxidised (hypoperfusion, hypoxia, drugs), so it is reduced to lactate',
      consequence: 'High anion gap acidosis with a Δ/Δ near 1.6. The anion is not lost in the urine because there is little urine. It regenerates bicarbonate once perfusion is restored.',
      route: '/metabolic-acidosis',
    },
    {
      name: 'Diabetic ketoacidosis',
      broken: 'Insulin deficiency releases free fatty acids, which are oxidised to acetoacetate and β-hydroxybutyrate',
      consequence: 'High anion gap acidosis with Δ/Δ near 1, because the ketoanions are filtered beyond tubular capacity and lost. Treatment converts it into a normal-gap acidosis.',
      route: '/hyperglycemia',
    },
    {
      name: 'Diarrhoea',
      broken: 'Stool carries up to 50 mmol/L of base out of the body',
      consequence: 'Normal anion gap acidosis with an appropriately negative urine anion gap. Volume depletion makes it worse by limiting the ammonium response.',
      route: '/hypovolemia',
    },
    {
      name: 'Type 1 (distal) renal tubular acidosis',
      broken: 'The collecting-tubule H⁺-ATPase, the luminal voltage that drives it, or the tight junction that holds the gradient',
      consequence: 'Urine pH stuck above 5.3, positive urine anion gap, progressive acidaemia, hypokalaemia, hypercalciuria, hypocitraturia, stones and nephrocalcinosis.',
      route: '/rta',
    },
    {
      name: 'Type 2 (proximal) renal tubular acidosis',
      broken: 'Proximal bicarbonate reabsorptive threshold, often with the rest of the Fanconi transport set',
      consequence: 'Self-limiting acidosis at 14–20 mmol/L, acid urine at the steady state, alkaline urine and > 15% fractional bicarbonate excretion once alkali is given, hypokalaemia that worsens on treatment, rickets and osteomalacia.',
      route: '/rta',
    },
    {
      name: 'Type 4 renal tubular acidosis',
      broken: 'Aldosterone action, and through the hyperkalaemia, medullary ammonium recycling',
      consequence: 'Mild hyperchloraemic acidosis with hyperkalaemia and an acid urine. Often corrects when the potassium is corrected.',
      route: '/hyperkalemia',
    },
    {
      name: 'Toluene (glue sniffing)',
      broken: 'Hippuric acid overproduction; hippurate is filtered and secreted, so almost none is reabsorbed',
      consequence: 'A normal anion gap despite an organic acid load, because the anion leaves as fast as it arrives — commonly mistaken for renal tubular acidosis.',
      route: '/metabolic-acidosis',
    },
    {
      name: 'Uraemic acidosis',
      broken: 'Too few nephrons: ammonium excretion per nephron is normal, total excretion is not',
      consequence: 'High anion gap acidosis from retained sulfate, phosphate, urate and hippurate, plateauing at 12–20 mmol/L on bone buffer, at the cost of the skeleton.',
      route: '/ckd',
    },
  ],
  questions: [
    {
      q: 'A patient has a bicarbonate of 9 mmol/L and a PCO₂ of 40 mmHg. What is the disorder?',
      options: [
        'Pure metabolic acidosis with appropriate compensation',
        'A combined metabolic and respiratory acidosis — the expected PCO₂ is about 22',
        'Metabolic acidosis with respiratory alkalosis',
        'Chronic respiratory alkalosis',
      ],
      answer: 1,
      explanation:
        'A 15 mmol/L fall in bicarbonate should lower the PCO₂ by about 18 mmHg. A "normal" PCO₂ here gives a pH of 6.98 and means ventilation is also failing.',
      route: '/mixed',
    },
    {
      q: 'A patient with diarrhoea, hypokalaemia and a normal anion gap acidosis has a urine pH of 6.3. Is this type 1 renal tubular acidosis?',
      options: [
        'Yes — the urine pH is above 5.3',
        'Not necessarily; hypokalaemia raises renal ammonia production and the ammonia raises the urine pH. The urine anion gap will be negative in diarrhoea and positive in type 1.',
        'No, because type 1 never has a normal gap',
        'Only if the potassium is below 3.0',
      ],
      answer: 1,
      explanation:
        'This is exactly the trap the urine anion gap was designed for. Batlle\'s diarrhoea patients had a mean urine pH of 5.64 and a mean urine anion gap of −20.',
      route: '/rta',
    },
    {
      q: 'An alcoholic patient has an anion gap of 54 and a bicarbonate of 9, a Δ/Δ ratio of about 3:1. What does the ratio suggest?',
      options: [
        'Pure lactic acidosis',
        'A coexisting metabolic alkalosis holding the bicarbonate up — in this case from vomiting',
        'A laboratory error',
        'A coexisting hyperchloraemic acidosis',
      ],
      answer: 1,
      explanation:
        'Rose\'s case: repletion corrected the volume, the lactate was metabolised back to bicarbonate, and the bicarbonate rose from 9 to 37. The true fall had been 28, giving the 1.7:1 typical of lactic acidosis.',
      route: '/mixed',
    },
    {
      q: 'Why does a patient with type 2 renal tubular acidosis need ten times the alkali that a patient with type 1 needs?',
      options: [
        'The acidosis is more severe',
        'Raising the plasma bicarbonate above the reduced threshold makes the kidney excrete the alkali again, so the dose has to stay ahead of urinary loss',
        'Absorption is poor',
        'The bicarbonate is consumed by bone',
      ],
      answer: 1,
      explanation:
        'It is also why the accompanying bicarbonaturia wastes potassium: a poorly reabsorbable anion arrives at the collecting duct in a patient who already has secondary hyperaldosteronism.',
      route: '/rta',
    },
    {
      q: 'A patient in diabetic ketoacidosis has a potassium of 5.4 mmol/L. What does that tell you about total body potassium?',
      options: [
        'It is high',
        'It is normal',
        'Almost nothing — insulin deficiency and hyperglycaemia have moved potassium out of cells, and the true state is usually marked depletion',
        'It is high because of the acidaemia',
      ],
      answer: 2,
      explanation:
        'Note that it is the insulin deficiency and hyperglycaemia doing this, not the acidaemia: organic acidoses have little effect on potassium distribution. Insulin will unmask the deficit within hours.',
      route: '/hyperglycemia',
    },
    {
      q: 'Why is bicarbonate given to a target pH of 7.20 rather than 7.40?',
      options: [
        'To save money',
        'Because 7.20 is where arrhythmias and the loss of inotropic response become unlikely, and going further risks a fall in cerebrospinal fluid pH, a left shift of the oxyhaemoglobin curve, and an overshoot alkalosis when the organic anions are metabolised',
        'Because the kidney cannot handle more',
        'Because a higher pH causes hypokalaemia',
      ],
      answer: 1,
      explanation:
        'CO₂ generated by the buffering reaction crosses into the brain faster than bicarbonate, so the brain sees the PCO₂ rise before it sees the bicarbonate.',
      route: '/metabolic-acidosis',
    },
  ],
  updates: [
    {
      topic: 'Bicarbonate in severe acidaemia',
      text: 'The chapter\'s position — bicarbonate for the severely acidaemic patient, aimed at a pH of about 7.20, and usually unnecessary in organic acidoses — has since been tested. BICAR-ICU randomised 389 critically ill adults with a pH of 7.20 or below to 4.2% sodium bicarbonate aimed at a pH above 7.30, or to no bicarbonate. The primary composite outcome did not differ (66% versus 71%, difference −5.5%, 95% CI −15.2 to 4.2). In the prespecified subgroup with acute kidney injury, day-28 survival was better with bicarbonate (54% versus 37%). Metabolic alkalosis, hypernatraemia and hypocalcaemia were commoner in the bicarbonate arm. So the overall answer remains that alkali does not help, with a possible exception where the kidney cannot regenerate the bicarbonate itself.',
      cite: { refs: ['jaber2018bicar'], rose: [19], evidence: 'guideline', update: 'A randomised trial where the chapter had only physiological reasoning.' },
    },
    {
      topic: 'Alkali for the acidosis of chronic kidney disease',
      text: 'The chapter treats uraemic acidosis mainly as something to correct for bone and growth. Since then, correcting it has been shown to slow the kidney disease itself. In de Brito-Ashurst\'s randomised trial, 134 patients with a creatinine clearance of 15–30 mL/min per 1.73 m² and a bicarbonate of 16–20 mmol/L took oral sodium bicarbonate or had standard care for two years. Creatinine clearance fell by 1.88 mL/min per 1.73 m² against 5.93 in the controls, rapid progression occurred in 9% against 45%, and end-stage disease in 6.5% against 33%. Nutritional measures improved. Later trials in less advanced disease have been less impressive, so this is not settled, but correcting a bicarbonate below about 22 mmol/L is now standard.',
      cite: { refs: ['britoashurst2009'], rose: [19, 6], evidence: 'clinical', update: 'A new reason to treat an old problem.' },
    },
    {
      topic: 'Toxic alcohols: fomepizole',
      text: 'The chapter\'s treatment of methanol and ethylene glycol poisoning is ethanol to compete for alcohol dehydrogenase, plus haemodialysis. Fomepizole, a direct inhibitor of the same enzyme, has since replaced ethanol in practice. In 19 patients with ethylene glycol poisoning, acid–base status normalised within hours and none of the ten who had a normal creatinine on presentation developed renal injury; in 11 patients with methanol poisoning, formate concentrations fell, the acidosis resolved, and no survivor had a residual visual deficit. The mechanism and the reasoning are exactly the chapter\'s — stop the parent alcohol being oxidised to its toxic acid — and the anion gap and osmolal gap remain the diagnostic tools.',
      cite: { refs: ['brent1999fomepizole', 'brent2001fomepizole'], rose: [19], evidence: 'clinical', update: 'The same mechanism, a better drug.' },
    },
    {
      topic: 'Bicarbonate during cardiac arrest',
      text: 'The chapter warns that bicarbonate given during cardiopulmonary resuscitation generates CO₂ that a failing circulation cannot excrete, so the arterial gas looks better while the tissues become more acid, and that mixed venous blood is the better guide. Resuscitation guidelines have since dropped routine bicarbonate from cardiac arrest entirely, keeping it for specific indications such as hyperkalaemia and tricyclic overdose. Monitoring has moved to end-tidal CO₂, which tracks the cardiac output generated by compressions and rises abruptly when spontaneous circulation returns.',
      cite: { refs: ['falk1988etco2'], rose: [19, 20], evidence: 'guideline', update: 'The chapter\'s physiological warning became a guideline.' },
    },
  ],
  modules: ['/metabolic-acidosis', '/rta', '/mixed', '/urine-chemistry', '/ckd'],
};
