// Segmental tubular transport, the concentrating mechanism and renal acid handling.
//
// The model is a steady-state mass balance: each segment receives a load, reabsorbs or
// secretes according to its transporters and the local driving forces, and passes the rest on.
// Fractional reabsorptions are anchored to Rose ch. 1 Table 1-1/1-2 and ch. 3-5:
//   PT 55-60% of filtrate, ~90% HCO3, all glucose/amino acids, 80-85% Pi, ~80% Ca (with loop)
//   loop of Henle 15-25% of filtered NaCl, the diluting segment (NaCl without water)
//   DCT/CNT small NaCl, site of regulated Ca (PTH) and Mg transport
//   CNT/CCD principal cells: ENaC-driven Na uptake -> lumen-negative voltage -> K and H secretion
//   IMCD: final NaCl (urine Na can fall <1 mmol/L), ADH-dependent water and urea

import { clamp, saturable } from './math';
import type { Hormones, Params, Plasma, SegmentFlux, SegmentId, SoluteId } from './types';

const zero = (): Record<SoluteId, number> => ({
  Na: 0,
  K: 0,
  Cl: 0,
  HCO3: 0,
  glucose: 0,
  aa: 0,
  urea: 0,
  Pi: 0,
  Ca: 0,
  Mg: 0,
  creat: 0,
  NH4: 0,
  water: 0,
});

export interface NephronInput {
  params: Params;
  plasma: Plasma;
  hormones: Hormones;
  /** whole-kidney GFR (mL/min) and filtered fraction of nephrons */
  GFR: number;
  nephronFraction: number;
  /** peritubular capillary forces that set proximal reabsorption */
  FF: number;
  Pptc: number;
  piPtc: number;
  /** relative vasa recta blood flow (washout when high) */
  vasaRecta: number;
  /** mean renal perfusion pressure, mmHg (drives pressure natriuresis) */
  perfusionPressure: number;
  /** urea appearance from protein catabolism, mmol/min */
  ureaProduction: number;
  /** NH3 available to the collecting duct from proximal ammoniagenesis, mmol/min */
  nh4Supply?: number;
}

export interface NephronResult {
  segments: Record<SegmentId, SegmentFlux>;
  medullaTarget: number;
  medullaOM: number;
  gNaCl: number;
  gUrea: number;
  maculaDensa: number;
  /** chloride actually delivered past the macula densa, relative to normal */
  mdDelivery: number;
  distalNaDelivery: number;
  distalFlow: number;
  distalVoltage: number;
  talVoltage: number;
  kSecretion: number;
  hSecretionDistal: number;
  pendrinSecretion: number;
  ammoniagenesis: number;
  creatSecretion: number;
  glucoseReabsorbed: number;
  glucoseTm: number;
  ptReabsFraction: number;
  loopNaClFraction: number;
  urineOut: Record<SoluteId, number>;
  urinePH: number;
  urineTA: number;
  urineNH4: number;
  urineHCO3: number;
}

const PT_BASE = 0.63; // reference fractional proximal reabsorption before modulation
const MD_REF = 0.609; // normal macula densa NaCl uptake signal (dimensionless)
const MD_DELIVERY_REF = 1.09; // mmol/min of Cl delivered past the macula densa when normal

