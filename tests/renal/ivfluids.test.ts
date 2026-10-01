// The IV fluids model checked against the studies it was built from, and against its own mass balance.
import { describe, expect, it } from 'vitest';
import { simulate, fateOf, plasmaShareAt, PATIENTS, type Plan, type FluidId } from '../../renal/src/sim/ivfluids';

const patient = (id: string) => PATIENTS.find((p) => p.id === id)!;
const PLAN: Plan = { fluid: 'saline', volume: 1, minutes: 30, maintenance: 0, pressor: false, diuretic: false, hours: 24 };
const fate = (id: string, fluid: FluidId, volume = 1, extra: Partial<Plan> = {}) => {
  const plan = { ...PLAN, fluid, volume, ...extra };
  return fateOf(simulate(patient(id), plan), simulate(patient(id), { ...plan, volume: 0 }));
};

describe('IV fluid model', () => {
  it('every patient is in a steady state before any fluid is given', () => {
    for (const p of PATIENTS) {
      const run = simulate(p, { ...PLAN, volume: 0 });
      const a = run[0];
      const b = run[run.length - 1];
      expect(Math.abs(b.plasma - a.plasma), p.id).toBeLessThan(0.05);
      expect(Math.abs(b.isf - a.isf), p.id).toBeLessThan(0.05);
      expect(b.urine, p.id).toBeLessThan(0.05);
    }
  });

  it('conserves volume: plasma + interstitium + cells + urine account for what was infused', () => {
    for (const p of PATIENTS)
      for (const f of ['saline', 'd5w', 'albumin5', 'saline3'] as FluidId[]) {
        const fa = fate(p.id, f);
        const last = fa[fa.length - 1];
        expect(last.plasma + last.isf + last.icf + last.urine, `${p.id} ${f}`).toBeCloseTo(1, 1);
      }
  });

  it('Lobo 2001: about a third of 2 L of saline is excreted 6 h after a 1 h infusion; dextrose water within ~2 h', () => {
    const saline = simulate(patient('healthy'), { ...PLAN, volume: 2, minutes: 60, hours: 7 });
    const excreted = saline[saline.length - 1].urine / 2;
    expect(excreted).toBeGreaterThan(0.25);
    expect(excreted).toBeLessThan(0.45);
    const d5w = simulate(patient('healthy'), { ...PLAN, fluid: 'd5w', volume: 2, minutes: 60, hours: 3 });
    expect(d5w[d5w.length - 1].urine / 2).toBeGreaterThan(0.7);
  });

  it('crystalloid leaves the plasma within the hour; iso-oncotic albumin stays longer', () => {
    const saline = plasmaShareAt(fate('healthy', 'saline'), 1, 1);
    const alb = plasmaShareAt(fate('healthy', 'albumin5', 0.5), 0.5, 1);
    expect(saline).toBeGreaterThan(0.1);
    expect(saline).toBeLessThan(0.35);
    expect(alb).toBeGreaterThan(2 * saline);
  });

  it('context sensitivity: after haemorrhage more crystalloid stays in plasma; in septic shock less', () => {
    const healthy = plasmaShareAt(fate('healthy', 'saline'), 1, 1);
    expect(plasmaShareAt(fate('haemorrhage', 'saline'), 1, 1)).toBeGreaterThan(healthy);
    expect(plasmaShareAt(fate('sepsis', 'saline'), 1, 1)).toBeLessThan(healthy);
  });

  it('D5W is free water: about two-thirds ends up in cells when it cannot be excreted', () => {
    const f = fate('aki', 'd5w');
    const at6 = f.find((x) => x.t >= 6)!;
    expect(at6.icf).toBeGreaterThan(0.5);
    expect(at6.icf).toBeLessThan(0.72);
  });

  it('3% saline draws water out of cells', () => {
    const f = fate('healthy', 'saline3', 0.15);
    expect(f.find((x) => x.t >= 1)!.icf).toBeLessThan(-0.2);
  });

  it('heart failure: a bolus raises cardiac output far less than in health, and becomes oedema', () => {
    const peak = (id: string) => {
      const run = simulate(patient(id), { ...PLAN, volume: 0.5 });
      return Math.max(...run.map((s) => s.co)) - run[0].co;
    };
    expect(peak('hf')).toBeLessThan(0.5 * peak('healthy'));
    const f = fate('hf', 'saline');
    expect(f.find((x) => x.t >= 6)!.isf).toBeGreaterThan(0.8);
  });

  it('large-volume saline causes a hyperchloraemic fall in bicarbonate that a balanced solution avoids', () => {
    const end = (fluid: FluidId) => {
      const run = simulate(patient('aki'), { ...PLAN, fluid, volume: 4, minutes: 240, hours: 6 });
      return run[run.length - 1];
    };
    expect(end('saline').cl).toBeGreaterThan(end('plasmalyte').cl + 3);
    expect(end('saline').hco3).toBeLessThan(end('plasmalyte').hco3 - 1.5);
  });
});
