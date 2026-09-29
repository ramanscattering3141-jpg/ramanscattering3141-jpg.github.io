import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related, Busy, useTabParam } from '../ui/page';
import { Panel, Readout, Slider, Sources, Predict, Tabs, Chain, LineChart, Expand, type Series } from '../ui/kit';
import { makeParams, useCourse, useStep, NORMAL } from '../sim/hooks';
import type { ParamPatch } from '../engine/types';
import { si } from '../units';

const TAB_IDS = ['losses', 'signs', 'replacement'] as const;

interface Loss {
  label: string;
  patch: ParamPatch;
  explain: string;
}

const LOSSES: Loss[] = [
  { label: 'Diarrhoea', patch: { diarrhea: 2.5, waterIntake: 1, naIntake: 40 }, explain: 'Intestinal fluid is rich in bicarbonate and potassium. Expect a normal anion gap acidosis and hypokalaemia alongside the volume loss.' },
  { label: 'Vomiting', patch: { vomiting: 1.5, waterIntake: 1, naIntake: 40 }, explain: 'Gastric fluid is rich in H⁺, Cl⁻ and K⁺. Expect a metabolic alkalosis and hypokalaemia — and a urine chloride that stays low while the urine sodium may not.' },
  { label: 'Sweat and insensible loss', patch: { insensible: 3.5, waterIntake: 1.2 }, explain: 'Mostly water, with sodium at 30–50 mmol/L. Plasma sodium rises rather than falls, and the kidney keeps excreting sodium — so a high urine sodium here does not mean the kidney is failing to conserve.' },
  { label: 'No intake at all', patch: { naIntake: 5, waterIntake: 0.3 }, explain: 'Obligatory losses continue: insensible loss, and the sodium the kidney cannot quite drive to zero. Slower than any of the others.' },
  { label: 'Osmotic diuresis', patch: { glucose: 600, naIntake: 60, waterIntake: 1.5 }, explain: 'Non-reabsorbed solute drags salt and water out together, and wastes potassium. The plasma sodium falls by translocation even as total body water is lost.' },
  { label: 'Third-space sequestration', patch: { capillaryLeak: 0.5, naIntake: 60, waterIntake: 1.2 }, explain: 'Fluid trapped out of circulation — pancreatitis, obstruction, crush injury, burns. Total body sodium can be normal or high while the circulation is depleted. This is the case in which a weight chart is useless.' },
  { label: 'Haemorrhage-like loss', patch: { naIntake: 10, waterIntake: 0.6, insensible: 2 }, explain: 'Whole blood is isotonic, so the plasma sodium does not move. Volume is lost without any change in composition, which is why the chemistry can be entirely normal early on.' },
];

const CLOCK = [0.25, 0.5, 1, 2, 3, 5];

