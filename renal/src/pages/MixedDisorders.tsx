import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related, useTabParam } from '../ui/page';
import { Panel, Readout, Slider, Sources, Predict, Chain, Expand, Equation } from '../ui/kit';
import { AcidBaseMap, hco3From, phFrom, type MapPoint } from '../ui/AcidBaseMap';
import { BedsideEquations } from '../ui/EquationCard';

const TAB_IDS = ['interpret', 'map', 'cases'] as const;

/** Rose Table 17-3. One place, used by the interpreter and by the map's geometry. */
const RULES = {
  metAcidosis: { label: 'metabolic acidosis', text: 'PCO₂ falls 1.2 mmHg per 1 mmol/L fall in HCO₃⁻', predict: (hco3: number) => 40 + 1.2 * (hco3 - 24), tol: 2.5 },
  metAlkalosis: { label: 'metabolic alkalosis', text: 'PCO₂ rises 0.7 mmHg per 1 mmol/L rise in HCO₃⁻', predict: (hco3: number) => 40 + 0.7 * (hco3 - 24), tol: 2.5 },
  respAcidosisAcute: { label: 'acute respiratory acidosis', text: 'HCO₃⁻ rises 1 mmol/L per 10 mmHg rise in PCO₂', predict: (pco2: number) => 24 + 0.1 * (pco2 - 40), tol: 2 },
  respAcidosisChronic: { label: 'chronic respiratory acidosis', text: 'HCO₃⁻ rises 3.5 mmol/L per 10 mmHg rise in PCO₂', predict: (pco2: number) => 24 + 0.35 * (pco2 - 40), tol: 3 },
  respAlkalosisAcute: { label: 'acute respiratory alkalosis', text: 'HCO₃⁻ falls 2 mmol/L per 10 mmHg fall in PCO₂', predict: (pco2: number) => 24 + 0.2 * (pco2 - 40), tol: 2 },
  respAlkalosisChronic: { label: 'chronic respiratory alkalosis', text: 'HCO₃⁻ falls 4 mmol/L per 10 mmHg fall in PCO₂', predict: (pco2: number) => 24 + 0.4 * (pco2 - 40), tol: 3 },
};

interface Gas {
  pco2: number;
  hco3: number;
  chronic: boolean;
  na?: number;
  cl?: number;
  albumin?: number;
}

const CASES: { label: string; gas: Gas; story: string; answer: string }[] = [
  {
    label: 'Salicylate overdose',
    gas: { pco2: 20, hco3: 13, chronic: false, na: 140, cl: 103, albumin: 42 },
    story: 'A young adult brought in confused, hyperventilating, with tinnitus.',
    answer:
      'The pH is high, and only the low PCO₂ can explain that, so the primary disorder is an acute respiratory alkalosis. That should have lowered the bicarbonate to about 20; it is 13. The difference is a metabolic acidosis — and the anion gap confirms it. Salicylate stimulates the respiratory centre directly and deranges metabolism, producing both at once.',
  },
  {
    label: 'COPD given a diuretic',
    gas: { pco2: 60, hco3: 37, chronic: true, na: 140, cl: 92, albumin: 42 },
    story: 'Chronic obstructive lung disease, recently started on furosemide for ankle swelling.',
    answer:
      'The pH is normal, which is the finding. Chronic hypercapnia at a PCO₂ of 60 should raise the bicarbonate to about 31; it is 37. The extra is a metabolic alkalosis from the diuretic — chloride and potassium depletion. Compensation returns the pH towards normal, not to it, so a normal pH with these numbers means two disorders.',
  },
  {
    label: 'Severe diarrhoea, not breathing well',
    gas: { pco2: 40, hco3: 8, chronic: false, na: 140, cl: 116, albumin: 42 },
    story: 'Profuse diarrhoea for three days; drowsy on arrival.',
    answer:
      'A bicarbonate of 8 should have driven the PCO₂ down to about 21. It is 40 — inappropriately high by 19 mmHg — so there is a respiratory acidosis on top of the metabolic one, and the pH is far lower than the bicarbonate alone suggests. A normal-looking PCO₂ is not a normal finding.',
  },
  {
    label: 'Septic shock',
    gas: { pco2: 24, hco3: 14, chronic: false, na: 138, cl: 100, albumin: 22 },
    story: 'Hypotensive, tachypnoeic, lactate 6 mmol/L. Albumin 22 g/L.',
    answer:
      'A metabolic acidosis with a respiratory alkalosis: the PCO₂ of 24 is lower than the 28 the bicarbonate predicts, so ventilation is being driven beyond compensation. Note the albumin: at 22 g/L the raw anion gap understates the unmeasured anions by about 4.5 mmol/L, which matters in exactly this patient.',
  },
  {
    label: 'Vomiting with renal failure',
    gas: { pco2: 40, hco3: 24, chronic: false, na: 140, cl: 92, albumin: 42 },
    story: 'Persistent vomiting for a week; creatinine 480 µmol/L.',
    answer:
      'Every number is normal, and the patient has two disorders. The anion gap is 24 — far above normal — from the uraemic acidosis, while the metabolic alkalosis of vomiting has put the bicarbonate back to 24. Neither the pH nor the bicarbonate would have found this; only the gap does.',
  },
  {
    label: 'Normal',
    gas: { pco2: 40, hco3: 24, chronic: false, na: 140, cl: 104, albumin: 42 },
    story: 'For comparison.',
    answer: 'Nothing to find.',
  },
];

