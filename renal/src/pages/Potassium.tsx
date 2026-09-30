import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related, Toggle, useTabParam } from '../ui/page';
import { Panel, Readout, Slider, Chain, Sources, Predict, LineChart, Tabs, toneFor, BarRow, type Series } from '../ui/kit';
import { EquationCard } from '../ui/EquationCard';
import { nephronRun } from '../sim/nephron';

type Tab = 'internal' | 'secretion' | 'independence';
const TAB_IDS = ['internal', 'secretion', 'independence'] as const;
const TABS: { id: Tab; label: string }[] = [
  { id: 'internal', label: 'Internal balance (minutes)' },
  { id: 'secretion', label: 'Distal secretion (hours)' },
  { id: 'independence', label: 'Why Na⁺ and K⁺ stay independent' },
];

// ---------------------------------------------------------------- 1. internal distribution

interface Internal {
  load: number;
  insulin: number;
  beta: number;
  pH: number;
  osmRise: number;
  mineralAcid: boolean;
}
const INT_START: Internal = { load: 40, insulin: 1, beta: 1, pH: 7.4, osmRise: 0, mineralAcid: true };

const INT_CASES: { label: string; patch: Partial<Internal>; explain: string }[] = [
  { label: 'Orange juice (40 mmol)', patch: {}, explain: 'Spread through 17 L of extracellular fluid, 40 mmol would raise the plasma K⁺ by 2.4 mmol/L. Insulin and basal β₂ tone park most of it in muscle and liver within minutes.' },
  { label: 'Same load on a β-blocker', patch: { beta: 0.2 }, explain: 'Cellular uptake is reduced, so the rise is larger and longer — and severe exercise on a β-blocker can raise K⁺ by 1.5 to 4 mmol/L.' },
  { label: 'Same load, insulin deficient', patch: { insulin: 0.2 }, explain: 'Insulin deficiency raises the baseline K⁺ by 0.4–0.5 mmol/L and exaggerates the response to a load — reversed by giving insulin.' },
  { label: 'Mineral acidosis (pH 7.20)', patch: { pH: 7.2, load: 0 }, explain: 'H⁺ enters cells to be buffered and K⁺ leaves to preserve electroneutrality: +0.2 to 1.7 mmol/L per 0.1 pH unit — a wide, unpredictable range.' },
  { label: 'Lactic acidosis (pH 7.20)', patch: { pH: 7.2, load: 0, mineralAcid: false }, explain: 'Organic acidoses raise K⁺ far less: the anion can follow H⁺ into the cell, so K⁺ does not have to move out.' },
  { label: 'Hyperglycaemia (+40 mOsm/kg)', patch: { osmRise: 40, load: 0, insulin: 0.2 }, explain: 'Water leaving cells concentrates cell K⁺ and drags it out: +0.4 to 0.8 mmol/L per 10 mOsm/kg. This is why K⁺ looks normal or high in ketoacidosis despite a large deficit.' },
  { label: 'Insulin + glucose treatment', patch: { insulin: 3, load: 0 }, explain: 'The therapeutic use of the same physiology: driving K⁺ into cells buys time in hyperkalaemia while the kidney or dialysis removes it.' },
];

