import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, Related, Busy, Toggle } from '../ui/page';
import { Panel, Slider, Sources, Predict, Chain, Expand, LineChart, type Series } from '../ui/kit';
import { makeParams, useStep } from '../sim/hooks';
import type { ParamPatch } from '../engine/types';
import { si } from '../units';

/**
 * Two patients, side by side, at the same moment after the same insult. Both are run from the same
 * settled body, so every difference between the columns is the difference between their kidneys.
 */
interface Arm {
  id: string;
  label: string;
  patch: ParamPatch;
  truth: 'prerenal' | 'atn';
  note: string;
}

const PURE: Arm[] = [
  {
    id: 'prerenal',
    label: 'Pre-renal',
    patch: { diarrhea: 2.2, waterIntake: 1.2, naIntake: 60 },
    truth: 'prerenal',
    note: 'Volume depletion from gastrointestinal loss. The tubules are untouched and behave perfectly: they conserve sodium and concentrate the urine.',
  },
  {
    id: 'atn',
    label: 'Acute tubular necrosis',
    patch: { tubularInjury: 0.75 },
    truth: 'atn',
    note: 'Ischaemic or toxic tubular injury. The tubules can neither reabsorb the filtered sodium nor respond to ADH, so the urine is sodium-rich and isosthenuric.',
  },
];

const CONFOUNDED: Arm[] = [
  {
    id: 'atnHf',
    label: 'ATN on heart failure',
    patch: { tubularInjury: 0.7, cardiacFunction: 0.42 },
    truth: 'atn',
    note: 'Injured tubules, but an intense volume signal. FENa reads pre-renal. Rose lists cirrhosis, heart failure and burns as the settings where this happens.',
  },
  {
    id: 'prerenalDiuretic',
    label: 'Pre-renal, on a diuretic',
    patch: { diarrhea: 2.2, waterIntake: 1.2, naIntake: 60, drugs: { furosemide: 0.7 } },
    truth: 'prerenal',
    note: 'Genuinely volume depleted, but the drug forces sodium out. FENa is uninterpretable; FEurea is less affected but not clean.',
  },
  {
    id: 'ckdAtn',
    label: 'ATN on advanced CKD',
    patch: { tubularInjury: 0.5, nephronFraction: 0.2 },
    truth: 'atn',
    note: 'A small filtered load means a high FENa whatever the tubules are doing, so the index cannot add anything here.',
  },
  {
    id: 'contrast',
    label: 'Contrast nephropathy',
    patch: { tubularInjury: 0.45, afferentTone: 1.6 },
    truth: 'atn',
    note: 'Rose lists contrast and pigment injury as tubular injury that nonetheless gives a low FENa, because intense renal vasoconstriction dominates the picture.',
  },
];

const CLOCK = [0.25, 0.5, 1, 2, 3, 5];

