import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, Related, Busy, useTabParam } from '../ui/page';
import { Panel, Readout, Slider, Sources, Predict, BarRow, Tabs, Chain, LineChart, Expand, type Series } from '../ui/kit';
import { AcidBaseMap, phFrom } from '../ui/AcidBaseMap';
import { makeParams, useStep, NORMAL } from '../sim/hooks';

const TAB_IDS = ['acute', 'chronic', 'oxygen', 'reading'] as const;

export default function Respiratory({ query }: { query: URLSearchParams }) {
  const [tab, setTab] = useTabParam('/respiratory', TAB_IDS, 'acute', query);
  return (
    <div>
      <PageHead
        path="/respiratory"
        lede="Carbon dioxide is the strongest stimulus to breathing there is, so a high PCO₂ almost always means ventilation failed rather than that CO₂ production rose. Acutely there is almost no defence — bicarbonate cannot buffer carbonic acid. Given days the kidney does the work, and does it so well that protecting the pH becomes its own problem."
      />
      <Tabs
        tabs={[
          { id: 'acute', label: 'Acute: cells only' },
          { id: 'chronic', label: 'Chronic: the kidney' },
          { id: 'oxygen', label: 'Oxygen and the drive' },
          { id: 'reading', label: 'Reading the gas' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'acute' && <Acute />}
      {tab === 'chronic' && <Chronic />}
      {tab === 'oxygen' && <Oxygen />}
      {tab === 'reading' && <Reading />}
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>About 15 000 mmol of CO₂ a day is produced and excreted by the lung, holding the arterial PCO₂ at 40 ± 4 mmHg. It is carried in the blood mostly as bicarbonate.</p>}
          why={
            <p>
              The central chemoreceptors sense the pH of the cerebral interstitium, which tracks the PCO₂; the peripheral ones sense hypoxaemia. Minute ventilation rises 1–4 L for every 1 mmHg rise
              in PCO₂, which is why hypercapnia is a late finding in lung disease.
            </p>
          }
          change={
            <p>
              Acutely, only the cell buffers respond and the bicarbonate rises about 1 mmol/L per 10 mmHg — the pH falls steeply. Over three to five days renal hydrogen secretion raises it by about
              3.5 per 10, and the pH is nearly restored.
            </p>
          }
          abnormal={
            <p>
              The compensation removes the acidaemic drive to breathe, so both the hypercapnia and the hypoxaemia end up worse than they need to be. Add a diuretic-induced metabolic alkalosis and
              ventilation falls further still.
            </p>
          }
          clinical={
            <p>
              Ventilate rather than alkalinise, and bring a chronic PCO₂ down slowly — CO₂ leaves the brain far faster than bicarbonate, so abrupt correction raises the cerebrospinal fluid pH sharply
              and can cause seizures.
            </p>
          }
        />
        <Sources cite={{ rose: [20, 21, 11], refs: ['schwartz1965', 'gennari1972', 'arbus1969'], evidence: 'experimental' }} />
      </Panel>
      <Related paths={['/mixed', '/acid-base', '/metabolic-acidosis', '/metabolic-alkalosis', '/bicarbonate']} />
    </div>
  );
}

// ------------------------------------------------------------------ acute
function Acute() {
  const [pco2, setPco2] = useState(70);
  const acuteHco3 = 24 + 0.1 * (pco2 - 40);
  const chronicHco3 = pco2 > 40 ? 24 + 0.35 * (pco2 - 40) : 24 + 0.4 * (pco2 - 40);
  const noBuffer = 24;
  const ph = (h: number) => phFrom(h, pco2);

  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="What buffering actually buys you" note="Acute change in PCO₂, before the kidney has done anything.">
            <Slider label="Arterial PCO₂" value={pco2} min={15} max={110} step={1} unit=" mmHg" onInput={setPco2} normal={40} />
            <div class="readout-grid">
              <Readout label="pH with no buffering at all" value={ph(noBuffer)} digits={2} tone={ph(noBuffer) < 7.2 ? 'danger' : 'normal'} title="bicarbonate stays at 24" />
              <Readout label="Bicarbonate, acute" value={acuteHco3} digits={1} unit="mmol/L" refRange="1 per 10 mmHg" />
              <Readout label="pH, acute" value={ph(acuteHco3)} digits={2} tone={ph(acuteHco3) < 7.2 ? 'danger' : ph(acuteHco3) > 7.5 ? 'high' : 'normal'} />
              <Readout label="Bicarbonate, chronic" value={chronicHco3} digits={1} unit="mmol/L" refRange={pco2 > 40 ? '3.5 per 10 mmHg' : '4 per 10 mmHg'} />
              <Readout label="pH, chronic" value={ph(chronicHco3)} digits={2} tone={ph(chronicHco3) < 7.25 ? 'low' : ph(chronicHco3) > 7.5 ? 'high' : 'good'} />
              <Readout label="Gained by the kidney" value={ph(chronicHco3) - ph(acuteHco3)} digits={3} unit="pH" tone="good" />
            </div>
            <BarRow label="Cell buffering alone" value={Math.abs(ph(acuteHco3) - ph(noBuffer)) * 1000} max={200} unit=" mpH" color="var(--c-coral)" />
            <BarRow label="Plus the renal compensation" value={Math.abs(ph(chronicHco3) - ph(noBuffer)) * 1000} max={200} unit=" mpH" color="var(--c-teal)" />
            <p class="control-hint">
              Take the PCO₂ to 80. Without any buffering the pH would be 7.10; the cell buffers get it to 7.17. That is nearly nothing — and it is because bicarbonate, the body's main extracellular
              buffer, cannot buffer carbonic acid. Give the kidney three to five days and the same PCO₂ gives a pH of 7.30.
            </p>
          </Panel>
        </div>
        <div>
          <Panel title="Where the two bands sit">
            <AcidBaseMap
              points={[
                { pH: ph(acuteHco3), pco2, label: 'acute' },
                { pH: ph(chronicHco3), pco2, label: 'chronic', tone: 'case' },
              ]}
              height={300}
              show={['respAcidoseAcute', 'respAcidoseChronic', 'respAlkAcute', 'respAlkChronic']}
            />
            <p class="control-hint">
              Drag the PCO₂ and watch the two points separate. The vertical distance between the acute and chronic bands at any PCO₂ is the whole of what the kidney contributes — and the reason a
              single blood gas cannot tell you how long this has been going on.
            </p>
          </Panel>
          <Panel title="Why bicarbonate is no use here">
            <Chain
              steps={[
                { text: 'CO₂ + H₂O ⇌ H₂CO₃ ⇌ H⁺ + HCO₃⁻' },
                { text: 'A buffer must be the conjugate base of a *different* acid' },
                { text: 'HCO₃⁻ + H₂CO₃ → H₂CO₃ + HCO₃⁻: nothing happens' },
                { text: 'So only haemoglobin and cell protein can take up the H⁺' },
                { text: 'They release HCO₃⁻ as they do — about 1 mmol/L per 10 mmHg' },
              ]}
            />
            <p class="control-hint">
              The same asymmetry explains the difference between the two respiratory disorders and the two metabolic ones. A metabolic acid load meets 24 mmol/L of extracellular bicarbonate head on; a
              respiratory one meets none of it.
            </p>
          </Panel>
          <Expand summary="The four numbers, in one place">
            <table class="table">
              <thead>
                <tr>
                  <th>Disorder</th>
                  <th>Acute</th>
                  <th>Chronic</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Respiratory acidosis</td>
                  <td>HCO₃⁻ +1 per 10 mmHg</td>
                  <td>+3.5 per 10 mmHg</td>
                </tr>
                <tr>
                  <td>Respiratory alkalosis</td>
                  <td>HCO₃⁻ −2 per 10 mmHg</td>
                  <td>−4 per 10 mmHg</td>
                </tr>
              </tbody>
            </table>
            <p>
              Note the asymmetry in the acute rows. Hypocapnia is buffered twice as well as hypercapnia, because hydrogen ions can come out of cells more freely than they can go in. It is the chronic
              rows that matter clinically, though: chronic hypocapnia is the one acid–base disorder in which compensation can restore the pH essentially to normal.
            </p>
            <Sources cite={{ refs: ['arbus1969', 'schwartz1965', 'gennari1972'], rose: [20, 21], evidence: 'experimental' }} />
          </Expand>
        </div>
      </div>
      <Predict
        question="The PCO₂ rises acutely from 40 to 80 mmHg. How far does the plasma bicarbonate rise?"
        options={['By 14 mmol/L', 'By about 4 mmol/L — the cell buffers are all there is', 'Not at all', 'It falls']}
        correct={1}
        explanation="One millimole per litre per 10 mmHg. The resulting pH of 7.17 is barely better than the 7.10 you would get with no buffering at all, which is why acute hypercapnia is so much more dangerous than chronic."
      />
    </>
  );
}

