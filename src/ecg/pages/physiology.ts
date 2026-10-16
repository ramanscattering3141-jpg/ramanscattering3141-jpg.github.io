import { h, p } from '../ui/dom';
import { dxLink, header, presetPhysio, refList, whyBox, whyList } from '../ui/common';
import { EcgPanel } from '../ui/panel';
import { ActivationStepper } from '../ui/activation';
import { segmented } from '../ui/controls';
import { FINDINGS, findingById } from '../content/findings';
import { presetLabel } from '../content/index';
import type { WhyStep } from '../content/types';

const WAVES: { name: string; steps: WhyStep[] }[] = [
  {
    name: 'P wave (atrial depolarisation)',
    steps: [
      { level: 'conduction', text: 'Starts at the sinus node in the high right atrium; spreads through the RA, then via Bachmann’s bundle to the LA.' },
      { level: 'vector', text: 'Mean vector inferior and leftward (≈ +50°): RA component anterior-inferior, LA component leftward-posterior.' },
      { level: 'waveform', text: 'Upright in II (< 120 ms, < 2.5 mm), inverted in aVR, often biphasic in V1 (RA positive then LA negative).' },
    ],
  },
  {
    name: 'PR interval (atrial → ventricular delay)',
    steps: [
      { level: 'cell', text: 'AV-nodal cells rely on the slow L-type Ca²⁺ current → slow conduction (decremental) — the main source of delay.' },
      { level: 'conduction', text: 'The delay lets atrial contraction complete ventricular filling and protects the ventricles from rapid atrial rates.' },
      { level: 'waveform', text: 'His–Purkinje activation is too small to see on the surface: the PR segment is isoelectric.' },
    ],
  },
  {
    name: 'QRS complex (ventricular depolarisation)',
    steps: [
      { level: 'conduction', text: 'Septum first (from the left bundle, left→right), then apex and free walls via Purkinje fibres, then posterobasal regions.' },
      { level: 'vector', text: 'Small initial rightward-anterior septal vector, then a large leftward-inferior-posterior LV vector, then a small superior-posterior terminal vector.' },
      { level: 'waveform', text: 'V1: small r (septum toward it) then deep S (LV away). V6: small q then tall R. Total 80–100 ms thanks to the fast Purkinje network.' },
    ],
  },
  {
    name: 'ST segment (plateau)',
    steps: [
      { level: 'cell', text: 'All ventricular cells are in phase 2 at a similar voltage.' },
      { level: 'vector', text: 'No voltage gradient → no current → no vector.' },
      { level: 'waveform', text: 'Isoelectric. Any gradient (injury, dome loss, secondary to abnormal activation) shifts it.' },
    ],
  },
  {
    name: 'T wave (ventricular repolarisation)',
    steps: [
      { level: 'cell', text: 'Epicardial action potentials are shorter than endocardial ones.' },
      { level: 'conduction', text: 'So although the epicardium is activated last, it repolarises first: repolarisation travels epicardium → endocardium.' },
      { level: 'waveform', text: 'A repolarisation wave moving away from a lead writes upward → T concordant with the main QRS deflection.' },
    ],
  },
  {
    name: 'QT interval and U wave',
    steps: [
      { level: 'cell', text: 'QT ≈ ventricular action-potential duration; shortens at faster rates (rate adaptation) — hence QTc.' },
      { level: 'waveform', text: 'U wave: a small late wave (best in V2–V3), prominent in hypokalaemia and bradycardia.' },
    ],
  },
];

