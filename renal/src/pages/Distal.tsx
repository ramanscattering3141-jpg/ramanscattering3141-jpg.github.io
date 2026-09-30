import type { JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related, Toggle } from '../ui/page';
import { Panel, Readout, Slider, Chain, Sources, Predict, Tabs } from '../ui/kit';
import { CellDiagram } from '../ui/CellDiagram';
import { acute, makeParams, NORMAL } from '../sim/hooks';
import { initialBody } from '../engine/body';

type Cell = 'dct' | 'principal' | 'icA' | 'icB';

interface S {
  aldo: number; // fixed aldosterone floor (× normal); 0 = physiological
  ncc: number;
  enac: number;
  thiazide: boolean;
  amiloride: boolean;
  spiro: boolean;
  furosemide: boolean;
  hco3: number; // plasma HCO3 shift, mmol/L
  pth: number;
  kLoad: number; // extra exchangeable K, mmol
  aldoAbsent: boolean;
}
const START: S = { aldo: 0, ncc: 1, enac: 1, thiazide: false, amiloride: false, spiro: false, furosemide: false, hco3: 24, pth: 1, kLoad: 0, aldoAbsent: false };

export default function Distal() {
  const [cell, setCell] = useState<Cell>('principal');
  const [s, setS] = useState<S>(START);
  const up = (p: Partial<S>) => setS({ ...s, ...p });
  const ev = useMemo(() => {
    const p = makeParams({
      aldoAutonomous: s.aldo,
      aldoSynthesis: s.aldoAbsent ? 0.03 : 1,
      pthMode: s.pth > 2 ? 'high' : s.pth < 0.5 ? 'low' : 'auto',
      transporters: { NCC: s.ncc, ENaC: s.enac },
      drugs: { thiazide: s.thiazide ? 1 : 0, amiloride: s.amiloride ? 1 : 0, spironolactone: s.spiro ? 1 : 0, furosemide: s.furosemide ? 1 : 0 },
    });
    const body = { ...initialBody(p), hco3: s.hco3, kE: initialBody(p).kE + s.kLoad };
    return acute(p, s.hco3 === 24 && s.kLoad === 0 ? undefined : body);
  }, [s]);
  const n = NORMAL();
  const k = ev.kidney;
  const h = ev.reg.hormones;
  const rel = (a: number, b: number) => (b > 1e-9 ? a / b : 0);

  const cells: Record<Cell, JSX.Element> = {
    dct: (
      <CellDiagram
        title="Distal convoluted tubule cell"
        apical={[
          { label: 'NCC', moves: 'Na⁺ + Cl⁻', dir: 'in', activity: s.ncc * (s.thiazide ? 0.08 : 1), blocked: s.thiazide ? 'thiazide' : undefined },
          { label: 'TRPV5', moves: 'Ca²⁺ (PTH, calcitriol ↑)', dir: 'in', activity: Math.min(1.5, Math.pow(h.pth, 0.35)) * (s.thiazide ? 1.4 : 1), color: 'var(--c-amber)' },
          { label: 'TRPM6', moves: 'Mg²⁺', dir: 'in', activity: s.thiazide ? 0.7 : 1, color: 'var(--c-violet)' },
        ]}
        basolateral={[
          { label: 'NaK', moves: '3 Na⁺ out / 2 K⁺ in', dir: 'in', activity: s.ncc * (s.thiazide ? 0.5 : 1), color: 'var(--c-amber)' },
          { label: 'NCX1', moves: '3 Na⁺ in / 1 Ca²⁺ out', dir: 'in', activity: s.thiazide ? 1.4 : 1, color: 'var(--c-orange)' },
          { label: 'ClC-Kb', moves: 'Cl⁻ exits', dir: 'in', activity: s.ncc * (s.thiazide ? 0.1 : 1), color: 'var(--c-green)' },
        ]}
        cellNote="water-impermeable even with ADH: keeps diluting"
      />
    ),
    principal: (
      <CellDiagram
        title="Principal cell"
        lumenVoltage={`lumen −${(k.distalVoltage * 12).toFixed(0)} mV`}
        apical={[
          { label: 'ENaC', moves: 'Na⁺ alone (electrogenic)', dir: 'in', activity: s.enac * (s.amiloride ? 0.2 : 1) * Math.min(1.5, Math.pow(h.mr, 0.45)), blocked: s.amiloride ? 'amiloride' : undefined },
          { label: 'ROMK', moves: 'K⁺ secreted', dir: 'out', activity: Math.min(1.5, rel(k.kSecretion, n.kidney.kSecretion)), color: 'var(--c-green)' },
          { label: 'BK', moves: 'flow-activated K⁺', dir: 'out', activity: Math.min(1.5, rel(k.distalFlow, n.kidney.distalFlow)), color: 'var(--c-green2)' },
          { label: 'AQP2', moves: 'H₂O (ADH)', dir: 'in', activity: h.aqp2, color: 'var(--c-blue)' },
        ]}
        basolateral={[
          { label: 'NaK', moves: '3 Na⁺ out / 2 K⁺ in', dir: 'in', activity: Math.min(1.5, Math.pow(h.mr, 0.3)), color: 'var(--c-amber)' },
          { label: 'MR', moves: s.spiro ? 'aldosterone receptor (blocked)' : 'aldosterone receptor', dir: 'both', activity: Math.min(1.5, h.mr), color: 'var(--c-violet)', blocked: s.spiro ? 'spironolactone' : undefined },
          { label: 'AQP3/4', moves: 'H₂O exits', dir: 'in', activity: 1, color: 'var(--c-blue)' },
        ]}
        paracellular={[{ label: 'Cl⁻', activity: Math.min(1, k.distalVoltage) }]}
      />
    ),
    icA: (
      <CellDiagram
        title="Type A intercalated cell"
        apical={[
          { label: 'H-ATP', moves: 'H⁺ secreted', dir: 'out', activity: Math.min(1.5, rel(k.hSecretionDistal, n.kidney.hSecretionDistal)), color: 'var(--c-red)' },
          { label: 'HKATP', moves: 'H⁺ out / K⁺ in', dir: 'both', activity: ev.plasma.K < 3.8 ? 1.3 : 0.7, color: 'var(--c-green)' },
        ]}
        basolateral={[
          { label: 'AE1', moves: 'HCO₃⁻ out / Cl⁻ in', dir: 'in', activity: Math.min(1.5, rel(k.hSecretionDistal, n.kidney.hSecretionDistal)), color: 'var(--c-violet)' },
          { label: 'CA II', moves: 'CO₂ + H₂O → H⁺ + HCO₃⁻', dir: 'both', activity: 1, color: 'var(--c-blue)' },
        ]}
        cellNote="acidaemia, aldosterone and a negative lumen increase H⁺ secretion"
      />
    ),
    icB: (
      <CellDiagram
        title="Type B intercalated cell"
        apical={[{ label: 'Pendrin', moves: 'HCO₃⁻ out / Cl⁻ in', dir: 'out', activity: Math.min(1.5, k.pendrinSecretion / 0.05), color: 'var(--c-violet)' }]}
        basolateral={[
          { label: 'H-ATP', moves: 'H⁺ returned to blood', dir: 'out', activity: Math.min(1.5, k.pendrinSecretion / 0.05), color: 'var(--c-red)' },
          { label: 'CA II', moves: 'CO₂ + H₂O → H⁺ + HCO₃⁻', dir: 'both', activity: 1, color: 'var(--c-blue)' },
        ]}
        cellNote="active in alkalosis — but needs luminal Cl⁻"
      />
    ),
  };

  return (
    <div>
      <PageHead path="/distal" lede="Everything the final urine becomes is decided here. Pick a cell, then change aldosterone, the channels, the diuretics or the acid–base state, and watch sodium, potassium, hydrogen, calcium and water respond." />
      <WhatIf
        options={[
          { label: 'Primary aldosteronism', explain: 'More open ENaC channels → more negative lumen → K⁺ and H⁺ secretion: hypokalaemic metabolic alkalosis, with sodium retention limited by escape.' },
          { label: 'Aldosterone absent', explain: 'Fewer ENaC channels: Na⁺ wasting, K⁺ and H⁺ retention — hyperkalaemic acidosis (type 4 RTA pattern).' },
          { label: 'Thiazide', explain: 'NCC blocked: modest natriuresis, more Na⁺ reaching ENaC (K⁺ loss), and more Ca²⁺ reabsorption.' },
          { label: 'Amiloride', explain: 'ENaC blocked: small natriuresis, lumen voltage collapses — K⁺ and H⁺ secretion fall.' },
          { label: 'Spironolactone', explain: 'MR blocked: aldosterone cannot open channels; K⁺ rises.' },
          { label: 'Metabolic alkalosis', explain: 'Type B cells secrete HCO₃⁻ through pendrin — if luminal Cl⁻ is available.' },
          { label: 'Metabolic acidosis', explain: 'Type A cells step up H⁺ secretion and ammonium trapping.' },
        ]}
        onApply={(o) => {
          const m: Record<string, Partial<S>> = {
            'Primary aldosteronism': { aldo: 5 },
            'Aldosterone absent': { aldoAbsent: true },
            Thiazide: { thiazide: true },
            Amiloride: { amiloride: true },
            Spironolactone: { spiro: true },
            'Metabolic alkalosis': { hco3: 34 },
            'Metabolic acidosis': { hco3: 14 },
          };
          setS({ ...START, ...m[o.label] });
          setCell(o.label.includes('alkalosis') ? 'icB' : o.label.includes('acidosis') ? 'icA' : o.label === 'Thiazide' ? 'dct' : 'principal');
        }}
        onReset={() => setS(START)}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Hormones and transporters">
            <Slider label="Aldosterone (autonomous floor)" value={s.aldo} min={0} max={8} step={0.25} format={(v) => (v === 0 ? 'physiological' : `${v.toFixed(2)} ×`)} onInput={(v) => up({ aldo: v })} />
            <Slider label="NCC" value={s.ncc} min={0} max={1.5} step={0.05} unit="×" onInput={(v) => up({ ncc: v })} />
            <Slider label="ENaC" value={s.enac} min={0} max={3} step={0.05} unit="×" onInput={(v) => up({ enac: v })} hint="> 1 = Liddle syndrome" />
            <Slider label="Plasma HCO₃⁻" value={s.hco3} min={8} max={45} step={0.5} unit="mmol/L" onInput={(v) => up({ hco3: v })} />
            <Slider label="PTH" value={s.pth} min={0.1} max={5} step={0.1} unit="×" onInput={(v) => up({ pth: v })} />
            <Toggle label="No aldosterone (adrenal insufficiency / hypoaldosteronism)" checked={s.aldoAbsent} onChange={(v) => up({ aldoAbsent: v })} />
            <Toggle label="Thiazide" checked={s.thiazide} onChange={(v) => up({ thiazide: v })} />
            <Toggle label="Amiloride" checked={s.amiloride} onChange={(v) => up({ amiloride: v })} />
            <Toggle label="Spironolactone" checked={s.spiro} onChange={(v) => up({ spiro: v })} />
            <Toggle label="Loop diuretic (more distal delivery)" checked={s.furosemide} onChange={(v) => up({ furosemide: v })} />
          </Panel>
          <Panel title="Distal readouts">
            <div class="readout-grid">
              <Readout label="Distal Na⁺ delivery" value={k.distalNaDelivery * 1440} unit="mmol/d" delta={(k.distalNaDelivery - n.kidney.distalNaDelivery) * 1440} />
              <Readout label="Lumen-negative voltage" value={k.distalVoltage * 100} unit="% normal" />
              <Readout label="K⁺ secretion" value={k.kSecretion * 1440} unit="mmol/d" delta={(k.kSecretion - n.kidney.kSecretion) * 1440} />
              <Readout label="Urine K⁺" value={k.urine.exc.K} unit="mmol/d" />
              <Readout label="Urine Na⁺" value={k.urine.exc.Na} unit="mmol/d" />
              <Readout label="Urine pH" value={k.urine.pH} digits={2} />
              <Readout label="Urine Ca²⁺" value={k.urine.exc.Ca} digits={1} unit="mmol/d" />
              <Readout label="MR activation" value={h.mr} digits={2} unit="×" />
            </div>
          </Panel>
        </div>
        <div>
          <Tabs
            tabs={[
              { id: 'dct', label: 'Distal convoluted tubule' },
              { id: 'principal', label: 'Principal cell' },
              { id: 'icA', label: 'Intercalated cell (type A)' },
              { id: 'icB', label: 'Intercalated cell (type B)' },
            ]}
            active={cell}
            onChange={setCell}
          />
          <Panel>{cells[cell]}</Panel>
          <div class="grid grid-2">
            <Panel title="Aldosterone’s cascade">
              <Chain
                steps={[
                  { text: `Mineralocorticoid receptor activation ${h.mr.toFixed(1)}×`, direction: h.mr > 1.2 ? 1 : h.mr < 0.8 ? -1 : 0 },
                  { text: 'Open ENaC channels (from <100 to ~3000 per cell across the range of salt intake)', direction: h.mr > 1.2 ? 1 : h.mr < 0.8 ? -1 : 0 },
                  { text: 'Na⁺ reabsorbed without an anion → lumen-negative voltage', direction: k.distalVoltage > 1.1 ? 1 : k.distalVoltage < 0.9 ? -1 : 0 },
                  { text: 'K⁺ secretion through ROMK/BK', direction: k.kSecretion > n.kidney.kSecretion * 1.1 ? 1 : k.kSecretion < n.kidney.kSecretion * 0.9 ? -1 : 0 },
                  { text: 'H⁺ secretion by type A intercalated cells', direction: k.hSecretionDistal > n.kidney.hSecretionDistal * 1.05 ? 1 : k.hSecretionDistal < n.kidney.hSecretionDistal * 0.95 ? -1 : 0 },
                ]}
              />
            </Panel>
            <Predict
              question="A patient with hypertension and hypokalaemia has suppressed renin and aldosterone. Spironolactone does nothing; amiloride corrects everything. Diagnosis?"
              options={['Primary aldosteronism', 'Liddle syndrome (constitutively active ENaC)', 'Renal artery stenosis']}
              correct={1}
              explanation="The channel is open without aldosterone, so blocking the aldosterone receptor is useless; blocking the channel itself works. Try ENaC 2.5× with aldosterone physiological."
            />
          </div>
        </div>
      </div>
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>The distal nephron reabsorbs ~10–12% of filtered Na⁺, secretes most urinary K⁺, finishes acidification and, with ADH, concentrates the urine.</p>}
          why={<p>Tight junctions hold steep gradients; electrogenic ENaC couples Na⁺ reabsorption to K⁺ and H⁺ secretion; separate cell types answer to aldosterone, ADH and PTH.</p>}
          change={<p>More aldosterone or more distal Na⁺ delivery → more K⁺ and H⁺ secretion. Less of either → retention. Thiazides dissociate Na⁺ from Ca²⁺.</p>}
          abnormal={<p>Gitelman, Liddle, pseudohypoaldosteronism, distal RTA, lithium nephrogenic DI, hyper- and hypoaldosteronism.</p>}
          clinical={<p>Diuretic-induced hypokalaemia and alkalosis; potassium-sparing diuretics and hyperkalaemia; thiazides for calcium stones; distal adaptation in diuretic resistance.</p>}
        />
        <Sources cite={{ rose: [5], evidence: 'physiology', refs: ['rossier2015', 'pearce2015', 'roy2015', 'subramanya2014'] }} />
      </Panel>
      <Related paths={['/potassium', '/raas', '/diuretics', '/rta', '/inherited', '/transport']} />
    </div>
  );
}
