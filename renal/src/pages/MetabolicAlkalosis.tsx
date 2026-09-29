import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related, Busy, useTabParam } from '../ui/page';
import { Panel, Readout, Slider, Sources, Predict, BarRow, Tabs, Chain, LineChart, Expand, type Series } from '../ui/kit';
import { AcidBaseMap } from '../ui/AcidBaseMap';
import { makeParams, useStep, useCourse, NORMAL } from '../sim/hooks';
import type { ParamPatch } from '../engine/types';

const TAB_IDS = ['generate', 'maintain', 'treat'] as const;

interface Cause {
  label: string;
  patch: ParamPatch;
  /** chloride-responsive (urine Cl low) or resistant */
  kind: 'responsive' | 'resistant' | 'none';
  explain: string;
}

const CAUSES: Cause[] = [
  { label: 'Normal', patch: {}, kind: 'none', explain: 'Nothing wrong.' },
  {
    label: 'Vomiting',
    patch: { naIntake: 20, vomiting: 1.2, waterIntake: 2 },
    kind: 'responsive',
    explain: 'Gastric HCl is lost with no pancreatic bicarbonate secreted to match it, and the patient is not eating, so chloride falls steeply. The commonest cause and the clearest example.',
  },
  {
    label: 'Nasogastric suction',
    patch: { naIntake: 60, vomiting: 1.0, waterIntake: 2.5 },
    kind: 'responsive',
    explain: 'The same mechanism, usually with better hydration because fluids are being given — so the alkalosis develops more slowly.',
  },
  {
    label: 'Loop diuretic on a low-salt diet',
    patch: { naIntake: 40, drugs: { furosemide: 0.7 }, diureticDoses: 1 },
    kind: 'responsive',
    explain: 'Volume contraction plus increased distal hydrogen and potassium secretion — the diuretic raises distal delivery, which is what aldosterone needs to act on.',
  },
  {
    label: 'Alkali load, normal kidney',
    patch: { drugs: { sodiumBicarbonate: 1000 } },
    kind: 'none',
    explain: 'A thousand millimoles a day. Watch what happens: almost nothing, because a chloride-replete kidney simply excretes it. Generation without a maintenance factor is not enough.',
  },
  {
    label: 'Alkali load with renal failure',
    patch: { drugs: { sodiumBicarbonate: 600 }, nephronFraction: 0.15 },
    kind: 'resistant',
    explain: 'The same load with nowhere to go. This is the antacid-plus-resin patient the chapter describes.',
  },
  {
    label: 'Primary aldosteronism',
    patch: { aldoAutonomous: 4 },
    kind: 'resistant',
    explain: 'Aldosterone escape prevents volume expansion, so the patient is not volume depleted and saline will not help. The hypokalaemia is what maintains the alkalosis.',
  },
  {
    label: 'Severe hypokalaemia',
    patch: { kIntake: 8, drugs: { fludrocortisone: 1.5 } },
    kind: 'resistant',
    explain: 'Potassium depletion alone drives hydrogen secretion, through intracellular acidosis and the H⁺-K⁺-ATPase.',
  },
];

