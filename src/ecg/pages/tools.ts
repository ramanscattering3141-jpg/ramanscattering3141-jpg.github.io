import { h, p, ul } from '../ui/dom';
import { header, presetPhysio, refList } from '../ui/common';
import { EcgPanel } from '../ui/panel';
import { button, segmented, select, slider, toggle } from '../ui/controls';
import { BRUGADA_WCT, VERECKEI_AVR, chadsAdvice, chadsVasc, qtc, runWct, sgarbossa, type ChadsInput, type WctStep } from '../content/calculators';
import type { Electrode, LeadReversal, ArtifactKind, PhysioPatch } from '../engine/params';
import { dxByCategory } from '../content/index';
import { dxTile } from '../ui/common';

type Cleanup = (() => void) | void;

const TOOLS: { id: string; title: string; desc: string; render: (root: HTMLElement) => Cleanup }[] = [
  { id: 'qtc', title: 'QTc calculator', desc: 'Bazett, Fridericia, Framingham and Hodges side by side — and why Bazett misleads at fast rates.', render: renderQtc },
  { id: 'chads', title: 'CHA₂DS₂-VASc / CHA₂DS₂-VA', desc: 'Stroke-risk score for AF/flutter with 2023 ACC/AHA and 2024 ESC thresholds.', render: renderChads },
  { id: 'sgarbossa', title: 'Sgarbossa & Smith-modified criteria', desc: 'Recognising acute occlusion MI in LBBB or ventricular pacing.', render: renderSgarbossa },
  { id: 'wct', title: 'Wide-complex tachycardia algorithms', desc: 'Step through the Brugada and Vereckei aVR algorithms with live examples.', render: renderWct },
  { id: 'leads', title: 'Lead reversal, dextrocardia & artefact lab', desc: 'Swap cables, mirror the heart, or shake one electrode — and see which leads change.', render: renderLeadLab },
];

export function renderTools(root: HTMLElement, parts: string[]): Cleanup {
  const t = TOOLS.find((x) => x.id === parts[0]);
  if (!t) {
    root.append(header('Clinical tools', 'Calculators & decision aids', 'Each tool shows the formula or rule, why it works physiologically, and its source. Educational use: verify against current guidelines and local protocols.'));
    root.append(h('div', { class: 'grid' }, ...TOOLS.map((x) => h('a', { class: 'tile', href: `#/tools/${x.id}` }, h('h3', null, x.title), h('p', null, x.desc)))));
    return;
  }
  root.append(h('p', null, h('a', { href: '#/tools' }, '← All tools')));
  return t.render(root);
}

