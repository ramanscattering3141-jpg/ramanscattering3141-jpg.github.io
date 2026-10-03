// Validation of the physiology engine against known renal relationships.
//
// These tests check that the model reproduces the causal relationships the application
// teaches. Most are directional (the sign of a response), because that is what must never
// break; a smaller set pins absolute values that are well established.

import { describe, expect, test } from 'vitest';
import { DEFAULT_PARAMS, applyPatch, type ParamPatch } from '../../renal/src/engine/types';
import { GLOM_REF, solveGlomerulus, oncotic } from '../../renal/src/engine/glomerulus';
import { evaluate, runToSteadyState, simulate } from '../../renal/src/engine/simulate';
import { runKidney } from '../../renal/src/engine/kidney';
import { runNephron } from '../../renal/src/engine/nephron';
import { initialBody, edelmanNa, respiratoryPCO2, acidBase, oncoticGradientRel } from '../../renal/src/engine/body';
import { withIsotonicChange } from '../../renal/src/engine/scenarios';
import { waterDeprivationTest, DEPRIVATION_PATIENTS, hypernatraemiaCorrection, type Regimen } from '../../renal/src/sim/deprivation';
import { hyperglycemicCrisis, treatCrisis, type Rx } from '../../renal/src/sim/hyperglycemia';

/**
 * One evaluation from the normal body state: the immediate ("before anything has had time to
 * change body composition") response, which is what the interactive panels show.
 */
function snap(patch: ParamPatch = {}) {
  const params = applyPatch(DEFAULT_PARAMS, patch);
  return evaluate(initialBody(params), params);
}

/**
 * The state reached after days of balance: needed for anything whose effect works through a
 * change in body fluid volume or composition (diuretics, salt intake, mineralocorticoid excess).
 */
function steady(patch: ParamPatch = {}, days = 14) {
  return runToSteadyState(applyPatch(DEFAULT_PARAMS, patch), days, 1).ev;
}

describe('normal values', () => {
  const n = snap();

  test('GFR, renal plasma flow and filtration fraction are in the normal adult range', () => {
    expect(n.kidney.GFR).toBeGreaterThan(105);
    expect(n.kidney.GFR).toBeLessThan(150);
    expect(n.kidney.RPF).toBeGreaterThan(500);
    expect(n.kidney.RPF).toBeLessThan(750);
    expect(n.kidney.FF).toBeGreaterThan(0.15);
    expect(n.kidney.FF).toBeLessThan(0.26);
  });

  test('glomerular capillary pressure ~45 mmHg with a small mean net filtration pressure', () => {
    // Rose Table 2-1: Pgc 45-46, Pbs 10, oncotic 23 -> 35 along the capillary; the human
    // glomerulus is more permeable than the primate, so the mean net gradient is only ~4 mmHg.
    expect(n.kidney.Pgc).toBeGreaterThan(38);
    expect(n.kidney.Pgc).toBeLessThan(52);
    const g = solveGlomerulus(GLOM_REF);
    expect(g.meanNFP).toBeGreaterThan(1.5);
    expect(g.meanNFP).toBeLessThan(8);
    expect(g.piAff).toBeGreaterThan(19);
    expect(g.piAff).toBeLessThan(27);
    expect(g.piEff).toBeGreaterThan(g.piAff);
  });

  test('the proximal tubule reabsorbs 55-70% of the filtrate isosmotically', () => {
    const pt = n.kidney.segments.PT;
    const frac = 1 - pt.out.water / pt.in.water;
    expect(frac).toBeGreaterThan(0.5);
    expect(frac).toBeLessThan(0.72);
    // fluid leaving the proximal tubule is still ~isosmotic to plasma
    expect(pt.osmOut).toBeGreaterThan(255);
    expect(pt.osmOut).toBeLessThan(320);
  });

  test('the thick ascending limb dilutes the tubular fluid below plasma osmolality', () => {
    expect(n.kidney.segments.TAL.osmOut).toBeLessThan(n.kidney.segments.PT.osmOut);
    expect(n.kidney.segments.TAL.osmOut).toBeLessThan(250);
  });

  test('fractional excretions and daily excretion rates are physiological', () => {
    expect(n.kidney.FE.Na * 100).toBeLessThan(2);
    expect(n.kidney.FE.HCO3 * 100).toBeLessThan(3);
    expect(n.kidney.FE.glucose * 100).toBeLessThan(0.5);
    expect(n.kidney.urine.exc.Na).toBeGreaterThan(30);
    expect(n.kidney.urine.exc.Na).toBeLessThan(260);
    expect(n.kidney.urine.volumePerDay).toBeGreaterThan(0.8);
    expect(n.kidney.urine.volumePerDay).toBeLessThan(3);
    expect(n.kidney.urine.osm).toBeGreaterThan(300);
  });

  test('net acid excretion is in the 40-100 mEq/day range and the urine is acid', () => {
    expect(n.kidney.urine.exc.NAE).toBeGreaterThan(30);
    expect(n.kidney.urine.exc.NAE).toBeLessThan(110);
    expect(n.kidney.urine.pH).toBeGreaterThan(4.4);
    expect(n.kidney.urine.pH).toBeLessThan(7);
    // ammonium is the larger and more adaptable component
    expect(n.kidney.urine.exc.NH4).toBeGreaterThan(15);
  });

  test('plasma composition and acid-base are normal', () => {
    expect(n.plasma.Na).toBeGreaterThan(136);
    expect(n.plasma.Na).toBeLessThan(145);
    expect(n.plasma.K).toBeGreaterThan(3.4);
    expect(n.plasma.K).toBeLessThan(5.2);
    expect(n.plasma.pH).toBeGreaterThan(7.35);
    expect(n.plasma.pH).toBeLessThan(7.45);
    expect(n.plasma.PCO2).toBeGreaterThan(36);
    expect(n.plasma.PCO2).toBeLessThan(44);
    expect(n.plasma.anionGap).toBeGreaterThan(4);
    expect(n.plasma.anionGap).toBeLessThan(16);
  });
});

describe('glomerular haemodynamics', () => {
  test('afferent constriction reduces renal blood flow, glomerular pressure and GFR', () => {
    const base = solveGlomerulus(GLOM_REF);
    const constricted = solveGlomerulus({ ...GLOM_REF, Ra: GLOM_REF.Ra * 1.6 });
    expect(constricted.RBF).toBeLessThan(base.RBF);
    expect(constricted.Pgc).toBeLessThan(base.Pgc);
    expect(constricted.GFR).toBeLessThan(base.GFR);
  });

  test('afferent dilation raises renal blood flow and GFR in parallel', () => {
    const base = solveGlomerulus(GLOM_REF);
    const dilated = solveGlomerulus({ ...GLOM_REF, Ra: GLOM_REF.Ra * 0.7 });
    expect(dilated.RBF).toBeGreaterThan(base.RBF);
    expect(dilated.GFR).toBeGreaterThan(base.GFR);
    expect(dilated.Pgc).toBeGreaterThan(base.Pgc);
  });

  test('moderate efferent constriction raises glomerular pressure, filtration fraction and GFR while lowering flow', () => {
    const base = solveGlomerulus(GLOM_REF);
    const mod = solveGlomerulus({ ...GLOM_REF, Re: GLOM_REF.Re * 1.8 });
    expect(mod.Pgc).toBeGreaterThan(base.Pgc);
    expect(mod.GFR).toBeGreaterThan(base.GFR);
    expect(mod.FF).toBeGreaterThan(base.FF);
    expect(mod.RBF).toBeLessThan(base.RBF);
    // the rise in filtration fraction concentrates protein in the peritubular capillary
    expect(mod.piEff).toBeGreaterThan(base.piEff);
  });

  test('severe efferent constriction eventually reduces GFR because flow falls too far', () => {
    const mod = solveGlomerulus({ ...GLOM_REF, Re: GLOM_REF.Re * 3 });
    const severe = solveGlomerulus({ ...GLOM_REF, Re: GLOM_REF.Re * 12 });
    expect(severe.Pgc).toBeGreaterThan(mod.Pgc); // pressure keeps rising
    expect(severe.RBF).toBeLessThan(mod.RBF * 0.6); // but flow collapses
    expect(severe.GFR).toBeLessThan(mod.GFR); // so filtration falls
  });

  test('raising Bowman’s space pressure (obstruction) reduces GFR', () => {
    const base = solveGlomerulus(GLOM_REF);
    const obstructed = solveGlomerulus({ ...GLOM_REF, Pbs: GLOM_REF.Pbs + 20 });
    expect(obstructed.GFR).toBeLessThan(base.GFR);
  });

  test('raising plasma protein concentration reduces GFR', () => {
    const base = solveGlomerulus(GLOM_REF);
    const conc = solveGlomerulus({ ...GLOM_REF, Cp: GLOM_REF.Cp + 1.5 });
    expect(oncotic(GLOM_REF.Cp + 1.5)).toBeGreaterThan(oncotic(GLOM_REF.Cp));
    expect(conc.GFR).toBeLessThan(base.GFR);
  });

  test('losing filtration surface area (glomerular disease) reduces GFR', () => {
    const base = solveGlomerulus(GLOM_REF);
    const gn = solveGlomerulus({ ...GLOM_REF, Kf: GLOM_REF.Kf * 0.35 });
    expect(gn.GFR).toBeLessThan(base.GFR);
  });

  test('GFR is autoregulated over a range of pressures and fails at low pressure', () => {
    const base = snap();
    const at = (MAP: number) =>
      runKidney({ params: base.params, plasma: base.plasma, hormones: base.reg.hormones, MAP, ureaProduction: 0.33 }).GFR;
    const g80 = at(80);
    const g100 = at(100);
    const g120 = at(120);
    const g45 = at(45);
    // a 50% rise in pressure changes GFR by much less than 50%
    expect(Math.abs(g120 - g80) / g100).toBeLessThan(0.55);
    // below the autoregulatory range filtration falls steeply
    expect(g45).toBeLessThan(g80 * 0.6);
    // pressure and flow still move in the same direction overall
    expect(g120).toBeGreaterThan(g45);
  });
});

describe('tubuloglomerular feedback and the renin–angiotensin system', () => {
  test('a loop diuretic raises chloride delivery but abolishes macula densa sensing, so renin rises', () => {
    const base = snap();
    const loop = snap({ drugs: { furosemide: 0.8 } });
    // more chloride arrives at the macula densa...
    expect(loop.kidney.mdDelivery).toBeGreaterThan(base.kidney.mdDelivery);
    // ...but it cannot be taken up through the blocked NKCC2, so the signal falls
    expect(loop.kidney.maculaDensa).toBeLessThan(base.kidney.maculaDensa);
    // which releases the macula densa brake on renin
    expect(loop.reg.hormones.renin).toBeGreaterThan(base.reg.hormones.renin);
    // and because the signal is what drives feedback, autoregulation is blunted: Rose notes that
    // inhibiting NKCC2 markedly impairs autoregulation as perfusion pressure rises
    expect(loop.kidney.maculaDensa).toBeLessThan(0.5);
  });

  test('a thiazide acts downstream of the macula densa, so it does not stimulate renin directly', () => {
    const base = snap();
    const thiazide = snap({ drugs: { thiazide: 0.9 } });
    const loop = snap({ drugs: { furosemide: 0.9 } });
    const thiazideRise = thiazide.reg.hormones.renin / base.reg.hormones.renin;
    const loopRise = loop.reg.hormones.renin / base.reg.hormones.renin;
    expect(loopRise).toBeGreaterThan(thiazideRise);
    expect(thiazideRise).toBeLessThan(1.5);
  });

  test('renal artery stenosis raises renin and angiotensin II', () => {
    const base = snap();
    const ras = snap({ stenosisL: 0.8, stenosisR: 0.8 });
    expect(ras.reg.hormones.renin).toBeGreaterThan(base.reg.hormones.renin);
    expect(ras.reg.hormones.angII).toBeGreaterThan(base.reg.hormones.angII);
  });

  test('an ACE inhibitor lowers angiotensin II, dilates the efferent arteriole and lowers glomerular pressure', () => {
    const base = snap({ stenosisL: 0.75, stenosisR: 0.75 });
    const acei = snap({ stenosisL: 0.75, stenosisR: 0.75, drugs: { acei: 0.9 } });
    expect(acei.reg.hormones.angII).toBeLessThan(base.reg.hormones.angII);
    expect(acei.kidney.sides[0].Re).toBeLessThan(base.kidney.sides[0].Re);
    expect(acei.kidney.Pgc).toBeLessThan(base.kidney.Pgc);
    expect(acei.kidney.GFR).toBeLessThan(base.kidney.GFR);
    // filtration fraction falls: this is the signature of efferent dilation
    expect(acei.kidney.FF).toBeLessThan(base.kidney.FF);
  });

  test('an ARB reproduces the ACE inhibitor effect on filtration', () => {
    const base = snap({ stenosisL: 0.75, stenosisR: 0.75 });
    const arb = snap({ stenosisL: 0.75, stenosisR: 0.75, drugs: { arb: 0.9 } });
    expect(arb.kidney.Pgc).toBeLessThan(base.kidney.Pgc);
    expect(arb.reg.hormones.at1).toBeLessThan(base.reg.hormones.at1);
  });

  test('an NSAID removes the protective vasodilator prostaglandins and lowers GFR when angiotensin II is high', () => {
    const volumeDepleted: ParamPatch = { cardiacFunction: 0.45, vasodilation: 0.3 };
    const base = snap(volumeDepleted);
    const nsaid = snap({ ...volumeDepleted, drugs: { nsaid: 1 } });
    expect(nsaid.reg.hormones.pg).toBeLessThan(base.reg.hormones.pg);
    expect(nsaid.kidney.GFR).toBeLessThan(base.kidney.GFR);
    // in a normal person the same NSAID has little effect on filtration
    const wellBase = snap();
    const wellNsaid = snap({ drugs: { nsaid: 1 } });
    const sickDrop = (base.kidney.GFR - nsaid.kidney.GFR) / base.kidney.GFR;
    const wellDrop = (wellBase.kidney.GFR - wellNsaid.kidney.GFR) / wellBase.kidney.GFR;
    expect(sickDrop).toBeGreaterThan(wellDrop);
  });
});

describe('water balance and the concentrating mechanism', () => {
  test('ADH increases collecting duct water permeability, urine osmolality and reduces volume', () => {
    const low = snap({ centralDI: 1 });
    const high = snap({ adhAutonomous: 8 });
    expect(high.reg.hormones.aqp2).toBeGreaterThan(low.reg.hormones.aqp2);
    expect(high.kidney.urine.osm).toBeGreaterThan(low.kidney.urine.osm);
    expect(high.kidney.urine.volumePerDay).toBeLessThan(low.kidney.urine.volumePerDay);
    expect(low.kidney.freeWaterClearance).toBeGreaterThan(high.kidney.freeWaterClearance);
  });

  test('a V2 antagonist reverses the effect of ADH', () => {
    const siadh = snap({ adhAutonomous: 8 });
    const treated = snap({ adhAutonomous: 8, drugs: { tolvaptan: 0.9 } });
    expect(treated.kidney.urine.osm).toBeLessThan(siadh.kidney.urine.osm);
    expect(treated.kidney.urine.volumePerDay).toBeGreaterThan(siadh.kidney.urine.volumePerDay);
  });

  test('inhibiting NKCC2 reduces the medullary gradient and concentrating ability', () => {
    const base = snap({ adhAutonomous: 8 });
    const loop = snap({ adhAutonomous: 8, drugs: { furosemide: 0.9 } });
    expect(loop.kidney.gNaCl).toBeLessThan(base.kidney.gNaCl * 0.5);
    expect(loop.kidney.medullaTarget).toBeLessThan(base.kidney.medullaTarget);
    // the maximum urine osmolality attainable falls
    expect(loop.kidney.urine.osm).toBeLessThan(base.kidney.urine.osm);
  });

  test('a thiazide acts in the cortex and spares the medullary gradient', () => {
    const base = snap({ adhAutonomous: 8 });
    const loop = snap({ adhAutonomous: 8, drugs: { furosemide: 0.9 } });
    const thiazide = snap({ adhAutonomous: 8, drugs: { thiazide: 0.9 } });
    expect(thiazide.kidney.medullaTarget).toBeGreaterThan(loop.kidney.medullaTarget);
    expect(thiazide.kidney.gNaCl).toBeGreaterThan(loop.kidney.gNaCl);
    // which is why thiazides, not loop diuretics, typically cause hyponatraemia
    expect(thiazide.kidney.urine.osm).toBeGreaterThan(loop.kidney.urine.osm);
  });

  test('urea recycling contributes to the medullary gradient', () => {
    const base = snap({ adhAutonomous: 6 });
    const noUrea = snap({ adhAutonomous: 6, transporters: { UTA: 0.05 } });
    expect(noUrea.kidney.gUrea).toBeLessThan(base.kidney.gUrea);
    expect(noUrea.kidney.medullaTarget).toBeLessThan(base.kidney.medullaTarget);
  });

  test('high vasa recta flow washes out the medullary gradient', () => {
    const base = snap({ adhAutonomous: 6 });
    const input = {
      params: base.params,
      plasma: base.plasma,
      hormones: base.reg.hormones,
      GFR: base.kidney.GFR,
      nephronFraction: 1,
      FF: base.kidney.FF,
      Pptc: base.kidney.Pptc,
      piPtc: base.kidney.piPtc,
      ureaProduction: 0.33,
    };
    const slow = runNephron({ ...input, vasaRecta: 0.6, perfusionPressure: base.reg.MAP });
    const fast = runNephron({ ...input, vasaRecta: 2.0, perfusionPressure: base.reg.MAP });
    expect(fast.medullaTarget).toBeLessThan(slow.medullaTarget);
    expect(fast.gNaCl).toBeLessThan(slow.gNaCl);
  });

  test('free water clearance is negative with concentrated urine and positive with dilute urine', () => {
    expect(snap({ adhAutonomous: 8 }).kidney.freeWaterClearance).toBeLessThan(0);
    expect(snap({ centralDI: 1 }).kidney.freeWaterClearance).toBeGreaterThan(0);
  });

  test('nephrogenic DI: aquaporin-2 loss produces dilute urine despite high ADH', () => {
    const central = snap({ centralDI: 1 });
    const nephrogenic = snap({ adhAutonomous: 8, transporters: { AQP2: 0.05 } });
    expect(nephrogenic.reg.hormones.adh).toBeGreaterThan(central.reg.hormones.adh);
    expect(nephrogenic.kidney.urine.osm).toBeLessThan(200);
  });
});

