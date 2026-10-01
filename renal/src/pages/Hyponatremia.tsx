import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related, Busy, useTabParam } from '../ui/page';
import { Panel, Readout, Slider, Sources, Predict, BarRow, Tabs, Chain, LineChart, Expand, type Series } from '../ui/kit';
import { BedsideEquations } from '../ui/EquationCard';
import { makeParams, useSteady, useStep, NORMAL } from '../sim/hooks';
import type { ParamPatch } from '../engine/types';

const TAB_IDS = ['why', 'diagnose', 'fluids', 'correct'] as const;

interface Cause {
  label: string;
  patch: ParamPatch;
  days: number;
  group: 'low volume' | 'euvolaemic' | 'high volume' | 'normal excretion';
  explain: string;
}

const CAUSES: Cause[] = [
  {
    label: 'SIADH',
    patch: { adhAutonomous: 5, waterIntake: 1.35, naIntake: 100 },
    days: 25,
    group: 'euvolaemic',
    explain:
      'Antidiuretic hormone released without an osmotic or volume stimulus, and sodium handling entirely intact. Water is retained, the volume receptors see the expansion and answer with a natriuresis — so the urine sodium is high, and the patient is not oedematous.',
  },
  {
    label: 'Hypovolaemia (diarrhoea, drinking)',
    patch: { diarrhea: 2, waterIntake: 3, naIntake: 20 },
    days: 8,
    group: 'low volume',
    explain:
      'The baroreceptors are calling for antidiuretic hormone and the patient is thirsty, so water is both retained and drunk. This release is appropriate: perfusion is being defended at the expense of tonicity. The urine sodium gives it away.',
  },
  {
    label: 'Severe heart failure',
    patch: { cardiacFunction: 0.42, waterIntake: 2.5 },
    days: 25,
    group: 'high volume',
    explain:
      'The total volume is grossly expanded and the arterial side is not, so the carotid sinus reports underfilling and the hormone stays on. Hyponatraemia here means advanced disease, and predicts worse survival.',
  },
  {
    label: 'Cirrhosis with ascites',
    patch: { vasodilation: 0.5, portalHypertension: 0.7, albumin: 2.6, waterIntake: 2.5 },
    days: 25,
    group: 'high volume',
    explain:
      'The same arterial underfilling reached another way: a dilated splanchnic bed holding a large share of the blood volume, at a mean arterial pressure that often reads normal.',
  },
  {
    label: 'Thiazide',
    patch: { drugs: { thiazide: 0.8 }, adhAutonomous: 2.5, waterIntake: 2.2, naIntake: 70 },
    days: 10,
    group: 'low volume',
    explain:
      'The thiazide acts in the cortex, so the medullary gradient survives and the hormone can still concentrate the urine. Add potassium and sodium loss and increased drinking, and this is the diuretic that causes hyponatraemia — usually within two weeks of starting.',
  },
  {
    label: 'Primary polydipsia',
    patch: { waterIntake: 19 },
    days: 20,
    group: 'normal excretion',
    explain:
      'Water excretion is entirely normal; the intake simply exceeds it. The urine is maximally dilute, which is what separates this from everything else — and it is why restriction corrects it so fast that overcorrection becomes the risk.',
  },
  {
    label: 'Adrenal insufficiency',
    patch: { aldoSynthesis: 0, glucocorticoid: 0, waterIntake: 2.5, naIntake: 100 },
    days: 14,
    group: 'low volume',
    explain: 'Cortisol deficiency impairs water excretion; aldosterone deficiency wastes sodium. The company it keeps — hyperkalaemia and a metabolic acidosis — is what points at it.',
  },
];