function InternalTab() {
  const [s, setS] = useState<Internal>(INT_START);
  const up = (p: Partial<Internal>) => setS({ ...s, ...p });
  const ecf = 17;
  const base = 4.0;
  // Uptake capacity depends on the pump and its two permissive hormones.
  const uptakeFraction = Math.min(0.97, 0.55 + 0.22 * Math.log(Math.max(s.insulin, 0.05)) + 0.12 * Math.log(Math.max(s.beta, 0.05)) + 0.3);
  const fromLoad = (s.load / ecf) * (1 - Math.max(0.05, uptakeFraction));
  const perUnitPh = s.mineralAcid ? 0.7 : 0.15;
  const fromPh = ((7.4 - s.pH) / 0.1) * perUnitPh;
  const fromOsm = (s.osmRise / 10) * 0.6;
  const k = base + fromLoad + fromPh + fromOsm;
  const ifNoUptake = base + s.load / ecf + fromPh + fromOsm;

  return (
    <>
      <WhatIf options={INT_CASES.map((c) => ({ label: c.label, explain: c.explain }))} onApply={(o) => setS({ ...INT_START, ...INT_CASES.find((c) => c.label === o.label)!.patch })} onReset={() => setS(INT_START)} />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="The challenge">
            <Slider label="Potassium load absorbed" value={s.load} min={0} max={150} step={5} unit="mmol" onInput={(v) => up({ load: v })} hint="a K⁺-rich meal is 30–50 mmol" />
            <Slider label="Insulin effect" value={s.insulin} min={0} max={3} step={0.1} unit="× normal" onInput={(v) => up({ insulin: v })} normal={1} />
            <Slider label="β₂-adrenergic effect" value={s.beta} min={0} max={3} step={0.1} unit="× normal" onInput={(v) => up({ beta: v })} normal={1} />
          </Panel>
          <Panel title="Things that move K⁺ out of cells">
            <Slider label="Arterial pH" value={s.pH} min={6.9} max={7.6} step={0.01} onInput={(v) => up({ pH: v })} normal={7.4} />
            <Toggle label="Mineral acid (HCl-type) rather than organic" checked={s.mineralAcid} onChange={(v) => up({ mineralAcid: v })} />
            <Slider label="Rise in effective osmolality" value={s.osmRise} min={0} max={80} step={5} unit="mOsm/kg" onInput={(v) => up({ osmRise: v })} />
          </Panel>
        </div>
        <div>
          <Panel title="Plasma potassium">
            <div class="readout-grid">
              <Readout label="Plasma K⁺" value={k} digits={2} unit="mmol/L" tone={toneFor(k, 3.5, 5.0, [2.5, 6.5])} />
              <Readout label="If none entered cells" value={ifNoUptake} digits={2} unit="mmol/L" tone="danger" />
              <Readout label="Taken into cells" value={s.load * Math.max(0.05, uptakeFraction)} digits={0} unit="mmol" />
              <Readout label="From the acid–base shift" value={fromPh} digits={2} unit="mmol/L" />
              <Readout label="From hyperosmolality" value={fromOsm} digits={2} unit="mmol/L" />
            </div>
            <p class={k > 6 ? 'callout danger' : 'callout'} style={{ marginTop: 8 }}>
              {k > 6
                ? 'At this level the resting membrane potential is significantly depolarised: cardiac conduction is at risk.'
                : `Internal balance has absorbed most of the challenge. Cell uptake is temporary — the kidney still has to remove the load.`}
            </p>
          </Panel>
          <Panel title="Where the load goes, minute by minute">
            <BarRow label="Into cells (insulin, β₂, Na⁺-K⁺-ATPase)" value={s.load * Math.max(0.05, uptakeFraction)} max={Math.max(10, s.load)} unit=" mmol" color="#5ecfba" />
            <BarRow label="Left in the extracellular fluid" value={s.load * (1 - Math.max(0.05, uptakeFraction))} max={Math.max(10, s.load)} unit=" mmol" color="#f2b134" />
            <p class="control-hint">98% of body K⁺ is already intracellular; moving just 1.5–2% of it outwards would take the plasma level to 8 mmol/L. That asymmetry is why internal balance has to act first.</p>
          </Panel>
          <div class="grid grid-2">
            <Panel title="Permissive, not regulatory">
              <ul class="muted" style={{ fontSize: '0.88rem', marginTop: 0 }}>
                <li>A K⁺ load does not itself raise catecholamines, and raises insulin only slightly — these hormones allow uptake rather than being triggered by it.</li>
                <li>Their deficiency raises the baseline K⁺ only transiently, because the kidney then excretes the excess: fasting K⁺ is usually normal on a β-blocker or in type 1 diabetes.</li>
                <li>Digitalis overdose inhibits the pump itself and can take the plasma K⁺ to 13.5 mmol/L.</li>
              </ul>
            </Panel>
            <Panel title="Spurious hyperkalaemia">
              <ul class="muted" style={{ fontSize: '0.88rem', marginTop: 0 }}>
                <li>Clenching the fist during venepuncture: up to +1–2 mmol/L.</li>
                <li>Exercise before sampling: +0.3 (walking) to +2.0 mmol/L (exhaustion), reversing within minutes.</li>
                <li>Haemolysis, marked leucocytosis or thrombocytosis in the tube.</li>
                <li>Always ask whether the sample, not the patient, is hyperkalaemic.</li>
              </ul>
            </Panel>
          </div>
        </div>
      </div>
      <Predict
        question="A patient in diabetic ketoacidosis has a plasma K⁺ of 5.2. What is total body potassium?"
        options={['High', 'Normal', 'Usually substantially depleted — insulin deficiency, hyperosmolality and acidosis have shifted it out while osmotic diuresis lost it', 'Cannot be estimated']}
        correct={2}
        explanation="Treating with insulin and fluid moves K⁺ back into cells and unmasks the deficit — which is why potassium replacement starts early, often before the K⁺ has fallen."
      />
    </>
  );
}

