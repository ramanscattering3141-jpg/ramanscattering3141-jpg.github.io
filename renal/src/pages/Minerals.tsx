import { useState } from 'preact/hooks';
import { PageHead, FiveQuestions, Related, Busy, useTabParam } from '../ui/page';
import { Panel, Readout, Slider, Sources, Predict, Tabs, Chain, LineChart, BarRow, Expand, toneFor, type Series } from '../ui/kit';
import { makeParams, useSteady } from '../sim/hooks';
import type { ParamPatch } from '../engine/types';

const TAB_IDS = ['hormones', 'handling', 'ckd', 'magnesium'] as const;
type Tab = (typeof TAB_IDS)[number];
const TABS: { id: Tab; label: string }[] = [
  { id: 'hormones', label: 'The three hormones' },
  { id: 'handling', label: 'Where they are handled' },
  { id: 'ckd', label: 'CKD–mineral & bone' },
  { id: 'magnesium', label: 'Magnesium' },
];

const MGDL_CA = 4.0; // mmol/L → mg/dL for calcium
const MGDL_PI = 3.1; // mmol/L → mg/dL for phosphate

// ---------------------------------------------------------------- hormones

function HormonesTab() {
  // Corrected calcium is pure arithmetic (Rose ch. 6): +0.02 mmol/L per 1 g/L of albumin below 40.
  const [measured, setMeasured] = useState(2.05);
  const [albumin, setAlb] = useState(28);
  const corrected = measured + 0.02 * (40 - albumin);

  // The calcium-sensing receptor sets the parathyroid's threshold. Activating it (a drug, or the
  // autosomal-dominant hypocalcaemia mutation) suppresses PTH at a lower calcium; inactivating it
  // (familial hypocalciuric hypercalcaemia) needs a higher calcium to switch PTH off.
  const [casr, setCasr] = useState(1);
  const sick = useSteady(makeParams({ transporters: { CaSR: casr } }), 30);
  const s = sick.ev;

  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Correct the calcium first" note="About 45% of plasma calcium is ionised; the rest is bound to albumin or complexed. Hypoalbuminaemia lowers the total without touching the ionised, active fraction.">
            <Slider label="Measured total calcium" value={measured} min={1.6} max={3.2} step={0.01} unit="mmol/L" onInput={setMeasured} normal={2.35} format={(v) => `${v.toFixed(2)} (${(v * MGDL_CA).toFixed(1)} mg/dL)`} />
            <Slider label="Serum albumin" value={albumin} min={15} max={50} step={1} unit="g/L" onInput={setAlb} normal={40} />
            <div class="readout-grid">
              <Readout label="Corrected calcium" value={corrected} digits={2} unit="mmol/L" tone={toneFor(corrected, 2.2, 2.6)} refRange={`${(corrected * MGDL_CA).toFixed(1)} mg/dL`} />
              <Readout label="Correction" value={corrected - measured} digits={2} unit="mmol/L" />
            </div>
            <p class="note" style={{ marginBottom: 0 }}>
              {corrected >= 2.2 && measured < 2.2
                ? 'The low total is entirely the low albumin — the ionised calcium is normal, and no treatment is needed.'
                : corrected < 2.2
                  ? 'Genuinely low even after correction: hypocalcaemia.'
                  : 'Normal.'}
            </p>
          </Panel>
          <Panel title="What each hormone does">
            <div class="table-wrap"><table>
              <thead>
                <tr><th></th><th>Gut</th><th>Bone</th><th>Kidney</th></tr>
              </thead>
              <tbody>
                <tr><td><strong>PTH</strong></td><td>↑ (via calcitriol)</td><td>↑ resorption</td><td>↑ Ca reab, ↓ PO₄ reab, ↑ calcitriol</td></tr>
                <tr><td><strong>Calcitriol</strong></td><td>↑ Ca and PO₄</td><td>↑ resorption</td><td>↑ Ca reab; ↓ PTH</td></tr>
                <tr><td><strong>FGF23</strong></td><td>—</td><td>(from bone)</td><td>↓ PO₄ reab, ↓ calcitriol</td></tr>
              </tbody>
            </table></div>
            <p class="muted" style={{ fontSize: '0.85rem', marginBottom: 0 }}>PTH's phosphaturia usually outweighs the phosphate it releases from bone and gut, so PTH <em>lowers</em> plasma phosphate.</p>
          </Panel>
        </div>
        <div>
          <Panel title="The calcium-sensing receptor sets the setpoint" note="The parathyroid reads ionised calcium through the CaSR. Turn the receptor's sensitivity up or down and watch where PTH and calcium settle.">
            <Busy on={sick.busy} />
            <Slider label="CaSR sensitivity" value={casr} min={0.4} max={1.8} step={0.05} unit="× normal" onInput={setCasr} normal={1} hint={casr < 0.8 ? 'Inactivating: familial hypocalciuric hypercalcaemia' : casr > 1.2 ? 'Activating: autosomal-dominant hypocalcaemia (or a calcimimetic)' : 'Normal'} />
            {s && (
              <div class="readout-grid">
                <Readout label="Total calcium" value={s.plasma.Ca} digits={2} unit="mmol/L" tone={toneFor(s.plasma.Ca, 2.2, 2.6)} refRange={`${(s.plasma.Ca * MGDL_CA).toFixed(1)} mg/dL`} />
                <Readout label="PTH" value={s.reg.hormones.pth} digits={2} unit="× normal" tone={s.reg.hormones.pth > 1.5 ? 'high' : s.reg.hormones.pth < 0.6 ? 'low' : 'normal'} />
                <Readout label="Urine calcium" value={s.kidney.urine.exc.Ca} digits={1} unit="mmol/day" tone={s.kidney.urine.exc.Ca > 7.5 ? 'high' : s.kidney.urine.exc.Ca < 2.5 ? 'low' : 'normal'} />
                <Readout label="Calcitriol" value={s.reg.hormones.calcitriol} digits={2} unit="× normal" />
              </div>
            )}
          </Panel>
          <Panel title="The loop">
            <Chain
              steps={[
                { text: 'Ionised calcium falls', direction: -1 },
                { text: 'Parathyroid CaSR → PTH rises', direction: 1 },
                { text: 'Bone resorption + distal Ca reabsorption + calcitriol (gut absorption)', direction: 1 },
                { text: 'Phosphaturia offsets the phosphate released', direction: 0 },
                { text: 'Calcium restored, phosphate ≈ unchanged', direction: 1 },
              ]}
            />
            <Sources cite={{ rose: [6], evidence: 'physiology' }} />
          </Panel>
        </div>
      </div>
      <Predict
        question="A patient has a total calcium of 1.9 mmol/L and an albumin of 24 g/L. What is the ionised calcium likely to be?"
        options={['Low — treat the hypocalcaemia', 'Normal — the low total is the low albumin', 'High', 'Cannot tell without PTH']}
        correct={1}
        explanation="Corrected calcium = 1.9 + 0.02 × (40 − 24) = 2.22 mmol/L, normal. The measured total is low only because there is less albumin to bind."
      />
    </>
  );
}