export default function Hyponatremia({ query }: { query: URLSearchParams }) {
  const [tab, setTab] = useTabParam('/hyponatremia', TAB_IDS, 'why', query);
  return (
    <div>
      <PageHead
        path="/hyponatremia"
        lede="Two questions, and the second makes the diagnosis: how did the water get retained, and why is it still there? A normal kidney clears more than ten litres of free water a day, so hyponatraemia is almost never a drinking problem — it is a story about why the antidiuretic hormone has not switched off."
      />
      <Tabs
        tabs={[
          { id: 'why', label: 'Why the water stays' },
          { id: 'diagnose', label: 'Two numbers, seven causes' },
          { id: 'fluids', label: 'Why saline can make it worse' },
          { id: 'correct', label: 'How fast' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'why' && <Why />}
      {tab === 'diagnose' && <Diagnose />}
      {tab === 'fluids' && <Fluids />}
      {tab === 'correct' && <Correct />}
      <BedsideEquations
        ids={['furst', 'efwc', 'edelman', 'adrogue', 'nadeficit', 'maxuv']}
        intro="First ask whether the kidney can excrete free water at all (Furst ratio, electrolyte-free water clearance, solute-limited urine volume). Then size the correction (Adrogué–Madias, sodium deficit), remembering that potassium counts as much as sodium (Edelman)."
      />
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>Antidiuretic hormone stops below a plasma osmolality of about 275. The urine osmolality then falls to 40–100 mmol/kg and over 10 litres a day of free water can be excreted.</p>}
          why={<p>The plasma sodium is exchangeable sodium plus exchangeable potassium over total body water. Only water retention (or, with thiazides, effective solute loss) changes that ratio; isosmotic losses cannot.</p>}
          change={<p>Impair water excretion even modestly — a urine osmolality that will not go below 222 in someone taking 400 mosmol and 2 L a day — and 200 mL is retained every day, indefinitely.</p>}
          abnormal={
            <p>
              Almost every hyponatraemic patient has an excess of antidiuretic hormone: inappropriate in SIADH, appropriate in volume depletion, heart failure and cirrhosis. The exceptions are renal
              failure and primary polydipsia.
            </p>
          }
          clinical={
            <p>
              Effective osmolality, then urine osmolality, then urine sodium. Then ask how long it has been going on — because that, more than the number, decides how fast it may be corrected.
            </p>
          }
        />
        <Sources cite={{ rose: [23, 22, 9], refs: ['sterns1986'], evidence: 'clinical' }} />
      </Panel>
      <Related paths={['/water-disorders', '/adh', '/free-water', '/body-water', '/diuretics']} />
    </div>
  );
}

// ------------------------------------------------------------------ why
function Why() {
  const [intake, setIntake] = useState(2.5);
  const [adh, setAdh] = useState(0);
  const p = useMemo(() => makeParams({ waterIntake: intake, adhAutonomous: adh, naIntake: 120 }), [intake, adh]);
  const { ev, busy } = useSteady(p, 25);
  const normal = NORMAL();
  // the arithmetic of Rose's worked example, independent of the simulation
  const solute = 700; // mosmol/day
  const [uosmFloor, setUosmFloor] = useState(222);
  const urineVolume = solute / uosmFloor;
  const netIntake = 2.0;
  const retained = Math.max(0, netIntake - urineVolume);

  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="A small defect is enough" note="Rose's arithmetic: 700 mosmol of solute and 2 L of net water intake a day.">
            <Slider
              label="Lowest urine osmolality this kidney can reach"
              value={uosmFloor}
              min={50}
              max={600}
              step={5}
              unit=" mmol/kg"
              onInput={setUosmFloor}
              normal={60}
              hint="a normal kidney reaches 40–100"
            />
            <div class="readout-grid">
              <Readout label="Urine volume it can make" value={urineVolume} digits={2} unit="L/day" title="solute ÷ the lowest achievable osmolality" />
              <Readout label="Net water intake" value={netIntake} digits={2} unit="L/day" />
              <Readout label="Retained every day" value={retained} digits={2} unit="L/day" tone={retained > 0.05 ? 'danger' : 'good'} />
              <Readout label="Sodium falls by, per week" value={retained > 0 ? (140 * retained * 7) / (42 + retained * 7) : 0} digits={1} unit="mmol/L" tone={retained > 0.05 ? 'danger' : 'good'} />
            </div>
            <BarRow label="Urine volume possible" value={urineVolume} max={12} unit=" L/day" color="var(--c-blue)" />
            <BarRow label="Water coming in" value={netIntake} max={12} unit=" L/day" color="var(--c-coral)" />
            <p class="control-hint">
              A urine osmolality of 222 is still hypotonic to plasma — the kidney is diluting. It is nonetheless inappropriately high, and that is the whole point: to stay in balance this patient
              needed 200 mmol/kg, and the shortfall is 200 mL a day, every day. A urine osmolality of 150 in a hyponatraemic patient is not reassurance.
            </p>
          </Panel>
          <Panel title="Now with the whole body">
            <Slider label="Water intake" value={intake} min={0.5} max={8} step={0.1} unit=" L/day" onInput={setIntake} normal={2.2} />
            <Slider label="Autonomous ADH" value={adh} min={0} max={6} step={0.25} unit="× normal" onInput={setAdh} normal={0} hint="0 = normal regulation; above ~2 is SIADH" />
            <Busy on={busy} />
            {ev && (
              <div class="readout-grid">
                <Readout label="Plasma sodium" value={ev.plasma.Na} digits={1} unit="mmol/L" delta={ev.plasma.Na - normal.plasma.Na} deltaDigits={1} tone={ev.plasma.Na < 125 ? 'danger' : ev.plasma.Na < 135 ? 'low' : 'good'} />
                <Readout label="Plasma osmolality" value={ev.plasma.osm} digits={0} unit="mmol/kg" tone={ev.plasma.osm < 270 ? 'low' : 'normal'} />
                <Readout label="Urine osmolality" value={ev.kidney.urine.osm} digits={0} unit="mmol/kg" tone={ev.kidney.urine.osm > 300 ? 'high' : 'good'} refRange="< 100 if ADH is off" />
                <Readout label="Urine volume" value={ev.kidney.urine.volumePerDay} digits={2} unit="L/day" />
                <Readout label="ADH" value={ev.reg.hormones.adh} digits={2} unit="× normal" />
                <Readout label="Electrolyte-free water excreted" value={ev.kidney.urine.exc.electrolyteFreeWater} digits={2} unit="L/day" tone={ev.kidney.urine.exc.electrolyteFreeWater < 0 ? 'danger' : 'good'} />
              </div>
            )}
            <p class="control-hint">
              With normal regulation the model excretes over ten litres a day and the sodium barely moves — drag the intake up and watch. Then add autonomous hormone and the same intake becomes
              dangerous. That asymmetry is why hyponatraemia is a disorder of excretion, not of drinking.
            </p>
          </Panel>
        </div>
        <div>
          <Panel title="Two steps, either of which can fail">
            <Chain
              steps={[
                { text: 'NaCl reabsorbed without water in the loop and distal tubule' },
                { text: 'Dilute fluid is generated' },
                { text: 'The collecting duct is kept impermeable' },
                { text: 'That water actually leaves' },
                { text: 'Reduced delivery (low GFR, avid proximal reabsorption) limits the first' },
                { text: 'ADH defeats the second — and it is the more important of the two' },
              ]}
            />
            <p class="control-hint">
              A vasopressin antagonist reverses the defect in experimental heart failure and cirrhosis without improving perfusion at all, which is how we know the hormone matters more than the
              delivery.
            </p>
            <Sources cite={{ rose: [23, 4], evidence: 'experimental' }} />
          </Panel>
          <Expand summary="Why the brain tolerates it, and why that becomes the problem">
            <p>
              Falling osmolality drives water into brain cells. The brain answers in two stages: interstitial fluid is pushed into the cerebrospinal space, and then solute leaves the cells —
              potassium and sodium within minutes, then the organic osmolytes (myoinositol, glutamine, glutamate, taurine) over hours to days. About 60 per cent of the osmolyte pool goes, against
              under 10 per cent of the cell sodium and potassium. Using osmolytes rather than cations is the point: cell volume is restored without the disruption to protein function that a large
              change in cell potassium would cause.
            </p>
            <p>
              So the rate matters as much as the level. Rabbits taken to a plasma sodium of 119 in two hours gain 17 per cent brain water, have severe symptoms and die; taken to the same 119 over two
              days they gain 7 per cent and have none. And a brain that has adapted has inserted transporters to lose osmolytes and cannot quickly take them back — which is why raising the sodium
              rapidly in chronic hyponatraemia dehydrates it and tears axons away from their myelin.
            </p>
            <Sources cite={{ refs: ['sterns1986'], rose: [23], evidence: 'experimental' }} />
          </Expand>
        </div>
      </div>
      <Predict
        question="A hyponatraemic patient has a urine osmolality of 180 mmol/kg. Is the kidney diluting appropriately?"
        options={['Yes — 180 is hypotonic to plasma', 'No. It is hypotonic, but for a hyponatraemic patient it is far too high: the hormone should be off and the urine should be under 100', 'Cannot tell without the urine sodium', 'Only if the patient is euvolaemic']}
        correct={1}
        explanation="Raising the urine osmolality from 60 to 180 requires removing two-thirds of the water. That patient can excrete only a third of the free water they should, which is more than enough to become progressively hyponatraemic."
      />
    </>
  );
}