export default function Hypovolemia({ query }: { query: URLSearchParams }) {
  const [tab, setTab] = useTabParam('/hypovolemia', TAB_IDS, 'losses', query);
  return (
    <div>
      <PageHead
        path="/hypovolemia"
        lede="Volume depletion is a loss of extracellular fluid, and where it came from decides what else goes wrong with it. The volume itself the kidney defends the same way every time — but the acid-base disturbance, the potassium, the plasma sodium and the urine chemistry all differ, and reading them backwards tells you the source."
      />
      <Tabs
        tabs={[
          { id: 'losses', label: 'Where the fluid went' },
          { id: 'signs', label: 'What the examination is worth' },
          { id: 'replacement', label: 'Putting it back' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'losses' && <Losses />}
      {tab === 'signs' && <Signs />}
      {tab === 'replacement' && <Replacement />}
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>Intake matches obligatory losses: about 700–1000 mL/day insensible, 100–200 mL in stool, and whatever sodium is eaten.</p>}
          why={<p>The kidney defends effective circulating volume by raising sodium reabsorption at every site. Below about 10% of blood volume, compensation is complete; beyond 16–25%, postural hypotension appears.</p>}
          change={<p>Losses differ in composition, not just in volume. Gastric fluid takes acid and chloride, intestinal fluid takes bicarbonate and potassium, sweat is dilute, and an osmotic diuresis takes salt and water together.</p>}
          abnormal={<p>Renal salt wasting, adrenal insufficiency and third-spacing all produce hypovolaemia the history does not explain. Sustained hypoperfusion becomes acute tubular injury.</p>}
          clinical={<p>Replace with a fluid that resembles what was lost, and with enough sodium to stay extracellular. Dextrose in water does not restore volume — it distributes across total body water and dilutes.</p>}
        />
        <Sources cite={{ rose: [14, 13, 8], evidence: 'clinical', refs: ['mcgee1999', 'semler2018', 'finfer2022plus', 'marik2013cvp'] }} />
      </Panel>
      <Related paths={['/urine-chemistry', '/prerenal-atn', '/fractional-excretion', '/body-water', '/metabolic-alkalosis']} />
    </div>
  );
}

// ---------------------------------------------------------------- where it went
function Losses() {
  const [lossIdx, setLossIdx] = useState(0);
  const [day, setDay] = useState(2);
  const l = LOSSES[lossIdx];
  const base = useMemo(() => makeParams({ naIntake: 150 }), []);
  const sick = useMemo(() => makeParams({ naIntake: 150, ...l.patch }), [lossIdx]);
  const { points, busy } = useStep(base, sick, 5, 0.021, 60, 2, 0.25);
  const normal = NORMAL();
  const at = useMemo(() => {
    if (!points?.length) return undefined;
    return points.reduce((best, p) => (Math.abs(p.day - day) < Math.abs(best.day - day) ? p : best), points[0]);
  }, [points, day]);
  const ecf0 = normal.derived.ecfLiters;

  return (
    <>
      <WhatIf options={LOSSES.map((x) => ({ label: x.label, explain: x.explain }))} onApply={(o) => setLossIdx(LOSSES.findIndex((x) => x.label === o.label))} onReset={() => setLossIdx(0)} active={l.label} />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="How long has it been going on?">
            <Slider
              label="Days of loss"
              value={CLOCK.indexOf(day) >= 0 ? CLOCK.indexOf(day) : 3}
              min={0}
              max={CLOCK.length - 1}
              step={1}
              format={() => (day < 1 ? `${Math.round(day * 24)} h` : `${day} days`)}
              onInput={(v) => setDay(CLOCK[Math.round(v)])}
            />
            <p class="note" style={{ marginBottom: 0 }}>{l.explain}</p>
          </Panel>
          <Panel title="The deficit">
            <Busy on={busy} />
            {at && (
              <div class="readout-grid">
                <Readout label="Extracellular volume" value={at.ecf} digits={1} unit="L" delta={at.ecf - ecf0} deltaDigits={1} tone={at.ecf < ecf0 - 2 ? 'danger' : at.ecf < ecf0 - 0.5 ? 'low' : 'normal'} />
                <Readout label="Deficit" value={Math.max(0, ecf0 - at.ecf)} digits={1} unit="L" tone={ecf0 - at.ecf > 3 ? 'danger' : 'normal'} />
                <Readout label="Weight change" value={at.weightChange} digits={1} unit="kg" title="total body water; useless when fluid is sequestered rather than lost" />
                <Readout label="Mean arterial pressure" value={at.MAP} digits={0} unit="mmHg" tone={at.MAP < 80 ? 'danger' : at.MAP < 88 ? 'low' : 'normal'} />
              </div>
            )}
          </Panel>
          <Panel title="What else went with it" note="This is what distinguishes the sources. The volume response is identical; the composition is not.">
            {at && (
              <div class="readout-grid">
                <Readout label="Sodium" value={at.Na} digits={1} unit="mmol/L" tone={at.Na < 135 ? 'low' : at.Na > 145 ? 'high' : 'normal'} />
                <Readout label="Potassium" value={at.K} digits={2} unit="mmol/L" tone={at.K < 3.5 ? 'low' : at.K > 5.2 ? 'high' : 'normal'} />
                <Readout label="Bicarbonate" value={at.HCO3} digits={1} unit="mmol/L" tone={at.HCO3 < 22 ? 'low' : at.HCO3 > 28 ? 'high' : 'normal'} />
                <Readout label="pH" value={at.pH} digits={2} tone={at.pH < 7.35 ? 'low' : at.pH > 7.45 ? 'high' : 'normal'} />
                <Readout label="Creatinine" value={si.creat(at.creat)} digits={0} unit="µmol/L" tone={si.creat(at.creat) > 110 ? 'high' : 'normal'} />
                <Readout label="Urea" value={si.urea(at.BUN)} digits={1} unit="mmol/L" tone={si.urea(at.BUN) > 8 ? 'high' : 'normal'} />
                <Readout label="Urea : creatinine" value={si.ureaCreatRatio(at.BUN, at.creat)} digits={0} tone={si.ureaCreatRatio(at.BUN, at.creat) > 90 ? 'high' : 'normal'} refRange="rises in pre-renal azotaemia" />
                <Readout label="Urine Na⁺" value={at.urineNa / Math.max(at.urineVolume, 0.01)} digits={0} unit="mmol/L" tone={at.urineNa / Math.max(at.urineVolume, 0.01) < 25 ? 'low' : 'high'} />
              </div>
            )}
          </Panel>
        </div>
        <div>
          <Panel title="The signature of each source" note="Read backwards: the disturbance tells you what was lost.">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Acid–base</th>
                    <th>K⁺</th>
                    <th>Plasma Na⁺</th>
                    <th>Urine clue</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Vomiting</th>
                    <td>Metabolic alkalosis</td>
                    <td>Low</td>
                    <td>Variable</td>
                    <td>Urine Cl⁻ low; urine Na⁺ may be high</td>
                  </tr>
                  <tr>
                    <th scope="row">Diarrhoea</th>
                    <td>Normal gap acidosis</td>
                    <td>Low</td>
                    <td>Variable</td>
                    <td>Urine anion gap negative</td>
                  </tr>
                  <tr>
                    <th scope="row">Sweat, insensible</th>
                    <td>Unchanged</td>
                    <td>Unchanged</td>
                    <td>High</td>
                    <td>Urine Na⁺ may be high — water was lost, not salt</td>
                  </tr>
                  <tr>
                    <th scope="row">Osmotic diuresis</th>
                    <td>Depends on the solute</td>
                    <td>Low</td>
                    <td>Low (translocation)</td>
                    <td>High urine volume and osmolality together</td>
                  </tr>
                  <tr>
                    <th scope="row">Third space</th>
                    <td>Unchanged</td>
                    <td>Unchanged</td>
                    <td>Unchanged</td>
                    <td>Avid retention with a normal or raised body sodium</td>
                  </tr>
                  <tr>
                    <th scope="row">Adrenal insufficiency</th>
                    <td>Mild acidosis</td>
                    <td><strong>High</strong></td>
                    <td>Low</td>
                    <td>Renal salt wasting despite hypovolaemia</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel title="Five days">
            {points && (
              <>
                <LineChart
                  xLabel="days"
                  series={[
                    { label: 'Extracellular volume (L)', points: points.map((p) => ({ x: p.day, y: p.ecf })), color: '#6aa9e8' },
                  ] as Series[]}
                  marker={day}
                  height={150}
                />
                <LineChart
                  xLabel="days"
                  series={[
                    { label: 'Plasma Na⁺ (mmol/L)', points: points.map((p) => ({ x: p.day, y: p.Na })), color: '#f2b134' },
                    { label: 'Bicarbonate (mmol/L)', points: points.map((p) => ({ x: p.day, y: p.HCO3 })), color: '#7bc47f' },
                  ] as Series[]}
                  marker={day}
                  height={160}
                />
                <LineChart
                  xLabel="days"
                  series={[
                    { label: 'Creatinine (µmol/L)', points: points.map((p) => ({ x: p.day, y: si.creat(p.creat) })), color: '#e07b6a' },
                    { label: 'Urea × 10 (mmol/L)', points: points.map((p) => ({ x: p.day, y: si.urea(p.BUN) * 10 })), color: '#b08ee0' },
                  ] as Series[]}
                  marker={day}
                  height={160}
                />
                <p class="control-hint">
                  Urea is drawn at ten times scale so it shares an axis. It rises proportionally faster than creatinine because its reabsorption is passive: slow tubular flow and a concentrated lumen
                  both drive more of it back. Creatinine, which is neither reabsorbed nor concentration-driven, only reflects the fall in filtration — which is exactly why the ratio between them is
                  informative.
                </p>
              </>
            )}
          </Panel>
        </div>
      </div>
      <Predict
        question="A patient sweating heavily in the heat has a urine Na⁺ of 180 mmol/L. Does that exclude volume depletion?"
        options={['Yes — the kidney is not conserving sodium', 'No — sweat is dilute, so water was lost rather than salt; the kidney has no reason to conserve sodium and the urine volume is tiny', 'It means adrenal insufficiency', 'It means a diuretic was taken']}
        correct={1}
        explanation="Select “Sweat and insensible loss” above. The plasma sodium rises rather than falls, and the sodium being excreted is simply the diet, concentrated into a very small urine volume. A urine sodium is a concentration."
      />
    </>
  );
}

// ---------------------------------------------------------------- signs
function Signs() {
  const [lossIdx, setLossIdx] = useState(0);
  const [day, setDay] = useState(3);
  const l = LOSSES[lossIdx];
  const base = useMemo(() => makeParams({ naIntake: 150 }), []);
  const sick = useMemo(() => makeParams({ naIntake: 150, ...l.patch }), [lossIdx]);
  const { points, busy } = useStep(base, sick, 5, 0.021, 60, 2, 0.25);
  const normal = NORMAL();
  const at = points?.length ? points.reduce((b, p) => (Math.abs(p.day - day) < Math.abs(b.day - day) ? p : b), points[0]) : undefined;
  const deficit = at ? Math.max(0, normal.derived.ecfLiters - at.ecf) : 0;
  const pctBlood = at ? (100 * (3.0 - Math.min(3.0, (at.ecf / normal.derived.ecfLiters) * 3.0))) / 3.0 : 0;

  return (
    <>
      <WhatIf options={LOSSES.map((x) => ({ label: x.label, explain: x.explain }))} onApply={(o) => setLossIdx(LOSSES.findIndex((x) => x.label === o.label))} onReset={() => setLossIdx(0)} active={l.label} />
      <div class="grid grid-2">
        <Panel title="What the deficit would look like" note="The model gives the deficit; the signs are what Rose reports they are worth at that deficit.">
          <Slider label="Days of loss" value={CLOCK.indexOf(day) >= 0 ? CLOCK.indexOf(day) : 4} min={0} max={CLOCK.length - 1} step={1} format={() => (day < 1 ? `${Math.round(day * 24)} h` : `${day} days`)} onInput={(v) => setDay(CLOCK[Math.round(v)])} />
          <Busy on={busy} />
          {at && (
            <>
              <div class="readout-grid" style={{ marginTop: 8 }}>
                <Readout label="Extracellular deficit" value={deficit} digits={1} unit="L" tone={deficit > 3 ? 'danger' : deficit > 1 ? 'low' : 'normal'} />
                <Readout label="Equivalent loss" value={pctBlood} digits={0} unit="% of ECF" />
                <Readout label="Mean arterial pressure" value={at.MAP} digits={0} unit="mmHg" tone={at.MAP < 80 ? 'danger' : at.MAP < 88 ? 'low' : 'normal'} />
                <Readout label="Cardiac output" value={0} digits={0} unit="" title="not modelled per beat" />
              </div>
              <p class={deficit < 1 ? 'callout good' : deficit < 3 ? 'callout' : 'callout danger'} style={{ marginTop: 8 }}>
                {deficit < 1
                  ? 'A deficit this size is fully compensated. Rose: a loss of about 10% of blood volume produces no change in blood pressure or pulse at all. There is nothing to find on examination.'
                  : deficit < 3
                    ? 'Now in the range where postural change appears. Rose puts postural hypotension at a loss of 16–25%, and a postural pulse rise of 30 beats per minute or more is the single most useful sign.'
                    : 'A large deficit. Expect resting tachycardia, cool peripheries, oliguria under 15 mL/h and confusion. At about 30% of blood volume this is shock.'}
              </p>
            </>
          )}
        </Panel>
        <Panel title="What each sign is actually worth" note="Measured values from a systematic review of the physical diagnosis of hypovolaemia, not an impression.">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Finding</th>
                  <th>What it is worth</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Postural pulse rise ≥ 30/min, or severe postural dizziness</th>
                  <td>
                    Sensitivity 97% for <em>large</em> blood loss, specificity 98% — but only 22% sensitive for moderate loss
                  </td>
                </tr>
                <tr>
                  <th scope="row">Supine hypotension</th>
                  <td>Sensitivity 33%: frequently absent after losses of up to 1150 mL</td>
                </tr>
                <tr>
                  <th scope="row">Dry axilla</th>
                  <td>Supports hypovolaemia when present: positive likelihood ratio 2.8 (1.4–5.4)</td>
                </tr>
                <tr>
                  <th scope="row">Moist mucous membranes, tongue without furrows</th>
                  <td>Argue against it: negative likelihood ratio 0.3 (0.1–0.6)</td>
                </tr>
                <tr>
                  <th scope="row">Skin turgor</th>
                  <td>
                    <strong>No proven diagnostic value in adults</strong>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Capillary refill time</th>
                  <td>
                    <strong>No proven diagnostic value in adults</strong>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Mild postural dizziness</th>
                  <td>No proven value</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="control-hint">
            The asymmetry is the useful part: a postural pulse rise of 30 or more is close to diagnostic when present, and its absence means very little. In patients with vomiting, diarrhoea or poor
            intake the review found few findings of proven utility at all, and recommends measuring electrolytes, urea and creatinine when certainty is needed.
          </p>
          <Sources cite={{ rose: [14], evidence: 'clinical', refs: ['mcgee1999'] }} />
        </Panel>
      </div>
      <div class="grid grid-2">
        <Panel title="Rose's haemodynamic sequence">
          <Chain
            steps={[
              { text: 'Loss up to ~10% of blood volume', direction: -1 },
              { text: 'Venous constriction and increased cardiac contractility hold output and pressure — no signs' },
              { text: 'Loss of 16–25%', direction: -1 },
              { text: 'Cardiac output falls on standing; postural hypotension and a postural pulse rise appear' },
              { text: 'Loss approaching 30%', direction: -1 },
              { text: 'Resting hypotension, tachycardia, cold clammy skin, urine < 15 mL/h, confusion — shock' },
            ]}
          />
        </Panel>
        <Expand summary="Why the central venous pressure is not the answer either" open>
          <p>
            A low central venous pressure supports hypovolaemia and a high one argues against it, so it is not useless. But as a guide to whether a patient will respond to fluid it performs barely
            better than chance: a meta-analysis of 43 studies found an area under the curve of 0.56 for predicting fluid responsiveness, with no heterogeneity between studies and the same result in
            intensive care and the operating room. Only about 57% of patients were fluid responsive in the first place.
          </p>
          <p class="note" style={{ marginBottom: 0 }}>
            The modern replacements are dynamic: a passive leg raise with a stroke volume measurement, or the respiratory variation in stroke volume. Those ask the question directly — will more
            filling produce more output — instead of inferring it from a pressure.
          </p>
          <Sources cite={{ rose: [14], evidence: 'clinical', refs: ['marik2013cvp'] }} />
        </Expand>
      </div>
      <Predict
        question="An elderly patient has dry mucous membranes, poor skin turgor and sunken eyes. How much does that tell you about their volume status?"
        options={['They are clearly hypovolaemic', 'Rather little — all three fall with age and mouth-breathing independently of volume', 'They need 3 L of saline', 'Nothing at all']}
        correct={1}
        explanation="These are the signs taught first and the ones that perform worst. A postural pulse rise of 30 beats per minute or more, or postural dizziness severe enough to prevent standing, is worth far more — and Rose notes that a normal examination does not exclude a significant deficit."
      />
    </>
  );
}

// ---------------------------------------------------------------- replacement
const FLUIDS: { label: string; patch: ParamPatch; note: string }[] = [
  { label: 'Nothing', patch: {}, note: 'The control. Losses continue.' },
  { label: '0.9% saline, 3 L/day', patch: { ivNS: 3 }, note: 'Isotonic: it stays in the extracellular compartment, which is where the deficit is. 154 mmol/L of both sodium and chloride — more chloride than plasma has.' },
  { label: '0.9% saline, 1.5 L/day', patch: { ivNS: 1.5 }, note: 'Half the rate. Slower correction, and whether that matters depends on how fast the patient is losing.' },
  { label: '5% dextrose, 3 L/day', patch: { ivD5W: 3 }, note: 'The dextrose is metabolised, leaving water. Water distributes across total body water, so only about a third stays extracellular and it dilutes what is there.' },
  { label: 'Half saline, half dextrose', patch: { ivNS: 1.5, ivD5W: 1.5 }, note: 'A compromise, and a reasonable one when free water has been lost as well as salt.' },
];

function Replacement() {
  const [lossIdx, setLossIdx] = useState(0);
  const [fluidIdx, setFluidIdx] = useState(1);
  const l = LOSSES[lossIdx];
  const f = FLUIDS[fluidIdx];
  // Three phases: settle a normal body, lose fluid for three days, then treat while the loss
  // continues. The second run starts from the body the first one ended with — useStep settles its
  // "from" parameters to a steady state, which is not what three days of diarrhoea is.
  const base = useMemo(() => makeParams({ naIntake: 150 }), []);
  const ill = useMemo(() => makeParams({ naIntake: 150, ...l.patch }), [lossIdx]);
  const treated = useMemo(() => makeParams({ naIntake: 150, ...l.patch, ...f.patch }), [lossIdx, fluidIdx]);
  const illCourse = useStep(base, ill, 3, 0.05, 60, 2, 0.25);
  const illBody = illCourse.state?.body;
  const { points, busy } = useCourse(treated, 3, 0.05, illBody);
  const normal = NORMAL();
  const start = illCourse.points?.[illCourse.points.length - 1];
  const end = illBody && points ? points[points.length - 1] : undefined;

  return (
    <>
      <div class="grid grid-2">
        <Panel title="The patient" note="Three days of loss first, then the fluid is started while the loss continues.">
          <div class="btn-row" style={{ marginBottom: 8 }}>
            {LOSSES.slice(0, 5).map((x, i) => (
              <button key={x.label} class={i === lossIdx ? 'active' : ''} onClick={() => setLossIdx(i)}>
                {x.label}
              </button>
            ))}
          </div>
          <Busy on={illCourse.busy} />
          {start && (
            <div class="readout-grid">
              <Readout label="Extracellular volume" value={start.ecf} digits={1} unit="L" tone={start.ecf < normal.derived.ecfLiters - 1 ? 'low' : 'normal'} />
              <Readout label="Plasma Na⁺" value={start.Na} digits={1} unit="mmol/L" tone={start.Na < 135 ? 'low' : start.Na > 145 ? 'high' : 'normal'} />
              <Readout label="Bicarbonate" value={start.HCO3} digits={1} unit="mmol/L" tone={start.HCO3 < 22 ? 'low' : start.HCO3 > 28 ? 'high' : 'normal'} />
              <Readout label="Creatinine" value={si.creat(start.creat)} digits={0} unit="µmol/L" tone={si.creat(start.creat) > 110 ? 'high' : 'normal'} />
            </div>
          )}
        </Panel>
        <Panel title="The fluid">
          <div class="btn-row" style={{ marginBottom: 8 }}>
            {FLUIDS.map((x, i) => (
              <button key={x.label} class={i === fluidIdx ? 'active' : ''} onClick={() => setFluidIdx(i)}>
                {x.label}
              </button>
            ))}
          </div>
          <p class="note">{f.note}</p>
          <Busy on={busy} />
          {end && start && (
            <div class="readout-grid">
              <Readout label="Extracellular volume" value={end.ecf} digits={1} unit="L" delta={end.ecf - start.ecf} deltaDigits={1} tone={Math.abs(end.ecf - normal.derived.ecfLiters) < 0.8 ? 'good' : end.ecf < normal.derived.ecfLiters ? 'low' : 'high'} />
              <Readout label="Plasma Na⁺" value={end.Na} digits={1} unit="mmol/L" delta={end.Na - start.Na} deltaDigits={1} tone={end.Na < 135 ? 'low' : end.Na > 145 ? 'high' : 'normal'} />
              <Readout label="Bicarbonate" value={end.HCO3} digits={1} unit="mmol/L" delta={end.HCO3 - start.HCO3} deltaDigits={1} tone={end.HCO3 < 20 ? 'low' : 'normal'} />
              <Readout label="Creatinine" value={si.creat(end.creat)} digits={0} unit="µmol/L" delta={si.creat(end.creat) - si.creat(start.creat)} deltaDigits={0} tone={si.creat(end.creat) > 110 ? 'high' : 'good'} />
              <Readout label="Renin" value={end.renin} digits={2} unit="×normal" tone={end.renin > 2 ? 'high' : 'good'} />
              <Readout label="Urine Na⁺" value={end.urineNa / Math.max(end.urineVolume, 0.01)} digits={0} unit="mmol/L" tone={end.urineNa / Math.max(end.urineVolume, 0.01) < 25 ? 'low' : 'normal'} />
            </div>
          )}
        </Panel>
      </div>
      {end && start && (
        <p class={Math.abs(end.ecf - normal.derived.ecfLiters) < 0.8 ? 'callout good' : 'callout danger'}>
          {fluidIdx === 3 ? (
            <>
              <strong>Dextrose does not restore extracellular volume.</strong> Three litres a day of free water raised the extracellular volume by only {(end.ecf - start.ecf).toFixed(1)} L, because
              water distributes across total body water — roughly two-thirds of it went into cells. Note what it did to the plasma sodium ({start.Na.toFixed(0)} → {end.Na.toFixed(0)} mmol/L) and to
              the renin, which is still {end.renin.toFixed(1)}× normal. Sodium is what holds fluid in the extracellular compartment; a fluid without it treats water deficit, not volume deficit.
            </>
          ) : Math.abs(end.ecf - normal.derived.ecfLiters) < 0.8 ? (
            <>
              Volume restored: the extracellular volume is back to {end.ecf.toFixed(1)} L and renin has fallen to {end.renin.toFixed(1)}× normal. The kidney has stopped behaving as though depleted,
              which is the endpoint that matters.
            </>
          ) : (
            <>
              Still {(normal.derived.ecfLiters - end.ecf).toFixed(1)} L short, with renin at {end.renin.toFixed(1)}× normal. The loss is continuing, so replacement has to cover both the existing
              deficit and the ongoing losses.
            </>
          )}
        </p>
      )}
      <div class="grid grid-2">
        <Panel title="Three days of treatment">
          <Busy on={busy || illCourse.busy} />
          {points && illBody && (
            <>
              <LineChart
                xLabel="days of treatment"
                series={[
                  { label: 'Extracellular volume (L)', points: points.map((p) => ({ x: p.day, y: p.ecf })), color: '#6aa9e8' },
                  { label: 'Normal', points: points.map((p) => ({ x: p.day, y: normal.derived.ecfLiters })), color: '#8aa4b8' },
                ] as Series[]}
                height={160}
              />
              <LineChart
                xLabel="days of treatment"
                series={[{ label: 'Renin (×normal)', points: points.map((p) => ({ x: p.day, y: p.renin })), color: '#f2b134' }] as Series[]}
                yMin={0}
                height={150}
              />
              <LineChart
                xLabel="days of treatment"
                series={[{ label: 'Plasma Na⁺ (mmol/L)', points: points.map((p) => ({ x: p.day, y: p.Na })), color: '#7bc47f' }] as Series[]}
                height={150}
              />
            </>
          )}
        </Panel>
        <div>
          <Panel title="Choosing the fluid">
            <ul style={{ paddingLeft: 18, lineHeight: 1.8 }}>
              <li>
                <strong>Match what was lost.</strong> Isotonic saline for a salt-and-water loss; free water for a pure water deficit; potassium and bicarbonate where those went too.
              </li>
              <li>
                <strong>Sodium is what keeps fluid extracellular.</strong> That is the whole reason dextrose fails here, and it is worth seeing rather than memorising — try it above.
              </li>
              <li>
                <strong>Cover the ongoing losses as well as the deficit.</strong> The scenarios here keep losing while the fluid runs, which is why some of them never quite catch up.
              </li>
              <li>
                <strong>Correct the composition too.</strong> Saline worsens the acidosis of diarrhoea a little, by adding chloride; it is exactly right for the alkalosis of vomiting, which is
                chloride-responsive.
              </li>
            </ul>
          </Panel>
          <Expand summary="Saline versus balanced solutions, since the book was written" open>
            <p>
              Rose treats isotonic saline as the default. Its chloride content, 154 mmol/L, is well above plasma, and large volumes produce a hyperchloraemic acidosis. Two large trials have compared
              it with balanced solutions and they disagree.
            </p>
            <p>
              SMART randomised 15,802 critically ill adults at one centre and found fewer major adverse kidney events with balanced crystalloid — 14.3% against 15.4%, odds ratio 0.91 — significant
              but small, and driven by the composite rather than mortality. PLUS randomised 5,037 patients across 53 intensive care units, double-blind, and found no difference in 90-day mortality
              (21.8% vs 22.0%) or in renal replacement therapy.
            </p>
            <p class="note" style={{ marginBottom: 0 }}>
              The physiological argument for avoiding a large chloride load is sound and balanced solutions have become the usual default. The size of any clinical benefit remains genuinely uncertain,
              and it would be wrong to present either trial as having settled it.
            </p>
            <Sources cite={{ refs: ['semler2018', 'finfer2022plus'], evidence: 'clinical' }} />
          </Expand>
        </div>
      </div>
      <Predict
        question="A patient is 3 L extracellular-fluid depleted after diarrhoea. They are given 3 L/day of 5% dextrose. What happens to the extracellular volume?"
        options={['It is fully restored', 'It rises by roughly a third of what was given, and the plasma sodium falls', 'It falls further', 'It rises by more than 3 L']}
        correct={1}
        explanation="Dextrose is metabolised and leaves water, which distributes across total body water. About two-thirds enters cells. Select it above and watch the renin stay high — the kidney is not fooled."
      />
    </>
  );
}
