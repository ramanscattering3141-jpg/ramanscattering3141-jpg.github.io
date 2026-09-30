import { useState } from 'preact/hooks';
import { PageHead, Related, Busy } from '../ui/page';
import { Panel, Readout, Predict, toneFor } from '../ui/kit';
import { makeParams, useSteady } from '../sim/hooks';
import { si } from '../units';
import type { ParamPatch } from '../engine/types';

interface Challenge {
  id: string;
  title: string;
  brief: string;
  patch: ParamPatch;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  watch: { label: string; get: (e: any) => number; unit: string; digits: number; lo: number; hi: number }[];
}

const R = (label: string, get: (e: any) => number, unit: string, digits: number, lo: number, hi: number) => ({ label, get, unit, digits, lo, hi });

const CHALLENGES: Challenge[] = [
  {
    id: 'nkcc2', title: 'Break the thick ascending limb', brief: 'Knock out NKCC2 — the loop diuretic target and the site of Bartter syndrome.',
    patch: { transporters: { NKCC2: 0.3 } },
    question: 'With the thick limb crippled, what happens to potassium and the acid–base state?',
    options: ['Hyperkalaemic acidosis', 'Hypokalaemic alkalosis', 'No change', 'Hyperkalaemic alkalosis'],
    correct: 1,
    explanation: 'Salt wasting drives up aldosterone, and high distal flow with it wastes K⁺ and H⁺ — a hypokalaemic alkalosis, with hypercalciuria because the lumen-positive voltage that drove calcium reabsorption is gone.',
    watch: [R('Potassium', (e) => e.plasma.K, 'mmol/L', 1, 3.5, 5), R('Bicarbonate', (e) => e.plasma.HCO3, 'mmol/L', 0, 22, 28), R('Urine calcium', (e) => e.kidney.urine.exc.Ca, 'mmol/d', 1, 2.5, 7.5), R('Mean BP', (e) => e.reg.MAP, 'mmHg', 0, 80, 100)],
  },
  {
    id: 'hatpase', title: 'Break distal acid secretion', brief: 'Disable the collecting-duct H⁺-ATPase — distal (type 1) RTA.',
    patch: { transporters: { HATPase: 0.15 } },
    question: 'What is the signature of a kidney that cannot secrete H⁺ distally?',
    options: ['A high-gap acidosis', 'A normal-gap acidosis with a urine pH that stays above 5.3', 'A metabolic alkalosis', 'No acid–base change'],
    correct: 1,
    explanation: 'The α-intercalated cell cannot acidify the urine, so despite a severe hyperchloraemic (normal-gap) acidosis the urine pH stays inappropriately high — the hallmark of distal RTA, with hypokalaemia and stones.',
    watch: [R('Bicarbonate', (e) => e.plasma.HCO3, 'mmol/L', 0, 22, 28), R('Urine pH', (e) => e.kidney.urine.pH, '', 1, 5, 6.5), R('Potassium', (e) => e.plasma.K, 'mmol/L', 1, 3.5, 5), R('Chloride', (e) => e.plasma.Cl, 'mmol/L', 0, 98, 108)],
  },
  {
    id: 'aqp2', title: 'Break the water channel', brief: 'Remove aquaporin-2 — nephrogenic diabetes insipidus.',
    patch: { transporters: { AQP2: 0.1 } },
    question: 'The collecting duct can no longer respond to ADH. The urine will be:',
    options: ['Concentrated', 'Dilute and copious, whatever the ADH level', 'Normal', 'Absent'],
    correct: 1,
    explanation: 'Without aquaporin-2 the collecting duct is water-impermeable however much ADH is present: large volumes of dilute urine, and a risk of hypernatraemia if water is not freely available.',
    watch: [R('Urine osmolality', (e) => e.kidney.urine.osm, 'mOsm/kg', 0, 300, 900), R('Urine volume', (e) => e.kidney.urine.volumePerDay, 'L/d', 1, 0.8, 2.5), R('Sodium', (e) => e.plasma.Na, 'mmol/L', 0, 135, 145), R('ADH', (e) => e.reg.hormones.adh, 'pg/mL', 1, 0, 5)],
  },
  {
    id: 'aldo0', title: 'Remove aldosterone', brief: 'Abolish aldosterone synthesis — the mineralocorticoid half of Addison’s.',
    patch: { aldoSynthesis: 0, glucocorticoid: 0.3 },
    question: 'With no aldosterone, sodium and potassium go which ways?',
    options: ['Na⁺ retained, K⁺ low', 'Na⁺ wasted, K⁺ high', 'Both retained', 'Both wasted'],
    correct: 1,
    explanation: 'Aldosterone drives distal Na⁺ reabsorption and K⁺/H⁺ secretion. Without it the kidney wastes sodium (volume depletion, low BP) and retains potassium and acid — hyperkalaemia and a mild acidosis with a very low TTKG.',
    watch: [R('Sodium', (e) => e.plasma.Na, 'mmol/L', 0, 135, 145), R('Potassium', (e) => e.plasma.K, 'mmol/L', 1, 3.5, 5), R('Bicarbonate', (e) => e.plasma.HCO3, 'mmol/L', 0, 22, 28), R('Mean BP', (e) => e.reg.MAP, 'mmHg', 0, 80, 100)],
  },
  {
    id: 'nephron', title: 'Take away 85% of nephrons', brief: 'Reduce the working kidney to a sixth of itself — advanced CKD.',
    patch: { nephronFraction: 0.15 },
    question: 'Which disturbance appears first as nephrons are lost?',
    options: ['Hyperkalaemia', 'Hypernatraemia', 'The acidosis and the phosphate/PTH changes, before the potassium', 'Nothing until dialysis'],
    correct: 2,
    explanation: 'Ammonium excretion per nephron maxes out, and phosphate is retained, before potassium handling fails — so the acidosis and the mineral changes precede the hyperkalaemia, which adaptation and the colon hold off until late.',
    watch: [R('eGFR', (e) => e.derived.eGFR, 'mL/min', 0, 60, 120), R('Bicarbonate', (e) => e.plasma.HCO3, 'mmol/L', 0, 22, 28), R('Phosphate', (e) => e.plasma.Pi, 'mmol/L', 2, 0.8, 1.45), R('Potassium', (e) => e.plasma.K, 'mmol/L', 1, 3.5, 5)],
  },
];

