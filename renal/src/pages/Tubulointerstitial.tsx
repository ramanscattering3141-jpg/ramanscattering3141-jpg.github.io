import { useState } from 'preact/hooks';
import { PageHead, FiveQuestions, Related, Busy, useTabParam } from '../ui/page';
import { Panel, Readout, Sources, Predict, Tabs, Chain, toneFor } from '../ui/kit';
import { makeParams, useSteady } from '../sim/hooks';

const TAB_IDS = ['acute', 'chronic'] as const;
type Tab = (typeof TAB_IDS)[number];
const TABS: { id: Tab; label: string }[] = [
  { id: 'acute', label: 'Acute interstitial nephritis' },
  { id: 'chronic', label: 'Chronic disease & tubular defects' },
];

// ---------------------------------------------------------------- acute

function AcuteTab() {
  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="An allergic reaction inside the kidney" note="Acute interstitial nephritis is an immune reaction in the interstitium, most often to a drug. The inflammation, not a haemodynamic or obstructive cause, is what drops the GFR.">
            <Chain
              steps={[
                { text: 'A drug (or infection, or autoimmune disease) triggers an interstitial immune reaction', direction: 1 },
                { text: 'Inflammatory infiltrate and oedema in the interstitium', direction: 1 },
                { text: 'Falling GFR over days, with tubular dysfunction', direction: -1 },
                { text: 'Stop the drug → often recovers; steroids may speed it', direction: 0 },
              ]}
            />
            <Sources cite={{ rose: [2], evidence: 'clinical', refs: ['perazella2012'] }} />
          </Panel>
          <Panel title="The usual culprits">
            <ul class="muted" style={{ fontSize: '0.9rem', marginTop: 0, lineHeight: 1.7 }}>
              <li><strong>Antibiotics</strong> — β-lactams, sulfonamides, quinolones, rifampicin.</li>
              <li><strong>Proton-pump inhibitors</strong> — an increasingly common and easily missed cause.</li>
              <li><strong>NSAIDs</strong> — can cause AIN, sometimes with a nephrotic-range proteinuria.</li>
              <li><strong>Immune-checkpoint inhibitors</strong> — a modern cause, as cancer immunotherapy spreads.</li>
              <li><strong>Infections and systemic disease</strong> — and sarcoidosis, Sjögren, tubulointerstitial nephritis with uveitis.</li>
            </ul>
          </Panel>
        </div>
        <div>
          <Panel title="How it declares itself">
            <p class="muted" style={{ fontSize: '0.9rem', marginTop: 0, lineHeight: 1.7 }}>
              The classic triad of fever, rash and eosinophilia is present in only a minority — its absence does not exclude the diagnosis. What is more reliable is the urine: sterile pyuria, white-cell casts, and sometimes eosinophiluria, in a patient whose creatinine has risen over days on a new drug.
            </p>
            <p class="muted" style={{ fontSize: '0.9rem', lineHeight: 1.7, marginBottom: 0 }}>
              The proteinuria is usually modest (a tubular pattern), which helps separate it from a glomerular cause — the exception being NSAID-induced disease, which can be nephrotic. The biopsy is definitive when the diagnosis is unclear or steroids are being considered.
            </p>
          </Panel>
          <Panel title="Why catching it matters">
            <p class="muted" style={{ fontSize: '0.9rem', marginTop: 0, lineHeight: 1.7, marginBottom: 0 }}>
              Acute interstitial nephritis is one of the reversible causes of acute kidney injury — but only if the drug is stopped early. Left in place, the infiltrate organises into fibrosis and the loss becomes permanent. So a rising creatinine on a new drug, with an active urine sediment and no other explanation, is AIN until proven otherwise.
            </p>
          </Panel>
        </div>
      </div>
      <Predict
        question="A patient on a PPI for six weeks has a creatinine that has risen from 80 to 190 µmol/L, sterile pyuria and white-cell casts, but no fever, rash or eosinophilia. Most likely?"
        options={['Acute tubular necrosis', 'Acute interstitial nephritis — the triad is usually absent, and the drug and urine fit', 'Pre-renal', 'Glomerulonephritis']}
        correct={1}
        explanation="A subacute creatinine rise on a PPI with sterile pyuria and white-cell casts is drug-induced acute interstitial nephritis, even without the classic triad. Stop the drug; consider a biopsy and steroids if it does not recover."
      />
    </>
  );
}

// ---------------------------------------------------------------- chronic