// ---------------------------------------------------------------------------
function renderQtc(root: HTMLElement): void {
  root.append(header('Clinical tools', 'QTc calculator', 'Repolarisation shortens as heart rate rises, so QT must be corrected to compare it across rates. The formulas disagree most at fast and slow rates.'));
  let qt = 400;
  let hr = 75;
  let sex: 'M' | 'F' = 'M';
  const out = h('div');
  const upd = (): void => {
    const r = qtc(qt, hr);
    const lim = sex === 'M' ? 450 : 460;
    const flag = (v: number): string => (v >= 500 ? 'marked prolongation (≥ 500 ms)' : v >= lim ? `prolonged (≥ ${lim} ms)` : v <= 390 ? 'short (≤ 390 ms)' : 'normal');
    const rows: [string, string, number][] = [
      ['Bazett', 'QT / √RR', r.bazett],
      ['Fridericia', 'QT / ∛RR', r.fridericia],
      ['Framingham', 'QT + 154 × (1 − RR)', r.framingham],
      ['Hodges', 'QT + 1.75 × (HR − 60)', r.hodges],
    ];
    // Same patient (true Fridericia QTc 420 ms) at different heart rates: what does Bazett report?
    const demo = [50, 70, 90, 110, 130, 150].map((x) => {
      const rr = 60 / x;
      const q = 420 * Math.cbrt(rr);
      return h('tr', null, h('td', null, `${x}/min`), h('td', null, `${Math.round(q)}`), h('td', null, `${Math.round(q / Math.sqrt(rr))}`), h('td', null, '420'));
    });
    out.replaceChildren(
      p(`RR = ${r.rr} ms (RR in seconds is used in the formulas).`, 'ref-meta'),
      h('div', { class: 'table-scroll' }, h('table', { class: 't' }, h('thead', null, h('tr', null, h('th', null, 'Formula'), h('th', null, 'Equation'), h('th', null, 'QTc (ms)'), h('th', null, 'Interpretation'))), h('tbody', null, ...rows.map(([n, eq, v]) => h('tr', null, h('td', null, n), h('td', null, eq), h('td', null, h('strong', null, String(v))), h('td', null, flag(v))))))),
      h('h3', null, 'Why the choice matters'),
      p('Bazett’s square-root correction over-corrects at high heart rates and under-corrects at low rates. The table models one patient whose rate-independent QTc is 420 ms:'),
      h('div', { class: 'table-scroll' }, h('table', { class: 't' }, h('thead', null, h('tr', null, h('th', null, 'Heart rate'), h('th', null, 'Measured QT'), h('th', null, 'Bazett QTc'), h('th', null, 'Fridericia QTc'))), h('tbody', null, ...demo))),
    );
  };
  root.append(
    h(
      'section',
      { class: 'card' },
      slider({ label: 'Measured QT', min: 240, max: 700, step: 5, value: qt, unit: 'ms', onInput: (v) => ((qt = v), upd()) }),
      slider({ label: 'Heart rate', min: 30, max: 200, step: 1, value: hr, unit: '/min', onInput: (v) => ((hr = v), upd()) }),
      segmented<'M' | 'F'>([['M', 'Male'], ['F', 'Female']], sex, (v) => ((sex = v), upd()), 'Sex (for thresholds)'),
      out,
      ul([
        'Measure QT from QRS onset to T-wave end in the lead with the longest QT (often II or V2–V3); exclude U waves separated from T.',
        'With QRS widening (BBB, pacing), part of the QT is depolarisation: consider the JT interval or a QRS-adjusted QT.',
        'In AF, average several beats — QT varies with the preceding RR.',
        'QTc ≥ 500 ms (or an increase ≥ 60 ms on a drug) marks substantially increased torsades risk.',
      ]),
    ),
  );
  upd();
  root.append(refList(['ecgStd4', 'tdp2010']));
}

// ---------------------------------------------------------------------------
function renderChads(root: HTMLElement): void {
  root.append(header('Clinical tools', 'CHA₂DS₂-VASc & CHA₂DS₂-VA', 'Stroke risk in AF (and atrial flutter) rises with each risk factor that promotes atrial remodelling, stasis and endothelial dysfunction. The score estimates thromboembolic risk; bleeding risk and patient preference are weighed separately.'));
  const x: ChadsInput = { chf: false, htn: false, age: 60, dm: false, strokeTia: false, vascular: false, female: false };
  const out = h('div', { class: 'callout' });
  const upd = (): void => {
    const s = chadsVasc(x);
    const a = chadsAdvice(x);
    out.replaceChildren(
      h('p', null, h('strong', null, `CHA₂DS₂-VASc = ${s.vasc}`), ` · CHA₂DS₂-VA (sex removed) = ${s.va}`),
      p(`**2023 ACC/AHA/ACCP/HRS:** ${a.acc}`),
      p(`**2024 ESC:** ${a.esc}`),
      p('These scores do NOT apply to AF with moderate–severe mitral stenosis or a mechanical valve (anticoagulate with warfarin), and in hypertrophic cardiomyopathy with AF anticoagulation is recommended regardless of the score.', 'ref-meta'),
    );
  };
  const t = (label: string, k: keyof ChadsInput, pts: string): HTMLElement => toggle(`${label} (${pts})`, x[k] as boolean, (v) => (((x as unknown as Record<string, unknown>)[k] = v), upd()));
  root.append(
    h(
      'section',
      { class: 'card' },
      t('Congestive heart failure / LV dysfunction', 'chf', '+1'),
      t('Hypertension', 'htn', '+1'),
      slider({ label: 'Age (65–74: +1; ≥ 75: +2)', min: 18, max: 100, step: 1, value: x.age, unit: 'y', onInput: (v) => ((x.age = v), upd()) }),
      t('Diabetes mellitus', 'dm', '+1'),
      t('Prior stroke / TIA / thromboembolism', 'strokeTia', '+2'),
      t('Vascular disease (prior MI, peripheral artery disease, aortic plaque)', 'vascular', '+1'),
      t('Female sex', 'female', '+1 in CHA₂DS₂-VASc; a risk modifier rather than a risk factor'),
      out,
    ),
  );
  upd();
  root.append(refList(['chadsvasc2010', 'af2023', 'escAf2024', 'hcm2024']));
}