export default function BreakKidney({ query }: { query: URLSearchParams }) {
  void query;
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const c = CHALLENGES[idx];
  const base = useSteady(makeParams(), 40);
  const broken = useSteady(makeParams(c.patch), 40);
  const busy = base.busy || broken.busy;
  const pick = (i: number) => setIdx(i);

  return (
    <div>
      <PageHead
        path="/break"
        lede="Reach into the nephron and break one thing. Each challenge disables a transporter or a hormone; predict what the body does, then reveal the numbers the model settles on. The fastest way to learn what a mechanism is for is to watch what fails without it."
      />
      <div class="btn-row" style={{ marginBottom: 12 }}>
        {CHALLENGES.map((x, i) => (
          <button key={x.id} class={i === idx ? 'active' : ''} onClick={() => { pick(i); setRevealed(false); }}>{x.title}</button>
        ))}
      </div>
      <div class="grid grid-sidebar">
        <div>
          <Panel title={c.title} note={c.brief}>
            <Predict question={c.question} options={c.options} correct={c.correct} explanation={c.explanation} />
            {!revealed && <button class="primary" style={{ marginTop: 10 }} onClick={() => setRevealed(true)}>Reveal the numbers</button>}
          </Panel>
        </div>
        <div>
          <Panel title={revealed ? 'What the model settles on' : 'The result (hidden)'} note={revealed ? 'The broken kidney’s steady state, against normal.' : 'Make your prediction first, then reveal.'}>
            <Busy on={busy} />
            {revealed && base.ev && broken.ev && (
              <div class="readout-grid">
                {c.watch.map((w) => {
                  const b = w.get(base.ev);
                  const a = w.get(broken.ev);
                  const val = w.label === 'eGFR' ? a : w.label === 'Creatinine' ? si.creat(a) : a;
                  return (
                    <Readout key={w.label} label={w.label} value={val} digits={w.digits} unit={w.unit} tone={toneFor(a, w.lo, w.hi)} delta={a - b} deltaDigits={w.digits} refRange={`was ${b.toFixed(w.digits)}`} />
                  );
                })}
              </div>
            )}
            {!revealed && <p class="muted" style={{ marginBottom: 0 }}>Answer the prediction and press reveal.</p>}
          </Panel>
        </div>
      </div>
      <Related paths={['/sandbox', '/whatif', '/inherited', '/rta', '/transport', '/nephron']} />
    </div>
  );
}