describe('sodium, volume and the distinction from serum sodium', () => {
  test('serum sodium is set by the ratio of exchangeable cation to body water, not by total body sodium', () => {
    // doubling body sodium and body water together leaves the concentration unchanged
    expect(edelmanNa(3000, 3000, 42)).toBeCloseTo(edelmanNa(6000, 6000, 84), 6);
    // adding water alone lowers it
    expect(edelmanNa(3000, 3000, 48)).toBeLessThan(edelmanNa(3000, 3000, 42));
    // adding sodium alone raises it
    expect(edelmanNa(3400, 3000, 42)).toBeGreaterThan(edelmanNa(3000, 3000, 42));
  });

  test('aldosterone increases distal sodium reabsorption and potassium secretion', () => {
    const low = snap({ aldoSynthesis: 0 });
    const high = snap({ aldoAutonomous: 8 });
    expect(high.kidney.FE.Na).toBeLessThan(low.kidney.FE.Na);
    expect(high.kidney.kSecretion).toBeGreaterThan(low.kidney.kSecretion);
    expect(high.kidney.distalVoltage).toBeGreaterThan(low.kidney.distalVoltage);
  });

  test('effective volume depletion increases proximal reabsorption and lowers sodium excretion', () => {
    const base = snap();
    const depleted = snap({ cardiacFunction: 0.5 });
    expect(depleted.reg.hormones.at1).toBeGreaterThan(base.reg.hormones.at1);
    expect(depleted.kidney.FE.Na).toBeLessThan(base.kidney.FE.Na);
    expect(depleted.kidney.urine.Na).toBeLessThan(base.kidney.urine.Na);
    const ptFraction = (e: typeof base) => 1 - e.kidney.segments.PT.out.water / e.kidney.segments.PT.in.water;
    expect(ptFraction(depleted)).toBeGreaterThan(ptFraction(base));
  });

  test('a rise in renal perfusion pressure causes pressure natriuresis at constant hormone levels', () => {
    const base = snap();
    const at = (MAP: number) =>
      runKidney({ params: base.params, plasma: base.plasma, hormones: base.reg.hormones, MAP, ureaProduction: 0.33 });
    expect(at(110).urine.exc.Na).toBeGreaterThan(at(85).urine.exc.Na);
  });
});

describe('potassium', () => {
  test('distal sodium delivery and flow increase potassium secretion', () => {
    const base = snap();
    const loop = snap({ drugs: { furosemide: 0.7 } });
    expect(loop.kidney.distalNaDelivery).toBeGreaterThan(base.kidney.distalNaDelivery);
    expect(loop.kidney.distalFlow).toBeGreaterThan(base.kidney.distalFlow);
    expect(loop.kidney.kSecretion).toBeGreaterThan(base.kidney.kSecretion);
    expect(loop.kidney.urine.exc.K).toBeGreaterThan(base.kidney.urine.exc.K);
  });

  test('blocking ENaC abolishes the lumen-negative voltage and reduces potassium secretion', () => {
    const base = snap();
    const amiloride = snap({ drugs: { amiloride: 0.9 } });
    expect(amiloride.kidney.distalVoltage).toBeLessThan(base.kidney.distalVoltage);
    expect(amiloride.kidney.kSecretion).toBeLessThan(base.kidney.kSecretion);
  });

  test('an MR antagonist reduces potassium secretion and sodium reabsorption', () => {
    const base = snap();
    const spiro = snap({ drugs: { spironolactone: 0.9 } });
    expect(spiro.reg.hormones.mr).toBeLessThan(base.reg.hormones.mr);
    expect(spiro.kidney.kSecretion).toBeLessThan(base.kidney.kSecretion);
    expect(spiro.kidney.FE.Na).toBeGreaterThan(base.kidney.FE.Na);
  });

  test('ROMK loss impairs both loop transport and distal potassium channels (Bartter type 2)', () => {
    const base = snap();
    const romk = snap({ transporters: { ROMK: 0.1 } });
    // apical K channels are needed for NKCC2 to keep working, so the loop is impaired too
    expect(romk.kidney.gNaCl).toBeLessThan(base.kidney.gNaCl);
    expect(romk.kidney.FE.Na).toBeGreaterThan(base.kidney.FE.Na);
    // with the same distal flow and voltage, fewer channels means less secretion
    const flowMatched = snap({ transporters: { ROMK: 0.1, NKCC2: 1.6 } });
    expect(flowMatched.kidney.kSecretion).toBeLessThan(base.kidney.kSecretion * 2);
  });

  test('insulin and beta-2 stimulation shift potassium into cells; beta blockade opposes it', () => {
    const base = snap();
    const insulin = snap({ insulin: 3 });
    const beta = snap({ drugs: { albuterol: 1 } });
    const blocked = snap({ drugs: { betaBlocker: 1 } });
    expect(insulin.plasma.K).toBeLessThan(base.plasma.K);
    expect(beta.plasma.K).toBeLessThan(base.plasma.K);
    expect(blocked.plasma.K).toBeGreaterThan(base.plasma.K);
  });

  test('mineral acidosis raises plasma potassium relative to body stores', () => {
    const base = snap();
    const acidotic = snap({ extraAcid: 300 });
    const b = initialBody(applyPatch(DEFAULT_PARAMS, {}));
    // same potassium stores, lower pH -> higher measured potassium
    const p1 = applyPatch(DEFAULT_PARAMS, {});
    const e1 = evaluate({ ...b, hco3: 24 }, p1);
    const e2 = evaluate({ ...b, hco3: 14 }, p1);
    expect(e2.plasma.pH).toBeLessThan(e1.plasma.pH);
    expect(e2.plasma.K).toBeGreaterThan(e1.plasma.K);
    expect(acidotic.plasma.K).toBeGreaterThan(0); // sanity
    expect(base.plasma.K).toBeGreaterThan(0);
  });
});

describe('acid–base', () => {
  test('Henderson–Hasselbalch and the expected compensations', () => {
    expect(acidBase(24, 40).pH).toBeCloseTo(7.4, 1);
    const p = applyPatch(DEFAULT_PARAMS, {});
    // PCO2 is solved from the ventilatory response to pH rather than read off a bicarbonate rule,
    // so it lands near rather than exactly on 40 at a normal bicarbonate.
    expect(respiratoryPCO2(24, p)).toBeCloseTo(40, 0);

    // The rule itself relates the two numbers a blood gas reports, so it has to be checked on
    // those: the stored bicarbonate pool differs from the measured one by the acute buffering of
    // whatever PCO2 the compensation produced.
    const b = initialBody(p);
    const gas = (hco3: number) => {
      const ev = evaluate({ ...b, hco3 }, p);
      return { pco2: ev.plasma.PCO2, hco3: ev.plasma.HCO3 };
    };
    const ref = gas(24);
    const acidotic = gas(16);
    const alkalotic = gas(33);
    const slopeDown = (ref.pco2 - acidotic.pco2) / (ref.hco3 - acidotic.hco3);
    const slopeUp = (alkalotic.pco2 - ref.pco2) / (alkalotic.hco3 - ref.hco3);
    // Rose Table 17-3: 1.2 mmHg per mmol/L for metabolic acidosis, 0.7 for metabolic alkalosis
    expect(slopeDown).toBeGreaterThan(1.0);
    expect(slopeDown).toBeLessThan(1.45);
    expect(slopeUp).toBeGreaterThan(0.55);
    expect(slopeUp).toBeLessThan(0.95);
  });

  /**
   * Rose Table 17-3, the compensations the whole diagnostic approach rests on. The respiratory
   * disorders separate into acute and chronic because the non-renal buffering is immediate and the
   * renal response takes days; the metabolic ones do not, because ventilation responds in minutes.
   */
  test('respiratory disturbances: acute buffering, then renal compensation over days', () => {
    const settledBody = runToSteadyState(DEFAULT_PARAMS, 60).state.body;
    const baseline = evaluate(settledBody, DEFAULT_PARAMS);
    const at = (offset: number, days: number) => {
      const p = applyPatch(DEFAULT_PARAMS, { paco2Offset: offset });
      const ev = days < 0.05 ? evaluate(settledBody, p) : simulate(p, days, 0.05, settledBody).final;
      const dP = ev.plasma.PCO2 - baseline.plasma.PCO2;
      const dH = ev.plasma.HCO3 - baseline.plasma.HCO3;
      return { per10: (dH / dP) * 10, ev };
    };

    // acute respiratory acidosis: bicarbonate rises about 1 mmol/L per 10 mmHg, from buffering
    expect(at(20, 0).per10).toBeGreaterThan(0.6);
    expect(at(20, 0).per10).toBeLessThan(1.6);
    // chronic: the kidney adds to it over days, and the pH is better protected as a result
    expect(at(20, 5).per10).toBeGreaterThan(at(20, 0).per10 + 0.7);
    expect(at(20, 5).ev.plasma.pH).toBeGreaterThan(at(20, 0).ev.plasma.pH);

    // acute respiratory alkalosis: about 2 mmol/L per 10 mmHg downwards
    expect(at(-15, 0).per10).toBeGreaterThan(1.5);
    expect(at(-15, 0).per10).toBeLessThan(2.6);
    // chronic: roughly double, and again the pH is pulled back toward normal
    expect(at(-15, 5).per10).toBeGreaterThan(3);
    expect(at(-15, 5).per10).toBeLessThan(5.5);
    expect(at(-15, 5).ev.plasma.pH).toBeLessThan(at(-15, 0).ev.plasma.pH);
  });

  test('the kidney responds to acidity, not to bicarbonate alone', () => {
    // A respiratory acidosis has a normal bicarbonate at the outset, so a kidney keyed to
    // bicarbonate would do nothing at all. Ammoniagenesis and net acid excretion must rise.
    const settledBody = runToSteadyState(DEFAULT_PARAMS, 60).state.body;
    const normal = evaluate(settledBody, DEFAULT_PARAMS);
    const hypercapnic = evaluate(settledBody, applyPatch(DEFAULT_PARAMS, { paco2Offset: 25 }));
    expect(hypercapnic.plasma.PCO2).toBeGreaterThan(normal.plasma.PCO2 + 8);
    expect(hypercapnic.kidney.ammoniagenesis).toBeGreaterThan(1.3 * normal.kidney.ammoniagenesis);
    // Net acid excretion is flat at the instant of hypercapnia — the acute buffering has already
    // raised the plasma bicarbonate, so the larger filtered load consumes the extra pump capacity.
    // What matters is that it rises once the disturbance persists, generating new bicarbonate.
    const afterADay = simulate(applyPatch(DEFAULT_PARAMS, { paco2Offset: 25 }), 1, 0.05, settledBody).final;
    expect(afterADay.kidney.urine.exc.NAE).toBeGreaterThan(1.2 * normal.kidney.urine.exc.NAE);
    // and the converse: hypocapnia suppresses it
    const hypocapnic = evaluate(settledBody, applyPatch(DEFAULT_PARAMS, { paco2Offset: -15 }));
    expect(hypocapnic.kidney.ammoniagenesis).toBeLessThan(normal.kidney.ammoniagenesis);
  });

  test('a primary respiratory disturbance does not run away', () => {
    // Written as a bicarbonate rule, the ventilatory compensation is positive feedback when the
    // primary problem is respiratory: the renal response lowers the bicarbonate, the rule reads
    // that as a metabolic acidosis and lowers the PCO2 further. This is the regression test.
    const settledBody = runToSteadyState(DEFAULT_PARAMS, 60).state.body;
    const long = simulate(applyPatch(DEFAULT_PARAMS, { paco2Offset: -20 }), 40, 0.2, settledBody).final;
    expect(long.plasma.HCO3).toBeGreaterThan(14);
    expect(long.plasma.PCO2).toBeGreaterThan(18);
    expect(long.plasma.pH).toBeLessThan(7.62);
  });

  test('metabolic acidosis increases net acid excretion and ammoniagenesis when the kidney is intact', () => {
    const b = initialBody(DEFAULT_PARAMS);
    const normal = evaluate({ ...b, hco3: 24 }, DEFAULT_PARAMS);
    const acidotic = evaluate({ ...b, hco3: 14 }, DEFAULT_PARAMS);
    expect(acidotic.kidney.ammoniagenesis).toBeGreaterThan(normal.kidney.ammoniagenesis);
    expect(acidotic.kidney.urine.exc.NAE).toBeGreaterThan(normal.kidney.urine.exc.NAE);
    expect(acidotic.kidney.urine.pH).toBeLessThanOrEqual(normal.kidney.urine.pH + 0.01);
  });

  test('reduced nephron mass limits the ammoniagenic response to acidosis', () => {
    const b = initialBody(DEFAULT_PARAMS);
    const intact = evaluate({ ...b, hco3: 14 }, DEFAULT_PARAMS);
    const ckd = evaluate({ ...b, hco3: 14 }, applyPatch(DEFAULT_PARAMS, { nephronFraction: 0.2 }));
    expect(ckd.kidney.ammoniagenesis).toBeLessThan(intact.kidney.ammoniagenesis);
    expect(ckd.kidney.urine.exc.NAE).toBeLessThan(intact.kidney.urine.exc.NAE);
  });

  test('carbonic anhydrase inhibition causes bicarbonate wasting and an alkaline urine', () => {
    const base = snap();
    const acz = snap({ drugs: { acetazolamide: 0.9 } });
    expect(acz.kidney.urine.exc.HCO3).toBeGreaterThan(base.kidney.urine.exc.HCO3);
    expect(acz.kidney.urine.pH).toBeGreaterThan(base.kidney.urine.pH);
    expect(acz.kidney.urine.exc.NAE).toBeLessThan(base.kidney.urine.exc.NAE);
    // and reduces proximal sodium reabsorption, increasing distal delivery
    expect(acz.kidney.distalNaDelivery).toBeGreaterThan(base.kidney.distalNaDelivery);
  });

  test('proximal (type 2) RTA: bicarbonate wasting with preserved distal acidification', () => {
    const base = snap();
    const prta = snap({ transporters: { NBCe1: 0.15 } });
    expect(prta.kidney.urine.exc.HCO3).toBeGreaterThan(base.kidney.urine.exc.HCO3);
    // with a low plasma bicarbonate the filtered load falls and the urine can be acidified again
    const b = initialBody(DEFAULT_PARAMS);
    const prtaLow = evaluate({ ...b, hco3: 15 }, applyPatch(DEFAULT_PARAMS, { transporters: { NBCe1: 0.15 } }));
    expect(prtaLow.kidney.urine.pH).toBeLessThan(prta.kidney.urine.pH);
  });

  test('distal (type 1) RTA: the urine cannot be acidified even when the plasma bicarbonate is low', () => {
    const b = initialBody(DEFAULT_PARAMS);
    const params = applyPatch(DEFAULT_PARAMS, { transporters: { HATPase: 0.1 } });
    const drta = evaluate({ ...b, hco3: 15 }, params);
    const normal = evaluate({ ...b, hco3: 15 }, DEFAULT_PARAMS);
    expect(drta.kidney.urine.pH).toBeGreaterThan(normal.kidney.urine.pH);
    expect(drta.kidney.urine.exc.NAE).toBeLessThan(normal.kidney.urine.exc.NAE);
  });

  test('type 4 RTA: hypoaldosteronism gives hyperkalaemia and, through it, a modest acidosis', () => {
    const base = snap();
    const type4 = snap({ aldoSynthesis: 0 });
    // immediately: less potassium secretion and less distal H+ secretory capacity
    expect(type4.kidney.urine.exc.K).toBeLessThan(base.kidney.urine.exc.K);
    expect(type4.kidney.hSecretionDistal).toBeLessThan(base.kidney.hSecretionDistal);
    // over days potassium is retained, and hyperkalaemia itself suppresses ammoniagenesis, which
    // is the main reason the acidosis of type 4 RTA develops
    const chronic = steady({ aldoSynthesis: 0 }, 12);
    const control = steady({}, 12);
    expect(chronic.plasma.K).toBeGreaterThan(control.plasma.K);
    expect(chronic.kidney.ammoniagenesis).toBeLessThan(control.kidney.ammoniagenesis);
  });

  test('vomiting generates metabolic alkalosis and volume depletion maintains it', () => {
    const base = snap();
    const vomiting = snap({ vomiting: 1.5 });
    // net acid balance becomes negative (alkali gained) because gastric HCl is lost
    expect(vomiting.balance.acidIn).toBeLessThan(base.balance.acidIn);
    // and the chloride-depleted, volume-depleted kidney reclaims bicarbonate avidly
    const b = initialBody(DEFAULT_PARAMS);
    const alkaloticDepleted = evaluate({ ...b, hco3: 34, clE: b.clE * 0.75 }, applyPatch(DEFAULT_PARAMS, { cardiacFunction: 0.7, vomiting: 1.5 }));
    const alkaloticReplete = evaluate({ ...b, hco3: 34 }, DEFAULT_PARAMS);
    expect(alkaloticDepleted.kidney.urine.exc.HCO3).toBeLessThan(alkaloticReplete.kidney.urine.exc.HCO3);
  });

  test('an alkalotic, chloride-replete kidney excretes bicarbonate via pendrin', () => {
    const b = initialBody(DEFAULT_PARAMS);
    const alkalotic = evaluate({ ...b, hco3: 34 }, DEFAULT_PARAMS);
    expect(alkalotic.kidney.pendrinSecretion).toBeGreaterThan(0);
    expect(alkalotic.kidney.urine.pH).toBeGreaterThan(snap().kidney.urine.pH);
  });
});