// ---------------------------------------------------------------------------
function renderSgarbossa(root: HTMLElement): Cleanup {
  root.append(header('Clinical tools', 'Acute MI in LBBB or ventricular pacing', 'In LBBB and RV pacing the ST–T is SECONDARY: it points opposite to the QRS (appropriate discordance). Ischaemia is suspected when that rule breaks (concordance) or when discordance is excessive.'));
  const x = { concordantSTE: false, concordantSTDV1V3: false, discordantSTE5: false, st: 3, rs: -20 };
  const out = h('div', { class: 'callout' });
  const upd = (): void => {
    const r = sgarbossa({ concordantSTE: x.concordantSTE, concordantSTDV1V3: x.concordantSTDV1V3, discordantSTE5: x.discordantSTE5, discordantST: x.st, discordantRS: x.rs });
    out.replaceChildren(
      p(`**Original Sgarbossa score: ${r.score}** → ${r.original ? 'meets the ≥ 3 threshold (specific for acute MI)' : 'below 3 (low sensitivity: does not exclude MI)'}.`),
      p(`**Smith-modified:** ST/S ratio = ${r.smithRatio === null ? '—' : r.smithRatio.toFixed(2)} → ${r.smith ? 'POSITIVE (a concordant criterion, or discordant ST elevation ≥ 1 mm with ST/S ≤ −0.25)' : 'negative'}.`),
    );
  };
  const panel = new EcgPanel({ heart: false, duration: 8000, layoutToggle: false });
  const show = (k: 'lbbb' | 'lbbbStemi' | 'paced'): void => {
    const patch: Record<string, PhysioPatch> = {
      lbbb: { bundle: 'lbbb', noise: 0.05 },
      lbbbStemi: { bundle: 'lbbb', noise: 0.05, ischemia: { territory: 'proxLAD', stage: 'stemi', extent: 1 } },
      paced: { noise: 0.05 },
    };
    panel.show(k === 'paced' ? presetPhysio('vvi', patch.paced) : presetPhysio('nsr', patch[k]));
  };
  root.append(
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'Criteria'),
      toggle('Concordant ST elevation ≥ 1 mm in any lead with a positive QRS (5 points)', false, (v) => ((x.concordantSTE = v), upd())),
      toggle('Concordant ST depression ≥ 1 mm in V1, V2 or V3 (3 points)', false, (v) => ((x.concordantSTDV1V3 = v), upd())),
      toggle('Discordant ST elevation ≥ 5 mm (2 points — original criterion 3)', false, (v) => ((x.discordantSTE5 = v), upd())),
      h('h3', null, 'Smith modification (replaces criterion 3)'),
      slider({ label: 'ST elevation at the J point (vs PR segment) in the lead with the most discordant STE', min: -10, max: 10, step: 0.5, value: x.st, unit: 'mm', onInput: (v) => ((x.st = v), upd()) }),
      slider({ label: 'Preceding S-wave depth in that lead (entered as negative)', min: -40, max: 40, step: 1, value: x.rs, unit: 'mm', onInput: (v) => ((x.rs = v), upd()) }),
      out,
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'See the physiology'),
      segmented<'lbbb' | 'lbbbStemi' | 'paced'>([['lbbb', 'LBBB alone (appropriate discordance)'], ['lbbbStemi', 'LBBB + proximal LAD occlusion'], ['paced', 'RV pacing']], 'lbbb', show, 'Example'),
      panel.el,
      p('In the model, the injury vector adds to the secondary ST vector: leads with a positive QRS can show concordant elevation, and V1–V3 (negative QRS) show less elevation or concordant depression depending on the territory.', 'ref-meta'),
    ),
  );
  upd();
  show('lbbb');
  root.append(refList(['sgarbossa1996', 'smith2012', 'acs2025']));
  return () => panel.destroy();
}

