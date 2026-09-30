import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related, Busy, Toggle, useTabParam } from '../ui/page';
import { Panel, Readout, Slider, Sources, Predict, Tabs, Chain, LineChart, Expand, toneFor, type Series } from '../ui/kit';
import { EquationCard } from '../ui/EquationCard';
import { EcgStrip } from '../ui/EcgStrip';
import { acute, makeParams, useCrisis, useSteady } from '../sim/hooks';
import type { CrisisKind, CrisisPoint, Rx } from '../sim/hyperglycemia';

const TAB_IDS = ['shift', 'crisis', 'treat', 'kidney'] as const;
type Tab = (typeof TAB_IDS)[number];
const TABS: { id: Tab; label: string }[] = [
  { id: 'shift', label: 'Glucose and the sodium' },
  { id: 'crisis', label: 'Three patients, one lesion' },
  { id: 'treat', label: 'Treating the crisis' },
  { id: 'kidney', label: 'The kidney helps and harms' },
];

const mgdl = (mmol: number) => Math.round(mmol * 18);

// ---------------------------------------------------------------- 1. translocation

function ShiftTab() {
  const [glu, setGlu] = useState(40);
  const [days, setDays] = useState(false);
  const normal = useMemo(() => acute(makeParams()), []);
  const now = useMemo(() => acute(makeParams({ glucose: glu * 18 }), normal.body), [glu]);
  const later = useSteady(makeParams({ glucose: glu * 18 }), 20);
  const shown = days && later.ev ? later.ev : now;
  const katz = 139 - (1.6 * Math.max(0, glu - 5.3)) / 5.6;
  const hillier = 139 - (2.4 * Math.max(0, glu - 5.3)) / 5.6;
  const curve = useMemo(() => {
    const model: Series['points'] = [];
    const k: Series['points'] = [];
    const h: Series['points'] = [];
    for (let g = 5; g <= 80; g += 5) {
      model.push({ x: g, y: acute(makeParams({ glucose: g * 18 }), normal.body).plasma.Na });
      k.push({ x: g, y: normal.plasma.Na - (1.6 * (g - 5.3)) / 5.6 });
      h.push({ x: g, y: normal.plasma.Na - (2.4 * (g - 5.3)) / 5.6 });
    }
    return { model, k, h };
  }, []);
  const corrected = shown.plasma.Na + (2.4 * Math.max(0, glu - 5.6)) / 5.6;

  return (
    <>
      <WhatIf
        options={[
          { label: 'Mild (15 mmol/L)', apply: () => setGlu(15), explain: 'Below the renal threshold for much glucosuria; the sodium falls by only 2–4 mmol/L.' },
          { label: 'Typical DKA (30 mmol/L)', apply: () => setGlu(30), explain: 'The sodium falls 7–11 mmol/L by dilution alone: a "low" sodium that is not water excess.' },
          { label: 'Rose’s example (55 mmol/L)', apply: () => setGlu(55.5), explain: 'Glucose 1000 mg/dL: sodium 140 → about 118 on Hillier’s factor, and the effective osmolality still only about 290 + 23 — hyperglycaemia alone does not make marked hyperosmolality.' },
          { label: 'Extreme (80 mmol/L)', apply: () => setGlu(80), explain: 'Seen in dialysis patients, who have no osmotic diuresis to cap the glucose.' },
        ]}
        onApply={() => {}}
        onReset={() => setGlu(5.3)}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Raise the glucose">
            <Slider label="Plasma glucose" value={glu} min={5} max={80} step={0.5} format={(v) => `${v.toFixed(1)} mmol/L (${mgdl(v)} mg/dL)`} onInput={setGlu} normal={5.3} />
            <Toggle label="…and let thirst and ADH act for several days" checked={days} onChange={setDays} hint="With thirst intact, water is drunk until the effective osmolality is back near 290." />
            <Busy on={days && later.busy} />
          </Panel>
          <Panel title={days ? 'After days, thirst intact' : 'Within minutes (no water in or out)'}>
            <div class="readout-grid">
              <Readout label="Measured Na⁺" value={shown.plasma.Na} digits={1} unit="mmol/L" tone={toneFor(shown.plasma.Na, 135, 145, [120, 160])} delta={shown.plasma.Na - normal.plasma.Na} deltaDigits={1} />
              <Readout label="Corrected Na⁺ (×2.4)" value={corrected} digits={1} unit="mmol/L" tone={toneFor(corrected, 135, 145)} title="the sodium once the glucose is gone" />
              <Readout label="Effective osmolality" value={shown.plasma.effOsm} digits={0} unit="mOsm/kg" tone={toneFor(shown.plasma.effOsm, 275, 295, [260, 330])} />
              <Readout label="Measured osmolality" value={shown.plasma.osm} digits={0} unit="mOsm/kg" />
              <Readout label="Extracellular volume" value={shown.plasma.ecf} digits={1} unit="L" delta={shown.plasma.ecf - normal.plasma.ecf} deltaDigits={1} title="water drawn out of cells" />
              <Readout label="Plasma K⁺" value={shown.plasma.K} digits={2} unit="mmol/L" tone={toneFor(shown.plasma.K, 3.5, 5.0)} title="hyperosmolality drags K⁺ out of cells" />
            </div>
            <p class="note" style={{ marginBottom: 0 }}>
              {days
                ? 'Thirst restores the tonicity by adding water, so the measured sodium falls further — but the corrected sodium says the body water is about right. In a patient who cannot drink, the osmotic diuresis would instead push both up.'
                : 'Nothing has been lost or gained: water has only moved from cells into the extracellular fluid. The sodium is diluted while the osmolality rises.'}
            </p>
          </Panel>
        </div>
        <div>
          <Panel title="Sodium against glucose, before any water is gained or lost" note="The model solves the body as an ideal osmometer, which lands on Katz's 1.6 mmol/L per 5.6 mmol/L. Hillier's volunteers fell faster above about 22 mmol/L; 2.4 per 5.6 fitted their data better overall.">
            <LineChart
              xLabel="plasma glucose (mmol/L)"
              series={[
                { label: 'This model', points: curve.model, color: '#5ecfba' },
                { label: 'Katz 1.6', points: curve.k, color: '#6aa9e8', dashed: true },
                { label: 'Hillier 2.4', points: curve.h, color: '#f2b134', dashed: true },
              ]}
              marker={glu}
              height={220}
            />
            <div class="chips">
              <span class="tag">Katz at this glucose: {katz.toFixed(0)}</span>
              <span class="tag">Hillier: {hillier.toFixed(0)}</span>
            </div>
          </Panel>
          <Panel title="Why the sodium falls">
            <Chain
              steps={[
                { text: 'Glucose rises in the extracellular fluid; without insulin it enters cells slowly', direction: 1 },
                { text: 'Extracellular osmolality exceeds intracellular' },
                { text: 'Water leaves the cells', mechanism: 'cell volume falls — including brain cells' },
                { text: 'Extracellular volume expands and its Na⁺ is diluted', direction: -1 },
                { text: 'Total osmolality still ends up higher than before', direction: 1 },
                { text: 'Insulin reverses all of it: glucose and water re-enter cells and the Na⁺ rises', direction: 1 },
              ]}
            />
          </Panel>
        </div>
      </div>
      <div class="grid grid-2" style={{ marginTop: 12 }}>
        <EquationCard eq="nacorr" compact />
        <EquationCard eq="effosm" compact />
      </div>
      <Predict
        question="A patient has a glucose of 45 mmol/L and a measured sodium of 141 mmol/L. As insulin brings the glucose to 10, what happens to the sodium if nothing else is given?"
        options={['Falls toward 130', 'Stays about 141', 'Rises toward 155', 'Cannot be predicted']}
        correct={2}
        explanation="The corrected sodium is about 141 + 2.4 × (45 − 5.6)/5.6 ≈ 158. A normal measured sodium at that glucose means water has already been lost in excess of Na⁺ + K⁺; the hypernatraemia surfaces as glucose and water move back into cells."
      />
    </>
  );
}