describe('proximal tubule transport', () => {
  test('glucose: reabsorption saturates and glucosuria begins below the theoretical threshold (splay)', () => {
    const normal = snap({ glucose: 95 });
    expect(normal.kidney.urine.exc.glucose).toBeLessThan(1);
    const g200 = snap({ glucose: 200 });
    const g400 = snap({ glucose: 400 });
    expect(g200.kidney.urine.exc.glucose).toBeGreaterThan(0.2); // splay: spilling before Tm
    expect(g400.kidney.urine.exc.glucose).toBeGreaterThan(g200.kidney.urine.exc.glucose);
    expect(g400.kidney.glucoseReabsorbed).toBeLessThanOrEqual(g400.kidney.glucoseTm * 1.05);
  });

  test('SGLT2 inhibition causes glucosuria, osmotic diuresis and natriuresis at normal glucose', () => {
    const base = snap();
    const sglt2i = snap({ drugs: { sglt2i: 0.9 } });
    expect(sglt2i.kidney.urine.exc.glucose).toBeGreaterThan(base.kidney.urine.exc.glucose);
    // unreabsorbed glucose holds sodium and water in the proximal lumen
    const ptFraction = (e: typeof base) => 1 - e.kidney.segments.PT.out.water / e.kidney.segments.PT.in.water;
    expect(ptFraction(sglt2i)).toBeLessThan(ptFraction(base));
    // at the same filtered load, more sodium leaves the proximal tubule
    const shared = {
      params: base.params,
      plasma: base.plasma,
      hormones: base.reg.hormones,
      GFR: 125,
      nephronFraction: 1,
      FF: 0.2,
      Pptc: 20,
      piPtc: 30,
      vasaRecta: 1,
      perfusionPressure: 93,
      ureaProduction: 0.33,
    };
    const ptBase = runNephron(shared);
    const ptDrug = runNephron({ ...shared, params: applyPatch(DEFAULT_PARAMS, { drugs: { sglt2i: 0.9 } }) });
    expect(ptDrug.segments.PT.out.Na).toBeGreaterThan(ptBase.segments.PT.out.Na);
    // at the same filtered load more chloride reaches the macula densa and more of it is taken
    // up, and that extra signal is how SGLT2 inhibitors reduce hyperfiltration (Cherney 2014)
    expect(ptDrug.mdDelivery).toBeGreaterThan(ptBase.mdDelivery);
    expect(ptDrug.maculaDensa).toBeGreaterThan(ptBase.maculaDensa);
  });

  test('phosphate: PTH and FGF23 reduce reabsorption', () => {
    const base = snap({ pthMode: 'low' });
    const high = snap({ pthMode: 'high' });
    expect(high.kidney.FE.Pi).toBeGreaterThan(base.kidney.FE.Pi);
  });

  test('Fanconi syndrome: generalised proximal transport failure', () => {
    const fanconi = snap({
      transporters: { SGLT2: 0.1, SGLT1: 0.1, NaPi2: 0.1, AAtransport: 0.1, NBCe1: 0.2, NHE3: 0.4 },
    });
    const base = snap();
    expect(fanconi.kidney.urine.exc.glucose).toBeGreaterThan(base.kidney.urine.exc.glucose);
    expect(fanconi.kidney.FE.Pi).toBeGreaterThan(base.kidney.FE.Pi);
    expect(fanconi.kidney.urine.exc.HCO3).toBeGreaterThan(base.kidney.urine.exc.HCO3);
  });

  test('creatinine secretion is inhibited by trimethoprim, raising the plasma level without a GFR change', () => {
    const base = snap();
    const tmp = snap({ drugs: { trimethoprim: 0.9 } });
    expect(tmp.kidney.creatSecretion).toBeLessThan(base.kidney.creatSecretion);
    expect(tmp.kidney.creatClearance).toBeLessThan(base.kidney.creatClearance);
    expect(Math.abs(tmp.kidney.GFR - base.kidney.GFR)).toBeLessThan(base.kidney.GFR * 0.12);
  });
});

describe('calcium and magnesium', () => {
  test('a loop diuretic increases calcium and magnesium excretion; a thiazide lowers calcium excretion', () => {
    const base = snap();
    const loop = snap({ drugs: { furosemide: 0.8 } });
    const thiazide = snap({ drugs: { thiazide: 0.8 } });
    expect(loop.kidney.FE.Ca).toBeGreaterThan(base.kidney.FE.Ca);
    expect(loop.kidney.FE.Mg).toBeGreaterThan(base.kidney.FE.Mg);
    expect(thiazide.kidney.FE.Ca).toBeLessThan(base.kidney.FE.Ca);
  });

  test('loss of paracellin-1 (claudin-16) wastes both calcium and magnesium', () => {
    const base = snap();
    const fhhnc = snap({ transporters: { claudin16: 0.1 } });
    expect(fhhnc.kidney.FE.Ca).toBeGreaterThan(base.kidney.FE.Ca);
    expect(fhhnc.kidney.FE.Mg).toBeGreaterThan(base.kidney.FE.Mg);
  });

  test('PTH increases distal calcium reabsorption', () => {
    const low = snap({ pthMode: 'low' });
    const high = snap({ pthMode: 'high' });
    expect(high.kidney.FE.Ca).toBeLessThan(low.kidney.FE.Ca);
  });
});

describe('diuretics', () => {
  test('potency ranks loop > thiazide > ENaC blocker', () => {
    const base = snap();
    const loop = snap({ drugs: { furosemide: 1 } });
    const thiazide = snap({ drugs: { thiazide: 1 } });
    const amiloride = snap({ drugs: { amiloride: 1 } });
    expect(loop.kidney.FE.Na).toBeGreaterThan(amiloride.kidney.FE.Na);
    expect(thiazide.kidney.FE.Na).toBeGreaterThan(base.kidney.FE.Na);
    expect(amiloride.kidney.FE.Na).toBeGreaterThan(base.kidney.FE.Na);
    // a maximal loop diuretic can excrete a large fraction of the filtered sodium
    expect(loop.kidney.FE.Na * 100).toBeGreaterThan(5);
    // the thiazide-sensitive segment reabsorbs much less than the loop, so its ceiling is lower
    expect(thiazide.kidney.FE.Na * 100).toBeLessThan(6);
  });

  test('distal adaptation causes partial resistance, and makes an added thiazide worth more', () => {
    // Rose ch. 15: chronic loop therapy hypertrophies the thiazide-sensitive distal tubule. The
    // loop diuretic achieves less, but is never abolished ("not seriously impaired"), while the
    // natriuretic response to an added thiazide grows (Loon 1989).
    const fe = (patch: ParamPatch) => snap(patch).derived.FENa;
    const naive = fe({ drugs: { furosemide: 0.9 } });
    const adapted = fe({ distalAdaptation: 1.8, drugs: { furosemide: 0.9 } });
    expect(adapted).toBeLessThan(naive);
    expect(adapted).toBeGreaterThan(3); // resistance is partial, not total

    const addedWhenNaive = fe({ drugs: { furosemide: 0.9, thiazide: 0.8 } }) - naive;
    const addedWhenAdapted = fe({ distalAdaptation: 1.8, drugs: { furosemide: 0.9, thiazide: 0.8 } }) - adapted;
    expect(addedWhenAdapted).toBeGreaterThan(addedWhenNaive);
    // and far more than the same thiazide achieves on its own
    expect(addedWhenAdapted).toBeGreaterThan(2 * fe({ distalAdaptation: 1.8, drugs: { thiazide: 0.8 } }));
  });

  test('sequential nephron blockade: adding a thiazide to a loop diuretic adds natriuresis', () => {
    const loop = snap({ drugs: { furosemide: 0.8 } });
    const both = snap({ drugs: { furosemide: 0.8, thiazide: 0.8 } });
    expect(both.kidney.urine.exc.Na).toBeGreaterThan(loop.kidney.urine.exc.Na);
  });

  test('loop and thiazide diuretics cause potassium and hydrogen loss; ENaC blockade spares them', () => {
    const base = snap();
    const loop = snap({ drugs: { furosemide: 0.8 } });
    const amiloride = snap({ drugs: { amiloride: 0.9 } });
    expect(loop.kidney.urine.exc.K).toBeGreaterThan(base.kidney.urine.exc.K);
    expect(amiloride.kidney.kSecretion).toBeLessThan(base.kidney.kSecretion);
    // the same loss of lumen negativity reduces the drive for distal H+ secretion, which is why
    // ENaC blockade can cause a hyperkalaemic, hyperchloraemic acidosis
    expect(amiloride.kidney.hSecretionDistal).toBeLessThan(base.kidney.hSecretionDistal);
  });

  test('a potassium-sparing diuretic added to a loop diuretic reduces potassium loss', () => {
    const loop = snap({ drugs: { furosemide: 0.8 } });
    const combo = snap({ drugs: { furosemide: 0.8, amiloride: 0.8 } });
    expect(combo.kidney.urine.exc.K).toBeLessThan(loop.kidney.urine.exc.K);
  });

  test('osmotic diuresis (mannitol) reduces proximal reabsorption', () => {
    const base = snap();
    const mannitol = snap({ drugs: { mannitol: 60 } });
    expect(mannitol.kidney.urine.exc.Na).toBeGreaterThanOrEqual(base.kidney.urine.exc.Na);
  });
});

describe('inherited tubular disorders reproduce their laboratory phenotype', () => {
  test('Bartter syndrome behaves like a loop diuretic: salt wasting, hypokalaemia, poor concentration', () => {
    const base = snap();
    const bartter = snap({ transporters: { NKCC2: 0.12 } });
    expect(bartter.kidney.FE.Na).toBeGreaterThan(base.kidney.FE.Na);
    expect(bartter.kidney.urine.exc.K).toBeGreaterThan(base.kidney.urine.exc.K);
    expect(bartter.kidney.medullaTarget).toBeLessThan(base.kidney.medullaTarget);
    expect(bartter.kidney.FE.Ca).toBeGreaterThan(base.kidney.FE.Ca);
    expect(bartter.reg.hormones.renin).toBeGreaterThan(base.reg.hormones.renin);
  });

  test('Gitelman syndrome behaves like a thiazide: hypokalaemia with low calcium excretion', () => {
    const base = snap();
    const gitelman = snap({ transporters: { NCC: 0.1 } });
    expect(gitelman.kidney.FE.Na).toBeGreaterThan(base.kidney.FE.Na);
    expect(gitelman.kidney.urine.exc.K).toBeGreaterThan(base.kidney.urine.exc.K);
    expect(gitelman.kidney.FE.Ca).toBeLessThan(base.kidney.FE.Ca);
    // the medullary gradient is preserved, unlike Bartter
    const bartter = snap({ transporters: { NKCC2: 0.12 } });
    expect(gitelman.kidney.medullaTarget).toBeGreaterThan(bartter.kidney.medullaTarget);
  });

  test('Liddle syndrome: constitutively active ENaC retains sodium and wastes potassium with low renin', () => {
    const base = snap();
    const liddle = snap({ transporters: { ENaC: 3.5 } });
    expect(liddle.kidney.FE.Na).toBeLessThan(base.kidney.FE.Na);
    expect(liddle.kidney.kSecretion).toBeGreaterThan(base.kidney.kSecretion);
    expect(liddle.kidney.distalVoltage).toBeGreaterThan(base.kidney.distalVoltage);
  });

  test('apparent mineralocorticoid excess mimics aldosterone: sodium retention and potassium wasting', () => {
    const base = snap();
    const ame = snap({ cortisolMR: 1 });
    expect(ame.reg.hormones.mr).toBeGreaterThan(base.reg.hormones.mr);
    expect(ame.kidney.kSecretion).toBeGreaterThan(base.kidney.kSecretion);
    expect(ame.kidney.FE.Na).toBeLessThan(base.kidney.FE.Na);
    // aldosterone synthesis itself is suppressed because the receptor is already occupied
    expect(ame.reg.hormones.aldo).toBeLessThanOrEqual(base.reg.hormones.aldo * 1.05);
  });

  test('nephrogenic DI from a V2 receptor defect cannot concentrate the urine', () => {
    const v2 = snap({ adhAutonomous: 8, transporters: { V2R: 0.05 } });
    expect(v2.kidney.urine.osm).toBeLessThan(250);
  });
});

