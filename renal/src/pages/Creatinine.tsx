import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related, Toggle } from '../ui/page';
import { Panel, Readout, Slider, Sources, Predict, LineChart, Chain } from '../ui/kit';
import { EquationCard } from '../ui/EquationCard';
import { equationById } from '../content/equations';

interface S {
  baseGfr: number;
  newGfr: number;
  injuryDays: number; // 0 = permanent
  weight: number;
  age: number;
  female: boolean;
  muscle: number;
  secretionBlock: boolean;
  meatMeal: boolean;
}
const START: S = { baseGfr: 120, newGfr: 120, injuryDays: 0, weight: 70, age: 40, female: false, muscle: 1, secretionBlock: false, meatMeal: false };

/** Creatinine generation, mg/day (Rose ch. 2: men 28 − 0.2·age, women 22 − age/9, mg/kg/day). */
const generation = (s: S) => (s.female ? 22 - s.age / 9 : 28 - 0.2 * s.age) * s.weight * s.muscle;

/**
 * One-compartment creatinine kinetics. Excretion = (filtration + secretion) × Pcr.
 * Secretion adds ~15% of filtration normally, more as GFR falls, until it saturates.
 */
function secretionFraction(gfr: number, block: boolean) {
  if (block) return 0.02;
  return Math.min(0.6, 0.15 * Math.pow(120 / Math.max(gfr, 5), 0.6));
}

function kinetics(s: S) {
  const G = generation(s); // mg/day
  const Vd = s.weight * (s.female ? 0.5 : 0.6) * 10; // dL (total body water)
  const clAt = (gfr: number) => gfr * (1 + secretionFraction(gfr, s.secretionBlock)); // mL/min
  const ss = (gfr: number) => (G / (clAt(gfr) * 1440)) * 100; // mg/dL
  let pcr = (G / (s.baseGfr * (1 + secretionFraction(s.baseGfr, false)) * 1440)) * 100;
  const pts: { day: number; pcr: number; gfr: number; egfr: number }[] = [];
  const dt = 0.05;
  const days = 21;
  for (let t = 0; t <= days + 1e-9; t += dt) {
    const gfr = t < 1 ? s.baseGfr : s.injuryDays > 0 && t >= 1 + s.injuryDays ? s.baseGfr : s.newGfr;
    const meal = s.meatMeal && t >= 1 && t < 1.25 ? 400 / 0.25 : 0; // ~400 mg extra over 6 h
    const excretionPerDay = (clAt(gfr) * 1440 * pcr) / 100;
    pcr += ((G + meal - excretionPerDay) / Vd) * dt;
    if (Math.abs(t - Math.round(t * 4) / 4) < 1e-6) pts.push({ day: t, pcr, gfr, egfr: ckdEpi(pcr, s.age, s.female) });
  }
  return { pts, G, ssBase: ss(s.baseGfr), ssNew: ss(s.newGfr) };
}

function ckdEpi(scr: number, age: number, female: boolean) {
  const eq = equationById.get('ckdepi')!;
  return eq.compute({ scr, age, female: female ? 1 : 0 }).value;
}