// ---------------------------------------------------------------- 2. crises

const KINDS: { id: CrisisKind; label: string; hours: number; blurb: string }[] = [
  { id: 'dka', label: 'Ketoacidosis (young, type 1)', hours: 30, blurb: 'Insulin almost absent: lipolysis runs, glucagon opens the ketogenic gate, and the osmotic diuresis starts at a GFR that excretes glucose well.' },
  { id: 'hhs', label: 'Non-ketotic (older, low GFR)', hours: 120, blurb: 'Insulin reduced but present — enough to stop lipolysis, not to clear glucose. A lower GFR excretes glucose less well, and a confused patient drinks little.' },
  { id: 'dialysis', label: 'Dialysis patient', hours: 18, blurb: 'Almost no filtration: no glucosuria, so no osmotic diuresis. The glucose climbs very high, the sodium is diluted, and potassium leaving cells has nowhere to go.' },
];

function pick(points: CrisisPoint[] | undefined, hour: number) {
  if (!points?.length) return undefined;
  return points.reduce((best, p) => (Math.abs(p.hour - hour) < Math.abs(best.hour - hour) ? p : best), points[0]);
}

function CrisisTab() {
  const [kind, setKind] = useState<CrisisKind>('dka');
  const def = KINDS.find((k) => k.id === kind)!;
  const [frac, setFrac] = useState(1);
  const { result, busy } = useCrisis({ kind, hours: def.hours });
  const hour = Math.round(def.hours * frac);
  const p = pick(result?.points, hour);
  const pts = result?.points ?? [];
  const s = (f: (q: CrisisPoint) => number) => pts.map((q) => ({ x: q.hour, y: f(q) }));

  return (
    <>
      <WhatIf options={KINDS.map((k) => ({ label: k.label, explain: k.blurb }))} onApply={(o) => setKind(KINDS.find((k) => k.label === o.label)!.id)} active={def.label} />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Time since decompensation began">
            <Slider label="Hours" value={frac} min={0} max={1} step={0.02} format={() => `${hour} h`} onInput={setFrac} />
            <Busy on={busy} />
            {result?.outOfRange && <p class="callout danger">{result.outOfRange}</p>}
          </Panel>
          {p && (
            <>
              <Panel title="Chemistry">
                <div class="readout-grid">
                  <Readout label="Glucose" value={p.glucose} digits={1} unit="mmol/L" tone={toneFor(p.glucose, 3.9, 11, [3, 33])} refRange={`${mgdl(p.glucose)} mg/dL`} />
                  <Readout label="Na⁺" value={p.Na} digits={0} unit="mmol/L" tone={toneFor(p.Na, 135, 145, [120, 160])} />
                  <Readout label="Corrected Na⁺" value={p.naCorrected} digits={0} unit="mmol/L" tone={toneFor(p.naCorrected, 135, 145, [120, 160])} />
                  <Readout label="Effective osmolality" value={p.effOsm} digits={0} unit="mOsm/kg" tone={toneFor(p.effOsm, 275, 295, [0, 320])} refRange="coma unusual < 320–330" />
                  <Readout label="K⁺" value={p.K} digits={1} unit="mmol/L" tone={toneFor(p.K, 3.5, 5.0, [2.5, 6.5])} />
                  <Readout label="K⁺ deficit" value={Math.max(0, p.kDeficit)} digits={0} unit="mmol" refRange={`${(Math.max(0, p.kDeficit) / 70).toFixed(1)} mmol/kg`} />
                  <Readout label="HCO₃⁻" value={p.HCO3} digits={0} unit="mmol/L" tone={toneFor(p.HCO3, 22, 29, [8, 45])} />
                  <Readout label="pH" value={p.pH} digits={2} tone={toneFor(p.pH, 7.35, 7.45, [7.1, 7.6])} />
                  <Readout label="Anion gap" value={p.anionGap} digits={0} unit="mmol/L" tone={p.anionGap > 16 ? 'high' : 'normal'} />
                  <Readout label="Urea" value={p.urea} digits={1} unit="mmol/L" />
                  <Readout label="Creatinine" value={p.creat} digits={0} unit="µmol/L" />
                </div>
              </Panel>
              <Panel title="Losses">
                <div class="readout-grid">
                  <Readout label="Water lost" value={p.waterDeficit} digits={1} unit="L" tone={p.waterDeficit > 5 ? 'danger' : p.waterDeficit > 2 ? 'high' : 'normal'} />
                  <Readout label="Urine output" value={p.urineL} digits={1} unit="L/day" />
                  <Readout label="Urine Na⁺ + K⁺" value={p.urineNaK} digits={0} unit="mmol/L" refRange="below plasma: water lost in excess" />
                  <Readout label="Extracellular volume" value={p.ecf} digits={1} unit="L" />
                </div>
              </Panel>
            </>
          )}
        </div>
        <div>
          <Panel title="Glucose, and what caps it" note="The glucose is free to move here: hepatic output minus tissue uptake minus what the kidney excretes. With a normal GFR, excretion catches up in the 20s; with a low GFR, far higher; with none, it keeps climbing.">
            <LineChart xLabel="hours" series={[{ label: 'glucose (mmol/L)', points: s((q) => q.glucose), color: '#f2b134' }]} marker={hour} yMin={0} height={170} />
          </Panel>
          <Panel title="Sodium: diluted, then concentrated">
            <LineChart
              xLabel="hours"
              series={[
                { label: 'measured Na⁺', points: s((q) => q.Na), color: '#5ecfba' },
                { label: 'corrected Na⁺', points: s((q) => q.naCorrected), color: '#e07b6a', dashed: true },
                { label: 'effective osm − 150', points: s((q) => q.effOsm - 150), color: '#b08ee0' },
              ]}
              bands={[{ from: 135, to: 145 }]}
              marker={hour}
              height={200}
            />
          </Panel>
          <div class="grid grid-2">
            <Panel title="Potassium: normal level, falling store">
              <LineChart
                xLabel="hours"
                series={[
                  { label: 'plasma K⁺', points: s((q) => q.K), color: '#5ecfba' },
                  { label: 'deficit ÷ 100 (mmol)', points: s((q) => Math.max(0, q.kDeficit) / 100), color: '#e07b6a', dashed: true },
                ]}
                bands={[{ from: 3.5, to: 5 }]}
                marker={hour}
                height={170}
              />
            </Panel>
            <Panel title="Acid–base">
              <LineChart
                xLabel="hours"
                series={[
                  { label: 'HCO₃⁻', points: s((q) => q.HCO3), color: '#6aa9e8' },
                  { label: 'anion gap', points: s((q) => q.anionGap), color: '#f2b134' },
                ]}
                marker={hour}
                yMin={0}
                height={170}
              />
            </Panel>
          </div>
        </div>
      </div>
      <Expand summary="What the model leaves out">
        <p class="muted" style={{ fontSize: '0.88rem' }}>
          The glucose kinetics are a simple balance (hepatic output doubling in insulin deficiency, a fixed insulin-independent uptake by brain and red cells, insulin-dependent uptake blunted by the resistance of the diabetic state, and renal excretion from the engine). Ketogenesis is switched on below a quarter of normal insulin effect. The anion gap in this model runs somewhat above the fall in bicarbonate in ketoacidosis; in patients with good renal function, ketoacid anions lost in the urine usually keep the two closer to 1 : 1, or below it (Rose ch. 25). The model's glomerular filtration rate is also better defended in volume depletion than a real patient's, so the rise in urea and creatinine is understated.
        </p>
      </Expand>
    </>
  );
}

