import { useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related } from '../ui/page';
import { Panel, Readout, Slider, Chain, Sources, Predict } from '../ui/kit';
import { EquationCard } from '../ui/EquationCard';
import { freeWater, type FreeWaterInput } from '../sim/osmoregulation';

const START: FreeWaterInput = { volume: 1.5, uosm: 600, posm: 285, una: 70, uk: 40, pna: 140 };

const CASES: { label: string; patch: Partial<FreeWaterInput>; explain: string }[] = [
  { label: 'Normal', patch: {}, explain: 'A concentrated urine removing a little free water — the kidney trimming a small water surplus.' },
  { label: 'Water load', patch: { volume: 8, uosm: 70, una: 15, uk: 10 }, explain: 'Both measures agree: a large dilute urine is removing free water fast. This is how a water load is disposed of.' },
  { label: 'Central diabetes insipidus', patch: { volume: 10, uosm: 84, posm: 300, una: 20, uk: 15, pna: 147 }, explain: 'The book’s worked example: of 10 L, 7.2 L is pure water leaving the body (Cosm 2.8 L). The plasma sodium rises unless thirst matches it.' },
  { label: 'Urea diuresis (high-protein feeds)', patch: { volume: 4, uosm: 580, una: 5, uk: 43, pna: 144, posm: 320 }, explain: 'The trap. The urine looks concentrated and the classical formula says water is being retained — but the electrolytes are low, so ~2.7 L/day of electrolyte-free water is being lost. This is how hypernatraemia develops on a concentrated urine.' },
  { label: 'SIADH', patch: { volume: 1, uosm: 540, una: 80, uk: 50, pna: 130, posm: 268 }, explain: 'Urine Na⁺ + K⁺ (130) equals the plasma Na⁺: essentially none of this urine is electrolyte-free water, so it cannot correct the hyponatraemia. Restricting water or raising solute is needed.' },
  { label: 'Heart failure, same urine osmolality', patch: { volume: 1, uosm: 540, una: 10, uk: 50, pna: 130, posm: 268 }, explain: 'Identical urine osmolality to SIADH, but avid Na⁺ retention means Na⁺ + K⁺ is only 60: this urine does remove free water and tends to correct the sodium, even though it looks the same on a dipstick.' },
  { label: 'Correcting hyponatraemia too fast', patch: { volume: 6, uosm: 80, una: 20, uk: 15, pna: 122, posm: 250 }, explain: 'Once the ADH stimulus is removed, a brisk water diuresis begins. 6 L of electrolyte-poor urine raises the plasma sodium quickly — the setting in which overcorrection and osmotic demyelination occur.' },
];

