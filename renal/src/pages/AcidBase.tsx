import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related, Toggle } from '../ui/page';
import { Panel, Readout, Slider, Chain, Sources, Predict, LineChart, Tabs, toneFor, BarRow, type Series } from '../ui/kit';
import { EquationCard } from '../ui/EquationCard';
import { acidLoad, bufferCapacity, hFromHco3, LOAD_DEFAULT, pHFrom, titration, type LoadInput } from '../sim/acidbase';
import { navigate } from '../router';

type Tab = 'load' | 'open' | 'map';

const TABS: { id: Tab; label: string }[] = [
  { id: 'load', label: 'Where an acid load goes' },
  { id: 'open', label: 'Why an open buffer is powerful' },
  { id: 'map', label: 'The acid–base map' },
];

const CASES: { label: string; patch: Partial<LoadInput>; explain: string }[] = [
  { label: 'HCl 10 mmol/kg (the dog experiment)', patch: { load: 10 }, explain: 'Swan and Pitts gave ~180 mmol to 19 kg dogs. In water that load would give a pH of 1.80; in the animal the pH fell only to about 7.07, with bicarbonate down to 7 and PCO₂ down to 25.' },
  { label: 'Same load, no cell or bone buffering', patch: { load: 10, cellBuffering: false }, explain: 'If only extracellular bicarbonate could take the load, it would be consumed entirely — cells and bone carry more than half of an acute acid load.' },
  { label: 'Same load, paralysed and ventilated', patch: { load: 10, fixedPco2: true, respiratoryCompensation: false }, explain: 'Without the fall in PCO₂ the same bicarbonate gives a far worse pH. Respiratory compensation is not a luxury.' },
  { label: 'Acid load on an already low bicarbonate', patch: { load: 4, hco3: 10 }, explain: 'With little bicarbonate left, the extracellular share collapses and each further mmol costs much more pH: why a small extra insult is dangerous in established acidosis.' },
  { label: 'Bicarbonate load (alkali)', patch: { load: -3 }, explain: 'The reactions run backwards: buffers release H⁺, bicarbonate rises less than the amount given, ventilation falls, and K⁺ moves into cells.' },
];

