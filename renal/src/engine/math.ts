// Small numeric helpers shared by the physiology engine.

export const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);

/** Smooth minimum of a and b; k controls how rounded the corner is (0 = hard min). */
export function smin(a: number, b: number, k = 0.05): number {
  if (k <= 0) return Math.min(a, b);
  const eps = Math.max(Math.abs(a), Math.abs(b), 1e-9) * k;
  return 0.5 * (a + b - Math.sqrt((a - b) * (a - b) + eps * eps));
}

/**
 * Non-rectangular hyperbola: saturable transport of a delivered load L by a carrier with
 * capacity Tm. theta in (0,1): 1 = sharp Tm (ideal titration curve), lower = more "splay".
 */
export function saturable(L: number, Tm: number, theta = 0.97): number {
  if (L <= 0 || Tm <= 0) return 0;
  const s = L + Tm;
  const disc = s * s - 4 * theta * L * Tm;
  const reabsorbed = (s - Math.sqrt(Math.max(0, disc))) / (2 * theta);
  // The curve approaches Tm asymptotically; never let rounding carry it past the maximum.
  return Math.min(reabsorbed, Tm, L);
}

/** Logistic between lo and hi centred at x0 with slope k. */
export const logistic = (x: number, x0: number, k: number, lo = 0, hi = 1) =>
  lo + (hi - lo) / (1 + Math.exp(-k * (x - x0)));

/** Bisection root finder for monotonic f on [a, b]. */
export function bisect(f: (x: number) => number, a: number, b: number, tol = 1e-6, maxIter = 80): number {
  let fa = f(a);
  const fb = f(b);
  if (fa * fb > 0) return Math.abs(fa) < Math.abs(fb) ? a : b;
  for (let i = 0; i < maxIter; i++) {
    const m = 0.5 * (a + b);
    const fm = f(m);
    if (Math.abs(fm) < tol || b - a < tol) return m;
    if (fa * fm < 0) {
      b = m;
    } else {
      a = m;
      fa = fm;
    }
  }
  return 0.5 * (a + b);
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Relative change helper used by the causal cascade: (after-before)/|before|. */
export const relChange = (before: number, after: number) =>
  Math.abs(before) < 1e-9 ? (Math.abs(after) < 1e-9 ? 0 : Math.sign(after)) : (after - before) / Math.abs(before);

export const round = (x: number, d = 0) => {
  const p = Math.pow(10, d);
  return Math.round(x * p) / p;
};