export default function MetabolicAlkalosis({ query }: { query: URLSearchParams }) {
  const [tab, setTab] = useTabParam('/metabolic-alkalosis', TAB_IDS, 'generate', query);
  return (
    <div>
      <PageHead
        path="/metabolic-alkalosis"
        lede="Ask two questions. What generated the bicarbonate — and, much more interesting, what is stopping the kidney from excreting it? A normal kidney clears a thousand millimoles a day without much trouble, so an alkalosis that persists is being maintained by something, and which something decides the treatment."
      />
      <Tabs
        tabs={[
          { id: 'generate', label: 'Generating it' },
          { id: 'maintain', label: 'Maintaining it' },
          { id: 'treat', label: 'Correcting it' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'generate' && <Generate />}
      {tab === 'maintain' && <Maintain />}
      {tab === 'treat' && <Treat />}
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>Plasma bicarbonate 22–26 mmol/L, held there by a reabsorptive threshold near 26 and by net acid excretion matching acid production.</p>}
          why={<p>Losing hydrogen ions generates bicarbonate one for one. So does distal hydrogen secretion. And contracting the extracellular volume around a fixed bicarbonate pool raises its concentration without generating anything.</p>}
          change={<p>Raise the bicarbonate in a chloride-replete kidney and it is excreted within a day. Deplete chloride first and the same load is held indefinitely.</p>}
          abnormal={<p>Chloride depletion abolishes bicarbonate secretion and sustains distal hydrogen secretion, giving a paradoxically acid urine. Mineralocorticoid excess and hypokalaemia maintain it without volume depletion.</p>}
          clinical={<p>Measure the urine chloride. Under 20 mmol/L: give sodium chloride, or potassium chloride if sodium is unwelcome. Over 20: treat the mineralocorticoid excess and replace potassium.</p>}
        />
        <Sources cite={{ rose: [18, 11, 15], evidence: 'clinical' }} />
      </Panel>
      <Related paths={['/mixed', '/acid-base', '/bicarbonate', '/diuretics', '/hypokalemia']} />
    </div>
  );
}

// ---------------------------------------------------------------- generating
function Generate() {
  const [causeIdx, setCauseIdx] = useState(1);
  const c = CAUSES[causeIdx];
  const base = useMemo(() => makeParams({ naIntake: 150 }), []);
  const sick = useMemo(() => makeParams({ naIntake: 150, ...c.patch }), [causeIdx]);
  const { points, busy } = useStep(base, sick, 7, 0.05, 60, 2, 0.25);
  const normal = NORMAL();
  const end = points?.[points.length - 1];

  return (
    <>
      <WhatIf options={CAUSES.map((x) => ({ label: x.label, explain: x.explain }))} onApply={(o) => setCauseIdx(CAUSES.findIndex((x) => x.label === o.label))} onReset={() => setCauseIdx(0)} active={c.label} />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="After seven days">
            <Busy on={busy} />
            {end && (
              <div class="readout-grid">
                <Readout label="Bicarbonate" value={end.HCO3} digits={1} unit="mmol/L" delta={end.HCO3 - normal.plasma.HCO3} deltaDigits={1} tone={end.HCO3 > 30 ? 'danger' : end.HCO3 > 26 ? 'high' : 'good'} />
                <Readout label="pH" value={end.pH} digits={3} tone={end.pH > 7.5 ? 'danger' : end.pH > 7.45 ? 'high' : 'good'} />
                <Readout label="PCO₂" value={end.PCO2} digits={0} unit="mmHg" tone={end.PCO2 > 48 ? 'high' : 'normal'} refRange="compensating" />
                <Readout label="Potassium" value={end.K} digits={2} unit="mmol/L" tone={end.K < 3.5 ? 'danger' : 'normal'} />
                <Readout label="Urine pH" value={end.urinePH} digits={2} tone={end.urinePH < 6 ? 'danger' : 'normal'} />
                <Readout label="Extracellular volume" value={end.ecf} digits={1} unit="L" tone={end.ecf < 12.8 ? 'low' : 'normal'} />
              </div>
            )}
            <p class="note" style={{ marginTop: 8, marginBottom: 0 }}>{c.explain}</p>
          </Panel>
          <Panel title="Rose's contraction arithmetic" note="No bicarbonate is generated at all — the same amount sits in a smaller volume.">
            <ContractionDemo />
          </Panel>
        </div>
        <div>
          <Panel title="Seven days">
            {points && (
              <>
                <LineChart
                  xLabel="days"
                  series={[
                    { label: 'Bicarbonate (mmol/L)', points: points.map((p) => ({ x: p.day, y: p.HCO3 })), color: '#7bc47f' },
                    { label: 'Chloride (mmol/L) ÷ 2', points: points.map((p) => ({ x: p.day, y: p.Cl / 2 })), color: '#6aa9e8' },
                  ] as Series[]}
                  height={170}
                />
                <LineChart
                  xLabel="days"
                  series={[
                    { label: 'Arterial pH', points: points.map((p) => ({ x: p.day, y: p.pH })), color: '#e07b6a' },
                    { label: 'Urine pH', points: points.map((p) => ({ x: p.day, y: p.urinePH })), color: '#f2b134' },
                  ] as Series[]}
                  height={170}
                />
                <p class="control-hint">
                  Watch the two pH lines separate. In a chloride-depletion alkalosis the blood becomes alkalaemic while the urine becomes <em>more</em> acid — the paradoxical aciduria, and the single
                  most characteristic finding in the disorder.
                </p>
              </>
            )}
          </Panel>
          <Panel title="Where it sits on the map">{end && <AcidBaseMap points={[{ pH: end.pH, pco2: end.PCO2, label: c.label }]} height={280} show={['metAlkalosis', 'respAcidoseAcute', 'respAcidoseChronic']} />}</Panel>
        </div>
      </div>
      <Predict
        question="A patient is given 1000 mmol of sodium bicarbonate a day. What happens to the plasma bicarbonate?"
        options={['It rises steeply and keeps rising', 'It rises a little and then plateaus — the kidney excretes the rest', 'Nothing changes at all', 'It falls']}
        correct={1}
        explanation="Select “Alkali load, normal kidney” above. Generation without a maintenance factor produces very little. This is why the diagnostic question in metabolic alkalosis is what is stopping the excretion, not what started it."
      />
    </>
  );
}

/** Rose Fig. 18-1: the same bicarbonate in a smaller volume. */
function ContractionDemo() {
  const [ecf, setEcf] = useState(22);
  const startEcf = 22;
  const startHco3 = 24;
  const pool = startEcf * startHco3; // mmol, held constant
  const hco3 = pool / ecf;
  return (
    <>
      <Slider label="Extracellular volume" value={ecf} min={11} max={24} step={0.5} unit="L" onInput={setEcf} normal={22} hint="the bicarbonate pool is held constant" />
      <div class="readout-grid">
        <Readout label="Bicarbonate pool" value={pool} digits={0} unit="mmol" title="unchanged throughout" />
        <Readout label="Concentration" value={hco3} digits={1} unit="mmol/L" tone={hco3 > 30 ? 'high' : 'normal'} />
      </div>
      <BarRow label="Extracellular volume" value={ecf} max={24} unit=" L" color="#6aa9e8" />
      <BarRow label="Bicarbonate concentration" value={hco3} max={48} unit=" mmol/L" color="#7bc47f" />
      <p class="control-hint">
        Rose's example takes 22 L to 17 L and the bicarbonate from 24 to 31 mmol/L. Nothing was added. In practice cell and bone buffering limits how far this goes, which is why a pure contraction
        alkalosis is usually modest — and why haemorrhage, which removes bicarbonate and chloride in plasma proportions, causes none at all.
      </p>
    </>
  );
}

// ---------------------------------------------------------------- maintaining
function Maintain() {
  const [causeIdx, setCauseIdx] = useState(1);
  const c = CAUSES[causeIdx];
  const base = useMemo(() => makeParams({ naIntake: 150 }), []);
  const sick = useMemo(() => makeParams({ naIntake: 150, ...c.patch }), [causeIdx]);
  const { points, busy } = useStep(base, sick, 7, 0.05, 60, 2, 0.25);
  const end = points?.[points.length - 1];

  return (
    <>
      <WhatIf options={CAUSES.map((x) => ({ label: x.label, explain: x.explain }))} onApply={(o) => setCauseIdx(CAUSES.findIndex((x) => x.label === o.label))} onReset={() => setCauseIdx(0)} active={c.label} />
      <div class="grid grid-2">
        <Panel title="The urine chloride decides the treatment" note="Not the urine sodium: a kidney excreting bicarbonate has to excrete sodium with it.">
          <Busy on={busy} />
          <UrineChlorideReadout causeIdx={causeIdx} />
        </Panel>
        <Panel title="What is holding it up">
          <Chain
            steps={[
              { text: 'Bicarbonate has been generated' },
              { text: 'A normal kidney would excrete it within a day', direction: -1 },
              { text: 'Chloride depletion: no counter-ion for bicarbonate secretion, and sustained distal H⁺ secretion', direction: 1 },
              { text: 'Volume depletion: excreting HCO₃⁻ would obligate Na⁺ loss, so it is held', direction: 1 },
              { text: 'Hypokalaemia: intracellular acidosis and the H⁺-K⁺-ATPase drive H⁺ secretion', direction: 1 },
              { text: 'Mineralocorticoid excess: direct stimulation of the distal H⁺-ATPase', direction: 1 },
            ]}
          />
          <p class="control-hint">
            Rose leaves the relative weight of chloride and volume unresolved, and notes it rarely matters because sodium chloride fixes both. It matters when you cannot give sodium — and the next tab
            is that experiment.
          </p>
        </Panel>
      </div>
      <div class="grid grid-2">
        <Panel title="The paradox" note="Arterial and urine pH, side by side.">
          {end && (
            <>
              <div class="readout-grid">
                <Readout label="Arterial pH" value={end.pH} digits={3} tone={end.pH > 7.45 ? 'high' : 'normal'} />
                <Readout label="Urine pH" value={end.urinePH} digits={2} tone={end.urinePH < 6 ? 'danger' : 'normal'} />
              </div>
              {end.pH > 7.45 && end.urinePH < 6.2 && (
                <p class="callout danger" style={{ marginTop: 8 }}>
                  <strong>Paradoxical aciduria.</strong> The blood is alkalaemic at pH {end.pH.toFixed(2)} and the urine is acid at pH {end.urinePH.toFixed(1)}. Bicarbonate secretion runs on the
                  inward chloride gradient across the luminal membrane of the type B intercalated cell; with the lumen stripped of chloride there is nothing to exchange against, so the kidney cannot
                  let go of bicarbonate however alkalaemic the patient becomes. Replace the chloride and the urine turns alkaline within hours.
                </p>
              )}
              {end.pH > 7.45 && end.urinePH >= 6.2 && (
                <p class="callout" style={{ marginTop: 8 }}>
                  The urine is not acid here, which means chloride is available and bicarbonate is being excreted. This is a chloride-resistant alkalosis, or one that is already correcting.
                </p>
              )}
            </>
          )}
        </Panel>
        <Expand summary="Rose's three mechanisms for a chloride effect independent of sodium" open>
          <ol style={{ paddingLeft: 18, lineHeight: 1.75 }}>
            <li>
              <strong>The macula densa.</strong> The Na⁺-K⁺-2Cl⁻ carrier there is rate-limited by chloride, so hypochloraemia reduces the signal, releases renin, and produces secondary
              hyperaldosteronism with more distal hydrogen secretion.
            </li>
            <li>
              <strong>The H⁺-ATPase.</strong> It probably cosecretes chloride for electroneutrality, and a low luminal chloride concentration maximises the gradient favouring that.
            </li>
            <li>
              <strong>Bicarbonate secretion.</strong> Type B intercalated cells secrete bicarbonate by chloride–bicarbonate exchange, driven by the inward chloride gradient. Strip the lumen of
              chloride and the kidney loses the ability to secrete bicarbonate at all — not merely the inclination.
            </li>
          </ol>
        </Expand>
      </div>
    </>
  );
}

function UrineChlorideReadout({ causeIdx }: { causeIdx: number }) {
  const c = CAUSES[causeIdx];
  const base = useMemo(() => makeParams({ naIntake: 150 }), []);
  const sick = useMemo(() => makeParams({ naIntake: 150, ...c.patch }), [causeIdx]);
  const { points } = useStep(base, sick, 7, 0.05, 60, 2, 0.25);
  const end = points?.[points.length - 1];
  if (!end) return <Busy on />;
  const uCl = end.urineCl / Math.max(end.urineVolume, 0.01);
  const uNa = end.urineNa / Math.max(end.urineVolume, 0.01);
  const responsive = uCl < 20;
  return (
    <>
      <div class="readout-grid">
        <Readout label="Urine chloride" value={uCl} digits={0} unit="mmol/L" tone={uCl < 20 ? 'low' : 'normal'} refRange="< 20 = chloride-responsive" />
        <Readout label="Urine sodium" value={uNa} digits={0} unit="mmol/L" refRange="misleading here" />
        <Readout label="Bicarbonate" value={end.HCO3} digits={1} unit="mmol/L" tone={end.HCO3 > 28 ? 'high' : 'normal'} />
        <Readout label="Potassium" value={end.K} digits={2} unit="mmol/L" tone={end.K < 3.5 ? 'low' : 'normal'} />
      </div>
      {end.HCO3 > 26 && (
        <p class={responsive ? 'callout good' : 'callout'} style={{ marginTop: 8 }}>
          {responsive ? (
            <>
              <strong>Chloride-responsive.</strong> Urine chloride {uCl.toFixed(0)} mmol/L. Saline will correct this — and so will potassium chloride, without any sodium at all.
            </>
          ) : (
            <>
              <strong>Chloride-resistant.</strong> Urine chloride {uCl.toFixed(0)} mmol/L. Saline will not help; the problem is mineralocorticoid excess or potassium depletion, and the treatment is
              aimed at those.
            </>
          )}
          {Math.abs(uNa - uCl) > 15 && <> Note the gap between the urine sodium and chloride — {uNa.toFixed(0)} against {uCl.toFixed(0)} — which is exactly why the sodium is the wrong number to read.</>}
        </p>
      )}
    </>
  );
}

// ---------------------------------------------------------------- correcting
const TREATMENTS: { label: string; patch: ParamPatch; note: string }[] = [
  { label: 'Nothing', patch: {}, note: 'The vomiting has stopped, but nothing has been replaced.' },
  { label: '0.9% saline 2 L/day', patch: { ivNS: 2 }, note: 'Sodium and chloride together. Corrects both the volume and the chloride deficit, which is why it is the standard answer.' },
  { label: 'Potassium chloride only', patch: { drugs: { potassiumChloride: 120 } }, note: "Chloride without sodium. Rose's decisive experiment: if this corrects the alkalosis, chloride was the maintenance factor, not volume." },
  { label: '5% dextrose 2 L/day', patch: { ivD5W: 2 }, note: 'Volume without chloride. The mirror image of the last one — and if volume were the maintenance factor, this should work.' },
  { label: 'Acetazolamide', patch: { drugs: { acetazolamide: 0.6 } }, note: 'Wastes bicarbonate proximally. The option when the patient is oedematous and saline is unwelcome.' },
];

function Treat() {
  const [tIdx, setTIdx] = useState(1);
  const t = TREATMENTS[tIdx];
  const base = useMemo(() => makeParams({ naIntake: 150 }), []);
  const ill = useMemo(() => makeParams({ naIntake: 20, vomiting: 1.2, waterIntake: 2 }), []);
  const illCourse = useStep(base, ill, 3, 0.05, 60, 2, 0.25);
  const illBody = illCourse.state?.body;
  const treated = useMemo(() => makeParams({ naIntake: 20, waterIntake: 2, ...t.patch }), [tIdx]);
  const { points, busy } = useCourse(treated, 4, 0.05, illBody);
  const start = illCourse.points?.[illCourse.points.length - 1];
  const end = illBody && points ? points[points.length - 1] : undefined;

  return (
    <>
      <div class="grid grid-2">
        <Panel title="The patient" note="Three days of vomiting with little intake. The vomiting has now stopped.">
          <Busy on={illCourse.busy} />
          {start && (
            <div class="readout-grid">
              <Readout label="Bicarbonate" value={start.HCO3} digits={1} unit="mmol/L" tone="danger" />
              <Readout label="pH" value={start.pH} digits={3} tone="danger" />
              <Readout label="Chloride" value={start.Cl} digits={0} unit="mmol/L" tone={start.Cl < 96 ? 'low' : 'normal'} />
              <Readout label="Potassium" value={start.K} digits={2} unit="mmol/L" tone={start.K < 3.5 ? 'low' : 'normal'} />
              <Readout label="Urine pH" value={start.urinePH} digits={2} tone="danger" />
              <Readout label="Extracellular volume" value={start.ecf} digits={1} unit="L" tone="low" />
            </div>
          )}
        </Panel>
        <Panel title="Choose the treatment">
          <div class="btn-row" style={{ marginBottom: 8 }}>
            {TREATMENTS.map((x, i) => (
              <button key={x.label} class={i === tIdx ? 'active' : ''} onClick={() => setTIdx(i)}>
                {x.label}
              </button>
            ))}
          </div>
          <p class="note">{t.note}</p>
          <Busy on={busy} />
          {end && start && (
            <div class="readout-grid">
              <Readout label="Bicarbonate" value={end.HCO3} digits={1} unit="mmol/L" delta={end.HCO3 - start.HCO3} deltaDigits={1} tone={end.HCO3 < 28 ? 'good' : 'danger'} />
              <Readout label="pH" value={end.pH} digits={3} delta={end.pH - start.pH} deltaDigits={3} tone={end.pH < 7.45 ? 'good' : 'high'} />
              <Readout label="Urine pH" value={end.urinePH} digits={2} tone={end.urinePH > 7 ? 'good' : 'danger'} title="turning alkaline means bicarbonate is finally being excreted" />
              <Readout label="Urine chloride" value={end.urineCl / Math.max(end.urineVolume, 0.01)} digits={0} unit="mmol/L" tone={end.urineCl / Math.max(end.urineVolume, 0.01) > 20 ? 'good' : 'low'} />
              <Readout label="Extracellular volume" value={end.ecf} digits={1} unit="L" />
              <Readout label="Potassium" value={end.K} digits={2} unit="mmol/L" tone={end.K < 3.5 ? 'low' : 'good'} />
            </div>
          )}
        </Panel>
      </div>
      {end && start && (
        <p class={end.HCO3 < start.HCO3 - 6 ? 'callout good' : 'callout danger'}>
          {tIdx === 3 ? (
            <>
              <strong>Volume was restored and the alkalosis was not corrected.</strong> The extracellular volume is {end.ecf.toFixed(1)} L, up from {start.ecf.toFixed(1)}, and the bicarbonate is
              still {end.HCO3.toFixed(1)} mmol/L with the urine still acid at pH {end.urinePH.toFixed(1)}. Chloride, not volume, was holding this up. Compare with potassium chloride, which corrects it
              without restoring the volume at all.
            </>
          ) : tIdx === 2 ? (
            <>
              <strong>Chloride corrected it without restoring volume.</strong> The bicarbonate has fallen to {end.HCO3.toFixed(1)} mmol/L and the urine chloride has reappeared, while the
              extracellular volume is still {end.ecf.toFixed(1)} L. This pair of results — potassium chloride works, free water does not — is the experiment that separates chloride depletion from
              volume depletion as the maintenance factor.
            </>
          ) : end.HCO3 < start.HCO3 - 6 ? (
            <>
              Corrected: bicarbonate {start.HCO3.toFixed(1)} → {end.HCO3.toFixed(1)} mmol/L, and the urine pH has risen to {end.urinePH.toFixed(1)} as the kidney finally lets the bicarbonate go.
            </>
          ) : (
            <>
              Little change. Bicarbonate {end.HCO3.toFixed(1)} mmol/L with the urine still at pH {end.urinePH.toFixed(1)} — the kidney is still reclaiming everything it filters.
            </>
          )}
        </p>
      )}
      <div class="grid grid-2">
        <Panel title="Four days of treatment">
          {points && illBody && (
            <>
              <LineChart
                xLabel="days of treatment"
                series={[{ label: 'Bicarbonate (mmol/L)', points: points.map((p) => ({ x: p.day, y: p.HCO3 })), color: '#7bc47f' }] as Series[]}
                height={150}
              />
              <LineChart
                xLabel="days of treatment"
                series={[
                  { label: 'Urine pH', points: points.map((p) => ({ x: p.day, y: p.urinePH })), color: '#f2b134' },
                  { label: 'Arterial pH', points: points.map((p) => ({ x: p.day, y: p.pH })), color: '#e07b6a' },
                ] as Series[]}
                height={160}
              />
            </>
          )}
        </Panel>
        <Predict
          question="A vomiting patient with a bicarbonate of 44 is given 2 L/day of 5% dextrose. Volume is restored. What happens to the alkalosis?"
          options={['It corrects within a day', 'Almost nothing — chloride, not volume, is maintaining it', 'It worsens sharply', 'The urine turns alkaline immediately']}
          correct={1}
          explanation="Try it above and compare with potassium chloride, which corrects it while leaving the volume where it was. This pairing is how Rose separates the two, and it is the reason the urine chloride is the test that matters."
        />
      </div>
      <Expand summary="When saline is the wrong answer">
        <p>
          Everything above assumes a chloride-responsive alkalosis with a urine chloride under 20 mmol/L. Above that, the alkalosis is chloride-resistant and saline will not correct it — it will
          simply expand a patient who is not volume depleted. Those are the mineralocorticoid causes: primary hyperaldosteronism, Cushing's, licorice, Liddle, and severe potassium depletion. The
          treatment is aimed at the cause, with potassium replacement, and a mineralocorticoid antagonist where appropriate.
        </p>
        <p class="note" style={{ marginBottom: 0 }}>
          The oedematous patient is the other exception: chloride-responsive by the urine test, but giving saline would worsen the oedema. Acetazolamide wastes bicarbonate proximally and is the usual
          choice — try it above and note that it corrects the bicarbonate only partly, and at the cost of a mild acidosis of its own.
        </p>
      </Expand>
    </>
  );
}
