import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related, Toggle } from '../ui/page';
import { Panel, Readout, Slider, Chain, Sources, Predict, LineChart } from '../ui/kit';
import { nephronRun, volumeState } from '../sim/nephron';
import { NORMAL } from '../sim/hooks';
import { conv } from '../units';
import { useMode } from '../ui/mode';

interface S {
  volume: number;
  nhe3: number;
  acetazolamide: boolean;
  sglt2i: boolean;
  glucose: number;
  hco3: number;
  gfr: number;
  pth: number;
}
const START: S = { volume: 0, nhe3: 1, acetazolamide: false, sglt2i: false, glucose: 5.3, hco3: 24, gfr: 130, pth: 1 };

/** Amount remaining along the tubule for a solute of which `frac` is reabsorbed, front-loaded with rate k. */
const remaining = (x: number, frac: number, k: number) => 1 - frac * ((1 - Math.exp(-k * x)) / (1 - Math.exp(-k)));

export default function Proximal() {
  const { mode } = useMode();
  const [s, setS] = useState<S>(START);
  const up = (p: Partial<S>) => setS({ ...s, ...p });
  const r = useMemo(
    () =>
      nephronRun({
        ...volumeState(s.volume),
        GFR: s.gfr,
        plasma: { glucose: conv.glucose(s.glucose), HCO3: s.hco3, pH: 6.1 + Math.log10(s.hco3 / (0.03 * (40 + 1.2 * Math.min(0, s.hco3 - 24) + 0.7 * Math.max(0, s.hco3 - 24)))) },
        hormones: { ...volumeState(s.volume).hormones, pth: s.pth },
        patch: { transporters: { NHE3: s.nhe3 }, drugs: { acetazolamide: s.acetazolamide ? 1 : 0, sglt2i: s.sglt2i ? 1 : 0 } },
      }),
    [s],
  );
  const base = useMemo(() => nephronRun({ GFR: NORMAL().kidney.GFR }), []);
  const pt = r.segments.PT;
  const frac = (k: keyof typeof pt.in) => (pt.in[k] > 1e-12 ? 1 - pt.out[k] / pt.in[k] : 0);
  const fW = frac('water');
  const fNa = frac('Na');
  const fH = frac('HCO3');
  const fG = frac('glucose');
  const fCl = frac('Cl');
  const fPi = frac('Pi');
  const fU = frac('urea');
  const fAA = frac('aa');

  const profile = useMemo(() => {
    const pts = Array.from({ length: 41 }, (_, i) => i / 40);
    const W = (x: number) => remaining(x, fW, 1.6);
    const line = (f: number, k: number) => pts.map((x) => ({ x: x * 100, y: remaining(x, f, k) / W(x) }));
    return {
      water: pts.map((x) => ({ x: x * 100, y: W(x) })),
      na: line(fNa, 1.6),
      hco3: line(fH, 5),
      glucose: line(fG, 7),
      aa: line(fAA, 7),
      cl: line(fCl, 0.9),
    };
  }, [fW, fNa, fH, fG, fCl, fAA]);

  // Glomerulotubular balance: absolute PT reabsorption against GFR.
  const gtb = useMemo(() => {
    const out: { gfr: number; abs: number; frac: number }[] = [];
    for (let g = 60; g <= 190; g += 10) {
      const rr = nephronRun({ ...volumeState(s.volume), GFR: g });
      const p = rr.segments.PT;
      out.push({ gfr: g, abs: (p.in.Na - p.out.Na) * 1440, frac: 1 - p.out.Na / p.in.Na });
    }
    return out;
  }, [s.volume]);

  return (
    <div>
      <PageHead path="/proximal" lede="Two-thirds of the filtrate is reabsorbed here, isosmotically, on the energy of one basolateral pump. Change the volume state, the Na⁺/H⁺ exchanger or the filtered load and watch the tubular fluid profile, glomerulotubular balance, and every solute whose fate is tied to sodium." />
      <WhatIf
        options={[
          { label: 'Volume depletion', explain: 'Angiotensin II and noradrenaline activate NHE3 and raise the filtration fraction: proximal reabsorption of Na⁺ — and with it urea, urate, calcium and bicarbonate — rises.' },
          { label: 'Volume expansion', explain: 'Angiotensin II and noradrenaline fall, dopamine rises: fractional proximal reabsorption falls and more NaCl is delivered downstream.' },
          { label: 'Acetazolamide', explain: 'Carbonic anhydrase inhibition blunts bicarbonate reclamation — and because the chloride gradient depends on it, NaCl reabsorption falls too.' },
          { label: 'Plasma glucose 22', explain: 'The filtered load exceeds the transport maximum. Unreabsorbed glucose holds water in the lumen and lowers luminal Na⁺, so NaCl reabsorption falls too (osmotic diuresis).' },
          { label: 'Metabolic acidosis (HCO₃⁻ 12)', explain: 'Less bicarbonate is filtered, so the passive chloride-driven component of NaCl reabsorption falls; phosphate reabsorption also falls.' },
          { label: 'High PTH', explain: 'NaPi-IIa is withdrawn from the brush border: phosphaturia.' },
          { label: 'GFR rises 30%', explain: 'Glomerulotubular balance: absolute reabsorption rises almost in proportion, so distal delivery barely changes.' },
        ]}
        onApply={(o) => {
          const m: Record<string, Partial<S>> = {
            'Volume depletion': { volume: -1 },
            'Volume expansion': { volume: 1 },
            Acetazolamide: { acetazolamide: true },
            'Plasma glucose 22': { glucose: 22 },
            'Metabolic acidosis (HCO₃⁻ 12)': { hco3: 12 },
            'High PTH': { pth: 5 },
            'GFR rises 30%': { gfr: 170 },
          };
          setS({ ...START, ...m[o.label] });
        }}
        onReset={() => setS(START)}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Controls">
            <Slider label="Effective volume" value={s.volume} min={-1} max={1} step={0.05} format={(v) => (v < -0.1 ? 'depleted' : v > 0.1 ? 'expanded' : 'normal')} onInput={(v) => up({ volume: v })} hint="Sets angiotensin II, sympathetic tone and peritubular Starling forces together" />
            <Slider label="GFR" value={s.gfr} min={40} max={200} unit="mL/min" onInput={(v) => up({ gfr: v })} />
            <Slider label="NHE3 activity" value={s.nhe3} min={0} max={1.6} step={0.05} unit="×" onInput={(v) => up({ nhe3: v })} />
            <Slider label="Plasma glucose" value={s.glucose} min={3} max={45} step={0.1} unit="mmol/L" onInput={(v) => up({ glucose: v })} />
            <Slider label="Plasma HCO₃⁻" value={s.hco3} min={8} max={45} step={0.5} unit="mmol/L" onInput={(v) => up({ hco3: v })} />
            <Slider label="PTH" value={s.pth} min={0.1} max={8} step={0.1} unit="× normal" onInput={(v) => up({ pth: v })} />
            <Toggle label="Acetazolamide" checked={s.acetazolamide} onChange={(v) => up({ acetazolamide: v })} />
            <Toggle label="SGLT2 inhibitor" checked={s.sglt2i} onChange={(v) => up({ sglt2i: v })} />
          </Panel>
          <Panel title="Fraction of filtered load reabsorbed here">
            <div class="readout-grid">
              <Readout label="Water" value={fW * 100} unit="%" delta={(fW - (1 - base.segments.PT.out.water / base.segments.PT.in.water)) * 100} />
              <Readout label="Na⁺" value={fNa * 100} unit="%" />
              <Readout label="HCO₃⁻" value={fH * 100} unit="%" />
              <Readout label="Cl⁻" value={fCl * 100} unit="%" />
              <Readout label="Glucose" value={fG * 100} digits={fG > 0.99 ? 1 : 0} unit="%" tone={fG < 0.98 ? 'low' : 'normal'} />
              <Readout label="Phosphate" value={fPi * 100} unit="%" />
              <Readout label="Urea" value={fU * 100} unit="%" />
              <Readout label="Urate (net, FE)" value={(0.09 * Math.pow(Math.min(1.5, Math.max(0.5, r.ptReabsFraction / 0.6)), -1.8)) * 100} digits={1} unit="% excreted" />
              {mode === 'quantitative' && <Readout label="Na⁺ leaving PT" value={pt.out.Na * 1440} unit="mmol/day" />}
              {mode === 'quantitative' && <Readout label="Macula densa signal" value={r.maculaDensa} digits={2} unit="×" />}
            </div>
          </Panel>
        </div>
        <div>
          <Panel title="Tubular fluid along the proximal tubule" note="Concentration in tubular fluid relative to plasma (TF/P) along the tubule; water shows the fraction of filtrate still in the lumen. Sodium stays flat because water follows it; the early removal of HCO₃⁻, glucose and amino acids concentrates chloride.">
            <LineChart
              xLabel="% of proximal tubule length"
              series={[
                { label: 'Na⁺', axis: 'TF/P: tubular fluid ÷ plasma concentration', points: profile.na, color: 'var(--c-teal)' },
                { label: 'Cl⁻', axis: 'TF/P: tubular fluid ÷ plasma concentration', points: profile.cl, color: 'var(--c-green)' },
                { label: 'HCO₃⁻', axis: 'TF/P: tubular fluid ÷ plasma concentration', points: profile.hco3, color: 'var(--c-violet)' },
                { label: 'Glucose', axis: 'TF/P: tubular fluid ÷ plasma concentration', points: profile.glucose, color: 'var(--c-amber)' },
                { label: 'Amino acids', axis: 'TF/P: tubular fluid ÷ plasma concentration', points: profile.aa, color: 'var(--c-red)', dashed: true },
                { label: 'Water still in the tubule', axis: 'Fraction of filtered water still in the tubule', points: profile.water, color: 'var(--c-blue)', dashed: true },
              ]}
              yMin={0}
              height={260}
            />
          </Panel>
          <div class="grid grid-2">
            <Panel title="Glomerulotubular balance" note="Absolute proximal Na⁺ reabsorption rises with GFR, so the fraction stays nearly constant.">
              <LineChart
                xLabel="GFR (mL/min)"
                series={[
                  { label: 'Absolute Na⁺ reabsorbed', axis: 'Proximal Na⁺ reabsorbed (mol/day)', points: gtb.map((p) => ({ x: p.gfr, y: p.abs / 1000 })), color: 'var(--c-teal)' },
                  { label: 'Fraction of filtered Na⁺ reabsorbed', axis: 'Fraction of filtered Na⁺ reabsorbed (%)', points: gtb.map((p) => ({ x: p.gfr, y: p.frac * 100 })), color: 'var(--c-amber)', dashed: true },
                ]}
                yMin={0}
                marker={s.gfr}
              />
            </Panel>
            <Panel title="Sodium drags everything with it">
              <Chain
                steps={[
                  { text: s.volume < -0.1 ? 'Volume depletion: ↑ angiotensin II, noradrenaline, filtration fraction' : s.volume > 0.1 ? 'Volume expansion: ↓ angiotensin II, ↑ dopamine' : 'Normal volume', direction: s.volume < -0.1 ? 1 : s.volume > 0.1 ? -1 : 0 },
                  { text: `Proximal Na⁺ reabsorption ${(fNa * 100).toFixed(0)}%`, direction: (Math.abs(fNa - (1 - base.segments.PT.out.Na / base.segments.PT.in.Na)) < 0.01 ? 0 : Math.sign(fNa - (1 - base.segments.PT.out.Na / base.segments.PT.in.Na))) as 1 | -1 | 0 },
                  { text: 'Urea follows water → plasma urea rises without creatinine (prerenal azotaemia)' },
                  { text: 'Urate reabsorption tracks Na⁺ → diuretic hyperuricaemia' },
                  { text: 'Ca²⁺ follows passively → saline + loop diuretic for hypercalcaemia' },
                  { text: 'HCO₃⁻ reabsorption rises → metabolic alkalosis maintained' },
                ]}
              />
            </Panel>
          </div>
        </div>
      </div>
      <div class="grid grid-2">
        <Predict
          question="Acetazolamide has no direct action on chloride transport. Does it change proximal NaCl reabsorption?"
          options={['No', 'Yes — it falls, because the chloride gradient depends on bicarbonate reabsorption', 'Yes — it rises']}
          correct={1}
          explanation="Removing bicarbonate early concentrates chloride; less bicarbonate removal means a smaller chloride gradient and less passive NaCl reabsorption. The result is a chloruresis as well as a bicarbonaturia. Toggle acetazolamide and watch the Cl⁻ curve flatten."
        />
        <Predict
          question="A newborn lacks the proximal brush border entirely. What plasma bicarbonate would you expect?"
          options={['24 mmol/L', 'About 11–12 mmol/L', 'Near zero']}
          correct={1}
          explanation="Without proximal reclamation, bicarbonate is wasted until its filtered load falls to what the distal nephron can reclaim — about 11 mmol/L in the case the book describes. Proximal RTA patients stabilise around 12 mmol/L or higher for the same reason."
        />
      </div>
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>55–65% of filtered Na⁺ and water, ~90% of HCO₃⁻, and essentially all glucose and amino acids are reabsorbed isosmotically.</p>}
          why={<p>The basolateral pump keeps cell Na⁺ low; coupled carriers let sodium bring solutes in; early removal of HCO₃⁻ and organic solutes concentrates chloride, which then diffuses out through the leaky tight junction and takes Na⁺ and water with it.</p>}
          change={<p>Volume depletion raises proximal reabsorption (angiotensin II, noradrenaline, filtration fraction); expansion lowers it. A rise in GFR raises absolute reabsorption proportionally (glomerulotubular balance).</p>}
          abnormal={<p>Fanconi syndrome, proximal RTA, renal glucosuria, cystinuria; osmotic diuresis from unreabsorbed glucose or mannitol; carbonic anhydrase inhibition.</p>}
          clinical={<p>Prerenal azotaemia, diuretic hyperuricaemia, maintenance of metabolic alkalosis, and the use of sodium manipulation to raise or lower calcium excretion all follow from sodium’s primacy here.</p>}
        />
        <Sources cite={{ rose: [3], evidence: 'physiology' }} />
      </Panel>
      <Related paths={['/glucose', '/bicarbonate', '/transport', '/minerals', '/rta', '/inherited']} />
    </div>
  );
}
