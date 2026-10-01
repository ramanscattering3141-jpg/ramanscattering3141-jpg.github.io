// The transporter and drug-target map: which carrier sits where along the nephron, which drugs act on
// it, and what that does to sodium, potassium, magnesium, calcium, acid–base and water.
// Rose & Post chs. 3–5 (transport), 15 (diuretics), 23–28 (electrolyte disorders); mechanism papers as cited.

import type { Citation } from './sources';

export type CellId = 'PT' | 'TAL' | 'DCT' | 'PC' | 'IC';
export type Side = 'apical' | 'baso' | 'para' | 'intra';

export interface Flux {
  ion: string;
  /** 'down' = towards the blood (reabsorbed); 'up' = towards the urine (secreted) */
  dir: 'down' | 'up';
}

export interface Transporter {
  id: string;
  cell: CellId;
  side: Side;
  /** position across the cell, 0–1 */
  x: number;
  /** for intracellular items, position down the cell, 0–1 */
  y?: number;
  short: string;
  name: string;
  fluxes: Flux[];
  kind: 'carrier' | 'channel' | 'pump' | 'receptor' | 'enzyme' | 'junction';
  what: string;
  genetics?: string;
}

export interface Cell {
  id: CellId;
  name: string;
  load: string;
  voltage?: string;
}

export const CELLS: Cell[] = [
  { id: 'PT', name: 'Proximal tubule', load: '≈65% of filtered Na⁺; all glucose; ≈80% of HCO₃⁻' },
  { id: 'TAL', name: 'Thick ascending limb', load: '≈25% of Na⁺; ≈60–70% of Mg²⁺; builds the medullary gradient', voltage: 'lumen +' },
  { id: 'DCT', name: 'Distal convoluted tubule', load: '≈5–10% of Na⁺; fine-tunes Mg²⁺ and Ca²⁺' },
  { id: 'PC', name: 'Principal cell (CNT/CCD)', load: '≈2–3% of Na⁺; secretes K⁺; water with ADH', voltage: 'lumen −' },
  { id: 'IC', name: 'α-intercalated cell', load: 'secretes H⁺; reclaims K⁺' },
];

