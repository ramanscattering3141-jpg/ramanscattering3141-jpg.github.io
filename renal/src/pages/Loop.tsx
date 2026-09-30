import { si } from '../units';
import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related } from '../ui/page';
import { Panel, Readout, Slider, Chain, Sources, Predict, BarRow } from '../ui/kit';
import { CellDiagram } from '../ui/CellDiagram';
import { acute, makeParams, NORMAL } from '../sim/hooks';
import { useMode } from '../ui/mode';

interface S {
  nkcc2: number;
  romk: number;
  clckb: number;
  claudin16: number;
  casr: number;
  furosemide: number;
  adh: number;
}
const START: S = { nkcc2: 1, romk: 1, clckb: 1, claudin16: 1, casr: 1, furosemide: 0, adh: 0 };

export default function Loop() {
  const { mode } = useMode();
  const [s, setS] = useState<S>(START);
  const up = (p: Partial<S>) => setS({ ...s, ...p });
  const ev = useMemo(
    () =>
      acute(
        makeParams({
          adhAutonomous: s.adh,
          transporters: { NKCC2: s.nkcc2, ROMK: s.romk, ClCKb: s.clckb, claudin16: s.claudin16, CaSR: s.casr },
          drugs: { furosemide: s.furosemide },
        }),
      ),
    [s],
  );
  const n = NORMAL();
  const k = ev.kidney;
  const seg = k.segments;
  const talReab = (seg.TAL.in.Na - seg.TAL.out.Na) * 1440;
  const talReabN = (n.kidney.segments.TAL.in.Na - n.kidney.segments.TAL.out.Na) * 1440;
  const loopFrac = (seg.DTL.in.Na - seg.TAL.out.Na) / (seg.PT.in.Na || 1);
  const blocked = s.furosemide > 0.05 ? 'furosemide' : undefined;

  return (
    <div>
      <PageHead path="/loop" lede="The thick ascending limb pumps NaCl out of a water-tight tube. That one property makes it the diluting segment and the engine of the concentrating mechanism. Switch off its carriers one at a time and watch where the sodium, calcium, magnesium and potassium go." />
      <WhatIf
        options={[
          { label: 'Loop diuretic', explain: 'NKCC2 blocked: up to a quarter of filtered NaCl escapes; the lumen-positive voltage collapses (Ca²⁺ and Mg²⁺ wasting); the medullary gradient falls (neither concentration nor full dilution); distal Na⁺ delivery rises (K⁺ loss); macula densa senses less Cl⁻ so renin rises.' },
          { label: 'Bartter type 1 (NKCC2)', explain: 'A lifelong loop diuretic: salt wasting, hypercalciuria, hypokalaemic alkalosis.' },
          { label: 'Bartter type 2 (ROMK)', explain: 'Without K⁺ recycling, NKCC2 runs short of luminal K⁺ and the voltage falls. Neonates may be transiently hyperkalaemic because ROMK is also the collecting duct’s K⁺ secretory channel.' },
          { label: 'Bartter type 3 (ClC-Kb)', explain: 'Chloride cannot leave basolaterally, so NKCC2 stalls.' },
          { label: 'Claudin-16 defect', explain: 'NaCl transport intact, but the paracellular route for Ca²⁺ and Mg²⁺ is lost: hypomagnesaemia with hypercalciuria.' },
          { label: 'Hypercalcaemia (CaSR on)', explain: 'The calcium-sensing receptor inhibits ROMK: less NaCl reabsorption, less voltage, calciuria — and a concentrating defect.' },
          { label: 'High ADH', explain: 'In some species ADH boosts medullary NKCC2 via cAMP, deepening the gradient (evidence in humans is uncertain).' },
        ]}
        onApply={(o) => {
          const m: Record<string, Partial<S>> = {
            'Loop diuretic': { furosemide: 1 },
            'Bartter type 1 (NKCC2)': { nkcc2: 0.15 },
            'Bartter type 2 (ROMK)': { romk: 0.1 },
            'Bartter type 3 (ClC-Kb)': { clckb: 0.1 },
            'Claudin-16 defect': { claudin16: 0.1 },
            'Hypercalcaemia (CaSR on)': { casr: 2 },
            'High ADH': { adh: 8 },
          };
          setS({ ...START, ...m[o.label] });
        }}
        onReset={() => setS(START)}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Thick ascending limb machinery">
            <Slider label="NKCC2" value={s.nkcc2} min={0} max={1.5} step={0.05} unit="×" onInput={(v) => up({ nkcc2: v })} />
            <Slider label="ROMK (apical K⁺ recycling)" value={s.romk} min={0} max={1.5} step={0.05} unit="×" onInput={(v) => up({ romk: v })} />
            <Slider label="ClC-Kb / barttin (basolateral Cl⁻)" value={s.clckb} min={0} max={1.5} step={0.05} unit="×" onInput={(v) => up({ clckb: v })} />
            <Slider label="Claudin-16/19 (paracellular Ca²⁺/Mg²⁺)" value={s.claudin16} min={0} max={1.5} step={0.05} unit="×" onInput={(v) => up({ claudin16: v })} />
            <Slider label="Calcium-sensing receptor activation" value={s.casr} min={0.5} max={2.5} step={0.05} unit="×" onInput={(v) => up({ casr: v })} />
            <Slider label="Furosemide" value={s.furosemide} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}% block`} onInput={(v) => up({ furosemide: v })} />
            <Slider label="Plasma ADH (fixed)" value={s.adh} min={0} max={10} step={0.5} unit="pmol/L" format={(v) => si.adh(v).toFixed(1)} onInput={(v) => up({ adh: v })} hint="0 = let osmolality set it" />
          </Panel>
          <Panel title="Loop function">
            <div class="readout-grid">
              <Readout label="TAL Na⁺ reabsorbed" value={talReab} unit="mmol/day" delta={talReab - talReabN} />
              <Readout label="Loop share of filtered Na⁺" value={loopFrac * 100} unit="%" />
              <Readout label="Fluid leaving TAL" value={seg.TAL.osmOut} unit="mOsm/kg" tone={seg.TAL.osmOut > 200 ? 'high' : 'normal'} />
              <Readout label="Lumen-positive voltage" value={k.talVoltage * 100} unit="% normal" tone={k.talVoltage < 0.6 ? 'low' : 'normal'} />
              <Readout label="Papillary osmolality" value={k.medullaTarget} unit="mOsm/kg" delta={k.medullaTarget - n.kidney.medullaTarget} />
              <Readout label="Macula densa signal" value={k.maculaDensa} digits={2} unit="×" />
            </div>
          </Panel>
        </div>
        <div>
          <Panel title="Thick ascending limb cell" note="Arrow weight follows each transporter’s activity. The lumen-positive voltage drives the paracellular cations.">
            <CellDiagram
              lumenVoltage={`lumen +${(k.talVoltage * 7).toFixed(0)} mV`}
              apical={[
                { label: 'NKCC2', moves: '1 Na⁺ + 1 K⁺ + 2 Cl⁻', dir: 'in', activity: s.nkcc2 * (1 - 0.95 * s.furosemide), blocked: blocked, color: 'var(--c-teal)' },
                { label: 'ROMK', moves: 'K⁺ recycles to lumen', dir: 'out', activity: s.romk / Math.max(1, s.casr), color: 'var(--c-green)' },
                { label: 'NHE3', moves: 'Na⁺ in / H⁺ out (HCO₃⁻)', dir: 'in', activity: 1, color: 'var(--c-blue)' },
              ]}
              basolateral={[
                { label: 'NaK', moves: '3 Na⁺ out / 2 K⁺ in', dir: 'in', activity: 1, color: 'var(--c-amber)' },
                { label: 'ClC-Kb', moves: 'Cl⁻ exits', dir: 'in', activity: s.clckb, color: 'var(--c-orange)' },
                { label: 'CaSR', moves: 'senses Ca²⁺/Mg²⁺ → inhibits ROMK', dir: 'both', activity: Math.min(1, s.casr - 0.5), color: 'var(--c-violet)' },
              ]}
              paracellular={[
                { label: 'Na⁺', activity: k.talVoltage },
                { label: 'Ca²⁺', activity: k.talVoltage * s.claudin16 },
                { label: 'Mg²⁺', activity: k.talVoltage * s.claudin16 },
              ]}
              cellNote="water-impermeable: NaCl leaves, water stays"
            />
          </Panel>
          <div class="grid grid-2">
            <Panel title="Where it shows up in the urine">
              <BarRow label="Urine Na⁺" value={k.urine.exc.Na} max={Math.max(600, k.urine.exc.Na)} unit="mmol/d" sub={`normal ${n.kidney.urine.exc.Na.toFixed(0)}`} />
              <BarRow label="Urine K⁺" value={k.urine.exc.K} max={Math.max(250, k.urine.exc.K)} unit="mmol/d" color="var(--c-green)" sub={`normal ${n.kidney.urine.exc.K.toFixed(0)}`} />
              <BarRow label="Urine Ca²⁺" value={k.urine.exc.Ca} max={Math.max(12, k.urine.exc.Ca)} unit="mmol/d" color="var(--c-amber)" sub={`normal ${n.kidney.urine.exc.Ca.toFixed(1)}`} />
              <BarRow label="Urine Mg²⁺" value={k.urine.exc.Mg} max={Math.max(12, k.urine.exc.Mg)} unit="mmol/d" color="var(--c-violet)" sub={`normal ${n.kidney.urine.exc.Mg.toFixed(1)}`} />
              <BarRow label="Urine volume" value={k.urine.volumePerDay} max={Math.max(8, k.urine.volumePerDay)} unit="L/d" color="var(--c-blue)" sub={`osmolality ${k.urine.osm.toFixed(0)} mOsm/kg`} />
              {mode === 'quantitative' && <BarRow label="Distal Na⁺ delivery" value={k.distalNaDelivery * 1440} max={Math.max(2000, k.distalNaDelivery * 1440)} unit="mmol/d" color="var(--c-red)" />}
            </Panel>
            <Panel title="The cascade from the carrier">
              <Chain
                steps={[
                  { text: 'NKCC2 NaCl uptake', direction: s.nkcc2 * (1 - s.furosemide) < 0.9 ? -1 : 0 },
                  { text: 'K⁺ recycling → lumen-positive voltage', direction: k.talVoltage < 0.9 ? -1 : 0 },
                  { text: 'Paracellular Ca²⁺ and Mg²⁺ reabsorption', direction: k.talVoltage * s.claudin16 < 0.9 ? -1 : 0 },
                  { text: 'NaCl added to the medulla → concentrating gradient', direction: k.medullaTarget < n.kidney.medullaTarget - 30 ? -1 : 0 },
                  { text: 'Tubular fluid diluted → ability to excrete free water', direction: seg.TAL.osmOut > n.kidney.segments.TAL.osmOut + 20 ? -1 : 0 },
                  { text: 'NaCl delivered to the distal nephron', direction: k.distalNaDelivery > n.kidney.distalNaDelivery * 1.1 ? 1 : 0 },
                  { text: 'ENaC Na⁺ uptake → K⁺ and H⁺ secretion', direction: k.kSecretion > n.kidney.kSecretion * 1.1 ? 1 : 0 },
                  { text: 'Macula densa Cl⁻ uptake → renin', direction: k.maculaDensa < 0.9 ? 1 : 0, mechanism: 'reduced uptake is read as reduced delivery, so renin rises' },
                ]}
              />
            </Panel>
          </div>
        </div>
      </div>
      <div class="grid grid-2">
        <Predict
          question="Why does a loop diuretic cause hypercalciuria while a thiazide lowers urinary calcium?"
          options={['Different effects on PTH', 'The loop diuretic abolishes the lumen-positive voltage that drives paracellular Ca²⁺ in the TAL; thiazides act distally and increase distal and proximal Ca²⁺ reabsorption', 'Both cause hypercalciuria']}
          correct={1}
          explanation="Calcium in the thick limb follows the voltage NKCC2 creates. In the DCT, blocking NCC hyperpolarises the cell and speeds TRPV5 Ca²⁺ entry; mild volume contraction also increases proximal reabsorption."
          />
        <Predict
          question="The thick ascending limb normally uses ~half the oxygen consumed for NaCl transport. Why is its 2Cl⁻ : 1Na⁺ carrier an energy saver?"
          options={['It uses no ATP', 'For every two Cl⁻ taken up, only one Na⁺ is pumped; the other Na⁺ is reabsorbed passively through the tight junction by the voltage', 'It uses glucose']}
          correct={1}
          explanation="Paracellular Na⁺ reabsorption rides the voltage generated by K⁺ recycling, halving the ATP cost per Na⁺ — valuable in an outer medulla whose PO₂ may be 10–20 mmHg."
        />
      </div>
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>The loop reabsorbs 25–35% of filtered NaCl, almost all in the thick ascending limb, without water. Fluid leaves at ~100 mOsm/kg; the medulla is loaded with solute.</p>}
          why={<p>NKCC2 (Cl⁻-limited) brings NaCl in, Na⁺-K⁺-ATPase and ClC-Kb take it out; ROMK recycles K⁺, making the lumen positive; the membrane has no water channels.</p>}
          change={<p>Less NKCC2 activity: less NaCl reabsorbed, less voltage, less Ca²⁺/Mg²⁺ reabsorbed, less medullary gradient, less dilution, more distal delivery. Reabsorption is load-dependent down to a limiting luminal Cl⁻ of ~50–75 mmol/L.</p>}
          abnormal={<p>Loop diuretics, Bartter syndromes, claudin-16/19 mutations, activating CaSR variants, ischaemic injury in the hypoxic outer medulla.</p>}
          clinical={<p>Loop diuretics treat oedema and hypercalcaemia but cause hypokalaemia, alkalosis, hypomagnesaemia and a concentrating defect; hypercalcaemia itself causes polyuria via CaSR.</p>}
        />
        <Sources cite={{ rose: [4], evidence: 'physiology', refs: ['mount2014', 'hou2013', 'konrad2021'] }} />
      </Panel>
      <Related paths={['/countercurrent', '/diuretics', '/inherited', '/minerals', '/potassium']} />
    </div>
  );
}