// ---------------------------------------------------------------- handling

function HandlingTab() {
  const low = useSteady(makeParams({ pthMode: 'low' }), 30);
  const high = useSteady(makeParams({ pthMode: 'high' }), 30);
  const busy = low.busy || high.busy;
  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="PTH pulls calcium and phosphate in opposite directions" note="It raises distal calcium reabsorption but blocks proximal phosphate reabsorption. Compare a suppressed and a maximal parathyroid.">
            <Busy on={busy} />
            {low.ev && high.ev && (
              <div class="readout-grid">
                <Readout label="Calcium (low PTH)" value={low.ev.plasma.Ca} digits={2} unit="mmol/L" />
                <Readout label="Calcium (high PTH)" value={high.ev.plasma.Ca} digits={2} unit="mmol/L" tone="high" />
                <Readout label="Phosphate (low PTH)" value={low.ev.plasma.Pi} digits={2} unit="mmol/L" tone="high" />
                <Readout label="Phosphate (high PTH)" value={high.ev.plasma.Pi} digits={2} unit="mmol/L" tone="low" />
                <Readout label="Urine Ca (low PTH)" value={low.ev.kidney.urine.exc.Ca} digits={1} unit="mmol/d" tone="high" />
                <Readout label="Urine Ca (high PTH)" value={high.ev.kidney.urine.exc.Ca} digits={1} unit="mmol/d" tone="low" />
              </div>
            )}
            <p class="muted" style={{ fontSize: '0.85rem', marginBottom: 0 }}>Low PTH (hypoparathyroidism) wastes calcium in the urine despite a low plasma level — the distal reabsorption is lost.</p>
          </Panel>
        </div>
        <div>
          <Panel title="Where calcium is reabsorbed" note="Fraction of the filtered load, by segment. Most is passive and paracellular in the proximal tubule and thick ascending limb; the fine, hormone-controlled adjustment is distal.">
            <BarRow label="Proximal tubule" value={65} max={100} unit="%" color="#5ecfba" />
            <BarRow label="Thick ascending limb" value={20} max={100} unit="%" color="#6aa9e8" sub="paracellular, via claudin-16; driven by the lumen-positive voltage" />
            <BarRow label="Distal tubule / CNT" value={10} max={100} unit="%" color="#f2b134" sub="active, TRPV5; PTH and calcitriol act here" />
            <BarRow label="Excreted" value={2} max={100} unit="%" color="#e07b6a" />
          </Panel>
          <Panel title="Where phosphate is reabsorbed" note="Almost entirely proximal, through the NaPi-II cotransporter — the target of both PTH and FGF23.">
            <BarRow label="Proximal tubule (NaPi-II)" value={85} max={100} unit="%" color="#5ecfba" sub="80–95% normally; falls to as low as 15% under PTH/FGF23" />
            <BarRow label="Excreted" value={13} max={100} unit="%" color="#e07b6a" />
          </Panel>
          <Sources cite={{ rose: [3, 4, 6], evidence: 'physiology' }} />
        </div>
      </div>
      <Predict
        question="A patient with primary hyperparathyroidism has a high calcium. Why is the urine calcium often high too, despite PTH raising reabsorption?"
        options={['PTH lowers reabsorption', 'The filtered calcium load is so high that more is excreted even though the fraction reabsorbed rises', 'Calcitriol is low', 'The kidney is damaged']}
        correct={1}
        explanation="Excretion = filtered load × (1 − fractional reabsorption). A high plasma calcium raises the filtered load enough that absolute excretion rises — which is why hypercalcaemia of any cause tends to cause hypercalciuria and stones."
      />
    </>
  );
}

