import { h, p, ul, debounce } from '../ui/dom';
import { header, presetPhysio, refList, whyList } from '../ui/common';
import { EcgPanel } from '../ui/panel';
import { button, segmented, slider, toggle } from '../ui/controls';
import { managementBlock } from './library';
import { resolveDx } from '../content/index';
import type { ApLocation, Physio } from '../engine/params';
import { AP_SITE } from '../engine/morphology';

function explainRun(panel: EcgPanel, kind: 'avnrt' | 'avrt'): string {
  const run = panel.run;
  if (!run) return '';
  const vs = run.sim.ventricular.filter((v) => v.t > 1500);
  const retro = run.sim.atrial.filter((a) => a.t > 1500 && a.kind === 'retro');
  const sustained = retro.length >= 4;
  if (kind === 'avnrt') {
    if (!sustained) {
      const slowUsed = run.sim.atrial.some((a) => a.via === 'slow');
      return slowUsed
        ? 'The premature beat conducted down the SLOW pathway (long PR) but the circuit did not sustain: either the fast pathway had not recovered for retrograde conduction, or the slow pathway was still refractory when the echo returned. Try shortening slow-pathway refractoriness or slowing slow-pathway conduction.'
        : 'The premature beat did not enter the slow pathway alone: the fast pathway had already recovered (its refractory period is shorter than the coupling interval) or the slow pathway was refractory too. Lengthen the fast-pathway refractory period or shorten the slow pathway’s.';
    }
    const cl = vs.length > 3 ? Math.round((vs[vs.length - 1].t - vs[vs.length - 4].t) / 3) : 0;
    return `Sustained AVNRT: cycle length ≈ ${cl} ms (≈ ${Math.round(60000 / cl)}/min) = slow-pathway conduction + fast-pathway retrograde time + turnaround. Each turn activates the ventricles (down the His) and the atria (up from the node) almost simultaneously, so the retrograde P sits at the end of the QRS.`;
  }
  if (!sustained) return 'No sustained re-entry. For orthodromic AVRT the premature beat must block in the accessory pathway (longer refractory period than the coupling) yet conduct through the AV node — and by the time it reaches the pathway from the ventricular side, the pathway must have recovered.';
  const cl = vs.length > 3 ? Math.round((vs[vs.length - 1].t - vs[vs.length - 4].t) / 3) : 0;
  const pre = vs.filter((v) => v.route === 'ap').length > vs.length / 2;
  return `Sustained ${pre ? 'ANTIDROMIC' : 'ORTHODROMIC'} AVRT, cycle length ≈ ${cl} ms. ${pre ? 'The ventricles are activated entirely via the pathway → wide, fully pre-excited QRS; the AV node carries the impulse back to the atria.' : 'Narrow QRS (normal His–Purkinje activation); the retrograde P appears after the QRS because the impulse must cross the ventricle and the pathway before reaching the atria.'}`;
}