// ---------------------------------------------------------------- 2. distal secretion

interface Sec {
  aldo: number;
  flow: number;
  plasmaK: number;
  enac: number;
  romk: number;
  nonReabsorbableAnion: boolean;
}
const SEC_START: Sec = { aldo: 1, flow: 1, plasmaK: 4.2, enac: 1, romk: 1, nonReabsorbableAnion: false };

const SEC_CASES: { label: string; patch: Partial<Sec>; explain: string }[] = [
  { label: 'High K⁺ diet', patch: { plasmaK: 5.0, aldo: 2.5 }, explain: 'Plasma K⁺ and aldosterone rise together and reinforce each other: excretion climbs steeply above a plasma K⁺ of about 4.2 mmol/L.' },
  { label: 'Primary aldosteronism', patch: { aldo: 4, plasmaK: 3.4 }, explain: 'Autonomous aldosterone drives secretion until the plasma K⁺ falls — the steady state is a lower K⁺, about 3.4 mmol/L in the dog experiments.' },
  { label: 'Hypoaldosteronism', patch: { aldo: 0.15, plasmaK: 5.4 }, explain: 'Without aldosterone, secretion needs a higher plasma K⁺ to proceed: the steady state settles near 5.0–5.5 — type 4 RTA.' },
  { label: 'Amiloride', patch: { enac: 0.1 }, explain: 'Closing ENaC removes the lumen-negative voltage, so K⁺ secretion falls even with aldosterone present — the drug has no direct action on potassium at all.' },
  { label: 'Loop diuretic', patch: { flow: 3, aldo: 2.5 }, explain: 'High distal flow combined with the volume depletion that raises aldosterone: the pairing that normally keeps K⁺ constant is broken, and K⁺ wasting follows.' },
  { label: 'Non-reabsorbable anion', patch: { nonReabsorbableAnion: true, aldo: 2.5 }, explain: 'Bicarbonate in type 2 RTA or vomiting, ketoacid anions in DKA, carbenicillin: less chloride to dissipate the voltage, so K⁺ secretion rises.' },
  { label: 'Bartter/Gitelman', patch: { flow: 2.5, aldo: 3 }, explain: 'A genetic loop or thiazide-like defect: permanently high delivery with secondary hyperaldosteronism, hence lifelong hypokalaemia.' },
];

