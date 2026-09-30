import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related, Busy, Toggle, useTabParam } from '../ui/page';
import { Panel, Readout, Slider, Sources, Predict, Tabs, Chain, LineChart, Expand, toneFor, type Series } from '../ui/kit';
import { EquationCard } from '../ui/EquationCard';
import { EcgStrip, ecgFeatures } from '../ui/EcgStrip';
import { makeParams, useStep } from '../sim/hooks';
import { normalKStore, plasmaPotassium } from '../engine/body';
import type { Evaluation } from '../engine/simulate';
import type { ParamPatch } from '../engine/types';

const TAB_IDS = ['causes', 'shift', 'adapt', 'ecg', 'treat'] as const;
type Tab = (typeof TAB_IDS)[number];
const TABS: { id: Tab; label: string }[] = [
  { id: 'causes', label: 'Why it stays high' },
  { id: 'shift', label: 'Shifts and artefacts' },
  { id: 'adapt', label: 'Potassium adaptation' },
  { id: 'ecg', label: 'Heart and ECG' },
  { id: 'treat', label: 'Emergency treatment' },
];

// ---------------------------------------------------------------- persistent hyperkalaemia

interface Cause {
  id: string;
  label: string;
  patch: ParamPatch;
  days: number;
  how: string;
}

const CAUSES: Cause[] = [
  { id: 'load', label: 'KCl 250 mmol/day, normal kidneys', patch: { kIntake: 250 }, days: 14, how: 'A normal kidney adapts: the plasma K⁺ and aldosterone rise for a few days, then excretion keeps pace at almost the old level. A high intake alone rarely causes lasting hyperkalaemia.' },
  { id: 'ckd', label: 'Advanced renal failure (GFR ≈ 25)', patch: { nephronFraction: 0.15 }, days: 30, how: 'Each remaining nephron secretes several times its normal share of K⁺, so balance holds near normal until oliguria, a K⁺ load or a second insult is added.' },
  { id: 'hypoaldo', label: 'Hyporeninaemic hypoaldosteronism', patch: { nephronFraction: 0.35, aldoSynthesis: 0.1 }, days: 30, how: 'Moderate renal insufficiency with low aldosterone — the commonest cause of unexplained hyperkalaemia in adults, often diabetic; a mild hyperchloraemic acidosis (type 4 RTA) comes with it.' },
  { id: 'raas', label: 'Renal failure + ACE inhibitor + spironolactone', patch: { nephronFraction: 0.4, drugs: { acei: 1, spironolactone: 1 } }, days: 30, how: 'Too few nephrons and blocked aldosterone together: the combination that filled hospitals with hyperkalaemia after RALES.' },
  { id: 'addison', label: 'Primary adrenal insufficiency', patch: { aldoSynthesis: 0, glucocorticoid: 0.3 }, days: 20, how: 'No aldosterone and little cortisol: renal Na⁺ wasting, high renin, hyponatraemia (cortisol deficiency raises ADH) and hyperkalaemia with a very low TTKG.' },
  { id: 'tmp', label: 'Trimethoprim in renal insufficiency', patch: { nephronFraction: 0.5, drugs: { trimethoprim: 1 } }, days: 10, how: 'Trimethoprim closes ENaC as amiloride does: no lumen-negative voltage, so aldosterone rises but cannot restore K⁺ secretion.' },
  { id: 'amiloride', label: 'Amiloride with K⁺ supplements', patch: { drugs: { amiloride: 1 }, kIntake: 160 }, days: 14, how: 'A K⁺-sparing diuretic plus extra K⁺: Rose warns never to combine them without close monitoring.' },
];

interface Step {
  q: string;
  a: string;
  tone: 'renal' | 'extra' | 'info';
}