// ---------------------------------------------------------------- 3. treatment

const DEFAULT_RX: Rx = { bolusRate: 1, later: 'half', laterRate: 0.25, insulin: true, kcl: 30, kBelow: 5.0, bicarbonate: false };

function TreatTab() {
  const [kind, setKind] = useState<'dka' | 'hhs'>('dka');
  const [rx, setRx] = useState<Rx>(DEFAULT_RX);
  const up = (x: Partial<Rx>) => setRx({ ...rx, ...x });
  const spec = { kind, hours: kind === 'dka' ? 30 : 120 };
  const { result, busy } = useCrisis(spec, rx);
  const pts = result?.points ?? [];
  const s = (f: (q: CrisisPoint) => number) => pts.map((q) => ({ x: q.hour, y: f(q) }));
  const start = pts[0];
  const minK = pts.length ? Math.min(...pts.map((q) => q.K)) : NaN;
  let maxOsmFall = 0;
  let maxGluFall = 0;
  for (let i = 1; i < pts.length; i++) {
    maxOsmFall = Math.max(maxOsmFall, pts[i - 1].effOsm - pts[i].effOsm);
    maxGluFall = Math.max(maxGluFall, pts[i - 1].glucose - pts[i].glucose);
  }
  const gapClosed = pts.find((q) => q.hour > 0 && q.anionGap <= 14 && q.HCO3 >= 15);
  const at12 = pick(pts, 12);

  return (
    <>
      <WhatIf
        options={[
          { label: 'Rose’s regimen', apply: () => setRx(DEFAULT_RX), explain: 'Isotonic saline first, insulin, dextrose once the glucose is below ~14–17 mmol/L, half-isotonic saline with KCl after the rapid-repletion phase.' },
          { label: 'Insulin without potassium', apply: () => setRx({ ...DEFAULT_RX, kcl: 0 }), explain: 'Insulin and the falling glucose drive K⁺ into cells and unmask the deficit. Watch the potassium.' },
          { label: 'Insulin before fluid', apply: () => setRx({ ...DEFAULT_RX, bolusRate: 0.1, laterRate: 0.1 }), explain: 'Insulin moves glucose and water into cells; without volume replacement the circulation suffers and renal clearance of glucose and ketones falls.' },
          { label: 'Fluids only, no insulin', apply: () => setRx({ ...DEFAULT_RX, insulin: false }), explain: 'In patients saline lowers the glucose by 2–4 mmol/L/h, by dilution and by restoring renal excretion, but the ketogenesis continues. (This model defends its GFR better than a volume-depleted patient does, so it understates the fall in glucose.)' },
          { label: 'Aggressive dilute fluid', apply: () => setRx({ ...DEFAULT_RX, later: 'half', laterRate: 0.75 }), explain: 'Half-isotonic saline fast: the effective osmolality falls faster — the concern behind the book’s caution about cerebral oedema.' },
          { label: 'Add bicarbonate if pH < 7.0', apply: () => setRx({ ...DEFAULT_RX, bicarbonate: true }), explain: 'Insulin regenerates bicarbonate from retained ketoacid anions; extra alkali usually adds little and pushes K⁺ into cells.' },
        ]}
        onApply={() => {}}
        onReset={() => setRx(DEFAULT_RX)}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Patient">
            <div class="btn-row">
              <button class={kind === 'dka' ? 'active' : ''} onClick={() => setKind('dka')}>Ketoacidosis</button>
              <button class={kind === 'hhs' ? 'active' : ''} onClick={() => setKind('hhs')}>Non-ketotic</button>
            </div>
            {start && (
              <div class="readout-grid" style={{ marginTop: 8 }}>
                <Readout label="Glucose" value={start.glucose} digits={1} unit="mmol/L" />
                <Readout label="Na⁺ / corrected" value={`${start.Na.toFixed(0)} / ${start.naCorrected.toFixed(0)}`} unit="mmol/L" />
                <Readout label="K⁺" value={start.K} digits={1} unit="mmol/L" refRange={`deficit ${Math.max(0, start.kDeficit).toFixed(0)} mmol`} />
                <Readout label="HCO₃⁻ / pH" value={`${start.HCO3.toFixed(0)} / ${start.pH.toFixed(2)}`} />
              </div>
            )}
          </Panel>
          <Panel title="Regimen">
            <Slider label="Isotonic saline, first 4 h" value={rx.bolusRate} min={0} max={1.5} step={0.1} unit="L/h" onInput={(v) => up({ bolusRate: v })} />
            <div class="btn-row" style={{ margin: '4px 0 8px' }}>
              <button class={rx.later === 'ns' ? 'active' : ''} onClick={() => up({ later: 'ns' })}>then isotonic</button>
              <button class={rx.later === 'half' ? 'active' : ''} onClick={() => up({ later: 'half' })}>then half-isotonic</button>
            </div>
            <Slider label="Rate after 4 h" value={rx.laterRate} min={0} max={1} step={0.05} unit="L/h" onInput={(v) => up({ laterRate: v })} />
            <Toggle label="Insulin infusion" checked={rx.insulin} onChange={(v) => up({ insulin: v })} />
            <Slider label="KCl added" value={rx.kcl} min={0} max={60} step={5} unit="mmol/L" onInput={(v) => up({ kcl: v })} />
            <Slider label="…once plasma K⁺ is below" value={rx.kBelow} min={3.5} max={5.5} step={0.1} unit="mmol/L" onInput={(v) => up({ kBelow: v })} hint="Rose: 4.5; current consensus: about 5.0–5.2" />
            <Toggle label="Sodium bicarbonate if pH < 7.0" checked={rx.bicarbonate} onChange={(v) => up({ bicarbonate: v })} />
            <Busy on={busy} />
          </Panel>
          <Panel title="How it went">
            <div class="readout-grid">
              <Readout label="Lowest K⁺" value={minK} digits={1} unit="mmol/L" tone={minK < 3 ? 'danger' : minK < 3.5 ? 'low' : 'normal'} />
              <Readout label="Fastest glucose fall" value={maxGluFall} digits={1} unit="mmol/L/h" refRange="book: 3.6–6.9 on insulin" tone={maxGluFall > 11 ? 'high' : 'normal'} />
              <Readout label="Fastest fall in effective osm" value={maxOsmFall} digits={1} unit="mOsm/kg/h" tone={maxOsmFall > 5 ? 'high' : 'normal'} />
              <Readout label="Gap closed (≤ 14, HCO₃ ≥ 15)" value={gapClosed ? `${gapClosed.hour} h` : '—'} />
              {at12 && <Readout label="Na⁺ at 12 h" value={at12.Na} digits={0} unit="mmol/L" />}
            </div>
          </Panel>
        </div>
        <div>
          <Panel title="Potassium: the danger of treatment" note="Insulin and the falling osmolality move K⁺ back into cells; the deficit that was hidden appears.">
            <LineChart xLabel="hours of treatment" series={[{ label: 'plasma K⁺', points: s((q) => q.K), color: '#5ecfba' }]} bands={[{ from: 3.5, to: 5.0 }]} yMin={2} yMax={7} height={170} />
            {Number.isFinite(minK) && <EcgStrip k={minK} seconds={2.4} height={110} label={`lead II at the lowest K⁺ (${minK.toFixed(1)} mmol/L)`} />}
          </Panel>
          <Panel title="Glucose and osmolality">
            <LineChart
              xLabel="hours of treatment"
              series={[
                { label: 'glucose (mmol/L)', points: s((q) => q.glucose), color: '#f2b134' },
                { label: 'effective osm − 270', points: s((q) => q.effOsm - 270), color: '#b08ee0' },
              ]}
              yMin={0}
              height={170}
            />
          </Panel>
          <div class="grid grid-2">
            <Panel title="Sodium">
              <LineChart
                xLabel="hours"
                series={[
                  { label: 'measured', points: s((q) => q.Na), color: '#5ecfba' },
                  { label: 'corrected', points: s((q) => q.naCorrected), color: '#e07b6a', dashed: true },
                ]}
                bands={[{ from: 135, to: 145 }]}
                height={160}
              />
            </Panel>
            <Panel title="Acid–base repair">
              <LineChart
                xLabel="hours"
                series={[
                  { label: 'HCO₃⁻', points: s((q) => q.HCO3), color: '#6aa9e8' },
                  { label: 'anion gap', points: s((q) => q.anionGap), color: '#f2b134' },
                  { label: 'Cl⁻ − 80', points: s((q) => q.Cl - 80), color: '#7bc47f', dashed: true },
                ]}
                yMin={0}
                height={160}
              />
            </Panel>
          </div>
        </div>
      </div>
      <Expand summary="What the model gets wrong here">
        <p class="muted" style={{ fontSize: '0.88rem' }}>
          Two things to know. The model's glomerular filtration rate is better defended in volume depletion than a patient's, so saline restores less renal glucose excretion than it would. And its bicarbonate recovers faster and further than in patients: it does not reproduce the dilution of bicarbonate by chloride-rich saline, so the hyperchloraemic, normal-gap phase that commonly follows treatment (Rose ch. 25) is understated, and the calculated anion gap drifts below normal during repair.
        </p>
      </Expand>
      <Panel title="The logic of each step">
        <Chain
          steps={[
            { text: 'Isotonic saline first: restores ECF fastest, still hypotonic to the patient, and lowers the glucose by dilution and renal excretion' },
            { text: 'Insulin: suppresses hepatic output and ketogenesis; the retained ketoacid anions are metabolised back to bicarbonate over 5–10 h' },
            { text: 'Dextrose once the glucose is below ~14–17 mmol/L: insulin continues to clear ketones without hypoglycaemia' },
            { text: 'Potassium early: the store is depleted even when the level is high' },
            { text: 'Half-isotonic saline after the rapid phase: replaces the water lost in excess of Na⁺ + K⁺, slowly' },
            { text: 'Bicarbonate only for severe acidaemia, or when the anions were lost in the urine' },
          ]}
        />
        <Sources cite={{ rose: [25], refs: ['umpierrez2024', 'kuppermann2018'], evidence: 'guideline', update: 'Current consensus keeps Rose’s structure. It adds potassium once the level falls to about 5.0–5.2 mmol/L, holds insulin until it is at least 3.5, and considers bicarbonate below pH 7.0.' }} />
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------- 4. the kidney

function KidneyTab() {
  const normal = useCrisis({ kind: 'dka', hours: 30 });
  const esrd = useCrisis({ kind: 'dialysis', hours: 18 });
  const a = normal.result?.presentation;
  const b = esrd.result?.presentation;
  return (
    <>
      <div class="grid grid-2">
        <Panel title="Table 25-1, as a mechanism">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Beneficial</th>
                  <th>Detrimental</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Excretes some of the excess glucose, capping the plasma level</td>
                  <td>Volume depletion from the osmotic diuresis</td>
                </tr>
                <tr>
                  <td>Excretes acid, as β-hydroxybutyric acid or its NH₄⁺ salt</td>
                  <td>Hyperosmolality worsened: water lost in excess of Na⁺ + K⁺</td>
                </tr>
                <tr>
                  <td>K⁺ loss protects against extreme hyperkalaemia at presentation</td>
                  <td>Loss of Na⁺ and K⁺ salts of ketoacids: potential bicarbonate thrown away; K⁺ depletion</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="control-hint">In one study ketone production averaged 51 mmol/h, of which about 30% was excreted with the urine and a further 15–25% neutralised by conversion to acetone.</p>
        </Panel>
        <Panel title="With a kidney and without one" note="The same insulin deficiency, simulated in a young patient with normal renal function and in a dialysis patient.">
          <Busy on={normal.busy || esrd.busy} />
          {a && b && (
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th />
                    <th>Normal GFR</th>
                    <th>Dialysis</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><th scope="row">Glucose (mmol/L)</th><td>{a.glucose.toFixed(0)}</td><td>{b.glucose.toFixed(0)}</td></tr>
                  <tr><th scope="row">Measured Na⁺</th><td>{a.Na.toFixed(0)}</td><td>{b.Na.toFixed(0)}</td></tr>
                  <tr><th scope="row">Effective osmolality</th><td>{a.effOsm.toFixed(0)}</td><td>{b.effOsm.toFixed(0)}</td></tr>
                  <tr><th scope="row">Water lost (L)</th><td>{a.waterDeficit.toFixed(1)}</td><td>{b.waterDeficit.toFixed(1)}</td></tr>
                  <tr><th scope="row">K⁺ (mmol/L)</th><td>{a.K.toFixed(1)}</td><td>{b.K.toFixed(1)}</td></tr>
                  <tr><th scope="row">K⁺ deficit (mmol)</th><td>{Math.max(0, a.kDeficit).toFixed(0)}</td><td>{Math.max(0, b.kDeficit).toFixed(0)}</td></tr>
                  <tr><th scope="row">Creatinine (µmol/L)</th><td>{a.creat.toFixed(0)}</td><td>{b.creat.toFixed(0)}</td></tr>
                </tbody>
              </table>
            </div>
          )}
          <p class="control-hint">The dialysis patient reaches a far higher glucose with less hyperosmolality and no volume depletion — and the potassium shifted out of cells stays in the plasma. Book: glucose of 55–85 mmol/L and K⁺ of 8–9 mmol/L can occur.</p>
        </Panel>
      </div>
      <div class="grid grid-2">
        <Panel title="Why K⁺ is high while the store is low">
          <Chain
            steps={[
              { text: 'Insulin deficiency: less K⁺ uptake by muscle and liver', direction: 1 },
              { text: 'Hyperosmolality: water leaves cells, cell K⁺ concentrates and diffuses out, and solvent drag carries more', direction: 1 },
              { text: 'Acidaemia contributes little: organic acids shift K⁺ far less than mineral acids', direction: 0 },
              { text: 'Meanwhile the kidney loses K⁺: high distal flow, ketoacid anions, aldosterone', direction: -1 },
              { text: 'Net: plasma K⁺ normal or high, total body K⁺ 3–5 mmol/kg low', direction: 0 },
            ]}
          />
          <Sources cite={{ rose: [25, 12, 28], evidence: 'physiology', refs: ['palmer2015k'] }} />
        </Panel>
        <Panel title="Two ends of one spectrum">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th />
                  <th>Ketoacidosis</th>
                  <th>Non-ketotic</th>
                </tr>
              </thead>
              <tbody>
                <tr><th scope="row">Typical patient</th><td>Young, type 1</td><td>60–65 years, type 2 or none known</td></tr>
                <tr><th scope="row">Insulin</th><td>Absent</td><td>Reduced, present</td></tr>
                <tr><th scope="row">Glucose</th><td>Usually &lt; 44 mmol/L</td><td>Often &gt; 55 mmol/L</td></tr>
                <tr><th scope="row">GFR</th><td>Normal or high (up to +50%)</td><td>Often reduced</td></tr>
                <tr><th scope="row">Effective osmolality</th><td>Moderately raised</td><td>Up to 380; coma in 25–50%</td></tr>
                <tr><th scope="row">Presents with</th><td>Breathlessness of acidosis</td><td>Confusion of hyperosmolality</td></tr>
                <tr><th scope="row">Fluid deficit</th><td>3–6 L</td><td>8–10 L</td></tr>
              </tbody>
            </table>
          </div>
          <Sources cite={{ rose: [25], evidence: 'clinical', refs: ['umpierrez2024'] }} />
        </Panel>
      </div>
      <Predict
        question="Why is the glucose usually higher in non-ketotic hyperglycaemia than in ketoacidosis, although insulin is less deficient?"
        options={['More glucagon', 'The GFR is lower, so less glucose is excreted — and confusion delays presentation', 'Ketones lower the glucose', 'Insulin resistance is greater']}
        correct={1}
        explanation="Renal excretion is the brake on the glucose. A young type 1 diabetic may filter 50% more than normal; an older patient with reduced renal function excretes far less. Acidosis also brings the ketotic patient in early (Rose ch. 25)."
      />
    </>
  );
}

// ----------------------------------------------------------------

export default function Hyperglycemia({ query }: { query: URLSearchParams }) {
  const [tab, setTab] = useTabParam('/hyperglycemia', TAB_IDS, 'shift', query);
  return (
    <div>
      <PageHead
        path="/hyperglycemia"
        lede="Uncontrolled diabetes is a hyperosmolal state, a volume depletion and — when insulin is absent — a ketoacidosis, all from one lesion. The kidney sits in the middle: it limits the glucose and the acid by excreting them, and deepens the dehydration and the potassium deficit by doing so."
      />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'shift' && <ShiftTab />}
      {tab === 'crisis' && <CrisisTab />}
      {tab === 'treat' && <TreatTab />}
      {tab === 'kidney' && <KidneyTab />}
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>Insulin and glucagon hold fasting glucose at 3.3–5.6 mmol/L; the proximal tubule reclaims all filtered glucose below a load of about 375 mg/min.</p>}
          why={<p>Insulin suppresses hepatic output and lipolysis and drives uptake into muscle and fat; glucagon promotes gluconeogenesis and, by lowering malonyl-CoA, opens the mitochondria to fatty acids and ketogenesis.</p>}
          change={<p>Remove insulin and the glucose rises until renal excretion catches up; the unreabsorbed glucose drives an osmotic diuresis with urine Na⁺ + K⁺ near 70 mmol/L. Remove it completely and ketoacids accumulate as well.</p>}
          abnormal={<p>Ketoacidosis, non-ketotic hyperglycaemia and hyperglycaemia on dialysis differ in how much insulin is left and how much the kidney can excrete.</p>}
          clinical={<p>Correct the sodium for the glucose; expect potassium to fall on insulin and replace it early; restore volume with isotonic saline, then replace water slowly; bicarbonate rarely.</p>}
        />
        <Sources cite={{ rose: [25], evidence: 'clinical', refs: ['umpierrez2024', 'hillier1999', 'kuppermann2018', 'peters2015'] }} />
      </Panel>
      <Related paths={['/glucose', '/metabolic-acidosis', '/potassium', '/hypokalemia', '/water-disorders', '/body-water']} />
    </div>
  );
}
