import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related, Busy, useTabParam } from '../ui/page';
import { Panel, Readout, Slider, Sources, Predict, Tabs, Chain, LineChart, Expand, toneFor, type Series } from '../ui/kit';
import { EquationCard } from '../ui/EquationCard';
import { EcgStrip, ecgFeatures } from '../ui/EcgStrip';
import { makeParams, useStep } from '../sim/hooks';
import { normalKStore, plasmaPotassium } from '../engine/body';
import type { Evaluation } from '../engine/simulate';
import type { ParamPatch } from '../engine/types';

const TAB_IDS = ['causes', 'deficit', 'ecg', 'treat'] as const;
type Tab = (typeof TAB_IDS)[number];
const TABS: { id: Tab; label: string }[] = [
  { id: 'causes', label: 'Find the cause' },
  { id: 'deficit', label: 'Level versus store' },
  { id: 'ecg', label: 'Muscle, heart and ECG' },
  { id: 'treat', label: 'Replacing it' },
];

interface Cause {
  id: string;
  label: string;
  patch: ParamPatch;
  days: number;
  how: string;
}

const CAUSES: Cause[] = [
  { id: 'thiazide', label: 'Thiazide diuretic', patch: { drugs: { thiazide: 1 } }, days: 14, how: 'Distal flow and aldosterone rise together; all the loss happens in the first two weeks.' },
  { id: 'loop', label: 'Loop diuretic, once daily', patch: { drugs: { furosemide: 0.7 }, diureticDoses: 1 }, days: 14, how: 'The same pairing, in pulses: high flow while the drug acts, then retention.' },
  { id: 'vomiting', label: 'Vomiting', patch: { vomiting: 0.6, naIntake: 80, waterIntake: 1.5 }, days: 7, how: 'HCl lost; bicarbonate spills into the urine as a non-reabsorbable anion and carries K⁺ with it. Gastric juice itself holds only 5–10 mmol/L.' },
  { id: 'diarrhoea', label: 'Diarrhoea or laxatives', patch: { diarrhea: 1.2, naIntake: 100 }, days: 7, how: 'K⁺ and bicarbonate lost in stool; the kidney conserves K⁺.' },
  { id: 'aldo', label: 'Primary aldosteronism', patch: { aldoAutonomous: 4 }, days: 21, how: 'Autonomous aldosterone: K⁺ and H⁺ secretion, mild volume expansion and escape, renin suppressed.' },
  { id: 'liquorice', label: 'Liquorice / apparent mineralocorticoid excess', patch: { cortisolMR: 0.8 }, days: 21, how: 'Cortisol reaches the mineralocorticoid receptor when 11β-HSD2 is inhibited or absent; aldosterone is suppressed.' },
  { id: 'gitelman', label: 'Gitelman syndrome', patch: { transporters: { NCC: 0 } }, days: 21, how: 'A lifelong thiazide: NCC absent.' },
  { id: 'bartter', label: 'Bartter syndrome', patch: { transporters: { NKCC2: 0.35 } }, days: 21, how: 'A lifelong loop diuretic: the thick ascending limb cannot reabsorb NaCl.' },
  { id: 'drta', label: 'Distal (type 1) RTA', patch: { transporters: { HATPase: 0.15 } }, days: 21, how: 'With H⁺ secretion impaired, Na⁺ is reabsorbed in exchange for K⁺.' },
  { id: 'lowk', label: 'Very low intake (10 mmol/day)', patch: { kIntake: 10 }, days: 21, how: 'Intake below the minimum the kidney can excrete; the kidney conserves appropriately.' },
  { id: 'polydipsia', label: 'Primary polydipsia (14 L/day)', patch: { waterIntake: 14, kIntake: 40 }, days: 21, how: 'The urine K⁺ cannot fall below ~5 mmol/L, so 15 L of urine carries 75 mmol a day.' },
];

interface Step {
  q: string;
  a: string;
  tone: 'renal' | 'extra' | 'info';
}