describe('acute kidney injury and obstruction', () => {
  test('pre-renal physiology: intact tubules reabsorb sodium avidly and concentrate the urine', () => {
    const prerenal = snap({ cardiacFunction: 0.45 });
    expect(prerenal.kidney.FE.Na * 100).toBeLessThan(1);
    expect(prerenal.kidney.urine.Na).toBeLessThan(25);
    expect(prerenal.kidney.urine.osm).toBeGreaterThan(450);
  });

  test('tubular injury raises FENa and the urine sodium and impairs concentration', () => {
    const prerenal = snap({ cardiacFunction: 0.45 });
    const atn = snap({ tubularInjury: 0.8 });
    expect(atn.kidney.FE.Na * 100).toBeGreaterThan(1.2);
    expect(atn.kidney.FE.Na).toBeGreaterThan(prerenal.kidney.FE.Na);
    expect(atn.kidney.urine.Na).toBeGreaterThan(40);
    expect(atn.kidney.urine.osm).toBeLessThan(prerenal.kidney.urine.osm);
    expect(atn.kidney.GFR).toBeLessThan(snap().kidney.GFR);
  });

  test('the traditional indices overlap: volume depletion superimposed on injury can still look pre-renal', () => {
    const atn = snap({ tubularInjury: 0.8 });
    const both = snap({ cardiacFunction: 0.45, tubularInjury: 0.8 });
    // the same degree of tubular injury gives a much lower FENa once volume depletion is added,
    // which is why FENa must not be taught as an infallible test
    expect(both.kidney.FE.Na).toBeLessThan(atn.kidney.FE.Na);
  });

  test('tubular injury can reduce GFR without oliguria (non-oliguric injury is possible)', () => {
    const atn = snap({ tubularInjury: 0.7 });
    const base = snap();
    expect(atn.kidney.GFR).toBeLessThan(base.kidney.GFR * 0.8);
    expect(atn.kidney.urine.volumePerDay).toBeGreaterThan(0.4);
  });

  test('obstruction raises Bowman’s space pressure and reduces GFR', () => {
    const base = snap();
    const obstructed = snap({ obstructionL: 0.8, obstructionR: 0.8 });
    expect(obstructed.kidney.sides[0].Pbs).toBeGreaterThan(base.kidney.sides[0].Pbs);
    expect(obstructed.kidney.GFR).toBeLessThan(base.kidney.GFR);
  });

  test('unilateral obstruction is partly compensated by the other kidney', () => {
    const unilateral = snap({ obstructionL: 0.9 });
    const bilateral = snap({ obstructionL: 0.9, obstructionR: 0.9 });
    expect(unilateral.kidney.GFR).toBeGreaterThan(bilateral.kidney.GFR);
    expect(unilateral.kidney.sides[0].GFR).toBeLessThan(unilateral.kidney.sides[1].GFR);
  });
});

describe('chronic kidney disease', () => {
  test('nephron loss produces single-nephron hyperfiltration, so GFR falls less than nephron mass', () => {
    const base = snap();
    const half = snap({ nephronFraction: 0.5 });
    expect(half.kidney.singleNephronGFR).toBeGreaterThan(base.kidney.singleNephronGFR);
    expect(half.kidney.GFR / base.kidney.GFR).toBeGreaterThan(0.5);
    expect(half.kidney.GFR).toBeLessThan(base.kidney.GFR);
  });

  test('the remaining nephrons excrete a larger fraction of their filtered sodium and potassium', () => {
    const base = snap();
    const ckd = snap({ nephronFraction: 0.25 });
    expect(ckd.kidney.FE.Na).toBeGreaterThan(base.kidney.FE.Na);
  });

  test('advanced CKD reduces the ability to excrete acid and to concentrate the urine', () => {
    const base = snap();
    const ckd = snap({ nephronFraction: 0.15 });
    expect(ckd.kidney.ammoniagenesis).toBeLessThan(base.kidney.ammoniagenesis);
    expect(ckd.kidney.medullaTarget).toBeLessThan(base.kidney.medullaTarget);
  });

  test('an ACE inhibitor lowers glomerular pressure in the remnant kidney at the same perfusion pressure', () => {
    const ckd = snap({ nephronFraction: 0.3 });
    const treated = snap({ nephronFraction: 0.3, drugs: { acei: 0.9 } });
    // compare at a matched renal perfusion pressure so the effect on the efferent arteriole is
    // not masked by the systemic fall in pressure
    const at = (e: typeof ckd) =>
      runKidney({ params: e.params, plasma: e.plasma, hormones: e.reg.hormones, MAP: 95, ureaProduction: 0.33 });
    // the efferent arteriole dilates relatively more than the afferent, so the filtration
    // fraction falls - the signature of a lower glomerular capillary pressure per unit flow
    expect(at(treated).FF).toBeLessThan(at(ckd).FF);
    expect(at(treated).sides[0].Re / at(treated).sides[0].Ra).toBeLessThan(at(ckd).sides[0].Re / at(ckd).sides[0].Ra);
  });
});

describe('clearance relationships', () => {
  test('creatinine clearance exceeds GFR because creatinine is secreted', () => {
    const n = snap();
    expect(n.kidney.creatClearance).toBeGreaterThan(n.kidney.GFR);
    expect(n.kidney.creatClearance).toBeLessThan(n.kidney.GFR * 1.6);
  });

  test('urea clearance is well below GFR because urea is reabsorbed', () => {
    const n = snap();
    expect(n.kidney.ureaClearance).toBeLessThan(n.kidney.GFR * 0.8);
  });

  test('volume depletion raises the BUN out of proportion to creatinine (pre-renal pattern)', () => {
    const base = snap();
    const depleted = snap({ cardiacFunction: 0.5 });
    expect(depleted.kidney.FE.urea).toBeLessThan(base.kidney.FE.urea);
  });
});

describe('the model is in balance and stays there', () => {
  // A model whose normal state drifts teaches nothing: every scenario would carry the drift on
  // top of the effect being studied. These tests pin the baseline as a genuine steady state.
  const n = snap();

  test('the normal kidney excretes what is taken in', () => {
    // Sodium: intake 150 mmol/day, of which ~10 leaves in sweat and stool.
    expect(n.balance.naOut).toBeGreaterThan(n.balance.naIn * 0.9);
    expect(n.balance.naOut).toBeLessThan(n.balance.naIn * 1.1);
    expect(n.balance.kOut).toBeGreaterThan(n.balance.kIn * 0.85);
    expect(n.balance.kOut).toBeLessThan(n.balance.kIn * 1.15);
    expect(n.balance.waterOut).toBeGreaterThan(n.balance.waterIn * 0.85);
    expect(n.balance.waterOut).toBeLessThan(n.balance.waterIn * 1.15);
  });

  test('normal urine composition', () => {
    const u = n.kidney.urine;
    expect(u.volumePerDay).toBeGreaterThan(1);
    expect(u.volumePerDay).toBeLessThan(2);
    expect(u.osm).toBeGreaterThan(400);
    expect(u.osm).toBeLessThan(800);
    expect(u.exc.osm).toBeGreaterThan(550); // 600-900 mOsm/day on a normal diet
    expect(u.exc.osm).toBeLessThan(950);
    // Urine chloride tracks urine sodium: the two are excreted together as their salt.
    expect(u.Cl).toBeGreaterThan(u.Na * 0.6);
    expect(u.Cl).toBeLessThan(u.Na * 1.4);
    // Fractional sodium excretion is well under 1% even in a person in sodium balance.
    expect(n.derived.FENa).toBeGreaterThan(0.2);
    expect(n.derived.FENa).toBeLessThan(1);
  });

  test('the macula densa signal is normalised to 1 at the normal state', () => {
    expect(n.kidney.maculaDensa).toBeGreaterThan(0.95);
    expect(n.kidney.maculaDensa).toBeLessThan(1.05);
  });

  test('a normal person holds a steady state for two months', () => {
    const { points } = simulate(DEFAULT_PARAMS, 60, 2);
    const last = points[points.length - 1];
    const first = points[0];
    expect(last.Na).toBeGreaterThan(136);
    expect(last.Na).toBeLessThan(143);
    expect(Math.abs(last.ecf - first.ecf)).toBeLessThan(1.5);
    expect(last.HCO3).toBeGreaterThan(22);
    expect(last.HCO3).toBeLessThan(27);
    expect(last.urineVolume).toBeGreaterThan(1);
    expect(last.urineVolume).toBeLessThan(2.2);
    expect(last.edema).toBeLessThan(0.5);
  });

  test('sodium excretion rises steeply with extracellular volume (the renal function curve)', () => {
    const b0 = initialBody(DEFAULT_PARAMS);
    const at = (scale: number) => {
      const b = { ...b0, naE: b0.naE * scale, clE: b0.clE * scale, tbw: b0.tbw + (b0.naE * (scale - 1)) / 140 };
      return evaluate(b, DEFAULT_PARAMS);
    };
    const contracted = at(0.9);
    const normal = at(1);
    const expanded = at(1.15);
    // Monotonic, and steep enough that a modest volume change restores balance.
    expect(contracted.kidney.urine.exc.Na).toBeLessThan(normal.kidney.urine.exc.Na * 0.6);
    expect(expanded.kidney.urine.exc.Na).toBeGreaterThan(normal.kidney.urine.exc.Na * 1.4);
    // Aldosterone moves the other way, as the volume signal requires.
    expect(contracted.reg.hormones.aldo).toBeGreaterThan(normal.reg.hormones.aldo);
    expect(expanded.reg.hormones.aldo).toBeLessThan(normal.reg.hormones.aldo);
  });

  test('a high salt intake reaches a new steady state: expanded volume, normal serum sodium', () => {
    const { points, state } = simulate(applyPatch(DEFAULT_PARAMS, { naIntake: 350 }), 45, 2);
    const last = points[points.length - 1];
    expect(state.outOfRange).toBeUndefined();
    // Serum sodium is defended by water balance; it is the volume that changes.
    expect(last.Na).toBeGreaterThan(137);
    expect(last.Na).toBeLessThan(143);
    // Rose ch. 8: a modest, self-limited expansion is the persistent signal that keeps excretion
    // matched to the higher intake — neither none nor a runaway.
    expect(last.ecf).toBeGreaterThan(points[0].ecf + 0.2);
    expect(last.ecf).toBeLessThan(points[0].ecf + 4);
    // Sodium balance is restored: output has caught up with the higher intake.
    const fin = evaluate(state.body, applyPatch(DEFAULT_PARAMS, { naIntake: 350 }));
    expect(fin.balance.naOut).toBeGreaterThan(fin.balance.naIn * 0.85);
    // Aldosterone is suppressed, which is how the new steady state is held.
    expect(last.aldo).toBeLessThan(points[0].aldo);
  });

  test('mineralocorticoid excess escapes: sodium retention is self-limiting, without oedema', () => {
    // Rose ch. 16: primary aldosteronism expands volume by a few litres and then escapes, which
    // is why these patients are hypertensive and hypokalaemic but not oedematous.
    const p = applyPatch(DEFAULT_PARAMS, { aldoAutonomous: 8 });
    const { points, state } = simulate(p, 45, 2);
    const last = points[points.length - 1];
    expect(state.outOfRange).toBeUndefined();
    const fin = evaluate(state.body, p);
    expect(fin.balance.naOut).toBeGreaterThan(fin.balance.naIn * 0.8);
    expect(last.Na).toBeGreaterThan(136);
    expect(fin.plasma.K).toBeLessThan(snap().plasma.K);
  });

  test('a disturbance with no steady state is reported as such, not given false numbers', () => {
    // Untreated severe heart failure retains water indefinitely. The model says so instead of
    // producing an impossible serum sodium once the body composition leaves the valid range.
    const { state, points } = simulate(applyPatch(DEFAULT_PARAMS, { cardiacFunction: 0.45 }), 60, 2);
    expect(state.outOfRange).toBeTruthy();
    for (const q of points) {
      expect(q.Na).toBeGreaterThan(95);
      expect(q.Na).toBeLessThan(180);
    }
    // Before it gets there it behaves like heart failure: avid sodium retention and oedema.
    const mid = points[Math.floor(points.length / 2)];
    expect(mid.edema).toBeGreaterThan(0.5);
    // Aldosterone falls from its acute peak as fluid is retained, but stays far above normal (1).
    expect(mid.aldo).toBeGreaterThan(2);
    expect(mid.Na).toBeLessThan(points[0].Na);
  });
});

describe('renal acid-base handling (Rose ch. 11)', () => {
  const atHco3 = (hco3: number, patch: ParamPatch = {}) =>
    evaluate(
      { ...initialBody(applyPatch(DEFAULT_PARAMS, patch)), hco3 },
      applyPatch(DEFAULT_PARAMS, patch),
    );

  test('bicarbonate reabsorption plateaus near a plasma level of 26 mmol/L', () => {
    // Rose Fig. 11-14: below the threshold essentially none is lost; above it the excess spills,
    // which is why a metabolic alkalosis cannot persist in a volume-replete person.
    expect(atHco3(20).kidney.urine.exc.HCO3).toBeLessThan(5);
    expect(atHco3(24).kidney.urine.exc.HCO3).toBeLessThan(15);
    expect(atHco3(32).kidney.urine.exc.HCO3).toBeGreaterThan(80);
    expect(atHco3(38).kidney.urine.exc.HCO3).toBeGreaterThan(atHco3(32).kidney.urine.exc.HCO3);
  });

  test('volume depletion raises that threshold, so the alkalosis is maintained', () => {
    const replete = atHco3(32).kidney.urine.exc.HCO3;
    const depleted = evaluate(
      withIsotonicChange({ ...initialBody(DEFAULT_PARAMS), hco3: 32 }, 3),
      DEFAULT_PARAMS,
    ).kidney.urine.exc.HCO3;
    expect(depleted).toBeLessThan(replete * 0.75);
  });

  test('acidaemia raises ammonium excretion far more than titratable acid', () => {
    const normal = atHco3(24);
    const acidotic = atHco3(12);
    const nh4Ratio = acidotic.kidney.urine.exc.NH4 / Math.max(normal.kidney.urine.exc.NH4, 1e-6);
    const taRatio = acidotic.kidney.urine.exc.TA / Math.max(normal.kidney.urine.exc.TA, 1e-6);
    expect(nh4Ratio).toBeGreaterThan(1.5);
    expect(nh4Ratio).toBeGreaterThan(taRatio);
    expect(acidotic.kidney.urine.pH).toBeLessThan(normal.kidney.urine.pH);
  });

  test('blocking the distal H+ pump raises urine pH and cuts net acid excretion (distal RTA)', () => {
    const rta = atHco3(16, { transporters: { HATPase: 0.1 } });
    const normal = atHco3(16);
    expect(rta.kidney.urine.pH).toBeGreaterThan(5.5);
    expect(rta.kidney.urine.pH).toBeGreaterThan(normal.kidney.urine.pH);
    expect(rta.kidney.urine.exc.NAE).toBeLessThan(normal.kidney.urine.exc.NAE);
  });

  test('carbonic anhydrase blockade wastes bicarbonate (acetazolamide, proximal RTA)', () => {
    const acz = atHco3(24, { transporters: { CA: 0.1 } });
    expect(acz.kidney.urine.exc.HCO3).toBeGreaterThan(atHco3(24).kidney.urine.exc.HCO3 + 40);
    expect(acz.kidney.urine.pH).toBeGreaterThan(atHco3(24).kidney.urine.pH);
  });
});