// ---------------------------------------------------------------- CKD-MBD

const CKD_STEPS: { nf: number }[] = [{ nf: 1 }, { nf: 0.6 }, { nf: 0.4 }, { nf: 0.28 }, { nf: 0.18 }, { nf: 0.12 }, { nf: 0.08 }];

function CkdTab() {
  const [idx, setIdx] = useState(4);
  const runs = CKD_STEPS.map((c) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useSteady(makeParams({ nephronFraction: c.nf }), 40),
  );
  const busy = runs.some((r) => r.busy);
  const pts = (f: (e: NonNullable<(typeof runs)[number]['ev']>) => number): Series['points'] =>
    runs.filter((r) => r.ev).map((r) => ({ x: r.ev!.kidney.GFR, y: f(r.ev!) }));
  const cur = runs[idx].ev;
  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Follow one patient down" note="Reduce the working nephron mass and read the mineral picture. The hormones respond long before the calcium and phosphate move.">
            <Busy on={busy} />
            <Slider label="Nephron mass" value={idx} min={0} max={CKD_STEPS.length - 1} step={1} onInput={(v) => setIdx(Math.round(v))} format={() => (cur ? `GFR ${cur.kidney.GFR.toFixed(0)} mL/min` : '…')} />
            {cur && (
              <div class="readout-grid">
                <Readout label="Phosphate" value={cur.plasma.Pi} digits={2} unit="mmol/L" tone={toneFor(cur.plasma.Pi, 0.8, 1.45)} refRange={`${(cur.plasma.Pi * MGDL_PI).toFixed(1)} mg/dL`} />
                <Readout label="Calcium" value={cur.plasma.Ca} digits={2} unit="mmol/L" tone={toneFor(cur.plasma.Ca, 2.2, 2.6)} refRange={`${(cur.plasma.Ca * MGDL_CA).toFixed(1)} mg/dL`} />
                <Readout label="PTH" value={cur.reg.hormones.pth} digits={1} unit="× normal" tone={cur.reg.hormones.pth > 1.5 ? 'high' : 'normal'} />
                <Readout label="Calcitriol" value={cur.reg.hormones.calcitriol} digits={2} unit="× normal" tone={cur.reg.hormones.calcitriol < 0.7 ? 'low' : 'normal'} />
                <Readout label="FGF23" value={cur.reg.hormones.fgf23} digits={1} unit="× normal" tone={cur.reg.hormones.fgf23 > 1.5 ? 'high' : 'normal'} />
                <Readout label="Ca × PO₄ product" value={cur.plasma.Ca * cur.plasma.Pi} digits={1} tone={cur.plasma.Ca * cur.plasma.Pi > 3.5 ? 'danger' : 'normal'} refRange="mmol²/L²" />
                <Readout label="Bicarbonate" value={cur.plasma.HCO3} digits={0} unit="mmol/L" tone={toneFor(cur.plasma.HCO3, 22, 28)} />
              </div>
            )}
          </Panel>
          <Panel title="The sequence">
            <Chain
              steps={[
                { text: 'GFR falls → phosphate retained', direction: -1 },
                { text: 'FGF23 rises first, then PTH; calcitriol falls', direction: 1 },
                { text: 'Phosphaturia keeps phosphate near normal — until GFR < ~30', direction: 0 },
                { text: 'Below that, PTH can no longer excrete it: phosphate rises', direction: 1 },
                { text: 'High Ca × PO₄ product: vascular and soft-tissue calcification', direction: -1 },
              ]}
            />
            <Sources cite={{ rose: [6, 19], evidence: 'clinical', refs: ['isakova2011', 'ketteler2017'] }} />
          </Panel>
        </div>
        <div>
          <Panel title="Phosphate and calcium as GFR falls">
            <LineChart
              xLabel="GFR (mL/min)"
              series={[
                { label: 'phosphate', points: pts((e) => e.plasma.Pi), color: '#f2b134' },
                { label: 'calcium', points: pts((e) => e.plasma.Ca), color: '#5ecfba' },
              ]}
              bands={[{ from: 0.8, to: 1.45, label: 'PO₄', color: 'rgba(242,177,52,0.10)' }]}
              marker={cur?.kidney.GFR}
              xFormat={(x) => x.toFixed(0)}
              height={190}
            />
          </Panel>
          <Panel title="The hormones (× normal)">
            <LineChart
              xLabel="GFR (mL/min)"
              series={[
                { label: 'PTH', points: pts((e) => e.reg.hormones.pth), color: '#e07b6a' },
                { label: 'FGF23', points: pts((e) => e.reg.hormones.fgf23), color: '#b18ae0' },
                { label: 'calcitriol', points: pts((e) => e.reg.hormones.calcitriol), color: '#6aa9e8' },
              ]}
              marker={cur?.kidney.GFR}
              xFormat={(x) => x.toFixed(0)}
              yMin={0}
              height={190}
            />
          </Panel>
        </div>
      </div>
      <Predict
        question="In moderate CKD (GFR 45) the phosphate is still normal but PTH is already three times normal. Why?"
        options={['The laboratory is wrong', 'Secondary hyperparathyroidism is holding the phosphate normal by forcing phosphaturia — the normal phosphate is bought at the cost of a high PTH', 'PTH is irrelevant to phosphate', 'The patient is hyperphosphataemic really']}
        correct={1}
        explanation="This is the trade-off. Each fall in GFR needs a further rise in PTH and FGF23 to keep the phosphate normal. Once the GFR falls below ~30, even maximal phosphaturia is not enough and the phosphate climbs."
      />
      <Expand summary="How the model is calibrated">
        <p class="muted" style={{ fontSize: '0.88rem' }}>
          Phosphate reabsorption is suppressed by PTH and FGF23 down to a floor of ~20% (Rose: as low as 15% in severe failure), so the fractional excretion cannot rise without limit; below a GFR of about 20–30 mL/min the filtered load can no longer carry the daily intake and the phosphate rises. Calcium is defended by secondary hyperparathyroidism (bone resorption) and so falls only mildly. FGF23 rises steeply and suppresses calcitriol, which drives PTH further — the mechanism, recognised after Rose was written, for the calcitriol deficiency the book infers.
        </p>
      </Expand>
    </>
  );
}

