import { useState } from 'preact/hooks';
import { PageHead, FiveQuestions, Related, Busy, Toggle, useTabParam } from '../ui/page';
import { Panel, Readout, Slider, Sources, Predict, Tabs, Chain, LineChart, Expand, toneFor, type Series } from '../ui/kit';
import { makeParams, useSteady } from '../sim/hooks';
import { si } from '../units';

const TAB_IDS = ['stages', 'systemic', 'progression'] as const;
type Tab = (typeof TAB_IDS)[number];
const TABS: { id: Tab; label: string }[] = [
  { id: 'stages', label: 'Stages & the intact nephron' },
  { id: 'systemic', label: 'What accumulates, what fails' },
  { id: 'progression', label: 'Why it progresses' },
];

// A ladder of nephron mass, from healthy to end-stage.
const LADDER = [1, 0.75, 0.55, 0.4, 0.28, 0.18, 0.12, 0.08];

function stage(egfr: number) {
  if (egfr >= 90) return { g: 'G1', desc: 'normal', tone: 'normal' as const };
  if (egfr >= 60) return { g: 'G2', desc: 'mildly reduced', tone: 'normal' as const };
  if (egfr >= 45) return { g: 'G3a', desc: 'mild–moderate', tone: 'high' as const };
  if (egfr >= 30) return { g: 'G3b', desc: 'moderate–severe', tone: 'high' as const };
  if (egfr >= 15) return { g: 'G4', desc: 'severe', tone: 'danger' as const };
  return { g: 'G5', desc: 'kidney failure', tone: 'danger' as const };
}

// ---------------------------------------------------------------- stages

