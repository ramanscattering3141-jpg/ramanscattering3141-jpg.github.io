// Nephron anatomy and segment-level transport reference data.
//
// Written from the concepts in Rose ch. 1-5 (segment functions, permeabilities, transporters)
// with molecular detail from the modern reviews in the reference registry. These entries are
// the data behind the nephron explorer panels and the transport laboratory.

import type { Citation } from './sources';
import type { SegmentId, Transporters } from '../engine/types';

export interface TransporterEntry {
  /** key into the engine's transporter map, when the learner can switch it off */
  key?: keyof Transporters;
  name: string;
  membrane: 'apical' | 'basolateral' | 'paracellular';
  kind: 'channel' | 'cotransporter' | 'exchanger' | 'pump' | 'junction' | 'receptor';
  moves: string;
  driving: string;
  note?: string;
  /** drugs or diseases that act here */
  targets?: string[];
  cite?: Citation;
}

export interface SegmentInfo {
  id: SegmentId;
  name: string;
  short: string;
  /** one-line summary shown on hover in the nephron diagram */
  tagline: string;
  /** fraction of the filtered load handled, as prose */
  handles: string[];
  waterPermeability: string;
  luminalComposition: string;
  hormones: string[];
  transporters: TransporterEntry[];
  drivingForce: string;
  clinical: string[];
  diuretics: string[];
  disorders: string[];
  cite: Citation;
}