function LoadTab() {
  const [s, setS] = useState<LoadInput>(LOAD_DEFAULT);
  const up = (p: Partial<LoadInput>) => setS({ ...s, ...p });
  const r = acidLoad(s);
  const acid = s.load >= 0;

  return (
    <>
      <WhatIf
        options={CASES.map((c) => ({ label: c.label, explain: c.explain }))}
        onApply={(o) => setS({ ...LOAD_DEFAULT, ...CASES.find((c) => c.label === o.label)!.patch })}
        onReset={() => setS(LOAD_DEFAULT)}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="The load">
            <Slider label={acid ? 'Strong acid added' : 'Alkali added'} value={s.load} min={-6} max={14} step={0.5} unit="mmol/kg" onInput={(v) => up({ load: v })} format={(v) => (v >= 0 ? v.toFixed(1) : `${Math.abs(v).toFixed(1)} (alkali)`)} />
            <Slider label="Body weight" value={s.weightKg} min={20} max={120} unit="kg" onInput={(v) => up({ weightKg: v })} />
            <Slider label="Starting bicarbonate" value={s.hco3} min={5} max={40} step={0.5} unit="mmol/L" onInput={(v) => up({ hco3: v })} normal={24} />
            <p class="control-hint">Total load: {r.mmol.toFixed(0)} mmol</p>
          </Panel>
          <Panel title="Which defences are allowed">
            <Toggle label="Cells and bone may buffer" checked={s.cellBuffering} onChange={(v) => up({ cellBuffering: v })} />
            <Toggle label="Ventilation may change the PCO₂" checked={s.respiratoryCompensation && !s.fixedPco2} onChange={(v) => up({ respiratoryCompensation: v, fixedPco2: !v })} />
            {!s.respiratoryCompensation && <Slider label="PCO₂ held at" value={s.pco2} min={15} max={80} unit="mmHg" onInput={(v) => up({ pco2: v })} />}
          </Panel>
        </div>
        <div>
          <Panel title="Result">
            <div class="readout-grid">
              <Readout label="Plasma bicarbonate" value={r.hco3} digits={1} unit="mmol/L" tone={toneFor(r.hco3, 22, 26)} delta={r.hco3 - s.hco3} deltaDigits={1} />
              <Readout label="PCO₂" value={r.pco2} digits={0} unit="mmHg" tone={toneFor(r.pco2, 35, 45)} />
              <Readout label="Arterial pH" value={r.pH} digits={2} tone={toneFor(r.pH, 7.35, 7.45, [7.1, 7.6])} />
              <Readout label="[H⁺]" value={r.h} digits={0} unit="nmol/L" />
              <Readout label="Plasma K⁺ shift" value={r.kShift} digits={2} unit="mmol/L" tone={Math.abs(r.kShift) > 0.5 ? 'danger' : 'normal'} />
              <Readout label="pH if nothing buffered it" value={r.pHUnbuffered} digits={2} tone="danger" title="the same load against extracellular bicarbonate alone, with a fixed PCO₂" />
            </div>
          </Panel>
          <Panel title="Where the load went" note="Rose ch. 10: about 43% of an acute acid load is taken up by extracellular bicarbonate and 57% by cells and bone — and the cellular share rises as bicarbonate is used up.">
            <BarRow label="Extracellular bicarbonate" value={Math.abs(r.extracellular)} max={Math.max(1, Math.abs(r.mmol))} unit=" mmol" color="#6aa9e8" sub={`${((Math.abs(r.extracellular) / Math.max(1, Math.abs(r.mmol))) * 100).toFixed(0)}%`} />
            <BarRow label="Cells and bone" value={Math.abs(r.cellular)} max={Math.max(1, Math.abs(r.mmol))} unit=" mmol" color="#b08ee0" sub={`${((Math.abs(r.cellular) / Math.max(1, Math.abs(r.mmol))) * 100).toFixed(0)}%`} />
            <p class="control-hint">
              Of the cellular share, roughly two-thirds is exchanged for Na⁺ and a third for K⁺, with a little chloride entering cells alongside H⁺ — which is why the plasma K⁺ rises in acidaemia and falls in alkalaemia.
            </p>
          </Panel>
          <div class="grid grid-2">
            <Panel title="The time course">
              <Chain
                steps={[
                  { text: 'Plasma bicarbonate — immediate' },
                  { text: 'Interstitial bicarbonate — ~15 min' },
                  { text: 'Cell buffers (protein, phosphate, haemoglobin) — 2–4 h' },
                  { text: 'Bone — hours, and for years in chronic acidosis', direction: -1 },
                  { text: 'Renal excretion of the acid — days' },
                ]}
              />
            </Panel>
            <Panel title="What buffering costs">
              <ul class="muted" style={{ fontSize: '0.88rem', marginTop: 0 }}>
                <li>Potassium leaves cells as H⁺ enters: a severe acidaemia can raise plasma K⁺ from 4 to 6–7 mmol/L without any change in total body K⁺.</li>
                <li>Bone gives up carbonate and phosphate with calcium: hypercalciuria acutely, bone disease over years in kidney failure.</li>
                <li>Muscle protein is broken down when it buffers a chronic acid load — part of the wasting of advanced kidney disease.</li>
              </ul>
            </Panel>
          </div>
        </div>
      </div>
      <Predict
        question="A patient with a bicarbonate of 10 receives the same acid load as one with a bicarbonate of 24. Compared with the second, the first patient's pH falls:"
        options={['By the same amount', 'Much further — less bicarbonate means less extracellular buffering and a steeper fall', 'Less far', 'Not at all']}
        correct={1}
        explanation="Bicarbonate buffering capacity is set by how much bicarbonate there is. As it is consumed, cells and bone take a larger share but the pH still falls faster for each added mmol."
      />
    </>
  );
}

