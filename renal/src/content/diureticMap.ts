// Content for the interactive diuretic map (ui/DiureticMap.tsx): each nephron segment with its
// transporters, and each diuretic class with its site, target and effects. Percentages are
// approximate shares of the filtered load; FENa ceilings follow Rose & Post (Table 15-1).
// Diagram coordinates live here too, so the drawing and the content stay in step.

export type SegId = 'glom' | 'pct' | 'tdl' | 'tal0' | 'tal' | 'dct' | 'ccd' | 'mcd';
export type DrugId = 'cai' | 'osm' | 'sglt2' | 'loop' | 'thz' | 'mra' | 'enac' | 'vap';
export type Dir = 'up' | 'down' | 'flat' | 'mixed';
export type Effect = [Dir, string, string];

export interface Transporter {
  /** a = apical, b = basolateral, p = paracellular, c = inside the cell */
  s: 'a' | 'b' | 'p' | 'c';
  n: string;
  m: string;
  /** the drug class that blocks it */
  t?: DrugId;
  /** side the drug arrives from, when not the lumen */
  from?: 'b';
}

export interface Segment {
  name: string;
  full: string;
  role: string;
  path?: string;
  call: [number, number, string] | null;
  label: [number, number, string, 'start' | 'middle' | 'end', string?];
  now: string;
  stats: [string, string][];
  transport: Transporter[];
  notes: string[];
  drugs: DrugId[];
}

export interface DrugClass {
  name: string;
  short: string;
  tag: string;
  ex: string;
  sites: SegId[];
  target: string;
  tgt: string;
  ceiling: string;
  natri: string;
  fx: Record<'na' | 'k' | 'ca' | 'mg' | 'ab' | 'vol', Effect>;
  uses: string[];
  cautions: string[];
  pearl: string;
  more: string[];
}

export interface MapLabel {
  d: DrugId;
  site: SegId;
  x: number;
  y: number;
  a: 'start' | 'end';
  lines: string[];
  bars: [number, number, number, number][];
}

