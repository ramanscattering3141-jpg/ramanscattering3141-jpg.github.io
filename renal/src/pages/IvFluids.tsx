import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { PageHead, Related, Toggle } from '../ui/page';
import { LineChart, Panel, Readout, Slider, Sources, toneFor, type Series } from '../ui/kit';
import { FLUIDS, PATIENTS, fateOf, simulate, type Fate, type FluidId, type Plan, type Snapshot } from '../sim/ivfluids';

const DEFAULT_PLAN: Plan = { fluid: 'saline', volume: 1, minutes: 30, maintenance: 0, pressor: false, diuretic: false, hours: 24 };

/** What the trials and physiology say for each patient — shown beside the simulation. */
const CLINICAL: Record<string, { points: string[]; refs: string[] }> = {
  healthy: {
    points: [
      'Only about a fifth of a litre of crystalloid is still in the plasma an hour later; most is interstitial. An excess of water is excreted within hours, but an excess of saline takes a day or more — only a third of 2 L had been excreted after 6 h in volunteers.',
      'Saline also lowers plasma albumin by more than dilution explains: more filtration carries more albumin out with it.',
    ],
    refs: ['lobo2001', 'hahn2010'],
  },
  hypovolaemic: {
    points: [
      'Isotonic losses (vomiting, diarrhoea, diuretics) empty plasma and interstitium together, so isotonic replacement refills both: expect roughly a quarter of what is given to stay in the circulation, and give enough to replace the whole ECF deficit.',
      'D5W is the wrong fluid here: two-thirds of it goes into cells.',
    ],
    refs: ['myburgh2013'],
  },
  haemorrhage: {
    points: [
      'After bleeding, capillary pressure is low and arterioles are constricted: infused fluid stays in the circulation longer than in a healthy person ("context sensitivity").',
      'Crystalloid restores volume but not oxygen-carrying capacity: watch the haemoglobin fall. Red cells stay entirely intravascular.',
    ],
    refs: ['hahn2010', 'chappell2008', 'woodcock2012'],
  },
  sepsis: {
    points: [
      'Albumin escapes more than three times faster than normal in septic shock, and the glycocalyx is damaged, so an hour after a litre of crystalloid less than a tenth remains in plasma; the cardiac output gain fades as the fluid leaks.',
      'Positive fluid balance tracks mortality (VASST), but in randomised trials restricting fluid after initial resuscitation neither helped nor harmed (CLASSIC, CLOVERS). Albumin was no better than saline for survival (SAFE, ALBIOS), though it needs less volume.',
      'Only about half of critically ill patients raise their cardiac output with a fluid bolus; test preload responsiveness (passive leg raise) rather than trusting the CVP.',
    ],
    refs: ['fleck1985', 'boyd2011', 'meyhoff2022classic', 'shapiro2023clovers', 'finfer2004safe', 'caironi2014albios', 'michard2002', 'monnet2016', 'marik2013cvp'],
  },
  hf: {
    points: [
      'The heart is on the flat part of its Starling curve: a bolus raises venous pressure rather than cardiac output, lymph is already running near capacity, and the fluid becomes oedema (and, in the lungs, pulmonary oedema).',
      'Venous congestion, more than low output, drives the fall in GFR in decompensated heart failure — so more fluid can worsen renal function. The treatment is decongestion: switch on the loop diuretic.',
    ],
    refs: ['mullens2009', 'felker2011dose'],
  },
  cirrhosis: {
    points: [
      'Splanchnic vasodilation and low albumin: the circulation is hyperdynamic but under-filled, and the kidney retains every mmol of sodium given. Saline mostly adds to ascites and oedema.',
      'Albumin (about 8 g per litre of ascites removed) after large-volume paracentesis prevents the circulatory dysfunction, hyponatraemia and renal impairment that otherwise follow.',
    ],
    refs: ['gines1988'],
  },
  nephrotic: {
    points: [
      'Plasma oncotic pressure is low but interstitial protein has fallen with it, so the gradient is partly preserved; much of the oedema reflects primary renal sodium retention (overfill). Saline adds to it; infused albumin is lost again in the urine within a day or two.',
    ],
    refs: ['levick2010'],
  },
  aki: {
    points: [
      'With no urine, every litre given stays in the body: fluid balance becomes cumulative, and a hyperchloraemic acidosis from saline cannot be excreted. Balanced solutions avoid the chloride load (SMART, PLUS).',
    ],
    refs: ['semler2018', 'finfer2022plus'],
  },
  postop: {
    points: [
      'Under anaesthesia and after surgery, renal clearance of infused fluid falls to a fraction of normal and ADH is high: crystalloid accumulates, and hypotonic fluid causes hyponatraemia. Much post-operative weight gain is infused fluid that has nowhere to go.',
    ],
    refs: ['hahn2010', 'chappell2008'],
  },
};