function ChronicTab() {
  const [nf, setNf] = useState(0.4);
  // Chronic tubulointerstitial disease reduces nephron mass and impairs tubular function; here a
  // reduced nephron mass with a mild aldosterone-signalling defect stands in for the type-4 pattern
  // and concentrating defect that characterise it.
  const run = useSteady(makeParams({ nephronFraction: nf, aldoSynthesis: 0.5, transporters: { AQP2: 0.6 } }), 30);
  const e = run.ev;
  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="The tubules fail before the filter" note="Chronic tubulointerstitial disease damages tubules and interstitium, so the tubular functions go early — concentration, acidification and potassium handling — while the GFR is still relatively preserved.">
            <Busy on={run.busy} />
            <input type="range" min={0.15} max={0.9} step={0.05} value={nf} onInput={(ev) => setNf(parseFloat((ev.target as HTMLInputElement).value))} style={{ width: '100%' }} />
            <p class="control-hint">Severity — nephron mass {(nf * 100).toFixed(0)}%</p>
            {e && (
              <div class="readout-grid">
                <Readout label="GFR" value={e.kidney.GFR} digits={0} unit="mL/min" tone={e.kidney.GFR < 30 ? 'danger' : e.kidney.GFR < 80 ? 'high' : 'normal'} />
                <Readout label="Max urine osm" value={e.kidney.urine.osm} digits={0} unit="mOsm/kg" tone={e.kidney.urine.osm < 400 ? 'low' : 'normal'} refRange="concentrating defect" />
                <Readout label="Potassium" value={e.plasma.K} digits={1} unit="mmol/L" tone={toneFor(e.plasma.K, 3.5, 5.0, [3, 6])} />
                <Readout label="Bicarbonate" value={e.plasma.HCO3} digits={0} unit="mmol/L" tone={toneFor(e.plasma.HCO3, 22, 28)} />
              </div>
            )}
            <p class="note" style={{ marginBottom: 0 }}>A hyperkalaemic, hyperchloraemic (type-4) acidosis with a concentrating defect, out of proportion to the GFR, is the signature of tubulointerstitial rather than glomerular disease.</p>
          </Panel>
          <Panel title="The pattern of defects">
            <Chain
              steps={[
                { text: 'Concentrating defect → polyuria and nocturia (medullary damage)', direction: -1 },
                { text: 'Impaired acid and potassium secretion → type-4 RTA', direction: 1 },
                { text: 'Sometimes proximal defects → Fanconi features', direction: -1 },
                { text: 'Salt wasting or retention, depending on the lesion', direction: 0 },
              ]}
            />
            <Sources cite={{ rose: [19, 28], evidence: 'clinical', refs: ['praga2010'] }} />
          </Panel>
        </div>
        <div>
          <Panel title="What causes it">
            <ul class="muted" style={{ fontSize: '0.9rem', marginTop: 0, lineHeight: 1.7 }}>
              <li><strong>Obstruction and reflux</strong> — chronic back-pressure and infection.</li>
              <li><strong>Drugs and toxins</strong> — analgesic nephropathy, lithium, calcineurin inhibitors, aristolochic acid, lead and cadmium.</li>
              <li><strong>Metabolic</strong> — chronic hypokalaemia, hypercalcaemia, hyperuricaemia, oxalate.</li>
              <li><strong>Immune and infiltrative</strong> — Sjögren, sarcoidosis, IgG4 disease.</li>
              <li><strong>Myeloma</strong> — cast nephropathy: filtered light chains obstruct and injure the tubules.</li>
            </ul>
          </Panel>
          <Panel title="How it differs from glomerular disease">
            <div class="table-wrap"><table>
              <thead><tr><th></th><th>Tubulointerstitial</th><th>Glomerular</th></tr></thead>
              <tbody>
                <tr><td><strong>Proteinuria</strong></td><td>Modest (tubular)</td><td>Can be heavy</td></tr>
                <tr><td><strong>Sediment</strong></td><td>White cells, casts</td><td>Red cells, casts</td></tr>
                <tr><td><strong>Early defect</strong></td><td>Tubular (concentration, K, acid)</td><td>Filtration, protein</td></tr>
                <tr><td><strong>Blood pressure</strong></td><td>Often normal early</td><td>Often raised</td></tr>
              </tbody>
            </table></div>
          </Panel>
        </div>
      </div>
      <Predict
        question="A patient with a GFR of 55 has a potassium of 5.6 and a bicarbonate of 18 — a bigger disturbance than the GFR alone would explain. What does this suggest?"
        options={['Pure glomerular disease', 'A tubulointerstitial process, which hits potassium and acid handling out of proportion to the GFR', 'Normal for the GFR', 'Laboratory error']}
        correct={1}
        explanation="A hyperkalaemic acidosis disproportionate to the GFR points to a tubular defect in potassium and acid secretion — the type-4 pattern of tubulointerstitial disease — rather than a simple loss of filtering nephrons."
      />
    </>
  );
}

// ----------------------------------------------------------------

export default function Tubulointerstitial({ query }: { query: URLSearchParams }) {
  const [tab, setTab] = useTabParam('/tubulointerstitial', TAB_IDS, 'acute', query);
  return (
    <div>
      <PageHead
        path="/tubulointerstitial"
        lede="Tubulointerstitial disease is injury to the tubules and the tissue around them rather than to the glomeruli. Its signature is tubular: a concentrating defect, a type-4 acidosis, potassium and sometimes proximal handling all disturbed out of proportion to the GFR, with a modest, tubular proteinuria and an active urine sediment."
      />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'acute' && <AcuteTab />}
      {tab === 'chronic' && <ChronicTab />}
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>The tubules and the interstitium do the reabsorptive and secretory work and hold the medullary gradient that concentrates the urine.</p>}
          why={<p>An immune, toxic, obstructive or infiltrative injury to the interstitium disturbs tubular function directly, and reduces the GFR through inflammation and, in time, fibrosis.</p>}
          change={<p>The tubular jobs fail first: concentration, acidification and potassium secretion, often before the GFR falls much — the opposite order to glomerular disease.</p>}
          abnormal={<p>Acute: a subacute creatinine rise, sterile pyuria and white-cell casts. Chronic: polyuria, a type-4 acidosis, and a slowly falling GFR with a small kidney.</p>}
          clinical={<p>Find and remove the cause — above all the offending drug — early, before fibrosis fixes the loss; support the tubular defects; consider steroids for acute interstitial nephritis.</p>}
        />
        <Sources cite={{ rose: [2, 19, 28], evidence: 'clinical', refs: ['perazella2012', 'praga2010'] }} />
      </Panel>
      <Related paths={['/aki', '/rta', '/hyperkalemia', '/ckd', '/obstruction', '/urine-osmolality']} />
    </div>
  );
}
