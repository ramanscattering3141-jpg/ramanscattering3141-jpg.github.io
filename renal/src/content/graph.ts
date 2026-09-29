// The knowledge graph: the causal spine of the whole platform.
//
// Nodes run from molecule to clinical finding; edges are directed causal links with a sign.
// Search, the "what if?" cascades and the concept map all read from this one structure, so a
// mechanism only has to be stated once.

import type { Citation, Evidence } from './sources';

export type NodeKind =
  | 'transporter'
  | 'ion'
  | 'force'
  | 'segment'
  | 'hormone'
  | 'organ'
  | 'wholeBody'
  | 'disease'
  | 'lab'
  | 'drug'
  | 'treatment'
  | 'equation'
  | 'concept';

export const NODE_KIND_LABEL: Record<NodeKind, string> = {
  transporter: 'Transporter / channel',
  ion: 'Ion or solute',
  force: 'Physical force',
  segment: 'Nephron segment',
  hormone: 'Hormone',
  organ: 'Whole-kidney',
  wholeBody: 'Whole-body',
  disease: 'Disease',
  lab: 'Laboratory finding',
  drug: 'Drug',
  treatment: 'Treatment',
  equation: 'Equation',
  concept: 'Concept',
};

/** The scale a node sits at, for the multi-scale view. */
export type Scale = 'molecular' | 'cellular' | 'nephron' | 'kidney' | 'body' | 'clinical';

export const SCALE_LABEL: Record<Scale, string> = {
  molecular: 'Molecular',
  cellular: 'Cellular',
  nephron: 'Nephron segment',
  kidney: 'Whole kidney',
  body: 'Whole body',
  clinical: 'Clinical',
};

export interface GraphNode {
  id: string;
  label: string;
  kind: NodeKind;
  scale: Scale;
  /** one or two sentences: what this is */
  summary: string;
  /** searchable synonyms and abbreviations */
  aliases?: string[];
  /** route in the app that explores this node */
  route?: string;
  cite?: Citation;
}

/** A citation on an edge inherits the edge's evidence grade. */
export type EdgeCitation = Omit<Citation, 'evidence'> & { evidence?: Evidence };

export interface GraphEdge {
  from: string;
  to: string;
  /** +1 = increases, -1 = decreases, 0 = modulates without a fixed sign */
  sign: 1 | -1 | 0;
  /** the mechanism, in one clause: reads as "<from> ... <to>" */
  mechanism: string;
  evidence: Evidence;
  cite?: EdgeCitation;
}