// ------------------------------------------------------------------ chronic
function Chronic() {
  const [offset, setOffset] = useState(40);
  const base = useMemo(() => makeParams({}), []);
  const sick = useMemo(() => makeParams({ paco2Offset: offset }), [offset]);
  const { points, busy } = useStep(base, sick, 40, 0.25, 60, 3, 1);
  const end = points?.[points.length - 1];
  const day0 = points?.[0];
  const normal = NORMAL();

  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Hypoventilate, then wait" note="A sustained change in ventilatory drive, followed to a new steady state.">
            <Slider
              label="Change in ventilatory drive"
              value={offset}
              min={-25}
              max={60}
              step={5}
              unit=" mmHg"
              onInput={setOffset}
              normal={0}
              hint="positive = hypoventilation; the PCO₂ achieved is less than this, because the acidaemia pushes back"
            />
            <Busy on={busy} />
            {end && day0 && (
              <div class="readout-grid">
                <Readout label="PCO₂" value={end.PCO2} digits={1} unit="mmHg" delta={end.PCO2 - normal.plasma.PCO2} deltaDigits={0} tone={end.PCO2 > 55 ? 'high' : end.PCO2 < 30 ? 'low' : 'normal'} />
                <Readout label="Bicarbonate" value={end.HCO3} digits={1} unit="mmol/L" delta={end.HCO3 - normal.plasma.HCO3} deltaDigits={1} tone={end.HCO3 > 30 ? 'high' : end.HCO3 < 18 ? 'low' : 'normal'} />
                <Readout
                  label="Compensation achieved"
                  value={(end.HCO3 - normal.plasma.HCO3) / ((end.PCO2 - normal.plasma.PCO2) / 10 || 1)}
                  digits={2}
                  unit="mmol/L per 10 mmHg"
                  refRange={offset > 0 ? 'expect 3.5' : 'expect 4'}
                  tone="good"
                />
                <Readout label="pH at the end" value={end.pH} digits={3} tone={end.pH < 7.3 ? 'low' : end.pH > 7.48 ? 'high' : 'good'} />
                <Readout label="pH on day 0" value={day0.pH} digits={3} tone={day0.pH < 7.25 ? 'danger' : day0.pH < 7.35 ? 'low' : 'normal'} title="before the kidney had time to act" />
                <Readout label="Urine pH" value={end.urinePH} digits={2} tone={end.urinePH < 5.5 ? 'good' : 'normal'} />
              </div>
            )}
            <p class="control-hint">
              Note what the slider does and does not control. It changes the drive to breathe, not the PCO₂ achieved — the resulting acidaemia pushes back through the same reflex, so the PCO₂ moves
              by rather less than the offset. That is what happens in a patient, and it is why hypercapnia is such a late finding in lung disease.
            </p>
          </Panel>
          <Panel title="The compensation that removes the stimulus">
            <Chain
              steps={[
                { text: 'PCO₂ rises; the tubular cell becomes acid' },
                { text: 'H⁺ secretion and bicarbonate reabsorptive capacity rise' },
                { text: 'Plasma bicarbonate climbs 3.5 mmol/L per 10 mmHg over 3–5 days' },
                { text: 'Arterial pH returns toward normal' },
                { text: 'The acidaemic drive to ventilation is now gone' },
                { text: 'Baseline ventilation falls: the PCO₂ ends higher and the PO₂ lower than they had to be' },
              ]}
            />
            <p class="control-hint">
              Lower the bicarbonate again with ammonium chloride and baseline ventilation rises, the PCO₂ falls and the PO₂ rises — and the slope of ventilation against PCO₂ returns toward normal.
              What was read as a respiratory centre insensitive to CO₂ is largely arithmetic: at a high bicarbonate, a given rise in PCO₂ produces a smaller rise in hydrogen ion concentration.
            </p>
            <Sources cite={{ refs: ['schwartz1965'], rose: [20], evidence: 'experimental' }} />
          </Panel>
        </div>
        <div>
          <Panel title="Forty days">
            {points && (
              <>
                <LineChart
                  xLabel="days"
                  series={[
                    { label: 'PCO₂', axis: 'Arterial PCO₂ (mmHg)', points: points.map((p) => ({ x: p.day, y: p.PCO2 })), color: 'var(--c-coral)' },
                    { label: 'Bicarbonate', axis: 'Plasma HCO₃⁻ (mmol/L)', points: points.map((p) => ({ x: p.day, y: p.HCO3 })), color: 'var(--c-blue)' },
                  ] as Series[]}
                  height={175}
                />
                <LineChart yLabel="Arterial pH"
                  xLabel="days"
                  series={[{ label: 'Arterial pH', points: points.map((p) => ({ x: p.day, y: p.pH })), color: 'var(--c-teal)' }] as Series[]}
                  height={150}
                />
                <p class="control-hint">
                  The PCO₂ moves within minutes and the pH with it. The bicarbonate climbs over days, and the pH recovers as it does. Nothing about the lung has changed — only the kidney.
                </p>
                <p class="control-hint">
                  Watch the pH line turn over near the end. As the bicarbonate rises the acidaemia eases, the drive to breathe eases with it, and the PCO₂ drifts up again — so the compensation keeps
                  chasing a target that is still moving. That feedback is real, and it is why this model takes longer to settle than the three to five days the textbook gives for the renal response
                  itself.
                </p>
              </>
            )}
          </Panel>
          <Panel title="On the map">
            {end && day0 && (
              <AcidBaseMap
                points={[
                  { pH: day0.pH, pco2: day0.PCO2, label: 'day 0', tone: 'case' },
                  { pH: end.pH, pco2: end.PCO2, label: 'steady state' },
                ]}
                height={260}
                show={['respAcidoseAcute', 'respAcidoseChronic', 'respAlkAcute', 'respAlkChronic']}
              />
            )}
          </Panel>
        </div>
      </div>
      <Predict
        question="A patient with a chronic PCO₂ of 70 mmHg has a normal arterial pH. Is the compensation complete?"
        options={[
          'Yes, and that is expected',
          'No — the renal compensation for hypercapnia is partial, so a normal pH means something else is also raising the bicarbonate: a diuretic, vomiting, or corticosteroids',
          'It means the PCO₂ measurement is wrong',
          'It means the hypercapnia is acute',
        ]}
        correct={1}
        explanation="At a PCO₂ of 70 the expected bicarbonate is about 34 and the expected pH about 7.31. A normal pH means a superimposed metabolic alkalosis — which is worth finding, because it is suppressing ventilation further and making both the hypercapnia and the hypoxaemia worse."
      />
    </>
  );
}

