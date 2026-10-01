import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related } from '../ui/page';
import { Panel, Readout, Slider, Chain, Sources, Predict, LineChart, toneFor } from '../ui/kit';
import { EquationCard } from '../ui/EquationCard';
import { nephronRun } from '../sim/nephron';

interface S {
  hco3: number;
  k: number;
  nephrons: number;
  rhcg: number;
  nkcc2: number;
  hatpase: number;
}
const START: S = { hco3: 24, k: 4.2, nephrons: 1, rhcg: 1, nkcc2: 1, hatpase: 1 };

const CASES: { label: string; patch: Partial<S>; explain: string }[] = [
  { label: 'Metabolic acidosis', patch: { hco3: 12 }, explain: 'Two levers act together: a lower cell pH induces the enzymes of ammoniagenesis over 5–6 days, and a more acid urine traps NH₃ more efficiently within hours. Excretion can exceed 300 mmol/day.' },
  { label: 'Hyperkalaemia', patch: { k: 6.2 }, explain: 'K⁺ competes with NH₄⁺ for the K⁺ site on NKCC2, so less ammonium is recycled into the medulla — the mechanism of the acidosis of type 4 RTA and hypoaldosteronism.' },
  { label: 'Hypokalaemia', patch: { k: 2.8 }, explain: 'K⁺ leaves cells and H⁺ enters: the acidified cell makes more ammonium and reabsorbs more bicarbonate, helping to sustain a metabolic alkalosis.' },
  { label: 'Chronic kidney disease', patch: { nephrons: 0.25, hco3: 18 }, explain: 'Each surviving nephron makes more ammonium, but total capacity still falls with nephron mass — so acid is retained and buffered by bone and muscle.' },
  { label: 'Distal RTA (no H⁺ pump)', patch: { hatpase: 0.15, hco3: 16 }, explain: 'Without a low urine pH the gradient for NH₃ to enter the lumen collapses, so ammonium excretion fails even though production may be normal.' },
  { label: 'Loop diuretic (NKCC2 blocked)', patch: { nkcc2: 0.15 }, explain: 'Medullary recycling depends on NH₄⁺ substituting for K⁺ on NKCC2. Block it and interstitial ammonia falls, reducing the gradient for secretion into the collecting duct.' },
  { label: 'Rh glycoprotein loss', patch: { rhcg: 0.15 }, explain: 'RhCG carries ammonia across collecting-duct membranes. Losing it impairs ammonium excretion and the response to an acid load — the modern refinement of the free-diffusion picture.' },
];

