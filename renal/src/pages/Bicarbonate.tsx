import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related, Toggle } from '../ui/page';
import { Panel, Readout, Slider, Chain, Sources, Predict, LineChart, toneFor, BarRow } from '../ui/kit';
import { EquationCard } from '../ui/EquationCard';
import { nephronRun } from '../sim/nephron';
import { SEGMENTS } from '../engine/types';
import { SEGMENT_INFO } from '../content/segments';

interface S {
  hco3: number;
  pco2: number;
  nhe3: number;
  ca: number;
  nbce1: number;
  hatpase: number;
  volumeDepleted: boolean;
  k: number;
  aldo: number;
}
const START: S = { hco3: 24, pco2: 40, nhe3: 1, ca: 1, nbce1: 1, hatpase: 1, volumeDepleted: false, k: 4.2, aldo: 1 };

const CASES: { label: string; patch: Partial<S>; explain: string }[] = [
  { label: 'Raise plasma bicarbonate to 30', patch: { hco3: 30 }, explain: 'Above the reabsorptive plateau of ~26 mmol/L the excess spills into the urine. This is why a normal person can be given 1000 mmol of bicarbonate a day with almost no rise in the plasma level.' },
  { label: 'Metabolic acidosis (HCO₃⁻ 14)', patch: { hco3: 14 }, explain: 'A smaller filtered load is reclaimed completely, and the low cell pH drives more distal H⁺ secretion and more ammoniagenesis.' },
  { label: 'Acetazolamide', patch: { ca: 0.15 }, explain: 'Blocking carbonic anhydrase slows the dehydration of luminal carbonic acid, so the luminal pH falls quickly and proximal reabsorption collapses by up to 80% — a bicarbonate diuresis.' },
  { label: 'Proximal (type 2) RTA', patch: { nbce1: 0.2 }, explain: 'Bicarbonate cannot leave the cell, so proximal reclamation fails. Wasting continues until the plasma level falls far enough for the distal nephron to cope — then the urine acidifies normally.' },
  { label: 'Distal (type 1) RTA', patch: { hatpase: 0.15, hco3: 16 }, explain: 'The collecting duct cannot generate the gradient: urine pH stays above 5.5, so neither titratable acid nor ammonium can be formed in quantity.' },
  { label: 'Volume depletion', patch: { volumeDepleted: true, hco3: 30 }, explain: 'Angiotensin II, aldosterone and avid Na⁺ reabsorption push the reabsorptive threshold above 35 mmol/L — how a metabolic alkalosis is maintained rather than excreted.' },
  { label: 'Hypokalaemia', patch: { k: 2.8, hco3: 30 }, explain: 'K⁺ leaves cells and H⁺ enters: the acidified cell secretes more H⁺, reabsorbs more bicarbonate and makes more ammonium — so hypokalaemia sustains an alkalosis.' },
  { label: 'Chronic respiratory acidosis', patch: { pco2: 70, hco3: 34 }, explain: 'A high PCO₂ acidifies the cell directly, and the high filtered bicarbonate load lets more H⁺ be secreted without the luminal pH falling too far — the renal compensation of 3.5 mmol/L per 10 mmHg.' },
];

