import { useState } from 'preact/hooks';
import { PageHead, Related, Busy } from '../ui/page';
import { Panel, Readout, Chain, toneFor } from '../ui/kit';
import { makeParams, useSteady } from '../sim/hooks';
import { si } from '../units';
import type { ParamPatch } from '../engine/types';

interface Lever {
  id: string;
  label: string;
  patch: ParamPatch;
  chain: { text: string; direction?: 1 | -1 | 0 }[];
}

const LEVERS: Lever[] = [
  {
    id: 'salt-up', label: 'Eat much more salt (350 mmol/day)', patch: { naIntake: 350 },
    chain: [
      { text: 'More Na⁺ retained → extracellular volume expands', direction: 1 },
      { text: 'Renin, aldosterone and sympathetic tone fall; ANP rises', direction: -1 },
      { text: 'Pressure natriuresis and reduced reabsorption raise Na⁺ excretion to match', direction: 1 },
      { text: 'New steady state: excretion equals intake, at a slightly higher volume and pressure', direction: 0 },
    ],
  },
  {
    id: 'water-up', label: 'Drink 8 L of water a day', patch: { waterIntake: 8 },
    chain: [
      { text: 'Plasma osmolality dips → ADH is suppressed', direction: -1 },
      { text: 'Collecting duct becomes water-impermeable', direction: -1 },
      { text: 'A large volume of maximally dilute urine is passed', direction: 1 },
      { text: 'Osmolality and sodium held nearly normal — unless intake exceeds the diluting capacity', direction: 0 },
    ],
  },
  {
    id: 'loop', label: 'Start a loop diuretic', patch: { drugs: { furosemide: 0.7 } },
    chain: [
      { text: 'NKCC2 blocked in the thick limb → NaCl delivery to the distal nephron rises', direction: 1 },
      { text: 'Natriuresis and diuresis; the medullary gradient is partly washed out', direction: 1 },
      { text: 'High distal flow and secondary aldosterone waste K⁺ and H⁺', direction: -1 },
      { text: 'Volume contracts; a hypokalaemic alkalosis develops', direction: -1 },
    ],
  },
  {
    id: 'aldo', label: 'Autonomous aldosterone (Conn’s)', patch: { aldoAutonomous: 3 },
    chain: [
      { text: 'ENaC-driven Na⁺ reabsorption and K⁺/H⁺ secretion rise', direction: 1 },
      { text: 'Volume expands → hypertension; renin is suppressed', direction: 1 },
      { text: 'Pressure natriuresis escapes the Na⁺ retention (no oedema)', direction: 0 },
      { text: 'But K⁺ and H⁺ wasting continue: hypokalaemic alkalosis', direction: -1 },
    ],
  },
  {
    id: 'ckd', label: 'Lose 80% of nephrons', patch: { nephronFraction: 0.2 },
    chain: [
      { text: 'Survivors hyperfilter, holding the GFR above nephron mass', direction: 1 },
      { text: 'Creatinine rises; concentrating range narrows', direction: 1 },
      { text: 'Phosphate and acid handling reach their per-nephron ceiling', direction: -1 },
      { text: 'Acidosis, a rising phosphate and PTH, and a tendency to hyperkalaemia', direction: -1 },
    ],
  },
  {
    id: 'vomit', label: 'Vomit for days', patch: { vomiting: 1.2, waterIntake: 1.2, naIntake: 60 },
    chain: [
      { text: 'HCl and volume lost → a chloride-depletion alkalosis', direction: 1 },
      { text: 'Volume depletion raises aldosterone and avid Na⁺ reabsorption', direction: 1 },
      { text: 'Bicarbonate spills with Na⁺ and drags K⁺ out; K⁺ falls', direction: -1 },
      { text: 'The alkalosis is maintained until chloride is replaced', direction: 0 },
    ],
  },
];

const KEYS = [
  { k: 'Na', label: 'Sodium', unit: 'mmol/L', get: (e: any) => e.plasma.Na, d: 0, lo: 135, hi: 145 },
  { k: 'K', label: 'Potassium', unit: 'mmol/L', get: (e: any) => e.plasma.K, d: 1, lo: 3.5, hi: 5.0 },
  { k: 'HCO3', label: 'Bicarbonate', unit: 'mmol/L', get: (e: any) => e.plasma.HCO3, d: 0, lo: 22, hi: 28 },
  { k: 'pH', label: 'pH', unit: '', get: (e: any) => e.plasma.pH, d: 2, lo: 7.35, hi: 7.45 },
  { k: 'MAP', label: 'Mean BP', unit: 'mmHg', get: (e: any) => e.reg.MAP, d: 0, lo: 80, hi: 100 },
  { k: 'creat', label: 'Creatinine', unit: 'µmol/L', get: (e: any) => si.creat(e.body.creat), d: 0, lo: 50, hi: 100 },
  { k: 'uv', label: 'Urine volume', unit: 'L/d', get: (e: any) => e.kidney.urine.volumePerDay, d: 1, lo: 0.8, hi: 2.5 },
  { k: 'uosm', label: 'Urine osmolality', unit: 'mOsm/kg', get: (e: any) => e.kidney.urine.osm, d: 0, lo: 300, hi: 900 },
];

export default function WhatIf({ query }: { query: URLSearchParams }) {
  void query;
  const [idx, setIdx] = useState(0);
  const lever = LEVERS[idx];
  const base = useSteady(makeParams(), 40);
  const after = useSteady(makeParams(lever.patch), 40);
  const busy = base.busy || after.busy;

  return (
    <div>
      <PageHead
        path="/whatif"
        lede="Pull one lever and follow it through. Each change sets off a chain of compensations, and the body arrives somewhere new — read the before and after side by side, and the mechanism that connects them."
      />
      <div class="btn-row" style={{ marginBottom: 12 }}>
        {LEVERS.map((l, i) => (
          <button key={l.id} class={i === idx ? 'active' : ''} onClick={() => setIdx(i)}>{l.label}</button>
        ))}
      </div>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Before → after" note="The steady state on a normal diet, and after the change settles.">
            <Busy on={busy} />
            {base.ev && after.ev && (
              <div class="readout-grid">
                {KEYS.map((key) => {
                  const b = key.get(base.ev);
                  const a = key.get(after.ev);
                  return (
                    <Readout
                      key={key.k}
                      label={key.label}
                      value={a}
                      digits={key.d}
                      unit={key.unit}
                      tone={toneFor(a, key.lo, key.hi)}
                      delta={a - b}
                      deltaDigits={key.d}
                      refRange={`was ${b.toFixed(key.d)}`}
                    />
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
        <div>
          <Panel title="The chain of events">
            <Chain steps={lever.chain} />
          </Panel>
          <Panel title="Read it as a loop">
            <p class="muted" style={{ fontSize: '0.9rem', marginTop: 0, lineHeight: 1.7, marginBottom: 0 }}>
              Almost every lever here ends in a new steady state, not a runaway — because the kidney's regulators (renin–angiotensin–aldosterone, ADH, pressure natriuresis, tubuloglomerular feedback) act against the change until excretion again matches intake. What moves in the end is usually a volume or a pressure, held at a small offset that keeps the balance. The disturbances that do not settle — the ones that kill — are the ones that outrun these loops.
            </p>
          </Panel>
        </div>
      </div>
      <Related paths={['/sandbox', '/break', '/raas', '/sodium', '/potassium', '/acid-base']} />
    </div>
  );
}
