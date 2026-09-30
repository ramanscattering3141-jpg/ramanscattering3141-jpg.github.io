import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related, Toggle } from '../ui/page';
import { Panel, Readout, Slider, Chain, Sources, Predict, LineChart } from '../ui/kit';
import { saturable } from '../engine/math';
import { acute, makeParams, NORMAL } from '../sim/hooks';
import { conv } from '../units';

interface S {
  glucose: number;
  gfr: number;
  sglt2: number;
  sglt1: number;
  inhibitor: boolean;
}
// glucose in mmol/L; loads in mmol/min
const START: S = { glucose: 5.3, gfr: 125, sglt2: 1, sglt1: 1, inhibitor: false };
/** whole-kidney glucose Tm ≈ 375 mg/min */
const TM = 2.08;
/** 1 mg/min of glucose, the smallest glucosuria we call glucosuria */
const TRACE = 1 / 180;

function titration(s: S, P: number) {
  const filtered = (s.gfr * P) / 1000;
  const tm2 = TM * 0.92 * s.sglt2 * (s.inhibitor ? 0.15 : 1);
  const tm1 = TM * 0.08 * s.sglt1;
  const g2 = saturable(filtered, tm2, 0.93);
  const g1 = saturable(filtered - g2, tm1, 0.93);
  const idealReab = Math.min(filtered, tm2 + tm1);
  return { filtered, reab: g2 + g1, g2, g1, excreted: filtered - g2 - g1, idealExc: filtered - idealReab, tm: tm1 + tm2 };
}

function CellDiagram({ sglt2, sglt1, inhibitor, flux }: { sglt2: number; sglt1: number; inhibitor: boolean; flux: number }) {
  const w = (x: number) => Math.max(1, Math.min(10, x));
  return (
    <svg viewBox="0 0 600 190" width="100%" role="img" aria-label="Proximal tubule cell: SGLT2 and SGLT1 at the apical membrane, GLUT2 and GLUT1 at the basolateral membrane">
      <text x="60" y="18" class="svg-label" text-anchor="middle">
        LUMEN
      </text>
      <text x="300" y="18" class="svg-label" text-anchor="middle">
        PROXIMAL TUBULE CELL
      </text>
      <text x="540" y="18" class="svg-label" text-anchor="middle">
        BLOOD
      </text>
      <rect x="140" y="30" width="320" height="140" rx="12" fill="#16303f" stroke="#2f7f73" />
      {/* apical carriers */}
      <circle cx="140" cy="70" r="23" fill={inhibitor ? '#b08ee0' : '#5ecfba'} opacity={0.3 + 0.7 * Math.min(1, sglt2)} />
      <text x="140" y="74" text-anchor="middle" class="svg-label" style={{ fill: '#0b1b27', fontWeight: 700 }}>
        SGLT2
      </text>
      <circle cx="140" cy="130" r="23" fill="#7bc47f" opacity={0.3 + 0.7 * Math.min(1, sglt1)} />
      <text x="140" y="134" text-anchor="middle" class="svg-label" style={{ fill: '#0b1b27', fontWeight: 700 }}>
        SGLT1
      </text>
      <text x="60" y="66" text-anchor="middle" class="svg-label">
        1 Na⁺ + 1 glucose
      </text>
      <text x="60" y="80" text-anchor="middle" class="svg-label">
        S1–S2 · high capacity
      </text>
      <text x="60" y="126" text-anchor="middle" class="svg-label">
        2 Na⁺ + 1 glucose
      </text>
      <text x="60" y="140" text-anchor="middle" class="svg-label">
        S3 · high affinity
      </text>
      {inhibitor && (
        <text x="140" y="46" text-anchor="middle" class="svg-label" style={{ fill: '#b08ee0' }}>
          ✕ gliflozin
        </text>
      )}
      {/* basolateral */}
      <circle cx="460" cy="70" r="23" fill="#f2b134" />
      <text x="460" y="74" text-anchor="middle" class="svg-label" style={{ fill: '#0b1b27', fontWeight: 700 }}>
        GLUT2
      </text>
      <circle cx="460" cy="130" r="23" fill="#e4a26b" />
      <text x="460" y="134" text-anchor="middle" class="svg-label" style={{ fill: '#0b1b27', fontWeight: 700 }}>
        NaK
      </text>
      <text x="540" y="66" text-anchor="middle" class="svg-label">
        facilitated diffusion
      </text>
      <text x="540" y="126" text-anchor="middle" class="svg-label">
        3 Na⁺ out / 2 K⁺ in
      </text>
      <line x1="160" x2="440" y1="70" y2="70" stroke="#f2b134" stroke-width={w(flux * 8)} marker-end="url(#g-arr)" opacity="0.8" />
      <line x1="160" x2="440" y1="130" y2="130" stroke="#5ecfba" stroke-width="2" stroke-dasharray="4 4" />
      <text x="300" y="62" text-anchor="middle" class="svg-label">
        glucose moves uphill into the cell, then downhill out
      </text>
      <text x="300" y="152" text-anchor="middle" class="svg-label">
        Na⁺ gradient (cell Na⁺ 20–30 mmol/L) powers the apical step
      </text>
      <defs>
        <marker id="g-arr" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#f2b134" />
        </marker>
      </defs>
    </svg>
  );
}

