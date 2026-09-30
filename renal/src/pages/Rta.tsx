import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, Related, Busy, useTabParam } from '../ui/page';
import { Panel, Readout, Slider, Sources, Predict, BarRow, Tabs, Chain, LineChart, Expand, type Series } from '../ui/kit';
import { makeParams, useSteady, useStep } from '../sim/hooks';
import type { ParamPatch } from '../engine/types';

const TAB_IDS = ['three', 'titration', 'diagnose', 'stones'] as const;

interface Type {
  id: 'normal' | 'type1' | 'type2' | 'type4';
  label: string;
  lesion: string;
  patch: ParamPatch;
  expect: { urinePH: string; hco3: string; k: string; uag: string; alkali: string; extra: string };
}

const TYPES: Type[] = [
  {
    id: 'normal',
    label: 'Normal kidney',
    lesion: 'Nothing. Shown under the same dietary acid load for comparison.',
    patch: {},
    expect: { urinePH: '4.5–5.0 under an acid load', hco3: '22–26', k: 'normal', uag: 'negative under an acid load', alkali: 'none', extra: '—' },
  },
  {
    id: 'type1',
    label: 'Type 1 — distal',
    lesion: 'The collecting-tubule H⁺-ATPase, the luminal electronegativity that drives it, or the tight junction that holds the gradient.',
    patch: { transporters: { HATPase: 0.15 } },
    expect: {
      urinePH: '> 5.3, whatever the blood pH',
      hco3: 'may fall below 10',
      k: 'low, or high in the voltage-defect variant',
      uag: 'positive (+23 in Batlle\'s series)',
      alkali: '1–2 mmol/kg/day',
      extra: 'nephrocalcinosis and calcium phosphate stones',
    },
  },
  {
    id: 'type2',
    label: 'Type 2 — proximal',
    lesion: 'A lowered proximal bicarbonate threshold — the basolateral Na⁺-3HCO₃⁻ exit step, carbonic anhydrase, or the whole Fanconi transport set.',
    patch: { transporters: { NBCe1: 0.25 } },
    expect: {
      urinePH: 'variable: acid below the threshold, > 7.5 above it',
      hco3: 'self-limiting at 14–20',
      k: 'normal or low, and falls further on treatment',
      uag: 'positive',
      alkali: '10–15 mmol/kg/day',
      extra: 'rickets or osteomalacia; glycosuria, hypophosphataemia, aminoaciduria if Fanconi',
    },
  },
  {
    id: 'type4',
    label: 'Type 4 — hypoaldosteronism',
    lesion: 'Aldosterone deficiency or resistance, and through the hyperkalaemia, a failure of medullary ammonium recycling.',
    patch: { aldoSynthesis: 0.03 },
    expect: {
      urinePH: 'usually < 5.3 — acidification works',
      hco3: 'usually above 15',
      k: 'high — this is the defining feature',
      uag: 'positive (+39 with selective aldosterone deficiency)',
      alkali: '1–3 mmol/kg/day, or none if the potassium is corrected',
      extra: 'none',
    },
  },
];