export const TRANSPORTERS: Transporter[] = [
  // proximal tubule
  { id: 'nhe3', cell: 'PT', side: 'apical', x: 0.14, short: 'NHE3', name: 'Na⁺/H⁺ exchanger 3', kind: 'carrier', fluxes: [{ ion: 'Na⁺', dir: 'down' }, { ion: 'H⁺', dir: 'up' }], what: 'The main proximal entry route for Na⁺. The secreted H⁺ titrates filtered bicarbonate, which is how most HCO₃⁻ is reclaimed. Stimulated by angiotensin II and sympathetic nerves; inhibited by dopamine and PTH.' },
  { id: 'sglt2', cell: 'PT', side: 'apical', x: 0.4, short: 'SGLT2', name: 'Na⁺–glucose cotransporter 2', kind: 'carrier', fluxes: [{ ion: 'Na⁺', dir: 'down' }, { ion: 'glc', dir: 'down' }], what: 'Reabsorbs about 90% of filtered glucose in the early proximal tubule; SGLT1 downstream takes the rest.', genetics: 'Familial renal glucosuria (SLC5A2).' },
  { id: 'napi', cell: 'PT', side: 'apical', x: 0.66, short: 'NaPi-IIa', name: 'Na⁺–phosphate cotransporter', kind: 'carrier', fluxes: [{ ion: 'Na⁺', dir: 'down' }, { ion: 'Pi', dir: 'down' }], what: 'Sets phosphate reabsorption. PTH and FGF23 pull it out of the membrane (phosphaturia).' },
  { id: 'ca4', cell: 'PT', side: 'apical', x: 0.88, short: 'CA IV', name: 'Luminal carbonic anhydrase (IV)', kind: 'enzyme', fluxes: [{ ion: 'CO₂', dir: 'down' }], what: 'On the brush border: converts the H₂CO₃ formed from secreted H⁺ and filtered HCO₃⁻ into CO₂ and water, which enter the cell. Without it bicarbonate reclamation stalls.' },
  { id: 'ca2', cell: 'PT', side: 'intra', x: 0.72, y: 0.55, short: 'CA II', name: 'Cytosolic carbonic anhydrase (II)', kind: 'enzyme', fluxes: [], what: 'Regenerates H⁺ and HCO₃⁻ inside the cell from CO₂ and water: H⁺ goes back out on NHE3, HCO₃⁻ leaves across the basolateral membrane.' },
  { id: 'nka_pt', cell: 'PT', side: 'baso', x: 0.22, short: 'Na⁺ pump', name: 'Na⁺/K⁺-ATPase', kind: 'pump', fluxes: [{ ion: '3Na⁺', dir: 'down' }, { ion: '2K⁺', dir: 'up' }], what: 'The engine for every secondary active step in the cell: keeps cell Na⁺ low and the inside negative.' },
  { id: 'nbce1', cell: 'PT', side: 'baso', x: 0.6, short: 'NBCe1', name: 'Na⁺–3HCO₃⁻ cotransporter', kind: 'carrier', fluxes: [{ ion: 'Na⁺', dir: 'down' }, { ion: '3HCO₃⁻', dir: 'down' }], what: 'Carries reclaimed bicarbonate into the blood.', genetics: 'Loss of function: proximal (type 2) RTA with eye abnormalities.' },
  { id: 'cldn2', cell: 'PT', side: 'para', x: 1, short: 'claudin-2', name: 'Leaky tight junction (claudin-2)', kind: 'junction', fluxes: [{ ion: 'Cl⁻', dir: 'down' }, { ion: 'water', dir: 'down' }, { ion: 'Ca²⁺', dir: 'down' }], what: 'The proximal tight junction is leaky: water, Cl⁻ and Ca²⁺ follow Na⁺ between the cells. That is why proximal Ca²⁺ reabsorption rises whenever proximal Na⁺ reabsorption does (volume depletion, thiazides).' },
  // thick ascending limb
  { id: 'nkcc2', cell: 'TAL', side: 'apical', x: 0.22, short: 'NKCC2', name: 'Na⁺–K⁺–2Cl⁻ cotransporter', kind: 'carrier', fluxes: [{ ion: 'Na⁺', dir: 'down' }, { ion: 'K⁺', dir: 'down' }, { ion: '2Cl⁻', dir: 'down' }], what: 'Takes up NaCl without water: dilutes the tubular fluid and loads the medullary interstitium, the basis of both diluting and concentrating the urine.', genetics: 'Bartter syndrome type 1 (SLC12A1).' },
  { id: 'romk_tal', cell: 'TAL', side: 'apical', x: 0.68, short: 'ROMK', name: 'Renal outer medullary K⁺ channel', kind: 'channel', fluxes: [{ ion: 'K⁺', dir: 'up' }], what: 'Recycles the K⁺ brought in by NKCC2 back to the lumen. That keeps NKCC2 supplied and makes the lumen positive (+5 to +10 mV) — the voltage that drives Mg²⁺ and Ca²⁺ between the cells.', genetics: 'Bartter syndrome type 2 (KCNJ1).' },
  { id: 'nka_tal', cell: 'TAL', side: 'baso', x: 0.2, short: 'Na⁺ pump', name: 'Na⁺/K⁺-ATPase', kind: 'pump', fluxes: [{ ion: '3Na⁺', dir: 'down' }, { ion: '2K⁺', dir: 'up' }], what: 'Pumps the reabsorbed Na⁺ out. The TAL has the highest pump density in the nephron and works close to hypoxia.' },
  { id: 'clckb', cell: 'TAL', side: 'baso', x: 0.5, short: 'ClC-Kb', name: 'Cl⁻ channel ClC-Kb with barttin', kind: 'channel', fluxes: [{ ion: 'Cl⁻', dir: 'down' }], what: 'The exit for chloride.', genetics: 'Bartter type 3 (CLCNKB); type 4 (barttin, with deafness).' },
  { id: 'casr', cell: 'TAL', side: 'baso', x: 0.8, short: 'CaSR', name: 'Calcium-sensing receptor', kind: 'receptor', fluxes: [], what: 'Senses peritubular Ca²⁺ and Mg²⁺. When activated it turns down ROMK and NKCC2 — so less lumen-positive voltage and less Mg²⁺ and Ca²⁺ reabsorption. Hypercalcaemia therefore causes calciuria and a concentrating defect.', genetics: 'Activating mutations: autosomal dominant hypocalcaemia with a Bartter-like picture (type 5).' },
  { id: 'cldn16', cell: 'TAL', side: 'para', x: 1, short: 'claudin-16/19', name: 'Cation-selective tight junction (claudin-16/19)', kind: 'junction', fluxes: [{ ion: 'Mg²⁺', dir: 'down' }, { ion: 'Ca²⁺', dir: 'down' }, { ion: 'Na⁺', dir: 'down' }], what: 'Most filtered Mg²⁺ (60–70%) is reabsorbed here, passively between the cells, pushed by the lumen-positive voltage. Anything that abolishes the voltage — a loop diuretic, Bartter syndrome, CaSR activation — wastes Mg²⁺ and Ca²⁺.', genetics: 'Familial hypomagnesaemia with hypercalciuria and nephrocalcinosis (CLDN16 = paracellin-1, CLDN19).' },
  // distal convoluted tubule
  { id: 'ncc', cell: 'DCT', side: 'apical', x: 0.18, short: 'NCC', name: 'Na⁺–Cl⁻ cotransporter', kind: 'carrier', fluxes: [{ ion: 'Na⁺', dir: 'down' }, { ion: 'Cl⁻', dir: 'down' }], what: 'The cortical diluting segment: NaCl without water. Activated by the WNK–SPAK kinases (angiotensin II, low K⁺, calcineurin inhibitors).', genetics: 'Gitelman syndrome (SLC12A3); overactive in familial hyperkalaemic hypertension (WNK/KLHL3/CUL3).' },
  { id: 'trpm6', cell: 'DCT', side: 'apical', x: 0.5, short: 'TRPM6', name: 'Mg²⁺ channel TRPM6', kind: 'channel', fluxes: [{ ion: 'Mg²⁺', dir: 'down' }], what: 'Active, regulated Mg²⁺ reabsorption: only about 10% of the filtered load, but it sets the final urinary Mg²⁺. Stimulated by EGF acting on basolateral EGF receptors.', genetics: 'Hypomagnesaemia with secondary hypocalcaemia (TRPM6).' },
  { id: 'trpv5', cell: 'DCT', side: 'apical', x: 0.8, short: 'TRPV5', name: 'Ca²⁺ channel TRPV5 (late DCT, CNT)', kind: 'channel', fluxes: [{ ion: 'Ca²⁺', dir: 'down' }], what: 'Active, PTH- and calcitriol-regulated Ca²⁺ reabsorption.' },
  { id: 'nka_dct', cell: 'DCT', side: 'baso', x: 0.17, short: 'Na⁺ pump', name: 'Na⁺/K⁺-ATPase', kind: 'pump', fluxes: [{ ion: '3Na⁺', dir: 'down' }, { ion: '2K⁺', dir: 'up' }], what: 'Pumps the Na⁺ out.' },
  { id: 'egfr', cell: 'DCT', side: 'baso', x: 0.42, short: 'EGFR', name: 'EGF receptor', kind: 'receptor', fluxes: [], what: 'EGF acting here keeps TRPM6 in the apical membrane. Blocking EGFR (cetuximab, panitumumab) wastes Mg²⁺.', genetics: 'Isolated recessive renal hypomagnesaemia (pro-EGF).' },
  { id: 'kir41', cell: 'DCT', side: 'baso', x: 0.64, short: 'Kir4.1', name: 'Basolateral K⁺ channel Kir4.1/5.1', kind: 'channel', fluxes: [{ ion: 'K⁺', dir: 'down' }], what: 'Recycles K⁺ and sets the membrane voltage that drives Cl⁻ exit and Mg²⁺ entry; the DCT senses plasma K⁺ through it.', genetics: 'EAST/SeSAME syndrome (KCNJ10): a Gitelman-like salt and Mg²⁺ wasting.' },
  { id: 'ncx1', cell: 'DCT', side: 'baso', x: 0.88, short: 'NCX1', name: 'Na⁺/Ca²⁺ exchanger', kind: 'carrier', fluxes: [{ ion: 'Ca²⁺', dir: 'down' }, { ion: '3Na⁺', dir: 'up' }], what: 'Moves reclaimed Ca²⁺ into the blood.' },
  // principal cell
  { id: 'enac', cell: 'PC', side: 'apical', x: 0.15, short: 'ENaC', name: 'Epithelial Na⁺ channel', kind: 'channel', fluxes: [{ ion: 'Na⁺', dir: 'down' }], what: 'Na⁺ enters alone, without an anion, so the lumen becomes negative — the voltage that drives K⁺ (and H⁺) secretion. Aldosterone multiplies the number of open channels.', genetics: 'Liddle syndrome (gain); pseudohypoaldosteronism type 1 (loss).' },
  { id: 'romk_pc', cell: 'PC', side: 'apical', x: 0.48, short: 'ROMK / BK', name: 'K⁺ channels ROMK and BK', kind: 'channel', fluxes: [{ ion: 'K⁺', dir: 'up' }], what: 'Where K⁺ is secreted: ROMK at baseline, flow-activated BK channels at high tubular flow. Intracellular Mg²⁺ normally blocks outward K⁺ movement through ROMK.' },
  { id: 'aqp2', cell: 'PC', side: 'apical', x: 0.82, short: 'AQP2', name: 'Aquaporin-2', kind: 'channel', fluxes: [{ ion: 'water', dir: 'down' }], what: 'Inserted into the apical membrane when ADH acts on V2 receptors; without it the collecting duct is water-tight and urine stays dilute.', genetics: 'Nephrogenic DI (AQP2, autosomal).' },
  { id: 'nka_pc', cell: 'PC', side: 'baso', x: 0.2, short: 'Na⁺ pump', name: 'Na⁺/K⁺-ATPase', kind: 'pump', fluxes: [{ ion: '3Na⁺', dir: 'down' }, { ion: '2K⁺', dir: 'up' }], what: 'Brings in the K⁺ that ROMK and BK then secrete; increased by aldosterone and by high plasma K⁺.' },
  { id: 'v2r', cell: 'PC', side: 'baso', x: 0.5, short: 'V2R', name: 'Vasopressin V2 receptor', kind: 'receptor', fluxes: [], what: 'ADH → Gs → cAMP → protein kinase A → aquaporin-2 inserted. Also raises urea permeability of the inner medullary collecting duct.', genetics: 'X-linked nephrogenic DI (AVPR2); gain of function: nephrogenic SIAD.' },
  { id: 'aqp34', cell: 'PC', side: 'baso', x: 0.84, short: 'AQP3/4', name: 'Aquaporins 3 and 4', kind: 'channel', fluxes: [{ ion: 'water', dir: 'down' }], what: 'Constitutive basolateral water exits.' },
  { id: 'mr', cell: 'PC', side: 'intra', x: 0.33, y: 0.52, short: 'MR', name: 'Mineralocorticoid receptor', kind: 'receptor', fluxes: [], what: 'Aldosterone binds, moves to the nucleus and switches on ENaC, the Na⁺/K⁺-ATPase and SGK1. 11β-HSD2 in the same cell protects it from cortisol.', genetics: 'Loss: pseudohypoaldosteronism type 1 (NR3C2).' },
  // alpha intercalated cell
  { id: 'hatpase', cell: 'IC', side: 'apical', x: 0.25, short: 'H⁺-ATPase', name: 'Vacuolar H⁺-ATPase', kind: 'pump', fluxes: [{ ion: 'H⁺', dir: 'up' }], what: 'Secretes acid against a gradient down to urine pH ≈4.5; helped by the lumen-negative voltage of neighbouring principal cells.', genetics: 'Distal (type 1) RTA with deafness (ATP6V1B1, ATP6V0A4).' },
  { id: 'hkatpase', cell: 'IC', side: 'apical', x: 0.7, short: 'H⁺/K⁺-ATPase', name: 'H⁺/K⁺-ATPase', kind: 'pump', fluxes: [{ ion: 'H⁺', dir: 'up' }, { ion: 'K⁺', dir: 'down' }], what: 'Secretes H⁺ and reclaims K⁺; upregulated in K⁺ depletion.' },
  { id: 'ae1', cell: 'IC', side: 'baso', x: 0.4, short: 'AE1', name: 'Cl⁻/HCO₃⁻ exchanger AE1', kind: 'carrier', fluxes: [{ ion: 'HCO₃⁻', dir: 'down' }, { ion: 'Cl⁻', dir: 'up' }], what: 'Returns the new bicarbonate made with each secreted H⁺ to the blood.', genetics: 'Distal RTA (SLC4A1).' },
];

