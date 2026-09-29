// Educational action-potential model (shape, not a full ionic simulation). Parameters map
// directly to the ion currents discussed in the text so that the learner can see how each
// cellular change reshapes the AP — and which ECG segment corresponds to which phase.

import { css } from './dom';

export interface ApParams {
  K: number; // mmol/L extracellular
  Ca: number; // mmol/L total
  naBlock: number; // 0..1
  ikrBlock: number; // 0..1
  ito: number; // 0..2 relative transient outward current (epicardial notch)
  sympathetic: number; // −1..1
  ischemia: number; // 0..1
}

export const AP_DEFAULT: ApParams = { K: 4.2, Ca: 2.35, naBlock: 0, ikrBlock: 0, ito: 1, sympathetic: 0, ischemia: 0 };

/** Resting membrane potential (mV) from a simplified Nernst relation for K⁺ (Ki = 140 mM). */
export function restingPotential(K: number, ischemia = 0): number {
  const ek = 61.5 * Math.log10(Math.max(1, K) / 140);
  return ek + 4 + 12 * ischemia;
}

/** Fraction of fast Na⁺ channels available at a given resting potential (steady-state inactivation, h∞). */
export function naAvailability(rmp: number): number {
  return 1 / (1 + Math.exp((rmp + 72) / 5.5));
}

export interface ApCurve {
  t: number[];
  v: number[];
  rmp: number;
  upstroke: number; // relative dV/dt
  apd: number;
  phase: { p0: number; p1: number; p2: number; p3: number };
}

export function ventricularAP(pp: ApParams, epi: boolean): ApCurve {
  const rmp = restingPotential(pp.K, pp.ischemia);
  const avail = naAvailability(rmp) * (1 - 0.7 * pp.naBlock);
  const peak = rmp + (100 + 28) * Math.max(0.15, avail) * 0.9 + 12;
  const upDur = 2 / Math.max(0.12, avail);
  const notch = epi ? 18 * pp.ito : 4 * pp.ito;
  let plateau = 20 - notch * 0.5 - 8 * pp.ischemia;
  // Brugada/strong Ito: epicardial dome can be lost entirely.
  const domeLost = epi && notch > 30 && avail < 0.9;
  if (domeLost) plateau = -30;
  let apd = epi ? 250 : 285;
  apd *= 1 + 0.45 * pp.ikrBlock;
  if (pp.K < 3.5) apd *= 1 + (3.5 - pp.K) * 0.12;
  if (pp.K > 5.5) apd *= 1 - Math.min(0.25, (pp.K - 5.5) * 0.08);
  if (pp.Ca < 2.15) apd += (2.15 - pp.Ca) * 180;
  if (pp.Ca > 2.6) apd -= (pp.Ca - 2.6) * 110;
  apd *= 1 - 0.12 * pp.sympathetic - 0.35 * pp.ischemia;
  if (domeLost) apd *= 0.55;
  const p3dur = 70 * (pp.K > 5.5 ? 1 - Math.min(0.4, (pp.K - 5.5) * 0.15) : pp.K < 3.5 ? 1 + (3.5 - pp.K) * 0.3 : 1) * (1 + 0.3 * pp.ikrBlock);
  const t: number[] = [];
  const v: number[] = [];
  const t0 = 30;
  for (let x = 0; x <= 520; x += 1) {
    let y: number;
    const tt = x - t0;
    if (tt < 0) y = rmp;
    else if (tt < upDur) y = rmp + (peak - rmp) * (tt / upDur);
    else if (tt < upDur + 12) y = peak - (peak - (plateau + notch * 0.2)) * ((tt - upDur) / 12) - (tt - upDur < 6 ? notch * ((tt - upDur) / 6) : notch * (1 - (tt - upDur - 6) / 6));
    else if (tt < apd - p3dur) y = plateau - ((tt - upDur - 12) / Math.max(1, apd - p3dur - upDur - 12)) * 15;
    else if (tt < apd) {
      const u = (tt - (apd - p3dur)) / p3dur;
      y = plateau - 15 - (plateau - 15 - rmp) * (0.5 - 0.5 * Math.cos(Math.PI * u));
    } else y = rmp;
    t.push(x);
    v.push(y);
  }
  return { t, v, rmp, upstroke: avail, apd, phase: { p0: t0, p1: t0 + upDur, p2: t0 + upDur + 12, p3: t0 + apd - p3dur } };
}

export function sinoatrialAP(pp: ApParams): ApCurve {
  const mdp = -62 - 4 * Math.min(0, pp.sympathetic) * -1;
  const slope = 0.09 * (1 + 0.8 * pp.sympathetic);
  const thr = -40;
  const t: number[] = [];
  const v: number[] = [];
  let y = mdp;
  let phase = 4;
  let tp = 0;
  for (let x = 0; x <= 520; x++) {
    if (phase === 4) {
      y += slope;
      if (y >= thr) {
        phase = 0;
        tp = x;
      }
    } else if (phase === 0) {
      y = thr + (10 - thr) * Math.min(1, (x - tp) / 15);
      if (x - tp >= 15) {
        phase = 3;
        tp = x;
      }
    } else {
      y = 10 - (10 - mdp) * Math.min(1, (x - tp) / 110);
      if (x - tp >= 110) phase = 4;
    }
    t.push(x);
    v.push(y);
  }
  return { t, v, rmp: mdp, upstroke: 0.3, apd: 0, phase: { p0: 0, p1: 0, p2: 0, p3: 0 } };
}

export function drawAP(canvas: HTMLCanvasElement, curves: { c: ApCurve; label: string; color: string }[], showPhases = true): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = canvas.clientWidth || 600;
  const H = canvas.clientHeight || 260;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const pad = 36;
  const X = (t: number): number => pad + (t / 520) * (W - pad - 10);
  const Y = (mv: number): number => 12 + ((40 - mv) / 140) * (H - 30);
  const ink = css('--ink') || '#222';
  const muted = css('--muted') || '#777';
  const line = css('--line') || '#ddd';
  ctx.strokeStyle = line;
  ctx.fillStyle = muted;
  ctx.font = '11px system-ui';
  for (const mv of [20, 0, -20, -40, -60, -80, -100]) {
    ctx.beginPath();
    ctx.moveTo(pad, Y(mv));
    ctx.lineTo(W - 8, Y(mv));
    ctx.stroke();
    ctx.fillText(`${mv}`, 4, Y(mv) + 4);
  }
  ctx.fillText('mV', 4, 10);
  ctx.fillText('time (ms) →', W - 80, H - 4);
  curves.forEach(({ c, label, color }, k) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    c.t.forEach((t, i) => (i ? ctx.lineTo(X(t), Y(c.v[i])) : ctx.moveTo(X(t), Y(c.v[i]))));
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillText(label, X(c.t[c.t.length - 1]) - 150, Y(c.rmp) - 6 - k * 13);
  });
  if (showPhases && curves[0]) {
    const ph = curves[0].c.phase;
    ctx.fillStyle = ink;
    ctx.font = '600 11px system-ui';
    const tags: [number, string][] = [
      [ph.p0 - 12, '4'],
      [ph.p0 + 2, '0'],
      [ph.p1 + 6, '1'],
      [(ph.p2 + ph.p3) / 2, '2 (plateau ≈ ST)'],
      [ph.p3 + 30, '3 (≈ T wave)'],
    ];
    for (const [t, s] of tags) ctx.fillText(s, X(t), 24);
  }
}
