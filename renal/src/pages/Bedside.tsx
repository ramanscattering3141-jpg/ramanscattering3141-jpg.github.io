import { useState } from 'preact/hooks';
import { PageHead, Related } from '../ui/page';
import { Panel, Sources, Tabs } from '../ui/kit';
import { EquationCard } from '../ui/EquationCard';
import { equationById } from '../content/equations';
import { href } from '../router';

// Equations at the bedside: why the renal equations matter for patients, which one answers which
// question, and worked patients that chain several equations from the first blood test to a plan.
// Every card is live and pre-loaded with the patient's numbers.

interface Step {
  text: string;
  eq?: string;
  values?: Record<string, number>;
}

interface Walkthrough {
  id: string;
  label: string;
  title: string;
  patient: string;
  steps: Step[];
  plan: string;
}

const WALKS: Walkthrough[] = [
  {
    id: 'hypona',
    label: 'Hyponatraemia',
    title: 'Hyponatraemia, from the first result to a plan',
    patient:
      'A 72-year-old woman (60 kg) with small-cell lung cancer is admitted with confusion. Na⁺ 122 mmol/L, glucose 5, urea 4 mmol/L, K⁺ 3.4 mmol/L. She looks euvolaemic. Urine osmolality 540 mOsm/kg, urine Na⁺ 90, K⁺ 45 mmol/L.',
    steps: [
      { text: 'Is she truly hypotonic? Effective osmolality leaves urea out because it crosses cell membranes freely.', eq: 'effosm', values: { na: 122, glu: 5 } },
      { text: 'Yes: about 249 mOsm/kg. Her urine osmolality of 540 says ADH is switched on despite hypotonicity; with euvolaemia and a lung tumour, that is SIADH. Will fluid restriction work?', eq: 'furst', values: { una: 90, uk: 45, pna: 122 } },
      { text: 'The ratio is above 1, so her urine contains no free water. Electrolyte-free water clearance shows the same thing in litres.', eq: 'efwc', values: { una: 90, uk: 45, v: 1.2, pna: 122 } },
      { text: 'She is confused, so the team gives hypertonic saline. How much will one litre of 3% saline change her Na⁺? (Body water ≈ 0.5 × 60 kg = 30 L in an older woman.)', eq: 'adrogue', values: { inf: 513, na: 122, tbw: 30 } },
      { text: 'Chronic hyponatraemia: the goal is a rise of about 6–8 mmol/L in the first 24 hours, and no more than 10. How much sodium is that?', eq: 'nadeficit', values: { wt: 60, frac: 0.5, na: 122, target: 128 } },
      { text: 'She also receives 40 mmol of KCl. Edelman says it raises the Na⁺ as much as 40 mmol of NaCl would. Count it in the plan, or it can tip her into overcorrection. Try raising exchangeable K⁺ by 40 mmol.', eq: 'edelman', values: { na: 2100, k: 1890, tbw: 30 } },
    ],
    plan: 'About 180 mmol of Na⁺ over 24 hours (≈ 350 mL of 3% saline, less the KCl), Na⁺ checked every 4–6 hours. Fluid restriction alone will fail while the Furst ratio is above 1, so add oral urea or salt with a loop diuretic. Have a rescue plan (D5W, desmopressin) if the Na⁺ rises more than 8 mmol/L.',
  },
  {
    id: 'acid',
    label: 'Metabolic acidosis',
    title: 'An unconscious patient with a metabolic acidosis',
    patient:
      'A 40-year-old man found unresponsive. Na⁺ 138, Cl⁻ 100, HCO₃⁻ 8 mmol/L, albumin 40 g/L, glucose 6, urea 5 mmol/L. PCO₂ 24 mmHg. Measured osmolality 330 mOsm/kg.',
    steps: [
      { text: 'Start with the anion gap.', eq: 'ag', values: { na: 138, cl: 100, hco3: 8, alb: 40 } },
      { text: 'A gap of 30: unmeasured anions. Is there a second metabolic disorder hiding?', eq: 'deltaratio', values: { ag: 30, hco3: 8 } },
      { text: 'A ratio of about 1.1: a pure high-gap acidosis. Is he breathing enough to compensate?', eq: 'winters', values: { hco3: 8 } },
      { text: 'Expected PCO₂ ≈ 20 ± 2; his 24 is at the upper edge, so watch for tiring. Now the key question: what is the anion?', eq: 'osmgap', values: { meas: 330, na: 138, glu: 6, urea: 5 } },
    ],
    plan: 'High anion gap plus an osmolal gap of about 43: toxic alcohol (methanol or ethylene glycol) until proven otherwise, especially if the ethanol level is low. Give fomepizole, call toxicology and nephrology for dialysis. Protect the airway before he tires.',
  },
  {
    id: 'aki',
    label: 'Rising creatinine',
    title: 'A rising creatinine: pre-renal or tubular injury?',
    patient:
      'A 70-year-old woman on furosemide for heart failure has had three days of vomiting and diarrhoea. Creatinine 265 µmol/L (baseline 90), urea 25 mmol/L, Na⁺ 138. Urine Na⁺ 35, urea 150, creatinine 8 mmol/L.',
    steps: [
      { text: 'FENa first, bearing in mind she takes furosemide.', eq: 'fena', values: { una: 35, pcr: 265, pna: 138, ucr: 8 } },
      { text: 'About 0.8%. Furosemide pushes FENa up, so a low-looking value is reassuring, but a high one would be uninterpretable. FEUrea is unaffected by loop diuretics.', eq: 'feurea', values: { uurea: 150, pcr: 265, purea: 25, ucr: 8 } },
      { text: 'Below 35%: pre-renal physiology. The urea:creatinine ratio is borderline at about 94. The indices rarely all agree, which is why none is used alone.', eq: 'ureacr', values: { urea: 25, cr: 265 } },
      { text: 'The eGFR equation assumes a steady state. Put her creatinine in and see what it reports, then remember it is not true while the creatinine is still rising.', eq: 'ckdepi', values: { scr: 265, age: 70, female: 1 } },
    ],
    plan: 'Pre-renal AKI from GI losses on a diuretic. Hold the furosemide (and any ACE inhibitor, ARB, SGLT2 inhibitor or NSAID), give cautious isotonic fluid while watching her lungs, and recheck the creatinine in 24 hours. Do not dose drugs from the eGFR until the creatinine is stable.',
  },
  {
    id: 'potassium',
    label: 'Hypokalaemia',
    title: 'Hypokalaemia: where is it going, and how much is missing?',
    patient:
      'A 70-kg man with K⁺ 2.8 mmol/L after three weeks of diarrhoea, on long-term omeprazole. Spot urine K⁺ 12, creatinine 9 mmol/L. Mg²⁺ 0.4 mmol/L; urine Mg²⁺ 0.3 mmol/L; plasma creatinine 80 µmol/L.',
    steps: [
      { text: 'Is the kidney losing K⁺?', eq: 'ukcr', values: { uk: 12, ucr: 9 } },
      { text: 'No, a low ratio means the kidney is conserving K⁺, so the loss is from the gut. How big is the deficit?', eq: 'kdeficit', values: { k: 2.8, wt: 70 } },
      { text: 'Hundreds of mmol, so replacement takes days. And the magnesium is low: is that renal or gut?', eq: 'femg', values: { umg: 0.3, pcr: 80, pmg: 0.4, ucr: 8 } },
    ],
    plan: 'Gut losses of both K⁺ and Mg²⁺, the magnesium made worse by the PPI. Replace Mg²⁺ first or alongside (low Mg²⁺ keeps the renal K⁺ channel open), give oral KCl over several days, treat the diarrhoea and review the PPI.',
  },
  {
    id: 'hyperna',
    label: 'Hypernatraemia',
    title: 'Hypernatraemia in an older patient',
    patient: 'An 85-year-old, 50-kg woman with dementia and a fever, Na⁺ 158 mmol/L. Urine 1.5 L/day at 700 mOsm/kg, urine Na⁺ 40, K⁺ 30 mmol/L.',
    steps: [
      { text: 'How much water is missing? (Body water ≈ 40% of weight in an older, dehydrated woman.)', eq: 'waterdeficit', values: { wt: 50, frac: 0.4, na: 158 } },
      { text: 'Is her urine still losing free water? Although it is concentrated, much of that osmolality is urea, and its Na⁺ + K⁺ (70) is far below her plasma Na⁺. So her urine still carries about 0.8 L/day of electrolyte-free water, on top of insensible losses from the fever.', eq: 'efwc', values: { una: 40, uk: 30, v: 1.5, pna: 158 } },
      { text: 'What will one litre of D5W do? (Infusate Na⁺ + K⁺ = 0.)', eq: 'adrogue', values: { inf: 0, na: 158, tbw: 20 } },
    ],
    plan: 'About 2.6 L of water deficit plus roughly 2 L/day of ongoing free-water loss (urine and fever). Give water enterally or as D5W over 24–48 hours: each litre lowers her Na⁺ by about 7.5 mmol/L. Recheck every 4–6 hours and treat the fever and infection.',
  },
  {
    id: 'ascites',
    label: 'Cirrhotic ascites',
    title: 'Ascites that is not going away',
    patient: 'A 58-year-old man with cirrhosis on spironolactone 100 mg and furosemide 40 mg. Weight up 2 kg in a week. Spot urine Na⁺ 70, K⁺ 35 mmol/L. Albumin 22 g/L, total calcium 1.95 mmol/L.',
    steps: [
      { text: 'Is the diuretic producing natriuresis?', eq: 'unauk', values: { una: 70, uk: 35 } },
      { text: 'Yes: the ratio is above 1, so he is probably excreting more than 78 mmol/day. Rising weight then means sodium intake is too high. His low calcium is a separate question: correct it for albumin before acting.', eq: 'correctedCa', values: { ca: 1.95, alb: 22 } },
    ],
    plan: 'Review diet and hidden sodium (processed food, saline-based IV drugs) with a dietitian rather than escalating diuretics. The calcium is normal once corrected. If the ratio had been below 1, the answer would have been the opposite: raise spironolactone and furosemide together (100:40).',
  },
];