export const SEGS: Record<SegId, Segment> = {
  glom: {
    name: 'Glomerulus', full: "Glomerulus & Bowman's capsule",
    role: 'Filters plasma into the tubule. Nothing is reabsorbed here, but everything downstream depends on how much arrives.',
    call: null, label: [270, 38, 'Glomerulus', 'middle'], now: '≈180 L/day filtered',
    stats: [['≈125 mL/min', 'GFR'], ['180 L/day', 'Filtrate'], ['≈20%', 'Filtration fraction'], ['≈25,000', 'mmol Na⁺/day filtered']],
    transport: [],
    notes: [
      'NSAIDs constrict the afferent arteriole: GFR falls, and they blunt loop diuretics.',
      'ACE inhibitors and ARBs dilate the efferent arteriole, so glomerular pressure and GFR fall a little. A creatinine rise of up to about 30% is expected.',
      'SGLT2 inhibitors raise NaCl delivery to the macula densa. Tubuloglomerular feedback constricts the afferent arteriole, which causes the early eGFR dip.',
      'Mannitol is freely filtered here and not reabsorbed, which is how it works downstream.'
    ],
    drugs: []
  },
  pct: {
    name: 'Proximal tubule', full: 'Proximal convoluted tubule',
    role: 'The bulk reabsorber. Fluid leaves isotonic (≈300 mOsm/kg): the volume falls but the concentration does not.',
    path: 'M240 122 C215 145 180 150 160 125 C140 100 170 70 140 60 C105 48 70 80 85 115 C100 150 140 140 140 180 C140 215 95 215 95 250 L95 275',
    call: [-62, 196, 'Na⁺ 65–70%'], label: [40, 30, 'Proximal tubule', 'middle'], now: '65–70% of Na⁺',
    stats: [['65–70%', 'Na⁺'], ['≈65%', 'Water'], ['≈80%', 'HCO₃⁻'], ['≈100%', 'Glucose'], ['≈65%', 'K⁺ and Ca²⁺']],
    transport: [
      { s: 'a', n: 'NHE3', m: 'Na⁺ in · H⁺ out' },
      { s: 'a', n: 'Carbonic anhydrase IV', m: 'H₂CO₃ → CO₂ + H₂O in lumen', t: 'cai' },
      { s: 'a', n: 'SGLT2', m: 'Na⁺ + glucose in (~90%)', t: 'sglt2' },
      { s: 'a', n: 'NaPi-IIa', m: 'Na⁺ + phosphate in' },
      { s: 'a', n: 'AQP1', m: 'Water follows solute' },
      { s: 'c', n: 'Carbonic anhydrase II', m: 'CO₂ + H₂O → H⁺ + HCO₃⁻', t: 'cai' },
      { s: 'b', n: 'Na⁺/K⁺-ATPase', m: '3Na⁺ out · 2K⁺ in' },
      { s: 'b', n: 'NBCe1', m: 'Na⁺ + 3HCO₃⁻ out' },
      { s: 'b', n: 'GLUT2', m: 'Glucose out' },
      { s: 'b', n: 'OAT1 / OAT3', m: 'Take up loop + thiazide drugs' }
    ],
    notes: [
      'Loop diuretics are over 95% protein-bound, so little is filtered. Like thiazides, they reach their targets by secretion here through OAT1/OAT3. Uraemic anions and NSAIDs compete, one reason for diuretic resistance in CKD.',
      'Loops and thiazides also compete with urate for secretion, and volume contraction increases urate reabsorption here: hence hyperuricaemia and gout.',
      'Fanconi syndrome is failure of this whole segment: glycosuria, aminoaciduria, phosphaturia and proximal (type 2) RTA.'
    ],
    drugs: ['cai', 'sglt2', 'osm']
  },
  tdl: {
    name: 'Thin descending limb', full: 'Thin descending limb of Henle',
    role: 'Permeable to water but not salt. Water leaves into the increasingly concentrated medulla, so tubular fluid is most concentrated at the hairpin.',
    path: 'M95 275 L95 545 C95 600 190 600 190 545', call: [-62, 470, 'H₂O ≈15%'], label: [80, 400, 'Thin descending', 'end'], now: '≈15% of water',
    stats: [['≈15%', 'Water'], ['≈0%', 'Na⁺'], ['up to 1200', 'mOsm/kg at the tip']],
    transport: [
      { s: 'a', n: 'AQP1', m: 'Water out of the lumen' },
      { s: 'b', n: 'AQP1', m: 'Water into the interstitium' }
    ],
    notes: [
      'Mannitol stays in the lumen and holds water with it, so less water leaves here and in the proximal tubule.',
      'This limb and the thick ascending limb form the countercurrent multiplier: the ascending limb adds salt to the medulla, and the descending limb loses water to it.'
    ],
    drugs: ['osm']
  },
  tal0: {
    name: 'Thin ascending limb', full: 'Thin ascending limb of Henle',
    role: 'Impermeable to water but leaky to salt. NaCl diffuses out passively down the gradient the descending limb created, so the fluid starts to dilute.',
    path: 'M190 545 L190 430', call: [212, 530, 'NaCl passive'], label: [212, 500, 'Thin ascending', 'start'], now: 'passive NaCl exit',
    stats: [['Passive', 'NaCl exit'], ['0%', 'Water']],
    transport: [
      { s: 'a', n: 'ClC-Ka', m: 'Cl⁻ out of the lumen' },
      { s: 'p', n: 'Paracellular', m: 'Na⁺ leaks out passively' },
      { s: 'b', n: 'ClC-Ka + barttin', m: 'Cl⁻ into the interstitium' }
    ],
    notes: [
      'Only long-looped (juxtamedullary) nephrons have a thin ascending limb.',
      'No diuretic acts here. It matters for urea handling and the inner medullary gradient.'
    ],
    drugs: []
  },
  tal: {
    name: 'Thick ascending limb', full: 'Thick ascending limb of Henle',
    role: 'The diluting segment. It pumps NaCl out but is impermeable to water, so fluid leaves it at about 100 mOsm/kg and the medullary gradient is built.',
    path: 'M190 430 L190 200', call: [212, 360, 'Na⁺ ≈25%'], label: [212, 330, 'Thick ascending limb', 'start'], now: '≈25% of Na⁺',
    stats: [['≈25%', 'Na⁺'], ['0%', 'Water'], ['60–70%', 'Mg²⁺'], ['20–25%', 'Ca²⁺']],
    transport: [
      { s: 'a', n: 'NKCC2', m: 'Na⁺ + K⁺ + 2Cl⁻ in', t: 'loop' },
      { s: 'a', n: 'ROMK', m: 'K⁺ recycled back: lumen +' },
      { s: 'a', n: 'NHE3', m: 'Na⁺ in · H⁺ out' },
      { s: 'p', n: 'Claudin-16 / 19', m: 'Ca²⁺ and Mg²⁺ between cells' },
      { s: 'b', n: 'Na⁺/K⁺-ATPase', m: '3Na⁺ out · 2K⁺ in' },
      { s: 'b', n: 'ClC-Kb + barttin', m: 'Cl⁻ out' },
      { s: 'b', n: 'CaSR', m: 'High Ca²⁺ slows NaCl uptake' }
    ],
    notes: [
      'K⁺ recycled through ROMK makes the lumen positive. That voltage pushes Ca²⁺ and Mg²⁺ between the cells. Block NKCC2 and the voltage is lost, so Ca²⁺ and Mg²⁺ are lost in urine.',
      'Macula densa cells at the end of this segment sense NaCl through NKCC2. Loop diuretics block them too, so renin rises.',
      'Bartter syndrome (NKCC2, ROMK, ClC-Kb or barttin mutations) looks like a patient on a loop diuretic.'
    ],
    drugs: ['loop']
  },
  dct: {
    name: 'Distal convoluted tubule', full: 'Distal convoluted tubule',
    role: 'Fine-tunes NaCl and is the main regulated site for calcium (PTH) and magnesium. It is still impermeable to water, so it keeps diluting.',
    path: 'M190 200 C190 160 250 150 290 165 C340 185 350 120 390 105 C440 88 470 140 440 170 C410 200 440 235 490 225',
    call: [458, 258, 'Na⁺ ≈5%'], label: [320, 218, 'Distal convoluted tubule', 'middle'], now: '≈5% of Na⁺',
    stats: [['≈5%', 'Na⁺'], ['0%', 'Water'], ['≈10%', 'Ca²⁺ (PTH)'], ['≈10%', 'Mg²⁺']],
    transport: [
      { s: 'a', n: 'NCC', m: 'Na⁺ + Cl⁻ in', t: 'thz' },
      { s: 'a', n: 'TRPV5', m: 'Ca²⁺ in (PTH increases it)' },
      { s: 'a', n: 'TRPM6', m: 'Mg²⁺ in' },
      { s: 'b', n: 'Na⁺/K⁺-ATPase', m: '3Na⁺ out · 2K⁺ in' },
      { s: 'b', n: 'NCX1', m: '3Na⁺ in · Ca²⁺ out' },
      { s: 'b', n: 'ClC-Kb', m: 'Cl⁻ out' }
    ],
    notes: [
      'Block NCC and Na⁺ inside the cell falls. NCX1 then swaps more Na⁺ in for Ca²⁺ out, so more Ca²⁺ is reabsorbed. Mild volume contraction adds proximal Ca²⁺ reabsorption. Together, thiazides lower urine calcium.',
      'Thiazides reduce TRPM6, which is why Mg²⁺ is lost.',
      'Gitelman syndrome (loss of NCC) looks like a patient on a thiazide: low K⁺, low Mg²⁺, low urine Ca²⁺ and alkalosis.'
    ],
    drugs: ['thz']
  },
  ccd: {
    name: 'Cortical collecting duct', full: 'Connecting tubule & cortical collecting duct',
    role: 'Where aldosterone and ADH act. Principal cells take up Na⁺ and secrete K⁺; intercalated cells handle H⁺ and HCO₃⁻.',
    path: 'M490 225 C530 215 560 200 580 190 M580 40 L580 275', call: [604, 236, 'Na⁺ 2–5% · K⁺ out'], label: [604, 188, 'Cortical', 'start', 'collecting duct'], now: '2–5% of Na⁺, main site of K⁺ secretion',
    stats: [['2–5%', 'Na⁺'], ['Variable', 'Water (ADH)'], ['Main site', 'K⁺ secretion']],
    transport: [
      { s: 'c', n: 'Aldosterone receptor (MR)', m: 'More ENaC, ROMK and pumps', t: 'mra', from: 'b' },
      { s: 'a', n: 'ENaC', m: 'Na⁺ in: lumen becomes negative', t: 'enac' },
      { s: 'a', n: 'ROMK / BK', m: 'K⁺ secreted into lumen' },
      { s: 'a', n: 'AQP2', m: 'Water in (only with ADH)' },
      { s: 'b', n: 'Na⁺/K⁺-ATPase', m: '3Na⁺ out · 2K⁺ in' },
      { s: 'b', n: 'V2 receptor', m: 'ADH → AQP2 inserted', t: 'vap' },
      { s: 'b', n: 'AQP3 / AQP4', m: 'Water out to blood' }
    ],
    notes: [
      'Na⁺ entering through ENaC leaves the lumen negative, which pulls K⁺ (principal cells) and H⁺ (α-intercalated cells) out. More Na⁺ reaching this point, as with loops and thiazides, means more K⁺ and H⁺ lost.',
      'α-intercalated cells secrete H⁺ with H⁺-ATPase and H⁺/K⁺-ATPase. β-intercalated cells secrete HCO₃⁻ through pendrin.',
      'Liddle syndrome is overactive ENaC: hypertension, low K⁺, low renin and low aldosterone. Amiloride treats it; spironolactone does not.'
    ],
    drugs: ['mra', 'enac', 'vap']
  },
  mcd: {
    name: 'Medullary collecting duct', full: 'Medullary collecting duct',
    role: 'The final say on water. With ADH, water leaves into the concentrated medulla and urine can reach 1200 mOsm/kg. Without it, urine can be as dilute as 50 mOsm/kg.',
    path: 'M580 275 L580 598', call: [604, 486, 'H₂O with ADH'], label: [604, 430, 'Medullary', 'start', 'collecting duct'], now: 'final water reabsorption (ADH)',
    stats: [['50–1200', 'Urine mOsm/kg'], ['≤1%', 'Na⁺'], ['Urea', 'recycled']],
    transport: [
      { s: 'a', n: 'AQP2', m: 'Water in (ADH)' },
      { s: 'a', n: 'UT-A1', m: 'Urea in from lumen (ADH)' },
      { s: 'b', n: 'V2 receptor', m: 'ADH binds here', t: 'vap' },
      { s: 'b', n: 'UT-A3', m: 'Urea to interstitium' },
      { s: 'b', n: 'AQP3 / AQP4', m: 'Water out to blood' }
    ],
    notes: [
      'Lithium enters principal cells through ENaC and blocks ADH signalling: nephrogenic diabetes insipidus. Amiloride blocks its entry.',
      'Thiazides reduce urine volume in nephrogenic DI, because mild volume contraction increases proximal reabsorption and less water reaches here.',
      'ANP reduces Na⁺ reabsorption in the inner medullary collecting duct.'
    ],
    drugs: ['vap']
  }
};

