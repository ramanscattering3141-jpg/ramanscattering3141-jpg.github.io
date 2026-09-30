import type { ChapterContent } from './types';

export const chapter: ChapterContent = {
  n: 22,
  title: 'Introduction to disorders of osmolality',
  thesis:
    'The plasma sodium concentration is a ratio — exchangeable sodium plus exchangeable potassium over total body water — and a ratio tells you nothing about either number on its own. So hyponatraemia and hypernatraemia are almost always disorders of water balance, not of sodium balance, and the plasma sodium gives no information at all about the extracellular volume. Two separate regulatory systems are at work: one senses osmolality and answers with thirst and antidiuretic hormone, the other senses the effective circulating volume and answers with renin, aldosterone and the sympathetic nerves. When they conflict, volume wins.',
  concepts: [
    {
      heading: 'One solute per compartment',
      body: [
        'Total body water is about 60 per cent of lean body weight in men and 50 in women, split roughly 60:40 between cells and extracellular fluid, with about a fifth of the extracellular fluid inside blood vessels. Each compartment is held open by a solute confined to it: sodium salts extracellularly, potassium salts intracellularly, plasma proteins intravascularly.',
        'Urea is the exception that defines the rule. It crosses cell membranes readily and equilibrates through total body water, so it raises the measured osmolality without moving any water between compartments. It is an ineffective osmole, which is why the hyperosmolality of renal failure produces none of the symptoms that the same figure would produce if it were sodium or glucose — and why calculating the effective osmolality means leaving the urea out.',
        'Cell membranes are freely permeable to water, so the two compartments are always in osmotic equilibrium. Any osmotic gradient is abolished by water flowing down it, and it is that flow — in and out of brain cells — that produces the symptoms of hyponatraemia and hypernatraemia.',
      ],
      chain: [
        'Effective osmolality of the extracellular fluid changes',
        'Water flows across cell membranes until osmolality is equal again',
        'Brain cell volume changes',
        'Symptoms — and the rate of change matters more than the level',
      ],
      points: [
        '100 kg person, round numbers: 60 L total, 40 L intracellular, 20 L extracellular (15 L interstitial, 5 L plasma)',
        'Urea is an ineffective osmole; sodium and glucose are effective',
        'Effective osmolality ≈ 2 × [Na⁺] + glucose (in mmol/L)',
      ],
      cite: { rose: [22, 7, 9], evidence: 'physiology' },
      route: '/body-water',
      equation: 'effosm',
    },
    {
      heading: 'Why adding sodium raises the sodium less than you expect',
      body: [
        'Give 210 mmol of sodium and nothing else to a man with 17 litres of extracellular fluid, and the arithmetic says the plasma sodium should rise by 12.5 mmol/L. It rises by 5. The reason is that although the sodium stays extracellular, its osmotic effect does not: the rise in extracellular osmolality pulls water out of the cells, and that water dilutes the sodium it was called out to correct. The osmotic effect is distributed through total body water even though the solute is not.',
        'Give water alone and the mirror image happens: extracellular osmolality falls, water moves into cells, and both compartments end up larger and more dilute. Give isotonic saline and nothing moves at all — the extracellular volume expands and the intracellular composition is untouched.',
        'Two clinical points fall out. An effective osmolality that rises dehydrates cells and one that falls swells them, which is where the symptoms come from. And the plasma sodium — a ratio — carries no information about volume, an absolute quantity. In all three of those examples the extracellular volume rose, while the plasma sodium went up, down and nowhere respectively.',
      ],
      points: ['210 mmol Na⁺ into 17 L raises the plasma Na⁺ by 5, not 12.5', 'Water shifts out of cells and dilutes the change', 'Plasma sodium says nothing about extracellular volume'],
      cite: { rose: [22, 7], evidence: 'physiology' },
      route: '/body-water',
    },
    {
      heading: 'The Edelman relation, and the potassium in it',
      body: [
        'If the plasma sodium reflects plasma osmolality, and plasma osmolality is in equilibrium with total body osmolality, then the plasma sodium is set by the exchangeable sodium plus the exchangeable potassium, all divided by total body water. Exchangeable, because about 30 per cent of body sodium is locked in bone and is osmotically inactive.',
        'The potassium term is easy to overlook and clinically important. Lose potassium from the extracellular fluid and potassium leaves the cells down the new gradient. Electroneutrality is then preserved in one of three ways, and every one of them lowers the plasma sodium: extracellular sodium enters the cells; intracellular chloride leaves, taking water with it osmotically; or extracellular hydrogen ions move in, which is charge-neutral but still lowers cell osmolality and pulls water out. In some patients with thiazide-induced hyponatraemia it is the potassium deficit, not the sodium deficit, that is doing most of the work — and giving potassium chloride alone raises both the potassium and the sodium.',
        'The same arithmetic changes how a replacement fluid behaves. Half-isotonic saline is, osmotically, 500 mL of isotonic saline plus 500 mL of free water. Add 40 mmol of potassium chloride to the litre and the cation concentration rises to 117 mmol/L, so the same litre is now 760 mL of isotonic fluid and only 240 mL of free water. At 200 mL/h that supplies about 50 mL/h of free water — roughly the insensible loss, so the osmolality does not fall at all.',
      ],
      points: ['[Na⁺] ≈ (exchangeable Na⁺ + exchangeable K⁺) / total body water', '~30% of body sodium is non-exchangeable bone sodium', 'Adding KCl to half-saline converts most of its free water into isotonic fluid'],
      cite: { refs: ['edelman1958'], rose: [22, 23, 25], evidence: 'experimental' },
      route: '/body-water',
      equation: 'edelman',
    },
    {
      heading: 'Two regulators, and which one gives way',
      body: [
        'Osmoregulation senses plasma osmolality with hypothalamic osmoreceptors sensitive to a 1 per cent change, and answers with thirst and antidiuretic hormone — that is, by adjusting water intake and water excretion, not sodium. Volume regulation senses the effective circulating volume at the carotid sinus, the afferent arteriole and the atria, and answers with renin, angiotensin, aldosterone, the sympathetic nerves and the natriuretic peptides — that is, by adjusting sodium.',
        'They usually operate independently, and the dissociation is easy to demonstrate. Sweating on a hot day loses dilute fluid: the plasma sodium rises and the extracellular volume falls. Sustained antidiuretic hormone release retains water: the plasma sodium falls and the volume rises.',
        'When the two conflict, volume wins. Hypovolaemia is a potent non-osmotic stimulus to both thirst and antidiuretic hormone, so a hypovolaemic patient goes on drinking and goes on retaining water even when they are already hyponatraemic. Perfusion is defended at the expense of tonicity — which is the right priority, and the reason volume depletion is on the differential of every hyponatraemia.',
      ],
      chain: [
        'Effective circulating volume falls',
        'Non-osmotic ADH release and thirst are stimulated',
        'Water is retained and drunk despite a falling plasma sodium',
        'Hyponatraemia, defended by the body on purpose',
        'Restore the volume and the ADH switches off — sometimes abruptly',
      ],
      points: ['Osmoreceptors detect a 1% change in osmolality', 'Hypovolaemia overrides osmoregulation', 'Correcting the volume can unleash a brisk water diuresis and a rapid rise in sodium'],
      cite: { rose: [22, 6, 9], evidence: 'physiology' },
      route: '/adh',
    },
    {
      heading: 'Diarrhoea, and why the sodium can go either way',
      body: [
        'Diarrhoeal fluid is roughly isosmotic to plasma but its ionic composition varies, and that is what decides the plasma sodium. In a secretory diarrhoea such as cholera the sodium plus potassium concentration of the stool is close to that of plasma, so losing it depletes volume and potassium without directly changing tonicity at all.',
        'In an osmotic diarrhoea — lactulose, malabsorption, some infectious enteritides — the stool sodium plus potassium is 30 to 110 mmol/L, with unabsorbed solute making up the rest of the osmoles. Water is therefore lost in excess of cations even though the fluid is isosmotic, and the plasma sodium tends to rise.',
        'Then the competing effects. Fever adds sweat losses and the compensatory hyperventilation of a metabolic acidosis adds respiratory losses, both of which raise the sodium. Volume depletion stimulates thirst and antidiuretic hormone, both of which lower it. In most adults these roughly cancel and the sodium barely moves. In an infant, who cannot reach a cup, the thirst arm is missing — so enteric infection with fever produces hypernatraemia. In an adult who can drink freely, the same illness can produce hyponatraemia.',
      ],
      points: ['Secretory diarrhoea: stool Na⁺ + K⁺ ≈ plasma — volume and potassium lost, tonicity unchanged', 'Osmotic diarrhoea: stool Na⁺ + K⁺ 30–110 mmol/L — free water lost, sodium rises', 'Access to water is what decides which way an infant and an adult go'],
      cite: { rose: [22, 24], evidence: 'clinical' },
      route: '/hypovolemia',
    },
  ],
  numbers: [
    { label: 'Total body water', value: '60% of lean weight (men), 50% (women)' },
    { label: 'Distribution', value: '60% intracellular, 40% extracellular; 1/5 of the ECF is plasma' },
    { label: 'Normal plasma osmolality', value: '275–290 mmol/kg' },
    { label: 'Glucose and urea normally contribute', value: '< 10 mmol/kg' },
    { label: 'Osmoreceptor sensitivity', value: '~1% change in osmolality' },
    { label: 'Daily water turnover', value: '2600 mL in and out', note: 'drink 1400, food 850, oxidation 350; urine 1500, skin 500, lungs 400, stool 200' },
    { label: 'Sweat losses with exercise or heat', value: 'occasionally over 5 L/day' },
    { label: 'Non-exchangeable sodium', value: '~30% of body sodium', note: 'bone; osmotically inactive' },
  ],
  equations: ['posm', 'effosm', 'edelman', 'glucoseNa', 'osmgap'],
  clinical: [
    'The plasma sodium tells you about water balance, not sodium balance — and nothing at all about the extracellular volume. Assess the volume separately, at the bedside.',
    'Leave urea out when deciding whether a patient is effectively hyperosmolar: it crosses cell membranes and shifts no water.',
    'In hyperglycaemia the hyponatraemia is dilutional and the patient is hyperosmolar. Treat the osmolality, not the sodium.',
    'Check the potassium before attributing a low sodium entirely to a sodium deficit — a potassium deficit lowers the plasma sodium too, and replacing it raises both.',
    'When you add potassium chloride to a hypotonic replacement fluid, recalculate the free water it actually contains.',
    'A hypovolaemic patient will keep drinking and keep retaining water even when hyponatraemic; restoring the volume switches the ADH off and can produce an abrupt water diuresis.',
  ],
  pathology: [
    {
      name: 'Hyperglycaemia',
      broken: 'Glucose becomes a major effective extracellular osmole',
      consequence: 'Water is pulled out of cells and dilutes the plasma sodium. The patient is hyperosmolar despite hyponatraemia — treating the number rather than the tonicity is the error.',
      route: '/hyperglycemia',
    },
    {
      name: 'Uraemia',
      broken: 'Urea accumulates',
      consequence: 'Measured osmolality rises with no water shift and no symptoms of hyperosmolality, because urea equilibrates across cell membranes.',
      route: '/ckd',
    },
    {
      name: 'Thiazide-induced hyponatraemia',
      broken: 'Potassium and sodium loss plus impaired dilution',
      consequence: 'The plasma sodium can fall largely because of the exchangeable potassium deficit. Replacing potassium chloride raises the sodium as well as the potassium.',
      route: '/diuretics',
    },
    {
      name: 'Hypovolaemia with free access to water',
      broken: 'Volume regulation overrides osmoregulation',
      consequence: 'Thirst and non-osmotic ADH release persist despite hyponatraemia, because perfusion is defended ahead of tonicity.',
      route: '/hypovolemia',
    },
    {
      name: 'Infantile osmotic diarrhoea with fever',
      broken: 'Free water is lost and thirst cannot be satisfied',
      consequence: 'Hypernatraemic dehydration — the combination that makes infants a special case.',
      route: '/water-disorders',
    },
  ],
  questions: [
    {
      q: 'A patient has a plasma sodium of 125 mmol/L. What does that tell you about their extracellular volume?',
      options: ['It is low', 'It is high', 'Nothing — the sodium is a ratio and the volume is an absolute quantity, and hyponatraemia occurs at low, normal and high volumes', 'It is normal'],
      answer: 2,
      explanation:
        'This is the single most useful idea in the chapter. Volume has to be assessed independently — from the history, the examination and the urine chemistry — because the plasma sodium cannot supply it.',
      route: '/hyponatremia',
    },
    {
      q: 'Why does the plasma osmolality of renal failure not cause the symptoms that the same osmolality would in hypernatraemia?',
      options: [
        'The osmolality is not really raised',
        'Urea crosses cell membranes and equilibrates through total body water, so no water shifts out of brain cells',
        'The brain adapts to urea',
        'Renal failure patients are used to it',
      ],
      answer: 1,
      explanation: 'Urea is an ineffective osmole. Osmotic equilibrium is reached by urea entering cells, not by water leaving them — which is why the effective osmolality leaves urea out.',
      route: '/body-water',
    },
    {
      q: 'A litre of half-isotonic saline contains about 500 mL of free water. What happens when 40 mmol of KCl is added?',
      options: [
        'Nothing — potassium is intracellular',
        'The cation concentration rises to 117 mmol/L, so the litre is now 760 mL of isotonic fluid and only 240 mL of free water',
        'It becomes hypertonic',
        'The free water doubles',
      ],
      answer: 1,
      explanation:
        'Osmotically, potassium counts alongside sodium — that is the Edelman relation. Given at 200 mL/h this supplies only about 50 mL/h of free water, roughly the insensible loss, so the plasma osmolality does not fall.',
      route: '/hyperglycemia',
    },
    {
      q: 'Adding 210 mmol of sodium to a 17 L extracellular fluid raises the plasma sodium by 5 mmol/L, not 12.5. Why?',
      options: [
        'Some of the sodium is excreted immediately',
        'The rise in extracellular osmolality pulls water out of the cells, and that water dilutes the sodium',
        'The sodium enters cells',
        'The measurement is inaccurate',
      ],
      answer: 1,
      explanation: 'Sodium is confined to the extracellular fluid, but its osmotic effect is distributed through total body water. That is why every sodium-deficit formula uses total body water and not extracellular volume.',
      route: '/body-water',
    },
  ],
  updates: [
    {
      topic: 'Osmotically inactive sodium is not only bone',
      text: 'The chapter treats the roughly 30 per cent of body sodium that is not exchangeable as bone sodium, osmotically inactive and therefore outside the Edelman relation. Sodium-23 magnetic resonance imaging and balance studies have since shown that skin and skeletal muscle store sodium in a non-osmotic form bound to glycosaminoglycans, that the store changes with salt intake over weeks, and that local macrophages respond to it. This helps explain why measured changes in plasma sodium after a salt or water load sometimes deviate from the Edelman prediction. It refines the denominator rather than overturning the relation, which remains the basis of every correction formula in use.',
      cite: { refs: ['machnik2009', 'edelman1958'], rose: [22, 7], evidence: 'experimental', update: 'A third compartment for sodium that the chapter did not have.' },
    },
    {
      topic: 'Correcting the sodium for hyperglycaemia',
      text: 'The chapter states that hyperglycaemia lowers the plasma sodium by dilution and that therapy should address the hyperosmolality. The conventional correction of 1.6 mmol/L of sodium per 5.5 mmol/L of glucose above normal has since been measured directly: in somatostatin-clamped volunteers the relation was closer to 2.4 mmol/L, and steeper still above a glucose of about 22 mmol/L. The principle in the chapter is unchanged; the coefficient is bigger than the one usually quoted.',
      cite: { refs: ['hillier1999'], rose: [22, 25], evidence: 'experimental', update: 'The correction factor was measured rather than derived.' },
    },
  ],
  modules: ['/body-water', '/adh', '/hyponatremia', '/water-disorders'],
};
