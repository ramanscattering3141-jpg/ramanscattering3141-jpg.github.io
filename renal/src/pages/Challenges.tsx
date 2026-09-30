import { useState } from 'preact/hooks';
import { PageHead, Related, Busy } from '../ui/page';
import { Panel, Readout, toneFor } from '../ui/kit';
import { makeParams, useSteady } from '../sim/hooks';
import type { ParamPatch } from '../engine/types';

interface Challenge {
  id: string;
  topic: string;
  prompt: string;
  patch: ParamPatch;
  reveal: { label: string; get: (e: any) => number; unit: string; digits: number; lo: number; hi: number };
  options: string[];
  correct: number;
  why: string;
}

const CH: Challenge[] = [
  { id: 'c1', topic: 'Sodium', prompt: 'A patient eats 350 mmol of sodium a day for two weeks. Where does the sodium balance end up?', patch: { naIntake: 350 }, reveal: { label: 'Urine Na', get: (e) => e.kidney.urine.exc.Na, unit: 'mmol/d', digits: 0, lo: 100, hi: 400 }, options: ['Excretion rises to match intake', 'Sodium keeps accumulating forever', 'Excretion stays at 150', 'Sodium falls'], correct: 0, why: 'The kidney reaches a new steady state where excretion equals intake, at a slightly higher volume and pressure.' },
  { id: 'c2', topic: 'Water', prompt: 'Drinking 10 L of water a day, with normal kidneys — what is the urine osmolality?', patch: { waterIntake: 10 }, reveal: { label: 'Urine osmolality', get: (e) => e.kidney.urine.osm, unit: 'mOsm/kg', digits: 0, lo: 50, hi: 150 }, options: ['Maximally concentrated', 'Maximally dilute (~50–100)', 'Isosthenuric (~300)', 'Unchanged from normal'], correct: 1, why: 'ADH is suppressed, so the collecting duct stays water-impermeable and the urine is maximally dilute.' },
  { id: 'c3', topic: 'Potassium', prompt: 'Autonomous aldosterone (Conn’s). What happens to the potassium?', patch: { aldoAutonomous: 3 }, reveal: { label: 'Potassium', get: (e) => e.plasma.K, unit: 'mmol/L', digits: 1, lo: 3.5, hi: 5 }, options: ['Rises', 'Falls (hypokalaemia)', 'Unchanged', 'Falls then rises'], correct: 1, why: 'Aldosterone drives distal K⁺ secretion; with it autonomous, potassium is wasted into hypokalaemia.' },
  { id: 'c4', topic: 'Acid–base', prompt: 'A ketoacid load of 12 mmol/h. What is the bicarbonate at steady state?', patch: { ketoAcid: 12 }, reveal: { label: 'Bicarbonate', get: (e) => e.plasma.HCO3, unit: 'mmol/L', digits: 0, lo: 22, hi: 28 }, options: ['Rises', 'Falls sharply (high-gap acidosis)', 'Unchanged', 'Falls a little'], correct: 1, why: 'The ketoacids consume bicarbonate and leave their anion, producing a high anion gap metabolic acidosis.' },
  { id: 'c5', topic: 'CKD', prompt: 'Lose 85% of nephrons. What happens to the phosphate?', patch: { nephronFraction: 0.15 }, reveal: { label: 'Phosphate', get: (e) => e.plasma.Pi, unit: 'mmol/L', digits: 2, lo: 0.8, hi: 1.45 }, options: ['Falls', 'Rises (once GFR is below ~30)', 'Unchanged', 'Rises then falls'], correct: 1, why: 'Below a GFR of ~30 the kidney can no longer excrete the phosphate load however hard PTH pushes, so it rises.' },
  { id: 'c6', topic: 'Diuretics', prompt: 'Start a loop diuretic. What happens to the potassium and bicarbonate?', patch: { drugs: { furosemide: 0.7 } }, reveal: { label: 'Potassium', get: (e) => e.plasma.K, unit: 'mmol/L', digits: 1, lo: 3.5, hi: 5 }, options: ['Both rise', 'Hypokalaemic alkalosis', 'Both fall', 'Hyperkalaemic acidosis'], correct: 1, why: 'High distal flow and secondary aldosterone waste K⁺ and H⁺: a hypokalaemic metabolic alkalosis.' },
  { id: 'c7', topic: 'Obstruction', prompt: 'Both ureters 80% obstructed. What happens to the GFR?', patch: { obstructionL: 0.8, obstructionR: 0.8 }, reveal: { label: 'GFR', get: (e) => e.kidney.GFR, unit: 'mL/min', digits: 0, lo: 60, hi: 120 }, options: ['Rises', 'Falls (back-pressure opposes filtration)', 'Unchanged', 'Falls only if unilateral'], correct: 1, why: 'Obstruction raises Bowman’s-space pressure, which opposes filtration and drops the GFR.' },
  { id: 'c8', topic: 'Aldosterone', prompt: 'Abolish aldosterone (Addison’s). What happens to sodium and potassium?', patch: { aldoSynthesis: 0, glucocorticoid: 0.3 }, reveal: { label: 'Potassium', get: (e) => e.plasma.K, unit: 'mmol/L', digits: 1, lo: 3.5, hi: 5 }, options: ['Na retained, K low', 'Na wasted, K high', 'Both retained', 'Both wasted'], correct: 1, why: 'Without aldosterone the kidney wastes sodium and retains potassium and acid — hyperkalaemia with a low TTKG.' },
];

