import { h, p, debounce } from '../ui/dom';
import { header, takeSimState } from '../ui/common';
import { EcgPanel } from '../ui/panel';
import { button, details, select, slider, toggle } from '../ui/controls';
import { makePhysio, type Physio, type InterventionKind } from '../engine/params';
import { PRESETS } from '../engine/presets';
import { TERRITORY, VENT_SITE, AP_SITE, P_SITE } from '../engine/morphology';
import { randomVariation } from '../engine/variability';

type Path = string;

function getAt(o: unknown, path: Path): unknown {
  return path.split('.').reduce<unknown>((a, k) => (a as Record<string, unknown>)?.[k], o);
}
function setAt(o: unknown, path: Path, v: unknown): void {
  const ks = path.split('.');
  let cur = o as Record<string, unknown>;
  for (let i = 0; i < ks.length - 1; i++) cur = cur[ks[i]] as Record<string, unknown>;
  cur[ks[ks.length - 1]] = v;
}

export function buildControls(state: { p: Physio }, onChange: () => void, opts: { compactOpen?: string[] } = {}): HTMLElement {
  const num = (label: string, path: Path, min: number, max: number, step: number, unit = '', help?: string): HTMLElement =>
    slider({ label, min, max, step, value: getAt(state.p, path) as number, unit, help, onInput: (v) => (setAt(state.p, path, v), onChange()) });
  const sel = <T extends string>(label: string, path: Path, options: [T, string][], help?: string): HTMLElement => select({ label, value: getAt(state.p, path) as T, options, help, onChange: (v) => (setAt(state.p, path, v), onChange()) });
  const tog = (label: string, path: Path, help?: string): HTMLElement => toggle(label, getAt(state.p, path) as boolean, (v) => (setAt(state.p, path, v), onChange()), help);
  const open = (k: string): boolean => (opts.compactOpen ?? []).includes(k);
  const atrialSites = Object.entries(P_SITE).filter(([k]) => !k.startsWith('retro')).map(([k, v]) => [k, v.label] as [string, string]);
  const ventSites = Object.entries(VENT_SITE).map(([k, v]) => [k, v.label] as [string, string]);
  const pattern: [string, string][] = [['none', 'none'], ['single', 'occasional'], ['bigeminy', 'bigeminy'], ['trigeminy', 'trigeminy'], ['couplet', 'couplets'], ['run', 'runs'], ['random', 'random']];

  return h(
    'div',
    null,
    details('Patient & autonomic tone', open('patient'),
      num('Age', 'age', 18, 90, 1, 'y'),
      sel('Sex', 'sex', [['M', 'male'], ['F', 'female']]),
      num('Autonomic tone', 'autonomic', -1, 1, 0.05, '', '−1 vagal … +1 sympathetic: sinus rate, AV-nodal speed/refractoriness, QT'),
      num('Body habitus / insulation', 'habitus', 0.4, 1.5, 0.05, '×', 'Lower = obesity, emphysema: smaller surface voltages'),
      num('Anatomical axis (heart position)', 'anatomicalAxis', -40, 40, 1, '°', '+ vertical heart, − horizontal heart'),
      num('Horizontal rotation', 'horizontalRotation', -40, 40, 1, '°', '− clockwise (late transition), + counter-clockwise'),
      num('Artefact / noise', 'noise', 0, 1, 0.05),
    ),
    details('Sinus node & atria', open('atria'),
      tog('Sinus node discharging', 'rhythm.sinusEnabled', 'Off = sinus arrest'),
      num('Sinus rate (intrinsic)', 'rhythm.sinusRate', 20, 180, 1, '/min'),
      num('Sinus arrhythmia', 'rhythm.sinusArrhythmia', 0, 0.3, 0.01),
      num('SA exit block (every Nth fails)', 'rhythm.saExitBlockEvery', 0, 6, 1, '', '0 = none'),
      sel('Atrial mechanism', 'rhythm.atrialMechanism', [['sinus', 'sinus'], ['focalAT', 'focal atrial tachycardia'], ['mat', 'multifocal atrial tachycardia'], ['flutter', 'atrial flutter (macro-re-entry)'], ['fibrillation', 'atrial fibrillation'], ['none', 'no atrial activity']]),
      num('Focal AT rate', 'rhythm.focalATRate', 90, 250, 1, '/min'),
      sel('Focal AT site', 'rhythm.focalATSite', atrialSites as [string, string][]),
      num('MAT mean rate', 'rhythm.matRate', 90, 170, 1, '/min'),
      num('Flutter cycle length', 'rhythm.flutterCL', 170, 300, 1, 'ms'),
      tog('Clockwise (reverse typical) flutter', 'rhythm.flutterReverse'),
      num('AF wavefront interval at AV node', 'rhythm.afMeanCL', 110, 260, 5, 'ms'),
      num('AF f-wave coarseness', 'rhythm.afCoarse', 0, 1, 0.05),
      num('Atrial refractory period', 'rhythm.atrialERP', 120, 350, 5, 'ms'),
      num('Right atrial size', 'raSize', 0.8, 2.5, 0.05, '×'),
      num('Left atrial size', 'laSize', 0.8, 2.5, 0.05, '×'),
      num('Atrial conduction velocity', 'atrialCV', 0.5, 1.5, 0.05, '×'),
      num('Interatrial (Bachmann) delay', 'interatrialDelay', 0, 80, 1, 'ms'),
    ),
    details('AV node (single or dual pathway)', open('avn'),
      tog('AV node conducts', 'rhythm.avnConducts'),
      sel('Complete block in AV node', 'rhythm.nodalBlock', [['none', 'no'], ['complete', 'yes (junctional escape possible)']]),
      num('Minimum nodal conduction time (AH)', 'rhythm.avnAHmin', 40, 350, 5, 'ms', 'Longer → first-degree AV block'),
      num('Nodal refractoriness (from last exit)', 'rhythm.avnERP', 80, 800, 5, 'ms', 'Longer → Wenckebach, higher flutter/AF block ratios'),
      num('Decremental conduction', 'rhythm.avnDecrement', 0, 400, 5, 'ms', 'Extra delay when an impulse arrives early in recovery'),
      num('Recovery time-constant', 'rhythm.avnTau', 30, 300, 5, 'ms'),
      tog('Concealed conduction', 'rhythm.concealed', 'Blocked impulses partially penetrate and reset recovery'),
      tog('Dual AV-nodal pathways', 'rhythm.dualPathway', 'Substrate for AVNRT'),
      num('Fast pathway conduction', 'rhythm.fastAH', 30, 150, 1, 'ms'),
      num('Fast pathway refractory period', 'rhythm.fastERP', 200, 600, 5, 'ms'),
      num('Slow pathway conduction', 'rhythm.slowAH', 150, 450, 5, 'ms'),
      num('Slow pathway refractory period', 'rhythm.slowERP', 150, 500, 5, 'ms'),
      num('Retrograde fast-pathway time', 'rhythm.retroFastTime', 20, 120, 1, 'ms'),
    ),
    details('His–Purkinje system & bundles', open('his'),
      num('HV interval', 'rhythm.hv', 30, 110, 1, 'ms'),
      sel('Infranodal block', 'rhythm.infranodal', [['none', 'none'], ['mobitz2', 'intermittent (Mobitz II)'], ['complete', 'complete (only ventricular escape)']]),
      num('Mobitz II: every Nth P blocked', 'rhythm.infranodalRatio', 2, 8, 1),
      num('High-grade: 1 of N conducts', 'rhythm.highGrade', 0, 5, 1, '', '0 = off; 2 = 2:1; 3 = 3:1'),
      sel('Bundle branches / fascicles', 'bundle', [['normal', 'normal'], ['rbbb', 'RBBB'], ['incompleteRbbb', 'incomplete RBBB'], ['lbbb', 'LBBB'], ['lafb', 'LAFB'], ['lpfb', 'LPFB'], ['rbbb+lafb', 'RBBB + LAFB'], ['rbbb+lpfb', 'RBBB + LPFB'], ['ivcd', 'nonspecific IVCD']]),
      num('Right-bundle refractoriness intercept', 'rhythm.rbERPbase', 60, 260, 5, 'ms', 'Higher → more rate-related/Ashman aberrancy'),
    ),
    details('Accessory pathway', open('ap'),
      tog('Accessory pathway present', 'rhythm.ap.present'),
      sel('Location', 'rhythm.ap.location', Object.entries(AP_SITE).map(([k, v]) => [k, v.label]) as [string, string][]),
      tog('Antegrade conduction (manifest → delta wave)', 'rhythm.ap.antegrade'),
      tog('Retrograde conduction', 'rhythm.ap.retrograde'),
      num('Pathway refractory period', 'rhythm.ap.erp', 160, 450, 5, 'ms', 'Short = dangerous in AF'),
      num('Pathway conduction time', 'rhythm.ap.time', 20, 80, 1, 'ms'),
    ),
    details('Escape pacemakers & premature beats', open('ectopy'),
      tog('Junctional pacemaker', 'rhythm.junctionalEnabled'),
      num('Junctional rate', 'rhythm.junctionalRate', 25, 150, 1, '/min'),
      tog('Enhanced junctional automaticity', 'rhythm.junctionalAccelerated'),
      tog('Ventricular escape pacemaker', 'rhythm.ventEscapeEnabled'),
      num('Ventricular escape rate', 'rhythm.ventEscapeRate', 15, 50, 1, '/min'),
      sel('Ventricular escape site', 'rhythm.ventEscapeSite', ventSites),
      sel('PAC pattern', 'rhythm.pac.pattern', pattern),
      num('PAC coupling interval', 'rhythm.pac.coupling', 250, 800, 5, 'ms'),
      sel('PAC site', 'rhythm.pac.site', atrialSites as [string, string][]),
      sel('PVC pattern', 'rhythm.pvc.pattern', pattern),
      num('PVC coupling interval', 'rhythm.pvc.coupling', 280, 700, 5, 'ms'),
      sel('PVC site', 'rhythm.pvc.site', ventSites),
      tog('VA (retrograde) conduction from ventricular beats', 'rhythm.pvc.retrograde'),
      tog('Multifocal PVCs', 'rhythm.pvc.multifocal'),
    ),
    details('Sustained ventricular mechanism', open('vt'),
      sel('Mechanism', 'rhythm.ventMechanism', [['none', 'none'], ['monoVT', 'monomorphic VT (re-entry)'], ['polyVT', 'polymorphic VT'], ['torsades', 'torsades de pointes'], ['bidirectional', 'bidirectional VT'], ['aivr', 'accelerated idioventricular'], ['vflutter', 'ventricular flutter'], ['vf', 'ventricular fibrillation'], ['asystole', 'ventricular standstill']]),
      num('Rate', 'rhythm.vtRate', 50, 280, 1, '/min'),
      sel('Exit / focus site', 'rhythm.vtSite', ventSites),
      num('Start time', 'rhythm.vtStart', 0, 15000, 100, 'ms'),
      num('Duration (0 = sustained)', 'rhythm.vtDuration', 0, 15000, 100, 'ms'),
      tog('Adenosine-sensitive (triggered, cAMP-mediated)', 'rhythm.vtAdenosineSensitive'),
    ),
    details('Ventricular myocardium & repolarisation', open('vent'),
      num('LV mass', 'lvMass', 0.7, 2.4, 0.05, '×'),
      num('RV mass', 'rvMass', 0.7, 3.5, 0.05, '×'),
      num('Myocardial conduction velocity', 'ventricularCV', 0.4, 1.5, 0.05, '×'),
      num('Extra axis rotation', 'axisShift', -90, 90, 1, '°'),
      num('Intrinsic QTc', 'qtcBase', 280, 600, 5, 'ms'),
      num('Early repolarisation (Ito notch)', 'earlyRepol', 0, 1, 0.05),
      select({ label: 'Brugada pattern', value: String(state.p.brugada), options: [['0', 'none'], ['1', 'type 1 (coved)'], ['2', 'type 2 (saddleback)']], onChange: (v) => ((state.p.brugada = Number(v) as 0 | 1 | 2), onChange()) }),
      num('Septal hypertrophy (HCM)', 'hcm', 0, 1, 0.05, '', 'Exaggerated initial septal forces → deep narrow lateral/inferior Q waves'),
      num('RV fibrofatty replacement (ARVC)', 'arvc', 0, 1, 0.05, '', 'Epsilon wave, terminal delay and T inversion in V1–V3'),
    ),
    details('Electrolytes, temperature & drugs', open('ions'),
      num('K⁺', 'K', 2, 9.5, 0.1, 'mmol/L'),
      num('Ca²⁺ (total)', 'Ca', 1.4, 3.8, 0.05, 'mmol/L'),
      num('Mg²⁺', 'Mg', 0.3, 4, 0.05, 'mmol/L'),
      num('Hypothermia', 'hypothermia', 0, 1, 0.05),
      num('β-blocker', 'drugs.betaBlocker', 0, 1, 0.05),
      num('Non-DHP calcium-channel blocker', 'drugs.ccb', 0, 1, 0.05),
      num('Digoxin (>1 = toxic)', 'drugs.digoxin', 0, 1.5, 0.05),
      num('Na⁺-channel blocker (class I / TCA)', 'drugs.naBlocker', 0, 1, 0.05),
      num('IKr blocker (QT drug)', 'drugs.qtDrug', 0, 1, 0.05),
      num('Amiodarone', 'drugs.amiodarone', 0, 1, 0.05),
    ),
    details('Ischaemia, inflammation, right heart, effusion', open('injury'),
      sel('Ischaemic territory', 'ischemia.territory', Object.entries(TERRITORY).map(([k, v]) => [k, `${v.label} — ${v.artery}`]) as [string, string][]),
      sel('Ischaemia stage', 'ischemia.stage', [['none', 'none'], ['hyperacute', 'hyperacute T'], ['stemi', 'acute transmural injury (STEMI)'], ['evolving', 'evolving (Q + T inversion)'], ['old', 'old infarct (Q waves)'], ['subendocardial', 'subendocardial ischaemia'], ['wellens', 'Wellens (reperfused LAD)'], ['deWinter', 'de Winter (J-point STD + tall T)'], ['aneurysm', 'LV aneurysm (Q + persistent STE)'], ['takotsubo', 'Takotsubo (deep TWI, long QT)']]),
      num('Extent', 'ischemia.extent', 0.1, 1, 0.05),
      num('Pericarditis stage', 'pericarditis', 0, 4, 1, '', '1 = STE + PR depression, 2 = ST normalises / T flattens, 3 = T inversion, 4 = normalisation'),
      num('Myocarditis', 'myocarditis', 0, 1, 0.05),
      num('Acute RV strain (PE)', 'rvStrain', 0, 1, 0.05),
      num('Low voltage (effusion)', 'lowVoltage', 0, 1, 0.05),
      num('Electrical alternans', 'alternans', 0, 1, 0.05),
    ),
    details('Pacemaker', open('pacer'),
      sel('Mode', 'rhythm.pacer.mode', [['none', 'none'], ['AAI', 'AAI'], ['VVI', 'VVI'], ['DDD', 'DDD'], ['VOO', 'VOO (asynchronous)'], ['DOO', 'DOO (asynchronous)']]),
      num('Lower rate', 'rhythm.pacer.lowerRate', 30, 120, 1, '/min'),
      num('AV delay', 'rhythm.pacer.avDelay', 80, 300, 5, 'ms'),
      sel('Fault', 'rhythm.pacer.fault', [['none', 'none'], ['failCapture', 'failure to capture'], ['failSense', 'undersensing'], ['oversense', 'oversensing (inhibition)']]),
      tog('Bipolar lead (small spikes)', 'rhythm.pacer.bipolar'),
    ),
    details('Heart position, electrodes & artefact', open('recording'),
      tog('Dextrocardia (mirror-image heart)', 'dextrocardia'),
      sel('Limb-cable reversal', 'leadReversal', [['none', 'none (correct)'], ['raLa', 'RA ↔ LA'], ['laLl', 'LA ↔ LL'], ['raLl', 'RA ↔ LL']], 'Chest leads are unaffected: Wilson’s terminal is unchanged'),
      sel('Artefact', 'artifact.kind', [['none', 'none'], ['motion', 'motion burst (pseudo-VT)'], ['tremor', 'tremor (pseudo-flutter/AF)']]),
      sel('Artefact electrode', 'artifact.electrode', [['RA', 'right arm'], ['LA', 'left arm'], ['LL', 'left leg']]),
      num('Artefact amplitude', 'artifact.amp', 0, 1.5, 0.05, 'mV'),
    ),
  );
}

