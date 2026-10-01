import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related, Busy, useTabParam } from '../ui/page';
import { Panel, Readout, Slider, Sources, Predict, BarRow, Tabs, Chain, LineChart, Expand, type Series } from '../ui/kit';
import { BedsideEquations, EquationCard } from '../ui/EquationCard';
import { makeParams, useSteady, useStep, NORMAL } from '../sim/hooks';
import { oncoticGradientRel } from '../engine/body';
import type { ParamPatch } from '../engine/types';
import { si } from '../units';

const TAB_IDS = ['states', 'underfill', 'compensation', 'treating'] as const;

interface Case {
  label: string;
  patch: ParamPatch;
  /** what is actually wrong, for the underfill/overfill scoring */
  kind: 'none' | 'underfill' | 'overfill' | 'leak';
  explain: string;
}

const CASES: Case[] = [
  { label: 'Normal', patch: {}, kind: 'none', explain: 'Nothing is wrong. Intake equals output at a normal extracellular volume.' },
  {
    label: 'Heart failure, compensated',
    patch: { cardiacFunction: 0.72 },
    kind: 'underfill',
    explain: 'Moderate impairment. The fluid retained restores venous return, so the volume signals switch off again — renin is back near normal at an expanded volume. This is why renin can be normal in a patient who plainly has heart failure.',
  },
  {
    label: 'Heart failure, decompensated',
    patch: { cardiacFunction: 0.45 },
    kind: 'underfill',
    explain: 'Severe impairment. No amount of filling restores output, so the volume signals never switch off and retention continues. Renin and aldosterone stay high and sodium excretion stays near zero.',
  },
  {
    label: 'Cirrhosis with ascites',
    patch: { vasodilation: 0.55, portalHypertension: 0.9, albumin: 2.2 },
    kind: 'underfill',
    explain: 'Splanchnic vasodilatation drops systemic vascular resistance. Cardiac output is high and the kidney still reads underfilling, because much of that output is circulating ineffectively.',
  },
  {
    label: 'Nephrotic syndrome',
    patch: { albumin: 2.2, proteinuria: 10 },
    kind: 'overfill',
    explain: 'Primary renal sodium retention. Renin is suppressed and the plasma volume is defended — the opposite signature to heart failure, and the reason diuresis here costs nothing.',
  },
  {
    label: 'Low albumin alone',
    patch: { albumin: 2.2 },
    kind: 'none',
    explain: 'The same albumin, without the renal disease. Almost no oedema: interstitial oncotic pressure falls in parallel and the transcapillary gradient is largely preserved.',
  },
  {
    label: 'Severe hypoalbuminaemia',
    patch: { albumin: 1.3 },
    kind: 'none',
    explain: 'Below roughly 15 g/L the interstitial protein reservoir is washed out and the gradient does start to fall. This is the setting in which hypoalbuminaemia alone can underfill.',
  },
  {
    label: 'Capillary leak (burns)',
    patch: { capillaryLeak: 0.5 },
    kind: 'leak',
    explain: 'Protein crosses the wall freely, so the oncotic gradient is lost outright rather than shifted. Fluid and protein leave together and the plasma volume falls.',
  },
];