/** Rose's approach to persistent hyperkalaemia (ch. 28), applied to a set of numbers. */
function pathway(ev: Evaluation, ttkg: number): Step[] {
  const u = ev.kidney.urine;
  const h = ev.reg.hormones;
  const steps: Step[] = [];
  const high = ev.plasma.K > 5.0;
  steps.push({
    q: `Plasma K⁺ ${ev.plasma.K.toFixed(1)} mmol/L`,
    a: high ? 'Persistently high: first exclude artefact and an acute shift; then it is a problem of excretion.' : 'Within or near the normal range: the kidney has kept pace with intake.',
    tone: high ? 'renal' : 'info',
  });
  steps.push({
    q: `GFR ${ev.kidney.GFR.toFixed(0)} mL/min, urine ${u.volumePerDay.toFixed(1)} L/day`,
    a: ev.kidney.GFR < 15 || u.volumePerDay < 0.5 ? 'Very few nephrons or oliguria: too little distal flow to excrete the intake.' : ev.kidney.GFR < 60 ? 'Renal insufficiency: tolerable on its own through adaptation, but it removes the reserve — look for a second factor.' : 'Adequate filtration: renal failure alone does not explain it.',
    tone: 'info',
  });
  steps.push({
    q: `TTKG ${ttkg.toFixed(1)}`,
    a: high ? (ttkg < 7 ? 'Below 7 with a high K⁺: the collecting duct is not responding as aldosterone would make it — deficiency or resistance.' : 'Above 7: aldosterone effect is present; look at flow, intake and shifts.') : ttkg > 10 ? 'High: the kidney is secreting hard, as after a K⁺ load.' : 'Unremarkable at a normal K⁺.',
    tone: high && ttkg < 7 ? 'renal' : 'info',
  });
  if (high && ttkg < 7) {
    const r = h.renin;
    const a = h.aldo;
    steps.push({
      q: `Renin ×${r.toFixed(2)}, aldosterone ×${a.toFixed(2)} normal`,
      a:
        a < 0.2 && r > 2
          ? 'High renin, very low aldosterone: primary adrenal insufficiency (check cortisol), or an aldosterone synthesis defect or heparin.'
          : a < 0.8 && r < 1.6
            ? 'Low or normal renin with inappropriately low aldosterone for this K⁺: hyporeninaemic hypoaldosteronism (or NSAIDs, cyclosporine, ACE inhibitors).'
            : 'Aldosterone high but ineffective: resistance — a K⁺-sparing diuretic, trimethoprim, or pseudohypoaldosteronism.',
      tone: 'renal',
    });
  }
  if (high && ev.plasma.HCO3 < 22) {
    steps.push({ q: `HCO₃⁻ ${ev.plasma.HCO3.toFixed(0)} mmol/L`, a: 'A mild acidosis: hyperkalaemia suppresses ammoniagenesis, and low aldosterone reduces H⁺ secretion — type 4 RTA.', tone: 'info' });
  }
  return steps;
}

function ttkgOf(ev: Evaluation) {
  const u = ev.kidney.urine;
  return u.K / ev.plasma.K / Math.max(u.osm / ev.plasma.osm, 0.1);
}

