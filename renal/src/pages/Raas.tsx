import { si } from '../units';
import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related, Toggle, Busy } from '../ui/page';
import { Panel, Readout, Slider, Sources, Predict, toneFor } from '../ui/kit';
import { acute, makeParams, NORMAL, useSteady } from '../sim/hooks';
import { depletedBody } from '../engine/scenarios';
import type { Evaluation } from '../engine/simulate';

interface S {
  volume: number; // isotonic L lost (+) or gained (−)
  naIntake: number;
  stenosis: number;
  acei: boolean;
  arb: boolean;
  mra: boolean;
  aliskiren: boolean;
  nsaid: boolean;
  beta: boolean;
  loop: boolean;
}
const START: S = { volume: 0, naIntake: 150, stenosis: 0, acei: false, arb: false, mra: false, aliskiren: false, nsaid: false, beta: false, loop: false };

const col = (x: number) => (x > 1.25 ? 'var(--c-amber)' : x < 0.8 ? 'var(--c-blue)' : 'var(--c-teal)');

function Pathway({ ev, s }: { ev: Evaluation; s: S }) {
  const h = ev.reg.hormones;
  const k = ev.kidney;
  const n = NORMAL();
  const node = (x: number, y: number, w: number, label: string, value: number | null, sub?: string, blocked?: string) => (
    <g>
      <rect x={x} y={y} width={w} height={48} rx="9" fill="var(--bg-2)" stroke={value === null ? 'var(--c-dim)' : col(value)} stroke-width={2} />
      <text x={x + w / 2} y={y + 19} text-anchor="middle" style={{ fontSize: 12, fill: 'var(--ink)', fontWeight: 600 }}>
        {label}
      </text>
      <text x={x + w / 2} y={y + 36} text-anchor="middle" class="svg-value" style={{ fill: value === null ? 'var(--ink-dim)' : col(value), fontSize: 11 }}>
        {value === null ? sub : `${value.toFixed(value < 10 ? 2 : 0)}× ${sub ?? ''}`}
      </text>
      {blocked && (
        <g>
          <line x1={x + w - 4} y1={y - 6} x2={x + w + 10} y2={y + 8} stroke="var(--c-violet)" stroke-width="3" />
          <line x1={x + w + 10} y1={y - 6} x2={x + w - 4} y2={y + 8} stroke="var(--c-violet)" stroke-width="3" />
          <text x={x + w + 14} y={y + 4} style={{ fontSize: 10, fill: 'var(--c-violet)' }}>
            {blocked}
          </text>
        </g>
      )}
    </g>
  );
  const arrow = (x1: number, y1: number, x2: number, y2: number, label?: string) => (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink-dim)" stroke-width="1.6" marker-end="url(#raas-arr)" />
      {label && (
        <text x={(x1 + x2) / 2 + 4} y={(y1 + y2) / 2 - 3} class="svg-label" style={{ fontSize: 9.5 }}>
          {label}
        </text>
      )}
    </g>
  );
  const perfusion = ev.reg.MAP / 93;
  return (
    <div class="svg-scroll wide">
    <svg viewBox="0 0 760 470" width="100%" role="img" aria-label="Renin–angiotensin–aldosterone pathway with current values">
      <defs>
        <marker id="raas-arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--ink-dim)" />
        </marker>
      </defs>
      {/* stimuli */}
      {node(10, 10, 150, 'Renal perfusion', perfusion, 'normal')}
      {node(180, 10, 170, 'Macula densa NaCl', k.maculaDensa, 'uptake', s.loop ? 'loop diuretic' : undefined)}
      {node(390, 10, 150, 'Sympathetic β₁', h.sns, '', s.beta ? 'β-blocker' : undefined)}
      {node(570, 10, 170, 'Prostaglandins', h.pg / 0.2, '', s.nsaid ? 'NSAID' : undefined)}
      {arrow(85, 58, 290, 100)}
      {arrow(265, 58, 300, 100)}
      {arrow(465, 58, 330, 100)}
      {arrow(640, 58, 350, 100, 'mediate release')}
      {node(240, 100, 170, 'Renin (JG cells)', h.renin, 'PRA', s.aliskiren ? 'aliskiren' : undefined)}
      <text x="430" y="130" class="svg-label">
        + angiotensinogen (liver)
      </text>
      {arrow(325, 148, 325, 180)}
      {node(240, 180, 170, 'Angiotensin I', h.angI, '')}
      {arrow(325, 228, 325, 262, 'ACE (lung, endothelium)')}
      {node(240, 262, 170, 'Angiotensin II → AT1', h.at1, '', s.acei ? 'ACE inhibitor' : s.arb ? 'ARB' : undefined)}
      {/* effects */}
      {arrow(300, 310, 110, 350)}
      {arrow(320, 310, 290, 350)}
      {arrow(340, 310, 470, 350)}
      {arrow(360, 310, 640, 350)}
      {node(20, 350, 180, 'Efferent ≫ afferent', k.sides[0].Re / n.kidney.sides[0].Re, 'resistance')}
      {node(210, 350, 170, 'Proximal NHE3', h.at1 ** 0.17, 'Na⁺ reabs.')}
      {node(390, 350, 170, 'Aldosterone', h.aldo, '', undefined)}
      {node(570, 350, 180, 'Systemic vasoconstriction', ev.reg.SVR, 'SVR')}
      {arrow(475, 398, 475, 420)}
      {node(380, 420, 190, 'MR → ENaC, K⁺, H⁺', h.mr, '', s.mra ? 'MRA' : undefined)}
      <text x="20" y="418" class="svg-label">
        Pgc {k.Pgc.toFixed(0)} mmHg · GFR {k.GFR.toFixed(0)} · RBF {k.RBF.toFixed(0)} · FF {(k.FF * 100).toFixed(0)}%
      </text>
      <text x="20" y="436" class="svg-label">
        plasma K⁺ {ev.plasma.K.toFixed(1)} → feeds back on aldosterone
      </text>
      <text x="570" y="418" class="svg-label">
        MAP {ev.reg.MAP.toFixed(0)} mmHg
      </text>
    </svg>
    </div>
  );
}

