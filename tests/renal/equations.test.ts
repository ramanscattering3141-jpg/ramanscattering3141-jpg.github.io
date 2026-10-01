// The equation registry: worked patient cases must fit their equation's sliders, and the bedside
// equations must give the textbook answers for the worked numbers quoted in their case text.

import { describe, expect, test } from 'vitest';
import { EQUATIONS, equationById, initialValues } from '../../renal/src/content/equations';

const calc = (id: string, v: Record<string, number>) => {
  const e = equationById.get(id)!;
  return e.compute({ ...initialValues(e), ...v }).value;
};

describe('equation registry', () => {
  test('ids are unique', () => {
    const ids = EQUATIONS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every default value sits inside its slider range', () => {
    const bad: string[] = [];
    for (const e of EQUATIONS) for (const v of e.vars) if (v.value < v.min || v.value > v.max) bad.push(`${e.id}.${v.key}`);
    expect(bad).toEqual([]);
  });

  test('every patient case uses the equation’s own variables, inside their ranges', () => {
    const bad: string[] = [];
    for (const e of EQUATIONS) {
      if (!e.patient) continue;
      for (const [k, val] of Object.entries(e.patient.values)) {
        const v = e.vars.find((x) => x.key === k);
        if (!v) bad.push(`${e.id}: unknown variable ${k}`);
        else if (val < v.min || val > v.max) bad.push(`${e.id}.${k} = ${val} outside ${v.min}–${v.max}`);
      }
      if (!e.patient.steps.length || !e.patient.takeaway) bad.push(`${e.id}: case has no steps or takeaway`);
    }
    expect(bad).toEqual([]);
  });

  test('every equation computes a finite number at its defaults and at its patient case', () => {
    const bad: string[] = [];
    for (const e of EQUATIONS) {
      if (!Number.isFinite(e.compute(initialValues(e)).value)) bad.push(`${e.id} (defaults)`);
      if (e.patient && !Number.isFinite(e.compute({ ...initialValues(e), ...e.patient.values }).value)) bad.push(`${e.id} (patient)`);
    }
    expect(bad).toEqual([]);
  });
});

describe('bedside equations give the worked answers', () => {
  test('Furst ratio: SIADH urine saltier than plasma', () => {
    expect(calc('furst', { una: 90, uk: 45, pna: 122 })).toBeCloseTo(1.107, 2);
    expect(calc('furst', { una: 40, uk: 20, pna: 122 })).toBeLessThan(0.5);
  });

  test('spot urine Na/K ratio', () => {
    expect(calc('unauk', { una: 70, uk: 35 })).toBeCloseTo(2, 5);
  });

  test('Edelman: 300 mmol of K⁺ raises the Na⁺ by about 9 mmol/L in 36 L of water', () => {
    const before = calc('edelman', { na: 2600, k: 2250, tbw: 36 });
    const after = calc('edelman', { na: 2600, k: 2550, tbw: 36 });
    expect(before).toBeCloseTo(124, 0);
    expect(after - before).toBeCloseTo(9.25, 1);
  });

  test('electrolyte-free water clearance is negative when (UNa + UK) > PNa', () => {
    expect(calc('efwc', { una: 90, uk: 45, v: 1.2, pna: 122 })).toBeLessThan(0);
  });

  test('solute-limited urine volume', () => {
    expect(calc('maxuv', { sol: 150, umin: 50 })).toBeCloseTo(3, 5);
  });

  test('fractional excretions', () => {
    expect(calc('femg', { umg: 0.3, pcr: 80, pmg: 0.4, ucr: 8 })).toBeCloseTo(1.07, 1);
    expect(calc('fepo4', { upo4: 10, pcr: 70, ppo4: 0.45, ucr: 7 })).toBeCloseTo(22.2, 0);
    expect(calc('fek', { uk: 25, pcr: 95, pk: 6.2, ucr: 9 })).toBeCloseTo(4.26, 1);
    expect(calc('fehco3', { uhco3: 100, pcr: 90, phco3: 22, ucr: 2.5 })).toBeGreaterThan(15);
  });

  test('calcium/creatinine clearance ratio separates FHH', () => {
    expect(calc('cccr', { uca: 1, pcr: 80, pca: 2.75, ucr: 8 })).toBeLessThan(0.01);
  });

  test('protein/creatinine ratio and urea/creatinine ratio', () => {
    expect(calc('upcr', { prot: 3, ucr: 7.5 })).toBeCloseTo(400, 5);
    expect(calc('ureacr', { urea: 28, cr: 160 })).toBeCloseTo(175, 5);
  });

  test('potassium deficit scales with the fall and with weight', () => {
    expect(calc('kdeficit', { k: 2.8, wt: 70 })).toBeCloseTo(360, 5);
    expect(calc('kdeficit', { k: 4, wt: 70 })).toBe(0);
  });
});

describe('unit preference conversions', async () => {
  const u = await import('../../renal/src/ui/unitPref');
  test('analytes are recognised from key and unit', () => {
    expect(u.analyteOf('pcr', 'µmol/L')).toBe('creat');
    expect(u.analyteOf('ucr', 'mmol/L')).toBe('ucreat');
    expect(u.analyteOf('glu', 'mmol/L')).toBe('glucose');
    expect(u.analyteOf('purea', 'mmol/L')).toBe('urea');
    expect(u.analyteOf('alb', 'g/L')).toBe('alb');
    expect(u.analyteOf('pmg', 'mmol/L')).toBe('mg');
    expect(u.analyteOf('na', 'mmol/L')).toBeUndefined();
  });
  test('textbook conversions round-trip', () => {
    expect(u.toDisplay('creat', 88.4, 'us')).toBeCloseTo(1, 5);
    expect(u.toDisplay('glucose', 18, 'us')).toBeCloseTo(324, 5);
    expect(u.toDisplay('urea', 5, 'us')).toBeCloseTo(14, 5);
    expect(u.toDisplay('alb', 40, 'us')).toBeCloseTo(4, 5);
    for (const a of ['glucose', 'urea', 'creat', 'ucreat', 'ca', 'mg', 'pi', 'alb'] as const) {
      expect(u.fromDisplay(a, u.toDisplay(a, 3.7, 'us'), 'us')).toBeCloseTo(3.7, 9);
    }
    expect(u.toDisplay('creat', 88.4, 'si')).toBe(88.4);
  });
});