// ---------------------------------------------------------------- magnesium

const MG_CAUSES: { id: string; label: string; patch: ParamPatch; how: string }[] = [
  { id: 'normal', label: 'Normal', patch: {}, how: 'About 30% of filtered magnesium is reabsorbed paracellularly in the thick ascending limb and 5–10% actively in the distal tubule.' },
  { id: 'gitelman', label: 'Gitelman (NCC loss)', patch: { transporters: { NCC: 0 } }, how: 'The distal tubule cannot reabsorb NaCl; TRPM6 falls and the segment atrophies, so magnesium is wasted — hypomagnesaemia is characteristic.' },
  { id: 'bartter', label: 'Bartter (NKCC2 loss)', patch: { transporters: { NKCC2: 0.35 } }, how: 'The thick limb cannot build the voltage that drives paracellular Mg and Ca reabsorption; but distal TRPM6 up-regulates, so the magnesium is usually only mildly low.' },
  { id: 'claudin', label: 'Claudin-16 loss', patch: { transporters: { claudin16: 0.15 } }, how: 'The paracellular pore for Mg and Ca in the thick limb is lost: familial hypomagnesaemia with hypercalciuria and nephrocalcinosis.' },
  { id: 'thiazide', label: 'Thiazide', patch: { drugs: { thiazide: 1 } }, how: 'Like Gitelman pharmacologically: distal NaCl transport blocked, mild magnesium wasting and — usefully — reduced urine calcium.' },
];

