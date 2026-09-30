import { useState } from 'preact/hooks';
import { PageHead, FiveQuestions, Related, Busy, useTabParam } from '../ui/page';
import { Panel, Readout, Slider, Sources, Predict, Tabs, Chain, Expand, toneFor } from '../ui/kit';
import { makeParams, useSteady, useStep } from '../sim/hooks';
import { si } from '../units';

const TAB_IDS = ['stage', 'course'] as const;
type Tab = (typeof TAB_IDS)[number];
const TABS: { id: Tab; label: string }[] = [
  { id: 'stage', label: 'Stage & category' },
  { id: 'course', label: 'The course of ATN' },
];

// KDIGO staging on the creatinine criterion (the urine-output criterion is shown separately).
function kdigoStage(ratio: number) {
  if (ratio >= 3) return { s: 'Stage 3', tone: 'danger' as const, note: '≥ 3× baseline (or ≥ 354 µmol/L, or dialysis)' };
  if (ratio >= 2) return { s: 'Stage 2', tone: 'danger' as const, note: '2–3× baseline' };
  if (ratio >= 1.5) return { s: 'Stage 1', tone: 'high' as const, note: '1.5–1.9× baseline (or ≥ 26.5 µmol/L rise in 48 h)' };
  return { s: 'No AKI', tone: 'normal' as const, note: 'creatinine at baseline' };
}

// ---------------------------------------------------------------- stage & category

function StageTab() {
  const [injury, setInjury] = useState(0.6);
  const base = useSteady(makeParams(), 30);
  const sick = useStep(makeParams(), makeParams({ tubularInjury: injury }), 5, 0.1, 40, 2, 0.25);
  const now = sick.final;
  const baseCr = base.ev?.body.creat ?? 0.9;
  const ratio = now ? now.body.creat / baseCr : 1;
  const st = kdigoStage(ratio);
  const uv = now?.kidney.urine.volumePerDay ?? 1.5;
  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="An ischaemic or toxic insult" note="Increase the tubular injury and watch the creatinine climb through the KDIGO stages over the days that follow.">
            <Busy on={sick.busy || base.busy} />
            <Slider label="Tubular injury" value={injury} min={0} max={0.95} step={0.05} onInput={setInjury} format={(v) => `${(v * 100).toFixed(0)}%`} />
            {now && (
              <div class="readout-grid">
                <Readout label="KDIGO stage" value={st.s} tone={st.tone} refRange={st.note} />
                <Readout label="Creatinine" value={si.creat(now.body.creat)} digits={0} unit="µmol/L" tone={ratio > 1.5 ? 'high' : 'normal'} refRange={`${ratio.toFixed(1)}× baseline`} />
                <Readout label="eGFR" value={now.derived.eGFR} digits={0} unit="mL/min/1.73m²" tone={now.derived.eGFR < 30 ? 'danger' : 'high'} />
                <Readout label="Urine output" value={uv} digits={1} unit="L/day" tone={uv < 0.5 ? 'danger' : uv < 1 ? 'high' : 'normal'} refRange={uv < 0.4 ? 'oliguric' : 'non-oliguric'} />
              </div>
            )}
            <p class="note" style={{ marginBottom: 0 }}>
              KDIGO stages AKI on whichever is worse: the creatinine rise or the urine output (&lt; 0.5 mL/kg/h). A patient can be staged on either — and non-oliguric ATN carries a better prognosis than oliguric.
            </p>
          </Panel>
          <Panel title="The three questions in order">
            <Chain
              steps={[
                { text: 'Is it obstructed? — a bladder scan and imaging; post-renal is the reversible one to catch first', direction: 0 },
                { text: 'Is it pre-renal? — volume status, the urine indices; restore perfusion and it recovers', direction: 1 },
                { text: 'Is it intrinsic? — ATN, glomerulonephritis, interstitial nephritis, vascular; the urine tells which', direction: -1 },
              ]}
            />
            <Sources cite={{ rose: [2, 13, 14], evidence: 'clinical', refs: ['kellum2013aki', 'kellum2021'] }} />
          </Panel>
        </div>
        <div>
          <Panel title="Where the injury is">
            <div class="table-wrap"><table>
              <thead><tr><th>Category</th><th>Cause</th><th>Urine Na / FENa</th><th>Urine</th></tr></thead>
              <tbody>
                <tr><td><strong>Pre-renal</strong></td><td>Hypoperfusion</td><td>Low (&lt; 1%)</td><td>Concentrated</td></tr>
                <tr><td><strong>Intrinsic (ATN)</strong></td><td>Ischaemia, toxins</td><td>High (&gt; 2%)</td><td>Isosthenuric, muddy casts</td></tr>
                <tr><td><strong>Post-renal</strong></td><td>Obstruction</td><td>Variable</td><td>Variable</td></tr>
              </tbody>
            </table></div>
            <p class="muted" style={{ fontSize: '0.85rem', marginBottom: 0 }}>The distinction between pre-renal and ATN — and the traps in the indices — has its own page.</p>
          </Panel>
          <Panel title="Why the creatinine lags">
            <p class="muted" style={{ fontSize: '0.9rem', marginTop: 0, lineHeight: 1.7 }}>
              When the GFR falls abruptly, the creatinine has not yet risen to its new steady state — it climbs over days as production keeps exceeding excretion. So early in AKI the creatinine <em>understates</em> the loss of function, and a single value cannot tell you how fast the GFR is falling. This is why AKI is defined by the <em>change</em> in creatinine, not a threshold, and why newer biomarkers of injury are being sought.
            </p>
            <Sources cite={{ rose: [2], evidence: 'physiology', refs: ['bonventre2011'] }} />
          </Panel>
        </div>
      </div>
      <Predict
        question="A patient's creatinine is 110 µmol/L and rising fast, having been 70 two days ago. The eGFR calculator reports 65 mL/min. What is the true GFR likely to be?"
        options={['About 65 — trust the calculator', 'Much lower — the creatinine has not yet caught up with a GFR that is still falling', 'Normal', 'Higher than 65']}
        correct={1}
        explanation="Estimating equations assume a steady state. In evolving AKI the creatinine is still climbing toward equilibrium, so the real GFR is well below what today's creatinine implies. Trend the value; do not trust a single eGFR."
      />
    </>
  );
}

