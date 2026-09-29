import type { ChapterContent } from './types';

export const chapter: ChapterContent = {
  n: 3,
  title: 'Proximal tubule',
  thesis:
    'The proximal tubule reabsorbs 55–60% of the filtrate isosmotically, powered almost entirely by one pump — the basolateral Na⁺-K⁺-ATPase. Sodium drags glucose, amino acids, phosphate and bicarbonate in with it, and by removing them early it creates the chloride gradient that lets a third of NaCl and water follow passively. Because so much rides on sodium, anything that changes proximal sodium reabsorption — volume depletion, angiotensin II, diuretics — also changes the handling of bicarbonate, urea, calcium, urate and citrate, often at the expense of their own balance.',
  concepts: [
    {
      heading: 'What the proximal tubule reabsorbs — and what it doesn’t',
      body: [
        'Nearly all filtered glucose and amino acids, about 90% of the bicarbonate (80% in the book’s later accounting), 65% of the sodium and only 55% of the chloride are reabsorbed here. Water follows sodium so closely that the luminal sodium concentration never changes along the segment, even though two-thirds of the volume is gone.',
        'Three cell types line it: S1 (early convoluted; highest capacity for Na⁺ and HCO₃⁻, with more carriers and surface area), S2 (late convoluted/early straight; the main site of organic anion and cation secretion), and S3 (pars recta).',
      ],
      points: ['Luminal [Na⁺]: flat along the tubule', 'Luminal [HCO₃⁻], glucose, amino acids: fall steeply in the first quarter', 'Luminal [Cl⁻]: rises above plasma (TF/P ≈ 1.2–1.3)', 'Osmolality: stays ≈ plasma (isosmotic)'],
      route: '/proximal',
      cite: { rose: [3], evidence: 'physiology' },
    },
    {
      heading: 'One pump powers everything',
      body: [
        'The basolateral Na⁺-K⁺-ATPase moves 3 Na⁺ out for 2 K⁺ in. Cell sodium stays at 20–30 mmol/L against 145 in the filtrate, and K⁺ leaking back out through ATP-sensitive channels makes the cell interior negative. Sodium therefore has a large electrochemical gradient into the cell.',
        'Sodium can only cross the apical membrane on a carrier, and each carrier couples it to something else: Na⁺-glucose (SGLT), Na⁺-amino acid, Na⁺-phosphate, and Na⁺/H⁺ exchange (NHE3). Glucose moves uphill into the cell because sodium moves downhill with it — secondary active transport. The coupling runs both ways: removing glucose, amino acids or bicarbonate from the lumen markedly reduces sodium reabsorption.',
        'Basolateral exit is also indirectly pump-driven: bicarbonate leaves with sodium on a 3HCO₃⁻:1Na⁺ carrier pushed by the negative cell voltage. Pump activity and K⁺ back-leak are coupled through ATP: more transport, less ATP, more open K⁺ channels.',
        'Despite its huge transport, the proximal tubule has much less Na⁺-K⁺-ATPase activity than the thick ascending limb or distal tubule, because a third of its reabsorption is passive.',
      ],
      chain: ['Basolateral Na⁺-K⁺-ATPase', 'Cell [Na⁺] 20–30 mmol/L, cell interior negative', 'Na⁺ enters on SGLT2, NaPi-II, Na⁺-amino acid carriers and NHE3', 'Glucose, phosphate, amino acids reabsorbed uphill; H⁺ secreted', 'HCO₃⁻ exits basolaterally on NBCe1'],
      route: '/transport',
      cite: { rose: [3], evidence: 'physiology' },
    },
    {
      heading: 'Water and the isosmotic reabsorbate',
      body: [
        'Aquaporin-1 in both membranes makes the proximal tubule highly water-permeable; mice lacking it cannot reabsorb proximal fluid normally. Removing solute lowers luminal osmolality only slightly (an osmotic gradient of a few mOsm is enough given the permeability), and water follows through cells and across the leaky single-strand tight junction.',
        'Because chloride crosses the tight junction readily, it acts as an ineffective osmole there, so the effective osmolality of the intercellular space exceeds that of the lumen even when total osmolalities are equal — a further drive for water.',
      ],
      cite: { rose: [3], evidence: 'physiology' },
    },
    {
      heading: 'Chloride: active and passive',
      body: [
        'Active chloride entry uses apical anion exchangers — chloride for formate (recycled as formic acid with H⁺ from NHE3), and probably for hydroxyl or oxalate — so it too depends on Na⁺/H⁺ exchange. Blocking NHE3 blocks almost all active transcellular chloride transport.',
        'Passive reabsorption, about a third of proximal NaCl and water, arises because early preferential reabsorption of NaHCO₃, glucose and amino acids concentrates chloride in the lumen. Chloride diffuses down that gradient through the tight junction (making the late proximal lumen positive), and sodium and water follow; water also moves osmotically and carries NaCl by solvent drag.',
        'Bicarbonate is the key driver because it is present in the highest concentration (24 versus ~5 mmol/L for glucose). That explains two clinical observations: acetazolamide causes a chloruresis despite having no direct action on chloride, and metabolic acidosis (less filtered bicarbonate) reduces proximal NaCl reabsorption.',
      ],
      chain: ['NHE3 + carbonic anhydrase reclaim HCO₃⁻ early', 'Water follows', 'Luminal [Cl⁻] rises above plasma', 'Cl⁻ diffuses through the leaky tight junction', 'Na⁺ and water follow passively (≈⅓ of proximal reabsorption)'],
      route: '/proximal',
      cite: { rose: [3], evidence: 'physiology' },
    },
    {
      heading: 'The Na⁺/H⁺ exchanger as the master switch',
      body: [
        'Apart from the pump, NHE3 is the main determinant of proximal sodium and water reabsorption. It reclaims bicarbonate directly, creates the chloride gradient for passive reabsorption, and drives active chloride entry through the anion exchangers. Its activity rises on a low-salt diet and falls on a high-salt diet.',
        'Angiotensin II and noradrenaline stimulate it (angiotensin II may account for 40–50% of S1 reabsorption); dopamine, produced more in volume expansion, inhibits both NHE3 and the pump, and blocking dopamine blunts the natriuresis of volume expansion.',
        'Angiotensin II raises early bicarbonate reabsorption, but later reabsorption is flow-dependent and falls to compensate, so net proximal acidification does not change much — while chloride delivery out of the proximal tubule does fall. Net effect: more NaCl and water reabsorbed, not more acid excreted.',
      ],
      route: '/raas',
      cite: { rose: [3], evidence: 'experimental' },
    },
    {
      heading: 'Peritubular capillary uptake',
      body: [
        'Reabsorbate in the intercellular space is taken up by the peritubular capillary according to Starling forces. That capillary has low hydraulic pressure (the arterioles have dissipated most of the arterial pressure) and high oncotic pressure (plasma has just lost protein-free filtrate): a net gradient of ~13 mmHg favours uptake. Interstitial forces are small and roughly cancel.',
        'Efferent constriction — by angiotensin II and noradrenaline in effective volume depletion — lowers capillary hydraulic pressure and raises the filtration fraction and so the oncotic pressure: uptake and proximal reabsorption rise. In heart failure, angiotensin II, noradrenaline, filtration fraction and proximal reabsorption are all high. In volume expansion the opposite, possibly with more back-leak of reabsorbate through the tight junction into the lumen — though experimentally it is active NaCl reabsorption that falls, so the mechanism is not settled.',
      ],
      chain: ['↓ Effective volume', '↑ Angiotensin II, noradrenaline', 'Efferent constriction', '↑ Filtration fraction → ↑ peritubular oncotic pressure, ↓ hydraulic pressure', '↑ Capillary uptake → ↑ proximal NaCl and water reabsorption'],
      route: '/arterioles',
      cite: { rose: [3], evidence: 'physiology' },
    },
    {
      heading: 'Glomerulotubular balance',
      body: [
        'If GFR rose from 180 to 183 L/day with no change in reabsorption, 3 extra litres would be lost in the urine. Instead, the proximal tubule reabsorbs a constant fraction (~60%) of whatever is filtered: absolute reabsorption rises and falls with GFR. The loop and distal tubule show the same balance for what is delivered to them.',
        'Two mechanisms contribute: a higher GFR at constant plasma flow raises peritubular oncotic pressure, and a higher GFR delivers more glucose, amino acids and bicarbonate, whose coupled and gradient-creating reabsorption carries sodium with it.',
        'Glomerulotubular balance, autoregulation and tubuloglomerular feedback together keep delivery to the collecting ducts nearly constant, because the collecting ducts have little total capacity. The balance is reset in volume disorders: fractional proximal reabsorption rises with depletion and falls with expansion — appropriately.',
      ],
      chain: ['↑ GFR', '↑ Filtered Na⁺, HCO₃⁻, glucose, amino acids + ↑ peritubular π', '↑ Absolute proximal reabsorption', 'Fraction reabsorbed roughly constant', 'Distal delivery barely changes'],
      route: '/proximal',
      cite: { rose: [3], evidence: 'physiology' },
    },
    {
      heading: 'Bicarbonate: no fixed Tm',
      body: [
        'In bicarbonate titration studies, reabsorption appears to plateau at 26–28 mmol per litre of filtrate, as if there were a transport maximum. But infusing NaHCO₃ expands volume, which suppresses proximal sodium (and linked bicarbonate) reabsorption. When expansion is prevented, reabsorption keeps rising even at a plasma bicarbonate of 36 mmol/L — and in rats a Tm cannot be shown at all.',
        'The clinical meaning is central to metabolic alkalosis: volume and chloride depletion raise bicarbonate reabsorption, so excess bicarbonate is retained rather than excreted. Only restoring volume (with chloride) removes the stimulus.',
      ],
      chain: ['Volume + Cl⁻ depletion', '↑ Proximal Na⁺ (and NHE3-coupled HCO₃⁻) reabsorption', 'Excess HCO₃⁻ retained', 'Metabolic alkalosis maintained', 'Saline repletion → HCO₃⁻ excreted'],
      route: '/bicarbonate',
      cite: { rose: [3, 18], evidence: 'physiology' },
    },
    {
      heading: 'Glucose: Tm and splay',
      body: [
        'Glucose enters with sodium and leaves across the basolateral membrane by facilitated diffusion (GLUT carriers). SGLT2, a high-capacity, low-affinity 1:1 carrier in S1/S2, takes most of it; SGLT1, a low-capacity, high-affinity 2 Na⁺:1 glucose carrier in S3, uses the double sodium gradient to scavenge the rest against a steep gradient.',
        'The whole-kidney Tm is ~375 mg/min. At a GFR of 125 mL/min that predicts no glucosuria until plasma glucose exceeds 300 mg/dL — yet glucose appears in the urine above 180–200 mg/dL. This splay reflects nephron heterogeneity: nephrons with large glomeruli or short proximal tubules saturate first.',
        'Glucosuria usually reflects an increased filtered load (diabetes). Less often, reabsorption is defective: selectively (renal glucosuria: fewer or lower-affinity carriers) or as part of generalised proximal dysfunction (Fanconi syndrome).',
      ],
      chain: ['↑ Plasma glucose', '↑ Filtered load (GFR × Pglucose)', 'Weakest nephrons saturate first (splay, ~180–200 mg/dL)', 'Whole-kidney Tm reached (~375 mg/min)', 'Excretion = filtered load − Tm'],
      route: '/glucose',
      cite: { rose: [3], evidence: 'physiology' },
    },
    {
      heading: 'Urea and prerenal azotaemia',
      body: [
        'Urea is lipid-soluble and follows water: as sodium and water are reabsorbed, the luminal urea concentration rises and urea diffuses out. Only 50–60% of filtered urea is excreted normally. In volume depletion, more sodium and water reabsorption means more urea reabsorption — the BUN rises with little or no rise in creatinine: prerenal azotaemia.',
      ],
      route: '/prerenal-atn',
      cite: { rose: [3], evidence: 'physiology' },
    },
    {
      heading: 'Calcium',
      body: [
        'About 40% of plasma calcium is albumin-bound and not filtered; of the filtered 60%, most is ionised. About 80–85% of filtered calcium is reabsorbed in the proximal tubule and loop, largely passively following sodium and water (paracellularly in the thick ascending limb, via paracellin-1/claudin-16). Only ~5% is excreted.',
        'Regulation happens in the distal tubule, connecting segment and cortical thick ascending limb: PTH (and to a lesser degree calcitriol) increases calcium entry through apical calcium channels, and extrusion by a basolateral Na⁺/Ca²⁺ exchanger and Ca²⁺-ATPase.',
        'Because most calcium reabsorption follows sodium, anything that changes proximal and loop sodium reabsorption changes calcium excretion in parallel. Saline and a loop diuretic increase calcium excretion (treatment of hypercalcaemia); a low-sodium diet with a thiazide or amiloride reduces it (hypercalciuric stone formers) — thiazides and amiloride also increase distal calcium reabsorption directly.',
        'In hypoparathyroidism, loss of PTH-dependent distal reabsorption means calciuria persists at low plasma calcium, and raising calcium toward normal causes hypercalciuria — which limits correction.',
      ],
      route: '/minerals',
      cite: { rose: [3], evidence: 'physiology' },
    },
    {
      heading: 'Phosphate',
      body: [
        '80–95% of filtered phosphate is reabsorbed, almost all proximally, on 3Na⁺:1HPO₄²⁻ cotransporters (type II being the important one). Transport is regulated by plasma phosphate itself and by PTH: a low-phosphate diet virtually abolishes phosphate excretion; a phosphate load and PTH reduce carrier activity.',
        'Metabolic acidosis also reduces phosphate reabsorption — usefully, since the extra phosphate delivered distally is buffer for titratable acid.',
      ],
      route: '/minerals',
      cite: { rose: [3], evidence: 'physiology' },
      },
    {
      heading: 'Magnesium: a loop ion',
      body: [
        'Only 70–80% of plasma magnesium is filtered, and unlike most solutes most of it (50–60%) is reabsorbed in the cortical thick ascending limb, paracellularly, driven by the lumen-positive voltage; the proximal tubule takes only 20–30%, the distal convoluted tubule a small regulated fraction transcellularly. About 3% is excreted.',
        'Loop diuretics and paracellin-1 mutations cause magnesium (and calcium) wasting. The basolateral calcium-sensing receptor inhibits apical K⁺ channels when calcium or magnesium is high, reducing NaCl reabsorption and the voltage — and so magnesium reabsorption.',
      ],
      route: '/minerals',
      cite: { rose: [3, 4], evidence: 'physiology', refs: ['simon1999'] },
    },
    {
      heading: 'Uric acid',
      body: [
        'Urate is handled entirely in the proximal tubule by reabsorption, secretion (about half the filtered load) and post-secretory reabsorption, with 6–12% of the filtered load excreted. Reabsorption uses urate/anion exchangers running alongside NHE3, so it tracks proximal sodium reabsorption.',
        'Diuretic-induced volume depletion therefore causes hyperuricaemia (not seen if the losses are replaced). Ketoacid anions compete for organic anion secretion, which is why fasting raises urate.',
      ],
      route: '/proximal',
      cite: { rose: [3], evidence: 'physiology' },
    },
    {
      heading: 'Proteins, amino acids and citrate',
      body: [
        'Amino acids are reabsorbed by multiple Na⁺-coupled carriers plus Na⁺-independent ones; loss of the cystine/dibasic carrier (SLC3A1) causes cystinuria and cystine stones. Small peptides are hydrolysed at the brush border; larger proteins (insulin, lysozyme, albumin) are taken up by endocytosis and degraded — the kidney is a major site of peptide hormone metabolism.',
        'Citrate (65–90% reabsorbed on a 3Na⁺:1 citrate²⁻ carrier) is reabsorbed more in acidosis and hypokalaemia and less in alkalosis. Low urinary citrate promotes calcium stones; potassium citrate is preferred for treatment because the sodium salt would increase calcium excretion.',
      ],
      route: '/proximal',
      cite: { rose: [3], evidence: 'physiology' },
    },
    {
      heading: 'Secretion of organic cations and anions',
      body: [
        'In S2, organic cations (creatinine, cimetidine, trimethoprim) enter across the basolateral membrane down their electrochemical gradient and are exchanged for luminal H⁺ supplied by NHE3. They compete: cimetidine or trimethoprim raise plasma creatinine without changing GFR.',
        'Organic anions (urate, hippurate, ketoacid anions, penicillins, diuretics, contrast, salicylate) enter in exchange for α-ketoglutarate. Albumin binding, which prevents filtration, promotes their secretion. Probenecid blocks the pathway. Weak acids such as salicylic acid are excreted better in alkaline urine, which traps the ionised form in the lumen — the basis for alkalinising the urine in salicylate poisoning.',
      ],
      route: '/clearance',
      cite: { rose: [3], evidence: 'physiology' },
    },
  ],
  numbers: [
    { label: 'Fraction of filtrate reabsorbed', value: '55–60% (>100 L/day)' },
    { label: 'Filtered HCO₃⁻ reabsorbed proximally', value: '≈80–90%' },
    { label: 'Passive (paracellular) share of reabsorption', value: '≈⅓' },
    { label: 'Cell [Na⁺]', value: '20–30 mmol/L' },
    { label: 'Peritubular net uptake gradient', value: '≈13 mmHg' },
    { label: 'Glucose Tm', value: '≈375 mg/min' },
    { label: 'Glucose threshold (splay)', value: '180–200 mg/dL' },
    { label: 'Apparent HCO₃⁻ reabsorption plateau', value: '26–28 mmol/L filtrate (volume-dependent)' },
    { label: 'Filtered urea excreted', value: '50–60%' },
    { label: 'Filtered Ca²⁺ reabsorbed (PT + loop)', value: '80–85%; ~5% excreted' },
    { label: 'Filtered phosphate reabsorbed', value: '80–95%' },
    { label: 'Filtered Mg²⁺', value: '70–80% of plasma; ~3% excreted; 50–60% reabsorbed in the loop' },
    { label: 'Urate excreted', value: '6–12% of filtered' },
    { label: 'Citrate reabsorbed', value: '65–90%' },
    { label: 'Plasma HCO₃⁻ with no proximal reclamation', value: '≈11–12 mmol/L (distal capacity alone)' },
  ],
  equations: ['clearance', 'ff'],
  clinical: [
    'Hypovolaemia raises proximal reabsorption of sodium and, with it, of bicarbonate (maintaining metabolic alkalosis), urea (raising BUN out of proportion to creatinine), calcium, and urate (diuretic-induced hyperuricaemia).',
    'Acetazolamide causes a chloruresis as well as bicarbonaturia, because proximal chloride reabsorption depends on prior bicarbonate reabsorption.',
    'Glucose appears in the urine above ~180–200 mg/dL, not at the Tm-predicted 300 mg/dL, because of nephron heterogeneity.',
    'Hypercalcaemia: saline plus a loop diuretic increases calcium excretion. Hypercalciuric stones: low sodium intake plus a thiazide or amiloride reduces it; potassium citrate raises urinary citrate without the calciuria sodium would cause.',
    'In proximal (type 2) RTA the plasma bicarbonate usually stabilises at or above ~12 mmol/L, because distal segments can still reclaim that much.',
    'Cimetidine and trimethoprim raise creatinine by competing for organic cation secretion; probenecid slows penicillin excretion; urinary alkalinisation speeds salicylate excretion.',
  ],
  pathology: [
    { name: 'Fanconi syndrome', broken: 'Generalised proximal transport (often energy supply or brush border)', consequence: 'Glucosuria at normal plasma glucose, aminoaciduria, phosphaturia (rickets/osteomalacia), bicarbonaturia (proximal RTA), urate and citrate wasting', route: '/inherited' },
    { name: 'Renal glucosuria', broken: 'SGLT2 number or affinity', consequence: 'Glucose in the urine with normal blood glucose; otherwise benign', route: '/glucose' },
    { name: 'Proximal (type 2) RTA', broken: 'Proximal HCO₃⁻ reclamation (NHE3, carbonic anhydrase or NBCe1)', consequence: 'Bicarbonate wasting until plasma HCO₃⁻ falls to what the distal nephron can reclaim (~12–20 mmol/L), then acid urine', route: '/rta' },
    { name: 'Cystinuria', broken: 'Cystine/dibasic amino acid carrier (SLC3A1/SLC7A9)', consequence: 'Cystine stones', route: '/inherited' },
    { name: 'Ischaemic tubular injury', broken: 'Epithelial polarity (pumps drift apical)', consequence: 'Delayed recovery of sodium reabsorption', route: '/prerenal-atn' },
    { name: 'Hypoparathyroidism', broken: 'PTH-dependent distal Ca²⁺ reabsorption', consequence: 'Calciuria despite hypocalcaemia; treatment limited by hypercalciuria', route: '/minerals' },
  ],
  questions: [
    {
      q: 'GFR rises with no change in extracellular volume. Fractional and absolute proximal Na⁺ reabsorption:',
      options: ['Both unchanged', 'Fractional unchanged, absolute increased', 'Fractional increased, absolute unchanged', 'Both decreased'],
      answer: 1,
      explanation: 'Glomerulotubular balance: the proximal tubule reabsorbs a roughly constant fraction, so absolute reabsorption rises with the filtered load.',
      route: '/proximal',
    },
    {
      q: 'PTH inhibits proximal Na⁺/H⁺ exchange. Which proximal reabsorptions fall?',
      options: ['Only bicarbonate', 'Bicarbonate, chloride and water', 'Only phosphate', 'None'],
      answer: 1,
      explanation: 'NHE3 reclaims bicarbonate directly; less bicarbonate reabsorption means a smaller chloride gradient (less passive NaCl) and less active chloride exchange; water follows solute. (PTH’s dominant proximal effect is on phosphate.)',
      route: '/transport',
    },
    {
      q: 'After three days of diarrhoea: BUN 40 (was 10), creatinine 1.0 (unchanged), urate raised. Why is the BUN up?',
      options: ['GFR has fallen by 75%', 'Enhanced proximal Na⁺ and water reabsorption in volume depletion increases passive urea reabsorption', 'Increased protein intake', 'Hepatic failure'],
      answer: 1,
      explanation: 'The unchanged creatinine says GFR has not changed much. Volume depletion increases proximal reabsorption, and urea follows water. Urate rises for the same reason, plus competition from fasting ketoacid anions for urate secretion.',
      route: '/prerenal-atn',
    },
    {
      q: 'In distal RTA (low plasma HCO₃⁻, alkaline urine), proximal citrate reabsorption is:',
      options: ['Decreased', 'Increased — so urinary citrate falls and calcium phosphate stones form in the alkaline urine', 'Unchanged', 'Abolished'],
      answer: 1,
      explanation: 'Acidaemia increases proximal citrate reabsorption. Low urinary citrate (a stone inhibitor) plus an alkaline urine (calcium phosphate is less soluble) predisposes to nephrocalcinosis and stones. Low filtered bicarbonate also reduces proximal NaCl reabsorption.',
      route: '/rta',
    },
    {
      q: 'Why does glucose appear in the urine at ~200 mg/dL when the Tm predicts ~300?',
      options: ['SGLT1 saturates first', 'Nephron heterogeneity (splay): nephrons with large glomeruli or short proximal tubules saturate early', 'GFR rises with hyperglycaemia', 'Glucose is secreted'],
      answer: 1,
      explanation: 'The whole-kidney Tm is an average. Individual nephrons with a high filtered load relative to their reabsorptive length reach their own Tm at lower plasma glucose.',
      route: '/glucose',
    },
    {
      q: 'Metabolic alkalosis persists in a vomiting patient although bicarbonate is above normal. Why doesn’t the kidney excrete it?',
      options: ['There is a fixed Tm for bicarbonate', 'Volume and chloride depletion raise proximal Na⁺-coupled bicarbonate reabsorption', 'The kidney cannot secrete bicarbonate', 'Aldosterone is suppressed'],
      answer: 1,
      explanation: 'There is no fixed Tm: bicarbonate reabsorption rises with sodium avidity. Until volume and chloride are restored, the excess bicarbonate is reclaimed.',
      route: '/metabolic-alkalosis',
    },
  ],
  updates: [
    {
      topic: 'SGLT2 as a drug target',
      text: 'SGLT2 inhibitors, developed after this edition, block the high-capacity proximal glucose carrier. Besides glucosuria they cause a mild natriuresis, raise macula densa delivery and reduce glomerular hyperfiltration; they reduce kidney and cardiovascular events in trials of patients with and without diabetes.',
      cite: { evidence: 'clinical', refs: ['vallon2017', 'cherney2014', 'heerspink2020', 'empakidney2023'] },
    },
    {
      topic: 'FGF23',
      text: 'The book attributes proximal phosphate regulation to plasma phosphate and PTH. The bone hormone FGF23 (identified in 2000–2001) is now recognised as a principal phosphaturic hormone, removing NaPi-IIa/IIc from the brush border and suppressing calcitriol synthesis.',
      cite: { evidence: 'clinical', refs: ['shimada2004', 'blaine2015'] },
    },
    {
      topic: 'Urate transporters',
      text: 'The apical urate/anion exchanger the book postulates was identified in 2002 as URAT1 (SLC22A12), the target of uricosuric drugs; loss-of-function mutations cause idiopathic renal hypouricaemia.',
      cite: { evidence: 'experimental', refs: ['enomoto2002'] },
    },
  ],
};