function MagnesiumTab() {
  const [idx, setIdx] = useState(0);
  const c = MG_CAUSES[idx];
  const run = useSteady(makeParams(c.patch), 30);
  const e = run.ev;
  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="A magnesium-handling defect" note={c.how}>
            <Busy on={run.busy} />
            <div class="btn-row" style={{ marginBottom: 8 }}>
              {MG_CAUSES.map((x, i) => (
                <button key={x.id} class={i === idx ? 'active' : ''} onClick={() => setIdx(i)}>{x.label}</button>
              ))}
            </div>
            {e && (
              <div class="readout-grid">
                <Readout label="Magnesium" value={e.plasma.Mg} digits={2} unit="mmol/L" tone={toneFor(e.plasma.Mg, 0.7, 1.0)} refRange={`${(e.plasma.Mg * 2.43).toFixed(1)} mg/dL`} />
                <Readout label="Calcium" value={e.plasma.Ca} digits={2} unit="mmol/L" tone={toneFor(e.plasma.Ca, 2.2, 2.6)} />
                <Readout label="Potassium" value={e.plasma.K} digits={2} unit="mmol/L" tone={toneFor(e.plasma.K, 3.5, 5.0)} />
                <Readout label="Urine calcium" value={e.kidney.urine.exc.Ca} digits={1} unit="mmol/d" tone={e.kidney.urine.exc.Ca > 7.5 ? 'high' : e.kidney.urine.exc.Ca < 2.5 ? 'low' : 'normal'} />
              </div>
            )}
          </Panel>
          <Panel title="Why magnesium and potassium travel together">
            <p class="muted" style={{ fontSize: '0.88rem', marginTop: 0 }}>
              Intracellular magnesium normally blocks the ROMK potassium channel from within. When magnesium is depleted the block is relieved, potassium leaks into the lumen, and the hypokalaemia becomes refractory until the magnesium is replaced — which is why magnesium must always be checked and corrected in stubborn hypokalaemia.
            </p>
            <Sources cite={{ rose: [4, 27], evidence: 'physiology' }} />
          </Panel>
        </div>
        <div>
          <Panel title="The two thiazide-like versus loop-like patterns" note="Whether the urine calcium is low or high separates a distal (thiazide-like) from a thick-limb (loop-like) defect — the bedside test that tells Gitelman from Bartter.">
            <div class="table-wrap"><table>
              <thead><tr><th></th><th>Site</th><th>Urine Ca</th><th>Magnesium</th></tr></thead>
              <tbody>
                <tr><td><strong>Gitelman / thiazide</strong></td><td>Distal tubule</td><td>Low</td><td>Low</td></tr>
                <tr><td><strong>Bartter / loop</strong></td><td>Thick limb</td><td>High</td><td>Normal / mildly low</td></tr>
                <tr><td><strong>Claudin-16</strong></td><td>Thick limb (pore)</td><td>High</td><td>Low</td></tr>
              </tbody>
            </table></div>
          </Panel>
          <Panel title="Where magnesium is reabsorbed">
            <BarRow label="Proximal tubule" value={20} max={100} unit="%" color="#5ecfba" />
            <BarRow label="Thick ascending limb" value={65} max={100} unit="%" color="#6aa9e8" sub="paracellular, claudin-16" />
            <BarRow label="Distal tubule" value={10} max={100} unit="%" color="#f2b134" sub="active, TRPM6" />
            <BarRow label="Excreted" value={5} max={100} unit="%" color="#e07b6a" />
          </Panel>
        </div>
      </div>
    </>
  );
}