function CausesTab() {
  const [idx, setIdx] = useState(1);
  const [mystery, setMystery] = useState(false);
  const [guess, setGuess] = useState<number | null>(null);
  const c = CAUSES[idx];
  const base = useMemo(() => makeParams(), []);
  const sick = useMemo(() => makeParams(c.patch), [idx]);
  const { points, final, busy } = useStep(base, sick, c.days, 0.25, 40);
  const newMystery = () => {
    let n = idx;
    while (n === idx) n = Math.floor(Math.random() * CAUSES.length);
    setIdx(n);
    setGuess(null);
    setMystery(true);
  };
  const hidden = mystery && guess === null;
  const u = final?.kidney.urine;
  const ttkg = final ? ttkgOf(final) : 0;
  const s = (f: (p: NonNullable<typeof points>[number]) => number) => (points ?? []).map((p) => ({ x: p.day, y: f(p) }));
  const excess = final ? final.body.kE - normalKStore(final.params) : 0;

  return (
    <>
      <div class="btn-row" style={{ marginBottom: 8 }}>
        <button class={!mystery ? 'active' : ''} onClick={() => setMystery(false)}>Explore a cause</button>
        <button class={mystery ? 'active' : ''} onClick={newMystery}>Mystery patient</button>
      </div>
      {!mystery && <WhatIf options={CAUSES.map((x) => ({ label: x.label, explain: x.how }))} onApply={(o) => setIdx(CAUSES.findIndex((x) => x.label === o.label))} active={c.label} />}
      <div class="grid grid-sidebar">
        <div>
          <Panel title={hidden ? 'A patient with a raised K⁺' : c.label} note={hidden ? 'Artefact and acute shifts have been excluded. Read the chemistry, walk the pathway, then name the cause.' : c.how}>
            <Busy on={busy} />
            {final && u && (
              <div class="readout-grid">
                <Readout label="Plasma K⁺" value={final.plasma.K} digits={1} unit="mmol/L" tone={toneFor(final.plasma.K, 3.5, 5.0, [2.5, 6.5])} />
                <Readout label="Na⁺" value={final.plasma.Na} digits={0} unit="mmol/L" tone={toneFor(final.plasma.Na, 135, 145)} />
                <Readout label="HCO₃⁻" value={final.plasma.HCO3} digits={0} unit="mmol/L" tone={toneFor(final.plasma.HCO3, 22, 28)} />
                <Readout label="Cl⁻" value={final.plasma.Cl} digits={0} unit="mmol/L" />
                <Readout label="GFR" value={final.kidney.GFR} digits={0} unit="mL/min" tone={final.kidney.GFR < 60 ? 'low' : 'normal'} />
                <Readout label="Mean BP" value={final.reg.MAP} digits={0} unit="mmHg" />
                <Readout label="Urine K⁺" value={u.exc.K} digits={0} unit="mmol/day" refRange={`${u.K.toFixed(0)} mmol/L`} />
                <Readout label="TTKG" value={ttkg} digits={1} tone={final.plasma.K > 5 && ttkg < 7 ? 'low' : 'normal'} />
                <Readout label="Renin" value={final.reg.hormones.renin} digits={2} unit="× normal" />
                <Readout label="Aldosterone" value={final.reg.hormones.aldo} digits={2} unit="× normal" />
                {!hidden && <Readout label="K⁺ adaptation" value={final.body.kAdapt ?? 1} digits={2} unit="× normal" />}
                {!hidden && <Readout label="K⁺ retained" value={Math.max(0, excess)} digits={0} unit="mmol" />}
              </div>
            )}
          </Panel>
          {mystery && (
            <Panel title="Your diagnosis">
              <div class="btn-row">
                {CAUSES.map((x, i) => (
                  <button key={x.id} class={guess === null ? '' : i === idx ? 'primary' : guess === i ? '' : 'ghost'} style={guess === i && i !== idx ? { borderColor: 'var(--danger)' } : undefined} onClick={() => setGuess(i)}>
                    {x.label}
                  </button>
                ))}
              </div>
              {guess !== null && (
                <p class="note" style={{ marginBottom: 0 }}>
                  <strong>{guess === idx ? 'Right.' : `It was ${c.label}.`}</strong> {c.how}{' '}
                  <button class="ghost" onClick={newMystery}>Another patient</button>
                </p>
              )}
            </Panel>
          )}
        </div>
        <div>
          <Panel title="Rose's approach, applied to these numbers" note="Persistent hyperkalaemia means reduced excretion: too few nephrons, too little distal flow, or too little aldosterone effect.">
            {final && (
              <ol class="cascade" style={{ listStyle: 'none', paddingLeft: 0 }}>
                {pathway(final, ttkg).map((st, i) => (
                  <li key={i} class={st.tone === 'renal' ? 'up' : st.tone === 'extra' ? 'down' : ''}>
                    <span class="arrow">{i + 1}</span>
                    <strong>{st.q}.</strong> {st.a}
                  </li>
                ))}
              </ol>
            )}
          </Panel>
          {!hidden && (
            <div class="grid grid-2">
              <Panel title="Plasma K⁺ over time">
                <LineChart yLabel="Plasma K⁺ (mmol/L)" xLabel="days" series={[{ label: 'K⁺', points: s((p) => p.K), color: 'var(--c-coral)' }]} bands={[{ from: 3.5, to: 5 }]} height={160} />
              </Panel>
              <Panel title="Aldosterone and adaptation" note="Aldosterone answers the K⁺ first; the secreting cells adapt over days.">
                <LineChart yLabel="× normal"
                  xLabel="days"
                  series={[
                    { label: 'aldosterone', points: s((p) => p.aldo), color: 'var(--c-amber)' },
                    { label: 'K⁺ adaptation', points: s((p) => p.kAdapt), color: 'var(--c-teal)' },
                  ]}
                  yMin={0}
                  height={160}
                />
              </Panel>
            </div>
          )}
        </div>
      </div>
      <Expand summary="Where the model is weaker than the book">
        <p class="muted" style={{ fontSize: '0.88rem' }}>
          The model's TTKG runs lower than Rose's normal of 8–9, so read it comparatively. Salt restriction in renal failure (Rose's problem 28-1) produces only a mild rise here, because the model's aldosterone and adaptation make up for the lower distal flow more completely than a patient's do. Pseudohypoaldosteronism and Gordon syndrome are described in the chapter notes but not reproduced: the model's aldosterone compensates for them. Tissue breakdown (rhabdomyolysis, tumour lysis, haemolysis) is not simulated.
        </p>
      </Expand>
    </>
  );
}

// ---------------------------------------------------------------- shifts and artefacts

function ShiftTab() {
  const [excess, setExcess] = useState(0);
  const [pH, setPH] = useState(7.4);
  const [organic, setOrganic] = useState(false);
  const [insulin, setInsulin] = useState(1);
  const [betaBlock, setBetaBlock] = useState(false);
  const [osm, setOsm] = useState(285);
  const [serumK, setSerumK] = useState(6.8);
  const [platelets, setPlatelets] = useState(900);
  const [wbc, setWbc] = useState(8);
  const [haemolysed, setHaemolysed] = useState(false);
  const p = makeParams({ insulin, lacticAcid: organic ? 8 : 0, drugs: { betaBlocker: betaBlock ? 1 : 0 } });
  const store = normalKStore(makeParams());
  const k = plasmaPotassium(store + excess, p.weightKg, p, pH, osm);
  const kNeutral = plasmaPotassium(store + excess, p.weightKg, makeParams(), 7.4, 285);
  // Rose ch. 28: serum exceeds plasma by ~0.15 mmol/L per 100 × 10⁹/L of platelets above normal.
  const plateletExcess = Math.max(0, (platelets - 300) / 100) * 0.15;
  const trueK = serumK - plateletExcess - 0.2;

  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="What moves K⁺ out of cells">
            <Slider label="K⁺ retained (store above normal)" value={excess} min={0} max={500} step={10} unit="mmol" onInput={setExcess} />
            <Slider label="Arterial pH" value={pH} min={7.0} max={7.5} step={0.01} onInput={setPH} normal={7.4} />
            <Toggle label="The acid is organic (lactic, keto)" checked={organic} onChange={setOrganic} hint="Organic anions enter cells with the H⁺, so little K⁺ leaves." />
            <Slider label="Insulin effect" value={insulin} min={0.05} max={3} step={0.05} unit="× normal" onInput={setInsulin} normal={1} />
            <Toggle label="Non-selective β-blocker" checked={betaBlock} onChange={setBetaBlock} />
            <Slider label="Effective osmolality" value={osm} min={280} max={340} step={1} unit="mOsm/kg" onInput={setOsm} normal={285} hint="Hyperglycaemia or mannitol: water leaves cells and drags K⁺ with it." />
          </Panel>
        </div>
        <div>
          <Panel title="Plasma K⁺">
            <div class="readout-grid">
              <Readout label="Plasma K⁺" value={k} digits={1} unit="mmol/L" tone={toneFor(k, 3.5, 5, [2.5, 6.5])} />
              <Readout label="Without the shifts" value={kNeutral} digits={1} unit="mmol/L" />
              <Readout label="Shift" value={k - kNeutral} digits={1} unit="mmol/L" tone={k - kNeutral > 0.3 ? 'high' : k - kNeutral < -0.3 ? 'low' : 'normal'} />
            </div>
            <Chain
              steps={[
                { text: 'Mineral acidosis: 0.2–1.7 mmol/L per 0.1 pH (the model uses 0.6); organic acidoses much less', direction: 1 },
                { text: 'Insulin deficiency with hyperglycaemia: the hyperosmolality matters more than the insulin', direction: 1 },
                { text: 'β-blockade: a small rise, larger after a K⁺ load or exercise', direction: 1 },
                { text: 'Exercise: +0.3 walking to +2 mmol/L at exhaustion, reversed within minutes', direction: 1 },
                { text: 'Cell breakdown: rhabdomyolysis, tumour lysis, haemolysis, bleeding into the gut', direction: 1 },
              ]}
            />
            <Sources cite={{ rose: [28, 12], evidence: 'clinical' }} />
          </Panel>
          <Panel title="Is it real? Serum versus plasma" note="With no cause and no ECG change at 6.5–7.0, suspect artefact: repeat without a tourniquet or fist clenching, and measure plasma K⁺.">
            <div class="grid grid-2">
              <div>
                <Slider label="Measured serum K⁺" value={serumK} min={4} max={9} step={0.1} unit="mmol/L" onInput={setSerumK} />
                <Slider label="Platelets" value={platelets} min={150} max={2000} step={25} unit="× 10⁹/L" onInput={setPlatelets} />
                <Slider label="White cells" value={wbc} min={4} max={300} step={1} unit="× 10⁹/L" onInput={setWbc} />
                <Toggle label="Sample haemolysed (pink serum)" checked={haemolysed} onChange={setHaemolysed} />
              </div>
              <div>
                <div class="readout-grid">
                  <Readout label="Expected plasma K⁺" value={trueK} digits={1} unit="mmol/L" tone={toneFor(trueK, 3.5, 5)} />
                  <Readout label="Platelet artefact" value={plateletExcess} digits={2} unit="mmol/L" />
                </div>
                <ul class="muted" style={{ fontSize: '0.85rem' }}>
                  <li>Clotting releases 0.1–0.5 mmol/L from cells in anyone.</li>
                  <li>+0.15 per 100 × 10⁹/L of platelets above normal.</li>
                  {wbc > 100 && <li><strong>White cells above 100 × 10⁹/L:</strong> serum K⁺ can be spuriously as high as 9 — measure plasma.</li>}
                  {haemolysed && <li><strong>Haemolysis:</strong> K⁺ released from red cells; the estimate above cannot correct it — repeat the sample.</li>}
                  <li>Fist clenching with a tourniquet can add 1–2 mmol/L.</li>
                </ul>
              </div>
            </div>
          </Panel>
        </div>
      </div>
      <Predict
        question="A dialysis patient's glucose rises from 5 to 50 mmol/L. What happens to the plasma K⁺?"
        options={['Nothing: there is no insulin effect', 'It rises: the hyperosmolality pulls water and K⁺ out of cells, and there is no urine to excrete it', 'It falls: glucose drives K⁺ into cells', 'It falls by dilution']}
        correct={1}
        explanation="Rose describes plasma K⁺ above 8–9 in this setting. In a patient with kidneys, the same shift is followed by urinary loss, which is why ketoacidosis ends in K⁺ depletion (ch. 25)."
      />
    </>
  );
}

