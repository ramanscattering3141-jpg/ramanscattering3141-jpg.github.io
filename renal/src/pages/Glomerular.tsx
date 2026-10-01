import { useState } from 'preact/hooks';
import { PageHead, FiveQuestions, Related, Busy, useTabParam } from '../ui/page';
import { Panel, Readout, Sources, Predict, Tabs, Chain, Expand, BarRow, toneFor } from '../ui/kit';
import { BedsideEquations } from '../ui/EquationCard';
import { makeParams, useSteady } from '../sim/hooks';
import { si } from '../units';
import type { ParamPatch } from '../engine/types';

const TAB_IDS = ['barrier', 'syndromes'] as const;
type Tab = (typeof TAB_IDS)[number];
const TABS: { id: Tab; label: string }[] = [
  { id: 'barrier', label: 'The barrier & proteinuria' },
  { id: 'syndromes', label: 'Nephrotic, nephritic & the diseases' },
];

// ---------------------------------------------------------------- barrier

function BarrierTab() {
  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Three layers, two kinds of selectivity" note="The filter keeps albumin in the blood by size and by charge. Damage either, and protein leaks.">
            <Chain
              steps={[
                { text: 'Fenestrated endothelium — the first sieve, coated in a negatively charged glycocalyx', direction: 0 },
                { text: 'Glomerular basement membrane — the main size barrier, also negatively charged', direction: 0 },
                { text: 'Podocytes and their slit diaphragms — the fine size barrier; nephrin and podocin hold the slit', direction: 0 },
              ]}
            />
            <p class="muted" style={{ fontSize: '0.9rem', lineHeight: 1.7, marginBottom: 0 }}>
              Albumin (69 kDa, and negatively charged) is right at the size cutoff and repelled by the charge, so almost none is filtered. Lose the charge (early minimal-change disease) or the size barrier (a hole in the membrane) and albumin pours through faster than the tubule can reclaim it.
            </p>
          </Panel>
          <Panel title="What the proteinuria is made of">
            <ul class="muted" style={{ fontSize: '0.9rem', marginTop: 0, lineHeight: 1.7 }}>
              <li><strong>Glomerular</strong> — albumin and larger proteins; the heavy proteinuria (&gt; 3.5 g/day) of glomerular disease.</li>
              <li><strong>Tubular</strong> — low-molecular-weight proteins normally reabsorbed proximally; modest, and a marker of tubulointerstitial disease.</li>
              <li><strong>Overflow</strong> — a filtered protein made in excess, such as light chains in myeloma.</li>
            </ul>
            <Sources cite={{ rose: [2, 16], evidence: 'physiology' }} />
          </Panel>
        </div>
        <div>
          <Panel title="Where filtration selectivity comes from">
            <BarRow label="Water, ions, glucose, urea" value={100} max={100} unit="% filtered" color="var(--c-teal)" sub="freely filtered, then handled by the tubule" />
            <BarRow label="Small proteins (β₂-microglobulin)" value={90} max={100} unit="%" color="var(--c-blue)" sub="filtered, then reabsorbed proximally" />
            <BarRow label="Albumin (69 kDa, anionic)" value={1} max={100} unit="%" color="var(--c-amber)" sub="size + charge: almost entirely retained" />
            <BarRow label="Immunoglobulin (150 kDa)" value={0.1} max={100} unit="%" color="var(--c-coral)" sub="too large to pass an intact barrier" />
          </Panel>
          <Panel title="Two ways the glomerulus fails">
            <p class="muted" style={{ fontSize: '0.9rem', marginTop: 0, lineHeight: 1.7 }}>
              A glomerular disease shows itself in one of two patterns, depending on whether the injury is mainly to the filter (protein leaks: <strong>nephrotic</strong>) or mainly inflammatory (blood and cells leak, and filtration falls: <strong>nephritic</strong>). Most diseases sit somewhere on the spectrum, and some cross it.
            </p>
            <p class="muted" style={{ fontSize: '0.9rem', lineHeight: 1.7, marginBottom: 0 }}>
              The urine is where the two declare themselves: bland but frothy in nephrotic syndrome, dark with red-cell casts and dysmorphic red cells in nephritic.
            </p>
          </Panel>
        </div>
      </div>
      <Predict
        question="Early minimal-change disease can cause heavy albuminuria with an apparently intact glomerular basement membrane on light microscopy. How?"
        options={['The membrane has large holes', 'Loss of the barrier’s negative charge lets anionic albumin through even though the size barrier looks intact', 'The tubule stops reabsorbing', 'Blood pressure is high']}
        correct={1}
        explanation="Charge selectivity is separate from size. Minimal-change disease effaces the podocyte foot processes and reduces the anionic charge, so albumin — small and negatively charged — leaks selectively, with a normal-looking membrane on light microscopy."
      />
    </>
  );
}

// ---------------------------------------------------------------- syndromes

interface Disease {
  id: string;
  label: string;
  patch: ParamPatch;
  syndrome: 'nephrotic' | 'nephritic' | 'mixed';
  note: string;
}

