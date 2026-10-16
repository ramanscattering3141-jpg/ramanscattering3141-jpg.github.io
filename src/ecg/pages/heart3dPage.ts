import { h, p, ul } from '../ui/dom';
import { header, openInSimulator, presetPhysio, refList } from '../ui/common';
import { EcgPanel } from '../ui/panel';
import { PRESETS } from '../engine/presets';
import { resolveDx } from '../content/index';

// One-click rhythms, grouped by what watching the wavefront explains best.
const GROUPS: [string, string[]][] = [
  ['Normal', ['nsr', 'sinusBrady', 'sinusTach']],
  ['Conduction blocks', ['avb1', 'mobitz1', 'mobitz2', 'chbVentricular', 'rbbb', 'lbbb', 'lafb']],
  ['Pre-excitation & re-entry', ['wpw', 'avnrt', 'orthoAvrt', 'flutter21', 'af', 'preexAf']],
  ['Ventricular', ['pvc', 'monoVT', 'torsades', 'vf', 'vvi']],
  ['Ischaemia & other', ['stemiAnterior', 'stemiInferior', 'oldInferior', 'lvAneurysm', 'takotsubo', 'hyperK8', 'pe', 'hcm', 'dextrocardia']],
];
const SHORT: Record<string, string> = {
  nsr: 'Normal sinus',
  sinusBrady: 'Sinus bradycardia',
  sinusTach: 'Sinus tachycardia',
  avb1: '1st-degree block',
  mobitz1: 'Mobitz I',
  mobitz2: 'Mobitz II',
  chbVentricular: 'Complete block',
  rbbb: 'RBBB',
  lbbb: 'LBBB',
  lafb: 'LAFB',
  wpw: 'WPW',
  avnrt: 'AVNRT',
  orthoAvrt: 'Orthodromic AVRT',
  flutter21: 'Flutter 2:1',
  af: 'Atrial fibrillation',
  preexAf: 'Pre-excited AF',
  pvc: 'PVC',
  monoVT: 'Monomorphic VT',
  torsades: 'Torsades',
  vf: 'VF',
  vvi: 'Paced (VVI)',
  stemiAnterior: 'Anterior STEMI',
  stemiInferior: 'Inferior + RV STEMI',
  oldInferior: 'Old inferior MI',
  lvAneurysm: 'LV aneurysm',
  takotsubo: 'Takotsubo',
  hyperK8: 'Hyperkalaemia',
  pe: 'Pulmonary embolism',
  hcm: 'HCM',
  dextrocardia: 'Dextrocardia',
};