function SecretionTab() {
  const [s, setS] = useState<Sec>(SEC_START);
  const up = (p: Partial<Sec>) => setS({ ...s, ...p });

  const run = (x: Sec) =>
    nephronRun({
      plasma: { K: x.plasmaK, Cl: x.nonReabsorbableAnion ? 88 : 104 },
      hormones: { aldo: x.aldo, mr: x.aldo },
      GFR: 130 * Math.min(1.6, Math.max(0.5, 0.6 + 0.4 * x.flow)),
      patch: { transporters: { ENaC: x.enac, ROMK: x.romk }, drugs: { furosemide: x.flow > 1.8 ? 0.55 : 0 } },
    });
  const r = useMemo(() => run(s), [s]);
  const excreted = r.urineOut.K * 1440;
  const flowMl = r.distalFlow;

  const curve = useMemo(() => {
    const withAldo: Series['points'] = [];
    const lowAldo: Series['points'] = [];
    for (let k = 2.5; k <= 7; k += 0.25) {
      withAldo.push({ x: k, y: run({ ...s, plasmaK: k, aldo: Math.max(s.aldo, 0.5 + 0.9 * (k - 3.5)) }).urineOut.K * 1440 });
      lowAldo.push({ x: k, y: run({ ...s, plasmaK: k, aldo: 0.15 }).urineOut.K * 1440 });
    }
    return { withAldo, lowAldo };
  }, [s.flow, s.enac, s.romk, s.nonReabsorbableAnion, s.aldo]);

  return (
    <>
      <WhatIf options={SEC_CASES.map((c) => ({ label: c.label, explain: c.explain }))} onApply={(o) => setS({ ...SEC_START, ...SEC_CASES.find((c) => c.label === o.label)!.patch })} onReset={() => setS(SEC_START)} />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="The two regulators">
            <Slider label="Aldosterone" value={s.aldo} min={0} max={5} step={0.1} unit="× normal" onInput={(v) => up({ aldo: v })} normal={1} />
            <Slider label="Plasma K⁺" value={s.plasmaK} min={2.5} max={7} step={0.1} unit="mmol/L" onInput={(v) => up({ plasmaK: v })} normal={4.2} />
          </Panel>
          <Panel title="The permissive factors">
            <Slider label="Distal flow" value={s.flow} min={0.3} max={4} step={0.1} unit="× normal" onInput={(v) => up({ flow: v })} normal={1} />
            <Slider label="ENaC (sets the voltage)" value={s.enac} min={0} max={1.5} step={0.05} unit="×" onInput={(v) => up({ enac: v })} />
            <Slider label="ROMK/BK channels" value={s.romk} min={0} max={1.5} step={0.05} unit="×" onInput={(v) => up({ romk: v })} />
            <Toggle label="Na⁺ delivered with a non-reabsorbable anion" checked={s.nonReabsorbableAnion} onChange={(v) => up({ nonReabsorbableAnion: v })} />
          </Panel>
          <Panel title="Result">
            <div class="readout-grid">
              <Readout label="K⁺ excreted" value={excreted} unit="mmol/day" tone={excreted < 20 ? 'low' : excreted > 120 ? 'high' : 'normal'} />
              <Readout label="Distal secretion" value={r.kSecretion * 1440} unit="mmol/day" />
              <Readout label="Lumen-negative voltage" value={r.distalVoltage} digits={2} unit="index" />
              <Readout label="Distal flow" value={flowMl * 1.44} digits={1} unit="L/day" />
              <Readout label="Na⁺ to the secretory site" value={r.distalNaDelivery * 1440} unit="mmol/day" />
            </div>
          </Panel>
        </div>
        <div>
          <Panel title="The principal cell" note="K⁺ enters basolaterally on the pump and leaves passively through luminal channels — so only the gradient, the voltage and the number of open channels matter.">
            <PrincipalCell aldo={s.aldo} enac={s.enac} romk={s.romk} voltage={r.distalVoltage} secretion={r.kSecretion * 1440} anion={s.nonReabsorbableAnion} />
          </Panel>
          <Panel title="Excretion against plasma K⁺" note="With aldosterone free to rise, excretion climbs steeply above ~4.2 mmol/L. With aldosterone fixed low, a much higher plasma K⁺ is needed for the same excretion — the steady state of hypoaldosteronism.">
            <LineChart
              xLabel="plasma K⁺ (mmol/L)"
              series={[
                { label: 'Aldosterone free to rise', points: curve.withAldo, color: '#5ecfba' },
                { label: 'Aldosterone fixed low', points: curve.lowAldo, color: '#e07b6a', dashed: true },
              ]}
              yMin={0}
              marker={s.plasmaK}
              height={230}
            />
          </Panel>
          <Panel title="Why flow matters">
            <Chain
              steps={[
                { text: 'Secreted K⁺ raises the luminal K⁺ concentration' },
                { text: 'That shrinks the gradient and slows further secretion', direction: -1 },
                { text: 'Flow washes it away and replaces it with K⁺-poor fluid' },
                { text: 'Luminal K⁺ stays nearly constant across the physiological range of flow', direction: 0 },
                { text: 'So more flow means more K⁺ secreted at the same concentration', direction: 1 },
              ]}
            />
          </Panel>
        </div>
      </div>
      <Predict
        question="Amiloride reduces K⁺ secretion even when aldosterone is high. Why?"
        options={['It blocks K⁺ channels', 'It closes ENaC, removing the lumen-negative voltage that drives K⁺ out of the cell', 'It inhibits the Na⁺-K⁺-ATPase', 'It reduces distal flow']}
        correct={1}
        explanation="Amiloride has no direct action on potassium. The demonstration that removing luminal Na⁺ entry abolishes the voltage — and with it K⁺ secretion — is what established sodium transport as the driver."
      />
    </>
  );
}

