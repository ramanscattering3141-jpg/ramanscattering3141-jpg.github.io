import { useState } from 'preact/hooks';
import { PageHead, Related, Busy } from '../ui/page';
import { Panel, Readout, Slider, toneFor } from '../ui/kit';
import { makeParams, useSteady } from '../sim/hooks';
import { si } from '../units';
import type { ParamPatch } from '../engine/types';
import { decodeState } from '../router';

interface Control {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  normal: number;
  path?: 'drug' | 'transporter';
  /** engine value = slider value × scale (e.g. glucose shown in mmol/L, engine in mg/dL) */
  scale?: number;
}

const GROUPS: { title: string; controls: Control[] }[] = [
  {
    title: 'Intake',
    controls: [
      { key: 'naIntake', label: 'Sodium', min: 0, max: 400, step: 10, unit: 'mmol/d', normal: 150 },
      { key: 'kIntake', label: 'Potassium', min: 10, max: 400, step: 10, unit: 'mmol/d', normal: 80 },
      { key: 'waterIntake', label: 'Water', min: 0.3, max: 20, step: 0.1, unit: 'L/d', normal: 2 },
      { key: 'proteinIntake', label: 'Protein', min: 20, max: 200, step: 10, unit: 'g/d', normal: 80 },
    ],
  },
  {
    title: 'Losses',
    controls: [
      { key: 'vomiting', label: 'Vomiting', min: 0, max: 3, step: 0.1, unit: 'L/d', normal: 0 },
      { key: 'diarrhea', label: 'Diarrhoea', min: 0, max: 4, step: 0.1, unit: 'L/d', normal: 0 },
      { key: 'insensible', label: 'Insensible / sweat', min: 0.5, max: 5, step: 0.1, unit: 'L/d', normal: 0.9 },
    ],
  },
  {
    title: 'Kidney & circulation',
    controls: [
      { key: 'nephronFraction', label: 'Nephron mass', min: 0.08, max: 1, step: 0.02, normal: 1 },
      { key: 'cardiacFunction', label: 'Cardiac function', min: 0.4, max: 1.1, step: 0.05, normal: 1 },
      { key: 'tubularInjury', label: 'Tubular injury', min: 0, max: 0.9, step: 0.05, normal: 0 },
    ],
  },
  {
    title: 'Hormones',
    controls: [
      { key: 'aldoAutonomous', label: 'Autonomous aldosterone', min: 0, max: 5, step: 0.5, unit: '×', normal: 0 },
      { key: 'adhAutonomous', label: 'Autonomous ADH (SIADH)', min: 0, max: 6, step: 0.5, unit: 'pg/mL', normal: 0 },
      { key: 'aldoSynthesis', label: 'Aldosterone synthesis', min: 0, max: 1, step: 0.1, unit: '×', normal: 1 },
    ],
  },
  {
    title: 'Metabolic',
    controls: [
      { key: 'glucose', label: 'Plasma glucose (held)', min: 3, max: 45, step: 0.5, unit: 'mmol/L', normal: 5.5, scale: 18 },
      { key: 'ketoAcid', label: 'Ketoacid production', min: 0, max: 20, step: 1, unit: 'mmol/h', normal: 0 },
    ],
  },
  {
    title: 'Drugs',
    controls: [
      { key: 'furosemide', label: 'Loop diuretic', min: 0, max: 1, step: 0.1, normal: 0, path: 'drug' },
      { key: 'thiazide', label: 'Thiazide', min: 0, max: 1, step: 0.1, normal: 0, path: 'drug' },
      { key: 'spironolactone', label: 'Spironolactone', min: 0, max: 1, step: 0.1, normal: 0, path: 'drug' },
      { key: 'acei', label: 'ACE inhibitor', min: 0, max: 1, step: 0.1, normal: 0, path: 'drug' },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.controls);

const PRESETS: { label: string; patch: Record<string, number> }[] = [
  { label: 'Normal', patch: {} },
  { label: 'Vomiting', patch: { vomiting: 1.2, waterIntake: 1.2, naIntake: 60 } },
  { label: 'Heart failure', patch: { cardiacFunction: 0.5, naIntake: 200 } },
  { label: 'CKD (GFR ~25)', patch: { nephronFraction: 0.18 } },
  { label: 'Primary aldosteronism', patch: { aldoAutonomous: 3 } },
  { label: 'SIADH', patch: { adhAutonomous: 5, waterIntake: 2.2, naIntake: 100 } },
  { label: 'Loop diuretic', patch: { furosemide: 0.7 } },
];

function buildPatch(vals: Record<string, number>): ParamPatch {
  const patch: Record<string, unknown> = {};
  const drugs: Record<string, number> = {};
  for (const c of ALL) {
    const v = vals[c.key];
    if (v === undefined || v === c.normal) continue;
    if (c.path === 'drug') drugs[c.key] = v;
    else patch[c.key] = v * (c.scale ?? 1);
  }
  if (Object.keys(drugs).length) patch.drugs = drugs;
  return patch as ParamPatch;
}

/** Slider values for a parameter patch (the inverse of buildPatch); unknown keys are ignored. */
function valsFromPatch(patch: Record<string, unknown>): Record<string, number> {
  const drugs = (patch.drugs ?? {}) as Record<string, number>;
  return Object.fromEntries(
    ALL.map((c) => {
      const raw = c.path === 'drug' ? drugs[c.key] : (patch[c.key] as number | undefined);
      if (typeof raw !== 'number') return [c.key, c.normal];
      const v = raw / (c.scale ?? 1);
      return [c.key, Math.min(c.max, Math.max(c.min, Math.round(v / c.step) * c.step))];
    }),
  );
}

export default function Sandbox({ query }: { query: URLSearchParams }) {
  // A clinical case can open the sandbox pre-set to its patient: #/sandbox?s=<encoded {patch, label}>.
  const shared = decodeState<{ patch: Record<string, unknown>; label?: string }>(query.get('s'));
  const [loadedFrom, setLoadedFrom] = useState(shared?.label);
  const [vals, setVals] = useState<Record<string, number>>(() => (shared?.patch ? valsFromPatch(shared.patch) : Object.fromEntries(ALL.map((c) => [c.key, c.normal]))));
  const set = (k: string, v: number) => setVals((s) => ({ ...s, [k]: v }));
  const applyPreset = (patch: Record<string, number>) => {
    setLoadedFrom(undefined);
    setVals(Object.fromEntries(ALL.map((c) => [c.key, patch[c.key] ?? c.normal])));
  };
  const run = useSteady(makeParams(buildPatch(vals)), 40);
  const e = run.ev;
  const changed = ALL.filter((c) => vals[c.key] !== c.normal).length;

  return (
    <div>
      <PageHead
        path="/sandbox"
        lede="The whole model, open. Set any combination of intake, losses, kidney, hormones and drugs, and read the steady state the body settles into. Nothing here is a fixed lesson — it is the same engine every other page drives, with all the dials exposed at once."
      />
      {loadedFrom && (
        <p class="note">
          <strong>Loaded from the case “{loadedFrom}”.</strong> Every dial below is set to that patient. Change any of them to ask what would happen next.
        </p>
      )}
      <div class="btn-row" style={{ marginBottom: 12 }}>
        {PRESETS.map((p) => (
          <button key={p.label} onClick={() => applyPreset(p.patch)}>{p.label}</button>
        ))}
        {changed > 0 && <button class="ghost" onClick={() => applyPreset({})}>Reset ({changed} changed)</button>}
      </div>
      <div class="grid grid-sidebar">
        <div>
          {GROUPS.map((g) => (
            <Panel key={g.title} title={g.title}>
              {g.controls.map((c) => (
                <Slider
                  key={c.key}
                  label={c.label}
                  value={vals[c.key]}
                  min={c.min}
                  max={c.max}
                  step={c.step}
                  unit={c.unit}
                  normal={c.normal}
                  onInput={(v) => set(c.key, v)}
                />
              ))}
            </Panel>
          ))}
        </div>
        <div>
          <Panel title="Steady state" note="Where the body settles after weeks on these settings.">
            <Busy on={run.busy} />
            {e && (
              <>
                <h4 style={{ margin: '4px 0 6px', fontSize: '0.8rem', color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Plasma</h4>
                <div class="readout-grid">
                  <Readout label="Sodium" value={e.plasma.Na} digits={0} unit="mmol/L" tone={toneFor(e.plasma.Na, 135, 145)} />
                  <Readout label="Potassium" value={e.plasma.K} digits={1} unit="mmol/L" tone={toneFor(e.plasma.K, 3.5, 5.0, [2.8, 6.2])} />
                  <Readout label="Chloride" value={e.plasma.Cl} digits={0} unit="mmol/L" />
                  <Readout label="Bicarbonate" value={e.plasma.HCO3} digits={0} unit="mmol/L" tone={toneFor(e.plasma.HCO3, 22, 28)} />
                  <Readout label="pH" value={e.plasma.pH} digits={2} tone={toneFor(e.plasma.pH, 7.35, 7.45)} />
                  <Readout label="Anion gap" value={e.plasma.anionGap} digits={0} unit="mmol/L" />
                  <Readout label="Creatinine" value={si.creat(e.body.creat)} digits={0} unit="µmol/L" tone={e.body.creat > 1.3 ? 'high' : 'normal'} />
                  <Readout label="eGFR" value={e.derived.eGFR} digits={0} unit="mL/min" tone={e.derived.eGFR < 60 ? 'high' : 'normal'} />
                  <Readout label="Urea" value={si.urea(e.body.bun)} digits={1} unit="mmol/L" />
                </div>
                <h4 style={{ margin: '12px 0 6px', fontSize: '0.8rem', color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Volume & pressure</h4>
                <div class="readout-grid">
                  <Readout label="Mean BP" value={e.reg.MAP} digits={0} unit="mmHg" tone={e.reg.MAP > 105 ? 'high' : e.reg.MAP < 80 ? 'low' : 'normal'} />
                  <Readout label="ECF volume" value={e.derived.ecfLiters} digits={1} unit="L" tone={e.derived.ecfLiters > 17 ? 'high' : 'normal'} />
                  <Readout label="Oedema" value={e.derived.edemaLiters} digits={1} unit="L" tone={e.derived.edemaLiters > 1 ? 'high' : 'normal'} />
                </div>
                <h4 style={{ margin: '12px 0 6px', fontSize: '0.8rem', color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Urine</h4>
                <div class="readout-grid">
                  <Readout label="Volume" value={e.kidney.urine.volumePerDay} digits={1} unit="L/d" />
                  <Readout label="Osmolality" value={e.kidney.urine.osm} digits={0} unit="mOsm/kg" />
                  <Readout label="Sodium" value={e.kidney.urine.Na} digits={0} unit="mmol/L" />
                  <Readout label="Potassium" value={e.kidney.urine.exc.K} digits={0} unit="mmol/d" />
                  <Readout label="pH" value={e.kidney.urine.pH} digits={1} />
                  <Readout label="FENa" value={e.derived.FENa} digits={1} unit="%" />
                </div>
                <h4 style={{ margin: '12px 0 6px', fontSize: '0.8rem', color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hormones (× normal)</h4>
                <div class="readout-grid">
                  <Readout label="Renin" value={e.reg.hormones.renin} digits={2} />
                  <Readout label="Aldosterone" value={e.reg.hormones.aldo} digits={2} />
                  <Readout label="ADH" value={e.reg.hormones.adh} digits={2} unit="pg/mL" />
                </div>
                {e.derived.acidBase.label && (
                  <p class="note" style={{ marginTop: 10, marginBottom: 0 }}>
                    <strong>Acid–base:</strong> {e.derived.acidBase.label}{e.derived.acidBase.compensation ? ` — ${e.derived.acidBase.compensation}` : ''}.
                  </p>
                )}
              </>
            )}
          </Panel>
        </div>
      </div>
      <Related paths={['/break', '/whatif', '/nephron', '/transport', '/equations', '/labs']} />
    </div>
  );
}
