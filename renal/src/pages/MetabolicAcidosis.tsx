import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related, Busy, useTabParam } from '../ui/page';
import { Panel, Readout, Slider, Sources, Predict, BarRow, Tabs, Chain, LineChart, Expand, type Series } from '../ui/kit';
import { AcidBaseMap } from '../ui/AcidBaseMap';
import { makeParams, useStep, useCourse, NORMAL } from '../sim/hooks';
import type { ParamPatch } from '../engine/types';

const TAB_IDS = ['buffers', 'gap', 'causes', 'treat'] as const;

interface Cause {
  label: string;
  patch: ParamPatch;
  /** does the acid's anion stay in the plasma? */
  gap: 'high' | 'normal';
  explain: string;
  days: number;
}

const CAUSES: Cause[] = [
  {
    label: 'Lactic acidosis',
    patch: { lacticAcid: 8, cardiacFunction: 0.5 },
    gap: 'high',
    days: 1,
    explain:
      'Lactate accumulates because it is reabsorbed proximally by a sodium–lactate cotransporter and because the hypoperfusion producing it leaves little urine to lose it in. The anion stays, so the gap rises by more than the bicarbonate falls.',
  },
  {
    label: 'Ketoacidosis',
    patch: { ketoAcid: 8, glucose: 480, insulin: 0.05 },
    gap: 'high',
    days: 1,
    explain:
      'β-hydroxybutyrate and acetoacetate are filtered beyond the tubule\'s capacity to reabsorb them, so a good deal is lost in the urine. That loss lowers the anion gap and offsets the cell buffering, which is why the Δ/Δ ratio here sits nearer 1 than 1.6.',
  },
  {
    label: 'Ammonium chloride load',
    patch: { extraAcid: 150 },
    gap: 'normal',
    days: 4,
    explain:
      'The acid brings its own chloride, which replaces the bicarbonate one for one. The archetypal hyperchloraemic acidosis, and the load Batlle used to establish what a normal urine anion gap looks like under an acid stress.',
  },
  {
    label: 'Diarrhoea',
    patch: { diarrhea: 3, waterIntake: 2, naIntake: 100 },
    gap: 'normal',
    days: 4,
    explain:
      'Stool carries up to 50 mmol/L of base. The kidney answers properly — ammonium excretion climbs and the urine anion gap goes negative — but volume depletion limits how far, which is why severe diarrhoea produces a worse acidosis than the base loss alone would predict.',
  },
  {
    label: 'Uraemic acidosis',
    patch: { nephronFraction: 0.18 },
    gap: 'high',
    days: 20,
    explain:
      'Ammonium excretion per surviving nephron is normal; there are simply too few nephrons. And because filtration is what has been lost, the sulfate of the dietary acid load is retained alongside the acid, so the gap rises.',
  },
  {
    label: 'Distal (type 1) RTA',
    patch: { transporters: { HATPase: 0.15 } },
    gap: 'normal',
    days: 20,
    explain:
      'The collecting-tubule proton pump cannot lower the urine pH, so both titratable acid and ammonium excretion fall and the dietary acid load is retained day after day. Filtration is intact, so the sulfate still leaves.',
  },
  {
    label: 'Proximal (type 2) RTA',
    patch: { transporters: { NBCe1: 0.25 } },
    gap: 'normal',
    days: 20,
    explain: 'A lowered bicarbonate threshold, not a proportional loss. Below the new threshold everything is still reclaimed, which is why the acidosis stops at 14–20 mmol/L instead of falling without limit.',
  },
  {
    label: 'Type 4 RTA (hypoaldosteronism)',
    patch: { aldoSynthesis: 0 },
    gap: 'normal',
    days: 20,
    explain:
      'Mild acidosis with hyperkalaemia and — unlike type 1 — an acid urine, because the defect is ammonium production rather than acidification. The hyperkalaemia does much of that: tubular potassium competes with ammonium on the loop carrier and medullary recycling fails.',
  },
];

