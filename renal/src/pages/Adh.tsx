import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related, Toggle } from '../ui/page';
import { Panel, Readout, Slider, Chain, Sources, Predict, LineChart, toneFor, type Series } from '../ui/kit';
import { EquationCard } from '../ui/EquationCard';
import { osmoregulation, OSMO_DEFAULT, urineVolume, type OsmoInput } from '../sim/osmoregulation';
import { nephronRun } from '../sim/nephron';
import { si } from '../units';
import { useMode } from '../ui/mode';

const CASES: { label: string; patch: Partial<OsmoInput>; explain: string }[] = [
  { label: 'Water load', patch: { effOsm: 272 }, explain: 'Below the threshold ADH is switched off entirely and the urine becomes maximally dilute. The diuresis peaks 90–120 min later, once the ADH already circulating has been cleared.' },
  { label: 'Water deprivation', patch: { effOsm: 298 }, explain: 'ADH rises steeply and the urine concentrates — but ADH can only stop further loss. Replacing a deficit needs drinking, which is why thirst matters more here.' },
  { label: 'Volume depletion (10%)', patch: { eabv: 0.88, effOsm: 283 }, explain: 'The baroreceptor limb lowers the osmotic threshold and steepens the slope: ADH stays on even though osmolality is normal or low. This is how hypovolaemia causes hyponatraemia.' },
  { label: 'SIADH', patch: { autonomous: 5 }, explain: 'ADH is fixed regardless of osmolality: water is retained until dilution stops, and the urine stays inappropriately concentrated.' },
  { label: 'Central diabetes insipidus', patch: { centralDI: 1, effOsm: 292 }, explain: 'No ADH: maximally dilute urine at any osmolality. Thirst keeps the plasma sodium near normal as long as water is available.' },
  { label: 'Nausea / pain / post-operative', patch: { nonosmotic: 0.7 }, explain: 'Nausea is the most powerful non-osmotic stimulus known (up to 500-fold). Hypotonic fluids given after surgery are dangerous for this reason.' },
  { label: 'Pregnancy (reset osmostat)', patch: { osmostatShift: -10 }, explain: 'The whole curve shifts left: ADH and thirst defend a plasma sodium about 5 mmol/L lower, and do so normally.' },
  { label: 'Adrenal insufficiency', patch: { glucocorticoid: 0 }, explain: 'Cortisol restrains ADH release; without it ADH persists and water is retained — a cause of hyponatraemia with a normal aldosterone.' },
];

