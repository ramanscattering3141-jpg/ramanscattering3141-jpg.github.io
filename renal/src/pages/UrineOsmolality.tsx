import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related } from '../ui/page';
import { Panel, Readout, Slider, Chain, Sources, Predict, LineChart, BarRow, type Series } from '../ui/kit';
import { BedsideEquations } from '../ui/EquationCard';
import { urineVolume } from '../sim/osmoregulation';

interface S {
  /** mOsm/day of solute presented for excretion */
  solute: number;
  /** urine osmolality the kidney can produce, mOsm/kg */
  uosm: number;
  /** water drunk, L/day */
  intake: number;
  /** maximum dilution the kidney can reach */
  minUosm: number;
  /** maximum concentration */
  maxUosm: number;
}
const START: S = { solute: 800, uosm: 600, intake: 2, minUosm: 60, maxUosm: 1200 };

const CASES: { label: string; patch: Partial<S>; explain: string }[] = [
  { label: 'Normal diet', patch: {}, explain: 'About 800 mOsm/day of solute — mostly Na⁺ and K⁺ salts and urea — excreted at whatever osmolality ADH dictates.' },
  { label: 'Beer potomania', patch: { solute: 200, intake: 5 }, explain: 'Beer is almost solute-free. With only ~200 mOsm/day to excrete, even a maximally dilute urine can carry off just 3–4 L — so 5 L of beer causes hyponatraemia.' },
  { label: '“Tea and toast” elderly diet', patch: { solute: 300, intake: 2.5 }, explain: 'A low-protein, low-salt diet has the same effect: water excretion is capped by how little solute there is to carry it.' },
  { label: 'Central diabetes insipidus', patch: { uosm: 80, maxUosm: 100, intake: 10 }, explain: 'No ADH: the urine cannot be concentrated above ~80–100, so 800 mOsm needs 10 L. Thirst keeps up, which is why the sodium stays normal.' },
  { label: 'DI on a low-solute diet', patch: { uosm: 80, maxUosm: 100, solute: 400, intake: 5 }, explain: 'Halving solute halves the obligatory volume, from 10 L to 5 L — the reason salt and protein are restricted in nephrogenic DI.' },
  { label: 'SIADH', patch: { uosm: 600, minUosm: 500, solute: 800, intake: 2 }, explain: 'ADH is fixed, so the urine cannot be diluted below ~500. Water given beyond 1.6 L/day is retained.' },
  { label: 'SIADH + salt and urea', patch: { uosm: 600, minUosm: 500, solute: 1400, intake: 2 }, explain: 'Raising solute excretion raises the volume the same urine osmolality can carry: 1400 ÷ 600 = 2.3 L/day, and the plasma sodium rises.' },
  { label: 'Maximal water load', patch: { uosm: 60, intake: 12 }, explain: 'A healthy kidney at 60 mOsm/kg can excrete 800 ÷ 60 ≈ 13 L/day. Beyond that, even normal people become hyponatraemic.' },
];