export default function MetabolicAcidosis({ query }: { query: URLSearchParams }) {
  const [tab, setTab] = useTabParam('/metabolic-acidosis', TAB_IDS, 'buffers', query);
  return (
    <div>
      <PageHead
        path="/metabolic-acidosis"
        lede="Four defences meet an acid load and only the last of them removes it. Because the first three are so good, the plasma bicarbonate measures how much buffer has been spent rather than how much acid arrived — and the anion gap, not the bicarbonate, is what tells you which acid it was."
      />
      <Tabs
        tabs={[
          { id: 'buffers', label: 'The four defences' },
          { id: 'gap', label: 'The anion gap' },
          { id: 'causes', label: 'Causes side by side' },
          { id: 'treat', label: 'Giving alkali' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'buffers' && <Buffers />}
      {tab === 'gap' && <Gap />}
      {tab === 'causes' && <Causes />}
      {tab === 'treat' && <Treat />}
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>Acid production of 50–100 mmol/day is matched by net acid excretion: 10–40 mmol as titratable acid on phosphate, 30–60 as ammonium, minus any bicarbonate lost.</p>}
          why={
            <p>
              Buffering in three compartments keeps the free hydrogen ion concentration nearly constant while the bicarbonate is consumed. Ventilation then lowers the PCO₂ by 1.2 mmHg for every 1
              mmol/L of bicarbonate lost. Only the kidney removes the acid.
            </p>
          }
          change={
            <p>
              Add acid with chloride and the gap does not move. Add acid with an anion the kidney cannot clear and the gap rises. Add acid with an anion it clears easily — hippurate, D-lactate — and
              the gap stays normal despite an organic acid.
            </p>
          }
          abnormal={
            <p>
              Ammonium excretion is the term that adapts, up to five-fold; titratable acidity is fixed by the filtered phosphate. A disorder that removes the ammonium response — renal failure, type 1
              or type 4 RTA — produces a slow, grinding acidosis; one that overwhelms it produces a fast, severe one.
            </p>
          }
          clinical={
            <p>
              Anion gap first, corrected for albumin. If it is high, work the Δ/Δ ratio for a hidden second disorder. If it is normal, the urine anion gap decides between the gut and the kidney — and
              the urine pH and plasma potassium then separate the three renal tubular acidoses.
            </p>
          }
        />
        <Sources cite={{ rose: [19, 11, 17], refs: ['batlle1988'], evidence: 'clinical' }} />
      </Panel>
      <Related paths={['/rta', '/mixed', '/urine-chemistry', '/acid-base', '/metabolic-alkalosis']} />
    </div>
  );
}

// ------------------------------------------------------------------ buffers
function Buffers() {
  const [load, setLoad] = useState(12);
  // Rose's worked example: 12 mmol of H+ per litre of extracellular fluid.
  const cellShare = 0.58;
  const hco3NoBuffer = Math.max(24 - load, 0.5);
  const hco3WithBuffer = Math.max(24 - load * (1 - cellShare), 0.5);
  const phAt = (hco3: number, pco2: number) => 6.1 + Math.log10(Math.max(hco3, 0.2) / (0.03 * pco2));
  const pco2Comp = Math.max(40 + 1.2 * (hco3WithBuffer - 24), 12);

  const base = useMemo(() => makeParams({}), []);
  const acid = useMemo(() => makeParams({ extraAcid: 120 }), []);
  const { points, busy } = useStep(base, acid, 8, 0.1, 60);

  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="One acid load, three defences" note="Rose's worked example: hydrogen ion added to each litre of extracellular fluid.">
            <Slider label="Acid added" value={load} min={0} max={24} step={0.5} unit=" mmol/L of ECF" onInput={setLoad} normal={0} />
            <div class="readout-grid">
              <Readout label="If only ECF bicarbonate buffered" value={hco3NoBuffer} digits={1} unit="mmol/L" tone={hco3NoBuffer < 12 ? 'danger' : 'low'} title="HCO₃⁻ falls 1:1 with the load" />
              <Readout label="pH then" value={phAt(hco3NoBuffer, 40)} digits={2} tone={phAt(hco3NoBuffer, 40) < 7.1 ? 'danger' : 'low'} />
              <Readout label="With cell and bone buffering" value={hco3WithBuffer} digits={1} unit="mmol/L" tone={hco3WithBuffer < 15 ? 'low' : 'normal'} title="58% of the load goes onto cell protein, phosphate and bone carbonate" />
              <Readout label="pH then" value={phAt(hco3WithBuffer, 40)} digits={2} tone={phAt(hco3WithBuffer, 40) < 7.2 ? 'low' : 'normal'} />
              <Readout label="With hyperventilation too" value={pco2Comp} digits={0} unit="mmHg PCO₂" tone="normal" refRange="1.2 per 1 mmol/L" />
              <Readout label="Final pH" value={phAt(hco3WithBuffer, pco2Comp)} digits={2} tone={phAt(hco3WithBuffer, pco2Comp) < 7.3 ? 'low' : 'good'} />
            </div>
            <div class="readout-grid">
              <Readout label="H⁺ added" value={load * 1e6} digits={0} unit="nmol/L" title="12 mmol/L is 12 million nmol/L" />
              <Readout label="Rise in free H⁺" value={Math.pow(10, 9 - phAt(hco3WithBuffer, pco2Comp)) - 40} digits={0} unit="nmol/L" tone="good" />
              <Readout label="Taken up by buffers" value={100 * (1 - (Math.pow(10, 9 - phAt(hco3WithBuffer, pco2Comp)) - 40) / Math.max(load * 1e6, 1))} digits={4} unit="%" tone="good" />
            </div>
            <p class="control-hint">
              Twelve millimoles is twelve <em>million</em> nanomoles. The free hydrogen ion concentration moves by tens of nanomoles. Essentially the whole load has been taken up, which is the entire
              point of a buffer — and the reason the plasma bicarbonate is a measure of buffer spent, not of acid present.
            </p>
          </Panel>
        </div>
        <div>
          <Panel title="The kidney takes days">
            <Busy on={busy} />
            {points && (
              <>
                <LineChart
                  xLabel="days"
                  series={[
                    { label: 'Bicarbonate (mmol/L)', points: points.map((p) => ({ x: p.day, y: p.HCO3 })), color: '#6aa9e8' },
                    { label: 'PCO₂ (mmHg) ÷ 2', points: points.map((p) => ({ x: p.day, y: p.PCO2 / 2 })), color: '#e07b6a' },
                  ] as Series[]}
                  height={165}
                />
                <LineChart
                  xLabel="days"
                  series={[
                    { label: 'Ammonium excretion (mmol/day)', points: points.map((p) => ({ x: p.day, y: p.urineNH4 })), color: '#7bc47f' },
                    { label: 'Net acid excretion (mmol/day)', points: points.map((p) => ({ x: p.day, y: p.nae })), color: '#f2b134' },
                  ] as Series[]}
                  height={165}
                />
                <p class="control-hint">
                  A steady 120 mmol/day acid load. The bicarbonate falls immediately, the PCO₂ follows within hours, and ammoniagenesis takes days to climb — but it is the only line that can end the
                  problem. Titratable acidity barely moves, because the filtered phosphate does not.
                </p>
              </>
            )}
          </Panel>
          <Panel title="Why the compensation stops helping" note="Rose Table 19-2">
            <Chain
              steps={[
                { text: 'Metabolic acidosis: HCO₃⁻ 19, PCO₂ 40 → pH 7.29' },
                { text: 'Ventilation rises, PCO₂ falls to 34 → pH 7.37' },
                { text: 'Hypocapnia raises tubular cell pH' },
                { text: 'H⁺ secretion and HCO₃⁻ reabsorption fall; bicarbonate is lost in the urine' },
                { text: 'HCO₃⁻ falls to 16 at the same PCO₂ 34 → pH 7.29 again' },
              ]}
            />
            <p class="control-hint">
              Over a few days the arterial pH in chronic metabolic acidosis is the same whether or not the respiratory compensation happened. It matters anyway, because the acidoses severe enough to
              kill are acute.
            </p>
          </Panel>
          <Expand summary="Why ammonium and not titratable acid?">
            <p>
              Free hydrogen ions are useless for excretion: at the minimum urine pH of 4.5 the concentration is under 0.05 mmol/L, so even 3 litres of urine carries less than a sixth of a millimole.
              The acid has to leave attached to something. Phosphate is the main urinary buffer, but the amount filtered is set by phosphate balance and does not rise with an acid load, so titratable
              acidity is capped near 40 mmol/day.
            </p>
            <p>
              Ammonium is different, because the kidney makes the buffer itself from glutamine. Production climbs over several days under an acid stimulus, and excretion can exceed 250 mmol/day. That
              is the whole reason a healthy person survives a large acid load and why anything that blocks ammoniagenesis — too few nephrons, hyperkalaemia, a failure of collecting-duct acidification
              to trap the ammonia — produces an acidosis that will not resolve.
            </p>
            <Sources cite={{ rose: [19, 11], evidence: 'physiology' }} />
          </Expand>
        </div>
      </div>
      <Predict
        question="Twelve millimoles of hydrogen ion is added to each litre of extracellular fluid. How far does the plasma bicarbonate fall?"
        options={['By 12 mmol/L', 'By about 5 mmol/L — most of the load is buffered in cells and bone', 'Not at all', 'By 24 mmol/L']}
        correct={1}
        explanation="55–60% of an acid load ends up on cell protein, phosphate and bone carbonate. The share rises as the extracellular bicarbonate is depleted, which is why the apparent bicarbonate space grows in severe acidosis."
      />
    </>
  );
}

