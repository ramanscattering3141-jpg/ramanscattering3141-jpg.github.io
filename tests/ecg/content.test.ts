import { describe, expect, it } from 'vitest';
import { ALL_DX, resolveDx, search } from '../../src/ecg/content/index';
import { SOURCES } from '../../src/ecg/content/sources';
import { PRESETS } from '../../src/ecg/engine/presets';
import { FINDINGS } from '../../src/ecg/content/findings';
import { DDX } from '../../src/ecg/content/differentials';
import { COMPARISONS } from '../../src/ecg/content/comparisons';
import { ACLS } from '../../src/ecg/content/acls';
import { CASES } from '../../src/ecg/content/cases';
import { L1, L2, L3, L4, L5 } from '../../src/ecg/content/challenge';

describe('content integrity', () => {
  it('diagnosis ids are unique and every record is complete', () => {
    const ids = ALL_DX.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of ALL_DX) {
      expect(d.definition.length, d.id).toBeGreaterThan(20);
      expect(d.mechanism.length, d.id).toBeGreaterThan(20);
      expect(d.ecg.length, d.id).toBeGreaterThan(0);
      expect(d.why.length, d.id).toBeGreaterThan(1);
      expect(d.differential.length, d.id).toBeGreaterThan(0);
      expect(d.refs.length, d.id).toBeGreaterThan(0);
    }
  });
  it('every cited source exists and has a verification date and identifier', () => {
    for (const d of ALL_DX) for (const r of [...d.refs, ...(d.management?.refs ?? [])]) expect(SOURCES[r], `${d.id} → ${r}`).toBeDefined();
    for (const s of Object.values(SOURCES)) {
      expect(s.verified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.doi || s.url).toBeTruthy();
    }
  });
  it('every referenced preset exists', () => {
    const presets = [
      ...ALL_DX.flatMap((d) => [d.preset, ...(d.altPresets ?? [])].filter(Boolean) as string[]),
      ...FINDINGS.flatMap((f) => [f.demo.a, f.demo.b]),
      ...DDX.flatMap((d) => d.candidates.map((c) => c.preset)),
      ...COMPARISONS.flatMap((c) => [c.a, c.b]),
      ...ACLS.flatMap((c) => c.presets),
      ...CASES.map((c) => c.preset),
      ...L1.map((x) => x[0]),
      ...L2.map((x) => x.preset),
      ...[...L3, ...L4, ...L5].map((x) => x.preset),
    ];
    for (const p of presets) expect(PRESETS[p], p).toBeDefined();
  });
  it('findings, cases and challenge items link to real diagnoses', () => {
    for (const f of FINDINGS) for (const c of f.causes) expect(resolveDx(c.id), `${f.id} → ${c.id}`).toBeDefined();
    for (const c of CASES) expect(resolveDx(c.dx), c.dx).toBeDefined();
    for (const q of [...L3, ...L4, ...L5]) if (q.dx) expect(resolveDx(q.dx), q.dx).toBeDefined();
    for (const a of ACLS) if (a.dx) expect(resolveDx(a.dx), a.dx).toBeDefined();
  });
  it('covers the required curriculum', () => {
    const required = ['nsr', 'sinusBrady', 'sinusTach', 'sinusArrhythmia', 'sinusPause', 'saExitBlock', 'pac', 'pvc', 'focalAT', 'mat', 'flutter', 'af', 'ist', 'junctionalEscape', 'accelJunctional', 'avnrt', 'orthoAvrt', 'wpw', 'preexAf', 'ventEscape', 'aivr', 'monoVT', 'polyVT', 'torsades', 'vflutter', 'vf', 'pulselessVT', 'pea', 'asystole', 'avb1', 'mobitz1', 'mobitz2', 'avb21', 'highGrade', 'chb', 'rbbb', 'lbbb', 'lafb', 'lpfb', 'bifascicular', 'ivcd', 'paced', 'pacerMalfunction', 'lvh', 'rvh', 'atrialEnlargement', 'poorR', 'stemi', 'stemiPosterior', 'nste', 'wellens', 'oldMI', 'pericarditis', 'myocarditis', 'pe', 'copd', 'hyperK', 'hypoK', 'hyperCa', 'hypoCa', 'magnesium', 'digoxinEffect', 'avnBlockers', 'tca', 'qtDrug', 'antiarrhythmics', 'lqts', 'sqts', 'brugada', 'earlyRepol', 'hypothermia', 'hcm', 'arvc', 'athlete', 'takotsubo', 'deWinter', 'lvAneurysm', 'cpvt', 'dextrocardia', 'leadReversal', 'artifact'];
    for (const id of required) expect(resolveDx(id), id).toBeDefined();
  });
  it('the required management records exist with all eight parts', () => {
    for (const id of ['sinusBrady', 'chb', 'af', 'flutter', 'avnrt', 'orthoAvrt', 'focalAT', 'mat', 'monoVT', 'torsades', 'vf', 'wpw', 'preexAf', 'stemi', 'hyperK']) {
      const m = resolveDx(id)!.management!;
      expect(m, id).toBeDefined();
      for (const k of ['immediate', 'definitive', 'cautions', 'whyWorks', 'whyNot'] as const) expect(m[k].length, `${id}.${k}`).toBeGreaterThan(0);
    }
  });
});

describe('search', () => {
  const ids = (q: string): string[] => search(q).map((h) => h.id);
  it('"wide QRS" returns the mechanistic causes', () => {
    const r = ids('wide QRS');
    for (const id of ['monoVT', 'rbbb', 'lbbb', 'hyperK', 'tca', 'paced', 'wpw', 'wide-qrs']) expect(r, id).toContain(id);
  });
  it('"regular narrow tachycardia" returns the SVT differential', () => {
    const r = ids('regular narrow tachycardia');
    for (const id of ['avnrt', 'orthoAvrt', 'flutter', 'focalAT', 'sinusTach']) expect(r, id).toContain(id);
  });
  it('"adenosine" returns AV-nodal rhythms, the demonstrator and ACLS', () => {
    const r = ids('adenosine');
    for (const id of ['avnrt', 'orthoAvrt', 'adenosine', 'acls']) expect(r, id).toContain(id);
  });
});
