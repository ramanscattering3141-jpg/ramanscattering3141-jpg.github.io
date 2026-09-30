import { useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related, Toggle } from '../ui/page';
import { Panel, Readout, Slider, Chain, Sources, Predict, Tabs, toneFor, BarRow } from '../ui/kit';
import { EquationCard } from '../ui/EquationCard';
import { useMode } from '../ui/mode';
import { compartments, COMPARTMENT_DEFAULT, starling, STARLING_DEFAULT, type CompartmentInput, type StarlingInput, type Organ } from '../sim/compartments';

/** Two boxes whose widths are the compartment volumes; the dashed outline is the starting size. */
function CompartmentBars(props: { icf0: number; ecf0: number; icf: number; ecf: number; osm: number }) {
  const scale = 560 / 50;
  const h = 96;
  const x0 = 20;
  const icfW = props.icf * scale;
  const ecfW = props.ecf * scale;
  const shade = Math.max(0, Math.min(1, (props.osm - 250) / 70));
  const fill = (base: [number, number, number]) => `rgb(${base.map((c) => Math.round(c * (1 - 0.35 * shade))).join(',')})`;
  return (
    <svg viewBox="0 0 600 150" class="diagram" role="img" aria-label="Intracellular and extracellular volumes">
      <rect x={x0} y={24} width={props.icf0 * scale} height={h} fill="none" stroke="var(--muted)" stroke-dasharray="4 3" />
      <rect x={x0 + props.icf0 * scale} y={24} width={props.ecf0 * scale} height={h} fill="none" stroke="var(--muted)" stroke-dasharray="4 3" />
      <rect x={x0} y={30} width={icfW} height={h - 12} rx={6} fill={fill([120, 170, 230])} opacity={0.85} />
      <rect x={x0 + icfW + 2} y={30} width={ecfW} height={h - 12} rx={6} fill={fill([240, 190, 110])} opacity={0.85} />
      <rect x={x0 + icfW + 2 + ecfW * 0.75} y={30} width={ecfW * 0.25} height={h - 12} rx={4} fill="rgba(220,80,80,0.35)" />
      <text x={x0 + icfW / 2} y={70} text-anchor="middle" class="svg-label">ICF {props.icf.toFixed(1)} L</text>
      <text x={x0 + icfW + 2 + (ecfW * 0.75) / 2} y={70} text-anchor="middle" class="svg-label">ECF {props.ecf.toFixed(1)} L</text>
      <text x={x0 + icfW + 2 + ecfW * 0.875} y={112} text-anchor="middle" class="svg-small">plasma</text>
      <text x={x0} y={16} class="svg-small">K⁺ salts hold water in cells</text>
      <text x={x0 + icfW + 2} y={16} class="svg-small">Na⁺ salts hold water outside cells</text>
      <text x={x0} y={142} class="svg-small">dashed outline = starting volumes · deeper colour = higher osmolality ({props.osm.toFixed(0)} mOsm/kg in every compartment)</text>
    </svg>
  );
}

type Tab = 'compartments' | 'starling';

