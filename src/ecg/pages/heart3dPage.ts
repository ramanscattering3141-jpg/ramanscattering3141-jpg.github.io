import { h, p, ul } from '../ui/dom';
import { header, openInSimulator, presetPhysio, refList } from '../ui/common';
import { EcgPanel } from '../ui/panel';
import { select } from '../ui/controls';
import { PRESETS } from '../engine/presets';
import { resolveDx } from '../content/index';

// A curated order: normal first, then the conduction abnormalities where watching the
// wavefront explains the ECG best.
const FEATURED = ['nsr', 'rbbb', 'lbbb', 'lafb', 'wpw', 'mobitz1', 'mobitz2', 'chbVentricular', 'pvc', 'monoVT', 'avnrt', 'orthoAvrt', 'flutter21', 'af', 'vvi', 'stemiAnterior', 'oldInferior', 'hyperK8', 'dextrocardia', 'vf'];

export function renderHeart3d(root: HTMLElement, _parts: string[], q: URLSearchParams): () => void {
  root.append(
    header(
      'B · Physiology',
      '3-D heart & slow-motion ECG',
      'Rotate the heart, slow time down to 1/100 of real time, and step millisecond by millisecond. The coloured wavefront, the conduction-system highlights and the heart-vector arrow come from the same simulation that draws the ECG, so you can see exactly which event writes each part of the tracing.',
    ),
  );
  let preset = q.get('preset') && PRESETS[q.get('preset')!] ? q.get('preset')! : 'nsr';
  const panel = new EcgPanel({ heart: true, heart3d: true, large: true, duration: 10000, layout: 'strips', leads: ['II', 'V1', 'V6'], showLadder: true, showLabels: true });
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
        '**Walls: transparent** (default) lets you watch activation start on the inner wall (endocardium) and move outward; **cut away** removes the half of the heart facing you; **solid** shows only the outer (epicardial) surface.',
        'Choose a **slow speed** (0.1× to 0.01×) and press Play, or use the ±1 ms / ±10 ms buttons. Click anywhere on the ECG to jump to that instant.',
        'Colours: **yellow-white** = the activation wavefront, **orange** = depolarised (plateau), **blue** = repolarising, dull red = resting. Grey = scar; purple tint = ischaemic territory.',
        'The **arrow** is the instantaneous heart vector; the **yellow loop** is the path its tip has traced during the current wave (the vector loop). The **green/red bar** on the selected lead axis is its projection — exactly the voltage that lead is recording at that moment.',
      ]),
      p('Anatomy is simplified (ellipsoidal chambers); timing, sequence and vectors are physiological and match the tracing. Activation times are scaled to each beat’s measured QRS duration.', 'ref-meta'),
    ),
    refList(['durrer1970', 'ecgStd1']),
  );
  show();
  return () => panel.destroy();
}
