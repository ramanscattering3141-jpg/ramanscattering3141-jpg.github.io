import { useState } from 'preact/hooks';
import { PageHead, Related, Busy } from '../ui/page';
import { Panel, Readout, Predict, Sources, toneFor } from '../ui/kit';
import { makeParams, useSteady } from '../sim/hooks';
import { encodeState, href } from '../router';
import { readyRoute } from '../routes';
import type { ParamPatch } from '../engine/types';

interface Readable {
  label: string;
  get: (e: any) => number;
  unit: string;
  digits: number;
  lo: number;
  hi: number;
}
const R = (label: string, get: (e: any) => number, unit: string, digits: number, lo: number, hi: number): Readable => ({ label, get, unit, digits, lo, hi });

interface Case {
  id: string;
  title: string;
  vignette: string;
  patch: ParamPatch;
  labs: Readable[];
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  teaching: string;
  links: string[];
}

const CASES: Case[] = [
  {
    id: 'vomiting', title: 'The vomiting young woman',
    vignette: 'A 24-year-old has been vomiting for five days. She is thirsty and lightheaded on standing. What will the chemistry show, and why does the urine chloride matter more than the urine sodium?',
    patch: { vomiting: 1.2, waterIntake: 1.2, naIntake: 60 },
    labs: [R('Potassium', (e) => e.plasma.K, 'mmol/L', 1, 3.5, 5), R('Bicarbonate', (e) => e.plasma.HCO3, 'mmol/L', 0, 22, 28), R('Chloride', (e) => e.plasma.Cl, 'mmol/L', 0, 98, 108), R('Urine chloride', (e) => e.kidney.urine.Cl, 'mmol/L', 0, 10, 100)],
    question: 'Her urine sodium is not low, yet she is clearly volume depleted. What explains it, and what confirms the depletion?',
    options: ['She is not really depleted', 'Bicarbonate is spilling with sodium as a non-reabsorbable anion, so the urine sodium stays up — the low urine chloride reveals the true state', 'She has an aldosterone deficiency', 'The kidney is injured'],
    correct: 1,
    explanation: 'In a chloride-depletion alkalosis the kidney must excrete the excess bicarbonate, which drags sodium out with it, so the urine sodium is misleadingly high. The urine chloride, driven low by the volume signal, is the reliable marker — the reason it is the test that separates the saline-responsive alkaloses.',
    teaching: 'Vomiting removes HCl and volume: a chloride-depletion (saline-responsive) metabolic alkalosis, with potassium wasted along the way. Replace chloride (as saline and KCl) and the kidney offloads the bicarbonate.',
    links: ['/metabolic-alkalosis', '/hypokalemia', '/urine-chemistry'],
  },
  {
    id: 'dka', title: 'The collapse with a high glucose',
    vignette: 'A young man with type 1 diabetes is drowsy and breathing deeply. Glucose 32 mmol/L. He is profoundly volume depleted. What is the acid–base picture, and what will happen to the potassium when you start insulin?',
    patch: { ketoAcid: 12, glucose: 580, naIntake: 100, waterIntake: 1.2 },
    labs: [R('Bicarbonate', (e) => e.plasma.HCO3, 'mmol/L', 0, 22, 28), R('Anion gap', (e) => e.plasma.anionGap, 'mmol/L', 0, 6, 12), R('Potassium', (e) => e.plasma.K, 'mmol/L', 1, 3.5, 5), R('Sodium', (e) => e.plasma.Na, 'mmol/L', 0, 135, 145)],
    question: 'His potassium reads normal on arrival. After insulin, what happens?',
    options: ['It rises', 'It falls, often steeply — the total-body deficit was masked by the acidosis and insulin lack', 'It stays the same', 'It is irrelevant'],
    correct: 1,
    explanation: 'The acidosis and insulin deficiency held potassium outside the cells, so a normal plasma level sits on a large deficit (3–5 mmol/kg lost in the osmotic diuresis). Insulin drives it back in and the level falls — replace potassium early and watch it closely.',
    teaching: 'A high-gap ketoacidosis with an osmotic diuresis: volume, potassium and phosphate deficits under a deceptively normal or high plasma potassium. The hyperglycaemia crisis simulator runs the whole time course.',
    links: ['/hyperglycemia', '/metabolic-acidosis', '/potassium'],
  },
  {
    id: 'siadh', title: 'The hyponatraemia after pneumonia',
    vignette: 'An older woman recovering from pneumonia has a sodium of 122 mmol/L. She is clinically euvolaemic and not oedematous. The urine is concentrated with a high sodium. Why does giving saline not help?',
    patch: { adhAutonomous: 5, waterIntake: 1.5, naIntake: 100 },
    labs: [R('Sodium', (e) => e.plasma.Na, 'mmol/L', 0, 135, 145), R('Urine osmolality', (e) => e.kidney.urine.osm, 'mOsm/kg', 0, 100, 800), R('Urine sodium', (e) => e.kidney.urine.Na, 'mmol/L', 0, 20, 40), R('Oedema', (e) => e.derived.edemaLiters, 'L', 1, 0, 0.5)],
    question: 'Isotonic saline is given. What happens to her sodium?',
    options: ['It rises nicely', 'It can fall further — with the urine more concentrated than the saline, the salt is excreted and part of the water is kept', 'No change', 'She becomes hypernatraemic'],
    correct: 1,
    explanation: 'When the urine osmolality exceeds that of the infused saline, the kidney excretes the sodium in a smaller volume than was given, retaining the rest as electrolyte-free water — so the sodium falls. Restrict water, or raise the solute load; use hypertonic saline only for severe symptoms.',
    teaching: 'SIADH: water retention then a secondary natriuresis, euvolaemic, with an inappropriately concentrated urine. The fluid that helps depends on its osmolality relative to the urine, not to the plasma.',
    links: ['/hyponatremia', '/adh', '/free-water'],
  },
  {
    id: 'conn', title: 'The hypertensive with a low potassium',
    vignette: 'A 45-year-old with resistant hypertension has a potassium of 3.0 and a mild alkalosis. He is not on a diuretic. Renin is suppressed and aldosterone is high. Why is he not oedematous?',
    patch: { aldoAutonomous: 3 },
    labs: [R('Potassium', (e) => e.plasma.K, 'mmol/L', 1, 3.5, 5), R('Bicarbonate', (e) => e.plasma.HCO3, 'mmol/L', 0, 22, 28), R('Mean BP', (e) => e.reg.MAP, 'mmHg', 0, 80, 100), R('Oedema', (e) => e.derived.edemaLiters, 'L', 1, 0, 0.5)],
    question: 'Autonomous aldosterone retains sodium — why does the volume not keep expanding into oedema?',
    options: ['Aldosterone does not retain sodium', 'Pressure natriuresis escapes the sodium retention after a few days, while the potassium and acid wasting continue', 'He is fluid restricted', 'The kidney is failing'],
    correct: 1,
    explanation: 'The initial sodium retention raises the pressure, and pressure natriuresis then returns sodium balance to normal at a higher blood pressure — the escape phenomenon — so there is hypertension but no oedema. The distal potassium and hydrogen secretion do not escape, so the hypokalaemic alkalosis persists.',
    teaching: 'Primary aldosteronism: hypertension, hypokalaemic alkalosis, suppressed renin, no oedema. It is the potassium depletion, not the volume, that keeps the alkalosis going.',
    links: ['/raas', '/hypokalemia', '/sodium'],
  },
  {
    id: 'ckd', title: 'The slow decline',
    vignette: 'A 60-year-old diabetic has a creatinine that has crept up over years; eGFR is now 22. He has a mild acidosis, a rising phosphate and a high PTH, but a nearly normal potassium. Put the derangements in order.',
    patch: { nephronFraction: 0.16, glucose: 160 },
    labs: [R('eGFR', (e) => e.derived.eGFR, 'mL/min', 0, 60, 120), R('Bicarbonate', (e) => e.plasma.HCO3, 'mmol/L', 0, 22, 28), R('Phosphate', (e) => e.plasma.Pi, 'mmol/L', 2, 0.8, 1.45), R('Potassium', (e) => e.plasma.K, 'mmol/L', 1, 3.5, 5)],
    question: 'Why is the potassium still near normal when the acidosis and mineral changes are already established?',
    options: ['The potassium is measured wrong', 'Adaptation and colonic secretion defend potassium longest; ammonium excretion and phosphate handling fail earlier', 'He is on a potassium binder', 'Potassium does not change in CKD'],
    correct: 1,
    explanation: 'Ammonium excretion per nephron reaches its ceiling once the GFR is below ~40–50, and phosphate is retained, before potassium handling fails — so acidosis and CKD–MBD precede the hyperkalaemia, which is held off until very late or a drug is added.',
    teaching: 'Chronic kidney disease exhausts its adaptations in a fixed order: concentration, then phosphate and acid, then potassium, then sodium and water. Watch for the drug (ACE inhibitor, MRA) that tips the potassium over.',
    links: ['/ckd', '/minerals', '/hyperkalemia'],
  },
  {
    id: 'atn', title: 'The oliguria after surgery',
    vignette: 'After a long operation complicated by hypotension, a patient becomes oliguric. The urine sodium is high and the urine is isosthenuric, with granular casts. Pre-renal or established injury?',
    patch: { tubularInjury: 0.75 },
    labs: [R('GFR', (e) => e.kidney.GFR, 'mL/min', 0, 60, 120), R('FENa', (e) => e.derived.FENa, '%', 1, 0, 1), R('Urine sodium', (e) => e.kidney.urine.Na, 'mmol/L', 0, 10, 40), R('Urine osmolality', (e) => e.kidney.urine.osm, 'mOsm/kg', 0, 300, 900)],
    question: 'A FENa above 2% with an isosthenuric urine and casts points to which, and what is the management?',
    options: ['Pre-renal — give more fluid', 'Established acute tubular necrosis — supportive care through the maintenance phase, watch for hyperkalaemia', 'Obstruction — catheterise', 'Glomerulonephritis — steroids'],
    correct: 1,
    explanation: 'Injured tubules cannot reabsorb sodium or concentrate the urine, so the FENa is high and the urine isosthenuric with granular (muddy-brown) casts — established ATN, not pre-renal. Nothing shortens it; support the patient and treat the complications until the tubules recover.',
    teaching: 'The urine indices separate pre-renal from ATN, but with traps — a superimposed volume signal, diuretics or advanced CKD can mislead. Read the indices as evidence, not proof.',
    links: ['/prerenal-atn', '/aki', '/fractional-excretion'],
  },
];