const ADDITIONS: { label: string; patch: Partial<CompartmentInput>; explain: string }[] = [
  { label: 'Add 600 mOsm NaCl', patch: { nacl: 300 }, explain: 'The salt stays outside cells: 16,800 + 600 = 17,400 mOsm in 60 L, so osmolality rises from 280 to 290. About 1.4 L of water leaves the cells (ICF 40 → 38.6 L, ECF 20 → 21.4 L) and plasma Na⁺ rises to ~145. Both compartments end up hypertonic. (Rose’s version: 420 mOsm in a 70 kg man.)' },
  { label: 'Drink 3 L water', patch: { water: 3 }, explain: 'Water distributes in proportion to the compartments: two-thirds (2 L) ends up inside cells and one-third (1 L) outside, only ¼ L of it in the plasma. 16,800 mOsm in 63 L: osmolality ≈267, Na⁺ ≈133.' },
  { label: 'Infuse 3 L saline', patch: { saline: 3 }, explain: 'No change in osmolality, so no water crosses cell membranes: all 3 L stays extracellular, and at equilibrium only about ¼ (0.75 L) is still in the plasma. The IV fluids lab follows this over time and in illness.' },
  { label: 'Lose 3 L isotonic fluid', patch: { saline: -3 }, explain: 'Diarrhoea or bleeding: ECF shrinks, ICF and Na⁺ unchanged. Plasma Na⁺ says nothing about this volume loss.' },
  { label: 'Lose 300 mmol K⁺', patch: { kLoss: 300 }, explain: 'Edelman: Na⁺ ≈ (Na⁺e + K⁺e)/TBW. Losing 300 mmol of cell K⁺ (600 mOsm with its anion) takes osmolality from 280 to 270 and plasma Na⁺ to 135, although no Na⁺ was lost — water moves from cells to the ECF.' },
  { label: 'Glucose, no insulin', patch: { glucose: 1000 }, explain: 'Glucose is an effective extracellular osmole without insulin: water leaves cells, the ECF expands and its Na⁺ is diluted, although total osmolality is high (translocational hyponatraemia).' },
  { label: 'Urea 1000 mmol', patch: { urea: 1000 }, explain: 'Urea enters cells: 1000 mmol spread through 60 L raises measured osmolality ~17 mOsm/kg but tonicity, volumes and Na⁺ do not change.' },
  { label: 'Mannitol', patch: { mannitol: 600 }, explain: 'Mannitol stays extracellular: like glucose without insulin it pulls water from cells (the basis for its use in cerebral oedema) and lowers Na⁺; the osmolal gap rises.' },
];

const STARLING_CASES: { label: string; patch: Partial<StarlingInput>; explain: string }[] = [
  { label: 'Hypertension (MAP 160)', patch: { map: 160 }, explain: 'Precapillary autoregulation keeps arterial pressure off the capillary — no oedema. Switch autoregulation off to see what would otherwise happen.' },
  { label: 'Heart failure (venous 20)', patch: { venous: 20 }, explain: 'Venous pressure is transmitted back to the capillary. Lymph flow, falling interstitial oncotic pressure and rising interstitial pressure oppose it — until they are exhausted.' },
  { label: 'Chronic nephrosis (alb 20)', patch: { albumin: 20, chronic: true }, explain: 'Less albumin leaks, so interstitial oncotic pressure falls in parallel and the gradient is largely preserved (minimal change disease data). Oedema here is often primary renal Na⁺ retention (overflow).' },
  { label: 'Acute fall (alb 20)', patch: { albumin: 20, chronic: false }, explain: 'Dilution by saline after massive bleeding, or abrupt nephrosis: the interstitium has not adapted, the full fall in plasma oncotic pressure acts — underfill oedema.' },
  { label: 'Severe (alb 8)', patch: { albumin: 8, chronic: true }, explain: 'Below ~10 g/L the interstitial oncotic pressure cannot fall any further, so the gradient collapses even with chronic adaptation.' },
  { label: 'Leaky capillaries', patch: { permeability: 3 }, explain: 'Inflammation/sepsis: the reflection coefficient falls, protein leaks and the oncotic safety factor is lost.' },
  { label: 'Pulmonary venous 25', patch: { organ: 'lung', venous: 25 }, explain: 'Alveolar capillaries run at low pressure; raising left atrial pressure overwhelms lung lymph — pulmonary oedema.' },
];