export function renderAvnrtLab(root: HTMLElement): () => void {
  root.append(header('D · Rhythm Library — AVNRT', 'AV nodal re-entry: build the circuit', 'Two pathways into the AV node with different properties. Initiate re-entry with a premature beat, then manipulate each pathway and watch the ECG and ladder diagram change.'));
  const phys: Physio = presetPhysio('avnrt');
  const panel = new EcgPanel({ heart: true, layout: 'strips', leads: ['II', 'V1'], showLadder: true, showLabels: true, duration: 10000 });
  const explain = h('div', { class: 'callout' });
  const rerun = debounce(() => {
    panel.stop();
    panel.show(phys);
    explain.replaceChildren(p(explainRun(panel, 'avnrt')));
  }, 80);
  const R = phys.rhythm;
  const ctl = h(
    'div',
    { class: 'grid' },
    slider({ label: 'Fast pathway: refractory period', min: 220, max: 560, step: 5, value: R.fastERP, unit: 'ms', help: 'Long ERP is what lets a PAC block here.', onInput: (v) => ((R.fastERP = v), rerun()) }),
    slider({ label: 'Fast pathway: conduction time', min: 40, max: 140, step: 1, value: R.fastAH, unit: 'ms', onInput: (v) => ((R.fastAH = v), rerun()) }),
    slider({ label: 'Slow pathway: refractory period', min: 150, max: 450, step: 5, value: R.slowERP, unit: 'ms', help: 'Short ERP lets the PAC enter it.', onInput: (v) => ((R.slowERP = v), rerun()) }),
    slider({ label: 'Slow pathway: conduction time', min: 150, max: 420, step: 5, value: R.slowAH, unit: 'ms', help: 'Slower conduction gives the fast pathway time to recover → sustains the circuit and sets the tachycardia rate.', onInput: (v) => ((R.slowAH = v), rerun()) }),
    slider({ label: 'Retrograde fast-pathway time', min: 25, max: 120, step: 1, value: R.retroFastTime, unit: 'ms', onInput: (v) => ((R.retroFastTime = v), rerun()) }),
    slider({ label: 'PAC coupling interval', min: 240, max: 520, step: 5, value: R.triggerPAC?.coupling ?? 300, unit: 'ms', help: 'The "A1–A2" interval of an EP study.', onInput: (v) => ((R.triggerPAC = { at: 1500, coupling: v, site: 'leftAtrial' }), rerun()) }),
  );
  const acts = h(
    'div',
    { class: 'btn-row' },
    button('Give adenosine (t = 5 s)', () => ((R.interventions = [{ t: 5000, kind: 'adenosine' }]), rerun()), 'btn-primary'),
    button('Vagal manoeuvre (t = 5 s)', () => ((R.interventions = [{ t: 5000, kind: 'vagal' }]), rerun())),
    button('Synchronised cardioversion (t = 5 s)', () => ((R.interventions = [{ t: 5000, kind: 'shock' }]), rerun())),
    button('No intervention', () => ((R.interventions = []), rerun())),
    toggle('Dual pathways present (uncheck = "after slow-pathway ablation")', R.dualPathway, (v) => ((R.dualPathway = v), rerun())),
  );
  root.append(h('section', { class: 'card' }, ctl, acts, explain, panel.el));
  root.append(
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'The circuit, step by step'),
      whyList([
        { level: 'conduction', text: 'Sinus rhythm: impulses enter both pathways; the fast one reaches the His first and its wavefront collides with the slow-pathway wavefront from below → only the fast pathway "shows" (normal PR).' },
        { level: 'conduction', text: 'A PAC arrives while the fast pathway is refractory (its ERP > coupling) but the slow pathway is not → conduction down the slow pathway only → sudden PR prolongation ("jump").' },
        { level: 'conduction', text: 'Slow conduction buys time: the fast pathway recovers and conducts the impulse back up (retrograde) → an atrial echo.' },
        { level: 'conduction', text: 'If the slow pathway has recovered too, the impulse re-enters it → the loop sustains: atrial impulse → slow pathway → fast pathway → re-entry → rapid ventricular activation.' },
        { level: 'waveform', text: 'Atria (retrograde, from the septum upward) and ventricles are activated almost simultaneously → retrograde P hidden at the end of the QRS: pseudo-r′ in V1, pseudo-S in II/III/aVF, very short RP.' },
        { level: 'treatment', text: 'The circuit lives in the AV node → anything that blocks the node for one beat (adenosine, vagal tone) terminates it; slow-pathway ablation removes the substrate.' },
      ]),
    ),
  );
  const d = resolveDx('avnrt');
  if (d?.management) root.append(h('section', { class: 'card' }, h('h2', null, 'Management — linked to the mechanism'), managementBlock(d.management)));
  root.append(refList(['svt2015', 'escSvt2019', 'acls2025']));
  rerun();
  return () => panel.destroy();
}

