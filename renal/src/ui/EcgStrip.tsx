// A synthetic lead II rhythm strip whose morphology follows the plasma K⁺, drawn from the
// sequence Rose describes (Figs. 27-4, 28-4, after Surawicz): as K⁺ falls, ST depression, a
// flattening T wave and a growing U wave, then a larger P and a wider QRS; as K⁺ rises, a peaked,
// narrow T with a short QT, then a longer PR, a flattening P, a widening QRS, and finally the
// sine wave. Calcium blunts the depolarisation changes of hyperkalaemia, which is why it is given
// first. The relation to the K⁺ level is loose in real patients, so the strip is a teaching
// schematic, not a prediction.

import { useWidth } from './kit';

export interface EcgFeatures {
  pAmp: number; // mV
  pr: number; // s, P onset to QRS onset
  qrs: number; // s
  tAmp: number; // mV
  tWidth: number; // s (SD of the T Gaussian)
  qt: number; // s, QRS onset to T peak
  uAmp: number; // mV
  st: number; // mV offset of the ST segment
  sine: number; // 0..1 blend toward a sine-wave pattern
  notes: string[];
}

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** Morphology for a plasma K⁺ (mmol/L); `calcium` > 0 models IV calcium given (0..1). */
export function ecgFeatures(k: number, calcium = 0): EcgFeatures {
  const notes: string[] = [];
  const hypo = clamp(3.5 - k, 0, 2.5); // 0 at 3.5, 2.5 at 1.0
  const hyper = clamp(k - 5.5, 0, 4.5); // 0 at 5.5
  // Calcium restores excitability: it undoes much of the conduction slowing (P, PR, QRS, sine),
  // not the peaked T. Its effect is transient.
  const conduction = clamp(k - 6.5, 0, 3.5) * (1 - 0.7 * clamp(calcium, 0, 1));

  let pAmp = 0.12 * (1 + 0.4 * clamp(hypo - 1, 0, 1)) * clamp(1 - conduction / 2, 0, 1);
  let pr = 0.16 + 0.03 * clamp(hypo - 1, 0, 1.5) + 0.06 * clamp(conduction, 0, 2);
  const qrs = 0.09 + 0.015 * clamp(hypo - 1.2, 0, 1.3) + 0.05 * Math.pow(clamp(conduction, 0, 3.5), 1.3);
  let tAmp = 0.3 * clamp(1 - hypo / 1.6, 0.05, 1) + 0.28 * clamp(hyper, 0, 2.5);
  const tWidth = 0.055 - 0.012 * clamp(hyper, 0, 1.5) + 0.01 * clamp(hypo, 0, 1.5);
  let qt = 0.28 - 0.035 * clamp(hyper, 0, 1.5) + 0.02 * clamp(hypo, 0, 1.5);
  const uAmp = 0.03 + 0.11 * clamp(hypo, 0, 1.8);
  const st = -0.06 * clamp(hypo - 0.3, 0, 1.5);
  const sine = clamp((conduction - 2.2) / 1.2, 0, 1);

  if (k < 3.0) notes.push('ST depression, flattened T wave, prominent U wave');
  if (k < 2.3) notes.push('taller P, longer PR, slightly wider QRS');
  if (k > 5.8) notes.push('peaked, narrow T wave with a short QT');
  if (conduction > 0.3) notes.push('longer PR, flattening P wave, widening QRS');
  if (conduction > 1.8) notes.push('P wave lost');
  if (sine > 0.2) notes.push('QRS merging with T: the sine-wave pattern that precedes ventricular fibrillation or asystole');
  if (!notes.length) notes.push('normal morphology');
  if (conduction > 1.8) {
    pAmp = 0;
    pr = 0.16;
  }
  tAmp = Math.min(tAmp, 1.1);
  qt = Math.max(qt, 0.18);
  return { pAmp, pr, qrs, tAmp, tWidth, qt, uAmp, st, sine, notes };
}

const gauss = (t: number, mu: number, sd: number) => Math.exp(-0.5 * ((t - mu) / sd) ** 2);

/** Voltage (mV) at time t within one beat that starts at P onset. */
function beat(t: number, f: EcgFeatures) {
  const pMid = 0.05;
  const q0 = f.pr; // QRS onset
  const w = f.qrs;
  let v = f.pAmp * gauss(t, pMid, 0.022);
  v += -0.1 * gauss(t, q0 + 0.12 * w, 0.08 * w);
  v += 1.1 * gauss(t, q0 + 0.42 * w, 0.14 * w) * (0.9 / Math.max(0.9, w / 0.09) + 0.1);
  v += -0.25 * gauss(t, q0 + 0.78 * w, 0.12 * w);
  // ST segment offset between the J point and the T wave
  const j = q0 + w;
  const tPeak = q0 + f.qt;
  if (t > j && t < tPeak) v += f.st * Math.sin((Math.PI * (t - j)) / Math.max(tPeak - j, 0.01));
  v += f.tAmp * gauss(t, tPeak, f.tWidth);
  v += f.uAmp * gauss(t, tPeak + 0.16, 0.045);
  if (f.sine > 0) {
    const sineWave = 0.8 * Math.sin((2 * Math.PI * (t - q0)) / 0.36) * (t > q0 - 0.05 && t < q0 + 0.5 ? 1 : 0.3);
    v = (1 - f.sine) * v + f.sine * sineWave;
  }
  return v;
}

export function EcgStrip(props: { k: number; calcium?: number; rate?: number; seconds?: number; height?: number; label?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const f = ecgFeatures(props.k, props.calcium ?? 0);
  const rr = 60 / (props.rate ?? 75);
  const secs = props.seconds ?? 3;
  const h = props.height ?? 150;
  const w = Math.max(260, width);
  const pxPerS = w / secs;
  const mvToPx = h / 3.2; // 3.2 mV tall
  const baseline = h * 0.62;
  const pts: string[] = [];
  const n = Math.round(w);
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * secs;
    const tb = ((t % rr) + rr) % rr;
    const v = beat(tb, f);
    pts.push(`${(i).toFixed(1)},${(baseline - v * mvToPx).toFixed(1)}`);
  }
  const small = pxPerS * 0.04;
  const grid: preact.JSX.Element[] = [];
  for (let x = 0, i = 0; x <= w; x += small, i++) grid.push(<line key={`v${i}`} x1={x} x2={x} y1={0} y2={h} stroke={i % 5 === 0 ? '#e0707040' : '#e0707018'} />);
  const smallY = mvToPx * 0.1;
  for (let y = baseline % smallY, i = 0; y <= h; y += smallY, i++) grid.push(<line key={`h${i}`} x1={0} x2={w} y1={y} y2={y} stroke={Math.round((y - baseline) / smallY) % 5 === 0 ? '#e0707040' : '#e0707018'} />);
  return (
    <figure ref={ref} style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label={`Schematic ECG at plasma potassium ${props.k.toFixed(1)} mmol/L: ${f.notes.join('; ')}`}>
        <rect x={0} y={0} width={w} height={h} fill="#fff6f4" opacity={0.06} />
        {grid}
        <polyline points={pts.join(' ')} fill="none" stroke="var(--accent)" strokeWidth={1.8} strokeLinejoin="round" />
        <text x={6} y={14} class="svg-small">{props.label ?? `lead II · K⁺ ${props.k.toFixed(1)} mmol/L${props.calcium ? ' · after IV calcium' : ''}`}</text>
      </svg>
      <figcaption>{f.notes.join(' · ')}</figcaption>
    </figure>
  );
}
