// The route registry: every module of the laboratory, where it sits in the navigation, which
// textbook chapters it draws on and what it can be found by. Search, the home page, the tutor and
// the chapter pages all read from here.

export interface RouteDef {
  path: string;
  /** file name in ./pages (without .tsx) */
  page: string;
  title: string;
  group: GroupId;
  blurb: string;
  chapters?: number[];
  keywords?: string[];
  /** knowledge-graph nodes this module explores */
  nodes?: string[];
}

export type GroupId = 'start' | 'nephron' | 'filtration' | 'tubule' | 'water' | 'potassium' | 'acidbase' | 'minerals' | 'drugs' | 'disease' | 'clinical' | 'lab';

export const GROUPS: { id: GroupId; label: string }[] = [
  { id: 'start', label: 'Start here' },
  { id: 'lab', label: 'Laboratory' },
  { id: 'nephron', label: 'The nephron' },
  { id: 'filtration', label: 'Filtration & clearance' },
  { id: 'tubule', label: 'Tubular transport' },
  { id: 'water', label: 'Water, sodium & volume' },
  { id: 'potassium', label: 'Potassium' },
  { id: 'acidbase', label: 'Acid–base' },
  { id: 'minerals', label: 'Calcium, phosphate, magnesium' },
  { id: 'drugs', label: 'Diuretics & drugs' },
  { id: 'disease', label: 'Kidney disease' },
  { id: 'clinical', label: 'Clinical reasoning' },
];