// ---------------------------------------------------------------------------
function stepper(title: string, steps: WctStep[]): HTMLElement {
  const answers: boolean[] = [];
  const box = h('div');
  const draw = (): void => {
    const r = runWct(steps, answers);
    const items = steps.slice(0, r.result === 'incomplete' ? r.stoppedAt + 1 : r.stoppedAt + 1).map((s, i) => {
      const ans = answers[i];
      const row = h('li', null, h('strong', null, s.question), h('div', { class: 'ref-meta' }, s.why));
      if (ans === undefined) {
        row.append(
          h(
            'div',
            { class: 'btn-row' },
            button('Yes', () => {
              answers[i] = true;
              draw();
            }),
            button('No', () => {
              answers[i] = false;
              draw();
            }),
          ),
        );
      } else row.append(h('div', null, `Answer: ${ans ? 'yes' : 'no'}`));
      return row;
    });
    box.replaceChildren(
      ...[
        h('h3', null, title),
        h('ol', null, ...items),
        r.result !== 'incomplete' ? h('div', { class: 'callout' }, p(`**Result: ${r.result}.** ${r.result === 'VT' ? 'Criterion met — algorithm stops.' : 'No VT criterion met.'} If still uncertain, treat as VT.`)) : null,
        answers.length ? button('Restart', () => ((answers.length = 0), draw())) : null,
      ].filter((x) => x !== null),
    );
  };
  draw();
  return box;
}

function renderWct(root: HTMLElement): Cleanup {
  root.append(header('Clinical tools', 'Wide-complex tachycardia: VT or SVT with aberrancy?', 'Both algorithms exploit the same physiology: supraventricular impulses start ventricular activation through the fast His–Purkinje system, whereas VT starts in working myocardium and spreads slowly at first.'));
  const panel = new EcgPanel({ heart: true, duration: 8000 });
  const ex: Record<string, () => void> = {
    vt: () => panel.show(presetPhysio('monoVT')),
    svtRbbb: () => panel.show(presetPhysio('avnrt', { bundle: 'rbbb' })),
    svtLbbb: () => panel.show(presetPhysio('avnrt', { bundle: 'lbbb' })),
    anti: () => panel.show(presetPhysio('antiAvrt')),
  };
  root.append(
    h(
      'section',
      { class: 'card' },
      segmented<string>([['vt', 'Scar VT'], ['svtRbbb', 'AVNRT + RBBB'], ['svtLbbb', 'AVNRT + LBBB'], ['anti', 'Antidromic AVRT']], 'vt', (v) => ex[v](), 'Example ECG'),
      panel.el,
    ),
    h('div', { class: 'grid-2' }, h('section', { class: 'card' }, stepper('Brugada algorithm (1991)', BRUGADA_WCT)), h('section', { class: 'card' }, stepper('Vereckei aVR algorithm (2008)', VERECKEI_AVR))),
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'Clinical pearls'),
      ul([
        'Structural heart disease or prior MI makes VT far more likely than SVT with aberrancy — history matters as much as morphology.',
        'Haemodynamic stability does NOT distinguish VT from SVT.',
        'Pre-excited tachycardia (antidromic AVRT) meets most "VT" criteria because it, too, starts in ventricular muscle.',
        'If in doubt, treat as VT; avoid IV verapamil/diltiazem in undiagnosed WCT.',
      ]),
    ),
  );
  ex.vt();
  root.append(refList(['brugadaWct1991', 'vereckei2008', 'va2017', 'acls2025']));
  return () => panel.destroy();
}