export default function BodyWater() {
  const { mode } = useMode();
  const [tab, setTab] = useState<Tab>('compartments');
  const [c, setC] = useState<CompartmentInput>(COMPARTMENT_DEFAULT);
  const [s, setS] = useState<StarlingInput>(STARLING_DEFAULT);
  const upC = (p: Partial<CompartmentInput>) => setC({ ...c, ...p });
  const upS = (p: Partial<StarlingInput>) => setS({ ...s, ...p });
  const r = compartments(c);
  const st = starling(s);
  const gap = r.posm - (2 * r.na + r.glucoseConc + r.ureaConc);

  return (
    <div>
      <PageHead
        path="/body-water"
        lede="Water crosses cell membranes freely, so every compartment has the same osmolality — but each holds different solutes. Add salt, water, saline, glucose or urea, remove potassium, and watch the compartments and the plasma Na⁺ follow. Then move to the capillary, where proteins rather than salts are the effective osmoles."
      />
      <Tabs
        tabs={[
          { id: 'compartments', label: 'Cells vs extracellular fluid (osmosis)' },
          { id: 'starling', label: 'Plasma vs interstitium (Starling forces)' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'compartments' ? (
        <>
          <WhatIf options={ADDITIONS.map((a) => ({ label: a.label, explain: a.explain }))} onApply={(o) => setC({ ...COMPARTMENT_DEFAULT, ...ADDITIONS.find((a) => a.label === o.label)!.patch })} onReset={() => setC(COMPARTMENT_DEFAULT)} />
          <div class="grid grid-sidebar">
            <div>
              <Panel title="Person">
                <Slider label="Weight" value={c.weight} min={40} max={150} unit="kg" hint="starts at 100 kg: 60 L of water, 40 L in cells, 20 L outside (15 L interstitial, 5 L plasma)" onInput={(v) => upC({ weight: v })} />
                <Slider label="Water fraction" value={c.waterFraction} min={0.4} max={0.65} step={0.01} unit="" hint="≈0.6 men, 0.5 women, less with age and obesity" onInput={(v) => upC({ waterFraction: v })} />
                <Slider label="Starting plasma Na⁺" value={c.na0} min={115} max={165} unit="mmol/L" onInput={(v) => upC({ na0: v })} />
              </Panel>
              <Panel title="Add or remove">
                <Slider label="NaCl (as dry salt)" value={c.nacl} min={-400} max={600} step={10} unit="mmol" hint="each mmol = 2 mOsm, confined to the ECF" onInput={(v) => upC({ nacl: v })} />
                <Slider label="Pure water" value={c.water} min={-6} max={6} step={0.1} unit="L" onInput={(v) => upC({ water: v })} />
                <Slider label="Isotonic saline" value={c.saline} min={-6} max={6} step={0.1} unit="L" hint="negative = isotonic loss (diarrhoea, bleeding)" onInput={(v) => upC({ saline: v })} />
                <Slider label="K⁺ lost from cells" value={c.kLoss} min={0} max={800} step={10} unit="mmol" onInput={(v) => upC({ kLoss: v })} />
                <Slider label="Glucose" value={c.glucose} min={0} max={2500} step={25} unit="mmol" onInput={(v) => upC({ glucose: v })} />
                <Toggle label="Insulin present (glucose enters cells)" checked={c.insulin} onChange={(v) => upC({ insulin: v })} />
                <Slider label="Mannitol" value={c.mannitol} min={0} max={1500} step={25} unit="mmol" onInput={(v) => upC({ mannitol: v })} />
                <Slider label="Urea" value={c.urea} min={0} max={3000} step={50} unit="mmol" onInput={(v) => upC({ urea: v })} />
              </Panel>
            </div>
            <div>
              <Panel title="Compartments at the new equilibrium">
                <CompartmentBars icf0={r.icf0} ecf0={r.ecf0} icf={r.icf} ecf={r.ecf} osm={r.effOsm} />
                <div class="readout-grid">
                  <Readout label="Plasma Na⁺" value={r.na} digits={1} unit="mmol/L" refRange="135–145" tone={toneFor(r.na, 135, 145, [120, 160])} delta={r.na - c.na0} deltaDigits={1} />
                  <Readout label="Tonicity (effective)" value={r.effOsm} unit="mOsm/kg" delta={r.effOsm - 2 * c.na0} />
                  <Readout label="Measured osmolality" value={r.posm} unit="mOsm/kg" delta={r.posm - 2 * c.na0} />
                  <Readout label="ECF volume" value={r.ecf} digits={2} unit="L" delta={r.ecf - r.ecf0} deltaDigits={2} />
                  <Readout label="ICF volume" value={r.icf} digits={2} unit="L" delta={r.icf - r.icf0} deltaDigits={2} />
                  <Readout label="Plasma volume" value={r.plasma} digits={2} unit="L" delta={r.plasma - r.ecf0 * 0.25} deltaDigits={2} />
                  <Readout label={r.shift >= 0 ? 'Water out of cells' : 'Water into cells'} value={Math.abs(r.shift)} digits={2} unit="L" />
                  <Readout label="Glucose" value={r.glucoseConc} digits={1} unit="mmol/L" />
                  {mode === 'quantitative' && <Readout label="Urea added" value={r.ureaConc} digits={1} unit="mmol/L" />}
                  {mode === 'quantitative' && <Readout label="Osmolal gap (mannitol)" value={gap} unit="mOsm/kg" />}
                </div>
              </Panel>
              <Panel title="The arithmetic" note="Rose & Post’s three-step method: total osmoles ÷ total water gives the new osmolality; each compartment’s osmoles ÷ that osmolality gives its volume.">
                <ol class="muted" style={{ fontSize: '0.88rem', margin: 0 }}>
                  {r.steps.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                  <li>Plasma Na⁺ ≈ (effective osmolality − glucose − mannitol) ÷ 2 = {r.na.toFixed(1)} mmol/L</li>
                </ol>
              </Panel>
              <div class="grid grid-2">
                <Panel title="Sodium balance sets volume">
                  <Chain
                    steps={[
                      { text: 'Na⁺ salts are the ECF’s effective osmoles' },
                      { text: 'More Na⁺ retained → water follows (ADH, thirst)' },
                      { text: 'ECF volume ↑ — Na⁺ concentration unchanged', direction: 1 },
                      { text: 'Sensed as volume; corrected by Na⁺ excretion (RAAS, SNS, ANP)' },
                    ]}
                  />
                </Panel>
                <Panel title="Water balance sets concentration">
                  <Chain
                    steps={[
                      { text: 'Water gained relative to Na⁺ + K⁺' },
                      { text: 'Every compartment dilutes; cells swell' },
                      { text: 'Plasma Na⁺ ↓', direction: -1 },
                      { text: 'Sensed as tonicity; corrected by ADH suppression and water diuresis' },
                    ]}
                  />
                </Panel>
              </div>
            </div>
          </div>
          <div class="grid grid-2">
            <Predict
              question="A patient with diarrhoea loses 3 L of isotonic fluid and drinks nothing. Plasma Na⁺ will be:"
              options={['Low', 'High', 'Unchanged — but the ECF is 3 L smaller']}
              correct={2}
              explanation="Isotonic loss leaves osmolality and Na⁺ untouched. If the patient then drinks water while ADH is stimulated by hypovolaemia, hyponatraemia follows — the Na⁺ reports the water, not the salt."
            />
            <Predict
              question="Glucose rises by 50 mmol/L in a person without insulin. Plasma Na⁺ will:"
              options={['Rise', 'Fall by roughly 15–20 mmol/L', 'Stay the same']}
              correct={1}
              explanation="Water leaves cells into the ECF and dilutes Na⁺ (≈1.6 mmol/L per 5.5 mmol/L of glucose in the classical calculation; ≈2.4 empirically). The osmolality is high although the Na⁺ is low."
            />
          </div>
          <div class="grid grid-3">
            <EquationCard eq="posm" compact />
            <EquationCard eq="edelman" compact />
            <EquationCard eq="osmgap" compact />
          </div>
        </>
      ) : (
        <>
          <WhatIf options={STARLING_CASES.map((a) => ({ label: a.label, explain: a.explain }))} onApply={(o) => setS({ ...STARLING_DEFAULT, ...STARLING_CASES.find((a) => a.label === o.label)!.patch })} onReset={() => setS(STARLING_DEFAULT)} />
          <div class="grid grid-sidebar">
            <div>
              <Panel title="Capillary bed">
                <div class="btn-row" style={{ marginBottom: 8 }}>
                  {(['muscle', 'lung', 'liver'] as Organ[]).map((o) => (
                    <button key={o} class={s.organ === o ? 'active' : ''} onClick={() => upS({ organ: o })}>
                      {o === 'muscle' ? 'Skeletal muscle' : o === 'lung' ? 'Alveoli' : 'Liver sinusoid'}
                    </button>
                  ))}
                </div>
                <Slider label="Venous pressure" value={s.venous} min={0} max={35} unit="mmHg" onInput={(v) => upS({ venous: v })} />
                <Slider label="Mean arterial pressure" value={s.map} min={50} max={180} unit="mmHg" onInput={(v) => upS({ map: v })} />
                <Slider label="Plasma albumin" value={s.albumin} min={5} max={50} step={1} unit="g/L" onInput={(v) => upS({ albumin: v })} />
                <Slider label="Capillary protein permeability" value={s.permeability} min={1} max={5} step={0.1} unit="×" onInput={(v) => upS({ permeability: v })} />
                {s.organ === 'muscle' && <Slider label="Baseline interstitial oncotic pressure" value={s.interstitialOncotic} min={4} max={15} step={0.5} unit="mmHg" hint="8 in Table 7-2; 12–15 in human subcutaneous studies — a higher value gives more room to fall" onInput={(v) => upS({ interstitialOncotic: v })} />}
                <Toggle label="Hypoalbuminaemia is chronic (interstitium adapted)" checked={s.chronic} onChange={(v) => upS({ chronic: v })} />
              </Panel>
              <Panel title="Protective mechanisms">
                <Toggle label="Precapillary autoregulation" checked={s.autoregulation} onChange={(v) => upS({ autoregulation: v })} />
                <Toggle label="Lymph flow can rise" checked={s.lymph} onChange={(v) => upS({ lymph: v })} />
                <Toggle label="Interstitial oncotic pressure can fall" checked={s.oncoticBuffer} onChange={(v) => upS({ oncoticBuffer: v })} />
                <Toggle label="Interstitial hydraulic pressure can rise" checked={s.pressureBuffer} onChange={(v) => upS({ pressureBuffer: v })} />
              </Panel>
            </div>
            <div>
              <Panel title="Forces across the capillary wall" note="Net filtration pressure = (Pc − Pi) − σ(πp − πi). Values settle where filtration equals lymph return.">
                <div class="readout-grid">
                  <Readout label="Capillary pressure Pc" value={st.pc} digits={1} unit="mmHg" />
                  <Readout label="Interstitial pressure Pi" value={st.pi} digits={1} unit="mmHg" />
                  <Readout label="Plasma oncotic πp" value={st.pip} digits={1} unit="mmHg" />
                  <Readout label="Interstitial oncotic πi" value={st.pii} digits={1} unit="mmHg" />
                  <Readout label="Reflection coefficient σ" value={st.sigma} digits={2} />
                  <Readout label="Net filtration pressure" value={st.nfp} digits={1} unit="mmHg" />
                  <Readout label="Filtration / lymph" value={st.jv} digits={1} unit="× normal" tone={st.jv > 2.5 ? 'high' : 'normal'} />
                  <Readout label="Interstitial volume" value={st.volume >= 3.9 ? '> 3.9' : st.volume.toFixed(2)} unit="× normal" tone={st.oedema ? 'danger' : 'normal'} />
                </div>
                <p class={st.oedema ? 'callout danger' : 'callout'} style={{ marginTop: 10 }}>
                  {st.oedema
                    ? 'Oedema: the safety factors are exhausted and interstitial fluid accumulates.'
                    : st.volume > 1.03
                      ? 'Filtration is raised, but lymph flow and the interstitial forces are absorbing it — no clinical oedema yet.'
                      : 'Balanced: filtration slightly exceeds zero and is returned by lymph.'}
                </p>
              </Panel>
              <Panel title="How much each safety factor is contributing">
                <BarRow label="Extra lymph flow" value={st.safety.lymph * 100} max={200} unit="% above normal" color="var(--c-blue)" />
                <BarRow label="Fall in interstitial oncotic pressure" value={st.safety.oncotic} max={10} unit="mmHg" color="var(--c-violet)" />
                <BarRow label="Rise in interstitial hydraulic pressure" value={st.safety.pressure} max={10} unit="mmHg" color="var(--c-orange)" />
              </Panel>
              <div class="grid grid-2">
                <Panel title="Why hypertension does not cause oedema">
                  <Chain
                    steps={[
                      { text: 'Arterial pressure ↑', direction: 1 },
                      { text: 'Arterioles constrict (myogenic autoregulation)' },
                      { text: 'Capillary pressure barely changes' },
                      { text: 'Venous pressure, by contrast, is transmitted backwards in full' },
                    ]}
                  />
                </Panel>
                <Panel title="Nephrotic oedema: two mechanisms">
                  <Chain
                    steps={[
                      { text: 'Overflow: primary Na⁺ retention in the collecting tubule (unilateral nephrosis → unilateral retention)' },
                      { text: 'Underfill: acute or very severe hypoalbuminaemia → plasma volume ↓ → RAAS, SNS, ADH' },
                      { text: 'Both expand the interstitium; their balance varies between patients' },
                    ]}
                  />
                </Panel>
              </div>
            </div>
          </div>
          <div class="grid grid-2">
            <Predict
              question="In the liver sinusoid, what opposes filtration?"
              options={['A large oncotic gradient', 'Almost no oncotic gradient — sinusoids are protein-permeable, so lymph flow is the main defence', 'High interstitial pressure']}
              correct={1}
              explanation="Plasma and hepatic interstitial oncotic pressures are nearly equal. Low sinusoidal (portal) pressure and hepatic lymph keep the liver dry; portal hypertension overwhelms lymph and ascites forms."
            />
            <EquationCard eq="nfp" compact />
          </div>
        </>
      )}
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>All compartments share one osmolality (≈280–290). In round numbers for a 100 kg person: 60 L of water, ⅔ (40 L) in cells, ⅓ (20 L) outside them, and of that 15 L interstitial and 5 L plasma. Capillary filtration slightly exceeds reabsorption and lymph returns the rest.</p>}
          why={<p>The Na⁺-K⁺-ATPase keeps Na⁺ salts outside cells and K⁺ salts inside, making each an effective osmole for its compartment. At the capillary, only protein is effective.</p>}
          change={<p>Hypertonic solute confined to the ECF shrinks cells; water swells everything; isotonic saline expands only the ECF. Venous pressure and oncotic pressure shift fluid between plasma and interstitium.</p>}
          abnormal={<p>Water retention (ADH) → hyponatraemia; lack of access to water → hypernatraemia; hyperglycaemia → translocational hyponatraemia; exhausted safety factors → oedema.</p>}
          clinical={<p>Na⁺ concentration and volume are separate questions answered by different tests. Choose fluids by where they go. Toxic alcohols appear as an osmolal gap. Nephrotic oedema is often primary renal Na⁺ retention.</p>}
        />
        <Sources cite={{ rose: [7], evidence: 'physiology', refs: ['edelman1958', 'rose1986', 'siddall2012', 'levick2010'] }} />
      </Panel>
      <Related paths={['/sodium', '/adh', '/hyponatremia', '/edema', '/hyperglycemia', '/equations']} />
    </div>
  );
}
