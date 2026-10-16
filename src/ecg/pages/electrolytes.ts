import { h, p, debounce } from '../ui/dom';
import { dxTile, header, presetPhysio, refList, whyList } from '../ui/common';
import { EcgPanel } from '../ui/panel';
import { slider, button } from '../ui/controls';
import { AP_DEFAULT, drawAP, naAvailability, restingPotential, ventricularAP } from '../ui/apPlot';
import { dxByCategory, resolveDx } from '../content/index';
import { managementBlock } from './library';
import type { Physio } from '../engine/params';

function kText(K: number): string {
  if (K < 2.5) return 'Severe hypokalaemia: reduced IK1/IKr → slow late repolarisation → flat T, ST depression, large U waves fusing with T (long QU); ectopy and torsades risk.';
  if (K < 3.5) return 'Hypokalaemia: repolarisation slows → T flattens, U wave grows.';
  if (K <= 5.2) return 'Normal K⁺: resting potential ≈ −90 mV; almost all fast Na⁺ channels available.';
  if (K <= 6.5) return 'Mild–moderate hyperkalaemia: higher IKr conductance → faster, synchronous phase 3 → tall, narrow, peaked T; QT may shorten.';
  if (K <= 7.5) return 'Moderate–severe: resting potential rises (≈ −75 mV) → Na⁺-channel inactivation → slower atrial conduction (P flattens, PR lengthens) and QRS begins to widen.';
  if (K <= 8.5) return 'Severe: P waves disappear (atrial myocytes inexcitable; sinus impulses may still reach the AV node — "sinoventricular" conduction), QRS very wide, bradycardia/blocks.';
  return 'Critical: QRS merges with T into a sine wave → VF, asystole or PEA imminent.';
}

export function renderElectrolytes(root: HTMLElement, parts: string[]): (() => void) | void {
  if (parts[0] === 'drugs') return drugs(root);
  root.append(header('H · Electrolytes & Toxicology', 'Electrolyte lab', 'Move the ion concentrations continuously and watch the action potential and the ECG change together. Note that ECG–electrolyte correlations in patients are loose: the same K⁺ can produce very different ECGs.'));
  const phys: Physio = presetPhysio('nsr', { noise: 0.05 });
  const panel = new EcgPanel({ layout: 'strips', leads: ['II', 'V2', 'V5'], duration: 6000, layoutToggle: true });
  const ap = h('canvas', { class: 'ap-canvas', 'aria-label': 'Ventricular action potential' });
  const text = h('div', { class: 'callout' });
  const kv = h('div', { class: 'kv' });
  const rerun = debounce(() => {
    panel.show(phys);
    const pp = { ...AP_DEFAULT, K: phys.K, Ca: phys.Ca };
    drawAP(ap, [
      { c: ventricularAP(AP_DEFAULT, false), label: 'normal', color: '#9e9e9e' },
      { c: ventricularAP(pp, false), label: 'current', color: '#c62828' },
    ]);
    const rmp = restingPotential(phys.K);
    kv.replaceChildren(h('dt', null, 'Resting potential'), h('dd', null, `${rmp.toFixed(0)} mV`), h('dt', null, 'Na⁺ channels available'), h('dd', null, `${Math.round(naAvailability(rmp) * 100)}%`), h('dt', null, 'Ca²⁺ effect'), h('dd', null, phys.Ca < 2.15 ? 'long plateau → long ST / QT' : phys.Ca > 2.6 ? 'short plateau → short ST / QT' : 'normal plateau'), h('dt', null, 'Mg²⁺ effect'), h('dd', null, phys.Mg < 0.7 ? 'low: prolonged repolarisation, torsades risk (often with low K⁺)' : phys.Mg > 2 ? 'high: slowed AV/intraventricular conduction' : 'normal'));
    text.replaceChildren(p(kText(phys.K)));
  }, 60);
  root.append(
    h(
      'section',
      { class: 'card' },
      h(
        'div',
        { class: 'grid' },
        slider({ label: 'Potassium', min: 2, max: 9.5, step: 0.1, value: phys.K, unit: 'mmol/L', onInput: (v) => ((phys.K = v), rerun()) }),
        slider({ label: 'Calcium (total)', min: 1.4, max: 3.8, step: 0.05, value: phys.Ca, unit: 'mmol/L', format: (v) => `${v.toFixed(2)} mmol/L (${(v * 4.008).toFixed(1)} mg/dL)`, onInput: (v) => ((phys.Ca = v), rerun()) }),
        slider({ label: 'Magnesium', min: 0.3, max: 4, step: 0.05, value: phys.Mg, unit: 'mmol/L', onInput: (v) => ((phys.Mg = v), rerun()) }),
      ),
      text,
      h('div', { class: 'grid-2' }, h('div', null, h('h3', null, 'Ventricular action potential'), ap, kv), h('div', null, h('h3', null, 'ECG'), panel.el)),
    ),
  );
  root.append(
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'Hyperkalaemia: the causal chain'),
      whyList([
        { level: 'cell', text: 'Potassium gradient falls → resting membrane potential becomes less negative (Nernst).' },
        { level: 'cell', text: 'Less negative resting potential → more fast Na⁺ channels inactivated → reduced sodium-channel availability.' },
        { level: 'conduction', text: 'Slower phase-0 upstroke → slower conduction in atria (P flattening), AV node/His–Purkinje (PR, block) and ventricles (QRS widening).' },
        { level: 'cell', text: 'Meanwhile higher K⁺ increases IKr conductance → faster repolarisation → peaked T.' },
        { level: 'waveform', text: 'Peaked T → P flattening/loss, PR ↑ → QRS widening → sine wave → VF/asystole.' },
        { level: 'treatment', text: 'Calcium restores the threshold–resting gap (membrane stabilisation) within minutes; insulin/β₂-agonists shift K⁺ into cells; only binders/diuretics/dialysis remove it.' },
      ]),
    ),
  );
  const d = resolveDx('hyperK');
  if (d?.management) root.append(h('section', { class: 'card' }, h('h2', null, 'Electrolyte-related arrhythmia management (hyperkalaemia)'), managementBlock(d.management)));
  root.append(h('p', null, h('a', { class: 'btn btn-primary', href: '#/electrolytes/drugs' }, 'Drug & toxin lab →')));
  root.append(h('h2', null, 'Electrolyte library'), h('div', { class: 'grid' }, ...dxByCategory(['electrolyte']).map(dxTile)));
  root.append(refList(['kdigoK2020', 'littmann2018', 'special2025', 'ecgStd4', 'tdp2010']));
  rerun();
  return () => panel.destroy();
}