// ---------------------------------------------------------------- course

function CourseTab() {
  const [phase, setPhase] = useState(1);
  // Three snapshots along the course, as static states the engine can hold.
  const runs = [
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useSteady(makeParams({ diarrhea: 2, waterIntake: 1.2, naIntake: 60 }), 20), // pre-renal / initiation
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useSteady(makeParams({ tubularInjury: 0.8 }), 20), // maintenance / established ATN
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useSteady(makeParams({ tubularInjury: 0.35 }), 20), // recovery
  ];
  const e = runs[phase].ev;
  const busy = runs.some((r) => r.busy);
  const PHASES = ['Initiation (pre-renal)', 'Maintenance (established ATN)', 'Recovery'];
  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="The phases of acute tubular necrosis" note="Classically three: the insult, a plateau of low GFR that lasts one to three weeks, and a recovery in which the tubules work before they concentrate.">
            <Busy on={busy} />
            <div class="btn-row" style={{ marginBottom: 8 }}>
              {PHASES.map((p, i) => (
                <button key={p} class={i === phase ? 'active' : ''} onClick={() => setPhase(i)}>{p}</button>
              ))}
            </div>
            {e && (
              <div class="readout-grid">
                <Readout label="GFR" value={e.kidney.GFR} digits={0} unit="mL/min" tone={e.kidney.GFR < 30 ? 'danger' : e.kidney.GFR < 80 ? 'high' : 'normal'} />
                <Readout label="Urine output" value={e.kidney.urine.volumePerDay} digits={1} unit="L/day" tone={e.kidney.urine.volumePerDay < 0.5 ? 'danger' : e.kidney.urine.volumePerDay > 3 ? 'high' : 'normal'} />
                <Readout label="Urine Na" value={e.kidney.urine.Na} digits={0} unit="mmol/L" tone={e.kidney.urine.Na > 40 ? 'high' : 'low'} />
                <Readout label="FENa" value={e.derived.FENa} digits={1} unit="%" tone={e.derived.FENa > 2 ? 'high' : 'low'} />
                <Readout label="Potassium" value={e.plasma.K} digits={1} unit="mmol/L" tone={toneFor(e.plasma.K, 3.5, 5.0, [3, 6])} />
                <Readout label="Bicarbonate" value={e.plasma.HCO3} digits={0} unit="mmol/L" tone={toneFor(e.plasma.HCO3, 22, 28)} />
              </div>
            )}
          </Panel>
          <Panel title="What each phase is">
            <ul class="muted" style={{ fontSize: '0.9rem', marginTop: 0, lineHeight: 1.7 }}>
              <li><strong>Initiation.</strong> Hypoperfusion or a toxin; still reversible. The tubules are conserving sodium (pre-renal indices) — restore perfusion now and ATN may be averted.</li>
              <li><strong>Maintenance.</strong> The tubules are injured: sodium-rich, isosthenuric urine, often oliguria, and the complications accumulate — hyperkalaemia, acidosis, volume overload, uraemia — over one to three weeks.</li>
              <li><strong>Recovery.</strong> The tubules regenerate. Filtration returns before concentrating ability, so there may be a brief polyuric phase with ongoing solute and water loss to watch.</li>
            </ul>
            <Sources cite={{ rose: [2, 14], evidence: 'clinical', refs: ['bonventre2011', 'kellum2021'] }} />
          </Panel>
        </div>
        <div>
          <Panel title="The danger is in the maintenance phase">
            <p class="muted" style={{ fontSize: '0.9rem', marginTop: 0, lineHeight: 1.7 }}>
              Nothing so far shortens established ATN; management is supportive and aimed at surviving the complications until the tubules recover. Watch and treat:
            </p>
            <ul class="muted" style={{ fontSize: '0.9rem', lineHeight: 1.7 }}>
              <li><strong>Hyperkalaemia</strong> — the most immediately lethal, especially with tissue breakdown; worse in oliguria.</li>
              <li><strong>Volume overload</strong> — no urine to clear the fluids given; pulmonary oedema.</li>
              <li><strong>Metabolic acidosis</strong> — the daily acid load is retained.</li>
              <li><strong>Uraemia</strong> — pericarditis, encephalopathy, bleeding: indications for dialysis.</li>
            </ul>
            <p class="muted" style={{ fontSize: '0.9rem', lineHeight: 1.7, marginBottom: 0 }}>
              Dialysis buys time for recovery; it does not treat the tubules. Avoid further insults — nephrotoxins, contrast, hypotension.
            </p>
          </Panel>
        </div>
      </div>
      <Predict
        question="A patient recovering from ATN starts passing 4 litres of urine a day. What is the main risk?"
        options={['The kidney is failing again', 'Volume depletion and potassium and magnesium loss — the tubules filter before they can concentrate or reabsorb well', 'Nothing, it means full recovery', 'Obstruction']}
        correct={1}
        explanation="In the recovery (polyuric) phase, filtration returns faster than tubular reabsorption and concentrating ability, and retained urea and salt drive an osmotic diuresis. Replace the losses and monitor electrolytes until concentrating ability returns."
      />
      <Expand summary="What the model shows here">
        <p class="muted" style={{ fontSize: '0.88rem' }}>
          The three buttons are steady states the engine can hold — a pre-renal picture, established injury, and partial recovery — not a single continuous run, because the model does not regenerate tubules over time. They let you read the urine indices and the systemic complications that define each phase; the recovery polyuria itself is described rather than simulated.
        </p>
      </Expand>
    </>
  );
}

