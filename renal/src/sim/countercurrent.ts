// A teaching model of countercurrent multiplication in the style of the textbook's step diagrams
// (Rose Fig. 4-5/4-6): discrete medullary levels, an active "single effect" in the ascending limb,
// passive osmotic equilibration of the descending limb, fluid flow round the hairpin, washout by
// the vasa recta, urea added in the inner medulla, and a collecting duct that equilibrates with the
// interstitium in proportion to its ADH-dependent water permeability.
//
// It is deliberately separate from the whole-kidney engine: its purpose is to make the mechanism
// visible, level by level, rather than to be quantitatively calibrated.

export interface CCParams {
  levels: number;
  /** maximal transverse gradient the ascending limb can hold (mOsm/kg) — the single effect */
  single: number;
  /** fraction of a level's fluid that moves on per step (tubular flow) */
  flow: number;
  /** descending-limb osmotic equilibration per step (aquaporin-1) */
  aqp1: number;
  /** vasa recta washout per step (0 = none) */
  washout: number;
  /** urea contribution at the papilla, mOsm/kg, before washout (0 = none) */
  urea: number;
  /** collecting duct water permeability (ADH/AQP2), 0..1 */
  adh: number;
}

export const CC_DEFAULT: CCParams = { levels: 8, single: 150, flow: 0.3, aqp1: 0.9, washout: 0.01, urea: 560, adh: 0.95 };

export interface CCState {
  desc: number[];
  asc: number[];
  /** interstitial NaCl osmolality */
  nacl: number[];
  /** interstitial urea osmolality */
  urea: number[];
  cd: number[];
  step: number;
}

export const ISO = 290;

export function ccInitial(n: number): CCState {
  const f = () => Array.from({ length: n }, () => ISO);
  return { desc: f(), asc: f(), nacl: f(), urea: Array.from({ length: n }, () => 0), cd: f(), step: 0 };
}

export const interstitium = (s: CCState) => s.nacl.map((v, i) => v + s.urea[i]);

/**
 * Step 1 of the textbook sequence: the ascending limb pumps NaCl into the interstitium, aiming for
 * the single-effect gradient but limited to a fixed transport capacity per step. Faster flow means
 * each volume of fluid spends less time being pumped, so the gradient actually achieved is smaller.
 */
export function pump(s: CCState, p: CCParams): CCState {
  const asc = [...s.asc];
  const nacl = [...s.nacl];
  const inter = interstitium(s);
  // Each step moves fluid a fixed fraction of a level, so a step represents more time when flow
  // is slow: transport capacity per step scales inversely with flow.
  const capacity = (p.single * 0.09) / Math.max(p.flow, 0.02);
  for (let i = 0; i < asc.length; i++) {
    const gap = inter[i] - asc[i];
    if (gap < p.single) {
      const d = Math.min((p.single - gap) / 2, capacity, Math.max(0, asc[i] - 40));
      asc[i] -= d;
      nacl[i] += d;
    }
  }
  return { ...s, asc, nacl };
}

/**
 * Step 2: the descending limb equilibrates osmotically with the interstitium, mostly by losing
 * water. Equal volumes are assumed, so the two move toward their average (the interstitium is
 * diluted by the water it receives).
 */
export function equilibrate(s: CCState, p: CCParams): CCState {
  const desc = [...s.desc];
  const nacl = [...s.nacl];
  const inter = interstitium(s);
  for (let i = 0; i < desc.length; i++) {
    const m = (p.aqp1 * (inter[i] - desc[i])) / 2;
    desc[i] += m;
    nacl[i] -= m * (s.nacl[i] / Math.max(inter[i], 1));
  }
  return { ...s, desc, nacl };
}

/** Step 3: fluid moves round the hairpin by a fraction `flow` of a level. */
export function flowStep(s: CCState, p: CCParams): CCState {
  const n = s.desc.length;
  const f = Math.min(1, Math.max(0, p.flow));
  const desc = s.desc.map((v, i) => v * (1 - f) + (i === 0 ? ISO : s.desc[i - 1]) * f);
  const asc = s.asc.map((v, i) => v * (1 - f) + (i === n - 1 ? s.desc[n - 1] : s.asc[i + 1]) * f);
  return { ...s, desc, asc };
}

/** Vasa recta washout, urea accumulation, and collecting duct equilibration. */
export function exchange(s: CCState, p: CCParams): CCState {
  const n = s.desc.length;
  const dt = Math.max(p.flow, 0.02) / 0.3; // time represented by one step, relative to normal flow
  const w = Math.min(0.5, p.washout * dt);
  const nacl = s.nacl.map((v) => v - w * (v - ISO));
  // Urea accumulates in the inner medulla, rising toward the papilla. It depends on ADH (water
  // removal upstream concentrates urea; UT-A1 lets it out) and is washed out by blood flow.
  const urea = s.urea.map((u, i) => {
    const depth = i / Math.max(1, n - 1);
    const target = p.urea * p.adh * Math.pow(Math.max(0, (depth - 0.3) / 0.7), 1.3);
    return Math.max(0, u + Math.min(0.5, 0.06 * dt) * (target - u) - 2 * w * u);
  });
  const inter = nacl.map((v, i) => v + urea[i]);
  const cd: number[] = [];
  // The cortical thick limb keeps pumping without water, diluting the fluid further before it
  // reaches the distal tubule (~100 mOsm/kg).
  let x = loopOutflow(s, p);
  x = x + p.adh * (ISO - x); // cortical collecting duct equilibrates with the isosmotic cortex
  for (let i = 0; i < n; i++) {
    // equilibration with the interstitium (ADH), and continued NaCl reabsorption without water,
    // which lowers the osmolality a little further when the duct is water-impermeable
    if (inter[i] > x) x = x + p.adh * (inter[i] - x);
    x = Math.max(50, x - (1 - p.adh) * 7);
    cd.push(x);
  }
  return { ...s, nacl, urea, cd };
}

/** Osmolality of fluid leaving the loop after the cortical thick ascending limb. */
export const loopOutflow = (s: CCState, p: CCParams) => Math.max(70, s.asc[0] - 0.6 * p.single);

export function fullStep(s: CCState, p: CCParams): CCState {
  let t = pump(s, p);
  t = equilibrate(t, p);
  t = flowStep(t, p);
  t = exchange(t, p);
  return { ...t, step: s.step + 1 };
}

export function runCC(p: CCParams, steps = 600, from?: CCState): CCState {
  let s = from ?? ccInitial(p.levels);
  for (let i = 0; i < steps; i++) s = fullStep(s, p);
  return s;
}
