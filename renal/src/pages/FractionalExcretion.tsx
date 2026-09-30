import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related, Busy } from '../ui/page';
import { Panel, Readout, Sources, Predict, BarRow, Equation, LineChart, Expand, type Series } from '../ui/kit';
import { EquationCard } from '../ui/EquationCard';
import { makeParams, useAcute, useSteady, NORMAL } from '../sim/hooks';
import type { ParamPatch } from '../engine/types';
import { si } from '../units';

const CASES: { label: string; patch: ParamPatch; explain: string }[] = [
  { label: 'Normal', patch: {}, explain: 'A person in balance on a normal diet: FENa well under 1%, because 1% of the filtered load is far more sodium than anyone eats.' },
  { label: 'Low salt diet', patch: { naIntake: 20 }, explain: 'FENa falls further still. Nothing is wrong — the filtered load has not changed and the intake has.' },
  { label: 'High salt diet', patch: { naIntake: 350 }, explain: 'FENa rises. A number above 1% here means a large dinner, not tubular injury.' },
  { label: 'Advanced CKD', patch: { nephronFraction: 0.13 }, explain: 'The filtered load is a seventh of normal, so the same daily intake is a much larger fraction of it. FENa exceeds 3% in a patient in perfect sodium balance.' },
  { label: 'Loop diuretic', patch: { drugs: { furosemide: 0.9 } }, explain: 'FENa around 5% through entirely normal tubules. Any diuretic makes FENa uninterpretable as a test of tubular integrity.' },
  { label: 'Acute tubular necrosis', patch: { tubularInjury: 0.75 }, explain: 'The case FENa is meant to detect: damaged tubules cannot reabsorb the filtered sodium.' },
  { label: 'ATN on heart failure', patch: { tubularInjury: 0.7, cardiacFunction: 0.42 }, explain: 'The false negative. The volume signal overrides the injury and holds FENa far below 1%.' },
];