describe('volume regulation and the independence of Na+ and K+ (Rose ch. 6, 8)', () => {
  const steadyAt = (patch: ParamPatch) => runToSteadyState(applyPatch(DEFAULT_PARAMS, patch), 60).ev;
  const low = steadyAt({ naIntake: 20 });
  const mid = steadyAt({});
  const high = steadyAt({ naIntake: 400 });

  test('changing Na+ intake alone leaves plasma K+ essentially unchanged (Table 6-3)', () => {
    expect(Math.abs(low.plasma.K - mid.plasma.K)).toBeLessThan(0.3);
    expect(Math.abs(high.plasma.K - mid.plasma.K)).toBeLessThan(0.3);
  });

  test('a low-salt diet is met by a modest volume contraction and a rise in aldosterone', () => {
    const drop = mid.derived.ecfLiters - low.derived.ecfLiters;
    expect(drop).toBeGreaterThan(0.4);
    expect(drop).toBeLessThan(3);
    expect(low.reg.hormones.aldo).toBeGreaterThan(2 * mid.reg.hormones.aldo);
    expect(low.kidney.urine.exc.Na).toBeLessThan(20);
    expect(low.body.hco3).toBeGreaterThan(22);
  });

  test('steady-state ECF rises with intake: a few litres across a 20-fold range, never a runaway', () => {
    expect(mid.derived.ecfLiters).toBeGreaterThan(low.derived.ecfLiters);
    expect(high.derived.ecfLiters).toBeGreaterThan(mid.derived.ecfLiters);
    const span = high.derived.ecfLiters - low.derived.ecfLiters;
    expect(span).toBeGreaterThan(1);
    expect(span).toBeLessThan(4);
  });

  test('moderate heart failure compensates; severe failure has no steady state (Rose Fig. 8-7)', () => {
    const moderate = runToSteadyState(applyPatch(DEFAULT_PARAMS, { cardiacFunction: 0.7 }), 60);
    expect(moderate.state.outOfRange).toBeUndefined();
    expect(moderate.ev.reg.CO).toBeGreaterThan(0.85);
    expect(moderate.ev.derived.ecfLiters).toBeGreaterThan(mid.derived.ecfLiters + 2);
    expect(moderate.ev.reg.hormones.sns).toBeGreaterThan(0.9);
    const severe = runToSteadyState(applyPatch(DEFAULT_PARAMS, { cardiacFunction: 0.45 }), 60);
    expect(severe.state.outOfRange).toBeTruthy();
  });

  test('salt restriction lowers blood pressure slightly; salt loading raises it slightly', () => {
    // The reflexes defend pressure without overshooting: low salt must not come out hypertensive.
    expect(low.reg.MAP).toBeLessThan(mid.reg.MAP + 2.5);
    expect(high.reg.MAP).toBeGreaterThan(mid.reg.MAP);
    expect(high.reg.MAP - low.reg.MAP).toBeLessThan(8);
  });

  test('a 20-fold range of salt intake barely moves blood pressure when the RAAS can adjust', () => {
    expect(Math.abs(high.reg.MAP - low.reg.MAP)).toBeLessThan(6);
    expect(high.derived.ecfLiters).toBeGreaterThan(mid.derived.ecfLiters);
    expect(high.derived.edemaLiters).toBeLessThan(0.1);
    expect(high.reg.hormones.renin).toBeLessThan(mid.reg.hormones.renin);
  });

  test('primary aldosteronism: hypertension, hypokalaemia, suppressed renin, no oedema', () => {
    const pa = steadyAt({ aldoAutonomous: 3 });
    expect(pa.reg.MAP).toBeGreaterThan(mid.reg.MAP + 5);
    expect(pa.plasma.K).toBeLessThan(3.6);
    expect(pa.reg.hormones.renin).toBeLessThan(0.5 * mid.reg.hormones.renin);
    expect(pa.derived.edemaLiters).toBeLessThan(0.3);
    expect(pa.derived.ecfLiters - mid.derived.ecfLiters).toBeLessThan(4.5);
  });

  test('escape needs pressure natriuresis: clamping renal perfusion pressure prevents it (Hall 1984)', () => {
    const free = steadyAt({ aldoAutonomous: 3 });
    const clamped = steadyAt({ aldoAutonomous: 3, renalPressureClamp: 92 });
    expect(clamped.derived.ecfLiters).toBeGreaterThan(free.derived.ecfLiters + 3);
    expect(clamped.reg.MAP).toBeGreaterThan(free.reg.MAP + 10);
  });

  test('K+ loading and K+ restriction move plasma K+ in the expected direction without extremes', () => {
    const kLoad = steadyAt({ kIntake: 200 });
    const kLow = steadyAt({ kIntake: 20 });
    expect(kLoad.plasma.K).toBeGreaterThan(mid.plasma.K);
    expect(kLoad.plasma.K).toBeLessThan(5.3);
    expect(kLoad.reg.hormones.aldo).toBeGreaterThan(mid.reg.hormones.aldo);
    expect(kLow.plasma.K).toBeLessThan(mid.plasma.K);
    expect(kLow.plasma.K).toBeGreaterThan(2.5);
  });

  test('the macula densa senses volume depletion (less NaCl delivered) and renin rises', () => {
    const base = runToSteadyState(DEFAULT_PARAMS, 60).state.body;
    const depleted = evaluate(withIsotonicChange(base, 1), DEFAULT_PARAMS);
    const normal = evaluate(base, DEFAULT_PARAMS);
    expect(depleted.kidney.maculaDensa).toBeLessThan(normal.kidney.maculaDensa);
    expect(depleted.reg.hormones.renin).toBeGreaterThan(1.2 * normal.reg.hormones.renin);
    // and a litre of loss already cuts sodium excretion by more than half
    expect(depleted.kidney.urine.exc.Na).toBeLessThan(0.5 * normal.kidney.urine.exc.Na);
  });

  test('most urinary K+ comes from regulated distal secretion', () => {
    expect(mid.kidney.kSecretion * 1440).toBeGreaterThan(0.5 * mid.kidney.urine.exc.K);
  });
});

/**
 * The urine-chemistry module claims that each index succeeds in some states and misleads in
 * others, and it scores the model's own numbers against the truth it holds. Those claims are only
 * honest if the engine really produces the patterns, at the moment the page jumps to — so each
 * scenario below is the page's own parameter patch, read at its own teaching moment.
 *
 * Note the times: these are all non-steady states. In balance, excretion equals intake and FENa
 * reports the diet, which is precisely why urine chemistries are read early.
 */
describe('urine chemistries and where they mislead (Rose ch. 13)', () => {
  const settled = runToSteadyState(applyPatch(DEFAULT_PARAMS, { naIntake: 150 }), 60).state.body;

  /** The state a given number of days after the change, starting from a settled normal body. */
  function at(patch: ParamPatch, day: number) {
    const p = applyPatch(DEFAULT_PARAMS, { naIntake: 150, ...patch });
    const ev = day === 0 ? evaluate(settled, p) : simulate(p, day, Math.min(0.021, day / 8), settled).final;
    const u = ev.kidney.urine;
    return { ev, u, UNa: u.Na, UCl: u.Cl, FENa: ev.derived.FENa, Uosm: u.osm, naExc: u.exc.Na };
  }

  test('diarrhoea: the case the indices were designed for — all three point at hypovolaemia', () => {
    const d = at({ diarrhea: 2, waterIntake: 1.2, naIntake: 60 }, 1);
    expect(d.UNa).toBeLessThan(20);
    expect(d.FENa).toBeLessThan(1);
    expect(d.Uosm).toBeGreaterThan(500);
  });

  test('acute tubular necrosis: sodium is not reabsorbed and the urine is isosthenuric', () => {
    const a = at({ tubularInjury: 0.75 }, 0.25);
    expect(a.UNa).toBeGreaterThan(40);
    expect(a.FENa).toBeGreaterThan(1);
    expect(a.Uosm).toBeLessThan(350);
  });

  test('ATN on heart failure: FENa stays far below 1% although the tubules are injured', () => {
    const a = at({ tubularInjury: 0.7, cardiacFunction: 0.42 }, 1);
    expect(a.FENa).toBeLessThan(1);
    expect(a.UNa).toBeLessThan(20);
    // the volume signal that overrides the injury is real, not an artefact
    expect(a.ev.reg.hormones.aldo).toBeGreaterThan(1.5);
  });

  test('a loop diuretic drives FENa to ~5% through entirely normal tubules', () => {
    const l = at({ drugs: { furosemide: 0.9 } }, 0);
    expect(l.FENa).toBeGreaterThan(2);
    expect(l.FENa).toBeLessThan(15);
    expect(DEFAULT_PARAMS.tubularInjury).toBe(0);
  });

  test('braking: the same loop diuretic is back under 1% within hours', () => {
    const early = at({ drugs: { furosemide: 0.9 } }, 0);
    const later = at({ drugs: { furosemide: 0.9 } }, 1);
    expect(later.FENa).toBeLessThan(1);
    expect(later.naExc).toBeLessThan(0.2 * early.naExc);
  });

  test('vomiting: urine Na+ is high while urine Cl- stays low — bicarbonate carries the sodium out', () => {
    const v = at({ vomiting: 1, waterIntake: 2.5 }, 2);
    expect(v.ev.plasma.HCO3).toBeGreaterThan(28);
    expect(v.UNa).toBeGreaterThan(40);
    expect(v.UCl).toBeLessThan(20);
    expect(v.UNa - v.UCl).toBeGreaterThan(15);
    expect(v.u.pH).toBeGreaterThan(7);
  });

  test('diabetes insipidus: a low urine Na+ concentration with a normal daily excretion', () => {
    const di = at({ centralDI: 0.95 }, 3);
    expect(di.UNa).toBeLessThan(30);
    expect(di.u.volumePerDay).toBeGreaterThan(4);
    // the concentration is low only because of the volume: excretion is near intake
    expect(di.naExc).toBeGreaterThan(80);
  });

  test('SIADH: water is retained but sodium handling is untouched, so urine Na+ is not low', () => {
    const s = at({ adhAutonomous: 5 }, 3);
    expect(s.ev.plasma.Na).toBeLessThan(135);
    expect(s.UNa).toBeGreaterThan(40);
    expect(s.Uosm).toBeGreaterThan(500);
  });

  test('bilateral renal artery stenosis: avid sodium retention without volume depletion', () => {
    const r = at({ stenosisL: 0.8, stenosisR: 0.78 }, 0.5);
    expect(r.UNa).toBeLessThan(20);
    expect(r.FENa).toBeLessThan(1);
    // the patient is not dry — extracellular volume is normal or high
    expect(r.ev.derived.ecfLiters).toBeGreaterThan(13.5);
  });

  test('advanced CKD: FENa exceeds 3% in a patient who is in sodium balance', () => {
    const c = at({ nephronFraction: 0.13 }, 1);
    expect(c.FENa).toBeGreaterThan(2);
    expect(c.naExc).toBeGreaterThan(100); // still excreting roughly the intake
    expect(c.ev.derived.ecfLiters).toBeLessThan(15.5);
  });

  test('in a steady state FENa only reports the diet, whatever the kidney', () => {
    const lowSalt = runToSteadyState(applyPatch(DEFAULT_PARAMS, { naIntake: 20 }), 40).ev;
    const highSalt = runToSteadyState(applyPatch(DEFAULT_PARAMS, { naIntake: 300 }), 40).ev;
    expect(lowSalt.derived.FENa).toBeLessThan(highSalt.derived.FENa);
    // and both are in balance: excretion has returned to intake
    expect(Math.abs(lowSalt.kidney.urine.exc.Na - 20)).toBeLessThan(12);
    expect(Math.abs(highSalt.kidney.urine.exc.Na - 300)).toBeLessThan(40);
  });
});

/**
 * Diuretics (Rose ch. 15). The chapter's central argument is that a diuretic's net effect is far
 * smaller than its peak, because the kidney defends the volume the drug removes — so these tests
 * are mostly about the compensation, not the natriuresis.
 */
describe('diuretics: potency, braking and sequential blockade (Rose ch. 15)', () => {
  const settled = runToSteadyState(applyPatch(DEFAULT_PARAMS, { naIntake: 150 }), 60).state.body;
  /** The instantaneous response, before body composition has changed: the peak of the dose. */
  const peak = (patch: ParamPatch) => {
    const p = applyPatch(DEFAULT_PARAMS, { naIntake: 150, ...patch });
    return evaluate(settled, p);
  };

  test('potency follows the site: loop > thiazide > K+-sparing (Rose Table 15-1)', () => {
    const loop = peak({ drugs: { furosemide: 1 } }).derived.FENa;
    const thiazide = peak({ drugs: { thiazide: 1 } }).derived.FENa;
    const amiloride = peak({ drugs: { amiloride: 1 } }).derived.FENa;
    expect(loop).toBeGreaterThan(thiazide);
    expect(thiazide).toBeGreaterThan(peak({}).derived.FENa);
    // the book's ceilings: loop up to 20-25%, thiazide 3-5%, K+-sparing 1-2%
    expect(loop).toBeGreaterThan(8);
    expect(loop).toBeLessThan(25);
    expect(amiloride).toBeLessThan(3);
  });

  test('acetazolamide is weak despite acting where most Na+ is reabsorbed', () => {
    // The loop reclaims most of the extra delivery, which is the whole point of Rose's argument
    // that the site of action does not by itself determine potency.
    const acz = peak({ drugs: { acetazolamide: 1 } });
    expect(acz.derived.FENa).toBeLessThan(peak({ drugs: { furosemide: 0.5 } }).derived.FENa);
    expect(acz.derived.FENa).toBeLessThan(3);
    // but it does produce a bicarbonate diuresis and an alkaline urine
    expect(acz.kidney.urine.exc.HCO3).toBeGreaterThan(5 * peak({}).kidney.urine.exc.HCO3);
  });

  test('the loop reclaims an increased proximal delivery (flow-dependent transport)', () => {
    const base = peak({});
    const acz = peak({ drugs: { acetazolamide: 1 } });
    const deliveredToLoop = (ev: ReturnType<typeof peak>) => ev.kidney.segments.ATL.in.Na;
    const reabsorbedInLoop = (ev: ReturnType<typeof peak>) => ev.kidney.segments.TAL.in.Na - ev.kidney.segments.TAL.out.Na;
    expect(deliveredToLoop(acz)).toBeGreaterThan(deliveredToLoop(base));
    expect(reabsorbedInLoop(acz)).toBeGreaterThan(reabsorbedInLoop(base));
  });

  test('sequential nephron blockade: adding a thiazide to a loop diuretic adds natriuresis', () => {
    const loop = peak({ drugs: { furosemide: 1 } }).derived.FENa;
    const both = peak({ drugs: { furosemide: 1, thiazide: 1 } }).derived.FENa;
    const all = peak({ drugs: { furosemide: 1, thiazide: 1, amiloride: 1 } }).derived.FENa;
    expect(both).toBeGreaterThan(loop);
    expect(all).toBeGreaterThan(both);
  });

  test('a loop diuretic blinds the macula densa, so renin rises although distal delivery is high', () => {
    const base = peak({});
    const loop = peak({ drugs: { furosemide: 0.9 } });
    expect(loop.kidney.mdDelivery).toBeGreaterThan(base.kidney.mdDelivery);
    expect(loop.kidney.maculaDensa).toBeLessThan(base.kidney.maculaDensa);
    expect(loop.reg.hormones.renin).toBeGreaterThan(2 * base.reg.hormones.renin);
  });

  /**
   * Rose Fig. 15-1: 40 mg of furosemide in a normal subject eating 270 mmol of Na+ a day gives a
   * brisk natriuresis for about six hours and then excretion below intake for the other eighteen,
   * so there is no net sodium loss over the day. The three ways out are salt restriction, twice
   * daily dosing, and a higher dose.
   */
  describe('Fig. 15-1: why a single daily dose produces no net loss on a high salt intake', () => {
    const netAt = (diet: number, doses: number, dose = 0.9) => {
      const base = runToSteadyState(applyPatch(DEFAULT_PARAMS, { naIntake: diet }), 60).state.body;
      const p = applyPatch(DEFAULT_PARAMS, { naIntake: diet, diureticDoses: doses, drugs: { furosemide: dose } });
      const r = simulate(p, 1, 0.021, base);
      return r.points[r.points.length - 1].naBalance;
    };

    test('once daily on 270 mmol/day: essentially no net sodium loss over 24 hours', () => {
      expect(Math.abs(netAt(270, 1))).toBeLessThan(60);
    });

    test('excretion falls below intake once the dose wears off', () => {
      const base = runToSteadyState(applyPatch(DEFAULT_PARAMS, { naIntake: 270 }), 60).state.body;
      const p = applyPatch(DEFAULT_PARAMS, { naIntake: 270, diureticDoses: 1, drugs: { furosemide: 0.9 } });
      const r = simulate(p, 1, 0.021, base);
      const mean = (a: number, b: number) => {
        const pts = r.points.filter((x) => x.day >= a && x.day < b);
        return pts.reduce((s, x) => s + x.urineNa, 0) / Math.max(pts.length, 1);
      };
      expect(mean(0, 0.25)).toBeGreaterThan(270); // the natriuresis
      expect(mean(0.25, 0.75)).toBeLessThan(270); // the retention that cancels it
    });

    test('restricting salt converts it into a real loss', () => {
      expect(netAt(40, 1)).toBeLessThan(netAt(270, 1) - 40);
    });

    test('twice daily dosing also converts it into a real loss', () => {
      expect(netAt(270, 2)).toBeLessThan(netAt(270, 1) - 30);
    });

    test('continuous exposure is not the same as a daily dose — the off-hours are the point', () => {
      expect(netAt(270, 0)).toBeLessThan(netAt(270, 1) - 100);
    });
  });
});

/**
 * Oedematous states (Rose ch. 16). The chapter's argument is that oedema needs two things — a
 * Starling change that favours filtration, and renal sodium retention — and that the retention is
 * usually an appropriate response to underfilling rather than the primary fault. The exception,
 * and the one that matters clinically, is nephrotic syndrome, where retention is primary.
 */
