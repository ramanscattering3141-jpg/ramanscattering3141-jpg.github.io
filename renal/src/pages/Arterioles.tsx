import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related, Toggle } from '../ui/page';
import { Panel, Readout, Slider, Chain, Sources, Predict, LineChart, toneFor } from '../ui/kit';
import { ArterioleSchematic } from '../ui/ArterioleSchematic';
import { acute, makeParams, NORMAL } from '../sim/hooks';
import { depletedBody } from '../engine/scenarios';
import { GLOM_DEFAULT, isolatedGlomerulus } from '../sim/glomerular';
import { GLOM_REF } from '../engine/glomerulus';
import { useMode } from '../ui/mode';

interface S {
  aff: number;
  eff: number;
  nsaid: boolean;
  acei: boolean;
  arb: boolean;
  ccb: boolean;
  volume: number; // litres of isotonic loss
  sns: number;
  stenosis: number;
  hf: boolean;
}

const START: S = { aff: 1, eff: 1, nsaid: false, acei: false, arb: false, ccb: false, volume: 0, sns: 1, stenosis: 0, hf: false };

export default function Arterioles() {
  const { mode } = useMode();
  const [s, setS] = useState<S>(START);
  const up = (patch: Partial<S>) => setS({ ...s, ...patch });

  const ev = useMemo(() => {
    const p = makeParams({
      afferentTone: s.aff,
      efferentTone: s.eff,
      snsOverride: s.sns,
      stenosisL: s.stenosis,
      stenosisR: s.stenosis,
      cardiacFunction: s.hf ? 0.55 : 1,
      drugs: { nsaid: s.nsaid ? 1 : 0, acei: s.acei ? 1 : 0, arb: s.arb ? 1 : 0, ccb: s.ccb ? 1 : 0 },
    });
    return acute(p, depletedBody(p, s.volume));
  }, [s]);
  const n = NORMAL();
  const k = ev.kidney;
  const side = k.sides[0];
  const RaRel = side.Ra / (n.kidney.sides[0].Ra || GLOM_REF.Ra);
  const ReRel = side.Re / (n.kidney.sides[0].Re || GLOM_REF.Re);

  // Pure-physics sweeps (isolated glomerulus, other factors normal)
  const effSweep = useMemo(() => {
    const pts = [];
    for (let e = 0.3; e <= 10.01; e *= 1.12) {
      const g = isolatedGlomerulus({ ...GLOM_DEFAULT, eff: e });
      pts.push({ e, gfr: g.GFR, rpf: g.RPF, ff: g.FF });
    }
    return pts;
  }, []);
  const affSweep = useMemo(() => {
    const pts = [];
    for (let a = 0.4; a <= 3.01; a *= 1.08) {
      const g = isolatedGlomerulus({ ...GLOM_DEFAULT, aff: a });
      pts.push({ a, gfr: g.GFR, rpf: g.RPF });
    }
    return pts;
  }, []);

  const notes: string[] = [];
  if (s.volume > 0.5 || s.hf) notes.push('Effective volume is low: sympathetic tone and angiotensin II rise, constricting the afferent and (more) the efferent arteriole. RPF falls; GFR is partly defended by the higher Pgc, so the filtration fraction rises.');
  if (s.acei || s.arb) notes.push('Blocking angiotensin II removes its efferent constriction: Pgc falls. Harmless when perfusion is normal; when GFR depends on angiotensin II (low volume, stenosis, heart failure) GFR falls and creatinine rises.');
  if (s.nsaid) notes.push('Blocking prostaglandin synthesis removes the brake on vasoconstriction. With normal volume the effect is small; with high angiotensin II and noradrenaline, renal flow and the flow-dependent GFR drop.');
  if (s.ccb) notes.push('Dihydropyridine calcium channel blockers dilate the afferent arteriole (which has voltage-gated calcium channels; the efferent largely does not), so more systemic pressure reaches the glomerulus.');
  if (s.stenosis > 0.5) notes.push('The stenosis drops the pressure reaching the glomeruli; renin rises and angiotensin II-dependent efferent tone keeps GFR up — until an ACE inhibitor or ARB removes it.');
  if (s.sns > 1.5) notes.push('Noradrenaline constricts the afferent arteriole directly and, via β₁-mediated renin release, the efferent indirectly.');

  return (
    <div>
      <PageHead path="/arterioles" lede="The glomerulus has a tap on each side. Turn them, then add the drugs and physiological states that turn them for you — and see why an ACE inhibitor or an NSAID can be harmless in one patient and precipitate kidney injury in another." />
      <WhatIf
        options={[
          { label: 'Constrict afferent', explain: 'Pgc, RBF and GFR fall together; the filtration fraction stays about the same.' },
          { label: 'Moderate efferent constriction', explain: 'Pgc and GFR rise, RBF falls: the filtration fraction rises.' },
          { label: 'Severe efferent constriction', explain: 'RBF falls so far that GFR stops rising and starts to fall, even though Pgc is high.' },
          { label: 'Volume depletion + NSAID', explain: 'Prostaglandins were holding the kidney open against angiotensin II and noradrenaline. Removing them drops RBF and GFR.' },
          { label: 'Volume depletion + ACE inhibitor', explain: 'GFR depended on angiotensin II’s efferent constriction. Take it away and Pgc and GFR fall.' },
          { label: 'Bilateral stenosis + ACE inhibitor', explain: 'The classic cause of an ACE inhibitor-induced rise in creatinine.' },
        ]}
        onApply={(o) => {
          const m: Record<string, Partial<S>> = {
            'Constrict afferent': { aff: 1.7 },
            'Moderate efferent constriction': { eff: 2 },
            'Severe efferent constriction': { eff: 7 },
            'Volume depletion + NSAID': { volume: 3, nsaid: true },
            'Volume depletion + ACE inhibitor': { volume: 3, acei: true },
            'Bilateral stenosis + ACE inhibitor': { stenosis: 0.8, acei: true },
          };
          setS({ ...START, ...m[o.label] });
        }}
        onReset={() => setS(START)}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Arteriolar tone">
            <Slider label="Afferent resistance" value={s.aff} min={0.4} max={3} step={0.05} unit="× own tone" onInput={(v) => up({ aff: v })} />
            <Slider label="Efferent resistance" value={s.eff} min={0.3} max={8} step={0.05} unit="× own tone" onInput={(v) => up({ eff: v })} />
          </Panel>
          <Panel title="Add a state or a drug">
            <Slider label="Isotonic volume loss" value={s.volume} min={0} max={4} step={0.25} unit="L" onInput={(v) => up({ volume: v })} />
            <Slider label="Sympathetic activation" value={s.sns} min={0.5} max={4} step={0.1} unit="×" onInput={(v) => up({ sns: v })} />
            <Slider label="Bilateral renal artery stenosis" value={s.stenosis} min={0} max={0.9} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onInput={(v) => up({ stenosis: v })} />
            <Toggle label="Heart failure (low cardiac output)" checked={s.hf} onChange={(v) => up({ hf: v })} />
            <Toggle label="NSAID (blocks prostaglandins)" checked={s.nsaid} onChange={(v) => up({ nsaid: v })} />
            <Toggle label="ACE inhibitor" checked={s.acei} onChange={(v) => up({ acei: v })} />
            <Toggle label="ARB" checked={s.arb} onChange={(v) => up({ arb: v })} />
            <Toggle label="Dihydropyridine CCB (afferent dilator)" checked={s.ccb} onChange={(v) => up({ ccb: v })} />
          </Panel>
        </div>
        <div>
          <Panel title="The glomerulus right now" note="Vessel width follows resistance; the glomerulus colour follows its pressure. Everything here is the integrated model — hormones, autoregulation and feedback included — in the first minutes after the change.">
            <ArterioleSchematic ra={RaRel} re={ReRel} pgc={k.Pgc} gfr={k.GFR} rbf={k.RBF} />
            <div class="readout-grid">
              <Readout label="GFR" value={k.GFR} unit="mL/min" delta={k.GFR - n.kidney.GFR} tone={toneFor(k.GFR, 90, 170, [40, 400])} />
              <Readout label="Renal blood flow" value={k.RBF} unit="mL/min" delta={k.RBF - n.kidney.RBF} />
              <Readout label="Pgc" value={k.Pgc} digits={1} unit="mmHg" delta={k.Pgc - n.kidney.Pgc} deltaDigits={1} />
              <Readout label="Filtration fraction" value={k.FF * 100} digits={1} unit="%" delta={(k.FF - n.kidney.FF) * 100} deltaDigits={1} />
              <Readout label="Peritubular π" value={k.piPtc} digits={1} unit="mmHg" />
              <Readout label="Mean arterial pressure" value={ev.reg.MAP} unit="mmHg" />
              <Readout label="Renin" value={ev.reg.hormones.renin} digits={1} unit="× normal" tone={ev.reg.hormones.renin > 2 ? 'high' : 'normal'} />
              <Readout label="AT1 signalling" value={ev.reg.hormones.at1} digits={2} unit="× normal" />
              <Readout label="Prostaglandins" value={ev.reg.hormones.pg / 0.2} digits={1} unit="× normal" />
              <Readout label="Sympathetic tone" value={ev.reg.hormones.sns} digits={1} unit="× normal" />
              {mode === 'quantitative' && <Readout label="Urine Na⁺" value={k.urine.Na} unit="mmol/L" />}
              {mode === 'quantitative' && <Readout label="FENa" value={k.FE.Na * 100} digits={2} unit="%" />}
            </div>
          </Panel>
          {notes.length > 0 && (
            <Panel title="What is happening">
              <Chain steps={notes.map((t) => ({ text: t }))} />
            </Panel>
          )}
          <div class="grid grid-2">
            <Panel title="Efferent resistance: a biphasic effect" note="Isolated glomerulus, everything else normal. GFR rises then falls; plasma flow falls throughout.">
              <LineChart
                xLabel="efferent resistance (× normal, log scale)"
                series={[
                  { label: 'GFR', axis: 'GFR (mL/min)', points: effSweep.map((p) => ({ x: Math.log2(p.e), y: p.gfr })), color: 'var(--c-teal)' },
                  { label: 'Renal plasma flow', axis: 'Renal plasma flow (mL/min)', points: effSweep.map((p) => ({ x: Math.log2(p.e), y: p.rpf })), color: 'var(--c-blue)' },
                ]}
                marker={Math.log2(Math.max(0.3, s.eff))}
                yMin={0}
                xFormat={(x) => `×${Math.pow(2, x).toFixed(Math.pow(2, x) < 2 ? 1 : 0)}`}
              />
            </Panel>
            <Panel title="Afferent resistance: GFR and flow move together">
              <LineChart
                xLabel="afferent resistance (× normal, log scale)"
                series={[
                  { label: 'GFR', axis: 'GFR (mL/min)', points: affSweep.map((p) => ({ x: Math.log2(p.a), y: p.gfr })), color: 'var(--c-teal)' },
                  { label: 'Renal plasma flow', axis: 'Renal plasma flow (mL/min)', points: affSweep.map((p) => ({ x: Math.log2(p.a), y: p.rpf })), color: 'var(--c-blue)' },
                ]}
                marker={Math.log2(Math.max(0.4, s.aff))}
                yMin={0}
                xFormat={(x) => `×${Math.pow(2, x).toFixed(1)}`}
              />
            </Panel>
          </div>
        </div>
      </div>
      <div class="grid grid-2">
        <Predict
          question="A patient with cirrhosis and ascites is given ibuprofen. Normal volume status before the drug would have predicted little effect. What happens here?"
          options={['GFR unchanged', 'GFR falls, perhaps by half', 'GFR rises']}
          correct={1}
          explanation="In cirrhosis angiotensin II and noradrenaline are high and renal prostaglandins are holding renal flow up. Removing them leaves the vasoconstrictors unopposed; in one study creatinine clearance fell from 73 to 32 mL/min. Reproduce it here: add volume loss, then the NSAID."
        />
        <Predict
          question="Why does an ACE inhibitor raise the creatinine by 20% in one patient and not at all in another?"
          options={['Different doses', 'It depends on how angiotensin II-dependent glomerular pressure is', 'Random variation']}
          correct={1}
          explanation="With normal perfusion, angiotensin II contributes little to Pgc and the ACE inhibitor barely changes GFR. With renal artery stenosis, volume depletion or low cardiac output, GFR is being held up by efferent constriction; removing it lowers Pgc."
        />
      </div>
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>About 85% of renal vascular resistance sits in the two arterioles; together they set a glomerular pressure near 45 mmHg with a flow of ~1.1 L/min.</p>}
          why={<p>Resistance before the capillary drops pressure before it; resistance after it holds pressure up inside it. Both raise total resistance, so both lower flow.</p>}
          change={<p>Afferent: GFR and RBF move together. Efferent: they move in opposite directions (so filtration fraction changes) — until severe constriction makes flow limiting.</p>}
          abnormal={<p>Effective volume depletion makes GFR depend on angiotensin II (efferent) and on prostaglandins (both). Blocking either can precipitate acute kidney injury.</p>}
          clinical={<p>Expect a rise in creatinine of up to ~30% after starting an ACE inhibitor or ARB in CKD; larger rises suggest volume depletion or renovascular disease. Avoid NSAIDs in heart failure, cirrhosis, CKD and volume depletion — and avoid combining them with RAS blockers and diuretics.</p>}
        />
        <Sources cite={{ rose: [2], evidence: 'clinical', refs: ['whelton1999', 'lapi2013', 'bakris2000'] }} />
      </Panel>
      <Related paths={['/gfr', '/autoregulation', '/raas', '/aki', '/ckd', '/edema']} />
    </div>
  );
}
