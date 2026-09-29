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
import { initialBody, edelmanNa, respiratoryPCO2, acidBase } from '../../renal/src/engine/body';

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
    // metabolic acidosis: PCO2 falls 1.2 mmHg per 1 mEq/L fall in HCO3
    const p = applyPatch(DEFAULT_PARAMS, {});
    expect(respiratoryPCO2(24, p)).toBeCloseTo(40, 5);
    expect(respiratoryPCO2(14, p)).toBeCloseTo(28, 0);
    // metabolic alkalosis: PCO2 rises 0.7 mmHg per 1 mEq/L rise
    expect(respiratoryPCO2(34, p)).toBeCloseTo(47, 0);
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
    expect(last.ecf).toBeGreaterThan(points[0].ecf + 0.5);
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
    expect(drop).toBeGreaterThan(0.8);
    expect(drop).toBeLessThan(3);
    expect(low.reg.hormones.aldo).toBeGreaterThan(2 * mid.reg.hormones.aldo);
    expect(low.kidney.urine.exc.Na).toBeLessThan(20);
    expect(low.body.hco3).toBeGreaterThan(22);
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

  test('most urinary K+ comes from regulated distal secretion', () => {
    expect(mid.kidney.kSecretion * 1440).toBeGreaterThan(0.5 * mid.kidney.urine.exc.K);
  });
});