// ------------------------------------------------------------------ oxygen
function Oxygen() {
  const [pco2, setPco2] = useState(40);
  const [fio2, setFio2] = useState(21);
  const [aa, setAa] = useState(12);
  const pio2 = (760 - 47) * (fio2 / 100);
  const pAO2 = pio2 - pco2 / 0.8;
  const paO2 = Math.max(pAO2 - aa, 5);
  // the threshold at which hypoxaemia begins to drive ventilation, per Rose Fig. 20-2
  const hypoxicThreshold = pco2 >= 40 ? 80 : 55;

  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Alveolar gas, and the A–a gradient">
            <Slider label="Arterial PCO₂" value={pco2} min={20} max={100} step={1} unit=" mmHg" onInput={setPco2} normal={40} />
            <Slider label="Inspired oxygen" value={fio2} min={21} max={60} step={1} unit=" %" onInput={setFio2} normal={21} />
            <Slider label="A–a gradient" value={aa} min={5} max={70} step={1} unit=" mmHg" onInput={setAa} normal={10} hint="5–10 under 30 years, 15–20 in the elderly; always raised in intrinsic lung disease" />
            <div class="readout-grid">
              <Readout label="Inspired PO₂" value={pio2} digits={0} unit="mmHg" title="(760 − 47) × FiO₂" />
              <Readout label="Alveolar PO₂" value={pAO2} digits={0} unit="mmHg" title="PiO₂ − PCO₂ / 0.8" />
              <Readout label="Arterial PO₂" value={paO2} digits={0} unit="mmHg" tone={paO2 < 55 ? 'danger' : paO2 < 70 ? 'low' : 'good'} />
              <Readout label="Hypoxic drive begins at" value={hypoxicThreshold} digits={0} unit="mmHg" title="80 mmHg when the PCO₂ cannot fall; 50–60 when it can" />
              <Readout label="Hypoxic drive active?" value={paO2 < hypoxicThreshold ? 'yes' : 'no'} tone={paO2 < hypoxicThreshold ? 'high' : 'normal'} />
            </div>
            <BarRow label="Alveolar PO₂" value={pAO2} max={350} unit=" mmHg" color="var(--c-teal)" />
            <BarRow label="Taken by CO₂" value={pco2 / 0.8} max={350} unit=" mmHg" color="var(--c-coral)" />
            <p class="control-hint">
              Raise the PCO₂ on room air and the PO₂ falls with it, because the alveolar partial pressures must add to atmospheric. That is why every hypercapnic patient breathing room air is
              hypoxaemic — and why supplemental oxygen fixes the hypoxaemia without touching the hypercapnia. Only ventilation removes CO₂.
            </p>
            <p class="control-hint">
              The A–a gradient adds what the acid–base numbers cannot. It is always raised in hypercapnia from intrinsic lung disease; a normal gradient effectively excludes the lungs and points to
              the respiratory centre, the chest wall, the respiratory muscles — or to a primary metabolic alkalosis whose compensation is the hypercapnia.
            </p>
          </Panel>
        </div>
        <div>
          <Panel title="Why oxygen raises the PCO₂ — mostly not by hypoventilation">
            <BarRow label="Reduced minute ventilation" value={5} max={23} unit=" mmHg" color="var(--c-amber)" />
            <BarRow label="Worse V/Q matching + Haldane effect" value={18} max={23} unit=" mmHg" color="var(--c-coral)" />
            <p class="control-hint">
              In the study Rose cites, oxygen given to patients with chronic lung disease in acute respiratory failure reduced minute ventilation by about 7 per cent, which accounted for 5 mmHg of a
              23 mmHg rise in PCO₂. The rest came from releasing hypoxic pulmonary vasoconstriction — sending blood to poorly ventilated areas and so raising the dead-space fraction — and from the
              Haldane effect, oxygenated haemoglobin carrying less CO₂.
            </p>
            <p class="control-hint">
              The practical conclusion is not to withhold oxygen from a hypoxaemic patient. It is to titrate it: aim for a PO₂ of 60–65 mmHg and a saturation above 90 per cent, and watch the PCO₂.
              Maintaining the PO₂ above 55 mmHg improves both survival and quality of life in chronic lung disease.
            </p>
            <Sources cite={{ rose: [20], evidence: 'experimental' }} />
          </Panel>
          <Panel title="The asthma sequence">
            <Chain
              steps={[
                { text: 'Mucous plugging and bronchoconstriction → hypoxaemia' },
                { text: 'Hypoxaemia and intrapulmonary mechanoreceptors → hyperventilation' },
                { text: 'Mild to moderate attack: hypocapnia, respiratory alkalosis' },
                { text: 'Airway resistance rises; maximum minute ventilation falls' },
                { text: 'PCO₂ climbs back to "normal" — this is exhaustion, not improvement' },
                { text: 'Then frank hypercapnia' },
              ]}
            />
            <p class="control-hint">
              A PCO₂ of 40 in an acutely breathless asthmatic is one of the most reliably misread numbers in medicine. Generalised: in intrinsic lung disease, even a few millimetres of hypercapnia
              means advanced dysfunction or a second hit to ventilatory drive, because CO₂ is normally such a powerful stimulus.
            </p>
          </Panel>
        </div>
      </div>
      <Predict
        question="A 24-year-old in status asthmaticus has a PCO₂ of 41 mmHg and a PO₂ of 58 mmHg. What does that mean?"
        options={['They are improving — the PCO₂ is normal', 'They are tiring: in an acute attack the PCO₂ should be low, so a normal one means minute ventilation is failing', 'Nothing in particular', 'They are over-sedated']}
        correct={1}
        explanation="Expect hypocapnia in a mild or moderate attack. A rising PCO₂ tracks rising airway resistance and falling maximum minute ventilation. This patient needs escalation now, not reassurance."
      />
    </>
  );
}