export default function FreeWater() {
  const [s, setS] = useState<FreeWaterInput>(START);
  const up = (p: Partial<FreeWaterInput>) => setS({ ...s, ...p });
  const r = freeWater(s);
  const electrolytes = s.una + s.uk;
  // How fast the plasma Na+ moves: losing electrolyte-free water concentrates the remaining body water.
  const tbw = 42;
  const naRate = (-r.efwc * s.pna) / tbw;

  return (
    <div>
      <PageHead
        path="/free-water"
        lede="A urine can be split into an isosmotic part and a water part. Do that with total solute and you learn whether the urine is dilute; do it with sodium and potassium and you learn what the plasma sodium will actually do — and those two answers often disagree."
      />
      <WhatIf
        options={CASES.map((c) => ({ label: c.label, explain: c.explain }))}
        onApply={(o) => setS({ ...START, ...CASES.find((c) => c.label === o.label)!.patch })}
        onReset={() => setS(START)}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="The urine">
            <Slider label="Urine volume" value={s.volume} min={0.3} max={15} step={0.1} unit="L/day" onInput={(v) => up({ volume: v })} />
            <Slider label="Urine osmolality" value={s.uosm} min={40} max={1200} step={10} unit="mOsm/kg" onInput={(v) => up({ uosm: v })} />
            <Slider label="Urine Na⁺" value={s.una} min={0} max={200} step={5} unit="mmol/L" onInput={(v) => up({ una: v })} />
            <Slider label="Urine K⁺" value={s.uk} min={0} max={120} step={5} unit="mmol/L" onInput={(v) => up({ uk: v })} />
          </Panel>
          <Panel title="The plasma">
            <Slider label="Plasma Na⁺" value={s.pna} min={105} max={175} step={1} unit="mmol/L" onInput={(v) => up({ pna: v })} />
            <Slider label="Plasma osmolality" value={s.posm} min={240} max={340} step={1} unit="mOsm/kg" onInput={(v) => up({ posm: v })} />
          </Panel>
        </div>
        <div>
          <Panel title="Two ways of splitting the same urine">
            <div class="grid grid-2">
              <div>
                <h4 style={{ margin: '0 0 6px' }}>By total solute</h4>
                <div class="readout-grid">
                  <Readout label="Osmolal clearance" value={r.cosm} digits={2} unit="L/day" title="the part of the urine that is isosmotic to plasma" />
                  <Readout label={r.ch2o >= 0 ? 'Free-water clearance' : 'Free-water reabsorption'} value={Math.abs(r.ch2o)} digits={2} unit="L/day" tone={r.ch2o >= 0 ? 'high' : 'low'} />
                </div>
                <p class="control-hint">Answers: is the urine dilute or concentrated?</p>
              </div>
              <div>
                <h4 style={{ margin: '0 0 6px' }}>By sodium and potassium</h4>
                <div class="readout-grid">
                  <Readout label="Urine Na⁺ + K⁺" value={electrolytes} unit="mmol/L" tone={electrolytes > s.pna ? 'high' : 'low'} title="compare this with the plasma Na⁺" />
                  <Readout label="Electrolyte-free water clearance" value={r.efwc} digits={2} unit="L/day" tone={r.efwc > 0 ? 'high' : r.efwc < 0 ? 'low' : 'good'} />
                </div>
                <p class="control-hint">Answers: what will the plasma sodium do?</p>
              </div>
            </div>
            <p class={r.verdict === 'steady' ? 'callout' : r.verdict === 'rising' ? 'callout danger' : 'callout good'} style={{ marginTop: 10 }}>
              {r.verdict === 'rising'
                ? `Urine Na⁺ + K⁺ (${electrolytes}) is below the plasma Na⁺ (${s.pna}): this urine is removing ${r.efwc.toFixed(2)} L/day of electrolyte-free water, so the plasma Na⁺ will rise — about ${Math.abs(naRate).toFixed(1)} mmol/L per day if nothing is drunk.`
                : r.verdict === 'falling'
                  ? `Urine Na⁺ + K⁺ (${electrolytes}) exceeds the plasma Na⁺ (${s.pna}): this urine is adding ${Math.abs(r.efwc).toFixed(2)} L/day of free water to the body, so the plasma Na⁺ will fall by about ${Math.abs(naRate).toFixed(1)} mmol/L per day.`
                  : 'Urine Na⁺ + K⁺ is close to the plasma Na⁺: this urine is neutral for the plasma sodium, whatever its osmolality.'}
            </p>
            {Math.sign(r.ch2o) !== Math.sign(r.efwc) && Math.abs(r.ch2o) > 0.1 && Math.abs(r.efwc) > 0.1 && (
              <p class="note caution">
                The two measures disagree. By total solute this urine appears to be {r.ch2o > 0 ? 'removing' : 'adding'} water; by electrolytes it is {r.efwc > 0 ? 'removing' : 'adding'} it. The difference is made up of urea and ammonium, which cross cell membranes and so do not affect the plasma sodium.
              </p>
            )}
          </Panel>
          <Panel title="Where the urine volume goes" note="The urine split into its isosmotic part and its free-water part — the block diagram from the chapter.">
            <UrineBlocks volume={s.volume} cosm={r.cosm} efwc={r.efwc} />
          </Panel>
          <div class="grid grid-2">
            <Panel title="The rule at the bedside">
              <Chain
                steps={[
                  { text: 'Measure urine Na⁺ and K⁺' },
                  { text: 'Add them, and compare with the plasma Na⁺' },
                  { text: 'Sum below plasma Na⁺ → the urine removes water → plasma Na⁺ rises', direction: 1 },
                  { text: 'Sum above plasma Na⁺ → the urine adds water → plasma Na⁺ falls', direction: -1 },
                  { text: 'Urine osmolality alone cannot tell you which', direction: 0 },
                ]}
              />
            </Panel>
            <Panel title="Why urea does not count">
              <ul class="muted" style={{ fontSize: '0.88rem', marginTop: 0 }}>
                <li>Plasma Na⁺ is set by exchangeable Na⁺ + K⁺ over total body water.</li>
                <li>Urea crosses cell membranes freely, so excreting it lowers the blood urea but moves no water between compartments.</li>
                <li>A urine concentrated with urea is therefore electrolyte-poor water leaving the body — it raises the plasma sodium.</li>
                <li>Ammonium salts behave the same way.</li>
              </ul>
            </Panel>
          </div>
        </div>
      </div>
      <div class="grid grid-2">
        <Predict
          question="Urine 4 L/day at 580 mOsm/kg, Na⁺ 5 and K⁺ 43, plasma Na⁺ 144 on high-protein feeds. Is the kidney adding or removing water?"
          options={['Adding ~2 L/day — the urine is concentrated', 'Removing ~2.7 L/day of electrolyte-free water', 'Neither', 'Impossible to tell']}
          correct={1}
          explanation="The book's case. Total-solute arithmetic says +2 L because the urine is concentrated — with urea. The electrolytes are only 48 against a plasma Na⁺ of 144, so 2.7 L/day of free water is being lost and the sodium climbs to 156."
        />
        <Predict
          question="Two patients pass 1 L/day at 540 mOsm/kg with a plasma Na⁺ of 130 — SIADH (Na⁺ 80, K⁺ 50) and heart failure (Na⁺ 10, K⁺ 50). Who is more likely to stay hyponatraemic?"
          options={['Heart failure', 'SIADH — its urine electrolytes equal the plasma Na⁺, so the urine removes no free water', 'Both the same', 'Neither']}
          correct={1}
          explanation="Identical osmolality, opposite effects. This is why fluid restriction alone often fails in SIADH with a high urine electrolyte concentration, and why salt or urea is added."
        />
      </div>
      <div class="grid grid-2">
        <EquationCard eq="ch2o" compact />
        <EquationCard eq="efwc" compact />
      </div>
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>A urine can be split into an isosmotic part carrying all the solute and a part that is pure water — either being removed (dilute urine) or having been returned to the body (concentrated urine).</p>}
          why={<p>The loop generates solute-free water by reabsorbing NaCl without water; the collecting duct then either lets that water go (no ADH) or returns it (ADH).</p>}
          change={<p>Raise ADH and the water part becomes negative — water is returned. Raise solute excretion and the isosmotic part grows.</p>}
          abnormal={<p>When the urine is concentrated by urea rather than electrolytes, the two calculations disagree, and only the electrolyte-free version predicts the plasma sodium.</p>}
          clinical={<p>Compare urine Na⁺ + K⁺ with plasma Na⁺ to know which way the sodium will move; use it to plan correction and to anticipate the brisk diuresis that follows removing an ADH stimulus.</p>}
        />
        <Sources cite={{ rose: [9, 23], evidence: 'physiology', refs: ['rose1986', 'sterns2015', 'spasovski2014'] }} />
      </Panel>
      <Related paths={['/adh', '/urine-osmolality', '/hyponatremia', '/water-disorders', '/body-water']} />
    </div>
  );
}