export const SEGMENT_INFO: Record<SegmentId, SegmentInfo> = {
  PT: {
    id: 'PT',
    name: 'Proximal tubule',
    short: 'PT',
    tagline: 'Reabsorbs the bulk of the filtrate isosmotically, and nearly all glucose, amino acids and bicarbonate',
    handles: [
      '55–65% of filtered sodium and water, isosmotically',
      '~90% of filtered bicarbonate, mostly in the early (S1) segment',
      'Essentially all filtered glucose and amino acids',
      '80–95% of filtered phosphate; 65–90% of citrate',
      '~65% of filtered potassium; 20–30% of magnesium; 60–65% of calcium',
      'Site of ammonium production from glutamine, and of organic anion and cation secretion',
    ],
    waterPermeability: 'High: aquaporin-1 in both the apical and basolateral membranes, so water follows solute and the fluid stays close to plasma osmolality.',
    luminalComposition:
      'Sodium concentration is unchanged along the segment (water follows sodium), but bicarbonate, glucose and amino acids fall steeply while chloride rises to ~120–130 mmol/L. That chloride gradient then drives passive paracellular NaCl reabsorption.',
    hormones: ['Angiotensin II (stimulates Na⁺/H⁺ exchange)', 'Noradrenaline', 'Dopamine (inhibits)', 'PTH (inhibits phosphate transport)', 'FGF23 (inhibits phosphate transport)'],
    drivingForce:
      'Everything here is ultimately powered by the basolateral Na⁺-K⁺-ATPase, which keeps the cell sodium low (~20–30 mmol/L) and the interior electronegative. Filtered solutes then ride that gradient inwards — secondary active transport. About a third of proximal reabsorption is passive and paracellular.',
    transporters: [
      {
        key: 'NaKATPase',
        name: 'Na⁺-K⁺-ATPase',
        membrane: 'basolateral',
        kind: 'pump',
        moves: '3 Na⁺ out, 2 K⁺ in',
        driving: 'ATP hydrolysis',
        note: 'The only major energy-consuming step. Ischaemia can mislocalise it to the apical membrane, which is one reason sodium reabsorption fails in tubular injury.',
        cite: { rose: [1, 3], evidence: 'physiology', refs: ['bonventre2011'] },
      },
      {
        key: 'NHE3',
        name: 'Na⁺/H⁺ exchanger (NHE3)',
        membrane: 'apical',
        kind: 'exchanger',
        moves: 'Na⁺ in, H⁺ out',
        driving: 'Inward sodium gradient',
        note: 'The main determinant of proximal sodium and bicarbonate reabsorption. Secreted H⁺ titrates filtered bicarbonate; it also drives chloride/formate exchange and organic cation secretion.',
        targets: ['Angiotensin II (stimulates)', 'Dopamine (inhibits)'],
        cite: { rose: [3], evidence: 'physiology' },
      },
      {
        key: 'CA',
        name: 'Carbonic anhydrase (II and IV)',
        membrane: 'apical',
        kind: 'receptor',
        moves: 'Catalyses H₂CO₃ ⇄ CO₂ + H₂O',
        driving: 'Enzymatic',
        note: 'Brush-border carbonic anhydrase lets secreted H⁺ be recovered as CO₂, which diffuses into the cell and regenerates bicarbonate.',
        targets: ['Acetazolamide'],
        cite: { rose: [3, 11, 15], evidence: 'physiology' },
      },
      {
        key: 'SGLT2',
        name: 'SGLT2',
        membrane: 'apical',
        kind: 'cotransporter',
        moves: '1 Na⁺ with 1 glucose',
        driving: 'Inward sodium gradient',
        note: 'High capacity, low affinity; handles the bulk of filtered glucose in S1/S2.',
        targets: ['SGLT2 inhibitors', 'Familial renal glucosuria'],
        cite: { rose: [3], evidence: 'physiology', refs: ['vallon2017'] },
      },
      {
        key: 'SGLT1',
        name: 'SGLT1',
        membrane: 'apical',
        kind: 'cotransporter',
        moves: '2 Na⁺ with 1 glucose',
        driving: 'Inward sodium gradient (two ions, so it can work against a steeper gradient)',
        note: 'Low capacity, high affinity, in S3; mops up the glucose that SGLT2 leaves.',
        cite: { rose: [3], evidence: 'physiology', refs: ['vallon2017'] },
      },
      {
        key: 'NaPi2',
        name: 'Na⁺-phosphate cotransporter (NaPi-IIa/IIc)',
        membrane: 'apical',
        kind: 'cotransporter',
        moves: '3 Na⁺ with 1 HPO₄²⁻',
        driving: 'Inward sodium gradient',
        note: 'Retrieved from or inserted into the membrane according to phosphate need. PTH and FGF23 remove it.',
        targets: ['PTH', 'FGF23', 'Metabolic acidosis'],
        cite: { rose: [3], evidence: 'physiology', refs: ['blaine2015', 'shimada2004'] },
      },
      {
        key: 'AAtransport',
        name: 'Na⁺-amino acid cotransporters',
        membrane: 'apical',
        kind: 'cotransporter',
        moves: 'Na⁺ with neutral, acidic or basic amino acids',
        driving: 'Inward sodium gradient',
        note: 'Several carriers with different specificities. The cystine/dibasic carrier is the one lost in cystinuria.',
        targets: ['Cystinuria (SLC3A1/SLC7A9)', 'Fanconi syndrome'],
        cite: { rose: [3], evidence: 'physiology', refs: ['klootwijk2015'] },
      },
      {
        key: 'NBCe1',
        name: 'Na⁺-3HCO₃⁻ cotransporter (NBCe1)',
        membrane: 'basolateral',
        kind: 'cotransporter',
        moves: '1 Na⁺ with 3 HCO₃⁻ out of the cell',
        driving: 'Cell-negative potential carries net negative charge outwards',
        note: 'The exit route for reclaimed bicarbonate. Loss of function causes proximal (type 2) renal tubular acidosis.',
        targets: ['Proximal RTA'],
        cite: { rose: [3, 11], evidence: 'physiology', refs: ['curthoys2014'] },
      },
      {
        name: 'Cl⁻/formate and Cl⁻/oxalate exchange',
        membrane: 'apical',
        kind: 'exchanger',
        moves: 'Cl⁻ in, formate or oxalate out',
        driving: 'Recycling of formic acid across the membrane, powered indirectly by NHE3',
        note: 'Active chloride reabsorption. Inhibiting Na⁺/H⁺ exchange stops it, because the recycling depends on a low cell pH.',
        cite: { rose: [3], evidence: 'experimental' },
      },
      {
        key: 'AQP1',
        name: 'Aquaporin-1',
        membrane: 'apical',
        kind: 'channel',
        moves: 'Water',
        driving: 'Osmotic gradient of ~15 mmHg created by solute removal',
        cite: { rose: [3], evidence: 'physiology', refs: ['nielsen2002'] },
      },
      {
        name: 'Leaky tight junction (claudin-2)',
        membrane: 'paracellular',
        kind: 'junction',
        moves: 'Na⁺, Cl⁻, water, Ca²⁺',
        driving: 'Chloride concentration gradient and solvent drag',
        note: 'A single-strand junction, so this segment is "leaky" — which is exactly what lets it move 90 L a day. The same leakiness limits it to a luminal pH of about 6.8.',
        cite: { rose: [1, 3], evidence: 'physiology', refs: ['hou2013'] },
      },
      {
        key: 'OCT2',
        name: 'Organic cation transport (OCT2, MATE)',
        membrane: 'basolateral',
        kind: 'exchanger',
        moves: 'Creatinine, cimetidine, trimethoprim, metformin',
        driving: 'Cell-negative potential, then H⁺/cation exchange at the apical membrane',
        note: 'This is why creatinine clearance exceeds GFR, and why trimethoprim or cimetidine raise the plasma creatinine without touching GFR.',
        targets: ['Trimethoprim', 'Cimetidine'],
        cite: { rose: [2, 3], evidence: 'clinical', refs: ['delanaye2011'] },
      },
      {
        name: 'Organic anion transport (OAT1/OAT3)',
        membrane: 'basolateral',
        kind: 'exchanger',
        moves: 'Urate, PAH, diuretics, penicillins, NSAIDs, contrast',
        driving: 'Exchange with intracellular α-ketoglutarate',
        note: 'Diuretics are highly protein-bound, so they reach their luminal targets through this pump rather than by filtration. Retained anions in renal failure compete with them.',
        targets: ['Probenecid', 'Uraemic anions'],
        cite: { rose: [3, 15], evidence: 'physiology', refs: ['brater1998'] },
      },
    ],
    clinical: [
      'Volume depletion raises proximal reabsorption, and with it the reabsorption of urea, urate and calcium — which is why hypovolaemia raises the plasma urea and urate together.',
      'Because bicarbonate reabsorption is tied to sodium reabsorption, there is no fixed bicarbonate transport maximum: a volume-depleted, chloride-depleted patient will reclaim bicarbonate avidly and sustain a metabolic alkalosis.',
      'Acetazolamide blocks the first step of bicarbonate reclamation, but the resulting diuresis is modest because the loop of Henle reclaims most of what escapes.',
    ],
    diuretics: ['Acetazolamide (carbonic anhydrase)', 'SGLT2 inhibitors', 'Mannitol (osmotic)'],
    disorders: ['Proximal (type 2) RTA', 'Fanconi syndrome', 'Cystinuria', 'Familial renal glucosuria', 'Cystinosis'],
    cite: { rose: [1, 3], evidence: 'physiology', refs: ['curthoys2014'] },
  },

  DTL: {
    id: 'DTL',
    name: 'Thin descending limb',
    short: 'tDL',
    tagline: 'Water leaves into the hypertonic interstitium; solute largely stays behind',
    handles: ['Water abstraction, which concentrates the tubular fluid towards the local interstitial osmolality'],
    waterPermeability: 'High (aquaporin-1). This is what makes the descending limb the passive arm of the countercurrent multiplier.',
    luminalComposition: 'Osmolality rises towards the interstitial value; sodium and chloride concentrations climb steeply while the volume falls.',
    hormones: [],
    drivingForce: 'The medullary interstitial osmotic gradient built by the thick ascending limb. No active transport happens here.',
    transporters: [
      {
        key: 'AQP1',
        name: 'Aquaporin-1',
        membrane: 'apical',
        kind: 'channel',
        moves: 'Water out of the lumen',
        driving: 'Medullary interstitial hypertonicity',
        cite: { rose: [4], evidence: 'physiology', refs: ['nielsen2002'] },
      },
      {
        name: 'UT-A2 urea transporter',
        membrane: 'apical',
        kind: 'channel',
        moves: 'Urea into the lumen in the inner medulla',
        driving: 'Interstitial urea concentration',
        note: 'Part of urea recycling: urea reabsorbed from the collecting duct re-enters the loop here.',
        cite: { rose: [4], evidence: 'experimental', refs: ['klein2011', 'fenton2004'] },
      },
    ],
    clinical: ['Aquaporin-1 deletion impairs urinary concentration, confirming that this passive water exit is a necessary step.'],
    diuretics: [],
    disorders: [],
    cite: { rose: [4], evidence: 'physiology', refs: ['dantzler2014'] },
  },

  ATL: {
    id: 'ATL',
    name: 'Thin ascending limb',
    short: 'tAL',
    tagline: 'Water-impermeable; NaCl leaves passively down its concentration gradient',
    handles: ['Passive NaCl exit, beginning the separation of solute from water'],
    waterPermeability: 'Very low — no aquaporins. This is the first water-impermeable segment, and it is why solute can be removed without water following.',
    luminalComposition: 'Sodium and chloride fall while osmolality drops; urea entry keeps total osmolality closer to the interstitium than NaCl alone would.',
    hormones: [],
    drivingForce:
      'The steep luminal-to-interstitial NaCl gradient created by water abstraction in the descending limb. Transport here is passive, which is the economy of the countercurrent system.',
    transporters: [
      {
        name: 'Paracellular and transcellular NaCl permeability',
        membrane: 'paracellular',
        kind: 'junction',
        moves: 'Na⁺ and Cl⁻ out of the lumen',
        driving: 'Concentration gradient',
        cite: { rose: [4], evidence: 'experimental', refs: ['kokko1972', 'stephenson1972'] },
      },
    ],
    clinical: ['Only long-looped (juxtamedullary) nephrons have this segment; the ~40% of nephrons with short loops do not.'],
    diuretics: [],
    disorders: [],
    cite: { rose: [1, 4], evidence: 'experimental', refs: ['kokko1972'] },
  },

  TAL: {
    id: 'TAL',
    name: 'Thick ascending limb',
    short: 'TAL',
    tagline: 'The diluting segment: pumps NaCl out of water-impermeable tubule, building the medullary gradient',
    handles: [
      '25–35% of filtered sodium chloride',
      '50–60% of filtered magnesium and a large share of calcium, paracellularly',
      'Some bicarbonate (Na⁺/H⁺ exchange) and ammonium (on NKCC2, feeding medullary recycling)',
    ],
    waterPermeability: 'Essentially zero. Removing salt from a water-impermeable tube is what both dilutes the urine and concentrates the interstitium.',
    luminalComposition: 'Osmolality falls below plasma (to ~100–150 mOsm/kg) — the tubular fluid entering the distal tubule is always hypotonic.',
    hormones: ['ADH (stimulates NKCC2)', 'PTH and calcitonin (raise magnesium reabsorption)', 'Prostaglandin E₂ (inhibits)'],
    drivingForce:
      'NKCC2 brings Na⁺, K⁺ and 2 Cl⁻ in together. The K⁺ recycles back through apical ROMK, which leaves the lumen electrically positive — and that lumen-positive voltage is the force that drives calcium and magnesium between the cells.',
    transporters: [
      {
        key: 'NKCC2',
        name: 'NKCC2 (Na⁺-K⁺-2Cl⁻ cotransporter)',
        membrane: 'apical',
        kind: 'cotransporter',
        moves: '1 Na⁺, 1 K⁺, 2 Cl⁻ in',
        driving: 'Inward sodium gradient; all four sites must be occupied',
        note: 'Chloride is the rate-limiting site within the physiological range, which is why the macula densa reads chloride. Loop diuretics compete for that chloride site.',
        targets: ['Loop diuretics', 'Bartter syndrome type 1'],
        cite: { rose: [4, 15], evidence: 'physiology', refs: ['mount2014', 'simon1996bartter'] },
      },
      {
        key: 'ROMK',
        name: 'ROMK (Kir1.1)',
        membrane: 'apical',
        kind: 'channel',
        moves: 'K⁺ back into the lumen',
        driving: 'Cell-to-lumen potassium gradient',
        note: 'Potassium recycling keeps NKCC2 supplied and generates the lumen-positive voltage. Lose it and you lose both — Bartter syndrome type 2.',
        targets: ['Bartter syndrome type 2'],
        cite: { rose: [4], evidence: 'physiology', refs: ['welling2016'] },
      },
      {
        key: 'ClCKb',
        name: 'ClC-Kb chloride channel and barttin',
        membrane: 'basolateral',
        kind: 'channel',
        moves: 'Cl⁻ out of the cell',
        driving: 'Electrochemical gradient',
        note: 'The chloride exit route. Barttin is its obligatory subunit and is also expressed in the inner ear, which is why some Bartter variants cause deafness.',
        targets: ['Bartter syndrome types 3 and 4'],
        cite: { evidence: 'clinical', refs: ['simon1996bartter', 'konrad2021'] },
      },
      {
        key: 'claudin16',
        name: 'Claudin-16/19 (paracellin-1)',
        membrane: 'paracellular',
        kind: 'junction',
        moves: 'Ca²⁺ and Mg²⁺ between cells',
        driving: 'Lumen-positive transepithelial voltage',
        note: 'Mutations cause familial hypomagnesaemia with hypercalciuria and nephrocalcinosis — losing both cations together, exactly as the shared pathway predicts.',
        targets: ['FHHNC'],
        cite: { rose: [3], evidence: 'clinical', refs: ['simon1999', 'hou2013'] },
      },
      {
        key: 'CaSR',
        name: 'Calcium-sensing receptor',
        membrane: 'basolateral',
        kind: 'receptor',
        moves: 'Senses interstitial Ca²⁺ and Mg²⁺',
        driving: 'Ligand binding',
        note: 'When plasma calcium rises it inhibits apical potassium channels, which reduces NaCl transport, collapses the voltage and so increases calcium excretion. Activating mutations mimic Bartter syndrome; inactivating ones cause familial hypocalciuric hypercalcaemia.',
        cite: { rose: [3], evidence: 'experimental', refs: ['mount2014'] },
      },
      {
        name: 'Na⁺/H⁺ exchange (NHE3)',
        membrane: 'apical',
        kind: 'exchanger',
        moves: 'Na⁺ in, H⁺ out',
        driving: 'Inward sodium gradient',
        note: 'Reclaims some of the bicarbonate that escapes the proximal tubule. A loop diuretic shifts sodium entry towards this pathway, adding to the alkalosis it causes.',
        cite: { rose: [15, 18], evidence: 'experimental' },
      },
    ],
    clinical: [
      'This is the segment that makes both a concentrated and a dilute urine possible: it supplies the medullary gradient for concentration and delivers hypotonic fluid for dilution.',
      'A loop diuretic therefore impairs concentration, which is why loop diuretics rarely cause hyponatraemia while thiazides — acting in the cortex — commonly do.',
      'The macula densa sits at the end of this segment. It senses chloride uptake through NKCC2, not chloride delivery, which is why a loop diuretic raises renin and blunts tubuloglomerular feedback.',
    ],
    diuretics: ['Furosemide', 'Bumetanide', 'Torsemide', 'Ethacrynic acid'],
    disorders: ['Bartter syndrome (types 1–4)', 'FHHNC', 'Loop diuretic effect', 'Familial hypocalciuric hypercalcaemia'],
    cite: { rose: [1, 4, 15], evidence: 'physiology', refs: ['mount2014'] },
  },

  DCT: {
    id: 'DCT',
    name: 'Distal convoluted tubule',
    short: 'DCT',
    tagline: 'Thiazide-sensitive NaCl reabsorption and the regulated site for calcium and magnesium',
    handles: ['5–8% of filtered sodium chloride', 'Regulated, active calcium reabsorption', 'Active magnesium reabsorption through TRPM6'],
    waterPermeability: 'Low — this segment continues to dilute the tubular fluid.',
    luminalComposition: 'Hypotonic; sodium and chloride fall further while calcium handling is adjusted to need.',
    hormones: ['Aldosterone (via WNK/SPAK signalling)', 'PTH and calcitriol (raise calcium reabsorption)', 'Angiotensin II', 'Plasma potassium (directly, through WNK kinases)'],
    drivingForce:
      'The NCC cotransporter uses the inward sodium gradient to bring sodium and chloride in together. Calcium enters apically through TRPV5 down a steep electrochemical gradient and leaves against it through a basolateral pump and the 3Na⁺/1Ca²⁺ exchanger.',
    transporters: [
      {
        key: 'NCC',
        name: 'NCC (Na⁺-Cl⁻ cotransporter)',
        membrane: 'apical',
        kind: 'cotransporter',
        moves: '1 Na⁺ with 1 Cl⁻',
        driving: 'Inward sodium gradient',
        note: 'Thiazides compete for the chloride site. A low plasma potassium activates NCC through the WNK kinases, which is a direct link between potassium status and salt handling.',
        targets: ['Thiazides', 'Gitelman syndrome', 'Hypokalaemia (activates)'],
        cite: { rose: [5, 15], evidence: 'physiology', refs: ['subramanya2014', 'simon1996gitelman', 'terker2015'] },
      },
      {
        key: 'TRPV5',
        name: 'TRPV5 calcium channel',
        membrane: 'apical',
        kind: 'channel',
        moves: 'Ca²⁺ into the cell',
        driving: 'Cell-negative potential and a very low cell calcium (<200 nmol/L)',
        note: 'When apical NaCl entry is blocked the cell hyperpolarises and calcium uptake rises — which is why a thiazide lowers calcium excretion while raising sodium excretion.',
        targets: ['Thiazides (increase)', 'PTH (increases)', 'Calcitriol (increases)'],
        cite: { rose: [3], evidence: 'experimental', refs: ['blaine2015'] },
      },
      {
        key: 'TRPM6',
        name: 'TRPM6 magnesium channel',
        membrane: 'apical',
        kind: 'channel',
        moves: 'Mg²⁺ into the cell',
        driving: 'Electrochemical gradient',
        note: 'The regulated, transcellular route for magnesium. Mutations cause hypomagnesaemia with secondary hypocalcaemia; thiazides and hypokalaemia reduce its activity.',
        targets: ['HSH (TRPM6 mutations)', 'Thiazides'],
        cite: { evidence: 'clinical', refs: ['schlingmann2002', 'debaaij2015'] },
      },
      {
        name: 'Na⁺/Ca²⁺ exchanger (NCX1) and PMCA',
        membrane: 'basolateral',
        kind: 'exchanger',
        moves: '3 Na⁺ in, 1 Ca²⁺ out',
        driving: 'Inward sodium gradient (exchanger) and ATP (pump)',
        note: 'Carries up to ~70% of calcium exit. Lowering cell sodium with a diuretic steepens the gradient and so favours calcium extrusion.',
        cite: { rose: [3], evidence: 'experimental' },
      },
    ],
    clinical: [
      'Gitelman syndrome is a lifelong thiazide effect: salt wasting, hypokalaemic alkalosis, hypomagnesaemia and a low urinary calcium.',
      'Chronic loop diuretic treatment makes this segment hypertrophy and raise its Na⁺-K⁺-ATPase activity, which is why adding a thiazide to a loop diuretic gives a larger than expected natriuresis.',
    ],
    diuretics: ['Thiazides', 'Chlorthalidone', 'Metolazone', 'Indapamide'],
    disorders: ['Gitelman syndrome', 'Familial hyperkalaemic hypertension (WNK mutations)', 'HSH'],
    cite: { rose: [5], evidence: 'physiology', refs: ['subramanya2014'] },
  },

  CNT: {
    id: 'CNT',
    name: 'Connecting tubule',
    short: 'CNT',
    tagline: 'Where aldosterone-sensitive sodium entry begins, and with it potassium secretion',
    handles: ['A few percent of filtered sodium, under aldosterone control', 'A large share of regulated potassium secretion', 'Regulated calcium reabsorption'],
    waterPermeability: 'ADH-dependent (aquaporin-2), rising through this segment into the collecting duct.',
    luminalComposition: 'Sodium falls and potassium rises; the lumen becomes electrically negative.',
    hormones: ['Aldosterone', 'ADH', 'Angiotensin II', 'PTH'],
    drivingForce:
      'Sodium enters through ENaC without an accompanying anion, which leaves the lumen negative. That voltage is the shared driving force for potassium secretion through ROMK and BK, and for H⁺ secretion by the intercalated cells.',
    transporters: [
      {
        key: 'ENaC',
        name: 'ENaC (epithelial sodium channel)',
        membrane: 'apical',
        kind: 'channel',
        moves: 'Na⁺ in, unaccompanied by an anion',
        driving: 'Electrochemical gradient; channel number set by aldosterone',
        note: 'Because the cation moves without an anion, reabsorbing it creates the lumen-negative voltage that everything downstream depends on.',
        targets: ['Amiloride', 'Triamterene', 'Trimethoprim', 'Aldosterone', 'Liddle syndrome', 'Pseudohypoaldosteronism type 1'],
        cite: { rose: [5, 15], evidence: 'physiology', refs: ['rossier2015', 'shimkets1994', 'chang1996'] },
      },
      {
        key: 'ROMK',
        name: 'ROMK',
        membrane: 'apical',
        kind: 'channel',
        moves: 'K⁺ into the lumen',
        driving: 'Cell-to-lumen gradient plus the lumen-negative voltage',
        note: 'The constitutive potassium secretory route, always partly open.',
        cite: { rose: [5, 12], evidence: 'physiology', refs: ['welling2016'] },
      },
      {
        key: 'BK',
        name: 'BK (maxi-K) channel',
        membrane: 'apical',
        kind: 'channel',
        moves: 'K⁺ into the lumen',
        driving: 'Activated by flow and by cell calcium',
        note: 'Flow-activated, which is why a high tubular flow rate increases potassium secretion independently of aldosterone.',
        cite: { rose: [12], evidence: 'experimental', refs: ['welling2016'] },
      },
      {
        key: 'TRPV5',
        name: 'TRPV5',
        membrane: 'apical',
        kind: 'channel',
        moves: 'Ca²⁺ in',
        driving: 'Electrochemical gradient',
        cite: { rose: [3], evidence: 'experimental', refs: ['blaine2015'] },
      },
    ],
    clinical: [
      'Two things set potassium secretion here: how negative the lumen is (aldosterone, sodium delivery) and how fast fluid is flowing past (which keeps the luminal potassium low and opens BK channels).',
      'This is why the same aldosterone level produces very different potassium losses depending on distal sodium delivery — the core of the loop-diuretic hypokalaemia chain.',
    ],
    diuretics: ['Amiloride', 'Triamterene', 'Spironolactone', 'Eplerenone', 'Finerenone'],
    disorders: ['Liddle syndrome', 'Pseudohypoaldosteronism types 1 and 2', 'Apparent mineralocorticoid excess'],
    cite: { rose: [5, 12], evidence: 'physiology', refs: ['pearce2015'] },
  },

  CCD: {
    id: 'CCD',
    name: 'Cortical collecting duct',
    short: 'CCD',
    tagline: 'Principal cells handle sodium, potassium and water; intercalated cells handle acid and base',
    handles: ['Final regulated sodium reabsorption', 'The main site of potassium secretion', 'ADH-dependent water reabsorption', 'Acid or base secretion'],
    waterPermeability: 'Set by ADH: aquaporin-2 is shuttled into the apical membrane from cytoplasmic vesicles, and removed again when ADH falls.',
    luminalComposition: 'With ADH the fluid equilibrates with the isotonic cortical interstitium (~290 mOsm/kg); without it, it stays dilute.',
    hormones: ['Aldosterone', 'ADH', 'Prostaglandin E₂ (opposes both)', 'ATP and endothelin (autocrine brakes)'],
    drivingForce:
      'The same ENaC-generated lumen-negative voltage as the connecting tubule, plus an apical H⁺-ATPase in the α-intercalated cells that can secrete H⁺ against a 1000-fold gradient, and pendrin in the β-cells that secretes bicarbonate in exchange for chloride.',
    transporters: [
      {
        key: 'ENaC',
        name: 'ENaC',
        membrane: 'apical',
        kind: 'channel',
        moves: 'Na⁺ in',
        driving: 'Electrochemical gradient; aldosterone sets channel number and open probability',
        targets: ['Amiloride', 'Spironolactone (indirectly)'],
        cite: { rose: [5], evidence: 'physiology', refs: ['rossier2015'] },
      },
      {
        key: 'AQP2',
        name: 'Aquaporin-2',
        membrane: 'apical',
        kind: 'channel',
        moves: 'Water',
        driving: 'Osmotic gradient; presence in the membrane is controlled by ADH',
        note: 'Trafficked in and out of the membrane rather than made and destroyed, so the response to ADH is fast and reversible. Mutations, or lithium, cause nephrogenic diabetes insipidus.',
        targets: ['ADH/V2 receptor', 'Lithium', 'Tolvaptan', 'Nephrogenic DI'],
        cite: { rose: [1, 5, 6], evidence: 'physiology', refs: ['knepper2015', 'nielsen2002', 'deen2001'] },
      },
      {
        key: 'V2R',
        name: 'V2 vasopressin receptor',
        membrane: 'basolateral',
        kind: 'receptor',
        moves: 'Signals through cyclic AMP',
        driving: 'ADH binding',
        note: 'X-linked mutations are the commonest cause of congenital nephrogenic DI; tolvaptan blocks it deliberately.',
        targets: ['Tolvaptan', 'Congenital nephrogenic DI'],
        cite: { evidence: 'clinical', refs: ['rosenthal1992', 'schrier2006'] },
      },
      {
        key: 'HATPase',
        name: 'H⁺-ATPase (α-intercalated cell)',
        membrane: 'apical',
        kind: 'pump',
        moves: 'H⁺ into the lumen',
        driving: 'ATP; helped by the lumen-negative voltage',
        note: 'Can lower the urine pH to 4.5, a hydrogen ion concentration nearly 1000 times that of plasma. Failure here is distal (type 1) RTA.',
        targets: ['Distal RTA', 'Aldosterone (stimulates)'],
        cite: { rose: [11, 18], evidence: 'physiology', refs: ['roy2015', 'karet2002'] },
      },
      {
        key: 'pendrin',
        name: 'Pendrin (β-intercalated cell)',
        membrane: 'apical',
        kind: 'exchanger',
        moves: 'Cl⁻ in, HCO₃⁻ out',
        driving: 'The steep inward chloride gradient',
        note: 'The route for excreting excess bicarbonate. It needs luminal chloride — which is exactly why a chloride-depleted patient cannot correct a metabolic alkalosis.',
        cite: { rose: [18], evidence: 'experimental', refs: ['roy2015'] },
      },
      {
        key: 'HKATPase',
        name: 'H⁺-K⁺-ATPase',
        membrane: 'apical',
        kind: 'pump',
        moves: 'H⁺ out, K⁺ in',
        driving: 'ATP',
        note: 'Reclaims potassium during depletion, at the cost of secreting acid — one reason hypokalaemia and metabolic alkalosis travel together.',
        cite: { rose: [12, 18], evidence: 'experimental', refs: ['roy2015'] },
      },
    ],
    clinical: [
      'Principal and intercalated cells sit side by side but do different jobs: only the principal cells handle sodium and potassium, and only the intercalated cells handle acid and base.',
      'Aldosterone acts on both — directly on the H⁺-ATPase, and indirectly by making the lumen more negative.',
    ],
    diuretics: ['Amiloride', 'Spironolactone', 'Eplerenone', 'Finerenone'],
    disorders: ['Distal (type 1) RTA', 'Type 4 RTA', 'Liddle syndrome', 'Nephrogenic DI', 'SIADH'],
    cite: { rose: [5, 11], evidence: 'physiology', refs: ['pearce2015', 'roy2015'] },
  },

  OMCD: {
    id: 'OMCD',
    name: 'Outer medullary collecting duct',
    short: 'OMCD',
    tagline: 'Continues acidification and, with ADH, water reabsorption into a progressively saltier interstitium',
    handles: ['Further sodium reabsorption', 'Vigorous H⁺ secretion', 'ADH-dependent water reabsorption'],
    waterPermeability: 'ADH-dependent.',
    luminalComposition: 'Osmolality rises as water leaves; the pH falls as H⁺ accumulates.',
    hormones: ['Aldosterone', 'ADH'],
    drivingForce: 'Apical H⁺-ATPase, with a tight epithelium that can hold very large gradients.',
    transporters: [
      {
        key: 'HATPase',
        name: 'H⁺-ATPase',
        membrane: 'apical',
        kind: 'pump',
        moves: 'H⁺ into the lumen',
        driving: 'ATP',
        cite: { rose: [11], evidence: 'physiology', refs: ['roy2015'] },
      },
      {
        key: 'RhCG',
        name: 'Rh glycoproteins (RhBG/RhCG)',
        membrane: 'apical',
        kind: 'channel',
        moves: 'NH₃ into the lumen',
        driving: 'Concentration gradient from the medullary interstitium',
        note: 'Ammonia is moved by specific transporters, not just lipid diffusion. Trapping it as NH₄⁺ in the acid lumen is what makes ammonium excretion possible.',
        cite: { evidence: 'experimental', refs: ['weiner2017'] },
      },
    ],
    clinical: ['The tight junctions here are many-stranded, which is what allows a urine pH of 4.5 without back-diffusion.'],
    diuretics: [],
    disorders: ['Distal RTA'],
    cite: { rose: [5, 11], evidence: 'physiology', refs: ['weiner2017'] },
  },

  IMCD: {
    id: 'IMCD',
    name: 'Inner medullary collecting duct',
    short: 'IMCD',
    tagline: 'The last word on the urine: final water, urea and sodium handling in the papilla',
    handles: [
      'Final sodium reabsorption — urine sodium can fall below 1 mmol/L',
      'ADH-dependent urea reabsorption, which feeds the medullary urea store',
      'Final water reabsorption against the papillary gradient',
    ],
    waterPermeability: 'Highest ADH-dependent permeability of any segment; with maximal ADH the urine reaches the papillary interstitial osmolality.',
    luminalComposition: 'Whatever is left: from 50 mOsm/kg with no ADH to about 1200 mOsm/kg with maximal ADH.',
    hormones: ['ADH (water through AQP2/3, urea through UT-A1/A3)', 'Aldosterone'],
    drivingForce: 'The corticopapillary osmotic gradient, which ADH allows the tubular fluid to equilibrate with.',
    transporters: [
      {
        key: 'AQP2',
        name: 'Aquaporin-2 (apical) with AQP3/4 (basolateral)',
        membrane: 'apical',
        kind: 'channel',
        moves: 'Water',
        driving: 'The papillary osmotic gradient',
        cite: { rose: [4, 6], evidence: 'physiology', refs: ['knepper2015'] },
      },
      {
        key: 'UTA',
        name: 'UT-A1 and UT-A3 urea transporters',
        membrane: 'apical',
        kind: 'channel',
        moves: 'Urea out of the lumen',
        driving: 'Concentration gradient; ADH raises the permeability',
        note: 'Reabsorbed urea is trapped in the inner medulla and becomes about half of the concentrating gradient. Knocking these out impairs concentration while leaving NaCl transport intact.',
        cite: { rose: [4], evidence: 'experimental', refs: ['fenton2004', 'klein2011'] },
      },
      {
        key: 'ENaC',
        name: 'ENaC',
        membrane: 'apical',
        kind: 'channel',
        moves: 'Na⁺ in',
        driving: 'Electrochemical gradient',
        cite: { rose: [5], evidence: 'physiology' },
      },
    ],
    clinical: [
      'Because urea contributes so much of the gradient, protein intake affects how concentrated the urine can become — and a low-solute diet lowers the ceiling on water excretion too.',
      'Reabsorbing urea here rather than excreting it lets the kidney excrete nitrogen without spending water, which is the point of recycling it.',
    ],
    diuretics: ['Amiloride (also blocks lithium entry here)'],
    disorders: ['Nephrogenic DI', 'Lithium toxicity', 'Medullary washout'],
    cite: { rose: [4, 5], evidence: 'physiology', refs: ['fenton2007'] },
  },
};