// ------------------------------------------------------------------ anion gap
function Gap() {
  const [na, setNa] = useState(140);
  const [cl, setCl] = useState(104);
  const [hco3, setHco3] = useState(24);
  const [alb, setAlb] = useState(40);
  const gap = na - cl - hco3;
  const normalGap = 2.43 * (alb / 10);
  const delta = (gap - normalGap) / Math.max(24 - hco3, 0.1);
  const high = gap > normalGap + 4;

  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Calculate it, and correct it">
            <Slider label="Sodium" value={na} min={115} max={165} step={1} unit=" mmol/L" onInput={setNa} normal={140} />
            <Slider label="Chloride" value={cl} min={70} max={130} step={1} unit=" mmol/L" onInput={setCl} normal={104} />
            <Slider label="Bicarbonate" value={hco3} min={2} max={45} step={1} unit=" mmol/L" onInput={setHco3} normal={24} />
            <Slider label="Albumin" value={alb} min={10} max={55} step={1} unit=" g/L" onInput={setAlb} normal={40} hint="most of the normal gap is albumin's negative charge" />
            <div class="readout-grid">
              <Readout label="Anion gap" value={gap} digits={0} unit="mmol/L" tone={high ? 'high' : 'normal'} />
              <Readout label="This patient's normal gap" value={normalGap} digits={1} unit="mmol/L" title="≈ 2.5 mmol/L per g/dL of albumin" />
              <Readout label="Raised by" value={gap - normalGap} digits={1} unit="mmol/L" tone={high ? 'high' : 'normal'} />
              {hco3 < 22 && <Readout label="Δ gap / Δ bicarbonate" value={delta} digits={2} tone={delta < 1 ? 'low' : delta > 2 ? 'high' : 'good'} />}
            </div>
            <p class="note" style={{ marginTop: 8 }}>
              {hco3 >= 22
                ? 'The bicarbonate is not low, so there is no metabolic acidosis to apportion — but note that the gap can still be raised in metabolic alkalosis, from haemoconcentration, from albumin carrying more negative charge at a higher pH, and from an alkalaemia-driven rise in lactate production.'
                : delta < 1
                  ? 'Below 1: the bicarbonate has fallen further than the gap has risen, so there is a normal-anion-gap acidosis on top of the high-gap one — diarrhoea or hyperchloraemic fluid on top of lactic acidosis, for instance.'
                  : delta > 2
                    ? 'Above 2: the gap has risen further than the bicarbonate has fallen, so something is holding the bicarbonate up — a coexisting metabolic alkalosis. The classic case is a vomiting patient who becomes hypoperfused.'
                    : 'Between 1 and 2: consistent with an uncomplicated high-anion-gap acidosis. Lactic acidosis tends toward 1.6; ketoacidosis nearer 1, because the ketoanions are lost in the urine.'}
            </p>
          </Panel>
          <Panel title="Why the gap is albumin">
            <BarRow label="Albumin charge" value={normalGap} max={16} unit=" mmol/L" color="#6aa9e8" />
            <BarRow label="Phosphate, sulfate, organic anions" value={7} max={16} unit=" mmol/L" color="#f2b134" />
            <BarRow label="K⁺, Ca²⁺, Mg²⁺ (unmeasured cations, subtracted)" value={7} max={16} unit=" mmol/L" color="#7bc47f" />
            <p class="control-hint">
              The unmeasured anions other than albumin are very nearly cancelled by the unmeasured cations, which is why the gap tracks albumin so closely. It is also why a patient with an albumin of
              20 g/L and a gap of 15 has a markedly raised gap, not a mildly raised one: their baseline was about 5.
            </p>
            <Sources cite={{ rose: [19], evidence: 'clinical' }} />
          </Panel>
        </div>
        <div>
          <Panel title="Which anion?">
            <Chain
              steps={[
                { text: 'An acid is added: H⁺ plus an anion' },
                { text: 'H⁺ consumes bicarbonate; the bicarbonate falls' },
                { text: 'The anion has to go somewhere' },
                { text: 'Chloride (HCl, NH₄Cl) → replaces HCO₃⁻ → gap unchanged' },
                { text: 'Lactate, ketoacid, sulfate → retained → gap rises' },
                { text: 'Hippurate, D-lactate → excreted as fast as produced → gap normal' },
              ]}
            />
            <p class="control-hint">
              This last row is the one that catches people out. A glue-sniffer overproducing hippuric acid has a normal anion gap, because hippurate is both filtered and secreted and almost none is
              reabsorbed — so it is regularly mistaken for renal tubular acidosis. The acid is still retained; only the anion has left.
            </p>
          </Panel>
          <Expand summary="Four presets worth trying">
            <p>
              <button class="btn" onClick={() => { setNa(140); setCl(104); setHco3(24); setAlb(40); }}>
                Normal
              </button>{' '}
              <button class="btn" onClick={() => { setNa(140); setCl(100); setHco3(6); setAlb(40); }}>
                Diabetic ketoacidosis
              </button>{' '}
              <button class="btn" onClick={() => { setNa(140); setCl(115); setHco3(12); setAlb(40); }}>
                Diarrhoea
              </button>{' '}
              <button class="btn" onClick={() => { setNa(140); setCl(77); setHco3(9); setAlb(40); }}>
                Lactic acidosis with vomiting
              </button>
            </p>
            <p>
              The last is Rose's case 19-2: a gap of 54 against a bicarbonate of 9, a Δ/Δ of about 3:1. Fluid repletion restored perfusion, the lactate was metabolised back into bicarbonate, and the
              bicarbonate rose to 37 — revealing that the true fall had been 28, a 1.7:1 ratio typical of lactic acidosis, with a vomiting-induced alkalosis underneath.
            </p>
          </Expand>
        </div>
      </div>
      <Predict
        question="A patient with an albumin of 18 g/L has an anion gap of 14 mmol/L. Is the gap raised?"
        options={['No, 14 is within the normal range', 'Yes, markedly — their expected gap is about 4, so it is raised by about 10', 'Cannot say without the potassium', 'Only if the bicarbonate is low']}
        correct={1}
        explanation="Subtract about 2.5 mmol/L for every 1 g/dL of albumin below normal. Failing to do this is the commonest way a high-gap acidosis gets missed."
      />
    </>
  );
}

