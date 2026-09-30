import { h, p, storageGet, storageSet } from '../ui/dom';
import { header, presetPhysio } from '../ui/common';
import { EcgPanel } from '../ui/panel';
import { button, segmented } from '../ui/controls';
import { L1, L2, L2_CONDUCTION_OPTIONS, L2_MORPH_OPTIONS, L3, L4, L5, LEVEL_INFO, type QItem } from '../content/challenge';
import { mulberry32, newSeed, pick, shuffle } from '../engine/random';
import { randomVariation } from '../engine/variability';
import { axisLabel } from '../engine/measure';

interface Q {
  preset: string;
  q: string;
  options: string[];
  correct: string;
  explain: string;
  dx?: string;
  twelve: boolean;
}

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

function makeQuestion(level: number, seed: number): Q {
  const rng = mulberry32(seed);
  if (level === 1) {
    const [preset, label] = pick(rng, L1);
    const others = shuffle(rng, uniq(L1.map((x) => x[1]).filter((x) => x !== label))).slice(0, 3);
    return { preset, q: 'Identify the rhythm.', options: shuffle(rng, [label, ...others]), correct: label, explain: 'Compare the P waves, the P–QRS relationship, regularity and QRS width.', twelve: false };
  }
  if (level === 2) {
    const item = pick(rng, L2);
    switch (item.kind) {
      case 'axis':
        return { preset: item.preset, q: 'What is the frontal QRS axis?', options: ['normal', 'left axis deviation', 'right axis deviation', 'extreme (northwest) axis'], correct: '', explain: 'Leads I and aVF: both positive = normal; I positive/aVF negative = check II (negative → LAD); I negative/aVF positive = RAD.', twelve: true };
      case 'conduction':
        return { preset: item.preset, q: 'Which conduction abnormality is present?', options: shuffle(rng, uniq([item.answer!, ...shuffle(rng, L2_CONDUCTION_OPTIONS.filter((x) => x !== item.answer)).slice(0, 3)])), correct: item.answer!, explain: 'Look at V1 (RBBB: rSR′; LBBB: QS/rS), I/V6 (wide S vs broad notched R), axis (fascicles), PR and delta wave (pre-excitation).', twelve: true };
      case 'morph':
        return { preset: item.preset, q: 'What is the principal abnormality?', options: shuffle(rng, uniq([item.answer!, ...shuffle(rng, L2_MORPH_OPTIONS.filter((x) => x !== item.answer)).slice(0, 3)])), correct: item.answer!, explain: 'Distribution (territorial vs diffuse vs V1–V2), T-wave shape and voltage discriminate these.', twelve: true };
      case 'pr':
        return { preset: item.preset, q: 'How would you describe the PR interval?', options: ['short (< 120 ms)', 'normal (120–200 ms)', 'prolonged (> 200 ms)', 'progressively lengthening'], correct: '', explain: 'Measure from P onset to QRS onset with the caliper.', twelve: true };
      case 'qt':
        return { preset: item.preset, q: 'How would you describe the QTc?', options: ['short (< 360 ms)', 'normal', 'prolonged (> 460 ms)'], correct: '', explain: 'QTc (Bazett) = QT/√RR; use Fridericia at fast rates.', twelve: true };
      default:
        return { preset: item.preset, q: 'What is the QRS duration?', options: ['< 110 ms', '110–119 ms', '≥ 120 ms'], correct: '', explain: 'Measure in the lead with the widest QRS.', twelve: true };
    }
  }
  const bank: QItem[] = level === 3 ? L3 : level === 4 ? L4 : L5;
  const it = pick(rng, bank);
  return { preset: it.preset, q: it.q, options: shuffle(rng, [it.correct, ...it.wrong]), correct: it.correct, explain: it.explain, dx: it.dx, twelve: true };
}