// ------------------------------------------------------------------ diagnose
function Diagnose() {
  const [idx, setIdx] = useState(0);
  const c = CAUSES[idx];
  const { ev, busy } = useSteady(useMemo(() => makeParams(c.patch), [idx]), c.days, undefined);
  const normal = NORMAL();
  const uosm = ev?.kidney.urine.osm ?? 0;
  const una = ev?.kidney.urine.Na ?? 0;

  return (
    <>
      <WhatIf options={CAUSES.map((x) => ({ label: x.label, explain: x.explain }))} onApply={(o) => setIdx(CAUSES.findIndex((x) => x.label === o.label))} onReset={() => setIdx(0)} active={c.label} />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="The two numbers that sort it">
            <Busy on={busy} />
            {ev && (
              <div class="readout-grid">
                <Readout label="Plasma sodium" value={ev.plasma.Na} digits={1} unit="mmol/L" delta={ev.plasma.Na - normal.plasma.Na} deltaDigits={1} tone={ev.plasma.Na < 125 ? 'danger' : ev.plasma.Na < 135 ? 'low' : 'normal'} />
                <Readout label="Effective osmolality" value={ev.plasma.effOsm} digits={0} unit="mmol/kg" tone={ev.plasma.effOsm < 270 ? 'low' : 'normal'} />
                <Readout label="Urine osmolality" value={uosm} digits={0} unit="mmol/kg" tone={uosm > 100 ? 'high' : 'good'} refRange="< 100 = ADH off" />
                <Readout label="Urine sodium" value={una} digits={0} unit="mmol/L" tone={una < 25 ? 'low' : 'high'} refRange="< 25 vs > 40" />
                <Readout label="Potassium" value={ev.plasma.K} digits={2} unit="mmol/L" tone={ev.plasma.K > 5.5 || ev.plasma.K < 3.4 ? 'danger' : 'normal'} />
                <Readout label="Bicarbonate" value={ev.plasma.HCO3} digits={1} unit="mmol/L" tone={ev.plasma.HCO3 < 20 ? 'low' : ev.plasma.HCO3 > 28 ? 'high' : 'normal'} />
                <Readout label="Extracellular volume" value={ev.plasma.ecf} digits={1} unit="L" tone={ev.plasma.ecf < 12 ? 'low' : ev.plasma.ecf > 18 ? 'high' : 'normal'} />
                <Readout label="Oedema" value={ev.body.edema} digits={1} unit="L" tone={ev.body.edema > 2 ? 'high' : 'good'} />
                <Readout label="ADH" value={ev.reg.hormones.adh} digits={2} unit="× normal" />
              </div>
            )}
            <p class="note" style={{ marginTop: 8, marginBottom: 0 }}>{c.explain}</p>
          </Panel>
        </div>
        <div>
          <Panel title="Where this patient lands">
            <table class="table">
              <thead>
                <tr>
                  <th>Urine osmolality</th>
                  <th>Urine sodium</th>
                  <th>What it means</th>
                </tr>
              </thead>
              <tbody>
                <tr class={uosm < 100 ? 'row-hit' : ''}>
                  <td>&lt; 100</td>
                  <td>any</td>
                  <td>ADH fully and appropriately off: primary polydipsia, or a reset osmostat if the sodium is stable at 125–135. Water restriction separates them.</td>
                </tr>
                <tr class={uosm >= 100 && una < 25 ? 'row-hit' : ''}>
                  <td>&gt; 100</td>
                  <td>&lt; 25</td>
                  <td>Effective circulating volume depletion — true hypovolaemia, or heart failure or cirrhosis with an expanded total volume. The ADH release is appropriate.</td>
                </tr>
                <tr class={uosm >= 100 && una >= 25 ? 'row-hit' : ''}>
                  <td>&gt; 100</td>
                  <td>&gt; 40</td>
                  <td>SIADH, renal failure, a diuretic still acting, adrenal insufficiency, a reset osmostat, or vomiting with obligatory bicarbonate loss.</td>
                </tr>
              </tbody>
            </table>
            <p class="control-hint">
              Equivocal? Give saline and measure again. If the hyponatraemia was hypovolaemic and the volume is now restored, the urine osmolality drops below 100 as the hormone switches off. If it
              stays high with a urine sodium above 40, there was SIADH underneath as well.
            </p>
            <Sources cite={{ rose: [23], evidence: 'clinical' }} />
          </Panel>
          <Panel title="And the company it keeps">
            <table class="table">
              <tbody>
                <tr>
                  <td>Alkalosis + hypokalaemia</td>
                  <td>Vomiting, or a diuretic</td>
                </tr>
                <tr>
                  <td>Acidosis + hyperkalaemia</td>
                  <td>Adrenal insufficiency, with reasonable renal function</td>
                </tr>
                <tr>
                  <td>Acidosis + normal or high K⁺</td>
                  <td>Renal failure</td>
                </tr>
                <tr>
                  <td>Nothing else abnormal</td>
                  <td>SIADH</td>
                </tr>
                <tr>
                  <td>Low urea and urate</td>
                  <td>Water excess (thiazide with increased drinking)</td>
                </tr>
                <tr>
                  <td>High urea and urate</td>
                  <td>Volume depletion (thiazide with a natriuresis)</td>
                </tr>
              </tbody>
            </table>
          </Panel>
        </div>
      </div>
      <Predict
        question="A patient has a plasma sodium of 122, a urine osmolality of 520 and a urine sodium of 65, no oedema and a normal potassium and bicarbonate. What is it?"
        options={['Hypovolaemia', 'SIADH — impaired water excretion with entirely intact sodium handling', 'Primary polydipsia', 'Heart failure']}
        correct={1}
        explanation="The urine sodium above 40 with no oedema is the signature: volume regulation is working, so the sodium excreted matches intake. It is the water that cannot leave."
      />
    </>
  );
}