export default function MixedDisorders({ query }: { query: URLSearchParams }) {
  const [tab, setTab] = useTabParam('/mixed', TAB_IDS, 'interpret', query);
  const [gas, setGas] = useState<Gas>({ pco2: 20, hco3: 13, chronic: false, na: 140, cl: 103, albumin: 42 });
  const up = (p: Partial<Gas>) => setGas({ ...gas, ...p });
  const reading = useMemo(() => interpret(gas), [gas]);

  return (
    <div>
      <PageHead
        path="/mixed"
        lede="Compensation moves the same way as the primary disturbance and never quite finishes. That is inconvenient for the patient and useful for you: predict what the compensation should be, measure how far the blood gas is from it, and the difference is the second disorder."
      />
      <WhatIf
        options={CASES.map((c) => ({ label: c.label, explain: c.story }))}
        onApply={(o) => setGas(CASES.find((c) => c.label === o.label)!.gas)}
        onReset={() => setGas({ pco2: 40, hco3: 24, chronic: false, na: 140, cl: 104, albumin: 42 })}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="The blood gas">
            <Slider label="PCO₂" value={gas.pco2} min={10} max={100} step={1} unit="mmHg" onInput={(v) => up({ pco2: v })} normal={40} />
            <Slider label="Bicarbonate" value={gas.hco3} min={4} max={48} step={1} unit="mmol/L" onInput={(v) => up({ hco3: v })} normal={24} />
            <div class="readout-grid" style={{ marginTop: 6 }}>
              <Readout label="pH" value={reading.pH} digits={2} tone={reading.pH < 7.35 ? 'low' : reading.pH > 7.45 ? 'high' : 'good'} refRange="7.37–7.43" />
              <Readout label="[H⁺]" value={reading.h} digits={0} unit="nmol/L" refRange="37–43" title="24 × PCO₂ ÷ HCO₃⁻" />
            </div>
            <div class="btn-row" style={{ marginTop: 8 }}>
              <button class={!gas.chronic ? 'active' : ''} onClick={() => up({ chronic: false })}>
                Acute
              </button>
              <button class={gas.chronic ? 'active' : ''} onClick={() => up({ chronic: true })}>
                Chronic
              </button>
            </div>
            <p class="control-hint">Only matters for a respiratory primary disorder: the buffering is immediate, the renal response takes days.</p>
          </Panel>
          <Panel title="Electrolytes" note="For the anion gap, which finds the disorders the pH cannot.">
            <Slider label="Sodium" value={gas.na ?? 140} min={110} max={165} step={1} unit="mmol/L" onInput={(v) => up({ na: v })} normal={140} />
            <Slider label="Chloride" value={gas.cl ?? 104} min={70} max={125} step={1} unit="mmol/L" onInput={(v) => up({ cl: v })} normal={104} />
            <Slider label="Albumin" value={gas.albumin ?? 42} min={10} max={50} step={1} unit="g/L" onInput={(v) => up({ albumin: v })} normal={42} />
            <div class="readout-grid" style={{ marginTop: 6 }}>
              <Readout label="Anion gap" value={reading.gap} digits={0} unit="mmol/L" tone={reading.gap > 16 ? 'high' : 'normal'} refRange="8–16" />
              <Readout
                label="Corrected for albumin"
                value={reading.gapCorrected}
                digits={0}
                unit="mmol/L"
                tone={reading.gapCorrected > 16 ? 'high' : 'normal'}
                title="+2.5 mmol/L per 10 g/L the albumin is below 42"
              />
            </div>
            {reading.gapCorrected > 16 && reading.gap <= 16 && (
              <p class="callout danger" style={{ marginTop: 8 }}>
                The raw gap is normal and the corrected gap is not. Hypoalbuminaemia lowers the gap by removing the anionic charge that generates it — in a critically ill, nephrotic or cirrhotic
                patient it can conceal exactly the raised gap you are looking for.
              </p>
            )}
          </Panel>
        </div>
        <div>
          <Tabs2 tab={tab} setTab={setTab} />
          {tab === 'interpret' && (
            <>
              <Panel title="Rose's method, step by step">
                <ol class="steps">
                  <li>
                    <strong>The pH.</strong> {reading.pH.toFixed(2)} — {reading.acidaemic ? 'acidaemic' : reading.alkalaemic ? 'alkalaemic' : 'within the normal range'}.
                  </li>
                  <li>
                    <strong>Which number explains it?</strong> {reading.primaryText}
                  </li>
                  <li>
                    <strong>What should the compensation be?</strong> {reading.ruleText}
                  </li>
                  <li>
                    <strong>How far off is it?</strong> {reading.deltaText}
                  </li>
                </ol>
                {reading.equation && <Equation formula={reading.equation.formula} substituted={reading.equation.substituted} result={reading.equation.result} />}
                <p class={reading.mixed ? 'callout danger' : 'callout good'} style={{ marginTop: 8 }}>
                  <strong>{reading.verdict}</strong> {reading.verdictWhy}
                </p>
              </Panel>
              <Panel title="Where it sits on the map">
                <AcidBaseMap points={[{ pH: reading.pH, pco2: gas.pco2, label: 'this patient' }]} height={300} />
                <p class="control-hint">
                  Inside a band is a simple disorder with its expected compensation. Between bands is a mixed disorder — including the awkward case of a point sitting in the normal box with an
                  abnormal anion gap, which the map cannot show you and the gap can.
                </p>
              </Panel>
            </>
          )}
          {tab === 'map' && <MapTab gas={gas} reading={reading} />}
          {tab === 'cases' && <CasesTab onPick={(g) => setGas(g)} />}
        </div>
      </div>
      <div class="grid grid-2">
        <Predict
          question="pH 7.40, PCO₂ 60 mmHg, bicarbonate 37 mmol/L. The pH is normal. Is anything wrong?"
          options={['No', 'Yes — respiratory acidosis with metabolic alkalosis', 'Chronic respiratory acidosis alone', 'Metabolic alkalosis alone']}
          correct={1}
          explanation="Chronic hypercapnia at a PCO₂ of 60 should give a bicarbonate near 31, not 37. Compensation returns the pH towards normal but rarely to it, so a normal pH with these numbers means two disorders pulling opposite ways. Select “COPD given a diuretic” above."
        />
        <Predict
          question="A patient has a bicarbonate of 8 and a PCO₂ of 40. What does the PCO₂ tell you?"
          options={['It is normal, so the lungs are fine', 'It is inappropriately high by about 19 mmHg — a respiratory acidosis as well', 'It suggests chronic disease', 'Nothing without the pH']}
          correct={1}
          explanation="A 16 mmol/L fall in bicarbonate should lower the PCO₂ to about 21. Failing to do so makes the acidaemia far worse. A number inside the reference range can still be the wrong number for this patient."
        />
      </div>
      <Expand summary="Rose Table 17-3 in full">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Disorder</th>
                <th>Primary change</th>
                <th>Expected compensation</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Metabolic acidosis</th>
                <td>↓ HCO₃⁻</td>
                <td>PCO₂ falls 1.2 mmHg per 1 mmol/L fall</td>
              </tr>
              <tr>
                <th scope="row">Metabolic alkalosis</th>
                <td>↑ HCO₃⁻</td>
                <td>PCO₂ rises 0.7 mmHg per 1 mmol/L rise</td>
              </tr>
              <tr>
                <th scope="row">Respiratory acidosis, acute</th>
                <td>↑ PCO₂</td>
                <td>HCO₃⁻ rises 1 mmol/L per 10 mmHg</td>
              </tr>
              <tr>
                <th scope="row">Respiratory acidosis, chronic</th>
                <td>↑ PCO₂</td>
                <td>HCO₃⁻ rises 3.5 mmol/L per 10 mmHg</td>
              </tr>
              <tr>
                <th scope="row">Respiratory alkalosis, acute</th>
                <td>↓ PCO₂</td>
                <td>HCO₃⁻ falls 2 mmol/L per 10 mmHg</td>
              </tr>
              <tr>
                <th scope="row">Respiratory alkalosis, chronic</th>
                <td>↓ PCO₂</td>
                <td>HCO₃⁻ falls 4 mmol/L per 10 mmHg</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="note">
          These are empirical — measured in patients with each disorder, not derived. They are quoted here with a tolerance, because a real population scatters around them; a value just outside is a
          reason to look again rather than a second diagnosis.
        </p>
      </Expand>
      <BedsideEquations
        ids={['hplus', 'ag', 'deltaratio', 'winters', 'alkComp', 'respComp']}
        intro="Every compensation rule in one place, each with a patient in whom it reveals a second disorder."
      />
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>pH 7.37–7.43, PCO₂ 36–44 mmHg, bicarbonate 22–26 mmol/L; [H⁺] about 40 nmol/L.</p>}
          why={<p>The bicarbonate–CO₂ pair is the main extracellular buffer because both components are separately regulated — the kidney sets one, the lungs the other.</p>}
          change={<p>A primary change in either is followed by a change in the other in the same direction, restoring the ratio partly. Never completely, which is what leaves a measurable residual.</p>}
          abnormal={<p>Two or more disorders at once. They may cancel, leaving a normal pH; they may compound, as when a failing respiratory drive meets a metabolic acidosis.</p>}
          clinical={<p>Read the pH, identify the primary, predict the compensation, measure the difference. Then check the anion gap, which finds disorders the pH cannot.</p>}
        />
        <Sources cite={{ rose: [17, 19], evidence: 'clinical' }} />
      </Panel>
      <Related paths={['/acid-base', '/metabolic-acidosis', '/metabolic-alkalosis', '/respiratory', '/rta']} />
    </div>
  );
}

