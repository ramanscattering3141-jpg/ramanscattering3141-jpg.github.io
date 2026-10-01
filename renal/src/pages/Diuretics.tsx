import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related, Busy, useTabParam } from '../ui/page';
import { Panel, Readout, Slider, Sources, Predict, BarRow, Tabs, Expand, LineChart, Chain, type Series } from '../ui/kit';
import { BedsideEquations } from '../ui/EquationCard';
import { DiureticMap } from '../ui/DiureticMap';
import { NephronDiagram, type Mark, type StructureId } from '../ui/NephronDiagram';
import { acute, makeParams, useAcute, useStep, NORMAL } from '../sim/hooks';
import type { Drugs, ParamPatch } from '../engine/types';

const TAB_IDS = ['map', 'classes', 'timecourse', 'braking', 'resistance'] as const;
type Tab = (typeof TAB_IDS)[number];

interface DrugSpec {
  key: keyof Drugs;
  name: string;
  target: string;
  site: StructureId;
  /** Rose Table 15-1: the ceiling on fractional Na+ excretion */
  ceiling: string;
  note: string;
}

const DRUGS: DrugSpec[] = [
  { key: 'furosemide', name: 'Loop diuretic', target: 'NKCC2 (Na⁺-K⁺-2Cl⁻)', site: 'TAL', ceiling: 'up to 20–25%', note: 'Furosemide, bumetanide, torsemide, ethacrynic acid. Competes for the chloride site on the carrier. Also acts at the macula densa, which is why it releases renin, and increases calcium excretion because loop Ca²⁺ reabsorption is driven passively by NaCl transport.' },
  { key: 'thiazide', name: 'Thiazide', target: 'NCC (Na⁺-Cl⁻)', site: 'DCT', ceiling: 'up to 3–5%', note: 'Acts in the distal tubule and connecting segment. Lowers calcium excretion — the opposite of a loop diuretic — which is why it is used in hypercalciuric stone disease. Acting in the cortex, it leaves the medullary gradient intact, and that is why hyponatraemia is a thiazide problem.' },
  { key: 'amiloride', name: 'Amiloride / triamterene', target: 'ENaC (Na⁺ channel)', site: 'CCD', ceiling: 'up to 1–2%', note: 'Blocks the channel directly. Removing the lumen-negative voltage removes the drive for both K⁺ and H⁺ secretion, so hyperkalaemia and a metabolic acidosis follow. Amiloride is also used in lithium-induced nephrogenic diabetes insipidus, because lithium enters the cell through the same channel.' },
  { key: 'spironolactone', name: 'Spironolactone (MRA)', target: 'Mineralocorticoid receptor', site: 'CCD', ceiling: 'up to 1–2%', note: 'The only diuretic that does not need to reach the tubular lumen: it enters the cell across the basolateral membrane and competes with aldosterone for its receptor. That is why it is first choice in cirrhosis, where bile salts compete for the proximal organic anion pump.' },
  { key: 'acetazolamide', name: 'Acetazolamide', target: 'Carbonic anhydrase', site: 'PT', ceiling: 'modest', note: 'Acts where most sodium is reabsorbed and is still weak, because the loop of Henle reclaims most of the extra delivery — transport there rises with the chloride delivered. It is also self-limiting, since the bicarbonate it wastes produces a metabolic acidosis. Useful in oedema with metabolic alkalosis, and to increase delivery to the loop when that is what limits a diuretic.' },
];

const CASES: { label: string; patch: ParamPatch; explain: string; tab?: Tab }[] = [
  { label: 'Furosemide, maximal', patch: { drugs: { furosemide: 1 } }, explain: 'Blocking NKCC2 entirely: the largest fractional excretion any class achieves.' },
  { label: 'Thiazide, maximal', patch: { drugs: { thiazide: 1 } }, explain: 'A much smaller natriuresis — the distal tubule reabsorbs far less than the loop.' },
  { label: 'Acetazolamide', patch: { drugs: { acetazolamide: 1 } }, explain: 'Acts on 60% of the filtered load and is still weak: watch the loop take up the extra delivery.' },
  { label: 'Loop + thiazide', patch: { drugs: { furosemide: 1, thiazide: 1 } }, explain: 'Sequential blockade. The thiazide now blocks a segment that is reabsorbing far more than usual.' },
  { label: 'Loop + thiazide + amiloride', patch: { drugs: { furosemide: 1, thiazide: 1, amiloride: 1 } }, explain: 'Every downstream escape blocked. This is also how patients lose 5 L and 200 mmol of K⁺ in a day.' },
  { label: 'Spironolactone alone', patch: { drugs: { spironolactone: 1 } }, explain: 'Weak as a diuretic, but the choice in cirrhosis — and at 25 mg a day, a drug that changes survival in heart failure.' },
];

