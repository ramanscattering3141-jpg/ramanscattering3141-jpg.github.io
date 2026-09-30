import { h, p } from '../ui/dom';
import { header, presetPhysio, refList } from '../ui/common';
import { EcgPanel } from '../ui/panel';
import { button, segmented } from '../ui/controls';
import { CASES, caseVitals, pickCase, type CaseTemplate } from '../content/cases';
import { ALL_DX, resolveDx } from '../content/index';
import { mulberry32, newSeed, range, shuffle } from '../engine/random';
import { randomVariation } from '../engine/variability';
import { managementBlock } from './library';

export function renderCases(root: HTMLElement, _parts: string[], q: URLSearchParams): () => void {
  root.append(header('L · ECG Cases', 'ECG case generator', 'Realistic cases generated from the simulator. Work through the 11 interpretation steps, commit to answers, then reveal the explanation. Each new case varies the patient and the physiology.'));
  let level: 'any' | '1' | '2' | '3' = 'any';
  const host = h('div');
  let panel: EcgPanel | null = null;
  const dxFilter = q.get('dx');
  const newCase = (): void => {
    panel?.destroy();
    const seed = newSeed();
    const rng = mulberry32(seed);
    const pool = (c: CaseTemplate): boolean => (dxFilter ? c.dx === dxFilter || resolveDx(dxFilter)?.id === c.dx : level === 'any' || String(c.level) === level);
    const t = CASES.some(pool) ? pickCase(rng, pool) : pickCase(rng);
    const d = resolveDx(t.dx)!;
    let phys = presetPhysio(t.preset, t.patch);
    if (t.dx !== 'vf') phys = randomVariation(phys, seed);
    phys.sex = t.sex ?? (rng() < 0.5 ? 'M' : 'F');
    phys.age = Math.round(range(rng, t.age[0], t.age[1]));
    panel = new EcgPanel({ duration: 10000, heart: true, measurements: false });
    const run = panel.show(phys);
    const m = run.m;
    // Diagnosis options
    const distractors = shuffle(rng, ALL_DX.filter((x) => x.id !== d.id && x.category === d.category)).slice(0, 2);
    const others = shuffle(rng, ALL_DX.filter((x) => x.id !== d.id && !distractors.includes(x) && x.tier === 1)).slice(0, 4 - distractors.length);
    const options = shuffle(rng, [d, ...distractors, ...others]);
    const measureRow = (k: string, v: string): [string, string] => [k, v];
    const answers: [string, string][] = [
      measureRow('1. Rate', `Ventricular ${m.ventRate ?? '—'}/min${m.atrialRate && m.atrialRate !== m.ventRate ? `; atrial ${m.atrialRate}/min` : ''}.`),
      measureRow('2. Rhythm', `${t.rhythmDesc} (${m.regularity}; ${m.avRelation}).`),
      measureRow('3. Axis', m.axis === null ? 'Indeterminate.' : `${m.axis}° — ${m.axisLabel}.`),
      measureRow('4. P waves', t.pDesc),
      measureRow('5. PR', m.pr === null ? 'Not applicable / not measurable.' : m.prRange && m.prRange[1] - m.prRange[0] > 20 ? `${m.prRange[0]}–${m.prRange[1]} ms (varies).` : `${m.pr} ms.`),
      measureRow('6. QRS', `${m.qrs ?? '—'} ms. ${t.qrsDesc}`),
      measureRow('7. ST / T', t.stDesc),
      measureRow('8. QT', m.qt ? `QT ${m.qt} ms, QTc ${m.qtcBazett} (Bazett) / ${m.qtcFridericia} ms (Fridericia).` : 'Not measurable.'),
      measureRow('9. Diagnosis', d.name),
      measureRow('10. Mechanism', d.mechanism),
      measureRow('11. Management', t.mgmtFocus),
    ];
    const reveal = h('div', { class: 'answer' });
    const inputs = answers.slice(0, 8).map(([k]) => h('div', { class: 'ctl' }, h('label', null, h('span', null, k)), h('input', { type: 'text', placeholder: 'your answer', style: 'width:100%;padding:6px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink)' })));
    const feedback = h('div');
    const dxButtons = options.map((o) =>
      button(o.name, () => {
        dxButtons.forEach((b) => (b.disabled = true));
        const right = o.id === d.id;
        dxButtons[options.indexOf(o)].classList.add(right ? 'right' : 'wrong');
        dxButtons[options.indexOf(d)].classList.add('right');
        feedback.replaceChildren(p(right ? '✔ Correct.' : `✘ It is ${d.name}.`));
      }, 'quiz-opt'),
    );
    reveal.append(
      h('div', { class: 'table-scroll' }, h('table', { class: 't' }, h('tbody', null, ...answers.map(([k, v]) => h('tr', null, h('th', { style: 'width:150px' }, k), h('td', null, v)))))),
      h('h3', null, 'Why does this ECG look like this?'),
      h('ol', { class: 'why' }, ...d.why.map((w) => h('li', null, w.text))),
      ...(d.management ? [h('div', null, h('h3', null, 'Management framework'), managementBlock(d.management))] : []),
      h('p', null, h('a', { href: `#/dx/${d.id}` }, `Open the full ${d.name} entry →`)),
      refList(d.management?.refs ?? d.refs),
    );
    const vit = caseVitals(t, rng, m.ventRate);
    host.replaceChildren(
      h(
        'section',
        { class: 'card' },
        h('h2', null, `Case: ${phys.age}-year-old ${phys.sex === 'F' ? 'woman' : 'man'}`),
        p(`**Presenting:** ${t.symptoms.join('; ')}.`),
        p(`**History:** ${t.history.join('; ')}.`),
        p(`**Medications:** ${t.meds.join(', ')}.`),
        p(`**Vitals:** ${vit}.`),
        t.labs ? p(`**Labs:** ${t.labs(rng)}.`) : null,
        panel.el,
      ),
      h('section', { class: 'card' }, h('h2', null, 'Your interpretation'), h('div', { class: 'grid' }, ...inputs), h('h3', null, '9. Diagnosis — choose one'), ...dxButtons, feedback, h('div', { class: 'btn-row' }, button('Reveal full explanation', () => reveal.classList.add('show'), 'btn-primary'), button('Next case', newCase))),
      h('section', { class: 'card' }, reveal),
    );
  };
  root.append(
    h(
      'div',
      { class: 'btn-row' },
      segmented<'any' | '1' | '2' | '3'>(
        [
          ['any', 'Any difficulty'],
          ['1', 'Foundation'],
          ['2', 'Intermediate'],
          ['3', 'Advanced'],
        ],
        'any',
        (v) => ((level = v), newCase()),
        'Difficulty',
      ),
      button('New case', newCase, 'btn-primary'),
    ),
    ...(dxFilter ? [p(`Showing cases for **${resolveDx(dxFilter)?.name ?? dxFilter}** — [all cases](#/cases).`)] : []),
    host,
  );
  newCase();
  return () => panel?.destroy();
}
