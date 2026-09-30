import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related, Busy, Toggle } from '../ui/page';
import { navigate } from '../router';
import { Panel, Readout, Slider, Sources, Predict, BarRow, Expand, LineChart, type Series } from '../ui/kit';
import { EquationCard } from '../ui/EquationCard';
import { makeParams, useStep } from '../sim/hooks';
import type { ParamPatch } from '../engine/types';
import { si } from '../units';

/**
 * Urine chemistries are read in a kidney that is *not* in balance — that is what makes them
 * informative. In a steady state excretion must equal intake, so a FENa measured weeks into an
 * illness only reports the diet. Every scenario here therefore settles the patient first and then
 * applies the insult, and the learner moves the clock.
 *
 * `truth` records what is actually wrong in the simulation, so the page can score each index
 * against it rather than asserting that the indices work.
 */
interface Case {
  label: string;
  patch: ParamPatch;
  truth: { volume: 'low' | 'normal' | 'high'; tubules: 'intact' | 'injured'; note: string };
  /** the moment in the illness where the teaching point is clearest */
  atDay?: number;
}

const CASES: Case[] = [
  { label: 'Normal', patch: {}, truth: { volume: 'normal', tubules: 'intact', note: 'Nothing is wrong. The urine electrolytes mirror the diet and nothing else.' } },
  {
    label: 'Diarrhoea',
    patch: { diarrhea: 2, waterIntake: 1.2, naIntake: 60 },
    truth: { volume: 'low', tubules: 'intact', note: 'Genuine volume depletion with intact tubules — the case the indices were designed for, and the one in which they work.' },
    atDay: 1,
  },
  {
    label: 'Vomiting (drinking water)',
    patch: { vomiting: 1, waterIntake: 2.5 },
    truth: { volume: 'low', tubules: 'intact', note: 'Volume depleted and alkalotic. Once plasma bicarbonate passes the reabsorptive threshold it spills, and sodium leaves with it — so the urine Na⁺ rises while the kidney is still retaining salt. The urine chloride stays low and gives the truth away.' },
    atDay: 2,
  },
  {
    label: 'Acute tubular necrosis',
    patch: { tubularInjury: 0.75 },
    truth: { volume: 'normal', tubules: 'injured', note: 'Tubules can neither reabsorb sodium nor concentrate the urine.' },
    atDay: 0.25,
  },
  {
    label: 'ATN on heart failure',
    patch: { tubularInjury: 0.7, cardiacFunction: 0.42 },
    truth: { volume: 'low', tubules: 'injured', note: 'Both at once. The volume signal overrides the injury and holds FENa far below 1% — the classic false negative that makes FENa unsafe as a rule.' },
    atDay: 1,
  },
  {
    label: 'Loop diuretic, first dose',
    patch: { drugs: { furosemide: 0.9 } },
    truth: { volume: 'normal', tubules: 'intact', note: 'At the moment the drug acts, FENa is around 5% in a kidney with perfectly normal tubules. Move the clock forward and watch braking undo it within hours.' },
    atDay: 0,
  },
  {
    label: 'Central diabetes insipidus',
    patch: { centralDI: 0.95 },
    truth: { volume: 'normal', tubules: 'intact', note: 'A very large dilute urine dilutes every concentration in it, sodium included — while the daily sodium excretion stays normal.' },
    atDay: 3,
  },
  { label: 'SIADH', patch: { adhAutonomous: 5 }, truth: { volume: 'normal', tubules: 'intact', note: 'Water is retained; sodium handling is untouched, so the urine Na⁺ is not low. That is how it is told from hypovolaemic hyponatraemia.' }, atDay: 3 },
  {
    label: 'Bilateral renal artery stenosis',
    patch: { stenosisL: 0.8, stenosisR: 0.78 },
    truth: { volume: 'normal', tubules: 'intact', note: 'The kidney sees a low pressure although the patient is not dry, and retains sodium anyway. Move the clock past day 2 and the model escapes — sodium excretion returns while the extracellular volume sits high.' },
    atDay: 0.5,
  },
  {
    label: 'Advanced CKD',
    patch: { nephronFraction: 0.13 },
    truth: { volume: 'normal', tubules: 'injured', note: 'The filtered load is a seventh of normal, so the same intake is a much larger fraction of it. FENa reads above 3% in a patient who is in perfect sodium balance.' },
    atDay: 1,
  },
  {
    label: 'Primary aldosteronism',
    patch: { aldoAutonomous: 4 },
    truth: { volume: 'high', tubules: 'intact', note: 'Volume expanded, yet distal sodium reabsorption is driven hard at first and potassium is wasted. By day 3 the kidney escapes and excretion returns to intake.' },
    atDay: 0.25,
  },
];