// ---------------------------------------------------------------- adaptation

const ADAPT_RUNS: { label: string; base: ParamPatch; color: string }[] = [
  { label: 'Normal kidneys', base: {}, color: 'var(--c-teal)' },
  { label: 'Renal failure (GFR ≈ 35)', base: { nephronFraction: 0.22 }, color: 'var(--c-amber)' },
  { label: 'Renal failure + low aldosterone', base: { nephronFraction: 0.22, aldoSynthesis: 0.15 }, color: 'var(--c-coral)' },
];

function AdaptTab() {
  const [load, setLoad] = useState(200);
  const runs = ADAPT_RUNS.map((r) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useStep(makeParams(r.base), makeParams({ ...r.base, kIntake: load }), 21, 0.25, 40),
  );
  const busy = runs.some((r) => r.busy);
  const series = (f: (p: NonNullable<(typeof runs)[number]['points']>[number]) => number): Series[] =>
    ADAPT_RUNS.map((r, i) => ({ label: r.label, color: r.color, points: (runs[i].points ?? []).map((p) => ({ x: p.day, y: f(p) })) }));
  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Raise the intake" note="Rose ch. 12 and 28: intake raised slowly to about 400 mmol/day is tolerated. Plasma K⁺ and aldosterone rise for a few days and then fall back while excretion stays high, because the secreting cells add Na⁺-K⁺-ATPase and basolateral membrane.">
            <Busy on={busy} />
            <Slider label="K⁺ intake from day 0" value={load} min={80} max={400} step={10} unit="mmol/day" onInput={setLoad} normal={80} />
            <div class="readout-grid">
              {runs.map((r, i) =>
                r.final ? <Readout key={i} label={ADAPT_RUNS[i].label} value={r.final.plasma.K} digits={2} unit="mmol/L" tone={toneFor(r.final.plasma.K, 3.5, 5, [2.5, 6.5])} /> : null,
              )}
            </div>
          </Panel>
          <Panel title="Why it matters">
            <Chain
              steps={[
                { text: 'Fewer nephrons: each must secrete more', direction: 1 },
                { text: 'The small rise in K⁺ (and aldosterone) induces adaptation in the survivors', direction: 1 },
                { text: 'Balance is restored at a near-normal K⁺ until the GFR is very low', direction: 0 },
                { text: 'Take away aldosterone or distal flow and the adaptation fails: hyperkalaemia', direction: 1 },
              ]}
            />
            <Sources cite={{ rose: [12, 28], evidence: 'experimental' }} />
          </Panel>
        </div>
        <div>
          <Panel title="Plasma K⁺">
            <LineChart yLabel="Plasma K⁺ (mmol/L)" xLabel="days" series={series((p) => p.K)} bands={[{ from: 3.5, to: 5 }]} height={190} />
          </Panel>
          <div class="grid grid-2">
            <Panel title="Aldosterone (× normal)">
              <LineChart yLabel="Aldosterone (× normal)" xLabel="days" series={series((p) => p.aldo)} yMin={0} height={160} />
            </Panel>
            <Panel title="Secretory adaptation (× normal)">
              <LineChart yLabel="Secretory adaptation (× normal)" xLabel="days" series={series((p) => p.kAdapt)} yMin={1} height={160} />
            </Panel>
          </div>
        </div>
      </div>
      <Predict
        question="Why does a patient with hyporeninaemic hypoaldosteronism and normal renal function usually have a normal K⁺?"
        options={['Aldosterone does not matter for K⁺', 'A small rise in plasma K⁺ drives secretion directly and restores balance', 'The colon excretes all of it', 'Insulin rises']}
        correct={1}
        explanation="Plasma K⁺ regulates secretion in its own right. Renal insufficiency removes the reserve that makes this compensation enough — compare the lines above."
      />
      <Expand summary="How the model represents adaptation">
        <p class="muted" style={{ fontSize: '0.88rem' }}>
          A slow state (time constant about three days) multiplies the principal cells' K⁺-secretory capacity in proportion to the sustained rise in plasma K⁺, gated by mineralocorticoid effect because aldosterone is permissive for it. The book gives the phenomenon and its time scale ("days"), not these constants; they were chosen so that renal failure alone keeps the K⁺ below about 5 until the GFR is under 20–25 mL/min, as Rose describes.
        </p>
      </Expand>
    </>
  );
}