export default function Glucose() {
  const [s, setS] = useState<S>(START);
  const up = (p: Partial<S>) => setS({ ...s, ...p });
  const t = titration(s, s.glucose);
  const curve = useMemo(() => {
    const rows = [];
    for (let P = 0; P <= 45; P += 0.5) rows.push({ P, ...titration(s, P) });
    return rows;
  }, [s.gfr, s.sglt2, s.sglt1, s.inhibitor]);
  const threshold = curve.find((r) => r.excreted > TRACE)?.P;
  const ev = useMemo(() => acute(makeParams({ glucose: conv.glucose(s.glucose), drugs: { sglt2i: s.inhibitor ? 1 : 0 }, transporters: { SGLT2: s.sglt2, SGLT1: s.sglt1 } })), [s]);
  const n = NORMAL();
  const u = ev.kidney.urine;

  return (
    <div>
      <PageHead path="/glucose" lede="Filtered glucose rises with plasma glucose; reabsorptive capacity does not. Raise the glucose, lower the GFR, weaken or block SGLT2, and watch the titration curve, the threshold and the downstream osmotic diuresis." />
      <WhatIf
        options={[
          { label: 'Uncontrolled diabetes (glucose 25)', explain: 'Filtered load ≈ 3.1 mmol/min exceeds the Tm (≈2.1): about 1 mmol/min is excreted, dragging water and Na⁺ with it (osmotic diuresis).' },
          { label: 'SGLT2 inhibitor at normal glucose', explain: 'The threshold falls toward ~2–4.5 mmol/L: tens of grams of glucose a day are excreted even with normal blood glucose, with a mild natriuresis that raises NaCl delivery to the macula densa.' },
          { label: 'Familial renal glucosuria', explain: 'Fewer or weaker SGLT2 carriers: glucosuria with normal blood glucose.' },
          { label: 'Low GFR (CKD) + glucose 14', explain: 'A smaller filtered load means less glucosuria at the same plasma glucose — and SGLT2 inhibitors lower glucose less in CKD.' },
          { label: 'Pregnancy-like high GFR', explain: 'A 50% rise in GFR raises the filtered load, so glucosuria can appear at plasma glucose that would not normally cause it.' },
        ]}
        onApply={(o) => {
          const m: Record<string, Partial<S>> = {
            'Uncontrolled diabetes (glucose 25)': { glucose: 25 },
            'SGLT2 inhibitor at normal glucose': { inhibitor: true },
            'Familial renal glucosuria': { sglt2: 0.25 },
            'Low GFR (CKD) + glucose 14': { gfr: 35, glucose: 14 },
            'Pregnancy-like high GFR': { gfr: 180, glucose: 9.5 },
          };
          setS({ ...START, ...m[o.label] });
        }}
        onReset={() => setS(START)}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Controls">
            <Slider label="Plasma glucose" value={s.glucose} min={2} max={45} step={0.1} unit="mmol/L" onInput={(v) => up({ glucose: v })} />
            <Slider label="GFR" value={s.gfr} min={15} max={200} unit="mL/min" onInput={(v) => up({ gfr: v })} />
            <Slider label="SGLT2 capacity" value={s.sglt2} min={0} max={1.5} step={0.05} unit="×" onInput={(v) => up({ sglt2: v })} />
            <Slider label="SGLT1 capacity" value={s.sglt1} min={0} max={2} step={0.05} unit="×" onInput={(v) => up({ sglt1: v })} />
            <Toggle label="SGLT2 inhibitor (gliflozin)" checked={s.inhibitor} onChange={(v) => up({ inhibitor: v })} />
          </Panel>
          <Panel title="Handling now">
            <div class="readout-grid">
              <Readout label="Filtered" value={t.filtered} digits={2} unit="mmol/min" />
              <Readout label="Reabsorbed by SGLT2" value={t.g2} digits={2} unit="mmol/min" />
              <Readout label="by SGLT1" value={t.g1} digits={2} unit="mmol/min" />
              <Readout label="Excreted" value={t.excreted} digits={2} unit="mmol/min" tone={t.excreted > TRACE ? 'high' : 'normal'} />
              <Readout label="Glucosuria" value={t.excreted * 1440} digits={0} unit="mmol/day" />
              <Readout label="Tm (whole kidney)" value={t.tm} digits={2} unit="mmol/min" />
              <Readout label="Threshold" value={threshold ?? NaN} digits={1} unit="mmol/L" title="Plasma glucose at which glucose first appears in the urine" />
            </div>
          </Panel>
        </div>
        <div>
          <Panel title="Glucose titration curve" note="Solid: with splay (nephron heterogeneity). Dashed: the idealised sharp Tm. Vertical line: current plasma glucose.">
            <LineChart
              xLabel="plasma glucose (mmol/L)"
              series={[
                { label: 'Filtered', points: curve.map((r) => ({ x: r.P, y: r.filtered })), color: '#6aa9e8' },
                { label: 'Reabsorbed', points: curve.map((r) => ({ x: r.P, y: r.reab })), color: '#7bc47f' },
                { label: 'Excreted', points: curve.map((r) => ({ x: r.P, y: r.excreted })), color: '#f2b134' },
                { label: 'Excreted if no splay', points: curve.map((r) => ({ x: r.P, y: r.idealExc })), color: '#f2b134', dashed: true },
              ]}
              yMin={0}
              marker={s.glucose}
              height={260}
            />
          </Panel>
          <Panel title="From carrier to cell">
            <CellDiagram sglt2={s.sglt2} sglt1={s.sglt1} inhibitor={s.inhibitor} flux={t.reab / TM} />
          </Panel>
          <div class="grid grid-2">
            <Panel title="Downstream: the whole kidney" note="Integrated model, first hours (before the body’s balances shift).">
              <div class="readout-grid">
                <Readout label="Urine volume" value={u.volumePerDay} digits={2} unit="L/day" delta={u.volumePerDay - n.kidney.urine.volumePerDay} deltaDigits={2} />
                <Readout label="Urine Na⁺ excretion" value={u.exc.Na} unit="mmol/day" delta={u.exc.Na - n.kidney.urine.exc.Na} />
                <Readout label="Urine osmolality" value={u.osm} unit="mOsm/kg" />
                <Readout label="Macula densa signal" value={ev.kidney.maculaDensa} digits={2} unit="×" />
                <Readout label="GFR" value={ev.kidney.GFR} unit="mL/min" delta={ev.kidney.GFR - n.kidney.GFR} />
              </div>
            </Panel>
            <Panel title="Causal chain">
              <Chain
                steps={[
                  { text: s.inhibitor ? 'SGLT2 blocked' : t.excreted > TRACE ? 'Filtered glucose exceeds reabsorptive capacity' : 'All filtered glucose reabsorbed', direction: s.inhibitor || t.excreted > TRACE ? -1 : 0 },
                  { text: 'Unreabsorbed glucose stays in the lumen as an osmole', direction: t.excreted > TRACE ? 1 : 0 },
                  { text: 'Proximal water and Na⁺ reabsorption fall (and Na⁺ no longer co-transported with glucose)', direction: t.excreted > TRACE ? -1 : 0 },
                  { text: 'More NaCl reaches the macula densa → afferent constriction, lower intraglomerular pressure', direction: t.excreted > TRACE ? 1 : 0 },
                  { text: 'Osmotic diuresis and natriuresis: glucose, water and Na⁺ in the urine', direction: t.excreted > TRACE ? 1 : 0 },
                ]}
              />
            </Panel>
          </div>
        </div>
      </div>
      <div class="grid grid-2">
        <Predict
          question="With a Tm of ~2.1 mmol/min and GFR 125 mL/min, glucosuria should begin at ~17 mmol/L. When does it actually begin?"
          options={['At ~17 mmol/L', 'At about 10–11 mmol/L', 'Only above 28 mmol/L']}
          correct={1}
          explanation="Splay: nephrons differ in glomerular size relative to proximal tubular length, so some saturate early. The curve bends before the whole-kidney Tm is reached."
        />
        <Predict
          question="Why do SGLT2 inhibitors reduce intraglomerular pressure?"
          options={['They dilate the efferent arteriole directly', 'Less proximal Na⁺ reabsorption raises macula densa NaCl delivery, activating tubuloglomerular feedback (afferent constriction)', 'They lower plasma oncotic pressure']}
          correct={1}
          explanation="This is the leading mechanistic explanation, supported by physiology studies in type 1 diabetes (Cherney 2014). It is a mechanistic interpretation of the trial benefit, not proven to be its sole cause."
        />
      </div>
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>All ~1000 mmol/day (≈180 g) of filtered glucose is reabsorbed proximally: SGLT2 takes ~90% in S1–S2, SGLT1 the rest in S3.</p>}
          why={<p>Secondary active transport: sodium’s inward gradient pulls glucose uphill into the cell; GLUT carriers let it out down its gradient.</p>}
          change={<p>Raise the filtered load past the Tm (with splay beginning at ~10–11 mmol/L) and the excess is excreted; lower the capacity and glucosuria appears at normal glucose.</p>}
          abnormal={<p>Diabetes (load), renal glucosuria (carrier), Fanconi syndrome (generalised), SGLT2 inhibition (drug). Unreabsorbed glucose causes an osmotic diuresis and impairs tubuloglomerular feedback.</p>}
          clinical={<p>Glucosuria causes polyuria and volume depletion in uncontrolled diabetes. SGLT2 inhibitors are now used for kidney and heart protection; they can cause euglycaemic ketoacidosis and genital infections, and cause an early, reversible dip in eGFR.</p>}
        />
        <Sources cite={{ rose: [3, 25], evidence: 'clinical', refs: ['vallon2017', 'cherney2014', 'heerspink2020', 'empakidney2023'] }} />
      </Panel>
      <Related paths={['/proximal', '/hyperglycemia', '/ckd', '/transport']} />
    </div>
  );
}