// Each disease is modelled with the glomerular surface-area/permeability factor and nephron mass
// that reproduce its GFR; the heavy proteinuria and hypoalbuminaemia of the nephrotic diseases are
// stated rather than driven from the engine (see the model note).
const DISEASES: Disease[] = [
  { id: 'mcd', label: 'Minimal change', patch: { proteinuria: 8 }, syndrome: 'nephrotic', note: 'Podocyte effacement and charge loss; a normal light microscopy. Heavy selective proteinuria, a normal GFR, and a brisk response to steroids. The commonest nephrotic syndrome in children.' },
  { id: 'fsgs', label: 'FSGS', patch: { proteinuria: 6, kfFactor: 0.6, nephronFraction: 0.65 }, syndrome: 'nephrotic', note: 'Segmental scarring: heavy proteinuria with some loss of GFR and often hypertension. Primary (a circulating permeability factor) or secondary to hyperfiltration.' },
  { id: 'membranous', label: 'Membranous', patch: { proteinuria: 8, kfFactor: 0.8 }, syndrome: 'nephrotic', note: 'Subepithelial immune deposits, most often against the podocyte antigen PLA2R. The classic adult nephrotic syndrome, with a notable risk of venous thrombosis.' },
  { id: 'iga', label: 'IgA nephropathy', patch: { proteinuria: 1.5, kfFactor: 0.55, nephronFraction: 0.6 }, syndrome: 'nephritic', note: 'Mesangial IgA deposition: haematuria (classically with a mucosal infection), variable proteinuria and a slow decline. The commonest glomerulonephritis worldwide.' },
  { id: 'rpgn', label: 'Crescentic (ANCA / anti-GBM)', patch: { proteinuria: 2, kfFactor: 0.3, nephronFraction: 0.3 }, syndrome: 'nephritic', note: 'Rapidly progressive: crescents, a falling GFR over days to weeks, active sediment. A nephrological emergency — immunosuppression cannot wait for the biopsy.' },
  { id: 'diabetic', label: 'Diabetic nephropathy', patch: { proteinuria: 4, glucose: 180 }, syndrome: 'mixed', note: 'Early hyperfiltration and microalbuminuria, then heavy proteinuria and a long decline. The commonest cause of end-stage kidney disease; ACE inhibitors, SGLT2 inhibitors and glycaemic control slow it.' },
];

const SYNDROME_TONE: Record<Disease['syndrome'], 'high' | 'danger' | 'normal'> = { nephrotic: 'high', nephritic: 'danger', mixed: 'normal' };

