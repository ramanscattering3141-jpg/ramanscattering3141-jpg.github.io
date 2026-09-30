import { useEffect, useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, Related, Toggle, Busy, useTabParam } from '../ui/page';
import { Panel, Readout, Slider, Chain, Sources, Predict, Tabs, LineChart, toneFor, type Series } from '../ui/kit';
import { EquationCard } from '../ui/EquationCard';
import { acute, makeParams, steady, useStep, useSteady } from '../sim/hooks';
import { withFluid } from '../engine/scenarios';
import { thirstDrive, type Evaluation } from '../engine/simulate';
import type { ParamPatch } from '../engine/types';
import { si } from '../units';

type Tab = 'step' | 'curve' | 'clamp' | 'effective' | 'osmo';

// ------------------------------------------------------------------------------------------------
// 1. A step change in salt intake (Rose Fig. 8-1)

const BACKGROUND: { id: string; label: string; patch: ParamPatch; note: string }[] = [
  { id: 'normal', label: 'Normal kidneys', patch: {}, note: 'Aldosterone falls and ANP rises as the extra salt expands the ECF.' },
  { id: 'acei', label: 'On an ACE inhibitor', patch: { drugs: { acei: 1 } }, note: 'Angiotensin II cannot rise on a low-salt diet or be suppressed much further on a high one: the kidney leans on volume and pressure instead.' },
  { id: 'aldo', label: 'Aldosterone fixed high', patch: { aldoAutonomous: 3 }, note: 'Aldosterone cannot fall, so extra salt is excreted only once pressure and ANP rise — at a higher blood pressure.' },
  { id: 'ckd', label: 'Half the nephrons', patch: { nephronFraction: 0.5 }, note: 'Fewer nephrons still reach balance, but each must excrete a larger fraction of its filtered Na⁺.' },
];