export default function Rta({ query }: { query: URLSearchParams }) {
  const [tab, setTab] = useTabParam('/rta', TAB_IDS, 'three', query);
  return (
    <div>
      <PageHead
        path="/rta"
        lede="Three different lesions that all end in a hyperchloraemic acidosis, and four measurements that separate them: the urine pH during acidaemia, the plasma potassium, the urine anion gap, and what happens when you give bicarbonate."
      />
      <Tabs
        tabs={[
          { id: 'three', label: 'Three lesions' },
          { id: 'titration', label: 'Bicarbonate titration' },
          { id: 'diagnose', label: 'Work one up' },
          { id: 'stones', label: 'Bones and stones' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'three' && <Three />}
      {tab === 'titration' && <Titration />}
      {tab === 'diagnose' && <Diagnose />}
      {tab === 'stones' && <Stones />}
      <Panel title="The five questions">
        <FiveQuestions
          normal={
            <p>
              The proximal tubule reclaims about 90 per cent of the filtered bicarbonate up to a threshold near 26 mmol/L; the collecting tubule reclaims the rest and then secretes the dietary acid
              load, lowering the urine pH to 4.5–5.0 and trapping ammonia as ammonium.
            </p>
          }
          why={<p>Both jobs are needed. Bicarbonate lost in the urine adds to the acid load; and without a low luminal pH there is no gradient to trap ammonia, so ammonium excretion collapses too.</p>}
          change={
            <p>
              Break the distal pump and the urine pH will not fall, ammonium excretion fails, and acid accumulates without limit. Lower the proximal threshold and bicarbonate is lost until the plasma
              level reaches the new threshold — then it stops, because the distal nephron can still acidify.
            </p>
          }
          abnormal={
            <p>
              Type 1 is progressive and can reach a bicarbonate below 10. Type 2 is self-limiting at 14–20 but needs ten times the alkali to treat, because the alkali is promptly re-excreted. Type 4
              is mild, hyperkalaemic, and often corrects when the potassium does.
            </p>
          }
          clinical={
            <p>
              A normal anion gap acidosis with a urine pH above 5.3 is not automatically type 1: hypokalaemia, volume depletion and urea-splitting organisms all raise the urine pH. Check the urine
              sodium and the urine anion gap before committing.
            </p>
          }
        />
        <Sources cite={{ rose: [19, 11], refs: ['batlle1988'], evidence: 'clinical' }} />
      </Panel>
      <Related paths={['/metabolic-acidosis', '/urine-chemistry', '/ammonium', '/hyperkalemia', '/distal', '/proximal']} />
    </div>
  );
}

// ------------------------------------------------------------------ three lesions
function Three() {
  const [loaded, setLoaded] = useState(false);
  const rows = TYPES.map((t) => ({
    t,
    ev: useSteady(useMemo(() => makeParams(loaded ? { ...t.patch, extraAcid: 100 } : t.patch), [loaded]), 40),
  }));
  const busy = rows.some((r) => r.ev.busy);

  return (
    <>
      <Panel
        title="The same diet, four kidneys"
        note={
          loaded
            ? 'All four given 100 mmol/day of ammonium chloride on top of the diet — the acid-loading test. This is the condition in which the urine pH and the urine anion gap become diagnostic.'
            : 'All four settled for forty days on an ordinary acid load of about 55 mmol/day.'
        }
        actions={
          <button class="btn" onClick={() => setLoaded(!loaded)}>
            {loaded ? 'Back to an ordinary diet' : 'Add an ammonium chloride load'}
          </button>
        }
      >
        <Busy on={busy} />
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th></th>
                {TYPES.map((t) => (
                  <th key={t.id}>{t.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Bicarbonate (mmol/L)</td>
                {rows.map((r) => (
                  <td key={r.t.id} class={r.ev.ev && r.ev.ev.plasma.HCO3 < 16 ? 'bad' : ''}>
                    {r.ev.ev ? r.ev.ev.plasma.HCO3.toFixed(1) : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Arterial pH</td>
                {rows.map((r) => (
                  <td key={r.t.id}>{r.ev.ev ? r.ev.ev.plasma.pH.toFixed(3) : '—'}</td>
                ))}
              </tr>
              <tr>
                <td>Potassium (mmol/L)</td>
                {rows.map((r) => (
                  <td key={r.t.id} class={r.ev.ev && (r.ev.ev.plasma.K > 5.5 || r.ev.ev.plasma.K < 3.5) ? 'bad' : ''}>
                    {r.ev.ev ? r.ev.ev.plasma.K.toFixed(2) : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Urine pH</td>
                {rows.map((r) => (
                  <td key={r.t.id} class={r.ev.ev && r.ev.ev.kidney.urine.pH > 5.3 && r.ev.ev.plasma.HCO3 < 22 ? 'bad' : ''}>
                    {r.ev.ev ? r.ev.ev.kidney.urine.pH.toFixed(2) : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <td>Ammonium (mmol/day)</td>
                {rows.map((r) => (
                  <td key={r.t.id}>{r.ev.ev ? r.ev.ev.kidney.urine.exc.NH4.toFixed(0) : '—'}</td>
                ))}
              </tr>
              <tr>
                <td>Net acid excretion (mmol/day)</td>
                {rows.map((r) => (
                  <td key={r.t.id}>{r.ev.ev ? r.ev.ev.kidney.urine.exc.NAE.toFixed(0) : '—'}</td>
                ))}
              </tr>
              <tr>
                <td>Urine anion gap (mmol/L)</td>
                {rows.map((r) => (
                  <td key={r.t.id}>{r.ev.ev ? r.ev.ev.derived.urineAnionGap.toFixed(0) : '—'}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p class="control-hint">
          Note the row that does the most work: ammonium. Every renal tubular acidosis is, in the end, a failure to excrete enough ammonium — the urine pH and the plasma potassium only tell you which
          step failed.
        </p>
        <p class="control-hint">
          {loaded
            ? 'Under an acid load the normal kidney takes its urine pH below 5.0 and drives the urine anion gap strongly negative, because ammonium is leaving as ammonium chloride. None of the three defects can do that — which is exactly the comparison Batlle made, and why the test has to be done under an acid stress rather than on an ordinary diet.'
            : 'On an ordinary diet the urine anion gap is positive in everybody, including the normal kidney: there is not enough acid to excrete for ammonium chloride to dominate the urine. Add the acid load and watch which column moves.'}
        </p>
      </Panel>
      <div class="grid grid-2">
        {TYPES.slice(1).map((t) => (
          <Panel key={t.id} title={t.label}>
            <p class="note">{t.lesion}</p>
            <table class="table">
              <tbody>
                <tr>
                  <td>Urine pH</td>
                  <td>{t.expect.urinePH}</td>
                </tr>
                <tr>
                  <td>Plasma HCO₃⁻</td>
                  <td>{t.expect.hco3}</td>
                </tr>
                <tr>
                  <td>Plasma K⁺</td>
                  <td>{t.expect.k}</td>
                </tr>
                <tr>
                  <td>Urine anion gap</td>
                  <td>{t.expect.uag}</td>
                </tr>
                <tr>
                  <td>Alkali needed</td>
                  <td>{t.expect.alkali}</td>
                </tr>
                <tr>
                  <td>Other</td>
                  <td>{t.expect.extra}</td>
                </tr>
              </tbody>
            </table>
          </Panel>
        ))}
      </div>
      <Panel title="Why type 1 keeps falling and type 2 does not">
        <div class="grid grid-2">
          <Chain
            steps={[
              { text: 'Distal H⁺-ATPase fails' },
              { text: 'Urine pH cannot fall below ~5.3' },
              { text: 'No gradient to trap NH₃ as NH₄⁺; titratable acid capped too' },
              { text: 'Net acid excretion falls below the dietary load' },
              { text: 'Acid is retained every single day' },
              { text: 'Bicarbonate falls until bone carbonate buffers the difference — below 10 mmol/L' },
            ]}
          />
          <Chain
            steps={[
              { text: 'Proximal threshold falls from 26 to, say, 14' },
              { text: 'Bicarbonate above 14 is not reclaimed and appears in the urine' },
              { text: 'Plasma bicarbonate falls toward the new threshold' },
              { text: 'Filtered load now fits within the reduced capacity' },
              { text: 'Distal acidification is intact and mops up what escapes' },
              { text: 'A new steady state at 14–20: self-limiting' },
            ]}
          />
        </div>
        <p class="control-hint">
          Even abolishing proximal reabsorption altogether only takes the bicarbonate to 11 or 12, because the distal nephron reclaims a great deal of what gets past. In animals a carbonic anhydrase
          inhibitor can block 80 per cent of proximal reabsorption while only 30 per cent of the filtered bicarbonate reaches the urine.
        </p>
        <Sources cite={{ rose: [19, 11], evidence: 'experimental' }} />
      </Panel>
      <Predict
        question="Which renal tubular acidosis produces the lowest plasma bicarbonate?"
        options={['Type 2, because bicarbonate is being lost in the urine', 'Type 1, because acid is retained every day with no new steady state until bone buffers it', 'Type 4', 'They are all the same']}
        correct={1}
        explanation="Losing bicarbonate is self-limiting: the loss stops when the plasma level reaches the reduced threshold. Failing to excrete acid is not self-limiting, because the diet keeps supplying it."
      />
    </>
  );
}

// ------------------------------------------------------------------ titration
function Titration() {
  const [dose, setDose] = useState(0);
  const rows = TYPES.map((t) => ({
    t,
    ev: useSteady(useMemo(() => makeParams({ ...t.patch, drugs: { sodiumBicarbonate: dose } }), [dose]), 40),
  }));
  const busy = rows.some((r) => r.ev.busy);
  const feHco3 = (ev: NonNullable<(typeof rows)[0]['ev']['ev']>) => (ev.kidney.urine.exc.HCO3 / Math.max((ev.kidney.GFR * 1440 * ev.plasma.HCO3) / 1000, 1)) * 100;

  return (
    <>
      <Panel title="Rose Fig. 19-6: give alkali and watch where it goes" note="Sodium bicarbonate, mmol/day, held until a new steady state.">
        <Slider label="Sodium bicarbonate" value={dose} min={0} max={800} step={50} unit=" mmol/day" onInput={setDose} normal={0} hint="1–2 mmol/kg/day corrects type 1; type 2 needs 10–15" />
        <Busy on={busy} />
        <div class="grid grid-2">
          {rows.map((r) => (
            <Panel key={r.t.id} title={r.t.label}>
              {r.ev.ev && (
                <div class="readout-grid">
                  <Readout label="Plasma HCO₃⁻" value={r.ev.ev.plasma.HCO3} digits={1} unit="mmol/L" tone={r.ev.ev.plasma.HCO3 < 16 ? 'low' : r.ev.ev.plasma.HCO3 > 28 ? 'high' : 'good'} />
                  <Readout label="Urine pH" value={r.ev.ev.kidney.urine.pH} digits={2} tone={r.ev.ev.kidney.urine.pH > 7.4 ? 'high' : 'normal'} />
                  <Readout label="Fractional HCO₃⁻ excretion" value={feHco3(r.ev.ev)} digits={1} unit="%" tone={feHco3(r.ev.ev) > 15 ? 'high' : 'normal'} />
                  <Readout label="Urine K⁺" value={r.ev.ev.kidney.urine.exc.K} digits={0} unit="mmol/day" tone={r.ev.ev.kidney.urine.exc.K > 100 ? 'high' : 'normal'} />
                </div>
              )}
            </Panel>
          ))}
        </div>
        <p class="control-hint">
          Push the dose up and watch the two disorders separate. In type 1 the plasma bicarbonate climbs toward normal — there is no threshold defect, only a fixed bicarbonaturia obligated by the
          high urine pH, under 3 per cent of the filtered load in adults. In type 2 the plasma bicarbonate barely moves however much you give, because everything above the reduced threshold goes
          straight out; the fractional excretion climbs past 15 per cent instead.
        </p>
      </Panel>
      <div class="grid grid-2">
        <Panel title="And why the potassium falls on treatment">
          <p class="note">
            Before treatment a patient with type 2 renal tubular acidosis is in a steady state where almost all the filtered bicarbonate is reclaimed, with mild hypokalaemia from the secondary
            hyperaldosteronism that the proximal sodium wasting has produced. Give alkali and two things happen at once: a poorly reabsorbable anion arrives at the collecting duct in bulk, and the
            distal flow rate rises. Both increase potassium secretion in a patient whose aldosterone is already high.
          </p>
          <p class="note">
            That is why the alkali has to be given partly as the potassium salt, and why the requirement is empirical: the more bicarbonaturia the treatment produces, the more potassium it costs.
          </p>
          <Sources cite={{ rose: [19, 12], evidence: 'clinical' }} />
        </Panel>
        <Panel title="The diagnostic test, as Rose states it">
          <Chain
            steps={[
              { text: 'Infuse NaHCO₃ at 0.5–1.0 mmol/kg/h' },
              { text: 'Watch the urine pH and the fractional bicarbonate excretion' },
              { text: 'Type 1: both stay put — there was never a threshold defect' },
              { text: 'Type 2: urine pH rises above 7.5, FE HCO₃⁻ passes 15–20% as the plasma level approaches normal' },
            ]}
          />
          <p class="control-hint">
            For the patient who is not acidaemic at all — incomplete type 1 renal tubular acidosis, usually suspected because the urine pH is persistently above 5.5 in someone with calcium stones or
            a family history — the test runs the other way: 0.1 g/kg of ammonium chloride should drop the plasma bicarbonate by 4–5 mmol/L within 4–6 hours, and a normal subject will then take the
            urine pH below 5.0.
          </p>
        </Panel>
      </div>
      <Predict
        question="Why does a patient with type 2 renal tubular acidosis need ten times as much alkali as one with type 1?"
        options={['The acidosis is more severe', 'Raising the plasma bicarbonate above the reduced threshold makes the kidney excrete the alkali again, so the dose has to outrun the urinary loss', 'Absorption is poor', 'The alkali is consumed by bone']}
        correct={1}
        explanation="It is also why the treatment costs potassium: bicarbonaturia delivers a poorly reabsorbable anion to a collecting duct that is already under aldosterone drive."
      />
    </>
  );
}

// ------------------------------------------------------------------ diagnose
const CASES = [
  {
    label: 'Sjögren\'s syndrome, weakness, renal stones',
    patch: { transporters: { HATPase: 0.15 } } as ParamPatch,
    answer: 'type1',
    note: 'Autoimmune disease is the commonest identifiable cause of type 1 renal tubular acidosis in adults, and in some patients with Sjögren\'s syndrome renal biopsy has shown the H⁺-ATPase pump to be entirely absent from the intercalated cells. The acidosis can precede the sicca symptoms by five years or more.',
  },
  {
    label: 'Multiple myeloma with glycosuria at a normal glucose',
    patch: { transporters: { NBCe1: 0.25, SGLT2: 0.2, NaPi2: 0.3 } } as ParamPatch,
    answer: 'type2',
    note: 'Toxic light chains are reabsorbed by and accumulate in the proximal tubular cells. Myeloma is probably the commonest cause of type 2 renal tubular acidosis in adults, and the glycosuria, hypophosphataemia and aminoaciduria of a full Fanconi syndrome are the giveaway.',
  },
  {
    label: 'Diabetic with mild renal impairment and a potassium of 6',
    patch: { aldoSynthesis: 0.1, nephronFraction: 0.5 } as ParamPatch,
    answer: 'type4',
    note: 'Hyporeninaemic hypoaldosteronism. The hyperkalaemia is generally more prominent than the acidosis, and much of the acidosis is caused by the hyperkalaemia itself: tubular potassium competes with ammonium for the potassium site on the loop\'s Na⁺-K⁺-2Cl⁻ carrier, so medullary ammonium recycling fails.',
  },
  {
    label: 'Severe diarrhoea with hypokalaemia and an alkaline urine',
    patch: { diarrhea: 3, waterIntake: 2, naIntake: 100 } as ParamPatch,
    answer: 'none',
    note: 'The trap. Hypokalaemia stimulates renal ammonia production, and ammonia diffusing into the urine raises its pH — so the urine pH looks like type 1 renal tubular acidosis. The urine anion gap gives it away: Batlle\'s diarrhoea patients had a mean urine pH of 5.64 and a mean urine anion gap of −20 mmol/L.',
  },
  {
    label: 'Marked volume depletion, urine sodium 8 mmol/L',
    patch: { diarrhea: 2.5, waterIntake: 0.6, naIntake: 10 } as ParamPatch,
    answer: 'none',
    note: 'Also a trap, and a different one. Low distal sodium delivery reduces luminal electronegativity and impairs distal acidification, producing a genuinely reversible form of type 1 renal tubular acidosis. It also prevents ammonium chloride excretion, so the urine anion gap cannot be interpreted either. Rehydrate first, then re-test.',
  },
];

function Diagnose() {
  const [idx, setIdx] = useState(0);
  const [guess, setGuess] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const c = CASES[idx];
  const base = useMemo(() => makeParams({}), []);
  const sick = useMemo(() => makeParams(c.patch), [idx]);
  const { points, busy } = useStep(base, sick, 21, 0.25, 60, 4, 1);
  const end = points?.[points.length - 1];

  const pick = (label: string, id: string) => (
    <button key={id} class={`btn ${guess === id ? 'active' : ''}`} onClick={() => setGuess(id)} disabled={shown}>
      {label}
    </button>
  );

  return (
    <>
      <Panel title="Pick a patient, predict the pattern, then look">
        <div class="chips">
          {CASES.map((x, i) => (
            <button
              key={x.label}
              class={`chip ${i === idx ? 'active' : ''}`}
              onClick={() => {
                setIdx(i);
                setGuess(null);
                setShown(false);
              }}
            >
              {x.label}
            </button>
          ))}
        </div>
        <p class="control-hint" style={{ marginTop: 10 }}>
          What will the urine pH, the plasma potassium and the urine anion gap show — and is this a renal tubular acidosis at all?
        </p>
        <div class="chips" style={{ marginTop: 6 }}>
          {pick('Type 1 (distal)', 'type1')}
          {pick('Type 2 (proximal)', 'type2')}
          {pick('Type 4', 'type4')}
          {pick('Not an RTA', 'none')}
        </div>
        <p style={{ marginTop: 8 }}>
          <button class="btn primary" onClick={() => setShown(true)} disabled={!guess || shown}>
            Reveal
          </button>
        </p>
        {shown && (
          <p class={`note ${guess === c.answer ? 'good' : 'bad'}`}>
            {guess === c.answer ? 'Correct. ' : 'Not quite. '}
            {c.note}
          </p>
        )}
      </Panel>
      {shown && (
        <div class="grid grid-sidebar">
          <div>
            <Panel title="After three weeks">
              <Busy on={busy} />
              {end && (
                <div class="readout-grid">
                  <Readout label="Bicarbonate" value={end.HCO3} digits={1} unit="mmol/L" tone={end.HCO3 < 16 ? 'low' : 'normal'} />
                  <Readout label="pH" value={end.pH} digits={3} tone={end.pH < 7.32 ? 'low' : 'normal'} />
                  <Readout label="Potassium" value={end.K} digits={2} unit="mmol/L" tone={end.K > 5.5 || end.K < 3.5 ? 'danger' : 'normal'} />
                  <Readout label="Anion gap" value={end.anionGap} digits={1} unit="mmol/L" tone={end.anionGap > 14 ? 'high' : 'normal'} />
                  <Readout label="Urine pH" value={end.urinePH} digits={2} tone={end.urinePH > 5.3 ? 'high' : 'good'} refRange="< 5.3 if acidification works" />
                  <Readout label="Urine anion gap" value={end.urineAnionGap} digits={0} unit="mmol/L" tone={end.urineAnionGap > 0 ? 'high' : 'good'} />
                  <Readout label="Urine sodium" value={end.urineNa} digits={0} unit="mmol/day" tone={end.urineNa < 25 ? 'low' : 'normal'} title="below ~25 mmol/L the urine anion gap is uninterpretable" />
                  <Readout label="Ammonium" value={end.urineNH4} digits={0} unit="mmol/day" tone={end.urineNH4 < 30 ? 'low' : 'good'} />
                </div>
              )}
            </Panel>
          </div>
          <div>
            <Panel title="Getting there">
              {points && (
                <LineChart
                  xLabel="days"
                  series={[
                    { label: 'Bicarbonate', axis: 'Plasma HCO₃⁻ (mmol/L)', points: points.map((p) => ({ x: p.day, y: p.HCO3 })), color: 'var(--c-blue)' },
                    { label: 'Urine pH', axis: 'Urine pH', points: points.map((p) => ({ x: p.day, y: p.urinePH })), color: 'var(--c-amber)' },
                    { label: 'Potassium', axis: 'Plasma K⁺ (mmol/L)', points: points.map((p) => ({ x: p.day, y: p.K })), color: 'var(--c-green)' },
                  ] as Series[]}
                  height={210}
                />
              )}
            </Panel>
          </div>
        </div>
      )}
      <Expand summary="The two conditions in which the urine anion gap cannot be used">
        <p>
          <strong>A high anion gap acidosis.</strong> The unmeasured ketoacid or lactate anions are in the urine as well as the plasma, so the gap can be positive even while ammonium excretion is
          rising appropriately. Where this matters, the urine osmolal gap estimates ammonium directly: measure the urine osmolality, calculate it from 2 × (Na⁺ + K⁺) + urea + glucose, and ammonium is
          roughly half the difference, because each ammonium ion comes with an anion.
        </p>
        <p>
          <strong>Avid sodium retention.</strong> With a urine sodium at or below 25 mmol/L the tubule is reabsorbing chloride too, so there is no ammonium chloride to make the gap negative. The
          volume depletion has also produced a reversible distal acidification defect in its own right — which is one reason severe or persistent diarrhoea produces a worse acidosis than the stool
          losses alone would account for.
        </p>
        <Sources cite={{ refs: ['batlle1988'], rose: [19], evidence: 'clinical' }} />
      </Expand>
    </>
  );
}

// ------------------------------------------------------------------ stones
function Stones() {
  const [hco3, setHco3] = useState(12);
  const [k, setK] = useState(3.0);
  // An illustration of two statements the chapter makes qualitatively — that the hypercalciuria is
  // proportional to the fall in bicarbonate, and that citrate excretion falls with both acidaemia
  // and hypokalaemia. The slopes are chosen to span the reported clinical range; they are not
  // measured coefficients, and the panel says so.
  const calciuria = 1 + 0.09 * Math.max(0, 24 - hco3);
  const citrate = Math.max(0.1, 1 - 0.055 * Math.max(0, 24 - hco3) - 0.22 * Math.max(0, 4.0 - k));
  const risk = calciuria / citrate;

  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Why the stones happen">
            <Slider label="Plasma bicarbonate" value={hco3} min={6} max={24} step={0.5} unit=" mmol/L" onInput={setHco3} normal={24} />
            <Slider label="Plasma potassium" value={k} min={2.2} max={4.5} step={0.1} unit=" mmol/L" onInput={setK} normal={4.2} />
            <div class="readout-grid">
              <Readout label="Calcium excretion" value={calciuria} digits={2} unit="× normal" tone={calciuria > 1.6 ? 'high' : 'normal'} />
              <Readout label="Citrate excretion" value={citrate} digits={2} unit="× normal" tone={citrate < 0.5 ? 'low' : 'normal'} />
              <Readout label="Calcium : citrate" value={risk} digits={2} unit="× normal" tone={risk > 3 ? 'danger' : risk > 1.8 ? 'high' : 'normal'} />
            </div>
            <BarRow label="Calcium excretion" value={calciuria} max={3.2} unit="×" color="var(--c-coral)" />
            <BarRow label="Citrate excretion" value={citrate} max={1.2} unit="×" color="var(--c-teal)" />
            <p class="control-hint">
              These two curves illustrate relationships the chapter states as proportionalities rather than as equations; the slopes span the reported clinical range but are not measured
              coefficients. What they are there to show is the product, not either number on its own.
            </p>
            <p class="control-hint">
              Chronic acidaemia releases calcium and phosphate from bone during buffering and reduces their tubular reabsorption directly, in proportion to how low the bicarbonate is. Meanwhile
              citrate — which normally keeps calcium in solution by forming a soluble complex with it — falls, because an acid proximal tubular cell metabolises citrate and reabsorbs more of what is
              filtered. Hypokalaemia does the same thing by a different route, driving potassium out of cells in exchange for hydrogen going in.
            </p>
          </Panel>
        </div>
        <div>
          <Panel title="Why only type 1">
            <table class="table">
              <thead>
                <tr>
                  <th></th>
                  <th>Type 1</th>
                  <th>Type 2</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Hypercalciuria</td>
                  <td>yes</td>
                  <td>yes</td>
                </tr>
                <tr>
                  <td>Hypocitraturia</td>
                  <td>yes</td>
                  <td>less — filtered citrate escapes a leaky proximal tubule</td>
                </tr>
                <tr>
                  <td>Urine pH</td>
                  <td>persistently high — calcium phosphate precipitates</td>
                  <td>can be lowered — calcium phosphate stays soluble</td>
                </tr>
                <tr>
                  <td>Chelators in the urine</td>
                  <td>few</td>
                  <td>unreabsorbed amino acids and organic anions bind calcium</td>
                </tr>
                <tr>
                  <td>Result</td>
                  <td class="bad">nephrocalcinosis and stones</td>
                  <td>rickets or osteomalacia, but not stones</td>
                </tr>
              </tbody>
            </table>
            <p class="control-hint">
              The bone disease of type 2 has its own causes on top of the acidaemia: phosphate wasting with hypophosphataemia, and loss of the proximal tubule's calcitriol synthesis.
            </p>
            <Sources cite={{ rose: [19, 3, 6], evidence: 'clinical' }} />
          </Panel>
          <Panel title="Which alkali">
            <p class="note">
              Potassium citrate, not sodium bicarbonate, in type 1. Three reasons, all of them following from the box above: citrate is metabolised to bicarbonate so the alkali is equivalent;
              correcting the hypokalaemia raises citrate excretion further; and the natriuresis a sodium salt causes would raise calcium excretion, because sodium and calcium handling are linked in the
              proximal tubule and the loop of Henle.
            </p>
            <p class="note">
              Where the hypercalciuria is the primary defect rather than a consequence — some inherited forms — alkali alone will not prevent the nephrocalcinosis, and conventional stone treatment
              (a thiazide to reduce calcium excretion) is needed as well.
            </p>
          </Panel>
        </div>
      </div>
      <Predict
        question="A patient with type 1 renal tubular acidosis and recurrent calcium stones needs alkali. Which salt?"
        options={['Sodium bicarbonate — it is cheapest', 'Potassium citrate — it corrects the hypokalaemia, raises citrate excretion, and avoids the natriuresis that would increase calcium excretion', 'Calcium carbonate', 'None — alkali makes stones worse']}
        correct={1}
        explanation="Citrate is rapidly metabolised to bicarbonate, so nothing is lost on the alkali side. Early and complete correction of the acidaemia prevents nephrocalcinosis and stone formation, even in the incomplete form."
      />
    </>
  );
}
