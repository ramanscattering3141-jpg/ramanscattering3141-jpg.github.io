// Regulatory effectors as declarative response curves.
//
// Each effector is a product of named factor curves. Keeping them declarative lets the UI
// show "what drives renin?" directly from the same numbers the simulator uses.

import { clamp } from './math';
import type { Hormones, Params } from './types';

export type Curve = (x: number) => number;

export const curves = {
  /** exp(k·(x − x0)) bounded to [lo, hi] */
  expo: (k: number, x0: number, lo: number, hi: number): Curve => (x) => clamp(Math.exp(k * (x - x0)), lo, hi),
  /** power law (x/x0)^n */
  power: (n: number, x0 = 1): Curve => (x) => Math.pow(Math.max(x, 1e-6) / x0, n),
  /** Hill saturation */
  hill: (k: number, n: number): Curve => (x) => {
    const xn = Math.pow(Math.max(0, x), n);
    return xn / (xn + Math.pow(k, n));
  },
};

export interface RegulationInput {
  params: Params;
  pvRel: number;
  Na: number;
  K: number;
  effOsm: number;
  Pi: number;
  ionizedCa: number;
  mdSignal: number;
  /** pressure drop across a renal artery stenosis for left & right kidney (mmHg) */
  stenosisDrop: [number, number];
  nephronFraction: number;
}

export interface RegulationState {
  MAP: number;
  CO: number;
  SVR: number;
  cbv: number;
  eabv: number;
  hormones: Hormones;
}

const MAP_REF = 93;

/** Cardiac output from central blood volume on a Frank–Starling-type curve (Rose Fig. 16-6). */
export function cardiacOutput(cardiacFunction: number, cbv: number) {
  // Below normal filling the curve is steep (stroke volume falls almost in proportion to
  // venous return); above it the curve flattens, which is why a failing heart gains little from
  // further volume expansion.
  // Above normal filling there is real preload reserve: in heart failure the rise in filling
  // pressure that follows renal Na+ retention raises output back toward normal, which is why
  // moderate failure reaches a compensated steady state (Rose ch. 8, Fig. 8-7).
  // Above normal filling there is real preload reserve, but it is limited: a normal circulation is
  // already near the flat part of the curve, which is why volume loading a healthy person raises
  // cardiac output and blood pressure only modestly and the extra salt is handled by pressure
  // natriuresis instead. A failing circulation sits lower on the same curve and so has more to
  // gain from the filling that sodium retention provides — the compensation of Rose Fig. 16-5.
  const reserve = 1.5 + 1.1 * clamp(1 - cardiacFunction, 0, 0.8);
  const filling = cbv >= 1 ? 1 + (reserve * (cbv - 1)) / (1 + (cbv - 1)) : Math.pow(Math.max(cbv, 0.05), 0.9);
  return clamp(cardiacFunction * filling, 0.05, 2);
}

/** Renin release from one kidney: baroreceptor × macula densa × β1 sympathetic (Rose ch. 2). */
export function reninRelease(p: Params, pressure: number, md: number, sns: number, at1: number, anp: number) {
  const nsaid = p.drugs.nsaid;
  const baro = Math.pow(curves.expo(-9, 1, 0.1, 20)(pressure / MAP_REF), 1 - 0.4 * nsaid);
  const macula = Math.pow(curves.expo(-3.6, 1, 0.15, 10)(md), 1 - 0.6 * nsaid);
  const beta1 = (0.4 + 0.6 * Math.pow(sns, 0.8)) * (1 - 0.5 * p.drugs.betaBlocker);
  const feedback = Math.pow(Math.max(at1, 0.05), -0.25);
  // The inputs are multiplied, so at their extremes they compound into values no adrenal or
  // juxtaglomerular apparatus could produce. Plasma renin activity in severe heart failure or
  // decompensated cirrhosis runs some ten to twenty times normal, not hundreds.
  return clamp(baro * macula * beta1 * feedback * Math.pow(anp, -0.2), 0.02, 20);
}