export function renderChallenge(root: HTMLElement): () => void {
  root.append(header('M · ECG Challenge Mode', 'Progressive challenge', 'Five levels, from recognition to management. Every question uses a freshly generated ECG with patient variability — so you cannot memorise pictures.'));
  let level = storageGet('ecg.challenge.level', 1);
  const stats = storageGet<Record<string, [number, number]>>('ecg.challenge.stats', {});
  const scoreEl = h('div', { class: 'score' });
  const host = h('div');
  const info = h('p', { class: 'lead' });
  let panel: EcgPanel | null = null;
  const renderScore = (): void => {
    scoreEl.textContent = [1, 2, 3, 4, 5].map((l) => `L${l}: ${stats[l]?.[0] ?? 0}/${stats[l]?.[1] ?? 0}`).join(' · ');
  };
  const next = (): void => {
    panel?.destroy();
    info.textContent = LEVEL_INFO[level].text;
    const seed = newSeed();
    const q = makeQuestion(level, seed);
    const phys = randomVariation(presetPhysio(q.preset), seed);
    panel = new EcgPanel({ duration: 10000, measurements: false, layout: q.twelve ? '12' : 'strips', leads: ['II', 'V1'], layoutToggle: level >= 3 });
    const run = panel.show(phys);
    // Fill answers for measurement-based questions from the model's ground truth.
    let correct = q.correct;
    if (!correct) {
      const m = run.m;
      if (q.q.includes('axis')) correct = axisLabel(m.axis);
      else if (q.q.includes('PR')) correct = m.pr === null ? 'normal (120–200 ms)' : m.prRange && m.prRange[1] - m.prRange[0] > 40 ? 'progressively lengthening' : m.pr < 120 ? 'short (< 120 ms)' : m.pr > 200 ? 'prolonged (> 200 ms)' : 'normal (120–200 ms)';
      else if (q.q.includes('QTc')) correct = (m.qtcBazett ?? 420) < 360 ? 'short (< 360 ms)' : (m.qtcBazett ?? 420) > 460 ? 'prolonged (> 460 ms)' : 'normal';
      else correct = (m.qrs ?? 90) >= 120 ? '≥ 120 ms' : (m.qrs ?? 90) >= 110 ? '110–119 ms' : '< 110 ms';
    }
    const fb = h('div');
    const btns = q.options.map((o) =>
      button(o, () => {
        btns.forEach((b) => (b.disabled = true));
        const ok = o === correct;
        btns[q.options.indexOf(o)].classList.add(ok ? 'right' : 'wrong');
        const ci = q.options.indexOf(correct);
        if (ci >= 0) btns[ci].classList.add('right');
        const st = stats[level] ?? [0, 0];
        stats[level] = [st[0] + (ok ? 1 : 0), st[1] + 1];
        storageSet('ecg.challenge.stats', stats);
        renderScore();
        fb.replaceChildren(p(ok ? '✔ Correct.' : `✘ Answer: ${correct}.`), p(q.explain), p(`Model measurements: rate ${run.m.ventRate ?? '—'}, PR ${run.m.pr ?? '—'} ms, QRS ${run.m.qrs ?? '—'} ms, QTc ${run.m.qtcBazett ?? '—'} ms, axis ${run.m.axis ?? '—'}°.`, 'ref-meta'), ...(q.dx ? [h('p', null, h('a', { href: `#/dx/${q.dx}` }, 'Review the mechanism →'))] : []), h('div', { class: 'btn-row' }, button('Next question', next, 'btn-primary')));
      }, 'quiz-opt'),
    );
    host.replaceChildren(h('section', { class: 'card' }, h('h2', null, LEVEL_INFO[level].title), panel.el, h('h3', null, q.q), ...btns, fb));
  };
  root.append(
    h(
      'div',
      { class: 'btn-row' },
      segmented<string>(
        [1, 2, 3, 4, 5].map((l) => [String(l), `Level ${l}`] as [string, string]),
        String(level),
        (v) => {
          level = parseInt(v, 10);
          storageSet('ecg.challenge.level', level);
          next();
        },
        'Level',
      ),
      button('Skip', () => next()),
      button('Reset score', () => {
        for (const k of Object.keys(stats)) delete stats[k];
        storageSet('ecg.challenge.stats', stats);
        renderScore();
      }),
    ),
    scoreEl,
    info,
    host,
  );
  renderScore();
  next();
  return () => panel?.destroy();
}