export const NODES: GraphNode[] = [
  // ---------------------------------------------------------------- molecular
  { id: 'nkcc2', label: 'NKCC2', kind: 'transporter', scale: 'molecular', aliases: ['Na-K-2Cl cotransporter', 'SLC12A1', 'furosemide receptor'], summary: 'The apical cotransporter of the thick ascending limb. Brings in one Na⁺, one K⁺ and two Cl⁻ together; chloride is the rate-limiting site.', route: '/renal/loop/', cite: { rose: [4], evidence: 'physiology', refs: ['mount2014'] } },
  { id: 'romk', label: 'ROMK', kind: 'transporter', scale: 'molecular', aliases: ['Kir1.1', 'KCNJ1'], summary: 'Apical potassium channel. Recycles K⁺ in the thick ascending limb and secretes it in the collecting duct.', route: '/renal/potassium/', cite: { evidence: 'physiology', refs: ['welling2016'] } },
  { id: 'bk', label: 'BK channel', kind: 'transporter', scale: 'molecular', aliases: ['maxi-K', 'flow-activated K channel'], summary: 'Flow-activated apical potassium channel: a high tubular flow rate opens it, adding a flow-dependent component to potassium secretion.', route: '/renal/potassium/', cite: { evidence: 'experimental', refs: ['welling2016'] } },
  { id: 'ncc', label: 'NCC', kind: 'transporter', scale: 'molecular', aliases: ['Na-Cl cotransporter', 'SLC12A3', 'thiazide receptor'], summary: 'The apical Na⁺-Cl⁻ cotransporter of the distal convoluted tubule, and the target of thiazides.', route: '/renal/tubular-transport/', cite: { evidence: 'physiology', refs: ['subramanya2014'] } },
  { id: 'enac', label: 'ENaC', kind: 'transporter', scale: 'molecular', aliases: ['epithelial sodium channel', 'amiloride-sensitive channel'], summary: 'Apical sodium channel of the principal cells. Sodium enters without an anion, so reabsorbing it makes the lumen electrically negative.', route: '/renal/tubular-transport/', cite: { evidence: 'physiology', refs: ['rossier2015'] } },
  { id: 'nhe3', label: 'NHE3', kind: 'transporter', scale: 'molecular', aliases: ['Na-H exchanger', 'sodium-hydrogen antiporter'], summary: 'The main apical sodium entry step of the proximal tubule; secreting H⁺ is how filtered bicarbonate is reclaimed.', route: '/renal/proximal/', cite: { rose: [3], evidence: 'physiology' } },
  { id: 'sglt2', label: 'SGLT2', kind: 'transporter', scale: 'molecular', aliases: ['sodium-glucose cotransporter 2'], summary: 'High-capacity apical glucose carrier of the early proximal tubule, coupled 1:1 to sodium.', route: '/renal/glucose/', cite: { evidence: 'physiology', refs: ['vallon2017'] } },
  { id: 'aqp2', label: 'Aquaporin-2', kind: 'transporter', scale: 'molecular', aliases: ['AQP2', 'water channel'], summary: 'The ADH-regulated water channel. Shuttled into the apical membrane of the collecting duct when ADH binds, and withdrawn when it falls.', route: '/renal/water/', cite: { evidence: 'physiology', refs: ['knepper2015'] } },
  { id: 'utA', label: 'UT-A1/A3', kind: 'transporter', scale: 'molecular', aliases: ['urea transporter'], summary: 'ADH-sensitive urea transporters of the inner medullary collecting duct; they let urea be recycled into the medulla.', route: '/renal/urea/', cite: { evidence: 'experimental', refs: ['fenton2004'] } },
  { id: 'hatpase', label: 'H⁺-ATPase', kind: 'transporter', scale: 'molecular', aliases: ['proton pump', 'vacuolar ATPase'], summary: 'Apical proton pump of the α-intercalated cell; can acidify urine to pH 4.5.', route: '/renal/acid-base/', cite: { evidence: 'physiology', refs: ['roy2015'] } },
  { id: 'pendrin', label: 'Pendrin', kind: 'transporter', scale: 'molecular', aliases: ['SLC26A4', 'Cl-HCO3 exchanger'], summary: 'Apical chloride/bicarbonate exchanger of the β-intercalated cell: the route for excreting excess bicarbonate, and it needs luminal chloride.', route: '/renal/acid-base/', cite: { rose: [18], evidence: 'experimental', refs: ['roy2015'] } },
  { id: 'claudin16', label: 'Claudin-16/19', kind: 'transporter', scale: 'molecular', aliases: ['paracellin-1'], summary: 'Tight-junction proteins that let calcium and magnesium cross between thick ascending limb cells.', route: '/renal/minerals/', cite: { evidence: 'clinical', refs: ['simon1999'] } },
  { id: 'napi2', label: 'NaPi-IIa', kind: 'transporter', scale: 'molecular', aliases: ['sodium-phosphate cotransporter', 'SLC34A1'], summary: 'The apical phosphate carrier of the proximal tubule; removed from the membrane by PTH and FGF23.', route: '/renal/minerals/', cite: { evidence: 'physiology', refs: ['blaine2015'] } },
  { id: 'nakatpase', label: 'Na⁺-K⁺-ATPase', kind: 'transporter', scale: 'molecular', summary: 'The basolateral pump that powers nearly all tubular transport by keeping cell sodium low and the interior negative.', route: '/renal/tubular-transport/', cite: { rose: [1], evidence: 'physiology' } },

  // ---------------------------------------------------------------- cellular / forces
  { id: 'lumenNegative', label: 'Lumen-negative voltage', kind: 'force', scale: 'cellular', aliases: ['transepithelial potential', 'electrical gradient'], summary: 'In the connecting tubule and collecting duct, reabsorbing sodium without an anion leaves the lumen negative — the driving force for potassium and hydrogen secretion.', route: '/renal/potassium/', cite: { rose: [5, 12], evidence: 'physiology' } },
  { id: 'lumenPositive', label: 'Lumen-positive voltage', kind: 'force', scale: 'cellular', summary: 'In the thick ascending limb, potassium recycling through ROMK leaves the lumen positive, which drives calcium and magnesium between the cells.', route: '/renal/loop/', cite: { rose: [4], evidence: 'physiology', refs: ['mount2014'] } },
  { id: 'sodiumGradient', label: 'Inward sodium gradient', kind: 'force', scale: 'cellular', aliases: ['secondary active transport'], summary: 'The low intracellular sodium maintained by the pump. Almost every apical carrier spends this gradient rather than ATP directly.', cite: { rose: [1, 3], evidence: 'physiology' } },
  { id: 'starling', label: 'Starling forces', kind: 'force', scale: 'kidney', aliases: ['hydraulic pressure', 'oncotic pressure', 'net filtration pressure'], summary: 'The balance of hydraulic and oncotic pressures that governs filtration across the glomerulus and uptake by the peritubular capillary.', route: '/renal/gfr/', cite: { rose: [2], evidence: 'physiology', refs: ['deen1972'] } },
  { id: 'medullaryGradient', label: 'Medullary osmotic gradient', kind: 'force', scale: 'kidney', aliases: ['corticomedullary gradient', 'papillary osmolality'], summary: 'The rise in interstitial osmolality from ~290 in the cortex to ~1200 mOsm/kg at the papilla. Built by the loop, stored as NaCl and urea, preserved by the vasa recta.', route: '/renal/countercurrent/', cite: { rose: [4], evidence: 'physiology', refs: ['dantzler2014'] } },

  // ---------------------------------------------------------------- segments
  { id: 'pt', label: 'Proximal tubule', kind: 'segment', scale: 'nephron', summary: 'Reabsorbs 55–65% of the filtrate isosmotically, plus essentially all glucose and amino acids and ~90% of bicarbonate.', route: '/renal/proximal/', cite: { rose: [3], evidence: 'physiology' } },
  { id: 'tal', label: 'Thick ascending limb', kind: 'segment', scale: 'nephron', aliases: ['diluting segment'], summary: 'Pumps NaCl out of a water-impermeable tubule: it dilutes the urine and concentrates the medulla at the same time.', route: '/renal/loop/', cite: { rose: [4], evidence: 'physiology' } },
  { id: 'dct', label: 'Distal convoluted tubule', kind: 'segment', scale: 'nephron', summary: 'Thiazide-sensitive NaCl reabsorption and the regulated site for calcium and magnesium.', route: '/renal/tubular-transport/', cite: { rose: [5], evidence: 'physiology' } },
  { id: 'cd', label: 'Collecting duct', kind: 'segment', scale: 'nephron', aliases: ['principal cell', 'intercalated cell'], summary: 'Where the urine is finished: aldosterone-dependent sodium and potassium handling, ADH-dependent water, and acid or base secretion.', route: '/renal/tubular-transport/', cite: { rose: [5], evidence: 'physiology' } },
  { id: 'maculaDensa', label: 'Macula densa', kind: 'segment', scale: 'nephron', aliases: ['tubuloglomerular feedback', 'TGF'], summary: 'Cells at the end of the cortical thick ascending limb that read NaCl uptake and adjust both filtration and renin release.', route: '/renal/autoregulation/', cite: { rose: [2], evidence: 'physiology', refs: ['carlstrom2015'] } },

  // ---------------------------------------------------------------- hormones
  { id: 'renin', label: 'Renin', kind: 'hormone', scale: 'body', aliases: ['plasma renin activity', 'PRA'], summary: 'Released by juxtaglomerular cells in response to reduced afferent stretch, sympathetic β₁ stimulation and a fall in macula densa NaCl uptake.', route: '/renal/raas/', cite: { rose: [2], evidence: 'physiology' } },
  { id: 'angII', label: 'Angiotensin II', kind: 'hormone', scale: 'body', aliases: ['AT1 receptor', 'ATII'], summary: 'Constricts the efferent arteriole more than the afferent, stimulates proximal Na⁺/H⁺ exchange, releases aldosterone and raises systemic vascular resistance.', route: '/renal/raas/', cite: { rose: [2], evidence: 'physiology' } },
  { id: 'aldosterone', label: 'Aldosterone', kind: 'hormone', scale: 'body', aliases: ['mineralocorticoid receptor', 'MR'], summary: 'Raises ENaC activity in the collecting duct, and so sodium reabsorption, potassium secretion and hydrogen secretion.', route: '/renal/raas/', cite: { rose: [6], evidence: 'physiology' } },
  { id: 'adh', label: 'ADH', kind: 'hormone', scale: 'body', aliases: ['vasopressin', 'AVP', 'antidiuretic hormone', 'copeptin'], summary: 'Inserts aquaporin-2 into the collecting duct, raises urea permeability and stimulates NKCC2. Released by rising osmolality and, more steeply, by falling effective arterial volume.', route: '/renal/adh/', cite: { rose: [6, 9], evidence: 'physiology', refs: ['robertson1976'] } },
  { id: 'pth', label: 'Parathyroid hormone', kind: 'hormone', scale: 'body', aliases: ['PTH'], summary: 'Raises distal calcium reabsorption, lowers proximal phosphate reabsorption and stimulates calcitriol synthesis.', route: '/renal/minerals/', cite: { rose: [3, 6], evidence: 'physiology' } },
  { id: 'fgf23', label: 'FGF23', kind: 'hormone', scale: 'body', summary: 'Bone-derived phosphaturic hormone: removes NaPi-II carriers and suppresses calcitriol. Rises early in chronic kidney disease, before phosphate does.', route: '/renal/minerals/', cite: { evidence: 'clinical', refs: ['shimada2004', 'isakova2011'], update: 'Not in the 2001 textbook: FGF23 was identified in 2000–2001 and is now central to how phosphate balance is understood in CKD.' } },
  { id: 'calcitriol', label: 'Calcitriol', kind: 'hormone', scale: 'body', aliases: ['1,25-dihydroxyvitamin D'], summary: 'The active vitamin D metabolite, made in the proximal tubule. Raises intestinal calcium absorption and distal calcium reabsorption.', route: '/renal/minerals/', cite: { rose: [6], evidence: 'physiology' } },
  { id: 'anp', label: 'Natriuretic peptides', kind: 'hormone', scale: 'body', aliases: ['ANP', 'BNP'], summary: 'Released when the atria are stretched. Promote sodium excretion and inhibit renin and aldosterone — a brake on volume retention.', route: '/renal/sodium/', cite: { rose: [6, 16], evidence: 'physiology' } },
  { id: 'prostaglandins', label: 'Renal prostaglandins', kind: 'hormone', scale: 'kidney', aliases: ['PGE2', 'prostacyclin', 'COX-2'], summary: 'Locally released vasodilators whose production rises with angiotensin II and noradrenaline. They stop vasoconstriction going too far.', route: '/renal/arterioles/', cite: { rose: [2], evidence: 'physiology', refs: ['whelton1999'] } },
  { id: 'sns', label: 'Sympathetic tone', kind: 'hormone', scale: 'body', aliases: ['noradrenaline', 'catecholamines'], summary: 'Constricts the afferent arteriole directly, stimulates renin through β₁ receptors, and raises proximal sodium reabsorption.', route: '/renal/raas/', cite: { rose: [2, 8], evidence: 'physiology' } },
  { id: 'insulin', label: 'Insulin', kind: 'hormone', scale: 'body', summary: 'Drives potassium into cells, independently of its effect on glucose. The basis of treating hyperkalaemia with insulin and dextrose.', route: '/renal/potassium/', cite: { rose: [12], evidence: 'clinical', refs: ['defronzo1980', 'allon1989'] } },

  // ---------------------------------------------------------------- whole kidney
  { id: 'gfr', label: 'GFR', kind: 'organ', scale: 'kidney', aliases: ['glomerular filtration rate', 'filtration'], summary: 'The volume filtered per minute: the product of the filtration coefficient and the mean net filtration pressure. Normally 95±20 mL/min in women, 120±25 in men.', route: '/renal/gfr/', cite: { rose: [2], evidence: 'physiology' } },
  { id: 'rbf', label: 'Renal blood flow', kind: 'organ', scale: 'kidney', aliases: ['renal plasma flow', 'RPF', 'RBF'], summary: 'About 20% of cardiac output, or 1.1 L/min. Because filtration reaches equilibrium, plasma flow is itself a determinant of GFR.', route: '/renal/gfr/', cite: { rose: [2], evidence: 'physiology' } },
  { id: 'ff', label: 'Filtration fraction', kind: 'organ', scale: 'kidney', aliases: ['FF'], summary: 'GFR divided by renal plasma flow, normally about 0.20. Changes in efferent tone move it; it sets the peritubular capillary oncotic pressure.', route: '/renal/gfr/', cite: { rose: [2, 3], evidence: 'physiology' } },
  { id: 'pgc', label: 'Glomerular capillary pressure', kind: 'force', scale: 'kidney', aliases: ['Pgc', 'intraglomerular pressure'], summary: 'About 45 mmHg, set by systemic pressure and the two arteriolar resistances. Chronically raised, it damages glomeruli.', route: '/renal/arterioles/', cite: { rose: [2], evidence: 'physiology' } },
  { id: 'autoregulation', label: 'Autoregulation', kind: 'concept', scale: 'kidney', aliases: ['myogenic response'], summary: 'GFR and renal blood flow are held nearly constant between mean pressures of about 80 and 180 mmHg by the myogenic response, tubuloglomerular feedback and angiotensin II.', route: '/renal/autoregulation/', cite: { rose: [2], evidence: 'physiology' } },
  { id: 'distalDelivery', label: 'Distal sodium delivery', kind: 'concept', scale: 'nephron', aliases: ['distal flow'], summary: 'How much sodium and fluid reach the aldosterone-sensitive distal nephron. The hinge between proximal events and potassium and acid excretion.', route: '/renal/potassium/', cite: { rose: [12], evidence: 'physiology' } },
  { id: 'concentratingAbility', label: 'Urinary concentrating ability', kind: 'organ', scale: 'kidney', aliases: ['maximum urine osmolality'], summary: 'The highest urine osmolality attainable, set by the medullary gradient and collecting duct water permeability. Normally ~1200 mOsm/kg.', route: '/renal/urine-osmolality/', cite: { rose: [4], evidence: 'physiology' } },
  { id: 'nae', label: 'Net acid excretion', kind: 'organ', scale: 'kidney', aliases: ['NAE', 'titratable acid', 'ammonium excretion'], summary: 'Titratable acid plus ammonium minus bicarbonate. Must match endogenous acid production (50–100 mEq/day) for acid-base balance.', route: '/renal/acid-base/', cite: { rose: [11, 17], evidence: 'physiology' } },
  { id: 'ammoniagenesis', label: 'Ammoniagenesis', kind: 'organ', scale: 'kidney', aliases: ['glutamine metabolism', 'NH4 production'], summary: 'Proximal glutamine metabolism generating NH₄⁺ and new bicarbonate. The component of acid excretion that adapts most in chronic acidosis.', route: '/renal/ammonium/', cite: { rose: [11], evidence: 'physiology', refs: ['weiner2017'] } },

  // ---------------------------------------------------------------- whole body
  { id: 'eabv', label: 'Effective arterial blood volume', kind: 'wholeBody', scale: 'body', aliases: ['EABV', 'effective circulating volume', 'tissue perfusion'], summary: 'The pressure actually perfusing the arterial baroreceptors. Not the same as total extracellular volume — an oedematous cirrhotic can have a huge extracellular volume and a low effective arterial volume.', route: '/renal/sodium/', cite: { rose: [8, 16], evidence: 'physiology', refs: ['schrier1990'] } },
  { id: 'totalBodyNa', label: 'Total body sodium', kind: 'wholeBody', scale: 'body', summary: 'Sets the extracellular volume. Say it slowly: total body sodium determines volume, not the serum sodium concentration.', route: '/renal/sodium/', cite: { rose: [7], evidence: 'physiology' } },
  { id: 'serumNa', label: 'Serum sodium concentration', kind: 'lab', scale: 'clinical', aliases: ['plasma sodium', 'hyponatraemia', 'hypernatraemia'], summary: 'A ratio, not an amount: exchangeable sodium plus potassium divided by total body water. It is a water problem far more often than a sodium problem.', route: '/renal/hyponatremia/', cite: { rose: [7], evidence: 'physiology', refs: ['edelman1958', 'rose1986'] } },
  { id: 'ecfVolume', label: 'Extracellular volume', kind: 'wholeBody', scale: 'body', aliases: ['ECF', 'oedema'], summary: 'Roughly a third of total body water. Expanded by sodium retention; whether the excess sits in the plasma or the interstitium depends on capillary Starling forces.', route: '/renal/sodium/', cite: { rose: [16], evidence: 'physiology' } },
  { id: 'plasmaK', label: 'Plasma potassium', kind: 'lab', scale: 'clinical', aliases: ['hyperkalaemia', 'hypokalaemia', 'serum potassium'], summary: 'Only 2% of body potassium is extracellular, so the plasma level reflects both external balance and the internal shift between cells and plasma.', route: '/renal/potassium/', cite: { rose: [12], evidence: 'physiology', refs: ['mcdonough2017'] } },
  { id: 'plasmaHCO3', label: 'Plasma bicarbonate', kind: 'lab', scale: 'clinical', aliases: ['serum bicarbonate', 'metabolic acidosis', 'metabolic alkalosis'], summary: 'The metabolic side of acid-base balance. Falls when acid is added or alkali lost; rises when acid is lost or alkali retained.', route: '/renal/acid-base/', cite: { rose: [17], evidence: 'physiology' } },
  { id: 'osmolality', label: 'Plasma osmolality', kind: 'lab', scale: 'clinical', aliases: ['tonicity', 'effective osmolality'], summary: 'Total osmolality includes urea; effective osmolality (tonicity) does not, because urea crosses cell membranes freely.', route: '/renal/water/', cite: { rose: [1, 7], evidence: 'physiology' } },
  { id: 'scr', label: 'Serum creatinine', kind: 'lab', scale: 'clinical', aliases: ['Scr', 'creatinine'], summary: 'Varies inversely with GFR in the steady state, but takes days to reach a new one — and is shifted by muscle mass, diet and tubular secretion.', route: '/renal/creatinine/', cite: { rose: [2], evidence: 'physiology' } },

  // ---------------------------------------------------------------- drugs
  { id: 'loopDiuretic', label: 'Loop diuretic', kind: 'drug', scale: 'clinical', aliases: ['furosemide', 'bumetanide', 'torsemide', 'frusemide'], summary: 'Blocks NKCC2 in the thick ascending limb; can excrete up to a quarter of the filtered sodium.', route: '/renal/diuretics/', cite: { rose: [15], evidence: 'clinical', refs: ['brater1998'] } },
  { id: 'thiazide', label: 'Thiazide', kind: 'drug', scale: 'clinical', aliases: ['hydrochlorothiazide', 'chlorthalidone', 'metolazone', 'indapamide'], summary: 'Blocks NCC in the distal convoluted tubule. Less potent than a loop diuretic, but spares the medullary gradient — hence the hyponatraemia.', route: '/renal/diuretics/', cite: { rose: [15], evidence: 'clinical' } },
  { id: 'acei', label: 'ACE inhibitor', kind: 'drug', scale: 'clinical', aliases: ['ACEi', 'ramipril', 'lisinopril', 'captopril', 'enalapril'], summary: 'Reduces angiotensin II, which dilates the efferent arteriole and lowers glomerular pressure — protective long-term, but it lowers GFR acutely.', route: '/renal/raas/', cite: { rose: [2], evidence: 'clinical', refs: ['bakris2000', 'lewis1993'] } },
  { id: 'arb', label: 'ARB', kind: 'drug', scale: 'clinical', aliases: ['losartan', 'valsartan', 'irbesartan', 'angiotensin receptor blocker'], summary: 'Blocks the AT1 receptor. Renal effects mirror an ACE inhibitor.', route: '/renal/raas/', cite: { evidence: 'clinical', refs: ['brenner2001', 'lewis2001'] } },
  { id: 'mra', label: 'MR antagonist', kind: 'drug', scale: 'clinical', aliases: ['spironolactone', 'eplerenone', 'finerenone', 'aldosterone antagonist'], summary: 'Competes with aldosterone at the mineralocorticoid receptor: mild natriuresis, potassium retention, reduced acid excretion.', route: '/renal/diuretics/', cite: { rose: [15], evidence: 'clinical', refs: ['pitt1999'] } },
  { id: 'nsaid', label: 'NSAID', kind: 'drug', scale: 'clinical', aliases: ['ibuprofen', 'indomethacin', 'diclofenac', 'cyclo-oxygenase inhibitor'], summary: 'Blocks renal prostaglandin synthesis. Harmless when volume is normal; precipitates acute kidney injury when angiotensin II and noradrenaline are high.', route: '/renal/arterioles/', cite: { rose: [2], evidence: 'clinical', refs: ['whelton1999', 'lapi2013'] } },
  { id: 'sglt2i', label: 'SGLT2 inhibitor', kind: 'drug', scale: 'clinical', aliases: ['empagliflozin', 'dapagliflozin', 'canagliflozin', 'gliflozin'], summary: 'Blocks proximal glucose reabsorption: glucosuria, mild natriuresis, and restoration of tubuloglomerular feedback that reduces hyperfiltration.', route: '/renal/glucose/', cite: { evidence: 'clinical', refs: ['heerspink2020', 'empakidney2023', 'cherney2014'], update: 'Entirely post-dates the 2001 textbook.' } },
  { id: 'acetazolamide', label: 'Acetazolamide', kind: 'drug', scale: 'clinical', aliases: ['carbonic anhydrase inhibitor'], summary: 'Blocks carbonic anhydrase, causing bicarbonate and sodium loss. Useful when oedema coexists with metabolic alkalosis.', route: '/renal/diuretics/', cite: { rose: [15], evidence: 'clinical' } },
  { id: 'amiloride', label: 'ENaC blocker', kind: 'drug', scale: 'clinical', aliases: ['amiloride', 'triamterene'], summary: 'Closes the sodium channel directly: weak natriuresis, potassium and hydrogen retention.', route: '/renal/diuretics/', cite: { rose: [15], evidence: 'clinical' } },
  { id: 'tolvaptan', label: 'Vasopressin V2 antagonist', kind: 'drug', scale: 'clinical', aliases: ['tolvaptan', 'vaptan'], summary: 'Blocks the V2 receptor, producing a water diuresis without sodium loss. Raises the serum sodium in SIADH.', route: '/renal/water-disorders/', cite: { evidence: 'clinical', refs: ['schrier2006'] } },

  // ---------------------------------------------------------------- diseases
  { id: 'bartter', label: 'Bartter syndrome', kind: 'disease', scale: 'clinical', summary: 'Inherited loss of thick ascending limb transport — a lifelong loop diuretic: salt wasting, hypokalaemic alkalosis, hypercalciuria, poor concentration.', route: '/renal/inherited/', cite: { evidence: 'clinical', refs: ['simon1996bartter', 'konrad2021'] } },
  { id: 'gitelman', label: 'Gitelman syndrome', kind: 'disease', scale: 'clinical', summary: 'Inherited loss of NCC — a lifelong thiazide: hypokalaemic alkalosis, hypomagnesaemia and a low urinary calcium.', route: '/renal/inherited/', cite: { evidence: 'clinical', refs: ['simon1996gitelman', 'blanchard2017'] } },
  { id: 'liddle', label: 'Liddle syndrome', kind: 'disease', scale: 'clinical', summary: 'Constitutively open ENaC: hypertension, hypokalaemia and suppressed renin and aldosterone. Responds to amiloride, not spironolactone.', route: '/renal/inherited/', cite: { evidence: 'clinical', refs: ['shimkets1994'] } },
  { id: 'siadh', label: 'SIADH', kind: 'disease', scale: 'clinical', aliases: ['syndrome of inappropriate antidiuresis'], summary: 'ADH secretion that does not switch off: water is retained, the serum sodium falls, and the urine stays inappropriately concentrated.', route: '/renal/water-disorders/', cite: { rose: [23], evidence: 'clinical', refs: ['decaux2008', 'spasovski2014'] } },
  { id: 'centralDI', label: 'Central diabetes insipidus', kind: 'disease', scale: 'clinical', aliases: ['AVP deficiency', 'arginine vasopressin deficiency'], summary: 'Failure to make ADH: large volumes of dilute urine that concentrate normally when desmopressin is given.', route: '/renal/water-disorders/', cite: { evidence: 'clinical', refs: ['christcrain2019', 'arima2022'], update: 'Now usually called arginine vasopressin deficiency (AVP-D).' } },
  { id: 'nephrogenicDI', label: 'Nephrogenic diabetes insipidus', kind: 'disease', scale: 'clinical', aliases: ['AVP resistance', 'NDI'], summary: 'The collecting duct cannot respond to ADH — V2 receptor or aquaporin-2 defects, or lithium. Desmopressin does not help.', route: '/renal/water-disorders/', cite: { evidence: 'clinical', refs: ['rosenthal1992', 'bockenhauer2015'] } },
  { id: 'dRTA', label: 'Distal (type 1) RTA', kind: 'disease', scale: 'clinical', summary: 'The collecting duct cannot acidify the urine: a normal anion gap acidosis with an inappropriately high urine pH and hypokalaemia.', route: '/renal/rta/', cite: { rose: [19], evidence: 'clinical', refs: ['karet2002', 'batlle2018'] } },
  { id: 'pRTA', label: 'Proximal (type 2) RTA', kind: 'disease', scale: 'clinical', summary: 'Bicarbonate wasting until the plasma level falls far enough for the distal nephron to cope — then the urine can be acidified again.', route: '/renal/rta/', cite: { rose: [19], evidence: 'clinical', refs: ['batlle2018'] } },
  { id: 'type4RTA', label: 'Type 4 RTA', kind: 'disease', scale: 'clinical', aliases: ['hyperkalaemic RTA', 'hypoaldosteronism'], summary: 'Aldosterone deficiency or resistance: hyperkalaemia, and an acidosis driven largely by the hyperkalaemia suppressing ammoniagenesis.', route: '/renal/rta/', cite: { rose: [19], evidence: 'clinical', refs: ['batlle2018', 'karet2002'] } },
  { id: 'ckd', label: 'Chronic kidney disease', kind: 'disease', scale: 'clinical', aliases: ['CKD', 'chronic renal failure'], summary: 'Progressive nephron loss with compensatory single-nephron hyperfiltration that is adaptive at first and damaging later.', route: '/renal/ckd/', cite: { evidence: 'guideline', refs: ['kdigo2024ckd', 'webster2017'] } },
  { id: 'aki', label: 'Acute kidney injury', kind: 'disease', scale: 'clinical', aliases: ['AKI', 'acute renal failure', 'ATN', 'acute tubular necrosis'], summary: 'An abrupt fall in filtration from altered perfusion, tubular injury or obstruction — often more than one at once.', route: '/renal/aki/', cite: { evidence: 'guideline', refs: ['kellum2013aki', 'kellum2021'] } },
  { id: 'prerenal', label: 'Pre-renal physiology', kind: 'disease', scale: 'clinical', aliases: ['prerenal azotaemia'], summary: 'Filtration limited by perfusion while the tubules work perfectly — so sodium is reabsorbed avidly and the urine is concentrated.', route: '/renal/prerenal-atn/', cite: { rose: [3], evidence: 'clinical', refs: ['abuelo2007'] } },
  { id: 'obstruction', label: 'Urinary obstruction', kind: 'disease', scale: 'clinical', aliases: ['post-renal', 'hydronephrosis'], summary: 'Raised pressure downstream is transmitted to Bowman’s space, which opposes filtration directly.', route: '/renal/obstruction/', cite: { evidence: 'experimental', refs: ['klahr2002'] } },
  { id: 'nephrotic', label: 'Nephrotic syndrome', kind: 'disease', scale: 'clinical', summary: 'Heavy proteinuria, hypoalbuminaemia and oedema, from a filtration barrier that has lost its size or charge selectivity.', route: '/renal/glomerular/', cite: { rose: [16], evidence: 'clinical', refs: ['kdigo2021gd'] } },
  { id: 'heartFailure', label: 'Heart failure', kind: 'disease', scale: 'clinical', summary: 'Reduced cardiac output lowers effective arterial volume, so the kidney retains sodium and water even as the total extracellular volume rises.', route: '/renal/sodium/', cite: { rose: [16], evidence: 'clinical', refs: ['mullens2019'] } },
  { id: 'cirrhosis', label: 'Cirrhosis', kind: 'disease', scale: 'clinical', summary: 'Splanchnic vasodilation lowers effective arterial volume despite a high cardiac output, and portal hypertension sends the retained fluid into the peritoneum.', route: '/renal/sodium/', cite: { rose: [16], evidence: 'clinical', refs: ['schrier1988', 'gines2009'] } },
];