/** Times offered on the clock, in days. 0 is the instant the insult begins. */
const CLOCK = [0, 0.042, 0.125, 0.25, 0.5, 1, 2, 3, 5, 7, 10, 14];
const clockLabel = (d: number) => (d === 0 ? 'the instant it starts' : d < 1 ? `${Math.round(d * 24)} h` : `day ${d}`);

/** Specific gravity from osmolality, plus whatever heavy solute has been added (Rose ch. 13). */
function specificGravity(uosm: number, glucoseMmolL: number, contrast: boolean) {
  const fromOsm = uosm / 33000; // each 30–35 mOsm/kg adds about 0.001
  const fromGlucose = ((glucoseMmolL * 180) / 1e6) * 0.55; // MW 180, ~6x heavier per particle
  return 1 + fromOsm + fromGlucose + (contrast ? 0.012 : 0); // contrast MW ≈ 550, given in grams
}

export default function UrineChemistry({ query }: { query: URLSearchParams }) {
  // Scenario and clock live in the URL, so a chapter can link straight to the moment that makes
  // its point ("the loop diuretic's first dose", "vomiting on day 2").
  const linked = CASES.findIndex((x) => x.label.toLowerCase().startsWith((query.get('case') ?? '').toLowerCase()) && query.get('case'));
  const [caseIdx, setCaseIdx] = useState(linked >= 0 ? linked : 0);
  const linkedDay = CLOCK.indexOf(Number(query.get('day')));
  const [clock, setClock] = useState(linkedDay >= 0 ? linkedDay : CLOCK.indexOf(CASES[linked >= 0 ? linked : 0].atDay ?? 0));
  const [naIntake, setNaIntake] = useState(150);
  const [contrast, setContrast] = useState(false);
  const [glycosuria, setGlycosuria] = useState(false);
  const c = CASES[caseIdx];
  const day = CLOCK[clock];

  const base = useMemo(() => makeParams({ naIntake }), [naIntake]);
  const sick = useMemo(() => makeParams({ naIntake, ...c.patch }), [naIntake, caseIdx]);
  // One worker job settles the baseline and then runs the insult, so the two never race. The whole
  // fortnight is computed once at half-hourly resolution; moving the clock only indexes into it,
  // so the slider is instant and the early hours — where the teaching happens — are not smoothed
  // away.
  const { points, busy } = useStep(base, sick, 14, 0.021, 60, 1, 0.25);
  const link = (i: number, k: number) => navigate('/urine-chemistry', { case: CASES[i].label, day: String(CLOCK[k]) });

  // The state at the chosen moment. The first trajectory point is the instant of the insult.
  const at = useMemo(() => {
    if (!points || !points.length) return undefined;
    let best = points[0];
    for (const p of points) if (Math.abs(p.day - day) < Math.abs(best.day - day)) best = p;
    return best;
  }, [points, day]);

  return (
    <div>
      <PageHead
        path="/urine-chemistry"
        lede="Urine electrolytes have no normal values — the kidney is supposed to vary them. Each is the answer to one question, and each has a setting in which it answers wrongly. Here the model knows the truth, so you can watch the tests succeed and fail. Note the clock: these numbers are read in a kidney that is not yet in balance, which is exactly why they say anything at all."
      />
      <WhatIf
        options={CASES.map((x) => ({ label: x.label, explain: x.truth.note }))}
        onApply={(o) => {
          const i = CASES.findIndex((x) => x.label === o.label);
          const at = CASES[i].atDay ?? 0;
          const k = CLOCK.indexOf(at) >= 0 ? CLOCK.indexOf(at) : 0;
          setCaseIdx(i);
          setClock(k);
          link(i, k);
        }}
        onReset={() => {
          setCaseIdx(0);
          setClock(0);
          setNaIntake(150);
          link(0, 0);
        }}
        active={c.label}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="The patient" note="Each scenario settles a normal body first, then applies the change. The urine below is whatever this kidney then produces.">
            <Slider
              label="Time since it began"
              value={clock}
              min={0}
              max={CLOCK.length - 1}
              step={1}
              format={() => clockLabel(day)}
              onInput={(v) => {
                setClock(Math.round(v));
                link(caseIdx, Math.round(v));
              }}
              hint="the single most important control on this page"
            />
            <Slider label="Dietary sodium" value={naIntake} min={10} max={400} step={10} unit="mmol/day" onInput={setNaIntake} normal={150} hint="once in balance, excretion must equal this — whatever the disease" />
            <p class="note" style={{ marginBottom: 0 }}>
              <strong>Ground truth:</strong> effective circulating volume is <strong>{c.truth.volume}</strong>; tubules are <strong>{c.truth.tubules}</strong>. {c.truth.note}
            </p>
          </Panel>
          <Panel title={`Urine report — ${clockLabel(day)}`} note="Canadian (SI) units, as a laboratory reports them.">
            <Busy on={busy} />
            {at && (
              <div class="readout-grid">
                <Readout
                  label="Sodium"
                  value={at.urineNa / Math.max(at.urineVolume, 0.01)}
                  digits={0}
                  unit="mmol/L"
                  tone={at.urineNa / Math.max(at.urineVolume, 0.01) < 20 ? 'low' : at.urineNa / Math.max(at.urineVolume, 0.01) > 40 ? 'high' : 'normal'}
                  refRange="no normal value"
                />
                <Readout label="Chloride" value={at.urineCl / Math.max(at.urineVolume, 0.01)} digits={0} unit="mmol/L" tone={at.urineCl / Math.max(at.urineVolume, 0.01) < 20 ? 'low' : 'normal'} />
                <Readout label="Potassium" value={at.urineK / Math.max(at.urineVolume, 0.01)} digits={0} unit="mmol/L" />
                <Readout label="Osmolality" value={at.urineOsm} digits={0} unit="mOsm/kg" tone={at.urineOsm < 350 ? 'low' : at.urineOsm > 700 ? 'high' : 'normal'} />
                <Readout label="pH" value={at.urinePH} digits={2} tone={at.urinePH > 6 ? 'high' : 'normal'} />
                <Readout label="Volume" value={at.urineVolume} digits={2} unit="L/day" tone={at.urineVolume > 3 ? 'high' : at.urineVolume < 0.5 ? 'low' : 'normal'} />
                <Readout label="FENa" value={at.fena} digits={2} unit="%" tone={at.fena < 1 ? 'low' : at.fena > 2 ? 'high' : 'normal'} />
                <Readout label="Na⁺ excreted" value={at.urineNa} digits={0} unit="mmol/day" title="in balance this must equal intake" />
              </div>
            )}
          </Panel>
          <Panel title="The blood at the same moment">
            {at && (
              <div class="readout-grid">
                <Readout label="Sodium" value={at.Na} digits={1} unit="mmol/L" tone={at.Na < 135 ? 'low' : at.Na > 145 ? 'high' : 'normal'} />
                <Readout label="Potassium" value={at.K} digits={2} unit="mmol/L" tone={at.K < 3.5 ? 'low' : at.K > 5.2 ? 'high' : 'normal'} />
                <Readout label="Bicarbonate" value={at.HCO3} digits={1} unit="mmol/L" tone={at.HCO3 < 22 ? 'low' : at.HCO3 > 28 ? 'high' : 'normal'} />
                <Readout label="Creatinine" value={si.creat(at.creat)} digits={0} unit="µmol/L" tone={si.creat(at.creat) > 110 ? 'high' : 'normal'} />
                <Readout label="Extracellular volume" value={at.ecf} digits={1} unit="L" tone={at.ecf < 12.5 ? 'low' : at.ecf > 16 ? 'high' : 'normal'} />
                <Readout label="Cumulative Na⁺ balance" value={at.naBalance} digits={0} unit="mmol" tone={at.naBalance < -80 ? 'low' : at.naBalance > 150 ? 'high' : 'normal'} />
              </div>
            )}
          </Panel>
        </div>
        <div>
          <Panel title="What the tests say, and whether they are right" note="The middle column is the clinical reading of the number. The right is what the simulation knows.">
            {at && (
              <>
                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Test</th>
                        <th>Reads as</th>
                        <th>Correct here?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scoreAll(c, at).map((r) => (
                        <tr key={r.test}>
                          <th scope="row">{r.test}</th>
                          <td>{r.says}</td>
                          <td>{mark(r.result)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(() => {
                  const bad = scoreAll(c, at).filter((r) => r.result === 'no');
                  return bad.length ? (
                    <p class="callout danger" style={{ marginTop: 8 }}>
                      <strong>Misleading here.</strong> {bad.map((b) => b.why).join(' ')} {c.truth.note}
                    </p>
                  ) : (
                    <p class="callout good" style={{ marginTop: 8 }}>
                      At this moment the indices point the right way. Move the clock, or pick a scenario above where they do not.
                    </p>
                  );
                })()}
              </>
            )}
          </Panel>
          <Panel title="How the indices change as the kidney re-equilibrates" note="The reason the clock matters: a FENa read on arrival and the same FENa read a week later are different measurements.">
            <Busy on={busy} />
            {points && (
              <LineChart
                xLabel="days since the insult"
                series={[
                  { label: 'FENa', axis: 'FENa (%)', points: points.map((p) => ({ x: p.day, y: p.fena })), color: 'var(--c-amber)' },
                  { label: 'Urine Na⁺', axis: 'Urine concentration (mmol/L)', points: points.map((p) => ({ x: p.day, y: p.urineNa / Math.max(p.urineVolume, 0.01) })), color: 'var(--c-blue)' },
                  { label: 'Urine Cl⁻', axis: 'Urine concentration (mmol/L)', points: points.map((p) => ({ x: p.day, y: p.urineCl / Math.max(p.urineVolume, 0.01) })), color: 'var(--c-green)' },
                ] as Series[]}
                yMin={0}
                marker={day}
                height={230}
              />
            )}
            <p class="control-hint">
              The two concentrations are divided by 20 so they share an axis with FENa. The dashed marker is the moment shown in the report. The 1% and 2% FENa thresholds sit at 1 and 2 on this axis.
            </p>
          </Panel>
          <Panel title="Sodium against chloride" note="They usually agree, and then chloride adds nothing. Where they part company, the ion that has not been dragged out by a partner is the honest one.">
            {at && (
              <>
                {(() => {
                  const na = at.urineNa / Math.max(at.urineVolume, 0.01);
                  const cl = at.urineCl / Math.max(at.urineVolume, 0.01);
                  const k = at.urineK / Math.max(at.urineVolume, 0.01);
                  return (
                    <>
                      <BarRow label="Urine Na⁺" value={na} max={220} unit=" mmol/L" color="var(--c-blue)" />
                      <BarRow label="Urine Cl⁻" value={cl} max={220} unit=" mmol/L" color="var(--c-green)" />
                      <BarRow label="Urine K⁺" value={k} max={220} unit=" mmol/L" color="var(--c-violet)" />
                      <p class={Math.abs(na - cl) > 15 ? 'callout' : 'control-hint'} style={{ marginTop: 6 }}>
                        {Math.abs(na - cl) > 15
                          ? `They differ by ${Math.abs(na - cl).toFixed(0)} mmol/L. ${
                              na > cl
                                ? `Sodium is leaving with an anion other than chloride — here bicarbonate, at a urine pH of ${at.urinePH.toFixed(1)}. The low chloride is the true volume signal, and it predicts that saline will work.`
                                : 'Chloride is leaving with a cation other than sodium — ammonium, or potassium driven out distally.'
                            }`
                          : `They agree to within ${Math.abs(na - cl).toFixed(0)} mmol/L, so chloride adds nothing here. Rose: the two differ by more than 15 mmol/L in about 30% of hypovolaemic patients.`}
                      </p>
                    </>
                  );
                })()}
              </>
            )}
          </Panel>
          <div class="grid grid-2">
            <Panel title="Concentration is not excretion">
              {at && (
                <div class="readout-grid">
                  <Readout label="Urine Na⁺" value={at.urineNa / Math.max(at.urineVolume, 0.01)} digits={0} unit="mmol/L" />
                  <Readout label="Na⁺ per day" value={at.urineNa} digits={0} unit="mmol/day" />
                  <Readout label="Urine volume" value={at.urineVolume} digits={2} unit="L/day" />
                  <Readout label="Same Na⁺ at 1.5 L/day" value={at.urineNa / 1.5} digits={0} unit="mmol/L" title="what the concentration would read at a normal urine output" />
                </div>
              )}
              <p class="control-hint">Choose central diabetes insipidus: a normal daily sodium excretion reads as a urine Na⁺ near 15 mmol/L simply because it is dissolved in 6 L.</p>
            </Panel>
            <Panel title="Specific gravity versus osmolality">
              <div class="btn-row" style={{ marginBottom: 8 }}>
                <Toggle label="Radiocontrast given" checked={contrast} onChange={setContrast} hint="MW ≈ 550, given in grams: heavy, but few particles" />
                <Toggle label="Heavy glycosuria" checked={glycosuria} onChange={setGlycosuria} hint="MW 180 — about six times heavier per particle than the usual urinary solutes" />
              </div>
              {at && (
                <>
                  <div class="readout-grid">
                    <Readout label="Osmolality" value={at.urineOsm} digits={0} unit="mOsm/kg" />
                    <Readout
                      label="Specific gravity"
                      value={specificGravity(at.urineOsm, glycosuria ? 140 : 0, contrast)}
                      digits={3}
                      tone={contrast || glycosuria ? 'danger' : 'normal'}
                    />
                    <Readout label="Expected for that osmolality" value={1 + at.urineOsm / 33000} digits={3} title="0.001 per 30–35 mOsm/kg" />
                  </div>
                  {(contrast || glycosuria) && (
                    <p class="callout danger" style={{ marginTop: 8 }}>
                      The specific gravity now reads {specificGravity(at.urineOsm, glycosuria ? 140 : 0, contrast).toFixed(3)} while the osmolality is unchanged at {at.urineOsm.toFixed(0)} mOsm/kg. Read as a
                      concentrating test it would suggest a far more concentrated urine than the kidney has actually produced.
                    </p>
                  )}
                </>
              )}
              <p class="control-hint">Specific gravity weighs; osmolality counts. A specific gravity out of proportion means a large molecule is present — glucose, radiocontrast, or high-dose carbenicillin.</p>
            </Panel>
          </div>
        </div>
      </div>
      <div class="grid grid-2">
        <Predict
          question="A vomiting patient looks dry but the urine Na⁺ is 95 mmol/L. Which number settles it?"
          options={['Urine osmolality', 'Urine chloride', 'Urine creatinine', 'Serum aldosterone']}
          correct={1}
          explanation="Bicarbonate is spilling above its reabsorptive threshold and sodium must accompany it. Chloride is still reabsorbed avidly, so a urine Cl⁻ near zero exposes the volume depletion — and predicts a response to saline. Select “Vomiting (drinking water)” and set the clock to day 2."
        />
        <Predict
          question="A loop diuretic is given to someone with entirely normal tubules. What does FENa do at the moment it acts?"
          options={['Stays below 1%', 'Rises to around 5%', 'Falls', 'Nothing — FENa only reflects tubular damage']}
          correct={1}
          explanation="About 5%, then back under 1% within hours as the kidney brakes. FENa measures how much of the filtered sodium is leaving, not whether tubules are injured — which is why a diuretic makes it uninterpretable. Select “Loop diuretic, first dose” and sweep the clock."
        />
      </div>
      <Expand summary="Rose’s list of where each urine test misleads">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Test</th>
                <th>Falsely low</th>
                <th>Falsely high</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Urine Na⁺</th>
                <td>Selective renal ischaemia (bilateral renal artery stenosis), acute glomerulonephritis; any large urine volume</td>
                <td>Diuretics, salt-wasting nephropathy, adrenal insufficiency, a non-reabsorbable anion (bicarbonate, ketoacids)</td>
              </tr>
              <tr>
                <th scope="row">FENa</th>
                <td>ATN on a background of cirrhosis, heart failure or burns; contrast and pigment injury</td>
                <td>Diuretics; advanced CKD, where the threshold itself has moved</td>
              </tr>
              <tr>
                <th scope="row">Urine osmolality</th>
                <td>Osmotic diuresis; recovering ATN</td>
                <td>A urea or contrast load</td>
              </tr>
              <tr>
                <th scope="row">Urine anion gap</th>
                <td>Unmeasured anions (ketones, penicillins) make it read low although ammonium excretion is adequate</td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="note">
          Rose gives no single number that separates the states reliably, and neither does this model. The indices are evidence about effective circulating volume, to be weighed with everything else — not a test for a diagnosis.
        </p>
      </Expand>
      <div class="grid grid-2">
        <EquationCard eq="fena" compact />
        <EquationCard eq="uag" compact />
      </div>
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>There is no normal value. Someone in balance on 150 mmol/day of sodium excretes 150 mmol/day, at whatever concentration the urine volume happens to give.</p>}
          why={<p>The kidney varies sodium excretion to defend effective circulating volume and water excretion to defend osmolality. Urine chemistry is the read-out of those two regulators — a property of the regulation, not of the urine.</p>}
          change={<p>Raise intake and excretion follows within days. Lower effective volume and sodium excretion falls towards zero, then recovers as the kidney re-equilibrates. Change urine volume alone and every concentration changes with no change in excretion at all.</p>}
          abnormal={<p>Tubular injury raises urine Na⁺ and abolishes concentration. Diuretics raise it while the patient is dry. Non-reabsorbable anions carry sodium out of an avidly retaining kidney. A large dilute urine makes everything look low. Advanced CKD moves the FENa threshold.</p>}
          clinical={<p>Read each number as the answer to one question, against the clinical picture and the time course. Measure urine chloride when sodium and the examination disagree. Never treat FENa as a diagnosis.</p>}
        />
        <Sources cite={{ rose: [13, 8, 14], evidence: 'clinical', refs: ['espinel1976', 'miller1978', 'carvounis2002', 'perazella2012'] }} />
      </Panel>
      <Related paths={['/fractional-excretion', '/prerenal-atn', '/urine-osmolality', '/hypovolemia', '/diuretics']} />
    </div>
  );
}

// ---------------------------------------------------------------- scoring the indices
/**
 * "Correct" means the index points at the truth the simulation holds: urine sodium read as a
 * volume test, FENa and urine osmolality read as tests of tubular integrity in acute kidney
 * injury. Where an index lands in its own acknowledged grey zone it is scored equivocal rather
 * than wrong.
 */
interface Score {
  test: string;
  says: string;
  result: 'yes' | 'no' | 'equivocal';
  why: string;
}

function scoreAll(c: Case, at: { urineNa: number; urineVolume: number; fena: number; urineOsm: number }): Score[] {
  const na = at.urineNa / Math.max(at.urineVolume, 0.01);
  const truthLow = c.truth.volume === 'low';
  const truthIntact = c.truth.tubules === 'intact';

  const naScore: Score =
    na >= 20 && na <= 40
      ? { test: 'Urine Na⁺', says: 'equivocal (20–40 mmol/L)', result: 'equivocal', why: '' }
      : {
          test: 'Urine Na⁺',
          says: na < 20 ? 'behaving as volume-depleted' : 'not retaining sodium',
          result: (na < 20) === truthLow ? 'yes' : 'no',
          why: na < 20 ? 'The urine sodium is low although effective volume is not.' : 'The urine sodium is high although effective volume is genuinely low.',
        };

  const fenaScore: Score =
    at.fena >= 1 && at.fena <= 2
      ? { test: 'FENa', says: 'intermediate (1–2%)', result: 'equivocal', why: '' }
      : {
          test: 'FENa',
          says: at.fena < 1 ? 'pre-renal pattern' : 'tubular pattern',
          result: (at.fena < 1) === truthIntact ? 'yes' : 'no',
          why: at.fena < 1 ? 'FENa is below 1% although the tubules are injured.' : 'FENa is above 2% although the tubules are intact.',
        };

  const osmScore: Score =
    at.urineOsm >= 350 && at.urineOsm <= 500
      ? { test: 'Urine osmolality', says: 'intermediate', result: 'equivocal', why: '' }
      : {
          test: 'Urine osmolality',
          says: at.urineOsm > 500 ? 'concentrating — favours pre-renal' : 'isosthenuric — favours tubular injury',
          result: (at.urineOsm > 500) === truthIntact ? 'yes' : 'no',
          why: at.urineOsm > 500 ? 'The urine is concentrated although the tubules are injured.' : 'The urine is dilute although the tubules are intact.',
        };

  return [naScore, fenaScore, osmScore];
}

function mark(r: Score['result']) {
  if (r === 'yes') return <span style={{ color: 'var(--good)' }}>✓ yes</span>;
  if (r === 'no') return <span style={{ color: 'var(--danger)' }}>✗ misleading</span>;
  return <span style={{ color: 'var(--ink-dim)' }}>– equivocal</span>;
}
