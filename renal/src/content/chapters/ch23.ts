import type { ChapterContent } from './types';

export const chapter: ChapterContent = {
  n: 23,
  title: 'Hypoosmolal states — hyponatraemia',
  thesis:
    'Two questions, and the second is the one that makes the diagnosis. How did the water get retained? And why is it still there? A normal kidney excretes more than ten litres of water a day, so hyponatraemia almost never means too much drinking — it means water excretion is impaired, and the impairment need not be severe. Almost every hyponatraemic patient who is not in renal failure or drinking enormously has an excess of antidiuretic hormone, either because something is secreting it inappropriately or because the effective circulating volume is low and the hormone is doing its job.',
  concepts: [
    {
      heading: 'Generation is the easy half',
      body: [
        'Either solute loss or water retention can lower the plasma sodium, but solute is almost always lost in a fluid that is isosmotic to plasma — vomit, diarrhoea, drainage — and an isosmotic loss cannot change a concentration. It becomes hyponatraemia only when the loss is replaced with water. So water retention is the common denominator, and the corollary is worth holding on to: hypoosmolality cannot be produced without water intake.',
        'The one real exception is the thiazide diuretic, where sodium plus potassium can be lost in a fluid more concentrated than plasma. In one series the urine sodium plus potassium averaged 156 mmol/L while the plasma levels were below 110. That loss lowers the plasma sodium directly, whatever the patient drinks.',
      ],
      points: ['Isosmotic loss alone changes no concentration', 'No water intake, no hypoosmolality', 'Thiazides are the exception: effective solute lost in excess of water'],
      cite: { rose: [23, 22], evidence: 'physiology' },
      route: '/hyponatremia',
    },
    {
      heading: 'Why the water stays: the hormone and the delivery',
      body: [
        'Antidiuretic hormone secretion stops when the plasma osmolality falls below about 275 mmol/kg — a plasma sodium near 135. Without it the urine osmolality falls to 40–100 mmol/kg and more than 10 litres a day of solute-free water can be excreted, with more than 80 per cent of a water load gone within four hours. Against that capacity, water retention takes real impairment.',
        'Free-water excretion needs two things: sodium chloride reabsorbed without water in the loop and distal tubule to generate dilute fluid, and a collecting duct kept impermeable so the water actually leaves. Anything that reduces delivery to the diluting segments — a fall in glomerular filtration rate, increased proximal reabsorption — limits the first. Antidiuretic hormone defeats the second, and it is much the more important of the two: an antagonist reverses the defect in experimental heart failure and cirrhosis without improving perfusion at all.',
        'The impairment can be modest and still do it. Rose\'s arithmetic: a patient taking 400 mosmol of solute and two litres of net water a day needs an average urine osmolality of 200 to stay in balance. If they cannot get below 222 — still hypotonic to plasma — that solute leaves in 1800 mL, 200 mL of water is retained every day, and the sodium drifts down. A urine osmolality of 100 to 200 is hypotonic and still inappropriately high.',
      ],
      chain: [
        'Plasma osmolality falls below ~275',
        'ADH secretion should stop',
        'Urine osmolality 40–100; > 10 L/day of free water excreted',
        'Unless ADH persists — inappropriately, or because volume is low',
        'Then even a modest impairment retains water day after day',
      ],
      points: ['ADH off below Posm 275', 'Maximum free-water excretion > 10 L/day', '> 80% of a water load excreted in 4 h', 'Uosm 100–200 is hypotonic and still inappropriate'],
      cite: { rose: [23, 4, 9], evidence: 'physiology' },
      route: '/hyponatremia',
      equation: 'efwc',
    },
    {
      heading: 'Effective circulating volume: appropriate ADH',
      body: [
        'Hypovolaemia acting through the carotid sinus baroreceptors is a potent stimulus to antidiuretic hormone, and this is appropriate: the retained water is trying to restore the circulation. The same thing happens when the total volume is expanded but the arterial side is not — heart failure with a low cardiac output, cirrhosis with a dilated splanchnic bed. Almost all hyponatraemic patients with advanced heart failure or cirrhosis have raised antidiuretic hormone levels, and an angiotensin converting enzyme inhibitor that improves perfusion can reverse the hypersecretion.',
        'Volume depletion also reduces delivery to the diluting segments by lowering the filtration rate and raising proximal reabsorption, and it stimulates thirst. Three effects, all pushing the same way.',
        'Because the water-excreting capacity is normally so large, even a small fall in the plasma sodium in heart failure means a severe impairment. It follows that hyponatraemia does not occur in these disorders until the disease is advanced — and that a plasma sodium below 137 in heart failure carries a significantly worse survival.',
        'Potassium depletion contributes too, and by a route that is easy to miss: potassium leaves the cells to replete the extracellular store, sodium moves in to preserve electroneutrality, and the plasma sodium falls. In a normal subject this is transient, because antidiuretic hormone is suppressed and the water leaves; if the hormone is raised, the fall persists. Giving potassium chloride alone can then correct the sodium.',
      ],
      points: [
        'Hypovolaemic ADH release is appropriate — perfusion before tonicity',
        'Hyponatraemia in heart failure means advanced disease and a worse prognosis',
        'Potassium depletion lowers the sodium; KCl alone can raise it',
      ],
      cite: { rose: [23, 8, 16], evidence: 'clinical' },
      route: '/hyponatremia',
    },
    {
      heading: 'SIADH, and why the patient is not oedematous',
      body: [
        'The syndrome is defined by two things happening together: impaired water excretion, and entirely normal sodium handling. Water is retained and the plasma is diluted; the volume receptors then see the expansion and increase sodium and water excretion, partly through atrial natriuretic peptide. So the patient does not become oedematous, and the urine sodium is high — excretion equals intake.',
        'That secondary sodium loss is not a footnote. Water retention and solute loss together account for essentially all of the fall in the plasma sodium in chronic SIADH, and with time the sodium loss is as prominent as the water retention. Potassium is lost too, from cells that are regulating their volume downwards.',
        'It is a syndrome with a long list of causes, grouped by mechanism: increased hypothalamic production (central nervous system disease, drugs, pulmonary disease, the postoperative state, severe nausea), ectopic production (small cell lung carcinoma above all), and potentiation of the hormone\'s effect at the tubule.',
        'The reset osmostat is its mild variant: thirst and hormone release regulated normally, but around a lower osmolality. The sodium sits stably between 125 and 135, the patient is asymptomatic, and a water load is excreted normally. It does not need correcting, and correcting it does not stick — raising the sodium above the new baseline simply switches the hormone back on and makes the patient thirsty.',
      ],
      chain: [
        'ADH released without an osmotic or volume stimulus',
        'Water retained; plasma diluted',
        'Volume receptors sense expansion → natriuresis and kaliuresis',
        'No oedema; urine sodium high',
        'Solute loss then contributes as much as water retention',
      ],
      points: ['Urine Na⁺ > 40 mmol/L, no oedema', 'Sodium loss is secondary, not primary', 'Reset osmostat: stable 125–135, normal water-load excretion, leave it alone'],
      cite: { rose: [23, 6], evidence: 'clinical' },
      route: '/hyponatremia',
    },
    {
      heading: 'Adaptation is what makes both the illness and the treatment dangerous',
      body: [
        'Falling osmolality drives water into brain cells. The brain answers in two stages: interstitial fluid is pushed into the cerebrospinal space, and then solutes leave the cells. Potassium and sodium go first, through channels that open within minutes; organic osmolytes — myoinositol, glutamine, glutamate, taurine — follow over hours to days. The cation loss is larger in absolute terms but under 10 per cent of the pool, while roughly 60 per cent of the osmolytes go. Losing osmolytes rather than cations is the point: it restores cell volume without the disruption to protein function that a large change in cell potassium would cause.',
        'So the rate matters as much as the level. Rabbits taken to a plasma sodium of 119 in two hours gain 17 per cent brain water, have severe symptoms and die; taken to the same 119 over two days they gain 7 per cent and have none. Taken slowly to 99 they have only mild symptoms.',
        'Then the trap. A brain that has adapted has inserted transporters to lose osmolytes and cannot quickly take them back up. Raising the plasma sodium rapidly now dehydrates it, and axons shrink away from their myelin sheaths — osmotic demyelination, with paraparesis or quadriparesis, dysarthria, dysphagia and coma, appearing days after the correction and often invisible on imaging for up to four weeks. The risk is greatest in exactly the patients whose adaptation has been most complete: severe, chronic, asymptomatic hyponatraemia.',
        'One group is at particular risk from the hyponatraemia itself. In a series of fifteen previously healthy young women given excessive intravenous water after surgery, the plasma sodium fell from 138 to 108 over 48 hours; four died and the rest had permanent neurological deficits. Premenopausal women are much more likely than men to suffer irreversible damage, and there is no gender difference before puberty — which points at sex hormones.',
      ],
      points: [
        'Osmolytes: ~60% lost, against < 10% of cell Na⁺ + K⁺',
        'Same sodium, different rate: 17% brain water in 2 h against 7% over 2 days',
        'Symptoms: nausea below 125, obtundation 115–120, seizures below 110–115',
        'Demyelination risk: > 12 mmol/L in the first day, or overshoot above 140 in two days',
      ],
      cite: { refs: ['sterns1986'], rose: [23], evidence: 'experimental' },
      route: '/hyponatremia',
    },
    {
      heading: 'Three measurements make the diagnosis',
      body: [
        'First the plasma osmolality, to confirm the hyponatraemia is real. A normal or raised effective osmolality means pseudohyponatraemia or an osmotically active solute, and the treatment is aimed at the tonicity, not the number.',
        'Then the urine osmolality. Below 100 mmol/kg the hormone is fully and appropriately off, which leaves primary polydipsia or a reset osmostat — separated by water restriction, which keeps the urine dilute until the sodium is normal in polydipsia but raises the urine osmolality progressively with a reset osmostat. Above 100, water excretion is impaired, which covers the great majority.',
        'Then the urine sodium. Under 25 mmol/L points to effective circulating volume depletion, including heart failure and cirrhosis; over 40 to SIADH, renal failure, a reset osmostat, a diuretic still acting, adrenal insufficiency, or vomiting with obligatory bicarbonate loss. Where it is equivocal, give saline and re-measure: if the hyponatraemia was hypovolaemic and the volume is now restored, the urine osmolality falls below 100 as the hormone switches off; if it stays high with a urine sodium above 40, SIADH was there as well.',
        'The acid–base and potassium picture adds a last discriminator. Metabolic alkalosis with hypokalaemia suggests vomiting or a diuretic; metabolic acidosis with hyperkalaemia and reasonable renal function is highly suggestive of adrenal insufficiency.',
      ],
      points: [
        'Uosm < 100: polydipsia or reset osmostat. Uosm > 100: impaired excretion',
        'Urine Na⁺ < 25: effective volume depletion. > 40: SIADH and the rest',
        'Hyperkalaemic acidosis plus hyponatraemia: think adrenal insufficiency',
      ],
      cite: { rose: [23, 13], evidence: 'clinical' },
      route: '/hyponatremia',
    },
    {
      heading: 'Why isotonic saline can make SIADH worse',
      body: [
        'This is the most useful piece of arithmetic in the chapter, and it is entirely counterintuitive. In SIADH the urine osmolality is fixed by the hormone. Give a litre of isotonic saline — 308 mosmol in a litre — to a patient whose urine osmolality is 680, and that solute is excreted in 453 mL. All of the salt leaves; more than half the water stays. The plasma sodium falls.',
        'What decides the effect of a fluid is its osmolality relative to the urine\'s, not relative to the plasma\'s. Three per cent saline is 1026 mosmol/kg, so against a urine osmolality of 680 it produces a net water loss and the sodium rises — but against a urine osmolality above 1000 even that is barely enough.',
        'The answer is to change the urine, not the infusion. A loop diuretic blocks sodium chloride reabsorption in the medullary thick ascending limb, which is the first step of countercurrent multiplication, so the medullary gradient collapses and the urine osmolality falls toward 300. The same litre of 3 per cent saline now leaves in 3400 mL and the sodium rises properly. Give the salt back, or the diuresis simply makes the patient hypovolaemic and the sodium falls further.',
        'The same logic runs the chronic treatment. With the urine osmolality fixed, urine volume is set by how much solute is excreted — 680 mosmol a day gives a litre, 1020 gives 1.5 litres. A high-salt, high-protein diet raises solute output and therefore water output. Below a urine osmolality of 400 that is usually enough on its own; above 600 to 700 a loop diuretic or a drug that blocks the hormone at the tubule is needed.',
      ],
      chain: [
        'Uosm is fixed by ADH',
        'A fluid is excreted in whatever volume its solute requires at that Uosm',
        'Fluid osmolality < Uosm → net water retained → sodium falls',
        'Fluid osmolality > Uosm → net water lost → sodium rises',
        'Lower the Uosm with a loop diuretic and everything gets easier',
      ],
      points: ['Isotonic saline in SIADH with Uosm 680: 453 mL out, 547 mL retained', '3% saline is 1026 mosmol/kg', 'Furosemide takes Uosm toward 300 and must be given with salt'],
      cite: { rose: [23, 15, 4], evidence: 'physiology' },
      route: '/hyponatremia',
    },
    {
      heading: 'How fast, and the formula that does not apply',
      body: [
        'The sodium needed is total body water times the desired rise. It is an estimate, it ignores any isosmotic deficit that also needs replacing, and — crucially — it applies only to sodium given without water, or in marked excess of it. Isotonic saline does not obey it. Neither does SIADH, where the administered sodium is simply excreted and it is the water leaving with it that raises the plasma sodium.',
        'Potassium counts in the same equation. It is as osmotically active as sodium, and 200 to 400 mmol given over the first day for severe hypokalaemia may by itself raise the plasma sodium at close to the maximum safe rate. Giving sodium as well then overcorrects.',
        'The rate: less than 10 to 12 mmol/L in the first 24 hours and less than 18 over the first two days, and preferably under 10 a day in an asymptomatic patient. The exception is a patient already fitting, where the risk of the hyponatraemia exceeds the risk of the correction: hypertonic saline at 1.5 to 2 mmol/L per hour for three to four hours, or until the seizures stop — and still no more than 10 to 12 in the first day.',
        'Two situations overcorrect without any hypertonic saline at all, because the stimulus to the hormone disappears at once: primary polydipsia, and hypovolaemia after the volume has been restored. Both then excrete the excess water in a maximally dilute urine. That is the moment to watch.',
      ],
      points: ['< 10–12 mmol/L in 24 h; < 18 in 48 h', 'Seizures: 1.5–2 mmol/L/h for 3–4 h, then stop', 'KCl raises the sodium too — count it', 'Restoring volume can start an unwanted water diuresis'],
      cite: { refs: ['sterns1986'], rose: [23], evidence: 'clinical' },
      route: '/hyponatremia',
      equation: 'nadeficit',
    },
  ],
  numbers: [
    { label: 'Hyponatraemia', value: '< 135 mmol/L' },
    { label: 'ADH off below', value: 'Posm 275 mmol/kg', note: 'plasma Na⁺ about 135' },
    { label: 'Minimum urine osmolality', value: '40–100 mmol/kg', note: 'specific gravity 1.001–1.003' },
    { label: 'Maximum free-water excretion', value: '> 10 L/day' },
    { label: 'Water load excreted', value: '> 80% within 4 h' },
    { label: 'Urine sodium', value: '< 25 mmol/L in volume depletion; > 40 in SIADH' },
    { label: 'Symptoms', value: 'nausea < 125; obtundation 115–120; seizures < 110–115', note: 'acute falls; chronic is far better tolerated' },
    { label: 'Safe correction', value: '< 10–12 mmol/L per day, < 18 over two days' },
    { label: 'Emergency rate', value: '1.5–2 mmol/L/h for 3–4 h', note: 'seizures only; the daily cap still applies' },
    { label: 'Sodium deficit', value: 'TBW × (target − current)', note: 'only for sodium given without water' },
    { label: 'Osmolyte loss in chronic hyponatraemia', value: '~60% of the pool', note: 'against < 10% of cell Na⁺ + K⁺' },
  ],
  equations: ['edelman', 'nadeficit', 'adrogue', 'efwc', 'ch2o', 'cosm', 'effosm'],
  clinical: [
    'Confirm the hypoosmolality first — a normal or high effective osmolality means the problem is not free water.',
    'Urine osmolality then urine sodium: those two numbers sort almost every case.',
    'A urine osmolality of 150 is hypotonic and still inappropriate. Do not read it as "the kidney is diluting".',
    'In SIADH, isotonic saline lowers the sodium whenever the urine osmolality exceeds about 300. Check the urine osmolality before choosing a fluid.',
    'Count any potassium you give towards the rise in sodium.',
    'The moments of greatest danger are after the volume is restored and in primary polydipsia, when the hormone switches off and a brisk water diuresis begins on its own.',
    'A reset osmostat needs no treatment; trying to correct it makes the patient thirsty and does not last.',
  ],
  pathology: [
    {
      name: 'SIADH',
      broken: 'ADH released without an osmotic or volume stimulus; sodium handling intact',
      consequence: 'Hyponatraemia with a concentrated urine, urine sodium above 40, no oedema. Treat the water, not the sodium.',
      route: '/hyponatremia',
    },
    {
      name: 'Hypovolaemic hyponatraemia',
      broken: 'Baroreceptor-driven ADH release plus reduced delivery to the diluting segments',
      consequence: 'Concentrated urine with a urine sodium below 25. Saline corrects it in two stages, and the second stage can be too fast.',
      route: '/hypovolemia',
    },
    {
      name: 'Thiazide-induced hyponatraemia',
      broken: 'Cortical site of action leaves the medullary gradient and ADH-driven water retention intact, plus Na⁺ and K⁺ loss and increased drinking',
      consequence: 'Can be acute and severe, usually within two weeks of starting. A low urea and urate point to water excess; a high one to volume depletion.',
      route: '/diuretics',
    },
    {
      name: 'Heart failure and cirrhosis',
      broken: 'Arterial underfilling despite an expanded total volume',
      consequence: 'Appropriate ADH release that cannot be switched off without improving perfusion. Hyponatraemia marks advanced disease and predicts worse survival.',
      route: '/edema',
    },
    {
      name: 'Primary polydipsia',
      broken: 'Intake exceeds even a normal excretory capacity',
      consequence: 'Dilute urine, normal ADH suppression. Restriction corrects it fast — sometimes too fast.',
      route: '/hyponatremia',
    },
    {
      name: 'Reset osmostat',
      broken: 'The osmotic threshold for ADH and thirst is set lower',
      consequence: 'Stable sodium of 125–135, asymptomatic, normal water-load excretion. Needs no treatment.',
      route: '/hyponatremia',
    },
    {
      name: 'Adrenal insufficiency',
      broken: 'Cortisol deficiency impairs water excretion; aldosterone deficiency wastes sodium',
      consequence: 'Hyponatraemia with hyperkalaemia and a metabolic acidosis. Cortisol alone restores water excretion quickly.',
      route: '/hyponatremia',
    },
    {
      name: 'Osmotic demyelination',
      broken: 'A brain that has lost its osmolytes cannot take them back quickly',
      consequence: 'Paraparesis, dysarthria, dysphagia and coma, days after an overly rapid correction, and often not visible on imaging for weeks.',
      route: '/hyponatremia',
    },
  ],
  questions: [
    {
      q: 'A patient with SIADH and a urine osmolality of 680 is given a litre of isotonic saline. What happens to the plasma sodium?',
      options: [
        'It rises — the saline is isotonic',
        'It falls: the 308 mosmol of solute is excreted in 453 mL at that urine osmolality, so more than half the litre is retained as water',
        'It does not change',
        'It depends on the urine sodium',
      ],
      answer: 1,
      explanation:
        'What matters is the osmolality of the fluid relative to the urine, not relative to the plasma. This is why the urine osmolality has to be measured before a fluid is chosen in SIADH.',
      route: '/hyponatremia',
    },
    {
      q: 'Why does the sodium-deficit formula over-predict what is needed in SIADH?',
      options: [
        'The formula is wrong',
        'It applies only to sodium given without water. In SIADH volume regulation is intact, so the administered sodium is excreted, and it is the water that leaves with it that raises the plasma sodium',
        'Total body water is underestimated',
        'Sodium is not osmotically active',
      ],
      answer: 1,
      explanation:
        'The same caveat explains why isotonic saline fails there, and why a loop diuretic — which lowers the urine osmolality — makes hypertonic saline work as intended.',
      route: '/hyponatremia',
    },
    {
      q: 'Why is thiazide-induced hyponatraemia common and loop-diuretic-induced hyponatraemia rare?',
      options: [
        'Thiazides are prescribed more often',
        'Thiazides act in the cortex and leave the medullary gradient intact, so ADH can still concentrate the urine. Loop diuretics wash the gradient out, which limits how much water can be retained',
        'Loop diuretics do not cause volume depletion',
        'Thiazides directly stimulate ADH',
      ],
      answer: 1,
      explanation:
        'It is the same property that makes a loop diuretic useful in treating SIADH: lowering the urine osmolality is exactly what the hyponatraemic patient needs.',
      route: '/diuretics',
    },
    {
      q: 'Two patients have a plasma sodium of 110. One developed it over 8 hours, the other over 3 weeks. Which is more likely to be symptomatic, and which is more at risk from treatment?',
      options: [
        'Both the same',
        'The acute one is more symptomatic; the chronic one is more at risk from rapid correction, because its brain has already given up the osmolytes it would need to take back',
        'The chronic one is more symptomatic',
        'Neither is at risk',
      ],
      answer: 1,
      explanation:
        'Adaptation is protective and then becomes the hazard. That is why the history — how long — changes the management more than the number does.',
      route: '/hyponatremia',
    },
    {
      q: 'A hyponatraemic patient with vomiting is given isotonic saline. Six hours later the urine osmolality falls to 60 and the urine output rises sharply. What is happening?',
      options: [
        'The saline caused a diuresis directly',
        'The volume has been restored, the baroreceptor stimulus to ADH has gone, and the retained water is now being excreted — this is when overcorrection happens',
        'Renal failure',
        'SIADH has developed',
      ],
      answer: 1,
      explanation:
        'Rose lists this and primary polydipsia as the two settings in which rapid correction happens with no hypertonic saline involved at all. Measure the sodium frequently through that window.',
      route: '/hypovolemia',
    },
    {
      q: 'A patient with severe hypokalaemia and hyponatraemia is given 300 mmol of potassium chloride over a day. What does that do to the plasma sodium?',
      options: [
        'Nothing — potassium is intracellular',
        'It raises it, because potassium is as osmotically active as sodium; the amount given may by itself approach the maximum safe daily rise',
        'It lowers it',
        'Only if given with sodium',
      ],
      answer: 1,
      explanation:
        'Potassium enters cells and sodium comes out, or chloride follows and water moves in — three routes, the same result. Any potassium given has to be counted in the correction.',
      route: '/hypokalemia',
    },
  ],
  updates: [
    {
      topic: 'Vasopressin receptor antagonists',
      text: 'The chapter describes oral V2-receptor antagonists as "undergoing clinical trials". They arrived. In SALT-1 and SALT-2, 448 patients with euvolaemic or hypervolaemic hyponatraemia were randomised to tolvaptan or placebo; the serum sodium rose more with tolvaptan at day 4 and at day 30, side effects were thirst, dry mouth and increased urination, and the hyponatraemia recurred within a week of stopping. The chapter\'s own caution has proved the operative one: eliminating the hormone\'s effect can produce a marked water diuresis and overly rapid correction, so these drugs are started in hospital with the sodium measured frequently and fluid restriction lifted. They correct a number; whether they change outcomes is still unsettled.',
      cite: { refs: ['schrier2006salt'], rose: [23], evidence: 'clinical', update: 'The drug class the chapter anticipated, with the risk it anticipated.' },
    },
    {
      topic: 'Chronic hyponatraemia is not asymptomatic',
      text: 'The chapter treats mild chronic hyponatraemia as tolerable and mostly not worth correcting. That has shifted. In a case–control study of 122 patients with a mean sodium of 126 admitted to an emergency department, 21 per cent presented with a fall against 5 per cent of matched controls; the same patients, tested before and after correction, had measurably worse gait and slower, less accurate attention, comparable to the effect of alcohol. Associations with fractures and osteoporosis have followed. The chapter\'s physiology is unchanged — the brain has adapted — but "asymptomatic" turns out to mean "symptoms nobody was measuring".',
      cite: { refs: ['renneboog2006'], rose: [23], evidence: 'clinical', update: 'A reason to treat something the chapter was content to leave.' },
    },
    {
      topic: 'Guidelines, and relowering after overcorrection',
      text: 'The chapter\'s rate limits — under 10 to 12 mmol/L in the first day — have held up and are now formal guidance, with European guidance recommending a 150 mL bolus of 3% saline repeated for severe symptoms rather than an hourly infusion rate. The chapter also raises, as an unresolved question, whether deliberately relowering the sodium helps when correction has gone too fast, citing one rat study and one patient. That has become accepted practice: desmopressin with hypotonic fluid to bring the sodium back down is now a recognised rescue, and giving desmopressin proactively alongside hypertonic saline is used to make the rise predictable.',
      cite: { refs: ['spasovski2014'], rose: [23], evidence: 'guideline', update: 'The chapter\'s open question became standard practice.' },
    },
  ],
  modules: ['/hyponatremia', '/water-disorders', '/adh', '/free-water', '/body-water'],
};