export const ORDER: SegId[] = ['glom', 'pct', 'tdl', 'tal0', 'tal', 'dct', 'ccd', 'mcd'];

export const DRUGS: Record<DrugId, DrugClass> = {
  cai: {
    name: 'Carbonic anhydrase inhibitors', short: 'CA inhibitors', tag: 'CAi', ex: 'Acetazolamide, methazolamide', sites: ['pct'],
    target: 'Carbonic anhydrase IV (brush border) and II (cytosol)', tgt: 'Carbonic anhydrase', ceiling: 'Weak and self-limiting', natri: 'Weak',
    fx: {
      na: ['flat', '≈', 'Little change'],
      k: ['down', '↓', 'Hypokalaemia: extra Na⁺ and HCO₃⁻ reach the collecting duct and pull K⁺ out'],
      ca: ['flat', '≈', 'Alkaline urine favours calcium phosphate stones'],
      mg: ['flat', '≈', 'Little change'],
      ab: ['down', 'Acidosis', 'Normal anion gap (hyperchloraemic) metabolic acidosis; urine pH above 6'],
      vol: ['up', '↑', 'Mild diuresis that fades in 2–3 days as filtered HCO₃⁻ falls']
    },
    uses: ['Glaucoma', 'Acute mountain sickness', 'Idiopathic intracranial hypertension', 'Metabolic alkalosis in oedematous patients'],
    cautions: ['Sulfonamide', 'Cirrhosis: alkaline urine traps less NH₄⁺ and can precipitate encephalopathy', 'Kidney stones'],
    pearl: 'It acts where most Na⁺ is reabsorbed and is still weak, because the thick ascending limb reclaims most of the extra delivery.',
    more: []
  },
  osm: {
    name: 'Osmotic diuretics', short: 'Osmotic', tag: 'Osmotic', ex: 'Mannitol', sites: ['pct', 'tdl'],
    target: 'No transporter. Filtered, not reabsorbed; holds water in the lumen', tgt: 'None: stays in the lumen', ceiling: 'Dose-dependent; water more than Na⁺', natri: 'Water ≫ Na⁺',
    fx: {
      na: ['mixed', '↓ then ↑', 'Falls first as water is pulled out of cells, then rises as free water is lost in urine'],
      k: ['mixed', '±', 'May rise as K⁺ follows water out of cells; later lost in urine'],
      ca: ['flat', '≈', 'Little change'],
      mg: ['flat', '≈', 'Little change'],
      ab: ['flat', '≈', 'Little direct effect'],
      vol: ['up', '↑↑', 'Large water diuresis']
    },
    uses: ['Raised intracranial pressure', 'Acute angle-closure glaucoma'],
    cautions: ['Pulmonary oedema in heart failure or anuria (it expands the ECF first)', 'AKI at high doses'],
    pearl: 'It needs filtration to work, so in anuria it only expands plasma volume.',
    more: ['An osmolal gap above about 20 mOsm/kg means mannitol is accumulating.', 'It also raises medullary blood flow, which washes out the medullary gradient.']
  },
  sglt2: {
    name: 'SGLT2 inhibitors', short: 'SGLT2 inhibitors', tag: 'SGLT2i', ex: 'Empagliflozin, dapagliflozin, canagliflozin', sites: ['pct'],
    target: 'SGLT2 (early proximal tubule)', tgt: 'SGLT2', ceiling: 'Mild natriuresis plus glycosuria', natri: 'Mild',
    fx: {
      na: ['flat', '≈', 'Little change'],
      k: ['flat', '≈', 'Neutral; slightly less hyperkalaemia'],
      ca: ['flat', '≈', 'Little change'],
      mg: ['up', '↑', 'Serum Mg²⁺ rises slightly'],
      ab: ['down', 'Ketoacidosis risk', 'Euglycaemic diabetic ketoacidosis; stop before surgery and during acute illness'],
      vol: ['up', '↑', 'Osmotic diuresis from about 60–80 g/day of urinary glucose']
    },
    uses: ['Type 2 diabetes', 'Heart failure (reduced and preserved EF)', 'CKD with or without diabetes'],
    cautions: ['Genital mycotic infections', 'Euglycaemic DKA', 'Volume depletion with loop diuretics'],
    pearl: 'An early eGFR dip of a few mL/min is expected and protective: more NaCl at the macula densa constricts the afferent arteriole and lowers glomerular pressure.',
    more: ['Uricosuric: serum urate falls.', 'Haematocrit rises a little.']
  },
  loop: {
    name: 'Loop diuretics', short: 'Loop', tag: 'Loop', ex: 'Furosemide, bumetanide, torsemide, ethacrynic acid', sites: ['tal'],
    target: 'NKCC2 (Na⁺-K⁺-2Cl⁻ cotransporter)', tgt: 'NKCC2', ceiling: 'Up to 20–25% FENa', natri: 'Strongest',
    fx: {
      na: ['flat', '≈', 'Hyponatraemia is less common than with thiazides: they impair both diluting and concentrating'],
      k: ['down', '↓', 'Hypokalaemia'],
      ca: ['down', '↓', 'Calciuria; serum Ca²⁺ falls (used with saline in hypercalcaemia)'],
      mg: ['down', '↓', 'Hypomagnesaemia'],
      ab: ['up', 'Alkalosis', 'Metabolic alkalosis from volume contraction, K⁺ loss and more distal H⁺ secretion'],
      vol: ['up', '↑↑↑', 'Large diuresis']
    },
    uses: ['Acute pulmonary oedema', 'Oedema in heart failure, cirrhosis, nephrotic syndrome', 'Hypercalcaemia', 'Hyperkalaemia'],
    cautions: ['Ototoxicity (high IV doses, with aminoglycosides)', 'Hyperuricaemia and gout', 'Sulfonamide (not ethacrynic acid)', 'Volume depletion and AKI'],
    pearl: 'They wash out the medullary gradient, so urine cannot be concentrated. That is why they cause less hyponatraemia than thiazides and are used with salt in SIADH.',
    more: ['Oral furosemide absorption varies (10–100%); bumetanide and torsemide are more predictable.', 'Short-acting: salt eaten between doses is retained (post-diuretic rebound).', 'Ethacrynic acid is the most ototoxic and the option in sulfonamide allergy.']
  },
  thz: {
    name: 'Thiazides', short: 'Thiazides', tag: 'Thiazide', ex: 'Hydrochlorothiazide, chlorthalidone, indapamide, metolazone', sites: ['dct'],
    target: 'NCC (Na⁺-Cl⁻ cotransporter)', tgt: 'NCC', ceiling: 'Up to 3–5% FENa', natri: 'Moderate',
    fx: {
      na: ['down', '↓', 'Hyponatraemia: diluting is impaired but ADH can still concentrate urine'],
      k: ['down', '↓', 'Hypokalaemia'],
      ca: ['up', '↑', 'Hypocalciuria; serum Ca²⁺ may rise (used for calcium stones)'],
      mg: ['down', '↓', 'Hypomagnesaemia'],
      ab: ['up', 'Alkalosis', 'Metabolic alkalosis'],
      vol: ['up', '↑↑', 'Moderate diuresis']
    },
    uses: ['Hypertension (chlorthalidone, indapamide)', 'Calcium stones with hypercalciuria', 'Nephrogenic diabetes insipidus', 'With a loop diuretic for resistance (metolazone)'],
    cautions: ['Hyperglycaemia, hyperlipidaemia, hyperuricaemia', 'Hyponatraemia in older adults', 'Sulfonamide'],
    pearl: 'Acting in the cortex, they leave the medullary gradient intact. That is why hyponatraemia is a thiazide problem, not a loop one.',
    more: ['Less effective below an eGFR of about 30, although chlorthalidone and metolazone still work.', 'Hydrochlorothiazide is photosensitising and linked to non-melanoma skin cancer.']
  },
  mra: {
    name: 'Mineralocorticoid receptor antagonists', short: 'MRAs', tag: 'MRA', ex: 'Spironolactone, eplerenone, finerenone', sites: ['ccd'],
    target: 'Mineralocorticoid (aldosterone) receptor in principal cells', tgt: 'Mineralocorticoid receptor', ceiling: 'Up to 1–2% FENa', natri: 'Mild',
    fx: {
      na: ['flat', '≈', 'Mild fall possible'],
      k: ['up', '↑', 'Hyperkalaemia'],
      ca: ['flat', '≈', 'Little change'],
      mg: ['up', '↑', 'Mg²⁺ retained'],
      ab: ['down', 'Acidosis', 'Metabolic acidosis (less H⁺ secretion; type 4 RTA pattern)'],
      vol: ['up', '↑', 'Mild diuresis, slow onset over days']
    },
    uses: ['Heart failure with reduced EF (survival benefit)', 'Primary aldosteronism', 'Resistant hypertension', 'Cirrhotic ascites (first line)', 'Diabetic CKD (finerenone)'],
    cautions: ['Hyperkalaemia, especially with ACE inhibitors, ARBs or CKD', 'Gynaecomastia and menstrual change (spironolactone)'],
    pearl: 'The only diuretic that does not need to reach the tubular lumen: it enters from the blood side. That is why it still works in cirrhosis.',
    more: ['Onset over days, because it acts by changing gene transcription.', 'Eplerenone and finerenone are more selective, so gynaecomastia is rare.']
  },
  enac: {
    name: 'ENaC blockers', short: 'ENaC blockers', tag: 'Amiloride', ex: 'Amiloride, triamterene', sites: ['ccd'],
    target: 'ENaC (epithelial Na⁺ channel), from the lumen', tgt: 'ENaC', ceiling: 'Up to 1–2% FENa', natri: 'Mild',
    fx: {
      na: ['flat', '≈', 'Little change'],
      k: ['up', '↑', 'Hyperkalaemia'],
      ca: ['flat', '≈', 'Little change'],
      mg: ['up', '↑', 'Mg²⁺ retained'],
      ab: ['down', 'Acidosis', 'Metabolic acidosis: no lumen-negative drive for H⁺ secretion'],
      vol: ['up', '↑', 'Mild diuresis']
    },
    uses: ['Liddle syndrome', 'Lithium-induced nephrogenic DI', 'Offset K⁺ loss from loops or thiazides'],
    cautions: ['Hyperkalaemia', 'Triamterene: kidney stones, folate antagonism'],
    pearl: 'Works whatever the aldosterone level, because it blocks the channel itself.',
    more: ['Trimethoprim and pentamidine block ENaC the same way, which is why they raise K⁺.']
  },
  vap: {
    name: 'Vasopressin (V2) antagonists', short: 'Vaptans', tag: 'Vaptan', ex: 'Tolvaptan (oral), conivaptan (IV)', sites: ['ccd', 'mcd'],
    target: 'V2 receptor: no AQP2 insertion', tgt: 'V2 receptor', ceiling: 'No natriuresis; water only (aquaresis)', natri: 'None (water only)',
    fx: {
      na: ['up', '↑', 'Serum Na⁺ rises as free water is excreted'],
      k: ['flat', '≈', 'No change'],
      ca: ['flat', '≈', 'No change'],
      mg: ['flat', '≈', 'No change'],
      ab: ['flat', '≈', 'No change'],
      vol: ['up', '↑↑', 'Large volume of dilute urine']
    },
    uses: ['SIADH and hypervolaemic hyponatraemia', 'ADPKD (tolvaptan slows cyst growth)'],
    cautions: ['Correcting Na⁺ too fast: osmotic demyelination', 'Liver injury (tolvaptan)', 'Hypovolaemic hyponatraemia (contraindicated)'],
    pearl: 'The one class built to raise serum Na⁺: it removes water without salt.',
    more: ['Conivaptan also blocks V1a receptors.', 'Thirst is common; patients must be able to drink.']
  }
};
export const FX: [keyof DrugClass['fx'], string][] = [['na', 'Serum Na⁺'], ['k', 'Serum K⁺'], ['ca', 'Calcium'], ['mg', 'Magnesium'], ['ab', 'Acid–base'], ['vol', 'Urine volume']];
export const NA_SPLIT: [SegId | null, number, string][] = [['pct', 66, '65–70%'], ['tal', 25, '≈25%'], ['dct', 5, '≈5%'], ['ccd', 3, '2–5%'], [null, 1, '<1%']];