export function runNephron(inp: NephronInput): NephronResult {
  const p = inp.params;
  const t = p.transporters;
  const d = p.drugs;
  const h = inp.hormones;
  const pl = inp.plasma;
  const injury = clamp(p.tubularInjury, 0, 1);

  // ---------------------------------------------------------------- filtered loads
  const gfr = Math.max(inp.GFR, 0.01); // mL/min
  const f = zero();
  f.water = gfr;
  f.Na = (gfr * pl.Na) / 1000; // mmol/min
  f.K = (gfr * pl.K) / 1000;
  f.Cl = (gfr * pl.Cl) / 1000;
  f.HCO3 = (gfr * pl.HCO3) / 1000;
  f.urea = (gfr * ((pl.BUN * 10) / 28)) / 1000; // BUN mg/dL -> mmol/L urea
  f.glucose = (gfr * pl.glucose) / 100; // mg/min
  f.aa = (gfr * 2.5) / 1000;
  f.Pi = (gfr * pl.Pi) / 1000;
  f.Ca = (gfr * pl.Ca * 0.6) / 1000; // ~60% filterable (Rose ch. 3)
  f.Mg = (gfr * pl.Mg * 0.75) / 1000;
  f.creat = (gfr * pl.creat) / 100; // mg/min
  f.NH4 = 0;

  const segments = {} as Record<SegmentId, SegmentFlux>;
  const put = (id: SegmentId, i: Record<SoluteId, number>, o: Record<SoluteId, number>, osmOut: number) => {
    segments[id] = { in: { ...i }, out: { ...o }, osmOut };
  };

  // ---------------------------------------------------------------- proximal tubule
  // Glucose: SGLT2 (bulk, low affinity) then SGLT1 (high affinity). Tm ~375 mg/min at normal
  // nephron mass; "splay" from nephron heterogeneity gives a threshold of ~180-200 mg/dL.
  const tmGlucose = 375 * inp.nephronFraction * (1 - 0.5 * injury);
  const tm2 = tmGlucose * 0.92 * t.SGLT2 * (1 - 0.85 * d.sglt2i);
  const tm1 = tmGlucose * 0.08 * t.SGLT1;
  const g2 = saturable(f.glucose, tm2, 0.93);
  const g1 = saturable(f.glucose - g2, tm1, 0.93);
  const glucoseReabsorbed = g2 + g1;
  const glucoseOut = f.glucose - glucoseReabsorbed;
  const glucosuriaOsm = glucoseOut / 180; // mg/min -> mmol/min of osmotically active glucose

  // Amino acids, phosphate (PTH- and FGF23-sensitive), and proximal HCO3 reclamation.
  const aaReab = f.aa * clamp(0.99 * t.AAtransport * (1 - 0.6 * injury), 0, 1);
  const piCapacity =
    f.Pi *
    clamp(
      0.85 * t.NaPi2 * Math.pow(Math.max(h.pth, 0.05), -0.22) * Math.pow(Math.max(h.fgf23, 0.05), -0.12) * (1 - 0.5 * injury),
      0,
      0.98,
    );
  const piReab = Math.min(f.Pi, piCapacity * (pl.pH < 7.3 ? 0.85 : 1));

  // Proximal Na: Na-H exchange (angiotensin II, sympathetic) + cotransport with glucose/AA/Pi +
  // paracellular NaCl driven by the lumen-negative-to-positive Cl gradient.
  // Angiotensin II and renal nerves stimulate proximal NHE3 when they rise above normal, which is
  // a major part of Na+ retention in volume depletion. Suppressing them below normal does much
  // less: with renal perfusion pressure held constant, aldosterone escape fails even though
  // renin is suppressed (Hall 1984; Rose Fig. 8-9) — the escape is carried by pressure natriuresis.
  const lnAt1 = Math.log(Math.max(h.at1, 0.05));
  const lnSns = Math.log(Math.max(h.sns, 0.1));
  const at1Pt = lnAt1 > 0 ? 0.17 * lnAt1 : 0.04 * lnAt1;
  const snsPt = lnSns > 0 ? 0.08 * lnSns : 0.02 * lnSns;
  const nheActivity =
    t.NHE3 *
    clamp(1 + at1Pt + snsPt, 0.45, 1.5) *
    (1 - 0.75 * d.acetazolamide) *
    (1 - 0.6 * injury);
  const caActivity = t.CA * (1 - 0.9 * d.acetazolamide);
  const hco3Capacity = f.HCO3 * clamp(0.9 * nheActivity * Math.pow(caActivity, 0.6) * Math.pow(t.NBCe1, 0.8), 0, 0.95);
  // Volume depletion raises HCO3 reabsorptive capacity (no fixed Tm; Rose ch. 3 Fig. 3-11)
  const volumeFactor = clamp(Math.pow(Math.max(h.at1, 0.05), 0.1), 0.85, 1.25);
  const hco3ReabPT = Math.min(f.HCO3, hco3Capacity * volumeFactor);

  // Non-reabsorbable solute in the lumen (spilled glucose, infused mannitol) retains water and
  // lowers the luminal Na concentration, which reduces net proximal Na reabsorption.
  const mannitolLoad = (d.mannitol * 1000) / 182 / 1440; // g/day -> mmol/min filtered
  const nonReabsorbed = glucosuriaOsm + mannitolLoad;
  // A saturating brake: the first unreabsorbed osmoles matter most, and even a massive osmotic
  // load cannot abolish proximal reabsorption entirely.
  const ptOsmoticBrake = clamp(1 - 0.5 * (nonReabsorbed / (nonReabsorbed + 2.5)), 0.45, 1);
  const ptStarling = clamp(1 + 0.6 * (inp.FF - 0.2) + 0.004 * (20 - inp.Pptc), 0.75, 1.25);
  // Pressure natriuresis: a rise in renal perfusion pressure reduces proximal (and loop) Na
  // reabsorption, which is the dominant long-term controller of extracellular volume
  // (Rose ch. 8; it persists even when the renin and sympathetic systems are blocked).
  const pressureNatriuresis = clamp(1 - 1.15 * (inp.perfusionPressure / 93 - 1), 0.55, 1.5);
  const ptFraction = clamp(
    PT_BASE *
      nheActivity *
      ptStarling *
      ptOsmoticBrake *
      pressureNatriuresis *
      (1 - 0.18 * injury) *
      (1 + (lnAt1 > 0 ? 0.06 : 0.015) * lnAt1) *
      Math.pow(t.NaKATPase, 0.5),
    0.15,
    0.82,
  );
  const naReabPT = f.Na * ptFraction;
  // Water follows isosmotically (aquaporin-1); proximal fluid stays ~isosmotic to plasma.
  const waterPT = f.water * ptFraction * clamp(0.6 + 0.4 * t.AQP1, 0.4, 1) * ptOsmoticBrake;
  // Chloride: the early proximal tubule reabsorbs Na with HCO3, glucose and amino acids, so
  // water removal raises the luminal Cl concentration above plasma (TF/P Cl ~1.2-1.3,
  // Rose Fig. 3-1). That gradient then drives passive paracellular NaCl reabsorption.
  const targetClConc = pl.Cl * (1.12 + 0.22 * (hco3ReabPT / Math.max(f.HCO3, 1e-9)));
  const clReabPT = clamp(f.Cl - ((f.water - waterPT) * targetClConc) / 1000, f.Cl * 0.2, f.Cl * 0.8);
  const kReabPT = f.K * 0.70 * clamp(ptFraction / PT_BASE, 0.5, 1.3);
  const ureaReabPT = f.urea * 0.45 * clamp(ptFraction / PT_BASE, 0.4, 1.3);
  const caReabPT = f.Ca * 0.65 * clamp(ptFraction / PT_BASE, 0.4, 1.2);
  const mgReabPT = f.Mg * 0.25;

  // Ammoniagenesis from glutamine: stimulated by acidosis and hypokalemia, limited by nephron mass.
  const acidStim = clamp(Math.pow(24 / Math.max(pl.HCO3, 5), 1.6), 0.4, 6);
  const kStim = clamp(1 + 0.35 * (4.2 - pl.K), 0.6, 2.2);
  const ammoniagenesis =
    40 * acidStim * kStim * Math.pow(inp.nephronFraction, 0.85) * (1 - 0.5 * injury) * (pl.pH > 7.5 ? 0.5 : 1); // mmol/day
  const nh4Prod = ammoniagenesis / 1440; // mmol/min secreted into the proximal lumen

  // Creatinine secretion by the organic cation pathway (10-20% of excreted creatinine,
  // rising as GFR falls until the pump saturates; blocked by cimetidine/trimethoprim).
  const creatSecretion =
    f.creat *
    clamp(0.15 / Math.max(inp.nephronFraction, 0.1), 0.15, 0.55) *
    t.OCT2 *
    (1 - 0.7 * d.trimethoprim) *
    (1 - 0.5 * injury);

  const ptIn = { ...f };
  const ptOut = zero();
  ptOut.water = f.water - waterPT;
  ptOut.Na = f.Na - naReabPT;
  ptOut.K = f.K - kReabPT;
  ptOut.Cl = f.Cl - clReabPT;
  ptOut.HCO3 = f.HCO3 - hco3ReabPT;
  ptOut.glucose = glucoseOut;
  ptOut.aa = f.aa - aaReab;
  ptOut.urea = f.urea - ureaReabPT;
  ptOut.Pi = f.Pi - piReab;
  ptOut.Ca = f.Ca - caReabPT;
  ptOut.Mg = f.Mg - mgReabPT;
  ptOut.creat = f.creat + creatSecretion;
  ptOut.NH4 = nh4Prod;
  const osmOfLoad = (o: Record<SoluteId, number>) => {
    const solutes = o.Na + o.K + o.Cl + o.HCO3 + o.urea + o.Pi * 1.8 + o.Ca + o.Mg + o.NH4 + o.aa + o.glucose / 180;
    return o.water > 1e-6 ? (solutes / o.water) * 1000 : 0;
  };
  put('PT', ptIn, ptOut, osmOfLoad(ptOut));

  // ---------------------------------------------------------------- loop of Henle
  // The medullary gradient is generated by TAL NaCl reabsorption (countercurrent
  // multiplication) plus urea accumulation in the inner medulla; it is washed out by high
  // vasa recta flow and by high tubular flow.
  const nkcc =
    t.NKCC2 *
    (1 - 0.95 * d.furosemide) *
    Math.pow(clamp(t.ROMK, 0.05, 2), 0.35) *
    Math.pow(clamp(t.ClCKb, 0.05, 2), 0.35) *
    Math.pow(t.NaKATPase, 0.5) *
    (1 - 0.2 * injury) *
    clamp(1 + 0.08 * Math.log(Math.max(h.adh, 0.2)), 0.85, 1.25) *
    clamp(1 - 0.25 * (t.CaSR - 1), 0.5, 1.2);

  const loopLoadFactor = clamp(ptOut.water / (gfr * (1 - PT_BASE)), 0.3, 3);
  // Flow dependence: the loop reabsorbs a roughly constant fraction of what it receives.
  // Pressure natriuresis also acts in the loop: a higher renal perfusion pressure is transmitted
  // through the vasa recta to the medullary interstitium, which pushes fluid back into the
  // descending limb and blunts the rise in luminal NaCl that drives passive thin-limb NaCl
  // exit (Rose ch. 8). A fall in pressure does the reverse.
  const loopPressure = clamp(1 - 0.9 * (inp.perfusionPressure / 93 - 1), 0.7, 1.15);
  const loopNaFraction = clamp(
    0.75 * nkcc * loopPressure * (1 + 0.05 * Math.log(loopLoadFactor)) * clamp(1 + 0.07 * Math.log(Math.max(h.at1, 0.05)), 0.85, 1.2),
    0.05,
    0.92,
  );
  const dtlIn = { ...ptOut };
  // Descending limb: water abstracted into the hypertonic interstitium, solute largely retained.
  // Solved after the medullary gradient below; first pass uses the previous gradient estimate.
  let medullaTarget = 1200;
  let gNaCl = 0;
  let gUrea = 0;
  let dtlWaterOut = dtlIn.water;
  let loopOut = zero();
  let talOut = zero();
  let maculaDensa = 1;
  let mdDelivery = 1;
  let talVoltage = 1;

  // urea recycling: IMCD urea reabsorption feeds the inner medullary interstitium
  let imcdUreaReab = inp.ureaProduction * 0.4;

  for (let iter = 0; iter < 12; iter++) {
    // NaCl component of the gradient from TAL transport per unit flow
    gNaCl = clamp(
      300 *
        Math.pow(clamp(nkcc, 0, 2), 0.9) *
        Math.pow(clamp(2.0 / Math.max(inp.vasaRecta, 0.2), 0.3, 2.2), 0.45) *
        Math.pow(clamp(1.1 / loopLoadFactor, 0.3, 1.6), 0.35) *
        Math.pow(inp.nephronFraction, 0.25),
      20,
      900,
    );
    // urea component: accumulation depends on IMCD urea delivery/permeability and flow
    gUrea = clamp(
      190 * Math.pow(clamp(imcdUreaReab / 0.0165, 0.05, 3), 0.55) * Math.pow(clamp(t.UTA, 0.05, 2), 0.5) * Math.pow(clamp(1.6 / Math.max(inp.vasaRecta, 0.2), 0.3, 1.8), 0.4),
      10,
      800,
    );
    medullaTarget = clamp(290 + gNaCl + gUrea, 300, 1250);

    // Descending thin limb equilibrates with the interstitium (AQP1).
    const eqOsm = 290 + (medullaTarget - 290) * 0.85 * clamp(t.AQP1, 0.1, 1);
    const dtlSolute =
      dtlIn.Na + dtlIn.K + dtlIn.Cl + dtlIn.HCO3 + dtlIn.urea + dtlIn.Pi * 1.8 + dtlIn.Ca + dtlIn.Mg + dtlIn.NH4 + dtlIn.aa + dtlIn.glucose / 180;
    dtlWaterOut = clamp((dtlSolute / Math.max(eqOsm, 100)) * 1000, dtlIn.water * 0.18, dtlIn.water);

    // Thin ascending limb: water-impermeable, passive NaCl exit into the interstitium.
    // Urea recycling: most of the urea reabsorbed from the inner medullary collecting duct
    // re-enters the thin limbs (UT-A2 in the descending limb, and the thin ascending limb) and is
    // carried round again, so the urea leaving the loop can equal or exceed the filtered amount
    // (Rose ch. 4). The rest leaves the medulla in the vasa recta.
    const recycled = imcdUreaReab * 0.75;
    const dtlOut = { ...dtlIn, water: dtlWaterOut, urea: dtlIn.urea + 0.4 * recycled };
    const atlIn = { ...dtlOut };
    const atlOut = { ...atlIn, urea: atlIn.urea + 0.6 * recycled };
    const atlNaOut = Math.min(atlIn.Na * 0.22 * clamp(gNaCl / 600, 0.2, 1.5), atlIn.Cl * 0.45);
    atlOut.Na = atlIn.Na - atlNaOut;
    atlOut.Cl = atlIn.Cl - atlNaOut;
    // Ammonium is secreted into the loop and recycled in the medulla.
    atlOut.NH4 = atlIn.NH4 * 1.1;

    // Thick ascending limb: NKCC2 -> lumen-positive voltage -> paracellular Ca/Mg.
    // NaCl reabsorption here is limited three ways: by the fraction the segment normally takes,
    // by the chloride delivered (NKCC2 carries 2 Cl- per Na+, but the K+ recycles so net
    // transport is ~1:1 NaCl), and by an absolute transport capacity. The capacity limit is what
    // makes a high delivered load raise distal delivery instead of being fully reclaimed.
    const talNaWanted = atlOut.Na * clamp(loopNaFraction * 1.05, 0.02, 0.92);
    const talCapacity = 5.2 * clamp(inp.nephronFraction, 0.05, 1) * clamp(nkcc, 0, 1.6) * loopPressure;
    const talNaReab = Math.min(talNaWanted, atlOut.Cl * 0.93, talCapacity);
    talVoltage = clamp(nkcc * Math.pow(clamp(t.ROMK, 0.05, 2), 0.5), 0, 1.6);
    const caReabTAL = atlOut.Ca * clamp(0.68 * talVoltage * t.claudin16 * clamp(1 - 0.35 * (t.CaSR - 1), 0.4, 1.2), 0, 0.85);
    const mgReabTAL = atlOut.Mg * clamp(0.72 * talVoltage * t.claudin16 * clamp(1 - 0.4 * (t.CaSR - 1), 0.3, 1.2), 0, 0.9);
    // TAL also reabsorbs HCO3 (Na-H exchange) and NH4 on NKCC2 (the medullary recycling step).
    const hco3ReabTAL = atlOut.HCO3 * clamp(0.4 * nheActivity, 0, 0.7);
    const nh4ReabTAL = atlOut.NH4 * clamp(0.6 * nkcc, 0, 0.8);
    // Most filtered K+ is gone by the end of the loop; what is excreted is chiefly what the
    // connecting tubule and collecting duct then secrete, which is why K+ excretion is regulated
    // there (Rose ch. 12).
    const kReabTAL = atlOut.K * clamp(0.88 * nkcc, 0, 0.94);
    talOut = { ...atlOut };
    talOut.Na = atlOut.Na - talNaReab;
    talOut.Cl = Math.max(0, atlOut.Cl - talNaReab - kReabTAL * 0.5);
    talOut.K = atlOut.K - kReabTAL;
    talOut.HCO3 = atlOut.HCO3 - hco3ReabTAL;
    talOut.Ca = atlOut.Ca - caReabTAL;
    talOut.Mg = atlOut.Mg - mgReabTAL;
    talOut.NH4 = atlOut.NH4 - nh4ReabTAL;
    talOut.water = atlOut.water; // water impermeable: this is the diluting segment

    // Tubuloglomerular feedback and macula densa renin control both depend on NaCl uptake
    // through NKCC2 in the macula densa cells, not merely on the chloride delivered. This is
    // why a loop diuretic - which blocks that uptake - blunts feedback and stimulates renin
    // even though delivery is high (Rose ch. 2).
    const mdClConc = (talOut.Cl / Math.max(talOut.water, 0.05)) * 1000; // mmol/L at the macula densa
    const uptake = mdClConc / (mdClConc + 45); // saturable Cl-dependence of NKCC2
    // Delivery is reported separately: it can rise at the same time as sensing falls.
    mdDelivery = talOut.Cl / Math.max(inp.nephronFraction, 0.05) / MD_DELIVERY_REF;
    // The TAL is gradient-limited, so the NaCl concentration reaching the macula densa rises and
    // falls with loop flow: slower flow lets the TAL dilute further. That flow dependence is how
    // volume depletion (lower GFR, more proximal reabsorption) is sensed here and releases renin
    // (Rose ch. 2). Above normal the response is blunted: macula densa nitric oxide rises with
    // NaCl delivery and resets feedback on a high-salt diet, so GFR is kept up to excrete the
    // load (Rose ch. 8). NKCC2 blockade still dominates, so a loop diuretic reads as "low".
    const flowSensing = mdDelivery < 1 ? Math.pow(Math.max(mdDelivery, 0.1), 0.5) : 1 + 0.1 * Math.min(mdDelivery - 1, 2);
    const sensed = uptake * clamp(nkcc, 0, 1.6) * flowSensing;
    maculaDensa = clamp(sensed / MD_REF, 0.05, 6);

    put('DTL', dtlIn, dtlOut, medullaTarget * 0.85);
    put('ATL', atlIn, atlOut, osmOfLoad(atlOut));
    put('TAL', atlOut, talOut, osmOfLoad(talOut));
    loopOut = talOut;

    // ------------------------------------------------- distal nephron (needed for urea loop)
    const distal = runDistal(loopOut, inp, medullaTarget);
    const change = Math.abs(distal.ureaReabIMCD - imcdUreaReab);
    imcdUreaReab = distal.ureaReabIMCD;
    if (iter > 2 && change < 1e-6) break;
  }

  const distal = runDistal(loopOut, inp, medullaTarget);
  put('DCT', loopOut, distal.dctOut, osmOfLoad(distal.dctOut));
  put('CNT', distal.dctOut, distal.cntOut, osmOfLoad(distal.cntOut));
  put('CCD', distal.cntOut, distal.ccdOut, osmOfLoad(distal.ccdOut));
  put('OMCD', distal.ccdOut, distal.omcdOut, osmOfLoad(distal.omcdOut));
  put('IMCD', distal.omcdOut, distal.imcdOut, osmOfLoad(distal.imcdOut));

  return {
    segments,
    medullaTarget,
    medullaOM: 290 + (medullaTarget - 290) * 0.55,
    gNaCl,
    gUrea,
    maculaDensa,
    mdDelivery,
    distalNaDelivery: distal.dctOut.Na,
    distalFlow: distal.dctOut.water,
    distalVoltage: distal.voltage,
    talVoltage,
    kSecretion: distal.kSecretion,
    hSecretionDistal: distal.hSecretion,
    pendrinSecretion: distal.pendrinSecretion,
    ammoniagenesis,
    creatSecretion,
    glucoseReabsorbed,
    glucoseTm: tmGlucose,
    ptReabsFraction: ptFraction,
    loopNaClFraction: loopNaFraction,
    urineOut: distal.imcdOut,
    urinePH: distal.pH,
    urineTA: distal.TA,
    urineNH4: distal.imcdOut.NH4,
    urineHCO3: distal.imcdOut.HCO3,
  };
}

