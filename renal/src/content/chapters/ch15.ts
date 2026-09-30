import type { ChapterContent } from './types';

export const chapter: ChapterContent = {
  n: 15,
  title: 'Clinical use of diuretics',
  thesis:
    'A diuretic does not remove fluid indefinitely. It blocks one transporter at one site, and the rest of the nephron immediately begins to compensate — by reabsorbing more where the drug does not reach, and by the volume signals that the drug itself generates. Within days sodium intake and output are equal again, at a smaller extracellular volume. Almost everything clinically useful about diuretics, and almost everything that goes wrong with them, follows from that single fact: the response is transient, and the first dose is the largest one you will ever see.',
  concepts: [
    {
      heading: 'Each class is defined by one entry step',
      body: [
        'Every sodium-transporting cell has Na⁺-K⁺-ATPase on its basolateral side, which keeps intracellular sodium low so that filtered sodium can enter down a gradient. What differs between segments is the luminal entry mechanism, and that is what each class of diuretic blocks: the Na⁺-K⁺-2Cl⁻ cotransporter of the thick ascending limb (loop diuretics), the Na⁺-Cl⁻ cotransporter of the distal tubule and connecting segment (thiazides), and the aldosterone-sensitive sodium channel of the principal cell (amiloride and triamterene directly, spironolactone by blocking the receptor).',
        'Potency follows the size of the load at the blocked site, but only loosely, because what is not reabsorbed there can be reabsorbed further on. Loop diuretics can take up to 20–25% of the filtered sodium, thiazides at most 3–5%, potassium-sparing agents 1–2%.',
        'Acetazolamide illustrates why site alone does not determine potency. It acts proximally, where most of the filtered sodium is reabsorbed, yet is a weak diuretic — because the loop of Henle reabsorbs most of the extra fluid delivered to it, transport there being flow-dependent. Its diuretic action is also self-limiting, since the bicarbonate it wastes produces a metabolic acidosis.',
      ],
      points: [
        'Loop: NKCC2, thick ascending limb, up to 25% of filtered Na⁺',
        'Thiazide: NCC, distal tubule and connecting segment, 3–5%',
        'K⁺-sparing: ENaC in the principal cell, 1–2%',
        'Acetazolamide: carbonic anhydrase, proximal — weak, because the loop reclaims the overflow',
      ],
      cite: { rose: [15, 3, 4, 5], evidence: 'physiology', refs: ['brater1998'] },
      route: '/diuretics',
    },
    {
      heading: 'Why the diuresis stops: the new steady state',
      body: [
        'Give 40 mg of furosemide to a normal person eating 270 mmol of sodium a day and sodium excretion rises steeply for about six hours, then falls below baseline for the remaining eighteen. Over the whole day there is no net sodium loss at all. Nothing has gone wrong; the kidney has defended the volume the drug was removing.',
        'Three things restore balance. Neurohumoral activation raises reabsorption at sites the drug does not block — angiotensin II proximally, aldosterone in the collecting tubule. Increased delivery past the blocked segment drives flow-dependent reabsorption downstream, and with chronic loop diuretic use the distal tubule and collecting duct hypertrophy, with a measurable rise in Na⁺-K⁺-ATPase activity. Later, if renal perfusion falls, less drug is secreted into the lumen.',
        'The most instructive part of the experiment is what happens when the neurohumoral limb is blocked. Giving captopril and prazosin together did not prevent the secondary sodium retention: blood pressure fell by about 13 mmHg instead, and the lower perfusion pressure retained sodium directly by pressure natriuresis. The kidney has more than one way to defend volume, and removing one reveals another. It also explains what angiotensin II and noradrenaline are for — they hold blood pressure up while sodium is being retained, rather than letting pressure natriuresis worsen the hypovolaemia.',
      ],
      chain: [
        'Diuretic blocks one transporter',
        'Natriuresis for the hours the drug is acting',
        'Extracellular volume falls',
        'Renin–angiotensin–aldosterone and sympathetic activation; distal delivery rises; blood pressure falls',
        'Reabsorption rises at unblocked sites',
        'Excretion returns to equal intake — at a smaller extracellular volume',
      ],
      cite: { rose: [15, 8], evidence: 'experimental', refs: ['wilcox1983', 'loon1989', 'kaissling1988'] },
      route: '/diuretics',
    },
    {
      heading: 'How fast the new steady state arrives, and what that means for monitoring',
      body: [
        'Three normal subjects given 100 mg of hydrochlorothiazide daily on a constant diet lost sodium for only three days and potassium for six to nine, after which intake and output were equal again. The same limited net diuresis occurs in heart failure and cirrhosis, where the fall in cardiac filling pressures reduces cardiac output and activates the renin–angiotensin system.',
        'The clinical consequence is precise and useful: provided dose and dietary intake are stable, essentially all the fluid and electrolyte complications of a diuretic appear within the first two to three weeks. A patient three weeks into 25 mg of hydrochlorothiazide with normal electrolytes and a normal creatinine is unlikely to develop late hypokalaemia or hyponatraemia, and does not need bloods at every visit unless something new — vomiting, diarrhoea, a dose change — is superimposed. In hypertension, the whole fall in plasma potassium happens in the first two to four weeks and then stabilises.',
        'A second consequence: the maximum diuresis is the first dose. Once fluid has been lost, sodium-retaining mechanisms blunt everything that follows. In patients with chronic renal failure the peak natriuresis to a second bolus of bumetanide was about a quarter to a third less than to the first. The exception is the markedly volume-expanded patient in whom renin is already suppressed — there the second and later doses can work as well as the first until most of the excess fluid is gone. Even then, the first dose is still the largest response you will see.',
      ],
      points: [
        'Na⁺ lost for ~3 days, K⁺ for 6–9 days, on a fixed dose and diet',
        'Complications appear in the first 2–3 weeks, then stop appearing',
        'The first dose is the maximum response',
      ],
      cite: { rose: [15], evidence: 'experimental', refs: ['brater1998'] },
      route: '/diuretics',
    },
    {
      heading: 'Three ways to produce a net diuresis anyway',
      body: [
        'If a single daily dose gives six hours of natriuresis and eighteen of retention, there are only three levers. Restrict dietary sodium, so there is less to retain in the off-hours — the preferred approach, because it also limits potassium loss. Give the drug twice a day. Or raise the dose, accepting that a larger initial diuresis may cause symptomatic hypovolaemia.',
        'This is why a 24-hour urinary sodium is the first investigation in apparent diuretic resistance. A value above 100–150 mmol/day in a patient who is still oedematous means the diuretic is working and the diet is not restricted — not that the drug has failed. Recurrent oedema after hospital discharge, with no change in the underlying disease, is usually this.',
      ],
      cite: { rose: [15, 13], evidence: 'clinical' },
      route: '/diuretics',
    },
    {
      heading: 'The complications, and why each one happens',
      body: [
        'Volume depletion and pre-renal azotaemia follow from the fall in effective circulating volume. Urea rises more than creatinine, partly because the hypovolaemia-driven rise in sodium and water reabsorption carries urea with it passively, and partly — up to about a third of the rise — because urea production increases.',
        'Hypokalaemia and metabolic alkalosis go together. Both delivery of sodium and water to the distal secretory site and aldosterone are increased, so potassium secretion rises; hydrogen ion secretion rises for the same reasons, and the contraction of extracellular volume around a fixed amount of bicarbonate adds a contraction alkalosis. Loop diuretics add a further mechanism, since blocking NKCC2 in the cortical thick ascending limb shifts sodium entry onto Na⁺-H⁺ exchange.',
        'Hyponatraemia is almost always a thiazide problem, and the asymmetry is mechanistically informative. Thiazides act in the cortex and leave concentrating ability intact, so volume-stimulated ADH can retain water. Loop diuretics impair the medullary osmotic gradient itself, so ADH has less to work with.',
        'Hyperuricaemia tracks proximal sodium reabsorption rather than the drug: urate reabsorption varies directly with proximal sodium transport, so it rises with diuretic-induced volume depletion and does not occur if the fluid losses are replaced. Asymptomatic hyperuricaemia in this setting does not need treating.',
        'Potassium-sparing diuretics do the opposite: blocking the sodium channel removes the lumen-negative potential that drives both K⁺ and H⁺ secretion, giving hyperkalaemia and a metabolic acidosis. Hypomagnesaemia is usually mild, and is more a loop diuretic effect, since most filtered magnesium is reabsorbed in the loop.',
      ],
      points: [
        'Urea rises more than creatinine — passive reabsorption plus increased production',
        'Hyponatraemia: thiazides, not loops (cortical site spares the medullary gradient)',
        'Hyperuricaemia: a marker of proximal Na⁺ avidity, not of the drug',
        'K⁺-sparing agents: hyperkalaemia and acidosis, from the same voltage',
      ],
      cite: { rose: [15, 12, 18, 23], evidence: 'clinical', refs: ['brater1998'] },
      route: '/diuretics',
    },
    {
      heading: 'Dose matters more than class in hypertension',
      body: [
        'The metabolic penalties of thiazides are dose-dependent in a way the antihypertensive effect is not. Raising the dose produced progressive hypokalaemia, hyperuricaemia and a greater chance of a rise in glucose, with no further fall in blood pressure — plausibly because the extra volume depletion activates the renin–angiotensin system. As little as 12.5 mg of hydrochlorothiazide or 15 mg of chlorthalidone gives most of the blood-pressure effect with little change in potassium, glucose or urate.',
        'At 50 mg/day of hydrochlorothiazide, plasma potassium falls on average 0.4–0.6 mmol/L and about 15% of patients reach 3.5 mmol/L or below; with 50 mg of the longer-acting chlorthalidone the mean fall is 0.8–0.9 mmol/L. Whether mild hypokalaemia matters was unsettled when the book was written, and the chapter is careful about it: the concern is not the resting potassium but what happens under adrenergic stress, when epinephrine can drive an already low value considerably lower.',
      ],
      cite: { rose: [15, 12], evidence: 'clinical' },
      route: '/diuretics',
    },
    {
      heading: 'Refractory oedema: work through the list in order',
      body: [
        'Excess sodium intake first — measure the 24-hour urinary sodium. Then absorption: bowel wall oedema can delay intestinal absorption enough that a patient resistant to 240 mg of oral furosemide responds to 40 mg intravenously. Then delivery of the drug into the lumen: loop diuretics are highly protein bound, poorly filtered, and reach their target by proximal organic-anion secretion, so anything that competes with or reduces that secretion reduces the effect. The strategy is to double the single dose until a diuresis occurs or a ceiling is reached, not to give an ineffective dose more often.',
        'Then increased distal reabsorption, which is where sequential nephron blockade belongs. Chronic loop diuretic use hypertrophies the thiazide-sensitive distal tubule, so adding a thiazide to a loop produces a larger natriuresis than the same thiazide would in an untreated patient — about 20% greater in one study. A potassium-sparing agent is usually added to limit potassium loss rather than for its own natriuresis. This combination needs watching: previously refractory patients have lost 5 L of fluid and 200 mmol of potassium in a day.',
        'Finally, reduced delivery to the loop, from a low GFR and angiotensin-II-driven proximal reabsorption. Here acetazolamide can help, by reducing proximal reabsorption and so increasing delivery to the diuretic-sensitive segments — the one setting where a weak proximal diuretic becomes useful. Posture can also matter: supine position or head-down tilt raised creatinine clearance by as much as 40% and could double sodium excretion in heart failure and cirrhosis. If nothing works, fluid is removed mechanically.',
        'Cirrhosis is the exception to starting with a loop diuretic. Spironolactone is first choice there — partly because marked hyperaldosteronism means the fluid delivered out of the loop is reclaimed in the collecting tubule, and partly because spironolactone is the only diuretic that does not need to reach the tubular lumen. It enters the cell across the basolateral membrane, which matters when bile salts compete for the organic anion pump. The usual regimen is a single morning dose of spironolactone with furosemide, beginning at 100 mg and 40 mg, a ratio that usually keeps potassium normal.',
      ],
      chain: [
        'Still oedematous on a loop diuretic',
        'Check 24-h urinary Na⁺ — over 100–150 mmol/day means diet, not drug failure',
        'Check absorption: high-dose oral failing → intravenous',
        'Find the effective single dose by doubling, not by giving more often',
        'Add a thiazide (± K⁺-sparing) to block the hypertrophied distal site',
        'If loop delivery is the problem, add acetazolamide proximally',
      ],
      cite: { rose: [15, 16], evidence: 'clinical', refs: ['brater1998', 'loon1989'] },
      route: '/diuretics',
    },
    {
      heading: 'Prostaglandins, and why NSAIDs blunt a diuretic',
      body: [
        'Loop diuretics, and to a lesser extent thiazides, increase renal prostaglandin production. The vasodilator prostaglandins raise renal blood flow and, importantly in acute pulmonary oedema, cause venodilation and a rise in venous capacitance — which lowers cardiac filling pressures before any diuresis has occurred.',
        'Non-steroidal anti-inflammatory drugs block prostaglandin synthesis and reduce the diuresis furosemide produces. Whether this is loss of a natriuretic prostaglandin effect or renal ischaemia from unopposed angiotensin II and noradrenaline was not settled, and the chapter says so.',
      ],
      cite: { rose: [15, 2], evidence: 'physiology' },
      route: '/diuretics',
    },
  ],
  numbers: [
    { label: 'Maximum FENa — loop diuretic', value: '20–25%' },
    { label: 'Maximum FENa — thiazide', value: '3–5%' },
    { label: 'Maximum FENa — K⁺-sparing', value: '1–2%' },
    { label: 'Duration of a furosemide dose', value: '~6 h of natriuresis, 18 h of retention' },
    { label: 'Net Na⁺ loss on 100 mg HCTZ daily', value: 'only the first 3 days' },
    { label: 'Net K⁺ loss on 100 mg HCTZ daily', value: 'first 6–9 days' },
    { label: 'When complications appear', value: 'first 2–3 weeks, on a fixed dose and diet' },
    { label: 'Second bolus response', value: '~25–33% less than the first' },
    { label: 'Maximum effective IV furosemide', value: '40 mg normally; 160–200 mg in renal failure' },
    { label: 'Oral : IV furosemide', value: '2 : 1 (about half is absorbed)' },
    { label: 'Bumetanide : furosemide potency', value: '1 : 40 (1 : 20 in renal failure)' },
    { label: 'Urinary Na⁺ suggesting dietary non-adherence', value: '> 100–150 mmol/day' },
    { label: 'Fall in plasma K⁺ on 50 mg HCTZ', value: '0.4–0.6 mmol/L (15% reach ≤ 3.5)' },
    { label: 'Fall in plasma K⁺ on 50 mg chlorthalidone', value: '0.8–0.9 mmol/L' },
    { label: 'Low-dose thiazide', value: '12.5 mg HCTZ or 15 mg chlorthalidone — most of the BP effect' },
    { label: 'Cirrhosis starting regimen', value: 'spironolactone 100 mg + furosemide 40 mg, single morning dose' },
    { label: 'Thiazides become ineffective below', value: 'GFR ~20 mL/min, unless combined with a loop' },
  ],
  equations: ['fena', 'feurea'],
  clinical: [
    'A diuretic produces a limited, self-terminating net fluid loss. If you expect continued weight loss on an unchanged dose and diet, you will be disappointed — and if you keep escalating, you will produce hypovolaemia.',
    'The first dose is the largest response. Judge efficacy on it, and find the effective single dose by doubling rather than by giving an ineffective dose more often.',
    'On a stable dose and diet, complications declare themselves in the first two to three weeks. Repeat electrolytes then; afterwards, only when something changes.',
    'Measure a 24-hour urinary sodium before calling a patient diuretic-resistant. Over 100–150 mmol/day means the drug is working and the diet is not.',
    'Use the lowest thiazide dose that controls blood pressure: the metabolic penalties keep rising with dose while the antihypertensive effect does not.',
    'Thiazides cause hyponatraemia; loop diuretics much less so, because they destroy the medullary gradient ADH needs.',
    'Sequential nephron blockade works because the distal tubule hypertrophies on chronic loop therapy — but it can remove far more fluid and potassium than expected. Start low and monitor on day one.',
    'In cirrhosis, start with spironolactone, not a loop diuretic.',
    'Never give a potassium-sparing diuretic casually to a patient with renal impairment, on an ACE inhibitor, or on potassium supplements.',
    'NSAIDs blunt the response to a loop diuretic.',
  ],
  pathology: [
    { name: 'Diuretic braking', broken: 'Nothing — this is the intact response', consequence: 'Natriuresis wanes within hours to days; a new steady state at a smaller ECF', route: '/diuretics' },
    { name: 'Diuretic resistance — dietary', broken: 'Adherence, not physiology', consequence: 'Oedema persists with a urinary Na⁺ above 100–150 mmol/day', route: '/diuretics' },
    { name: 'Diuretic resistance — distal hypertrophy', broken: 'Distal tubule reabsorptive capacity has increased', consequence: 'Loop diuretic effect blunted; a thiazide now produces a larger-than-normal natriuresis', route: '/diuretics' },
    { name: 'Diuretic resistance — low loop delivery', broken: 'GFR and proximal reabsorption', consequence: 'Too little sodium reaches the loop for the drug to block; acetazolamide may help', route: '/diuretics' },
    { name: 'Thiazide-induced hyponatraemia', broken: 'Water excretion, with concentrating ability intact', consequence: 'ADH-driven water retention lowers plasma Na⁺', route: '/hyponatremia' },
    { name: 'Contraction alkalosis with hypokalaemia', broken: 'Distal H⁺ and K⁺ secretion, plus ECF contraction', consequence: 'Metabolic alkalosis with hypokalaemia; acetazolamide corrects it without saline', route: '/metabolic-alkalosis' },
    { name: 'K⁺-sparing diuretic toxicity', broken: 'ENaC-generated lumen-negative voltage', consequence: 'Hyperkalaemia and metabolic acidosis (type 4 pattern)', route: '/hyperkalemia' },
    { name: 'Diuretic-induced hyperuricaemia', broken: 'Nothing renal — proximal Na⁺ avidity rises', consequence: 'Plasma urate rises; absent if fluid losses are replaced', route: '/proximal' },
  ],
  questions: [
    {
      q: 'A normal subject eating 270 mmol of sodium a day is given 40 mg of furosemide. What is the net sodium balance over 24 hours?',
      options: ['Strongly negative', 'About zero — six hours of natriuresis followed by eighteen of retention', 'Positive', 'Unpredictable'],
      answer: 1,
      explanation:
        'This is Rose Fig. 15-1. The natriuresis is real but is exactly offset once the drug wears off. To get net loss you must restrict sodium, dose twice daily, or raise the dose.',
      route: '/diuretics',
    },
    {
      q: 'Captopril and prazosin are given with the furosemide to block the renin–angiotensin and sympathetic responses. What happens to the secondary sodium retention?',
      options: ['It is abolished', 'It still occurs — blood pressure falls about 13 mmHg and pressure natriuresis is lost instead', 'It doubles', 'Sodium excretion becomes uncontrolled'],
      answer: 1,
      explanation:
        'The kidney has more than one way to defend volume. Removing the neurohumoral limb exposes the pressure limb. It also shows what those hormones are for: holding pressure up so that pressure natriuresis does not deepen the hypovolaemia.',
      route: '/diuretics',
    },
    {
      q: 'A patient has been on 25 mg of hydrochlorothiazide for three weeks with normal potassium, sodium and creatinine, on a stable diet. How often should electrolytes be repeated?',
      options: ['Every visit indefinitely', 'Not routinely — complications on a fixed dose and diet appear in the first 2–3 weeks', 'Weekly', 'Monthly for a year'],
      answer: 1,
      explanation:
        'Once the new steady state is established the abnormalities do not appear late. Recheck when something changes: the dose, the diet, an intercurrent illness, or a new drug.',
      route: '/diuretics',
    },
    {
      q: 'Why does adding a thiazide to chronic furosemide produce a bigger natriuresis than the same thiazide alone?',
      options: [
        'Thiazides are more potent than loop diuretics',
        'Chronic loop therapy hypertrophies the thiazide-sensitive distal tubule, so more sodium is being reabsorbed there to block',
        'The two drugs bind the same transporter',
        'Furosemide raises GFR',
      ],
      answer: 1,
      explanation:
        'Increased distal delivery causes distal hypertrophy and a rise in Na⁺-K⁺-ATPase activity. Blocking a site that is now doing more work yields more. The same logic explains why the combination can overshoot badly.',
      route: '/diuretics',
    },
    {
      q: 'Why is hyponatraemia far more common with thiazides than with loop diuretics?',
      options: [
        'Thiazides cause more volume depletion',
        'Thiazides act in the cortex and leave the medullary osmotic gradient intact, so ADH can still retain water',
        'Loop diuretics suppress ADH',
        'Thiazides directly stimulate thirst',
      ],
      answer: 1,
      explanation:
        'Both cause volume depletion and both raise ADH. Only the loop diuretic destroys the gradient that ADH needs in order to reabsorb water, which limits the fall in plasma sodium.',
      route: '/hyponatremia',
    },
    {
      q: 'Why is spironolactone the first choice in cirrhotic ascites?',
      options: [
        'It is the most potent diuretic',
        'Marked hyperaldosteronism means fluid is reclaimed distally, and spironolactone is the only diuretic that does not need to reach the tubular lumen',
        'It raises albumin',
        'It improves liver function',
      ],
      answer: 1,
      explanation:
        'It reaches its receptor from the blood side, across the basolateral membrane, so competition from bile salts for the proximal organic anion pump does not matter. Avoiding hypokalaemia also matters, since hypokalaemia can precipitate encephalopathy.',
      route: '/diuretics',
    },
  ],
  updates: [
    {
      topic: 'Bolus versus infusion, high versus low dose',
      text: 'The chapter prefers a continuous infusion to boluses, reasoning from the drug-excretion-rate curve, and cites a bumetanide study in chronic renal failure. The DOSE trial then randomised patients with acute decompensated heart failure to bolus versus continuous infusion and to low versus high dose, and found no significant difference between bolus and infusion in symptoms or renal function, with only a non-significant trend favouring the higher dose. The pharmacological reasoning still holds and infusions remain reasonable in selected patients; the expectation of a clear clinical advantage does not.',
      cite: { refs: ['felker2011dose'], evidence: 'clinical' },
    },
    {
      topic: 'Acetazolamide for refractory congestion — the book’s prediction tested',
      text: 'Rose suggests acetazolamide when reduced delivery to the loop limits the diuretic response. ADVOR randomised 519 patients with acute decompensated heart failure to intravenous acetazolamide or placebo added to a loop diuretic: successful decongestion within three days occurred in 42.2% versus 30.5% (risk ratio 1.46, 95% CI 1.17–1.82), with higher urine output and natriuresis. There was no difference in death or rehospitalisation (hazard ratio 1.07, 95% CI 0.78–1.48). The mechanism the chapter proposes was confirmed; the benefit demonstrated is decongestion, not survival.',
      cite: { refs: ['mullens2022advor'], evidence: 'clinical' },
    },
    {
      topic: 'Sequential nephron blockade tested',
      text: 'CLOROTIC randomised 230 patients with acute heart failure to hydrochlorothiazide or placebo added to intravenous furosemide. The thiazide group lost more weight at 72 hours (2.3 vs 1.5 kg) and had greater diuresis and greater weight loss per 40 mg of furosemide, with no difference in dyspnoea, mortality or rehospitalisation — and substantially more impairment of renal function (46.5% vs 17.2%). This is the chapter’s own warning, quantified: combination therapy works on the physiology and needs close monitoring.',
      cite: { refs: ['trullas2023clorotic'], evidence: 'clinical' },
    },
    {
      topic: 'Mineralocorticoid antagonists became disease-modifying drugs',
      text: 'The chapter treats spironolactone as a weak diuretic with a special role in cirrhosis. RALES then showed that 25 mg daily added to standard therapy in severe heart failure reduced death from 46% to 35% (relative risk 0.70, 95% CI 0.60–0.82) — a mortality benefit at a dose too small to be meaningfully natriuretic. Mineralocorticoid receptor antagonists are now used in heart failure, resistant hypertension and chronic kidney disease for reasons largely unrelated to diuresis.',
      cite: { refs: ['pitt1999rales'], evidence: 'clinical' },
    },
    {
      topic: 'Chlorthalidone versus hydrochlorothiazide',
      text: 'The chapter notes chlorthalidone is longer-acting and causes more potassium loss at equal milligrams, which is still true. Whether that translates into better outcomes was tested in a pragmatic trial of 13,523 patients: cardiovascular events were no different (10.4% vs 10.0%, hazard ratio 1.04, 95% CI 0.94–1.16), while hypokalaemia was more common with chlorthalidone (6.0% vs 4.4%). At the doses actually used in practice, the choice between them appears to matter less than the chapter’s emphasis on using a low dose.',
      cite: { refs: ['ishani2022dcp'], evidence: 'clinical' },
    },
  ],
  modules: ['/diuretics', '/edema', '/transport'],
};