// ---------------------------------------------------------------------------
function renderLeadLab(root: HTMLElement): Cleanup {
  root.append(header('Clinical tools', 'Lead reversal, dextrocardia & artefact lab', 'Limb leads are fixed combinations of three electrode potentials (RA, LA, LL); chest leads are referenced to their average (Wilson’s central terminal). Change the electrodes, not the heart, and watch which leads change.'));
  let rev: LeadReversal = 'none';
  let dextro = false;
  let art: ArtifactKind = 'none';
  let el: Electrode = 'RA';
  const panel = new EcgPanel({ heart: false, duration: 10000 });
  const explain = h('div', { class: 'callout' });
  const text: Record<LeadReversal, string> = {
    none: 'Correct cable connection.',
    raLa: '**RA ↔ LA:** I = LA − RA becomes −I (all waves inverted); II ↔ III; aVR ↔ aVL; aVF and V1–V6 unchanged. Clue: negative P in I, positive P in aVR, normal chest leads.',
    laLl: '**LA ↔ LL:** I ↔ II, III → −III, aVL ↔ aVF; aVR and chest leads unchanged. Clue: P wave taller in I than in II; negative P in III. Easily missed.',
    raLl: '**RA ↔ LL:** II → −II; I → −III and III → −I; aVR ↔ aVF. Clue: inverted P and QRS in II, III and aVF with a positive aVR.',
  };
  const rerun = (): void => {
    panel.stop();
    panel.show(presetPhysio('nsr', { noise: art === 'none' ? 0.08 : 0.05, leadReversal: rev, dextrocardia: dextro, artifact: { kind: art, electrode: el, amp: art === 'tremor' ? 0.8 : 0.9 } }));
    const spared = { RA: 'III', LA: 'II', LL: 'I' }[el];
    const ownAug = { RA: 'aVR', LA: 'aVL', LL: 'aVF' }[el];
    explain.replaceChildren(
      ...[
      p(text[rev]),
      dextro ? p('**Dextrocardia:** the heart vector is mirrored → P, QRS and T inverted in I, aVR/aVL exchanged, and R waves DECREASE from V1 to V6. Unlike RA/LA reversal, the chest leads are abnormal; right-sided chest leads would look normal.') : null,
      art !== 'none' ? p(`**${art === 'motion' ? 'Motion' : 'Tremor'} artefact at ${el}:** appears in every lead that uses ${el} (full size in two bipolar leads and in ${ownAug}, half size in the other two augmented leads, one-third size in every chest lead) and is absent from lead ${spared}. Native QRS complexes continue at the sinus rate — the model’s measurements still say sinus rhythm.`) : null,
      ].filter((x): x is HTMLParagraphElement => !!x),
    );
  };
  root.append(
    h(
      'section',
      { class: 'card' },
      segmented<LeadReversal>([['none', 'Correct'], ['raLa', 'RA ↔ LA'], ['laLl', 'LA ↔ LL'], ['raLl', 'RA ↔ LL']], rev, (v) => ((rev = v), rerun()), 'Limb cables'),
      toggle('Dextrocardia (mirror-image heart)', dextro, (v) => ((dextro = v), rerun())),
      segmented<ArtifactKind>([['none', 'No artefact'], ['motion', 'Motion burst (pseudo-VT)'], ['tremor', 'Tremor (pseudo-flutter/AF)']], art, (v) => ((art = v), rerun()), 'Artefact'),
      select<Electrode>({ label: 'Artefact electrode', value: el, options: [['RA', 'Right arm'], ['LA', 'Left arm'], ['LL', 'Left leg']], onChange: (v) => ((el = v), rerun()) }),
      explain,
      panel.el,
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'Electrode arithmetic'),
      h(
        'div',
        { class: 'table-scroll' },
        h(
          'table',
          { class: 't' },
          h('thead', null, h('tr', null, h('th', null, 'Lead'), h('th', null, 'RA'), h('th', null, 'LA'), h('th', null, 'LL'))),
          h(
            'tbody',
            null,
            ...(
              [
                ['I', '−1', '+1', '0'],
                ['II', '−1', '0', '+1'],
                ['III', '0', '−1', '+1'],
                ['aVR', '+1', '−½', '−½'],
                ['aVL', '−½', '+1', '−½'],
                ['aVF', '−½', '−½', '+1'],
                ['V1–V6', '−⅓', '−⅓', '−⅓'],
              ] as string[][]
            ).map((r) => h('tr', null, ...r.map((c, i) => (i ? h('td', null, c) : h('th', null, c))))),
          ),
        ),
      ),
      p('Each row is what a lead records from each electrode (chest leads also add their own electrode with +1). Read down a column to see where a signal on that electrode will appear.'),
    ),
  );
  root.append(h('h2', null, 'Related diagnoses'), h('div', { class: 'grid' }, ...dxByCategory(['technical']).map(dxTile)));
  rerun();
  root.append(refList(['leadReversal2007', 'artifact1999', 'ecgStd1']));
  return () => panel.destroy();
}