// ------------------------------------------------------------------ fluids
const TREATMENTS: { label: string; patch: ParamPatch; note: string }[] = [
  { label: 'Nothing', patch: {}, note: 'The sodium goes on falling, slowly, for as long as the intake exceeds the output.' },
  { label: 'Water restriction to 0.6 L', patch: { waterIntake: 0.6 }, note: 'Acts on the only side that matters. Slow, safe, and the first thing to do.' },
  {
    label: 'Isotonic saline 1 L/day',
    patch: { ivNS: 1 },
    note: 'Watch the sodium go down. The 308 mosmol in that litre leaves in far less than a litre at this urine osmolality, so most of the water stays behind.',
  },
  {
    label: 'Hypertonic 3% 0.5 L/day',
    patch: { ivHypertonic: 0.5 },
    note: 'Three per cent saline is 1026 mosmol/kg. Against a urine osmolality above 1000 that is barely hypertonic to the urine, so it achieves almost nothing.',
  },
  { label: 'Furosemide alone', patch: { drugs: { furosemide: 0.7 } }, note: 'The urine osmolality falls — but without salt replacement the patient becomes hypovolaemic and the sodium falls further.' },
  {
    label: 'Furosemide + 3% saline',
    patch: { drugs: { furosemide: 0.7 }, ivHypertonic: 1 },
    note: 'Now the arithmetic works: the loop diuretic collapses the medullary gradient, the urine osmolality drops, and the same salt load leaves in a much larger volume of water.',
  },
  { label: 'High-salt, high-protein diet', patch: { naIntake: 300, proteinIntake: 160 }, note: 'With the urine osmolality fixed, the urine volume is set by solute output. More solute, more water. This is the chronic treatment.' },
  { label: 'Vasopressin antagonist', patch: { drugs: { tolvaptan: 1 } }, note: 'A pure water diuresis. Effective, and the reason it is started in hospital: with the hormone fully blocked the sodium can rise far too fast.' },
];

