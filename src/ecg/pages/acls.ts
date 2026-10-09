import { h, p, ul } from '../ui/dom';
import { header, presetPhysio, refList } from '../ui/common';
import { EcgView } from '../ui/ecgView';
import { segmented } from '../ui/controls';
import { runEcg } from '../engine';
import { ACLS, ACLS_NOTE, type AclsCard } from '../content/acls';
import { presetLabel } from '../content/index';

export function renderAcls(root: HTMLElement): () => void {
  root.append(header('K · ACLS ECG Reference', 'ACLS ECG cheat sheet (2025 AHA)', 'Rapid-access reference: what the rhythm looks like, what to do first, which drugs and which electrical therapy — and why.'), h('div', { class: 'callout warn' }, p(ACLS_NOTE)));
  const views: EcgView[] = [];
  const groups: [AclsCard['group'], string][] = [
    ['arrest', 'Cardiac arrest'],
    ['tachy', 'Tachyarrhythmia with a pulse'],
    ['brady', 'Bradycardia with a pulse'],
  ];
  for (const [g, title] of groups) {
    root.append(h('h2', null, title));
    for (const c of ACLS.filter((x) => x.group === g)) {
      const view = new EcgView({ layout: 'strips', leads: ['II'], rowMm: 24 });
      views.push(view);
      const show = (pid: string): void => view.setRun(runEcg(presetPhysio(pid, { noise: 0.1 }), 6000));
      root.append(
        h(
          'section',
          { class: 'card' },
          h('h3', null, c.title),
          c.presets.length > 1 ? segmented(c.presets.map((x) => [x, presetLabel(x)] as [string, string]), c.presets[0], show, 'Example') : null,
          view.el,
          h(
            'div',
            { class: 'grid-2' },
            h('div', null, h('h4', null, 'Recognition'), ul(c.recognition), h('h4', null, 'Immediate action'), ul(c.action)),
            h('div', null, c.drugs ? h('h4', null, 'Medications') : null, c.drugs ? ul(c.drugs) : null, c.electrical ? h('h4', null, 'Electrical therapy') : null, c.electrical ? ul(c.electrical) : null, h('h4', null, 'Why'), p(c.why)),
          ),
          c.dx ? h('p', null, h('a', { href: `#/dx/${c.dx}` }, 'Mechanism & full management →')) : null,
        ),
      );
      show(c.presets[0]);
    }
  }
  root.append(
    h('section', { class: 'card' }, h('h2', null, 'Key 2025 points'), ul(['Adenosine for wide-complex tachycardia only if REGULAR and MONOMORPHIC (Class 2b); never verapamil/diltiazem for wide-complex tachycardia.', 'Synchronised cardioversion of AF: initial biphasic energy ≥ 200 J is reasonable (Class 2a); atrial flutter: 200 J may be reasonable (Class 2b); increase if unsuccessful. The new Electrical Cardioversion algorithm lists 100 J for narrow-complex tachycardia and monomorphic VT.', 'VF/pVT persisting after ≥ 3 shocks: the usefulness of vector change or double sequential external defibrillation has not been established (Class 2b).', 'Bradycardia: atropine 1 mg every 3–5 min (max 3 mg); then pacing and/or dopamine 5–20 mcg/kg/min or epinephrine 2–10 mcg/min; consider transvenous pacing.'])),
    refList(['acls2025', 'aclsExec2025', 'special2025', 'postArrest2025']),
  );
  return () => views.forEach((v) => v.destroy());
}