function StepTab() {
  const [from, setFrom] = useState(20);
  const [to, setTo] = useState(200);
  const [bg, setBg] = useState('normal');
  const days = 10;
  const back = BACKGROUND.find((b) => b.id === bg)!;
  const before = useMemo(() => makeParams({ ...back.patch, naIntake: from }), [bg, from]);
  const after = useMemo(() => makeParams({ ...back.patch, naIntake: to }), [bg, to]);
  const run = useStep(before, after, days, 0.25);
  const pts = run.points;
  const busy = run.busy;

  const series = useMemo(() => {
    if (!pts) return null;
    const out: Series[] = [
      { label: 'Na⁺ intake', points: pts.map((q) => ({ x: q.day, y: to })), color: 'var(--ink-faint)', dashed: true },
      { label: 'Na⁺ output (urine + ~10 skin and stool)', points: pts.map((q) => ({ x: q.day, y: q.urineNa + 10 })), color: 'var(--c-amber)' },
    ];
    const vol: Series[] = [
      { label: 'Change in ECF volume', axis: 'Change in ECF volume (L)', points: pts.map((q) => ({ x: q.day, y: q.ecf - pts[0].ecf })), color: 'var(--c-blue)' },
      { label: 'Cumulative Na⁺ balance', axis: 'Cumulative Na⁺ retained (mmol)', points: pts.map((q) => ({ x: q.day, y: q.naBalance })), color: 'var(--c-violet)', dashed: true },
    ];
    const hormones: Series[] = [
      { label: 'Renin', points: pts.map((q) => ({ x: q.day, y: q.renin })), color: 'var(--c-coral)' },
      { label: 'Aldosterone', points: pts.map((q) => ({ x: q.day, y: q.aldo })), color: 'var(--c-amber)' },
      { label: 'ANP', points: pts.map((q) => ({ x: q.day, y: q.anp })), color: 'var(--c-teal)' },
    ];
    return { out, vol, hormones };
  }, [pts, to]);

  const last = pts?.[pts.length - 1];
  const first = pts?.[0];
  const day1 = pts?.find((q) => q.day >= 1);
  const toSteady = pts?.find((q) => Math.abs(q.urineNa + 10 - to) < 0.1 * Math.abs(to - from) + 5 && q.day > 0.5);

  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="The experiment">
            <Slider label="Habitual Na⁺ intake" value={from} min={10} max={400} step={10} unit="mmol/day" onInput={setFrom} hint="the body starts in steady state on this diet" />
            <Slider label="New Na⁺ intake from day 0" value={to} min={10} max={400} step={10} unit="mmol/day" onInput={setTo} />
            <div class="btn-row" style={{ margin: '8px 0' }}>
              {BACKGROUND.map((b) => (
                <button key={b.id} class={bg === b.id ? 'active' : ''} onClick={() => setBg(b.id)}>
                  {b.label}
                </button>
              ))}
            </div>
            <p class="control-hint">{back.note}</p>
          </Panel>
          <Panel title="What happened">
            <Busy on={busy} />
            {last && first && (
              <div class="readout-grid">
                <Readout label="Day-1 output" value={(day1?.urineNa ?? 0) + 10} unit="mmol/day" />
                <Readout label="Balance restored by" value={toSteady ? `day ${Math.ceil(toSteady.day)}` : `> ${days} d`} />
                <Readout label="ECF change" value={last.ecf - first.ecf} digits={2} unit="L" delta={last.ecf - first.ecf} deltaDigits={2} />
                <Readout label="Na⁺ retained (or lost)" value={last.naBalance} unit="mmol" />
                <Readout label="MAP change" value={last.MAP - first.MAP} digits={1} unit="mmHg" />
                <Readout label="Plasma Na⁺" value={last.Na} digits={1} unit="mmol/L" tone={toneFor(last.Na, 135, 145)} />
                <Readout label="Aldosterone" value={last.aldo} digits={2} unit="× normal" delta={last.aldo - first.aldo} deltaDigits={2} />
                <Readout label="Plasma K⁺" value={last.K} digits={2} unit="mmol/L" tone={toneFor(last.K, 3.5, 5.0)} />
              </div>
            )}
          </Panel>
        </div>
        <div>
          <Panel title="Na⁺ in and out, day by day" note="Output lags intake until enough Na⁺ (and the water it holds) has been retained to change the volume signals. The difference between the curves is the Na⁺ being retained or lost.">
            {series && <LineChart yLabel="Na⁺ (mmol/day)" xLabel="day" series={series.out} yMin={0} height={220} />}
          </Panel>
          <div class="grid grid-2">
            <Panel title="Volume: the persistent signal">
              {series && <LineChart xLabel="day" series={series.vol} height={180} />}
            </Panel>
            <Panel title="The hormones that carry the signal (× normal)">
              {series && <LineChart yLabel="× normal" xLabel="day" series={series.hormones} yMin={0} height={180} />}
            </Panel>
          </div>
          <p class="note caution">
            Model limitation: in Rose &amp; Post’s Fig. 8-1 about half of an abrupt salt excess is excreted on the first day. This model, driven only by volume, pressure and hormones, excretes less on day 1 and catches up by day 2–3. Meal-related and other rapid signals are not represented.
          </p>
        </div>
      </div>
      <div class="grid grid-2">
        <Panel title="Why a steady state needs a changed volume">
          <Chain
            steps={[
              { text: 'Intake rises; excretion has not yet changed → Na⁺ is retained', direction: 1 },
              { text: 'Osmolality rises → thirst and ADH → water retained with it: ECF expands', direction: 1 },
              { text: 'Renin and aldosterone fall, ANP rises (and, if needed, pressure rises)', direction: -1 },
              { text: 'Each day a larger share of intake is excreted' },
              { text: 'New steady state: output = intake, held there by the slightly larger ECF', direction: 0 },
            ]}
          />
        </Panel>
        <Panel title="Day-to-day arithmetic" note="Normal kidneys regulate Na⁺ by adjusting less than 1% of the filtered load.">
          <DayToDay />
        </Panel>
      </div>
    </>
  );
}

