import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related } from '../ui/page';
import { Panel, Readout, Slider, Sources, Predict, LineChart, toneFor, BarRow } from '../ui/kit';
import { EquationCard } from '../ui/EquationCard';

interface S {
  /** phosphate excreted, mmol/day */
  phosphate: number;
  urinePh: number;
  /** other filtered buffer with its own pKa (ketoacid anions in DKA) */
  extraBuffer: number;
  extraPka: number;
  /** ammonium excretion, for comparison */
  nh4: number;
  urineHco3: number;
}
const START: S = { phosphate: 50, urinePh: 5.8, extraBuffer: 0, extraPka: 4.8, nh4: 40, urineHco3: 1 };

const PLASMA_PH = 7.4;
const PHOS_PKA = 6.8;

/** H+ taken up by a buffer as the urine is acidified from plasma pH to the urine pH. */
function buffered(total: number, pKa: number, urinePh: number) {
  const protonatedAt = (pH: number) => total / (1 + Math.pow(10, pH - pKa));
  return Math.max(0, protonatedAt(urinePh) - protonatedAt(PLASMA_PH));
}

const CASES: { label: string; patch: Partial<S>; explain: string }[] = [
  { label: 'Normal urine (pH 5.8)', patch: {}, explain: 'About half of the excreted phosphate has been protonated: titratable acid in the usual range of 10–40 mmol/day.' },
  { label: 'Maximally acid urine (pH 4.8)', patch: { urinePh: 4.8 }, explain: 'Almost all the phosphate is now H₂PO₄⁻ — 39.5 of 50 mmol buffered. Below about pH 5.5 no further buffering is possible without more phosphate.' },
  { label: 'Distal RTA (urine pH 6.5)', patch: { urinePh: 6.5, nh4: 8 }, explain: 'The urine cannot be acidified, so neither titratable acid nor ammonium can be formed in quantity — net acid excretion collapses and acidosis follows.' },
  { label: 'Phosphate depletion', patch: { phosphate: 12 }, explain: 'Titratable acid is proportional to how much buffer is filtered. With little phosphate there is little to titrate, whatever the urine pH.' },
  { label: 'Diabetic ketoacidosis', patch: { extraBuffer: 120, extraPka: 4.8, urinePh: 5.0, nh4: 250 }, explain: 'β-hydroxybutyrate (pKa 4.8) is excreted in quantity and acts as a urinary buffer, adding as much as 50 mmol/day to titratable acid — the one setting where it rises substantially.' },
  { label: 'Chronic metabolic acidosis', patch: { urinePh: 5.0, nh4: 250, phosphate: 60 }, explain: 'Ammonium carries the adaptation (up to 300+ mmol/day) while titratable acid rises only modestly — the central asymmetry of renal acid excretion.' },
  { label: 'Bicarbonate in the urine', patch: { urinePh: 7.2, urineHco3: 60, nh4: 10 }, explain: 'Urinary bicarbonate subtracts from net acid excretion: losing it is equivalent to adding acid to the body.' },
];

