import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related, Toggle } from '../ui/page';
import { Panel, Readout, Slider, Chain, Sources, Predict, LineChart } from '../ui/kit';
import { runKidney } from '../engine/kidney';
import { applyPatch, DEFAULT_PARAMS, type ParamPatch } from '../engine/types';
import { NORMAL } from '../sim/hooks';

interface S {
  map: number;
  myogenic: boolean;
  tgf: boolean;
  angII: boolean;
  loop: boolean;
  sns: number;
  injury: number;
}
const START: S = { map: 93, myogenic: true, tgf: true, angII: true, loop: false, sns: 1, injury: 0 };

function kidneyAt(s: S, map: number) {
  const n = NORMAL();
  const patch: ParamPatch = {
    myogenic: s.myogenic ? 1 : 0,
    tgf: s.tgf ? 1 : 0,
    tubularInjury: s.injury,
    drugs: { furosemide: s.loop ? 1 : 0 },
  };
  const p = applyPatch(DEFAULT_PARAMS, patch);
  // Angiotensin II rises as perfusion falls (renin release) unless blocked.
  const reninResponse = Math.min(8, Math.exp(-3 * (map / 93 - 1)));
  const at1 = s.angII ? reninResponse : 0.1;
  const hormones = { ...n.reg.hormones, at1, angII: at1, renin: reninResponse, sns: s.sns, pg: 0.2 + 0.4 * Math.max(0, at1 - 1) };
  return runKidney({ params: p, plasma: n.plasma, hormones, MAP: map, ureaProduction: 0.28 });
}

