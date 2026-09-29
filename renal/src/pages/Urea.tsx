import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related } from '../ui/page';
import { Panel, Readout, Slider, Chain, Sources, Predict, BarRow } from '../ui/kit';
import { nephronRun } from '../sim/nephron';
import { SEGMENTS } from '../engine/types';
import { SEGMENT_INFO } from '../content/segments';
import { useMode } from '../ui/mode';

interface S {
  protein: number;
  adh: number;
  uta: number;
  gfr: number;
}
const START: S = { protein: 80, adh: 2.5, uta: 1, gfr: 130 };

/** Urea generation from protein intake (mmol/min), as in the engine. */
const ureaGen = (protein: number) => Math.min(1400, Math.max(30, ((protein * 0.16) / 28) * 1000 * 0.85)) / 1440;

export default function Urea() {
  const { mode } = useMode();
  const [s, setS] = useState<S>(START);
  const up = (p: Partial<S>) => setS({ ...s, ...p });
  // Steady-state BUN rises with production and falls with clearance (~half of GFR).
  const bun = Math.max(3, ((ureaGen(s.protein) * 1440) / (s.gfr * 1.44 * 0.5)) * 2.8 * 0.95);
  const aqp2 = Math.pow(s.adh, 1.4) / (Math.pow(s.adh, 1.4) + Math.pow(0.666, 1.4)) * 1.12;
  const r = useMemo(
    () =>
      nephronRun({
        GFR: s.gfr,
        plasma: { BUN: bun },
        hormones: { adh: s.adh, aqp2: Math.min(1, aqp2) },
        patch: { transporters: { UTA: s.uta } },
        ureaProduction: ureaGen(s.protein),
      }),
    [s, bun, aqp2],
  );
  const filteredUrea = r.segments.PT.in.urea * 1440;
  const flow = Math.max(r.urineOut.water, 0.02);
  const uUrea = (r.urineOut.urea / flow) * 1000;
  const uOsm = Math.min(1400, ((r.urineOut.Na + r.urineOut.K + r.urineOut.Cl + r.urineOut.urea + r.urineOut.NH4 + r.urineOut.HCO3 + r.urineOut.Pi * 1.8) / flow) * 1000);

  return (
    <div>
      <PageHead path="/urea" lede="Urea is the body’s main nitrogenous waste — and half the osmolality of the inner medulla. Follow it from the liver through filtration, passive reabsorption, ADH-dependent trapping and recycling, and see how protein intake and ADH set the maximum urine concentration." />
      <WhatIf
        options={[
          { label: 'Low-protein diet', explain: 'Less urea is made, so less reaches the inner medulla: papillary osmolality and maximal urine concentration fall.' },
          { label: 'High-protein diet', explain: 'More urea: a higher inner-medullary contribution — and more osmoles that must be excreted each day.' },
          { label: 'No ADH', explain: 'Without water removal upstream, tubular urea never becomes concentrated enough to diffuse out, and UT-A1 is less active: urea accumulation collapses.' },
          { label: 'UT-A1/A3 knockout', explain: 'Mice lacking inner medullary urea transporters cannot accumulate urea and have a concentrating defect on a normal-protein diet.' },
        ]}
        onApply={(o) => {
          const m: Record<string, Partial<S>> = {
            'Low-protein diet': { protein: 25 },
            'High-protein diet': { protein: 180 },
            'No ADH': { adh: 0 },
            'UT-A1/A3 knockout': { uta: 0.05 },
          };
          setS({ ...START, ...m[o.label] });
        }}
        onReset={() => setS(START)}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Controls">
            <Slider label="Protein intake" value={s.protein} min={10} max={220} unit="g/day" onInput={(v) => up({ protein: v })} />
            <Slider label="Plasma ADH" value={s.adh} min={0} max={10} step={0.1} unit="pg/mL" onInput={(v) => up({ adh: v })} />
            <Slider label="IMCD urea transporters (UT-A1/A3)" value={s.uta} min={0} max={1.5} step={0.05} unit="×" onInput={(v) => up({ uta: v })} />
            <Slider label="GFR" value={s.gfr} min={20} max={180} unit="mL/min" onInput={(v) => up({ gfr: v })} />
          </Panel>
          <Panel title="Results">
            <div class="readout-grid">
              <Readout label="Urea made" value={ureaGen(s.protein) * 1440} unit="mmol/day" />
              <Readout label="BUN (steady)" value={bun} unit="mg/dL" />
              <Readout label="Filtered urea" value={filteredUrea} unit="mmol/day" />
              <Readout label="Urine urea" value={uUrea} unit="mmol/L" />
              <Readout label="Medullary urea" value={r.gUrea} unit="mOsm/kg" />
              <Readout label="Medullary NaCl" value={r.gNaCl} unit="mOsm/kg" />
              <Readout label="Papillary osmolality" value={r.medullaTarget} unit="mOsm/kg" />
              <Readout label="Urine osmolality" value={uOsm} unit="mOsm/kg" />
            </div>
          </Panel>
        </div>
        <div>
          <Panel title="Urea along the nephron" note="Amount of urea leaving each segment, as a percentage of the filtered load. More than 100% leaving the loop means urea recycled from the medulla has been added back.">
            {SEGMENTS.map((id) => {
              const pct = (r.segments[id].out.urea / (r.segments.PT.in.urea || 1)) * 100;
              return <BarRow key={id} label={SEGMENT_INFO[id].name} value={pct} max={Math.max(140, pct)} unit="%" color={id === 'IMCD' ? '#b08ee0' : '#6aa9e8'} />;
            })}
            {mode === 'quantitative' && <p class="control-hint">IMCD urea reabsorbed into the interstitium: {(r.segments.IMCD.in.urea - r.segments.IMCD.out.urea) * 1440 > 0 ? ((r.segments.IMCD.in.urea - r.segments.IMCD.out.urea) * 1440).toFixed(0) : 0} mmol/day</p>}
          </Panel>
          <div class="grid grid-2">
            <Panel title="From protein to papilla">
              <Chain
                steps={[
                  { text: 'Dietary protein → amino acids not used for synthesis are deaminated in the liver' },
                  { text: 'NH₃ is detoxified to urea (2 NH₃ + CO₂ → urea + H₂O)' },
                  { text: 'Urea is freely filtered; ~40–50% is reabsorbed passively as water is reabsorbed' },
                  { text: 'With ADH, water leaves the urea-impermeable cortical and outer-medullary collecting duct: luminal urea rises steeply' },
                  { text: 'UT-A1/A3 (ADH-stimulated) let urea diffuse into the inner medullary interstitium' },
                  { text: 'Some re-enters the thin limbs (UT-A2) and recirculates; ~half of papillary osmolality is urea' },
                ]}
              />
            </Panel>
            <Panel title="Why urea matters for concentrating">
              <ul class="muted" style={{ fontSize: '0.88rem' }}>
                <li>It lets the kidney excrete a large urea load without obligating extra water — urea in the interstitium balances urea in the urine.</li>
                <li>By drawing water out of the descending limb, it raises luminal NaCl at the hairpin and so favours passive NaCl exit from the thin ascending limb.</li>
                <li>ADH washout experiments: without ADH, papillary urea almost disappears and NaCl falls too.</li>
                <li>In humans, three days of water loading dropped maximal ADH-stimulated urine osmolality by more than 400 mOsm/kg.</li>
              </ul>
            </Panel>
          </div>
        </div>
      </div>
      <div class="grid grid-2">
        <Predict
          question="A patient is on a very low protein diet and is then water-deprived. Compared with normal, maximal urine osmolality will be:"
          options={['Higher', 'Lower', 'The same']}
          correct={1}
          explanation="Less urea reaches the inner medulla, so the papilla is less concentrated and the urine can only equilibrate with a lower osmolality. (A low solute intake also limits free-water excretion — the ‘tea and toast’ problem, but that is about dilution.)"
        />
        <Predict
          question="In volume depletion the BUN rises out of proportion to creatinine. Why?"
          options={['Urea production rises', 'More proximal Na⁺ and water reabsorption means more passive urea reabsorption (and ADH increases medullary urea reabsorption)', 'GFR falls more than creatinine shows']}
          correct={1}
          explanation="Urea follows water. Creatinine is not reabsorbed, so the BUN/creatinine ratio rises above ~20:1."
        />
      </div>
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>About half of filtered urea is excreted; in antidiuresis inner medullary urea supplies about half the papillary osmolality.</p>}
          why={<p>Collecting ducts are impermeable to urea until the inner medulla, where ADH-regulated transporters let concentrated urea out; recycling through the thin limbs keeps it there.</p>}
          change={<p>More protein or ADH: more medullary urea. Less of either, or loss of UT-A: less concentrating ability.</p>}
          abnormal={<p>Low protein intake, water loading, diabetes insipidus and urea-transporter defects all reduce maximal urine osmolality.</p>}
          clinical={<p>BUN reflects production (protein, GI bleeding, steroids, catabolism) and reabsorption (volume depletion) as well as GFR. Urea is an ineffective osmole across cell membranes, so uraemia does not cause cell shrinkage.</p>}
        />
        <Sources cite={{ rose: [4, 2], evidence: 'physiology', refs: ['fenton2004', 'sands2009', 'klein2011'] }} />
      </Panel>
      <Related paths={['/countercurrent', '/adh', '/urine-osmolality', '/prerenal-atn']} />
    </div>
  );
}