function Fluids() {
  const [idx, setIdx] = useState(2);
  const base = useMemo(() => makeParams({ adhAutonomous: 5, waterIntake: 1.35, naIntake: 100 }), []);
  const treated = useMemo(() => makeParams({ adhAutonomous: 5, waterIntake: 1.35, naIntake: 100, ...TREATMENTS[idx].patch }), [idx]);
  const { points, before, busy } = useStep(base, treated, 2, 0.02, 40);
  const t = TREATMENTS[idx];
  const start = before?.plasma.Na;
  const day1 = points?.find((p) => p.day >= 1);

  // the steady-state arithmetic, independent of the simulation
  const [uosm, setUosm] = useState(680);
  const fluids = [
    { label: 'Isotonic saline (308)', osm: 308, volume: 1 },
    { label: '3% saline (1026)', osm: 1026, volume: 1 },
    { label: '0.45% saline (154)', osm: 154, volume: 1 },
  ];

  return (
    <>
      <Panel title="Rose Table 23-9: what a litre actually does" note="With the urine osmolality fixed by the hormone, a fluid is excreted in whatever volume its solute requires.">
        <Slider label="Urine osmolality" value={uosm} min={150} max={1200} step={10} unit=" mmol/kg" onInput={setUosm} normal={680} hint="fixed by ADH in SIADH" />
        <table class="table">
          <thead>
            <tr>
              <th>1 litre of…</th>
              <th>Solute</th>
              <th>Leaves in</th>
              <th>Net water</th>
            </tr>
          </thead>
          <tbody>
            {fluids.map((fl) => {
              const out = (fl.osm * fl.volume) / uosm;
              const net = fl.volume - out;
              return (
                <tr key={fl.label}>
                  <td>{fl.label}</td>
                  <td>{(fl.osm * fl.volume).toFixed(0)} mosmol</td>
                  <td>{(out * 1000).toFixed(0)} mL</td>
                  <td class={net > 0.02 ? 'bad' : net < -0.02 ? 'good' : ''}>
                    {net > 0 ? '+' : ''}
                    {(net * 1000).toFixed(0)} mL retained
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p class="control-hint">
          What decides the effect of a fluid is its osmolality relative to the <em>urine's</em>, not relative to the plasma's. Drag the urine osmolality down — the crossover for isotonic saline is
          at 308, and for 3 per cent saline at 1026. Below those, the fluid raises the sodium; above them it lowers it, however "hypertonic" it looks on the bag.
        </p>
        <Sources cite={{ rose: [23], evidence: 'physiology' }} />
      </Panel>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Which is why a loop diuretic is the lever">
            <Chain
              steps={[
                { text: 'Furosemide blocks NaCl reabsorption in the medullary thick ascending limb' },
                { text: 'The first step of countercurrent multiplication fails' },
                { text: 'The medullary gradient collapses' },
                { text: 'The urine osmolality falls toward 300 whatever the ADH level' },
                { text: 'Now 1 L of 3% saline leaves in 3.4 L of urine — a net loss of 2.4 L of water' },
                { text: 'Replace the salt, or the diuresis makes the patient hypovolaemic and the sodium falls further' },
              ]}
            />
          </Panel>
        </div>
        <div>
          <Panel title="Try it on the model">
            <div class="chips">
              {TREATMENTS.map((x, i) => (
                <button key={x.label} class={`chip ${i === idx ? 'active' : ''}`} onClick={() => setIdx(i)}>
                  {x.label}
                </button>
              ))}
            </div>
            <Busy on={busy} />
            {before && day1 && (
              <div class="readout-grid" style={{ marginTop: 10 }}>
                <Readout label="Starting sodium" value={start!} digits={1} unit="mmol/L" tone="low" />
                <Readout label="Starting urine osmolality" value={before.kidney.urine.osm} digits={0} unit="mmol/kg" tone="high" />
                <Readout label="Sodium at 24 h" value={day1.Na} digits={1} unit="mmol/L" delta={day1.Na - start!} deltaDigits={1} tone={day1.Na - start! > 10 ? 'danger' : day1.Na > start! ? 'good' : 'low'} />
                <Readout label="Urine osmolality now" value={points![points!.length - 1].urineOsm} digits={0} unit="mmol/kg" />
                <Readout label="Urine volume" value={points![points!.length - 1].urineVolume} digits={2} unit="L/day" />
              </div>
            )}
            <p class="note" style={{ marginTop: 8 }}>{t.note}</p>
          </Panel>
          <Panel title="Two days">
            {points && before && (
              <LineChart
                xLabel="days"
                series={[
                  { label: 'Plasma sodium', axis: 'Plasma Na⁺ (mmol/L)', points: points.map((p) => ({ x: p.day, y: p.Na })), color: 'var(--c-blue)' },
                  { label: 'Urine osmolality', axis: 'Urine osmolality (mOsm/kg)', points: points.map((p) => ({ x: p.day, y: p.urineOsm })), color: 'var(--c-amber)' },
                ] as Series[]}
                height={200}
              />
            )}
            <p class="control-hint">
              The safe-correction limit is about 10 mmol/L in the first 24 hours. Compare the vasopressin antagonist against water restriction on that scale and the reason these drugs are started in
              hospital becomes obvious.
            </p>
          </Panel>
        </div>
      </div>
      <Predict
        question="A patient with SIADH and a urine osmolality of 700 is given a litre of isotonic saline. What happens to the plasma sodium?"
        options={['It rises by about 1 mmol/L', 'It falls — the 308 mosmol leaves in about 440 mL, so around 560 mL of water is retained', 'Nothing', 'It depends on the urine sodium']}
        correct={1}
        explanation="Select “Isotonic saline” above and watch. This is why the urine osmolality has to be measured before a fluid is chosen, and why the reflex of giving saline to a hyponatraemic patient is sometimes exactly wrong."
      />
    </>
  );
}

// ------------------------------------------------------------------ correct
function Correct() {
  const [weight, setWeight] = useState(60);
  const [female, setFemale] = useState(true);
  const [current, setCurrent] = useState(108);
  const [target, setTarget] = useState(118);
  const tbw = weight * (female ? 0.5 : 0.6);
  const deficit = tbw * Math.max(0, target - current);
  const volume3pc = deficit / 513;

  // what a fast and a slow correction look like on the model
  const sick = useMemo(() => makeParams({ waterIntake: 19 }), []);
  const fixedSlow = useMemo(() => makeParams({ waterIntake: 2.2 }), []);
  const fixedFast = useMemo(() => makeParams({ waterIntake: 0.6 }), []);
  const { points: slow, busy: b1 } = useStep(sick, fixedSlow, 2, 0.02, 25);
  const { points: fast, busy: b2 } = useStep(sick, fixedFast, 2, 0.02, 25);

  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="The sodium deficit, and where it does not apply" note="Rose Eq. 23-3.">
            <Slider label="Lean body weight" value={weight} min={35} max={120} step={1} unit=" kg" onInput={setWeight} normal={70} />
            <p class="chips" style={{ marginTop: 4 }}>
              <button class={`chip ${female ? 'active' : ''}`} onClick={() => setFemale(true)}>
                Female (TBW 50%)
              </button>
              <button class={`chip ${!female ? 'active' : ''}`} onClick={() => setFemale(false)}>
                Male (TBW 60%)
              </button>
            </p>
            <Slider label="Current sodium" value={current} min={95} max={132} step={1} unit=" mmol/L" onInput={setCurrent} normal={140} />
            <Slider label="Target sodium" value={target} min={100} max={140} step={1} unit=" mmol/L" onInput={setTarget} normal={140} hint="no more than 10–12 above the current value in 24 h" />
            <div class="readout-grid">
              <Readout label="Total body water" value={tbw} digits={1} unit="L" />
              <Readout label="Sodium needed" value={deficit} digits={0} unit="mmol" />
              <Readout label="As 3% saline" value={volume3pc * 1000} digits={0} unit="mL" />
              <Readout label="Rise requested" value={target - current} digits={0} unit="mmol/L" tone={target - current > 12 ? 'danger' : target - current > 10 ? 'high' : 'good'} />
              <Readout label="Over 24 h that is" value={(volume3pc * 1000) / 24} digits={0} unit="mL/h" />
            </div>
            <p class="note" style={{ marginTop: 6 }}>
              {target - current > 12
                ? 'Above 12 mmol/L in the first day is the threshold at which osmotic demyelination has been reported. Lower the target.'
                : target - current > 10
                  ? 'At the top of the safe range. In an asymptomatic patient, aim lower.'
                  : 'Within the safe range for the first 24 hours.'}
            </p>
            <p class="control-hint">
              Rose’s worked case: a 60 kg woman five days into a thiazide, sodium 108, lethargic and confused. Thirty litres of body water times 12 mmol/L is about 360 mmol, which is 700 mL of 3
              per cent saline — roughly 30 mL/h over the day, or 50–75 mL/h for the first three or four hours because she has symptoms.
            </p>
            <Sources cite={{ rose: [23], evidence: 'clinical' }} />
          </Panel>
          <Panel title="Three things the formula does not know">
            <ul class="bullets">
              <li>
                <strong>It only applies to sodium given without water.</strong> Isotonic saline does not obey it, and in SIADH it over-predicts badly: the administered sodium is simply excreted, and
                it is the water leaving with it that raises the plasma sodium.
              </li>
              <li>
                <strong>Potassium counts.</strong> It is as osmotically active as sodium. Two to four hundred millimoles given over the first day for severe hypokalaemia may by itself raise the
                plasma sodium at close to the maximum safe rate — and then giving sodium as well overcorrects.
              </li>
              <li>
                <strong>It ignores any isosmotic deficit.</strong> A patient who lost five litres of isosmotic diarrhoeal fluid and then drank three litres of water needs the formula's sodium
                <em> and</em> two litres of isosmotic replacement.
              </li>
            </ul>
          </Panel>
        </div>
        <div>
          <Panel title="Correction without any saline at all">
            <Busy on={b1 || b2} />
            {slow && fast && (
              <>
                <LineChart yLabel="Plasma Na⁺ (mmol/L)"
                  xLabel="days"
                  series={[
                    { label: 'Restricted to 2.2 L (mmol/L)', points: slow.map((p) => ({ x: p.day, y: p.Na })), color: 'var(--c-teal)' },
                    { label: 'Restricted to 0.6 L (mmol/L)', points: fast.map((p) => ({ x: p.day, y: p.Na })), color: 'var(--c-coral)' },
                  ] as Series[]}
                  height={200}
                />
                <p class="control-hint">
                  A patient with primary polydipsia, restricted two ways. Water excretion is entirely normal here — the hormone is appropriately off — so the retained water leaves in a maximally
                  dilute urine as soon as the intake stops. This is one of two settings in which correction runs away with no hypertonic saline involved; the other is hypovolaemia once the volume has
                  been restored and the baroreceptor stimulus disappears.
                </p>
              </>
            )}
          </Panel>
          <Expand summary="What the guidelines say now">
            <p>
              The chapter's limits have held: under 10 to 12 mmol/L in the first 24 hours, under 18 over two days, and preferably under 10 a day in an asymptomatic patient. For severe symptoms,
              European guidance now recommends a 150 mL bolus of 3 per cent saline, repeated if needed, rather than an hourly infusion rate — easier to control, and it stops once the seizures stop.
            </p>
            <p>
              The chapter raises, as an open question, whether deliberately re-lowering the sodium helps after an overly rapid correction, citing one rat study and a single patient. That has since
              become accepted rescue treatment: desmopressin with hypotonic fluid to bring the sodium back down. Giving desmopressin proactively alongside hypertonic saline — clamping the water
              excretion so the rise is predictable — is now a common strategy for exactly the reason the chapter identifies, that the danger comes when the hormone switches off on its own.
            </p>
            <Sources cite={{ refs: ['spasovski2014', 'sterns1986'], rose: [23], evidence: 'guideline', update: 'The chapter’s open question became standard practice.' }} />
          </Expand>
        </div>
      </div>
      <Predict
        question="A patient with a sodium of 106 for three weeks is corrected to 128 in 20 hours and wakes up. Two days later they deteriorate. What happened?"
        options={[
          'The hyponatraemia recurred',
          'Osmotic demyelination: the brain had given up its osmolytes over three weeks and could not take them back in twenty hours',
          'A seizure',
          'Infection',
        ]}
        correct={1}
        explanation="The classic course — improvement, then deterioration days later. Imaging can be negative for up to four weeks. A rise of 22 mmol/L in a day is roughly double the limit."
      />
    </>
  );
}