export default function Autoregulation() {
  const [s, setS] = useState<S>(START);
  const up = (p: Partial<S>) => setS({ ...s, ...p });
  const k = useMemo(() => kidneyAt(s, s.map), [s]);
  const curve = useMemo(() => {
    const pts: { m: number; gfr: number; rbf: number }[] = [];
    for (let m = 30; m <= 210; m += 6) {
      const r = kidneyAt(s, m);
      pts.push({ m, gfr: r.GFR, rbf: r.RBF });
    }
    return pts;
  }, [s.myogenic, s.tgf, s.angII, s.loop, s.sns, s.injury]);
  const normalCurve = useMemo(() => {
    const pts: { m: number; gfr: number; rbf: number }[] = [];
    for (let m = 30; m <= 210; m += 6) {
      const r = kidneyAt(START, m);
      pts.push({ m, gfr: r.GFR, rbf: r.RBF });
    }
    return pts;
  }, []);
  const k0 = useMemo(() => kidneyAt(START, 93), []);
  const dir = s.map > 100 ? 1 : s.map < 86 ? -1 : 0;
  const inRange = s.map >= 70 && s.map <= 190;

  return (
    <div>
      <PageHead path="/autoregulation" lede="Mean arterial pressure varies all day, yet GFR and renal blood flow barely move. Drag the pressure, watch the afferent arteriole respond, then remove the myogenic response, tubuloglomerular feedback or angiotensin II and see what each contributes." />
      <WhatIf
        options={[
          { label: 'Pressure rises to 160', explain: 'Stretch constricts the afferent arteriole; the extra filtrate reaching the macula densa adds tubuloglomerular feedback. GFR and RBF barely change.' },
          { label: 'Pressure falls to 75', explain: 'The afferent arteriole dilates and angiotensin II constricts the efferent: GFR is protected.' },
          { label: 'Pressure falls to 50', explain: 'Below ~70 mmHg dilation is exhausted; GFR falls steeply and ceases around 40–50 mmHg.' },
          { label: 'Block angiotensin II, pressure 70', explain: 'RBF is still autoregulated but GFR is not: at low pressure GFR depends on efferent constriction (the textbook’s Fig. 2-8 experiment).' },
          { label: 'Loop diuretic, pressure 150', explain: 'Furosemide blocks NKCC2 in the macula densa, silencing tubuloglomerular feedback: autoregulation against a rise in pressure is impaired.' },
          { label: 'Tubular injury', explain: 'Injured kidneys autoregulate poorly: a fall in pressure that a normal kidney would ignore reduces GFR.' },
        ]}
        onApply={(o) => {
          const m: Record<string, Partial<S>> = {
            'Pressure rises to 160': { map: 160 },
            'Pressure falls to 75': { map: 75 },
            'Pressure falls to 50': { map: 50 },
            'Block angiotensin II, pressure 70': { map: 70, angII: false },
            'Loop diuretic, pressure 150': { map: 150, loop: true },
            'Tubular injury': { map: 80, injury: 0.7, myogenic: false },
          };
          setS({ ...START, ...m[o.label] });
        }}
        onReset={() => setS(START)}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Renal perfusion pressure">
            <Slider label="Mean arterial pressure" value={s.map} min={30} max={210} unit="mmHg" onInput={(v) => up({ map: v })} normal={93} />
            <div class="readout-grid">
              <Readout label="GFR" value={k.GFR} unit="mL/min" delta={k.GFR - k0.GFR} tone={k.GFR < 80 ? 'low' : 'normal'} />
              <Readout label="Renal blood flow" value={k.RBF} unit="mL/min" delta={k.RBF - k0.RBF} />
              <Readout label="Afferent resistance" value={k.sides[0].Ra / k0.sides[0].Ra} digits={2} unit="× normal" />
              <Readout label="Efferent resistance" value={k.sides[0].Re / k0.sides[0].Re} digits={2} unit="× normal" />
              <Readout label="Pgc" value={k.Pgc} digits={1} unit="mmHg" />
              <Readout label="Macula densa signal" value={k.maculaDensa} digits={2} unit="× normal" />
            </div>
          </Panel>
          <Panel title="Mechanisms">
            <Toggle label="Myogenic response" checked={s.myogenic} onChange={(v) => up({ myogenic: v })} />
            <Toggle label="Tubuloglomerular feedback" checked={s.tgf} onChange={(v) => up({ tgf: v })} />
            <Toggle label="Angiotensin II (off = ARB/ACE inhibitor)" checked={s.angII} onChange={(v) => up({ angII: v })} />
            <Toggle label="Loop diuretic (blocks macula densa sensing)" checked={s.loop} onChange={(v) => up({ loop: v })} />
            <Slider label="Tubular injury" value={s.injury} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onInput={(v) => up({ injury: v })} />
            <Slider label="Renal sympathetic tone" value={s.sns} min={0.5} max={4} step={0.1} unit="×" onInput={(v) => up({ sns: v })} hint="Neurohumoral vasoconstriction overrides autoregulation" />
          </Panel>
        </div>
        <div>
          <Panel title="The autoregulation curve" note="Solid: your settings. Dashed: normal (hidden underneath when they coincide). The vertical line is the current pressure. The textbook places the lower limit near 70 mmHg.">
            <LineChart
              xLabel="renal perfusion pressure (mmHg)"
              series={[
                { label: 'GFR (mL/min)', points: curve.map((p) => ({ x: p.m, y: p.gfr })), color: '#5ecfba' },
                { label: 'RBF ÷ 8 (mL/min)', points: curve.map((p) => ({ x: p.m, y: p.rbf / 8 })), color: '#6aa9e8' },
                { label: 'normal GFR', points: normalCurve.map((p) => ({ x: p.m, y: p.gfr })), color: '#5ecfba', dashed: true },
                { label: 'normal RBF ÷ 8', points: normalCurve.map((p) => ({ x: p.m, y: p.rbf / 8 })), color: '#6aa9e8', dashed: true },
              ]}
              yMin={0}
              yMax={Math.max(260, ...curve.map((p) => Math.max(p.gfr, p.rbf / 8)))}
              marker={s.map}
              height={260}
            />
          </Panel>
          <div class="grid grid-2">
            <Panel title="Why the GFR is (or isn’t) holding">
              <Chain
                steps={
                  dir === 0
                    ? [{ text: 'Pressure is near normal: nothing needs to change.' }]
                    : dir > 0
                      ? [
                          { text: 'Perfusion pressure rises', direction: 1 },
                          { text: s.myogenic ? 'Afferent wall stretched → myogenic constriction' : 'Myogenic response absent', direction: s.myogenic ? 1 : 0 },
                          { text: s.tgf && !s.loop ? 'Any rise in GFR raises NaCl uptake at the macula densa → adenosine → further afferent constriction' : 'Tubuloglomerular feedback unavailable', direction: s.tgf && !s.loop ? 1 : 0 },
                          { text: inRange ? 'Pgc and GFR held near normal' : 'Beyond the range: GFR rises with pressure', direction: inRange ? 0 : 1 },
                        ]
                      : [
                          { text: 'Perfusion pressure falls', direction: -1 },
                          { text: s.myogenic ? 'Afferent arteriole relaxes' : 'Myogenic response absent', direction: s.myogenic ? -1 : 0 },
                          { text: s.angII ? 'Renin ↑ → angiotensin II constricts the efferent arteriole, holding Pgc up' : 'Angiotensin II blocked: efferent support lost', direction: s.angII ? 1 : 0 },
                          { text: s.map >= 70 ? 'GFR protected' : 'Dilation exhausted: GFR falls with pressure', direction: s.map >= 70 ? 0 : -1 },
                        ]
                }
              />
            </Panel>
            <Predict
              question="An ARB is given and renal perfusion pressure is lowered. Which is better preserved?"
              options={['GFR', 'Renal blood flow', 'Both equally']}
              correct={1}
              explanation="The myogenic response still dilates the afferent arteriole and keeps flow up, but without angiotensin II’s efferent constriction the glomerular pressure falls: GFR autoregulation fails first. Toggle angiotensin II off and look at the low-pressure end of the curve."
            />
          </div>
        </div>
      </div>
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>Between roughly 70 and 180 mmHg, GFR and RBF change little. It is intrinsic to the kidney — a denervated kidney does it.</p>}
          why={<p>The afferent arteriole’s myogenic response and tubuloglomerular feedback (macula densa → adenosine → afferent constriction) adjust resistance to pressure; angiotensin II supports GFR when pressure falls. Its real target may be the flow reaching the distal nephron, whose capacity is limited.</p>}
          change={<p>Raise pressure: afferent constriction. Lower it: afferent dilation plus angiotensin II. Below ~70 mmHg, both fall with pressure.</p>}
          abnormal={<p>Loop diuretics blunt feedback; angiotensin II blockade impairs GFR autoregulation at low pressure; tubular injury and neurohumoral vasoconstriction override it.</p>}
          clinical={<p>Lowering blood pressure in bilateral renal artery stenosis, or giving an ACE inhibitor/ARB when perfusion is marginal, can reduce GFR. Glucosuria impairs feedback, adding to fluid losses in hyperglycaemic crises.</p>}
        />
        <Sources cite={{ rose: [2], evidence: 'physiology', refs: ['carlstrom2015', 'loutzenhiser2006'] }} />
      </Panel>
      <Related paths={['/gfr', '/arterioles', '/raas', '/loop', '/aki']} />
    </div>
  );
}