export function renderPhysiology(root: HTMLElement, parts: string[]): (() => void) | void {
  if (parts[0] === 'activation') return activation(root);
  root.append(header('B · ECG Physiology', 'Why each wave looks the way it does', 'Follow a single heartbeat from the sinus node to repolarisation, then open the WHY chains for the findings you will meet.'));
  const panel = new EcgPanel({ heart: true, layout: 'strips', leads: ['II', 'V1', 'V6'], showLadder: true, showLabels: true, duration: 6000 });
  root.append(h('section', { class: 'card' }, h('h2', null, 'The conduction system in motion'), p('Press **Play** (choose a slow speed, or step ±1 ms): sinus node → atria (P) → AV node (PR segment) → His bundle → bundle branches → Purkinje → ventricles (QRS). Slow the playback to watch the AV-nodal delay on the ladder diagram.'), panel.el));
  panel.show(presetPhysio('nsr'));
  root.append(h('section', { class: 'card' }, h('h2', null, 'Each wave, from cell to lead'), ...WAVES.flatMap((w) => [h('h3', null, w.name), whyList(w.steps)])));
  root.append(h('section', { class: 'card' }, h('h2', null, 'Go deeper'), h('div', { class: 'grid' }, h('a', { class: 'tile', href: '#/heart3d' }, h('h3', null, '3-D heart & slow-motion ECG'), h('p', null, 'Rotatable heart driven by the simulation: watch each wavefront write the ECG at up to 1/100 speed.')), h('a', { class: 'tile', href: '#/physiology/activation' }, h('h3', null, 'Ventricular activation, millisecond by millisecond'), h('p', null, 'Step through the QRS: watch septal, apical and free-wall vectors build the vector loop and write each lead.')), h('a', { class: 'tile', href: '#/sandbox/hierarchy' }, h('h3', null, 'Pacemaker hierarchy'), h('p', null, 'Disable pacemakers and watch escape rhythms emerge.')))));
  root.append(h('h2', null, 'WHY does it look like this? — findings'), h('div', { class: 'grid' }, ...FINDINGS.map((f) => h('a', { class: 'tile', href: `#/why/${f.id}` }, h('h3', null, f.name), h('p', null, `${f.causes.length} causes · ${f.aliases.slice(0, 2).join(', ')}`)))));
  root.append(refList(['durrer1970', 'ecgStd1', 'ecgStd4', 'ionChannels2009']));
  return () => panel.destroy();
}

function activation(root: HTMLElement): void {
  root.append(header('B · ECG Physiology', 'Ventricular activation, millisecond by millisecond', 'The QRS is the running projection of a moving vector. Drag the time slider to watch it being written — and switch the conduction pattern to see how rerouting changes the vector.'));
  const stepper = new ActivationStepper({ kind: 'bundle', bundle: 'normal' });
  const modes: [string, string][] = [
    ['normal', 'Normal'],
    ['rbbb', 'RBBB'],
    ['lbbb', 'LBBB'],
    ['lafb', 'LAFB'],
    ['lpfb', 'LPFB'],
    ['rvApex', 'RV apical pacing / PVC'],
    ['lvLateral', 'LV lateral PVC'],
    ['ap', 'Pre-excitation'],
  ];
  root.append(
    h(
      'section',
      { class: 'card' },
      segmented(modes, 'normal', (v) => {
        if (v === 'rvApex' || v === 'lvLateral') stepper.setMode({ kind: 'focus', site: v });
        else if (v === 'ap') stepper.setMode({ kind: 'ap', hisDelay: 70 });
        else stepper.setMode({ kind: 'bundle', bundle: v as 'normal' });
      }, 'Conduction pattern'),
      stepper.el,
    ),
    refList(['durrer1970', 'ecgStd3']),
  );
}

export function renderWhy(root: HTMLElement, parts: string[]): (() => void) | void {
  const f = findingById(parts[0] ?? '');
  if (!f) {
    root.append(header('B · ECG Physiology', 'Finding not found'), h('a', { href: '#/physiology' }, 'Back'));
    return;
  }
  root.append(header('WHY does it look like this?', f.name, `Also called: ${f.aliases.join(', ')}.`));
  root.append(whyBox(f.name, f.abnormal, f.normal));
  const a = new EcgPanel({ duration: 6000, layoutToggle: true, compact: true });
  const b = new EcgPanel({ duration: 6000, layoutToggle: true, compact: true });
  root.append(h('section', { class: 'card' }, h('h2', null, `See it: ${f.demo.label}`), h('div', { class: 'grid-2' }, h('div', null, h('h3', null, presetLabel(f.demo.a)), a.el), h('div', null, h('h3', null, presetLabel(f.demo.b)), b.el))));
  a.show(presetPhysio(f.demo.a));
  b.show(presetPhysio(f.demo.b));
  root.append(h('section', { class: 'card' }, h('h2', null, 'Causes (each with its own mechanism)'), h('ul', null, ...f.causes.map((c) => h('li', null, dxLink(c.id), ` — ${c.note}`)))));
  if (f.lab) root.append(h('p', null, h('a', { class: 'btn btn-primary', href: f.lab }, 'Open the interactive lab →')));
  return () => {
    a.destroy();
    b.destroy();
  };
}