function Tabs2({ tab, setTab }: { tab: string; setTab: (t: (typeof TAB_IDS)[number]) => void }) {
  return (
    <div class="btn-row" style={{ marginBottom: 10 }} role="tablist">
      {(
        [
          ['interpret', 'Interpret'],
          ['map', 'The map'],
          ['cases', 'Cases'],
        ] as const
      ).map(([id, label]) => (
        <button key={id} role="tab" aria-selected={tab === id} class={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function MapTab({ gas, reading }: { gas: Gas; reading: ReturnType<typeof interpret> }) {
  const [highlight, setHighlight] = useState<Parameters<typeof AcidBaseMap>[0]['highlight']>(null);
  // Skip a case marker that would sit under the current point, so the two labels do not collide.
  const casePoints: MapPoint[] = CASES.filter((c) => c.label !== 'Normal')
    .map((c) => ({ pH: phFrom(c.gas.hco3, c.gas.pco2), pco2: c.gas.pco2, label: c.label, tone: 'case' as const }))
    .filter((p) => Math.abs(p.pH - reading.pH) > 0.02 || Math.abs(p.pco2 - gas.pco2) > 2);
  return (
    <>
      <Panel title="Rose Fig. 17-1" note="Each band is generated from its compensation rule, so the picture and the arithmetic cannot disagree.">
        <AcidBaseMap points={[{ pH: reading.pH, pco2: gas.pco2, label: 'this patient' }, ...casePoints]} height={380} highlight={highlight} />
        <div class="btn-row" style={{ marginTop: 8 }}>
          <button class={highlight === null ? 'active' : ''} onClick={() => setHighlight(null)}>
            All
          </button>
          <button onClick={() => setHighlight('metAcidosis')}>Metabolic acidosis</button>
          <button onClick={() => setHighlight('metAlkalosis')}>Metabolic alkalosis</button>
          <button onClick={() => setHighlight('respAcidoseAcute')}>Resp. acidosis (acute)</button>
          <button onClick={() => setHighlight('respAcidoseChronic')}>Resp. acidosis (chronic)</button>
          <button onClick={() => setHighlight('respAlkAcute')}>Resp. alkalosis (acute)</button>
          <button onClick={() => setHighlight('respAlkChronic')}>Resp. alkalosis (chronic)</button>
        </div>
      </Panel>
      <div class="grid grid-2">
        <Panel title="How to read it">
          <Chain
            steps={[
              { text: 'Curved dashed lines are bicarbonate isopleths' },
              { text: 'Each shaded band is one simple disorder, with its compensation' },
              { text: 'Inside a band: that disorder, compensating as expected' },
              { text: 'Between bands: a mixed disorder', direction: -1 },
              { text: 'In the normal box with a raised anion gap: still a mixed disorder', direction: -1 },
            ]}
          />
        </Panel>
        <Panel title="Why acute and chronic respiratory bands separate">
          <p>
            The immediate buffering of a changed PCO₂ is a property of haemoglobin and protein and happens in minutes; the renal response takes days. So the same PCO₂ gives a different bicarbonate,
            and a different pH, depending on how long it has been there — which is why chronic hypercapnia is so much better tolerated than the same value arriving suddenly.
          </p>
          <p class="note" style={{ marginBottom: 0 }}>
            The metabolic disorders have no such split. Ventilation responds within minutes and is complete within 12 to 24 hours, so there is only one band each.
          </p>
        </Panel>
      </div>
    </>
  );
}

function CasesTab({ onPick }: { onPick: (g: Gas) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Panel title="Worked cases" note="Try each one in the interpreter first; the answer is underneath.">
      {CASES.filter((c) => c.label !== 'Normal').map((c) => {
        const pH = phFrom(c.gas.hco3, c.gas.pco2);
        const gap = (c.gas.na ?? 140) - (c.gas.cl ?? 104) - c.gas.hco3;
        return (
          <div key={c.label} class="note" style={{ marginBottom: 10 }}>
            <strong>{c.label}</strong> — {c.story}
            <div class="mono" style={{ margin: '6px 0', fontSize: '0.85rem' }}>
              pH {pH.toFixed(2)} · PCO₂ {c.gas.pco2} mmHg · HCO₃⁻ {c.gas.hco3} mmol/L · anion gap {gap.toFixed(0)}
              {c.gas.albumin !== 42 ? ` · albumin ${c.gas.albumin} g/L` : ''}
            </div>
            <div class="btn-row">
              <button onClick={() => onPick(c.gas)}>Load into the interpreter</button>
              <button class="ghost" onClick={() => setOpen(open === c.label ? null : c.label)}>
                {open === c.label ? 'Hide' : 'Show'} the answer
              </button>
            </div>
            {open === c.label && <p style={{ marginTop: 8, marginBottom: 0 }}>{c.answer}</p>}
          </div>
        );
      })}
    </Panel>
  );
}

// ---------------------------------------------------------------- the interpreter
function interpret(gas: Gas) {
  const pH = phFrom(gas.hco3, gas.pco2);
  const h = (24 * gas.pco2) / Math.max(gas.hco3, 0.1);
  const acidaemic = pH < 7.36;
  const alkalaemic = pH > 7.44;
  const gap = (gas.na ?? 140) - (gas.cl ?? 104) - gas.hco3;
  const gapCorrected = gap + 0.25 * (42 - (gas.albumin ?? 42));

  const lowHco3 = gas.hco3 < 22;
  const highHco3 = gas.hco3 > 26;
  const lowPco2 = gas.pco2 < 36;
  const highPco2 = gas.pco2 > 44;

  // Which primary disorder can account for the pH?
  let rule: (typeof RULES)[keyof typeof RULES] | null = null;
  let primaryText = '';
  let metabolicPrimary = false;
  if (acidaemic) {
    if (lowHco3 && highPco2) {
      primaryText = 'Both: the bicarbonate is low and the PCO₂ is high, so this is a combined metabolic and respiratory acidosis.';
    } else if (lowHco3) {
      primaryText = 'The low bicarbonate. The primary disorder is a metabolic acidosis.';
      rule = RULES.metAcidosis;
      metabolicPrimary = true;
    } else {
      primaryText = 'The high PCO₂. The primary disorder is a respiratory acidosis.';
      rule = gas.chronic ? RULES.respAcidosisChronic : RULES.respAcidosisAcute;
    }
  } else if (alkalaemic) {
    if (highHco3 && lowPco2) {
      primaryText = 'Both: the bicarbonate is high and the PCO₂ is low, so this is a combined metabolic and respiratory alkalosis.';
    } else if (highHco3) {
      primaryText = 'The high bicarbonate. The primary disorder is a metabolic alkalosis.';
      rule = RULES.metAlkalosis;
      metabolicPrimary = true;
    } else {
      primaryText = 'The low PCO₂. The primary disorder is a respiratory alkalosis.';
      rule = gas.chronic ? RULES.respAlkalosisChronic : RULES.respAlkalosisAcute;
    }
  } else {
    // The pH is in the normal range. If the other two are not, that is itself the finding — but the
    // analysis still has to proceed from whichever component could be primary, or steps 3 and 4
    // would contradict step 2.
    if (highPco2) {
      rule = gas.chronic ? RULES.respAcidosisChronic : RULES.respAcidosisAcute;
      primaryText = 'The pH is normal while the PCO₂ is high — which is itself the finding, since compensation returns the pH towards normal and rarely to it. Taking the respiratory acidosis as primary:';
    } else if (lowPco2) {
      rule = gas.chronic ? RULES.respAlkalosisChronic : RULES.respAlkalosisAcute;
      primaryText = 'The pH is normal while the PCO₂ is low — itself the finding, since compensation rarely restores the pH completely. Taking the respiratory alkalosis as primary:';
    } else if (lowHco3) {
      rule = RULES.metAcidosis;
      metabolicPrimary = true;
      primaryText = 'The pH is normal while the bicarbonate is low. Taking the metabolic acidosis as primary:';
    } else if (highHco3) {
      rule = RULES.metAlkalosis;
      metabolicPrimary = true;
      primaryText = 'The pH is normal while the bicarbonate is high. Taking the metabolic alkalosis as primary:';
    } else {
      primaryText = 'Neither: the pH, PCO₂ and bicarbonate are all within the normal range.';
    }
  }

  let ruleText = 'No single primary disorder to compensate for.';
  let deltaText = '';
  let mixed = false;
  let verdict = '';
  let verdictWhy = '';
  let equation: { formula: string; substituted: string; result: string } | null = null;

  if (rule) {
    ruleText = `For ${/^[aeiou]/i.test(rule.label) ? 'an' : 'a'} ${rule.label}: ${rule.text}.`;
    if (metabolicPrimary) {
      const expected = rule.predict(gas.hco3);
      const diff = gas.pco2 - expected;
      equation = {
        formula: 'expected PCO₂ = 40 + slope × (HCO₃⁻ − 24)',
        substituted: `40 ${rule === RULES.metAcidosis ? '+ 1.2' : '+ 0.7'} × (${gas.hco3} − 24)`,
        result: `${expected.toFixed(0)} mmHg (measured ${gas.pco2})`,
      };
      if (Math.abs(diff) <= rule.tol) {
        deltaText = `The measured PCO₂ of ${gas.pco2} is within ${rule.tol} mmHg of the predicted ${expected.toFixed(0)} — appropriate compensation.`;
        verdict = `Simple ${rule.label}.`;
        verdictWhy = 'The compensation is what it should be, so there is no second respiratory disorder.';
      } else {
        mixed = true;
        deltaText = `The measured PCO₂ of ${gas.pco2} differs from the predicted ${expected.toFixed(0)} by ${Math.abs(diff).toFixed(0)} mmHg.`;
        verdict = `${rule.label[0].toUpperCase() + rule.label.slice(1)} with a ${diff > 0 ? 'respiratory acidosis' : 'respiratory alkalosis'}.`;
        verdictWhy =
          diff > 0
            ? 'The PCO₂ is higher than compensation explains, so ventilation is inadequate for the metabolic disturbance.'
            : 'The PCO₂ is lower than compensation explains, so something is driving ventilation beyond what the metabolic disturbance requires.';
      }
    } else {
      const expected = rule.predict(gas.pco2);
      const diff = gas.hco3 - expected;
      equation = {
        formula: 'expected HCO₃⁻ = 24 + slope × (PCO₂ − 40)',
        substituted: `24 + ${(rule.predict(50) - 24) / 10} × (${gas.pco2} − 40)`,
        result: `${expected.toFixed(0)} mmol/L (measured ${gas.hco3})`,
      };
      if (Math.abs(diff) <= rule.tol) {
        deltaText = `The measured bicarbonate of ${gas.hco3} is within ${rule.tol} mmol/L of the predicted ${expected.toFixed(0)} — appropriate compensation.`;
        verdict = `Simple ${rule.label}.`;
        verdictWhy = 'The compensation is what it should be for a disturbance of this duration.';
      } else {
        mixed = true;
        deltaText = `The measured bicarbonate of ${gas.hco3} differs from the predicted ${expected.toFixed(0)} by ${Math.abs(diff).toFixed(0)} mmol/L.`;
        verdict = `${rule.label[0].toUpperCase() + rule.label.slice(1)} with a ${diff > 0 ? 'metabolic alkalosis' : 'metabolic acidosis'}.`;
        verdictWhy =
          diff > 0
            ? 'The bicarbonate is higher than compensation explains. Consider whether the disturbance is in fact chronic before adding a second diagnosis.'
            : 'The bicarbonate is lower than compensation explains, so acid is being added or bicarbonate lost as well.';
      }
    }
  } else if (!acidaemic && !alkalaemic && !lowHco3 && !highHco3 && !lowPco2 && !highPco2) {
    verdict = 'No acid–base disorder on these numbers.';
    verdictWhy = 'But check the anion gap: a normal bicarbonate can conceal a metabolic acidosis and a metabolic alkalosis together.';
  } else {
    mixed = true;
    verdict = 'A mixed disorder.';
    verdictWhy = 'Both components are deranged in directions that reinforce each other, so there is no single primary disorder to compensate for.';
  }

  if (gapCorrected > 16) {
    verdictWhy += ` The anion gap, corrected for albumin, is ${gapCorrected.toFixed(0)} — there is a raised-gap metabolic acidosis here whatever else is going on.`;
    mixed = mixed || !(acidaemic && lowHco3);
  }

  return { pH, h, acidaemic, alkalaemic, gap, gapCorrected, primaryText, ruleText, deltaText, verdict, verdictWhy, mixed, equation, hco3Check: hco3From(pH, gas.pco2) };
}
