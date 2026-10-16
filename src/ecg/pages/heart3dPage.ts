import { h, p, ul } from '../ui/dom';
import { header, openInSimulator, presetPhysio, refList } from '../ui/common';
import { EcgPanel } from '../ui/panel';
import { select } from '../ui/controls';
import { PRESETS } from '../engine/presets';
import { resolveDx } from '../content/index';

// A curated order: normal first, then the conduction abnormalities where watching the
// wavefront explains the ECG best.
const FEATURED = ['nsr', 'rbbb', 'lbbb', 'lafb', 'wpw', 'mobitz1', 'mobitz2', 'chbVentricular', 'pvc', 'monoVT', 'avnrt', 'orthoAvrt', 'flutter21', 'af', 'vvi', 'stemiAnterior', 'stemiInferior', 'oldInferior', 'lvAneurysm', 'takotsubo', 'hcm', 'pe', 'hyperK8', 'dextrocardia', 'torsades', 'vf'];

export function renderHeart3d(root: HTMLElement, _parts: string[], q: URLSearchParams): () => void {
  root.append(
    header(
      'B · Physiology',
      '3-D heart & slow-motion ECG',
      'A beating heart driven by the same simulation that draws the ECG. Watch the wavefront, the action potentials and the refractory tissue; see each region contract when it is activated, the valves open and close, and the pressures, volumes, heart sounds and JVP that result. Slow time to 1/100 of real time and step millisecond by millisecond.',
    ),
  );
  let preset = q.get('preset') && PRESETS[q.get('preset')!] ? q.get('preset')! : 'nsr';
  const panel = new EcgPanel({ heart: true, heart3d: true, large: true, hemo: 'open', duration: 10000, layout: 'strips', leads: ['II', 'V1', 'V6'], showLadder: true, showLabels: true });
  const note = h('div', { class: 'callout' });
  const dxLinkHost = h('span');
  const show = (): void => {
    panel.stop();
    panel.show(presetPhysio(preset, { noise: 0.03 }));
    note.replaceChildren(p(PRESETS[preset].physiology));
    const d = resolveDx(preset);
    dxLinkHost.replaceChildren(...(d ? [' · ', h('a', { href: `#/dx/${d.id}` }, `Read: ${d.name} →`)] : []));
  };
  const opts: [string, string][] = [...FEATURED.filter((k) => PRESETS[k]).map((k) => [k, PRESETS[k].label] as [string, string]), ['—', '──────────'], ...Object.entries(PRESETS).filter(([k]) => !FEATURED.includes(k)).map(([k, v]) => [k, v.label] as [string, string])];
  const sel = select({
    label: 'Rhythm / condition',
    value: preset,
    options: opts,
    onChange: (v) => {
      if (v === '—') return;
      preset = v;
      show();
    },
  });
  root.append(
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'btn-row' }, sel, h('button', { class: 'btn', type: 'button', onclick: () => panel.run && openInSimulator(panel.run.physio) }, 'Change the physiology in the simulator →'), dxLinkHost),
      note,
      panel.el,
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'How to use it'),
      ul([
        '**Drag** to rotate, **scroll/pinch** to zoom; the viewpoint menu has anterior, LAO/RAO, lateral, posterior and horizontal-plane views. The small compass shows the patient’s Left, Superior and Anterior directions.',
        '**Click the heart muscle** to inspect that spot: its AHA 17-segment name and coronary supply, the leads that face it (and see it in mirror image), when it is activated and repolarised in this beat, its action potential with the ion currents flowing at this instant, and whether it is refractory.',
        '**Colour menu** — *electrical state* (wavefront, plateau, repolarisation); *membrane potential* in mV; *activation map* (isochrones: where the impulse arrives first and last — compare normal, LBBB, RV pacing and WPW); *refractoriness* (absolutely refractory, relatively refractory = the vulnerable period during the T wave, excitable); *coronary territories*; and *what the selected lead sees* (the wall facing its positive pole, and the wall it sees in the mirror).',
        '**Contraction**: every region shortens after its own activation, so dyssynchrony is visible (early septal contraction and late lateral wall in LBBB or RV pacing); scar does not contract, an aneurysm bulges outward in systole, ischaemic muscle is hypokinetic, and in VF the ventricles only quiver.',
        '**Valves** open and close from the pressure model; the **coronary arteries** run in their grooves, and in acute or old infarction the culprit occlusion is marked.',
        '**Walls: transparent** (default) lets you see inside; **cut away** removes the half of the heart facing you; **solid** shows the outer surface.',
        'Choose a **slow speed** (0.1× to 0.01×) and press Play, or use the ±1 ms / ±10 ms buttons. Click anywhere on the ECG or the Wiggers diagram to jump to that instant.',
        'The **arrow** is the instantaneous heart vector; the **yellow loop** is the path its tip has traced during the current wave (the vector loop). The **green/red bar** on the selected lead axis is its projection — exactly the voltage that lead is recording at that moment.',
        'Open **Mechanics & haemodynamics** below the playback controls for the Wiggers diagram (aortic, LV and LA pressures, LV volume, ECG, heart sounds, JVP with a/c/v waves), the pressure–volume loop, blood pressure, stroke volume and cardiac output, and audible heart sounds. Try complete heart block (cannon a waves, variable S1), AF (no a wave, beat-to-beat variation), LBBB (reversed splitting of S2), RBBB (wide splitting), VT and VF.',
      ]),
      p('The anatomy is a simplified model of real cardiac topography; the timing, activation sequence, vectors and mechanics are computed from the simulated physiology and match the tracing. Activation times are scaled to each beat’s measured QRS duration; haemodynamic values come from a lumped-parameter circulation model and are illustrative of a resting adult.', 'ref-meta'),
    ),
    refList(['durrer1970', 'ecgStd1']),
  );
  show();
  return () => panel.destroy();
}