const pctFmt = (x: number) => `${Math.round(x * 100)}%`;

export default function IvFluids({ query }: { query: URLSearchParams }) {
  const [pid, setPid] = useState(query.get('p') ?? 'healthy');
  const [plan, setPlan] = useState<Plan>(DEFAULT_PLAN);
  const patient = PATIENTS.find((p) => p.id === pid) ?? PATIENTS[0];
  const fluid = FLUIDS.find((f) => f.id === plan.fluid)!;
  const up = (p: Partial<Plan>) => setPlan({ ...plan, ...p });

  const run = useMemo(() => {
    const withFluid = simulate(patient, plan);
    const without = simulate(patient, { ...plan, volume: 0 });
    return { withFluid, without, fate: fateOf(withFluid, without) };
  }, [pid, plan]);

  // ---- the time cursor and playback
  const [t, setT] = useState(plan.minutes / 60);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(2); // simulated hours per real second
  const tRef = useRef(t);
  tRef.current = t;
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const next = tRef.current + ((now - last) / 1000) * rate;
      last = now;
      if (next >= plan.hours) {
        setT(plan.hours);
        setPlaying(false);
        return;
      }
      setT(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, rate, plan.hours]);
  useEffect(() => {
    if (t > plan.hours) setT(plan.hours);
  }, [plan.hours]);

  const idx = Math.min(run.withFluid.length - 1, Math.round((t * 60) / 5));
  const now = run.withFluid[idx];
  const start = run.withFluid[0];
  const fate = run.fate[idx];

  // ---- comparison of every fluid in this patient, same volume, at fixed times
  const compare = useMemo(() => {
    return FLUIDS.filter((f) => f.id !== 'rbc').map((f) => {
      const vol = f.id === 'albumin25' || f.id === 'saline3' ? f.unit : plan.volume;
      const p: Plan = { ...plan, fluid: f.id, volume: vol, minutes: Math.max(15, plan.minutes), hours: 24 };
      const w = simulate(patient, p);
      const fa = fateOf(w, simulate(patient, { ...p, volume: 0 }));
      const at = (h: number) => fa.find((x) => x.t >= h) ?? fa[fa.length - 1];
      const peak = Math.max(...w.map((s) => s.co)) - w[0].co;
      const end = w[w.length - 1];
      return { f, vol, p30: at(0.5).plasma / vol, p1: at(1).plasma / vol, p6: at(6).plasma / vol, isf24: at(24).isf, icf24: at(24).icf, peak, na: end.na, hco3: end.hco3 };
    });
  }, [pid, plan.volume, plan.minutes, plan.pressor, plan.diuretic]);

  const hrs = (s: Snapshot[], f: (x: Snapshot) => number, label: string, color: string, axis?: string, dashed?: boolean): Series => ({ label, points: s.map((x) => ({ x: x.t, y: f(x) })), color, axis, dashed });
  const fateSeries: Series[] = [
    { label: 'in plasma', points: run.fate.map((x) => ({ x: x.t, y: x.plasma })), color: 'var(--c-red)' },
    { label: 'in the interstitium', points: run.fate.map((x) => ({ x: x.t, y: x.isf })), color: 'var(--c-blue)' },
    { label: 'in cells', points: run.fate.map((x) => ({ x: x.t, y: x.icf })), color: 'var(--c-violet)' },
    { label: 'excreted', points: run.fate.map((x) => ({ x: x.t, y: x.urine })), color: 'var(--c-amber)' },
  ];
  const clinical = CLINICAL[patient.id];

  return (
    <div>
      <PageHead
        path="/iv-fluids"
        lede="Choose a patient and a bag, and follow every millilitre: into the plasma, out across the capillaries, into or out of cells, and — if the kidney is able — into the urine. The same litre behaves very differently in a healthy volunteer, after bleeding, in septic shock and in heart failure."
      />
      <div class="grid grid-main-side" style={{ gridTemplateColumns: 'minmax(0, 1.55fr) minmax(0, 1fr)' }}>
        <div>
          <Panel title={`${fluid.name} · ${patient.name}`}>
            <div class="player" style={{ marginBottom: 8 }}>
              <button class="primary play" onClick={() => (t >= plan.hours ? (setT(0), setPlaying(true)) : setPlaying(!playing))}>
                {playing ? '❚❚ Pause' : t >= plan.hours ? '↺ Replay' : '▶ Play'}
              </button>
              <input type="range" min={0} max={plan.hours} step={1 / 12} value={t} onInput={(e) => (setPlaying(false), setT(parseFloat((e.target as HTMLInputElement).value)))} style={{ flex: 1, minWidth: 160 }} aria-label="Time since the infusion started" />
              <span class="mono" style={{ minWidth: 70 }}>{t < 1 ? `${Math.round(t * 60)} min` : `${t.toFixed(1)} h`}</span>
              {[0.5, 2, 6].map((r) => (
                <button key={r} class={rate === r ? 'active' : ''} onClick={() => setRate(r)} title={`${r} simulated hours per second`}>
                  {r < 1 ? '½' : r} h/s
                </button>
              ))}
            </div>
            <CompartmentView now={now} start={start} fate={fate} volume={plan.volume} infusing={t < plan.minutes / 60 && plan.volume > 0} />
            <div class="readout-grid" style={{ marginTop: 10 }}>
              <Readout label="Cardiac output" value={now.co} digits={1} unit="L/min" delta={now.co - start.co} deltaDigits={1} />
              <Readout label="Mean arterial pressure" value={now.map} unit="mmHg" tone={now.map < 65 ? 'danger' : 'normal'} delta={now.map - start.map} />
              <Readout label="Central venous pressure" value={now.cvp} digits={0} unit="mmHg" tone={now.cvp > 12 ? 'high' : 'normal'} delta={now.cvp - start.cvp} />
              <Readout label="Oedema (interstitium above normal)" value={now.oedema} digits={1} unit="L" tone={now.oedema > 2.5 ? 'high' : 'normal'} delta={now.oedema - start.oedema} deltaDigits={2} />
              <Readout label="Plasma Na⁺" value={now.na} digits={1} unit="mmol/L" tone={toneFor(now.na, 135, 145, [120, 160])} delta={now.na - start.na} deltaDigits={1} />
              <Readout label="Plasma Cl⁻" value={now.cl} digits={0} unit="mmol/L" tone={toneFor(now.cl, 98, 108)} delta={now.cl - start.cl} />
              <Readout label="HCO₃⁻ (estimated)" value={now.hco3} digits={1} unit="mmol/L" tone={toneFor(now.hco3, 22, 28)} delta={now.hco3 - start.hco3} deltaDigits={1} title="Na⁺ − Cl⁻ − weak acids (albumin, phosphate): a strong-ion estimate" />
              <Readout label="Albumin" value={now.albumin} digits={0} unit="g/L" tone={toneFor(now.albumin, 35, 50)} delta={now.albumin - start.albumin} />
              <Readout label="Haemoglobin" value={now.hb} digits={0} unit="g/L" tone={toneFor(now.hb, 120, 170)} delta={now.hb - start.hb} />
              <Readout label="Urine flow" value={now.urineRate * 1000} digits={0} unit="mL/h" tone={now.urineRate < 0.03 ? 'low' : 'normal'} />
            </div>
          </Panel>
        </div>
        <div>
          <Panel title="Patient">
            <div class="btn-row">
              {PATIENTS.map((p) => (
                <button key={p.id} class={p.id === pid ? 'active' : ''} onClick={() => (setPid(p.id), setT(plan.minutes / 60))}>
                  {p.name}
                </button>
              ))}
            </div>
            <p class="muted" style={{ fontSize: '0.88rem', marginBottom: 0 }}>
              {patient.summary}
            </p>
          </Panel>
          <Panel title="The bag">
            <div class="btn-row">
              {FLUIDS.map((f) => (
                <button key={f.id} class={f.id === plan.fluid ? 'active' : ''} onClick={() => up({ fluid: f.id as FluidId, volume: f.unit < 1 ? f.unit : plan.volume > 0 && FLUIDS.find((x) => x.id === plan.fluid)!.unit >= 1 ? plan.volume : 1 })}>
                  {f.short}
                </button>
              ))}
            </div>
            <p class="muted" style={{ fontSize: '0.86rem' }}>{fluid.note}</p>
            <Slider label="Volume" value={plan.volume} min={0} max={fluid.unit < 1 ? 1 : 4} step={fluid.unit < 1 ? 0.05 : 0.25} unit="L" format={(v) => v.toFixed(2)} onInput={(v) => up({ volume: v })} />
            <Slider label="Given over" value={plan.minutes} min={5} max={480} step={5} unit="min" onInput={(v) => up({ minutes: v })} />
            <Slider label="Maintenance 5% dextrose" value={plan.maintenance} min={0} max={3} step={0.5} unit="L/day" format={(v) => v.toFixed(1)} onInput={(v) => up({ maintenance: v })} hint="background free water, as often prescribed alongside" />
            <div class="btn-row" style={{ marginTop: 6 }}>
              {[6, 24, 72].map((h) => (
                <button key={h} class={plan.hours === h ? 'active' : ''} onClick={() => up({ hours: h })}>
                  Follow {h} h
                </button>
              ))}
            </div>
            <Toggle label="Noradrenaline (constricts arteries and veins)" checked={plan.pressor} onChange={(v) => up({ pressor: v })} />
            <Toggle label="Loop diuretic (releases the kidney’s sodium avidity)" checked={plan.diuretic} onChange={(v) => up({ diuretic: v })} />
          </Panel>
          <Panel title="What the evidence says">
            <ul style={{ fontSize: '0.88rem' }}>
              {clinical.points.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <Sources cite={{ rose: [7, 14, 16], evidence: 'clinical', refs: clinical.refs }} />
          </Panel>
        </div>
      </div>

      <div class="grid grid-2">
        <Panel title="Where the fluid is, hour by hour" note="Litres attributable to the bag: the course with the infusion minus the same patient without it. The four lines always add up to what has been given.">
          <LineChart series={fateSeries} xLabel="hours since the infusion started" yLabel="Litres of the infused fluid" marker={t} height={240} />
        </Panel>
        <Panel title="Circulation" note="Cardiac output rises only while the heart is on the steep part of its Starling curve; venous pressure rises regardless.">
          <LineChart
            series={[
              hrs(run.withFluid, (x) => x.co, 'cardiac output', 'var(--c-teal)', 'Cardiac output (L/min)'),
              hrs(run.without, (x) => x.co, 'without the fluid', 'var(--c-teal)', 'Cardiac output (L/min)', true),
              hrs(run.withFluid, (x) => x.map, 'mean arterial pressure', 'var(--c-red)', 'Pressure (mmHg)'),
              hrs(run.withFluid, (x) => x.cvp, 'central venous pressure', 'var(--c-blue)', 'Pressure (mmHg)'),
            ]}
            xLabel="hours since the infusion started"
            marker={t}
            height={240}
          />
        </Panel>
      </div>
      <div class="grid grid-2">
        <Panel title="Oedema" note="Interstitial fluid above normal. Pitting oedema becomes detectable at about 2.5–3 L in an adult (Rose ch. 16).">
          <LineChart
            series={[hrs(run.withFluid, (x) => x.oedema, 'with the fluid', 'var(--c-blue)'), hrs(run.without, (x) => x.oedema, 'without it', 'var(--c-blue)', undefined, true)]}
            bands={[{ from: 2.5, to: Math.max(3, ...run.withFluid.map((x) => x.oedema)) + 0.5, color: 'var(--c-amber)' }]}
            xLabel="hours since the infusion started"
            yLabel="Interstitial fluid above normal (L)"
            yMin={0}
            marker={t}
            height={200}
          />
        </Panel>
        <Panel title="Blood chemistry">
          <LineChart
            series={[
              hrs(run.withFluid, (x) => x.na, 'Na⁺', 'var(--c-teal)', 'Na⁺ and Cl⁻ (mmol/L)'),
              hrs(run.withFluid, (x) => x.cl, 'Cl⁻', 'var(--c-green)', 'Na⁺ and Cl⁻ (mmol/L)'),
              hrs(run.withFluid, (x) => x.hco3, 'HCO₃⁻ (estimated)', 'var(--c-violet)', 'HCO₃⁻ (mmol/L)'),
              hrs(run.withFluid, (x) => x.albumin, 'albumin', 'var(--c-amber)', 'Albumin (g/L)'),
            ]}
            xLabel="hours since the infusion started"
            marker={t}
            height={240}
          />
        </Panel>
      </div>

      <Panel title={`Every bag compared in this patient: ${patient.name.toLowerCase()}`} note="Same volume and rate as your plan (25% albumin and 3% saline at one usual unit). Share of the infused volume still in plasma at each time, and where the rest has settled a day later.">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fluid</th>
                <th class="num">Volume</th>
                <th class="num">In plasma at 30 min</th>
                <th class="num">at 1 h</th>
                <th class="num">at 6 h</th>
                <th class="num">Interstitium at 24 h</th>
                <th class="num">Cells at 24 h</th>
                <th class="num">Peak Δ cardiac output</th>
                <th class="num">Na⁺ at 24 h</th>
                <th class="num">HCO₃⁻ at 24 h</th>
              </tr>
            </thead>
            <tbody>
              {compare.map((r) => (
                <tr key={r.f.id} class={r.f.id === plan.fluid ? 'row-hit' : ''}>
                  <td>
                    <button class="ghost" style={{ padding: '1px 6px' }} onClick={() => up({ fluid: r.f.id, volume: r.vol })}>
                      {r.f.name}
                    </button>
                  </td>
                  <td class="num">{r.vol.toFixed(2)} L</td>
                  <td class="num">{pctFmt(r.p30)}</td>
                  <td class="num">{pctFmt(r.p1)}</td>
                  <td class="num">{pctFmt(r.p6)}</td>
                  <td class="num">{r.isf24.toFixed(2)} L</td>
                  <td class="num">{r.icf24.toFixed(2)} L</td>
                  <td class="num">{r.peak >= 0 ? '+' : ''}{r.peak.toFixed(2)} L/min</td>
                  <td class="num">{r.na.toFixed(1)}</td>
                  <td class="num">{r.hco3.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p class="control-hint">A share above 100% means the fluid drew extra water into the plasma (hyperoncotic albumin, hypertonic saline). Cells: negative = water drawn out of cells.</p>
      </Panel>

      <div class="grid grid-2">
        <Panel title="How the model works">
          <ul class="muted" style={{ fontSize: '0.88rem' }}>
            <li>Plasma, interstitium and cells for the 100 kg reference person (5, 15 and 40 L), stepped minute by minute.</li>
            <li>Filtration follows the Starling forces; the fluid returns as lymph, which speeds up as interstitial pressure rises and saturates near six times normal. Reversal of filtration is weak and brief (the revised Starling principle).</li>
            <li>The interstitium is stiff close to normal and slack beyond it, so once the lymph and pressure buffers are used up fluid pools as oedema.</li>
            <li>Water moves across cell membranes until osmolality is equal; glucose in D5W is metabolised, leaving free water.</li>
            <li>A Guyton circulation: venous return set by blood volume and venous tone meets a Frank–Starling cardiac curve. Noradrenaline raises resistance and recruits unstressed venous volume.</li>
            <li>The kidney excretes excess isotonic fluid slowly and free water quickly — unless perfusion is low, ADH is held up, or (heart failure, cirrhosis, nephrotic syndrome) it defends the expanded volume.</li>
          </ul>
        </Panel>
        <Panel title="Limits">
          <ul class="muted" style={{ fontSize: '0.88rem' }}>
            <li>Whole-body averages: no separate lung, gut or brain compartments, so "oedema" here is total interstitial excess.</li>
            <li>Patient parameters are chosen to reproduce the direction and rough size of published findings (volunteer infusion studies, albumin leak in sepsis, venous congestion in heart failure), not fitted to individual data.</li>
            <li>Bicarbonate is a strong-ion estimate from Na⁺, Cl⁻ and albumin; lactate, ketones and renal acid excretion are not modelled here.</li>
            <li>An educational model, not a prescribing tool.</li>
          </ul>
          <Sources cite={{ rose: [7, 16], evidence: 'reasoning', refs: ['levick2010', 'woodcock2012', 'hahn2010', 'lobo2001', 'fleck1985'] }} />
        </Panel>
      </div>
      <Related paths={['/body-water', '/edema', '/hypovolemia', '/sodium', '/hyponatremia']} />
    </div>
  );
}

/** Four compartments with their water levels, the share of the bag in each, and the flows between them. */
function CompartmentView(props: { now: Snapshot; start: Snapshot; fate: Fate; volume: number; infusing: boolean }) {
  const { now, start, fate } = props;
  const W = 860;
  const H = 350;
  const tanks = [
    { id: 'plasma', name: 'Plasma', x: 200, w: 140, v: now.plasma, v0: start.plasma, share: fate.plasma, color: 'var(--c-red)', gain: 2.2 },
    { id: 'isf', name: 'Interstitium', x: 490, w: 160, v: now.isf, v0: start.isf, share: fate.isf, color: 'var(--c-blue)', gain: 1.4 },
    { id: 'icf', name: 'Cells', x: 710, w: 140, v: now.icf, v0: start.icf, share: fate.icf, color: 'var(--c-violet)', gain: 3 },
  ];
  const top = 70;
  const bottom = 290;
  const level = (v: number, v0: number, gain: number) => Math.max(0.05, Math.min(0.98, 0.55 + ((v - v0) / v0) * gain));
  const arrowW = (lph: number) => Math.max(1.5, Math.min(9, 1.5 + Math.abs(lph) * 4));
  const netCap = now.filtration - now.lymphFlow;
  const bag = props.volume;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Where the infused fluid is: plasma, interstitium, cells and urine">
      <defs>
        <marker id="iv-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="14" markerHeight="14" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--ink-dim)" />
        </marker>
      </defs>
      {/* the bag */}
      <g>
        <rect x={30} y={70} width={110} height={150} rx={14} fill="color-mix(in srgb, var(--c-teal) 10%, transparent)" stroke="var(--c-teal)" stroke-width="2" />
        <rect x={30} y={70 + 150 * Math.min(1, Math.max(0, (now.infused - 0) / Math.max(bag, 0.001)))} width={110} height={Math.max(0, 150 * (1 - Math.min(1, now.infused / Math.max(bag, 0.001))))} rx={14} fill="color-mix(in srgb, var(--c-teal) 45%, transparent)" />
        <text x={85} y={60} text-anchor="middle" class="svg-label" style={{ fontWeight: 600, fill: 'var(--ink)', fontSize: 15.5 }}>
          The bag
        </text>
        <text x={85} y={150} text-anchor="middle" class="svg-value" style={{ fontSize: 18 }}>
          {Math.max(0, bag - now.infused).toFixed(2)} L
        </text>
        <text x={85} y={168} text-anchor="middle" class="svg-label">
          still to run
        </text>
        <path d={`M142,145 L192,145`} stroke="var(--c-teal)" stroke-width={props.infusing ? 5 : 1.5} marker-end="url(#iv-arrow)" opacity={props.infusing ? 1 : 0.35} />
      </g>
      {tanks.map((k) => {
        const lv = level(k.v, k.v0, k.gain);
        const y = bottom - (bottom - top) * lv;
        const y0 = bottom - (bottom - top) * 0.55;
        return (
          <g key={k.id}>
            <text x={k.x + k.w / 2} y={top - 26} text-anchor="middle" class="svg-label" style={{ fontWeight: 700, fill: 'var(--ink)', fontSize: 16.5 }}>
              {k.name}
            </text>
            <text x={k.x + k.w / 2} y={top - 10} text-anchor="middle" class="svg-value" style={{ fontSize: 14.5, fill: 'var(--ink-dim)' }}>
              {k.v.toFixed(2)} L ({k.v - k.v0 >= 0 ? '+' : ''}
              {(k.v - k.v0).toFixed(2)})
            </text>
            <rect x={k.x} y={top} width={k.w} height={bottom - top} rx={10} fill="var(--well)" stroke="var(--line)" stroke-width="1.5" />
            <rect x={k.x + 2} y={y} width={k.w - 4} height={bottom - y - 2} rx={8} fill={`color-mix(in srgb, ${k.color} 30%, transparent)`} />
            <line x1={k.x} x2={k.x + k.w} y1={y0} y2={y0} stroke="var(--ink-faint)" stroke-dasharray="4 3" />
            <text x={k.x + k.w - 4} y={y0 - 4} text-anchor="end" class="svg-label" style={{ fontSize: 13 }}>
              start
            </text>
            {k.id === 'isf' && start.isf < 15 + 2.5 && (
              <g>
                <line x1={k.x} x2={k.x + k.w} y1={bottom - (bottom - top) * level(15 + 2.5, k.v0, k.gain)} y2={bottom - (bottom - top) * level(15 + 2.5, k.v0, k.gain)} stroke="var(--c-amber)" stroke-dasharray="2 3" />
                <text x={k.x + k.w - 4} y={bottom - (bottom - top) * level(15 + 2.5, k.v0, k.gain) - 4} text-anchor="end" class="svg-label" style={{ fontSize: 13, fill: 'var(--c-amber)' }}>
                  visible oedema
                </text>
              </g>
            )}
            <text x={k.x + k.w / 2} y={bottom - 34} text-anchor="middle" class="svg-value svg-halo" style={{ fontSize: 20, fontWeight: 700, fill: k.color }}>
              {k.share >= 0 ? '+' : ''}
              {(k.share * 1000).toFixed(0)} mL
            </text>
            <text x={k.x + k.w / 2} y={bottom - 16} text-anchor="middle" class="svg-label svg-halo" style={{ fontSize: 13.5 }}>
              {bag > 0 ? `${Math.round((k.share / bag) * 100)}% of the bag` : 'no infusion'}
            </text>
          </g>
        );
      })}
      {/* capillary exchange: filtration out, lymph back */}
      <text x={415} y={top + 22} text-anchor="middle" class="svg-label" style={{ fontSize: 14, fontWeight: 600 }}>
        capillary wall
      </text>
      <path d={`M348,${top + 55} L478,${top + 55}`} stroke="var(--c-blue)" stroke-width={arrowW(now.filtration)} marker-end="url(#iv-arrow)" />
      <text x={415} y={top + 45} text-anchor="middle" class="svg-label" style={{ fontSize: 14 }}>
        filtration {(now.filtration * 1000).toFixed(0)} mL/h →
      </text>
      <path d={`M482,${top + 115} L352,${top + 115}`} stroke="var(--c-green)" stroke-width={arrowW(now.lymphFlow)} marker-end="url(#iv-arrow)" />
      <text x={415} y={top + 140} text-anchor="middle" class="svg-label" style={{ fontSize: 14 }}>
        ← lymph {(now.lymphFlow * 1000).toFixed(0)} mL/h
      </text>
      <text x={415} y={top + 172} text-anchor="middle" class="svg-label" style={{ fontSize: 14.5, fontWeight: 600, fill: Math.abs(netCap) > 0.02 ? 'var(--c-blue)' : 'var(--ink-faint)' }}>
        net {netCap >= 0 ? 'out of' : 'into'} plasma
      </text>
      <text x={415} y={top + 188} text-anchor="middle" class="svg-value" style={{ fontSize: 14.5, fill: Math.abs(netCap) > 0.02 ? 'var(--c-blue)' : 'var(--ink-faint)' }}>
        {Math.abs(netCap * 1000).toFixed(0)} mL/h
      </text>
      {/* osmotic exchange with cells */}
      <text x={680} y={top + 90} text-anchor="middle" class="svg-label" style={{ fontSize: 22, fill: 'var(--c-violet)' }}>
        ⇄
      </text>
      <text x={680} y={top + 108} text-anchor="middle" class="svg-label" style={{ fontSize: 13.5 }}>
        osmosis
      </text>
      {/* kidney */}
      <path d={`M270,${bottom} L270,${bottom + 26}`} stroke="var(--c-amber)" stroke-width={arrowW(now.urineRate)} marker-end="url(#iv-arrow)" />
      <text x={284} y={bottom + 24} class="svg-label" style={{ fontSize: 14.5 }}>
        urine {(now.urineRate * 1000).toFixed(0)} mL/h · {(fate.urine * 1000).toFixed(0)} mL of the bag excreted ({bag > 0 ? Math.round((fate.urine / bag) * 100) : 0}%)
      </text>
    </svg>
  );
}