// ------------------------------------------------------------------ causes
function Causes() {
  const [idx, setIdx] = useState(0);
  const c = CAUSES[idx];
  const base = useMemo(() => makeParams({}), []);
  const sick = useMemo(() => makeParams(c.patch), [idx]);
  const { points, busy } = useStep(base, sick, c.days, c.days > 5 ? 0.25 : 0.02, 60, c.days > 5 ? 4 : undefined, c.days > 5 ? 1 : undefined);
  const end = points?.[points.length - 1];
  const normal = NORMAL();

  return (
    <>
      <WhatIf options={CAUSES.map((x) => ({ label: x.label, explain: x.explain }))} onApply={(o) => setIdx(CAUSES.findIndex((x) => x.label === o.label))} onReset={() => setIdx(0)} active={c.label} />
      <div class="grid grid-sidebar">
        <div>
          <Panel title={`After ${c.days} day${c.days === 1 ? '' : 's'}`}>
            <Busy on={busy} />
            {end && (
              <div class="readout-grid">
                <Readout label="Bicarbonate" value={end.HCO3} digits={1} unit="mmol/L" delta={end.HCO3 - normal.plasma.HCO3} deltaDigits={1} tone={end.HCO3 < 12 ? 'danger' : 'low'} />
                <Readout label="pH" value={end.pH} digits={3} tone={end.pH < 7.2 ? 'danger' : end.pH < 7.35 ? 'low' : 'normal'} />
                <Readout label="PCO₂" value={end.PCO2} digits={0} unit="mmHg" refRange={`expect ${(40 + 1.2 * (end.HCO3 - 24)).toFixed(0)}`} />
                <Readout label="Anion gap" value={end.anionGap} digits={1} unit="mmol/L" tone={end.anionGap > 14 ? 'high' : 'normal'} />
                <Readout label="Chloride" value={end.Cl} digits={1} unit="mmol/L" tone={end.Cl > 110 ? 'high' : 'normal'} />
                <Readout label="Potassium" value={end.K} digits={2} unit="mmol/L" tone={end.K > 5.5 ? 'danger' : end.K < 3.5 ? 'danger' : 'normal'} />
                <Readout label="Urine pH" value={end.urinePH} digits={2} tone={end.urinePH > 5.3 ? 'high' : 'good'} refRange="< 5.3 if acidification works" />
                <Readout label="Urine anion gap" value={end.urineAnionGap} digits={0} unit="mmol/L" tone={end.urineAnionGap > 0 ? 'high' : 'good'} title="Na⁺ + K⁺ − Cl⁻; negative means ammonium is leaving" />
                <Readout label="Ammonium excretion" value={end.urineNH4} digits={0} unit="mmol/day" tone={end.urineNH4 < 30 ? 'low' : 'good'} />
              </div>
            )}
            <p class="note" style={{ marginTop: 8, marginBottom: 0 }}>{c.explain}</p>
          </Panel>
        </div>
        <div>
          <Panel title="Course">
            {points && (
              <>
                <LineChart
                  xLabel="days"
                  series={[
                    { label: 'Bicarbonate (mmol/L)', points: points.map((p) => ({ x: p.day, y: p.HCO3 })), color: '#6aa9e8' },
                    { label: 'Anion gap (mmol/L)', points: points.map((p) => ({ x: p.day, y: p.anionGap })), color: '#c08d20' },
                    { label: 'Chloride − 90 (mmol/L)', points: points.map((p) => ({ x: p.day, y: p.Cl - 90 })), color: '#7bc47f' },
                  ] as Series[]}
                  height={175}
                />
                <LineChart
                  xLabel="days"
                  series={[
                    { label: 'Ammonium excretion (mmol/day)', points: points.map((p) => ({ x: p.day, y: p.urineNH4 })), color: '#5ecfba' },
                    { label: 'Urine anion gap (mmol/L)', points: points.map((p) => ({ x: p.day, y: p.urineAnionGap })), color: '#e07b6a' },
                  ] as Series[]}
                  height={175}
                />
                <p class="control-hint">
                  The two urine lines are mirror images, and that is the whole justification for the urine anion gap: ammonium leaves as ammonium chloride, so the more of it the kidney excretes, the
                  further chloride exceeds sodium plus potassium.
                </p>
              </>
            )}
          </Panel>
          <Panel title="On the map">{end && <AcidBaseMap points={[{ pH: end.pH, pco2: end.PCO2, label: c.label }]} height={260} show={['metAcidosis', 'respAlkAcute', 'respAlkChronic']} />}</Panel>
        </div>
      </div>
      <Panel title="Reading the two gaps together">
        <table class="table">
          <thead>
            <tr>
              <th>Plasma gap</th>
              <th>Urine gap</th>
              <th>Where the problem is</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>High</td>
              <td>uninterpretable</td>
              <td>An acid whose anion is retained — lactate, ketoacid, uraemic anions, a toxic alcohol. The urine gap fails here because those anions are in the urine too.</td>
            </tr>
            <tr>
              <td>Normal</td>
              <td>Negative</td>
              <td>The kidney is excreting ammonium properly, so the base is being lost somewhere else: diarrhoea, a fistula, a ureteric diversion.</td>
            </tr>
            <tr>
              <td>Normal</td>
              <td>Positive</td>
              <td>Ammonium excretion is the problem: renal failure, type 1 or type 4 renal tubular acidosis. Urine pH and plasma potassium then separate them.</td>
            </tr>
          </tbody>
        </table>
        <p class="control-hint">
          And one trap: with avid sodium retention (urine sodium at or below 25 mmol/L) the tubule reabsorbs the chloride too, so no ammonium chloride is excreted and the gap fails to go negative
          even when the kidney is doing its best. The volume depletion has produced a reversible distal acidification defect of its own.
        </p>
        <Sources cite={{ refs: ['batlle1988'], rose: [19], evidence: 'clinical' }} />
      </Panel>
      <Expand summary="What this model does not reproduce">
        <p>
          The model tracks chloride by mass balance — what is eaten, what is lost from the gut, what the kidney excretes — rather than deriving it from extracellular electroneutrality. That is
          deliberate: chloride has to be free to be a cause, because a chloride-depletion alkalosis needs chloride back and not merely volume. The price is that its plasma chloride is stiffer than a
          patient's.
        </p>
        <p>
          Where the retained acid has no anion of its own to leave behind — distal and type 4 renal tubular acidosis, an ammonium chloride load, diarrhoea — a real patient replaces the lost
          bicarbonate with chloride and keeps a normal anion gap. Here chloride moves only part of the way, so the calculated gap on those four runs sits several mmol/L above where a patient's would
          be. Proximal RTA and uraemic acidosis, where the kidney itself loses the sodium salt, do come out right. The urine anion gap — which is the test the chapter actually teaches for these
          disorders — is reproduced in all of them.
        </p>
      </Expand>
      <Predict
        question="A patient has a normal anion gap acidosis and a urine anion gap of +30 mmol/L. Where is the problem?"
        options={['The gut — this is diarrhoea', 'The kidney — ammonium excretion is inadequate', 'There is no acidosis', 'A toxic alcohol']}
        correct={1}
        explanation="A positive urine anion gap means chloride is not accompanying much ammonium out. Batlle's patients with distal renal tubular acidosis averaged +23, the hyperkalaemic form +30, and selective aldosterone deficiency +39; his patients with diarrhoea averaged −20."
      />
    </>
  );
}