// ----------------------------------------------------------------

export default function Minerals({ query }: { query: URLSearchParams }) {
  const [tab, setTab] = useTabParam('/minerals', TAB_IDS, 'hormones', query);
  return (
    <div>
      <PageHead
        path="/minerals"
        lede="Calcium, phosphate and magnesium are not regulated by the kidney alone: gut, bone and kidney share the work, and three hormones — PTH, calcitriol and FGF23 — hold the plasma levels between them. PTH raises calcium and lowers phosphate; the same machinery, run in reverse, is what fails in chronic kidney disease."
      />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'hormones' && <HormonesTab />}
      {tab === 'handling' && <HandlingTab />}
      {tab === 'ckd' && <CkdTab />}
      {tab === 'magnesium' && <MagnesiumTab />}
      <Panel title="The five questions" id="five">
        <FiveQuestions
          normal={<p>Gut, bone and kidney share the load; PTH, calcitriol and FGF23 hold ionised calcium and phosphate steady. About 45% of calcium is ionised; correct the total for albumin.</p>}
          why={<p>The parathyroid senses ionised calcium through the CaSR; phosphate and FGF23 set calcitriol; PTH raises distal calcium reabsorption and blocks proximal phosphate reabsorption.</p>}
          change={<p>Lose nephrons and phosphate is retained: FGF23 then PTH rise and calcitriol falls, holding phosphate normal until the GFR falls below ~30, when it climbs.</p>}
          abnormal={<p>Secondary hyperparathyroidism and bone disease, a high Ca × PO₄ product and vascular calcification; hypocalcaemia; magnesium wasting that makes hypokalaemia refractory.</p>}
          clinical={<p>Correct calcium for albumin; in CKD limit phosphate (diet, binders), replace calcitriol once phosphate is controlled, correct the acidosis; always check magnesium in stubborn hypokalaemia.</p>}
        />
        <Sources cite={{ rose: [3, 4, 6], evidence: 'clinical', refs: ['isakova2011', 'ketteler2017'] }} />
      </Panel>
      <Related paths={['/ckd', '/loop', '/distal', '/inherited', '/hormones', '/acid-base']} />
    </div>
  );
}