function StagesTab() {
  const [idx, setIdx] = useState(4);
  const runs = LADDER.map((nf) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useSteady(makeParams({ nephronFraction: nf }), 40),
  );
  const busy = runs.some((r) => r.busy);
  const cur = runs[idx].ev;
  const st = cur ? stage(cur.derived.eGFR) : null;
  const pts = (f: (e: NonNullable<(typeof runs)[number]['ev']>) => number): Series['points'] =>
    runs.filter((r) => r.ev).map((r) => ({ x: r.ev!.params.nephronFraction * 100, y: f(r.ev!) }));
  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Lose nephrons, watch the numbers" note="The working nephron mass is what the disease destroys. Filtration falls with it — but not at first, because the survivors take up the slack.">
            <Busy on={busy} />
            <Slider label="Working nephron mass" value={idx} min={0} max={LADDER.length - 1} step={1} onInput={(v) => setIdx(Math.round(v))} format={() => `${(LADDER[idx] * 100).toFixed(0)}% of nephrons`} />
            {cur && st && (
              <>
                <div class="readout-grid">
                  <Readout label="eGFR" value={cur.derived.eGFR} digits={0} unit="mL/min/1.73m²" tone={st.tone} refRange={`${st.g} · ${st.desc}`} />
                  <Readout label="Creatinine" value={si.creat(cur.body.creat)} digits={0} unit="µmol/L" tone={cur.body.creat > 1.3 ? 'high' : 'normal'} />
                  <Readout label="Urea" value={si.urea(cur.body.bun)} digits={1} unit="mmol/L" tone={cur.body.bun > 20 ? 'high' : 'normal'} />
                  <Readout label="Single-nephron GFR" value={cur.kidney.singleNephronGFR} digits={0} unit="nL/min" tone={cur.kidney.singleNephronGFR > 70 ? 'high' : 'normal'} refRange="≈ 60 normal" />
                </div>
                <p class="note" style={{ marginBottom: 0 }}>
                  {cur.kidney.singleNephronGFR > 75
                    ? 'Each surviving nephron is hyperfiltering — the adaptation that keeps the whole-kidney GFR up, and the one that wears the survivors out.'
                    : 'The remaining nephrons are filtering at close to their normal rate.'}
                </p>
              </>
            )}
          </Panel>
          <Panel title="Creatinine is a late and non-linear warning">
            <p class="muted" style={{ fontSize: '0.88rem', marginTop: 0 }}>
              Because creatinine excretion must equal its production, the plasma level is inversely proportional to the GFR. Halving the GFR from 120 to 60 barely moves it; halving it again from 30 to 15 doubles it. The same absolute rise means far more disease at the low end.
            </p>
            <Sources cite={{ rose: [2], evidence: 'physiology', refs: ['inker2021ckdepi'] }} />
          </Panel>
        </div>
        <div>
          <Panel title="Whole-kidney GFR against nephron mass" note="The dashed line is what filtration would be if each nephron kept its normal rate; the curve stays above it because the survivors hyperfilter.">
            <LineChart yLabel="GFR (mL/min)"
              xLabel="nephrons remaining (%)"
              series={[
                { label: 'eGFR', points: pts((e) => e.derived.eGFR), color: 'var(--c-teal)' },
                { label: 'if no adaptation', points: pts((e) => 120 * e.params.nephronFraction), color: 'var(--ink-faint)', dashed: true },
              ]}
              marker={cur ? cur.params.nephronFraction * 100 : undefined}
              xFormat={(x) => x.toFixed(0)}
              yMin={0}
              height={190}
            />
          </Panel>
          <Panel title="Creatinine and single-nephron filtration">
            <LineChart
              xLabel="nephrons remaining (%)"
              series={[
                { label: 'creatinine', axis: 'Serum creatinine (µmol/L)', points: pts((e) => si.creat(e.body.creat)), color: 'var(--c-coral)' },
                { label: 'single-nephron GFR', axis: 'Single-nephron GFR (nL/min)', points: pts((e) => e.kidney.singleNephronGFR), color: 'var(--c-amber)' },
              ]}
              marker={cur ? cur.params.nephronFraction * 100 : undefined}
              xFormat={(x) => x.toFixed(0)}
              yMin={0}
              height={190}
            />
          </Panel>
        </div>
      </div>
      <Predict
        question="A patient's creatinine rises from 60 to 120 µmol/L. Roughly how much kidney function has been lost?"
        options={['About 10%', 'About half', 'Almost none', 'All of it']}
        correct={1}
        explanation="Creatinine is inversely proportional to GFR, so a doubling means the GFR has roughly halved — even though both values are still near the normal range. This is why a 'normal' creatinine can hide substantial loss."
      />
    </>
  );
}

// ---------------------------------------------------------------- systemic