const QUESTIONS: { area: string; rows: [string, string][] }[] = [
  {
    area: 'Sodium and water',
    rows: [
      ['Is the low Na⁺ truly hypotonic?', 'effosm'],
      ['Is glucose hiding the real Na⁺?', 'nacorr'],
      ['Will fluid restriction work?', 'furst'],
      ['Is the urine raising or lowering the Na⁺?', 'efwc'],
      ['Why does a low-solute diet cause hyponatraemia?', 'maxuv'],
      ['What will one litre of this fluid do?', 'adrogue'],
      ['How much sodium to give?', 'nadeficit'],
      ['Does potassium change the Na⁺?', 'edelman'],
      ['How much water is missing?', 'waterdeficit'],
      ['Is the diuretic producing natriuresis (ascites)?', 'unauk'],
    ],
  },
  {
    area: 'Potassium',
    rows: [
      ['Is the kidney wasting K⁺?', 'ukcr'],
      ['Is the kidney excreting enough K⁺ in hyperkalaemia?', 'fek'],
      ['How large is the K⁺ deficit?', 'kdeficit'],
    ],
  },
  {
    area: 'Acid–base',
    rows: [
      ['Are there unmeasured anions?', 'ag'],
      ['Is there a second metabolic disorder?', 'deltaratio'],
      ['Is breathing compensating for a metabolic acidosis?', 'winters'],
      ['Is a high PCO₂ compensation for alkalosis?', 'alkComp'],
      ['Is a respiratory disorder acute or chronic?', 'respComp'],
      ['Gut or kidney in a normal-gap acidosis?', 'uag'],
      ['Proximal RTA?', 'fehco3'],
      ['Toxic alcohol?', 'osmgap'],
    ],
  },
  {
    area: 'Kidney function',
    rows: [
      ['Pre-renal or tubular injury?', 'fena'],
      ['The same, on diuretics?', 'feurea'],
      ['Why is the urea so high?', 'ureacr'],
      ['What is the GFR (steady state only)?', 'ckdepi'],
      ['How much protein is being lost?', 'upcr'],
    ],
  },
  {
    area: 'Calcium, magnesium, phosphate',
    rows: [
      ['Is the calcium really low?', 'correctedCa'],
      ['FHH or primary hyperparathyroidism?', 'cccr'],
      ['Renal or gut magnesium loss?', 'femg'],
      ['Is the kidney wasting phosphate?', 'fepo4'],
    ],
  },
];