function drugs(root: HTMLElement): () => void {
  root.append(header('H · Electrolytes & Toxicology', 'Drug & toxin lab', 'Each drug is represented by its ion-channel/receptor effect. Increase the dose and follow mechanism → ECG.'));
  const phys: Physio = presetPhysio('nsr', { noise: 0.05 });
  const panel = new EcgPanel({ heart: false, duration: 10000 });
  const txt = h('div', { class: 'callout' });
  const rerun = debounce(() => {
    const run = panel.show(phys);
    const D = phys.drugs;
    const lines: string[] = [];
    if (D.betaBlocker > 0) lines.push('**β-blocker**: less cAMP in nodal cells → slower sinus phase 4 and AV-nodal conduction → bradycardia, long PR, AV block.');
    if (D.ccb > 0) lines.push('**Non-DHP CCB**: blocks ICa,L — the upstroke current of nodal cells → sinus slowing and AV-nodal block.');
    if (D.digoxin > 0) lines.push(`**Digoxin**: Na⁺/K⁺-ATPase inhibition → shorter ventricular APD (short QT, sagging ST), vagotonic AV slowing${D.digoxin > 1 ? '; toxicity: Ca²⁺ overload → DADs (ectopy, AT with block, bidirectional VT)' : ''}.`);
    if (D.naBlocker > 0) lines.push('**Na⁺-channel blocker** (class I, TCAs): slower phase 0 → slower conduction → wider QRS (terminal R in aVR), PR ↑.');
    if (D.qtDrug > 0) lines.push('**IKr blocker**: slower phase 3 → long QT, broad/low T → early afterdepolarisations → torsades in susceptible settings.');
    if (D.amiodarone > 0) lines.push('**Amiodarone**: multichannel (K⁺, Na⁺, Ca²⁺, β) → sinus slowing, PR and QT prolongation.');
    txt.replaceChildren(...(lines.length ? lines.map((l) => p(l)) : [p('Move a slider to add a drug.')]), p(`Model: rate ${run.m.ventRate}/min, PR ${run.m.pr ?? '—'} ms, QRS ${run.m.qrs} ms, QTc ${run.m.qtcBazett} ms.`, 'ref-meta'));
  }, 60);
  const sl = (label: string, key: keyof Physio['drugs'], max = 1, help?: string): HTMLElement => slider({ label, min: 0, max, step: 0.05, value: 0, help, onInput: (v) => ((phys.drugs[key] = v), rerun()) });
  root.append(
    h(
      'section',
      { class: 'card' },
      h('div', { class: 'grid' }, sl('β-blocker', 'betaBlocker'), sl('Verapamil / diltiazem', 'ccb'), sl('Digoxin (> 1 = toxic)', 'digoxin', 1.5), sl('Na⁺-channel blocker / TCA', 'naBlocker'), sl('IKr (QT-prolonging) drug', 'qtDrug'), sl('Amiodarone', 'amiodarone')),
      h('div', { class: 'btn-row' }, button('Tachycardia (TCA anticholinergic)', () => ((phys.rhythm.sinusRate = 125), rerun())), button('Bradycardia', () => ((phys.rhythm.sinusRate = 52), rerun())), button('Hypokalaemia 3.0', () => ((phys.K = 3.0), rerun())), button('Reset', () => {
        Object.assign(phys, presetPhysio('nsr', { noise: 0.05 }));
        rerun();
      }, 'btn-danger')),
      txt,
      panel.el,
    ),
  );
  root.append(h('h2', null, 'Drug & toxin library'), h('div', { class: 'grid' }, ...dxByCategory(['drug']).map(dxTile)));
  root.append(refList(['tox2023', 'special2025', 'boehnert1985', 'liebelt1995', 'tdp2010']));
  rerun();
  return () => panel.destroy();
}
