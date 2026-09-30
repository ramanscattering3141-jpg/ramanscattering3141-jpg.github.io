import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, Related } from '../ui/page';
import { Panel, Readout, Slider, Sources, Predict, Tabs } from '../ui/kit';
import { EquationCard } from '../ui/EquationCard';

// A generic tubular-handling model: filtration (with sieving), saturable reabsorption and
// saturable secretion. Each "substance" is a preset of these parameters.
interface Sub {
  id: string;
  name: string;
  unit: string;
  plasma: number;
  pMax: number;
  sieving: number; // fraction of plasma concentration in filtrate (protein binding / size)
  reabFrac: number; // fraction of filtered load reabsorbed below Tm
  tm: number; // reabsorptive maximum, amount/min (Infinity if none)
  secExtraction: number; // fraction of post-glomerular plasma cleared by secretion
  secTm: number; // secretory maximum, amount/min
  note: string;
}

const SUBS: Sub[] = [
  { id: 'inulin', name: 'Inulin', unit: 'mg/L', plasma: 200, pMax: 1000, sieving: 1, reabFrac: 0, tm: Infinity, secExtraction: 0, secTm: 0, note: 'Freely filtered, neither reabsorbed nor secreted: clearance = GFR, whatever the plasma level.' },
  { id: 'creat', name: 'Creatinine', unit: 'µmol/L', plasma: 88, pMax: 1100, sieving: 1, reabFrac: 0, tm: Infinity, secExtraction: 0.035, secTm: 5.3, note: 'Filtered and modestly secreted by the organic cation pathway: clearance exceeds GFR by 10–20%, more as GFR falls.' },
  { id: 'pah', name: 'PAH', unit: 'mg/L', plasma: 20, pMax: 1200, sieving: 1, reabFrac: 0, tm: Infinity, secExtraction: 0.88, secTm: 80, note: 'Filtered and avidly secreted: ~90% extracted in one pass at low plasma levels, so its clearance approximates renal plasma flow — until secretion saturates.' },
  { id: 'glucose', name: 'Glucose', unit: 'mmol/L', plasma: 5.3, pMax: 45, sieving: 1, reabFrac: 1, tm: 2.08, secExtraction: 0, secTm: 0, note: 'Filtered and completely reabsorbed until the transport maximum is exceeded: clearance is zero, then rises toward GFR.' },
  { id: 'urea', name: 'Urea', unit: 'mmol/L', plasma: 5, pMax: 55, sieving: 1, reabFrac: 0.45, tm: Infinity, secExtraction: 0, secTm: 0, note: 'Filtered and passively reabsorbed (40–60%, more in volume depletion): clearance is about half the GFR.' },
  { id: 'na', name: 'Sodium', unit: 'mmol/L', plasma: 140, pMax: 170, sieving: 1, reabFrac: 0.995, tm: Infinity, secExtraction: 0, secTm: 0, note: 'Filtered and >99% reabsorbed: clearance is under 1 mL/min, adjusted by the distal nephron to match intake.' },
  { id: 'k', name: 'Potassium', unit: 'mmol/L', plasma: 4.2, pMax: 8, sieving: 1, reabFrac: 0.9, tm: Infinity, secExtraction: 0.1, secTm: 0.03, note: 'Mostly reabsorbed proximally, then secreted distally: its clearance reflects distal secretion.' },
  { id: 'albumin', name: 'Albumin', unit: 'g/L', plasma: 40, pMax: 50, sieving: 0.0006, reabFrac: 0.97, tm: Infinity, secExtraction: 0, secTm: 0, note: 'Barely filtered (size and charge), and most of what is filtered is taken up by the proximal tubule.' },
];

