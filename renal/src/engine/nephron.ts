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
  /** potassium adaptation of the secreting cells, relative to normal */
  kAdapt?: number;
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

/**
 * Primary sodium retention in glomerular disease.
 *
 * Nephrotic oedema is usually an overfilling state, not underfilling: sodium retention begins
 * before the plasma albumin has fallen, and in experimental glomerular disease it is localised to
 * the collecting tubules. Rose is explicit that how this happens is not well understood (ch. 16),
 * so this is an empirical term keyed to the severity of glomerular injury, not a mechanism.
 *
 * Its clinical signature is the one that distinguishes the two: retention with a suppressed renin
 * and a normal or expanded plasma volume, rather than the high renin of a patient who is
 * underfilled. Rose's account of remission in minimal change disease is the evidence — sodium
 * excretion rises and the oedema starts to clear before the plasma albumin has moved at all.
 */
function glomerularRetention(p: Params) {
  return 1 + 0.9 * clamp(p.proteinuria / 6, 0, 1);
}

/** Minimum urine K⁺ concentration, mmol/L (IMCD leak). */
const IMCD_MIN_K = 5;
/**
 * How total ammoniagenesis scales with nephron mass. The remaining nephrons adapt, each making
 * more NH₄⁺, up to three to four times normal — the most a normal kidney reaches after an acid
 * load. Total ammonium excretion is therefore preserved until the GFR falls below 40–50 mL/min,
 * and only then declines in proportion to the nephrons left (Rose ch. 19, Fig. 19-3). A smooth
 * minimum of 1 and 3 × the nephron fraction reproduces that. The earlier power law put the
 * bicarbonate at 17 mmol/L at a GFR of 73 mL/min.
 */