export function evaluateRegulation(inp: RegulationInput, prev?: RegulationState): RegulationState {
  const p = inp.params;
  const d = p.drugs;
  const cbv = clamp(inp.pvRel * (1 - 0.18 * p.portalHypertension) * (1 - 0.1 * p.capillaryLeak), 0.2, 2.5);
  const CO = cardiacOutput(p.cardiacFunction, cbv);
  const anp = clamp(Math.exp(1.8 * (cbv - 1)) * (1 + 1.5 * Math.max(0, 1 - p.cardiacFunction)), 0.3, 8);

  let MAP = prev?.MAP ?? MAP_REF;
  let sns = prev?.hormones.sns ?? 1;
  let at1 = prev?.hormones.at1 ?? 1;
  let adh = prev?.hormones.adh ?? 1.5;
  let out: RegulationState | undefined;

  let prevMap = 0;
  let prevAt1 = 0;
  let prevAdh = 0;
  for (let iter = 0; iter < 30; iter++) {
    // Arterial tone
    // Vasopressin is a vasoconstrictor at V1 receptors, but the pressor response saturates and
    // is largely buffered by the baroreflex, so even the very high levels of severe hypovolaemia
    // raise systemic resistance only modestly (Rose ch. 9).
    const v1 = 1 + 0.1 * (1 - Math.exp(-Math.max(0, adh - 4) / 12));
    // Whole-body autoregulation (Guyton): when volume expansion raises the cardiac output above
    // what the tissues need, their arterioles constrict, so a sustained rise in output becomes a
    // rise in resistance and pressure. This is the arm that makes pressure natriuresis the
    // final defence of the extracellular volume (Rose ch. 8).
    const tissueAutoregulation = CO > 1 ? Math.pow(CO, 1.6) : 1;
    // The reflexes defend arterial pressure without overshooting it: a modest volume loss leaves
    // pressure unchanged or slightly low even while renal Na+ retention is already brisk, which
    // is why salt restriction lowers blood pressure a little rather than raising it (Rose ch. 8).
    // The systemic vasoconstrictor gains are therefore smaller than the renal effects of the
    // same signals, which act on the tubule.
    const SVR =
      Math.pow(at1, 0.06) *
      Math.pow(sns, 0.16) *
      tissueAutoregulation *
      (1 - p.vasodilation) *
      (1 - 0.12 * d.ccb) *
      v1 *
      (0.8 + 0.2 * p.glucocorticoid);
    const mapNew = MAP_REF * CO * SVR;
    MAP = 0.5 * MAP + 0.5 * mapNew;
    // Baroreceptor signal ("effective arterial blood volume", Rose ch. 16)
    const eabv = clamp(MAP / MAP_REF, 0.2, 2);
    // Arterial baroreceptors plus the low-pressure cardiopulmonary receptors, which sense central
    // blood volume: sympathetic outflow to the kidney rises with volume depletion even before the
    // arterial pressure falls (Rose ch. 8).
    // Arterial baroreceptors reset within days when pressure stays high, so sustained
    // hypertension suppresses sympathetic outflow only a little; hypotension, by contrast,
    // drives it hard (Rose ch. 8).
    // In heart failure the high atrial pressures no longer restrain sympathetic outflow (the
    // cardiopulmonary reflex is blunted), so the arterial underfilling dominates and sympathetic
    // activity is raised despite the expanded volume (Rose ch. 8, 16).
    const cpInhibition = 0.5 * Math.pow(clamp(p.cardiacFunction, 0.2, 1), 3);
    const cardiopulmonary = cbv < 1 ? Math.exp(-2.5 * (cbv - 1)) : Math.exp(-cpInhibition * (cbv - 1));
    const arterial = eabv < 1 ? Math.exp(-3.2 * (eabv - 1)) : Math.exp(-1.0 * (eabv - 1));
    // Arterial underfilling that no pressure measurement shows. In cirrhosis the splanchnic bed
    // is dilated and holds a large share of the blood volume, so the arterial side is under-filled
    // while the mean pressure stays near normal — which is why these patients have high renin,
    // high noradrenaline and high ADH despite a grossly expanded total volume (Rose ch. 16, 23).
    // Heart failure reaches the same place by a different route, and is handled by the blunted
    // cardiopulmonary reflex above, so it is not counted again here.
    const splanchnicPooling = Math.exp(1.0 * clamp(p.vasodilation, 0, 0.7));
    const underfill = clamp(arterial * cardiopulmonary * splanchnicPooling, 0.4, 6);
    const snsNew = underfill * p.snsOverride;
    sns = 0.5 * sns + 0.5 * snsNew;

    // Renin–angiotensin–aldosterone
    const servo = (x: number) => (p.renalPressureClamp > 0 ? Math.min(x, p.renalPressureClamp) : x);
    const pL = servo(Math.max(10, MAP - inp.stenosisDrop[0]));
    const pR = servo(Math.max(10, MAP - inp.stenosisDrop[1]));
    const rL = reninRelease(p, pL, inp.mdSignal, sns, at1, anp);
    const rR = reninRelease(p, pR, inp.mdSignal, sns, at1, anp);
    const renin = Math.max(p.reninAutonomous, 0.5 * (rL + rR));
    const pra = renin * (1 - 0.9 * d.aliskiren);
    const angI = pra;
    // Chronic ACE inhibition is incomplete: chymase and other non-ACE pathways keep generating
    // some angiotensin II (the basis of "aldosterone breakthrough"), so AII falls by roughly
    // three-quarters rather than completely.
    const angII = angI * (0.97 * (1 - 0.78 * d.acei) + 0.03);
    const at1New = angII * (1 - 0.9 * d.arb);
    at1 = 0.5 * at1 + 0.5 * at1New;
    // Sustained angiotensin II also induces aldosterone synthase in the zona glomerulosa (about
    // ten-fold with chronic sodium restriction, Rose ch. 6), so the adrenal response to AII is
    // steeper than linear. This is what lets a low-salt diet raise aldosterone enough to
    // conserve Na+ without first having to raise the plasma K+ (Table 6-3).
    // Ceiling as for renin: the zona glomerulosa saturates. Plasma aldosterone in severe secondary
    // hyperaldosteronism reaches something like twenty to thirty times normal, not thousands.
    const aldoDriven = clamp(Math.pow(Math.max(at1, 0.02), 1.6) * clamp(Math.exp(0.8 * (inp.K - 4.2)), 0.25, 8) * Math.pow(anp, -0.2), 0.02, 25);
    const aldo = p.aldoSynthesis * Math.max(p.aldoAutonomous, aldoDriven);
    const mr = aldo * (1 - 0.9 * d.spironolactone) + d.fludrocortisone + 3 * p.cortisolMR;

    // Vasopressin: osmotic control with nonosmotic (baroreceptor) potentiation (Rose ch. 9)
    // The volume stimulus to ADH is insensitive: small losses that already raise renin and
    // noradrenaline barely change it, and it becomes powerful once arterial pressure falls
    // (Rose ch. 6, 9). The cardiopulmonary (low-pressure) input is therefore weighted weakly.
    const volSignal = Math.min(eabv, Math.pow(cbv, 0.3));
    // Non-osmotic release answers the same arterial underfilling the sympathetic nerves sense,
    // not the mean pressure alone. That distinction is what makes heart failure and cirrhosis
    // hyponatraemic: total volume is expanded and the pressure is often normal, yet the carotid
    // sinus reports underfilling, so ADH stays high and water is retained in the face of a
    // falling plasma sodium (Rose ch. 9, 16, 23). Perfusion is defended ahead of tonicity. The
    // two signals are combined by taking the larger rather than by adding, so an ordinary
    // hypovolaemia is not counted twice. The second term covers only the underfilling a pressure
    // reading does not show — splanchnic pooling in cirrhosis, a low cardiac output in heart
    // failure — because the pressure-driven part is already in the first.
    const occultUnderfill = splanchnicPooling * Math.exp(0.9 * clamp(1 - p.cardiacFunction, 0, 0.7));
    const deficit = Math.max(Math.max(0, 0.95 - volSignal), 0.1 * Math.max(0, occultUnderfill - 1.05));
    const threshold = 280 + p.osmostatShift - 25 * deficit;
    const slope = 0.38 * (1 + 3 * (deficit / 0.1));
    const adhOsm = slope * Math.max(0, inp.effOsm - threshold);
    const adhBaro = 0.6 * (Math.exp(8 * deficit) - 1);
    const adhOther = 4 * p.adhNonosmotic + 3 * (1 - p.glucocorticoid);
    const adhNew = Math.max(p.adhAutonomous, (1 - p.centralDI) * (adhOsm + adhBaro + adhOther));
    adh = 0.5 * adh + 0.5 * adhNew;

    // Collecting-duct V2 signalling -> aquaporin-2 insertion
    const v2Stim = adh + d.desmopressin;
    // Hypokalaemia down-regulates aquaporin-2: a modest, reversible concentrating defect
    // (maximal urine osmolality falls toward ~300–500), not complete diabetes insipidus.
    const kFactor = inp.K < 3.2 ? clamp(0.75 + 0.25 * (inp.K - 2.2), 0.6, 1) : 1;
    const caFactor = inp.ionizedCa > 1.4 ? clamp(1 - 1.2 * (inp.ionizedCa - 1.4), 0.4, 1) : 1;
    const aqp2 =
      p.transporters.AQP2 *
      p.transporters.V2R *
      (1 - 0.95 * d.tolvaptan) *
      (1 - 0.7 * d.lithium) *
      kFactor *
      caFactor *
      // The dose-response between plasma vasopressin and collecting-duct water permeability is
      // half-maximal near 2 pg/mL and close to maximal by 5 pg/mL (Rose ch. 9, Fig. 9-3):
      // a normally hydrated person sits on the steep part of this curve, which is why small
      // changes in plasma osmolality translate into large changes in urine osmolality.
      curves.hill(0.666, 1.4)(v2Stim) *
      1.12;

    // Renal vasodilator prostaglandins rise with vasoconstrictor activity (Rose ch. 2)
    const pg = (1 - d.nsaid) * (0.2 + 0.4 * (Math.max(0, at1 - 1) + Math.max(0, sns - 1)) + 0.2 * d.furosemide);

    // Mineral hormones (simple algebraic loop; full model in minerals.ts)
    const N = inp.nephronFraction;
    const fgf23 = clamp(Math.pow(inp.Pi / 1.1, 1.5) * Math.pow(N, -0.8), 0.2, 50);
    let pth = 1;
    let calcitriol = 1;
    for (let k = 0; k < 6; k++) {
      pth = clamp(Math.pow(1.2 / inp.ionizedCa, 6) * Math.pow(inp.Pi / 1.1, 0.5) * Math.pow(calcitriol, -0.3), 0.05, 30);
      calcitriol = clamp(Math.pow(N, 0.8) * Math.pow(pth, 0.5) * Math.pow(fgf23, -0.5) * Math.pow(inp.Pi / 1.1, -0.3), 0.05, 5);
    }
    if (p.pthMode === 'high') pth = 6;
    if (p.pthMode === 'low') pth = 0.1;

    // The loop is a damped fixed point; once it stops moving there is nothing more to gain, and
    // a steady-state run calls this many thousands of times.
    const settled = iter > 2 && Math.abs(MAP - prevMap) < 1e-4 && Math.abs(at1 - prevAt1) < 1e-5 && Math.abs(adh - prevAdh) < 1e-4;
    prevMap = MAP;
    prevAt1 = at1;
    prevAdh = adh;

    out = {
      MAP,
      CO,
      SVR,
      cbv,
      eabv,
      hormones: {
        renin: pra,
        angI,
        angII,
        at1,
        aldo,
        mr,
        adh,
        aqp2: clamp(aqp2, 0, 1),
        sns,
        anp,
        pg,
        pth,
        calcitriol,
        fgf23,
        insulin: p.insulin + d.insulinDrip,
      },
    };
    if (settled) break;
  }
  return out!;
}
