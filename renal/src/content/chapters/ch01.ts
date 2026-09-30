import type { ChapterContent } from './types';

export const chapter: ChapterContent = {
  n: 1,
  title: 'Introduction to renal function',
  thesis:
    'The kidney keeps the extracellular fluid constant by filtering an enormous volume and then reclaiming almost all of it, adjusting the last few percent of each substance independently to match intake. Filtration is deliberately wasteful: waste products that are cleared mainly by filtration need a high filtration rate, and the tubule pays for it by reabsorbing more than 99% of the filtered salt and water.',
  concepts: [
    {
      heading: 'Three jobs, one organ',
      body: [
        'The kidney has three sets of functions. It excretes metabolic waste (urea, creatinine, uric acid) and adjusts the excretion of water and each electrolyte to match what comes in. It is an endocrine organ, making renin, prostaglandins, erythropoietin and calcitriol among others. And it has metabolic roles: it breaks down peptide hormones and makes glucose during fasting.',
        'The key word is “individually”. The kidney can raise sodium excretion without raising water excretion, or excrete potassium while conserving sodium. It does this almost entirely by changing tubular reabsorption and secretion, not by changing filtration.',
      ],
      cite: { rose: [1], evidence: 'physiology' },
    },
    {
      heading: 'The nephron and its segments',
      body: [
        'Each kidney contains roughly a million nephrons. Each begins as a glomerulus — a capillary tuft sitting between two arterioles — and continues as a tubule lined by a single, continuous epithelium. Glomeruli are all in the cortex; tubules run through both cortex and medulla.',
        'The segments are defined by function, not just appearance: proximal convoluted tubule and pars recta; the loop of Henle (thin descending limb, thin ascending limb, thick ascending limb); then, after the macula densa, the distal convoluted tubule, connecting segment and cortical collecting tubule, and finally the medullary collecting duct that drains into the calyces.',
        'Loops are not all the same length. About 40% of nephrons (those whose glomeruli lie in the outer cortex) have short loops that turn in the outer medulla and lack a thin ascending limb; the rest, especially juxtamedullary nephrons, have long loops that reach toward the papilla. The long loops are the ones that build the inner-medullary gradient.',
        'The cortical thick ascending limb returns to touch its own glomerulus. The specialised cells there (the macula densa) and the renin-secreting cells of the afferent arteriole together form the juxtaglomerular apparatus — a sensor that links what the tubule delivers to how the glomerulus filters.',
      ],
      points: [
        'Proximal tubule and loop: bulk reabsorption of what was filtered',
        'Distal tubule and collecting duct: small, regulated adjustments that set final excretion',
        'Cortical collecting tubule has two cell types: principal cells (Na⁺ in, K⁺ out, aldosterone-sensitive) and intercalated cells (H⁺ or HCO₃⁻ secretion, K⁺ reabsorption)',
      ],
      route: '/nephron',
      cite: { rose: [1], evidence: 'physiology' },
    },
    {
      heading: 'Filter almost everything, reclaim almost everything',
      body: [
        'A normal adult filters around 135–180 L a day — more than ten times the extracellular volume and about sixty times the plasma volume. All but a litre or two must be returned. For sodium, chloride and bicarbonate, net reabsorption exceeds 99%.',
        'Why filter so much? Waste products such as urea and creatinine enter the urine mainly by filtration. Clearing them at useful rates requires a high GFR; the tubule then recovers the valuable solutes. The high filtration rate is the price of efficient waste excretion.',
        'Reabsorption means moving a substance out of the tubular fluid back to blood; secretion means adding it to the tubular fluid. Sodium, chloride and water are reabsorbed; hydrogen ions are secreted; potassium and urate are both reabsorbed and secreted; creatinine is filtered and only slightly secreted, which is why its excretion tracks filtration.',
      ],
      chain: ['High GFR', 'Large filtered load of waste (urea, creatinine)', 'Efficient waste excretion', 'Requires >99% tubular recovery of Na⁺, Cl⁻, HCO₃⁻, water'],
      route: '/flow',
      cite: { rose: [1], evidence: 'physiology' },
    },
    {
      heading: 'How epithelial cells move solute',
      body: [
        'Reabsorption can go through the cell (transcellular) or between cells across the tight junction (paracellular). Transcellular transport requires crossing two different membranes in series — the luminal (apical) membrane and the basolateral membrane — each with its own carriers and channels.',
        'The general pattern for sodium is the template for everything else. The basolateral Na⁺-K⁺-ATPase pumps sodium out of the cell, keeping cell sodium low and the cell interior negative. Sodium therefore flows passively into the cell across the apical membrane through whatever entry pathway that segment has: Na⁺/H⁺ exchange and Na⁺-glucose cotransport proximally, Na⁺-K⁺-2Cl⁻ in the thick ascending limb, Na⁺-Cl⁻ in the distal tubule, and a selective sodium channel in the collecting tubule. Only the collecting-tubule channel carries sodium alone; everywhere else sodium entry is coupled to another solute.',
        'Secretion uses the same machinery in reverse. Potassium is pumped into the principal cell by the basolateral Na⁺-K⁺-ATPase, and the resulting high cell potassium drives its exit into the lumen through apical potassium channels.',
      ],
      chain: ['Basolateral Na⁺-K⁺-ATPase', 'Low cell [Na⁺], negative cell interior', 'Passive apical Na⁺ entry via segment-specific carrier', 'Coupled solute moves with (or against) Na⁺', 'Na⁺ returned to blood by the pump'],
      route: '/transport',
      cite: { rose: [1], evidence: 'physiology' },
    },
    {
      heading: 'The tight junction: gate and fence',
      body: [
        'The tight junction does two separate jobs. As a gate, it limits passive diffusion between cells. As a fence, it keeps apical and basolateral membrane proteins apart so that the cell stays polarised.',
        'How leaky the gate is defines what a segment can do. The proximal tubule is leaky: up to a third of its sodium reabsorption is paracellular, which is why it can move such a large volume. But a leaky epithelium cannot hold a steep gradient — the proximal tubule can only lower the luminal pH to about 6.8 (four-fold the plasma [H⁺]). The collecting duct is tight: it can drive urine pH to 4.5, a thousand-fold gradient, and lower urine sodium below 1 mmol/L.',
        'Loss of polarity is pathological. In ischaemia, tight junctions open and actin anchoring fails, so Na⁺-K⁺-ATPase pumps drift onto the apical membrane; sodium reabsorption falls. The book also notes abnormal apical pump localisation in polycystic kidney disease as a proposed contributor to cyst fluid secretion.',
      ],
      points: ['Leaky epithelium → high capacity, low gradient (proximal tubule)', 'Tight epithelium → low capacity, steep gradient (collecting duct)'],
      cite: { rose: [1], evidence: 'physiology' },
    },
    {
      heading: 'Membrane recycling: how ADH switches water permeability',
      body: [
        'ADH binds its V2 receptor on the basolateral membrane of collecting-duct cells. That triggers insertion of pre-formed aquaporin-2 water channels, stored in cytoplasmic vesicles, into the apical membrane. When ADH falls, the membrane patches containing those channels are taken back in by endocytosis, restoring water impermeability. The receptor itself is internalised and recycled.',
        'Because the channels are pre-formed and shuttled rather than synthesised, water permeability can change within minutes. Mutations that misroute aquaporin-2 cause nephrogenic diabetes insipidus.',
      ],
      chain: ['ADH binds basolateral V2 receptor', 'Adenylyl cyclase / cAMP', 'Aquaporin-2 vesicles fuse with apical membrane', 'Water permeability ↑', 'ADH falls → endocytosis of channel-bearing membrane'],
      route: '/adh',
      cite: { rose: [1, 6], evidence: 'physiology' },
    },
    {
      heading: 'Urine has no normal composition',
      body: [
        'Because urinary excretion follows intake in the steady state, there is no single normal value for urine sodium or volume — only a range reflecting diet (for example, 100–250 mmol/day of sodium on a Western diet). A urine sodium can only be judged against the patient’s intake and volume status.',
        'Urine also differs from plasma qualitatively: ions make up about 95% of extracellular solute, but urine carries large amounts of uncharged solute, especially urea. That is what allows nitrogenous waste to be excreted rather than accumulated.',
      ],
      route: '/urine-chemistry',
      cite: { rose: [1, 13], evidence: 'physiology' },
    },
    {
      heading: 'Units: moles, equivalents and osmoles',
      body: [
        'The same amount of a substance can be written as mg/dL, mmol/L, mEq/L or mOsm/kg. For a monovalent ion such as sodium these are numerically the same apart from mg/dL. For divalent ions, 1 mmol = 2 mEq. Converting mg/dL to mmol/L means multiplying by 10 and dividing by the molecular weight — so glucose in mg/dL divided by 18, and blood urea nitrogen divided by 2.8, give mmol/L. This site uses SI units throughout, as Canadian laboratories do (mmol/L for electrolytes, glucose and urea; µmol/L for creatinine; g/L for albumin); the book’s mg/dL values are converted.',
        'Equivalents matter because ions combine by charge, and every body fluid must be electroneutral: total cationic milliequivalents equal total anionic milliequivalents. That constraint shapes renal transport — sodium cannot be reabsorbed without either an anion following it or another cation moving the other way.',
        'Osmolality depends on the number of particles, not their size or charge. In body fluids NaCl behaves as if about 75% dissociated, so 1 mmol/L contributes ~1.75 mOsm/kg. Osmolality is measured by freezing-point depression: 1 Osm/kg lowers the freezing point by 1.86 °C, so plasma freezing at −0.521 °C is ~280 mOsm/kg.',
        'Only solutes that cannot cross a membrane exert an effective osmotic pressure across it. Urea crosses cell membranes freely: it contributes to measured osmolality but not to tonicity. This distinction — total versus effective osmolality — underlies the whole approach to hyponatraemia.',
      ],
      points: ['Glucose: mg/dL ÷ 18 = mmol/L', 'BUN: mg/dL ÷ 2.8 = mmol/L urea', 'Creatinine: mg/dL × 88.4 = µmol/L', 'Albumin: g/dL × 10 = g/L; calcium: mg/dL × 0.25 = mmol/L', 'Phosphate average valence ≈ −1.8 (80% HPO₄²⁻)', 'Only ~45–50% of plasma calcium is ionised'],
      equation: 'posm',
      route: '/body-water',
      cite: { rose: [1], evidence: 'physiology' },
    },
  ],
  numbers: [
    { label: 'Nephrons per kidney', value: '≈1.0–1.3 million' },
    { label: 'GFR', value: '135–180 L/day', note: 'about 25% lower in women' },
    { label: 'Filtered Na⁺', value: '≈26,000 mmol/day', note: 'excreted 100–250 (>99% reabsorbed)' },
    { label: 'Filtered Cl⁻', value: '≈21,000 mmol/day', note: '>99% reabsorbed' },
    { label: 'Filtered HCO₃⁻', value: '≈4,800 mmol/day', note: '≈100% reabsorbed' },
    { label: 'Filtered K⁺', value: '≈800 mmol/day', note: 'excreted 40–120; urine K⁺ is set by distal secretion' },
    { label: 'Filtered urea', value: '≈54 g/day', note: '40–50% reabsorbed' },
    { label: 'Water', value: '180 L filtered', note: '0.5–3 L excreted (98–99% reabsorbed)' },
    { label: 'Proximal paracellular Na⁺', value: 'up to ⅓ of proximal reabsorption' },
    { label: 'Minimum urine pH', value: '4.5', note: 'proximal lumen only reaches ~6.8' },
    { label: 'Plasma freezing point', value: '−0.521 °C', note: '≈280 mOsm/kg' },
  ],
  equations: ['posm', 'units'],
  clinical: [
    'A urine sodium or volume means nothing without the intake it is matched to — the basis of interpreting urine chemistries (ch. 13).',
    'Tubular injury after ischaemia impairs sodium reabsorption partly through loss of epithelial polarity, which is why urine sodium tends to be higher in acute tubular necrosis than in pre-renal states.',
    'Nephrogenic diabetes insipidus can arise from aquaporin-2 mutations that misroute the channel.',
    'Measured osmolality includes urea and alcohols; tonicity does not. A high measured osmolality with a normal sodium points to an ineffective osmole or an osmolal gap.',
  ],
  pathology: [
    { name: 'Ischaemic tubular injury', broken: 'Tight-junction gate and fence; basolateral anchoring of Na⁺-K⁺-ATPase', consequence: 'Pumps mislocalise to the apical membrane; transcellular Na⁺ reabsorption falls and urine Na⁺ rises', route: '/prerenal-atn' },
    { name: 'Nephrogenic DI (aquaporin-2 mutations)', broken: 'Trafficking of water channels to the apical membrane', consequence: 'Collecting duct stays water-impermeable despite ADH: large volumes of dilute urine', route: '/water-disorders' },
    { name: 'Polycystic kidney disease (proposed)', broken: 'Membrane polarity: apical Na⁺-K⁺-ATPase and growth-factor receptors', consequence: 'Solute and fluid secretion into cysts; abnormal epithelial proliferation' },
  ],
  questions: [
    {
      q: 'Why can the collecting duct lower urine pH to 4.5 when the proximal tubule cannot go below about 6.8?',
      options: ['The collecting duct secretes more H⁺ in total', 'The collecting duct is a tight epithelium, so secreted H⁺ does not leak back', 'The proximal tubule has no proton pumps', 'Urine phosphate is higher distally'],
      answer: 1,
      explanation: 'Total H⁺ secretion is far greater proximally. What the collecting duct has is a tight junction that prevents back-diffusion, so it can sustain a thousand-fold gradient. Leaky epithelia trade gradient for capacity.',
    },
    {
      q: 'A person doubles their salt intake and reaches a new steady state. What is the “normal” urine sodium?',
      options: ['Still 100–150 mmol/day', 'About double the previous excretion — whatever matches intake', 'Near zero, because the kidney conserves sodium', 'It depends only on GFR'],
      answer: 1,
      explanation: 'In the steady state output equals intake. There is no fixed normal urine sodium, only one appropriate to intake and volume status.',
      route: '/sodium',
    },
    {
      q: 'Why does the kidney filter ~180 L/day only to reabsorb 99% of it?',
      options: ['Filtration is the only way to excrete sodium', 'A high GFR is needed to clear waste products such as urea and creatinine, which enter the urine mainly by filtration', 'Reabsorption is energetically free', 'To keep the medulla oxygenated'],
      answer: 1,
      explanation: 'Waste products are handled mostly by filtration; clearing them at a useful rate requires a large GFR. The tubule then recovers the useful solutes.',
      route: '/clearance',
    },
    {
      q: 'Which statement about urea is correct?',
      options: ['It raises both measured osmolality and tonicity', 'It raises measured osmolality but not tonicity, because it crosses cell membranes', 'It lowers the freezing point less than sodium', 'It is not measured by an osmometer'],
      answer: 1,
      explanation: 'An osmometer counts every particle. Only particles that cannot cross the cell membrane generate an effective osmotic pressure; urea equilibrates across cells.',
      route: '/body-water',
    },
    {
      q: 'Where does sodium enter the cell without a coupled solute?',
      options: ['Proximal tubule', 'Thick ascending limb', 'Distal convoluted tubule', 'Collecting tubule (principal cells)'],
      answer: 3,
      explanation: 'Only the principal-cell sodium channel (ENaC) carries sodium alone. That is why sodium reabsorption there makes the lumen negative and drives potassium and hydrogen secretion.',
      route: '/distal',
    },
  ],
  updates: [
    {
      topic: 'Nephron number',
      text: 'Autopsy studies show nephron number varies more than ten-fold between individuals (about 200,000 to more than 2.5 million per kidney, averaging about 900,000–1 million), is largely fixed at birth, correlates with birth weight, and falls with age-related glomerulosclerosis. Lower nephron endowment is associated with higher blood pressure.',
      cite: { evidence: 'clinical', refs: ['bertram2011'] },
    },
  ],
};