/** Rose's approach to unexplained hypokalaemia (ch. 27), applied to a set of numbers. */
function pathway(ev: Evaluation): Step[] {
  const u = ev.kidney.urine;
  const steps: Step[] = [];
  const renal = u.exc.K >= 25;
  steps.push({ q: `Urinary K⁺ ${u.exc.K.toFixed(0)} mmol/day`, a: renal ? 'Above 25: the kidney is losing K⁺.' : 'Below 25: the kidney is conserving — the loss is extrarenal, or a diuretic has worn off.', tone: renal ? 'renal' : 'extra' });
  const hco3 = ev.plasma.HCO3;
  const acid = hco3 < 22;
  const alk = hco3 > 27;
  steps.push({ q: `HCO₃⁻ ${hco3.toFixed(0)} mmol/L, pH ${ev.plasma.pH.toFixed(2)}`, a: acid ? 'Metabolic acidosis.' : alk ? 'Metabolic alkalosis.' : 'No important acid–base disturbance.', tone: 'info' });
  if (acid) {
    steps.push({
      q: `Urine pH ${u.pH.toFixed(1)}`,
      a: renal ? (u.pH > 5.3 ? 'Renal K⁺ loss with acidosis and a urine pH above 5.3: distal renal tubular acidosis (or ketoacidosis, or salt-wasting nephropathy with renal failure).' : 'Renal K⁺ loss with acidosis and an acid urine: ketoacidosis or proximal RTA on alkali.') : 'Extrarenal loss with acidosis: diarrhoea or laxatives.',
      tone: renal ? 'renal' : 'extra',
    });
  } else if (alk) {
    const ucl = u.Cl;
    steps.push({
      q: `Urine Cl⁻ ${ucl.toFixed(0)} mmol/L`,
      a: ucl < 25 ? 'Below 25: chloride depletion — vomiting (possibly concealed) or a diuretic whose effect has passed.' : ucl > 40 ? 'Above 40: a diuretic still acting (test the urine), Bartter or Gitelman syndrome, or mineralocorticoid excess.' : 'Borderline: repeat, and look at the blood pressure.',
      tone: ucl < 25 ? 'extra' : 'renal',
    });
    if (ucl >= 25) {
      const htn = ev.reg.MAP > 100;
      steps.push({ q: `Mean arterial pressure ${ev.reg.MAP.toFixed(0)} mmHg`, a: htn ? 'Hypertensive: look for mineralocorticoid excess.' : 'Normotensive: diuretic use, or Bartter/Gitelman syndrome.', tone: 'info' });
      if (htn) {
        const r = ev.reg.hormones.renin;
        const a = ev.reg.hormones.aldo;
        steps.push({
          q: `Renin ×${r.toFixed(2)}, aldosterone ×${a.toFixed(2)} normal`,
          a: r < 0.5 && a > 1.5 ? 'Low renin, high aldosterone: primary aldosteronism.' : r < 0.5 && a < 0.5 ? 'Low renin, low aldosterone: another mineralocorticoid — liquorice/AME, Cushing, CAH, Liddle.' : 'High renin and aldosterone: renovascular disease or a renin-secreting tumour (or a diuretic).',
          tone: 'renal',
        });
      } else {
        steps.push({ q: `Urinary Ca²⁺ ${u.exc.Ca.toFixed(1)} mmol/day, Mg²⁺ ${ev.plasma.Mg.toFixed(2)} mmol/L`, a: u.exc.Ca < 2.5 ? 'Low urinary calcium: thiazide-like (Gitelman, or a thiazide).' : 'Normal or high urinary calcium: loop-like (Bartter, or a loop diuretic).', tone: 'info' });
      }
    }
  } else if (renal && ev.kidney.urine.volumePerDay > 6) {
    steps.push({ q: `Urine volume ${ev.kidney.urine.volumePerDay.toFixed(1)} L/day`, a: 'Polyuria: the urine K⁺ is near its floor of 5–15 mmol/L, but the volume makes the daily loss large.', tone: 'renal' });
  } else if (renal) {
    steps.push({
      q: `Urine Cl⁻ ${u.Cl.toFixed(0)} mmol/L, mean pressure ${ev.reg.MAP.toFixed(0)} mmHg`,
      a: 'Renal loss without a clear acid–base change: a diuretic (the alkalosis is often mild), magnesium depletion, a non-reabsorbable anion such as high-dose penicillin, or two disorders cancelling. Test the urine for diuretics and check the magnesium.',
      tone: 'renal',
    });
  }
  return steps;
}