export default function Edema({ query }: { query: URLSearchParams }) {
  const [tab, setTab] = useTabParam('/edema', TAB_IDS, 'states', query);
  return (
    <div>
      <PageHead
        path="/edema"
        lede="Oedema needs two things: a capillary that filters too much, and a kidney that retains sodium. The second supplies almost all the volume — the whole plasma volume is about 3 litres and oedema is invisible below 2.5. Whether removing that fluid helps or harms depends entirely on why the kidney was retaining it."
      />
      <Tabs
        tabs={[
          { id: 'states', label: 'The states' },
          { id: 'underfill', label: 'Underfilling vs overfilling' },
          { id: 'compensation', label: 'The compensated state' },
          { id: 'treating', label: 'Removing the fluid' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'states' && <States />}
      {tab === 'underfill' && <Underfill />}
      {tab === 'compensation' && <Compensation />}
      {tab === 'treating' && <Treating />}
      <BedsideEquations
        ids={['unauk', 'fena']}
        intro="In an oedematous patient on diuretics, the spot urine Na⁺/K⁺ ratio shows whether the kidney is excreting sodium at all, and so whether to raise the diuretic or look at what the patient is eating."
      />
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>A net filtration gradient of about 0.3 mmHg at a muscle capillary, with the filtrate returned by the lymphatics. No interstitial accumulation.</p>}
          why={<p>Starling forces set filtration; lymph flow, interstitial oncotic washout and rising interstitial pressure absorb about 15 mmHg of disturbance before oedema appears.</p>}
          change={<p>Raise venous pressure, make the capillary leaky, or destroy the oncotic gradient, and filtration exceeds lymph return. The plasma volume falls, the kidney retains sodium, and most of what it retains goes to the interstitium.</p>}
          abnormal={<p>Heart failure and cirrhosis: retention because the circulation reads as underfilled. Nephrotic syndrome: retention as the primary renal fault. Capillary leak: protein and fluid leave together.</p>}
          clinical={<p>Decide which of those it is before treating. Watch the urea and creatinine as the check on perfusion, and limit diuresis to 500–750 mL/day in ascites without peripheral oedema.</p>}
        />
        <Sources cite={{ rose: [16, 7, 8, 15], evidence: 'clinical', refs: ['levick2010', 'pockros1986', 'pitt1999rales', 'mcmurray2014', 'mcmurray2019dapa'] }} />
      </Panel>
      <Related paths={['/diuretics', '/sodium', '/body-water', '/hyponatremia', '/prerenal-atn']} />
    </div>
  );
}

// ---------------------------------------------------------------- the states
function States() {
  const [caseIdx, setCaseIdx] = useState(0);
  const c = CASES[caseIdx];
  const params = useMemo(() => makeParams({ naIntake: 150, ...c.patch }), [caseIdx]);
  const { ev, busy } = useSteady(params, 45);
  const normal = NORMAL();

  return (
    <>
      <WhatIf options={CASES.map((x) => ({ label: x.label, explain: x.explain }))} onApply={(o) => setCaseIdx(CASES.findIndex((x) => x.label === o.label))} onReset={() => setCaseIdx(0)} active={c.label} />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="After 45 days" note="Each is a parameter change run to whatever steady state it reaches — or fails to reach.">
            <Busy on={busy} />
            {ev && (
              <div class="readout-grid">
                <Readout label="Extracellular volume" value={ev.derived.ecfLiters} digits={1} unit="L" delta={ev.derived.ecfLiters - normal.derived.ecfLiters} deltaDigits={1} tone={ev.derived.ecfLiters > 16 ? 'high' : 'normal'} />
                <Readout label="Oedema" value={ev.derived.edemaLiters} digits={1} unit="L" tone={ev.derived.edemaLiters > 2.5 ? 'danger' : ev.derived.edemaLiters > 0.5 ? 'high' : 'good'} refRange="visible above ~2.5 L" />
                <Readout label="Plasma volume" value={ev.plasma.plasmaVolume} digits={2} unit="L" tone={ev.plasma.plasmaVolume < 2.7 ? 'low' : 'normal'} refRange="~3.0 L" />
                <Readout label="Mean arterial pressure" value={ev.reg.MAP} digits={0} unit="mmHg" tone={ev.reg.MAP < 80 ? 'low' : 'normal'} />
                <Readout label="Cardiac output" value={ev.reg.CO} digits={2} unit="×normal" tone={ev.reg.CO < 0.85 ? 'low' : ev.reg.CO > 1.15 ? 'high' : 'normal'} />
                <Readout label="Systemic vascular resistance" value={ev.reg.SVR} digits={2} unit="×normal" tone={ev.reg.SVR < 0.85 ? 'low' : 'normal'} />
                <Readout label="Renin" value={ev.reg.hormones.renin} digits={2} unit="×normal" tone={ev.reg.hormones.renin > 2 ? 'high' : ev.reg.hormones.renin < 0.8 ? 'low' : 'normal'} />
                <Readout label="Aldosterone" value={ev.reg.hormones.aldo} digits={2} unit="×normal" tone={ev.reg.hormones.aldo > 2 ? 'high' : ev.reg.hormones.aldo < 0.8 ? 'low' : 'normal'} />
                <Readout label="Urine Na⁺" value={ev.kidney.urine.Na} digits={0} unit="mmol/L" tone={ev.kidney.urine.Na < 25 ? 'low' : 'normal'} refRange="< 25 suggests retention" />
                <Readout label="Na⁺ excreted" value={ev.kidney.urine.exc.Na} digits={0} unit="mmol/day" tone={ev.kidney.urine.exc.Na < 120 ? 'low' : 'normal'} refRange="intake 150" />
                <Readout label="Plasma albumin" value={si.albumin(ev.plasma.albumin)} digits={0} unit="g/L" tone={si.albumin(ev.plasma.albumin) < 30 ? 'low' : 'normal'} />
                <Readout label="Creatinine" value={si.creat(ev.body.creat)} digits={0} unit="µmol/L" tone={si.creat(ev.body.creat) > 110 ? 'high' : 'normal'} />
              </div>
            )}
          </Panel>
        </div>
        <div>
          <Panel title="Where the extracellular fluid is" note="The plasma volume is what supports the circulation. Everything above it is oedema, and it is doing nothing useful.">
            {ev && (
              <>
                <BarRow label="Plasma" value={ev.plasma.plasmaVolume} max={Math.max(20, ev.derived.ecfLiters)} unit=" L" color="var(--c-coral)" sub="normally ~3.0 L — defended almost to the last" />
                <BarRow label="Interstitium, normal" value={Math.max(0, Math.min(11, ev.derived.ecfLiters - ev.plasma.plasmaVolume - ev.derived.edemaLiters))} max={Math.max(20, ev.derived.ecfLiters)} unit=" L" color="var(--c-blue)" />
                <BarRow label="Oedema" value={ev.derived.edemaLiters} max={Math.max(20, ev.derived.ecfLiters)} unit=" L" color="var(--c-violet)" sub={ev.derived.edemaLiters > 2.5 ? 'clinically apparent' : 'not yet detectable'} />
                <p class="note" style={{ marginTop: 8 }}>
                  {c.explain}
                </p>
              </>
            )}
          </Panel>
          <Panel title="The transcapillary oncotic gradient" note="Not the plasma albumin — the gradient across the capillary wall, which is what actually opposes filtration.">
            {ev && (
              <>
                <LineChart yLabel="Oncotic gradient, plasma − interstitium (mmHg)"
                  xLabel="plasma albumin (g/L)"
                  series={[
                    { label: 'Gradient, chronic (interstitium has adapted)', points: albuminCurve(true), color: 'var(--c-green)' },
                    { label: 'Gradient, acute (no time to adapt)', points: albuminCurve(false), color: 'var(--c-coral)' },
                  ] as Series[]}
                  yMin={0}
                  yMax={1.1}
                  marker={si.albumin(ev.plasma.albumin)}
                  height={200}
                />
                <p class="control-hint">
                  The green line is why hypoalbuminaemia is a weaker cause of oedema than it looks: down to about 25 g/L the gradient barely moves, because interstitial oncotic pressure falls with
                  it. The red line is the same patient given large volumes of saline quickly — the interstitium has not adapted, the gradient falls at once, and oedema can appear before the filling
                  pressures are restored.
                </p>
              </>
            )}
          </Panel>
        </div>
      </div>
      <div class="grid grid-2">
        <EquationCard eq="starling" compact />
        <Predict
          question="Two patients have a plasma albumin of 22 g/L. One has nephrotic syndrome and is oedematous; the other has the same albumin from poor intake and is not. Why?"
          options={['The nephrotic albumin is abnormal', 'Nephrotic syndrome adds primary renal sodium retention; hypoalbuminaemia alone supplies no volume', 'Measurement error', 'The nephrotic patient drinks more']}
          correct={1}
          explanation="Oedema needs the kidney. Select “Low albumin alone” above and compare it with “Nephrotic syndrome” — the same albumin, and almost no oedema, because nothing is retaining sodium."
        />
      </div>
    </>
  );
}

function albuminCurve(chronic: boolean) {
  const pts: { x: number; y: number }[] = [];
  for (let gL = 8; gL <= 48; gL += 1) pts.push({ x: gL, y: oncoticGradientRel(gL / 10, chronic) });
  return pts;
}

// ---------------------------------------------------------------- underfill vs overfill
function Underfill() {
  const [caseIdx, setCaseIdx] = useState(1);
  const c = CASES[caseIdx];
  const params = useMemo(() => makeParams({ naIntake: 150, ...c.patch }), [caseIdx]);
  const { ev, busy } = useSteady(params, 45);
  const normal = NORMAL();

  // What the hormones read, which is not always what is true — the compensated state is exactly
  // the case where they disagree, and that is worth showing rather than hiding.
  const reading = ev
    ? ev.reg.hormones.renin > 1.6 * normal.reg.hormones.renin
      ? 'underfill'
      : ev.reg.hormones.renin < 0.9 * normal.reg.hormones.renin && ev.derived.ecfLiters > normal.derived.ecfLiters + 0.8
        ? 'overfill'
        : 'quiet'
    : 'quiet';
  const expanded = ev ? ev.derived.ecfLiters > normal.derived.ecfLiters + 0.8 : false;
  const compensated = reading === 'quiet' && expanded && c.kind === 'underfill';

  return (
    <>
      <WhatIf options={CASES.map((x) => ({ label: x.label, explain: x.explain }))} onApply={(o) => setCaseIdx(CASES.findIndex((x) => x.label === o.label))} onReset={() => setCaseIdx(1)} active={c.label} />
      <div class="grid grid-2">
        <Panel title="What the hormones say" note="This is the distinction that decides whether diuresis is safe, and it is readable at the bedside.">
          <Busy on={busy} />
          {ev && (
            <>
              <div class="readout-grid">
                <Readout label="Renin" value={ev.reg.hormones.renin} digits={2} unit="×normal" tone={ev.reg.hormones.renin > 1.6 ? 'high' : ev.reg.hormones.renin < 0.9 ? 'low' : 'normal'} />
                <Readout label="Aldosterone" value={ev.reg.hormones.aldo} digits={2} unit="×normal" tone={ev.reg.hormones.aldo > 1.6 ? 'high' : ev.reg.hormones.aldo < 0.9 ? 'low' : 'normal'} />
                <Readout label="ADH" value={ev.reg.hormones.adh} digits={2} unit="×normal" tone={ev.reg.hormones.adh > 2 ? 'high' : 'normal'} />
                <Readout label="Urine Na⁺" value={ev.kidney.urine.Na} digits={0} unit="mmol/L" tone={ev.kidney.urine.Na < 25 ? 'low' : 'normal'} />
                <Readout label="Plasma volume" value={ev.plasma.plasmaVolume} digits={2} unit="L" tone={ev.plasma.plasmaVolume < 2.7 ? 'low' : 'normal'} />
                <Readout label="Extracellular volume" value={ev.derived.ecfLiters} digits={1} unit="L" tone={ev.derived.ecfLiters > 16 ? 'high' : 'normal'} />
              </div>
              <p class={reading === 'underfill' ? 'callout danger' : reading === 'overfill' ? 'callout good' : compensated ? 'callout' : 'callout'} style={{ marginTop: 8 }}>
                {reading === 'underfill' && (
                  <>
                    <strong>Underfilling.</strong> Renin and aldosterone are raised and the urine sodium is low: the kidney is retaining because it reads the circulation as underfilled. Removing this
                    fluid will lower the effective circulating volume — watch the urea and creatinine.
                  </>
                )}
                {reading === 'overfill' && (
                  <>
                    <strong>Overfilling.</strong> The volume is expanded and renin is <em>suppressed</em>. The kidney is retaining sodium primarily, not in response to anything. Removing the fluid
                    brings the effective circulating volume from high back towards normal, so it costs nothing.
                  </>
                )}
                {compensated && (
                  <>
                    <strong>Compensated — and this is the trap.</strong> Renin is near normal, so the hormones read neither pattern. But the extracellular volume is{' '}
                    {(ev.derived.ecfLiters - normal.derived.ecfLiters).toFixed(1)} L above normal, and that expansion is exactly why renin is normal: the retention restored venous return, so the
                    signal that caused it switched off. Rose makes the same point — the plasma renin is normal in some patients with heart failure or cirrhosis, and a compensated state is part of the
                    explanation. A normal renin here does <em>not</em> mean diuresis is free.
                  </>
                )}
                {reading === 'quiet' && !compensated && <>Neither pattern: the volume signals are near normal and the volume is not much expanded.</>}
              </p>
            </>
          )}
        </Panel>
        <Panel title="The two sequences">
          <h4 style={{ marginBottom: 4 }}>Underfilling — heart failure, cirrhosis</h4>
          <Chain
            steps={[
              { text: 'Cardiac output falls, or resistance falls', direction: -1 },
              { text: 'Baroreceptors read a fall in effective circulating volume', direction: -1 },
              { text: 'Renin, aldosterone, noradrenaline, ADH rise', direction: 1 },
              { text: 'Na⁺ and water retained; plasma volume restored', direction: 1 },
              { text: 'Most of it enters the interstitium: oedema' },
            ]}
          />
          <h4 style={{ margin: '12px 0 4px' }}>Overfilling — nephrotic syndrome, glomerulonephritis</h4>
          <Chain
            steps={[
              { text: 'The diseased kidney reabsorbs Na⁺ primarily (collecting tubules)', direction: 1 },
              { text: 'Both plasma and interstitial volumes expand', direction: 1 },
              { text: 'Baroreceptors read a normal or high volume' },
              { text: 'Renin and aldosterone are suppressed', direction: -1 },
            ]}
          />
        </Panel>
      </div>
      <div class="grid grid-2">
        <Panel title="Rose Fig. 16-4: remission before the albumin moves" note="The strongest argument that nephrotic oedema is usually overfilling.">
          <RemissionExperiment />
        </Panel>
        <Predict
          question="A nephrotic patient is oedematous with an albumin of 22 g/L. Plasma renin is suppressed. Is diuresis likely to compromise renal perfusion?"
          options={['Yes, because the albumin is low', 'No — suppressed renin means the volume is expanded, so diuresis brings it from high back towards normal', 'Yes, always in nephrotic syndrome', 'Only if a loop diuretic is used']}
          correct={1}
          explanation="The minority of nephrotic patients with a very low albumin, a high renin, a low urine sodium and symptoms of hypovolaemia are the ones in whom it does. The hormones tell you which patient you have."
        />
      </div>
    </>
  );
}

/**
 * Rose Fig. 16-4: proteinuria remits, the albumin has not yet risen — does the retention stop?
 *
 * The two arms are chosen so that the plasma albumin the body actually sees is the same in both,
 * which takes a little care: heavy proteinuria lowers it further on its own, so the remission arm
 * starts from a lower nominal value to land on the same one.
 */
function RemissionExperiment() {
  const relapse = useSteady(useMemo(() => makeParams({ naIntake: 150, albumin: 1.4, proteinuria: 16 }), []), 45);
  const remitting = useSteady(useMemo(() => makeParams({ naIntake: 150, albumin: 1.0, proteinuria: 0 }), []), 45);
  const normal = NORMAL();
  return (
    <>
      <Busy on={relapse.busy || remitting.busy} />
      {relapse.ev && remitting.ev && (
        <>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th />
                  <th>Relapse</th>
                  <th>Remission, albumin unchanged</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Plasma albumin</th>
                  <td class="mono">{si.albumin(relapse.ev.plasma.albumin).toFixed(0)} g/L</td>
                  <td class="mono">{si.albumin(remitting.ev.plasma.albumin).toFixed(0)} g/L</td>
                </tr>
                <tr>
                  <th scope="row">FENa</th>
                  <td class="mono">{relapse.ev.derived.FENa.toFixed(2)}%</td>
                  <td class="mono">{remitting.ev.derived.FENa.toFixed(2)}%</td>
                </tr>
                <tr>
                  <th scope="row">Extracellular volume</th>
                  <td class="mono">{relapse.ev.derived.ecfLiters.toFixed(1)} L</td>
                  <td class="mono">{remitting.ev.derived.ecfLiters.toFixed(1)} L</td>
                </tr>
                <tr>
                  <th scope="row">Oedema</th>
                  <td class="mono">{relapse.ev.derived.edemaLiters.toFixed(1)} L</td>
                  <td class="mono">{remitting.ev.derived.edemaLiters.toFixed(1)} L</td>
                </tr>
                <tr>
                  <th scope="row">Renin</th>
                  <td class="mono">{relapse.ev.reg.hormones.renin.toFixed(2)}×</td>
                  <td class="mono">{remitting.ev.reg.hormones.renin.toFixed(2)}×</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="callout good" style={{ marginTop: 8 }}>
            The proteinuria has gone and the albumin is identical — and the volume has fallen by {(relapse.ev.derived.ecfLiters - remitting.ev.derived.ecfLiters).toFixed(1)} L. Whatever was retaining
            sodium was the renal disease, not the low albumin. Normal extracellular volume for comparison: {normal.derived.ecfLiters.toFixed(1)} L.
          </p>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------- compensation
function Compensation() {
  const [cf, setCf] = useState(0.72);
  const base = useMemo(() => makeParams({ naIntake: 150 }), []);
  const sick = useMemo(() => makeParams({ naIntake: 150, cardiacFunction: cf }), [cf]);
  const { points, busy } = useStep(base, sick, 30, 0.05, 60, 3, 0.2);
  const balanced = points?.find((p) => p.urineNa > 0.85 * 150);
  const end = points?.[points.length - 1];

  return (
    <>
      <WhatIf
        options={[
          { label: 'Mild (0.85)', explain: 'Barely impaired: compensates within a day or two with no detectable oedema.' },
          { label: 'Moderate (0.72)', explain: "Rose Fig. 16-5. A new steady state in about a week, with the volume expanded and renin, aldosterone and sodium excretion all back to baseline." },
          { label: 'Marked (0.6)', explain: 'Still compensates, but it takes a fortnight and costs several litres of oedema.' },
          { label: 'Severe (0.45)', explain: 'No amount of filling restores output. The hormones never switch off and retention continues — decompensated heart failure.' },
        ]}
        onApply={(o) => setCf(o.label.startsWith('Mild') ? 0.85 : o.label.startsWith('Moderate') ? 0.72 : o.label.startsWith('Marked') ? 0.6 : 0.45)}
        onReset={() => setCf(0.72)}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="How impaired is the heart?">
            <Slider
              label="Cardiac function"
              value={cf}
              min={0.35}
              max={1}
              step={0.01}
              format={(v) => `${(v * 100).toFixed(0)}% of normal`}
              onInput={setCf}
              normal={1}
              hint="an abrupt fall at day 0, as in Rose's inferior vena cava constriction"
            />
            <Busy on={busy} />
            {end && (
              <div class="readout-grid" style={{ marginTop: 8 }}>
                <Readout label="Reached balance on day" value={balanced ? balanced.day : 30} digits={1} tone={balanced ? 'good' : 'danger'} title="first day sodium excretion returns to within 15% of intake" />
                <Readout label="Extracellular volume, day 30" value={end.ecf} digits={1} unit="L" tone={end.ecf > 20 ? 'danger' : end.ecf > 16 ? 'high' : 'normal'} />
                <Readout label="Oedema, day 30" value={end.edema} digits={1} unit="L" tone={end.edema > 2.5 ? 'danger' : 'normal'} />
                <Readout label="Renin, day 30" value={end.renin} digits={2} unit="×normal" tone={end.renin > 2 ? 'high' : 'good'} />
              </div>
            )}
            <p class={balanced ? 'callout good' : 'callout danger'} style={{ marginTop: 8 }}>
              {balanced ? (
                <>
                  <strong>Compensated.</strong> Sodium excretion returned to intake on day {balanced.day.toFixed(1)}, at an extracellular volume of {balanced.ecf.toFixed(1)} L. The retention worked:
                  it restored venous return, so the signals that caused it switched off. This is why a patient who plainly has heart failure can have a normal plasma renin.
                </>
              ) : (
                <>
                  <strong>Decompensated.</strong> Thirty days and sodium excretion has still not caught up with intake. No attainable filling pressure restores output, so the volume signals never
                  switch off and fluid keeps accumulating. This patient needs the heart treated, not just the fluid removed.
                </>
              )}
            </p>
          </Panel>
        </div>
        <div>
          <Panel title="Rose Fig. 16-5" note="Thoracic inferior vena cava constriction in the dog: initial hypotension and hormone activation, then a new steady state at an expanded volume.">
            {points && (
              <>
                <LineChart yLabel="Mean arterial pressure (mmHg)"
                  xLabel="days"
                  series={[
                    { label: 'Mean arterial pressure (mmHg)', points: points.map((p) => ({ x: p.day, y: p.MAP })), color: 'var(--c-coral)' },
                  ] as Series[]}
                  height={130}
                />
                <LineChart yLabel="× normal"
                  xLabel="days"
                  series={[
                    { label: 'Renin (×normal)', points: points.map((p) => ({ x: p.day, y: p.renin })), color: 'var(--c-amber)' },
                    { label: 'Aldosterone (×normal)', points: points.map((p) => ({ x: p.day, y: p.aldo })), color: 'var(--c-violet)' },
                  ] as Series[]}
                  yMin={0}
                  height={150}
                />
                <LineChart yLabel="Na⁺ (mmol/day)"
                  xLabel="days"
                  series={[
                    { label: 'Urinary Na⁺ (mmol/day)', points: points.map((p) => ({ x: p.day, y: p.urineNa })), color: 'var(--c-green)' },
                    { label: 'Intake', points: points.map((p) => ({ x: p.day, y: 150 })), color: 'var(--ink-faint)' },
                  ] as Series[]}
                  yMin={0}
                  height={150}
                />
                <LineChart yLabel="Volume (L)"
                  xLabel="days"
                  series={[
                    { label: 'Extracellular volume (L)', points: points.map((p) => ({ x: p.day, y: p.ecf })), color: 'var(--c-blue)' },
                    { label: 'Oedema (L)', points: points.map((p) => ({ x: p.day, y: p.edema })), color: 'var(--c-violet)' },
                  ] as Series[]}
                  yMin={0}
                  height={150}
                />
              </>
            )}
          </Panel>
        </div>
      </div>
      <Expand summary="A caveat about the model, and one about the book">
        <p class="note">
          The model reaches balance at a larger expansion than Rose's dog did — compensating a 28% fall in cardiac function costs it a few litres rather than a few hundred millilitres. The shape is
          right and the timing is close; the amount of fluid is not, and the sliders should be read as a spectrum rather than as calibrated ejection fractions.
        </p>
        <p class="note">
          Rose is careful too. The compensated state explains some patients with a normal renin, but many with stable heart failure have a persistently low cardiac output and a normal plasma renin
          anyway. One possibility he offers is that circulating renin does not reflect intrarenal renin–angiotensin activity, which animal studies show can stay activated with normal plasma levels. He
          presents that as a possibility, not an established account, and so should we.
        </p>
      </Expand>
    </>
  );
}

// ---------------------------------------------------------------- treating
function Treating() {
  const [caseIdx, setCaseIdx] = useState(1);
  const [dose, setDose] = useState(0.5);
  const c = CASES[caseIdx];
  const before = useMemo(() => makeParams({ naIntake: 150, ...c.patch }), [caseIdx]);
  const after = useMemo(() => makeParams({ naIntake: 100, ...c.patch, diureticDoses: 1, drugs: { furosemide: dose } }), [caseIdx, dose]);
  const { points, busy } = useStep(before, after, 7, 0.05, 60, 2, 0.25);
  const base = useSteady(before, 45);
  const end = points?.[points.length - 1];
  const creatRise = end && base.ev ? si.creat(end.creat) - si.creat(base.ev.body.creat) : 0;

  return (
    <>
      <WhatIf
        options={CASES.filter((x) => x.kind !== 'none').map((x) => ({ label: x.label, explain: x.explain }))}
        onApply={(o) => setCaseIdx(CASES.findIndex((x) => x.label === o.label))}
        onReset={() => {
          setCaseIdx(1);
          setDose(0.5);
        }}
        active={c.label}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Treat it" note="A loop diuretic once daily, with dietary sodium cut to 100 mmol/day, started on a patient who has reached the state above.">
            <Slider label="Loop diuretic dose" value={dose} min={0} max={1} step={0.05} format={(v) => (v === 0 ? 'none' : `${(v * 100).toFixed(0)}% NKCC2 blocked`)} onInput={setDose} />
            <Busy on={busy} />
            {end && base.ev && (
              <div class="readout-grid" style={{ marginTop: 8 }}>
                <Readout label="Oedema removed" value={Math.max(0, base.ev.derived.edemaLiters - end.edema)} digits={2} unit="L" tone="good" />
                <Readout label="Oedema remaining" value={end.edema} digits={2} unit="L" tone={end.edema > 2.5 ? 'high' : 'normal'} />
                <Readout label="Creatinine" value={si.creat(end.creat)} digits={0} unit="µmol/L" delta={creatRise} deltaDigits={0} tone={creatRise > 30 ? 'danger' : 'normal'} />
                <Readout label="Urea" value={si.urea(end.BUN)} digits={1} unit="mmol/L" tone={si.urea(end.BUN) > 8 ? 'high' : 'normal'} />
                <Readout label="Renin" value={end.renin} digits={2} unit="×normal" tone={end.renin > 2 * (base.ev.reg.hormones.renin || 1) ? 'high' : 'normal'} />
                <Readout label="Plasma K⁺" value={end.K} digits={2} unit="mmol/L" tone={end.K < 3.5 ? 'low' : 'normal'} />
              </div>
            )}
            {end && base.ev && (
              <p class={creatRise > 30 ? 'callout danger' : 'callout good'} style={{ marginTop: 8 }}>
                {creatRise > 30 ? (
                  <>
                    The creatinine has risen {creatRise.toFixed(0)} µmol/L. Rose's rule: while urea and creatinine are stable, perfusion has been preserved. A rise means either too much diuretic, or a
                    circulation that can only maintain output at filling pressures high enough to cause oedema — and those two are managed quite differently.
                    {end.edema > 2 ? ' Note that oedema persists, which points to the second.' : ' The oedema has gone, which points to the first.'}
                  </>
                ) : (
                  <>Urea and creatinine are stable, so tissue perfusion has been preserved. {c.kind === 'overfill' ? 'Expected here: the volume was expanded to begin with.' : 'So far so good — but this is an underfilled circulation, so keep watching.'}</>
                )}
              </p>
            )}
          </Panel>
          <Panel title="Rose's three questions">
            <ol style={{ paddingLeft: 18, lineHeight: 1.75 }}>
              <li>
                <strong>Must it be treated?</strong> Only pulmonary oedema is an emergency. Everything else can go slowly — and in cirrhosis should, because hypokalaemia, alkalosis and rapid fluid
                shifts can precipitate encephalopathy or the hepatorenal syndrome.
              </li>
              <li>
                <strong>What does removing it cost?</strong> If the retention was compensatory, the effective circulating volume falls — cardiac output drops about 20% on average in heart failure, and
                renin, noradrenaline and ADH rise. Most patients still feel better.
              </li>
              <li>
                <strong>How fast?</strong> 2–3 L/day in generalised oedema. Ascites without peripheral oedema is the exception: about 500–750 mL/day, because it can only come back through the
                peritoneal capillaries.
              </li>
            </ol>
          </Panel>
        </div>
        <div>
          <Panel title="Seven days of treatment">
            {points && (
              <>
                <LineChart yLabel="Volume (L)"
                  xLabel="days"
                  series={[
                    { label: 'Oedema (L)', points: points.map((p) => ({ x: p.day, y: p.edema })), color: 'var(--c-violet)' },
                    { label: 'Extracellular volume (L)', points: points.map((p) => ({ x: p.day, y: p.ecf })), color: 'var(--c-blue)' },
                  ] as Series[]}
                  yMin={0}
                  height={170}
                />
                <LineChart yLabel="Creatinine (µmol/L)"
                  xLabel="days"
                  series={[{ label: 'Creatinine (µmol/L)', points: points.map((p) => ({ x: p.day, y: si.creat(p.creat) })), color: 'var(--c-coral)' }] as Series[]}
                  height={150}
                />
                <LineChart yLabel="Renin (× normal)"
                  xLabel="days"
                  series={[{ label: 'Renin (×normal)', points: points.map((p) => ({ x: p.day, y: p.renin })), color: 'var(--c-amber)' }] as Series[]}
                  yMin={0}
                  height={150}
                />
              </>
            )}
            <p class="control-hint">
              In an underfilled patient the renin curve rises as the fluid comes off — the kidney is being taken further from where it wanted to be. In an overfilled one it barely moves.
            </p>
          </Panel>
          <Panel title="Rose Fig. 16-7: ascites without peripheral oedema">
            <p>
              Fourteen patients with stable chronic liver disease were diuresed hard. Six had ascites without peripheral oedema: they lost about 1.2 L of ascites a day, every one of them had a rise in
              urea or creatinine, and their plasma volume fell by about a quarter. Eight who also had peripheral oedema lost more weight but less ascites, and none developed renal impairment — until
              the peripheral oedema disappeared, at which point ascites mobilisation increased and renal dysfunction appeared.
            </p>
            <p class="note" style={{ marginBottom: 0 }}>
              Peripheral oedema is mobilised from capillary beds everywhere; ascites has only the peritoneal capillaries. That is the whole of the 500–750 mL/day rule, and it stops applying the moment
              peripheral oedema is present.
            </p>
            <Sources cite={{ rose: [16], evidence: 'clinical', refs: ['pockros1986'] }} />
          </Panel>
        </div>
      </div>
      <Predict
        question="Three days of diuretics in chronic heart failure: 5 kg lost, symptoms much improved, but oedema persists and creatinine has gone from 105 to 200 µmol/L. Overdiuresis?"
        options={['Yes — stop the diuretic', 'No — this heart only maintains output at filling pressures high enough to cause oedema; she cannot be both dry and stable on diuretics alone', 'The creatinine assay is interfered with', 'Give albumin']}
        correct={1}
        explanation="Overdiuresis clears the oedema and then keeps going. Here the oedema is still there, so the fluid was not excessive — the disease is. The answer is to treat the heart, not to push more diuretic."
      />
    </>
  );
}