export default function Bedside({ query }: { query: URLSearchParams }) {
  const initial = WALKS.find((w) => w.id === query.get('case'))?.id ?? WALKS[0].id;
  const [walk, setWalk] = useState(initial);
  const w = WALKS.find((x) => x.id === walk)!;
  return (
    <div>
      <PageHead
        path="/bedside"
        lede="An equation is a physiological question with numbers in it. Used well, it turns a set of results into a mechanism, predicts what a treatment will do before you give it, and exposes a second disorder hiding behind the first. Used carelessly, it gives a precise answer to the wrong question. This page shows both, one patient at a time."
      />

      <Panel title="What equations do for a patient">
        <div class="grid grid-2">
          <div>
            <h4>They help you</h4>
            <ul>
              <li><b>Name the mechanism.</b> A Furst ratio above 1 tells you why the Na⁺ keeps falling, not just that it is low.</li>
              <li><b>Predict before you treat.</b> Adrogué–Madias estimates a litre’s effect before it runs in; the sodium deficit sets a ceiling.</li>
              <li><b>Find the hidden disorder.</b> An albumin-corrected anion gap, a Δ/Δ or Winter’s formula each uncover a second problem the headline number hides.</li>
              <li><b>Decide gut versus kidney</b> from one spot urine: K⁺/creatinine, FEMg, FEPO₄, the urine anion gap.</li>
              <li><b>Follow the response.</b> Repeating a spot ratio shows whether a change of treatment is working.</li>
            </ul>
          </div>
          <div>
            <h4>But remember</h4>
            <ul>
              <li><b>A spot urine is a snapshot.</b> Repeat it as treatment changes the kidney’s behaviour.</li>
              <li><b>Every equation assumes something.</b> eGFR assumes a steady state; FENa assumes no diuretic; Adrogué–Madias assumes no urine output.</li>
              <li><b>Units matter.</b> Everything here is SI: creatinine in µmol/L, urea and glucose in mmol/L.</li>
              <li><b>Correction limits come from the brain, not the formula.</b> In chronic hyponatraemia keep the rise within 10 mmol/L in 24 hours whatever the arithmetic says.</li>
              <li><b>The patient outranks the number.</b> Recheck the sample, the timing and the drugs before acting on a surprising result.</li>
            </ul>
          </div>
        </div>
        <Sources cite={{ rose: [30], evidence: 'reasoning', refs: ['spasovski2014', 'furst2000'] }} />
      </Panel>

      <Panel title="Worked patients" note="Each card is live and already holds this patient’s numbers. Move a slider to ask “what if”.">
        <Tabs tabs={WALKS.map((x) => ({ id: x.id, label: x.label }))} active={walk} onChange={setWalk} />
        <div key={w.id}>
          <h3 style={{ marginTop: 12 }}>{w.title}</h3>
          <p class="note">{w.patient}</p>
          <ol class="walk">
            {w.steps.map((s, i) => (
              <li key={i}>
                <p>{s.text}</p>
                {s.eq && <EquationCard eq={s.eq} values={s.values} compact hideCase />}
              </li>
            ))}
          </ol>
          <p class="note" style={{ marginBottom: 0 }}>
            <b>Plan:</b> {w.plan}
          </p>
        </div>
      </Panel>

      <Panel title="Which equation answers which question?" note="Each one opens in the equation explorer with its own worked patient.">
        <div class="grid grid-2">
          {QUESTIONS.map((g) => (
            <div key={g.area}>
              <h4>{g.area}</h4>
              <table class="qtable">
                <tbody>
                  {g.rows.map(([q, id]) => {
                    const e = equationById.get(id);
                    return (
                      <tr key={id + q}>
                        <td>{q}</td>
                        <td>
                          <a href={href('/equations', { q: e?.name ?? id })}>{e?.name ?? id}</a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </Panel>

      <Related paths={['/equations', '/labs', '/cases', '/hyponatremia', '/metabolic-acidosis', '/prerenal-atn']} />
    </div>
  );
}