export default function Ammonium() {
  const [s, setS] = useState<S>(START);
  const up = (p: Partial<S>) => setS({ ...s, ...p });

  const run = (x: S) => {
    const pH = 6.1 + Math.log10(x.hco3 / (0.03 * 40));
    return nephronRun({
      plasma: { HCO3: x.hco3, pH, K: x.k },
      nephronFraction: x.nephrons,
      GFR: 130 * x.nephrons,
      patch: { nephronFraction: x.nephrons, transporters: { RhCG: x.rhcg, NKCC2: x.nkcc2, HATPase: x.hatpase } },
    });
  };
  const r = useMemo(() => run(s), [s]);

  const production = r.ammoniagenesis;
  const excreted = r.urineNH4 * 1440;
  const ta = r.urineTA * 1440;
  const nae = (r.urineTA + r.urineNH4 - r.urineHCO3) * 1440;
  // What the thick ascending limb takes back out of the lumen and hands to the interstitium.
  const recycled = Math.max(0, (r.segments.TAL.in.NH4 - r.segments.TAL.out.NH4) * 1440);
  const recycledPct = (recycled / Math.max(r.segments.TAL.in.NH4 * 1440, 1e-9)) * 100;

  // Excretion against plasma bicarbonate — the adaptive curve.
  const curve = useMemo(() => {
    const nh4: { x: number; y: number }[] = [];
    const titratable: { x: number; y: number }[] = [];
    for (let h = 6; h <= 32; h += 1) {
      const q = run({ ...s, hco3: h });
      nh4.push({ x: h, y: q.urineNH4 * 1440 });
      titratable.push({ x: h, y: q.urineTA * 1440 });
    }
    return { nh4, titratable };
  }, [s.k, s.nephrons, s.rhcg, s.nkcc2, s.hatpase]);

  return (
    <div>
      <PageHead
        path="/ammonium"
        lede="Titratable acid is fixed by how much phosphate is filtered; ammonium is not. Production from glutamine can rise several-fold, and every ammonium excreted returns a new bicarbonate to the blood — which is why ammonium, not phosphate, is how the kidney answers an acid load."
      />
      <WhatIf
        options={CASES.map((c) => ({ label: c.label, explain: c.explain }))}
        onApply={(o) => setS({ ...START, ...CASES.find((c) => c.label === o.label)!.patch })}
        onReset={() => setS(START)}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="The stimulus">
            <Slider label="Plasma bicarbonate" value={s.hco3} min={6} max={34} step={0.5} unit="mmol/L" onInput={(v) => up({ hco3: v })} normal={24} hint="lower = more acidaemic = more ammoniagenesis" />
            <Slider label="Plasma K⁺" value={s.k} min={2} max={7} step={0.1} unit="mmol/L" onInput={(v) => up({ k: v })} normal={4.2} />
            <Slider label="Functioning nephrons" value={s.nephrons} min={0.1} max={1} step={0.05} unit="× normal" onInput={(v) => up({ nephrons: v })} />
          </Panel>
          <Panel title="The machinery">
            <Slider label="NKCC2 (medullary recycling)" value={s.nkcc2} min={0} max={1.5} step={0.05} unit="×" onInput={(v) => up({ nkcc2: v })} />
            <Slider label="RhCG (collecting-duct NH₃ transport)" value={s.rhcg} min={0} max={1.5} step={0.05} unit="×" onInput={(v) => up({ rhcg: v })} />
            <Slider label="Collecting-duct H⁺-ATPase" value={s.hatpase} min={0} max={1.5} step={0.05} unit="×" onInput={(v) => up({ hatpase: v })} />
          </Panel>
          <Panel title="Result">
            <div class="readout-grid">
              <Readout label="Ammoniagenesis" value={production} unit="mmol/day" />
              <Readout label="Ammonium excreted" value={excreted} unit="mmol/day" tone={excreted < 20 ? 'danger' : excreted > 100 ? 'high' : 'normal'} />
              <Readout label="Titratable acid" value={ta} unit="mmol/day" />
              <Readout label="Net acid excretion" value={nae} unit="mmol/day" tone={nae < 30 ? 'danger' : 'normal'} />
              <Readout label="Urine pH" value={r.urinePH} digits={2} tone={toneFor(r.urinePH, 4.5, 6.5)} />
              <Readout label="Recycled in the loop" value={recycled} unit="mmol/day" title="NH₄⁺ reabsorbed by the thick ascending limb and delivered to the medullary interstitium as NH₃" />
              <Readout label="Recycled fraction" value={recycledPct} unit="%" tone={recycledPct < 50 ? 'danger' : 'normal'} title="Rose ch. 11: more than 75% of luminal ammonium is normally recycled" />
            </div>
          </Panel>
        </div>
        <div>
          <Panel title="The three steps" note="Production in the proximal tubule, recycling in the medulla, trapping in the collecting duct. Each step can fail separately.">
            <AmmoniaDiagram production={production} excreted={excreted} recycling={s.nkcc2} recyclingPct={recycledPct} trapping={s.rhcg * s.hatpase} urinePh={r.urinePH} />
          </Panel>
          <Panel title="Ammonium versus titratable acid as acidaemia deepens" note="The adaptive difference: ammonium climbs steeply as the plasma bicarbonate falls, while titratable acid is limited by filtered phosphate.">
            <LineChart yLabel="Urinary excretion (mmol/day)"
              xLabel="plasma bicarbonate (mmol/L)"
              series={[
                { label: 'Ammonium', points: curve.nh4, color: 'var(--c-teal)' },
                { label: 'Titratable acid', points: curve.titratable, color: 'var(--c-amber)' },
              ]}
              yMin={0}
              marker={s.hco3}
              height={230}
            />
          </Panel>
          <div class="grid grid-2">
            <Panel title="Glutamine to bicarbonate">
              <Chain
                steps={[
                  { text: 'Glutamine taken up by the proximal cell (luminal and, in acidaemia, basolateral)' },
                  { text: 'Glutaminase → glutamate → glutamate dehydrogenase → 2 NH₄⁺ + α-ketoglutarate' },
                  { text: 'α-Ketoglutarate metabolised → 2 new HCO₃⁻ to the blood', direction: 1 },
                  { text: 'NH₄⁺ secreted into the lumen on the Na⁺-H⁺ exchanger' },
                ]}
              />
            </Panel>
            <Panel title="Two ways to excrete more">
              <ul class="muted" style={{ fontSize: '0.88rem', marginTop: 0 }}>
                <li><strong>Within hours:</strong> a more acid urine traps NH₃ more efficiently — excretion starts rising within 2 h of an acid load.</li>
                <li><strong>Over 5–6 days:</strong> glutamine uptake and the enzymes of ammoniagenesis are induced (glutaminase day 1, glutamate dehydrogenase days 2–3).</li>
                <li>A fall in plasma bicarbonate of only 4–5 mmol/L produces a roughly four-fold rise in ammonium excretion.</li>
              </ul>
            </Panel>
          </div>
        </div>
      </div>
      <div class="grid grid-2">
        <Predict
          question="Why does the ammonia system work at a urine pH of 6.0 when its pKa is 9.0 — a ratio of 1 NH₃ to 1000 NH₄⁺?"
          options={['The pKa changes in urine', 'Trapping NH₃ as NH₄⁺ lowers luminal NH₃, which simply pulls more in from the interstitium', 'NH₄⁺ diffuses back', 'It does not work']}
          correct={1}
          explanation="The buffer is continuously replenished from the medullary interstitium, so it is never exhausted — unlike phosphate, which is filtered once and then used up."
        />
        <Predict
          question="A hyperkalaemic patient has a mild metabolic acidosis with an appropriately acid urine. Why?"
          options={['The kidney cannot secrete H⁺', 'K⁺ competes with NH₄⁺ on NKCC2, so medullary recycling and ammonium excretion fall', 'Bicarbonate is being lost', 'The GFR is low']}
          correct={1}
          explanation="Distal H⁺ secretion is intact (so the urine is acid), but the ammonia buffer is not there to carry the acid out — the picture of type 4 RTA."
        />
      </div>
      <div class="grid grid-2">
        <EquationCard eq="uag" compact />
        <EquationCard eq="uosmgap" compact />
      </div>
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>30–40 mmol/day of ammonium is excreted, carrying most of net acid excretion. Over 75% of the ammonium made proximally is recycled within the medulla rather than passing straight down the tubule.</p>}
          why={<p>Glutamine metabolism makes NH₄⁺ and, with it, new bicarbonate. The loop reabsorbs NH₄⁺ on NKCC2 and delivers NH₃ to the interstitium; the acid collecting duct then traps it as NH₄⁺, which cannot diffuse back.</p>}
          change={<p>Acidaemia raises production and lowers urine pH: excretion can exceed 300 mmol/day. Alkalaemia and hyperkalaemia reduce it.</p>}
          abnormal={<p>Distal RTA (no acid urine), type 4 RTA (hyperkalaemia blocks recycling), CKD (too few nephrons), and loss of the Rh transporters all reduce ammonium excretion and cause acidosis.</p>}
          clinical={<p>Urinary ammonium separates renal from gastrointestinal causes of a normal anion gap acidosis: high in diarrhoea, inappropriately low in RTA. Estimate it from the urine osmolal gap rather than the anion gap when unmeasured anions may be present.</p>}
        />
        <Sources cite={{ rose: [11], evidence: 'physiology', refs: ['weiner2017', 'curthoys2014', 'kamel2021', 'uribarri2021'] }} />
      </Panel>
      <Related paths={['/bicarbonate', '/titratable-acid', '/rta', '/metabolic-acidosis', '/countercurrent', '/acid-base']} />
    </div>
  );
}

