// The nephron flow simulator: every scenario × solute must give finite, self-consistent numbers,
// the particle animation must reproduce the engine's mass balance, and each scenario must show the
// textbook pattern (Rose ch. 1, 3-5, 12, 15).

import { describe, expect, test } from 'vitest';
import { SOLUTES, type SoluteId } from '../../renal/src/engine/types';
import { FLOW_SCENARIOS, animatedExcretion, flowEvaluation, fmtPct, perDay, planExit, soluteFate } from '../../renal/src/sim/flow';

const fate = (scen: string, solute: SoluteId) => soluteFate(flowEvaluation(scen).kidney.segments, solute);
const seg = (scen: string, solute: SoluteId, id: string) => fate(scen, solute).segments.find((s) => s.id === id)!.delta;
const exc = (scen: string, solute: SoluteId) => fate(scen, solute).excreted;
const gfr = (scen: string) => flowEvaluation(scen).kidney.GFR;

/** Small deterministic generator so the Monte Carlo check is repeatable. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('every scenario and solute is well defined', () => {
  for (const sc of FLOW_SCENARIOS) {
    for (const solute of SOLUTES) {
      test(`${sc.id} / ${solute}`, () => {
        const f = fate(sc.id, solute);
        for (const s of f.segments) {
          expect(Number.isFinite(s.delta)).toBe(true);
          expect(Math.abs(s.delta)).toBeLessThanOrEqual(1 + 1e-9); // a share of the reference load
          expect(s.hazard).toBeGreaterThanOrEqual(0);
          expect(s.hazard).toBeLessThanOrEqual(1);
        }
        expect(Number.isFinite(f.excreted)).toBe(true);
        expect(f.excreted).toBeGreaterThanOrEqual(0);
        // what enters minus what each segment takes plus what it adds = what is excreted
        const net = f.filteredShare - f.segments.reduce((a, s) => a + s.delta, 0);
        expect(net).toBeCloseTo(f.excreted, 9);
        // and the particles, leaving with each segment's hazard, give the same urine
        expect(animatedExcretion(f)).toBeCloseTo(f.excreted, 9);
      });
    }
  }
});

describe('the particle plan reproduces the engine', () => {
  test.each([
    ['normal', 'Na'],
    ['normal', 'K'],
    ['normal', 'urea'],
    ['loop', 'Na'],
    ['sglt2i', 'glucose'],
    ['noadh', 'water'],
  ] as [string, SoluteId][])('%s / %s: Monte Carlo segment shares match', (scen, solute) => {
    const f = fate(scen, solute);
    const r = rng(42);
    const n = 40000;
    const counts = new Array(f.segments.length).fill(0);
    let out = 0;
    // filtered particles start at the glomerulus; secreted ones in the segment that adds them
    const sources: { from: number; weight: number }[] = [{ from: 0, weight: f.filteredShare }];
    f.segments.forEach((s, i) => s.delta < 0 && sources.push({ from: i + 1, weight: -s.delta }));
    const total = sources.reduce((a, s) => a + s.weight, 0);
    for (let k = 0; k < n; k++) {
      let x = r() * total;
      const src = sources.find((s) => (x -= s.weight) < 0) ?? sources[sources.length - 1];
      const i = planExit(f, src.from, r);
      if (i < 0) out++;
      else counts[i]++;
    }
    const scale = total / n;
    f.segments.forEach((s, i) => {
      if (s.delta > 0) expect(Math.abs(counts[i] * scale - s.delta)).toBeLessThan(0.015);
    });
    expect(Math.abs(out * scale - f.excreted)).toBeLessThan(0.015);
  });
});

describe('NH4+ is made by the tubule, not filtered', () => {
  test('its shares are of all the NH4+ entering the tubule, so they stay finite and sum to one', () => {
    const f = fate('normal', 'NH4');
    expect(f.basis).toBe('entered');
    const added = -f.segments.filter((s) => s.delta < 0).reduce((a, s) => a + s.delta, 0);
    expect(f.filteredShare + added).toBeCloseTo(1, 9);
    expect(seg('normal', 'NH4', 'PT')).toBeLessThan(0); // proximal ammoniagenesis and secretion
    expect(seg('normal', 'NH4', 'TAL')).toBeGreaterThan(0); // reabsorbed in the thick limb
    expect(seg('normal', 'NH4', 'IMCD')).toBeLessThan(0); // trapped in the collecting duct
  });

  test('metabolic acidosis raises NH4+ excretion', () => {
    expect(fate('acid', 'NH4').excretedAmount).toBeGreaterThan(1.5 * fate('normal', 'NH4').excretedAmount);
  });

  test('every other solute uses the filtered load', () => {
    for (const s of SOLUTES.filter((x) => x !== 'NH4')) expect(fate('normal', s).basis).toBe('filtered');
  });
});

describe('normal kidney (Rose ch. 1, 3-5)', () => {
  test('Na+: ~2/3 proximal, ~25% loop, <1% excreted', () => {
    expect(seg('normal', 'Na', 'PT')).toBeGreaterThan(0.55);
    expect(seg('normal', 'Na', 'PT')).toBeLessThan(0.72);
    expect(seg('normal', 'Na', 'TAL') + seg('normal', 'Na', 'ATL')).toBeGreaterThan(0.18);
    expect(seg('normal', 'Na', 'TAL') + seg('normal', 'Na', 'ATL')).toBeLessThan(0.35);
    expect(exc('normal', 'Na')).toBeLessThan(0.01);
  });

  test('water: proximal and descending limb, none in the ascending limbs, ~1% excreted', () => {
    expect(seg('normal', 'water', 'PT')).toBeGreaterThan(0.55);
    expect(seg('normal', 'water', 'DTL')).toBeGreaterThan(0.1);
    expect(seg('normal', 'water', 'ATL')).toBeCloseTo(0, 9);
    expect(seg('normal', 'water', 'TAL')).toBeCloseTo(0, 9);
    expect(exc('normal', 'water')).toBeLessThan(0.02);
  });

  test('glucose and amino acids are reabsorbed almost entirely in the proximal tubule', () => {
    expect(seg('normal', 'glucose', 'PT')).toBeGreaterThan(0.99);
    expect(seg('normal', 'aa', 'PT')).toBeGreaterThan(0.97);
  });

  test('HCO3-: ~85-90% proximal, almost none excreted', () => {
    expect(seg('normal', 'HCO3', 'PT')).toBeGreaterThan(0.8);
    expect(exc('normal', 'HCO3')).toBeLessThan(0.01);
  });

  test('K+: nearly all reabsorbed by the end of the loop, urine K+ is mostly secreted distally', () => {
    const f = fate('normal', 'K');
    const byLoop = f.segments.slice(0, 4).reduce((a, s) => a + s.delta, 0);
    expect(byLoop).toBeGreaterThan(0.85);
    const secreted = -f.segments.filter((s) => s.delta < 0).reduce((a, s) => a + s.delta, 0);
    expect(secreted).toBeGreaterThan(0.5 * f.excreted);
    expect(f.excreted).toBeGreaterThan(0.04);
    expect(f.excreted).toBeLessThan(0.25);
  });

  test('urea: proximal reabsorption, secretion into the thin limbs, ~30-60% excreted', () => {
    expect(seg('normal', 'urea', 'PT')).toBeGreaterThan(0.3);
    expect(seg('normal', 'urea', 'DTL') + seg('normal', 'urea', 'ATL')).toBeLessThan(0);
    expect(seg('normal', 'urea', 'IMCD')).toBeGreaterThan(0);
    expect(exc('normal', 'urea')).toBeGreaterThan(0.3);
    expect(exc('normal', 'urea')).toBeLessThan(0.6);
  });

  test('creatinine: filtered plus a little secreted, so excretion slightly exceeds the filtered load', () => {
    expect(exc('normal', 'creat')).toBeGreaterThan(1.05);
    expect(exc('normal', 'creat')).toBeLessThan(1.3);
  });

  test('Ca2+ mostly proximal; Mg2+ mostly in the thick ascending limb', () => {
    expect(seg('normal', 'Ca', 'PT')).toBeGreaterThan(0.55);
    expect(seg('normal', 'Ca', 'TAL')).toBeGreaterThan(0.15);
    expect(seg('normal', 'Mg', 'TAL')).toBeGreaterThan(seg('normal', 'Mg', 'PT'));
    expect(exc('normal', 'Ca')).toBeLessThan(0.05);
    expect(exc('normal', 'Mg')).toBeLessThan(0.12);
  });

  test('phosphate: 80-85% proximal', () => {
    expect(seg('normal', 'Pi', 'PT')).toBeGreaterThan(0.75);
    expect(exc('normal', 'Pi')).toBeLessThan(0.25);
  });
});

describe('scenarios', () => {
  test('loop diuretic: thick limb NaCl blocked, FENa ~10%+, GFR about unchanged', () => {
    expect(seg('loop', 'Na', 'TAL')).toBeLessThan(0.05);
    expect(exc('loop', 'Na')).toBeGreaterThan(0.05);
    expect(exc('loop', 'Na')).toBeLessThan(0.3);
    // prostaglandin-mediated vasodilation keeps GFR close to normal despite the loss of feedback
    expect(Math.abs(gfr('loop') / gfr('normal') - 1)).toBeLessThan(0.15);
    // paracellular Ca2+ and Mg2+ reabsorption in the thick limb falls with the voltage
    expect(exc('loop', 'Ca')).toBeGreaterThan(exc('normal', 'Ca'));
    expect(exc('loop', 'Mg')).toBeGreaterThan(exc('normal', 'Mg'));
    // more Na+ and flow to the CNT/CCD: more K+ secretion
    expect(exc('loop', 'K')).toBeGreaterThan(exc('normal', 'K'));
    expect(exc('loop', 'water')).toBeGreaterThan(exc('normal', 'water'));
  });

  test('thiazide: DCT NaCl blocked, FENa rises modestly, urine Ca2+ falls', () => {
    expect(seg('thiazide', 'Na', 'DCT')).toBeLessThan(0.5 * seg('normal', 'Na', 'DCT'));
    expect(exc('thiazide', 'Na')).toBeGreaterThan(exc('normal', 'Na'));
    expect(exc('thiazide', 'Na')).toBeLessThan(exc('loop', 'Na'));
    expect(exc('thiazide', 'Ca')).toBeLessThan(exc('normal', 'Ca'));
    expect(exc('thiazide', 'K')).toBeGreaterThan(exc('normal', 'K'));
  });

  test('SGLT2 inhibitor: a large share of filtered glucose reaches the urine', () => {
    expect(exc('sglt2i', 'glucose')).toBeGreaterThan(0.2);
    expect(exc('sglt2i', 'glucose')).toBeLessThan(0.7);
    expect(seg('sglt2i', 'Na', 'PT')).toBeLessThan(seg('normal', 'Na', 'PT'));
  });

  test('hyperglycaemia: the filtered load exceeds the transport maximum, glucose spills', () => {
    expect(exc('dm', 'glucose')).toBeGreaterThan(0.1);
    expect(exc('dm', 'water')).toBeGreaterThan(exc('normal', 'water')); // osmotic diuresis
  });

  test('volume depletion: avid Na+ retention, more proximal reabsorption, FEurea under 35%', () => {
    expect(exc('volume', 'Na')).toBeLessThan(0.002);
    expect(seg('volume', 'Na', 'PT')).toBeGreaterThan(seg('normal', 'Na', 'PT'));
    expect(exc('volume', 'urea')).toBeLessThan(0.35);
    expect(gfr('volume')).toBeLessThan(gfr('normal'));
  });

  test('high aldosterone: less Na+, more K+ in the urine', () => {
    expect(exc('aldo', 'Na')).toBeLessThan(exc('normal', 'Na'));
    expect(exc('aldo', 'K')).toBeGreaterThan(exc('normal', 'K'));
  });

  test('no ADH: collecting ducts take back almost no water, so ~10%+ of the filtrate is excreted', () => {
    const cd = (s: string) => seg(s, 'water', 'CCD') + seg(s, 'water', 'OMCD') + seg(s, 'water', 'IMCD');
    expect(cd('noadh')).toBeLessThan(0.2 * cd('normal'));
    expect(exc('noadh', 'water')).toBeGreaterThan(0.08);
    expect(seg('noadh', 'urea', 'IMCD')).toBeLessThan(seg('normal', 'urea', 'IMCD'));
  });
});

describe('display helpers', () => {
  test('small shares keep their digits', () => {
    expect(fmtPct(0.0002)).toBe('0.020%');
    expect(fmtPct(0.0052)).toBe('0.52%');
    expect(fmtPct(0.635)).toBe('64%');
    expect(fmtPct(0)).toBe('0%');
  });

  test('daily amounts use each solute’s unit', () => {
    expect(perDay('water', 125)).toBe('180 L/day');
    expect(perDay('Na', 17.5)).toBe('25200 mmol/day');
    expect(perDay('glucose', 180.16 / 1440)).toBe('1.00 mmol/day');
  });
});