const AMMONIA_PER_NEPHRON_MAX = 4;
function ammoniaNephronScale(nf: number) {
  const adapted = AMMONIA_PER_NEPHRON_MAX * clamp(nf, 0.01, 1);
  return Math.pow(1 + Math.pow(adapted, -4), -0.25);
}
/** Upper limit of potassium adaptation (Rose: intake raised slowly to ~400 mmol/day is tolerated). */
const KADAPT_MAX = 3.5;
/** Fraction of apical K⁺ channel activity that does not depend on mineralocorticoid. */
const ROMK_BASAL = 0.2;
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

  /**
   * The arterial PCO2 as an independent determinant of H+ secretion, not merely a consequence of
   * it. A rise in PCO2 raises the tubular cell's intracellular H+ concentration, which drives both
   * proximal Na+-H+ exchange and the distal H+-ATPase (Rose ch. 11). This is the entire mechanism
   * of renal compensation for a respiratory disturbance: chronic hypercapnia raises the plasma
   * bicarbonate by about 3.5 mmol/L per 10 mmHg, and chronic hypocapnia lowers it by about 4
   * (Rose Table 17-3), and neither happens if the kidney cannot see the PCO2.
   *
   * It also means a respiratory disturbance blunts the renal handling of a metabolic one, which is
   * correct: the hypocapnia of a compensated metabolic acidosis genuinely reduces bicarbonate
   * reabsorption.
   */
  // Asymmetric: the renal response to hypocapnia is weaker than to hypercapnia, which together
  // with the non-renal buffering reproduces Rose's +1 acute / +3.5 chronic and -2 / -4 per 10 mmHg.
  const pco2Drive = clamp(1 + (pl.PCO2 > 40 ? 0.015 : 0.008) * (pl.PCO2 - 40), 0.78, 1.55);

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
      0.85 * t.NaPi2 * Math.pow(Math.max(h.pth, 0.05), -0.12) * Math.pow(Math.max(h.fgf23, 0.05), -0.06) * (1 - 0.5 * injury),
      0.2,
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
  // Carbonic anhydrase inhibition blocks the bicarbonate-coupled part of proximal Na+ entry, not
  // all of it: the later proximal tubule reabsorbs NaCl down the chloride gradient by a largely
  // CA-independent route, so acetazolamide cuts proximal Na+ reabsorption by roughly a third
  // while nearly abolishing bicarbonate reabsorption (through caActivity below).
  const nheActivity =
    t.NHE3 *
    clamp(1 + at1Pt + snsPt, 0.45, 1.5) *
    (1 - 0.35 * d.acetazolamide) *
    (1 - 0.6 * injury);
  const caActivity = t.CA * (1 - 0.9 * d.acetazolamide);
  // Proximal H+ secretion rises with PCO2 as well, but gently: applied at full strength here a
  // fall in PCO2 strips bicarbonate faster than any kidney does, because the filtered load is
  // enormous and a few per cent of it is hundreds of millimoles a day. The reabsorptive threshold
  // below is what sets where the plasma bicarbonate finally settles.
  const hco3Fraction = clamp(0.9 * nheActivity * Math.pow(pco2Drive, 0.35) * Math.pow(caActivity, 0.6), 0, 0.995);
  // There is no fixed Tm for bicarbonate, but reabsorption does plateau: in the intact kidney it
  // levels off near a plasma concentration of 26 mmol/L, so anything above that is excreted
  // (Rose ch. 11, Fig. 11-14). That threshold is not fixed either — volume depletion (angiotensin
  // II, avid Na+ reabsorption), hypokalaemia and aldosterone all raise it, which is precisely how
  // a metabolic alkalosis is maintained instead of being excreted.
  const kOnHco3 = clamp(1 + 0.09 * (4.2 - pl.K), 0.85, 1.45);
  const volumeFactor = clamp(Math.pow(Math.max(h.at1, 0.05), 0.12), 0.85, 1.35);
  const threshold = 26 * volumeFactor * kOnHco3 * pco2Drive * clamp(Math.pow(Math.max(h.mr, 0.05), 0.05), 0.9, 1.2);
  const gfrLitresPerMin = inp.GFR / 1000;
  // A failure of the basolateral Na+-3HCO3- exit step — type 2 (proximal) RTA — lowers the
  // threshold rather than taking a fixed fraction off reabsorption, and that distinction is the
  // whole clinical picture (Rose Fig. 19-6). Below the reduced threshold the proximal tubule
  // still reclaims everything and the urine can be made maximally acid; above it, bicarbonate
  // pours out. That is why the disorder is self-limiting, settling at a plasma bicarbonate of
  // 14-20 mmol/L rather than falling without limit as a distal RTA does, and why alkali given to
  // a patient with it is promptly excreted again.
  const hco3Ceiling = threshold * gfrLitresPerMin * 0.93 * Math.pow(clamp(t.NBCe1, 0.05, 1.5), 0.55);
  const hco3ReabPT = Math.min(f.HCO3, f.HCO3 * hco3Fraction, hco3Ceiling);

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
  // The chloride left in the lumen is scaled to the sodium left there, not to the water. The two
  // are the same thing while the luminal osmoles are sodium salts. They part company in an
  // osmotic diuresis: unreabsorbed glucose or mannitol holds water in the lumen that carries no
  // sodium, and scaling chloride to the water sent several hundred mmol a day more chloride than
  // cation out of the proximal tubule, draining the body's chloride with nothing to replace it.
  // At normal flow the two scalings give the same chloride to within 0.01%.
  const naLeftPT = f.Na - naReabPT;
  const clReabPT = clamp(f.Cl - naLeftPT * (targetClConc / Math.max(pl.Na, 80)), f.Cl * 0.2, f.Cl * 0.8);
  const kReabPT = f.K * 0.70 * clamp(ptFraction / PT_BASE, 0.5, 1.3);
  const ureaReabPT = f.urea * 0.45 * clamp(ptFraction / PT_BASE, 0.4, 1.3);
  const caReabPT = f.Ca * 0.65 * clamp(ptFraction / PT_BASE, 0.4, 1.2);
  const mgReabPT = f.Mg * 0.25;

  // Ammoniagenesis from glutamine: stimulated by acidosis and hypokalemia, limited by nephron mass.
  // The stimulus is the cell's acidity, which tracks extracellular pH — that is, the ratio of
  // PCO2 to bicarbonate, not either alone. Keyed to bicarbonate by itself the kidney is blind to a
  // respiratory disturbance; keyed to PCO2 by itself it is blind to a metabolic one. Writing it as
  // pH also gives the right negative feedback: as compensation succeeds and the pH returns toward
  // normal, the stimulus fades, which is why compensation is partial.
  const acidStim = clamp(Math.pow(10, 3.0 * (7.4 - pl.pH)), 0.4, 6);
  const kStim = clamp(1 + 0.35 * (4.2 - pl.K), 0.6, 2.2);
  const ammoniagenesis =
    40 * acidStim * kStim * ammoniaNephronScale(inp.nephronFraction) * (1 - 0.5 * injury) * (pl.pH > 7.5 ? 0.5 : 1); // mmol/day
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

  // An osmotic diuresis washes the medulla out. Unreabsorbed glucose or mannitol raises medullary
  // blood flow (by a mechanism the book calls unknown) and lowers papillary osmolality, which in
  // turn reduces water abstraction from the descending limb and passive NaCl exit from the thin
  // ascending limb (Rose ch. 4). That is why a solute diuresis gives a urine only modestly
  // hyperosmotic to plasma, mostly glucose, with a Na⁺ + K⁺ concentration well below the plasma's
  // (Rose ch. 24, 25). Without it the model concentrated a 1000 mg/dL glucosuria to 1000 mOsm/kg.
  // Half the gradient is lost at about 2 mmol/min of unreabsorbed solute (a plasma glucose near
  // 30 mmol/L at a normal GFR), which puts the urine-to-plasma osmolality ratio near 2 at an
  // osmolar clearance of 9 mL/min and near 1.5 at 20 mL/min. The response is soft at the bottom
  // end: the few tens of grams a day of glucosuria an SGLT2 inhibitor causes at a normal glucose
  // is a mild diuresis that does not wash the medulla out.
  const osmoticWashout = 1 / (1 + (nonReabsorbed * nonReabsorbed) / (nonReabsorbed + 0.5) / 1.5);

  for (let iter = 0; iter < 12; iter++) {
    // NaCl component of the gradient from TAL transport per unit flow
    gNaCl = clamp(
      osmoticWashout *
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
      osmoticWashout *
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
    // transport is ~1:1 NaCl), and by transport capacity.
    //
    // That capacity is not a fixed ceiling. Transport here is flow-dependent, rising with the
    // chloride delivered (Rose ch. 4, Fig. 4-3), and it is precisely that which makes proximally
    // acting diuretics weak: most of the extra fluid delivered out of the proximal tubule is
    // reclaimed in the loop, so blocking the segment that reabsorbs the most sodium does not
    // produce the largest diuresis (Rose ch. 15). Modelled as a saturating function of delivery,
    // chosen so that the normal operating point (about 6.5 mmol/min delivered, 5.2 reabsorbed)
    // is unchanged while an increased load is largely, but not wholly, recovered.
    const nephrons = clamp(inp.nephronFraction, 0.05, 1);
    const talNaWanted = atlOut.Na * clamp(loopNaFraction * 1.05, 0.02, 0.92);
    const talTm = 26 * nephrons * clamp(nkcc, 0, 1.6) * loopPressure;
    const talCapacity = talTm * (atlOut.Na / (atlOut.Na + 26 * nephrons));
    const talNaReab = Math.min(talNaWanted, atlOut.Cl * 0.93, talCapacity);
    talVoltage = clamp(nkcc * Math.pow(clamp(t.ROMK, 0.05, 2), 0.5), 0, 1.6);
    const caReabTAL = atlOut.Ca * clamp(0.68 * talVoltage * t.claudin16 * clamp(1 - 0.35 * (t.CaSR - 1), 0.4, 1.2), 0, 0.85);
    const mgReabTAL = atlOut.Mg * clamp(0.84 * talVoltage * t.claudin16 * clamp(1 - 0.4 * (t.CaSR - 1), 0.3, 1.2), 0, 0.9);
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

  // Chronic loop diuretic therapy hypertrophies the distal tubule and collecting duct, with a
  // measurable rise in Na+-K+-ATPase activity (Rose ch. 15; Kaissling 1988). The effect is real —
  // it is why adding a thiazide to a loop diuretic yields more than the thiazide would alone — but
  // it is bounded: Rose is explicit that the response to a loop diuretic is not seriously impaired
  // in most circumstances, so the adapted segments must not be able to reclaim the whole delivery.
  const adapt = clamp(1 + 0.45 * (p.distalAdaptation - 1), 0.6, 1.5);

  // --- DCT: thiazide-sensitive NaCl cotransport; PTH-sensitive active Ca uptake (TRPV5);
  //     Mg via TRPM6. WNK/SPAK signalling makes NCC activity K-sensitive (Terker 2015).
  const kOnNCC = clamp(1 + 0.45 * (4.2 - pl.K), 0.6, 1.8);
  const ncc =
    t.NCC *
    (1 - 0.92 * d.thiazide) *
    kOnNCC *
    clamp(1 + 0.08 * Math.log(Math.max(h.at1, 0.05)), 0.8, 1.25) *
    adapt *
    (1 - 0.3 * injury);
  // As in the loop, the distal convoluted tubule has a finite absolute capacity (~7% of the
  // filtered load). This is why a loop diuretic's natriuresis is not simply recaptured
  // downstream, and why blocking this segment with a thiazide produces a real natriuresis.
  // The adaptation is already carried by ncc, so it is not applied a second time here.
  const dctCapacity = 1.3 * clamp(inp.nephronFraction, 0.05, 1) * clamp(ncc, 0, 2);
  const dctNaReab = Math.min(inLoad.Na * clamp(0.62 * ncc, 0.02, 0.88), dctCapacity);
  const dctOut = { ...inLoad };
  dctOut.Na = inLoad.Na - dctNaReab;
  dctOut.Cl = Math.max(0, inLoad.Cl - dctNaReab);
  // Thiazides (and amiloride) increase distal Ca reabsorption despite blocking Na uptake.
  const caDct =
    inLoad.Ca *
    clamp(
      0.8 *
        t.TRPV5 *
        Math.pow(Math.max(h.pth, 0.05), 0.35) *
        Math.pow(Math.max(h.calcitriol, 0.05), 0.15) *
        (1 + 0.9 * clamp(1 - ncc, 0, 1) + 0.4 * d.amiloride),
      0,
      0.95,
    );
  dctOut.Ca = Math.max(0, inLoad.Ca - caDct);
  // TRPM6-mediated Mg²⁺ reabsorption in the DCT falls when NaCl transport there fails: thiazides
  // and Gitelman syndrome reduce TRPM6 expression and the DCT atrophies, which is why
  // hypomagnesaemia is a feature of Gitelman but not usually of Bartter syndrome (Rose ch. 27).
  const nccMg = clamp((1 - 0.3 * d.thiazide) * (0.25 + 0.75 * clamp(t.NCC, 0, 1.5)), 0.15, 1.3);
  // Hypomagnesaemia upregulates TRPM6, so the DCT recaptures more of what the loop lets through —
  // the compensation that keeps the magnesium near normal in most Bartter syndrome.
  const mgAvid = clamp(1 + 2.5 * (0.85 - pl.Mg), 1, 2.2);
  const mgDct = inLoad.Mg * clamp(0.65 * t.TRPM6 * nccMg * mgAvid * clamp(1 + 0.2 * (pl.K - 4.2), 0.6, 1.2), 0, 0.9);
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
    adapt *
    glomerularRetention(p);
  const naAvail = dctOut.Na;
  const flow = dctOut.water;
  const enacFrac = (a: number) => clamp(1 - Math.exp(-a * enac), 0.01, 0.995);
  // Absolute distal capacity, scaled by nephron mass and by chronic adaptation to high delivery.
  // Aldosterone raises this capacity, but only so far: the connecting tubule and collecting duct
  // are the last few per cent of Na+ reabsorption and cannot recapture a loop diuretic's whole
  // delivery however high aldosterone goes. That ceiling is why loop diuretics are powerful and
  // why sequential blockade of the distal segments adds to them (Rose ch. 5, 15).
  // The adaptation is carried by enac above, so it is not applied a second time here.
  const distalCapacity = 0.95 * clamp(inp.nephronFraction, 0.05, 1) * clamp(0.45 + 0.35 * enac, 0.15, 1.35) * (1 - 0.55 * injury);
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
  // Flow helps secretion by washing secreted K⁺ away, but only up to a point: once the luminal K⁺
  // is held near zero, more flow cannot lower it further, and secretion is then limited by the
  // channels and the pump. Above about twice normal distal flow the gain flattens. Without the
  // ceiling, the six-fold distal flow of an osmotic diuresis wasted 600 mmol of K⁺ a day, where
  // the deficit of diabetic ketoacidosis builds up at 3–5 mmol/kg over several days (Rose ch. 25).
  // Below normal flow the dependence steepens (Rose Fig. 12-5 is nearly linear at low flow): with
  // little fluid reaching the collecting duct, secreted K⁺ accumulates in the lumen and stops
  // further secretion however much aldosterone there is — the reason volume depletion in a patient
  // with few nephrons produces hyperkalaemia (Rose ch. 28).
  const flowGain = flowRel <= 1 ? Math.pow(flowRel, 0.8) : flowRel <= 2 ? Math.pow(flowRel, 0.55) : Math.pow(2, 0.55) * Math.pow(flowRel / 2, 0.12);
  // Part of the apical K⁺ conductance is present without aldosterone: hyperkalaemia stimulates
  // secretion directly, which is how an adrenalectomised animal or a patient with
  // hypoaldosteronism still reaches a (higher) steady state (Rose ch. 12, 28).
  const kChannels = clamp(t.ROMK * (ROMK_BASAL + (1 - ROMK_BASAL) * Math.pow(Math.max(mr, 0.02), 0.6)) + 0.35 * t.BK * clamp(Math.pow(Math.min(flowRel, 2.5), 0.8), 0, 3), 0, 7);
  // A blocked sodium channel generates no voltage however many channels aldosterone inserts, so
  // amiloride and trimethoprim reduce K⁺ secretion even when aldosterone rises to compensate —
  // the reason both cause hyperkalaemia, trimethoprim at ordinary doses (Rose ch. 28).
  // Loss-of-function ENaC (pseudohypoaldosteronism type 1) acts the same way: aldosterone rises
  // but cannot insert channels that do not work.
  const channelBlock = clamp(1 - 0.45 * d.amiloride - 0.35 * d.trimethoprim - 0.8 * Math.max(0, 1 - t.ENaC), 0.2, 1);
  const kAdapt = clamp(inp.kAdapt ?? 1, 1, KADAPT_MAX);
  const kSecretion = clamp(
    channelBlock * kAdapt *
    KSEC_GAIN * kChannels * (0.4 + 0.9 * voltage) * clamp(flowGain, 0.25, 2.5) * (pl.K >= 4.2 ? clamp(1 + 0.9 * (pl.K - 4.2), 1, 3.5) : Math.max(0.02, Math.pow(pl.K / 4.2, 5))) /* K+ depletion withdraws ROMK and lowers cell K+ */ * (pl.pH > 7.45 ? 1.2 : pl.pH < 7.3 ? 0.8 : 1),
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
  //
  // Hypochloraemia makes the collecting duct avid for chloride: as the plasma chloride falls
  // relative to the sodium, more of the sodium reabsorbed takes chloride with it (and type B cells
  // reclaim chloride through pendrin), which is why urine chloride can be driven below 10 mmol/L
  // in chloride depletion while sodium is still being excreted (Rose ch. 13, 18).
  const clAvidity = clamp((0.76 - pl.Cl / Math.max(pl.Na, 1)) / 0.08, 0, 1);
  const clAfter = (luminalCl: number, naReab: number, coupling: number, cationsOut: number) => {
    const floor = Math.min(luminalCl, 0.55 * cationsOut);
    const c = coupling + (1 - coupling) * clAvidity;
    return Math.max(floor, luminalCl - naReab * c);
  };

  const cntOut = { ...dctOut };
  cntOut.Na = dctOut.Na - cntNaReab;
  cntOut.K = Math.max(0, dctOut.K + CNT_K_SHARE * kSecretion - kReabIntercalated);
  cntOut.Cl = clAfter(dctOut.Cl, cntNaReab, 0.75, cntOut.Na + cntOut.K);

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
  ccdOut.Cl = clAfter(ccdIn.Cl, ccdNaReab, 0.8, ccdOut.Na + ccdOut.K);
  ccdOut.water = equilibrate(ccdIn, 290, perm * 0.95);

  // --- Acid-base in the collecting duct: H-ATPase secretion titrates phosphate (titratable
  //     acid) and traps NH3 as NH4+; type B cells secrete HCO3 via pendrin when alkalotic.
  // Driven by cell acidity, as ammoniagenesis is: keyed to plasma bicarbonate alone the pump would
  // switch itself off as compensation raised the bicarbonate, and chronic hypercapnia could never
  // generate the new bicarbonate it needs (Rose ch. 11, Table 17-3).
  // Chloride depletion sustains distal H+ secretion even when the blood is alkalaemic, by two
  // routes Rose sets out: sodium reabsorbed without chloride to follow leaves the lumen more
  // electronegative, which favours H+ accumulation, and the H+-ATPase cosecretes chloride, which a
  // low luminal concentration also favours. This is why the urine stays acid in a
  // chloride-depletion alkalosis, and why it turns alkaline as soon as chloride is replaced.
  // Keyed to the plasma chloride, not the luminal concentration. Those come apart in exactly the
  // case that matters: after an alkali load the luminal chloride is low because bicarbonate has
  // replaced it, while the patient is chloride-replete and should be spilling bicarbonate freely.
  // What maintains an alkalosis is systemic hypochloraemia.
  const clDepletionDrive = clamp(1 + 0.03 * (106 - pl.Cl), 0.85, 1.6);
  const hPump =
    t.HATPase *
    clamp(Math.pow(Math.max(mr, 0.02), 0.15), 0.5, 1.6) *
    clamp(1 + 6.0 * (7.4 - pl.pH), 0.25, 3.2) *
    clDepletionDrive *
    (0.55 + 0.45 * voltage) *
    (1 - 0.4 * injury) *
    clamp(1 + 0.15 * (4.2 - pl.K), 0.7, 1.5);
  // Type B intercalated cells secrete HCO3- (pendrin, in exchange for luminal Cl-) once the
  // bicarbonate rises above the level the body is defending. The response is graded, not a
  // switch, and it needs luminal Cl- to exchange against: in chloride depletion it fails, which
  // is one reason vomiting maintains alkalosis.
  //
  // That level is not a fixed 26. It has to move with the PCO2, or the kidney is blind to the
  // respiratory side: a patient with chronic hypercapnia has a bicarbonate of 35 because the
  // kidney put it there to defend the pH, and a tubule reading the concentration alone would
  // secrete it straight back out and undo its own compensation. Same correction the proximal acid
  // stimulus needed (Rose ch. 11, 20). It moves less steeply than the reabsorptive threshold does
  // — 0.009 against 0.015 per mmHg — and that difference is what makes the compensation partial
  // rather than complete: as the bicarbonate climbs the two thresholds converge, secretion
  // restarts, and it stalls short of a normal pH. Keying it to the arterial pH instead turns the
  // kidney into a pH servo that restores the pH completely, which is not what a patient does.
  //
  // It moves with volume and with potassium too, for the same reasons the reabsorptive threshold
  // does. A kidney defending its perfusion will not throw away sodium bicarbonate, which is what
  // makes a chloride-depletion alkalosis self-sustaining; and potassium depletion drives H+
  // secretion and suppresses HCO3- secretion, which is what holds up the alkalosis of primary
  // aldosteronism in a patient whose volume is normal and whose renin is suppressed (Rose
  // ch. 18). The angiotensin term is one-sided: angiotensin II inhibits bicarbonate secretion, so
  // its absence means only that the inhibition is lifted.
  const secretionThreshold =
    26 * clamp(1 + 0.009 * (pl.PCO2 - 40), 0.78, 1.55) * clamp(Math.pow(Math.max(h.at1, 0.05), 0.12), 1, 1.35) * clamp(1 + 0.09 * (4.2 - pl.K), 0.9, 1.45);
  const hco3Excess = Math.log1p(Math.exp((pl.HCO3 - secretionThreshold) / 1.2)) * 1.2;
  // The exchange runs on the inward chloride gradient, so when luminal chloride is very low it
  // essentially stops rather than merely slowing. That failure is what produces the paradoxical
  // aciduria of a chloride-depletion alkalosis: the urine is acid while the blood is alkalaemic,
  // and stays that way until chloride is replaced (Rose ch. 18, Fig. 18-2).
  const luminalClRel = ccdOut.Cl / Math.max((ccdOut.water / 1000) * 30, 1e-6);
  // The rate follows the transmembrane chloride gradient rather than the luminal concentration
  // alone, so it falls away faster than linearly as the lumen is stripped of chloride — which is
  // what drives the urine pH below 6 while the blood is at 7.5.
  const pendrinSecretion = clamp(0.02 * t.pendrin * hco3Excess * Math.pow(clamp(luminalClRel, 0, 2), 1.8), 0, 0.6);

  const omcdIn = { ...ccdOut };
  const omcdOut = { ...omcdIn };
  omcdOut.water = equilibrate(omcdIn, 290 + (medullaTarget - 290) * 0.4, perm * 0.9);
  const omcdNaReab = takeDistal(omcdIn.Na * enacFrac(0.185));
  omcdOut.Na = omcdIn.Na - omcdNaReab;
  omcdOut.Cl = clAfter(omcdIn.Cl, omcdNaReab, 0.9, omcdOut.Na + omcdOut.K);

  const imcdIn = { ...omcdOut };
  const imcdOut = { ...imcdIn };
  // Urea: ADH-stimulated UT-A1/A3 permeability in the inner medulla; reabsorbed urea is
  // recycled into the medullary interstitium (and is the "gUrea" gradient component).
  const ureaPerm = clamp(t.UTA * (0.25 + 0.75 * clamp(h.aqp2, 0, 1)), 0.05, 1.2);
  // Reabsorption here is passive, so it depends on how long the fluid takes to pass and on how
  // concentrated the urea has become. Volume depletion moves both the same way: water reabsorbed
  // upstream slows the flow and raises the luminal urea concentration, so proportionally more
  // diffuses back. This is the main reason urea rises out of proportion to creatinine in
  // pre-renal azotaemia (Rose ch. 13, 14, 16) — a ratio that is useful precisely because
  // creatinine, being neither reabsorbed nor concentration-driven, does not behave this way.
  // Normalised to the intact kidney's inner medullary collecting duct inflow, so a normal body
  // is unchanged.
  const slowFlow = clamp(Math.pow(clamp(imcdIn.water / 3.2, 0.05, 4), -0.3), 0.55, 1.9);
  const ureaReabIMCD = imcdIn.urea * clamp(0.55 * ureaPerm * slowFlow, 0, 0.92);
  imcdOut.urea = imcdIn.urea - ureaReabIMCD;
  const imcdNaReab = takeDistal(imcdIn.Na * enacFrac(0.54));
  imcdOut.Na = Math.max(0, imcdIn.Na - imcdNaReab);
  imcdOut.Cl = clAfter(imcdIn.Cl, imcdNaReab, 0.9, imcdOut.Na + imcdOut.K);

  // Ammonium chloride. NH4+ secreted into the collecting duct is a cation the tubule cannot take
  // back; it blunts the lumen-negative voltage, so less chloride follows sodium across the
  // paracellular path and the ammonium leaves paired with chloride. This is why urine chloride
  // rises with ammonium excretion, and it is the whole basis of the urine anion gap: when the
  // kidney answers an acid load properly, Na+ + K+ − Cl− turns negative because the missing
  // cation is ammonium; when ammonium excretion is the defect (renal failure, type 1 and type 4
  // renal tubular acidosis), it stays positive (Rose ch. 19, Fig. 19-1). It also decides the
  // plasma anion gap: an acidosis whose acid is excreted as NH4Cl replaces bicarbonate with
  // chloride, so the gap is normal.
  // How much of it leaves as chloride is the share chloride holds of the urine's anions: in a
  // normal urine the sulfate of the dietary acid load and the phosphate buffer take the rest.
  const sulfateOut = (clamp(0.8 * p.proteinIntake - 10, 10, 160) * clamp(inp.GFR / 125, 0.02, 1)) / 1440; // mEq/min
  const nonClAnions = imcdOut.HCO3 + 1.8 * imcdOut.Pi + sulfateOut;
  const clShare = imcdOut.Cl / Math.max(imcdOut.Cl + nonClAnions, 1e-9);
  const distalClReab = Math.max(0, dctOut.Cl - imcdOut.Cl);
  imcdOut.Cl += Math.min(distalClReab, imcdOut.NH4 * clShare);

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

  // The final urine has to be electroneutral. Its chloride cannot exceed the cations left to
  // balance it once bicarbonate, phosphate and the sulfate of the dietary acid load have taken
  // their share. The segment rules above respect that at normal delivery; this is the backstop for
  // a high-flow state (an osmotic diuresis, most of all) where rounding in each segment adds up to
  // a urine carrying more chloride than cation, which bled the body of chloride with nothing to
  // replace it and inflated the plasma anion gap. A normal urine sits well inside the limit.
  const urineCations = imcdOut.Na + imcdOut.K + imcdOut.NH4 + 2 * (imcdOut.Ca + imcdOut.Mg);
  const otherAnions = imcdOut.HCO3 + 1.8 * imcdOut.Pi + sulfateOut;
  imcdOut.Cl = Math.min(imcdOut.Cl, Math.max(0, urineCations - otherAnions));

  // Final water equilibration with the papillary interstitium: this is the step that sets the
  // maximum urine osmolality.
  imcdOut.water = equilibrate(imcdOut, medullaTarget, perm);
  // The urine K⁺ cannot be driven much below 5–15 mmol/L, unlike sodium: K⁺ leaks into the lumen
  // down its gradient through a nonselective cation channel in the inner medullary collecting duct
  // (Rose ch. 26, 27). It rarely matters — except in polyuria, where 10 L/day or more of urine at
  // that floor carries 50–150 mmol of K⁺ however hard the kidney conserves.
  imcdOut.K = Math.max(imcdOut.K, (IMCD_MIN_K * imcdOut.water) / 1000);

  // Titratable acid: phosphate (pKa 6.8) is the main urinary buffer.
  const piLoad = imcdOut.Pi;
  const flowL = Math.max(imcdOut.water, 0.05) / 1000;
  // Phosphate can be titrated almost completely; what usually stops it is the H+ pump, not the
  // buffer. Leaving the last 0.5% is what puts the floor under the urine pH at 4.4-4.5, the
  // minimum Rose gives for the collecting tubule (ch. 19) and the value a normal subject reaches
  // under an acid load — which is what makes a urine pH above 5.3 during acidaemia diagnostic.
  const TA = Math.min(piLoad * 0.995, Math.max(0, hLeft));
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