describe('oedematous states: underfilling, overfilling and compensation (Rose ch. 16)', () => {
  const at = (patch: ParamPatch, days = 45) => runToSteadyState(applyPatch(DEFAULT_PARAMS, { naIntake: 150, ...patch }), days).ev;
  const normal = at({});

  test('hypoalbuminaemia alone does not cause oedema', () => {
    // Rose ch. 16: interstitial oncotic pressure falls in parallel, so the transcapillary gradient
    // is largely preserved. This is the chapter's correction of a long-standing assumption.
    expect(at({ albumin: 2.5 }).derived.edemaLiters).toBeLessThan(0.5);
    expect(at({ albumin: 1.8 }).derived.edemaLiters).toBeLessThan(1.5);
    // and the gradient itself is what is preserved, not the plasma albumin
    expect(oncoticGradientRel(2.5)).toBeGreaterThan(0.8);
    expect(oncoticGradientRel(4.0)).toBeCloseTo(1, 2);
    // below the point where the interstitial reservoir is exhausted it does fall
    expect(oncoticGradientRel(1.2)).toBeLessThan(oncoticGradientRel(2.5));
  });

  test('acute hypoalbuminaemia is different: the interstitium has not adapted', () => {
    expect(oncoticGradientRel(2.0, false)).toBeLessThan(oncoticGradientRel(2.0, true));
  });

  test('underfilling: heart failure retains sodium with a high renin and aldosterone', () => {
    const hf = at({ cardiacFunction: 0.45 });
    expect(hf.derived.ecfLiters).toBeGreaterThan(normal.derived.ecfLiters + 5);
    expect(hf.derived.edemaLiters).toBeGreaterThan(2);
    expect(hf.reg.hormones.renin).toBeGreaterThan(3 * normal.reg.hormones.renin);
    expect(hf.reg.hormones.aldo).toBeGreaterThan(3 * normal.reg.hormones.aldo);
    expect(hf.kidney.urine.exc.Na).toBeLessThan(60); // still not in balance
  });

  test('overfilling: nephrotic syndrome retains sodium with renin suppressed', () => {
    // The distinguishing signature. Rose: remission of minimal change disease raises sodium
    // excretion and clears oedema before the plasma albumin has changed, so the retention is
    // primary and renal, not a response to underfilling.
    const neph = at({ albumin: 2.2, proteinuria: 10 });
    expect(neph.derived.ecfLiters).toBeGreaterThan(normal.derived.ecfLiters + 1);
    expect(neph.reg.hormones.renin).toBeLessThan(normal.reg.hormones.renin);
    expect(neph.reg.hormones.aldo).toBeLessThan(normal.reg.hormones.aldo);
    // plasma volume is defended, not depleted
    expect(neph.plasma.plasmaVolume).toBeGreaterThan(0.93 * normal.plasma.plasmaVolume);
  });

  test('remission clears the retention before albumin moves (Rose Fig. 16-4)', () => {
    const relapse = at({ albumin: 2.2, proteinuria: 10 });
    // proteinuria resolves, albumin has not yet recovered
    const remitting = at({ albumin: 2.2, proteinuria: 0 });
    expect(remitting.derived.ecfLiters).toBeLessThan(relapse.derived.ecfLiters);
    expect(remitting.derived.edemaLiters).toBeLessThan(relapse.derived.edemaLiters + 0.01);
  });

  test('cirrhosis behaves as volume-depleted despite a high cardiac output', () => {
    const cirr = at({ vasodilation: 0.55, portalHypertension: 0.9, albumin: 2.2 });
    expect(cirr.reg.hormones.renin).toBeGreaterThan(5 * normal.reg.hormones.renin);
    expect(cirr.reg.hormones.adh).toBeGreaterThan(normal.reg.hormones.adh);
    expect(cirr.kidney.urine.Na).toBeLessThan(25); // avid retention, Rose's < 25 mmol/L
    expect(cirr.reg.SVR).toBeLessThan(normal.reg.SVR); // the fall in resistance is the cause
  });

  /** Rose Fig. 16-5: thoracic IVC constriction. A new steady state within about a week. */
  describe('Fig. 16-5: the compensated state', () => {
    const settled = runToSteadyState(applyPatch(DEFAULT_PARAMS, { naIntake: 150 }), 60).state.body;
    const course = (cf: number) => simulate(applyPatch(DEFAULT_PARAMS, { naIntake: 150, cardiacFunction: cf }), 30, 0.1, settled).points;

    test('moderate impairment: renin, aldosterone and sodium excretion return to baseline', () => {
      const pts = course(0.72);
      const day0 = pts[1];
      const end = pts[pts.length - 1];
      expect(day0.renin).toBeGreaterThan(3); // the initial activation
      expect(day0.urineNa).toBeLessThan(40);
      expect(end.renin).toBeLessThan(2); // and its resolution
      expect(end.urineNa).toBeGreaterThan(0.85 * 150);
      expect(end.MAP).toBeGreaterThan(88);
    });

    test('it takes about a week, and leaves the volume expanded', () => {
      const pts = course(0.72);
      const balanced = pts.find((x) => x.urineNa > 0.85 * 150);
      expect(balanced).toBeDefined();
      expect(balanced!.day).toBeGreaterThan(2);
      expect(balanced!.day).toBeLessThan(12);
      expect(balanced!.ecf).toBeGreaterThan(pts[0].ecf + 1);
    });

    test('severe impairment does not compensate — retention continues', () => {
      const pts = course(0.45);
      const end = pts[pts.length - 1];
      expect(end.urineNa).toBeLessThan(0.6 * 150);
      expect(end.renin).toBeGreaterThan(2);
      expect(end.ecf).toBeGreaterThan(pts[0].ecf + 10);
    });

    test('the more severe the impairment, the more volume compensation costs', () => {
      const ecfAt = (cf: number) => at({ cardiacFunction: cf }).derived.ecfLiters;
      expect(ecfAt(0.8)).toBeLessThan(ecfAt(0.72));
      expect(ecfAt(0.72)).toBeLessThan(ecfAt(0.65));
      expect(ecfAt(0.65)).toBeLessThan(ecfAt(0.55));
    });
  });
});

/**
 * Hypovolaemic states (Rose ch. 14). What the kidney does about the volume is the same every time;
 * what differs is the composition of what was lost, and that is what the pages teach.
 */
describe('hypovolaemia: composition, azotaemia and replacement (Rose ch. 14)', () => {
  const settled = runToSteadyState(applyPatch(DEFAULT_PARAMS, { naIntake: 150 }), 60).state.body;
  const after = (patch: ParamPatch, days: number, from: typeof settled = settled) =>
    simulate(applyPatch(DEFAULT_PARAMS, { naIntake: 150, ...patch }), days, 0.05, from);

  test('each source leaves its own signature', () => {
    const vomiting = after({ vomiting: 1.5, waterIntake: 1, naIntake: 40 }, 3).final;
    const diarrhoea = after({ diarrhea: 2.5, waterIntake: 1, naIntake: 40 }, 3).final;
    // Sweating without water to drink: with thirst answered, the loss is simply drunk back and
    // the sodium barely moves (Rose ch. 24), so the scenario has to take the water away.
    const sweat = after({ insensible: 3.5, waterIntake: 1.2, thirstIntact: false }, 3).final;
    // vomiting: alkalosis; diarrhoea: normal-gap acidosis
    expect(vomiting.plasma.HCO3).toBeGreaterThan(30);
    expect(diarrhoea.plasma.HCO3).toBeLessThan(21);
    // Both waste potassium, but the plasma level tells the truth about it only in the alkalotic
    // one. Rose ch. 19: in diarrhoea the acidaemia moves K+ out of the cells, so the plasma
    // concentration is "still higher than it would have been in the absence of acidemia" and can
    // sit in the normal range on top of a large deficit. The store is where the loss shows.
    expect(vomiting.plasma.K).toBeLessThan(4);
    // Nearly a tenth of the body's potassium, mostly lost in the stool: the volume depletion of
    // diarrhoea makes the kidney conserve renal K+ avidly (low distal flow), so the deficit is
    // almost entirely enteral.
    expect(diarrhoea.body.kE).toBeLessThan(0.906 * settled.kE);
    expect(diarrhoea.plasma.K).toBeLessThan(4.2);
    // pure water loss raises the plasma sodium instead of lowering it
    expect(sweat.plasma.Na).toBeGreaterThan(143);
    // Such patients are hypovolaemic too, and conserve sodium: Rose ch. 24 gives the urine
    // sodium after water loss as generally below 25 mmol/L (against > 100 after sodium overload).
    expect(sweat.kidney.urine.Na).toBeLessThan(25);
    // and with water to drink, thirst prevents the negative balance altogether (Rose ch. 14)
    const sweatDrinking = after({ insensible: 3.5 }, 3).final;
    expect(sweatDrinking.plasma.Na).toBeLessThan(sweat.plasma.Na - 5);
    expect(diarrhoea.kidney.urine.Na).toBeLessThan(20);
  });

  test('third-spacing depletes the circulation without losing body sodium', () => {
    const third = after({ capillaryLeak: 0.5, naIntake: 60, waterIntake: 1.2 }, 3).final;
    expect(third.reg.hormones.renin).toBeGreaterThan(3);
    expect(third.kidney.urine.Na).toBeLessThan(25);
    // total extracellular volume is not reduced — the fluid is sequestered, not gone
    expect(third.derived.ecfLiters).toBeGreaterThan(13);
  });

  test('urea rises out of proportion to creatinine in moderate volume depletion', () => {
    // Rose ch. 13/14/16: reabsorption of urea is passive, so slow tubular flow and a concentrated
    // lumen drive more of it back. Creatinine, neither reabsorbed nor concentration-driven, only
    // follows the fall in filtration — which is why the ratio between them is informative.
    const ratio = (ev: ReturnType<typeof evaluate>) => (ev.body.bun / 2.8) / (ev.body.creat * 0.0884);
    const base = evaluate(settled, DEFAULT_PARAMS);
    const mild = after({ diarrhea: 1, waterIntake: 1, naIntake: 60 }, 4).final;
    expect(ratio(mild)).toBeGreaterThan(ratio(base) + 10);
    expect(mild.body.bun).toBeGreaterThan(base.body.bun);
  });

  test('compensation is complete at small deficits and fails at large ones', () => {
    const small = after({ diarrhea: 1, waterIntake: 1, naIntake: 60 }, 2).final;
    const large = after({ diarrhea: 5, waterIntake: 1, naIntake: 60 }, 4).final;
    expect(small.reg.MAP).toBeGreaterThan(90);
    expect(large.reg.MAP).toBeLessThan(88);
    expect(large.kidney.GFR).toBeLessThan(0.7 * small.kidney.GFR);
    expect(si_creat(large)).toBeGreaterThan(1.5 * si_creat(small));
  });

  test('saline restores extracellular volume and dextrose does not', () => {
    // The point of the replacement panel: sodium is what holds fluid extracellular.
    const ill = after({ diarrhea: 2.5, waterIntake: 1, naIntake: 40 }, 3).state.body;
    const withSaline = after({ diarrhea: 2.5, waterIntake: 1, naIntake: 40, ivNS: 3 }, 3, ill).final;
    const withDextrose = after({ diarrhea: 2.5, waterIntake: 1, naIntake: 40, ivD5W: 3 }, 3, ill).final;
    expect(withSaline.derived.ecfLiters).toBeGreaterThan(withDextrose.derived.ecfLiters + 1.5);
    // and the kidney knows: renin falls with saline and stays up with dextrose
    expect(withSaline.reg.hormones.renin).toBeLessThan(withDextrose.reg.hormones.renin);
    // dextrose dilutes instead
    expect(withDextrose.plasma.Na).toBeLessThan(withSaline.plasma.Na);
  });
});

function si_creat(ev: ReturnType<typeof evaluate>) {
  return ev.body.creat * 88.4;
}

/**
 * Metabolic alkalosis (Rose ch. 18). The chapter's spine is that generation and maintenance are
 * separate problems: the kidney can excrete an enormous bicarbonate load, so an alkalosis only
 * persists if something is stopping it. These tests are mostly about the maintenance factor.
 */
describe('metabolic alkalosis: generation, maintenance and correction (Rose ch. 18)', () => {
  const settled = runToSteadyState(applyPatch(DEFAULT_PARAMS, { naIntake: 150 }), 60);
  const run = (patch: ParamPatch, days: number, from = settled.state.body) => simulate(applyPatch(DEFAULT_PARAMS, { naIntake: 150, ...patch }), days, 0.1, from);

  test('a chloride-replete kidney excretes a large alkali load instead of becoming alkalotic', () => {
    // Rose: normal subjects given 1000 mmol/day of NaHCO3 for two weeks excrete nearly all of it.
    const day1 = run({ drugs: { sodiumBicarbonate: 1000 } }, 1).final;
    const day14 = run({ drugs: { sodiumBicarbonate: 1000 } }, 14).final;
    expect(day14.kidney.urine.exc.HCO3).toBeGreaterThan(300);
    expect(day14.kidney.urine.pH).toBeGreaterThan(7.5);
    // and it plateaus rather than climbing: the kidney has found its new balance
    expect(Math.abs(day14.plasma.HCO3 - day1.plasma.HCO3)).toBeLessThan(2);
  });

  test('vomiting: alkalosis with a paradoxically acid urine and no urinary chloride', () => {
    // A patient who is vomiting is not eating, which is what allows chloride to fall.
    const v = run({ naIntake: 20, vomiting: 1.2, waterIntake: 2 }, 3).final;
    expect(v.plasma.HCO3).toBeGreaterThan(38);
    expect(v.plasma.pH).toBeGreaterThan(7.5);
    expect(v.plasma.Cl).toBeLessThan(95);
    // the paradox: alkalaemic blood, acid urine
    expect(v.kidney.urine.pH).toBeLessThan(6.2);
    expect(v.kidney.urine.Cl).toBeLessThan(5);
    expect(v.kidney.FE.HCO3 * 100).toBeLessThan(0.2);
  });

  test('chloride, not volume, is what maintains it', () => {
    // Rose's decisive comparison: a non-sodium chloride salt corrects the alkalosis without
    // restoring volume, while giving volume without chloride does not correct it at all.
    const sick = run({ naIntake: 20, vomiting: 1.2, waterIntake: 2 }, 3);
    const after = (patch: ParamPatch) => run({ naIntake: 20, waterIntake: 2, ...patch }, 4, sick.state.body).final;
    const untreated = after({});
    const withKCl = after({ drugs: { potassiumChloride: 120 } });
    const withWater = after({ ivD5W: 2 });

    // potassium chloride corrects it
    expect(withKCl.plasma.HCO3).toBeLessThan(untreated.plasma.HCO3 - 6);
    expect(withKCl.kidney.urine.Cl).toBeGreaterThan(40);
    // without restoring the volume
    expect(withKCl.derived.ecfLiters).toBeLessThan(untreated.derived.ecfLiters + 1);
    // while free water restores volume and leaves the alkalosis untouched
    expect(withWater.derived.ecfLiters).toBeGreaterThan(withKCl.derived.ecfLiters);
    expect(withWater.plasma.HCO3).toBeGreaterThan(withKCl.plasma.HCO3 + 5);
    expect(withWater.kidney.urine.pH).toBeLessThan(6.5); // still avidly reclaiming
  });

  test('saline corrects it, and the urine turns alkaline as it does', () => {
    const sick = run({ naIntake: 20, vomiting: 1.2, waterIntake: 2 }, 3);
    const treated = run({ naIntake: 20, waterIntake: 2, ivNS: 2 }, 4, sick.state.body).final;
    expect(treated.plasma.HCO3).toBeLessThan(sick.final.plasma.HCO3 - 10);
    expect(treated.plasma.Cl).toBeGreaterThan(sick.final.plasma.Cl + 10);
    expect(treated.kidney.urine.Cl).toBeGreaterThan(40);
  });

  test('in mineralocorticoid excess it is potassium, not volume, that maintains it', () => {
    // Aldosterone escape prevents the volume expansion, so the alkalosis is held up by the
    // hypokalaemia — and replacing potassium corrects it.
    const aldo = run({ aldoAutonomous: 4 }, 14).final;
    const aldoKCl = run({ aldoAutonomous: 4, drugs: { potassiumChloride: 120 } }, 14).final;
    expect(aldo.plasma.K).toBeLessThan(3.4);
    expect(aldo.plasma.HCO3).toBeGreaterThan(settled.ev.plasma.HCO3 + 1);
    expect(aldoKCl.plasma.K).toBeGreaterThan(aldo.plasma.K + 0.4);
    expect(aldoKCl.plasma.HCO3).toBeLessThan(aldo.plasma.HCO3 - 0.8);
  });

  test('respiratory compensation raises the PCO2, and can exceed 45 mmHg', () => {
    const v = run({ naIntake: 20, vomiting: 1.2, waterIntake: 2 }, 3).final;
    expect(v.plasma.PCO2).toBeGreaterThan(45);
    // Rose: about 0.7 mmHg per 1 mmol/L, so the pH is only partly protected
    expect(v.plasma.pH).toBeGreaterThan(7.45);
  });
});

