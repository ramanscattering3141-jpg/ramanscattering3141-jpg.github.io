import type { ChapterContent } from './types';

export const chapter: ChapterContent = {
  n: 5,
  title: 'Functions of the distal nephron',
  thesis:
    'The distal nephron — distal tubule, connecting segment, cortical and medullary collecting tubules — handles only a small share of the filtrate but makes every final adjustment: maximal concentration, potassium secretion, maximal acidification and sodium conservation down to urine Na⁺ below 1 mmol/L. It can hold steep gradients because it is a tight epithelium, but its total capacity is small, which is why upstream mechanisms keep delivery to it nearly constant. Function follows hormone responsiveness cell by cell.',
  concepts: [
    {
      heading: 'Tight, hormonally specialised, and low-capacity',
      body: [
        'Fluid leaves the loop with a Na⁺ of about 75 mmol/L; the collecting tubules can lower it below 1 mmol/L in volume depletion. That requires an epithelium that does not let the gradient leak back: the distal tight junction has up to eight strands versus one in the proximal tubule.',
        'But distal Na⁺-K⁺-ATPase activity is lower than in the proximal tubule or loop, so total capacity is limited. Autoregulation, glomerulotubular balance and tubuloglomerular feedback exist largely to keep delivery within that capacity; an unchecked rise could produce dangerous salt and water losses.',
        'Each cell type does what its hormones dictate: Na⁺ reabsorption and K⁺ secretion in aldosterone-responsive cells, water reabsorption in ADH-responsive cells, Ca²⁺ reabsorption in PTH- and calcitriol-responsive cells, and H⁺ secretion in intercalated and outer medullary cells driven by acidaemia and, permissively, aldosterone.',
      ],
      points: ['Distal tubule: PTH +, calcitriol +; no ADH or aldosterone response', 'Connecting segment: aldosterone, PTH, calcitriol', 'Cortical principal cells: ADH and aldosterone', 'Intercalated cells: aldosterone (H⁺ secretion)', 'Inner medullary collecting duct: ADH, aldosterone, ANP'],
      route: '/distal',
      cite: { rose: [5], evidence: 'physiology' },
    },
    {
      heading: 'Distal convoluted tubule: thiazide-sensitive NaCl, regulated calcium',
      body: [
        'The distal tubule reabsorbs about 5% of filtered NaCl through the electroneutral, thiazide-sensitive Na⁺-Cl⁻ cotransporter (plus parallel Na⁺/H⁺ and Cl⁻/HCO₃⁻ exchange). Unlike NKCC2 it does not need K⁺ and is not inhibited by loop diuretics. Loss-of-function mutations cause Gitelman syndrome — hypokalaemia, metabolic alkalosis and hypocalciuria, like chronic thiazide use.',
        'Like the loop, it is flow-dependent, until luminal Na⁺ falls to ~40 mmol/L. Chronic loop-diuretic use increases distal delivery, causing hypertrophy and more Na⁺-K⁺-ATPase — distal adaptation that blunts the natriuresis and is overcome by adding a thiazide. Chronic thiazide use does the opposite. Cell Na⁺ seems to set transport capacity. A high-salt diet also enlarges distal reabsorption, so regulation of Na⁺ excretion to need happens elsewhere (proximal and collecting tubules).',
        'The distal tubule is water-impermeable even with ADH, so it continues diluting the urine.',
        'It (with the cortical thick limb and connecting segment) is the main site of regulated Ca²⁺ reabsorption: PTH and calcitriol increase apical entry through calcium channels, with calbindin carrying Ca²⁺ across the cell and a basolateral Na⁺/Ca²⁺ exchanger (mostly) and Ca²⁺-ATPase extruding it. Ca²⁺ and Na⁺ handling can be dissociated here — thiazides reduce NaCl reabsorption but increase Ca²⁺ reabsorption, which is why they prevent hypercalciuric stones.',
      ],
      chain: ['Thiazide blocks NCC', '↓ NaCl entry, ↓ cell Na⁺, cell hyperpolarises', '↑ Apical Ca²⁺ entry; ↑ basolateral Na⁺/Ca²⁺ exchange', '↓ Urinary calcium', 'Hypocalciuria (thiazides, Gitelman)'],
      route: '/distal',
      cite: { rose: [5], evidence: 'physiology', refs: ['subramanya2014', 'simon1996gitelman'] },
    },
    {
      heading: 'Connecting segment',
      body: [
        'A hybrid between the distal tubule and collecting duct: water-impermeable even with ADH, it reabsorbs Ca²⁺ under PTH and calcitriol and (in some species) has thiazide-sensitive NaCl cotransport — but it also has aldosterone-responsive Na⁺ channels and secretes K⁺.',
      ],
      cite: { rose: [5], evidence: 'physiology' },
    },
    {
      heading: 'Principal cells: sodium in, potassium out',
      body: [
        'About two-thirds of cortical collecting duct cells are principal cells. Sodium enters through apical Na⁺ channels (ENaC) and leaves via the basolateral pump. Because Na⁺ enters alone (electrogenically), the lumen becomes negative; that voltage drives either paracellular Cl⁻ reabsorption or K⁺ secretion through apical K⁺ channels. The pump also brings K⁺ into the cell, raising the secretory pool.',
        'Why a channel rather than a cotransporter here? Urine Na⁺ can be driven below 5 mmol/L — below cell Na⁺ — so a concentration-driven carrier could not work. Only the cell’s negative voltage can pull Na⁺ in against that concentration gradient, and only an electrogenic channel can use it.',
        'Aldosterone increases the number of open Na⁺ channels — from under 100 to ~3000 per cell when going from a high- to a low-sodium diet — and later increases Na⁺-K⁺-ATPase and apical K⁺ channels (partly secondary to Na⁺ flux, since amiloride prevents the early changes).',
        'The collecting tubules reabsorb 5–7% of filtered Na⁺ and are the main site of day-to-day adjustment of Na⁺ excretion to intake: low intake → aldosterone ↑ → more channels; high intake → aldosterone ↓ and ANP ↑ (which closes inner medullary channels via cGMP). Low Na⁺ delivery also opens more channels via reduced PKC; PGE₂ inhibits transport; ADH may stimulate it in some species.',
        'ENaC mutations produce opposite diseases: gain of function (Liddle syndrome) mimics hyperaldosteronism — hypertension, hypokalaemia; loss of function (autosomal recessive pseudohypoaldosteronism type 1) mimics hypoaldosteronism — salt wasting and hyperkalaemia.',
      ],
      chain: ['Aldosterone → MR', '↑ Open ENaC channels (later ↑ Na⁺-K⁺-ATPase, ↑ ROMK)', '↑ Na⁺ entry without an anion', 'Lumen-negative voltage + ↑ cell K⁺', 'K⁺ secretion (and paracellular Cl⁻ reabsorption)', 'Urine Na⁺ ↓, urine K⁺ ↑'],
      route: '/distal',
      cite: { rose: [5], evidence: 'physiology', refs: ['rossier2015', 'pearce2015', 'shimkets1994'] },
    },
    {
      heading: 'Water in the principal cell',
      body: [
        'Basal apical water permeability is low; ADH inserts aquaporin-2 vesicles, letting the ~100 mOsm/kg fluid equilibrate with the isosmotic cortex (removing much of its volume) and then with the medulla. Less flow would be expected to reduce K⁺ secretion, but ADH directly stimulates K⁺ secretion, so K⁺ excretion is protected from swings in water balance.',
        'Lithium enters principal cells through ENaC and interferes with ADH action, causing polyuria in 20–30% of treated patients (nephrogenic DI). Amiloride, by blocking its entry, can lessen or prevent the defect.',
      ],
      route: '/adh',
      cite: { rose: [5], evidence: 'clinical' },
    },
    {
      heading: 'Intercalated cells: acid or base',
      body: [
        'Type A intercalated cells secrete H⁺ into the lumen through apical H⁺-ATPase (and H⁺-K⁺-ATPase), using H⁺ generated from CO₂ and water by carbonic anhydrase; the matching HCO₃⁻ exits basolaterally on the kidney isoform of the Cl⁻/HCO₃⁻ exchanger AE1. Acidaemia stimulates them; aldosterone enhances H⁺-ATPase activity (permissively in normal people, but hyper- and hypoaldosteronism do shift acid–base balance). Mutations in AE1 or in the H⁺-ATPase (the latter with sensorineural deafness) cause distal RTA.',
        'Type B intercalated cells reverse the polarity: H⁺-ATPase on the basolateral side, an apical Cl⁻/HCO₃⁻ exchanger (later identified as pendrin) secreting HCO₃⁻ in exchange for luminal Cl⁻. They let the kidney excrete an alkali load.',
        'Intercalated cells do not reabsorb Na⁺ (few Na⁺ channels, little pump), are water-impermeable, and reabsorb K⁺ via apical H⁺-K⁺-ATPase — more so in K⁺ depletion, which also adds to acid secretion.',
      ],
      chain: ['Acidaemia (and aldosterone)', '↑ Apical H⁺-ATPase in type A cells', 'H⁺ secreted; new HCO₃⁻ returned to blood via AE1', 'Urine acidified; NH₃ trapped as NH₄⁺'],
      route: '/acid-base',
      cite: { rose: [5, 11], evidence: 'physiology', refs: ['roy2015', 'karet2002'] },
    },
    {
      heading: 'Medullary collecting duct',
      body: [
        'Outer medulla: mostly acid-secreting cells, with far more H⁺-ATPase and H⁺-K⁺-ATPase activity than the cortex — the site that drives urine pH to its minimum and traps ammonium. It can also reabsorb K⁺ (K⁺ conservation and medullary K⁺ recycling). Water-impermeable without ADH, permeable with it.',
        'Inner medulla: Na⁺ enters through amiloride-sensitive cation channels, stimulated by aldosterone, so urine Na⁺ can fall to 5 mmol/L or less; ANP closes these channels via cGMP in volume expansion. ADH makes it water-permeable and — uniquely — raises urea permeability about four-fold (luminal urea transporters), which lets urea accumulate in the medulla. It usually reabsorbs K⁺ (more in depletion) but can secrete it after a load; leak through its cation channels may explain why urine K⁺ cannot fall below 5–15 mmol/L even in severe depletion.',
      ],
      route: '/distal',
      cite: { rose: [5], evidence: 'physiology' },
    },
    {
      heading: 'After the collecting duct',
      body: ['The renal pelvis, ureters and bladder are modestly permeable to urea and water, so urine composition can shift by 7–15% at low flow rates when contact time is long.'],
      cite: { rose: [5], evidence: 'physiology' },
    },
  ],
  numbers: [
    { label: 'Na⁺ in fluid leaving the loop', value: '≈75 mmol/L' },
    { label: 'Minimum urine Na⁺', value: '<1–5 mmol/L' },
    { label: 'Distal tubule NaCl reabsorption', value: '≈5% of filtered' },
    { label: 'DCT limiting luminal Na⁺', value: '≈40 mmol/L' },
    { label: 'Collecting tubules Na⁺ reabsorption', value: '5–7% of filtered' },
    { label: 'Open Na⁺ channels per principal cell', value: '<100 (high salt) → ~3000 (low salt)' },
    { label: 'Principal cells in CCD', value: '≈65%' },
    { label: 'Minimum urine pH', value: '≈4.5' },
    { label: 'ADH effect on IMCD urea permeability', value: '≈4-fold' },
    { label: 'Minimum urine K⁺ in K⁺ depletion', value: '5–15 mmol/L' },
    { label: 'Lithium polyuria', value: '20–30% of treated patients' },
  ],
  equations: ['ttkg', 'uag'],
  clinical: [
    'Chronic loop diuretic use causes distal tubular hypertrophy that limits natriuresis; adding a thiazide (sequential blockade) overcomes it.',
    'Thiazides lower urine calcium and prevent hypercalciuric stones; loop diuretics raise urine calcium.',
    'Liddle syndrome (ENaC gain of function) presents like aldosteronism but with suppressed renin and aldosterone, and responds to amiloride.',
    'Pseudohypoaldosteronism type 1 (ENaC loss of function or MR resistance) presents with salt wasting and hyperkalaemia despite high aldosterone.',
    'Lithium-induced nephrogenic DI can be reduced by amiloride, which blocks lithium’s entry into principal cells.',
    'Distal RTA can result from mutations in the H⁺-ATPase (with deafness) or in AE1.',
  ],
  pathology: [
    { name: 'Gitelman syndrome', broken: 'NCC (SLC12A3)', consequence: 'Mild salt wasting → RAAS; more distal Na⁺ delivery → K⁺ and H⁺ secretion: hypokalaemic alkalosis, hypocalciuria, hypomagnesaemia', route: '/inherited' },
    { name: 'Liddle syndrome', broken: 'ENaC stays in the membrane (gain of function)', consequence: 'Na⁺ retention, hypertension, hypokalaemia, alkalosis with low renin and aldosterone', route: '/inherited' },
    { name: 'Pseudohypoaldosteronism type 1', broken: 'ENaC or MR loss of function', consequence: 'Salt wasting, hyperkalaemia, acidosis, high renin and aldosterone', route: '/hyperkalemia' },
    { name: 'Distal RTA', broken: 'H⁺-ATPase or AE1 in type A intercalated cells', consequence: 'Cannot lower urine pH; NH₄⁺ trapping fails; normal-gap acidosis', route: '/rta' },
    { name: 'Lithium nephrogenic DI', broken: 'ADH response of principal cells (lithium entering via ENaC)', consequence: 'Polyuria, dilute urine', route: '/water-disorders' },
  ],
  questions: [
    {
      q: 'Why does the late collecting duct need a Na⁺ channel rather than a Na⁺ cotransporter?',
      options: ['Channels are faster', 'Urine Na⁺ can fall below cell Na⁺, so only the cell’s negative voltage — usable only by an electrogenic channel — can drive entry', 'Cotransporters need glucose', 'Aldosterone only regulates channels'],
      answer: 1,
      explanation: 'An electroneutral carrier depends on the concentration gradient. When luminal Na⁺ is below 5 mmol/L that gradient points the wrong way; the electrical gradient still favours entry.',
      route: '/distal',
    },
    {
      q: 'After months of furosemide, the natriuretic response weakens. The main renal reason:',
      options: ['Tolerance of NKCC2', 'Distal tubular hypertrophy with more NCC and Na⁺-K⁺-ATPase reclaims the extra delivered NaCl', 'Loss of aldosterone', 'Falling GFR only'],
      answer: 1,
      explanation: 'Increased delivery raises cell Na⁺ and transport capacity downstream. Adding a thiazide blocks the adapted segment too.',
      route: '/diuretics',
    },
    {
      q: 'ADH reduces tubular flow in the collecting duct. What happens to K⁺ secretion?',
      options: ['Falls markedly', 'Stays roughly constant, because ADH also directly stimulates K⁺ secretion', 'Rises markedly', 'Stops'],
      answer: 1,
      explanation: 'The fall in flow would reduce secretion, but ADH increases K⁺ channel activity (and perhaps Na⁺ reabsorption), balancing the effect.',
      route: '/potassium',
    },
    {
      q: 'In metabolic alkalosis, which cell excretes bicarbonate, and what does it need in the lumen?',
      options: ['Principal cell; Na⁺', 'Type B intercalated cell; Cl⁻ (for the apical Cl⁻/HCO₃⁻ exchanger)', 'Type A intercalated cell; K⁺', 'Proximal tubule; glucose'],
      answer: 1,
      explanation: 'Type B cells secrete HCO₃⁻ in exchange for luminal Cl⁻. In chloride depletion (vomiting), this route is limited — one reason chloride repletion corrects the alkalosis.',
      route: '/metabolic-alkalosis',
    },
  ],
  updates: [
    {
      topic: 'Pendrin and the aldosterone paradox',
      text: 'The apical Cl⁻/HCO₃⁻ exchanger of type B intercalated cells, uncertain in the book, is pendrin (SLC26A4). It also contributes to NaCl reabsorption, and the WNK–SPAK pathway explains how aldosterone can promote NaCl retention (with angiotensin II, in volume depletion) or K⁺ secretion (in hyperkalaemia) — the “aldosterone paradox”.',
      cite: { evidence: 'experimental', refs: ['roy2015', 'hoorn2011wnk', 'terker2015'] },
    },
    {
      topic: 'Mineralocorticoid receptor protection',
      text: 'Principal cells express 11β-hydroxysteroid dehydrogenase type 2, which inactivates cortisol and lets aldosterone occupy the mineralocorticoid receptor; its loss (apparent mineralocorticoid excess, liquorice) lets cortisol act as a mineralocorticoid.',
      cite: { evidence: 'clinical', refs: ['mune1995'] },
    },
  ],
};