function CausesTab() {
  const [idx, setIdx] = useState(0);
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
  const s = (f: (p: NonNullable<typeof points>[number]) => number) => (points ?? []).map((p) => ({ x: p.day, y: f(p) }));
  const def = final ? normalKStore(final.params) - final.body.kE : 0;

  return (
    <>
      <div class="btn-row" style={{ marginBottom: 8 }}>
        <button class={!mystery ? 'active' : ''} onClick={() => setMystery(false)}>Explore a cause</button>
        <button class={mystery ? 'active' : ''} onClick={newMystery}>Mystery patient</button>
      </div>
      {!mystery && <WhatIf options={CAUSES.map((x) => ({ label: x.label, explain: x.how }))} onApply={(o) => setIdx(CAUSES.findIndex((x) => x.label === o.label))} active={c.label} />}
      <div class="grid grid-sidebar">
        <div>
          <Panel title={hidden ? 'An unexplained hypokalaemia' : c.label} note={hidden ? 'A patient has been hypokalaemic for some time. Read the chemistry, walk the pathway, then name the cause.' : c.how}>
            <Busy on={busy} />
            {final && u && (
              <div class="readout-grid">
                <Readout label="Plasma K⁺" value={final.plasma.K} digits={1} unit="mmol/L" tone={toneFor(final.plasma.K, 3.5, 5.0, [2.5, 6.5])} />
                <Readout label="Na⁺" value={final.plasma.Na} digits={0} unit="mmol/L" />
                <Readout label="Cl⁻" value={final.plasma.Cl} digits={0} unit="mmol/L" />
                <Readout label="HCO₃⁻" value={final.plasma.HCO3} digits={0} unit="mmol/L" tone={toneFor(final.plasma.HCO3, 22, 28)} />
                <Readout label="pH" value={final.plasma.pH} digits={2} tone={toneFor(final.plasma.pH, 7.35, 7.45)} />
                <Readout label="Mean BP" value={final.reg.MAP} digits={0} unit="mmHg" tone={final.reg.MAP > 100 ? 'high' : 'normal'} />
                <Readout label="Urine K⁺" value={u.exc.K} digits={0} unit="mmol/day" tone={u.exc.K > 25 ? 'high' : 'low'} refRange={`${u.K.toFixed(0)} mmol/L`} />
                <Readout label="Urine Na⁺" value={u.Na} digits={0} unit="mmol/L" />
                <Readout label="Urine Cl⁻" value={u.Cl} digits={0} unit="mmol/L" tone={u.Cl < 25 ? 'low' : 'normal'} />
                <Readout label="Urine pH" value={u.pH} digits={1} />
                <Readout label="Renin" value={final.reg.hormones.renin} digits={2} unit="× normal" />
                <Readout label="Aldosterone" value={final.reg.hormones.aldo} digits={2} unit="× normal" />
                {!hidden && <Readout label="K⁺ deficit" value={Math.max(0, def)} digits={0} unit="mmol" />}
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
          <Panel title="Rose's pathway, applied to these numbers" note="Urinary K⁺ first, then the acid–base state, then the urine chloride, the blood pressure, and renin and aldosterone.">
            {final && (
              <ol class="cascade" style={{ listStyle: 'none', paddingLeft: 0 }}>
                {pathway(final).map((st, i) => (
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
                <LineChart yLabel="Plasma K⁺ (mmol/L)" xLabel="days" series={[{ label: 'K⁺', points: s((p) => p.K), color: 'var(--c-teal)' }]} bands={[{ from: 3.5, to: 5 }]} height={160} />
              </Panel>
              <Panel title="Urinary K⁺ (mmol/day)" note="The loss is front-loaded: as K⁺ falls, secretion slows and a new steady state is reached.">
                <LineChart yLabel="Urinary K⁺ (mmol/day)" xLabel="days" series={[{ label: 'urine K⁺', points: s((p) => p.urineK), color: 'var(--c-amber)' }]} yMin={0} height={160} />
              </Panel>
            </div>
          )}
        </div>
      </div>
      <Expand summary="Where the model is weaker than the book">
        <p class="muted" style={{ fontSize: '0.88rem' }}>
          The model's diuretic and Gitelman hypokalaemia is milder than Rose describes (a thiazide lowers the K⁺ by about 0.3 here, against 0.5 for hydrochlorothiazide 50 mg). Its plasma chloride is stiffer than a patient's, so the calculated anion gap runs high in diarrhoea and low in vomiting; that is why this page shows the bicarbonate and pH rather than the gap. It does not reproduce Liddle syndrome's hypokalaemia, because its sodium channel remains aldosterone-dependent.
        </p>
      </Expand>
    </>
  );
}

// ---------------------------------------------------------------- level vs store

function DeficitTab() {
  const [deficit, setDeficit] = useState(300);
  const [pH, setPH] = useState(7.4);
  const [insulin, setInsulin] = useState(1);
  const p = useMemo(() => makeParams({ insulin }), [insulin]);
  const store = normalKStore(p);
  const kAt = (d: number, ph = pH, pp = p) => plasmaPotassium(store - d, pp.weightKg, pp, ph, 285);
  const k = kAt(deficit);
  const curves = useMemo(() => {
    const at = (ph: number, pp: typeof p): Series['points'] => {
      const pts: Series['points'] = [];
      for (let d = 0; d <= 800; d += 25) pts.push({ x: d, y: kAt(d, ph, pp) });
      return pts;
    };
    return [
      { label: 'pH 7.40', points: at(7.4, makeParams()), color: 'var(--c-teal)' },
      { label: 'pH 7.20 (mineral acidosis)', points: at(7.2, makeParams()), color: 'var(--c-coral)', dashed: true },
      { label: 'pH 7.55 (alkalosis)', points: at(7.55, makeParams()), color: 'var(--c-blue)', dashed: true },
      { label: 'insulin ×3', points: at(7.4, makeParams({ insulin: 3 })), color: 'var(--c-amber)', dashed: true },
    ];
  }, []);
  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="The store and what moves it">
            <Slider label="Total body K⁺ deficit" value={deficit} min={0} max={800} step={10} unit="mmol" onInput={setDeficit} hint={`${(deficit / 70).toFixed(1)} mmol/kg`} />
            <Slider label="Arterial pH" value={pH} min={7.1} max={7.6} step={0.01} onInput={setPH} normal={7.4} />
            <Slider label="Insulin effect" value={insulin} min={0.2} max={3} step={0.1} unit="× normal" onInput={setInsulin} normal={1} />
          </Panel>
          <Panel title="Result">
            <div class="readout-grid">
              <Readout label="Plasma K⁺" value={k} digits={1} unit="mmol/L" tone={toneFor(k, 3.5, 5, [2.5, 6.5])} />
              <Readout label="Store" value={store - deficit} digits={0} unit="mmol" refRange={`normal ${store.toFixed(0)}`} />
            </div>
            <p class="note" style={{ marginBottom: 0 }}>
              {pH < 7.3 && deficit > 150
                ? 'Acidaemia is holding K⁺ outside cells: correcting it will unmask the deficit.'
                : insulin > 1.5
                  ? 'Insulin has pushed K⁺ into cells: the level understates the stores — as in treated ketoacidosis once insulin has taken effect.'
                  : 'With a normal distribution, the plasma level tracks the store.'}
            </p>
          </Panel>
        </div>
        <div>
          <Panel title="Plasma K⁺ against the deficit" note="Rose: 200–400 mmol takes the level from 4 to 3, another 200–400 to about 2. Below that, cells release K⁺ and hold the plasma near 2. Shifts move the whole curve.">
            <LineChart yLabel="Plasma K⁺ (mmol/L)" xLabel="deficit (mmol)" series={curves} bands={[{ from: 3.5, to: 5 }]} marker={deficit} height={240} yMin={1.5} yMax={6} />
          </Panel>
          <Panel title="Same level, different stores">
            <Chain
              steps={[
                { text: 'Periodic paralysis: level 1.5–2.5, stores normal — give K⁺ carefully; rebound hyperkalaemia follows', direction: 0 },
                { text: 'Diabetic ketoacidosis: level normal or high, stores 3–5 mmol/kg low — K⁺ falls on insulin', direction: -1 },
                { text: 'Chronic heart failure, cirrhosis, malnutrition: stores 10–15% low with a normal level — supplements are simply excreted', direction: -1 },
                { text: 'Diarrhoea with acidosis: the level understates the deficit until the acidosis is corrected', direction: -1 },
              ]}
            />
          </Panel>
        </div>
      </div>
      <Predict
        question="A patient with diarrhoea has K⁺ 3.4 and pH 7.22. You give bicarbonate. What will the K⁺ do?"
        options={['Rise', 'Stay at 3.4', 'Fall — the acidaemia was holding K⁺ out of cells', 'Normalise']}
        correct={2}
        explanation="Mineral acidosis shifts K⁺ out of cells; correcting it moves K⁺ back in and the deficit appears. Replace K⁺ first or together (Rose problem 26-1)."
      />
    </>
  );
}

// ---------------------------------------------------------------- ECG

function EcgTab() {
  const [k, setK] = useState(2.6);
  const f = ecgFeatures(k);
  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Plasma potassium">
            <Slider label="K⁺" value={k} min={1.5} max={5} step={0.1} unit="mmol/L" onInput={setK} normal={4.2} />
          </Panel>
          <Panel title="What to expect">
            <ul class="muted" style={{ fontSize: '0.88rem', marginTop: 0 }}>
              <li>ECG changes from about 3.0; present in ~90% below 2.7 (Rose).</li>
              <li>Muscle weakness usually below 2.5 — legs first, respiratory muscles in severe cases.</li>
              <li>Rhabdomyolysis below 2.5: K⁺ release normally dilates exercising muscle.</li>
              <li>Arrhythmia risk rises with digitalis, ischaemia, LV hypertrophy, stress adrenaline and QT-prolonging drugs.</li>
            </ul>
          </Panel>
        </div>
        <div>
          <Panel title="Lead II (schematic)">
            <EcgStrip k={k} seconds={3} height={170} />
            <div class="readout-grid" style={{ marginTop: 8 }}>
              <Readout label="T wave" value={f.tAmp} digits={2} unit="mV" />
              <Readout label="U wave" value={f.uAmp} digits={2} unit="mV" tone={f.uAmp > f.tAmp ? 'high' : 'normal'} />
              <Readout label="ST" value={f.st} digits={2} unit="mV" tone={f.st < -0.03 ? 'low' : 'normal'} />
              <Readout label="QRS" value={f.qrs * 1000} digits={0} unit="ms" />
            </div>
          </Panel>
          <Panel title="Why the ECG changes">
            <Chain
              steps={[
                { text: 'Low extracellular K⁺ hyperpolarises the resting membrane', direction: 1 },
                { text: 'Membrane K⁺ permeability falls, slowing repolarisation', direction: -1 },
                { text: 'ST depression, lower T, taller U; the relative refractory period lengthens' },
                { text: 'Re-entry and increased automaticity: ectopy, VT, VF — torsade with QT-prolonging drugs', direction: 1 },
              ]}
            />
            <Sources cite={{ rose: [27, 26], evidence: 'clinical' }} />
          </Panel>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- treatment

const REGIMENS: { label: string; patch: ParamPatch; color: string }[] = [
  { label: 'Stop vomiting, diet only', patch: {}, color: 'var(--ink-faint)' },
  { label: '+ KCl 80 mmol/day', patch: { drugs: { potassiumChloride: 80 } }, color: 'var(--c-teal)' },
  { label: '+ K citrate 80 mmol/day', patch: { drugs: { potassiumCitrate: 80 } }, color: 'var(--c-amber)' },
  { label: '+ saline 2 L/day and KCl 80', patch: { ivNS: 2, drugs: { potassiumChloride: 80 } }, color: 'var(--c-blue)' },
];

function TreatTab() {
  const sickPatch: ParamPatch = { vomiting: 0.8, naIntake: 60, waterIntake: 1.5 };
  const from = useMemo(() => makeParams(sickPatch), []);
  const runs = REGIMENS.map((r) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useStep(from, makeParams({ naIntake: 60, waterIntake: 1.5, ...r.patch }), 7, 0.25, 30),
  );
  const busy = runs.some((r) => r.busy);
  const start = runs[0].before;
  const series = (f: (p: NonNullable<(typeof runs)[number]['points']>[number]) => number) =>
    REGIMENS.map((r, i) => ({ label: r.label, color: r.color, points: (runs[i].points ?? []).map((p) => ({ x: p.day, y: f(p) })) }));
  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="The patient" note="Several days of vomiting: hypokalaemia with a chloride-depletion alkalosis. The vomiting stops; four ways to repair it.">
            <Busy on={busy} />
            {start && (
              <div class="readout-grid">
                <Readout label="K⁺" value={start.plasma.K} digits={1} unit="mmol/L" tone="low" />
                <Readout label="HCO₃⁻" value={start.plasma.HCO3} digits={0} unit="mmol/L" tone="high" />
                <Readout label="Cl⁻" value={start.plasma.Cl} digits={0} unit="mmol/L" />
                <Readout label="Urine Cl⁻" value={start.kidney.urine.Cl} digits={0} unit="mmol/L" tone="low" />
              </div>
            )}
          </Panel>
          <Panel title="Rules from the chapter">
            <ul class="muted" style={{ fontSize: '0.88rem', marginTop: 0 }}>
              <li>KCl is the salt of choice: chloride is also depleted, and other anions are non-reabsorbable and promote K⁺ and H⁺ loss.</li>
              <li>KCl raises the extracellular K⁺ more than KHCO₃, which takes K⁺ into cells with it (Fig. 27-8).</li>
              <li>Oral: 60–80 mmol/day for mild cases; 40–60 mmol raises the level 1–1.5 transiently.</li>
              <li>IV: usually ≤ 10–20 mmol/h, ≤ 60 mmol/L peripherally, in saline not dextrose.</li>
              <li>Primary aldosteronism needs a K⁺-sparing diuretic; supplements are excreted.</li>
            </ul>
          </Panel>
        </div>
        <div>
          <Panel title="Plasma K⁺">
            <LineChart yLabel="Plasma K⁺ (mmol/L)" xLabel="days" series={series((p) => p.K)} bands={[{ from: 3.5, to: 5 }]} height={200} />
          </Panel>
          <Panel title="Bicarbonate" note="Only chloride lets the kidney excrete the excess bicarbonate. Citrate adds base.">
            <LineChart yLabel="Plasma HCO₃⁻ (mmol/L)" xLabel="days" series={series((p) => p.HCO3)} bands={[{ from: 22, to: 28 }]} height={200} />
          </Panel>
        </div>
      </div>
      <Predict
        question="A patient with K⁺ 2.4 is given 20 mmol of KCl in a litre of 5% dextrose over 4 hours. What can happen in the first hour?"
        options={['K⁺ rises steadily', 'K⁺ falls further as glucose-stimulated insulin moves K⁺ into cells', 'Nothing', 'Hyperkalaemia']}
        correct={1}
        explanation="Falls of 0.2–1.4 mmol/L have been seen, enough to provoke arrhythmias in hypokalaemic or digitalised patients. Give K⁺ in saline (Rose ch. 27)."
      />
    </>
  );
}

// ----------------------------------------------------------------

export default function Hypokalemia({ query }: { query: URLSearchParams }) {
  const [tab, setTab] = useTabParam('/hypokalemia', TAB_IDS, 'causes', query);
  return (
    <div>
      <PageHead
        path="/hypokalemia"
        lede="Hypokalaemia comes from low intake, a shift into cells, or losses through the gut or kidney. The kidney is where the diagnosis is made: below 25 mmol/day of urinary K⁺ it is conserving, above that it is wasting — and renal wasting almost always means distal flow and mineralocorticoid activity have risen together, or sodium is arriving with an anion it cannot keep."
      />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'causes' && <CausesTab />}
      {tab === 'deficit' && <DeficitTab />}
      {tab === 'ecg' && <EcgTab />}
      {tab === 'treat' && <TreatTab />}
      <div class="grid grid-2" style={{ marginTop: 16 }}>
        <EquationCard eq="ukcr" compact />
        <EquationCard eq="ttkg" compact />
      </div>
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>40–120 mmol/day in, the same out in urine; cells hold 98% and buffer shifts; the kidney can cut excretion to 5–25 mmol/day.</p>}
          why={<p>Distal secretion is set by aldosterone and the plasma K⁺, permitted by distal flow and the lumen-negative voltage of Na⁺ reabsorption.</p>}
          change={<p>Raise flow and aldosterone together (diuretics, vomiting), add a non-reabsorbable anion, or give autonomous mineralocorticoid, and K⁺ is wasted; shift K⁺ into cells with insulin, β₂-agonists or alkalaemia and the level falls without loss.</p>}
          abnormal={<p>Weakness below 2.5, ECG changes below 3.0, arrhythmia with digitalis or ischaemia, polyuria, more ammonia, maintenance of alkalosis, and with time tubular damage.</p>}
          clinical={<p>Urinary K⁺, then acid–base, urine chloride, blood pressure, renin and aldosterone. Replace with KCl, orally when possible; check and correct magnesium.</p>}
        />
        <Sources cite={{ rose: [27, 26], evidence: 'clinical', refs: ['funder2016', 'palmer2016k', 'blanchard2017', 'konrad2021', 'clase2020'] }} />
      </Panel>
      <Related paths={['/potassium', '/hyperkalemia', '/diuretics', '/metabolic-alkalosis', '/raas', '/inherited']} />
    </div>
  );
}
