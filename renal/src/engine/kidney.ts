// Whole-kidney assembly: two kidneys, autoregulation + tubuloglomerular feedback, the nephron
// transport model, and the resulting urine.

import { clamp } from './math';
import { GLOM_REF, solveGlomerulus } from './glomerulus';
import { runNephron } from './nephron';
import type { Hormones, KidneyResult, KidneySide, Params, Plasma, Urine } from './types';

export interface KidneyInput {
  params: Params;
  plasma: Plasma;
  hormones: Hormones;
  MAP: number;
  /** urea appearance rate, mmol/min */
  ureaProduction: number;
  /** previous macula densa signal: seeds the fixed point so it converges in one or two passes */
  mdSeed?: number;
  /** potassium adaptation of the secreting cells (BodyState.kAdapt) */
  kAdapt?: number;
}

/**
 * Afferent resistance from the myogenic response, tubuloglomerular feedback, and the
 * vasoactive hormones. Efferent resistance is dominated by angiotensin II (Rose ch. 2:
 * the efferent arteriole has a smaller basal diameter, so the same stimulus raises its
 * resistance up to ~3x more than the afferent).
 */
export function arteriolarTone(p: Params, h: Hormones, perfusion: number, mdSignal: number) {
  const injuryTone = 1 + 0.8 * clamp(p.tubularInjury, 0, 1);
  const d = p.drugs;
  // Saturating response: a vasoactive signal cannot constrict or dilate an arteriole without
  // limit, so each factor is passed through a bounded function of its deviation from normal.
  const resp = (gain: number, x: number, lo: number, hi: number) => {
    const dev = x - 1;
    return clamp(1 + (gain * dev) / (1 + 0.45 * Math.abs(dev)), lo, hi);
  };
  // Myogenic response: the afferent arteriole constricts when stretched and relaxes when not, by
  // roughly the amount needed to hold renal blood flow constant. `ideal` is the afferent
  // resistance (relative to normal) that would keep flow exactly constant at this pressure; the
  // stretch response supplies most of it and tubuloglomerular feedback the rest. Dilation runs out
  // at about 70 mmHg, below which flow and filtration fall with pressure (Rose ch. 2, Fig. 2-8).
  const x = clamp(perfusion / 93, 0.25, 2.4);
  const idealAt = (r: number) => ((93 * r - GLOM_REF.Pv) / 1144 - (GLOM_REF.Re + GLOM_REF.Rpost)) / GLOM_REF.Ra;
  const ideal = idealAt(x) / idealAt(1);
  const myogenicRaw = clamp(1 + 0.85 * (ideal - 1), 0.45, 3.0);
  const myogenic = 1 + clamp(p.myogenic, 0, 1) * (myogenicRaw - 1);
  // Tubuloglomerular feedback constricts strongly when NaCl uptake at the macula densa rises;
  // the vasodilator limb when uptake falls is weaker (Rose ch. 2, Fig. 2-9).
  const mdDev = mdSignal - 1;
  const tgfGain = mdDev > 0 ? 0.42 : 0.16;
  const tgfRaw = clamp(1 + (tgfGain * mdDev) / (1 + 0.5 * Math.abs(mdDev)), 0.86, 1.9);
  const tgf = 1 + clamp(p.tgf, 0, 1) * (tgfRaw - 1);
  const sympathetic = resp(0.6, h.sns, 0.8, 2.6);
  const angioAfferent = resp(0.14, h.at1, 0.85, 1.8);
  const pgDilate = 1 - 0.25 * clamp(h.pg - 0.2, -0.2, 0.6);
  const ccb = 1 - 0.3 * d.ccb;
  const Ra = GLOM_REF.Ra * clamp(myogenic * tgf * sympathetic * angioAfferent * pgDilate * ccb * injuryTone * p.afferentTone, 0.3, 14);

  // The efferent arteriole has a smaller basal diameter, so angiotensin II raises its resistance
  // considerably more than the afferent's (Rose ch. 2).
  const angioEfferent = resp(0.4, h.at1, 0.55, 2.2);
  const efferentPg = 1 - 0.18 * clamp(h.pg - 0.2, -0.2, 0.6);
  const efferentSns = resp(0.12, h.sns, 0.9, 1.5);
  // A loop diuretic releases vasodilator prostaglandins within minutes of a dose; they relax the
  // efferent as well as the afferent arteriole, so renal plasma flow rises while GFR stays close
  // to normal and the filtration fraction falls - despite the renin rise and the loss of
  // tubuloglomerular feedback (Rose ch. 15). Abolished by an NSAID.
  const loopPg = 1 - 0.45 * clamp(d.furosemide, 0, 1) * (1 - clamp(d.nsaid, 0, 1));
  const Re = GLOM_REF.Re * clamp(angioEfferent * efferentPg * efferentSns * loopPg * p.efferentTone, 0.2, 8);
  return { Ra, Re };
}