export default function Clearance() {
  const [id, setId] = useState('inulin');
  const base = SUBS.find((s) => s.id === id)!;
  const [gfr, setGfr] = useState(125);
  const [rpf, setRpf] = useState(625);
  const [pconc, setP] = useState<Record<string, number>>({});
  const [reab, setReab] = useState<Record<string, number>>({});
  const [sec, setSec] = useState<Record<string, number>>({});
  const P = pconc[id] ?? base.plasma;
  const rf = reab[id] ?? base.reabFrac;
  const se = sec[id] ?? base.secExtraction;

  const r = useMemo(() => {
    // amounts per minute: P (per litre) × flow (mL/min) ÷ 1000
    const filtered = (gfr * P * base.sieving) / 1000;
    const reabsorbed = Math.min(filtered * rf, base.tm);
    const postGlom = ((rpf - gfr) * P) / 1000;
    const secreted = Math.min(postGlom * se, base.secTm === 0 ? 0 : base.secTm);
    const excreted = Math.max(0, filtered - reabsorbed + secreted);
    const clearance = (excreted / P) * 1000;
    return { filtered, reabsorbed, secreted, excreted, clearance };
  }, [gfr, rpf, P, rf, se, base]);

  const ratio = r.clearance / gfr;
  const verdict = ratio > 1.05 ? 'net secretion' : ratio < 0.95 ? 'net reabsorption' : 'filtration only';
  const maxBar = Math.max(r.filtered, r.filtered - r.reabsorbed + r.secreted, r.secreted, 1e-9);

  return (
    <div>
      <PageHead path="/clearance" lede="Clearance asks one question: how many millilitres of plasma would have to be completely emptied of this substance, each minute, to account for what appears in the urine? Compare it with the GFR and you learn whether the tubule adds or removes it." />
      <Tabs tabs={SUBS.map((s) => ({ id: s.id, label: s.name }))} active={id} onChange={setId} />
      <div class="grid grid-sidebar">
        <Panel title="Kidney and plasma">
          <Slider label="GFR" value={gfr} min={5} max={200} unit="mL/min" onInput={setGfr} />
          <Slider label="Renal plasma flow" value={rpf} min={Math.max(gfr + 20, 100)} max={1000} step={5} unit="mL/min" onInput={setRpf} />
          <Slider label={`Plasma ${base.name.toLowerCase()}`} value={P} min={base.pMax / 100} max={base.pMax} step={base.pMax / 400} unit={base.unit} onInput={(v) => setP({ ...pconc, [id]: v })} />
          <Slider label="Fraction of filtered load reabsorbed" value={rf} min={0} max={1} step={0.005} format={(v) => `${(v * 100).toFixed(1)}%`} onInput={(v) => setReab({ ...reab, [id]: v })} hint={Number.isFinite(base.tm) ? `Transport maximum: ${base.tm} per min` : undefined} />
          <Slider label="Secretory extraction from peritubular plasma" value={se} min={0} max={0.95} step={0.005} format={(v) => `${(v * 100).toFixed(1)}%`} onInput={(v) => setSec({ ...sec, [id]: v })} />
          <p class="muted" style={{ fontSize: '0.85rem' }}>{base.note}</p>
        </Panel>
        <div>
          <Panel title={`Handling of ${base.name.toLowerCase()}`}>
            <div class="handling">
              {[
                ['Filtered', r.filtered, 'var(--c-blue)'],
                ['Reabsorbed', r.reabsorbed, 'var(--c-green)'],
                ['Secreted', r.secreted, 'var(--c-violet)'],
                ['Excreted', r.excreted, 'var(--c-amber)'],
              ].map(([label, v, color]) => (
                <div key={label as string} class="handling-row">
                  <span>{label as string}</span>
                  <div class="handling-bar">
                    <i style={{ width: `${Math.min(100, ((v as number) / maxBar) * 100)}%`, background: color as string }} />
                  </div>
                  <span class="mono">{(v as number).toPrecision(3)} /min</span>
                </div>
              ))}
            </div>
            <div class="readout-grid" style={{ marginTop: 12 }}>
              <Readout label="Clearance" value={r.clearance} digits={r.clearance < 10 ? 2 : 0} unit="mL/min" />
              <Readout label="Clearance ÷ GFR" value={ratio} digits={2} tone={ratio > 1.05 ? 'high' : ratio < 0.95 ? 'low' : 'good'} />
              <Readout label="Fractional excretion" value={(r.excreted / Math.max(r.filtered, 1e-12)) * 100} digits={2} unit="%" />
              <Readout label="Interpretation" value={verdict} />
            </div>
            <p class="note" style={{ marginTop: 10 }}>
              Excreted = filtered − reabsorbed + secreted. Clearance = excreted ÷ plasma concentration = {r.excreted.toPrecision(3)} ÷ {(P / 1000).toPrecision(3)} per mL = {r.clearance.toFixed(1)} mL/min.
            </p>
          </Panel>
          <div class="grid grid-2">
            <Predict
              question="Plasma glucose is raised from 5.5 to 22 mmol/L (GFR 125). Its clearance:"
              options={['Stays zero', 'Rises toward the GFR', 'Exceeds the GFR']}
              correct={1}
              explanation="Filtered glucose (GFR × P) exceeds the ~2.1 mmol/min (375 mg/min) transport maximum; the excess is excreted, so clearance rises — approaching but never exceeding GFR, because glucose is not secreted."
            />
            <Predict
              question="PAH plasma level is pushed very high. Its clearance:"
              options={['Rises above renal plasma flow', 'Falls toward the GFR', 'Stays equal to RPF']}
              correct={1}
              explanation="Secretion saturates, so at high plasma levels PAH is handled more and more like a filtered-only substance: clearance falls toward GFR. That is why PAH clearance measures plasma flow only at low concentrations."
            />
          </div>
        </div>
      </div>
      <div class="grid grid-2">
        <EquationCard eq="clearance" />
        <EquationCard eq="crcl24" />
      </div>
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>Inulin clearance equals GFR (~125 mL/min); PAH clearance approximates renal plasma flow (~625 mL/min); glucose and bicarbonate clearances are near zero.</p>}
          why={<p>Filtered load is GFR × plasma concentration. The tubule then subtracts (reabsorption) or adds (secretion). Clearance compares the net result with plasma.</p>}
          change={<p>Raising plasma concentration changes clearance only when a carrier saturates: glucose clearance rises past its Tm; PAH clearance falls as secretion saturates.</p>}
          abnormal={<p>As GFR falls, creatinine secretion rises, so creatinine clearance overestimates GFR — by up to twofold in advanced disease.</p>}
          clinical={<p>Timed creatinine clearance remains useful when muscle mass is unusual, but check completeness from creatinine excretion (≈0.18–0.22 mmol/kg/day in young men, 0.13–0.18 in women).</p>}
        />
        <Sources cite={{ rose: [2], evidence: 'physiology' }} />
      </Panel>
      <Related paths={['/fractional-excretion', '/creatinine', '/free-water', '/glucose', '/gfr']} />
    </div>
  );
}