export const EDGES: GraphEdge[] = [
  // --- the volume chain, which the platform uses as its worked example
  { from: 'eabv', to: 'rbf', sign: 1, mechanism: 'sets the pressure perfusing the kidney', evidence: 'physiology', cite: { rose: [8, 16] } },
  { from: 'rbf', to: 'gfr', sign: 1, mechanism: 'supplies the plasma that is filtered; because filtration reaches equilibrium, flow itself limits GFR', evidence: 'physiology', cite: { rose: [2] } },
  { from: 'eabv', to: 'renin', sign: -1, mechanism: 'reduced afferent arteriolar stretch and increased sympathetic tone release renin', evidence: 'physiology', cite: { rose: [2] } },
  { from: 'renin', to: 'angII', sign: 1, mechanism: 'cleaves angiotensinogen to angiotensin I, which ACE converts to angiotensin II', evidence: 'physiology', cite: { rose: [2] } },
  { from: 'angII', to: 'aldosterone', sign: 1, mechanism: 'stimulates aldosterone synthesis in the adrenal zona glomerulosa', evidence: 'physiology', cite: { rose: [2, 6] } },
  { from: 'angII', to: 'nhe3', sign: 1, mechanism: 'activates proximal Na⁺/H⁺ exchange, accounting for up to 40–50% of reabsorption in the S1 segment', evidence: 'experimental', cite: { rose: [2, 3] } },
  { from: 'nhe3', to: 'totalBodyNa', sign: 1, mechanism: 'reabsorbs sodium in the proximal tubule', evidence: 'physiology' },
  { from: 'aldosterone', to: 'enac', sign: 1, mechanism: 'increases the number and open probability of sodium channels', evidence: 'physiology', cite: { refs: ['pearce2015'] } },
  { from: 'enac', to: 'lumenNegative', sign: 1, mechanism: 'moves cationic sodium without an anion, leaving the lumen electrically negative', evidence: 'physiology' },
  { from: 'enac', to: 'totalBodyNa', sign: 1, mechanism: 'reabsorbs the last few percent of filtered sodium', evidence: 'physiology' },
  { from: 'lumenNegative', to: 'romk', sign: 1, mechanism: 'steepens the electrical gradient favouring potassium secretion', evidence: 'physiology' },
  { from: 'lumenNegative', to: 'hatpase', sign: 1, mechanism: 'reduces back-diffusion of secreted protons, so more acid stays in the lumen', evidence: 'physiology', cite: { rose: [18] } },
  { from: 'totalBodyNa', to: 'ecfVolume', sign: 1, mechanism: 'sodium is the osmotic skeleton of the extracellular fluid, so retaining it expands that volume', evidence: 'physiology', cite: { rose: [7] } },
  { from: 'ecfVolume', to: 'eabv', sign: 1, mechanism: 'restores venous return and cardiac output — the loop closes', evidence: 'physiology', cite: { rose: [16] } },
  { from: 'adh', to: 'aqp2', sign: 1, mechanism: 'V2 receptor signalling inserts pre-formed water channels into the apical membrane', evidence: 'physiology', cite: { refs: ['knepper2015'] } },

  // --- the ADH / water chain
  { from: 'osmolality', to: 'adh', sign: 1, mechanism: 'osmoreceptors raise ADH secretion steeply above a threshold of about 280–285 mOsm/kg', evidence: 'physiology', cite: { refs: ['robertson1976'] } },
  { from: 'eabv', to: 'adh', sign: -1, mechanism: 'baroreceptor unloading raises ADH and lowers the osmotic threshold: volume beats tonicity', evidence: 'physiology', cite: { rose: [9] } },
  { from: 'aqp2', to: 'concentratingAbility', sign: 1, mechanism: 'lets water leave the collecting duct towards the medullary interstitium', evidence: 'physiology' },
  { from: 'medullaryGradient', to: 'concentratingAbility', sign: 1, mechanism: 'sets the osmolality that the tubular fluid can equilibrate up to', evidence: 'physiology', cite: { rose: [4] } },
  { from: 'concentratingAbility', to: 'serumNa', sign: 1, mechanism: 'retaining water without solute lowers the serum sodium by dilution', evidence: 'physiology', cite: { rose: [7] } },
  { from: 'nkcc2', to: 'medullaryGradient', sign: 1, mechanism: 'pumps NaCl into the medullary interstitium from a water-impermeable segment — countercurrent multiplication', evidence: 'physiology', cite: { rose: [4] } },
  { from: 'utA', to: 'medullaryGradient', sign: 1, mechanism: 'traps reabsorbed urea in the inner medulla, contributing about half the gradient', evidence: 'experimental', cite: { refs: ['fenton2004'] } },
  { from: 'adh', to: 'utA', sign: 1, mechanism: 'raises inner medullary urea permeability', evidence: 'experimental', cite: { refs: ['klein2011'] } },
  { from: 'nkcc2', to: 'lumenPositive', sign: 1, mechanism: 'potassium recycling through ROMK leaves the lumen positive', evidence: 'physiology' },
  { from: 'lumenPositive', to: 'claudin16', sign: 1, mechanism: 'drives calcium and magnesium through the paracellular pathway', evidence: 'physiology', cite: { refs: ['hou2013'] } },

  // --- tubuloglomerular feedback
  { from: 'gfr', to: 'distalDelivery', sign: 1, mechanism: 'a larger filtered load delivers more sodium downstream', evidence: 'physiology' },
  { from: 'distalDelivery', to: 'maculaDensa', sign: 1, mechanism: 'more chloride arrives at the sensing cells', evidence: 'physiology', cite: { rose: [2] } },
  { from: 'maculaDensa', to: 'gfr', sign: -1, mechanism: 'greater NaCl uptake constricts the afferent arteriole (probably through adenosine), lowering filtration', evidence: 'physiology', cite: { rose: [2], refs: ['carlstrom2015'] } },
  { from: 'maculaDensa', to: 'renin', sign: -1, mechanism: 'greater NaCl uptake suppresses renin release from the adjacent juxtaglomerular cells', evidence: 'physiology', cite: { rose: [2] } },
  { from: 'nkcc2', to: 'maculaDensa', sign: 1, mechanism: 'the sensing step itself is NKCC2-mediated uptake, so blocking the carrier silences the signal', evidence: 'physiology', cite: { rose: [2] } },
  { from: 'angII', to: 'pgc', sign: 1, mechanism: 'constricts the efferent arteriole up to three times more than the afferent, raising glomerular pressure', evidence: 'physiology', cite: { rose: [2] } },
  { from: 'angII', to: 'ff', sign: 1, mechanism: 'raises filtration while lowering plasma flow', evidence: 'physiology', cite: { rose: [2, 3] } },
  { from: 'ff', to: 'nhe3', sign: 1, mechanism: 'concentrates protein in the peritubular capillary, whose oncotic pressure favours proximal reabsorption', evidence: 'experimental', cite: { rose: [3] } },
  { from: 'pgc', to: 'gfr', sign: 1, mechanism: 'is the pressure that drives filtration', evidence: 'physiology' },
  { from: 'prostaglandins', to: 'rbf', sign: 1, mechanism: 'locally dilate the arterioles, limiting how far vasoconstrictors can go', evidence: 'physiology', cite: { rose: [2] } },
  { from: 'angII', to: 'prostaglandins', sign: 1, mechanism: 'stimulates glomerular prostaglandin synthesis — a built-in brake on its own vasoconstriction', evidence: 'physiology', cite: { rose: [2] } },
  { from: 'sns', to: 'renin', sign: 1, mechanism: 'β₁-adrenergic stimulation of the juxtaglomerular cells', evidence: 'physiology', cite: { rose: [2] } },
  { from: 'autoregulation', to: 'gfr', sign: 0, mechanism: 'holds filtration nearly constant as perfusion pressure varies, through the myogenic response and tubuloglomerular feedback', evidence: 'physiology', cite: { rose: [2] } },

  // --- potassium
  { from: 'nkcc2', to: 'distalDelivery', sign: -1, mechanism: 'NaCl not reabsorbed in the thick ascending limb is delivered to the distal nephron', evidence: 'physiology', cite: { rose: [15] } },
  { from: 'ncc', to: 'distalDelivery', sign: -1, mechanism: 'NaCl not taken up in the distal convoluted tubule reaches the connecting tubule and collecting duct', evidence: 'physiology', cite: { rose: [15] } },
  { from: 'distalDelivery', to: 'enac', sign: 1, mechanism: 'more sodium reaching the principal cells means more sodium entering through ENaC', evidence: 'physiology', cite: { rose: [12] } },
  { from: 'distalDelivery', to: 'plasmaK', sign: -1, mechanism: 'more sodium delivered distally means more ENaC-mediated uptake, a more negative lumen and more potassium secreted', evidence: 'physiology', cite: { rose: [12] } },
  { from: 'aldosterone', to: 'plasmaK', sign: -1, mechanism: 'increases distal potassium secretion', evidence: 'physiology', cite: { rose: [12] } },
  { from: 'romk', to: 'plasmaK', sign: -1, mechanism: 'the apical exit route for secreted potassium', evidence: 'physiology' },
  { from: 'bk', to: 'plasmaK', sign: -1, mechanism: 'adds flow-dependent potassium secretion', evidence: 'experimental' },
  { from: 'insulin', to: 'plasmaK', sign: -1, mechanism: 'stimulates the Na⁺-K⁺-ATPase of muscle and liver, shifting potassium into cells', evidence: 'clinical', cite: { refs: ['defronzo1980'] } },
  { from: 'plasmaHCO3', to: 'plasmaK', sign: -1, mechanism: 'mineral acidosis shifts potassium out of cells as hydrogen ions move in; organic acidoses do so much less', evidence: 'physiology', cite: { rose: [17] } },
  { from: 'plasmaK', to: 'aldosterone', sign: 1, mechanism: 'a rise in plasma potassium stimulates aldosterone secretion directly', evidence: 'physiology', cite: { rose: [6] } },
  { from: 'plasmaK', to: 'ammoniagenesis', sign: -1, mechanism: 'hyperkalaemia raises renal tubular cell pH and suppresses ammonium production', evidence: 'experimental', cite: { rose: [17], refs: ['weiner2017'] } },
  { from: 'plasmaK', to: 'ncc', sign: -1, mechanism: 'hypokalaemia activates the WNK–SPAK pathway, which turns NCC on', evidence: 'experimental', cite: { refs: ['terker2015'] } },

  // --- acid-base
  { from: 'nhe3', to: 'plasmaHCO3', sign: 1, mechanism: 'secreting H⁺ reclaims filtered bicarbonate in the proximal tubule', evidence: 'physiology', cite: { rose: [11] } },
  { from: 'hatpase', to: 'nae', sign: 1, mechanism: 'secretes the protons that titrate phosphate and trap ammonia', evidence: 'physiology', cite: { rose: [11] } },
  { from: 'ammoniagenesis', to: 'nae', sign: 1, mechanism: 'each ammonium excreted represents one new bicarbonate added to the blood', evidence: 'physiology', cite: { rose: [11] } },
  { from: 'nae', to: 'plasmaHCO3', sign: 1, mechanism: 'excreting acid regenerates the bicarbonate consumed in buffering it', evidence: 'physiology', cite: { rose: [11] } },
  { from: 'plasmaHCO3', to: 'ammoniagenesis', sign: -1, mechanism: 'acidosis stimulates glutamine uptake and ammonium production — the main adaptive response', evidence: 'physiology', cite: { rose: [11], refs: ['curthoys2014'] } },
  { from: 'pendrin', to: 'plasmaHCO3', sign: -1, mechanism: 'secretes bicarbonate in exchange for luminal chloride, which is how excess alkali is excreted', evidence: 'experimental', cite: { rose: [18] } },
  { from: 'ckd', to: 'ammoniagenesis', sign: -1, mechanism: 'fewer nephrons means less capacity to make and excrete ammonium', evidence: 'clinical', cite: { refs: ['raphael2019'] } },

  // --- minerals
  { from: 'pth', to: 'napi2', sign: -1, mechanism: 'removes phosphate carriers from the apical membrane, so phosphate is excreted', evidence: 'physiology', cite: { rose: [3] } },
  { from: 'fgf23', to: 'napi2', sign: -1, mechanism: 'also removes phosphate carriers, and additionally suppresses calcitriol', evidence: 'experimental', cite: { refs: ['shimada2004'] } },
  { from: 'pth', to: 'calcitriol', sign: 1, mechanism: 'stimulates 1α-hydroxylase in the proximal tubule', evidence: 'physiology' },
  { from: 'ckd', to: 'fgf23', sign: 1, mechanism: 'phosphate retention drives FGF23 up early, before the serum phosphate itself rises', evidence: 'clinical', cite: { refs: ['isakova2011'] } },

  // --- drugs
  { from: 'loopDiuretic', to: 'nkcc2', sign: -1, mechanism: 'competes for the chloride site on the carrier', evidence: 'physiology', cite: { rose: [15] } },
  { from: 'thiazide', to: 'ncc', sign: -1, mechanism: 'competes for the chloride site on NCC', evidence: 'physiology', cite: { rose: [15] } },
  { from: 'amiloride', to: 'enac', sign: -1, mechanism: 'blocks the channel pore directly', evidence: 'physiology', cite: { rose: [15] } },
  { from: 'mra', to: 'aldosterone', sign: -1, mechanism: 'competes with aldosterone for its receptor', evidence: 'physiology', cite: { rose: [15] } },
  { from: 'acei', to: 'angII', sign: -1, mechanism: 'blocks conversion of angiotensin I to angiotensin II', evidence: 'physiology' },
  { from: 'arb', to: 'angII', sign: -1, mechanism: 'blocks the AT1 receptor, so angiotensin II cannot act', evidence: 'physiology' },
  { from: 'nsaid', to: 'prostaglandins', sign: -1, mechanism: 'inhibits cyclo-oxygenase', evidence: 'physiology', cite: { refs: ['whelton1999'] } },
  { from: 'sglt2i', to: 'sglt2', sign: -1, mechanism: 'competitively inhibits the carrier', evidence: 'clinical', cite: { refs: ['vallon2017'] } },
  { from: 'sglt2', to: 'distalDelivery', sign: -1, mechanism: 'reabsorbing glucose with sodium proximally reduces what is delivered downstream', evidence: 'physiology' },
  { from: 'acetazolamide', to: 'nhe3', sign: -1, mechanism: 'blocks carbonic anhydrase, so proximal H⁺ secretion and bicarbonate reclamation fall', evidence: 'physiology', cite: { rose: [15] } },
  { from: 'tolvaptan', to: 'aqp2', sign: -1, mechanism: 'blocks the V2 receptor, so water channels are not inserted', evidence: 'clinical', cite: { refs: ['schrier2006'] } },

  // --- diseases as broken physiology
  { from: 'bartter', to: 'nkcc2', sign: -1, mechanism: 'loss-of-function mutations in the carrier or its partners', evidence: 'clinical', cite: { refs: ['simon1996bartter'] } },
  { from: 'gitelman', to: 'ncc', sign: -1, mechanism: 'loss-of-function mutations in SLC12A3', evidence: 'clinical', cite: { refs: ['simon1996gitelman'] } },
  { from: 'liddle', to: 'enac', sign: 1, mechanism: 'mutations prevent channel retrieval, so channels stay open', evidence: 'clinical', cite: { refs: ['shimkets1994'] } },
  { from: 'siadh', to: 'adh', sign: 1, mechanism: 'ADH is secreted without an osmotic or volume stimulus', evidence: 'clinical', cite: { refs: ['decaux2008'] } },
  { from: 'centralDI', to: 'adh', sign: -1, mechanism: 'the hypothalamic–pituitary axis cannot secrete ADH', evidence: 'clinical', cite: { refs: ['christcrain2019'] } },
  { from: 'nephrogenicDI', to: 'aqp2', sign: -1, mechanism: 'V2 receptor or aquaporin-2 defects, or lithium accumulation, prevent the response to ADH', evidence: 'clinical', cite: { refs: ['bockenhauer2015'] } },
  { from: 'dRTA', to: 'hatpase', sign: -1, mechanism: 'the collecting duct proton pump fails, so the urine cannot be acidified', evidence: 'clinical', cite: { refs: ['karet2002'] } },
  { from: 'pRTA', to: 'nhe3', sign: -1, mechanism: 'proximal bicarbonate reclamation fails, whether from the exchanger, carbonic anhydrase or the basolateral exit step', evidence: 'clinical', cite: { refs: ['batlle2018'] } },
  { from: 'type4RTA', to: 'aldosterone', sign: -1, mechanism: 'aldosterone deficiency or resistance', evidence: 'clinical', cite: { refs: ['batlle2018'] } },
  { from: 'ckd', to: 'gfr', sign: -1, mechanism: 'nephron loss reduces total filtration, partly offset by hyperfiltration in those that remain', evidence: 'clinical', cite: { refs: ['brenner1982'] } },
  { from: 'ckd', to: 'pgc', sign: 1, mechanism: 'afferent dilation in surviving nephrons raises their glomerular pressure — adaptive, then damaging', evidence: 'experimental', cite: { refs: ['hostetter1981'] } },
  { from: 'obstruction', to: 'gfr', sign: -1, mechanism: 'raised pressure in Bowman’s space opposes filtration directly', evidence: 'experimental', cite: { refs: ['klahr2002'] } },
  { from: 'prerenal', to: 'eabv', sign: -1, mechanism: 'reduced effective arterial volume is the defining abnormality', evidence: 'clinical' },
  { from: 'aki', to: 'gfr', sign: -1, mechanism: 'perfusion, tubular injury and obstruction each reduce filtration, often together', evidence: 'clinical', cite: { refs: ['kellum2021'] } },
  { from: 'heartFailure', to: 'eabv', sign: -1, mechanism: 'a reduced cardiac output lowers the pressure perfusing the baroreceptors', evidence: 'clinical', cite: { rose: [16] } },
  { from: 'cirrhosis', to: 'eabv', sign: -1, mechanism: 'splanchnic vasodilation lowers systemic vascular resistance and effective arterial volume despite a high cardiac output', evidence: 'clinical', cite: { refs: ['schrier1988'] } },
  { from: 'nephrotic', to: 'ecfVolume', sign: 1, mechanism: 'primary renal sodium retention in the collecting duct, with hypoalbuminaemia contributing in severe cases', evidence: 'clinical', cite: { rose: [16] } },

  // --- labs
  { from: 'gfr', to: 'scr', sign: -1, mechanism: 'excretion falls, so creatinine accumulates until filtration times plasma level again matches production — over days, not instantly', evidence: 'physiology', cite: { rose: [2] } },
  { from: 'serumNa', to: 'osmolality', sign: 1, mechanism: 'sodium and its anions are most of the effective osmolality of plasma', evidence: 'physiology' },
];