/** The three steps of ammonium excretion, drawn along a nephron. */
function AmmoniaDiagram({ production, excreted, recycling, recyclingPct, trapping, urinePh }: { production: number; excreted: number; recycling: number; recyclingPct: number; trapping: number; urinePh: number }) {
  const w = (v: number) => Math.max(1.5, Math.min(11, v / 30));
  return (
    <svg viewBox="0 0 600 220" class="diagram" role="img" aria-label="Ammonium production, medullary recycling and collecting duct trapping">
      <rect x={20} y={20} width={560} height={80} fill="color-mix(in srgb, var(--panel-2) 13%, transparent)" stroke="color-mix(in srgb, var(--accent-dim) 33%, transparent)" rx={6} />
      <rect x={20} y={100} width={560} height={100} fill="var(--bg-2)" stroke="color-mix(in srgb, var(--accent-dim) 33%, transparent)" rx={6} />
      <text x={30} y={38} class="svg-small">CORTEX</text>
      <text x={30} y={195} class="svg-small">MEDULLA — interstitial NH₃ accumulates here</text>

      <text x={60} y={60} class="svg-label">Proximal tubule</text>
      <text x={60} y={76} class="svg-small">glutamine → NH₄⁺ + new HCO₃⁻</text>
      <line x1={155} x2={230} y1={70} y2={130} stroke="var(--c-teal)" stroke-width={w(production)} opacity={0.8} marker-end="url(#a-arr)" />
      <text x={160} y={112} class="svg-small">{production.toFixed(0)} mmol/day made</text>

      <text x={250} y={128} class="svg-label">Thick ascending limb</text>
      <text x={250} y={143} class="svg-small">NH₄⁺ on NKCC2 → NH₃ to interstitium</text>
      <line x1={330} x2={410} y1={150} y2={150} stroke="var(--c-violet)" stroke-width={w(production * recycling * 0.8)} opacity={0.85} marker-end="url(#a-arr2)" />
      <text x={330} y={172} class="svg-small">{recyclingPct.toFixed(0)}% recycled</text>

      <text x={425} y={128} class="svg-label">Collecting duct</text>
      <text x={425} y={143} class="svg-small">NH₃ trapped as NH₄⁺ (pH {urinePh.toFixed(1)})</text>
      <line x1={500} x2={500} y1={155} y2={196} stroke="var(--c-amber)" stroke-width={w(excreted)} opacity={0.9} marker-end="url(#a-arr3)" />
      <text x={510} y={186} class="svg-small">{excreted.toFixed(0)} excreted</text>
      <text x={425} y={160} class="svg-small" style={{ fill: trapping < 0.5 ? 'var(--c-coral)' : undefined }}>
        {trapping < 0.5 ? 'trapping impaired' : ''}
      </text>
      <defs>
        {['a-arr', 'a-arr2', 'a-arr3'].map((id, i) => (
          <marker key={id} id={id} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill={['var(--c-teal)', 'var(--c-violet)', 'var(--c-amber)'][i]} />
          </marker>
        ))}
      </defs>
    </svg>
  );
}