export default function Raas() {
  const [s, setS] = useState<S>(START);
  const up = (p: Partial<S>) => setS({ ...s, ...p });
  const params = useMemo(
    () =>
      makeParams({
        naIntake: s.naIntake,
        stenosisL: s.stenosis,
        stenosisR: s.stenosis,
        drugs: { acei: s.acei ? 1 : 0, arb: s.arb ? 1 : 0, spironolactone: s.mra ? 1 : 0, aliskiren: s.aliskiren ? 1 : 0, nsaid: s.nsaid ? 1 : 0, betaBlocker: s.beta ? 1 : 0, furosemide: s.loop ? 1 : 0 },
      }),
    [s],
  );
  const ev = useMemo(() => acute(params, depletedBody(params, s.volume)), [params, s.volume]);
  const st = useSteady(params);
  const n = NORMAL();

  return (
    <div>
      <PageHead path="/raas" lede="Three sensors release renin; one enzyme chain makes angiotensin II; angiotensin II and aldosterone then act on the glomerulus, the proximal tubule, the collecting duct and the vessels. Change the volume, the salt intake or the renal arteries, add the blocking drugs, and follow every node." />
      <WhatIf
        options={[
          { label: 'Volume depletion (3 L)', explain: 'All three sensors fire: less afferent stretch, more sympathetic tone, less NaCl at the macula densa. Renin, angiotensin II and aldosterone rise; efferent constriction holds GFR; Na⁺ excretion falls.' },
          { label: 'Low-salt diet', explain: 'Diet is the main normal determinant of renin: low intake → higher renin and aldosterone → sodium conserved.' },
          { label: 'High-salt diet', explain: 'Renin and aldosterone suppressed; sodium excreted.' },
          { label: 'Bilateral renal artery stenosis', explain: 'Distal perfusion falls: renin and angiotensin II rise and hold GFR — renovascular hypertension.' },
          { label: 'Stenosis + ACE inhibitor', explain: 'Angiotensin II falls: efferent support lost, GFR falls. Renin rises further (no feedback).' },
          { label: 'ACE inhibitor + MRA', explain: 'Aldosterone blocked twice: K⁺ rises — watch it in CKD and heart failure.' },
          { label: 'Loop diuretic', explain: 'Blocks NKCC2 in the macula densa itself: renin rises beyond the effect of volume loss.' },
          { label: 'NSAID + β-blocker', explain: 'Prostaglandins and β₁ signalling mediate most renin release: together they nearly abolish it → hyporeninaemic hypoaldosteronism.' },
        ]}
        onApply={(o) => {
          const m: Record<string, Partial<S>> = {
            'Volume depletion (3 L)': { volume: 3 },
            'Low-salt diet': { naIntake: 20 },
            'High-salt diet': { naIntake: 350 },
            'Bilateral renal artery stenosis': { stenosis: 0.8 },
            'Stenosis + ACE inhibitor': { stenosis: 0.8, acei: true },
            'ACE inhibitor + MRA': { acei: true, mra: true },
            'Loop diuretic': { loop: true },
            'NSAID + β-blocker': { nsaid: true, beta: true },
          };
          setS({ ...START, ...m[o.label] });
        }}
        onReset={() => setS(START)}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Stimuli">
            <Slider label="Isotonic volume loss" value={s.volume} min={-2} max={4} step={0.25} unit="L" onInput={(v) => up({ volume: v })} hint="Negative = expansion" />
            <Slider label="Sodium intake (steady state)" value={s.naIntake} min={10} max={400} step={5} unit="mmol/d" onInput={(v) => up({ naIntake: v })} />
            <Slider label="Bilateral renal artery stenosis" value={s.stenosis} min={0} max={0.9} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onInput={(v) => up({ stenosis: v })} />
          </Panel>
          <Panel title="Drugs">
            <Toggle label="ACE inhibitor" checked={s.acei} onChange={(v) => up({ acei: v })} />
            <Toggle label="ARB" checked={s.arb} onChange={(v) => up({ arb: v })} />
            <Toggle label="Renin inhibitor (aliskiren)" checked={s.aliskiren} onChange={(v) => up({ aliskiren: v })} />
            <Toggle label="MR antagonist" checked={s.mra} onChange={(v) => up({ mra: v })} />
            <Toggle label="NSAID" checked={s.nsaid} onChange={(v) => up({ nsaid: v })} />
            <Toggle label="β-blocker" checked={s.beta} onChange={(v) => up({ beta: v })} />
            <Toggle label="Loop diuretic" checked={s.loop} onChange={(v) => up({ loop: v })} />
          </Panel>
        </div>
        <div>
          <Panel title="The cascade now" note="Each box shows its level relative to normal (amber above, blue below). First minutes to hours after the change.">
            <Pathway ev={ev} s={s} />
          </Panel>
          <div class="grid grid-2">
            <Panel title="Kidney, now">
              <div class="readout-grid">
                <Readout label="GFR" value={ev.kidney.GFR} unit="mL/min" delta={ev.kidney.GFR - n.kidney.GFR} tone={toneFor(ev.kidney.GFR, 90, 170)} />
                <Readout label="Urine Na⁺" value={ev.kidney.urine.exc.Na} unit="mmol/d" delta={ev.kidney.urine.exc.Na - n.kidney.urine.exc.Na} />
                <Readout label="Urine K⁺" value={ev.kidney.urine.exc.K} unit="mmol/d" />
                <Readout label="Urine pH" value={ev.kidney.urine.pH} digits={2} />
              </div>
            </Panel>
            <Panel title={<>After weeks (steady state) <Busy on={st.busy} /></> as unknown as string}>
              {st.ev ? (
                <div class="readout-grid">
                  <Readout label="MAP" value={st.ev.reg.MAP} unit="mmHg" delta={st.ev.reg.MAP - n.reg.MAP} />
                  <Readout label="ECF" value={st.ev.plasma.ecf} digits={1} unit="L" />
                  <Readout label="Plasma K⁺" value={st.ev.plasma.K} digits={1} unit="mmol/L" tone={toneFor(st.ev.plasma.K, 3.5, 5.2, [2.5, 6.5])} />
                  <Readout label="HCO₃⁻" value={st.ev.body.hco3} unit="mmol/L" />
                  <Readout label="Creatinine" value={si.creat(st.ev.body.creat)} unit="µmol/L" />
                  <Readout label="Renin" value={st.ev.reg.hormones.renin} digits={1} unit="×" />
                </div>
              ) : (
                <p class="faint">computing…</p>
              )}
            </Panel>
          </div>
        </div>
      </div>
      <div class="grid grid-2">
        <Predict
          question="An ACE inhibitor lowers angiotensin II. What happens to plasma renin activity?"
          options={['Falls', 'Rises — angiotensin II normally suppresses renin (short-loop feedback), and the fall in pressure stimulates it', 'Unchanged']}
          correct={1}
          explanation="Renin rises with ACE inhibitors and ARBs; it falls with aliskiren (whose activity measure falls although renin concentration rises) and with β-blockers and NSAIDs, which block its release."
        />
        <Predict
          question="Why doesn’t heart failure (high aldosterone) cause K⁺ wasting until diuretics are given?"
          options={['Aldosterone is inactive in heart failure', 'Low distal Na⁺ and water delivery (high proximal reabsorption) offsets aldosterone’s effect on K⁺ secretion; diuretics raise delivery', 'ANP blocks it']}
          correct={1}
          explanation="K⁺ secretion needs both aldosterone and distal delivery. Effective volume depletion raises aldosterone but lowers delivery — the book’s Table 6-3 logic."
        />
      </div>
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>Sodium intake sets renin: low intake raises renin and aldosterone; high intake suppresses them.</p>}
          why={<p>Renin responds to afferent stretch, β₁ sympathetic input and macula densa chloride uptake (via prostaglandins and adenosine). Angiotensin II raises Pgc (efferent), proximal Na⁺ reabsorption, aldosterone and systemic resistance — restoring volume and pressure.</p>}
          change={<p>More renin: more of everything downstream. Block a step and upstream rises (feedback lost) while downstream falls.</p>}
          abnormal={<p>Renovascular hypertension, secondary aldosteronism in heart failure and cirrhosis, hyporeninaemic hypoaldosteronism (diabetes, NSAIDs), primary aldosteronism (renin suppressed).</p>}
          clinical={<p>RAS blockers lower intraglomerular pressure and proteinuria but can raise creatinine and K⁺; combining ACE inhibitor with ARB adds risk without benefit; MRAs add K⁺ risk.</p>}
        />
        <Sources cite={{ rose: [2, 6, 8], evidence: 'clinical', refs: ['carlstrom2015', 'bakris2000', 'fried2013', 'pitt1999'] }} />
      </Panel>
      <Related paths={['/arterioles', '/sodium', '/potassium', '/hormones', '/edema']} />
    </div>
  );
}