export function renderSimulator(root: HTMLElement, _parts: string[], q: URLSearchParams): () => void {
  const presetId = q.get('preset');
  const fromState = q.get('from') === 'state' ? takeSimState() : null;
  const state = { p: fromState ?? makePhysio(presetId && PRESETS[presetId] ? PRESETS[presetId].patch : {}) };
  let duration = 10000;
  root.append(header('C · ECG Simulator', 'The physiological ECG engine', 'Every control changes a physiological variable — never a picture. Change one thing, predict the ECG, then observe. Use the ladder diagram to see exactly where each impulse conducted or blocked.'));
  const panel = new EcgPanel({ heart: true, duration, layout: '12', leads: ['II', 'V1'] });
  const rerun = debounce(() => {
    panel.stop();
    panel.show(state.p);
  }, 80);
  const controlsHost = h('div');
  const rebuild = (): void => {
    controlsHost.replaceChildren(buildControls(state, rerun, { compactOpen: ['atria', 'avn'] }));
  };
  const presetSel = select({
    label: 'Start from a physiological state',
    value: (presetId ?? 'nsr') as string,
    options: Object.entries(PRESETS).map(([k, v]) => [k, v.label]),
    onChange: (v) => {
      state.p = makePhysio(PRESETS[v].patch);
      note.replaceChildren(p(PRESETS[v].physiology));
      rebuild();
      rerun();
    },
  });
  const note = h('div', { class: 'callout' }, p(PRESETS[presetId ?? 'nsr']?.physiology ?? 'Custom physiological state.'));
  const iv = (kind: InterventionKind, label: string): HTMLButtonElement =>
    button(label, () => {
      state.p.rhythm.interventions = [...state.p.rhythm.interventions.filter((x) => x.kind !== kind), { t: 3000, kind }];
      rerun();
    });
  const interventions = h(
    'div',
    { class: 'card' },
    h('h3', null, 'Interventions (delivered at t = 3 s)'),
    h(
      'div',
      { class: 'btn-row' },
      iv('adenosine', 'Adenosine'),
      iv('vagal', 'Vagal manoeuvre'),
      iv('avnBlocker', 'IV AV-nodal blocker'),
      iv('atropine', 'Atropine'),
      iv('shock', '⚡ Cardioversion / defibrillation'),
      button(
        'PAC now (trigger re-entry)',
        () => {
          state.p.rhythm.triggerPAC = { at: 1500, coupling: 300, site: 'leftAtrial' };
          rerun();
        },
        '',
      ),
      button('Clear', () => {
        state.p.rhythm.interventions = [];
        state.p.rhythm.triggerPAC = null;
        rerun();
      }, 'btn-danger'),
    ),
    p('Time courses are compressed to fit the strip. Watch the ladder diagram to see which structure the intervention acted on.', 'ref-meta'),
  );
  const variability = h(
    'div',
    { class: 'btn-row' },
    button('🎲 New patient variability', () => {
      state.p = randomVariation(state.p);
      rebuild();
      rerun();
    }),
    button('New random seed', () => {
      state.p.rhythm.seed = Math.floor(Math.random() * 1e6);
      rerun();
    }),
    select<'10000' | '15000' | '20000'>({
      label: 'Strip length',
      value: '10000',
      options: [
        ['10000', '10 s'],
        ['15000', '15 s'],
        ['20000', '20 s'],
      ],
      onChange: (v) => {
        duration = parseInt(v, 10);
        panel.setDuration(duration);
        rerun();
      },
    }),
  );
  rebuild();
  root.append(h('div', { class: 'sim-layout' }, h('aside', { class: 'sim-controls card', 'aria-label': 'Physiology controls' }, presetSel, variability, controlsHost), h('div', null, note, panel.el, interventions)));
  panel.show(state.p);
  const cleanup = (): void => panel.destroy();
  return cleanup;
}
