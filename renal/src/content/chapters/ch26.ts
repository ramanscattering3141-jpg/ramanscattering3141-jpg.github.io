import type { ChapterContent } from './types';

export const chapter: ChapterContent = {
  n: 26,
  title: 'Introduction to disorders of potassium balance',
  thesis:
    'Potassium matters clinically because the ratio of its concentration inside and outside cells sets the resting membrane potential, and so the excitability of nerve and muscle. Ninety-eight per cent of it is inside cells, so the plasma level reports a small compartment that two systems defend: cells take up a load within minutes, and the distal nephron excretes it within hours. Every disorder of the plasma potassium is a disturbance of intake, of distribution between cells and extracellular fluid, or of urinary excretion — and chronic hyperkalaemia always means that excretion has failed.',
  concepts: [
    {
      heading: 'The membrane potential depends on a ratio',
      body: [
        'Total body potassium is about 3000 to 4000 mmol (50–55 mmol/kg), almost all of it inside cells at about 140 mmol/L against 4 to 5 mmol/L outside. The Na⁺-K⁺-ATPase maintains that distribution, pumping three Na⁺ out for two K⁺ in. Because the membrane is far more permeable to K⁺ than to Na⁺, K⁺ diffusing out of the cell leaves the interior negative, and the resting potential settles where that electrical pull balances the concentration gradient.',
        'Because the extracellular concentration is so small, a small absolute change there alters the ratio, and the potential, a great deal. The consequences are not simply more or less excitability. A high plasma K⁺ partly depolarises the membrane; that first makes it easier to fire, but sustained depolarisation inactivates sodium channels, so the net result is reduced excitability — weakness, and impaired cardiac conduction. A low plasma K⁺ hyperpolarises the membrane, which ought to reduce excitability, but removes the normal inactivation of sodium channels and so increases it — arrhythmias.',
        'Calcium and pH modify the same membrane. Calcium antagonises the effect of hyperkalaemia within minutes, which is why it is the first treatment for a dangerous ECG; hypocalcaemia, acidaemia and hyponatraemia make hyperkalaemia more toxic.',
      ],
      chain: ['Na⁺-K⁺-ATPase: cell K⁺ ≈ 140, extracellular ≈ 4–5 mmol/L', 'High K⁺ permeability: K⁺ diffuses out, interior negative', 'Resting potential set by [K⁺]cell / [K⁺]ECF', 'Small change in plasma K⁺ → large change in the ratio → altered excitability'],
      points: ['Total body K⁺ 50–55 mmol/kg; 98% intracellular', 'High K⁺: depolarisation → Na⁺ channel inactivation → less excitable', 'Low K⁺: hyperpolarisation → more excitable (arrhythmia)'],
      cite: { rose: [26, 12], evidence: 'physiology' },
      route: '/potassium',
    },
    {
      heading: 'Why the same plasma K⁺ can mean different things',
      body: [
        'Symptoms vary widely between patients at the same level. What matters is how far the ratio across the membrane changes, and that depends on the mechanism. When K⁺ moves acutely into cells (as in hypokalaemic periodic paralysis), the cell concentration rises a little while the plasma falls, so the ratio changes a lot and weakness is common. When K⁺ is lost from the body through the gut or kidney, K⁺ leaves cells to replace it, both concentrations fall, the ratio changes less, and symptoms are fewer at the same plasma level.',
        'Hence the book\'s practical rule: the plasma K⁺ is not the whole story, and monitoring the ECG and muscle strength, which reflect the functional consequences, is essential in severe disturbances.',
      ],
      points: ['Transcellular shifts cause more symptoms than external losses at the same plasma K⁺', 'Watch the ECG and muscle strength, not just the number'],
      cite: { rose: [26], evidence: 'physiology' },
      route: '/hypokalemia',
    },
    {
      heading: 'Internal balance: cells absorb a load first',
      body: [
        'Three glasses of orange juice contain about 40 mmol of K⁺. Spread through 17 litres of extracellular fluid that would raise the plasma level by 2.4 mmol/L. It does not, because most of the load enters cells within minutes and is then excreted in the urine over 6 to 8 hours.',
        'Insulin and β₂-adrenergic stimulation (mainly adrenaline) drive that uptake by activating the Na⁺-K⁺-ATPase. Their basal levels are what matter: a physiological K⁺ load barely changes them, so they permit rather than regulate. Blocking them (β-blockers, somatostatin) makes the rise after a load larger and longer, and extra insulin or adrenaline pushes K⁺ into cells for a few hours — the basis of insulin-glucose and albuterol in hyperkalaemia. Their deficiency alone causes only mild, transient hyperkalaemia, because the kidney excretes the excess.',
        'The plasma K⁺ itself also moves K⁺ passively: into cells after a load, out of them when K⁺ is lost. As a result the plasma level usually tracks body stores. The book\'s rule of thumb: a fall from 4 to 3 mmol/L means a deficit of 200 to 400 mmol; a rise from 4 to 5 means retention of 100 to 200 mmol. The exceptions are the disorders of distribution — insulin deficiency and hyperosmolality in uncontrolled diabetes, some metabolic acidoses, severe exercise and tissue breakdown — where the plasma level can be high while the stores are normal or low.',
      ],
      chain: ['K⁺ load absorbed', 'Insulin and β₂ tone (basal) activate the Na⁺-K⁺-ATPase', 'Most of the load enters muscle and liver within minutes', 'Kidney excretes it over 6–8 h'],
      points: ['40 mmol in 17 L of ECF would add 2.4 mmol/L', '4 → 3 mmol/L ≈ 200–400 mmol deficit', '4 → 5 mmol/L ≈ 100–200 mmol retained', 'Fist clenching at venepuncture can add 1–2 mmol/L'],
      cite: { rose: [26, 12], evidence: 'physiology', refs: ['rosa1980', 'defronzo1980'] },
      route: '/potassium',
    },
    {
      heading: 'External balance: aldosterone and the plasma K⁺ regulate; flow and voltage permit',
      body: [
        'Almost all filtered K⁺ is reabsorbed before the distal nephron; what is excreted is what the principal cells of the connecting tubule and cortical collecting duct secrete. Secretion is passive, through luminal K⁺ channels, so it depends on the channels open, the cell K⁺ concentration and the electrical gradient. Aldosterone raises all three: it increases Na⁺ entry (making the lumen more negative), pump activity (raising cell K⁺) and the number of open K⁺ channels. A rise in plasma K⁺ stimulates aldosterone and also acts on the cells directly. Both rise with a K⁺ load and fall with depletion, so they are the regulators.',
        'Distal flow and sodium delivery are permissive. Flow washes secreted K⁺ away and keeps the luminal concentration low; Na⁺ reabsorption generates the lumen-negative voltage (−35 to −50 mV in the cortical collecting tubule). Amiloride, which only closes the sodium channel, abolishes the voltage and with it K⁺ secretion. Na⁺ delivered with an anion that cannot follow it — sulfate, bicarbonate, a ketoacid, a penicillin — makes the lumen more negative still and increases K⁺ loss.',
        'This arrangement lets aldosterone regulate sodium and ADH regulate water without disturbing K⁺. In volume depletion (heart failure, cirrhosis) aldosterone is high but flow is low, and the patient is not hypokalaemic; with a high-salt diet flow is high but aldosterone low. K⁺ wasting appears when flow and aldosterone rise together — a diuretic, or salt given to a patient with an aldosterone-secreting adenoma.',
      ],
      chain: ['K⁺ load → plasma K⁺ ↑ → aldosterone ↑', 'More open K⁺ channels, higher cell K⁺, more negative lumen', 'Distal secretion ↑', 'Distal flow and Na⁺ delivery permit it'],
      points: ['Regulators: aldosterone, plasma K⁺', 'Permissive: distal flow, Na⁺ delivery, lumen-negative voltage', 'Non-reabsorbable anions increase K⁺ secretion'],
      cite: { rose: [26, 12], evidence: 'physiology', refs: ['palmer2015k', 'welling2016', 'woda2001'] },
      route: '/potassium',
    },
    {
      heading: 'Conservation and adaptation',
      body: [
        'On a low-K⁺ diet, secretion falls with the plasma K⁺ and aldosterone, and intercalated cells begin to reabsorb K⁺ actively through H⁺-K⁺-ATPase. Urinary K⁺ falls to 15–25 mmol/day with a moderate deficit and 5–15 mmol/day with a marked one — not as low as sodium can go, perhaps because K⁺ leaks into the lumen through a nonselective cation channel in the inner medullary collecting duct. A low intake alone therefore rarely causes depletion.',
        'In the other direction, intake raised slowly can reach 400 mmol/day with only a small rise in plasma K⁺. In Rabelink\'s volunteers the plasma K⁺ rose from 3.8 to 4.8 and aldosterone rose 2.5-fold in the first two days; by day 20 both had fallen back toward baseline while excretion stayed high. Secretory efficiency had increased — more pump and more basolateral membrane in the secreting cells. The same adaptation, per remaining nephron, keeps patients with advanced renal failure in balance, helped by colonic secretion.',
      ],
      points: ['Minimum urinary K⁺: 15–25 (moderate deficit) to 5–15 mmol/day (marked)', 'Adaptation allows up to 400 mmol/day', 'Chronic hyperkalaemia always means impaired excretion'],
      cite: { rose: [26, 28], evidence: 'clinical' },
      route: '/hyperkalemia',
    },
  ],
  numbers: [
    { label: 'Total body K⁺', value: '3000–4000 mmol', note: '50–55 mmol/kg' },
    { label: 'Intracellular fraction', value: '98%' },
    { label: 'Cell / extracellular K⁺', value: '≈ 140 / 4–5 mmol/L' },
    { label: 'Normal intake', value: '40–120 mmol/day' },
    { label: 'Deficit for 4 → 3 mmol/L', value: '200–400 mmol' },
    { label: 'Retention for 4 → 5 mmol/L', value: '100–200 mmol' },
    { label: 'Minimum urinary K⁺', value: '5–25 mmol/day' },
    { label: 'Adapted maximum intake', value: '≈ 400 mmol/day' },
    { label: 'Lumen-negative potential, CCD', value: '−35 to −50 mV' },
    { label: 'Artefact from fist clenching', value: 'up to +1–2 mmol/L' },
  ],
  equations: ['ttkg', 'ukcr'],
  clinical: [
    'Ask how the potassium changed, not just how far: an acute shift into cells causes more weakness than the same fall from gradual loss.',
    'Always consider a spurious result: fist clenching, haemolysis, or a very high white cell or platelet count.',
    'In hyperkalaemia, calcium protects the heart within minutes; insulin and β₂-agonists shift K⁺ into cells within an hour; only the kidney, the gut or dialysis removes it.',
    'A patient with chronic hyperkalaemia has an excretory problem — low aldosterone, low distal flow, or too few nephrons — whatever else is going on.',
  ],
  pathology: [
    { name: 'Hypokalaemic periodic paralysis', broken: 'Sudden K⁺ entry into cells (familial or thyrotoxic)', consequence: 'Plasma K⁺ 1.5–2.5 with normal stores; paralysis because the ratio changes so much', route: '/hypokalemia' },
    { name: 'Diarrhoea', broken: 'Gastrointestinal K⁺ loss', consequence: 'K⁺ depletion with appropriately low urinary K⁺', route: '/hypokalemia' },
    { name: 'β-blockade or insulin deficiency', broken: 'Impaired cellular uptake', consequence: 'Mild, transient rise after a load; fasting K⁺ usually normal', route: '/potassium' },
    { name: 'Hypoaldosteronism', broken: 'Regulator of distal secretion missing', consequence: 'Chronic hyperkalaemia with a mild metabolic acidosis (type 4 RTA)', route: '/hyperkalemia' },
  ],
  questions: [
    {
      q: 'A patient\'s plasma K⁺ has fallen from 4.0 to 3.0 mmol/L through diarrhoea over a week. About how large is the deficit?',
      options: ['20–40 mmol', '200–400 mmol', '1000 mmol', 'Cannot be estimated at all'],
      answer: 1,
      explanation: 'With normal distribution, a fall from 4 to 3 corresponds to a deficit of 200–400 mmol; another 200–400 takes it to about 2 (Rose ch. 26, 27).',
      route: '/hypokalemia',
    },
    {
      q: 'Amiloride reduces K⁺ excretion although it has no action on K⁺ channels. Why?',
      options: ['It lowers aldosterone', 'It closes ENaC, abolishing the lumen-negative voltage that drives K⁺ secretion', 'It reduces distal flow', 'It inhibits the Na⁺-K⁺-ATPase'],
      answer: 1,
      explanation: 'Na⁺ reabsorption through ENaC generates the voltage; without it K⁺ secretion falls (Rose ch. 26).',
      route: '/distal',
    },
    {
      q: 'An untreated patient with heart failure has high aldosterone. Why is the plasma K⁺ normal?',
      options: ['Aldosterone does not affect K⁺', 'Distal flow is low, offsetting the high aldosterone', 'K⁺ intake is low', 'ADH blocks K⁺ secretion'],
      answer: 1,
      explanation: 'Enhanced proximal and ADH-mediated reabsorption reduce distal flow. A diuretic raises flow while aldosterone stays high, and hypokalaemia follows.',
      route: '/potassium',
    },
    {
      q: 'Problem 26-1 in brief: a patient with diarrhoea, hypokalaemia and a metabolic acidosis. What will correcting the acidosis with bicarbonate do to the plasma K⁺?',
      options: ['Raise it', 'Lower it further — acidaemia was holding K⁺ outside cells', 'Nothing', 'Normalise it'],
      answer: 1,
      explanation: 'Mineral acidosis shifts K⁺ out of cells, masking the deficit. Correcting it moves K⁺ back in, so K⁺ should be replaced first or alongside.',
      route: '/hypokalemia',
    },
  ],
  updates: [
    {
      topic: 'How the distal nephron senses potassium',
      text: 'The book describes the independence of Na⁺ and K⁺ excretion without a molecular mechanism. It is now known that the distal convoluted tubule senses the plasma K⁺ through its basolateral membrane potential and the WNK–SPAK kinase pathway: a low K⁺ activates the thiazide-sensitive NaCl cotransporter, retaining Na⁺ upstream and reducing delivery to the K⁺-secreting segments; a high K⁺ does the reverse. This "potassium switch" explains how aldosterone can serve sodium retention in one state and potassium excretion in another.',
      cite: { refs: ['terker2015', 'hoorn2011wnk', 'mcdonough2017'], evidence: 'experimental' },
    },
    {
      topic: 'Flow-dependent secretion',
      text: 'The flow dependence Rose describes is now attributed largely to the large-conductance, calcium-activated BK (maxi-K) channel, which opens as flow rises, in addition to the constitutive ROMK channel.',
      cite: { refs: ['woda2001', 'welling2016'], evidence: 'experimental' },
    },
  ],
  modules: ['/potassium', '/hypokalemia', '/hyperkalemia'],
};