export const ROUTES: RouteDef[] = [
  // ---------------------------------------------------------------- start
  { path: '/', page: 'Home', title: 'Home', group: 'start', blurb: 'What this laboratory is and where to begin.' },
  { path: '/textbook', page: 'Textbook', title: 'Interactive textbook', group: 'start', blurb: 'The book’s thirty chapters, each rebuilt as explanation → diagram → simulation → clinical connection → questions.', keywords: ['chapter', 'Rose', 'Burton Rose', 'book', 'reading'] },
  { path: '/lessons', page: 'Lessons', title: 'Guided lessons', group: 'start', blurb: 'Step-by-step paths that unlock one experiment at a time.', keywords: ['learning mode', 'tutorial', 'course'] },
  { path: '/challenges', page: 'Challenges', title: 'Predict-then-observe challenges', group: 'start', blurb: 'Commit to a prediction, then run the physiology and see whether you were right.', keywords: ['quiz', 'questions', 'test', 'practice'] },
  { path: '/tutor', page: 'Tutor', title: 'AI tutor', group: 'start', blurb: 'Ask a mechanistic question; answers come from the verified knowledge base with sources, and can open the relevant simulator.', keywords: ['ask', 'question', 'AI', 'chat', 'Claude'] },
  { path: '/search', page: 'Search', title: 'Search', group: 'start', blurb: 'Search anatomy, transporters, hormones, diseases, drugs, equations and findings.' },

  // ---------------------------------------------------------------- laboratory
  { path: '/sandbox', page: 'Sandbox', title: 'Physiology sandbox', group: 'lab', blurb: 'The whole virtual kidney and body: change anything and run the patient forward to a new steady state.', keywords: ['virtual kidney', 'simulator', 'advanced', 'quantitative'], chapters: [1, 8, 9, 11, 12] },
  { path: '/break', page: 'BreakKidney', title: 'Break the kidney', group: 'lab', blurb: 'Switch off one component — a transporter, a hormone, nephrons — and watch the whole system respond.', keywords: ['knockout', 'disable', 'experiment', 'what if'] },
  { path: '/whatif', page: 'WhatIf', title: 'What if…?', group: 'lab', blurb: 'Pick a perturbation and see the downstream cascade, from the causal graph and from the simulation side by side.', keywords: ['what if', 'cascade', 'consequence'] },
  { path: '/graph', page: 'Graph', title: 'Knowledge graph', group: 'lab', blurb: 'Every mechanism as a clickable causal network, from molecule to treatment.', keywords: ['concept map', 'network', 'causal chain', 'multi-scale'] },
  { path: '/equations', page: 'Equations', title: 'Equation explorer', group: 'lab', blurb: 'Every important renal equation, live: change one term and watch the result.', chapters: [30], keywords: ['formula', 'calculator', 'anion gap', 'Henderson-Hasselbalch', 'free water clearance', 'osmolar clearance'] },
  { path: '/labs', page: 'LabExplorer', title: 'Laboratory interpreter', group: 'lab', blurb: 'Enter serum and urine chemistries; get every derived index and the physiology behind it.', chapters: [13, 17], keywords: ['lab values', 'interpretation', 'urine chemistry', 'calculator'] },

  // ---------------------------------------------------------------- nephron
  { path: '/nephron', page: 'NephronExplorer', title: 'Nephron explorer', group: 'nephron', blurb: 'Click any segment or vessel for its transporters, permeabilities, hormones, drugs and diseases.', chapters: [1, 3, 4, 5], keywords: ['anatomy', 'segments', 'glomerulus', 'juxtaglomerular apparatus'] },
  { path: '/flow', page: 'FlowSimulator', title: 'Nephron flow simulator', group: 'nephron', blurb: 'Follow filtered particles through the nephron and see where each solute goes.', chapters: [1], keywords: ['particles', 'follow sodium', 'where does sodium go', 'fractional reabsorption'] },
  { path: '/transport', page: 'TransportLab', title: 'Tubular transport laboratory', group: 'nephron', blurb: 'Every segment’s apical and basolateral machinery; switch a transporter off and follow the consequences downstream.', chapters: [1, 3, 4, 5], keywords: ['transporter', 'channel', 'cotransporter', 'driving force', 'secondary active'], nodes: ['nakatpase', 'sodiumGradient'] },
  { path: '/hormones', page: 'Hormones', title: 'Hormones and the kidney', group: 'nephron', blurb: 'Where each hormone acts along the nephron, and what it changes.', chapters: [6], keywords: ['aldosterone', 'ADH', 'PTH', 'ANP', 'angiotensin', 'catecholamines', 'dopamine', 'prostaglandins'] },

  // ---------------------------------------------------------------- filtration
  { path: '/gfr', page: 'Gfr', title: 'Glomerular filtration', group: 'filtration', blurb: 'Starling forces along the glomerular capillary, filtration equilibrium and every determinant of GFR.', chapters: [2], nodes: ['gfr', 'starling', 'rbf', 'ff'], keywords: ['Starling', 'Kf', 'filtration coefficient', 'oncotic pressure', 'Bowman'] },
  { path: '/arterioles', page: 'Arterioles', title: 'Afferent / efferent lab', group: 'filtration', blurb: 'Constrict or dilate either arteriole; add NSAIDs, ACE inhibitors or volume depletion.', chapters: [2], nodes: ['pgc', 'angII', 'prostaglandins', 'nsaid', 'acei'], keywords: ['efferent constriction', 'ACE inhibitor creatinine', 'NSAID', 'glomerular pressure'] },
  { path: '/autoregulation', page: 'Autoregulation', title: 'Autoregulation', group: 'filtration', blurb: 'Myogenic response and tubuloglomerular feedback holding GFR steady as pressure changes — and how they fail.', chapters: [2], nodes: ['autoregulation', 'maculaDensa'], keywords: ['myogenic', 'TGF', 'tubuloglomerular feedback', 'macula densa'] },
  { path: '/raas', page: 'Raas', title: 'Renin–angiotensin–aldosterone', group: 'filtration', blurb: 'The complete cascade from renin release to sodium, potassium and acid handling, with every blocking drug.', chapters: [2, 6, 8], nodes: ['renin', 'angII', 'aldosterone'], keywords: ['renin', 'angiotensin', 'aldosterone', 'ACE', 'ARB', 'aliskiren'] },
  { path: '/clearance', page: 'Clearance', title: 'Clearance laboratory', group: 'filtration', blurb: 'Clearance = excretion ÷ plasma concentration: inulin, creatinine, PAH, urea, sodium and water.', chapters: [2, 30], keywords: ['inulin', 'PAH', 'creatinine clearance', 'renal plasma flow'] },
  { path: '/fractional-excretion', page: 'FractionalExcretion', title: 'Fractional excretion', group: 'filtration', blurb: 'Filtered, reabsorbed, secreted and excreted — and why FENa is not a diagnostic rule.', chapters: [13, 14], keywords: ['FENa', 'FEUrea', 'fractional excretion'] },
  { path: '/creatinine', page: 'Creatinine', title: 'GFR & creatinine kinetics', group: 'filtration', blurb: 'Why serum creatinine lags behind GFR, and what else moves it.', chapters: [2], nodes: ['scr'], keywords: ['creatinine', 'eGFR', 'steady state', 'muscle mass', 'cystatin'] },

  // ---------------------------------------------------------------- tubule
  { path: '/proximal', page: 'Proximal', title: 'Proximal tubule', group: 'tubule', blurb: 'Isosmotic reabsorption, the chloride gradient, bicarbonate, phosphate, urate and glomerulotubular balance.', chapters: [3], nodes: ['pt', 'nhe3'], keywords: ['glomerulotubular balance', 'isosmotic', 'Fanconi'] },
  { path: '/glucose', page: 'Glucose', title: 'Glucose & SGLT2', group: 'tubule', blurb: 'Filtered load, transport maximum and splay, glucosuria, and SGLT2 inhibition.', chapters: [3, 25], nodes: ['sglt2', 'sglt2i'], keywords: ['Tm', 'transport maximum', 'glycosuria', 'threshold', 'empagliflozin'] },
  { path: '/loop', page: 'Loop', title: 'Loop of Henle', group: 'tubule', blurb: 'Descending, thin ascending and thick ascending limbs: the diluting segment and the engine of concentration.', chapters: [4], nodes: ['tal', 'nkcc2', 'lumenPositive'], keywords: ['thick ascending limb', 'NKCC2', 'diluting segment', 'K recycling'] },
  { path: '/countercurrent', page: 'Countercurrent', title: 'Countercurrent multiplication', group: 'tubule', blurb: 'Watch a single effect multiply into a corticomedullary gradient, step by step.', chapters: [4], nodes: ['medullaryGradient'], keywords: ['single effect', 'hairpin', 'medullary gradient'] },
  { path: '/vasa-recta', page: 'VasaRecta', title: 'Vasa recta exchange', group: 'tubule', blurb: 'Countercurrent exchange versus multiplication, and medullary washout.', chapters: [4], keywords: ['washout', 'countercurrent exchange', 'medullary blood flow'] },
  { path: '/urea', page: 'Urea', title: 'Urea recycling', group: 'tubule', blurb: 'From hepatic production to medullary trapping; protein intake and maximal concentration.', chapters: [4], nodes: ['utA'], keywords: ['urea', 'UT-A', 'BUN', 'protein intake'] },
  { path: '/distal', page: 'Distal', title: 'Distal nephron', group: 'tubule', blurb: 'DCT, connecting tubule and collecting duct: principal and intercalated cells.', chapters: [5], nodes: ['dct', 'cd', 'enac'], keywords: ['principal cell', 'intercalated cell', 'ENaC', 'NCC'] },

  // ---------------------------------------------------------------- water, sodium, volume
  { path: '/body-water', page: 'BodyWater', title: 'Body water & serum sodium', group: 'water', blurb: 'Total body sodium is not serum sodium: the Edelman relation, compartments and osmotic shifts.', chapters: [7, 22], nodes: ['serumNa', 'totalBodyNa', 'osmolality'], keywords: ['Edelman', 'total body water', 'osmolality', 'compartments', 'tonicity'] },
  { path: '/sodium', page: 'Sodium', title: 'Sodium & effective volume', group: 'water', blurb: 'Effective arterial blood volume, its sensors and effectors, and pressure natriuresis.', chapters: [8], nodes: ['eabv', 'ecfVolume', 'anp'], keywords: ['EABV', 'volume regulation', 'baroreceptors', 'natriuresis', 'aldosterone escape'] },
  { path: '/adh', page: 'Adh', title: 'ADH & water balance', group: 'water', blurb: 'Osmoreceptors, thirst, vasopressin and aquaporin-2 — drive ADH continuously and watch the urine change.', chapters: [9], nodes: ['adh', 'aqp2'], keywords: ['vasopressin', 'aquaporin', 'thirst', 'osmoreceptor'] },
  { path: '/urine-osmolality', page: 'UrineOsmolality', title: 'Urine osmolality lab', group: 'water', blurb: 'Solute excretion × concentrating ability sets urine volume; free-water and electrolyte-free-water clearance.', chapters: [4, 9, 22], nodes: ['concentratingAbility'], keywords: ['urine volume', 'solute excretion', 'tea and toast', 'beer potomania'] },
  { path: '/free-water', page: 'FreeWater', title: 'Free-water clearance', group: 'water', blurb: 'Split any urine into an isosmotic part and a free-water part, and connect it to SIADH, DI and polydipsia.', chapters: [9, 23, 30], keywords: ['CH2O', 'Cosm', 'electrolyte-free water'] },
  { path: '/hyponatremia', page: 'Hyponatremia', title: 'Hyponatremia simulator', group: 'water', blurb: 'SIADH, hypovolaemia, heart failure, cirrhosis, polydipsia, low solute intake, adrenal insufficiency and thiazides.', chapters: [23], nodes: ['siadh', 'serumNa'], keywords: ['SIADH', 'hyponatraemia', 'osmotic demyelination', 'correction'] },
  { path: '/water-disorders', page: 'WaterDisorders', title: 'Hypernatremia & polyuria', group: 'water', blurb: 'Central and nephrogenic diabetes insipidus, primary polydipsia and the water deprivation test.', chapters: [24], nodes: ['centralDI', 'nephrogenicDI'], keywords: ['diabetes insipidus', 'hypernatraemia', 'water deprivation test', 'desmopressin', 'polyuria'] },
  { path: '/hyperglycemia', page: 'Hyperglycemia', title: 'Hyperglycemia, DKA & HHS', group: 'water', blurb: 'Osmotic diuresis, translocational hyponatraemia, ketoacidosis and the potassium paradox.', chapters: [25], keywords: ['diabetic ketoacidosis', 'hyperosmolar', 'corrected sodium', 'insulin'] },
  { path: '/hypovolemia', page: 'Hypovolemia', title: 'Hypovolemic states', group: 'water', blurb: 'GI, renal, skin and third-space losses; compensation and fluid replacement.', chapters: [14], keywords: ['dehydration', 'volume depletion', 'shock', 'saline', 'fluid replacement'] },
  { path: '/edema', page: 'Edema', title: 'Edematous states', group: 'water', blurb: 'Heart failure, cirrhosis and nephrotic syndrome: why the kidney retains sodium when the body is already overloaded.', chapters: [16], nodes: ['heartFailure', 'cirrhosis', 'nephrotic'], keywords: ['oedema', 'underfill', 'overfill', 'ascites', 'Starling'] },

  // ---------------------------------------------------------------- potassium
  { path: '/potassium', page: 'Potassium', title: 'Potassium balance', group: 'potassium', blurb: 'Internal distribution versus external balance; the distal secretory machinery.', chapters: [12, 26], nodes: ['plasmaK', 'romk', 'bk', 'lumenNegative', 'distalDelivery'], keywords: ['K', 'ROMK', 'BK', 'insulin', 'aldosterone', 'TTKG'] },
  { path: '/hyperkalemia', page: 'Hyperkalemia', title: 'Hyperkalemia', group: 'potassium', blurb: 'Reduced excretion, impaired aldosterone and shifts out of cells — with the ECG.', chapters: [28], keywords: ['hyperkalaemia', 'ECG', 'peaked T waves', 'calcium gluconate', 'patiromer'] },
  { path: '/hypokalemia', page: 'Hypokalemia', title: 'Hypokalemia', group: 'potassium', blurb: 'GI and renal losses, diuretics and mineralocorticoid excess — with the ECG.', chapters: [27], keywords: ['hypokalaemia', 'U waves', 'loop diuretic hypokalemia', 'magnesium'] },

  // ---------------------------------------------------------------- acid-base
  { path: '/acid-base', page: 'AcidBase', title: 'Acid–base engine', group: 'acidbase', blurb: 'Buffers, Henderson–Hasselbalch, ventilation and the kidney in one live model.', chapters: [10, 17], nodes: ['plasmaHCO3', 'nae'], keywords: ['pH', 'bicarbonate', 'PCO2', 'buffer', 'Henderson-Hasselbalch', 'isohydric'] },
  { path: '/bicarbonate', page: 'Bicarbonate', title: 'Renal bicarbonate handling', group: 'acidbase', blurb: 'Proximal reclamation, carbonic anhydrase and the factors that set the plasma bicarbonate.', chapters: [11], keywords: ['carbonic anhydrase', 'HCO3 reabsorption', 'acetazolamide'] },
  { path: '/ammonium', page: 'Ammonium', title: 'Ammonium excretion', group: 'acidbase', blurb: 'Glutamine to NH₄⁺: proximal production, medullary recycling and collecting-duct trapping.', chapters: [11], nodes: ['ammoniagenesis'], keywords: ['NH4', 'ammonia', 'glutamine', 'diffusion trapping', 'urine anion gap'] },
  { path: '/titratable-acid', page: 'TitratableAcid', title: 'Titratable acid', group: 'acidbase', blurb: 'Phosphate buffering, urine pH and new bicarbonate — compared with ammonium.', chapters: [11], keywords: ['phosphate buffer', 'urine pH', 'net acid excretion'] },
  { path: '/metabolic-acidosis', page: 'MetabolicAcidosis', title: 'Metabolic acidosis', group: 'acidbase', blurb: 'Diarrhoea, RTA, lactic and ketoacidosis, CKD and toxins, with the renal response.', chapters: [19], keywords: ['anion gap', 'delta gap', 'lactic', 'ketoacidosis', 'methanol', 'ethylene glycol', 'osmolal gap'] },
  { path: '/metabolic-alkalosis', page: 'MetabolicAlkalosis', title: 'Metabolic alkalosis', group: 'acidbase', blurb: 'Generation versus maintenance: chloride, volume, potassium and aldosterone.', chapters: [18], keywords: ['vomiting', 'contraction alkalosis', 'chloride responsive', 'urine chloride'] },
  { path: '/rta', page: 'Rta', title: 'Renal tubular acidosis', group: 'acidbase', blurb: 'Types 1, 2 and 4 — predict the laboratory pattern, then reveal it.', chapters: [19], nodes: ['dRTA', 'pRTA', 'type4RTA'], keywords: ['RTA', 'distal RTA', 'proximal RTA', 'type 4'] },
  { path: '/respiratory', page: 'Respiratory', title: 'Respiratory disorders', group: 'acidbase', blurb: 'Respiratory acidosis and alkalosis: acute buffering and chronic renal compensation.', chapters: [20, 21], keywords: ['hypercapnia', 'hypocapnia', 'COPD', 'hyperventilation'] },
  { path: '/mixed', page: 'MixedDisorders', title: 'Simple & mixed disorders', group: 'acidbase', blurb: 'Expected compensation, the delta/delta, and a stepwise approach to any blood gas.', chapters: [17], keywords: ['compensation', 'Winter formula', 'mixed', 'triple disorder', 'ABG'] },

  // ---------------------------------------------------------------- minerals
  { path: '/minerals', page: 'Minerals', title: 'Calcium, phosphate & magnesium', group: 'minerals', blurb: 'PTH, calcitriol and FGF23 across bone, gut and kidney.', chapters: [3, 4, 5, 6], nodes: ['pth', 'fgf23', 'calcitriol', 'napi2', 'claudin16'], keywords: ['calcium', 'phosphate', 'magnesium', 'CKD-MBD', 'hyperparathyroidism'] },

  // ---------------------------------------------------------------- drugs
  { path: '/diuretics', page: 'Diuretics', title: 'Diuretic laboratory', group: 'drugs', blurb: 'Each class from site to adverse effects; combine them and see sequential nephron blockade.', chapters: [15], nodes: ['loopDiuretic', 'thiazide', 'amiloride', 'mra', 'acetazolamide'], keywords: ['furosemide', 'thiazide', 'spironolactone', 'amiloride', 'mannitol', 'metolazone', 'diuretic resistance', 'braking'] },

  // ---------------------------------------------------------------- disease
  { path: '/aki', page: 'Aki', title: 'Acute kidney injury', group: 'disease', blurb: 'Pre-renal, intrinsic and post-renal physiology on one model.', chapters: [2, 13, 14], nodes: ['aki', 'prerenal'], keywords: ['AKI', 'ATN', 'acute renal failure', 'KDIGO', 'oliguria'] },
  { path: '/prerenal-atn', page: 'PrerenalAtn', title: 'Pre-renal vs ATN', group: 'disease', blurb: 'Side-by-side urine indices — and their limitations.', chapters: [13, 14], keywords: ['FENa', 'urine sodium', 'BUN/creatinine', 'acute tubular necrosis'] },
  { path: '/obstruction', page: 'Obstruction', title: 'Urinary obstruction', group: 'disease', blurb: 'Bowman’s space pressure and filtration; acute versus chronic; post-obstructive diuresis.', chapters: [2], nodes: ['obstruction'], keywords: ['hydronephrosis', 'post-renal', 'post-obstructive diuresis'] },
  { path: '/ckd', page: 'Ckd', title: 'Chronic kidney disease', group: 'disease', blurb: 'Nephron loss, hyperfiltration, and the progression of every homeostatic system.', chapters: [2, 19, 28], nodes: ['ckd'], keywords: ['CKD', 'hyperfiltration', 'uremia', 'remnant kidney', 'KDIGO'] },
  { path: '/glomerular', page: 'Glomerular', title: 'Glomerular pathophysiology', group: 'disease', blurb: 'The filtration barrier, proteinuria, nephrotic and nephritic syndromes, and the major glomerular diseases.', chapters: [2, 16], nodes: ['nephrotic'], keywords: ['proteinuria', 'podocyte', 'GBM', 'nephritic', 'IgA', 'membranous', 'FSGS', 'minimal change', 'ANCA', 'anti-GBM', 'lupus'] },
  { path: '/tubulointerstitial', page: 'Tubulointerstitial', title: 'Tubulointerstitial disease', group: 'disease', blurb: 'Interstitial nephritis, analgesic nephropathy and tubular dysfunction.', chapters: [19, 28], keywords: ['AIN', 'interstitial nephritis', 'analgesic nephropathy', 'papillary necrosis'] },
  { path: '/inherited', page: 'Inherited', title: 'Inherited tubular disorders', group: 'disease', blurb: 'Bartter, Gitelman, Liddle, AME, Fanconi, cystinosis and nephrogenic DI as broken physiology.', chapters: [18, 27], nodes: ['bartter', 'gitelman', 'liddle'], keywords: ['Bartter', 'Gitelman', 'Liddle', 'apparent mineralocorticoid excess', 'Fanconi', 'cystinosis'] },

  // ---------------------------------------------------------------- clinical
  { path: '/cases', page: 'Cases', title: 'Clinical cases', group: 'clinical', blurb: 'Patients built from physiology, each opening in a simulator set to their parameters.', keywords: ['case', 'patient', 'vignette'] },
  { path: '/urine-chemistry', page: 'UrineChemistry', title: 'Urine chemistries', group: 'clinical', blurb: 'What urine Na, Cl, K, osmolality and pH mean — and when they mislead.', chapters: [13], keywords: ['urine sodium', 'urine chloride', 'urine osmolality', 'specific gravity', 'urine pH'] },
];

export const routeByPath = new Map(ROUTES.map((r) => [r.path, r]));

/** Which modules draw on a given textbook chapter. */
export const routesForChapter = (n: number) => ROUTES.filter((r) => r.chapters?.includes(n));
