import type { Category, Dx } from './types';
import { RHYTHM_DX } from './dx_rhythm';
import { REENTRY_DX } from './dx_reentry';
import { VENTRICULAR_DX } from './dx_ventricular';
import { CONDUCTION_DX } from './dx_conduction';
import { MORPH_DX } from './dx_morph';
import { METABOLIC_DX } from './dx_metabolic';
import { FINDINGS } from './findings';
import { PRESETS } from '../engine/presets';

export const ALL_DX: Dx[] = [...RHYTHM_DX, ...REENTRY_DX, ...VENTRICULAR_DX, ...CONDUCTION_DX, ...MORPH_DX, ...METABOLIC_DX];

const byId = new Map(ALL_DX.map((d) => [d.id, d]));

/** Resolve a diagnosis by id, or by a preset id that illustrates it. */
export function resolveDx(key: string): Dx | undefined {
  const d = byId.get(key);
  if (d) return d;
  return ALL_DX.find((x) => x.preset === key || x.altPresets?.includes(key));
}

export function dxByCategory(cats: Category[]): Dx[] {
  return ALL_DX.filter((d) => cats.includes(d.category)).sort((a, b) => a.tier - b.tier);
}

/** Which app section each category belongs to. */
export const SECTION_CATS: Record<string, Category[]> = {
  rhythm: ['sinus', 'premature', 'atrial', 'junctional', 'reentrant', 'ventricular', 'arrest'],
  conduction: ['avblock', 'ivcd', 'pacing'],
  structural: ['structural', 'pericardial', 'pulmonary'],
  ischemia: ['ischemia'],
  metabolic: ['electrolyte', 'drug'],
  inherited: ['inherited'],
};