const nodeById = new Map(NODES.map((n) => [n.id, n]));
export const getNode = (id: string) => nodeById.get(id);

export const edgesFrom = (id: string) => EDGES.filter((e) => e.from === id);
export const edgesTo = (id: string) => EDGES.filter((e) => e.to === id);

/**
 * Walk the graph downstream from a node, collecting the causal chain. Used by the
 * "what if I change this?" panels to lay out consequences in order.
 */
export interface CascadeStep {
  depth: number;
  node: GraphNode;
  via?: GraphEdge;
  /** the accumulated direction of change relative to the starting perturbation */
  direction: 1 | -1 | 0;
}

export function cascade(startId: string, startDirection: 1 | -1, maxDepth = 4): CascadeStep[] {
  const start = nodeById.get(startId);
  if (!start) return [];
  const out: CascadeStep[] = [{ depth: 0, node: start, direction: startDirection }];
  const seen = new Set([startId]);
  let frontier: CascadeStep[] = [out[0]];
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next: CascadeStep[] = [];
    for (const step of frontier) {
      for (const edge of edgesFrom(step.node.id)) {
        if (seen.has(edge.to)) continue;
        const node = nodeById.get(edge.to);
        if (!node) continue;
        const direction = (edge.sign === 0 ? 0 : step.direction * edge.sign) as 1 | -1 | 0;
        const entry: CascadeStep = { depth, node, via: edge, direction };
        next.push(entry);
        out.push(entry);
        seen.add(edge.to);
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }
  return out;
}

/** Find a causal path between two nodes, for "how does X lead to Y?" */
export function path(fromId: string, toId: string, maxDepth = 6): GraphEdge[] | null {
  const queue: { id: string; via: GraphEdge[] }[] = [{ id: fromId, via: [] }];
  const seen = new Set([fromId]);
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.id === toId) return cur.via;
    if (cur.via.length >= maxDepth) continue;
    for (const edge of edgesFrom(cur.id)) {
      if (seen.has(edge.to)) continue;
      seen.add(edge.to);
      queue.push({ id: edge.to, via: [...cur.via, edge] });
    }
  }
  return null;
}