// ------------------------------------------------------------------ reading
const GASES = [
  {
    label: 'pH 7.30, PCO₂ 70, HCO₃⁻ 31',
    stories: [
      'Chronic bronchitis, now with persistent diarrhoea — a metabolic acidosis complicating chronic hypercapnia.',
      'Chronic hypercapnia, now with fever and purulent sputum and a lobar consolidation — acute on chronic respiratory acidosis.',
      'Extrinsic asthma, five days of vomiting from theophylline toxicity, then an acute attack when the theophylline was stopped — metabolic alkalosis with acute hypercapnia.',
    ],
    comment:
      'The acute rule predicts a bicarbonate of 27, the chronic rule predicts 35. The measured 31 lies between the bands, and all three of these histories produce it. Nothing in the numbers chooses between them.',
  },
  {
    label: 'pH 7.53, PCO₂ 58, HCO₃⁻ 47',
    stories: [
      'Chronic obstructive lung disease with cor pulmonale, recently started on a diuretic — metabolic alkalosis on top of chronic hypercapnia.',
      'Severe CO₂ retention, just intubated and ventilated — acute hypocapnia superimposed on chronic hypercapnia, or posthypercapnic alkalosis.',
      'Five days of persistent vomiting — a primary metabolic alkalosis whose respiratory compensation is the hypercapnia.',
    ],
    comment:
      'A high PCO₂ with an alkaline pH. The commonest cause is the first, but the third is worth taking seriously: severe hypoxaemia limits how far compensatory hypoventilation can go, so a PCO₂ this high in a pure metabolic alkalosis suggests underlying lung disease. Here the alkalosis corrected with sodium chloride, which settles it.',
  },
  {
    label: 'pH 7.34, PCO₂ 65, HCO₃⁻ 34',
    stories: [
      'Stable chronic hypercapnia. Or: stable chronic hypercapnia, then recurrent vomiting, then aspiration pneumonia.',
    ],
    comment:
      'This one sits neatly inside the chronic band, and it is a trap. A triad of chronic respiratory acidosis, metabolic alkalosis and acute respiratory acidosis can land in exactly the same place as uncomplicated chronic hypercapnia. Values inside a confidence band are not proof of a simple disorder.',
  },
];