function sideResult(
  p: Params,
  h: Hormones,
  pl: Plasma,
  MAP: number,
  stenosis: number,
  obstruction: number,
  /** this kidney's share of a normal nephron complement (0.5 = one normal kidney) */
  share: number,
  /** whole-body fraction of normal nephron mass, used for the hyperfiltration adaptation */
  massFraction: number,
  mdSignal: number,
): KidneySide {
  // A stenosis drops the pressure delivered to the glomeruli; flow-dependent so we use a
  // fixed-point on the resulting RBF.
  const stenosisDropHere = MAP * 0.62 * Math.pow(clamp(stenosis, 0, 0.95), 2.2);
  const servo = (x: number) => (p.renalPressureClamp > 0 ? Math.min(x, p.renalPressureClamp) : x);
  const { Ra, Re } = arteriolarTone(p, h, servo(Math.max(15, MAP - stenosisDropHere)), mdSignal);
  const nephrons = clamp(share, 0.01, 1);
  // Remnant-nephron adaptation: surviving nephrons hyperfiltrate through afferent dilation
  // (Brenner 1982, Hostetter 1981). Single-nephron GFR rises, so whole-kidney GFR falls less
  // than nephron mass does — adaptive at first, maladaptive in the long run.
  const adapt = clamp(Math.pow(clamp(massFraction, 0.02, 1), -0.32), 1, 3.4);
  // `nephrons` is this kidney's share of total nephron mass (0.5 = one normal kidney).
  // Conductance scales with nephron number: resistance 1/n, filtration surface area n.
  // Hyperfiltration in the remnant kidney is driven mainly by afferent vasodilation (higher
  // plasma flow and glomerular pressure), with a smaller rise in single-nephron surface area.
  const KfSide = GLOM_REF.Kf * nephrons * Math.sqrt(adapt) * p.kfFactor;
  const RaSide = Ra / (nephrons * Math.sqrt(adapt));
  const ReSide = Re / (nephrons * Math.sqrt(adapt) * 0.95);
  const RpostSide = GLOM_REF.Rpost / Math.max(nephrons, 0.05);
  // Obstruction raises Bowman's space pressure; chronic obstruction also loses surface area.
  // Bowman's space pressure: ~4 mmHg of downstream (interstitial and pelvic) pressure plus the
  // back-pressure of pushing filtrate down the tubule, ~6 mmHg at a normal single-nephron GFR.
  // Obstruction raises the downstream component (Rose ch. 2).
  const PbsBase = GLOM_REF.Pbs - 6 + 28 * obstruction;
  const PbsFlow = 6 / (130 * nephrons);
  const chronicLoss = p.obstructionChronic ? 1 - 0.45 * obstruction : 1;
  const stenosisDrop = MAP * 0.62 * Math.pow(clamp(stenosis, 0, 0.95), 2.2);
  const Pa = servo(Math.max(15, MAP - stenosisDrop));

  const g = solveGlomerulus({
    Pa,
    Pv: GLOM_REF.Pv + p.venousCongestion,
    Ra: RaSide,
    Re: ReSide,
    Rpost: RpostSide,
    Kf: KfSide * chronicLoss * (1 - 0.33 * clamp(p.tubularInjury, 0, 1)),
    Pbs: PbsBase,
    PbsFlow,
    // Plasma protein = albumin + globulins (~3 g/dL); both exert oncotic pressure. In
    // hypoalbuminaemia the fall in the effective oncotic pressure at the glomerulus is smaller than
    // the albumin fall alone: the liver raises globulin and lipoprotein synthesis, some protein is
    // filtered (raising the tubular fluid's oncotic pressure), and tubuloglomerular feedback brakes
    // the hyperfiltration. Represented by letting the oncotic albumin fall at half rate below
    // normal, so nephrotic hypoalbuminaemia gives a modest, not a doubled, single-nephron GFR.
    Cp: clamp((pl.albumin >= 4 ? pl.albumin : 4 - 0.5 * (4 - pl.albumin)) + 3.0, 2, 12),
    // Renal anaemia: erythropoietin production falls with functioning renal mass, so the
    // haematocrit falls as chronic kidney disease progresses (Rose ch. 1). This depends on
    // whole-body renal mass, not on this one kidney's share of it.
    Hct: clamp(0.45 * (1 - 0.35 * (1 - Math.pow(clamp(massFraction, 0.02, 1), 0.35))), 0.15, 0.52),
  });

  return {
    GFR: g.GFR,
    RPF: g.RPF,
    RBF: g.RBF,
    FF: g.FF,
    Pgc: g.Pgc,
    Pptc: g.Pptc,
    piEff: g.piEff,
    Pa,
    Ra: RaSide,
    Re: ReSide,
    Kf: KfSide * chronicLoss,
    Pbs: g.Pbs,
    nephrons,
    mdSignal,
    urineFlow: 0,
  };
}