export default function Diuretics({ query }: { query: URLSearchParams }) {
  const [tab, setTab] = useTabParam('/diuretics', TAB_IDS, 'map', query);
  return (
    <div>
      <PageHead
        path="/diuretics"
        lede="A diuretic blocks one transporter at one site. Everything else about it — how potent it is, why the diuresis stops, why the first dose is the largest, why restricting salt matters as much as the dose — follows from what the rest of the nephron does next."
      />
      <Tabs
        tabs={[
          { id: 'map', label: 'Diuretic map' },
          { id: 'classes', label: 'The classes' },
          { id: 'timecourse', label: 'Why the diuresis stops' },
          { id: 'braking', label: 'How the kidney defends volume' },
          { id: 'resistance', label: 'Resistance & sequential blockade' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'map' && (
        <Panel title="Where each diuretic acts" note="Every class is drawn at its site with an inhibition bar (⊣). Hover, tap or tab to a segment or a drug for its transporters and its effect on sodium, potassium, calcium, magnesium, acid–base and water.">
          <DiureticMap />
        </Panel>
      )}
      {tab === 'classes' && <Classes />}
      {tab === 'timecourse' && <TimeCourse />}
      {tab === 'braking' && <Braking />}
      {tab === 'resistance' && <Resistance />}
      <BedsideEquations
        ids={['unauk', 'feurea']}
        intro="Two checks for a patient whose diuretic does not seem to work: is sodium actually reaching the urine (Na⁺/K⁺ ratio), and is the kidney under-perfused (FEUrea, which diuretics do not distort)."
      />
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>Nothing: a diuretic is a drug. In a person in balance, sodium intake equals sodium output at a normal extracellular volume.</p>}
          why={<p>Each class blocks the luminal sodium entry step of one segment. Potency depends on how much sodium that segment handles <em>and</em> on how much the segments downstream can recover.</p>}
          change={<p>Block the loop and the distal tubule takes up some of the load; block the proximal tubule and the loop takes up nearly all of it. Block two sites at once and the recovery has nowhere to go.</p>}
          abnormal={<p>Volume depletion and pre-renal azotaemia, hypokalaemia with metabolic alkalosis (loop and thiazide), hyperkalaemia with acidosis (potassium-sparing), thiazide-induced hyponatraemia, hyperuricaemia and mild magnesium depletion.</p>}
          clinical={<p>Expect a limited, self-terminating loss. Find the effective single dose by doubling. Check a 24-hour urinary sodium before calling a patient resistant. Use the lowest thiazide dose that controls the blood pressure.</p>}
        />
        <Sources cite={{ rose: [15, 4, 5, 8], evidence: 'clinical', refs: ['brater1998', 'wilcox1983', 'loon1989', 'kaissling1988', 'felker2011dose', 'mullens2022advor', 'trullas2023clorotic'] }} />
      </Panel>
      <Related paths={['/drug-map', '/edema', '/transport', '/loop', '/distal', '/hypokalemia', '/metabolic-alkalosis']} />
    </div>
  );
}

// ---------------------------------------------------------------- the classes
function Classes() {
  const [doses, setDoses] = useState<Record<string, number>>({});
  const set = (k: keyof Drugs, v: number) => setDoses({ ...doses, [k]: v });
  const params = useMemo(() => makeParams({ naIntake: 150, drugs: doses as Partial<Drugs> }), [JSON.stringify(doses)]);
  const ev = useAcute(params);
  const normal = NORMAL();
  const active = DRUGS.filter((d) => (doses[d.key] ?? 0) > 0.02);
  // Each agent alone at full blockade, so the table can be compared with the book's column
  // rather than repeating whatever combination happens to be selected.
  const soloMax = useMemo(() => {
    const out = {} as Record<keyof Drugs, number>;
    for (const d of DRUGS) out[d.key] = acute(makeParams({ naIntake: 150, drugs: { [d.key]: 1 } })).derived.FENa;
    return out;
  }, []);

  const marks: Partial<Record<StructureId, Mark>> = {};
  for (const d of active) marks[d.site] = 'drug';
  const notes: Partial<Record<StructureId, string>> = {};
  const filtered = (ev.kidney.GFR * ev.plasma.Na) / 1000;
  for (const id of ['PT', 'TAL', 'DCT', 'CNT', 'CCD'] as StructureId[]) {
    const s = ev.kidney.segments[id as keyof typeof ev.kidney.segments];
    if (s) notes[id] = `${(((s.in.Na - s.out.Na) / filtered) * 100).toFixed(1)}% Na⁺`;
  }

  return (
    <>
      <WhatIf
        options={CASES.map((c) => ({ label: c.label, explain: c.explain }))}
        onApply={(o) => {
          const c = CASES.find((x) => x.label === o.label)!;
          setDoses({ ...(c.patch.drugs as Record<string, number>) });
        }}
        onReset={() => setDoses({})}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Dose" note="Each slider is the fraction of that transporter blocked, not milligrams — the model has no pharmacology beyond the site of action.">
            {DRUGS.map((d) => (
              <Slider
                key={d.key}
                label={d.name}
                value={doses[d.key] ?? 0}
                min={0}
                max={1}
                step={0.05}
                format={(v) => (v === 0 ? 'off' : `${(v * 100).toFixed(0)}% blocked`)}
                onInput={(v) => set(d.key, v)}
                hint={`${d.target} — ${d.site}`}
              />
            ))}
          </Panel>
          <Panel title="The immediate response" note="Before body composition has changed: the peak of the dose, not what the day will bring.">
            <div class="readout-grid">
              <Readout label="FENa" value={ev.derived.FENa} digits={2} unit="%" delta={ev.derived.FENa - normal.derived.FENa} deltaDigits={2} tone={ev.derived.FENa > 2 ? 'high' : 'normal'} />
              <Readout label="Urine volume" value={ev.kidney.urine.volumePerDay} digits={2} unit="L/day" tone={ev.kidney.urine.volumePerDay > 3 ? 'high' : 'normal'} />
              <Readout label="Na⁺ excretion" value={ev.kidney.urine.exc.Na} digits={0} unit="mmol/day" />
              <Readout label="K⁺ excretion" value={ev.kidney.urine.exc.K} digits={0} unit="mmol/day" tone={ev.kidney.urine.exc.K > 120 ? 'high' : ev.kidney.urine.exc.K < 40 ? 'low' : 'normal'} />
              <Readout label="Urine pH" value={ev.kidney.urine.pH} digits={2} tone={ev.kidney.urine.pH > 7 ? 'high' : 'normal'} />
              <Readout label="HCO₃⁻ excretion" value={ev.kidney.urine.exc.HCO3} digits={0} unit="mmol/day" tone={ev.kidney.urine.exc.HCO3 > 40 ? 'high' : 'normal'} />
              <Readout label="Calcium excretion" value={ev.kidney.urine.exc.Ca} digits={1} unit="mmol/day" tone={ev.kidney.urine.exc.Ca > 6 ? 'high' : ev.kidney.urine.exc.Ca < 2.5 ? 'low' : 'normal'} />
              <Readout label="Renin" value={ev.reg.hormones.renin} digits={2} unit="×normal" tone={ev.reg.hormones.renin > 2 ? 'high' : 'normal'} />
            </div>
          </Panel>
          {active.length > 0 && (
            <Panel title="What you have blocked">
              {active.map((d) => (
                <div key={d.key} class="note" style={{ marginBottom: 8 }}>
                  <strong>{d.name}</strong> — {d.target}, {d.site}. Ceiling {d.ceiling}.
                  <div style={{ marginTop: 4 }}>{d.note}</div>
                </div>
              ))}
            </Panel>
          )}
        </div>
        <div>
          <Panel title="Where the sodium goes" note="Each segment's share of the filtered load, live. Purple marks a blocked site.">
            <NephronDiagram marks={marks} notes={notes} height={420} medullaOsm={ev.kidney.medullaOM} />
          </Panel>
          <Panel title="Segment by segment" note="Compare the blocked segment with the one after it: that is the compensation.">
            {(['PT', 'TAL', 'DCT', 'CNT', 'CCD'] as StructureId[]).map((id) => {
              const s = ev.kidney.segments[id as keyof typeof ev.kidney.segments];
              const n = normal.kidney.segments[id as keyof typeof normal.kidney.segments];
              if (!s || !n) return null;
              const nowPct = ((s.in.Na - s.out.Na) / filtered) * 100;
              const wasPct = ((n.in.Na - n.out.Na) / ((normal.kidney.GFR * normal.plasma.Na) / 1000)) * 100;
              return (
                <BarRow
                  key={id}
                  label={`${id}${marks[id] ? ' — blocked' : ''}`}
                  value={nowPct}
                  max={85}
                  unit="% of filtered Na⁺"
                  color={marks[id] ? 'var(--c-violet)' : nowPct > wasPct * 1.15 ? 'var(--c-green)' : 'var(--c-blue)'}
                  sub={`normally ${wasPct.toFixed(1)}%${nowPct > wasPct * 1.15 ? ' — compensating' : ''}`}
                />
              );
            })}
            <BarRow label="Excreted" value={ev.derived.FENa} max={85} unit="% of filtered Na⁺" color="var(--c-amber)" sub={`normally ${normal.derived.FENa.toFixed(2)}%`} />
          </Panel>
          <Panel title="Rose Table 15-1">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Site</th>
                    <th>Carrier or channel</th>
                    <th>Max % filtered Na⁺</th>
                    <th>This model</th>
                  </tr>
                </thead>
                <tbody>
                  {DRUGS.map((d) => (
                    <tr key={d.key}>
                      <th scope="row">{d.site}</th>
                      <td>{d.target}</td>
                      <td>{d.ceiling}</td>
                      <td class="mono">{soloMax[d.key].toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p class="control-hint">
              Potency does not follow the size of the load at the blocked site. The proximal tubule reabsorbs the most sodium and acetazolamide is the weakest agent here, because loop transport rises
              with the chloride delivered to it.
            </p>
          </Panel>
        </div>
      </div>
      <Predict
        question="Acetazolamide blocks reabsorption in the segment that handles 60% of the filtered sodium. Why is it a weak diuretic?"
        options={['It is poorly absorbed', 'The loop of Henle reclaims most of the extra delivery, and the resulting acidosis is self-limiting', 'It does not reach the lumen', 'It raises aldosterone']}
        correct={1}
        explanation="Loop transport is flow-dependent — it rises with the chloride delivered. Set acetazolamide to maximum above and watch the TAL's share of the filtered load rise rather than the excretion. Add a loop diuretic and the same proximal effect is unmasked."
      />
    </>
  );
}

// ---------------------------------------------------------------- Fig 15-1
function TimeCourse() {
  const [diet, setDiet] = useState(270);
  const [dose, setDose] = useState(0.9);
  const [perDay, setPerDay] = useState(1);
  const base = useMemo(() => makeParams({ naIntake: diet }), [diet]);
  const on = useMemo(() => makeParams({ naIntake: diet, diureticDoses: perDay, drugs: { furosemide: dose } }), [diet, dose, perDay]);
  const { points, busy } = useStep(base, on, 4, 0.021, 60);

  const blocks = useMemo(() => {
    if (!points) return [];
    const out: { label: string; mean: number }[] = [];
    for (let i = 0; i < 4; i++) {
      const pts = points.filter((p) => p.day >= i * 0.25 && p.day < (i + 1) * 0.25);
      out.push({ label: `${i * 6}–${(i + 1) * 6} h`, mean: pts.length ? pts.reduce((s, p) => s + p.urineNa, 0) / pts.length : 0 });
    }
    return out;
  }, [points]);
  const net1 = points ? nearest(points, 1).naBalance : 0;
  const net3 = points ? nearest(points, 3).naBalance : 0;
  const ecf3 = points ? nearest(points, 3).ecf : 0;

  return (
    <>
      <WhatIf
        options={[
          { label: 'Rose Fig. 15-1', explain: '40 mg of furosemide once a day in someone eating 270 mmol of sodium: a brisk natriuresis for six hours, then eighteen hours of retention, and no net loss over the day.' },
          { label: 'Restrict the salt', explain: 'The preferred lever. With less sodium to retain in the off-hours, the same dose now produces real, sustained loss — and less potassium wasting.' },
          { label: 'Give it twice a day', explain: 'Two natriuretic windows instead of one, so less time for retention.' },
          { label: 'Raise the dose', explain: 'Works, but the larger initial diuresis is what causes symptomatic hypovolaemia.' },
          { label: 'Continuous infusion', explain: 'No off-hours at all. The drug never wears off, so the retention phase never happens — but the kidney still defends volume by other means.' },
        ]}
        onApply={(o) => {
          if (o.label === 'Rose Fig. 15-1') { setDiet(270); setDose(0.9); setPerDay(1); }
          if (o.label === 'Restrict the salt') { setDiet(40); setDose(0.9); setPerDay(1); }
          if (o.label === 'Give it twice a day') { setDiet(270); setDose(0.9); setPerDay(2); }
          if (o.label === 'Raise the dose') { setDiet(270); setDose(1); setPerDay(1); }
          if (o.label === 'Continuous infusion') { setDiet(270); setDose(0.9); setPerDay(0); }
        }}
        onReset={() => { setDiet(270); setDose(0.9); setPerDay(1); }}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="The experiment">
            <Slider label="Dietary sodium" value={diet} min={20} max={400} step={10} unit="mmol/day" onInput={setDiet} normal={270} hint="Rose's subjects ate 270 mmol/day" />
            <Slider label="Furosemide dose" value={dose} min={0} max={1} step={0.05} format={(v) => `${(v * 100).toFixed(0)}% NKCC2 blocked`} onInput={setDose} />
            <Slider
              label="Doses per day"
              value={perDay}
              min={0}
              max={3}
              step={1}
              format={(v) => (v === 0 ? 'continuous infusion' : `${v} × daily`)}
              onInput={setPerDay}
              hint="each dose acts for about six hours, then wears off"
            />
          </Panel>
          <Panel title="Net sodium balance">
            <Busy on={busy} />
            <div class="readout-grid">
              <Readout label="Over 24 hours" value={net1} digits={0} unit="mmol" tone={net1 > -40 ? 'danger' : 'good'} />
              <Readout label="Over 3 days" value={net3} digits={0} unit="mmol" tone={net3 > -40 ? 'danger' : 'good'} />
              <Readout label="Extracellular volume, day 3" value={ecf3} digits={2} unit="L" />
            </div>
            <p class={net1 > -40 ? 'callout danger' : 'callout good'} style={{ marginTop: 8 }}>
              {net1 > -40
                ? `Almost no net sodium loss (${net1.toFixed(0)} mmol over the day). The natriuresis was real; the eighteen hours of retention that followed cancelled it. This is the single most important thing to understand about diuretic therapy.`
                : `A real net loss of ${Math.abs(net1).toFixed(0)} mmol over the day, and the extracellular volume falls. ${
                    diet < 120 ? 'Restricting sodium is what made the difference — there was less to retain once the drug wore off.' : perDay > 1 ? 'Splitting the dose gave a second natriuretic window and less time to retain.' : 'The dose or the infusion is carrying it.'
                  }`}
            </p>
          </Panel>
        </div>
        <div>
          <Panel title="Sodium excretion, six hours at a time" note="Rose Fig. 15-1. The dashed line is intake; the blocks below it are the retention that cancels the diuresis.">
            {blocks.map((b) => (
              <BarRow key={b.label} label={b.label} value={b.mean} max={Math.max(diet * 1.4, ...blocks.map((x) => x.mean))} unit=" mmol/day rate" color={b.mean > diet ? 'var(--c-green)' : 'var(--c-coral)'} sub={b.mean > diet ? 'above intake — losing sodium' : 'below intake — retaining'} />
            ))}
            <BarRow label="Sodium intake" value={diet} max={Math.max(diet * 1.4, ...blocks.map((x) => x.mean))} unit=" mmol/day" color="var(--ink-faint)" />
          </Panel>
          <Panel title="Four days" note="Excretion as a six-hourly mean, the way Rose's figure plots it. The instantaneous peak is many times higher and lasts minutes; what determines balance is the area.">
            {points && (
              <LineChart yLabel="Na⁺ (mmol/day)"
                xLabel="days"
                series={[
                  { label: 'Na⁺ excretion, 6-hourly mean', points: sixHourly(points), color: 'var(--c-amber)' },
                  { label: 'Na⁺ intake', points: points.map((p) => ({ x: p.day, y: diet })), color: 'var(--ink-faint)' },
                ] as Series[]}
                yMin={0}
                height={200}
              />
            )}
            {points && (
              <LineChart yLabel="Cumulative Na⁺ balance (mmol)"
                xLabel="days"
                series={[{ label: 'Cumulative Na⁺ balance (mmol)', points: points.map((p) => ({ x: p.day, y: p.naBalance })), color: 'var(--c-blue)' }] as Series[]}
                height={170}
              />
            )}
            <p class="control-hint">
              The cumulative curve is the one that matters clinically. A sawtooth that returns to zero each day is a patient who is not losing fluid however impressive the urine output looks.
            </p>
          </Panel>
        </div>
      </div>
      <div class="grid grid-2">
        <Panel title="Rose's three ways to produce a net diuresis">
          <Chain
            steps={[
              { text: 'A single daily dose gives ~6 h of natriuresis and ~18 h of retention' },
              { text: 'Restrict dietary sodium — less to retain in the off-hours, and less K⁺ wasting', direction: 1 },
              { text: 'or give the diuretic twice a day', direction: 1 },
              { text: 'or raise the dose — at the cost of symptomatic hypovolaemia', direction: 1 },
            ]}
          />
          <p class="note" style={{ marginBottom: 0 }}>
            Salt restriction is the preferred method, because it also limits the potassium loss that the natriuretic windows cause.
          </p>
        </Panel>
        <Predict
          question="A patient on furosemide is still oedematous. The 24-hour urinary sodium is 190 mmol. What does that mean?"
          options={['The diuretic is not working — increase the dose', 'The diuretic is working; the sodium intake is too high', 'There is renal failure', 'The drug is not being absorbed']}
          correct={1}
          explanation="Excreting 190 mmol a day means the drug reached its target. Above 100–150 mmol/day the problem is diet, not drug. Set the diet slider high above and watch the net balance return to zero however large the natriuretic burst is."
        />
      </div>
    </>
  );
}

// ---------------------------------------------------------------- braking
function Braking() {
  const [arm, setArm] = useState<'none' | 'loop' | 'blocked'>('loop');
  const diet = 270;
  const base = useMemo(() => makeParams({ naIntake: diet }), []);
  const to = useMemo(() => {
    if (arm === 'none') return makeParams({ naIntake: diet });
    if (arm === 'loop') return makeParams({ naIntake: diet, diureticDoses: 0, drugs: { furosemide: 0.9 } });
    // captopril + prazosin: the renin-angiotensin limb and the alpha-1 limb both blocked
    return makeParams({ naIntake: diet, diureticDoses: 0, drugs: { furosemide: 0.9, acei: 0.9 }, snsOverride: 0.35 });
  }, [arm]);
  const { points, busy } = useStep(base, to, 2, 0.021, 60);
  const control = useStep(base, base, 2, 0.021, 60);
  const day1 = points ? nearest(points, 1) : undefined;
  const ctl1 = control.points ? nearest(control.points, 1) : undefined;

  return (
    <>
      <Panel title="Rose Fig. 15-1, the second experiment" note="If sodium retention after a diuretic were simply the renin–angiotensin and sympathetic systems at work, blocking both should abolish it. It does not.">
        <div class="btn-row" style={{ marginBottom: 10 }}>
          <button class={arm === 'none' ? 'active' : ''} onClick={() => setArm('none')}>No drug</button>
          <button class={arm === 'loop' ? 'active' : ''} onClick={() => setArm('loop')}>Furosemide</button>
          <button class={arm === 'blocked' ? 'active' : ''} onClick={() => setArm('blocked')}>Furosemide + captopril + prazosin</button>
        </div>
        <Busy on={busy} />
        {day1 && ctl1 && (
          <div class="readout-grid">
            <Readout label="Mean arterial pressure, day 1" value={day1.MAP} digits={1} unit="mmHg" delta={day1.MAP - ctl1.MAP} deltaDigits={1} tone={day1.MAP < ctl1.MAP - 8 ? 'low' : 'normal'} />
            <Readout label="Aldosterone" value={day1.aldo} digits={2} unit="×normal" tone={day1.aldo > 2 ? 'high' : 'normal'} />
            <Readout label="Na⁺ excretion, day 1" value={day1.urineNa} digits={0} unit="mmol/day" />
            <Readout label="Cumulative Na⁺ balance" value={day1.naBalance} digits={0} unit="mmol" tone={day1.naBalance < -100 ? 'good' : 'normal'} />
          </div>
        )}
        {arm === 'blocked' && day1 && ctl1 && (
          <p class="callout" style={{ marginTop: 8 }}>
            Blood pressure has fallen {Math.abs(day1.MAP - ctl1.MAP).toFixed(0)} mmHg — Rose reports a mean fall of about 13 mmHg in this experiment. With the vasoconstrictors blocked there is nothing
            to hold the pressure up, and the lower renal perfusion pressure retains sodium directly, by pressure natriuresis running in reverse. The kidney has more than one way to defend its volume,
            and removing one exposes another.
          </p>
        )}
      </Panel>
      <div class="grid grid-2">
        <Panel title="What angiotensin II and noradrenaline are actually for">
          <Chain
            steps={[
              { text: 'Volume depletion' },
              { text: 'Angiotensin II and noradrenaline rise', direction: 1 },
              { text: 'They constrict vessels — blood pressure is held up' },
              { text: 'and they raise tubular Na⁺ reabsorption', direction: 1 },
              { text: 'Without them: pressure falls, and pressure natriuresis would otherwise make the hypovolaemia worse', direction: -1 },
            ]}
          />
          <p class="control-hint">
            This is why the two effects go together. A vasoconstrictor that did not also retain sodium would leave the kidney excreting salt at a normal pressure while the patient was dry.
          </p>
        </Panel>
        <Panel title="The three brakes, in order of appearance">
          <ol style={{ paddingLeft: 18, lineHeight: 1.7 }}>
            <li>
              <strong>Neurohumoral.</strong> Angiotensin II raises proximal reabsorption; aldosterone raises it in the collecting tubule. Both sites are ones the diuretic does not block.
            </li>
            <li>
              <strong>Flow-dependent.</strong> More sodium delivered past the blocked segment is more sodium reabsorbed downstream. With chronic loop diuretic use the distal tubule and collecting duct
              hypertrophy, with a measurable rise in Na⁺-K⁺-ATPase activity.
            </li>
            <li>
              <strong>Pressure.</strong> If blood pressure falls, the kidney retains sodium for that reason alone — the limb that survives when the other two are blocked.
            </li>
          </ol>
          <p class="control-hint">Later, if renal perfusion falls far enough, less drug is secreted into the lumen and the diuretic itself becomes less effective.</p>
        </Panel>
      </div>
      <Predict
        question="Captopril and prazosin are given with the furosemide, blocking the renin–angiotensin and sympathetic responses. What happens to the secondary sodium retention?"
        options={['It is abolished', 'It still occurs — blood pressure falls instead, and pressure natriuresis is lost', 'It doubles', 'Sodium excretion becomes uncontrolled']}
        correct={1}
        explanation="Try it above. Volume defence is redundant: block the hormonal limb and the pressure limb takes over. This is also a caution about reasoning from a single mechanism."
      />
    </>
  );
}

// ---------------------------------------------------------------- resistance
function Resistance() {
  const [loop, setLoop] = useState(0.9);
  const [thiazide, setThiazide] = useState(0);
  const [kSparing, setKSparing] = useState(0);
  const [acz, setAcz] = useState(0);
  const [chronic, setChronic] = useState(1);
  const params = useMemo(
    () => makeParams({ naIntake: 150, distalAdaptation: chronic, drugs: { furosemide: loop, thiazide, amiloride: kSparing, acetazolamide: acz } }),
    [loop, thiazide, kSparing, acz, chronic],
  );
  const ev = useAcute(params);
  const loopOnly = useAcute(useMemo(() => makeParams({ naIntake: 150, distalAdaptation: chronic, drugs: { furosemide: loop } }), [loop, chronic]));
  const added = ev.derived.FENa - loopOnly.derived.FENa;

  const combination = [thiazide, kSparing, acz].filter((x) => x > 0.02).length > 0 && loop > 0.02;

  return (
    <>
      <WhatIf
        options={[
          { label: 'Loop alone', explain: 'A maximal loop diuretic in a patient who has never had one: no distal hypertrophy yet.' },
          { label: 'After weeks of loop therapy', explain: 'The same dose, but the distal tubule has hypertrophied. The loop diuretic now achieves less — this is diuretic resistance, and it is a property of the nephron, not of the drug.' },
          { label: 'Add a thiazide', explain: 'Sequential blockade. The thiazide blocks the segment that hypertrophied, so it adds more than it would in an untreated patient.' },
          { label: 'Add a K⁺-sparing agent too', explain: 'Mainly to limit potassium loss — it adds little sodium of its own.' },
          { label: 'Add acetazolamide', explain: 'For the patient in whom too little sodium reaches the loop to block. With the loop already blocked, the proximal effect is unmasked.' },
        ]}
        onApply={(o) => {
          if (o.label === 'Loop alone') { setLoop(0.9); setThiazide(0); setKSparing(0); setAcz(0); setChronic(1); }
          if (o.label === 'After weeks of loop therapy') { setLoop(0.9); setThiazide(0); setKSparing(0); setAcz(0); setChronic(1.8); }
          if (o.label === 'Add a thiazide') { setLoop(0.9); setThiazide(0.8); setKSparing(0); setAcz(0); setChronic(1.8); }
          if (o.label === 'Add a K⁺-sparing agent too') { setLoop(0.9); setThiazide(0.8); setKSparing(0.8); setAcz(0); setChronic(1.8); }
          if (o.label === 'Add acetazolamide') { setLoop(0.9); setThiazide(0.8); setKSparing(0.8); setAcz(0.8); setChronic(1.8); }
        }}
        onReset={() => { setLoop(0.9); setThiazide(0); setKSparing(0); setAcz(0); setChronic(1); }}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Build the regimen">
            <Slider label="Loop diuretic" value={loop} min={0} max={1} step={0.05} format={(v) => `${(v * 100).toFixed(0)}%`} onInput={setLoop} />
            <Slider label="Thiazide added" value={thiazide} min={0} max={1} step={0.05} format={(v) => `${(v * 100).toFixed(0)}%`} onInput={setThiazide} hint="blocks the segment that hypertrophied" />
            <Slider label="K⁺-sparing added" value={kSparing} min={0} max={1} step={0.05} format={(v) => `${(v * 100).toFixed(0)}%`} onInput={setKSparing} hint="mainly to limit K⁺ loss" />
            <Slider label="Acetazolamide added" value={acz} min={0} max={1} step={0.05} format={(v) => `${(v * 100).toFixed(0)}%`} onInput={setAcz} hint="when too little reaches the loop to block" />
            <Slider
              label="Distal adaptation"
              value={chronic}
              min={1}
              max={2}
              step={0.05}
              format={(v) => (v < 1.05 ? 'none (first dose)' : `${v.toFixed(2)}× — weeks of loop therapy`)}
              onInput={setChronic}
              hint="chronic loop therapy hypertrophies the distal tubule"
            />
          </Panel>
          <Panel title="Result" note="The peak of the dose, before any balance has shifted — not a daily total. A urine volume here is the rate the kidney is briefly working at, and braking begins within hours.">
            <div class="readout-grid">
              <Readout label="FENa" value={ev.derived.FENa} digits={2} unit="%" tone={ev.derived.FENa > 2 ? 'high' : 'normal'} />
              <Readout label="Added by the combination" value={added} digits={2} unit="% points" tone={added > 0.5 ? 'good' : 'normal'} />
              <Readout label="Urine volume" value={ev.kidney.urine.volumePerDay} digits={2} unit="L/day" tone={ev.kidney.urine.volumePerDay > 5 ? 'danger' : 'normal'} />
              <Readout label="K⁺ excretion" value={ev.kidney.urine.exc.K} digits={0} unit="mmol/day" tone={ev.kidney.urine.exc.K > 200 ? 'danger' : ev.kidney.urine.exc.K > 120 ? 'high' : 'normal'} />
            </div>
            {combination && ev.kidney.urine.exc.K > 200 && (
              <p class="callout danger" style={{ marginTop: 8 }}>
                Combination therapy, with potassium leaving at {ev.kidney.urine.exc.K.toFixed(0)} mmol/day at the peak. Rose: previously refractory patients given combination therapy have lost 5 L of
                fluid and 200 mmol of potassium in a single day. Start with a low thiazide dose, add a potassium-sparing agent unless the patient is already hyperkalaemic, and monitor on day one —
                when the response is largest.
              </p>
            )}
            {combination && kSparing < 0.02 && (
              <p class="callout" style={{ marginTop: 8 }}>
                No potassium-sparing agent in this regimen. Rose adds one to combination therapy specifically to limit potassium loss; it contributes little sodium of its own.
              </p>
            )}
          </Panel>
        </div>
        <div>
          <Panel title="Why adding a thiazide to a loop diuretic works" note="Raise the distal adaptation slider — the thiazide's contribution grows, because it is now blocking a segment doing more work.">
            <BarRow label="Loop alone" value={loopOnly.derived.FENa} max={Math.max(6, ev.derived.FENa * 1.2)} unit="% FENa" color="var(--c-blue)" />
            <BarRow label="The regimen you built" value={ev.derived.FENa} max={Math.max(6, ev.derived.FENa * 1.2)} unit="% FENa" color="var(--c-green)" />
            <p class="control-hint">
              Increased delivery past the loop causes distal hypertrophy and a rise in Na⁺-K⁺-ATPase activity. In one study the natriuretic response to an added thiazide was about 20% greater in
              patients pre-treated with furosemide than in those given placebo.
            </p>
          </Panel>
          <Panel title="Rose Table 15-3: refractory oedema, in order">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Problem</th>
                    <th>What to do</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Excess sodium intake</th>
                    <td>Measure 24-hour urinary sodium; above 100–150 mmol/day the diet is the problem</td>
                  </tr>
                  <tr>
                    <th scope="row">Delayed intestinal absorption</th>
                    <td>Bowel wall oedema; switch to intravenous if high-dose oral fails</td>
                  </tr>
                  <tr>
                    <th scope="row">Too little drug in the lumen</th>
                    <td>Double the single dose to the ceiling; spironolactone in cirrhosis; albumin with the diuretic in severe hypoalbuminaemia</td>
                  </tr>
                  <tr>
                    <th scope="row">Increased distal reabsorption</th>
                    <td>More frequent dosing; add a thiazide ± a potassium-sparing agent</td>
                  </tr>
                  <tr>
                    <th scope="row">Too little sodium reaching the loop</th>
                    <td>Acetazolamide to reduce proximal reabsorption; supine posture or head-down tilt; dialysis or haemofiltration if severe</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>
          <Expand summary="Why spironolactone is first choice in cirrhosis">
            <p>
              Two reasons, and only one of them is about potency. Cirrhotic ascites comes with marked hyperaldosteronism, so fluid delivered out of the loop is reclaimed in the collecting tubule —
              the segment spironolactone blocks. And spironolactone is the only diuretic that does not need to reach the tubular lumen: it enters the cell across the basolateral membrane and competes
              with aldosterone for its receptor, so competition from bile salts for the proximal organic anion pump does not matter. Avoiding hypokalaemia matters too, since it can precipitate
              encephalopathy. The usual regimen is a single morning dose of spironolactone 100 mg with furosemide 40 mg, a ratio that generally keeps potassium normal.
            </p>
          </Expand>
        </div>
      </div>
      <Expand summary="What modern trials have said about all this" open>
        <div class="grid grid-2">
          <div class="note">
            <strong>Bolus versus infusion (DOSE, 2011).</strong> The chapter prefers a continuous infusion, reasoning from the drug-excretion-rate curve. Randomised, there was no significant difference
            between bolus and infusion in symptoms or renal function, and only a non-significant trend favouring a higher dose. The reasoning holds; the expected clinical advantage did not appear.
          </div>
          <div class="note">
            <strong>Acetazolamide (ADVOR, 2022).</strong> The chapter's suggestion, tested: added to a loop diuretic in acute heart failure, successful decongestion within three days rose from 30.5% to
            42.2% (risk ratio 1.46), with more urine output and natriuresis. No difference in death or rehospitalisation.
          </div>
          <div class="note">
            <strong>Sequential blockade (CLOROTIC, 2023).</strong> Hydrochlorothiazide added to intravenous furosemide gave more weight loss (2.3 vs 1.5 kg at 72 h) and better diuretic efficiency — and
            substantially more renal impairment (46.5% vs 17.2%). The chapter's own warning, quantified.
          </div>
          <div class="note">
            <strong>Spironolactone (RALES, 1999).</strong> 25 mg a day added to standard therapy in severe heart failure reduced death from 46% to 35%. A dose too small to be meaningfully natriuretic:
            mineralocorticoid antagonists turned out to be disease-modifying drugs rather than diuretics.
          </div>
        </div>
      </Expand>
    </>
  );
}

function nearest<T extends { day: number }>(points: T[], day: number): T {
  return points.reduce((best, p) => (Math.abs(p.day - day) < Math.abs(best.day - day) ? p : best), points[0]);
}

/**
 * Sodium excretion averaged over each six-hour block, which is how Rose Fig. 15-1 plots it. The
 * instantaneous rate after a dose is many times higher and lasts minutes; plotting that hides the
 * thing the figure is about — that the excretion between doses falls below intake.
 */
function sixHourly(points: { day: number; urineNa: number }[]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const last = points[points.length - 1]?.day ?? 0;
  for (let t = 0; t < last; t += 0.25) {
    const inBlock = points.filter((p) => p.day >= t && p.day < t + 0.25);
    if (!inBlock.length) continue;
    const mean = inBlock.reduce((s, p) => s + p.urineNa, 0) / inBlock.length;
    // drawn as a step, so each block reads as a flat six-hour rate
    out.push({ x: t, y: mean }, { x: t + 0.25, y: mean });
  }
  return out;
}