export default function Bicarbonate() {
  const [s, setS] = useState<S>(START);
  const up = (p: Partial<S>) => setS({ ...s, ...p });

  const r = useMemo(() => {
    const pH = 6.1 + Math.log10(s.hco3 / (0.03 * s.pco2));
    return nephronRun({
      plasma: { HCO3: s.hco3, PCO2: s.pco2, pH, K: s.k },
      hormones: { aldo: s.aldo, mr: s.aldo, at1: s.volumeDepleted ? 3 : 1, sns: s.volumeDepleted ? 1.6 : 1 },
      patch: { transporters: { NHE3: s.nhe3, CA: s.ca, NBCe1: s.nbce1, HATPase: s.hatpase } },
      ...(s.volumeDepleted ? { FF: 0.28, piPtc: 38, Pptc: 14 } : {}),
    });
  }, [s]);

  const filtered = r.segments.PT.in.HCO3 * 1440;
  const excreted = r.urineOut.HCO3 * 1440;
  const reabsorbed = filtered - excreted;
  const fe = (excreted / Math.max(filtered, 1e-9)) * 100;
  const urinePh = r.urinePH;
  const nae = (r.urineTA + r.urineNH4 - r.urineHCO3) * 1440;

  // The classic titration: reabsorption against plasma bicarbonate, showing the plateau.
  const curve = useMemo(() => {
    const normal: { x: number; y: number }[] = [];
    const depleted: { x: number; y: number }[] = [];
    for (let h = 10; h <= 45; h += 1.25) {
      const pH = 6.1 + Math.log10(h / (0.03 * s.pco2));
      const run = (vol: boolean) =>
        nephronRun({
          plasma: { HCO3: h, PCO2: s.pco2, pH, K: s.k },
          hormones: { aldo: s.aldo, mr: s.aldo, at1: vol ? 3 : 1, sns: vol ? 1.6 : 1 },
          patch: { transporters: { NHE3: s.nhe3, CA: s.ca, NBCe1: s.nbce1, HATPase: s.hatpase } },
          ...(vol ? { FF: 0.28, piPtc: 38, Pptc: 14 } : {}),
        });
      const a = run(false);
      const b = run(true);
      normal.push({ x: h, y: (a.segments.PT.in.HCO3 - a.urineOut.HCO3) * 1440 });
      depleted.push({ x: h, y: (b.segments.PT.in.HCO3 - b.urineOut.HCO3) * 1440 });
    }
    return { normal, depleted };
  }, [s.pco2, s.nhe3, s.ca, s.nbce1, s.hatpase, s.k, s.aldo]);

  return (
    <div>
      <PageHead
        path="/bicarbonate"
        lede="About 4300 mmol of bicarbonate is filtered every day and essentially all of it must come back, because bicarbonate lost in the urine is the same as acid gained. Change the plasma bicarbonate, block a transporter or deplete the volume, and watch reclamation succeed or fail."
      />
      <WhatIf
        options={CASES.map((c) => ({ label: c.label, explain: c.explain }))}
        onApply={(o) => setS({ ...START, ...CASES.find((c) => c.label === o.label)!.patch })}
        onReset={() => setS(START)}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Plasma">
            <Slider label="Plasma bicarbonate" value={s.hco3} min={8} max={45} step={0.5} unit="mmol/L" onInput={(v) => up({ hco3: v })} normal={24} />
            <Slider label="PCO₂" value={s.pco2} min={15} max={80} unit="mmHg" onInput={(v) => up({ pco2: v })} normal={40} />
            <Slider label="Plasma K⁺" value={s.k} min={2} max={7} step={0.1} unit="mmol/L" onInput={(v) => up({ k: v })} normal={4.2} hint="hypokalaemia acidifies the cell and raises reabsorption" />
            <Slider label="Aldosterone" value={s.aldo} min={0} max={6} step={0.25} unit="× normal" onInput={(v) => up({ aldo: v })} normal={1} />
            <Toggle label="Volume depleted (AII, SNS, high filtration fraction)" checked={s.volumeDepleted} onChange={(v) => up({ volumeDepleted: v })} />
          </Panel>
          <Panel title="Transporters">
            <Slider label="NHE3 (proximal Na⁺-H⁺ exchange)" value={s.nhe3} min={0} max={1.5} step={0.05} unit="×" onInput={(v) => up({ nhe3: v })} />
            <Slider label="Carbonic anhydrase" value={s.ca} min={0} max={1.5} step={0.05} unit="×" onInput={(v) => up({ ca: v })} />
            <Slider label="Na⁺-3HCO₃⁻ exit (NBCe1)" value={s.nbce1} min={0} max={1.5} step={0.05} unit="×" onInput={(v) => up({ nbce1: v })} />
            <Slider label="Collecting-duct H⁺-ATPase" value={s.hatpase} min={0} max={1.5} step={0.05} unit="×" onInput={(v) => up({ hatpase: v })} />
          </Panel>
        </div>
        <div>
          <Panel title="Bicarbonate handling">
            <div class="readout-grid">
              <Readout label="Filtered" value={filtered} unit="mmol/day" />
              <Readout label="Reabsorbed" value={reabsorbed} unit="mmol/day" />
              <Readout label="Excreted" value={excreted} digits={excreted < 10 ? 1 : 0} unit="mmol/day" tone={excreted > 20 ? 'danger' : 'normal'} />
              <Readout label="Fractional excretion" value={fe} digits={2} unit="%" tone={fe > 2 ? 'danger' : 'good'} />
              <Readout label="Urine pH" value={urinePh} digits={2} tone={toneFor(urinePh, 4.5, 6.5)} />
              <Readout label="Net acid excretion" value={nae} unit="mmol/day" tone={nae < 30 ? 'danger' : 'normal'} title="titratable acid + ammonium − urinary bicarbonate" />
            </div>
            <p class={excreted > 20 ? 'callout danger' : 'callout good'} style={{ marginTop: 8 }}>
              {excreted > 20
                ? `Bicarbonate is being lost in the urine (${excreted.toFixed(0)} mmol/day). Until that stops, no dietary acid can be excreted — the loss cancels it.`
                : `Essentially all the filtered bicarbonate is reclaimed, so the day's acid load can now be excreted as titratable acid and ammonium.`}
            </p>
          </Panel>
          <Panel title="Where it is reabsorbed" note="About 90% proximally, most of that in the first 1–2 mm, then the thick ascending limb and the outer medullary collecting duct.">
            {SEGMENTS.map((id) => {
              const seg = r.segments[id];
              const taken = (seg.in.HCO3 - seg.out.HCO3) * 1440;
              return <BarRow key={id} label={SEGMENT_INFO[id].name} value={Math.max(0, taken)} max={Math.max(100, filtered * 0.95)} unit=" mmol/day" color={taken < 0 ? '#e07b6a' : '#6aa9e8'} sub={taken < 0 ? 'secreting' : undefined} />;
            })}
          </Panel>
          <Panel title="The reabsorptive threshold" note="Reabsorption against plasma bicarbonate. Normally it plateaus near 26 mmol/L, so anything above that is excreted — which is why metabolic alkalosis cannot persist unless something raises the threshold.">
            <LineChart
              xLabel="plasma bicarbonate (mmol/L)"
              series={[
                { label: 'Normal volume', points: curve.normal, color: '#5ecfba' },
                { label: 'Volume depleted', points: curve.depleted, color: '#e07b6a', dashed: true },
              ]}
              yMin={0}
              marker={s.hco3}
              height={230}
            />
          </Panel>
          <div class="grid grid-2">
            <Panel title="One mechanism, two outcomes">
              <Chain
                steps={[
                  { text: 'H₂O dissociates inside the cell: H⁺ secreted, OH⁻ left behind' },
                  { text: 'OH⁻ + CO₂ → HCO₃⁻ (carbonic anhydrase), exported basolaterally' },
                  { text: 'If the secreted H⁺ meets filtered HCO₃⁻ → reabsorption (plasma HCO₃⁻ defended)', direction: 0 },
                  { text: 'If it meets HPO₄²⁻ or NH₃ → a new HCO₃⁻ is added to the blood', direction: 1 },
                ]}
              />
            </Panel>
            <Panel title="Why luminal carbonic anhydrase matters">
              <ul class="muted" style={{ fontSize: '0.88rem', marginTop: 0 }}>
                <li>It dehydrates luminal carbonic acid fast, so it cannot accumulate.</li>
                <li>That keeps luminal H⁺ low, so Na⁺-H⁺ exchange is not working uphill — proximal fluid pH falls only to ~6.80.</li>
                <li>Segments without it (S3, collecting tubule) show a disequilibrium pH ~0.5 unit below the calculated value — and that low pH is what traps ammonia.</li>
              </ul>
            </Panel>
          </div>
        </div>
      </div>
      <div class="grid grid-2">
        <Predict
          question="A patient with proximal (type 2) RTA has a plasma bicarbonate of 16 and a urine pH of 5.2. Is the distal nephron working?"
          options={['No — the urine should be alkaline', 'Yes: once the plasma bicarbonate falls below the reduced threshold, the filtered load is small enough to reclaim, and the urine acidifies normally', 'Impossible to tell', 'Only with alkali']}
          correct={1}
          explanation="This is the hallmark of proximal RTA: an acid urine at a low plasma bicarbonate, but massive bicarbonaturia the moment alkali is given and the threshold is exceeded again."
        />
        <Predict
          question="Why does volume depletion sustain a metabolic alkalosis?"
          options={['It raises GFR', 'It raises the bicarbonate reabsorptive threshold, so the excess cannot be excreted', 'It lowers ammonium production', 'It lowers aldosterone']}
          correct={1}
          explanation="Angiotensin II, aldosterone, hypochloraemia and hypokalaemia together push reabsorption past 35 mmol/L. Volume and chloride repletion lowers the threshold and the bicarbonate is excreted."
        />
      </div>
      <EquationCard eq="nae" />
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>≈4300 mmol of bicarbonate is filtered and essentially all reclaimed — 90% proximally — with a reabsorptive plateau near a plasma level of 26 mmol/L.</p>}
          why={<p>H⁺ secreted into the lumen combines with filtered bicarbonate; carbonic anhydrase on both sides of the membrane keeps the reaction fast, and a Na⁺-3HCO₃⁻ carrier returns the bicarbonate to the blood.</p>}
          change={<p>Raise the plasma bicarbonate past the threshold and the excess is excreted. Block carbonic anhydrase or bicarbonate exit and reclamation fails. Deplete volume, chloride or potassium and the threshold rises.</p>}
          abnormal={<p>Proximal RTA loses bicarbonate until a new lower set point is reached; distal RTA cannot acidify the urine at all; volume depletion maintains alkalosis.</p>}
          clinical={<p>Acetazolamide exploits the mechanism deliberately. A metabolic alkalosis that persists always means bicarbonate excretion is blocked — usually by volume and chloride depletion.</p>}
        />
        <Sources cite={{ rose: [11], evidence: 'physiology', refs: ['hamm2015', 'curthoys2014', 'batlle2012'] }} />
      </Panel>
      <Related paths={['/ammonium', '/titratable-acid', '/acid-base', '/rta', '/metabolic-alkalosis', '/proximal']} />
    </div>
  );
}
