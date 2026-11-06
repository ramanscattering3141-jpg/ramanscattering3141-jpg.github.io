// Finding chess diagrams on a rendered page and locating their 64 squares.
import { components, shrink, type Gray } from './image';

export interface BoardRect { x: number; y: number; size: number; score: number }

/**
 * Light/dark contrast of the squares' corners in a checkerboard pattern. Corners are sampled
 * because pieces rarely reach them; the median of the four corners tolerates the odd intrusion.
 * Returns (mean light − mean dark) / pooled spread; a real board scores well above 2.
 */
export function checkerScore(img: Gray, x: number, y: number, size: number): { score: number; contrast: number } {
  const cs = size / 8;
  const p = Math.max(1, Math.round(cs * 0.22));
  const q = cs * 0.03;
  const L: number[] = [], D: number[] = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const cx = x + c * cs, cy = y + r * cs;
    const m: number[] = [];
    for (const [ox, oy] of [[q, q], [cs - q - p, q], [q, cs - q - p], [cs - q - p, cs - q - p]]) {
      let s = 0, n = 0;
      const x0 = Math.round(cx + ox), y0 = Math.round(cy + oy);
      for (let j = 0; j < p; j++) for (let i = 0; i < p; i++) {
        const xx = x0 + i, yy = y0 + j;
        if (xx < 0 || yy < 0 || xx >= img.w || yy >= img.h) continue;
        s += img.data[yy * img.w + xx]; n++;
      }
      m.push(n ? s / n : 255);
    }
    m.sort((a, b) => a - b);
    ((r + c) % 2 === 0 ? L : D).push((m[1] + m[2]) / 2);
  }
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const vr = (a: number[], mu: number) => a.reduce((s, v) => s + (v - mu) ** 2, 0) / a.length;
  const mL = mean(L), mD = mean(D);
  const contrast = mL - mD;
  return { score: contrast / Math.sqrt((vr(L, mL) + vr(D, mD)) / 2 + 9), contrast };
}

/**
 * The board inside a candidate box: skip the frame (rows/columns that are almost all ink) and
 * any white gap between frame and squares, from each side.
 */
export function refineBoard(img: Gray, bx: number, by: number, bw: number, bh: number): BoardRect | null {
  bx = Math.max(0, Math.round(bx)); by = Math.max(0, Math.round(by));
  bw = Math.min(img.w - bx, Math.round(bw)); bh = Math.min(img.h - by, Math.round(bh));
  // Strip statistics: ink fraction (dark pixels) and spread. Margins and the gap inside a frame
  // are uniform paper (any grey level — scans keep theirs); the frame is mostly ink; the squares
  // alternate, so a strip across them is far from uniform.
  const stat = (x0: number, y0: number, w: number, h: number): { ink: number; sd: number } => {
    let n = 0, s1 = 0, s2 = 0;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const v = img.data[y * img.w + x]; if (v < 140) n++; s1 += v; s2 += v * v; }
    const c = w * h, mu = s1 / c;
    return { ink: n / c, sd: Math.sqrt(Math.max(0, s2 / c - mu * mu)) };
  };
  const lim = Math.ceil(Math.min(bw, bh) * 0.1);
  const scan = (at: (i: number) => { ink: number; sd: number }) => {
    let i = 0;
    while (i < lim && at(i).ink < 0.03 && at(i).sd < 10) i++; // blank margin of the candidate box
    // Frame: a line that is mostly ink within the next few pixels (its edge may be anti-aliased).
    const look = Math.max(3, Math.round(lim * 0.25));
    let k = i;
    while (k < Math.min(lim, i + look) && at(k).ink <= 0.5) k++;
    if (k < Math.min(lim, i + look)) {
      i = k;
      while (i < lim && at(i).ink > 0.25) i++;
      while (i < lim && at(i).ink < 0.08 && at(i).sd < 18) i++; // gap between frame and squares
    }
    return i;
  };
  const midY = by + Math.round(bh * 0.1), spanY = Math.round(bh * 0.8);
  const midX = bx + Math.round(bw * 0.1), spanX = Math.round(bw * 0.8);
  const l = scan((i) => stat(bx + i, midY, 1, spanY));
  const r = scan((i) => stat(bx + bw - 1 - i, midY, 1, spanY));
  const t = scan((i) => stat(midX, by + i, spanX, 1));
  const b = scan((i) => stat(midX, by + bh - 1 - i, spanX, 1));
  const w = bw - l - r, h = bh - t - b;
  if (w < 40 || h < 40 || Math.abs(w - h) > Math.max(4, 0.05 * w)) return null;
  const size = (w + h) / 2;
  const x = bx + l + (w - size) / 2, y = by + t + (h - size) / 2;
  const { score, contrast } = checkerScore(img, x, y, size);
  if (contrast < 12) return null;
  return { x, y, size, score };
}

/** All diagrams on a page image, top to bottom. */
export function detectBoards(img: Gray, minScore = 2.5): BoardRect[] {
  const f = Math.max(1, Math.round(Math.min(img.w, img.h) / 600));
  const s = shrink(img, f);
  const mask = new Uint8Array(s.w * s.h);
  for (let i = 0; i < mask.length; i++) mask[i] = s.data[i] < 215 ? 1 : 0;
  const minSide = Math.max(40 / f, Math.min(s.w, s.h) * 0.08);
  const boxes = components(mask, s.w, s.h, minSide * 2).filter((b) => {
    const ar = b.w / b.h;
    return b.w >= minSide && b.h >= minSide && ar > 0.8 && ar < 1.25 && b.area / (b.w * b.h) > 0.04;
  });
  const out: BoardRect[] = [];
  for (const b of boxes) {
    const r = refineBoard(img, b.x * f - f, b.y * f - f, (b.w + 2) * f, (b.h + 2) * f);
    if (r && r.score >= minScore) out.push(r);
  }
  // Remove overlaps (keep the better score).
  out.sort((a, b) => b.score - a.score);
  const kept: BoardRect[] = [];
  for (const r of out) if (!kept.some((k) => overlap(k, r) > 0.3)) kept.push(r);
  return kept.sort((a, b) => a.y - b.y || a.x - b.x);
}

function overlap(a: BoardRect, b: BoardRect): number {
  const ix = Math.max(0, Math.min(a.x + a.size, b.x + b.size) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.size, b.y + b.size) - Math.max(a.y, b.y));
  return (ix * iy) / Math.min(a.size * a.size, b.size * b.size);
}