function Reading() {
  const [idx, setIdx] = useState(0);
  const g = GASES[idx];
  return (
    <>
      <Panel title="One blood gas, several stories">
        <div class="chips">
          {GASES.map((x, i) => (
            <button key={x.label} class={`chip ${i === idx ? 'active' : ''}`} onClick={() => setIdx(i)}>
              {x.label}
            </button>
          ))}
        </div>
        <ol class="bullets" style={{ marginTop: 12 }}>
          {g.stories.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p class="note">{g.comment}</p>
        <p class="control-hint">
          The confidence bands are useful guides, but interpreting them in a vacuum is how mixed disorders get missed. Rose's own summary: this cannot proceed without a complete history and
          examination.
        </p>
        <Sources cite={{ rose: [20, 17], refs: ['arbus1969', 'schwartz1965'], evidence: 'clinical' }} />
      </Panel>
      <div class="grid grid-2">
        <Panel title="Correcting a chronic PCO₂ too fast">
          <Chain
            steps={[
              { text: 'Chronic PCO₂ 70, bicarbonate 34, pH 7.31 — already well defended' },
              { text: 'Ventilated; PCO₂ falls to 40 within the hour' },
              { text: 'CO₂ leaves the brain quickly; bicarbonate does not' },
              { text: 'Cerebrospinal fluid pH rises sharply' },
              { text: 'Seizures, coma — improved by letting the PCO₂ rise again' },
            ]}
          />
          <p class="control-hint">
            There was nothing to gain from speed: the renal compensation had already protected the arterial pH. The same asymmetry, running the other way, is why neurological symptoms are much more
            prominent in respiratory than in metabolic acid–base disorders.
          </p>
        </Panel>
        <Panel title="Treating a superimposed alkalosis">
          <p class="note">
            A metabolic alkalosis in a patient with chronic hypercapnia is not cosmetic: it suppresses ventilation further and worsens both the hypoxaemia and the hypercapnia. Stopping the diuretic
            and giving sodium chloride is the answer, but it is impractical in someone who is still oedematous.
          </p>
          <p class="note">
            Acetazolamide, 250–375 mg once or twice a day, lowers the bicarbonate and increases the urine output at the same time by inhibiting proximal sodium bicarbonate reabsorption. A urine pH
            above 7.0 confirms it is working. Two cautions: aim for the bicarbonate appropriate to the PCO₂ rather than for 24, or the patient becomes severely acidaemic; and expect a transient rise
            in PCO₂ of 3–7 mmHg first, from partial inhibition of red-cell carbonic anhydrase.
          </p>
          <Sources cite={{ rose: [20, 15], evidence: 'clinical' }} />
        </Panel>
      </div>
      <Expand summary="Respiratory alkalosis: the same logic, mirrored">
        <p>
          Hypocapnia is defended in the same two stages, and rather better. Within ten minutes hydrogen ions leave the cells and consume bicarbonate — about 2 mmol/L per 10 mmHg. Over two to three
          days renal hydrogen secretion falls, bicarbonate appears in the urine and ammonium excretion falls, taking the total to about 4 mmol/L per 10 mmHg. Gennari's dogs showed that the kidney does
          this by excreting cations rather than by retaining chloride — sodium on a normal salt intake, potassium when sodium was restricted — which is the opposite of how it adapts to hypercapnia.
        </p>
        <p>
          The result is the only acid–base disorder in which compensation can return the pH essentially to normal. Two things follow. Chronic respiratory alkalosis is nearly symptomless, while acute
          hypocapnia below a PCO₂ of 25–30 mmHg causes paraesthesiae, cramps, carpopedal spasm and syncope, largely through a 35–40 per cent fall in cerebral blood flow. And a bicarbonate of 10 mmol/L
          or less is never the compensation for hypocapnia — it is a metabolic acidosis, whatever the PCO₂ says.
        </p>
        <p>
          Respiratory alkalosis is also an early and easily missed sign. It appears in Gram-negative septicaemia before the lactate rises or the pressure falls; in hepatic failure through retained
          amines; in salicylate poisoning alongside the metabolic acidosis; and in pregnancy and the luteal phase through progesterone. In pneumonia, embolism and interstitial fibrosis it often
          persists despite oxygen, because the drive is coming from vagal mechanoreceptors in the lung rather than from hypoxaemia.
        </p>
        <Sources cite={{ refs: ['gennari1972'], rose: [21], evidence: 'experimental' }} />
      </Expand>
      <Predict
        question="A patient has a PCO₂ of 20 mmHg and a bicarbonate of 16 mmol/L. Chronic respiratory alkalosis, or something else?"
        options={[
          'Definitely chronic respiratory alkalosis',
          'Either that, or acute respiratory alkalosis with a metabolic acidosis — 4 per 10 gives 16, but the acute rule gives 20, so a 4 mmol/L metabolic acidosis fits equally',
          'Definitely metabolic acidosis',
          'The numbers are impossible',
        ]}
        correct={1}
        explanation="This is Rose's salicylate case: a stuporous child who had been playing with a bottle of aspirin. Salicylate stimulates the respiratory centre directly and causes a metabolic acidosis, and the two together pull the bicarbonate below what the hypocapnia alone would explain."
      />
    </>
  );
}