// ---------------------------------------------------------------- ECG

function EcgTab() {
  const [k, setK] = useState(7.2);
  const [ca, setCa] = useState(false);
  const f = ecgFeatures(k, ca ? 1 : 0);
  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Plasma potassium">
            <Slider label="K⁺" value={k} min={4} max={9.5} step={0.1} unit="mmol/L" onInput={setK} normal={4.2} />
            <Toggle label="Calcium gluconate given" checked={ca} onChange={setCa} hint="Restores excitability for 30–60 minutes; the K⁺ does not change." />
          </Panel>
          <Panel title="What to expect">
            <ul class="muted" style={{ fontSize: '0.88rem', marginTop: 0 }}>
              <li>Peaked, narrow T waves with a short QT, usually above ~6 mmol/L.</li>
              <li>Above 7–8: longer PR, wider QRS, flatter then absent P.</li>
              <li>Then a sine wave as QRS and T merge, and ventricular fibrillation or asystole.</li>
              <li>The relation is loose: a normal ECG does not make a high K⁺ safe.</li>
              <li>Weakness, ascending from the legs, usually waits until above 8.</li>
              <li>Worse with low Ca²⁺, low Na⁺, acidaemia or a rapid rise.</li>
            </ul>
          </Panel>
        </div>
        <div>
          <Panel title="Lead II (schematic)">
            <EcgStrip k={k} calcium={ca ? 1 : 0} seconds={3} height={170} />
            <p class="muted" style={{ fontSize: '0.85rem', margin: '6px 0' }}>{f.notes.join('; ')}</p>
            <div class="readout-grid">
              <Readout label="T wave" value={f.tAmp} digits={2} unit="mV" tone={f.tAmp > 0.5 ? 'high' : 'normal'} />
              <Readout label="PR" value={f.pr * 1000} digits={0} unit="ms" tone={f.pr > 0.2 ? 'high' : 'normal'} />
              <Readout label="QRS" value={f.qrs * 1000} digits={0} unit="ms" tone={f.qrs > 0.12 ? 'danger' : 'normal'} />
              <Readout label="QT" value={f.qt * 1000} digits={0} unit="ms" />
            </div>
          </Panel>
          <Panel title="Why the ECG changes">
            <Chain
              steps={[
                { text: 'High extracellular K⁺ partly depolarises the resting membrane', direction: 1 },
                { text: 'Membrane K⁺ conductance rises: faster repolarisation — peaked T, short QT', direction: 1 },
                { text: 'Sustained depolarisation inactivates Na⁺ channels: slower conduction — PR, QRS, P lost', direction: -1 },
                { text: 'Calcium raises the threshold potential and restores the gap to the resting potential', direction: 0 },
              ]}
            />
            <Sources cite={{ rose: [28, 26], evidence: 'clinical', refs: ['montague2008'] }} />
          </Panel>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- emergency treatment

interface Therapy {
  id: string;
  label: string;
  note: string;
}

const THERAPIES: Therapy[] = [
  { id: 'calcium', label: 'Calcium gluconate 10%, 10 mL', note: 'Protects the membrane within minutes for 30–60 min; no change in K⁺.' },
  { id: 'insulin', label: 'Insulin 10 U + glucose', note: '0.5–1.5 mmol/L within an hour (0.85 in the ESRD study Rose cites), lasting hours.' },
  { id: 'albuterol', label: 'Albuterol 10–20 mg nebulised', note: '0.5–1.5 mmol/L, peak at ~90 min; additive to insulin; blunted in some dialysis patients.' },
  { id: 'bicarb', label: 'Sodium bicarbonate', note: 'Little effect unless there is real acidaemia.' },
  { id: 'resin', label: 'Cation-exchange resin (enema)', note: 'Removes K⁺: 0.5–1.0 mmol/L per enema over 2–3 h.' },
  { id: 'diuretic', label: 'Loop diuretic', note: 'Removes K⁺ only if the kidney can respond.' },
  { id: 'hd', label: 'Haemodialysis', note: '1.3 mmol/L at 1 h, continuing while it runs.' },
];

const rise = (t: number, tau: number) => 1 - Math.exp(-Math.max(0, t) / tau);
const wane = (t: number, hold: number, tau: number) => Math.exp(-Math.max(0, t - hold) / tau);

/**
 * Change in plasma K⁺ (mmol/L) at time t (minutes) from each therapy. These are schematic curves
 * fitted to the effect sizes Rose gives in ch. 28 (insulin −0.85 and dialysis −1.3 at one hour,
 * bicarbonate nil without acidaemia; albuterol 0.5–1.5 with a 90-minute peak; resin enema 0.5–1.0),
 * not outputs of the renal engine: the shifts are transient, removal is not.
 */
function therapyEffect(id: string, t: number, pH: number, esrd: boolean): number {
  switch (id) {
    case 'insulin':
      return -0.9 * rise(t, 20) * wane(t, 150, 150);
    case 'albuterol':
      return -(esrd ? 0.6 : 0.8) * rise(t, 35) * wane(t, 120, 120);
    case 'bicarb': {
      const acid = Math.max(0, Math.min(2.5, (7.35 - pH) / 0.1));
      return -(0.1 + 0.3 * acid) * rise(t, 30) * wane(t, 240, 240);
    }
    case 'resin':
      return -0.7 * rise(t, 90);
    case 'diuretic':
      return esrd ? 0 : -0.5 * rise(t, 150);
    case 'hd':
      return -2.4 * rise(Math.min(t, 240), 70);
    default:
      return 0;
  }
}

/** Membrane protection from calcium (0–1). */
const calciumProtection = (t: number) => rise(t, 2) * wane(t, 30, 25);

function TreatTab() {
  const [k0, setK0] = useState(7.6);
  const [pH, setPH] = useState(7.3);
  const [esrd, setEsrd] = useState(true);
  const [on, setOn] = useState<Record<string, boolean>>({ calcium: true, insulin: true, albuterol: false, bicarb: false, resin: false, diuretic: false, hd: false });
  const [t, setT] = useState(60);
  const selected = THERAPIES.filter((x) => on[x.id]);
  const kAt = (time: number, ids: string[]) => Math.max(2.5, k0 + ids.reduce((s, id) => s + therapyEffect(id, time, pH, esrd), 0));
  const ids = selected.map((x) => x.id);
  const times = Array.from({ length: 73 }, (_, i) => i * 5);
  const series: Series[] = [
    { label: 'no treatment', color: 'var(--ink-faint)', dashed: true, points: times.map((x) => ({ x, y: k0 })) },
    { label: 'chosen regimen', color: 'var(--c-teal)', points: times.map((x) => ({ x, y: kAt(x, ids) })) },
    ...selected
      .filter((x) => x.id !== 'calcium')
      .map((x) => ({ label: x.label.split(' ')[0], dashed: true, color: 'var(--c-blue)', points: times.map((tt) => ({ x: tt, y: kAt(tt, [x.id]) })) })),
  ];
  const kNow = kAt(t, ids);
  const protect = on.calcium ? calciumProtection(t) : 0;
  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="The patient">
            <Slider label="Starting K⁺" value={k0} min={5.5} max={9} step={0.1} unit="mmol/L" onInput={setK0} />
            <Slider label="Arterial pH" value={pH} min={7.05} max={7.45} step={0.01} onInput={setPH} normal={7.4} />
            <Toggle label="End-stage renal failure / oliguria" checked={esrd} onChange={setEsrd} hint="No urine to excrete K⁺; β₂ response blunted in some." />
          </Panel>
          <Panel title="Treatment" note="Rose Table 28-4: antagonise the membrane effect, shift K⁺ into cells, then remove it.">
            {THERAPIES.map((x) => (
              <Toggle key={x.id} label={x.label} checked={!!on[x.id]} onChange={(v) => setOn({ ...on, [x.id]: v })} hint={x.note} />
            ))}
          </Panel>
        </div>
        <div>
          <Panel title="Plasma K⁺ over six hours">
            <LineChart yLabel="Plasma K⁺ (mmol/L)" xLabel="minutes" series={series} bands={[{ from: 3.5, to: 5 }]} marker={t} height={220} yMin={3} yMax={9.5} />
            <Slider label="Time since treatment" value={t} min={0} max={360} step={5} unit="min" onInput={setT} />
          </Panel>
          <Panel title={`At ${t} minutes`}>
            <EcgStrip k={kNow} calcium={protect} seconds={3} height={150} />
            <div class="readout-grid" style={{ marginTop: 8 }}>
              <Readout label="Plasma K⁺" value={kNow} digits={1} unit="mmol/L" tone={toneFor(kNow, 3.5, 5, [2.5, 6.5])} />
              <Readout label="Calcium protection" value={protect * 100} digits={0} unit="%" tone={protect > 0.5 ? 'good' : 'normal'} />
            </div>
            <p class="note" style={{ marginBottom: 0 }}>
              {!ids.some((i) => ['resin', 'diuretic', 'hd'].includes(i)) && ids.some((i) => ['insulin', 'albuterol', 'bicarb'].includes(i))
                ? 'Only shifts so far: the K⁺ is still in the body and returns to the plasma over several hours. Plan removal while the shift lasts.'
                : ids.includes('hd')
                  ? 'Dialysis removes K⁺ many times faster than peritoneal dialysis, and is essential when cell breakdown keeps releasing it.'
                  : on.calcium && ids.length === 1
                    ? 'Calcium buys minutes, not a solution: the K⁺ is unchanged.'
                    : 'Removal lowers the store; shifts buy time while it works.'}
            </p>
          </Panel>
        </div>
      </div>
      <Predict
        question="Which lowers the K⁺ the most within an hour in a haemodialysis patient with little acidaemia?"
        options={['Sodium bicarbonate', 'Adrenaline', 'Insulin with glucose', 'Calcium gluconate']}
        correct={2}
        explanation="In the study Rose cites: insulin–glucose −0.85, adrenaline −0.3, bicarbonate nil, haemodialysis −1.3. Calcium protects the heart but does not lower the K⁺."
      />
      <Expand summary="About these curves">
        <p class="muted" style={{ fontSize: '0.88rem' }}>
          This tab is a pharmacodynamic sketch, not the renal engine: each therapy's curve is shaped to the onset, size and duration Rose gives in chapter 28. Effects are treated as additive, which roughly matches the combination of albuterol with insulin; real responses vary widely between patients. Current practice favours insulin with glucose as the most reliable shift, and the newer binders (patiromer, sodium zirconium cyclosilicate) over sodium polystyrene sulfonate for ongoing removal.
        </p>
        <Sources cite={{ rose: [28], evidence: 'clinical', refs: ['allon1989', 'clase2020', 'packham2015', 'weir2015'] }} />
      </Expand>
    </>
  );
}