interface DistalResult {
  dctOut: Record<SoluteId, number>;
  cntOut: Record<SoluteId, number>;
  ccdOut: Record<SoluteId, number>;
  omcdOut: Record<SoluteId, number>;
  imcdOut: Record<SoluteId, number>;
  voltage: number;
  kSecretion: number;
  hSecretion: number;
  pendrinSecretion: number;
  ureaReabIMCD: number;
  pH: number;
  TA: number;
}

/** Calibrates distal K+ secretion so that plasma K+ sits near 4.2 mmol/L on a normal diet. */
const KSEC_GAIN = 0.026;
/** Share of principal-cell K+ secretion in the connecting tubule; the rest is in the CCD. */
const CNT_K_SHARE = 0.6;

/** Distal convoluted tubule -> connecting tubule -> collecting duct. */
function runDistal(inLoad: Record<SoluteId, number>, inp: NephronInput, medullaTarget: number): DistalResult {
  const p = inp.params;
  const t = p.transporters;
  const d = p.drugs;
  const h = inp.hormones;
  const pl = inp.plasma;
  const injury = clamp(p.tubularInjury, 0, 1);

  // --- DCT: thiazide-sensitive NaCl cotransport; PTH-sensitive active Ca uptake (TRPV5);
  //     Mg via TRPM6. WNK/SPAK signalling makes NCC activity K-sensitive (Terker 2015).
  const kOnNCC = clamp(1 + 0.45 * (4.2 - pl.K), 0.6, 1.8);
  const ncc =
    t.NCC *
    (1 - 0.92 * d.thiazide) *
    kOnNCC *
    clamp(1 + 0.08 * Math.log(Math.max(h.at1, 0.05)), 0.8, 1.25) *
    p.distalAdaptation *
    (1 - 0.3 * injury);
  // As in the loop, the distal convoluted tubule has a finite absolute capacity (~7% of the
  // filtered load). This is why a loop diuretic's natriuresis is not simply recaptured
  // downstream, and why blocking this segment with a thiazide produces a real natriuresis.
  const dctCapacity = 1.3 * clamp(inp.nephronFraction, 0.05, 1) * clamp(ncc, 0, 2) * p.distalAdaptation;
  const dctNaReab = Math.min(inLoad.Na * clamp(0.62 * ncc, 0.02, 0.88), dctCapacity);
  const dctOut = { ...inLoad };
  dctOut.Na = inLoad.Na - dctNaReab;
  dctOut.Cl = Math.max(0, inLoad.Cl - dctNaReab);
  // Thiazides (and amiloride) increase distal Ca reabsorption despite blocking Na uptake.
  const caDct =
    inLoad.Ca *
    clamp(
      0.6 *
        t.TRPV5 *
        Math.pow(Math.max(h.pth, 0.05), 0.35) *
        Math.pow(Math.max(h.calcitriol, 0.05), 0.15) *
        (1 + 0.9 * clamp(1 - ncc, 0, 1) + 0.4 * d.amiloride),
      0,
      0.95,
    );
  dctOut.Ca = Math.max(0, inLoad.Ca - caDct);
  const mgDct = inLoad.Mg * clamp(0.45 * t.TRPM6 * (1 - 0.3 * d.thiazide) * clamp(1 + 0.2 * (pl.K - 4.2), 0.6, 1.2), 0, 0.9);
  dctOut.Mg = Math.max(0, inLoad.Mg - mgDct);

  // --- CNT + CCD principal cells: ENaC-mediated Na entry creates the lumen-negative voltage
  //     that drives K secretion (ROMK/BK) and favours H+ secretion.
  const mr = h.mr;
  // Atrial natriuretic peptide is released when the atria are stretched and acts through cGMP
  // to close the cyclic-nucleotide-gated sodium channel and inhibit ENaC, mainly in the inner
  // medullary collecting duct. This is the limb of volume control that acts on the tubule
  // rather than on the vasculature, and it is why sodium excretion keeps rising as the
  // extracellular volume expands even once aldosterone is already fully suppressed - the same
  // mechanism that produces aldosterone escape (Rose ch. 8).
  const anpBrake = clamp(Math.pow(Math.max(h.anp, 0.1), -0.55), 0.3, 2);
  const enac =
    t.ENaC *
    clamp(Math.pow(Math.max(mr, 0.02), 0.7), 0.1, 4) *
    anpBrake *
    (1 - 0.78 * d.amiloride) *
    (1 - 0.55 * d.trimethoprim) *
    (1 - 0.35 * injury) *
    p.distalAdaptation;
  const naAvail = dctOut.Na;
  const flow = dctOut.water;
  const enacFrac = (a: number) => clamp(1 - Math.exp(-a * enac), 0.01, 0.995);
  // Absolute distal capacity, scaled by nephron mass and by chronic adaptation to high delivery.
  // Aldosterone raises this capacity, but only so far: the connecting tubule and collecting duct
  // are the last few per cent of Na+ reabsorption and cannot recapture a loop diuretic's whole
  // delivery however high aldosterone goes. That ceiling is why loop diuretics are powerful and
  // why sequential blockade of the distal segments adds to them (Rose ch. 5, 15).
  const distalCapacity =
    0.95 * clamp(inp.nephronFraction, 0.05, 1) * p.distalAdaptation * clamp(0.45 + 0.35 * enac, 0.15, 1.35) * (1 - 0.55 * injury);
  let distalBudget = distalCapacity;
  const takeDistal = (wanted: number) => {
    const taken = Math.min(wanted, Math.max(0, distalBudget));
    distalBudget -= taken;
    return taken;
  };
  const cntNaReab = takeDistal(naAvail * enacFrac(0.465));
  // Voltage depends on Na entry rate and on whether Cl can follow paracellularly.
  const clFollow = clamp(dctOut.Cl / Math.max(dctOut.Na, 1e-9), 0.3, 1.6);
  const voltage = clamp(cntNaReab * (1.3 - 0.3 * clFollow), 0, 3.2);

  // K secretion: voltage x luminal flow x apical K channels (ROMK constitutive, BK flow-activated)
  // Aldosterone and distal flow act in opposite directions in volume depletion (aldosterone up,
  // flow down) and in volume expansion (aldosterone down, flow up), so K+ excretion stays roughly
  // constant when only Na+ intake changes (Rose ch. 6, Table 6-3; ch. 12). Neither dependence
  // may therefore dominate the other.
  const flowRel = Math.max(flow, 0.1) / 6;
  const kChannels = clamp(t.ROMK * Math.pow(Math.max(mr, 0.02), 0.6) + 0.35 * t.BK * clamp(Math.pow(flowRel, 0.8), 0, 3), 0, 7);
  const kSecretion = clamp(
    KSEC_GAIN * kChannels * (0.4 + 0.9 * voltage) * clamp(Math.pow(flowRel, 0.55), 0.25, 2.5) * (pl.K >= 4.2 ? clamp(1 + 0.9 * (pl.K - 4.2), 1, 3.5) : Math.max(0.02, Math.pow(pl.K / 4.2, 5))) /* K+ depletion withdraws ROMK and lowers cell K+ */ * (pl.pH > 7.45 ? 1.2 : pl.pH < 7.3 ? 0.8 : 1),
    0,
    2.5,
  );
  // H-K-ATPase reabsorbs K during K depletion (and secretes H+).
  const kReabIntercalated = clamp(0.35 * t.HKATPase * Math.max(0, 4.0 - pl.K), 0, 1) * 0.02;

  // Chloride follows the reabsorbed sodium down the paracellular path, but only in part - the
  // shortfall is what sustains the lumen-negative voltage that drives K+ and H+ secretion.
  // Tubular fluid also has to stay electroneutral: chloride cannot be stripped out below the
  // point where it no longer balances the cations still in the lumen. That floor is what the
  // kidney runs up against when it drives urine chloride below 10 mmol/L in chloride
  // depletion, and it is why urine chloride normally tracks urine sodium.
  const clAfter = (luminalCl: number, naReab: number, coupling: number, cationsOut: number) => {
    const floor = Math.min(luminalCl, 0.55 * cationsOut);
    return Math.max(floor, luminalCl - naReab * coupling);
  };

  const cntOut = { ...dctOut };
  cntOut.Na = dctOut.Na - cntNaReab;
  cntOut.K = Math.max(0, dctOut.K + CNT_K_SHARE * kSecretion - kReabIntercalated);
  cntOut.Cl = clAfter(dctOut.Cl, cntNaReab, 0.75, cntOut.Na + cntOut.K + cntOut.NH4);

  // --- Water: ADH-dependent AQP2 in CNT/CCD/OMCD/IMCD equilibrates fluid with the
  //     cortical (290) then medullary interstitium.
  const perm = clamp(h.aqp2 * (1 - 0.4 * injury), 0.02, 1);
  const equilibrate = (load: Record<SoluteId, number>, interstitialOsm: number, fraction: number) => {
    const solute =
      load.Na + load.K + load.Cl + load.HCO3 + load.urea + load.Pi * 1.8 + load.Ca + load.Mg + load.NH4 + load.aa + load.glucose / 180;
    const target = (solute / Math.max(interstitialOsm, 50)) * 1000;
    // Water moves out of the lumen towards osmotic equilibrium; the collecting duct never
    // adds water back, so a lumen already more dilute than the interstitium simply passes on.
    if (target >= load.water) return load.water;
    return load.water + (target - load.water) * clamp(fraction, 0, 1);
  };

  const ccdIn = { ...cntOut };
  const ccdOut = { ...ccdIn };
  const ccdNaReab = takeDistal(ccdIn.Na * enacFrac(0.25));
  ccdOut.Na = ccdIn.Na - ccdNaReab;
  ccdOut.K = ccdIn.K + (1 - CNT_K_SHARE) * kSecretion;
  ccdOut.Cl = clAfter(ccdIn.Cl, ccdNaReab, 0.8, ccdOut.Na + ccdOut.K + ccdOut.NH4);
  ccdOut.water = equilibrate(ccdIn, 290, perm * 0.95);

  // --- Acid-base in the collecting duct: H-ATPase secretion titrates phosphate (titratable
  //     acid) and traps NH3 as NH4+; type B cells secrete HCO3 via pendrin when alkalotic.
  const hPump =
    t.HATPase *
    clamp(Math.pow(Math.max(mr, 0.02), 0.15), 0.5, 1.6) *
    clamp(1 + 1.6 * (24 - pl.HCO3) / 24, 0.25, 3.2) *
    (0.55 + 0.45 * voltage) *
    (1 - 0.4 * injury) *
    clamp(1 + 0.15 * (4.2 - pl.K), 0.7, 1.5);
  // Type B intercalated cells secrete HCO3- (pendrin, in exchange for luminal Cl-) as plasma
  // HCO3- rises. The response is graded, not a switch, and it needs luminal Cl- to exchange
  // against: in chloride depletion it fails, which is one reason vomiting maintains alkalosis.
  const hco3Excess = Math.log1p(Math.exp((pl.HCO3 - 26) / 1.2)) * 1.2;
  const pendrinSecretion = clamp(
    0.02 * t.pendrin * hco3Excess * clamp(ccdOut.Cl / Math.max((ccdOut.water / 1000) * 30, 1e-6), 0.2, 2),
    0,
    0.6,
  );

  const omcdIn = { ...ccdOut };
  const omcdOut = { ...omcdIn };
  omcdOut.water = equilibrate(omcdIn, 290 + (medullaTarget - 290) * 0.4, perm * 0.9);
  const omcdNaReab = takeDistal(omcdIn.Na * enacFrac(0.185));
  omcdOut.Na = omcdIn.Na - omcdNaReab;
  omcdOut.Cl = clAfter(omcdIn.Cl, omcdNaReab, 0.9, omcdOut.Na + omcdOut.K + omcdOut.NH4);

  const imcdIn = { ...omcdOut };
  const imcdOut = { ...imcdIn };
  // Urea: ADH-stimulated UT-A1/A3 permeability in the inner medulla; reabsorbed urea is
  // recycled into the medullary interstitium (and is the "gUrea" gradient component).
  const ureaPerm = clamp(t.UTA * (0.25 + 0.75 * clamp(h.aqp2, 0, 1)), 0.05, 1.2);
  const ureaReabIMCD = imcdIn.urea * clamp(0.55 * ureaPerm, 0, 0.8);
  imcdOut.urea = imcdIn.urea - ureaReabIMCD;
  const imcdNaReab = takeDistal(imcdIn.Na * enacFrac(0.54));
  imcdOut.Na = Math.max(0, imcdIn.Na - imcdNaReab);
  imcdOut.Cl = clAfter(imcdIn.Cl, imcdNaReab, 0.9, imcdOut.Na + imcdOut.K + imcdOut.NH4);

  // --- Distal acid excretion (before the final water equilibration, so that the osmoles left
  // in the lumen are the ones water equilibrates against).
  // Net acid excretion = titratable acid + NH4+ − HCO3−. The three terms are limited by
  // different things (Rose ch. 11), which is why they dissociate in the renal tubular acidoses:
  //   • reclaiming the last of the filtered HCO3 needs H-ATPase capacity (type 1 RTA fails here)
  //   • titratable acid is capped by the filtered phosphate buffer and by how low the pH goes
  //   • NH4+ is capped by proximal ammoniagenesis — the term that adapts most in chronic acidosis
  const hCapacity = 0.9 * hPump; // mmol/min of distal H+ secretion
  const hco3In = imcdOut.HCO3;
  const hco3Reclaimed = Math.min(hco3In, hCapacity);
  let hLeft = Math.max(0, hCapacity - hco3Reclaimed);
  const finalHCO3 = Math.max(0, hco3In - hco3Reclaimed) + pendrinSecretion;

  // NH4+ trapping: NH3 diffuses into the acid lumen and is protonated there. The supply comes
  // from proximal glutamine metabolism after medullary recycling (Weiner & Verlander 2017).
  const nh3Available =
    (inp.nh4Supply ?? 0.028) * clamp(t.RhCG, 0, 2) * (1 - 0.3 * injury) * clamp(0.55 + (0.45 * medullaTarget) / 900, 0.4, 1.4);
  const nh4Trapped = Math.min(hLeft * 0.85, nh3Available);
  hLeft -= nh4Trapped;

  imcdOut.HCO3 = finalHCO3;
  imcdOut.NH4 = nh4Trapped;

  // Final water equilibration with the papillary interstitium: this is the step that sets the
  // maximum urine osmolality.
  imcdOut.water = equilibrate(imcdOut, medullaTarget, perm);

  // Titratable acid: phosphate (pKa 6.8) is the main urinary buffer.
  const piLoad = imcdOut.Pi;
  const flowL = Math.max(imcdOut.water, 0.05) / 1000;
  const TA = Math.min(piLoad * 0.92, Math.max(0, hLeft));
  const titratedFraction = piLoad > 1e-9 ? clamp(TA / piLoad, 0, 0.999) : 0;

  // Urine pH: alkaline when HCO3 escapes, otherwise set by how far the phosphate buffer has
  // been titrated.
  const hco3Conc = finalHCO3 / flowL;
  const pH =
    hco3Conc > 0.5
      ? clamp(6.1 + Math.log10(hco3Conc / (0.03 * 45)), 5.5, 8.2)
      : clamp(6.8 + Math.log10((1 - titratedFraction + 1e-3) / (titratedFraction + 1e-3)), 4.4, 7.4);

  return {
    dctOut,
    cntOut,
    ccdOut,
    omcdOut,
    imcdOut,
    voltage,
    kSecretion,
    hSecretion: hCapacity,
    pendrinSecretion,
    ureaReabIMCD,
    pH,
    TA,
  };
}
