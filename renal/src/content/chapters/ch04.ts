import type { ChapterContent } from './types';

export const chapter: ChapterContent = {
  n: 4,
  title: 'Loop of Henle and the countercurrent mechanism',
  thesis:
    'The loop reabsorbs 25–35% of filtered NaCl, mostly in the thick ascending limb, and — crucially — it reabsorbs salt without water. That single fact both dilutes the tubular fluid (making a dilute urine possible) and loads the medullary interstitium with solute (making a concentrated urine possible). Countercurrent flow multiplies a modest transverse gradient into a corticomedullary gradient of up to ~1200 mOsm/kg; urea recycling supplies about half of it; the vasa recta preserve it by exchange; and ADH decides, in the collecting duct, which kind of urine is actually excreted.',
  concepts: [
    {
      heading: 'Four segments, two jobs',
      body: [
        'The 40–45% of filtrate leaving the proximal tubule enters the descending limb, the thin ascending limb (only in long loops), the medullary thick ascending limb and the cortical thick ascending limb, which ends at the macula densa. Together they reabsorb 25–35% of filtered NaCl, almost all of it in the thick limb, and reabsorb NaCl in excess of water.',
        'Their permeabilities differ sharply: the descending limb is permeable to water (aquaporin-1) and somewhat to NaCl and urea; both ascending segments are water-impermeable; the thin ascending limb is permeable to NaCl; the thick limb transports NaCl actively.',
      ],
      points: ['Descending limb: water ++, NaCl ± to ++, urea ± to +', 'Thin ascending limb: NaCl ++, urea +, water 0', 'Thick ascending limb: active NaCl, water 0, urea 0', 'Collecting tubules: water only with ADH; urea permeable only in the innermost medullary collecting duct'],
      route: '/loop',
      cite: { rose: [4], evidence: 'physiology' },
    },
    {
      heading: 'The thick ascending limb cell',
      body: [
        'NaCl enters across the apical membrane on the electroneutral Na⁺-K⁺-2Cl⁻ cotransporter (NKCC2), which needs all four sites filled: removing sodium, chloride or potassium from the lumen each stops transport. Sodium leaves basolaterally on the Na⁺-K⁺-ATPase (whose activity is highest here of any segment); chloride leaves through basolateral chloride channels (ClC-Kb with barttin).',
        'The carrier is saturated for Na⁺ and K⁺ below 5–10 mmol/L, so luminal chloride sets its rate. Loop diuretics compete for the chloride site.',
        'Luminal potassium would be limiting, but it is recycled back into the lumen through apical ROMK channels, whose opening is tied to transport through cell ATP. K⁺ recycling plus basolateral Cl⁻ exit create a lumen-positive voltage that drives about half of the thick limb’s sodium reabsorption — and its calcium and magnesium reabsorption — through the paracellular pathway.',
        'Mutations in NKCC2, ROMK or the basolateral chloride channel each cause Bartter syndrome, which mimics a loop diuretic: hypokalaemia, metabolic alkalosis and hypercalciuria.',
      ],
      chain: ['Na⁺-K⁺-ATPase keeps cell Na⁺ low', 'NKCC2 brings in 1 Na⁺, 1 K⁺, 2 Cl⁻', 'K⁺ recycles through ROMK; Cl⁻ exits basolaterally', 'Lumen-positive voltage', 'Paracellular Na⁺, Ca²⁺, Mg²⁺ reabsorption'],
      route: '/loop',
      cite: { rose: [4], evidence: 'physiology', refs: ['mount2014'] },
    },
    {
      heading: 'Efficiency in an oxygen-poor medulla',
      body: [
        'Because one of the two Na⁺ ions reabsorbed per two Cl⁻ goes paracellularly, the energy cost per sodium is halved. That matters: the medulla gets under 10% of renal blood flow, and oxygen shunts across the hairpin vasa recta, so the PO₂ around outer-medullary thick limbs can be only 10–20 mmHg.',
        'This borderline oxygenation explains why the thick ascending limb and the S3 segment of the proximal tubule (both in the outer medulla) are preferentially injured in ischaemic acute tubular necrosis. In ischaemia the thick limb itself turns down NaCl transport (cytochrome P450 metabolites, adenosine), perhaps protectively.',
      ],
      route: '/aki',
      cite: { rose: [4], evidence: 'experimental' },
    },
    {
      heading: 'Other thick-limb roles: bicarbonate, ammonium, calcium, magnesium',
      body: [
        'The medullary thick limb reabsorbs most of the bicarbonate leaving the proximal tubule (via Na⁺/H⁺ exchange), more in acidaemia and less in alkalaemia. It also reabsorbs NH₄⁺, which substitutes for K⁺ on NKCC2 — the first step of medullary ammonia recycling that maximises ammonium excretion.',
        'The basolateral calcium-sensing receptor, activated by a rise in plasma calcium (or magnesium), inhibits apical K⁺ recycling; less NKCC2 activity means a smaller lumen-positive voltage and less paracellular Ca²⁺ and Mg²⁺ reabsorption — part of the calciuric response to a calcium load.',
        'More than half of filtered magnesium is reabsorbed in the cortical thick limb, paracellularly; PTH adds regulated calcium reabsorption here and in the distal tubule.',
      ],
      route: '/minerals',
      cite: { rose: [4], evidence: 'physiology', refs: ['hou2013'] },
    },
    {
      heading: 'Load dependence: the limiting chloride gradient',
      body: [
        'Like the proximal tubule, the loop reabsorbs a roughly constant fraction of what it receives. But the limit is different: because the thick limb is water-impermeable, reabsorbing NaCl lowers luminal chloride, which both slows NKCC2 and favours back-leak between the cells, until influx equals back-flux at a minimum chloride of ~50–75 mmol/L.',
        'If more fluid arrives, luminal chloride stays higher further along, so more is reabsorbed. ADH (at least in some species) stimulates medullary NaCl entry via cAMP; the medullary segment then takes more and the cortical segment less, improving concentration without changing total loop reabsorption.',
      ],
      route: '/loop',
      cite: { rose: [4], evidence: 'physiology' },
    },
    {
      heading: 'Concentrating and diluting: the overview',
      body: [
        'To concentrate: NaCl reabsorbed without water in the medullary ascending limb (plus urea from the inner medullary collecting duct) makes the medullary interstitium hyperosmotic; urine then equilibrates with it in the medullary collecting duct — but only if ADH has made that duct water-permeable. Water reabsorbed in the cortical collecting duct first shrinks the volume that reaches the medulla, so the medulla is not diluted; the hairpin vasa recta avoid washing the solute away.',
        'To dilute: the same NaCl reabsorption without water makes the fluid leaving the loop hypo-osmotic (~100 mOsm/kg); without ADH the collecting ducts stay water-impermeable and continued NaCl reabsorption there lowers it further, to 50–75 mOsm/kg.',
        'The fluid leaving the loop is similar in volume and osmolality whether the final urine is concentrated or dilute. The collecting duct, under ADH, decides.',
      ],
      chain: ['Thick limb: NaCl out, water stays', 'Tubular fluid dilute (~100 mOsm/kg) + medulla concentrated', 'ADH present: collecting duct equilibrates → concentrated urine', 'ADH absent: collecting duct impermeable → dilute urine (50–75)'],
      route: '/urine-osmolality',
      cite: { rose: [4], evidence: 'physiology' },
    },
    {
      heading: 'Countercurrent multiplication',
      body: [
        'Imagine the loop, interstitium and fluid all at 285 mOsm/kg. The ascending limb pumps NaCl out until a modest transverse gradient (say 200 mOsm/kg) exists between it and the interstitium; the descending limb equilibrates with the interstitium by losing water. Now let the fluid move: hyperosmotic fluid from the descending limb flows round into the ascending limb, which pumps again to re-establish the same 200 mOsm/kg gradient — but starting from a higher osmolality. Repeat, and the small “single effect” is multiplied along the loop into a large axial gradient, highest at the hairpin and papillary tip.',
        'The final gradient scales with the length of the loop and the size of the single effect. Only the 30–40% of nephrons with long loops contribute substantially. Humans reach 900–1400 mOsm/kg; desert rodents with longer loops reach ~5000.',
        'The only active step is NaCl transport in the thick ascending limb; the descending and thin ascending limbs work passively.',
      ],
      chain: ['Active NaCl pump out of ascending limb (single effect)', 'Descending limb equilibrates by losing water', 'Countercurrent flow carries concentrated fluid to the ascending limb', 'Single effect repeated at a higher starting osmolality', 'Axial gradient 285 → ~1200 mOsm/kg'],
      route: '/countercurrent',
      cite: { rose: [4], evidence: 'physiology', refs: ['kokko1972', 'stephenson1972'] },
    },
    {
      heading: 'The collecting ducts finish the job',
      body: [
        'Collecting ducts are impermeable to NaCl, so interstitial NaCl acts as an effective osmotic gradient. With ADH, aquaporin-2 lets water leave toward the interstitium.',
        'The cortical collecting duct is as important as the medullary one: with ADH, fluid arriving at ~100 mOsm/kg equilibrates with the isosmotic cortex, removing about two-thirds of its water (plus more following aldosterone-driven NaCl reabsorption). The high cortical blood flow carries this water away without diluting anything. The medulla then receives a small volume, so concentrating it barely dilutes the interstitium.',
        'ADH secretion rises with plasma osmolality (thirst’s threshold is a few mOsm higher), so a water load lowers ADH and urine osmolality and a water deficit raises both. Its effects are graded: a typical day (≈800 mOsm of solute in 2 L, ≈400 mOsm/kg) uses a submaximal response.',
      ],
      route: '/adh',
      cite: { rose: [4], evidence: 'physiology' },
    },
    {
      heading: 'Urea: half the papillary osmolality',
      body: [
        'Nearly half of the ~1200 mOsm/kg at the papillary tip in antidiuresis is urea. As ADH-dependent water reabsorption proceeds in the urea-impermeable cortical and outer medullary collecting ducts, tubular urea concentration climbs; in the innermost medullary collecting duct, urea transporters (UT-A1, whose number ADH increases) let it diffuse out into the interstitium.',
        'Some of that urea re-enters the thin limbs (via a second transporter) and recirculates, so the urea reaching the early distal tubule can equal or exceed the filtered amount even though 60–65% was reabsorbed proximally.',
        'Urea accumulation lets large amounts of urea be excreted without obligating water, and it helps concentrate NaCl in the descending limb (by extracting water), which favours passive NaCl exit from the thin ascending limb.',
        'Without ADH (water loading, diabetes insipidus), urea accumulation almost disappears and NaCl accumulation also falls; papillary osmolality drops. In humans, three days of high fluid intake reduced maximal urine osmolality after ADH from ~1180 to ~760 mOsm/kg — medullary washout. A low-protein diet reduces urea delivery and so concentrating ability.',
      ],
      chain: ['ADH: water leaves cortical/outer medullary CD, urea stays', 'Luminal urea concentration rises', 'ADH-sensitive UT-A1 in inner medullary CD', 'Urea diffuses into inner medullary interstitium', 'Some recycles into thin limbs', '≈½ of papillary osmolality is urea'],
      route: '/urea',
      cite: { rose: [4], evidence: 'physiology', refs: ['fenton2004', 'sands2009', 'klein2011'] },
    },
    {
      heading: 'The thin ascending limb: passive, but not fully explained',
      body: [
        'The classic passive model: descending-limb fluid concentrates mostly by losing water, so its NaCl concentration becomes very high (≈600 mmol/L at the tip) — higher than interstitial NaCl, because half the interstitial osmolality is urea. In the NaCl-permeable, urea-poorly-permeable, water-impermeable thin ascending limb, NaCl then diffuses out, diluting the fluid without active transport.',
        'The model’s weakness: if part of the descending limb equilibrates by urea entry rather than water loss, the NaCl gradient is too small. How the thin ascending limb reabsorbs enough NaCl remains incompletely understood; some active component may exist. Chloride exits through the channel ClC-K1, whose knockout causes polyuria.',
      ],
      route: '/countercurrent',
      cite: { rose: [4], evidence: 'experimental', update: 'Computational models of the inner medulla still struggle to reproduce the concentrating ability observed; the mechanism of inner-medullary concentration remains an open question.', refs: ['dantzler2014'] },
    },
    {
      heading: 'Countercurrent exchange in the vasa recta',
      body: [
        'The vasa recta are hairpin capillaries from juxtamedullary efferent arterioles. They must remove the water and NaCl reabsorbed in the medulla — and their Starling forces (oncotic ~26 mmHg versus hydraulic ~9 mmHg at the tip) favour uptake, so ascending flow is almost twice descending flow.',
        'Being freely permeable, they equilibrate with the interstitium: in the descending limb solute enters and water leaves; in the ascending limb solute leaves and water re-enters. Because the vessels turn round rather than exiting at the papilla, what is lost on the way down is recovered on the way up — exchange, not multiplication. Blood returns to the cortex only slightly hyperosmotic (~325 mOsm/kg). Exchange is driven by pre-existing gradients, not by Starling forces.',
        'Medullary flow is deliberately low (~6% of renal blood flow). If it rises, more solute leaves at 325 mOsm/kg and the gradient washes out: less water leaves the descending limb, less NaCl leaves the thin ascending limb, and concentrating ability falls. This happens in osmotic diuresis (glucose, mannitol), where medullary flow rises and papillary osmolality falls.',
      ],
      chain: ['↑ Medullary blood flow (osmotic diuresis)', 'More solute carried out of the medulla', '↓ Papillary osmolality (washout)', '↓ Descending-limb water removal and thin-limb NaCl exit', '↑ Urine volume and Na⁺ excretion'],
      route: '/vasa-recta',
      cite: { rose: [4], evidence: 'physiology', refs: ['pallone2003'] },
    },
    {
      heading: 'When ADH is absent but volume is low',
      body: [
        'Without ADH, urine osmolality is normally below 100 mOsm/kg and output can exceed 10 L/day. But superimpose effective volume depletion: GFR falls and proximal reabsorption rises, so very little water reaches the collecting ducts; the inner medullary collecting duct’s small ADH-independent water permeability can then raise urine osmolality to 400 mOsm/kg or more. Diabetes insipidus can be masked until volume is restored.',
      ],
      route: '/water-disorders',
      cite: { rose: [4], evidence: 'clinical' },
    },
    {
      heading: 'Medullary cells survive enormous osmotic swings',
      body: [
        'Thick-limb and inner-medullary collecting-duct cells face interstitial osmolality that can change several-fold. They defend their volume first with NaCl uptake (Na⁺/H⁺ and Cl⁻/HCO₃⁻ exchange) and then by accumulating organic osmolytes — sorbitol (via aldose reductase), inositol and betaine (Na⁺-coupled uptake), glycerophosphocholine — which, unlike Na⁺ and K⁺, do not disturb enzyme function. When the medulla becomes dilute they release them.',
      ],
      cite: { rose: [4], evidence: 'experimental' },
    },
    {
      heading: 'Tamm–Horsfall protein and casts',
      body: [
        'The thick ascending limb secretes Tamm–Horsfall protein (uromodulin), the matrix of every urinary cast. Hyaline casts contain only matrix and can appear with exercise or fever; granular casts contain degenerated cells or protein; cellular casts trap red cells, white cells or epithelial cells — red cell casts are nearly diagnostic of glomerulonephritis or vasculitis. Coaggregation of certain light chains with uromodulin produces myeloma cast nephropathy.',
      ],
      route: '/glomerular',
      cite: { rose: [4], evidence: 'clinical' },
    },
  ],
  numbers: [
    { label: 'Filtered NaCl reabsorbed in the loop', value: '25–35%' },
    { label: 'Long-looped nephrons', value: '30–40%' },
    { label: 'NKCC2 saturation for Na⁺, K⁺', value: '<5–10 mmol/L (Cl⁻ is rate-limiting)' },
    { label: 'Paracellular share of thick-limb Na⁺ reabsorption', value: '≈½' },
    { label: 'Minimum thick-limb [Cl⁻]', value: '50–75 mmol/L' },
    { label: 'Fluid leaving the loop', value: '≈100 mOsm/kg' },
    { label: 'Minimum urine osmolality', value: '50–75 mOsm/kg' },
    { label: 'Maximum urine osmolality (humans)', value: '900–1400 mOsm/kg' },
    { label: 'Urea share of papillary osmolality', value: '≈½' },
    { label: 'Outer medullary PO₂', value: '10–20 mmHg' },
    { label: 'Medullary blood flow', value: '≈6% of RBF' },
    { label: 'Blood leaving the medulla', value: '≈325 mOsm/kg' },
    { label: 'Water removed in the cortical collecting duct with ADH', value: '≈⅔ of delivered volume' },
    { label: 'Effect of 3 days of water loading', value: 'max Uosm ≈1180 → 760 mOsm/kg' },
  ],
  equations: ['cosm', 'ch2o'],
  clinical: [
    'Loop diuretics and Bartter syndrome impair both concentration and dilution, because the thick ascending limb does both.',
    'The thick ascending limb and S3 proximal tubule, in the hypoxic outer medulla, are the segments most injured in ischaemic acute tubular necrosis.',
    'Osmotic diuresis (hyperglycaemia, mannitol) washes out the medulla via increased medullary blood flow.',
    'Chronic high water intake or diabetes insipidus reduces maximal concentrating ability (medullary washout), which can complicate the water deprivation test.',
    'A low-protein diet reduces maximal concentrating ability by limiting urea.',
    'Diabetes insipidus can be masked by volume depletion, which limits delivery to the collecting duct.',
    'Red cell casts point to glomerulonephritis or vasculitis; light chain–uromodulin casts cause myeloma kidney.',
  ],
  pathology: [
    { name: 'Bartter syndrome', broken: 'NKCC2, ROMK or the basolateral Cl⁻ channel (ClC-Kb/barttin)', consequence: 'Salt wasting, impaired concentration and dilution, hypercalciuria, and (via increased distal delivery and aldosterone) hypokalaemic alkalosis', route: '/inherited' },
    { name: 'Loop diuretic', broken: 'NKCC2 chloride site', consequence: 'Natriuresis; medullary gradient falls; Ca²⁺ and Mg²⁺ wasting; renin rises', route: '/diuretics' },
    { name: 'Familial hypomagnesaemia with hypercalciuria', broken: 'Paracellin-1 (claudin-16)', consequence: 'Mg²⁺ and Ca²⁺ wasting despite normal NaCl transport', route: '/minerals' },
    { name: 'Osmotic diuresis', broken: 'Medullary blood flow ↑ → washout; descending-limb water removal ↓', consequence: 'Lower papillary osmolality; more urine water and sodium', route: '/vasa-recta' },
    { name: 'Water loading / central DI', broken: 'Urea accumulation (needs ADH)', consequence: 'Papillary osmolality falls; even exogenous ADH cannot fully concentrate at first', route: '/urea' },
    { name: 'Ischaemic ATN', broken: 'Oxygen supply to outer-medullary TAL and S3', consequence: 'Tubular injury in the segments with the least oxygen margin', route: '/aki' },
  ],
  questions: [
    {
      q: 'A non-osmotic diuretic impairs both urinary concentration and dilution. Where does it act?',
      options: ['Proximal tubule', 'Thick ascending limb', 'Distal convoluted tubule', 'Collecting duct'],
      answer: 1,
      explanation: 'The thick ascending limb both builds the medullary gradient (needed to concentrate) and dilutes the tubular fluid (needed to dilute). A diuretic acting in the cortical diluting segment (the distal convoluted tubule — thiazides) impairs dilution but not concentration.',
      route: '/diuretics',
    },
    {
      q: 'If ADH stimulated medullary thick-limb NaCl transport, what would happen to NaCl delivery out of the cortical thick limb?',
      options: ['Fall substantially', 'Little change — the cortical segment reabsorbs less because luminal Cl⁻ reaches its limiting concentration sooner', 'Rise', 'Stop'],
      answer: 1,
      explanation: 'Reabsorption continues until the limiting chloride gradient (~50–75 mmol/L). More reabsorption in the medulla leaves less for the cortex, so total loop transport and distal delivery change little — but concentrating ability improves.',
      route: '/loop',
    },
    {
      q: 'How is water reabsorbed in the descending limb, and what happens to it during an osmotic diuresis?',
      options: ['Actively; it rises', 'Passively, by osmosis into the hypertonic interstitium; it falls because the medulla is washed out', 'Through aquaporin-2 under ADH; unchanged', 'It is not reabsorbed'],
      answer: 1,
      explanation: 'Aquaporin-1 lets water follow the interstitial osmotic gradient. Osmotic diuresis increases medullary blood flow and lowers papillary osmolality, so less water leaves; the ensuing smaller rise in luminal NaCl also reduces thin-limb NaCl exit.',
      route: '/vasa-recta',
    },
    {
      q: 'Effect of a low-protein diet on maximal urine osmolality?',
      options: ['Increase', 'Decrease — less urea to accumulate in the inner medulla', 'No effect', 'Depends on sodium intake only'],
      answer: 1,
      explanation: 'Urea supplies about half the papillary osmolality. Less urea production, less medullary urea, a lower maximal urine osmolality.',
      route: '/urea',
    },
    {
      q: 'What makes the vasa recta preserve rather than dissipate the medullary gradient?',
      options: ['They are impermeable to solute', 'Their hairpin shape: solute gained descending is lost again ascending (countercurrent exchange), and flow is low', 'They pump NaCl into the interstitium', 'Their high hydraulic pressure'],
      answer: 1,
      explanation: 'Exchange requires the hairpin, not special permeability. Raising flow increases the solute carried away and washes the gradient out.',
      route: '/vasa-recta',
    },
    {
      q: 'Why is the cortical collecting duct important for maximal concentration?',
      options: ['It pumps urea', 'With ADH it removes ~⅔ of the delivered water in the cortex, so little water enters (and dilutes) the medulla', 'It generates the medullary gradient', 'It secretes ADH'],
      answer: 1,
      explanation: 'The cortex, with its high blood flow, can absorb this water without dilution. The medullary collecting duct then concentrates a small volume without washing out the papilla.',
      route: '/urine-osmolality',
    },
  ],
  updates: [
    {
      topic: 'Molecular Bartter syndrome',
      text: 'Five genetic types are now recognised: NKCC2 (type 1), ROMK (type 2), ClC-Kb (type 3), barttin (type 4a, with deafness) or both ClC-Ka and ClC-Kb (4b), and a transient antenatal form due to MAGED2 (type 5). Gain-of-function CaSR variants cause a Bartter-like phenotype.',
      cite: { evidence: 'clinical', refs: ['konrad2021', 'simon1996bartter'] },
    },
  ],
};