/** Vascular and juxtaglomerular structures shown in the explorer alongside the tubule. */
export interface StructureInfo {
  id: string;
  name: string;
  tagline: string;
  detail: string[];
  cite: Citation;
}

export const STRUCTURES: StructureInfo[] = [
  {
    id: 'renalArtery',
    name: 'Renal artery',
    tagline: 'Delivers about a fifth of the cardiac output to organs weighing 0.5% of body weight',
    detail: [
      'Renal blood flow is roughly 1.1 L/min, four times the flow per 100 g of liver or exercising muscle.',
      'That flow exists to support filtration, not to meet the kidney’s own oxygen demand.',
      'A stenosis reduces the pressure delivered to the glomeruli; autoregulation then defends filtration, which is why the GFR becomes angiotensin II-dependent and falls when that is blocked.',
    ],
    cite: { rose: [2], evidence: 'physiology' },
  },
  {
    id: 'afferent',
    name: 'Afferent arteriole',
    tagline: 'The upstream tap: sets how much of the systemic pressure reaches the glomerulus',
    detail: [
      'Constriction lowers both glomerular pressure and plasma flow, so GFR and renal blood flow fall together.',
      'It carries the myogenic stretch response and is the effector of tubuloglomerular feedback.',
      'The juxtaglomerular cells in its wall make renin.',
      'It has voltage-gated calcium channels, which is why calcium channel blockers dilate it (and can therefore raise glomerular pressure).',
    ],
    cite: { rose: [2], evidence: 'physiology', refs: ['loutzenhiser2006'] },
  },
  {
    id: 'glomerulus',
    name: 'Glomerulus',
    tagline: 'A capillary tuft between two arterioles — the only way to control pressure on both sides',
    detail: [
      'Three layers filter: fenestrated endothelium, glomerular basement membrane, and podocytes with their slit diaphragms.',
      'Small solutes pass freely; albumin (radius 36 Å) barely does, restricted by both size and negative charge.',
      'Being between two arterioles is what lets the kidney raise filtration pressure without raising flow — and vice versa.',
    ],
    cite: { rose: [2], evidence: 'physiology', refs: ['scott2015', 'deen2001'] },
  },
  {
    id: 'bowman',
    name: "Bowman's space",
    tagline: 'Collects the ultrafiltrate; its pressure opposes filtration',
    detail: [
      'Normally about 10 mmHg, which is subtracted from the glomerular capillary pressure.',
      'Obstruction anywhere downstream raises it, and filtration falls in proportion — the whole mechanism of obstructive renal failure.',
      'Because the filtrate is essentially protein-free, there is no oncotic pressure here to oppose filtration.',
    ],
    cite: { rose: [2], evidence: 'physiology', refs: ['klahr2002'] },
  },
  {
    id: 'efferent',
    name: 'Efferent arteriole',
    tagline: 'The downstream tap: raises glomerular pressure while lowering flow',
    detail: [
      'Constriction holds fluid back in the capillary, raising glomerular pressure and filtration fraction while reducing renal blood flow.',
      'Its basal diameter is smaller than the afferent’s, so angiotensin II raises its resistance up to three times as much.',
      'Moderate constriction raises GFR; severe constriction reduces flow so much that GFR falls despite the higher pressure.',
      'It lacks the myogenic response, so it does not participate directly in autoregulation.',
    ],
    cite: { rose: [2], evidence: 'physiology', refs: ['loutzenhiser2006'] },
  },
  {
    id: 'peritubular',
    name: 'Peritubular capillaries',
    tagline: 'Take up the reabsorbate; their Starling forces modulate proximal reabsorption',
    detail: [
      'Blood arriving here has already lost protein-free filtrate, so its oncotic pressure is high (~35 mmHg) while its hydraulic pressure is low (~20 mmHg).',
      'That combination gives a net force of about 13 mmHg pulling reabsorbed fluid into the capillary.',
      'A rise in filtration fraction concentrates the protein further and so favours proximal reabsorption — the link between efferent tone and sodium retention in heart failure.',
    ],
    cite: { rose: [3], evidence: 'physiology' },
  },
  {
    id: 'vasaRecta',
    name: 'Vasa recta',
    tagline: 'Countercurrent exchangers that supply the medulla without washing out its gradient',
    detail: [
      'Descending and ascending vessels run side by side, so solute entering the ascending limb short-circuits back into the descending one.',
      'This is exchange, not multiplication: it preserves a gradient that the loop of Henle creates, but cannot create one itself.',
      'Medullary flow is deliberately low. Raising it washes out the gradient and impairs concentration.',
      'They carry UT-B urea transporters and aquaporin-1, which help trap urea in the medulla.',
    ],
    cite: { rose: [4], evidence: 'physiology', refs: ['pallone2003', 'dantzler2014'] },
  },
  {
    id: 'maculaDensa',
    name: 'Macula densa',
    tagline: 'Specialised cells that read tubular chloride and adjust filtration and renin',
    detail: [
      'They sit at the end of the cortical thick ascending limb, touching their own glomerulus’s afferent arteriole.',
      'They sense NaCl uptake through NKCC2. Because that carrier is saturated for sodium and potassium at normal concentrations, chloride is what the cells actually read.',
      'A rise in uptake constricts the afferent arteriole (tubuloglomerular feedback, probably through adenosine) and suppresses renin.',
      'A loop diuretic blocks the uptake step itself: the signal falls even though delivery has risen, so renin rises and feedback is blunted.',
    ],
    cite: { rose: [1, 2], evidence: 'physiology', refs: ['carlstrom2015'] },
  },
  {
    id: 'jgCells',
    name: 'Juxtaglomerular cells',
    tagline: 'Make and release renin in response to three separate signals',
    detail: [
      'Stretch in the afferent arteriolar wall: less stretch, more renin.',
      'Sympathetic nerves acting on β₁ receptors.',
      'The macula densa signal next door.',
      'Blocking prostaglandin synthesis and β-adrenergic transmission together almost abolishes the renin response to hypovolaemia.',
    ],
    cite: { rose: [2], evidence: 'physiology', refs: ['carlstrom2015'] },
  },
  {
    id: 'mesangium',
    name: 'Mesangium',
    tagline: 'Contractile and immune cells between the capillary loops',
    detail: [
      'Mesangial cells contain smooth-muscle-like filaments and contract in response to angiotensin II, reducing the surface area available for filtration.',
      'Most of the mesangium is separated from the capillary lumen only by fenestrated endothelium, so macromolecules can enter and be cleared there.',
      'They release and respond to cytokines, and proliferate in immune-mediated glomerular disease.',
    ],
    cite: { rose: [2], evidence: 'physiology' },
  },
  {
    id: 'renalVein',
    name: 'Renal vein',
    tagline: 'The outflow; its pressure matters more than it looks',
    detail: [
      'Venous pressure sets the downstream end of the pressure gradient across the kidney.',
      'Raising it — by congestion in right heart failure, or by raised intra-abdominal pressure — reduces the net perfusion gradient and lowers GFR even when arterial pressure is normal.',
    ],
    cite: { rose: [2, 16], evidence: 'clinical', refs: ['mullens2019'] },
  },
];