function SystemicTab() {
  const [nf, setNf] = useState(0.18);
  const run = useSteady(makeParams({ nephronFraction: nf }), 40);
  const e = run.ev;
  const st = e ? stage(e.derived.eGFR) : null;
  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Set the severity" note="Every system the kidney serves fails together, but in a fixed order: potassium and acid handling and the mineral axis go first, sodium and water balance last.">
            <Busy on={run.busy} />
            <Slider label="Working nephron mass" value={nf} min={0.06} max={1} step={0.02} onInput={setNf} format={() => (e ? `eGFR ${e.derived.eGFR.toFixed(0)} (${st?.g})` : '…')} />
            {e && (
              <div class="readout-grid">
                <Readout label="Potassium" value={e.plasma.K} digits={1} unit="mmol/L" tone={toneFor(e.plasma.K, 3.5, 5.0, [3.0, 6.0])} />
                <Readout label="Bicarbonate" value={e.plasma.HCO3} digits={0} unit="mmol/L" tone={toneFor(e.plasma.HCO3, 22, 28)} />
                <Readout label="Phosphate" value={e.plasma.Pi} digits={2} unit="mmol/L" tone={toneFor(e.plasma.Pi, 0.8, 1.45)} />
                <Readout label="Calcium" value={e.plasma.Ca} digits={2} unit="mmol/L" tone={toneFor(e.plasma.Ca, 2.2, 2.6)} />
                <Readout label="PTH" value={e.reg.hormones.pth} digits={1} unit="× normal" tone={e.reg.hormones.pth > 1.5 ? 'high' : 'normal'} />
                <Readout label="Mean BP" value={e.reg.MAP} digits={0} unit="mmHg" tone={e.reg.MAP > 100 ? 'high' : 'normal'} />
              </div>
            )}
          </Panel>
          <Panel title="The order things fail">
            <Chain
              steps={[
                { text: 'Concentrating and diluting range narrows (nocturia, then fixed isosthenuria)', direction: -1 },
                { text: 'Phosphate retention → FGF23, PTH rise (CKD–MBD)', direction: 1 },
                { text: 'Ammonium excretion per nephron maxes out → metabolic acidosis', direction: -1 },
                { text: 'Distal flow and adaptation fail → hyperkalaemia', direction: 1 },
                { text: 'Sodium and water balance last: volume overload, hypertension', direction: 1 },
              ]}
            />
            <Sources cite={{ rose: [2, 19, 28], evidence: 'clinical', refs: ['kdigo2024ckd'] }} />
          </Panel>
        </div>
        <div>
          <Panel title="Reading the panel">
            <ul class="muted" style={{ fontSize: '0.9rem', marginTop: 0, lineHeight: 1.7 }}>
              <li><strong>Acidosis</strong> — the failing kidney cannot excrete the daily acid load once ammoniagenesis per nephron is maximal (below a GFR of ~40–50); bone buffers it, and the bicarbonate stabilises at 12–20 mmol/L.</li>
              <li><strong>Hyperkalaemia</strong> — usually held off by adaptation and colonic secretion until the GFR is very low, or until a drug (ACE inhibitor, spironolactone), oliguria or a potassium load is added.</li>
              <li><strong>Mineral & bone</strong> — phosphate retention, a falling calcitriol and secondary hyperparathyroidism; the phosphate climbs only once the GFR is below ~30.</li>
              <li><strong>Volume & pressure</strong> — sodium balance is defended longest, but the price is expansion and hypertension, which then drive the disease on.</li>
              <li><strong>Anaemia and uraemic symptoms</strong> — erythropoietin deficiency and retained solutes; not captured by this model, but part of the same picture.</li>
            </ul>
          </Panel>
          <Panel title="Where to look closer">
            <p class="muted" style={{ fontSize: '0.88rem', marginBottom: 0 }}>
              The acidosis is built in the <a href="#/acid-base">acid–base engine</a> and the renal-failure section of <a href="#/rta">the RTA page</a>; the potassium in <a href="#/hyperkalemia">hyperkalaemia</a>; the bone and mineral axis in <a href="#/minerals">calcium, phosphate & magnesium</a>.
            </p>
          </Panel>
        </div>
      </div>
      <Predict
        question="At a GFR of 40 the potassium is still 4.6 but the bicarbonate is already 19. Why does the acidosis appear before the hyperkalaemia?"
        options={['They always appear together', 'Ammonium excretion per nephron is already maximal, while potassium is still defended by adaptation and the colon', 'The potassium is measured wrong', 'Acid is more toxic']}
        correct={1}
        explanation="Total ammonium excretion falls once the GFR is below ~40–50 because the remaining nephrons are already producing the maximum per nephron. Potassium excretion has more reserve — adaptation and colonic secretion — so hyperkalaemia comes later."
      />
    </>
  );
}

// ---------------------------------------------------------------- progression