export default function Challenges({ query }: { query: URLSearchParams }) {
  void query;
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState({ right: 0, done: 0 });
  const c = CH[i];
  const run = useSteady(makeParams(c.patch), 30);
  const e = run.ev;

  const pick = (n: number) => {
    if (picked !== null) return;
    setPicked(n);
    setScore((s) => ({ right: s.right + (n === c.correct ? 1 : 0), done: s.done + 1 }));
  };
  const next = () => {
    setPicked(null);
    setI((x) => (x + 1) % CH.length);
  };

  return (
    <div>
      <PageHead
        path="/challenges"
        lede="Predict, then observe. Each challenge names a single change; you say what the body does, and the model shows you. No lookup will help — the answer comes from reasoning through the physiology, and the number you reveal is the one the engine actually settles on."
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title={`Challenge ${i + 1} of ${CH.length}`} note={c.topic}>
            <p style={{ fontSize: '1.02rem', lineHeight: 1.6 }}>{c.prompt}</p>
            <div class="btn-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
              {c.options.map((o, n) => (
                <button
                  key={o}
                  class={picked === null ? '' : n === c.correct ? 'primary' : picked === n ? 'ghost' : 'ghost'}
                  style={picked !== null && picked === n && n !== c.correct ? { borderColor: 'var(--danger)' } : undefined}
                  onClick={() => pick(n)}
                >
                  {o}
                </button>
              ))}
            </div>
            {picked !== null && (
              <p class="note" style={{ marginTop: 10 }}>
                <strong>{picked === c.correct ? 'Correct.' : 'Not quite.'}</strong> {c.why}{' '}
                <button class="ghost" onClick={next}>Next →</button>
              </p>
            )}
          </Panel>
        </div>
        <div>
          <Panel title={picked === null ? 'The model’s answer (hidden)' : 'What the model settles on'}>
            <Busy on={run.busy} />
            {picked !== null && e && (
              <div class="readout-grid">
                <Readout label={c.reveal.label} value={c.reveal.get(e)} digits={c.reveal.digits} unit={c.reveal.unit} tone={toneFor(c.reveal.get(e), c.reveal.lo, c.reveal.hi)} />
              </div>
            )}
            {picked === null && <p class="muted" style={{ marginBottom: 0 }}>Make your prediction first.</p>}
          </Panel>
          <Panel title="Your score">
            <div class="readout-grid">
              <Readout label="Correct" value={score.right} digits={0} />
              <Readout label="Answered" value={score.done} digits={0} />
              <Readout label="Rate" value={score.done ? (100 * score.right) / score.done : 0} digits={0} unit="%" tone={score.done && score.right / score.done >= 0.7 ? 'good' : 'normal'} />
            </div>
          </Panel>
        </div>
      </div>
      <Related paths={['/cases', '/lessons', '/tutor', '/sandbox', '/break']} />
    </div>
  );
}