export function presetLabel(id: string): string {
  return PRESETS[id]?.label ?? id;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchHit {
  kind: 'diagnosis' | 'finding' | 'page';
  id: string;
  title: string;
  subtitle: string;
  href: string;
  score: number;
}

const PAGES: { id: string; title: string; href: string; keys: string }[] = [
  { id: 'fund-leads', title: 'The 12 leads & vector explorer', href: '#/fundamentals/leads', keys: 'lead leads electrode vector axis hexaxial einthoven precordial limb 12-lead v1 v6 avr' },
  { id: 'fund-ap', title: 'Membrane & action potentials', href: '#/fundamentals/ap', keys: 'action potential membrane resting potential ion channel sodium potassium calcium depolarization repolarization phase 0 phase 4 nernst sinus node pacemaker cell' },
  { id: 'fund-system', title: 'Systematic ECG interpretation', href: '#/fundamentals/systematic', keys: 'systematic approach rate rhythm axis intervals interpretation how to read' },
  { id: 'phys-waves', title: 'Why each wave looks the way it does', href: '#/physiology', keys: 'p wave pr qrs st t wave u wave qt interval physiology conduction system activation sequence his purkinje' },
  { id: 'phys-activation', title: 'Ventricular activation, beat by beat', href: '#/physiology/activation', keys: 'activation sequence vector loop septal depolarization durrer qrs formation' },
  { id: 'sim', title: 'ECG Simulator', href: '#/simulator', keys: 'simulator simulate physiology model sliders refractory period conduction velocity' },
  { id: 'avnrt-lab', title: 'AVNRT circuit lab', href: '#/rhythms/avnrt-lab', keys: 'avnrt dual pathway slow fast pathway re-entry circuit echo beat' },
  { id: 'avrt-lab', title: 'Accessory pathway / AVRT lab', href: '#/rhythms/avrt-lab', keys: 'avrt wpw accessory pathway orthodromic antidromic delta wave location localisation concealed manifest' },
  { id: 'flutter-lab', title: 'Flutter conduction-ratio lab', href: '#/rhythms/flutter-lab', keys: 'flutter 2:1 3:1 4:1 variable block conduction ratio' },
  { id: 'av-lab', title: 'AV block lab (level of block & escape)', href: '#/conduction/av', keys: 'av block wenckebach mobitz complete heart block escape junctional ventricular level' },
  { id: 'bbb-lab', title: 'Bundle-branch & fascicular block lab', href: '#/conduction/bbb', keys: 'bundle branch block rbbb lbbb lafb lpfb fascicular bifascicular reroute activation' },
  { id: 'isch-lab', title: 'Myocardial injury simulator', href: '#/ischemia', keys: 'ischemia infarction stemi lad rca lcx territory injury current reciprocal q waves hyperacute' },
  { id: 'lyte-lab', title: 'Electrolyte lab', href: '#/electrolytes', keys: 'potassium calcium magnesium electrolyte hyperkalemia hypokalemia hypercalcemia hypocalcemia' },
  { id: 'drug-lab', title: 'Drug & toxin lab', href: '#/electrolytes/drugs', keys: 'drug toxicology digoxin beta blocker calcium channel blocker tca sodium channel qt amiodarone flecainide overdose' },
  { id: 'mgmt', title: 'Arrhythmia management', href: '#/management', keys: 'management treatment therapy guideline acute definitive' },
  { id: 'acls', title: 'ACLS ECG reference (2025 AHA)', href: '#/acls', keys: 'acls cardiac arrest vf pulseless vt pea asystole tachycardia bradycardia algorithm cardioversion defibrillation atropine adenosine epinephrine amiodarone pacing' },
  { id: 'adenosine', title: 'Adenosine physiology demonstrator', href: '#/sandbox/adenosine', keys: 'adenosine av nodal blockade diagnostic unmask terminate a1 receptor' },
  { id: 'axis', title: 'Axis lab', href: '#/sandbox/axis', keys: 'axis left axis deviation right axis deviation extreme axis hexaxial' },
  { id: 'plab', title: 'P-wave lab', href: '#/sandbox/p', keys: 'p wave atrial enlargement ectopic atrial rhythm p mitrale p pulmonale' },
  { id: 'qrslab', title: 'QRS lab', href: '#/sandbox/qrs', keys: 'qrs morphology lvh rvh bundle branch pre-excitation ectopic focus' },
  { id: 'stlab', title: 'ST/T/QT lab', href: '#/sandbox/st', keys: 'st segment t wave qt qtc repolarization' },
  { id: 'one', title: 'Change-one-variable mode', href: '#/sandbox/one', keys: 'change one variable before after experiment' },
  { id: 'build', title: 'Build your own arrhythmia', href: '#/sandbox/build', keys: 'build arrhythmia pacemaker mechanism automaticity triggered re-entry' },
  { id: 'hierarchy', title: 'Pacemaker hierarchy & escape rhythms', href: '#/sandbox/hierarchy', keys: 'pacemaker hierarchy escape rhythm junctional ventricular overdrive suppression' },
  { id: 'compare', title: 'ECG comparison mode', href: '#/sandbox/compare', keys: 'compare comparison versus vs difference' },
  { id: 'ddx', title: 'Differential diagnosis engine', href: '#/ddx', keys: 'differential diagnosis wide complex tachycardia narrow complex tachycardia regular irregular bradycardia st elevation dominant r v1' },
  { id: 'cases', title: 'ECG case generator', href: '#/cases', keys: 'case cases clinical vignette practice' },
  { id: 'challenge', title: 'ECG challenge mode', href: '#/challenge', keys: 'quiz challenge test practice level' },
  { id: 'sources', title: 'Sources & evidence', href: '#/sources', keys: 'references sources guidelines evidence citation' },
];

/** Curated query expansions so that clinical phrases map to the right tags. */
const SYNONYMS: [RegExp, string[]][] = [
  [/\bwide\b|\bbroad\b/, ['wide-qrs']],
  [/\bnarrow\b/, ['narrow-qrs']],
  [/regular narrow|narrow.*regular/, ['regular-narrow-tachycardia']],
  [/irregular narrow/, ['irregular-narrow-tachycardia']],
  [/regular wide|wide.*regular/, ['regular-wide-tachycardia']],
  [/irregular wide/, ['irregular-wide-tachycardia']],
  [/\btachy/, ['tachycardia']],
  [/\bbrady|slow heart/, ['bradycardia']],
  [/adenosine/, ['adenosine', 'adenosine-terminates', 'adenosine-unmasks', 'adenosine-harm', 'adenosine-no-effect']],
  [/st elev|ste\b|st-elev/, ['st-elevation']],
  [/st dep|std\b/, ['st-depression']],
  [/t.?wave inv|twi|inverted t/, ['t-inversion']],
  [/peaked|tented/, ['peaked-t']],
  [/long qt|qt prol/, ['long-qt']],
  [/short qt/, ['short-qt']],
  [/short pr/, ['short-pr']],
  [/long pr|prolonged pr/, ['long-pr']],
  [/delta/, ['delta-wave']],
  [/syncope|faint/, ['syncope']],
  [/palpitation/, ['palpitations']],
  [/chest pain/, ['chest-pain']],
  [/dyspn|short of breath/, ['dyspnea']],
  [/arrest|pulseless/, ['cardiac-arrest']],
  [/dissociation/, ['av-dissociation']],
  [/left axis/, ['lad']],
  [/right axis/, ['rad']],
  [/low volt/, ['low-voltage']],
  [/high volt|voltage/, ['high-voltage']],
  [/q wave/, ['q-waves']],
  [/u wave/, ['u-wave']],
  [/pacing|pacemaker|spike/, ['pacing-spikes', 'pacing']],
  [/re-?entry|reentrant/, ['reentry']],
  [/automatic/, ['automaticity']],
  [/triggered|afterdepolari/, ['triggered']],
  [/av node|avn\b/, ['av-node']],
  [/accessory|bypass/, ['accessory-pathway']],
  [/digoxin|digitalis/, ['digoxin']],
  [/beta.?block/, ['beta-blocker']],
  [/calcium channel|verapamil|diltiazem/, ['ccb']],
  [/tricyclic|tca\b/, ['tca']],
  [/cardiover/, ['cardioversion']],
  [/defib/, ['defibrillation']],
  [/ablation/, ['ablation']],
  [/anticoag/, ['anticoagulation']],
  [/magnesium/, ['magnesium']],
  [/calcium gluconate|calcium chloride/, ['calcium']],
  [/procainamide/, ['procainamide']],
  [/amiodarone/, ['amiodarone']],
  [/atropine/, ['atropine']],
  [/vagal|valsalva/, ['vagal']],
];

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function search(query: string): SearchHit[] {
  const q = norm(query.trim());
  if (!q) return [];
  const words = q.split(/[\s,/]+/).filter((w) => w.length > 1);
  const tags = new Set<string>();
  for (const [re, t] of SYNONYMS) if (re.test(q)) t.forEach((x) => tags.add(x));
  const hits: SearchHit[] = [];
  for (const d of ALL_DX) {
    let score = 0;
    const name = norm(d.name);
    const aliases = (d.aliases ?? []).map(norm);
    if (name.includes(q)) score += 40;
    if (aliases.some((a) => a === q)) score += 45;
    else if (aliases.some((a) => a.includes(q))) score += 25;
    for (const t of d.tags) if (tags.has(t)) score += 12;
    const body = norm([d.definition, d.mechanism, d.ecg.join(' '), (d.causes ?? []).join(' '), (d.acute ?? []).join(' '), d.management ? [...d.management.immediate, ...d.management.definitive].join(' ') : ''].join(' '));
    for (const w of words) {
      if (name.includes(w)) score += 6;
      if (aliases.some((a) => a.includes(w))) score += 4;
      if (body.includes(w)) score += 1.5;
    }
    if (score > 3) hits.push({ kind: 'diagnosis', id: d.id, title: d.name, subtitle: d.definition.slice(0, 140), href: `#/dx/${d.id}`, score: score - d.tier * 0.5 });
  }
  for (const f of FINDINGS) {
    let score = 0;
    const n = norm(f.name);
    if (n.includes(q) || f.aliases.some((a) => norm(a).includes(q))) score += 30;
    if (tags.has(f.id)) score += 25;
    for (const w of words) if (n.includes(w)) score += 5;
    if (score > 4) hits.push({ kind: 'finding', id: f.id, title: `Why: ${f.name}`, subtitle: `Mechanism of the finding — ${f.causes.length} causes`, href: `#/why/${f.id}`, score });
  }
  for (const pg of PAGES) {
    let score = 0;
    const k = norm(pg.title + ' ' + pg.keys);
    if (k.includes(q)) score += 20;
    for (const w of words) if (k.includes(w)) score += 3;
    if (score > 5) hits.push({ kind: 'page', id: pg.id, title: pg.title, subtitle: 'Interactive page', href: pg.href, score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 30);
}