export default function Adh() {
  const { mode } = useMode();
  const [s, setS] = useState<OsmoInput>(OSMO_DEFAULT);
  const [solute, setSolute] = useState(800);
  const up = (p: Partial<OsmoInput>) => setS({ ...s, ...p });
  const r = osmoregulation(s);

  // The nephron model, driven by this ADH level, gives the urine that follows.
  const neph = useMemo(
    () => nephronRun({ hormones: { adh: r.adh, aqp2: r.aqp2 }, patch: { adhAutonomous: r.adh } }),
    [r.adh, r.aqp2],
  );
  const flow = Math.max(neph.urineOut.water, 0.02);
  const uosmModel = Math.min(1400, ((neph.urineOut.Na + neph.urineOut.K + neph.urineOut.Cl + neph.urineOut.urea + neph.urineOut.NH4 + neph.urineOut.HCO3 + neph.urineOut.Pi * 1.8) / flow) * 1000);
  const volume = urineVolume(solute, uosmModel);

  // The two response curves, drawn across the physiological range of osmolality.
  const curves = useMemo(() => {
    const adh: Series['points'] = [];
    const thirst: Series['points'] = [];
    const uosm: Series['points'] = [];
    for (let o = 265; o <= 310; o += 0.5) {
      const q = osmoregulation({ ...s, effOsm: o });
      adh.push({ x: o, y: q.adh });
      thirst.push({ x: o, y: q.thirst });
      uosm.push({ x: o, y: Math.min(1400, 60 + 1340 * q.aqp2) / 100 });
    }
    return { adh, thirst, uosm };
  }, [s]);

  /** the plasma Na+ that this tonicity implies, at a normal glucose */
  const naFromOsm = (s.effOsm - 5.3) / 2;

  return (
    <div>
      <PageHead
        path="/adh"
        lede="Osmoreceptors sense a 1% change in tonicity and set two effectors: ADH, which decides how much water the kidney keeps, and thirst, which decides how much is drunk. Move the osmolality along the curve, add a volume stimulus or a drug, and watch the urine follow."
      />
      <WhatIf
        options={CASES.map((c) => ({ label: c.label, explain: c.explain }))}
        onApply={(o) => setS({ ...OSMO_DEFAULT, ...CASES.find((c) => c.label === o.label)!.patch })}
        onReset={() => setS(OSMO_DEFAULT)}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="The stimulus">
            <Slider label="Effective osmolality (tonicity)" value={s.effOsm} min={260} max={320} step={0.5} unit="mOsm/kg" onInput={(v) => up({ effOsm: v })} normal={285} hint={`Plasma Na⁺ ≈ ${naFromOsm.toFixed(0)} mmol/L`} />
            <Slider label="Effective circulating volume" value={s.eabv} min={0.7} max={1.15} step={0.01} unit="× normal" onInput={(v) => up({ eabv: v })} normal={1} hint="the baroreceptor limb: insensitive until pressure falls, then powerful" />
            <Slider label="Osmostat shift" value={s.osmostatShift} min={-15} max={15} step={1} unit="mOsm/kg" onInput={(v) => up({ osmostatShift: v })} hint="pregnancy ≈ −10; reset osmostat in chronic illness" />
          </Panel>
          <Panel title="Interference">
            <Slider label="Non-osmotic stimulus (nausea, pain, drugs)" value={s.nonosmotic} min={0} max={1} step={0.05} unit="" onInput={(v) => up({ nonosmotic: v })} />
            <Slider label="Autonomous ADH (SIADH)" value={s.autonomous} min={0} max={10} step={0.5} unit="pmol/L" format={(v) => si.adh(v).toFixed(1)} onInput={(v) => up({ autonomous: v })} />
            <Slider label="Loss of ADH secretion (central DI)" value={s.centralDI} min={0} max={1} step={0.05} unit="" onInput={(v) => up({ centralDI: v })} />
            <Toggle label="Adrenal insufficiency (no cortisol restraint)" checked={s.glucocorticoid === 0} onChange={(v) => up({ glucocorticoid: v ? 0 : 1 })} />
          </Panel>
          <Panel title="Result">
            <div class="readout-grid">
              <Readout label="Plasma ADH" value={si.adh(r.adh)} digits={1} unit="pmol/L" tone={toneFor(si.adh(r.adh), 0.5, 5)} />
              <Readout label="Collecting-duct permeability" value={r.aqp2 * 100} unit="% of maximal" />
              <Readout label="Urine osmolality" value={uosmModel} unit="mOsm/kg" tone={toneFor(uosmModel, 100, 1000)} />
              <Readout label="Urine volume" value={volume} digits={2} unit="L/day" tone={volume > 3 ? 'high' : volume < 0.5 ? 'low' : 'normal'} />
              <Readout label="Thirst (extra water drunk)" value={r.thirst} digits={2} unit="L/day" />
              <Readout label="ADH threshold" value={r.threshold} unit="mOsm/kg" />
              {mode === 'quantitative' && <Readout label="Osmotic component" value={si.adh(r.osmotic)} digits={1} unit="pmol/L" />}
              {mode === 'quantitative' && <Readout label="Baroreceptor component" value={si.adh(r.baro)} digits={1} unit="pmol/L" />}
            </div>
          </Panel>
        </div>
        <div>
          <Panel title="The two response curves" note="ADH rises linearly above its threshold; thirst has a threshold a few mOsm/kg higher and then climbs steeply, which is why it, not ADH, is the final defence against hypernatraemia. The vertical line is the current osmolality. Volume depletion shifts both curves left and steepens them.">
            <LineChart
              xLabel="effective plasma osmolality (mOsm/kg)"
              series={[
                { label: 'ADH (pmol/L)', points: curves.adh.map((p) => ({ x: p.x, y: si.adh(p.y) })), color: '#5ecfba' },
                { label: 'Thirst (L/day ÷ 4)', points: curves.thirst.map((p) => ({ x: p.x, y: p.y / 4 })), color: '#f2b134' },
                { label: 'Urine osmolality ÷ 100', points: curves.uosm, color: '#6aa9e8', dashed: true },
              ]}
              yMin={0}
              marker={s.effOsm}
              height={250}
              bands={[{ from: 0, to: 0.5, label: 'ADH absent: maximally dilute urine', color: '#6aa9e820' }]}
            />
          </Panel>
          <div class="grid grid-2">
            <Panel title="Solute load sets the volume too" note="Rose Table 9-2: at a fixed ADH, urine volume is solute ÷ osmolality. This is why restricting salt and protein helps in diabetes insipidus, and why giving them helps in SIADH.">
              <Slider label="Solute excretion" value={solute} min={200} max={1400} step={50} unit="mOsm/day" onInput={setSolute} normal={800} />
              <div class="readout-grid">
                <Readout label="At this ADH" value={volume} digits={2} unit="L/day" />
                <Readout label="If ADH were absent (80)" value={urineVolume(solute, 80)} digits={1} unit="L/day" />
                <Readout label="At maximal ADH (1200)" value={urineVolume(solute, 1200)} digits={2} unit="L/day" />
              </div>
            </Panel>
            <Panel title="From receptor to water channel">
              <Chain
                steps={[
                  { text: 'Osmoreceptor cell shrinks (1% rise in tonicity)' },
                  { text: 'ADH released from the posterior pituitary (half-life 15–20 min)' },
                  { text: 'V2 receptor → Gs → cAMP → protein kinase A' },
                  { text: 'Aquaporin-2 vesicles fuse with the apical membrane' },
                  { text: 'Water leaves the lumen, exits via AQP3/4: concentrated urine', direction: 1 },
                ]}
              />
            </Panel>
          </div>
          <Panel title="Two defences, not one">
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th />
                    <th>Too much water (hypo-osmolality)</th>
                    <th>Too little water (hyper-osmolality)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Main defence</th>
                    <td>Excreting water (ADH suppressed)</td>
                    <td>Drinking (thirst)</td>
                  </tr>
                  <tr>
                    <th scope="row">Capacity</th>
                    <td>10–20 L/day</td>
                    <td>Limited only by access to water</td>
                  </tr>
                  <tr>
                    <th scope="row">So it fails when</th>
                    <td>ADH cannot be suppressed, delivery to the diluting segment is low, or solute intake is tiny</td>
                    <td>Thirst is impaired or water is out of reach (infants, the obtunded, the restrained)</td>
                  </tr>
                  <tr>
                    <th scope="row">Result</th>
                    <td>Hyponatraemia</td>
                    <td>Hypernatraemia</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
      <div class="grid grid-2">
        <Predict
          question="A patient with complete central diabetes insipidus passes 10 L/day. Their plasma sodium is 141. Why is it not high?"
          options={['Some ADH remains', 'Thirst has matched intake to output', 'The kidney retains sodium', 'The urine is concentrated']}
          correct={1}
          explanation="ADH can only stop further loss; a deficit must be drunk. Hypernatraemia in diabetes insipidus means thirst or access to water has failed — which is why it appears when the patient is nil by mouth or unconscious."
        />
        <Predict
          question="Why are hypotonic fluids risky after surgery?"
          options={['They dilute the blood directly', 'Pain and nausea keep ADH switched on, so the water cannot be excreted', 'They cause sodium loss', 'They raise the GFR']}
          correct={1}
          explanation="Post-operative ADH is non-osmotic and can persist for days. Water given then is retained, and hospital-acquired hyponatraemia follows — the reason isotonic fluid is now the default maintenance fluid."
        />
      </div>
      <div class="grid grid-2">
        <EquationCard eq="posm" compact />
        <EquationCard eq="waterdeficit" compact />
      </div>
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>Plasma osmolality sits at 275–290 mOsm/kg. Above a threshold of ~280 ADH rises linearly; thirst starts a few mOsm/kg higher. Urine osmolality can range from 40–100 to 900–1400.</p>}
          why={<p>Osmoreceptors shrink or swell with effective osmolality and change their firing. ADH acts through V2 receptors and aquaporin-2 to make the collecting duct permeable; water then follows the medullary gradient.</p>}
          change={<p>Raise tonicity: ADH and thirst rise, urine concentrates, water is retained and drunk. Lower it: ADH switches off and up to 10–20 L/day of dilute urine is passed. Volume depletion overrides both, resetting the threshold downwards.</p>}
          abnormal={<p>No ADH (central DI), no response (nephrogenic DI), or ADH that cannot be suppressed (SIADH, hypovolaemia, nausea, adrenal insufficiency). Solute intake sets the urine volume whenever ADH is fixed.</p>}
          clinical={<p>Hyponatraemia means impaired water excretion; hypernatraemia means impaired thirst or access. Copeptin has largely replaced measuring ADH when telling central DI from primary polydipsia.</p>}
        />
        <Sources cite={{ rose: [6, 9], evidence: 'physiology', refs: ['robertson1976', 'knepper2015', 'fenske2018', 'christcrain2019'] }} />
      </Panel>
      <Related paths={['/urine-osmolality', '/free-water', '/countercurrent', '/hyponatremia', '/water-disorders', '/body-water']} />
    </div>
  );
}