export default function TitratableAcid() {
  const [s, setS] = useState<S>(START);
  const up = (p: Partial<S>) => setS({ ...s, ...p });

  const ta = buffered(s.phosphate, PHOS_PKA, s.urinePh) + buffered(s.extraBuffer, s.extraPka, s.urinePh);
  const nae = ta + s.nh4 - s.urineHco3;
  const phosProtonated = s.phosphate / (1 + Math.pow(10, s.urinePh - PHOS_PKA));

  const curve = useMemo(() => {
    const phosphate: { x: number; y: number }[] = [];
    const extra: { x: number; y: number }[] = [];
    for (let pH = 7.4; pH >= 4.4; pH -= 0.05) {
      phosphate.push({ x: pH, y: buffered(s.phosphate, PHOS_PKA, pH) });
      if (s.extraBuffer > 0) extra.push({ x: pH, y: buffered(s.extraBuffer, s.extraPka, pH) });
    }
    return { phosphate, extra };
  }, [s.phosphate, s.extraBuffer, s.extraPka]);

  const table = [
    { label: 'Glomerular filtrate', pH: 7.4 },
    { label: 'End of proximal tubule', pH: 6.8 },
    { label: 'Final urine', pH: s.urinePh },
  ].map((row) => {
    const acid = s.phosphate / (1 + Math.pow(10, row.pH - PHOS_PKA));
    return { ...row, base: s.phosphate - acid, acid, buffered: buffered(s.phosphate, PHOS_PKA, row.pH) };
  });

  return (
    <div>
      <PageHead
        path="/titratable-acid"
        lede="Filtered phosphate buffers secreted H⁺ as the urine is acidified — that is titratable acid. It is real but inflexible: its size is set by how much phosphate is filtered and how low the urine pH goes, and below pH 5.5 the buffer is used up."
      />
      <WhatIf
        options={CASES.map((c) => ({ label: c.label, explain: c.explain }))}
        onApply={(o) => setS({ ...START, ...CASES.find((c) => c.label === o.label)!.patch })}
        onReset={() => setS(START)}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="The urine">
            <Slider label="Phosphate excreted" value={s.phosphate} min={0} max={120} step={2} unit="mmol/day" onInput={(v) => up({ phosphate: v })} normal={50} />
            <Slider label="Urine pH" value={s.urinePh} min={4.4} max={7.6} step={0.05} onInput={(v) => up({ urinePh: v })} normal={5.8} hint="minimum achievable in humans is 4.5–5.0" />
            <Slider label="Other buffer (e.g. ketoacid anions)" value={s.extraBuffer} min={0} max={250} step={5} unit="mmol/day" onInput={(v) => up({ extraBuffer: v })} />
            {s.extraBuffer > 0 && <Slider label="its pKa" value={s.extraPka} min={3.5} max={7} step={0.1} onInput={(v) => up({ extraPka: v })} hint="β-hydroxybutyrate 4.8, creatinine 4.97, urate 5.75" />}
          </Panel>
          <Panel title="The other two terms">
            <Slider label="Ammonium excreted" value={s.nh4} min={0} max={350} step={5} unit="mmol/day" onInput={(v) => up({ nh4: v })} normal={40} />
            <Slider label="Bicarbonate lost in the urine" value={s.urineHco3} min={0} max={150} step={1} unit="mmol/day" onInput={(v) => up({ urineHco3: v })} />
          </Panel>
          <Panel title="Net acid excretion">
            <div class="readout-grid">
              <Readout label="Titratable acid" value={ta} digits={1} unit="mmol/day" tone={toneFor(ta, 10, 40)} />
              <Readout label="Ammonium" value={s.nh4} unit="mmol/day" />
              <Readout label="− Urinary bicarbonate" value={s.urineHco3} unit="mmol/day" />
              <Readout label="Net acid excretion" value={nae} digits={0} unit="mmol/day" tone={nae < 40 ? 'danger' : nae > 150 ? 'high' : 'good'} />
            </div>
            <p class={nae < 40 ? 'callout danger' : 'callout'} style={{ marginTop: 8 }}>
              {nae < 40
                ? `Net acid excretion (${nae.toFixed(0)} mmol/day) is below the 50–100 mmol/day produced on a normal diet: acid is being retained and a metabolic acidosis will develop.`
                : `Balance requires net acid excretion to match production — about 50–100 mmol/day on a Western diet, more if acid production rises.`}
            </p>
          </Panel>
        </div>
        <div>
          <Panel title="How much H⁺ phosphate can take up" note="Buffering rises as the urine is acidified — and then stops, because once nearly all the phosphate is protonated there is nothing left to titrate.">
            <LineChart
              xLabel="urine pH (falling to the right)"
              series={[
                { label: 'Phosphate (pKa 6.8)', points: curve.phosphate, color: '#f2b134' },
                ...(s.extraBuffer > 0 ? [{ label: `Other buffer (pKa ${s.extraPka.toFixed(1)})`, points: curve.extra, color: '#b08ee0' }] : []),
              ]}
              yMin={0}
              marker={s.urinePh}
              xFormat={(x) => x.toFixed(1)}
              height={240}
            />
            <p class="control-hint">The x-axis runs from plasma pH (7.4) down to the minimum achievable urine pH. The vertical line is the current urine pH.</p>
          </Panel>
          <Panel title="Phosphate along the nephron" note="Rose Table 11-1, recalculated for the phosphate load you set. The ratio of HPO₄²⁻ to H₂PO₄⁻ is 4:1 in the filtrate and reverses as the fluid is acidified.">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Site</th>
                    <th>pH</th>
                    <th>HPO₄²⁻</th>
                    <th>H₂PO₄⁻</th>
                    <th>H⁺ buffered</th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      <td class="mono">{row.pH.toFixed(2)}</td>
                      <td class="mono">{row.base.toFixed(1)}</td>
                      <td class="mono">{row.acid.toFixed(1)}</td>
                      <td class="mono">{row.buffered.toFixed(1)} mmol</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <Panel title="The three terms of net acid excretion">
            <BarRow label="Titratable acid" value={ta} max={Math.max(120, ta + s.nh4)} unit=" mmol/day" color="#f2b134" />
            <BarRow label="Ammonium" value={s.nh4} max={Math.max(120, ta + s.nh4)} unit=" mmol/day" color="#5ecfba" />
            <BarRow label="Bicarbonate lost (subtracts)" value={s.urineHco3} max={Math.max(120, ta + s.nh4)} unit=" mmol/day" color="#e07b6a" />
            <p class="control-hint">
              {phosProtonated > s.phosphate * 0.95
                ? 'Nearly all the phosphate is already protonated: acidifying the urine further cannot increase titratable acid.'
                : `${((phosProtonated / Math.max(s.phosphate, 1e-9)) * 100).toFixed(0)}% of the phosphate is protonated at this urine pH.`}
            </p>
          </Panel>
        </div>
      </div>
      <div class="grid grid-2">
        <Predict
          question="A patient in severe metabolic acidosis needs to excrete 300 mmol of acid a day. Can titratable acid do it?"
          options={['Yes, if the urine is acid enough', 'No — even a maximally acid urine can only titrate the phosphate that is filtered, roughly 40 mmol/day', 'Yes, with more bicarbonate', 'Only with alkali']}
          correct={1}
          explanation="This is why ammonium is the adaptive term: it can rise from 30–40 to over 300 mmol/day, whereas titratable acid is capped by filtered buffer."
        />
        <Predict
          question="Why does titratable acid rise substantially in diabetic ketoacidosis?"
          options={['More phosphate is filtered', 'Ketoacid anions (β-hydroxybutyrate, pKa 4.8) are excreted in quantity and act as urinary buffers', 'The urine pH rises', 'Ammonium falls']}
          correct={1}
          explanation="Both the amount and the favourable pKa matter: at a urine pH near 5, β-hydroxybutyrate is close to its pKa and can add as much as 50 mmol/day to titratable acid."
        />
      </div>
      <EquationCard eq="nae" />
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>10–40 mmol/day of H⁺ is excreted bound to filtered buffers, mainly phosphate (pKa 6.80), with smaller contributions from creatinine and urate.</p>}
          why={<p>Secreted H⁺ protonates HPO₄²⁻ to H₂PO₄⁻ as the tubular fluid is acidified. Each H⁺ so buffered leaves a new bicarbonate behind in the cell, which returns to the blood.</p>}
          change={<p>More phosphate or a lower urine pH means more titratable acid — until the phosphate is exhausted below about pH 5.5.</p>}
          abnormal={<p>Distal RTA prevents the urine pH from falling, so titratable acid cannot form. Phosphate depletion removes the buffer. Ketoacidosis supplies an extra one.</p>}
          clinical={<p>Titratable acid is measured by titrating a 24-hour urine back to plasma pH. It is the small, fixed part of net acid excretion; ammonium is the part that adapts.</p>}
        />
        <Sources cite={{ rose: [11], evidence: 'physiology', refs: ['hamm2015'] }} />
      </Panel>
      <Related paths={['/ammonium', '/bicarbonate', '/acid-base', '/rta', '/metabolic-acidosis', '/minerals']} />
    </div>
  );
}