function OpenTab() {
  const [hco3, setHco3] = useState(24);
  const [pco2, setPco2] = useState(40);
  const [targetPh, setTargetPh] = useState(7.1);
  const targetH = Math.pow(10, 9 - targetPh);
  const closed = bufferCapacity(hco3, pco2, targetH, false);
  const open = bufferCapacity(hco3, pco2, targetH, true);
  const lowered = bufferCapacity(hco3, 20, targetH, true);

  const curve = useMemo(() => titration(6.8, 20), []);

  return (
    <>
      <div class="grid grid-sidebar">
        <div>
          <Panel title="The thought experiment" note="One litre of plasma in which bicarbonate is the only buffer. How much strong acid can be added before the pH falls to the target?">
            <Slider label="Starting bicarbonate" value={hco3} min={5} max={40} step={0.5} unit="mmol/L" onInput={setHco3} normal={24} />
            <Slider label="Starting PCO₂" value={pco2} min={20} max={70} unit="mmHg" onInput={setPco2} normal={40} />
            <Slider label="Target pH" value={targetPh} min={6.9} max={7.35} step={0.01} onInput={setTargetPh} />
          </Panel>
          <Panel title="Acid absorbed before reaching that pH">
            <div class="readout-grid">
              <Readout label="Closed system (PCO₂ rises)" value={closed} digits={1} unit="mmol/L" tone="low" />
              <Readout label="Open: PCO₂ held at 40" value={open} digits={1} unit="mmol/L" tone="good" />
              <Readout label="Open: PCO₂ lowered to 20" value={lowered} digits={1} unit="mmol/L" tone="good" />
              <Readout label="Gain from holding the PCO₂" value={closed > 0.01 ? open / closed : NaN} digits={1} unit="×" />
            </div>
            <p class="callout" style={{ marginTop: 8 }}>
              The book’s numbers: 1.1 mmol/L closed, 12 mmol/L at a fixed PCO₂ of 40, 18 mmol/L at a PCO₂ of 20 — an eleven-fold gain simply from being able to breathe out the CO₂ that buffering generates.
            </p>
          </Panel>
        </div>
        <div>
          <Panel title="A buffer works best near its pKa" note="Titration of a phosphate buffer (pKa 6.80). The curve is flat within about one pH unit of the pKa and steep outside it — where a small amount of acid moves the pH a long way.">
            <LineChart
              xLabel="strong acid added (mmol/L)"
              series={[{ label: 'pH', points: curve.map((p) => ({ x: p.added, y: p.pH })), color: '#5ecfba' }]}
              bands={[{ from: 5.8, to: 7.8, label: 'within 1 pH unit of the pKa: efficient buffering', color: '#5ecfba18' }]}
              height={230}
            />
          </Panel>
          <div class="grid grid-2">
            <Panel title="Why bicarbonate escapes that rule">
              <Chain
                steps={[
                  { text: 'pK′ 6.10, working pH 7.40 — 1.3 units away' },
                  { text: 'H⁺ + HCO₃⁻ → H₂CO₃ → CO₂ + H₂O' },
                  { text: 'Chemoreceptors sense the rise in H⁺ and ventilation increases' },
                  { text: 'CO₂ is removed rather than accumulating', direction: -1 },
                  { text: 'The buffering reaction keeps running: capacity is set by bicarbonate, not by pH', direction: 1 },
                ]}
              />
            </Panel>
            <Panel title="The one acid bicarbonate cannot buffer">
              <p class="muted" style={{ fontSize: '0.88rem', marginTop: 0 }}>
                Carbonic acid. Adding its H⁺ to bicarbonate simply regenerates carbonic acid, so a rising PCO₂ must be buffered by haemoglobin, cell proteins and phosphates, and bone. That is why buffering alone raises the bicarbonate by only about 1 mmol/L per 10 mmHg of PCO₂, and why the kidney — adding about 3.5 mmol/L per 10 mmHg over 4–5 days — is the real defence in respiratory acidosis.
              </p>
            </Panel>
          </div>
        </div>
      </div>
      <Predict
        question="Why does holding the PCO₂ constant increase bicarbonate's buffering capacity about eleven-fold?"
        options={['It raises the bicarbonate concentration', 'Every mmol of bicarbonate consumed would otherwise appear as dissolved CO₂, driving the H⁺ back up', 'It changes the pK', 'It increases cell buffering']}
        correct={1}
        explanation="In a closed system the products accumulate and oppose further buffering. Removing CO₂ at the lung keeps the ratio favourable — the definition of an open buffer system."
      />
    </>
  );
}