export default function PrerenalAtn() {
  const [day, setDay] = useState(0.25);
  const [showConfounded, setShowConfounded] = useState(false);
  const arms = showConfounded ? [...PURE, ...CONFOUNDED] : PURE;

  return (
    <div>
      <PageHead
        path="/prerenal-atn"
        lede="Two causes of a rising creatinine that look the same from outside: a kidney that is underperfused but intact, and one whose tubules are damaged. The urine tells them apart when the difference is clean — and Rose is careful to say how often it is not."
      />
      <div class="grid grid-2">
        <Panel title="The distinction" note="Both are run from the same normal body, so every difference is the kidney.">
          <Slider
            label="Time since the insult"
            value={CLOCK.indexOf(day) >= 0 ? CLOCK.indexOf(day) : 2}
            min={0}
            max={CLOCK.length - 1}
            step={1}
            format={() => (day < 1 ? `${Math.round(day * 24)} h` : `day ${day}`)}
            onInput={(v) => setDay(CLOCK[Math.round(v)])}
            hint="these indices are read early, before the kidney has re-equilibrated"
          />
          <p class="control-hint">
            Move it. The indices are not fixed properties of the two diseases — they drift over the first days as body composition shifts, and a single measurement can catch either patient at an
            unrepresentative moment.
          </p>
          <Toggle label="Add the cases where it fails" checked={showConfounded} onChange={setShowConfounded} hint="Rose's exceptions, run in the same model" />
        </Panel>
        <Panel title="Why they differ at all">
          <Chain
            steps={[
              { text: 'Both have a fallen GFR and a rising creatinine' },
              { text: 'Pre-renal: perfusion is low, tubules intact', direction: 1 },
              { text: '→ maximal Na⁺ reabsorption and maximal ADH response' },
              { text: 'ATN: perfusion may be adequate, tubules are not', direction: -1 },
              { text: '→ Na⁺ escapes and the urine cannot be concentrated' },
            ]}
          />
          <p class="control-hint">
            The urine indices are not tests of perfusion or of damage directly. They test whether the tubules are still doing what an intense volume signal is telling them to do.
          </p>
        </Panel>
      </div>
      <Panel title={`Side by side — ${day < 1 ? `${Math.round(day * 24)} hours` : `day ${day}`} after the insult`}>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th />
                {arms.map((a) => (
                  <th key={a.id}>{a.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Rows arms={arms} day={day} />
            </tbody>
          </table>
        </div>
        <p class="control-hint" style={{ marginTop: 8 }}>
          Rose's thresholds: urine Na⁺ under 20 mmol/L, FENa under 1% and urine osmolality above 500 favour pre-renal; urine Na⁺ over 40, FENa over 2% and an isosthenuric urine near 300 favour tubular
          injury. The urea:creatinine ratio is raised in pre-renal disease because hypovolaemia-driven sodium and water reabsorption carries urea with it — and up to a third of the rise is increased
          urea production rather than reduced clearance.
        </p>
      </Panel>
      {showConfounded && (
        <p class="callout danger">
          Four of these six rows are settings Rose names explicitly, and in each of them at least one index points the wrong way. That is the point of the page: the indices are evidence about the
          volume signal, and anything that changes the volume signal independently of the tubules — heart failure, a diuretic, a small filtered load, renal vasoconstriction — breaks them.
        </p>
      )}
      <div class="grid grid-2">
        <Panel title="How the two evolve" note="Pre-renal disease that is not corrected becomes tubular injury. There is no sharp line in time either.">
          <Evolution />
        </Panel>
        <Panel title="What actually settles it">
          <ul style={{ paddingLeft: 18, lineHeight: 1.8 }}>
            <li>
              <strong>The response to volume repletion.</strong> Pre-renal azotaemia improves within 24–72 hours of restoring the volume; established tubular injury does not. This is the only test
              that addresses the question directly, and it is the reason the distinction is often made retrospectively.
            </li>
            <li>
              <strong>The sediment.</strong> Pre-renal disease gives a bland sediment or hyaline casts; tubular injury gives granular and epithelial cell casts. This is independent of the volume
              signal, which is exactly why it survives the confounders above.
            </li>
            <li>
              <strong>The history.</strong> An obvious source of loss, a hypotensive episode, a contrast exposure or a nephrotoxin usually tells you more than any index.
            </li>
          </ul>
          <p class="note" style={{ marginBottom: 0 }}>
            Rose does not offer a number that separates them reliably, and this model cannot either. Treat the urine indices as one piece of evidence about effective circulating volume.
          </p>
        </Panel>
      </div>
      <div class="grid grid-2">
        <Predict
          question="A patient with cirrhosis develops acute kidney injury. FENa is 0.3%. Does that exclude tubular necrosis?"
          options={['Yes, FENa under 1% means pre-renal', 'No — ATN superimposed on chronic effective volume depletion characteristically gives a low FENa', 'Only if the urine osmolality is high', 'Yes, unless a diuretic was given']}
          correct={1}
          explanation="Turn on the confounded cases above. Cirrhosis, heart failure and burns all produce a volume signal intense enough to hold FENa below 1% through damaged tubules. The sediment and the response to volume are what help here."
        />
        <Predict
          question="Which finding is least disturbed by heart failure, a diuretic and advanced CKD?"
          options={['Urine sodium', 'FENa', 'The urinary sediment', 'Urine osmolality']}
          correct={2}
          explanation="All three of the others are read through the volume signal, which those conditions change independently of the tubules. Granular and epithelial cell casts are a direct observation of tubular injury."
        />
      </div>
      <Expand summary="Rose's exceptions in full">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Setting</th>
                <th>What happens</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">ATN on cirrhosis, heart failure, burns</th>
                <td>FENa under 1% despite established tubular injury — the volume signal overrides it</td>
              </tr>
              <tr>
                <th scope="row">Contrast or pigment nephropathy</th>
                <td>Low FENa, because intense renal vasoconstriction dominates the early picture</td>
              </tr>
              <tr>
                <th scope="row">Diuretics</th>
                <td>FENa raised in a genuinely hypovolaemic patient; FEurea or urate are offered instead, imperfectly</td>
              </tr>
              <tr>
                <th scope="row">Advanced CKD</th>
                <td>FENa above 2% at baseline — the threshold has moved with the filtered load</td>
              </tr>
              <tr>
                <th scope="row">Acute glomerulonephritis, early obstruction</th>
                <td>Avid sodium retention with a low urine Na⁺ although the cause is not volume depletion</td>
              </tr>
              <tr>
                <th scope="row">Non-oliguric ATN</th>
                <td>Milder injury; the indices are less deranged and overlap more</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Expand>
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>Neither state is normal. In health the kidney conserves sodium when volume falls and concentrates urine when ADH rises, which is exactly the behaviour the indices test for.</p>}
          why={<p>In pre-renal disease the tubules are intact and obey an intense volume signal. In tubular injury they cannot, so filtered sodium escapes and the urine stays near plasma osmolality.</p>}
          change={<p>Anything that changes the volume signal independently of the tubules changes the indices without changing the diagnosis: heart failure, cirrhosis, a diuretic, renal vasoconstriction, a small filtered load.</p>}
          abnormal={<p>Sustained pre-renal disease becomes ischaemic tubular injury. There is no sharp boundary in time, and often no sharp boundary in the numbers either.</p>}
          clinical={<p>Use the history, the sediment and the response to volume repletion. The indices support that judgement; they do not replace it.</p>}
        />
        <Sources cite={{ rose: [13, 14, 2], evidence: 'clinical', refs: ['espinel1976', 'miller1978', 'carvounis2002', 'perazella2012'] }} />
      </Panel>
      <Related paths={['/urine-chemistry', '/fractional-excretion', '/aki', '/hypovolemia', '/creatinine']} />
    </div>
  );
}

const ALL_ARMS = [...PURE, ...CONFOUNDED];

/**
 * One row per measurement, one column per arm. Every arm's course is computed unconditionally —
 * the number of hooks a component calls cannot depend on a toggle — and the display is sliced
 * afterwards. Each arm is a separate worker job, so they run in parallel.
 */
function Rows({ arms, day }: { arms: Arm[]; day: number }) {
  const base = useMemo(() => makeParams({ naIntake: 150 }), []);
  const courses = [
    useStep(base, useMemo(() => makeParams({ naIntake: 150, ...ALL_ARMS[0].patch }), []), 5, 0.021, 60, 2, 0.25),
    useStep(base, useMemo(() => makeParams({ naIntake: 150, ...ALL_ARMS[1].patch }), []), 5, 0.021, 60, 2, 0.25),
    useStep(base, useMemo(() => makeParams({ naIntake: 150, ...ALL_ARMS[2].patch }), []), 5, 0.021, 60, 2, 0.25),
    useStep(base, useMemo(() => makeParams({ naIntake: 150, ...ALL_ARMS[3].patch }), []), 5, 0.021, 60, 2, 0.25),
    useStep(base, useMemo(() => makeParams({ naIntake: 150, ...ALL_ARMS[4].patch }), []), 5, 0.021, 60, 2, 0.25),
    useStep(base, useMemo(() => makeParams({ naIntake: 150, ...ALL_ARMS[5].patch }), []), 5, 0.021, 60, 2, 0.25),
  ];

  const shown = arms.map((a) => {
    const i = ALL_ARMS.findIndex((x) => x.id === a.id);
    const pts = courses[i].points;
    const p = pts?.length ? pts.reduce((best, q) => (Math.abs(q.day - day) < Math.abs(best.day - day) ? q : best), pts[0]) : undefined;
    return { arm: a, p };
  });

  const tone = (says: string | null, truth: string) => (says ? { color: says === truth ? 'var(--good)' : 'var(--danger)' } : undefined);

  const row = (label: string, render: (p: NonNullable<(typeof shown)[number]['p']>, arm: Arm) => preact.ComponentChildren, hint?: string) => (
    <tr key={label}>
      <th scope="row" title={hint}>
        {label}
      </th>
      {shown.map((s) => (
        <td key={s.arm.id} class="mono">
          {s.p ? render(s.p, s.arm) : <Busy on />}
        </td>
      ))}
    </tr>
  );

  return (
    <>
      {row('Urine Na⁺ (mmol/L)', (p, arm) => {
        const v = p.urineNa / Math.max(p.urineVolume, 0.01);
        return <span style={tone(v < 20 ? 'prerenal' : v > 40 ? 'atn' : null, arm.truth)}>{v.toFixed(0)}</span>;
      })}
      {row('FENa (%)', (p, arm) => <span style={tone(p.fena < 1 ? 'prerenal' : p.fena > 2 ? 'atn' : null, arm.truth)}>{p.fena.toFixed(2)}</span>)}
      {row('FEurea (%)', (p, arm) => <span style={tone(p.feurea < 35 ? 'prerenal' : p.feurea > 50 ? 'atn' : null, arm.truth)}>{p.feurea.toFixed(0)}</span>, 'offered when a diuretic has made FENa useless')}
      {row('Urine osmolality (mOsm/kg)', (p, arm) => (
        <span style={tone(p.urineOsm > 500 ? 'prerenal' : p.urineOsm < 350 ? 'atn' : null, arm.truth)}>{p.urineOsm.toFixed(0)}</span>
      ))}
      {row('Urine volume (L/day)', (p) => p.urineVolume.toFixed(2))}
      {row('Creatinine (µmol/L)', (p) => si.creat(p.creat).toFixed(0))}
      {row('Urea (mmol/L)', (p) => si.urea(p.BUN).toFixed(1))}
      {row('Urea : creatinine (SI)', (p) => si.ureaCreatRatio(p.BUN, p.creat).toFixed(0), 'raised above ~80 in pre-renal azotaemia')}
      {row('GFR (mL/min)', (p) => p.GFR.toFixed(0))}
      <tr>
        <th scope="row">Truth</th>
        {shown.map((s) => (
          <td key={s.arm.id} title={s.arm.note}>
            <strong style={{ color: s.arm.truth === 'prerenal' ? 'var(--accent)' : 'var(--danger)' }}>{s.arm.truth === 'prerenal' ? 'Pre-renal' : 'Tubular injury'}</strong>
          </td>
        ))}
      </tr>
      <tr>
        <th scope="row">Why</th>
        {shown.map((s) => (
          <td key={s.arm.id} style={{ fontSize: '0.8rem', color: 'var(--ink-dim)' }}>
            {s.arm.note}
          </td>
        ))}
      </tr>
    </>
  );
}

/** Untreated pre-renal disease becoming tubular injury. */
function Evolution() {
  const base = useMemo(() => makeParams({ naIntake: 150 }), []);
  const worsening = useMemo(() => makeParams({ naIntake: 20, diarrhea: 3, waterIntake: 0.8 }), []);
  const { points, busy } = useStep(base, worsening, 6, 0.05, 60, 2, 0.25);
  return (
    <>
      <Busy on={busy} />
      {points && (
        <>
          <LineChart
            xLabel="days of uncorrected volume depletion"
            series={[
              { label: 'FENa (%)', points: points.map((p) => ({ x: p.day, y: p.fena })), color: '#f2b134' },
              { label: 'GFR ÷ 30 (mL/min)', points: points.map((p) => ({ x: p.day, y: p.GFR / 30 })), color: '#6aa9e8' },
              { label: 'Creatinine ÷ 50 (µmol/L)', points: points.map((p) => ({ x: p.day, y: si.creat(p.creat) / 50 })), color: '#e07b6a' },
            ] as Series[]}
            yMin={0}
            height={200}
          />
          <p class="control-hint">
            FENa stays low and the urine stays concentrated while the tubules are intact, even as the GFR falls and the creatinine climbs. The model has no mechanism for ischaemia to become injury —
            tubular damage is a parameter here, not a consequence — so this shows the pre-renal half of the story only. In a patient, sustained hypoperfusion eventually produces the injury, and the
            indices then cross over.
          </p>
        </>
      )}
    </>
  );
}