export default function UrineOsmolality() {
  const [s, setS] = useState<S>(START);
  const up = (p: Partial<S>) => setS({ ...s, ...p });
  const uosm = Math.min(Math.max(s.uosm, s.minUosm), s.maxUosm);
  const volume = urineVolume(s.solute, uosm);
  // Insensible losses are ~0.8 L/day; what the kidney cannot excrete accumulates.
  const insensible = 0.8;
  const balance = s.intake - volume - insensible;
  const maxVolume = urineVolume(s.solute, s.minUosm);
  const minVolume = urineVolume(s.solute, s.maxUosm);
  const maxIntake = maxVolume + insensible;

  const curve = useMemo(() => {
    const atMin: Series['points'] = [];
    const atMax: Series['points'] = [];
    const now: Series['points'] = [];
    for (let sol = 100; sol <= 1600; sol += 25) {
      atMin.push({ x: sol, y: urineVolume(sol, s.minUosm) });
      atMax.push({ x: sol, y: urineVolume(sol, s.maxUosm) });
      now.push({ x: sol, y: urineVolume(sol, uosm) });
    }
    return { atMin, atMax, now };
  }, [s.minUosm, s.maxUosm, uosm]);

  return (
    <div>
      <PageHead
        path="/urine-osmolality"
        lede="Urine volume is solute divided by urine osmolality. That one relation explains beer potomania, the polyuria of diabetes insipidus and why salt or urea helps in SIADH — and why the urine osmolality alone never tells you how much water is being lost."
      />
      <WhatIf
        options={CASES.map((c) => ({ label: c.label, explain: c.explain }))}
        onApply={(o) => setS({ ...START, ...CASES.find((c) => c.label === o.label)!.patch })}
        onReset={() => setS(START)}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Solute and water">
            <Slider label="Solute excreted" value={s.solute} min={100} max={1600} step={25} unit="mOsm/day" onInput={(v) => up({ solute: v })} normal={800} hint="Na⁺ and K⁺ salts plus urea; set by diet" />
            <Slider label="Urine osmolality (set by ADH)" value={s.uosm} min={40} max={1400} step={10} unit="mOsm/kg" onInput={(v) => up({ uosm: v })} normal={600} />
            <Slider label="Water intake" value={s.intake} min={0.2} max={15} step={0.1} unit="L/day" onInput={(v) => up({ intake: v })} normal={2} />
          </Panel>
          <Panel title="What the kidney can do" note="The limits of dilution and concentration; disease narrows this range.">
            <Slider label="Most dilute achievable" value={s.minUosm} min={40} max={700} step={10} unit="mOsm/kg" onInput={(v) => up({ minUosm: v })} normal={60} hint="raised in SIADH and renal failure" />
            <Slider label="Most concentrated achievable" value={s.maxUosm} min={80} max={1400} step={20} unit="mOsm/kg" onInput={(v) => up({ maxUosm: v })} normal={1200} hint="lowered in DI, low protein intake, medullary disease" />
          </Panel>
          <Panel title="Balance">
            <div class="readout-grid">
              <Readout label="Urine volume" value={volume} digits={2} unit="L/day" tone={volume > 3 ? 'high' : 'normal'} />
              <Readout label="Water balance" value={balance} digits={2} unit="L/day" tone={Math.abs(balance) < 0.15 ? 'good' : balance > 0 ? 'danger' : 'high'} title="intake − urine − insensible (0.8 L/day)" />
              <Readout label="Maximum water the kidney can clear" value={maxIntake} digits={1} unit="L/day" />
              <Readout label="Obligatory minimum volume" value={minVolume} digits={2} unit="L/day" />
            </div>
            <p class={Math.abs(balance) < 0.15 ? 'callout good' : balance > 0 ? 'callout danger' : 'callout'} style={{ marginTop: 8 }}>
              {Math.abs(balance) < 0.15
                ? 'In balance: what is drunk is what leaves.'
                : balance > 0
                  ? `Retaining ${balance.toFixed(2)} L/day — the plasma sodium will fall. Intake exceeds what this kidney can excrete (${maxIntake.toFixed(1)} L/day).`
                  : `Losing ${Math.abs(balance).toFixed(2)} L/day — the plasma sodium will rise unless thirst makes it up.`}
            </p>
          </Panel>
        </div>
        <div>
          <Panel title="Urine volume against solute load" note="Three lines: maximally dilute, maximally concentrated, and the current urine osmolality. The gap between the outer two is the kidney's whole working range at that solute load.">
            <LineChart yLabel="Urine volume (L/day)"
              xLabel="solute excreted (mOsm/day)"
              series={[
                { label: `Maximally dilute (${s.minUosm})`, points: curve.atMin, color: 'var(--c-blue)' },
                { label: `At the current osmolality (${uosm.toFixed(0)})`, points: curve.now, color: 'var(--c-amber)' },
                { label: `Maximally concentrated (${s.maxUosm})`, points: curve.atMax, color: 'var(--c-coral)' },
              ]}
              yMin={0}
              yMax={Math.min(20, maxVolume * 1.15)}
              marker={s.solute}
              height={250}
            />
          </Panel>
          <div class="grid grid-2">
            <Panel title="How the same urine osmolality means different things">
              <BarRow label="Urine volume now" value={volume} max={Math.max(6, maxVolume)} unit=" L/day" color="var(--c-amber)" />
              <BarRow label="If solute doubled" value={urineVolume(s.solute * 2, uosm)} max={Math.max(6, maxVolume)} unit=" L/day" color="var(--c-green)" />
              <BarRow label="If solute halved" value={urineVolume(s.solute / 2, uosm)} max={Math.max(6, maxVolume)} unit=" L/day" color="var(--c-violet)" />
              <p class="control-hint">The urine osmolality has not changed in any of these — only how much solute there was to carry.</p>
            </Panel>
            <Panel title="Two ways to be unable to excrete water">
              <Chain
                steps={[
                  { text: 'Not enough solute to carry it (beer potomania, tea and toast)', direction: -1 },
                  { text: 'or the urine cannot be diluted (ADH present: SIADH, hypovolaemia, thiazides)', direction: -1 },
                  { text: 'Maximum excretable water = solute ÷ minimum urine osmolality' },
                  { text: 'Intake above that is retained', direction: 1 },
                  { text: 'Plasma Na⁺ falls', direction: -1 },
                ]}
              />
            </Panel>
          </div>
          <Panel title="The book’s table" note="Rose Table 9-2: one person excreting 800 mOsm/day, at three levels of ADH.">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ADH</th>
                    <th>Urine osmolality</th>
                    <th>Urine volume</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Absent', 80, 10],
                    ['Moderate', 400, 2],
                    ['Maximal', 1200, 0.67],
                  ].map(([label, o, v]) => (
                    <tr key={label as string}>
                      <th scope="row">{label as string}</th>
                      <td class="mono">{o} mOsm/kg</td>
                      <td class="mono">{v} L/day</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
      <div class="grid grid-2">
        <Predict
          question="Someone on a beer-only diet excretes 200 mOsm/day and can dilute to 60 mOsm/kg. How much water can they excrete?"
          options={['10 L/day', 'About 3.3 L/day', 'Unlimited', '0.5 L/day']}
          correct={1}
          explanation="200 ÷ 60 ≈ 3.3 L/day. Diluting ability is perfectly normal — there is simply almost no solute to carry the water out. Hyponatraemia follows at intakes a normal diet would handle easily."
        />
        <Predict
          question="In SIADH with a urine osmolality fixed at 600, why does giving salt or urea raise the plasma sodium?"
          options={['It replaces lost sodium', 'More solute at the same osmolality means more urine volume, so more water leaves', 'It suppresses ADH', 'It lowers urine osmolality']}
          correct={1}
          explanation="Volume = solute ÷ osmolality. With ADH fixed, solute intake is the only lever on urine volume — the basis for oral urea in chronic SIADH."
        />
      </div>
      <BedsideEquations
        ids={['cosm', 'ch2o', 'maxuv']}
        intro="How solute excretion and urine osmolality together set urine volume, and why low-solute diets limit water excretion."
      />
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>About 800 mOsm/day of solute is excreted in 0.5–2 L of urine, at an osmolality set by ADH between 40–100 and 900–1400 mOsm/kg.</p>}
          why={<p>The kidney excretes solute; water accompanies it at whatever concentration the collecting duct permits. Volume is therefore solute divided by osmolality.</p>}
          change={<p>More solute at the same osmolality means more urine. Less solute caps how much water can be excreted, whatever the diluting ability.</p>}
          abnormal={<p>Low solute intake (beer, tea and toast) caps water excretion. Fixed high ADH (SIADH) raises the minimum osmolality. Absent ADH (DI) lowers the maximum, making volume depend entirely on solute intake.</p>}
          clinical={<p>Restrict salt and protein to reduce polyuria in diabetes insipidus; increase them (or give urea) to increase urine output in SIADH. Always ask what the solute load is before calling a urine volume inappropriate.</p>}
        />
        <Sources cite={{ rose: [9, 4], evidence: 'physiology', refs: ['berl2008', 'decaux2008', 'spasovski2014'] }} />
      </Panel>
      <Related paths={['/adh', '/free-water', '/hyponatremia', '/water-disorders', '/countercurrent']} />
    </div>
  );
}