export function renderHeart3d(root: HTMLElement, _parts: string[], q: URLSearchParams): () => void {
  root.append(
    header(
      'B · Physiology',
      'Heart simulator',
      'A beating 3-D heart run by the same simulation that draws the ECG. Slow it down, step a millisecond at a time, and watch where the impulse is while each wave of the ECG is written — and what changes when conduction goes wrong.',
    ),
  );
  let preset = q.get('preset') && PRESETS[q.get('preset')!] ? q.get('preset')! : 'nsr';
  const panel = new EcgPanel({ heart: true, heart3d: true, large: true, hemo: 'closed', duration: 10000, layout: 'strips', leads: ['II', 'V1', 'V6'], showLadder: true, showLabels: true });
  const note = h('div', { class: 'callout' });
  const dxLinkHost = h('span');
  const chips: HTMLButtonElement[] = [];
  const all = h('select', { 'aria-label': 'All rhythms and conditions', class: 'hs-all' }, h('option', { value: '' }, 'All rhythms and conditions…'), ...Object.entries(PRESETS).map(([k, v]) => h('option', { value: k }, v.label)));
  const show = (): void => {
    panel.stop();
    panel.show(presetPhysio(preset, { noise: 0.03 }));
    note.replaceChildren(h('strong', null, PRESETS[preset].label), ' — ', PRESETS[preset].physiology);
    const d = resolveDx(preset);
    dxLinkHost.replaceChildren(...(d ? [h('a', { href: `#/dx/${d.id}` }, `Read about ${d.name} →`)] : []));
    for (const c of chips) {
      const on = c.dataset.id === preset;
      c.classList.toggle('on', on);
      c.setAttribute('aria-pressed', String(on));
    }
    all.value = chips.some((c) => c.dataset.id === preset) ? '' : preset;
    history.replaceState(null, '', `#/heart3d?preset=${preset}`);
  };
  all.addEventListener('change', () => {
    if (!all.value) return;
    preset = all.value;
    show();
  });
  const groups = GROUPS.map(([title, ids]) =>
    h(
      'div',
      { class: 'hs-pick-group' },
      h('span', { class: 'hs-pick-title' }, title),
      h(
        'div',
        { class: 'hs-pick-chips' },
        ...ids
          .filter((id) => PRESETS[id])
          .map((id) => {
            const b = h('button', { type: 'button', class: 'hs-pick', 'data-id': id, title: PRESETS[id].label, 'aria-pressed': 'false' }, SHORT[id] ?? PRESETS[id].label);
            b.addEventListener('click', () => {
              preset = id;
              show();
            });
            chips.push(b);
            return b;
          }),
      ),
    ),
  );
  root.append(
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'hs-picker' }, ...groups, h('div', { class: 'hs-pick-group' }, h('span', { class: 'hs-pick-title' }, 'More'), all)),
      note,
      h('div', { class: 'btn-row' }, h('button', { class: 'btn', type: 'button', onclick: () => panel.run && openInSimulator(panel.run.physio) }, 'Change the physiology in the simulator →'), dxLinkHost),
      panel.el,
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'How to use it'),
      ul([
        '**Play slowly.** Press Play at **1/10** speed (the default) — one heartbeat then takes about 8 seconds. Use 1/50 or 1/100 to follow the wavefront through the QRS, or step with **−1/+1 ms** and **±10 ms**. **Next beat** jumps to just before the following P wave. Click anywhere on the ECG to jump to that instant.',
        '**Read the colours.** Resting muscle is **rose**; the **wavefront** is a bright white-yellow band; depolarised muscle is **orange** (its plateau is the ST segment); **cyan** marks repolarisation (the T wave), fading back to rose. Scar is grey.',
        '**Follow the impulse.** The panel beside the heart lists the pathway from the sinus node to the ventricles and lights the step that is active now, with the part of the ECG it writes. Blocked steps turn red; steps a beat does not use (an ectopic or paced beat) are struck through. The cream conduction system glows where the impulse is travelling.',
        '**Rotate and cut.** Drag to rotate, scroll or pinch to zoom. The **four-chamber cut** removes the front of the heart so you see all four chambers, the septum and the conduction system; the **short-axis cut** slices across the ventricles; **whole heart** shows the outside. The cut stays fixed to the heart as you turn it. **View** puts the camera at standard angles (front, LAO, RAO, left, back, from below).',
        '**Colour by…** *Membrane potential* shows each cell’s voltage; *activation map* colours where the impulse arrives first (red) and last (blue) with lines every 10 ms — compare normal, LBBB, RV pacing and WPW; *refractoriness* shows the vulnerable period during the T wave; *coronary territories* and *what a lead sees* link the wall to the coronary arteries and the leads.',
        '**Click the heart muscle** to inspect a spot: its name and AHA segment, its blood supply, the leads that face it, when it was activated and repolarised in this beat, and its action potential with a marker at the current instant.',
        '**Watch the beat.** Each region shortens after its own activation, so dyssynchrony is visible (early septum, late lateral wall in LBBB or RV pacing). Scar does not contract, an aneurysm bulges outward in systole, and in VF the ventricles only quiver. The valves open and close from the pressure model; open **Mechanics & haemodynamics** below the ECG for the Wiggers diagram, pressure–volume loop, heart sounds and JVP.',
        'The **arrow** is the instantaneous heart vector — the summed dipole projected onto the leads to draw the ECG; the yellow line is the loop its tip has traced. Turn on **Lead axis** to see the projection the selected lead records at this instant.',
      ]),
      p('The anatomy is a simplified model of an adult heart. What is computed is the timing: for every beat, local activation is the shortest path through the wall from that beat’s real entry points (fast along the Purkinje-lined endocardium of a side whose bundle conducts, slower muscle-to-muscle elsewhere, never through scar or across the insulating AV ring), scaled so the sequence lasts exactly as long as that beat’s QRS (or P wave). Repolarisation follows the beat’s own T-wave vector. Haemodynamic values come from a lumped-parameter circulation and are illustrative of a resting adult.', 'ref-meta'),
    ),
    refList(['durrer1970', 'ecgStd1']),
  );
  show();
  return () => panel.destroy();
}
