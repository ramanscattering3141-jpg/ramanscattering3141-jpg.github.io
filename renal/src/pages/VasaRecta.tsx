import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related } from '../ui/page';
import { Panel, Readout, Slider, Chain, Sources, Predict, LineChart } from '../ui/kit';
import { CC_DEFAULT, interstitium, runCC } from '../sim/countercurrent';
import { nephronRun } from '../sim/nephron';

export default function VasaRecta() {
  const [flow, setFlow] = useState(1); // medullary blood flow, × normal
  const [hairpin, setHairpin] = useState(true);
  const washout = 0.01 * Math.pow(flow, 1.3) * (hairpin ? 1 : 6);
  const cc = useMemo(() => runCC({ ...CC_DEFAULT, washout }, 700), [washout]);
  const normal = useMemo(() => runCC(CC_DEFAULT, 700), []);
  const inter = interstitium(cc);
  const n = inter.length;
  // Blood in the vasa recta lags the interstitium: descending blood slightly below, ascending slightly above.
  const lag = 18 * flow;
  const dvr = inter.map((v, i) => (i === 0 ? 300 : v - lag * (hairpin ? 1 : 0)));
  const avr = inter.map((v) => (hairpin ? v + lag : v));
  const leaving = hairpin ? Math.min(avr[0], 290 + 35 * flow) : inter[n - 1];
  // Engine: maximal urine osmolality against medullary blood flow.
  const sweep = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    for (let f = 0.3; f <= 2.2; f += 0.1) {
      const r = nephronRun({ vasaRecta: f, hormones: { adh: 8, aqp2: 1 } });
      pts.push({ x: f, y: r.medullaTarget });
    }
    return pts;
  }, []);
  const depth = (arr: number[]) => arr.map((y, i) => ({ x: (i / (arr.length - 1)) * 100, y }));

  return (
    <div>
      <PageHead path="/vasa-recta" lede="The medulla must be supplied with blood and must return the water and salt the tubules reabsorb there — without washing away the gradient the loop has built. The hairpin vasa recta manage it by countercurrent exchange. Change medullary flow, or straighten the hairpin, and watch the gradient survive or collapse." />
      <WhatIf
        options={[
          { label: 'Osmotic diuresis (↑ medullary flow)', explain: 'Mannitol or glucosuria raises medullary blood flow; more solute leaves the medulla and papillary osmolality falls, so less water leaves the descending limb and less NaCl the thin ascending limb.' },
          { label: 'Straight capillaries (no hairpin)', explain: 'If blood left the medulla at the papilla, it would carry away solute at papillary osmolality. Exchange depends on the hairpin geometry.' },
          { label: 'Low medullary flow', explain: 'Less washout preserves the gradient — but the medulla, already hypoxic, has less oxygen margin.' },
        ]}
        onApply={(o) => {
          if (o.label.startsWith('Osmotic')) {
            setFlow(2);
            setHairpin(true);
          } else if (o.label.startsWith('Straight')) {
            setFlow(1);
            setHairpin(false);
          } else {
            setFlow(0.5);
            setHairpin(true);
          }
        }}
        onReset={() => {
          setFlow(1);
          setHairpin(true);
        }}
      />
      <div class="grid grid-sidebar">
        <div>
          <Panel title="Controls">
            <Slider label="Medullary blood flow" value={flow} min={0.2} max={3} step={0.05} unit="× normal" onInput={setFlow} hint="Normally ~6% of renal blood flow" />
            <div class="btn-row">
              <button class={hairpin ? 'active' : ''} onClick={() => setHairpin(true)}>
                Hairpin (exchange)
              </button>
              <button class={!hairpin ? 'active' : ''} onClick={() => setHairpin(false)}>
                Straight through
              </button>
            </div>
            <div class="readout-grid">
              <Readout label="Papillary osmolality" value={inter[n - 1]} unit="mOsm/kg" delta={inter[n - 1] - interstitium(normal)[n - 1]} />
              <Readout label="Blood leaving medulla" value={leaving} unit="mOsm/kg" />
              <Readout label="Maximal urine" value={cc.cd[n - 1]} unit="mOsm/kg" />
            </div>
          </Panel>
          <Panel title="Multiplication vs exchange">
            <table>
              <thead>
                <tr>
                  <th />
                  <th>Loop of Henle</th>
                  <th>Vasa recta</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Creates the gradient?</td>
                  <td>Yes (multiplier)</td>
                  <td>No (exchanger)</td>
                </tr>
                <tr>
                  <td>Energy</td>
                  <td>Active NaCl transport in TAL</td>
                  <td>None: passive diffusion down existing gradients</td>
                </tr>
                <tr>
                  <td>Permeability</td>
                  <td>Asymmetric limbs</td>
                  <td>Both limbs permeable to water and solute</td>
                </tr>
                <tr>
                  <td>Net job</td>
                  <td>Deposit NaCl in the medulla</td>
                  <td>Remove reabsorbed water and solute, keep the gradient</td>
                </tr>
              </tbody>
            </table>
          </Panel>
        </div>
        <div>
          <Panel title="Osmolality in the vasa recta and interstitium" note="Descending blood gains solute and loses water; ascending blood gives the solute back. With a hairpin, blood returns to the cortex only slightly hypertonic (~325 mOsm/kg).">
            <LineChart
              xLabel="depth: cortex (0) → papilla (100)"
              series={[
                { label: 'Interstitium', points: depth(inter), color: '#f2b134' },
                { label: 'Descending vasa recta', points: depth(dvr), color: '#e4696b' },
                { label: 'Ascending vasa recta', points: depth(avr), color: '#6aa9e8' },
                { label: 'Normal interstitium', points: depth(interstitium(normal)), color: '#f2b134', dashed: true },
              ]}
              yMin={200}
              height={250}
            />
          </Panel>
          <div class="grid grid-2">
            <Panel title="Whole-kidney model: papillary osmolality vs medullary flow" note="From the integrated nephron model with maximal ADH.">
              <LineChart xLabel="medullary blood flow (× normal)" series={[{ label: 'Papillary osmolality', points: sweep, color: '#f2b134' }]} marker={flow} />
            </Panel>
            <Panel title="Why flow washes out the gradient">
              <Chain
                steps={[
                  { text: 'Medullary blood flow rises', direction: flow > 1.1 ? 1 : flow < 0.9 ? -1 : 0 },
                  { text: 'More blood leaves at above-plasma osmolality, carrying solute out', direction: flow > 1.1 ? 1 : flow < 0.9 ? -1 : 0 },
                  { text: 'Papillary osmolality falls', direction: flow > 1.1 ? -1 : flow < 0.9 ? 1 : 0 },
                  { text: 'Less water leaves the descending limb → lower luminal NaCl at the hairpin', direction: flow > 1.1 ? -1 : 0 },
                  { text: 'Less passive NaCl exit from the thin ascending limb', direction: flow > 1.1 ? -1 : 0 },
                  { text: 'Higher urine volume and Na⁺ excretion; lower maximal urine osmolality', direction: flow > 1.1 ? 1 : 0 },
                ]}
              />
            </Panel>
          </div>
        </div>
      </div>
      <div class="grid grid-2">
        <Predict
          question="What removes the water reabsorbed from the medullary collecting duct, if Starling forces don’t drive countercurrent exchange?"
          options={['Nothing — it accumulates', 'The ascending vasa recta: high oncotic (~26 mmHg) and low hydraulic (~9 mmHg) pressure favour uptake, so ascending flow is nearly twice descending', 'The lymphatics only']}
          correct={1}
          explanation="Exchange (solute in and out along the hairpin) is driven by concentration gradients; net removal of reabsorbed fluid is driven by Starling forces in the ascending vessels."
        />
        <Predict
          question="Why does the hairpin arrangement also make the medulla hypoxic?"
          options={['It doesn’t', 'Oxygen shunts from descending to ascending vessels just as solute does, so little reaches the inner medulla', 'Red cells cannot enter the vasa recta']}
          correct={1}
          explanation="The same exchange that traps solute short-circuits oxygen. Outer-medullary PO₂ can be 10–20 mmHg — part of why the thick ascending limb and S3 segment are vulnerable to ischaemic injury."
        />
      </div>
      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>The vasa recta carry ~6% of renal blood flow, follow a hairpin path and return blood to the cortex at ~325 mOsm/kg.</p>}
          why={<p>They are freely permeable; solute entering the descending vessel leaves again from the ascending one, water does the reverse — exchange preserves the gradient but cannot create it.</p>}
          change={<p>Increase flow and more solute escapes: washout. Remove the hairpin and the medulla would lose solute at papillary concentration.</p>}
          abnormal={<p>Osmotic diuresis raises medullary flow and lowers papillary osmolality; vasodilators may do likewise.</p>}
          clinical={<p>Polyuria of osmotic diuresis; limited concentrating ability after mannitol or glucosuria; medullary hypoxia underlies vulnerability of the outer medulla in ischaemic AKI.</p>}
        />
        <Sources cite={{ rose: [4], evidence: 'physiology', refs: ['pallone2003'] }} />
      </Panel>
      <Related paths={['/countercurrent', '/loop', '/urea', '/hyperglycemia']} />
    </div>
  );
}