function SyndromesTab() {
  const [idx, setIdx] = useState(0);
  const d = DISEASES[idx];
  const run = useSteady(makeParams(d.patch), 30);
  const e = run.ev;
  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Nephrotic versus nephritic">
            <div class="table-wrap"><table>
              <thead><tr><th></th><th>Nephrotic</th><th>Nephritic</th></tr></thead>
              <tbody>
                <tr><td><strong>Proteinuria</strong></td><td>Heavy (&gt; 3.5 g/d)</td><td>Modest</td></tr>
                <tr><td><strong>Sediment</strong></td><td>Bland</td><td>Red cells, red-cell casts</td></tr>
                <tr><td><strong>GFR</strong></td><td>Often preserved</td><td>Reduced</td></tr>
                <tr><td><strong>Blood pressure</strong></td><td>Normal / mild</td><td>Raised</td></tr>
                <tr><td><strong>Oedema</strong></td><td>Marked</td><td>Present</td></tr>
                <tr><td><strong>The lesion</strong></td><td>The filter</td><td>Inflammation</td></tr>
              </tbody>
            </table></div>
          </Panel>
          <Panel title="Complications of the nephrotic syndrome">
            <ul class="muted" style={{ fontSize: '0.9rem', marginTop: 0, lineHeight: 1.7 }}>
              <li><strong>Oedema</strong> — mostly primary renal sodium retention (overfilling); the low oncotic pressure contributes less than the number suggests.</li>
              <li><strong>Thrombosis</strong> — loss of antithrombin and other regulators; renal-vein thrombosis, especially in membranous disease.</li>
              <li><strong>Infection</strong> — urinary loss of immunoglobulin and complement factors.</li>
              <li><strong>Hyperlipidaemia</strong> — the liver's response to a low oncotic pressure.</li>
            </ul>
            <Sources cite={{ rose: [2, 16], evidence: 'clinical', refs: ['dagati2011', 'vivarelli2017'] }} />
          </Panel>
        </div>
        <div>
          <Panel title="Pick a disease" note={d.note}>
            <Busy on={run.busy} />
            <div class="btn-row" style={{ marginBottom: 8 }}>
              {DISEASES.map((x, i) => (
                <button key={x.id} class={i === idx ? 'active' : ''} onClick={() => setIdx(i)}>{x.label}</button>
              ))}
            </div>
            {e && (
              <div class="readout-grid">
                <Readout label="Syndrome" value={d.syndrome} tone={SYNDROME_TONE[d.syndrome]} />
                <Readout label="Proteinuria" value={d.patch.proteinuria ?? 0} digits={1} unit="g/day" tone={(d.patch.proteinuria ?? 0) > 3.5 ? 'high' : 'normal'} />
                <Readout label="GFR" value={e.kidney.GFR} digits={0} unit="mL/min" tone={e.kidney.GFR < 30 ? 'danger' : e.kidney.GFR < 80 ? 'high' : 'normal'} />
                <Readout label="Creatinine" value={si.creat(e.body.creat)} digits={0} unit="µmol/L" tone={e.body.creat > 1.3 ? 'high' : 'normal'} />
                <Readout label="Mean BP" value={e.reg.MAP} digits={0} unit="mmHg" tone={e.reg.MAP > 100 ? 'high' : 'normal'} />
                <Readout label="Potassium" value={e.plasma.K} digits={1} unit="mmol/L" tone={toneFor(e.plasma.K, 3.5, 5.0)} />
              </div>
            )}
          </Panel>
          <Panel title="How to think about them">
            <p class="muted" style={{ fontSize: '0.9rem', marginTop: 0, lineHeight: 1.7, marginBottom: 0 }}>
              First place the patient on the nephrotic–nephritic spectrum from the urine and the GFR; then the age, the serology (PLA2R, ANCA, anti-GBM, complement, ANA) and the tempo narrow it to a diagnosis, which the biopsy confirms. A rapidly falling GFR with an active sediment is crescentic disease until proven otherwise, and does not wait.
            </p>
          </Panel>
        </div>
      </div>
      <Predict
        question="A young woman has 8 g/day of proteinuria, an albumin of 18 g/L, gross oedema, a normal creatinine and a bland urine. Nephrotic or nephritic, and roughly which lesion?"
        options={['Nephritic — crescentic disease', 'Nephrotic — a podocyte lesion such as minimal change or membranous', 'Neither', 'Obstruction']}
        correct={1}
        explanation="Heavy proteinuria, hypoalbuminaemia, oedema, a preserved GFR and a bland sediment define the nephrotic syndrome, pointing to a podocyte/filter lesion — minimal change, FSGS or membranous — rather than an inflammatory nephritic process."
      />
      <Expand summary="What the model does and does not capture">
        <p class="muted" style={{ fontSize: '0.88rem' }}>
          The engine reproduces the fall in GFR of the nephritic diseases well (reduced filtration surface and nephron mass), and the proteinuria's effect on the plasma albumin. It over-estimates the hyperfiltration of pure hypoalbuminaemia, because an isolated fall in plasma oncotic pressure raises the filtration pressure more than it does in a real patient, where tubuloglomerular feedback and the filtered protein buffer it — so the nephrotic diseases' heavy proteinuria and low albumin are stated here rather than driven from the plasma albumin. The nephrotic oedema, which is mostly primary sodium retention, is discussed on the <a href="#/edema">oedema page</a>.
        </p>
      </Expand>
    </>
  );
}

// ----------------------------------------------------------------

export default function Glomerular({ query }: { query: URLSearchParams }) {
  const [tab, setTab] = useTabParam('/glomerular', TAB_IDS, 'barrier', query);
  return (
    <div>
      <PageHead
        path="/glomerular"
        lede="The glomerulus filters by size and by charge, keeping albumin and cells in the blood. Damage it and it fails in one of two directions: the filter leaks protein (nephrotic), or inflammation lets blood through and filtration falls (nephritic). The urine tells you which, and the pattern narrows the diagnosis before the biopsy confirms it."
      />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'barrier' && <BarrierTab />}
      {tab === 'syndromes' && <SyndromesTab />}
      <BedsideEquations
        ids={['upcr', 'ckdepi']}
        intro="Quantify proteinuria from a spot urine, and estimate GFR (only in a steady state)."
      />
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>Three layers — endothelium, basement membrane, podocytes — filter by size and charge, so water and small solutes pass while albumin and cells stay in the blood.</p>}
          why={<p>Charge loss or a size defect lets protein through (nephrotic); immune injury and inflammation let blood and cells through and reduce filtration (nephritic).</p>}
          change={<p>Reduce the filtration surface or scar the glomeruli and the GFR falls; damage the podocyte and albumin leaks faster than the tubule can reclaim it.</p>}
          abnormal={<p>Nephrotic: heavy proteinuria, hypoalbuminaemia, oedema, thrombosis, infection. Nephritic: haematuria, red-cell casts, hypertension, a falling GFR.</p>}
          clinical={<p>Place the patient on the spectrum from the urine and GFR; use age, serology and tempo to narrow it; treat crescentic disease urgently; slow proteinuric disease with RAAS and SGLT2 blockade.</p>}
        />
        <Sources cite={{ rose: [2, 16], evidence: 'clinical', refs: ['dagati2011', 'vivarelli2017', 'kitching2020', 'mcadoo2017'] }} />
      </Panel>
      <Related paths={['/gfr', '/edema', '/ckd', '/tubulointerstitial', '/clearance', '/arterioles']} />
    </div>
  );
}