/**
 * Metabolic acidosis, and the two disorders that are diagnosed by what is in the urine rather
 * than by what is in the blood (Rose ch. 19-21).
 */
describe('metabolic acidosis: the anion gaps (Rose ch. 19)', () => {
  const settledBody = runToSteadyState(DEFAULT_PARAMS, 60).state.body;
  const at = (patch: ParamPatch = {}, days = 40) => runToSteadyState(applyPatch(DEFAULT_PARAMS, patch), days, 1).ev;
  const acuteDays = (patch: ParamPatch, days: number) => simulate(applyPatch(DEFAULT_PARAMS, patch), days, 0.02, settledBody);

  test('respiratory compensation follows the 1.2 rule down to its floor', () => {
    // Rose ch. 19: the PCO2 falls 1.2 mmHg for every 1 mmol/L fall in bicarbonate, to a floor of
    // 10-15 mmHg. The slope is a property of the ventilatory reflex, not a formula in the model.
    for (const load of [40, 80, 150]) {
      const e = at({ extraAcid: load });
      const slope = (40 - e.plasma.PCO2) / (24 - e.plasma.HCO3);
      expect(slope).toBeGreaterThan(1.0);
      expect(slope).toBeLessThan(1.45);
    }
    expect(at({ extraAcid: 250 }).plasma.PCO2).toBeLessThan(16);
  });

  test('the urine anion gap separates a renal acidosis from a gut one (Fig. 19-1)', () => {
    // Batlle 1988 / Rose Fig. 19-1: with acidification intact, ammonium (and the chloride that
    // leaves with it) rises until Na + K − Cl is strongly negative. When ammonium excretion is
    // the defect, the urine anion gap keeps its normal positive value however acidaemic the
    // patient is.
    const normal = at();
    expect(normal.derived.urineAnionGap).toBeGreaterThan(0);

    const acidLoad = at({ extraAcid: 150 });
    expect(acidLoad.kidney.urine.exc.NH4).toBeGreaterThan(120);
    expect(acidLoad.derived.urineAnionGap).toBeLessThan(-20);

    const diarrhoea = at({ diarrhea: 3 });
    expect(diarrhoea.plasma.HCO3).toBeLessThan(18);
    expect(diarrhoea.derived.urineAnionGap).toBeLessThan(-20);

    for (const renal of [at({ transporters: { HATPase: 0.15 } }), at({ aldoSynthesis: 0 }), at({ nephronFraction: 0.2 })]) {
      expect(renal.plasma.HCO3).toBeLessThan(20);
      expect(renal.kidney.urine.exc.NH4).toBeLessThan(40);
      expect(renal.derived.urineAnionGap).toBeGreaterThan(0);
    }
  });

  test('ammonium excretion can rise five-fold, titratable acidity cannot', () => {
    // Rose ch. 19: NH4+ excretion can exceed 250 mmol/day, while titratable acidity is capped by
    // the filtered phosphate, which does not change. This is why ammonium is the adaptive term.
    const n = at();
    const loaded = at({ extraAcid: 250 });
    expect(loaded.kidney.urine.exc.NH4 / n.kidney.urine.exc.NH4).toBeGreaterThan(3);
    expect(loaded.kidney.urine.exc.TA / Math.max(n.kidney.urine.exc.TA, 0.1)).toBeLessThan(2.5);
  });

  test('an organic acidosis raises the gap and resolves when the anion is metabolised', () => {
    // Rose ch. 19: the anion stays extracellular while much of the H+ is buffered in cells, so
    // the Δ gap / Δ bicarbonate ratio sits between 1 and 2; and metabolism of the anion
    // regenerates the bicarbonate, which is why lactic acidosis corrects itself once perfusion
    // is restored, and why giving alkali for it risks an overshoot (Case 19-2).
    const sick = acuteDays({ lacticAcid: 8 }, 1);
    expect(sick.final.plasma.HCO3).toBeLessThan(16);
    expect(sick.final.plasma.deltaRatio).toBeGreaterThan(1);
    expect(sick.final.plasma.deltaRatio).toBeLessThan(2);
    expect(sick.final.body.organicAnions).toBeGreaterThan(8);

    const recovered = simulate(DEFAULT_PARAMS, 3, 0.02, sick.state.body).final;
    expect(recovered.body.organicAnions).toBeLessThan(1);
    expect(recovered.plasma.HCO3).toBeGreaterThan(22);
  });

  test('renal failure retains the acid and its anion; tubular acidosis retains only the acid', () => {
    // Rose ch. 19 ("Anion gap in renal failure"): sulfate needs filtration to be excreted, so it
    // is retained when the GFR falls but not when the defect is tubular.
    const uraemic = at({ nephronFraction: 0.2 });
    const proximal = at({ transporters: { NBCe1: 0.25 } });
    // The gap is clearly raised, but only moderately: the model keeps some titratable-acid
    // (phosphate) excretion at this GFR, so part of the uraemic acidosis is normal-gap, as Rose
    // describes (ch. 19 — the picture is mixed and depends on how much tubular function is lost).
    expect(uraemic.plasma.anionGap).toBeGreaterThan(uraemic.plasma.normalAnionGap + 4.5);
    expect(proximal.plasma.anionGap).toBeLessThan(proximal.plasma.normalAnionGap + 3);
    expect(proximal.plasma.Cl).toBeGreaterThan(110);
  });

  test('the three renal tubular acidoses separate on urine pH and plasma potassium (Table 19-6)', () => {
    const distal = at({ transporters: { HATPase: 0.15 } });
    const proximal = at({ transporters: { NBCe1: 0.25 } });
    const type4 = at({ aldoSynthesis: 0 });
    // type 1: cannot lower the urine pH however acidaemic
    expect(distal.kidney.urine.pH).toBeGreaterThan(5.3);
    expect(distal.plasma.HCO3).toBeLessThan(14);
    // type 2: self-limiting — the bicarbonate settles where the reduced threshold is, 14-20, well
    // above the level a distal defect reaches, because the distal nephron mops up what escapes
    expect(proximal.plasma.HCO3).toBeGreaterThan(14);
    expect(proximal.plasma.HCO3).toBeLessThan(20);
    // type 4: hyperkalaemic, the acidosis stays mild, and the urine can still be acidified —
    // the defect is ammonium production, not acidification (Rose Table 19-6)
    expect(type4.plasma.K).toBeGreaterThan(5.5);
    expect(type4.plasma.HCO3).toBeGreaterThan(15);
    expect(type4.kidney.urine.pH).toBeLessThan(5.3);
    // and a normal subject under the same acid load goes below 5.3, which is what makes the
    // distal defect visible at all
    expect(at({ extraAcid: 150 }).kidney.urine.pH).toBeLessThan(5.3);
  });

  test('bicarbonate titration separates type 2 from type 1 (Fig. 19-6)', () => {
    // Below the reduced threshold a proximal RTA reclaims everything and the urine is acid; above
    // it, bicarbonate pours out and the plasma level barely moves. A distal RTA has no threshold
    // defect, so the same alkali raises the plasma bicarbonate toward normal.
    const feHco3 = (e: ReturnType<typeof evaluate>) => e.kidney.urine.exc.HCO3 / Math.max((e.kidney.GFR * 1440 * e.plasma.HCO3) / 1000, 1);
    const proximalOff = at({ transporters: { NBCe1: 0.25 } });
    const proximalOn = at({ transporters: { NBCe1: 0.25 }, drugs: { sodiumBicarbonate: 400 } });
    const distalOn = at({ transporters: { HATPase: 0.15 }, drugs: { sodiumBicarbonate: 400 } });
    expect(proximalOff.kidney.urine.pH).toBeLessThan(7.2);
    expect(feHco3(proximalOff)).toBeLessThan(0.01);
    expect(feHco3(proximalOn)).toBeGreaterThan(0.07);
    expect(proximalOn.plasma.HCO3).toBeLessThan(proximalOff.plasma.HCO3 + 3);
    expect(distalOn.plasma.HCO3).toBeGreaterThan(at({ transporters: { HATPase: 0.15 } }).plasma.HCO3 + 8);
  });
});

describe('respiratory acid-base disorders (Rose ch. 20-21)', () => {
  const chronic = (offset: number) => runToSteadyState(applyPatch(DEFAULT_PARAMS, { paco2Offset: offset }), 40, 1).ev;
  const acute = (offset: number) => {
    const p = applyPatch(DEFAULT_PARAMS, { paco2Offset: offset });
    return simulate(p, 0.02, 0.01, initialBody(p)).final;
  };
  const per10 = (e: ReturnType<typeof evaluate>) => (e.plasma.HCO3 - 24) / ((e.plasma.PCO2 - 40) / 10);

  test('acute hypercapnia is buffered only by the cells (~1 mmol/L per 10 mmHg)', () => {
    for (const off of [20, 40, 60]) {
      const r = per10(acute(off));
      expect(r).toBeGreaterThan(0.4);
      expect(r).toBeLessThan(1.4);
    }
    expect(acute(40).plasma.pH).toBeLessThan(7.3);
  });

  test('chronic hypercapnia recruits the kidney and protects the pH', () => {
    // Rose ch. 20: roughly 3.5 mmol/L per 10 mmHg after 3-5 days, enough that a PCO2 of 80 leaves
    // the pH near 7.30 instead of 7.17. The model reaches 2.5-3.5, falling short at the extremes
    // because its acid-excretion feedback fades as the pH is restored.
    for (const off of [20, 40, 60]) {
      const r = per10(chronic(off));
      expect(r).toBeGreaterThan(2.2);
      expect(r).toBeLessThan(4.2);
      expect(chronic(off).plasma.pH).toBeGreaterThan(acute(off).plasma.pH);
    }
  });

  test('hypocapnia: cells first, then the kidney stops reclaiming bicarbonate', () => {
    // Rose ch. 21: about 2 mmol/L per 10 mmHg acutely, 4 mmol/L per 10 mmHg once renal acid
    // excretion has fallen, which is why chronic hypocapnia is so nearly pH-neutral.
    for (const off of [-12, -20]) {
      expect(per10(acute(off))).toBeGreaterThan(1.6);
      expect(per10(acute(off))).toBeLessThan(3.2);
      expect(per10(chronic(off))).toBeGreaterThan(3.5);
      expect(chronic(off).plasma.pH).toBeLessThan(acute(off).plasma.pH);
    }
    // and it never produces the bicarbonate of 10 or less that marks a metabolic acidosis
    expect(chronic(-24).plasma.HCO3).toBeGreaterThan(11);
  });
});

/**
 * Hyponatraemia (Rose ch. 22-23). Two questions: how did the water get retained, and why is it
 * still there. Almost everything diagnostic follows from the second.
 */
describe('hyponatraemia: water excretion and what limits it (Rose ch. 23)', () => {
  const settledBody = runToSteadyState(DEFAULT_PARAMS, 60).state.body;
  const at = (patch: ParamPatch, days = 25, dt = 0.5) => runToSteadyState(applyPatch(DEFAULT_PARAMS, patch), days, dt);
  const from = (body: typeof settledBody, patch: ParamPatch, days: number) => simulate(applyPatch(DEFAULT_PARAMS, patch), days, 0.05, body);

  test('a normal kidney excretes more than 10 L of water a day', () => {
    // Rose ch. 23: with ADH suppressed the urine osmolality falls to 40-100 mmol/kg and the
    // maximum water excretion exceeds 10 L/day, which is why hyponatraemia almost always means
    // a defect in water excretion rather than too much drinking.
    // Near the osmotic threshold the loop is so sensitive that a fraction of a mmol/L of sodium
    // moves the urine output by several litres, and the integrated model rings around its steady
    // state; the day-averaged values are the ones that mean anything.
    const r = simulate(applyPatch(DEFAULT_PARAMS, { waterIntake: 14 }), 4, 0.05, settledBody);
    const lastDay = r.points.filter((p) => p.day >= 3);
    const avg = (f: (p: (typeof lastDay)[number]) => number) => lastDay.reduce((s, p) => s + f(p), 0) / lastDay.length;
    expect(avg((p) => p.urineOsm)).toBeLessThan(110);
    expect(avg((p) => p.urineVolume)).toBeGreaterThan(10);
    expect(avg((p) => p.adh)).toBeLessThan(0.3);
    expect(avg((p) => p.Na)).toBeGreaterThan(135);
  });

  test('a water load is excreted within hours, not days', () => {
    const r = simulate(applyPatch(DEFAULT_PARAMS, { waterIntake: 20, thirstIntact: false }), 0.5, 0.01, settledBody);
    const at3h = r.points.find((p) => p.day >= 0.12);
    expect(at3h!.urineOsm).toBeLessThan(100);
    expect(at3h!.adh).toBeLessThan(0.2);
    expect(at3h!.urineVolume).toBeGreaterThan(12);
  });

  test('hypovolaemic hyponatraemia keeps its urine sodium low; SIADH does not', () => {
    // Rose Table 23-5: the urine sodium is under 25 mmol/L in effective volume depletion and
    // over 40 in SIADH, where sodium handling is intact and excretion equals intake.
    const hypo = at({ diarrhea: 2, waterIntake: 3, naIntake: 20 }, 8, 0.25).ev;
    expect(hypo.plasma.Na).toBeLessThan(134);
    expect(hypo.kidney.urine.Na).toBeLessThan(25);
    expect(hypo.kidney.urine.osm).toBeGreaterThan(300);

    const siadh = at({ adhAutonomous: 5, waterIntake: 1.35, naIntake: 100 }).ev;
    expect(siadh.plasma.Na).toBeLessThan(126);
    expect(siadh.kidney.urine.Na).toBeGreaterThan(40);
    expect(siadh.kidney.urine.osm).toBeGreaterThan(300);
    expect(siadh.body.edema).toBeLessThan(0.5); // volume regulation is intact, so no oedema
  });

  test('isotonic saline lowers the sodium in SIADH (Rose Table 23-9)', () => {
    // The steady-state effect of a fluid depends on its osmolality relative to the urine's, not
    // to the plasma's. With a urine osmolality above 1000, isotonic saline delivers 308 mmol of
    // solute that leaves in half a litre — so half the litre is retained as water.
    const base: ParamPatch = { adhAutonomous: 5, waterIntake: 1.35, naIntake: 100 };
    const sick = at(base);
    expect(sick.ev.kidney.urine.osm).toBeGreaterThan(900);
    const day1 = (patch: ParamPatch) => from(sick.state.body, { ...base, ...patch }, 2).points.find((p) => p.day >= 1)!.Na;
    const start = sick.ev.plasma.Na;

    expect(day1({ ivNS: 1 })).toBeLessThan(start - 1);
    // even hypertonic saline barely helps while the urine is this concentrated
    expect(day1({ ivHypertonic: 0.5 })).toBeLessThan(start + 1);
    // water restriction and a solute load both work, because both act on the water side
    expect(day1({ waterIntake: 0.6 })).toBeGreaterThan(start + 1);
    expect(day1({ naIntake: 300, proteinIntake: 160 })).toBeGreaterThan(start + 0.8);
  });

  test('the sodium-deficit formula over-predicts in SIADH', () => {
    // Rose is explicit that Eq. 23-3 applies only to sodium given without water: in SIADH the
    // administered sodium is excreted, and it is the water that leaves with it that raises the
    // plasma sodium. Giving nearly twice the calculated deficit moves it by under 1 mmol/L.
    const base: ParamPatch = { adhAutonomous: 5, waterIntake: 1.35, naIntake: 100 };
    const sick = at(base);
    const predicted = sick.state.body.tbw * 6; // mmol to raise the sodium by 6
    const given = 513; // 1 L of 3% saline
    expect(given).toBeGreaterThan(predicted * 1.5);
    const after = from(sick.state.body, { ...base, ivHypertonic: 1 }, 1).final;
    expect(after.plasma.Na - sick.ev.plasma.Na).toBeLessThan(2);
  });

  test('a loop diuretic washes out the medulla; a thiazide does not', () => {
    // Rose ch. 23: this is why thiazide-induced hyponatraemia is common and loop-induced
    // hyponatraemia is rare. The thiazide acts in the cortex and leaves ADH able to concentrate.
    const base: ParamPatch = { naIntake: 80, waterIntake: 2, adhAutonomous: 3 };
    const thiazide = from(settledBody, { ...base, drugs: { thiazide: 0.8 } }, 6).final;
    const loop = from(settledBody, { ...base, drugs: { furosemide: 0.8 } }, 6).final;
    expect(thiazide.kidney.urine.osm).toBeGreaterThan(loop.kidney.urine.osm * 1.5);
    expect(loop.kidney.urine.volumePerDay).toBeGreaterThan(thiazide.kidney.urine.volumePerDay * 1.5);
  });

  test('restricting water corrects polydipsia far faster than SIADH', () => {
    // Rose warns that water restriction alone can overcorrect in primary polydipsia, because ADH
    // is appropriately suppressed and the excess water leaves in a maximally dilute urine.
    const poly = at({ waterIntake: 19 }, 20);
    expect(poly.ev.kidney.urine.osm).toBeLessThan(100);
    // At 19 L/day the obligatory urinary K+ loss (urine [K+] cannot fall below ~5 meq/L, Rose
    // ch. 27) adds solute to the urine and limits how much water is retained, so the
    // hyponatraemia is mild; the point is that it corrects completely within a day.
    const polyFixed = from(poly.state.body, { waterIntake: 1.5 }, 2).points.find((p) => p.day >= 1)!;
    const polyRise = polyFixed.Na - poly.ev.plasma.Na;
    expect(poly.ev.plasma.Na).toBeLessThan(138);
    expect(polyFixed.Na).toBeGreaterThan(140);

    const siadh = at({ adhAutonomous: 5, waterIntake: 1.35, naIntake: 100 });
    const siadhFixed = from(siadh.state.body, { adhAutonomous: 5, waterIntake: 0.8, naIntake: 100 }, 2).points.find((p) => p.day >= 1)!;
    const siadhRise = siadhFixed.Na - siadh.ev.plasma.Na;
    expect(siadhRise).toBeLessThan(4);
    expect(siadhFixed.Na).toBeLessThan(135);
    expect(polyRise).toBeGreaterThan(2 * siadhRise);
  });

  test('arterial underfilling raises ADH where the pressure looks normal', () => {
    // Rose ch. 23: almost all hyponatraemic patients with advanced heart failure or cirrhosis
    // have raised ADH, and it is appropriate — the retained water is defending perfusion.
    const cirrhosis = at({ vasodilation: 0.5, portalHypertension: 0.7, albumin: 2.6, waterIntake: 2.5 }).ev;
    expect(cirrhosis.reg.MAP).toBeGreaterThan(85); // the pressure is not the signal
    expect(cirrhosis.kidney.urine.Na).toBeLessThan(25);
    expect(cirrhosis.kidney.urine.osm).toBeGreaterThan(400);
    expect(cirrhosis.body.edema).toBeGreaterThan(5);

    const failure = at({ cardiacFunction: 0.42, waterIntake: 2.5 }).ev;
    expect(failure.plasma.Na).toBeLessThan(136);
    expect(failure.kidney.urine.Na).toBeLessThan(25);
  });
});