// Drug labels on the drawing. Each bar runs from the label to the tube wall and ends in a T (inhibition).
export const MAPLBL: MapLabel[] = [
  { d: 'cai', site: 'pct', x: 30, y: 88, a: 'end', lines: ['CA inhibitors', 'acetazolamide'], bars: [[34, 92, 67, 94]] },
  { d: 'sglt2', site: 'pct', x: 30, y: 140, a: 'end', lines: ['SGLT2 inhibitors', 'empagliflozin · dapagliflozin'], bars: [[34, 144, 103, 146]] },
  { d: 'osm', site: 'pct', x: 30, y: 236, a: 'end', lines: ['Osmotic diuretics', 'mannitol'], bars: [[34, 238, 99, 223]] },
  { d: 'osm', site: 'tdl', x: 30, y: 236, a: 'end', lines: [], bars: [[34, 250, 80, 318]] },
  { d: 'loop', site: 'tal', x: 262, y: 394, a: 'start', lines: ['Loop diuretics', 'furosemide · bumetanide', 'torsemide · ethacrynic acid'], bars: [[258, 390, 206, 390]] },
  { d: 'thz', site: 'dct', x: 372, y: 24, a: 'start', lines: ['Thiazides', 'hydrochlorothiazide', 'chlorthalidone · indapamide'], bars: [[428, 60, 428, 89]] },
  { d: 'mra', site: 'ccd', x: 626, y: 44, a: 'start', lines: ['MRAs', 'spironolactone · eplerenone', 'finerenone'], bars: [[622, 40, 596, 40]] },
  { d: 'enac', site: 'ccd', x: 626, y: 100, a: 'start', lines: ['ENaC blockers', 'amiloride · triamterene'], bars: [[622, 96, 596, 96]] },
  { d: 'vap', site: 'ccd', x: 626, y: 142, a: 'start', lines: ['Vaptans', 'tolvaptan · conivaptan'], bars: [[622, 138, 596, 138]] },
  { d: 'vap', site: 'mcd', x: 626, y: 362, a: 'start', lines: ['Vaptans', 'tolvaptan · conivaptan'], bars: [[622, 358, 596, 358]] }
];