function ProgressionTab() {
  const [nf, setNf] = useState(0.35);
  const [acei, setAcei] = useState(false);
  const [protein, setProtein] = useState(80);
  // "off" and "on" are computed regardless of the toggle so the comparison panel always contrasts
  // them; the toggle only chooses which one the top readouts show.
  const off = useSteady(makeParams({ nephronFraction: nf, proteinIntake: protein }), 40);
  const on = useSteady(makeParams({ nephronFraction: nf, proteinIntake: protein, drugs: { acei: 1 } }), 40);
  const e = acei ? on.ev : off.ev;
  const bare = off.ev;
  const busy = off.busy || on.busy;
  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="The vicious cycle" note="Lost nephrons make the survivors hyperfilter. High single-nephron pressure and flow damage them in turn, so nephrons are lost faster — Brenner's hyperfiltration hypothesis.">
            <Busy on={busy} />
            <Slider label="Nephron mass" value={nf} min={0.1} max={1} step={0.05} onInput={setNf} format={() => (bare ? `eGFR ${bare.derived.eGFR.toFixed(0)}` : '…')} />
            <Slider label="Protein intake" value={protein} min={40} max={140} step={10} unit="g/day" onInput={setProtein} normal={80} hint="A high protein load raises single-nephron filtration and pressure." />
            <Toggle label="ACE inhibitor" checked={acei} onChange={setAcei} hint="Dilates the efferent arteriole, lowering the glomerular capillary pressure and proteinuria." />
            {e && (
              <div class="readout-grid">
                <Readout label="Single-nephron GFR" value={e.kidney.singleNephronGFR} digits={0} unit="nL/min" tone={e.kidney.singleNephronGFR > 70 ? 'high' : 'normal'} refRange="≈ 60 normal" />
                <Readout label="Glomerular pressure" value={e.kidney.Pgc} digits={0} unit="mmHg" tone={(e.kidney.Pgc) > 50 ? 'high' : 'normal'} />
                <Readout label="Whole-kidney GFR" value={e.kidney.GFR} digits={0} unit="mL/min" />
                <Readout label="Mean BP" value={e.reg.MAP} digits={0} unit="mmHg" tone={e.reg.MAP > 100 ? 'high' : 'normal'} />
              </div>
            )}
          </Panel>
          <Panel title="What slows it">
            <Chain
              steps={[
                { text: 'Fewer nephrons → single-nephron hyperfiltration and high capillary pressure', direction: 1 },
                { text: 'Pressure and protein leak injure the glomerulus → more nephrons lost', direction: -1 },
                { text: 'ACE inhibitor / ARB: dilate the efferent arteriole, drop the pressure', direction: 0 },
                { text: 'Lower protein and blood pressure, SGLT2 inhibition: less hyperfiltration', direction: 0 },
              ]}
            />
            <Sources cite={{ rose: [2], evidence: 'clinical', refs: ['brenner1982', 'hostetter1981', 'lewis1993', 'heerspink2020'] }} />
          </Panel>
        </div>
        <div>
          <Panel title="The efferent arteriole is the lever">
            <p class="muted" style={{ fontSize: '0.9rem', marginTop: 0, lineHeight: 1.7 }}>
              Angiotensin II constricts the efferent arteriole preferentially, which props up the filtration fraction and the glomerular capillary pressure. That is useful in acute volume depletion, but sustained in a kidney with few nephrons it is the pressure that wears them out.
            </p>
            <p class="muted" style={{ fontSize: '0.9rem', lineHeight: 1.7, marginBottom: 0 }}>
              Blocking it with an ACE inhibitor or ARB dilates the efferent arteriole: the single-nephron pressure and the proteinuria fall, and the GFR often dips a little at first — the sign the drug is working, not failing. This is why these drugs slow diabetic and proteinuric kidney disease, and why SGLT2 inhibitors, which restore tubuloglomerular feedback, add to them.
            </p>
          </Panel>
          <Panel title="Off treatment versus on an ACE inhibitor" note="The efferent dilation lowers the single-nephron filtration, the filtration fraction and the capillary pressure — the whole-kidney GFR dips a little, which is the point.">
            {off.ev && on.ev && (
              <div class="readout-grid">
                <Readout label="Single-nephron GFR (off)" value={off.ev.kidney.singleNephronGFR} digits={0} unit="nL/min" tone="high" />
                <Readout label="Single-nephron GFR (ACEi)" value={on.ev.kidney.singleNephronGFR} digits={0} unit="nL/min" tone={on.ev.kidney.singleNephronGFR < off.ev.kidney.singleNephronGFR ? 'good' : 'normal'} />
                <Readout label="Filtration fraction (off)" value={off.ev.kidney.FF * 100} digits={0} unit="%" tone="high" />
                <Readout label="Filtration fraction (ACEi)" value={on.ev.kidney.FF * 100} digits={0} unit="%" tone="good" />
                <Readout label="Glom. pressure (off)" value={off.ev.kidney.Pgc} digits={1} unit="mmHg" tone="high" />
                <Readout label="Glom. pressure (ACEi)" value={on.ev.kidney.Pgc} digits={1} unit="mmHg" tone="good" />
              </div>
            )}
          </Panel>
        </div>
      </div>
      <Predict
        question="You start an ACE inhibitor for proteinuric CKD and the creatinine rises 20% in a week. What does this usually mean?"
        options={['The drug is damaging the kidney — stop it', 'The efferent dilation has lowered the glomerular pressure and GFR a little — expected, and the pressure drop is what protects the kidney', 'The patient is dehydrated only', 'The dose is too low']}
        correct={1}
        explanation="A small, stable rise in creatinine (up to ~30%) after starting an ACE inhibitor or ARB reflects the intended fall in glomerular capillary pressure. It is a marker of benefit, not harm — only a larger or progressive rise warrants stopping and looking for renovascular disease."
      />
      <Expand summary="What the model does and does not capture">
        <p class="muted" style={{ fontSize: '0.88rem' }}>
          The engine represents the haemodynamics — single-nephron hyperfiltration, the efferent effect of angiotensin II and ACE inhibition, the glomerular capillary pressure — so it shows the mechanism of progression and of ACE-inhibitor protection at a moment in time. It does not model the slow loss of nephrons over years, so it cannot draw the decline curve itself; the nephron-mass slider stands in for where a patient has reached.
        </p>
      </Expand>
    </>
  );
}