function DayToDay() {
  const [gfr, setGfr] = useState(160);
  const [intake, setIntake] = useState(120);
  const filtered = gfr * 150; // L/day × mmol/L of plasma water
  const fe = ((intake - 10) / filtered) * 100;
  return (
    <div>
      <Slider label="GFR" value={gfr} min={20} max={200} unit="L/day" onInput={setGfr} />
      <Slider label="Na⁺ intake" value={intake} min={20} max={400} step={10} unit="mmol/day" onInput={setIntake} />
      <div class="readout-grid">
        <Readout label="Filtered Na⁺" value={filtered} unit="mmol/day" />
        <Readout label="FENa needed" value={fe} digits={2} unit="%" />
        <Readout label="Reabsorbed" value={100 - fe} digits={2} unit="%" />
      </div>
      <p class="control-hint">Book’s example: GFR 160 L/day, plasma-water Na⁺ 150 mmol/L → 24,000 mmol/day filtered; 120 mmol/day needs FENa ≈ 0.5%, and 180 mmol/day only ≈ 0.67%.</p>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// 2. Pressure natriuresis curves (Rose Fig. 8-8, after Guyton)

const CURVES: { id: string; label: string; patch: ParamPatch; color: string }[] = [
  { id: 'normal', label: 'Normal (AII free to vary)', patch: {}, color: 'var(--c-teal)' },
  { id: 'acei', label: 'AII blocked (ACE inhibitor)', patch: { drugs: { acei: 1 } }, color: 'var(--c-blue)' },
  { id: 'high', label: 'AII fixed high (autonomous renin)', patch: { reninAutonomous: 3 }, color: 'var(--c-coral)' },
  { id: 'ckd', label: 'Nephron loss (25% remaining)', patch: { nephronFraction: 0.25 }, color: 'var(--c-violet)' },
];
const INTAKES = [20, 75, 150, 250, 400];

type CurvePoint = { intake: number; map: number; ecf: number; renin: number };

function CurveTab() {
  const [data, setData] = useState<Record<string, CurvePoint[]>>({});
  const [shown, setShown] = useState<Record<string, boolean>>({ normal: true, acei: true, high: true, ckd: false });
  const pending = CURVES.filter((c) => shown[c.id]).reduce((n, c) => n + (INTAKES.length - (data[c.id]?.length ?? 0)), 0);

  useEffect(() => {
    let alive = true;
    for (const c of CURVES) {
      if (!shown[c.id] || data[c.id]?.length === INTAKES.length) continue;
      for (const intake of INTAKES) {
        steady(makeParams({ ...c.patch, naIntake: intake }), 60).then((r) => {
          if (!alive) return;
          setData((d) => {
            const list = [...(d[c.id] ?? []).filter((q) => q.intake !== intake), { intake, map: r.ev.reg.MAP, ecf: r.ev.derived.ecfLiters, renin: r.ev.reg.hormones.renin }];
            list.sort((a, b) => a.intake - b.intake);
            return { ...d, [c.id]: list };
          });
        });
      }
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  const series: Series[] = CURVES.filter((c) => shown[c.id] && data[c.id]?.length).map((c) => ({
    label: c.label,
    color: c.color,
    points: data[c.id].map((q) => ({ x: q.map, y: q.intake })),
  }));
  const span = (id: string) => {
    const d = data[id];
    if (!d || d.length < INTAKES.length) return undefined;
    return d[d.length - 1].map - d[0].map;
  };

  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Curves">
            {CURVES.map((c) => (
              <Toggle key={c.id} label={c.label} checked={!!shown[c.id]} onChange={(v) => setShown({ ...shown, [c.id]: v })} />
            ))}
            <p class="control-hint">Each point is a full steady state of the model at that salt intake (the model runs 60 simulated days for each).</p>
            {pending > 0 && <p class="busy">computing {pending} steady states…</p>}
          </Panel>
          <Panel title="Blood pressure cost of a 20-fold salt range">
            <div class="readout-grid">
              {CURVES.filter((c) => shown[c.id]).map((c) => (
                <Readout key={c.id} label={c.label} value={span(c.id) ?? '…'} digits={1} unit={span(c.id) === undefined ? '' : 'mmHg'} />
              ))}
            </div>
          </Panel>
        </div>
        <div>
          <Panel title="Steady-state Na⁺ intake (= excretion) against mean arterial pressure" note="Guyton’s way of drawing it: at steady state, excretion equals intake, so each curve shows the pressure at which the kidney can excrete a given salt load. A steep curve means salt barely changes pressure.">
            {series.length > 0 ? <LineChart yLabel="Steady-state Na⁺ intake = excretion (mmol/day)" xLabel="mean arterial pressure (mmHg)" series={series} yMin={0} height={280} /> : <p class="busy">computing…</p>}
          </Panel>
          <div class="grid grid-2">
            <Panel title="Reading the curves">
              <ul class="muted" style={{ fontSize: '0.88rem' }}>
                <li>Normal: angiotensin II and aldosterone fall as intake rises, so the kidney excretes more salt with little change in pressure — a nearly vertical curve.</li>
                <li>When angiotensin II cannot fall (fixed high) the kidney is primed to retain Na⁺: balance is reached only at a higher pressure — the curve shifts right.</li>
                <li>When it cannot rise (ACE inhibition) pressure is lower at every intake and becomes salt-sensitive: the reason diuretics and salt restriction potentiate ACE inhibitors.</li>
                <li>Nephron loss shifts the curve right: chronic kidney disease is a salt-sensitive, volume-dependent hypertension.</li>
              </ul>
            </Panel>
            <Panel title="Pressure natriuresis is the backstop">
              <Chain
                steps={[
                  { text: 'Na⁺ retained that the hormones can no longer shed', direction: 1 },
                  { text: 'ECF ↑ → cardiac output ↑ → tissues autoregulate → MAP ↑', direction: 1 },
                  { text: 'Renal perfusion pressure ↑ → medullary interstitial pressure ↑', direction: 1 },
                  { text: 'Proximal and loop reabsorption fall', direction: -1 },
                  { text: 'Balance restored — at a higher blood pressure', direction: 0 },
                ]}
              />
              <p class="control-hint">In normal people this contributes little day to day: a 50-fold rise in intake moves MAP only ~4 mmHg because the hormones do the work.</p>
            </Panel>
          </div>
        </div>
      </div>
      <Predict
        question="With angiotensin II infused at a fixed high rate, raising salt intake produces:"
        options={['The same small rise in blood pressure as normal', 'A larger rise in blood pressure, because reabsorption cannot be turned down hormonally', 'A fall in blood pressure', 'No natriuresis at all']}
        correct={1}
        explanation="Balance is still reached — intake always equals output eventually — but only once pressure natriuresis does the job the suppressible hormones would otherwise have done."
      />
    </>
  );
}

// ------------------------------------------------------------------------------------------------
// 3. Hall's aortic-clamp experiment: escape needs pressure (Rose Fig. 8-9)

function ClampTab() {
  const [aldo, setAldo] = useState(6);
  const [clamped, setClamped] = useState(false);
  const days = 16;
  // The dogs are first equilibrated on the high-salt diet; the infusion starts on day 0.
  const before = useMemo(() => makeParams({ naIntake: 250 }), []);
  const p = useMemo(() => makeParams({ aldoAutonomous: aldo, naIntake: 250, renalPressureClamp: clamped ? 93 : 0 }), [aldo, clamped]);
  const freeParams = useMemo(() => makeParams({ aldoAutonomous: aldo, naIntake: 250 }), [aldo]);
  const free = useStep(before, freeParams, days, 0.25);
  const run = useStep(before, p, days, 0.25);
  const pts = run.points;

  const chart = useMemo(() => {
    if (!pts || !free.points) return null;
    const naOut: Series[] = [
      { label: 'Intake', points: pts.map((q) => ({ x: q.day, y: 250 })), color: 'var(--ink-faint)', dashed: true },
      { label: clamped ? 'Na⁺ excretion (pressure clamped)' : 'Na⁺ excretion', points: pts.map((q) => ({ x: q.day, y: q.urineNa })), color: clamped ? 'var(--c-coral)' : 'var(--c-teal)' },
    ];
    if (clamped) naOut.push({ label: 'Na⁺ excretion if pressure could rise', points: free.points.map((q) => ({ x: q.day, y: q.urineNa })), color: 'var(--c-teal)', dashed: true });
    const volume: Series[] = [
      { label: 'ECF', axis: 'Volume (L)', points: pts.map((q) => ({ x: q.day, y: q.ecf })), color: 'var(--c-blue)' },
      { label: 'Oedema', axis: 'Volume (L)', points: pts.map((q) => ({ x: q.day, y: q.edema })), color: 'var(--c-violet)' },
      { label: 'Mean arterial pressure', axis: 'Mean arterial pressure (mmHg)', points: pts.map((q) => ({ x: q.day, y: q.MAP })), color: 'var(--c-amber)' },
    ];
    return { naOut, volume };
  }, [pts, free.points, clamped]);

  const last = pts?.[pts.length - 1];
  const escaped = pts && last && last.urineNa > 0.9 * 250;

  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="The dog experiment">
            <p class="muted" style={{ fontSize: '0.88rem', marginTop: 0 }}>
              Aldosterone is infused with a high-salt diet. Normally Na⁺ is retained for a few days and then a spontaneous natriuresis returns balance — aldosterone escape. Hall and colleagues repeated it with a servo-controlled aortic clamp holding renal perfusion pressure at baseline.
            </p>
            <Slider label="Aldosterone infusion" value={aldo} min={1} max={10} step={0.5} unit="× normal" onInput={setAldo} />
            <Toggle label="Suprarenal aortic clamp (renal perfusion pressure held at 93 mmHg)" checked={clamped} onChange={setClamped} />
            <Busy on={run.busy || free.busy} />
          </Panel>
          <Panel title="Outcome">
            {last && (
              <div class="readout-grid">
                <Readout label="Escape by day 16?" value={escaped ? 'yes' : 'no'} tone={escaped ? 'good' : 'danger'} />
                <Readout label="Na⁺ excretion" value={last.urineNa} unit="mmol/day" />
                <Readout label="ECF" value={last.ecf} digits={1} unit="L" />
                <Readout label="Oedema" value={last.edema} digits={1} unit="L" tone={last.edema > 1 ? 'danger' : 'normal'} />
                <Readout label="MAP" value={last.MAP} digits={0} unit="mmHg" tone={toneFor(last.MAP, 70, 105)} />
                <Readout label="Plasma K⁺" value={last.K} digits={2} unit="mmol/L" tone={toneFor(last.K, 3.5, 5)} />
              </div>
            )}
            <p class={escaped ? 'callout good' : 'callout danger'} style={{ marginTop: 8 }}>
              {escaped
                ? 'Escape: Na⁺ excretion has caught up with intake. Volume expansion is self-limiting, which is why primary aldosteronism causes hypertension and hypokalaemia but not oedema.'
                : 'No escape: with renal perfusion pressure held constant the kidney keeps retaining Na⁺, and fluid accumulates without limit. The escape depended on the rise in pressure.'}
            </p>
          </Panel>
        </div>
        <div>
          <Panel title="Sodium excretion against intake" note="Escape is the point where excretion climbs back to intake despite the aldosterone still being infused.">
            {chart && <LineChart yLabel="Na⁺ (mmol/day)" xLabel="day" series={chart.naOut} yMin={0} height={220} />}
          </Panel>
          <Panel title="Volume, oedema and pressure">
            {chart && <LineChart xLabel="day" series={chart.volume} height={200} />}
          </Panel>
          <Panel title="What escape is, and is not">
            <ul class="muted" style={{ fontSize: '0.88rem' }}>
              <li>It is not resistance to aldosterone: K⁺ wasting continues throughout, because that depends on the distal secretory machinery rather than on volume.</li>
              <li>ANP rises a day or two before the natriuresis and contributes, but ANP-deficient animals still escape.</li>
              <li>Clamping renal artery pressure prevents escape, and retention then progresses to pulmonary oedema or malignant hypertension; releasing the clamp produces a prompt diuresis.</li>
              <li>The same logic explains why SIADH, which retains water rather than salt, does not cause oedema.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------------------------------------
// 4. Effective circulating volume can part company with every measurable variable (Table 8-1)

const STATES: { id: string; label: string; patch: ParamPatch; expect: string }[] = [
  { id: 'normal', label: 'Normal', patch: {}, expect: 'Everything normal; urine Na⁺ matches intake.' },
  { id: 'depleted', label: 'Na⁺ depleted', patch: { naIntake: 10, diarrhea: 0.4 }, expect: 'Effective volume ↓, ECF ↓, plasma volume ↓, cardiac output ↓ — everything falls together.' },
  { id: 'hf', label: 'Heart failure', patch: { cardiacFunction: 0.7 }, expect: 'Effective volume ↓ although ECF and plasma volume are ↑: the pump, not the tank, is the problem.' },
  { id: 'fistula', label: 'Arteriovenous fistula', patch: { vasodilation: 0.2 }, expect: 'Cardiac output ↑ but much of it bypasses capillaries; effective volume is near normal.' },
  { id: 'cirrhosis', label: 'Cirrhosis with ascites', patch: { vasodilation: 0.3, portalHypertension: 0.7, albumin: 2.8 }, expect: 'ECF ↑↑ (ascites), plasma volume ↑, cardiac output normal or ↑ — yet the kidney retains Na⁺ avidly.' },
  { id: 'nephrotic', label: 'Nephrotic syndrome', patch: { albumin: 2.0, proteinuria: 8 }, expect: 'Hypoalbuminaemia: oedema with a plasma volume that may be normal (overflow) or low (underfill).' },
];

function EffectiveTab() {
  const [id, setId] = useState('hf');
  const chosen = STATES.find((s) => s.id === id)!;
  const normal = useSteady(makeParams({}), 60);
  const state = useSteady(makeParams(chosen.patch), 60);
  const n = normal.ev;
  const e = state.ev;
  const rel = (a?: number, b?: number) => (a === undefined || b === undefined ? '—' : `${a > b * 1.08 ? '↑' : a < b * 0.92 ? '↓' : '='} ${a.toFixed(a < 10 ? 2 : 0)}`);

  return (
    <>
      <div class="btn-row" style={{ marginBottom: 10 }}>
        {STATES.map((s) => (
          <button key={s.id} class={id === s.id ? 'active' : ''} onClick={() => setId(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
      <div class="grid grid-sidebar">
        <div>
          <Panel title={chosen.label}>
            <Busy on={normal.busy || state.busy} />
            <p class="muted" style={{ fontSize: '0.88rem' }}>{chosen.expect}</p>
            {e && n && (
              <div class="readout-grid">
                <Readout label="Urine Na⁺" value={e.kidney.urine.exc.Na} unit="mmol/day" tone={e.kidney.urine.exc.Na < 20 ? 'danger' : 'normal'} title="Below 15–20 mmol/L (or a very low daily excretion) is the practical marker of effective volume depletion" />
                <Readout label="ECF" value={e.derived.ecfLiters} digits={1} unit="L" delta={e.derived.ecfLiters - n.derived.ecfLiters} deltaDigits={1} />
                <Readout label="Plasma volume" value={e.plasma.plasmaVolume} digits={2} unit="L" delta={e.plasma.plasmaVolume - n.plasma.plasmaVolume} deltaDigits={2} />
                <Readout label="Cardiac output" value={e.reg.CO} digits={2} unit="× normal" delta={e.reg.CO - n.reg.CO} deltaDigits={2} />
                <Readout label="MAP" value={e.reg.MAP} digits={0} unit="mmHg" delta={e.reg.MAP - n.reg.MAP} />
                <Readout label="Oedema" value={e.derived.edemaLiters} digits={1} unit="L" tone={e.derived.edemaLiters > 1 ? 'danger' : 'normal'} />
                <Readout label="Renin" value={e.reg.hormones.renin} digits={2} unit="× normal" delta={e.reg.hormones.renin - n.reg.hormones.renin} deltaDigits={2} />
                <Readout label="Sympathetic tone" value={e.reg.hormones.sns} digits={2} unit="× normal" delta={e.reg.hormones.sns - n.reg.hormones.sns} deltaDigits={2} />
                <Readout label="ADH" value={si.adh(e.reg.hormones.adh)} digits={1} unit="pmol/L" />
                <Readout label="Plasma Na⁺" value={e.plasma.Na} digits={1} unit="mmol/L" tone={toneFor(e.plasma.Na, 135, 145)} />
              </div>
            )}
          </Panel>
        </div>
        <div>
          <Panel title="Every state, side by side" note="Arrows compare each steady state with the normal one. The point of the table: no single measurable variable tells you the effective circulating volume — the kidney's own behaviour does.">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>State</th>
                    <th>Urine Na⁺</th>
                    <th>ECF</th>
                    <th>Plasma volume</th>
                    <th>Cardiac output</th>
                    <th>Renin</th>
                  </tr>
                </thead>
                <tbody>
                  {STATES.map((s) => (
                    <EffectiveRow key={s.id} label={s.label} patch={s.patch} normal={n} active={s.id === id} onClick={() => setId(s.id)} rel={rel} />
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <div class="grid grid-2">
            <Panel title="How effective volume is judged clinically">
              <ul class="muted" style={{ fontSize: '0.88rem' }}>
                <li>A urine Na⁺ below 15–20 mmol/L means the kidney is behaving as though perfusion were inadequate.</li>
                <li>It misleads when the kidney cannot conserve Na⁺ (diuretics, salt-wasting disease) or when the kidney alone is under-perfused (bilateral renal artery stenosis, acute glomerulonephritis).</li>
                <li>Head-out water immersion shifts blood centrally and produces a natriuresis even in cirrhosis — evidence that the retention reflects effective hypovolaemia rather than a fixed tubular defect.</li>
              </ul>
            </Panel>
            <Panel title="Why the kidney can be wrong-footed">
              <Chain
                steps={[
                  { text: 'Receptors sense pressure/stretch, not volume' },
                  { text: 'Pressure usually tracks volume — but not when the pump fails or the circulation is dilated', direction: 0 },
                  { text: 'The kidney reads low pressure as hypovolaemia and retains Na⁺', direction: 1 },
                  { text: 'ECF expands further; the sensed signal does not improve', direction: 1 },
                  { text: 'Oedema, with the kidney still retaining salt', direction: 1 },
                ]}
              />
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}

function EffectiveRow(props: { label: string; patch: ParamPatch; normal?: Evaluation; active: boolean; onClick: () => void; rel: (a?: number, b?: number) => string }) {
  const s = useSteady(makeParams(props.patch), 60);
  const e = s.ev;
  const n = props.normal;
  return (
    <tr class={props.active ? 'active' : ''} onClick={props.onClick} style={{ cursor: 'pointer' }}>
      <th scope="row">{props.label}</th>
      <td>{e ? `${e.kidney.urine.exc.Na.toFixed(0)} mmol/d` : '…'}</td>
      <td>{props.rel(e?.derived.ecfLiters, n?.derived.ecfLiters)}</td>
      <td>{props.rel(e?.plasma.plasmaVolume, n?.plasma.plasmaVolume)}</td>
      <td>{props.rel(e?.reg.CO, n?.reg.CO)}</td>
      <td>{props.rel(e?.reg.hormones.renin, n?.reg.hormones.renin)}</td>
    </tr>
  );
}

// ------------------------------------------------------------------------------------------------
// 5. Volume regulation and osmoregulation are different systems (Table 8-4)

const FLUIDS: { id: string; label: string; litres: number; na: number; extraNa?: number; expect: string }[] = [
  { id: 'saline', label: '2 L isotonic saline', litres: 2, na: 154, expect: 'Osmolality unchanged, so ADH and thirst are untouched: only volume regulation responds. The salt and water leave together in an isosmotic urine.' },
  { id: 'half', label: '2 L half-isotonic saline', litres: 2, na: 77, expect: 'Both systems act: hypo-osmolality suppresses ADH (dilute urine) while expansion suppresses renin and raises ANP (Na⁺-rich urine).' },
  { id: 'water', label: '2 L water', litres: 2, na: 0, expect: 'Pure osmoregulation: ADH is suppressed and the water is excreted as dilute urine, with little change in volume or Na⁺ excretion.' },
  { id: 'sweat', label: '2 L sweat lost (hot day)', litres: -2, na: 40, expect: 'Dilute fluid lost: osmolality and Na⁺ rise (thirst and ADH ↑) while volume falls (renin ↑). Urine: concentrated and Na⁺-poor.' },
  { id: 'diarrhoea', label: '3 L diarrhoea', litres: -3, na: 100, expect: 'Nearly isotonic loss: volume depletion without much change in Na⁺ concentration — hypovolaemia without dehydration.' },
  { id: 'crisps', label: 'Salty snack, no water (150 mmol NaCl)', litres: 0, na: 0, extraNa: 150, expect: 'Salt without water: osmolality rises (ADH and thirst ↑) and, as water leaves cells, the ECF expands (renin ↓, ANP ↑). Urine: concentrated but Na⁺-rich.' },
];

function OsmoTab() {
  const [id, setId] = useState('saline');
  const f = FLUIDS.find((x) => x.id === id)!;
  const p = useMemo(() => makeParams({}), []);
  const base = useSteady(p, 60);
  const after = useMemo(() => (base.state ? acute(p, withFluid(base.state.body, f.litres, f.na, f.extraNa ?? 0)) : undefined), [base.state, f]);
  const before = useMemo(() => (base.state ? acute(p, base.state.body) : undefined), [base.state]);

  const row = (label: string, a?: number, b?: number, unit?: string, digits = 1) => ({ label, a, b, unit, digits });
  const rows = before && after ? [
    row('Plasma Na⁺', before.plasma.Na, after.plasma.Na, 'mmol/L'),
    row('Effective osmolality', before.plasma.effOsm, after.plasma.effOsm, 'mOsm/kg', 0),
    row('ECF volume', before.derived.ecfLiters, after.derived.ecfLiters, 'L', 2),
    row('ADH', si.adh(before.reg.hormones.adh), si.adh(after.reg.hormones.adh), 'pmol/L'),
    row('Thirst (extra water drunk)', thirstDrive(before), thirstDrive(after), 'L/day', 2),
    row('Renin', before.reg.hormones.renin, after.reg.hormones.renin, '× normal', 2),
    row('Aldosterone', before.reg.hormones.aldo, after.reg.hormones.aldo, '× normal', 2),
    row('ANP', before.reg.hormones.anp, after.reg.hormones.anp, '× normal', 2),
    row('Urine osmolality', before.kidney.urine.osm, after.kidney.urine.osm, 'mOsm/kg', 0),
    row('Urine Na⁺ concentration', before.kidney.urine.Na, after.kidney.urine.Na, 'mmol/L', 0),
    row('Urine volume', before.kidney.urine.volumePerDay, after.kidney.urine.volumePerDay, 'L/day', 2),
  ] : [];

  return (
    <>
      <div class="btn-row" style={{ marginBottom: 10 }}>
        {FLUIDS.map((x) => (
          <button key={x.id} class={id === x.id ? 'active' : ''} onClick={() => setId(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Two separate control systems">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th />
                    <th>Osmoregulation</th>
                    <th>Volume regulation</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Sensed</th>
                    <td>Plasma osmolality</td>
                    <td>Effective circulating volume</td>
                  </tr>
                  <tr>
                    <th scope="row">Sensors</th>
                    <td>Hypothalamic osmoreceptors</td>
                    <td>Carotid sinus, afferent arteriole, atria</td>
                  </tr>
                  <tr>
                    <th scope="row">Effectors</th>
                    <td>ADH, thirst</td>
                    <td>RAAS, sympathetic nerves, ANP, pressure natriuresis (and ADH)</td>
                  </tr>
                  <tr>
                    <th scope="row">What changes</th>
                    <td>Water excretion and intake</td>
                    <td>Urinary Na⁺ excretion</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="control-hint">The only large overlap is that hypovolaemia also stimulates ADH — which is why volume depletion can cause hyponatraemia.</p>
          </Panel>
          <Panel title="Dehydration is not the same as volume depletion">
            <ul class="muted" style={{ fontSize: '0.88rem' }}>
              <li><strong>Dehydration</strong>: water loss raising the plasma Na⁺, with water drawn out of cells.</li>
              <li><strong>Volume depletion</strong>: loss of extracellular fluid — salt and water together.</li>
              <li>Diarrhoea with a normal plasma Na⁺ is volume depletion without dehydration; the treatment is salt-containing fluid, not water.</li>
            </ul>
          </Panel>
        </div>
        <div>
          <Panel title={f.label} note="The immediate response of the model, before balances have had days to shift.">
            <Busy on={base.busy} />
            <p class="muted" style={{ fontSize: '0.88rem' }}>{f.expect}</p>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Variable</th>
                    <th>Before</th>
                    <th>After</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const d = (r.a ?? 0) === 0 ? 0 : ((r.b ?? 0) - (r.a ?? 0)) / Math.abs(r.a ?? 1);
                    return (
                      <tr key={r.label}>
                        <th scope="row">{r.label}</th>
                        <td class="mono">{r.a?.toFixed(r.digits)}{r.unit ? ` ${r.unit}` : ''}</td>
                        <td class="mono">{r.b?.toFixed(r.digits)}{r.unit ? ` ${r.unit}` : ''}</td>
                        <td>{Math.abs(d) < 0.03 ? '=' : d > 0 ? '↑' : '↓'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
          <Predict
            question="A patient with profuse diarrhoea has a plasma Na⁺ of 140. Which system is disturbed?"
            options={['Osmoregulation', 'Volume regulation only — the Na⁺ concentration is normal because salt and water were lost together', 'Both equally', 'Neither']}
            correct={1}
            explanation="The loss was nearly isotonic, so tonicity is untouched and only the volume sensors respond: renin, aldosterone and sympathetic tone rise, and urine Na⁺ falls."
          />
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------------------------------------

const TAB_IDS = ['step', 'curve', 'clamp', 'effective', 'osmo'] as const;
const TABS: { id: Tab; label: string }[] = [
  { id: 'step', label: 'Step change in salt intake' },
  { id: 'curve', label: 'Pressure natriuresis' },
  { id: 'clamp', label: 'Aldosterone escape' },
  { id: 'effective', label: 'Effective circulating volume' },
  { id: 'osmo', label: 'Volume vs osmoregulation' },
];

export default function Sodium({ query }: { query: URLSearchParams }) {
  const [tab, setTab] = useTabParam('/sodium', TAB_IDS, 'step', query);
  return (
    <div>
      <PageHead
        path="/sodium"
        lede="What the body defends is tissue perfusion, and it defends it mainly by varying how much sodium the kidney excretes. Change the salt intake and watch balance be restored over days — but only after the volume has changed, because that change is the signal. Then take the regulators away one at a time and see what has to happen instead."
      />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'step' && <StepTab />}
      {tab === 'curve' && <CurveTab />}
      {tab === 'clamp' && <ClampTab />}
      {tab === 'effective' && <EffectiveTab />}
      {tab === 'osmo' && <OsmoTab />}
      <div class="grid grid-2" style={{ marginTop: 18 }}>
        <EquationCard eq="fena" compact />
        <Panel title="Where sodium excretion is actually adjusted">
          <ul class="muted" style={{ fontSize: '0.88rem', marginTop: 0 }}>
            <li><strong>Proximal tubule (60–65%)</strong>: angiotensin II, noradrenaline, peritubular capillary forces — recruited in marked hypovolaemia.</li>
            <li><strong>Loop (25–30%) and distal tubule (5%)</strong>: largely flow-dependent, so they follow delivery rather than regulating it.</li>
            <li><strong>Collecting tubules (~4%)</strong>: aldosterone and ANP — the fine control used day to day.</li>
            <li>Because regulation is spread across several systems, losing any one of them rarely upsets sodium balance: the others compensate, with pressure natriuresis as the final backstop.</li>
          </ul>
        </Panel>
      </div>
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>Urinary Na⁺ excretion matches intake, whatever the intake, within 3–4 days. Only about 0.5% of the filtered load is excreted.</p>}
          why={<p>Volume sensors (carotid sinus, afferent arteriole, atria) sense pressure and stretch and set renin–angiotensin–aldosterone, sympathetic tone and ANP, which act mainly on the proximal and collecting tubules.</p>}
          change={<p>Raise intake: retention for a few days, a small persistent expansion, and excretion that now matches intake. Remove a regulator and the same balance is reached by a larger change in volume and pressure.</p>}
          abnormal={<p>Heart failure and cirrhosis lower effective volume while ECF is expanded; the kidney keeps retaining Na⁺ and oedema forms. Fixed aldosterone or angiotensin II shifts the pressure–natriuresis curve to the right: hypertension is the price of balance.</p>}
          clinical={<p>A urine Na⁺ under 15–20 mmol/L is the practical marker of effective volume depletion — unless the kidney cannot conserve Na⁺ (diuretics, salt wasting) or is selectively under-perfused. Diuretics lose their effect after 1–2 weeks as counter-regulation restores balance at a smaller volume.</p>}
        />
        <Sources cite={{ rose: [8], evidence: 'physiology', refs: ['guyton1991', 'hall1984', 'walser1985', 'schrier1990', 'mcdonough2010'] }} />
      </Panel>
      <Related paths={['/body-water', '/raas', '/edema', '/diuretics', '/hyponatremia', '/adh']} />
    </div>
  );
}
