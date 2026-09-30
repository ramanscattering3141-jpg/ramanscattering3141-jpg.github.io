import { useState } from 'preact/hooks';
import { PageHead, Related } from '../ui/page';
import { Panel, Readout, Slider, Sources, toneFor } from '../ui/kit';
import { acidBase } from '../engine/body';
import { describeAcidBase } from '../engine/simulate';

// A rule-based interpreter: it takes the numbers a learner would be handed and applies the same
// arithmetic the book teaches — anion gap, the delta ratio, Winter's expectation, the tonicity
// correction — rather than running the physiology engine.

interface Field {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  normal: number;
  digits?: number;
}

const FIELDS: Field[] = [
  { key: 'Na', label: 'Sodium', min: 100, max: 175, step: 1, unit: 'mmol/L', normal: 140 },
  { key: 'K', label: 'Potassium', min: 1.5, max: 9, step: 0.1, unit: 'mmol/L', normal: 4.2, digits: 1 },
  { key: 'Cl', label: 'Chloride', min: 70, max: 130, step: 1, unit: 'mmol/L', normal: 104 },
  { key: 'HCO3', label: 'Bicarbonate', min: 3, max: 50, step: 1, unit: 'mmol/L', normal: 24 },
  { key: 'PCO2', label: 'PCO₂', min: 10, max: 90, step: 1, unit: 'mmHg', normal: 40 },
  { key: 'albumin', label: 'Albumin', min: 10, max: 55, step: 1, unit: 'g/L', normal: 40 },
  { key: 'glucose', label: 'Glucose', min: 2, max: 60, step: 0.5, unit: 'mmol/L', normal: 5, digits: 1 },
];

export default function LabExplorer({ query }: { query: URLSearchParams }) {
  void query;
  const [v, setV] = useState<Record<string, number>>(() => Object.fromEntries(FIELDS.map((f) => [f.key, f.normal])));
  const set = (k: string, x: number) => setV((s) => ({ ...s, [k]: x }));

  const { Na, K, Cl, HCO3, PCO2, albumin, glucose } = v;
  // Anion gap, corrected for albumin (2.5 mmol/L per 10 g/L below 40).
  const ag = Na - Cl - HCO3;
  const agCorr = ag + 0.25 * (40 - albumin);
  const { pH } = acidBase(HCO3, PCO2);
  const ab = describeAcidBase(HCO3, PCO2, pH, agCorr);
  // Delta ratio for a high-gap acidosis.
  const deltaGap = agCorr - 12;
  const deltaHco3 = 24 - HCO3;
  const deltaRatio = deltaHco3 > 0 ? deltaGap / deltaHco3 : NaN;
  // Tonicity-corrected sodium (add 1.6 mmol/L per 5.6 mmol/L glucose above 5).
  const naCorr = Na + 1.6 * Math.max(0, (glucose - 5) / 5.6);
  const effOsm = 2 * Na + glucose;

  const highGap = agCorr > 16 && HCO3 < 22;

  return (
    <div>
      <PageHead
        path="/labs"
        lede="Enter a set of results and read them the way the book does — the anion gap and its albumin correction, the delta ratio, the sodium corrected for glucose, and Winter's expected PCO₂. The interpreter shows the arithmetic, not a verdict from nowhere, so you can see how each conclusion is reached."
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="The results">
            {FIELDS.map((f) => (
              <Slider key={f.key} label={f.label} value={v[f.key]} min={f.min} max={f.max} step={f.step} unit={f.unit} normal={f.normal} onInput={(x) => set(f.key, x)} />
            ))}
          </Panel>
        </div>
        <div>
          <Panel title="Acid–base">
            <div class="readout-grid">
              <Readout label="pH" value={pH} digits={2} tone={toneFor(pH, 7.35, 7.45)} />
              <Readout label="Anion gap" value={ag} digits={0} unit="mmol/L" tone={ag > 12 ? 'high' : 'normal'} />
              <Readout label="Albumin-corrected AG" value={agCorr} digits={0} unit="mmol/L" tone={agCorr > 16 ? 'high' : 'normal'} />
            </div>
            <p class="note" style={{ marginTop: 8, marginBottom: 0 }}>
              <strong>{ab.primary}.</strong>{ab.compensation ? ` ${ab.compensation}.` : ''}
            </p>
          </Panel>
          {highGap && (
            <Panel title="Delta ratio (high-gap acidosis)">
              <div class="readout-grid">
                <Readout label="Δ gap ÷ Δ HCO₃⁻" value={deltaRatio} digits={1} tone={deltaRatio < 1 || deltaRatio > 2 ? 'high' : 'normal'} />
              </div>
              <p class="note" style={{ marginTop: 6, marginBottom: 0 }}>
                {deltaRatio < 1
                  ? 'Below 1: a coexisting normal-gap acidosis is consuming extra bicarbonate.'
                  : deltaRatio > 2
                    ? 'Above 2: the bicarbonate is higher than the gap alone would explain — a coexisting metabolic alkalosis, or a chronic respiratory acidosis.'
                    : 'Between 1 and 2: a pure high-gap metabolic acidosis.'}
              </p>
            </Panel>
          )}
          <Panel title="Sodium & tonicity">
            <div class="readout-grid">
              <Readout label="Measured sodium" value={Na} digits={0} unit="mmol/L" tone={toneFor(Na, 135, 145)} />
              <Readout label="Glucose-corrected sodium" value={naCorr} digits={0} unit="mmol/L" tone={toneFor(naCorr, 135, 145)} />
              <Readout label="Effective osmolality" value={effOsm} digits={0} unit="mOsm/kg" tone={effOsm > 295 ? 'high' : effOsm < 275 ? 'low' : 'normal'} />
            </div>
            <p class="note" style={{ marginTop: 6, marginBottom: 0 }}>
              {glucose > 8
                ? 'Hyperglycaemia pulls water out of cells and dilutes the sodium; the corrected value is what the sodium would be at a normal glucose.'
                : naCorr < 135
                  ? 'True hyponatraemia — assess the volume status and the urine to find the cause.'
                  : naCorr > 145
                    ? 'Hypernatraemia — a water deficit; check access to water and the urine osmolality.'
                    : 'Sodium is normal.'}
            </p>
          </Panel>
          <Panel title="Potassium">
            <div class="readout-grid">
              <Readout label="Potassium" value={K} digits={1} unit="mmol/L" tone={toneFor(K, 3.5, 5.0, [2.8, 6.2])} />
            </div>
            <p class="note" style={{ marginTop: 6, marginBottom: 0 }}>
              {K < 3.5
                ? 'Hypokalaemia — separate a shift from a true deficit, then find the renal or gut loss; check magnesium.'
                : K > 5.2
                  ? 'Hyperkalaemia — exclude artefact and a shift, then think about excretion (GFR, aldosterone, drugs).'
                  : 'Potassium is normal.'}
            </p>
            <Sources cite={{ rose: [17, 19, 23, 27], evidence: 'reasoning' }} />
          </Panel>
        </div>
      </div>
      <Related paths={['/acid-base', '/metabolic-acidosis', '/mixed', '/hyponatremia', '/equations', '/sandbox']} />
    </div>
  );
}