// ------------------------------------------------------------------ treatment
function Treat() {
  const [weight, setWeight] = useState(70);
  const [hco3, setHco3] = useState(6);
  const [target, setTarget] = useState(10);
  const space = 0.4 + 2.6 / Math.max(hco3, 1);
  const deficit = space * weight * Math.max(target - hco3, 0);
  const pco2 = Math.max(40 + 1.2 * (hco3 - 24), 12);
  const phNow = 6.1 + Math.log10(Math.max(hco3, 0.2) / (0.03 * pco2));
  const phAfter = 6.1 + Math.log10(Math.max(target, 0.2) / (0.03 * Math.max(40 + 1.2 * (target - 24), 12)));

  // an organic acidosis, treated by removing the cause rather than by giving alkali
  const ill = useMemo(() => makeParams({ lacticAcid: 8, cardiacFunction: 0.5 }), []);
  const { points: sickPts, state: sickState, busy: b1 } = useCourseFrom(ill, 1);
  const { points: recPts, busy: b2 } = useCourse(useMemo(() => makeParams({}), []), 2, 0.02, sickState?.body);

  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="How much bicarbonate, and to what target" note="Rose Fig. 19-8: the apparent space grows as the bicarbonate falls.">
            <Slider label="Lean body weight" value={weight} min={35} max={130} step={1} unit=" kg" onInput={setWeight} normal={70} />
            <Slider label="Current bicarbonate" value={hco3} min={2} max={18} step={0.5} unit=" mmol/L" onInput={setHco3} normal={24} />
            <Slider label="Target bicarbonate" value={target} min={6} max={20} step={1} unit=" mmol/L" onInput={setTarget} normal={24} hint="aim for a pH of about 7.20, not 7.40" />
            <div class="readout-grid">
              <Readout label="Apparent bicarbonate space" value={space} digits={2} unit="× weight" title="0.4 + 2.6 ÷ [HCO₃⁻]" />
              <Readout label="In litres" value={space * weight} digits={0} unit="L" />
              <Readout label="Bicarbonate needed" value={deficit} digits={0} unit="mmol" tone={deficit > 400 ? 'high' : 'normal'} />
              <Readout label="pH now" value={phNow} digits={2} tone={phNow < 7.1 ? 'danger' : 'low'} />
              <Readout label="pH at target" value={phAfter} digits={2} tone={phAfter < 7.2 ? 'low' : 'good'} />
            </div>
            <BarRow label="Space as a fraction of body weight" value={space} max={0.9} unit="" color="#6aa9e8" />
            <p class="control-hint">
              At a normal bicarbonate the space is about half of body weight. Below 8–10 mmol/L it exceeds 70 per cent, because almost all the added alkali is going onto cell and bone buffers rather
              than staying in the extracellular fluid. Drag the bicarbonate down and watch the space grow.
            </p>
            <Sources cite={{ rose: [19], evidence: 'physiology' }} />
          </Panel>
          <Panel title="Four reasons not to overshoot">
            <ul class="bullets">
              <li>
                <strong>Cerebrospinal pH falls.</strong> Buffering the given bicarbonate generates CO₂, which crosses the blood–brain barrier far faster than bicarbonate does. The brain senses the
                rise in PCO₂ before it sees the alkali, so the neurological state can worsen while the arterial pH improves.
              </li>
              <li>
                <strong>Oxygen delivery falls.</strong> A higher pH shifts the oxyhaemoglobin dissociation curve to the left.
              </li>
              <li>
                <strong>Overshoot alkalosis.</strong> In lactic acidosis and ketoacidosis the retained anions are metabolised back into bicarbonate once the underlying problem is treated. Alkali given
                early is added to that.
              </li>
              <li>
                <strong>The early gas flatters you.</strong> Bicarbonate equilibrates through the extracellular fluid within fifteen minutes but takes two to four hours to equilibrate with cell and
                bone buffers. A gas at fifteen minutes overstates what has been achieved.
              </li>
            </ul>
          </Panel>
        </div>
        <div>
          <Panel title="The organic acidosis that treats itself">
            <Busy on={b1 || b2} />
            {sickPts && recPts && (
              <>
                <LineChart
                  xLabel="days (production stops at day 1)"
                  series={[
                    {
                      label: 'Bicarbonate (mmol/L)',
                      points: [...sickPts.map((p) => ({ x: p.day, y: p.HCO3 })), ...recPts.map((p) => ({ x: p.day + 1, y: p.HCO3 }))],
                      color: '#6aa9e8',
                    },
                    {
                      label: 'Anion gap (mmol/L)',
                      points: [...sickPts.map((p) => ({ x: p.day, y: p.anionGap })), ...recPts.map((p) => ({ x: p.day + 1, y: p.anionGap }))],
                      color: '#c08d20',
                    },
                  ] as Series[]}
                  height={180}
                />
                <LineChart
                  xLabel="days"
                  series={[
                    {
                      label: 'Arterial pH',
                      points: [...sickPts.map((p) => ({ x: p.day, y: p.pH })), ...recPts.map((p) => ({ x: p.day + 1, y: p.pH }))],
                      color: '#e07b6a',
                    },
                  ] as Series[]}
                  height={150}
                />
                <p class="control-hint">
                  A day of lactic acidosis, then perfusion is restored and production stops. No alkali is given. The accumulated lactate is metabolised back into bicarbonate and the acidosis corrects
                  itself over roughly a day — which is exactly why alkali given during the first day would leave the patient alkalotic on the second.
                </p>
              </>
            )}
          </Panel>
          <Expand summary="When alkali probably does help">
            <p>
              The chapter's position is physiological: raise the pH to about 7.20 in a severely acidaemic patient, and otherwise treat the cause. That has since been tested. BICAR-ICU randomised 389
              critically ill adults with an arterial pH of 7.20 or below either to 4.2 per cent sodium bicarbonate aimed at a pH above 7.30 or to no bicarbonate at all. The primary composite outcome
              did not differ: 66 per cent against 71 per cent, a difference of −5.5 per cent with a confidence interval from −15.2 to +4.2.
            </p>
            <p>
              In the prespecified subgroup with acute kidney injury, day-28 survival was better with bicarbonate — 54 per cent against 37 per cent. That is a subgroup finding and should be read as
              such, but it fits the physiology: those are the patients who cannot regenerate the bicarbonate themselves. Metabolic alkalosis, hypernatraemia and hypocalcaemia were all commoner in the
              bicarbonate arm.
            </p>
            <Sources cite={{ refs: ['jaber2018bicar'], rose: [19], evidence: 'guideline', update: 'A randomised trial where the chapter had only reasoning.' }} />
          </Expand>
        </div>
      </div>
      <Predict
        question="A 70 kg patient has a bicarbonate of 4 mmol/L. Roughly what volume does given bicarbonate distribute into?"
        options={['14 L — the extracellular fluid', 'About 35 L — half of body weight', 'About 75 L — more than body weight, because nearly all the buffering is in cells and bone', '42 L — total body water']}
        correct={2}
        explanation="The space is (0.4 + 2.6 ÷ 4) × 70 ≈ 74 L. It can exceed body weight, because the cell and bone buffer supply is effectively inexhaustible — the 'space' is a buffering capacity, not a volume."
      />
    </>
  );
}

/** A course that also exposes the ending body state, so a second course can start from it. */
function useCourseFrom(p: ReturnType<typeof makeParams>, days: number) {
  const base = useMemo(() => makeParams({}), []);
  return useStep(base, p, days, 0.02, 60);
}