describe('hypernatraemia and the diabetes insipidus states (Rose ch. 24)', () => {
  const at = (patch: ParamPatch, days = 14, dt = 0.25) => runToSteadyState(applyPatch(DEFAULT_PARAMS, patch), days, dt);

  test('central diabetes insipidus: a huge dilute urine, but thirst holds the sodium', () => {
    const di = at({ centralDI: 1 }).ev;
    expect(di.kidney.urine.volumePerDay).toBeGreaterThan(10);
    expect(di.kidney.urine.osm).toBeLessThan(120);
    expect(di.reg.hormones.adh).toBeLessThan(0.1);
  });

  test('take away access to water and the sodium climbs', () => {
    // Rose ch. 24: a plasma sodium above 150 is virtually never seen in an alert adult with a
    // normal thirst mechanism and access to water. Hypernatraemia is a thirst problem.
    const dry = at({ centralDI: 1, thirstIntact: false, waterIntake: 1.2 }, 6).ev;
    expect(dry.plasma.Na).toBeGreaterThan(155);
    expect(dry.plasma.effOsm).toBeGreaterThan(310);
  });

  test('nephrogenic diabetes insipidus: high ADH, dilute urine', () => {
    const ndi = at({ drugs: { lithium: 1 } }).ev;
    expect(ndi.kidney.urine.osm).toBeLessThan(200);
    expect(ndi.reg.hormones.adh).toBeGreaterThan(3); // resistance, not deficiency
    expect(ndi.plasma.Na).toBeGreaterThan(142);
  });

  test('desmopressin separates central from nephrogenic', () => {
    const central = at({ centralDI: 1, thirstIntact: false, waterIntake: 1.2 }, 6).ev;
    const centralTreated = at({ centralDI: 1, thirstIntact: false, waterIntake: 1.2, drugs: { desmopressin: 1 } }, 6).ev;
    const nephrogenic = at({ drugs: { lithium: 1 } }).ev;
    const nephrogenicTreated = at({ drugs: { lithium: 1, desmopressin: 1 } }).ev;
    expect(centralTreated.kidney.urine.osm).toBeGreaterThan(central.kidney.urine.osm * 3);
    expect(nephrogenicTreated.kidney.urine.osm).toBeLessThan(nephrogenic.kidney.urine.osm * 2);
  });

  test('with thirst intact the sodium is high-normal in DI and low-normal in primary polydipsia', () => {
    // Rose ch. 24: most patients with diabetes insipidus keep water balance because thirst matches
    // the urine output; the sodium sits at 140-145 in DI and 135-140 in primary polydipsia.
    const cdi = at({ centralDI: 1 }).ev;
    const ndi = at({ drugs: { lithium: 1 } }).ev;
    const polydipsia = at({ waterIntake: 12 }).ev;
    expect(cdi.kidney.urine.volumePerDay).toBeGreaterThan(12);
    for (const e of [cdi, ndi]) {
      expect(e.plasma.Na).toBeGreaterThan(140);
      expect(e.plasma.Na).toBeLessThan(146);
    }
    expect(polydipsia.plasma.Na).toBeGreaterThan(134);
    expect(polydipsia.plasma.Na).toBeLessThan(139);
  });

  describe('the water-restriction test (Fig. 24-6, Table 24-4)', () => {
    const run = (id: string) => waterDeprivationTest(DEPRIVATION_PATIENTS.find((p) => p.id === id)!.patch);
    const normal = run('normal');
    const cdi = run('cdi');
    const pcdi = run('pcdi');
    const ndi = run('ndi');
    const pndi = run('pndi');
    const polydipsia = run('polydipsia');

    test('normal: maximal concentration, and desmopressin adds nothing', () => {
      expect(normal.deprived.uosm).toBeGreaterThan(800);
      expect(normal.deprived.uflow).toBeLessThan(30); // < 0.5 mL/min
      expect(normal.riseWithDDAVP).toBeLessThan(10);
    });

    test('complete central DI: dilute urine, then a 100-800% rise with desmopressin', () => {
      expect(cdi.deprived.uosm).toBeLessThan(300);
      expect(cdi.riseWithDDAVP).toBeGreaterThan(100);
      expect(cdi.afterDDAVP.uflow).toBeLessThan(cdi.deprived.uflow / 3);
      // the stopping rules end restriction early, before the volume depletion Rose warns of
      expect(cdi.deprived.hour).toBeLessThanOrEqual(4);
      expect(cdi.deprived.weightLoss).toBeLessThan(5);
    });

    test('partial central DI: intermediate urine that desmopressin raises further', () => {
      expect(pcdi.deprived.uosm).toBeGreaterThan(300);
      expect(pcdi.deprived.uosm).toBeLessThan(800);
      expect(pcdi.riseWithDDAVP).toBeGreaterThan(15);
      expect(pcdi.afterDDAVP.uosm - pcdi.deprived.uosm).toBeGreaterThan(60);
    });

    test('nephrogenic DI: dilute urine that desmopressin cannot concentrate', () => {
      expect(ndi.deprived.uosm).toBeLessThan(300);
      expect(ndi.riseWithDDAVP).toBeLessThan(15);
      expect(ndi.afterDDAVP.uosm).toBeLessThan(250); // well below isosmotic
      expect(pndi.riseWithDDAVP).toBeLessThan(45);
    });

    test('primary polydipsia: a normal kidney once the water stops', () => {
      expect(polydipsia.samples[0].uosm).toBeLessThan(100);
      expect(polydipsia.deprived.uosm).toBeGreaterThan(800);
      expect(polydipsia.riseWithDDAVP).toBeLessThan(10);
      // it takes longer: the patient starts water-loaded
      expect(polydipsia.deprived.hour).toBeGreaterThan(cdi.deprived.hour);
    });
  });

  describe('correcting hypernatraemia (Rose ch. 24, treatment)', () => {
    const rx = (r: Partial<Regimen>) => hypernatraemiaCorrection({ cause: 'losses', d5w: 0, quarterSaline: 0, desmopressin: false, ...r });

    test('a measured amount of free water corrects within 12 mmol/L a day; twice as much does not', () => {
      const measured = rx({ d5w: 2.5 });
      expect(measured.startNa).toBeGreaterThan(163);
      expect(measured.worstDay).toBeLessThanOrEqual(12);
      expect(measured.points[measured.points.length - 1].na).toBeLessThan(146);
      expect(rx({ d5w: 5 }).worstDay).toBeGreaterThan(12);
    });

    test('central DI: without desmopressin the loss outruns the infusion; with it, too much water overshoots', () => {
      expect(rx({ cause: 'cdi', d5w: 2.5 }).outOfRange).toBeDefined();
      const overshoot = rx({ cause: 'cdi', d5w: 5, desmopressin: true });
      expect(overshoot.points[overshoot.points.length - 1].na).toBeLessThan(135);
    });
  });
});

/**
 * Hyperglycaemia (Rose ch. 25): translocation, the osmotic diuresis, the kidney as the brake on the
 * glucose, the potassium paradox and what insulin does to it.
 */
describe('hyperglycaemia: translocation, osmotic diuresis and the potassium paradox (Rose ch. 25)', () => {
  const settled = runToSteadyState(DEFAULT_PARAMS, 40);

  test('glucose draws water out of cells: the sodium falls within minutes and the ECF expands', () => {
    const before = evaluate(settled.state.body, DEFAULT_PARAMS);
    const after = evaluate(settled.state.body, applyPatch(DEFAULT_PARAMS, { glucose: 30 * 18 }));
    const perStep = (before.plasma.Na - after.plasma.Na) / ((30 - 95 / 18) / 5.6);
    // Katz's ideal osmometer gives 1.6 per 5.6 mmol/L; Hillier observed up to 2.4
    expect(perStep).toBeGreaterThan(1.4);
    expect(perStep).toBeLessThan(2.4);
    expect(after.plasma.ecf).toBeGreaterThan(before.plasma.ecf + 0.3);
    expect(after.plasma.effOsm).toBeGreaterThan(before.plasma.effOsm);
  });

  test('an osmotic diuresis: urine only modestly hyperosmotic, and its Na+ + K+ below the plasma', () => {
    const ev = runToSteadyState(applyPatch(DEFAULT_PARAMS, { glucose: 30 * 18 }), 30).ev;
    expect(ev.kidney.urine.volumePerDay).toBeGreaterThan(3);
    expect(ev.kidney.urine.osm).toBeGreaterThan(300);
    expect(ev.kidney.urine.osm).toBeLessThan(850);
    expect(ev.kidney.urine.Na + ev.kidney.urine.K).toBeLessThan(ev.plasma.Na + ev.plasma.K);
    // and without an acid, the anion gap stays normal
    expect(ev.plasma.anionGap).toBeLessThan(13);
  });

  test('without enough water, the osmotic diuresis raises the sodium (water lost in excess of Na+ + K+)', () => {
    const r = simulate(applyPatch(DEFAULT_PARAMS, { glucose: 30 * 18, thirstIntact: false, waterIntake: 1.5 }), 2, 0.05, settled.state.body).final;
    const translocated = evaluate(settled.state.body, applyPatch(DEFAULT_PARAMS, { glucose: 30 * 18 }));
    expect(r.plasma.Na).toBeGreaterThan(translocated.plasma.Na + 3);
  });

  test('insulin deficiency raises K+ modestly; pharmacological insulin lowers it by more', () => {
    const k = (insulin: number) => evaluate(settled.state.body, applyPatch(DEFAULT_PARAMS, { insulin })).plasma.K;
    const k0 = k(1);
    expect(k(0.1) - k0).toBeGreaterThan(0.3);
    expect(k(0.1) - k0).toBeLessThan(1.0);
    expect(k0 - k(3)).toBeGreaterThan(0.5);
  });

  const dka = hyperglycemicCrisis({ kind: 'dka', hours: 30 }).presentation;
  const hhs = hyperglycemicCrisis({ kind: 'hhs', hours: 120 }).presentation;
  const esrd = hyperglycemicCrisis({ kind: 'dialysis', hours: 18 }).presentation;

  test('ketoacidosis: glucose capped below 44 mmol/L by renal excretion; high-gap acidosis; K+ normal despite a deficit', () => {
    expect(dka.glucose).toBeLessThan(44);
    expect(dka.glucose).toBeGreaterThan(14);
    expect(dka.HCO3).toBeLessThan(15);
    expect(dka.anionGap).toBeGreaterThan(18);
    expect(dka.K).toBeGreaterThan(4.0);
    expect(dka.kDeficit / 70).toBeGreaterThan(2);
    expect(dka.kDeficit / 70).toBeLessThan(10);
  });

  test('non-ketotic hyperglycaemia: higher glucose and osmolality at a lower GFR, and no acidosis', () => {
    expect(hhs.glucose).toBeGreaterThan(dka.glucose);
    expect(hhs.effOsm).toBeGreaterThan(dka.effOsm + 10);
    expect(hhs.ketones).toBeLessThan(1);
    expect(hhs.HCO3).toBeGreaterThan(18);
    expect(hhs.waterDeficit).toBeGreaterThan(dka.waterDeficit);
  });

  test('on dialysis: very high glucose, diluted sodium, no dehydration, and hyperkalaemia', () => {
    expect(esrd.glucose).toBeGreaterThan(45);
    expect(esrd.Na).toBeLessThan(125);
    expect(esrd.effOsm).toBeLessThan(300);
    expect(esrd.waterDeficit).toBeLessThan(0.5);
    expect(esrd.K).toBeGreaterThan(5.8);
  });

  const rx: Rx = { bolusRate: 1, later: 'half', laterRate: 0.25, insulin: true, kcl: 30, kBelow: 5.0, bicarbonate: false };

  test('insulin unmasks the potassium deficit; the gap closes as ketoacid anions regenerate bicarbonate', () => {
    const t = treatCrisis({ kind: 'dka', hours: 30 }, rx).points;
    const minK = Math.min(...t.map((p) => p.K));
    expect(minK).toBeLessThan(t[0].K - 0.7);
    const closed = t.find((p) => p.hour > 0 && p.anionGap <= 14 && p.HCO3 >= 15);
    expect(closed).toBeDefined();
    expect(closed!.hour).toBeLessThan(18);
    const noK = treatCrisis({ kind: 'dka', hours: 30 }, { ...rx, kcl: 0 }).points;
    expect(Math.min(...noK.map((p) => p.K))).toBeLessThan(minK);
  });

  test('without insulin the ketoacidosis continues whatever fluid is given', () => {
    // Rose also expects saline alone to lower the glucose by 2-4 mmol/L/h, by dilution and by
    // restoring the GFR. The model does not reproduce the second part: its GFR is better defended
    // in volume depletion than a patient's, so there is little filtration for saline to restore.
    const t = treatCrisis({ kind: 'dka', hours: 30 }, { ...rx, insulin: false }).points;
    const at12 = t.find((p) => p.hour === 12)!;
    expect(at12.HCO3).toBeLessThan(t[0].HCO3 + 1);
    expect(at12.anionGap).toBeGreaterThan(18);
  });
});