export function renderAvrtLab(root: HTMLElement): () => void {
  root.append(header('D · Rhythm Library — AVRT & pre-excitation', 'Accessory pathways: WPW, AVRT, pre-excited AF', 'An accessory pathway is a strand of muscle across the AV groove: fast, non-decremental, bypassing the AV node. Move it, block it, make it concealed — and follow the ECG.'));
  let phys: Physio = presetPhysio('wpw');
  let scenario: 'sinus' | 'ortho' | 'anti' | 'af' = 'sinus';
  const panel = new EcgPanel({ heart: true, duration: 10000, layout: '12' });
  const explain = h('div', { class: 'callout' });
  const loc = { v: 'rightFreeWall' as ApLocation };
  const setup = (): void => {
    const base = scenario === 'sinus' ? 'wpw' : scenario === 'ortho' ? 'orthoAvrt' : scenario === 'anti' ? 'antiAvrt' : 'preexAf';
    const keepAnte = phys.rhythm.ap.antegrade;
    const keepErp = phys.rhythm.ap.erp;
    phys = presetPhysio(base);
    phys.rhythm.ap.location = loc.v;
    if (scenario !== 'anti') phys.rhythm.ap.antegrade = keepAnte;
    if (scenario === 'af' || scenario === 'sinus') phys.rhythm.ap.erp = keepErp;
  };
  const rerun = debounce(() => {
    panel.stop();
    panel.show(phys);
    const txt: Record<string, string> = {
      sinus: phys.rhythm.ap.antegrade ? `Pre-excitation from a ${AP_SITE[loc.v].label} pathway. Short PR (the pathway skips the nodal delay), delta wave (slow muscle-to-muscle activation near the insertion), wide fused QRS. Delta polarity points away from the insertion site — compare leads I, aVL, II, III, aVF and V1 as you move it.` : 'Concealed pathway: it cannot conduct antegradely, so the sinus ECG is NORMAL — yet it can still form the retrograde limb of orthodromic AVRT.',
      ortho: explainRun(panel, 'avrt'),
      anti: explainRun(panel, 'avrt'),
      af: 'Pre-excited AF: fibrillatory impulses reach the ventricles over the pathway, limited only by its refractory period. QRS width varies with the degree of fusion. Try the AV-nodal blocker: the rate does not fall and more beats become fully pre-excited.',
    };
    explain.replaceChildren(p(txt[scenario]));
  }, 80);
  const locSeg = segmented<ApLocation>(Object.entries(AP_SITE).map(([k, v]) => [k as ApLocation, v.label]), loc.v, (v) => {
    loc.v = v;
    phys.rhythm.ap.location = v;
    rerun();
  }, 'Pathway location');
  root.append(
    h(
      'section',
      { class: 'card' },
      segmented<'sinus' | 'ortho' | 'anti' | 'af'>(
        [
          ['sinus', 'Sinus rhythm (WPW pattern)'],
          ['ortho', 'Orthodromic AVRT'],
          ['anti', 'Antidromic AVRT'],
          ['af', 'Pre-excited AF'],
        ],
        'sinus',
        (v) => {
          scenario = v;
          setup();
          rerun();
        },
        'Scenario',
      ),
      locSeg,
      h(
        'div',
        { class: 'grid' },
        toggle('Antegrade conduction (manifest pathway)', true, (v) => ((phys.rhythm.ap.antegrade = v), rerun()), 'Off = concealed pathway'),
        slider({ label: 'Pathway refractory period', min: 170, max: 450, step: 5, value: phys.rhythm.ap.erp, unit: 'ms', help: 'Short refractory periods allow dangerously fast pre-excited AF.', onInput: (v) => ((phys.rhythm.ap.erp = v), rerun()) }),
        slider({ label: 'AV-nodal conduction (AH)', min: 40, max: 250, step: 5, value: phys.rhythm.avnAHmin, unit: 'ms', help: 'Slower nodal conduction → more pre-excitation (bigger delta).', onInput: (v) => ((phys.rhythm.avnAHmin = v), rerun()) }),
      ),
      h(
        'div',
        { class: 'btn-row' },
        button('Adenosine (t = 5 s)', () => ((phys.rhythm.interventions = [{ t: 5000, kind: 'adenosine' }]), rerun()), 'btn-primary'),
        button('IV AV-nodal blocker', () => ((phys.rhythm.interventions = [{ t: 2000, kind: 'avnBlocker' }]), rerun())),
        button('Procainamide (pathway refractoriness ↑)', () => ((phys.drugs.naBlocker = 0.6), rerun())),
        button('Cardioversion (t = 5 s)', () => ((phys.rhythm.interventions = [{ t: 5000, kind: 'shock' }]), rerun())),
        button('Reset', () => {
          phys.drugs.naBlocker = 0;
          phys.rhythm.interventions = [];
          rerun();
        }),
      ),
      explain,
      panel.el,
    ),
  );
  root.append(
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'Orthodromic vs antidromic'),
      ul([
        '**Orthodromic** (~90–95%): atrium → AV node → His–Purkinje → ventricle → accessory pathway → atrium. Narrow QRS because the ventricles are activated normally.',
        '**Antidromic**: atrium → accessory pathway → ventricle → His/AV node → atrium. Wide QRS because the ventricles are activated entirely from the pathway insertion.',
        '**Localisation concept**: the delta wave vector points away from the insertion. Left-sided pathways → delta positive in V1 (R > S), negative in I/aVL. Right free wall → negative V1, LBBB-like. Posteroseptal → negative delta in II, III, aVF. (Validated algorithms, e.g. Arruda 1998, use the first 20 ms of the delta wave in I, II, aVF, V1.)',
      ]),
    ),
  );
  for (const id of ['orthoAvrt', 'preexAf']) {
    const d = resolveDx(id);
    if (d?.management) root.append(h('section', { class: 'card' }, h('h2', null, `Management — ${d.name}`), managementBlock(d.management)));
  }
  root.append(refList(['svt2015', 'wpw2012', 'arruda1998', 'af2023']));
  rerun();
  return () => panel.destroy();
}