export default function Creatinine() {
  const [s, setS] = useState<S>({ ...START, newGfr: 30 });
  const up = (p: Partial<S>) => setS({ ...s, ...p });
  const k = useMemo(() => kinetics(s), [s]);
  const last = k.pts[k.pts.length - 1];
  const day2 = k.pts.find((p) => p.day >= 2)!;
  const hyper = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    for (let g = 5; g <= 150; g += 2.5) pts.push({ x: g, y: (k.G / (g * (1 + secretionFraction(g, s.secretionBlock)) * 1440)) * 100 });
    return pts;
  }, [k.G, s.secretionBlock]);
  const pureFiltration = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    for (let g = 5; g <= 150; g += 2.5) pts.push({ x: g, y: (k.G / (g * 1440)) * 100 });
    return pts;
  }, [k.G]);

  return (
    <div>
      <PageHead path="/creatinine" lede="Serum creatinine is the kidney’s most-used report card — and a lagging, muscle-dependent, secretion-contaminated one. Drop the GFR and watch creatinine climb over days, not minutes; change the patient and watch the same GFR produce a different creatinine." />
      <WhatIf
        options={[
          { label: 'Sudden 90% fall in GFR', explain: 'Day 1 creatinine is near normal; it climbs ~1–2 mg/dL/day and plateaus after 1–2 weeks. Any estimating equation applied on day 2 is badly wrong.' },
          { label: 'Transient 3-day injury', explain: 'The peak comes as GFR is already recovering — creatinine lags on the way down too.' },
          { label: 'Same GFR, small elderly woman', explain: 'Lower muscle mass means lower production, so a GFR of 40 can sit behind a “normal” creatinine.' },
          { label: 'Trimethoprim', explain: 'Blocking secretion raises creatinine with no change in GFR.' },
          { label: 'Cooked-meat meal', explain: 'Heating converts creatine to creatinine: a transient rise without any change in filtration.' },
          { label: 'Halve GFR from normal', explain: 'The first half of the GFR costs only ~0.5–0.8 mg/dL of creatinine — the steep part of the hyperbola is at low GFR.' },
        ]}
        onApply={(o) => {
          const m: Record<string, Partial<S>> = {
            'Sudden 90% fall in GFR': { newGfr: 12 },
            'Transient 3-day injury': { newGfr: 15, injuryDays: 3 },
            'Same GFR, small elderly woman': { newGfr: 40, baseGfr: 40, weight: 45, age: 82, female: true },
            Trimethoprim: { newGfr: 120, secretionBlock: true },
            'Cooked-meat meal': { newGfr: 120, meatMeal: true },
            'Halve GFR from normal': { newGfr: 60 },
          };
          setS({ ...START, ...m[o.label] });
        }}
        onReset={() => setS(START)}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="The event">
            <Slider label="Baseline GFR" value={s.baseGfr} min={10} max={150} unit="mL/min" onInput={(v) => up({ baseGfr: v })} />
            <Slider label="GFR from day 1" value={s.newGfr} min={2} max={150} unit="mL/min" onInput={(v) => up({ newGfr: v })} />
            <Slider label="Injury lasts" value={s.injuryDays} min={0} max={14} step={1} format={(v) => (v === 0 ? 'permanent' : `${v} days`)} onInput={(v) => up({ injuryDays: v })} />
            <Toggle label="Blocks creatinine secretion (trimethoprim, cimetidine)" checked={s.secretionBlock} onChange={(v) => up({ secretionBlock: v })} />
            <Toggle label="Large cooked-meat meal on day 1" checked={s.meatMeal} onChange={(v) => up({ meatMeal: v })} />
          </Panel>
          <Panel title="The patient">
            <Slider label="Weight" value={s.weight} min={35} max={130} unit="kg" onInput={(v) => up({ weight: v })} />
            <Slider label="Age" value={s.age} min={18} max={95} unit="y" onInput={(v) => up({ age: v })} />
            <Slider label="Muscle mass" value={s.muscle} min={0.4} max={1.5} step={0.05} unit="× typical" onInput={(v) => up({ muscle: v })} hint="Cirrhosis, malnutrition, amputation, bed rest lower it" />
            <Toggle label="Female" checked={s.female} onChange={(v) => up({ female: v })} />
            <div class="readout-grid">
              <Readout label="Creatinine production" value={k.G} unit="mg/day" />
              <Readout label="per kg" value={k.G / s.weight} digits={1} unit="mg/kg/day" />
            </div>
          </Panel>
        </div>
        <div>
          <Panel title="Three weeks of serum creatinine" note="The true GFR (right axis scaled into the same chart as GFR ÷ 20) changes instantly; creatinine follows over days. The eGFR calculated from each day's creatinine is shown for comparison.">
            <LineChart
              xLabel="day"
              series={[
                { label: 'Serum creatinine (mg/dL)', points: k.pts.map((p) => ({ x: p.day, y: p.pcr })), color: '#f2b134' },
                { label: 'True GFR ÷ 20', points: k.pts.map((p) => ({ x: p.day, y: p.gfr / 20 })), color: '#5ecfba' },
                { label: 'eGFR from that day’s creatinine ÷ 20', points: k.pts.map((p) => ({ x: p.day, y: Math.min(p.egfr, 160) / 20 })), color: '#6aa9e8', dashed: true },
              ]}
              yMin={0}
              height={250}
            />
            <div class="readout-grid">
              <Readout label="Creatinine before" value={k.pts[0].pcr} digits={2} unit="mg/dL" />
              <Readout label="Creatinine day 2" value={day2.pcr} digits={2} unit="mg/dL" />
              <Readout label="Day 21" value={last.pcr} digits={2} unit="mg/dL" />
              <Readout label="New steady state" value={k.ssNew} digits={2} unit="mg/dL" />
              <Readout label="eGFR on day 2" value={day2.egfr} unit="mL/min" tone={Math.abs(day2.egfr - s.newGfr) > 20 ? 'danger' : 'normal'} title="CKD-EPI 2021 applied to a non-steady-state creatinine" />
              <Readout label="True GFR on day 2" value={day2.gfr} unit="mL/min" />
            </div>
          </Panel>
          <div class="grid grid-2">
            <Panel title="The steady-state hyperbola" note="Solid: this patient (filtration plus secretion). Dashed: if creatinine were only filtered. Production shifts the whole curve.">
              <LineChart
                xLabel="GFR (mL/min)"
                series={[
                  { label: 'with secretion', points: hyper, color: '#f2b134' },
                  { label: 'filtration only', points: pureFiltration, color: '#f2b134', dashed: true },
                ]}
                yMin={0}
                yMax={Math.min(15, Math.max(4, k.ssNew * 1.3))}
                marker={s.newGfr}
              />
            </Panel>
            <Panel title="Why creatinine lags">
              <Chain
                steps={[
                  { text: 'GFR falls: filtered creatinine falls at once', direction: -1 },
                  { text: 'Production is unchanged, so creatinine accumulates', direction: 1 },
                  { text: 'Each day Pcr rises by (production − excretion) ÷ volume of distribution (total body water)', direction: 1 },
                  { text: 'As Pcr rises, filtered load (GFR × Pcr) climbs back toward production', direction: 1 },
                  { text: 'New steady state when GFR × Pcr = production again — days later', direction: 0 },
                ]}
              />
            </Panel>
          </div>
        </div>
      </div>
      <div class="grid grid-2">
        <Predict
          question="Two patients have a creatinine of 1.4 mg/dL: an 85 kg man of 20 and a 40 kg woman of 80. Their creatinine clearances are about:"
          options={['Equal', '≈100 and ≈20 mL/min', '≈50 and ≈50 mL/min']}
          correct={1}
          explanation="Cockcroft–Gault: (140−20)×85/(72×1.4) ≈ 101 mL/min; (140−80)×40/(72×1.4)×0.85 ≈ 20 mL/min. Production differs five-fold, so the same creatinine means very different filtration."
        />
        <EquationCard eq="cockcroft" />
      </div>
      <EquationCard eq="ckdepi" />
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>Creatinine is made from muscle creatine at a steady rate and excreted mostly by filtration, so in a steady state Pcr ≈ production ÷ GFR.</p>}
          why={<p>Accumulation needs time: the plasma level rises only as fast as unexcreted production accumulates in total body water.</p>}
          change={<p>Halving GFR doubles creatinine — eventually. Production (muscle, meat) and secretion shift the curve; the hyperbola makes early GFR loss hard to see and late loss easy to see.</p>}
          abnormal={<p>Rising secretion hides early GFR loss (a stable Pcr &lt;1.5 mg/dL does not prove stable disease); low muscle mass hides advanced loss; drugs blocking secretion mimic loss.</p>}
          clinical={<p>Estimating equations need a steady state. In acute kidney injury, a rising creatinine means GFR is lower than any equation says; KDIGO staging relies on the change in creatinine and on urine output instead.</p>}
        />
        <Sources cite={{ rose: [2], evidence: 'physiology', refs: ['cockcroft1976', 'inker2021ckdepi', 'kellum2013aki'] }} />
      </Panel>
      <Related paths={['/clearance', '/aki', '/ckd', '/gfr']} />
    </div>
  );
}