// ----------------------------------------------------------------

export default function Aki({ query }: { query: URLSearchParams }) {
  const [tab, setTab] = useTabParam('/aki', TAB_IDS, 'stage', query);
  return (
    <div>
      <PageHead
        path="/aki"
        lede="Acute kidney injury is a fall in GFR over hours to days, read from a rising creatinine or a falling urine output. The first job is anatomical — is it pre-renal, intrinsic, or obstructed? — because the reversible causes must be caught early; the second is to survive the complications of the ones that are not."
      />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'stage' && <StageTab />}
      {tab === 'course' && <CourseTab />}
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>The GFR matches excretion to intake from minute to minute; the creatinine sits at a steady level set by the balance of production and clearance.</p>}
          why={<p>A fall in GFR — from hypoperfusion, tubular injury or obstruction — lets creatinine and the daily solute, acid and potassium loads accumulate.</p>}
          change={<p>Restore perfusion or relieve obstruction and a pre-renal or post-renal kidney recovers; injured tubules must regenerate on their own time.</p>}
          abnormal={<p>Rising creatinine, oliguria, hyperkalaemia, metabolic acidosis, volume overload and the uraemic syndrome; staged by KDIGO on creatinine and urine output.</p>}
          clinical={<p>Exclude obstruction, correct perfusion, stop nephrotoxins; support through the maintenance phase and dialyse for refractory hyperkalaemia, volume overload, acidosis or uraemia.</p>}
        />
        <Sources cite={{ rose: [2, 13, 14], evidence: 'clinical', refs: ['kellum2013aki', 'kellum2021', 'bonventre2011'] }} />
      </Panel>
      <Related paths={['/prerenal-atn', '/obstruction', '/creatinine', '/fractional-excretion', '/hyperkalemia', '/ckd']} />
    </div>
  );
}