function MapTab() {
  const [hco3, setHco3] = useState(24);
  const [pco2, setPco2] = useState(40);
  const pH = pHFrom(hco3, pco2);
  const h = hFromHco3(hco3, pco2);
  const label =
    pH < 7.35
      ? hco3 < 22
        ? 'Acidaemia with a low bicarbonate: metabolic acidosis'
        : 'Acidaemia with a high PCO₂: respiratory acidosis'
      : pH > 7.45
        ? hco3 > 26
          ? 'Alkalaemia with a high bicarbonate: metabolic alkalosis'
          : 'Alkalaemia with a low PCO₂: respiratory alkalosis'
        : hco3 < 20 || hco3 > 30
          ? 'Normal pH with abnormal chemistry: suspect a mixed disorder'
          : 'Within the normal range';

  // Iso-pH lines: HCO3 = 0.03 * PCO2 * 10^(pH - 6.1)
  const isoLines = useMemo(() => {
    const lines: Series[] = [];
    for (const p of [7.0, 7.2, 7.4, 7.6]) {
      const pts = [];
      for (let c = 10; c <= 80; c += 2) pts.push({ x: c, y: 0.03 * c * Math.pow(10, p - 6.1) });
      lines.push({ label: `pH ${p.toFixed(1)}`, points: pts, color: p === 7.4 ? '#5ecfba' : '#44607a', dashed: p !== 7.4 });
    }
    return lines;
  }, []);

  return (
    <div class="grid grid-sidebar">
      <div>
        <Panel title="Set the two independent variables">
          <Slider label="Plasma bicarbonate (metabolic)" value={hco3} min={4} max={45} step={0.5} unit="mmol/L" onInput={setHco3} normal={24} />
          <Slider label="PCO₂ (respiratory)" value={pco2} min={10} max={90} unit="mmHg" onInput={setPco2} normal={40} />
          <div class="readout-grid">
            <Readout label="pH" value={pH} digits={2} tone={toneFor(pH, 7.35, 7.45, [7.1, 7.6])} />
            <Readout label="[H⁺]" value={h} digits={0} unit="nmol/L" />
          </div>
          <p class={pH < 7.2 || pH > 7.55 ? 'callout danger' : 'callout'} style={{ marginTop: 8 }}>{label}</p>
        </Panel>
        <Panel title="Reading a blood gas">
          <ol class="muted" style={{ fontSize: '0.88rem', margin: 0, paddingLeft: 18 }}>
            <li>Check internal consistency: [H⁺] should equal 24 × PCO₂ ÷ HCO₃⁻.</li>
            <li>Is the patient acidaemic or alkalaemic?</li>
            <li>Which variable explains it — bicarbonate (metabolic) or PCO₂ (respiratory)?</li>
            <li>Is the other one compensating by the expected amount? If not, a second disorder is present.</li>
          </ol>
        </Panel>
      </div>
      <div>
        <Panel title="The acid–base map" note="Every point is one combination of bicarbonate and PCO₂; the diagonals are lines of equal pH. Compensation moves a patient along a line of shifting pH, never across one to the opposite side.">
          <LineChart
            xLabel="PCO₂ (mmHg)"
            series={[...isoLines, { label: 'this patient', points: [{ x: pco2, y: hco3 }], color: '#f2b134' }]}
            yMin={0}
            yMax={50}
            height={300}
            marker={pco2}
          />
        </Panel>
        <div class="grid grid-2">
          <EquationCard eq="hh" compact />
          <EquationCard eq="hplus" compact />
        </div>
      </div>
    </div>
  );
}

export default function AcidBase({ query }: { query: URLSearchParams }) {
  const fromUrl = query.get('tab') as Tab | null;
  const [tab, setTabState] = useState<Tab>(fromUrl && TABS.some((t) => t.id === fromUrl) ? fromUrl : 'load');
  const setTab = (t: Tab) => {
    setTabState(t);
    navigate('/acid-base', { tab: t });
  };

  return (
    <div>
      <PageHead
        path="/acid-base"
        lede="The hydrogen ion concentration is held near 40 nanomol/L — a millionth of the sodium concentration — because H⁺ binds proteins and changes what they do. Three defences do it: buffers in seconds, ventilation in minutes, the kidney over days. Add an acid load here and watch where it goes."
      />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'load' && <LoadTab />}
      {tab === 'open' && <OpenTab />}
      {tab === 'map' && <MapTab />}
      <Panel title="The five questions" id="five">
        <FiveQuestions
          normal={<p>Arterial [H⁺] ≈ 40 nanomol/L (pH 7.40), bicarbonate 24 mmol/L, PCO₂ 40 mmHg. About 15,000 mmol of CO₂ and 50–100 mmol of non-carbonic acid are produced daily and disposed of by lungs and kidney respectively.</p>}
          why={<p>Weak acids take up or release H⁺. Bicarbonate dominates because it is plentiful and because the lung keeps the system open, making its capacity depend on bicarbonate concentration rather than on pH.</p>}
          change={<p>Add acid: bicarbonate falls, cells and bone take over half the load, K⁺ leaves cells, and ventilation lowers the PCO₂. Add alkali: everything runs backwards.</p>}
          abnormal={<p>Primary changes in bicarbonate are metabolic disorders; primary changes in PCO₂ are respiratory ones. In respiratory acidosis bicarbonate cannot buffer at all, so cells, bone and then the kidney must.</p>}
          clinical={<p>Acidaemia raises plasma K⁺ without any change in body stores; chronic acidosis costs bone and muscle; a high-protein acid load promotes calcium stones.</p>}
        />
        <Sources cite={{ rose: [10], evidence: 'physiology', refs: ['berend2014', 'kraut2010', 'figge1998'] }} />
      </Panel>
      <Related paths={['/bicarbonate', '/ammonium', '/titratable-acid', '/metabolic-acidosis', '/respiratory', '/mixed']} />
    </div>
  );
}