export function renderFlutterLab(root: HTMLElement): () => void {
  root.append(header('D · Rhythm Library — flutter & AF', 'Why the ventricular rate changes: AV-nodal filtering', 'The atria drive the AV node at ~300/min (flutter) or 350–600/min (AF). The ventricular rate is decided by the AV node’s refractoriness — watch the conduction ratio change as you lengthen it.'));
  const phys: Physio = presetPhysio('flutter21');
  const panel = new EcgPanel({ heart: true, layout: 'strips', leads: ['II', 'V1'], showLadder: true, showLabels: true, duration: 10000 });
  const explain = h('div', { class: 'callout' });
  const rerun = debounce(() => {
    panel.stop();
    const run = panel.show(phys);
    const m = run.m;
    explain.replaceChildren(p(phys.rhythm.atrialMechanism === 'flutter' ? `Atrial rate ${m.atrialRate}/min, ventricular rate ${m.ventRate}/min → ${m.avRelation}. ${m.regularity === 'regular' ? 'Fixed ratio: the nodal refractory period falls between two multiples of the flutter cycle.' : 'Variable block: the refractory period is close to a multiple of the flutter cycle, and concealed penetration shifts recovery beat to beat.'}` : `AF: ventricular rate ${m.ventRate}/min, ${m.regularity}. Each fibrillatory wavefront that reaches a partly recovered node penetrates and resets it (concealed conduction) — the source of the irregularity.`));
  }, 80);
  const R = phys.rhythm;
  root.append(
    h(
      'section',
      { class: 'card' },
      segmented<'flutter' | 'fibrillation'>(
        [
          ['flutter', 'Atrial flutter'],
          ['fibrillation', 'Atrial fibrillation'],
        ],
        'flutter',
        (v) => ((R.atrialMechanism = v), rerun()),
        'Atrial mechanism',
      ),
      h(
        'div',
        { class: 'grid' },
        slider({ label: 'AV-nodal refractoriness', min: 150, max: 800, step: 5, value: R.avnERP, unit: 'ms', help: '≈250 → 2:1; ≈450 → 3:1; ≈650 → 4:1 (with low decrement).', onInput: (v) => ((R.avnERP = v), rerun()) }),
        slider({ label: 'Decremental conduction', min: 0, max: 350, step: 5, value: R.avnDecrement, unit: 'ms', help: 'Higher → Wenckebach-like grouping and variable ratios.', onInput: (v) => ((R.avnDecrement = v), rerun()) }),
        slider({ label: 'Flutter cycle length', min: 180, max: 320, step: 5, value: R.flutterCL, unit: 'ms', help: 'Slower flutter (e.g. class IC drugs) can allow 1:1 conduction!', onInput: (v) => ((R.flutterCL = v), rerun()) }),
        slider({ label: 'AF wavefront interval', min: 110, max: 260, step: 5, value: R.afMeanCL, unit: 'ms', onInput: (v) => ((R.afMeanCL = v), rerun()) }),
        toggle('Concealed conduction', R.concealed, (v) => ((R.concealed = v), rerun())),
      ),
      h('div', { class: 'btn-row' }, button('Adenosine (unmasks F waves)', () => ((R.interventions = [{ t: 3000, kind: 'adenosine' }]), rerun()), 'btn-primary'), button('β-blocker / CCB effect', () => ((phys.drugs.betaBlocker = 0.8), rerun())), button('Cardioversion (t = 5 s)', () => ((R.interventions = [{ t: 5000, kind: 'shock' }]), rerun())), button('Reset', () => ((R.interventions = []), (phys.drugs.betaBlocker = 0), rerun()))),
      explain,
      panel.el,
    ),
    h(
      'section',
      { class: 'card' },
      h('h2', null, 'Why flutter waves look like a sawtooth'),
      whyList([
        { level: 'conduction', text: 'Typical (counter-clockwise) flutter circulates around the tricuspid annulus: up the septum, across the roof, down the lateral wall, through the cavotricuspid isthmus.' },
        { level: 'vector', text: 'For most of the cycle the septum is activated caudo-cranially → a superiorly directed atrial vector; there is never a moment without atrial activity.' },
        { level: 'lead', text: 'Inferior leads (II, III, aVF) see this as a slow negative ramp then a quick return → negative sawtooth; V1 sees positive discrete F waves.' },
        { level: 'diagnosis', text: 'A regular ventricular rate near 150/min + negative sawtooth in II/III/aVF = 2:1 flutter. Clockwise flutter reverses the polarity.' },
      ]),
    ),
  );
  for (const id of ['flutter', 'af']) {
    const d = resolveDx(id);
    if (d?.management) root.append(h('section', { class: 'card' }, h('h2', null, `Management — ${d.name}`), managementBlock(d.management)));
  }
  root.append(refList(['svt2015', 'af2023', 'escAf2024', 'ccsAf2020', 'acls2025']));
  rerun();
  return () => panel.destroy();
}