/**
 * The chapter's block diagram (Fig. 9-2). A dilute urine is the osmolal clearance plus the free
 * water being excreted; a concentrated urine is the osmolal clearance minus the free water that
 * was reabsorbed, so the bar extends beyond the urine actually passed.
 */
function UrineBlocks({ volume, cosm, efwc }: { volume: number; cosm: number; efwc: number }) {
  const w = 540;
  const total = Math.max(volume, cosm, 0.1);
  const scale = w / total;
  const concentrated = cosm > volume;
  const isoWidth = Math.min(cosm, volume) * scale;
  const freeWidth = concentrated ? 0 : (volume - cosm) * scale;
  const returnedWidth = concentrated ? (cosm - volume) * scale : 0;
  return (
    <svg viewBox="0 0 600 140" class="diagram" role="img" aria-label="Urine volume split into isosmotic and free-water parts">
      <rect x={30} y={36} width={Math.max(2, isoWidth)} height={46} rx={5} fill="#6aa9e8" opacity={0.85} />
      {freeWidth > 1 && <rect x={30 + isoWidth} y={36} width={freeWidth} height={46} rx={5} fill="#5ecfba" opacity={0.85} />}
      {returnedWidth > 1 && <rect x={30 + isoWidth} y={36} width={returnedWidth} height={46} rx={5} fill="#e07b6a" opacity={0.25} stroke="#e07b6a" stroke-dasharray="5 3" />}
      {isoWidth > 60 && (
        <text x={30 + isoWidth / 2} y={64} text-anchor="middle" class="svg-label" style={{ fill: '#0b1b27', fontWeight: 700 }}>
          {Math.min(cosm, volume).toFixed(2)} L isosmotic
        </text>
      )}
      {freeWidth > 70 && (
        <text x={30 + isoWidth + freeWidth / 2} y={64} text-anchor="middle" class="svg-label" style={{ fill: '#0b1b27', fontWeight: 700 }}>
          {(volume - cosm).toFixed(2)} L free water out
        </text>
      )}
      {returnedWidth > 70 && (
        <text x={30 + isoWidth + returnedWidth / 2} y={64} text-anchor="middle" class="svg-label" style={{ fill: '#e07b6a' }}>
          {(cosm - volume).toFixed(2)} L returned
        </text>
      )}
      <line x1={30} x2={30 + Math.max(2, isoWidth) + freeWidth} y1={94} y2={94} stroke="var(--muted)" />
      <text x={30} y={110} class="svg-small">
        urine passed: {volume.toFixed(2)} L/day{concentrated ? ' (the dashed block was reabsorbed before it left)' : ''}
      </text>
      <text x={30} y={128} class="svg-small">
        Electrolyte-free water: {efwc >= 0 ? `${efwc.toFixed(2)} L/day leaving the body — plasma Na⁺ rises` : `${Math.abs(efwc).toFixed(2)} L/day returned to the body — plasma Na⁺ falls`}
      </text>
    </svg>
  );
}