// ----------------------------------------------------------------

export default function Hyperkalemia({ query }: { query: URLSearchParams }) {
  const [tab, setTab] = useTabParam('/hyperkalemia', TAB_IDS, 'causes', query);
  return (
    <div>
      <PageHead
        path="/hyperkalemia"
        lede="A normal person hardly can become hyperkalaemic: cells take up a load within minutes, the kidney excretes it within hours, and chronic loading only makes excretion more efficient. So an acute rise means a large load or a shift out of cells, and a persistent one means excretion has failed — too few nephrons, too little distal flow, or too little aldosterone effect."
      />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'causes' && <CausesTab />}
      {tab === 'shift' && <ShiftTab />}
      {tab === 'adapt' && <AdaptTab />}
      {tab === 'ecg' && <EcgTab />}
      {tab === 'treat' && <TreatTab />}
      <div class="grid grid-2" style={{ marginTop: 16 }}>
        <EquationCard eq="ttkg" compact />
        <EquationCard eq="ukcr" compact />
      </div>
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>Cells buffer a load within minutes (insulin, β₂, the K⁺ itself); the kidney excretes most of it within 6–8 hours; adaptation lets intake rise to about 400 mmol/day.</p>}
          why={<p>Distal secretion needs nephrons, distal flow and aldosterone effect; the plasma K⁺ drives secretion directly as well as through aldosterone.</p>}
          change={<p>Remove nephrons and adaptation compensates; add oliguria, volume depletion, ACE inhibitors, spironolactone, trimethoprim, heparin or a K⁺ load and it no longer does.</p>}
          abnormal={<p>Depolarisation: peaked T, then conduction slowing, sine wave and arrest; ascending weakness above ~8; suppressed ammoniagenesis and a mild acidosis.</p>}
          clinical={<p>Exclude artefact; with ECG change give calcium, then insulin–glucose (± albuterol, bicarbonate if acidaemic), then remove K⁺. Chronically: diet, diuretic, binder, and review the drugs.</p>}
        />
        <Sources cite={{ rose: [28, 12], evidence: 'clinical', refs: ['palmer2004', 'clase2020', 'juurlink2004', 'montague2008', 'kdigo2024ckd'] }} />
      </Panel>
      <Related paths={['/potassium', '/hypokalemia', '/rta', '/raas', '/ckd', '/diuretics']} />
    </div>
  );
}
