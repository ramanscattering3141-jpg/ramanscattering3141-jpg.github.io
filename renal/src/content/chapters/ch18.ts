import type { ChapterContent } from './types';

export const chapter: ChapterContent = {
  n: 18,
  title: 'Metabolic alkalosis',
  thesis:
    'Two separate questions, and the second is the interesting one. Something must generate the alkalosis — acid lost, alkali given, or the extracellular volume contracting around a fixed bicarbonate pool. But a normal kidney can excrete an alkali load of 1000 mmol a day and barely move its plasma bicarbonate, so an alkalosis that persists means something is stopping that excretion. Chloride depletion, volume depletion, hypokalaemia and mineralocorticoid excess are the candidates, and identifying which one is present is what decides the treatment.',
  concepts: [
    {
      heading: 'Generation: three ways to raise the bicarbonate',
      body: [
        'Losing hydrogen ions generates bicarbonate one for one, because both come from the dissociation of carbonic acid. Gastric juice is rich in hydrochloric acid, so vomiting or nasogastric suction generates bicarbonate directly. Normally the acid entering the duodenum triggers an equal pancreatic bicarbonate secretion and nothing changes; removing the gastric juice removes that stimulus, and the bicarbonate stays.',
        'The kidney can do the same thing. Anything that drives distal hydrogen secretion — mineralocorticoid excess, high distal sodium delivery, hypokalaemia — generates new bicarbonate with every hydrogen ion excreted.',
        'Or the extracellular volume can contract around a fixed amount of bicarbonate. If the fluid lost contains chloride but little bicarbonate, the same bicarbonate is left in a smaller volume and its concentration rises: Rose\'s worked example takes an extracellular volume from 22 to 17 litres and the bicarbonate from 24 to 31 mmol/L. This is why diuretics cause alkalosis and haemorrhage does not — blood contains chloride and bicarbonate in the same proportions as plasma, so losing it changes no concentration.',
        'Giving alkali is the fourth route, and on its own the least effective: in a kidney that can excrete it, almost nothing happens.',
      ],
      chain: [
        'H⁺ lost (vomiting, distal secretion) or Cl⁻-rich fluid lost',
        'Bicarbonate generated, or concentrated into a smaller volume',
        'Plasma bicarbonate rises',
        'A normal kidney would now excrete it',
        'Unless a maintenance factor prevents that',
      ],
      points: ['Gastric juice: HCl, so its loss generates HCO₃⁻', 'Contraction: same HCO₃⁻, smaller volume', 'Haemorrhage does not cause alkalosis — it is isotonic to plasma'],
      cite: { rose: [18, 11], evidence: 'physiology' },
      route: '/metabolic-alkalosis',
    },
    {
      heading: 'Maintenance is the real problem',
      body: [
        'Normal subjects given 1000 mmol of sodium bicarbonate a day for two weeks excrete virtually all of it and end up with only a minor rise in plasma bicarbonate. Every disorder that causes metabolic alkalosis presents the kidney with far less than that. So an alkalosis that persists is not a story about how the bicarbonate got there; it is a story about why it is not leaving.',
        'Both a reduced filtered load and increased tubular reabsorption contribute, and the second matters more — a low filtration rate on its own, as in chronic renal insufficiency, does not predispose to alkalosis.',
        'The candidates are effective circulating volume depletion, chloride depletion, hypokalaemia and mineralocorticoid excess. In volume depletion, holding on to bicarbonate is arguably the right decision: excreting it would obligate sodium loss to maintain electroneutrality, worsening the perfusion the kidney is trying to defend.',
        'The reabsorptive capacity is not fixed. A very low sodium diet raises it by about 4 mmol/L of filtrate even in someone clinically euvolaemic; with marked reductions in tissue perfusion it can exceed 35 mmol/L, which is enough to hold a severe alkalosis indefinitely.',
      ],
      points: ['1000 mmol/day of NaHCO₃ for 2 weeks: nearly all excreted', 'Reabsorptive capacity ~25 normally, ~29 on a low-salt diet, > 35 in marked depletion', 'A low GFR alone does not cause alkalosis'],
      cite: { rose: [18, 11], evidence: 'experimental' },
      route: '/metabolic-alkalosis',
    },
    {
      heading: 'Chloride or volume? The experiment that separates them',
      body: [
        'Volume depletion and chloride depletion travel together in the usual causes, so it is hard to tell which is doing the work. Two observations separate them. Repairing the volume deficit with albumin does not reverse the increased distal bicarbonate reabsorption and does not correct the alkalosis. Giving a chloride salt that contains no sodium — potassium chloride, choline chloride — does not restore normovolaemia but does reduce net acid excretion and bring the plasma bicarbonate back to normal.',
        'Three mechanisms could explain a chloride effect independent of sodium. Chloride availability sets the activity of the Na⁺-K⁺-2Cl⁻ carrier at the macula densa, so hypochloraemia reduces the signal and releases renin, giving secondary hyperaldosteronism and more distal hydrogen secretion. The distal H⁺-ATPase probably cosecretes chloride for electroneutrality, and a low luminal chloride concentration maximises the gradient for that. And bicarbonate secretion by type B intercalated cells works by chloride–bicarbonate exchange across the luminal membrane, driven by the inward chloride gradient — so stripping the lumen of chloride removes the kidney\'s ability to secrete bicarbonate at all.',
        'That last mechanism is what produces the paradoxical aciduria: a urine pH below 6 in a patient whose arterial pH is 7.5. It resolves the moment chloride is replaced, which is also the moment the alkalosis starts to correct.',
        'Rose leaves the relative contributions unresolved, and notes it does not much matter clinically, because sodium chloride corrects both at once. The distinction still matters when you cannot give sodium.',
      ],
      points: [
        'Albumin (volume, no chloride): no correction',
        'KCl (chloride, no volume): corrects it',
        'Paradoxical aciduria: acid urine with alkalaemic blood',
      ],
      cite: { rose: [18], evidence: 'experimental' },
      route: '/metabolic-alkalosis',
    },
    {
      heading: 'Hypokalaemia, and when it is the whole story',
      body: [
        'Hypokalaemia is a potent stimulus to hydrogen secretion, by at least three routes: the intracellular acidosis produced by potassium leaving cells in exchange for hydrogen; activation of the H⁺-K⁺-ATPase, which reabsorbs potassium and secretes hydrogen in the same step; and, in severe depletion, a poorly understood reduction in distal chloride reabsorption that increases luminal electronegativity.',
        'Its contribution is small when bicarbonate reabsorption is already being driven by volume depletion. It becomes the main factor in primary mineralocorticoid excess, where aldosterone escape prevents the volume expansion: sodium intake and output are equal, the patient is not volume depleted, and it is the hypokalaemia that holds the alkalosis up. Replacing potassium corrects it — partly by reducing net acid excretion, partly because the potassium entering cells displaces hydrogen back out.',
        'The reverse case is instructive too. Patients with heart failure or cirrhosis have secondary hyperaldosteronism and yet usually have a normal potassium and no alkalosis, because distal sodium delivery is low. Give them a diuretic, which raises distal delivery, and hypokalaemia and alkalosis appear quickly.',
      ],
      cite: { rose: [18, 12, 27], evidence: 'physiology' },
      route: '/metabolic-alkalosis',
    },
    {
      heading: 'Respiratory compensation, and a caveat about it',
      body: [
        'Alkalaemia reduces ventilation, and the PCO₂ rises about 0.7 mmHg for every 1 mmol/L rise in bicarbonate. A bicarbonate of 34 should give a PCO₂ near 47. Values far from that indicate a superimposed respiratory disorder.',
        'The compensation can be prevented. Heart failure and cirrhosis often carry a primary respiratory alkalosis, which blocks the hypoventilation that a diuretic-induced alkalosis would otherwise produce. Hypoxaemia interferes less than might be expected: the hypoxic drive does not become prominent until the PO₂ falls below about 50 mmHg, so in the absence of lung disease the PCO₂ can exceed 60 mmHg in severe metabolic alkalosis.',
        'There is a genuine question about whether the compensation helps at all. In animals, the rise in PCO₂ itself increases net hydrogen excretion — the higher PCO₂ lowers renal tubular cell pH and stimulates hydrogen secretion — which raises the plasma bicarbonate further. After several days the arterial pH can end up where it would have been with no respiratory compensation at all, because the PCO₂ and the bicarbonate have risen equivalently.',
      ],
      equation: 'alkComp',
      cite: { rose: [18, 20], evidence: 'experimental' },
      route: '/metabolic-alkalosis',
    },
    {
      heading: 'Post-hypercapnic alkalosis, and why to lower a PCO₂ slowly',
      body: [
        'Chronic respiratory acidosis is compensated by renal bicarbonate generation, appropriately: the raised bicarbonate returns the pH towards normal, which is why chronic hypercapnia is well tolerated. Put such a patient on a ventilator and drop the PCO₂ quickly, and the bicarbonate stays up. The result is a metabolic alkalosis and, because CO₂ crosses the blood–brain barrier far faster than bicarbonate, an abrupt rise in cerebral pH that can cause serious neurological damage and death.',
        'So the PCO₂ should be lowered slowly in chronic hypercapnia, and there is no reason to hurry: the extracellular pH was already well protected.',
        'The alkalosis persists for several reasons. The hypercapnia-driven stimulation of bicarbonate reabsorption has a memory — it takes three to five days to reach maximum and reversal is probably as slow. Chronic respiratory acidosis is also accompanied by urinary chloride loss, so these patients are hypochloraemic and volume depleted, and the alkalosis will not resolve until chloride balance is restored.',
      ],
      points: ['Lower a chronic PCO₂ slowly', 'The pH was already protected — there is nothing to rush', 'It persists until chloride is replaced'],
      cite: { rose: [18, 20], evidence: 'clinical' },
      route: '/respiratory',
    },
    {
      heading: 'The causes worth recognising',
      body: [
        'Gastric loss and diuretics account for most of it. Beyond those: achlorhydria, where gastric fluid removal causes a contraction alkalosis rather than acid loss, since there was no acid in it; magnesium-containing antacids, harmless with normal renal function but capable of alkalosis when combined with a cation-exchange resin in renal failure; and congenital chloridorrhoea or a villous adenoma, in which the stool is unusually chloride-rich and its loss alkalinises rather than acidifies.',
        'Non-reabsorbable anions do it too. High-dose sodium carbenicillin delivers an anion that cannot be reabsorbed distally, so sodium reabsorption there must occur in exchange for potassium and hydrogen: hypokalaemia and alkalosis follow. The same logic applies to an infant given a formula containing sodium with almost no chloride.',
        'Hypercalcaemia increases hydrogen secretion and bicarbonate reabsorption by a mechanism that is not clear, and probably contributes to the milk–alkali syndrome, where calcium carbonate supplies both the calcium and the alkali. Confusingly, primary hyperparathyroidism tends towards a mild acidosis instead.',
        'Laxative abuse is the awkward one: it usually causes acidosis from bicarbonate-rich stool, but many patients present with alkalosis instead, and why is not well understood — hypokalaemia is probably important.',
      ],
      cite: { rose: [18], evidence: 'clinical' },
      route: '/metabolic-alkalosis',
    },
  ],
  numbers: [
    { label: 'Alkali load a normal kidney can clear', value: '1000 mmol/day of NaHCO₃ for 2 weeks' },
    { label: 'Normal bicarbonate reabsorptive capacity', value: '~25 mmol/L of filtrate' },
    { label: 'On a 10 mmol/day sodium diet', value: '~29 mmol/L' },
    { label: 'With marked volume depletion', value: '> 35 mmol/L' },
    { label: 'Respiratory compensation', value: 'PCO₂ ↑ 0.7 mmHg per 1 mmol/L ↑ HCO₃⁻' },
    { label: 'PCO₂ achievable in severe alkalosis', value: 'can exceed 60 mmHg' },
    { label: 'Hypoxic drive becomes prominent below', value: 'PO₂ ~50 mmHg' },
    { label: 'Urine Cl⁻ in chloride-responsive alkalosis', value: '< 20 mmol/L (often < 10)' },
    { label: 'Urine Cl⁻ in chloride-resistant alkalosis', value: '> 20 mmol/L' },
    { label: 'Urine pH in chloride depletion', value: 'paradoxically acid, often < 6' },
    { label: 'Time for hypercapnic H⁺ secretion to peak', value: '3–5 days' },
    { label: 'Contraction example (Rose Fig. 18-1)', value: 'ECF 22 → 17 L raises HCO₃⁻ 24 → 31' },
  ],
  equations: ['alkComp', 'hh', 'hplus'],
  clinical: [
    'Ask two questions, not one: what generated it, and what is stopping the kidney from excreting it.',
    'The urine chloride separates the two treatable groups. Below 20 mmol/L is chloride-responsive — vomiting, diuretics, post-hypercapnia — and saline corrects it. Above 20 is chloride-resistant: mineralocorticoid excess, severe potassium depletion, Bartter or Gitelman.',
    'Use the urine chloride, not the urine sodium: a patient excreting bicarbonate has to excrete sodium with it, so the urine sodium can be high while the kidney is avidly volume depleted.',
    'A paradoxically acid urine in an alkalaemic patient is not a contradiction — it is the diagnosis.',
    'When sodium cannot be given, potassium chloride corrects a chloride-responsive alkalosis without it. In an oedematous patient, acetazolamide wastes bicarbonate and is the usual choice.',
    'In mineralocorticoid excess, replace the potassium: it is the hypokalaemia, not the volume, holding the alkalosis up.',
    'Lower a chronically raised PCO₂ slowly. There is nothing to be gained by hurrying, and an abrupt fall raises cerebral pH dangerously.',
    'Severe alkalaemia matters: it lowers ionised calcium, shifts potassium into cells, reduces cerebral and coronary blood flow, and shifts the oxygen dissociation curve leftwards.',
  ],
  pathology: [
    { name: 'Vomiting / nasogastric suction', broken: 'Gastric HCl lost with no pancreatic stimulus', consequence: 'Alkalosis with hypokalaemia, urine Cl⁻ < 10, paradoxically acid urine', route: '/metabolic-alkalosis' },
    { name: 'Loop or thiazide diuretic', broken: 'Volume contraction plus increased distal H⁺ and K⁺ secretion', consequence: 'Alkalosis proportional to the diuresis; urine Cl⁻ high while the drug acts, low after', route: '/diuretics' },
    { name: 'Primary hyperaldosteronism', broken: 'Distal H⁺ and K⁺ secretion, without volume depletion', consequence: 'Alkalosis maintained by hypokalaemia; urine Cl⁻ > 20; corrected by KCl, not saline', route: '/hypokalemia' },
    { name: 'Post-hypercapnic', broken: 'PCO₂ lowered faster than the kidney can release bicarbonate', consequence: 'Alkalosis with a dangerous rise in cerebral pH; persists until chloride is replaced', route: '/respiratory' },
    { name: 'Contraction alkalosis', broken: 'Nothing is generated — the volume shrinks around the bicarbonate', consequence: 'Modest alkalosis, limited by cell and bone buffering', route: '/metabolic-alkalosis' },
    { name: 'Non-reabsorbable anion (carbenicillin)', broken: 'Distal Na⁺ must be reabsorbed in exchange for K⁺ and H⁺', consequence: 'Hypokalaemia with alkalosis', route: '/metabolic-alkalosis' },
    { name: 'Milk–alkali syndrome', broken: 'Calcium and alkali load together', consequence: 'Hypercalcaemia with alkalosis and renal impairment', route: '/minerals' },
    { name: 'Congenital chloridorrhoea', broken: 'Intestinal Cl⁻/HCO₃⁻ exchange', consequence: 'Chloride-rich stool: diarrhoea that alkalinises instead of acidifying', route: '/metabolic-alkalosis' },
  ],
  questions: [
    {
      q: 'Why does a normal person given 1000 mmol of bicarbonate a day not become alkalotic?',
      options: ['The gut does not absorb it', 'A chloride-replete kidney excretes essentially all of it', 'It is buffered by bone', 'They do — the question is wrong'],
      answer: 1,
      explanation:
        'Which is the chapter’s central point: generation is easy and maintenance is the problem. An alkalosis that persists means the kidney has been prevented from excreting bicarbonate, and finding out what is preventing it is the diagnosis.',
      route: '/metabolic-alkalosis',
    },
    {
      q: 'A vomiting patient is alkalaemic at pH 7.52 and the urine pH is 5.8. Is that a contradiction?',
      options: ['Yes — it suggests a laboratory error', 'No — chloride depletion stops bicarbonate secretion and sustains distal H⁺ secretion, so the urine is paradoxically acid', 'It means renal tubular acidosis', 'It means the alkalosis is resolving'],
      answer: 1,
      explanation:
        'Bicarbonate secretion by type B intercalated cells is driven by the inward chloride gradient, so an empty lumen abolishes it. The urine turns alkaline as soon as chloride is replaced, which is also when the alkalosis starts to correct.',
      route: '/metabolic-alkalosis',
    },
    {
      q: 'A patient with vomiting has a urine Na⁺ of 90 mmol/L. Does that exclude volume depletion?',
      options: ['Yes', 'No — sodium must accompany the bicarbonate being excreted; the urine chloride is the honest measure', 'Yes, unless a diuretic was given', 'Only if the urine osmolality is high'],
      answer: 1,
      explanation: 'This is why the urine chloride, not the urine sodium, is the test in metabolic alkalosis.',
      route: '/urine-chemistry',
    },
    {
      q: 'Which corrects a vomiting-induced alkalosis: albumin, or potassium chloride?',
      options: ['Albumin — it restores volume', 'Potassium chloride — it restores chloride without restoring volume', 'Neither', 'Both equally'],
      answer: 1,
      explanation:
        'This is the experiment that separates chloride depletion from volume depletion. Restoring volume without chloride leaves the increased distal bicarbonate reabsorption in place; restoring chloride without volume corrects it.',
      route: '/metabolic-alkalosis',
    },
    {
      q: 'A patient with COPD and a chronic PCO₂ of 70 is ventilated and the PCO₂ falls to 40 within an hour. What is the danger?',
      options: [
        'Hypoxaemia',
        'The bicarbonate is still high, so a sudden metabolic alkalosis develops and cerebral pH rises abruptly — this can be fatal',
        'Rebound hypercapnia',
        'None — normalising the PCO₂ is the goal',
      ],
      answer: 1,
      explanation:
        'CO₂ crosses the blood–brain barrier far faster than bicarbonate. The extracellular pH was already well protected by the renal compensation, so there was nothing to gain from speed.',
      route: '/respiratory',
    },
    {
      q: 'Why do uncomplicated heart failure and cirrhosis not usually cause hypokalaemia and alkalosis, despite secondary hyperaldosteronism?',
      options: [
        'Aldosterone is not really raised',
        'Distal sodium and water delivery is low, so there is little substrate for distal K⁺ and H⁺ secretion — until a diuretic increases it',
        'The liver metabolises aldosterone',
        'Potassium intake is higher',
      ],
      answer: 1,
      explanation:
        'Aldosterone needs distal delivery to act on. This is also why hypokalaemia and alkalosis appear so promptly once these patients are given a diuretic.',
      route: '/diuretics',
    },
  ],
  updates: [
    {
      topic: 'Chloride-responsive and chloride-resistant',
      text: 'The chapter frames the division as saline-responsive versus saline-resistant. Current practice uses the urine chloride explicitly as the dividing test — under 20 mmol/L responsive, over 20 resistant — which is the same distinction made operational, and it avoids the trap of reading the urine sodium instead. The molecular basis of the resistant group has also been filled in: Bartter and Gitelman syndromes are now known to be loss-of-function mutations in the same transporters that loop diuretics and thiazides block, which is why they present as a drug effect nobody has taken.',
      cite: { rose: [18, 27], evidence: 'clinical', update: 'The same distinction, made into a bedside test.' },
    },
    {
      topic: 'Acetazolamide and chloride-free correction',
      text: 'For the oedematous patient in whom saline is unwelcome, the chapter suggests acetazolamide to waste bicarbonate. That remains standard. Hydrochloric acid infusion through a central line survives for extreme alkalaemia but is now rare; ammonium chloride and arginine hydrochloride are little used. The main change is a lower threshold for simply stopping the diuretic and replacing potassium and chloride, since most diuretic-induced alkalosis is mild and self-limiting once the drug stops.',
      cite: { rose: [18, 15], evidence: 'clinical' },
    },
  ],
  modules: ['/metabolic-alkalosis', '/mixed', '/diuretics', '/urine-chemistry'],
};