export type Action = 'block' | 'activate' | 'reduce';

export interface Effect {
  na?: string;
  k?: string;
  mg?: string;
  ca?: string;
  ab?: string;
  water?: string;
}

export interface Drug {
  id: string;
  name: string;
  examples: string;
  group: 'diuretic' | 'potassium' | 'magnesium' | 'water' | 'other';
  targets: { t: string; action: Action }[];
  /** where the badge sits on the drawing when it has no transporter target */
  anchor?: { cell: CellId; side: 'apical' | 'baso' };
  mech: string;
  effects: Effect;
  cite: Citation;
}

export const DRUGS: Drug[] = [
  {
    id: 'acetazolamide',
    name: 'Acetazolamide',
    examples: 'acetazolamide; topiramate has the same effect',
    group: 'diuretic',
    targets: [{ t: 'ca4', action: 'block' }, { t: 'ca2', action: 'block' }],
    mech: 'Carbonic anhydrase inhibition stalls proximal bicarbonate reclamation: NaHCO₃ is delivered downstream and some is excreted. The diuresis is small because the loop reclaims most of the Na⁺.',
    effects: { k: '↓ (more Na⁺ and a non-reabsorbable anion reach the collecting duct)', ab: 'Hyperchloraemic metabolic acidosis (bicarbonate wasting); alkaline urine', ca: 'Alkaline urine: calcium phosphate stones' },
    cite: { rose: [11, 15], evidence: 'physiology', refs: ['mullens2022advor'] },
  },
  {
    id: 'sglt2i',
    name: 'SGLT2 inhibitors',
    examples: 'empagliflozin, dapagliflozin, canagliflozin',
    group: 'diuretic',
    targets: [{ t: 'sglt2', action: 'block' }],
    mech: 'Glucose and some Na⁺ stay in the lumen; more NaCl reaches the macula densa, tubuloglomerular feedback constricts the afferent arteriole and hyperfiltration falls.',
    effects: { na: 'Mild natriuresis and osmotic diuresis', k: 'Neutral; hyperkalaemia with RAAS blockers is less frequent', mg: '↑ slightly', ab: 'Euglycaemic ketoacidosis in rare cases', water: 'Glucosuria' },
    cite: { rose: [3, 25], evidence: 'clinical', refs: ['mcmurray2019dapa'] },
  },
  {
    id: 'mannitol',
    name: 'Mannitol',
    examples: 'mannitol (osmotic diuretic)',
    group: 'diuretic',
    targets: [],
    anchor: { cell: 'PT', side: 'apical' },
    mech: 'Filtered but not reabsorbed: holds water in the proximal tubule and loop, and first pulls water out of cells into the ECF.',
    effects: { na: 'First ↓ (water drawn from cells dilutes Na⁺), then ↑ (urine is hypotonic to plasma: free water is lost)', k: '↓ (distal flow)', water: 'Osmotic diuresis' },
    cite: { rose: [15, 24], evidence: 'physiology' },
  },
  {
    id: 'loop',
    name: 'Loop diuretics',
    examples: 'furosemide, bumetanide, torsemide',
    group: 'diuretic',
    targets: [{ t: 'nkcc2', action: 'block' }],
    mech: 'Block NKCC2 from the lumen (they reach it by secretion via the proximal organic anion transporters). NaCl uptake, K⁺ recycling and the lumen-positive voltage all collapse.',
    effects: { na: 'Usually normal: the medullary gradient is lost, so urine cannot be concentrated and free water is excreted with the salt', k: '↓↓ (flow + Na⁺ to the principal cell + aldosterone)', mg: '↓ (no voltage for paracellular Mg²⁺)', ca: 'Urine Ca²⁺ ↑ (used for hypercalcaemia)', ab: 'Metabolic alkalosis (contraction, H⁺ secretion)', water: 'Cannot concentrate or fully dilute: urine near isotonic' },
    cite: { rose: [15, 27], evidence: 'physiology', refs: ['felker2011dose'] },
  },
  {
    id: 'aminoglycoside',
    name: 'Aminoglycosides',
    examples: 'gentamicin, tobramycin, amikacin',
    group: 'magnesium',
    targets: [{ t: 'casr', action: 'activate' }],
    mech: 'Polyvalent cations that activate the CaSR (and injure the proximal tubule): the TAL behaves as if hypercalcaemic, with a Bartter-like loss of salt, K⁺, Mg²⁺ and Ca²⁺.',
    effects: { k: '↓', mg: '↓↓', ca: '↓ (urine Ca²⁺ ↑)', ab: 'Metabolic alkalosis', water: 'Concentrating defect' },
    cite: { rose: [27], evidence: 'clinical' },
  },
  {
    id: 'cinacalcet',
    name: 'Calcimimetics',
    examples: 'cinacalcet, etelcalcetide',
    group: 'other',
    targets: [{ t: 'casr', action: 'activate' }],
    mech: 'Make the CaSR more sensitive to Ca²⁺ — mainly in the parathyroid, lowering PTH; in the TAL they add calciuria.',
    effects: { ca: '↓ (lower PTH; more urinary Ca²⁺)', mg: '↓ slightly' },
    cite: { rose: [6], evidence: 'clinical' },
  },
  {
    id: 'thiazide',
    name: 'Thiazides',
    examples: 'hydrochlorothiazide, chlorthalidone, indapamide, metolazone',
    group: 'diuretic',
    targets: [{ t: 'ncc', action: 'block' }],
    mech: 'Block NCC in the cortical diluting segment. The medullary gradient is untouched, so ADH can still concentrate the urine.',
    effects: { na: '↓ — the classic cause of drug-induced hyponatraemia (see the card below)', k: '↓', mg: '↓ (TRPM6 downregulated)', ca: 'Urine Ca²⁺ ↓ (more passive proximal reabsorption after volume contraction); serum Ca²⁺ may rise', ab: 'Metabolic alkalosis', water: 'Cannot dilute: water excretion impaired' },
    cite: { rose: [15, 23], evidence: 'physiology', refs: ['nijenhuis2005', 'ishani2022dcp'] },
  },
  {
    id: 'cni',
    name: 'Calcineurin inhibitors',
    examples: 'tacrolimus, cyclosporine',
    group: 'potassium',
    targets: [{ t: 'ncc', action: 'activate' }, { t: 'trpm6', action: 'reduce' }],
    mech: 'Activate NCC through the WNK–SPAK kinases, reproducing familial hyperkalaemic hypertension: more NaCl taken up in the DCT leaves less Na⁺ for ENaC, so less K⁺ and H⁺ secretion. They also reduce TRPM6.',
    effects: { na: 'Salt retention and hypertension (thiazide-responsive)', k: '↑', mg: '↓', ca: 'Urine Ca²⁺ ↑', ab: 'Hyperchloraemic metabolic acidosis' },
    cite: { rose: [28], evidence: 'experimental', refs: ['hoorn2011'] },
  },
  {
    id: 'egfrab',
    name: 'EGFR antibodies',
    examples: 'cetuximab, panitumumab',
    group: 'magnesium',
    targets: [{ t: 'egfr', action: 'block' }],
    mech: 'Without EGF signalling, TRPM6 is not held in the apical membrane and Mg²⁺ reabsorption in the DCT falls.',
    effects: { mg: '↓↓ (can be severe)', k: '↓ (from Mg²⁺ depletion)', ca: '↓ (Mg²⁺ depletion impairs PTH)' },
    cite: { rose: [27], evidence: 'clinical', refs: ['groenestege2007'] },
  },
  {
    id: 'cisplatin',
    name: 'Cisplatin',
    examples: 'cisplatin',
    group: 'magnesium',
    targets: [{ t: 'trpm6', action: 'reduce' }],
    mech: 'Tubular toxicity with a DCT-predominant, Gitelman-like wasting of Mg²⁺ and K⁺ that can last for years.',
    effects: { mg: '↓↓', k: '↓', ca: '↓' },
    cite: { rose: [27], evidence: 'clinical' },
  },
  {
    id: 'amiloride',
    name: 'ENaC blockers',
    examples: 'amiloride, triamterene',
    group: 'diuretic',
    targets: [{ t: 'enac', action: 'block' }],
    mech: 'Close ENaC: less Na⁺ enters, the lumen is less negative, and K⁺ and H⁺ secretion fall. Amiloride also blocks lithium entry.',
    effects: { na: 'Mild natriuresis', k: '↑ (K⁺-sparing)', mg: 'Spares Mg²⁺', ab: 'Mild metabolic acidosis' },
    cite: { rose: [15, 28], evidence: 'physiology' },
  },
  {
    id: 'trimethoprim',
    name: 'Trimethoprim, pentamidine',
    examples: 'trimethoprim (co-trimoxazole), pentamidine',
    group: 'potassium',
    targets: [{ t: 'enac', action: 'block' }],
    mech: 'Organic cations that block ENaC exactly as amiloride does: a common, overlooked cause of hyperkalaemia, especially at high dose or with RAAS blockers.',
    effects: { k: '↑ (≈0.6 mmol/L on average at high dose)', na: 'Mild natriuresis', ab: 'Mild acidosis' },
    cite: { rose: [28], evidence: 'clinical', refs: ['velazquez1993'] },
  },
  {
    id: 'mra',
    name: 'Mineralocorticoid receptor antagonists',
    examples: 'spironolactone, eplerenone, finerenone',
    group: 'diuretic',
    targets: [{ t: 'mr', action: 'block' }],
    mech: 'Aldosterone can no longer switch on ENaC and the pump: fewer open channels, less lumen-negative voltage.',
    effects: { k: '↑', na: 'Mild natriuresis; ↓ Na⁺ possible', ab: 'Mild acidosis (a type 4 RTA pattern)', mg: 'Spares Mg²⁺' },
    cite: { rose: [15, 28], evidence: 'clinical', refs: ['pitt1999rales'] },
  },
  {
    id: 'raasi',
    name: 'ACE inhibitors, ARBs, heparin',
    examples: 'ramipril, losartan; heparin suppresses aldosterone synthesis',
    group: 'potassium',
    targets: [{ t: 'mr', action: 'reduce' }],
    mech: 'Less aldosterone reaches the receptor (less angiotensin II, or less aldosterone synthesis with heparin).',
    effects: { k: '↑', na: 'Mild natriuresis', ab: 'Mild acidosis' },
    cite: { rose: [6, 28], evidence: 'clinical' },
  },
  {
    id: 'nsaid',
    name: 'NSAIDs',
    examples: 'ibuprofen, naproxen, ketorolac',
    group: 'water',
    targets: [{ t: 'aqp2', action: 'activate' }, { t: 'mr', action: 'reduce' }],
    mech: 'Remove prostaglandins: less renin (so less aldosterone), less opposition to ADH (more water reabsorbed), more NaCl reabsorption, and — in low effective volume — afferent constriction and a fall in GFR.',
    effects: { na: '↓ (ADH effect enhanced); Na⁺ and water retention', k: '↑ (hyporeninaemic hypoaldosteronism)', water: 'Enhanced ADH action' },
    cite: { rose: [6, 23, 28], evidence: 'clinical' },
  },
  {
    id: 'vaptan',
    name: 'Vaptans (V2 antagonists)',
    examples: 'tolvaptan (oral), conivaptan (IV)',
    group: 'water',
    targets: [{ t: 'v2r', action: 'block' }],
    mech: 'Block the V2 receptor: aquaporin-2 is withdrawn and the kidney excretes electrolyte-free water — an "aquaresis", with no loss of Na⁺ or K⁺. Used for euvolaemic or hypervolaemic hyponatraemia (SIADH, heart failure) and, at higher doses, to slow cyst growth in ADPKD.',
    effects: { na: '↑ — can over-correct: monitor Na⁺ closely in the first 24–48 h and let the patient drink to thirst', water: 'Free-water excretion (dilute urine)', k: 'Neutral' },
    cite: { rose: [23], evidence: 'clinical', refs: ['schrier2006', 'spasovski2014'], update: 'Vaptans postdate the 2001 text. Tolvaptan carries a liver-injury warning and is not for hypovolaemic hyponatraemia or for correction faster than guidelines allow; European guidance does not recommend it for SIADH.' },
  },
  {
    id: 'desmopressin',
    name: 'Desmopressin',
    examples: 'desmopressin (DDAVP)',
    group: 'water',
    targets: [{ t: 'v2r', action: 'activate' }],
    mech: 'A selective V2 agonist: inserts aquaporin-2 for hours, regardless of plasma osmolality.',
    effects: { na: '↓ if water intake continues (treats central DI; causes hyponatraemia)', water: 'Concentrated urine' },
    cite: { rose: [24], evidence: 'clinical' },
  },
  {
    id: 'lithium',
    name: 'Lithium',
    examples: 'lithium carbonate',
    group: 'water',
    targets: [{ t: 'aqp2', action: 'reduce' }, { t: 'hatpase', action: 'reduce' }],
    mech: 'Enters principal cells through ENaC and interferes with the V2–cAMP pathway, so aquaporin-2 is lost: nephrogenic diabetes insipidus. Amiloride, by blocking its entry, can help.',
    effects: { na: '↑ (nephrogenic DI, if water intake cannot keep up)', ca: '↑ (raises the PTH set point)', ab: 'Distal RTA (incomplete)', water: 'Polyuria of dilute urine' },
    cite: { rose: [24], evidence: 'clinical' },
  },
  {
    id: 'amphotericin',
    name: 'Amphotericin B',
    examples: 'amphotericin B (less with lipid formulations)',
    group: 'potassium',
    targets: [{ t: 'hatpase', action: 'reduce' }],
    mech: 'Makes pores in cell membranes: secreted H⁺ leaks back into the intercalated cell (a gradient defect), and K⁺ and Mg²⁺ leak out of distal cells.',
    effects: { k: '↓↓', mg: '↓', ab: 'Distal (type 1) RTA' },
    cite: { rose: [19, 27], evidence: 'clinical' },
  },
];

/** Drugs that change electrolytes without acting on a renal transporter: the table only. */
export const OTHER_DRUGS: { name: string; effect: string }[] = [
  { name: 'Proton-pump inhibitors', effect: 'Hypomagnesaemia from reduced intestinal Mg²⁺ absorption (TRPM6/7 in the gut), not renal wasting; urine Mg²⁺ is low.' },
  { name: 'SSRIs, carbamazepine, cyclophosphamide, opioids, MDMA', effect: 'Hyponatraemia by stimulating ADH release or action (SIADH).' },
  { name: 'Ifosfamide, tenofovir', effect: 'Proximal tubulopathy (Fanconi): phosphate, glucose, bicarbonate and K⁺ wasting.' },
  { name: 'Insulin, β₂-agonists', effect: 'Shift K⁺ into cells: hypokalaemia without any renal loss.' },
  { name: 'Succinylcholine, digoxin toxicity, β-blockers', effect: 'Shift K⁺ out of cells (or stop it entering): hyperkalaemia.' },
];
