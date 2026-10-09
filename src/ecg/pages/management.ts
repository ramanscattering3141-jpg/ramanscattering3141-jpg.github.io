import { h, p } from '../ui/dom';
import { header, presetPhysio, refList } from '../ui/common';
import { EcgView } from '../ui/ecgView';
import { runEcg } from '../engine';
import { resolveDx } from '../content/index';
import { managementBlock } from './library';

const ORDER = ['sinusBrady', 'chb', 'mobitz2', 'af', 'flutter', 'avnrt', 'orthoAvrt', 'focalAT', 'mat', 'monoVT', 'torsades', 'vf', 'wpw', 'preexAf', 'stemi', 'hyperK'];

export function renderManagement(root: HTMLElement): () => void {
  root.append(
    header('J · Arrhythmia Management', 'Management, linked to mechanism', 'Every entry follows the same eight steps: recognition → mechanism → stable vs unstable → immediate → definitive → contraindications → why each treatment works → why others do not. Open an entry to see its ECG.'),
    h('div', { class: 'callout warn' }, p('Summaries of the cited guidelines (e.g. 2015 ACC/AHA/HRS & 2019 ESC SVT, 2023 ACC/AHA/ACCP/HRS & 2024 ESC AF, 2017 AHA/ACC/HRS & 2022 ESC ventricular arrhythmia, 2018 ACC/AHA/HRS bradycardia, 2025 AHA ACLS & special circumstances, 2025 ACC/AHA/ACEP/NAEMSP/SCAI ACS). US and European recommendations sometimes differ. Verify doses and recommendations in the current official documents before clinical use.')),
  );
  const views: EcgView[] = [];
  for (const id of ORDER) {
    const d = resolveDx(id);
    if (!d?.management) continue;
    const det = h('details', { class: 'card' }, h('summary', null, h('strong', null, d.name), ' — ', d.management.recognition));
    let built = false;
    det.addEventListener('toggle', () => {
      if (!det.open || built) return;
      built = true;
      const view = new EcgView({ layout: 'strips', leads: ['II'], rowMm: 24 });
      views.push(view);
      det.append(view.el, managementBlock(d.management!), h('p', null, h('a', { href: `#/dx/${d.id}` }, 'Full entry, WHY chain and interactive ECG →')), refList(d.management!.refs));
      if (d.preset) view.setRun(runEcg(presetPhysio(d.preset), 8000));
    });
    root.append(det);
  }
  return () => views.forEach((v) => v.destroy());
}