/** A principal cell drawn with the three determinants of K+ secretion. */
function PrincipalCell({ aldo, enac, romk, voltage, secretion, anion }: { aldo: number; enac: number; romk: number; voltage: number; secretion: number; anion: boolean }) {
  const op = (x: number) => 0.25 + 0.75 * Math.min(1, x);
  return (
    <svg viewBox="0 0 600 210" class="diagram" role="img" aria-label="Principal cell: ENaC, Na-K-ATPase and luminal K channels">
      <text x={62} y={20} text-anchor="middle" class="svg-small">LUMEN</text>
      <text x={300} y={20} text-anchor="middle" class="svg-small">PRINCIPAL CELL</text>
      <text x={540} y={20} text-anchor="middle" class="svg-small">BLOOD</text>
      <rect x={140} y={30} width={320} height={150} rx={12} fill="#16303f" stroke="#2f7f73" />
      {/* ENaC */}
      <circle cx={140} cy={70} r={21} fill="#f2b134" opacity={op(enac * aldo)} />
      <text x={140} y={74} text-anchor="middle" class="svg-label" style={{ fill: '#0b1b27', fontWeight: 700 }}>ENaC</text>
      <text x={62} y={74} text-anchor="middle" class="svg-small">Na⁺ in</text>
      {/* K channels */}
      <circle cx={140} cy={140} r={21} fill="#5ecfba" opacity={op(romk * aldo)} />
      <text x={140} y={144} text-anchor="middle" class="svg-label" style={{ fill: '#0b1b27', fontWeight: 700 }}>ROMK</text>
      <text x={62} y={144} text-anchor="middle" class="svg-small">K⁺ out</text>
      {/* pump */}
      <circle cx={460} cy={105} r={23} fill="#b08ee0" opacity={op(aldo)} />
      <text x={460} y={102} text-anchor="middle" class="svg-label" style={{ fill: '#0b1b27', fontWeight: 700 }}>Na⁺-K⁺</text>
      <text x={460} y={114} text-anchor="middle" class="svg-label" style={{ fill: '#0b1b27', fontWeight: 700 }}>ATPase</text>
      <text x={540} y={100} text-anchor="middle" class="svg-small">3 Na⁺ out</text>
      <text x={540} y={116} text-anchor="middle" class="svg-small">2 K⁺ in</text>
      <line x1={162} x2={436} y1={70} y2={95} stroke="#f2b134" stroke-width={Math.max(1.5, 7 * Math.min(1.4, enac * aldo))} opacity={0.75} />
      <line x1={436} x2={162} y1={118} y2={140} stroke="#5ecfba" stroke-width={Math.max(1.5, 7 * Math.min(1.4, romk * aldo))} opacity={0.75} />
      <text x={300} y={168} text-anchor="middle" class="svg-small">
        lumen {(-15 - 35 * Math.min(1.2, voltage)).toFixed(0)} mV · secreting {secretion.toFixed(0)} mmol/day{anion ? ' · non-reabsorbable anion raises the voltage' : ''}
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------- 3. independence

function IndependenceTab() {
  const rows = [
    { state: 'Na⁺ depletion', aldo: '↑', flow: '↓', na: '↓↓', k: 'unchanged', why: 'High aldosterone would waste K⁺, but low distal flow offsets it — why untreated heart failure and cirrhosis are normokalaemic.' },
    { state: 'Na⁺ load', aldo: '↓', flow: '↑', na: '↑↑', k: 'unchanged', why: 'Low aldosterone would retain K⁺, but high flow offsets it.' },
    { state: 'K⁺ load', aldo: '↑', flow: '↑ (loop transport falls)', na: 'unchanged', k: '↑↑', why: 'Both determinants move the same way, so K⁺ excretion rises without disturbing Na⁺ balance.' },
    { state: 'K⁺ depletion', aldo: '↓', flow: '↓', na: 'unchanged', k: '↓↓', why: 'Again both move together — and the H⁺-K⁺-ATPase begins actively reabsorbing K⁺.' },
    { state: 'Loop diuretic', aldo: '↑', flow: '↑↑', na: '↑', k: '↑↑', why: 'The pairing is broken: high flow and high aldosterone together. This is the main mechanism of diuretic-induced hypokalaemia.' },
    { state: 'Aldosteronism + salt load', aldo: 'fixed ↑', flow: '↑', na: '↑', k: '↑↑', why: 'Aldosterone cannot fall, so the salt load adds flow to an already maximal stimulus — the basis of salt-loading tests.' },
  ];
  return (
    <>
      <div class="grid grid-2">
        <Panel title="Table 6-3, as a mechanism" note="Sodium and potassium excretion are regulated by the same hormone, yet move independently — because aldosterone and distal flow usually change in opposite directions.">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>State</th>
                  <th>Aldosterone</th>
                  <th>Distal flow</th>
                  <th>Na⁺ excretion</th>
                  <th>K⁺ excretion</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.state}>
                    <th scope="row">{r.state}</th>
                    <td>{r.aldo}</td>
                    <td>{r.flow}</td>
                    <td>{r.na}</td>
                    <td class={r.k.includes('↑') ? 'mono' : ''}>{r.k}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Read it row by row">
          <ul class="muted" style={{ fontSize: '0.88rem', marginTop: 0 }}>
            {rows.map((r) => (
              <li key={r.state} style={{ marginBottom: 6 }}>
                <strong>{r.state}:</strong> {r.why}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <div class="grid grid-2">
        <Panel title="The modern mechanism">
          <p class="muted" style={{ fontSize: '0.88rem', marginTop: 0 }}>
            The book describes the pairing without knowing how the nephron implements it. WNK kinases in the distal convoluted tubule are now known to sense the plasma K⁺: a low K⁺ activates NCC, retaining Na⁺ and reducing delivery to the secretory site, while a high K⁺ inhibits NCC and raises delivery. That gives a molecular answer to the “aldosterone paradox” — how one hormone can serve sodium retention in one state and potassium excretion in another.
          </p>
        </Panel>
        <Panel title="Potassium adaptation">
          <Chain
            steps={[
              { text: 'Intake rises gradually (up to 500 mmol/day is tolerated)' },
              { text: 'Plasma K⁺ and aldosterone rise for the first days', direction: 1 },
              { text: 'Distal Na⁺-K⁺-ATPase activity and basolateral membrane area increase' },
              { text: 'Secretion at any given plasma K⁺ becomes 2–4× greater', direction: 1 },
              { text: 'Plasma K⁺ and aldosterone fall back toward normal while excretion stays high', direction: 0 },
            ]}
          />
          <p class="control-hint">The same adaptation keeps people with advanced kidney disease in balance — helped by colonic secretion, which can account for 30–50% of dietary K⁺ in end-stage disease.</p>
        </Panel>
      </div>
      <Predict
        question="A patient with cirrhosis and high aldosterone is normokalaemic. You start furosemide. What happens to the plasma K⁺?"
        options={['Unchanged', 'It falls — distal flow now rises while aldosterone stays high, so the two stimuli add', 'It rises', 'Depends on the sodium intake']}
        correct={1}
        explanation="The normokalaemia depended on low distal flow offsetting the high aldosterone. Removing that offset is the principal mechanism of diuretic-induced potassium wasting."
      />
    </>
  );
}

// ----------------------------------------------------------------

export default function Potassium({ query }: { query: URLSearchParams }) {
  const [tab, setTab] = useTabParam('/potassium', TAB_IDS, 'internal', query);

  return (
    <div>
      <PageHead
        path="/potassium"
        lede="Ninety-eight per cent of body potassium is inside cells, so the plasma level reports a very small compartment — moving 2% of cell K⁺ outwards would be fatal. Two systems defend it: cells absorb a load within minutes, and the distal nephron removes it over hours."
      />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'internal' && <InternalTab />}
      {tab === 'secretion' && <SecretionTab />}
      {tab === 'independence' && <IndependenceTab />}
      <div class="grid grid-2" style={{ marginTop: 18 }}>
        <EquationCard eq="ukcr" compact />
        <EquationCard eq="ttkg" compact />
      </div>
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>Intake of 40–120 mmol/day is matched by urinary excretion, with 5–10 mmol in stool. Less than 10% of filtered K⁺ reaches the distal tubule; what is excreted is what principal cells secrete.</p>}
          why={<p>The Na⁺-K⁺-ATPase loads the cell; K⁺ then leaves passively through luminal channels, driven by the lumen-negative voltage that ENaC-mediated Na⁺ entry creates. Aldosterone and the plasma K⁺ set the rate; flow and voltage permit it.</p>}
          change={<p>Raise aldosterone or plasma K⁺ and secretion rises. Raise distal flow and more is secreted at the same luminal concentration. Close ENaC and secretion stops regardless of aldosterone.</p>}
          abnormal={<p>Chronic hyperkalaemia means a secretory defect — hypoaldosteronism or poor distal delivery. Renal K⁺ wasting means the secretory process has been activated — mineralocorticoid excess, high flow, or a non-reabsorbable anion.</p>}
          clinical={<p>Use urinary K⁺ (or the K⁺/creatinine ratio) to separate renal from extrarenal loss. Insulin and β₂-agonists shift K⁺ into cells acutely; β-blockers, hyperosmolality and mineral acidosis shift it out.</p>}
        />
        <Sources cite={{ rose: [12], evidence: 'physiology', refs: ['palmer2015k', 'gumz2015', 'terker2015', 'mcdonough2017', 'kamel2011ttkg'] }} />
      </Panel>
      <Related paths={['/hypokalemia', '/hyperkalemia', '/distal', '/raas', '/diuretics', '/acid-base']} />
    </div>
  );
}