export function runKidney(inp: KidneyInput): KidneyResult {
  const p = inp.params;
  const pl = inp.plasma;
  const h = inp.hormones;
  const nephronFraction = clamp(p.nephronFraction, 0.02, 1);

  // Both kidneys see the same blood and the same hormones, so unless one of them is stenosed
  // or obstructed the two solutions are identical and only one needs solving.
  const symmetric = p.stenosisL === p.stenosisR && p.obstructionL === p.obstructionR;
  const bothSides = (md: number): [KidneySide, KidneySide] => {
    const l = sideResult(p, h, pl, inp.MAP, p.stenosisL, p.obstructionL, nephronFraction * 0.5, nephronFraction, md);
    const r = symmetric ? { ...l } : sideResult(p, h, pl, inp.MAP, p.stenosisR, p.obstructionR, nephronFraction * 0.5, nephronFraction, md);
    return [l, r];
  };

  // Seeding the fixed point from the previous evaluation (the body changes only slightly between
  // sub-steps) turns a ~10-iteration solve into one or two, which is most of the cost of a run.
  let mdSignal = inp.mdSeed ?? 1;
  let [left, right] = bothSides(mdSignal);
  let nephron = runNephron({
    params: p,
    plasma: pl,
    hormones: h,
    GFR: 125,
    nephronFraction,
    FF: 0.2,
    Pptc: 20,
    piPtc: 30,
    vasaRecta: 1,
    perfusionPressure: inp.MAP,
    ureaProduction: inp.ureaProduction,
    kAdapt: inp.kAdapt,
  });

  // Fixed point: GFR -> macula densa Cl delivery -> afferent tone -> GFR.
  for (let i = 0; i < 14; i++) {
    [left, right] = bothSides(mdSignal);
    const GFR = left.GFR + right.GFR;
    const RPF = left.RPF + right.RPF;
    const RBF = left.RBF + right.RBF;
    const FF = RPF > 0 ? GFR / RPF : 0;
    const vasaRecta = clamp(RBF / 1100, 0.2, 2.2) * (1 + 0.3 * p.vasodilation);
    nephron = runNephron({
      params: p,
      plasma: pl,
      hormones: h,
      GFR,
      nephronFraction,
      FF,
      Pptc: 0.5 * (left.Pptc + right.Pptc),
      piPtc: 0.5 * (left.piEff + right.piEff),
      vasaRecta,
      perfusionPressure: 0.5 * (left.Pa + right.Pa),
      ureaProduction: inp.ureaProduction,
      nh4Supply: nephron.ammoniagenesis / 1440,
      kAdapt: inp.kAdapt,
    });
    const next = 0.55 * mdSignal + 0.45 * nephron.maculaDensa;
    if (Math.abs(next - mdSignal) < 1e-4) {
      mdSignal = next;
      break;
    }
    mdSignal = next;
  }

  const GFR = left.GFR + right.GFR;
  const RPF = left.RPF + right.RPF;
  const RBF = left.RBF + right.RBF;
  const FF = RPF > 0 ? GFR / RPF : 0;
  const u = nephron.urineOut;
  const flow = Math.max(u.water, 0.02); // mL/min
  left.urineFlow = flow * (left.GFR / Math.max(GFR, 1e-6));
  right.urineFlow = flow - left.urineFlow;

  const conc = (amount: number) => (amount / flow) * 1000; // mmol/min -> mmol/L
  const urineUrea = conc(u.urea);
  const urineNa = conc(u.Na);
  const urineK = conc(u.K);
  const urineCl = conc(u.Cl);
  const urineHCO3 = conc(u.HCO3);
  const urineNH4 = conc(u.NH4);
  const urinePi = conc(u.Pi);
  const urineOsm = clamp(
    urineNa + urineK + urineCl + urineHCO3 + urineUrea + urineNH4 + urinePi * 1.8 + conc(u.Ca) + conc(u.Mg) + (u.glucose / 180 / flow) * 1000,
    30,
    1400,
  );
  const perDay = (x: number) => x * 1440;
  const TAday = perDay(nephron.urineTA);
  const NH4day = perDay(u.NH4);
  const HCO3day = perDay(u.HCO3);
  const osmExcretion = (urineOsm * flow * 1440) / 1000; // mOsm/day
  const osmolarClearance = (urineOsm * flow) / Math.max(pl.osm, 1);
  const freeWaterClearance = flow - osmolarClearance;
  const electrolyteFreeWater = flow * (1 - (urineNa + urineK) / Math.max(pl.Na + pl.K, 1));

  const filteredNa = (GFR * pl.Na) / 1000;
  const filteredK = (GFR * pl.K) / 1000;
  const filteredCl = (GFR * pl.Cl) / 1000;
  const filteredHCO3 = (GFR * pl.HCO3) / 1000;
  const filteredUrea = (GFR * ((pl.BUN * 10) / 28)) / 1000;
  const filteredPi = (GFR * pl.Pi) / 1000;
  const filteredCa = (GFR * pl.Ca * 0.6) / 1000;
  const filteredMg = (GFR * pl.Mg * 0.75) / 1000;
  const filteredGlucose = (GFR * pl.glucose) / 100;
  const fe = (excreted: number, filtered: number) => (filtered > 1e-9 ? excreted / filtered : 0);

  const urine: Urine = {
    flow,
    volumePerDay: (flow * 1440) / 1000,
    osm: urineOsm,
    Na: urineNa,
    K: urineK,
    Cl: urineCl,
    HCO3: urineHCO3,
    urea: urineUrea,
    creat: (u.creat / flow) * 100,
    glucose: (u.glucose / flow) * 100,
    NH4: urineNH4,
    Pi: urinePi,
    Ca: conc(u.Ca),
    Mg: conc(u.Mg),
    pH: nephron.urinePH,
    TA: (nephron.urineTA / flow) * 1000,
    exc: {
      Na: perDay(u.Na),
      K: perDay(u.K),
      Cl: perDay(u.Cl),
      HCO3: HCO3day,
      urea: perDay(u.urea),
      creat: perDay(u.creat),
      glucose: (perDay(u.glucose) / 1000) * 1,
      NH4: NH4day,
      TA: TAday,
      NAE: TAday + NH4day - HCO3day,
      Pi: perDay(u.Pi),
      Ca: perDay(u.Ca),
      Mg: perDay(u.Mg),
      osm: osmExcretion,
      water: (flow * 1440) / 1000,
      electrolyteFreeWater: (electrolyteFreeWater * 1440) / 1000,
      freeWater: (freeWaterClearance * 1440) / 1000,
    },
  };

  return {
    GFR,
    RPF,
    RBF,
    FF,
    Pgc: 0.5 * (left.Pgc + right.Pgc),
    Pptc: 0.5 * (left.Pptc + right.Pptc),
    piPtc: 0.5 * (left.piEff + right.piEff),
    sides: [left, right],
    segments: nephron.segments,
    FE: {
      Na: fe(u.Na, filteredNa),
      K: fe(u.K, filteredK),
      Cl: fe(u.Cl, filteredCl),
      HCO3: fe(u.HCO3, filteredHCO3),
      urea: fe(u.urea, filteredUrea),
      Pi: fe(u.Pi, filteredPi),
      Ca: fe(u.Ca, filteredCa),
      Mg: fe(u.Mg, filteredMg),
      glucose: fe(u.glucose, filteredGlucose),
      urate: clamp(0.09 * Math.pow(clamp(nephron.ptReabsFraction / 0.6, 0.5, 1.5), -1.8), 0.01, 0.4),
    },
    urine,
    medullaTarget: nephron.medullaTarget,
    medullaOM: nephron.medullaOM,
    gNaCl: nephron.gNaCl,
    gUrea: nephron.gUrea,
    maculaDensa: nephron.maculaDensa,
    mdDelivery: nephron.mdDelivery,
    ammoniagenesis: nephron.ammoniagenesis,
    distalVoltage: nephron.distalVoltage,
    talVoltage: nephron.talVoltage,
    distalNaDelivery: nephron.distalNaDelivery,
    distalFlow: nephron.distalFlow,
    kSecretion: nephron.kSecretion,
    hSecretionDistal: nephron.hSecretionDistal,
    pendrinSecretion: nephron.pendrinSecretion,
    freeWaterClearance,
    osmolarClearance,
    creatSecretion: nephron.creatSecretion,
    creatClearance: (u.creat / Math.max(pl.creat, 0.05)) * 100,
    ureaClearance: (u.urea / Math.max(filteredUrea, 1e-9)) * GFR,
    singleNephronGFR: (GFR * 1e6) / Math.max(2.2e6 * nephronFraction, 1),
    vasaRectaFlow: clamp(RBF / 1100, 0.2, 2.2),
    glucoseReabsorbed: nephron.glucoseReabsorbed,
    glucoseTm: nephron.glucoseTm,
  };
}
