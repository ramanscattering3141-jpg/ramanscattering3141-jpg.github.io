import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related, Toggle } from '../ui/page';
import { Panel, Readout, Slider, Sources, Predict, LineChart, Chain } from '../ui/kit';
import { LoopDiagram } from '../ui/LoopDiagram';
import { CC_DEFAULT, ccInitial, equilibrate, exchange, flowStep, fullStep, interstitium, loopOutflow, pump, runCC, type CCParams, type CCState } from '../sim/countercurrent';

type Phase = 'pump' | 'equilibrate' | 'flow' | null;

export default function Countercurrent() {
  const [p, setP] = useState<CCParams>(CC_DEFAULT);
  const [s, setS] = useState<CCState>(() => ccInitial(CC_DEFAULT.levels));
  const [phase, setPhase] = useState<Phase>(null);
  const [playing, setPlaying] = useState(false);
  const pRef = useRef(p);
  pRef.current = p;
  const up = (patch: Partial<CCParams>) => setP({ ...p, ...patch });

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setS((cur) => fullStep(cur, pRef.current)), 60);
    return () => clearInterval(id);
  }, [playing]);

  const steady = useMemo(() => runCC(p, 700), [p]);
  const steadyNormal = useMemo(() => runCC(CC_DEFAULT, 700), []);
  const inter = interstitium(s);
  const stepOnce = (ph: Exclude<Phase, null>) => {
    setPhase(ph);
    setS((cur) => {
      const t = ph === 'pump' ? pump(cur, p) : ph === 'equilibrate' ? equilibrate(cur, p) : exchange(flowStep(cur, p), p);
      return ph === 'flow' ? { ...t, step: cur.step + 1 } : t;
    });
  };
  const depth = (arr: number[]) => arr.map((y, i) => ({ x: (i / (arr.length - 1)) * 100, y }));

  return (
    <div>
      <PageHead path="/countercurrent" lede="A modest gradient across the ascending limb, repeated along a hairpin with fluid flowing in opposite directions, becomes a gradient of ~1200 mOsm/kg from cortex to papilla. Step through it as the textbook draws it, or let it run and change what drives it." />
      <WhatIf
        options={[
          { label: 'Loop diuretic (NKCC2 ↓)', explain: 'The single effect shrinks, so the whole axial gradient collapses — urine can no longer be concentrated (and fluid leaving the loop is less dilute).' },
          { label: 'Very fast tubular flow', explain: 'Each volume of fluid spends less time being pumped: the single effect is not reached and the gradient falls (osmotic diuresis also works this way).' },
          { label: 'Vasa recta washout', explain: 'High medullary blood flow carries solute away faster than the loop deposits it.' },
          { label: 'No ADH', explain: 'The collecting duct stays impermeable: a dilute urine despite a gradient. Urea accumulation disappears, so the papillary osmolality falls too.' },
          { label: 'No urea (low protein)', explain: 'Without urea the inner medulla holds only NaCl: maximal concentration falls.' },
          { label: 'AQP1 knockout', explain: 'The descending limb cannot equilibrate by losing water, so the fluid reaching the ascending limb is less concentrated — multiplication is weaker.' },
        ]}
        onApply={(o) => {
          const m: Record<string, Partial<CCParams>> = {
            'Loop diuretic (NKCC2 ↓)': { single: 30 },
            'Very fast tubular flow': { flow: 0.9 },
            'Vasa recta washout': { washout: 0.06 },
            'No ADH': { adh: 0.02 },
            'No urea (low protein)': { urea: 0 },
            'AQP1 knockout': { aqp1: 0.15 },
          };
          setP({ ...CC_DEFAULT, ...m[o.label] });
          setS(runCC({ ...CC_DEFAULT, ...m[o.label] }, 700));
        }}
        onReset={() => {
          setP(CC_DEFAULT);
          setS(ccInitial(CC_DEFAULT.levels));
        }}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Step through it">
            <p class="muted" style={{ fontSize: '0.85rem' }}>
              Start from “time zero” (everything isosmotic) and press the three steps in order, as in the textbook’s figures. Then press play to let the cycle repeat.
            </p>
            <div class="btn-row">
              <button onClick={() => stepOnce('pump')}>① Pump NaCl out of ascending limb</button>
              <button onClick={() => stepOnce('equilibrate')}>② Descending limb equilibrates</button>
              <button onClick={() => stepOnce('flow')}>③ Fluid flows round the loop</button>
            </div>
            <div class="btn-row">
              <button class={playing ? 'active' : 'primary'} onClick={() => setPlaying(!playing)}>
                {playing ? '❚❚ Pause' : '▶ Play continuously'}
              </button>
              <button onClick={() => setS(steady)}>Jump to steady state</button>
              <button class="ghost" onClick={() => setS(ccInitial(p.levels))}>
                ↺ Time zero
              </button>
            </div>
            <div class="readout-grid">
              <Readout label="Cycles" value={s.step} />
              <Readout label="Papillary osmolality" value={inter[inter.length - 1]} unit="mOsm/kg" />
              <Readout label="Fluid leaving loop" value={loopOutflow(s, p)} unit="mOsm/kg" />
              <Readout label="Final urine" value={s.cd[s.cd.length - 1]} unit="mOsm/kg" />
            </div>
          </Panel>
          <Panel title="What drives it">
            <Slider label="Single effect (NKCC2 activity)" value={p.single} min={0} max={250} step={5} unit="mOsm/kg" onInput={(v) => up({ single: v })} hint="Maximum gradient the ascending limb holds against the interstitium" />
            <Slider label="Tubular flow" value={p.flow} min={0.05} max={1} step={0.05} unit="× level/step" onInput={(v) => up({ flow: v })} />
            <Slider label="Descending-limb water permeability (AQP1)" value={p.aqp1} min={0} max={1} step={0.05} onInput={(v) => up({ aqp1: v })} />
            <Slider label="Vasa recta washout" value={p.washout} min={0} max={0.08} step={0.002} onInput={(v) => up({ washout: v })} />
            <Slider label="Urea available for recycling" value={p.urea} min={0} max={800} step={10} unit="mOsm/kg" onInput={(v) => up({ urea: v })} />
            <Slider label="ADH (collecting duct water permeability)" value={p.adh} min={0} max={1} step={0.02} format={(v) => `${Math.round(v * 100)}%`} onInput={(v) => up({ adh: v })} />
            <Toggle label="Play continuously" checked={playing} onChange={setPlaying} />
          </Panel>
        </div>
        <div>
          <Panel title="The loop, level by level" note="Each row is one level of the medulla, from cortex (top) to papilla (bottom). Numbers are osmolality in mOsm/kg.">
            <LoopDiagram s={s} p={p} highlight={phase} />
          </Panel>
          <div class="grid grid-2">
            <Panel title="Steady-state interstitial gradient" note="Solid: your settings. Dashed: normal. Stacked into NaCl and urea.">
              <LineChart
                xLabel="depth: cortex (0) → papilla (100)"
                series={[
                  { label: 'Total', points: depth(interstitium(steady)), color: '#f2b134' },
                  { label: 'NaCl part', points: depth(steady.nacl), color: '#5ecfba' },
                  { label: 'Urea part', points: depth(steady.urea), color: '#b08ee0' },
                  { label: 'Normal total', points: depth(interstitium(steadyNormal)), color: '#f2b134', dashed: true },
                ]}
                yMin={0}
              />
            </Panel>
            <Panel title="Why it multiplies">
              <Chain
                steps={[
                  { text: 'The ascending limb moves NaCl out but not water: its fluid becomes dilute, the interstitium concentrated.' },
                  { text: 'The water-permeable descending limb loses water to that interstitium and becomes concentrated.' },
                  { text: 'Flow carries that concentrated fluid round the hairpin into the ascending limb.' },
                  { text: 'The ascending limb pumps again from a higher starting point — the single effect is re-applied deeper each time.' },
                  { text: 'Result: an axial gradient far larger than the single effect, highest at the tip; its size scales with loop length and the single effect.' },
                ]}
              />
            </Panel>
          </div>
        </div>
      </div>
      <div class="grid grid-2">
        <Predict
          question="If the single effect is only 200 mOsm/kg, how can the papilla reach 1200?"
          options={['It can’t — the textbook value is wrong', 'Countercurrent flow repeats the single effect along the loop, multiplying it', 'The collecting duct pumps solute actively']}
          correct={1}
          explanation="Every pass round the hairpin starts the ascending limb at a higher osmolality, so the same transverse gradient stacks up along the length of the loop."
        />
        <Predict
          question="Final urine osmolality is set mainly by…"
          options={['Events in the loop', 'Collecting duct water permeability (ADH), given the gradient', 'The proximal tubule']}
          correct={1}
          explanation="The fluid leaving the loop is similar in concentrating and diluting states; ADH decides whether it equilibrates with the medulla. Set ADH to zero with the gradient intact and watch the urine."
        />
      </div>
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>Interstitial osmolality rises from ~290 in the cortex to ~1200 mOsm/kg at the papilla in antidiuresis, about half NaCl and half urea.</p>}
          why={<p>The thick ascending limb transports NaCl without water (the only active step); the hairpin and opposite flows multiply this single effect; urea recycling adds to the inner medulla; the vasa recta preserve it.</p>}
          change={<p>Weaken NKCC2, speed up flow, increase medullary blood flow, remove urea or ADH, or impair descending-limb water permeability — each lowers the gradient by a different route.</p>}
          abnormal={<p>Loop diuretics and Bartter syndrome, osmotic diuresis, chronic water loading, diabetes insipidus and low protein intake all reduce maximal concentrating ability.</p>}
          clinical={<p>An impaired gradient causes polyuria and an inability to conserve water; the water-deprivation test can underestimate concentrating ability after medullary washout.</p>}
        />
        <Sources cite={{ rose: [4], evidence: 'physiology', refs: ['kokko1972', 'stephenson1972', 'sands2009', 'dantzler2014'] }} />
      </Panel>
      <Related paths={['/loop', '/vasa-recta', '/urea', '/adh', '/urine-osmolality']} />
    </div>
  );
}