// ----------------------------------------------------------------

export default function Ckd({ query }: { query: URLSearchParams }) {
  const [tab, setTab] = useTabParam('/ckd', TAB_IDS, 'stages', query);
  return (
    <div>
      <PageHead
        path="/ckd"
        lede="Chronic kidney disease is the slow loss of nephrons. The survivors adapt — each filtering, excreting and secreting more — which keeps the plasma remarkably normal until late, and is also what drives the disease onward. Read it as one number, the GFR, falling, and a fixed sequence of failures behind it."
      />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'stages' && <StagesTab />}
      {tab === 'systemic' && <SystemicTab />}
      {tab === 'progression' && <ProgressionTab />}
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>Two kidneys filter ~180 L/day through ~2 million nephrons, matching every excretion to intake and making erythropoietin and calcitriol.</p>}
          why={<p>When nephrons are lost the survivors hyperfilter and each excretes more, so balance and the plasma composition are held near normal for a long time — the intact-nephron hypothesis.</p>}
          change={<p>As mass falls the adaptations are exhausted in order: concentrating range, then phosphate and acid handling, then potassium, then sodium and water.</p>}
          abnormal={<p>Metabolic acidosis, hyperkalaemia, CKD–mineral and bone disorder, anaemia, volume overload and hypertension, and the uraemic syndrome; hyperfiltration injures the survivors and the disease progresses.</p>}
          clinical={<p>Stage by eGFR and albuminuria; slow progression with blood-pressure control, ACE inhibitors or ARBs and SGLT2 inhibitors; treat the acidosis, potassium, phosphate and anaemia; prepare for replacement at G5.</p>}
        />
        <Sources cite={{ rose: [2, 19, 28], evidence: 'clinical', refs: ['kdigo2024ckd', 'inker2021ckdepi', 'heerspink2020', 'brenner1982'] }} />
      </Panel>
      <Related paths={['/minerals', '/hyperkalemia', '/rta', '/prerenal-atn', '/creatinine', '/glomerular']} />
    </div>
  );
}