function CaseCard({ c }: { c: Case }) {
  const run = useSteady(makeParams(c.patch), 30);
  const [open, setOpen] = useState(false);
  const e = run.ev;
  return (
    <Panel title={c.title} note={c.vignette}>
      <Busy on={run.busy} />
      {e && (
        <div class="readout-grid">
          {c.labs.map((l) => {
            const v = l.label === 'eGFR' ? l.get(e) : l.get(e);
            return <Readout key={l.label} label={l.label} value={v} digits={l.digits} unit={l.unit} tone={toneFor(l.get(e), l.lo, l.hi)} />;
          })}
        </div>
      )}
      <div style={{ marginTop: 10 }}>
        <Predict question={c.question} options={c.options} correct={c.correct} explanation={c.explanation} />
      </div>
      {!open && <button class="ghost" style={{ marginTop: 8 }} onClick={() => setOpen(true)}>Show the teaching point</button>}
      {open && (
        <p class="note" style={{ marginTop: 8 }}>
          <strong>Teaching point.</strong> {c.teaching}
        </p>
      )}
      <div class="chips" style={{ marginTop: 8 }}>
        <a class="tag" href={href('/sandbox', { s: encodeState({ patch: c.patch, label: c.title }) })}>
          open this patient in the sandbox →
        </a>
        {c.links.map((p) => (
          <a key={p} class="tag" href={href(p)}>
            {readyRoute(p)?.title ?? p} →
          </a>
        ))}
      </div>
    </Panel>
  );
}

export default function Cases({ query }: { query: URLSearchParams }) {
  void query;
  return (
    <div>
      <PageHead
        path="/cases"
        lede="Real presentations, run on the model. Each case gives you the story and the numbers the engine settles on, asks you to reason it out, and then opens the mechanism in the simulator that made those numbers. The chemistry is not memorised — it is derived, the way it is in the patient."
      />
      <div class="grid grid-2">
        {CASES.map((c) => (
          <CaseCard key={c.id} c={c} />
        ))}
      </div>
      <Panel title="How to use these" id="how">
        <p class="muted" style={{ marginBottom: 0 }}>
          Read the vignette, predict before revealing, then follow the “open in simulator” links to change the variables yourself and watch the same numbers move. Every case is built from the physiology on the linked pages — nothing here is a lookup table.
        </p>
        <Sources cite={{ rose: [13, 14, 19, 23, 25, 27, 28], evidence: 'clinical' }} />
      </Panel>
      <Related paths={['/challenges', '/lessons', '/labs', '/sandbox', '/tutor']} />
    </div>
  );
}
