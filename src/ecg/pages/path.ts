import { h, p } from '../ui/dom';
import { header } from '../ui/common';
import { button } from '../ui/controls';
import { resolveDx } from '../content/index';
import { reviewedSet, resetProgress, setReviewed } from '../ui/progress';

interface Stage {
  title: string;
  goal: string;
  pages: [string, string][]; // [label, href]
  dx: string[];
}

// Ordered from mechanism to application. Each stage pairs interactive pages with the
// diagnoses whose ECGs they explain.
export const PATH: Stage[] = [
  { title: '1 · Foundations', goal: 'Understand how a cell’s action potential becomes a vector and how each lead projects it.', pages: [['Action potentials', '#/fundamentals/ap'], ['Leads & vectors', '#/fundamentals/leads'], ['Why each wave looks the way it does', '#/physiology'], ['Systematic approach', '#/fundamentals/systematic']], dx: ['nsr', 'sinusArrhythmia'] },
  { title: '2 · Rate, rhythm & the pacemaker hierarchy', goal: 'Predict which pacemaker takes over and at what rate.', pages: [['Pacemaker hierarchy', '#/sandbox/hierarchy']], dx: ['sinusBrady', 'sinusTach', 'sinusPause', 'saExitBlock', 'junctionalEscape', 'ventEscape', 'pac', 'pvc'] },
  { title: '3 · AV conduction', goal: 'Locate the level of block from PR behaviour and escape width.', pages: [['AV block lab', '#/conduction/av']], dx: ['avb1', 'mobitz1', 'mobitz2', 'avb21', 'highGrade', 'chb'] },
  { title: '4 · Intraventricular conduction & axis', goal: 'Explain QRS shape from the activation sequence.', pages: [['Bundle-branch lab', '#/conduction/bbb'], ['Axis lab', '#/sandbox/axis'], ['QRS lab', '#/sandbox/qrs']], dx: ['rbbb', 'lbbb', 'lafb', 'lpfb', 'bifascicular', 'ivcd'] },
  { title: '5 · Supraventricular tachycardias', goal: 'Identify the circuit, then predict what adenosine does.', pages: [['AVNRT lab', '#/rhythms/avnrt-lab'], ['AVRT lab', '#/rhythms/avrt-lab'], ['Flutter lab', '#/rhythms/flutter-lab'], ['Adenosine demonstrator', '#/sandbox/adenosine']], dx: ['avnrt', 'orthoAvrt', 'wpw', 'preexAf', 'focalAT', 'mat', 'flutter', 'af'] },
  { title: '6 · Ventricular arrhythmias & arrest', goal: 'Separate VT from SVT with aberrancy; link each arrest rhythm to its algorithm.', pages: [['WCT algorithms', '#/tools/wct'], ['ACLS reference', '#/acls']], dx: ['monoVT', 'polyVT', 'torsades', 'vf', 'pulselessVT', 'pea', 'asystole', 'aivr'] },
  { title: '7 · Ischaemia & infarction', goal: 'Map injury vectors to territories, including the STEMI equivalents.', pages: [['Injury simulator (incl. V4R, V7–V9)', '#/ischemia'], ['Sgarbossa / Smith', '#/tools/sgarbossa']], dx: ['stemi', 'stemiPosterior', 'nste', 'wellens', 'deWinter', 'oldMI', 'lvAneurysm'] },
  { title: '8 · Structure, inflammation & position', goal: 'Recognise mass, fluid, inflammation and recording artefacts.', pages: [['P-wave lab', '#/sandbox/p'], ['Lead reversal & artefact lab', '#/tools/leads']], dx: ['lvh', 'rvh', 'atrialEnlargement', 'hcm', 'athlete', 'pericarditis', 'myocarditis', 'pe', 'lowVoltage', 'leadReversal', 'dextrocardia', 'artifact'] },
  { title: '9 · Electrolytes, drugs & temperature', goal: 'Tie each ion or drug to the current it changes.', pages: [['Electrolyte lab', '#/electrolytes'], ['Drug lab', '#/electrolytes/drugs'], ['QTc calculator', '#/tools/qtc']], dx: ['hyperK', 'hypoK', 'hyperCa', 'hypoCa', 'magnesium', 'digoxinEffect', 'tca', 'qtDrug', 'hypothermia'] },
  { title: '10 · Inherited syndromes & cardiomyopathies', goal: 'Recognise the patterns that predict sudden death in the young.', pages: [['ST/T/QT lab', '#/sandbox/st']], dx: ['lqts', 'sqts', 'brugada', 'earlyRepol', 'cpvt', 'arvc', 'takotsubo'] },
  { title: '11 · Pacing & management', goal: 'Read paced ECGs and choose mechanism-based treatment.', pages: [['Management', '#/management'], ['CHA₂DS₂-VASc', '#/tools/chads']], dx: ['paced', 'pacerMalfunction'] },
  { title: '12 · Integration', goal: 'Apply everything to unseen ECGs at increasing difficulty.', pages: [['Case generator', '#/cases'], ['Challenge mode', '#/challenge'], ['Differential engine', '#/ddx']], dx: [] },
];

export function renderPath(root: HTMLElement): void {
  root.append(header('Learning path', 'From ion channel to bedside', 'A suggested order through the app. Mark diagnosis pages as reviewed (on each page, or here); progress is stored only in this browser.'));
  const host = h('div');
  const draw = (): void => {
    const done = reviewedSet();
    const all = PATH.flatMap((s) => s.dx);
    const n = all.filter((id) => done.has(id)).length;
    host.replaceChildren(
      h('section', { class: 'card' }, h('h2', null, `Overall: ${n} / ${all.length} diagnoses reviewed`), h('progress', { max: all.length, value: n, class: 'progress', 'aria-label': 'Overall progress' }), h('div', { class: 'btn-row' }, button('Reset progress', () => {
        if (confirm('Clear all reviewed marks in this browser?')) {
          resetProgress();
          draw();
        }
      }, 'btn-danger'))),
      ...PATH.map((s) => {
        const k = s.dx.filter((id) => done.has(id)).length;
        return h(
          'section',
          { class: 'card' },
          h('h2', null, s.title, s.dx.length ? h('span', { class: 'pill' }, `${k}/${s.dx.length}`) : null),
          p(s.goal),
          h('div', { class: 'btn-row' }, ...s.pages.map(([l, href]) => h('a', { class: 'btn', href }, l))),
          s.dx.length
            ? h(
                'ul',
                { class: 'checklist' },
                ...s.dx.map((id) => {
                  const d = resolveDx(id);
                  const cb = h('input', { type: 'checkbox', checked: done.has(id), 'aria-label': `Reviewed: ${d?.name ?? id}` });
                  cb.addEventListener('change', () => {
                    setReviewed(id, cb.checked);
                    draw();
                  });
                  return h('li', null, h('label', null, cb, ' '), h('a', { href: `#/dx/${id}` }, d?.name ?? id));
                }),
              )
            : null,
        );
      }),
    );
  };
  root.append(host);
  draw();
}