export default function FractionalExcretion() {
  const [caseIdx, setCaseIdx] = useState(0);
  const c = CASES[caseIdx];
  const params = useMemo(() => makeParams({ naIntake: 150, ...c.patch }), [caseIdx]);
  const ev = useAcute(params);
  const steady = useSteady(params, 30);
  const normal = NORMAL();

  const u = ev.kidney.urine;
  const filteredNa = (ev.kidney.GFR * ev.plasma.Na * 1440) / 1000; // mmol/day

  const curve = useMemo(() => {
    // At a given GFR, what does 1% of the filtered load amount to, and what FENa does a person
    // in sodium balance on 150 mmol/day actually show?
    const one: Series['points'] = [];
    const inBalance: Series['points'] = [];
    for (let gfr = 5; gfr <= 140; gfr += 5) {
      const filt = (gfr * 140 * 1440) / 1000;
      one.push({ x: gfr, y: filt / 100 });
      inBalance.push({ x: gfr, y: (150 / filt) * 100 });
    }
    return { one, inBalance };
  }, []);

  return (
    <div>
      <PageHead
        path="/fractional-excretion"
        lede="Fractional excretion asks what proportion of the filtered load is leaving. Using creatinine to cancel the urine flow rate makes it a better volume signal than a urine concentration — but it is a fraction, and the thing it is a fraction of changes. That is why 1% means different things in different patients, and why it is evidence rather than a diagnosis."
      />
      <WhatIf options={CASES.map((x) => ({ label: x.label, explain: x.explain }))} onApply={(o) => setCaseIdx(CASES.findIndex((x) => x.label === o.label))} onReset={() => setCaseIdx(0)} active={c.label} />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="The arithmetic, on this patient" note="Every number below is what the model's kidney is actually doing.">
            <Equation
              formula="FENa = (U_Na × P_cr) ÷ (P_Na × U_cr) × 100"
              substituted={`(${u.Na.toFixed(0)} × ${si.creat(ev.body.creat).toFixed(0)}) ÷ (${ev.plasma.Na.toFixed(0)} × ${(si.creat(u.creat) / 1000).toFixed(2)} × 1000)  × 100`}
              result={`${ev.derived.FENa.toFixed(2)} %`}
              note="creatinine appears on both sides only to cancel the urine flow rate — it is not a sodium measurement"
            />
            <div class="readout-grid" style={{ marginTop: 8 }}>
              <Readout label="Filtered Na⁺" value={filteredNa} digits={0} unit="mmol/day" title="GFR × plasma Na⁺" />
              <Readout label="Excreted Na⁺" value={u.exc.Na} digits={0} unit="mmol/day" />
              <Readout label="FENa" value={ev.derived.FENa} digits={2} unit="%" tone={ev.derived.FENa < 1 ? 'low' : ev.derived.FENa > 2 ? 'high' : 'normal'} delta={ev.derived.FENa - normal.derived.FENa} deltaDigits={2} />
              <Readout label="GFR" value={ev.kidney.GFR} digits={0} unit="mL/min" tone={ev.kidney.GFR < 60 ? 'low' : 'normal'} />
            </div>
          </Panel>
          <Panel title="Other fractional excretions" note="Different denominators, different failure modes.">
            <div class="readout-grid">
              <Readout label="FEurea" value={ev.derived.FEUrea} digits={0} unit="%" tone={ev.derived.FEUrea < 35 ? 'low' : ev.derived.FEUrea > 65 ? 'high' : 'normal'} refRange="< 35% suggests pre-renal" />
              <Readout label="FEurate" value={ev.kidney.FE.urate * 100} digits={0} unit="%" refRange="< 12% suggested pre-renal" />
              <Readout label="FEK" value={ev.kidney.FE.K * 100} digits={0} unit="%" />
              <Readout label="FEHCO₃" value={ev.kidney.FE.HCO3 * 100} digits={1} unit="%" refRange="> 15% in proximal RTA" />
            </div>
            <p class="control-hint">
              Urea reabsorption is largely passive and follows water, so a loop diuretic disturbs it less than it disturbs sodium — which is why FEurea is offered when a diuretic has made FENa
              useless. It is not a clean substitute: it performs inconsistently across studies, and it rises in its own right with a high protein load or gastrointestinal bleeding.
            </p>
          </Panel>
        </div>
        <div>
          <Panel title="Why 1% is not a constant" note="The threshold is a fraction of the filtered load, and the filtered load is what changes in kidney disease.">
            <LineChart yLabel="1% of the filtered Na⁺ load (mmol/day)"
              xLabel="GFR (mL/min)"
              series={[{ label: '1% of the filtered load (mmol/day)', points: curve.one, color: 'var(--c-amber)' }] as Series[]}
              yMin={0}
              marker={ev.kidney.GFR}
              height={190}
            />
            <p class="control-hint" style={{ marginBottom: 10 }}>
              At a normal GFR, 1% of the filtered sodium is about 270 mmol/day — far more than anyone eats, so a normal person is always well under 1%. At a GFR of 12 it is about 25 mmol/day.
            </p>
            <LineChart yLabel="FENa (%)"
              xLabel="GFR (mL/min)"
              series={[
                { label: 'FENa of someone in balance on 150 mmol/day', points: curve.inBalance, color: 'var(--c-green)' },
                { label: 'The 1% line', points: curve.inBalance.map((p) => ({ x: p.x, y: 1 })), color: 'var(--ink-faint)' },
                { label: 'The 2% line', points: curve.inBalance.map((p) => ({ x: p.x, y: 2 })), color: 'var(--c-coral)' },
              ] as Series[]}
              yMin={0}
              yMax={8}
              marker={ev.kidney.GFR}
              height={190}
            />
            <p class="callout" style={{ marginTop: 8 }}>
              The green line crosses 1% at a GFR near 75 and 2% near 37 — in a patient doing nothing wrong at all. Below that, a "tubular" FENa is simply what sodium balance looks like on a small
              filtered load.
            </p>
          </Panel>
          <Panel title="Concentration, rate, fraction" note="Three ways to report the same sodium, and what each one is confounded by.">
            {steady.ev && (
              <>
                <BarRow label="Urine Na⁺ concentration" value={steady.ev.kidney.urine.Na} max={250} unit=" mmol/L" color="var(--c-blue)" sub="confounded by urine volume" />
                <BarRow label="Na⁺ excreted per day" value={steady.ev.kidney.urine.exc.Na} max={400} unit=" mmol/day" color="var(--c-green)" sub="confounded by intake — in balance it simply equals it" />
                <BarRow label="FENa" value={steady.ev.derived.FENa} max={8} unit=" %" color="var(--c-amber)" sub="confounded by GFR and by diuretics" />
                <p class="control-hint">
                  Each removes one confounder and introduces another. FENa is the right choice in the 20–40 mmol/L overlap zone, where the concentration is ambiguous — not a universally better number.
                </p>
              </>
            )}
            <Busy on={steady.busy} />
          </Panel>
        </div>
      </div>
      <div class="grid grid-2">
        <Predict
          question="A patient with a GFR of 12 mL/min, in steady sodium balance on 150 mmol/day, has a FENa of 4%. What does that mean?"
          options={['Acute tubular necrosis', 'Nothing abnormal — 1% of this filtered load is only about 25 mmol/day, so balance requires a high fraction', 'Diuretic use', 'Salt-wasting nephropathy']}
          correct={1}
          explanation="Excretion must equal intake whatever the GFR. With a small filtered load that takes a large fraction. Select “Advanced CKD” above and look at the filtered load."
        />
        <Predict
          question="Why does creatinine appear in the FENa formula at all?"
          options={['It measures tubular damage', 'It cancels the urine flow rate, so the answer does not depend on how concentrated the urine is', 'It corrects for GFR', 'It estimates the filtered load']}
          correct={1}
          explanation="Creatinine is filtered and barely reabsorbed, so the ratio of plasma to urine creatinine is a measure of how much water was reabsorbed. Dividing by it removes the water-handling confounder that makes a urine sodium concentration ambiguous."
        />
      </div>
      <Expand summary="Where each fractional excretion misleads">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Index</th>
                <th>Reads low when it should not</th>
                <th>Reads high when it should not</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">FENa</th>
                <td>ATN on cirrhosis, heart failure or burns; contrast and pigment nephropathy; early obstruction; acute glomerulonephritis</td>
                <td>Diuretics; advanced CKD; a high salt intake</td>
              </tr>
              <tr>
                <th scope="row">FEurea</th>
                <td>Low protein intake</td>
                <td>High protein load, gastrointestinal bleeding, corticosteroids</td>
              </tr>
              <tr>
                <th scope="row">FEurate</th>
                <td>Drugs that block urate reabsorption</td>
                <td>Modest sensitivity (68%) and specificity (78%) even in the study that proposed it</td>
              </tr>
              <tr>
                <th scope="row">Fractional lithium clearance</th>
                <td colSpan={2}>Measures proximal reabsorption directly, but is rarely available and is itself disturbed by volume depletion</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="note">
          Rose gives no threshold that separates the states reliably, and neither does this model. Later work has confirmed the caution rather than resolving it: urine sodium and FENa overlap
          substantially between pre-renal states and tubular injury. Use them as one piece of evidence about effective circulating volume.
        </p>
      </Expand>
      <div class="grid grid-2">
        <EquationCard eq="fena" compact />
        <EquationCard eq="feurea" compact />
      </div>
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>Well under 1% on a normal diet — often 0.5% — because 1% of a normal filtered load is about 270 mmol/day, far more sodium than is eaten.</p>}
          why={<p>FENa is excretion divided by filtration. Creatinine is in the formula only to cancel the urine flow rate, which is what makes a urine sodium concentration ambiguous.</p>}
          change={<p>Raise salt intake and FENa rises; lower GFR and it rises for the same intake. Give a diuretic and it rises with entirely normal tubules.</p>}
          abnormal={<p>Tubular injury raises it because the filtered sodium is not reabsorbed. But so do diuretics and a small filtered load, and intense volume signals can hold it low despite injury.</p>}
          clinical={<p>Use it in the 20–40 mmol/L overlap zone of urine sodium. Interpret it against the GFR, the drugs and the clinical picture — never as a test result on its own.</p>}
        />
        <Sources cite={{ rose: [13, 14], evidence: 'clinical', refs: ['espinel1976', 'miller1978', 'carvounis2002', 'perazella2012'] }} />
      </Panel>
      <Related paths={['/urine-chemistry', '/prerenal-atn', '/clearance', '/creatinine', '/aki']} />
    </div>
  );
}