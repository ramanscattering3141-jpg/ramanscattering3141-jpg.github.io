// Minimal grayscale image toolkit (no DOM), shared by the worker and the tests.

export interface Gray { w: number; h: number; data: Uint8Array }

export function gray(w: number, h: number, fill = 255): Gray { return { w, h, data: new Uint8Array(w * h).fill(fill) }; }

export function fromRGBA(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Gray {
  const out = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < out.length; i++, j += 4) {
    const a = rgba[j + 3] / 255;
    const v = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
    out[i] = Math.round(v * a + 255 * (1 - a));
  }
  return { w, h, data: out };
}

/** Area-averaged crop + resize of the rectangle (x, y, cw, ch) to s×s pixels. */
export function sample(img: Gray, x: number, y: number, cw: number, ch: number, s: number): Float32Array {
  const out = new Float32Array(s * s);
  const sx = cw / s, sy = ch / s;
  for (let j = 0; j < s; j++) {
    const y0 = y + j * sy, y1 = y0 + sy;
    for (let i = 0; i < s; i++) {
      const x0 = x + i * sx, x1 = x0 + sx;
      let sum = 0, n = 0;
      for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) {
        if (yy < 0 || yy >= img.h) continue;
        const wy = Math.min(y1, yy + 1) - Math.max(y0, yy);
        for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
          if (xx < 0 || xx >= img.w) continue;
          const wx = Math.min(x1, xx + 1) - Math.max(x0, xx);
          const wgt = wx * wy;
          sum += img.data[yy * img.w + xx] * wgt; n += wgt;
        }
      }
      out[j * s + i] = n ? sum / n : 255;
    }
  }
  return out;
}

export function otsu(values: ArrayLike<number>, bins = 256, min = 0, max = 255): number {
  const hist = new Float64Array(bins);
  for (let i = 0; i < values.length; i++) {
    const b = Math.max(0, Math.min(bins - 1, Math.floor(((values[i] - min) / (max - min)) * (bins - 1))));
    hist[b]++;
  }
  const total = values.length;
  let sum = 0;
  for (let i = 0; i < bins; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, thr = 0;
  for (let i = 0; i < bins; i++) {
    wB += hist[i]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) ** 2;
    if (v > best) { best = v; thr = i; }
  }
  return min + ((thr + 0.5) / (bins - 1)) * (max - min);
}

export interface Box { x: number; y: number; w: number; h: number; area: number }

/** 8-connected components of `mask` (1 = foreground); returns bounding boxes. */
export function components(mask: Uint8Array, w: number, h: number, minArea = 1): Box[] {
  const label = new Int32Array(w * h).fill(-1);
  const boxes: Box[] = [];
  const stack: number[] = [];
  for (let p = 0; p < w * h; p++) {
    if (!mask[p] || label[p] >= 0) continue;
    const id = boxes.length;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, area = 0;
    stack.push(p); label[p] = id;
    while (stack.length) {
      const q = stack.pop()!;
      const qx = q % w, qy = (q - qx) / w;
      area++;
      if (qx < x0) x0 = qx; if (qx > x1) x1 = qx; if (qy < y0) y0 = qy; if (qy > y1) y1 = qy;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = qy + dy; if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = qx + dx; if (nx < 0 || nx >= w) continue;
          const r = ny * w + nx;
          if (mask[r] && label[r] < 0) { label[r] = id; stack.push(r); }
        }
      }
    }
    boxes.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, area });
  }
  return boxes.filter((b) => b.area >= minArea);
}

/** Fill holes in a binary mask: background not reachable from the border becomes foreground. */
export function fillHoles(mask: Uint8Array, w: number, h: number): Uint8Array {
  const out = mask.slice();
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (p: number) => { if (!mask[p] && !seen[p]) { seen[p] = 1; stack.push(p); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w, y = (p - x) / w;
    if (x > 0) push(p - 1); if (x < w - 1) push(p + 1); if (y > 0) push(p - w); if (y < h - 1) push(p + w);
  }
  for (let p = 0; p < w * h; p++) if (!mask[p] && !seen[p]) out[p] = 1;
  return out;
}

/** Keep only the largest 4-connected component. */
export function largestComponent(mask: Uint8Array, w: number, h: number): Uint8Array {
  const label = new Int32Array(w * h).fill(-1);
  let best = -1, bestSize = 0, id = 0;
  const sizes: number[] = [];
  for (let p = 0; p < w * h; p++) {
    if (!mask[p] || label[p] >= 0) continue;
    const stack = [p]; label[p] = id; let n = 0;
    while (stack.length) {
      const q = stack.pop()!; n++;
      const x = q % w, y = (q - x) / w;
      const nb = [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, y > 0 ? q - w : -1, y < h - 1 ? q + w : -1];
      for (const r of nb) if (r >= 0 && mask[r] && label[r] < 0) { label[r] = id; stack.push(r); }
    }
    sizes.push(n);
    if (n > bestSize) { bestSize = n; best = id; }
    id++;
  }
  const out = new Uint8Array(w * h);
  if (best >= 0) for (let p = 0; p < w * h; p++) if (label[p] === best) out[p] = 1;
  return out;
}

/** Downscale by an integer factor (box filter) — used to make component search fast. */
export function shrink(img: Gray, f: number): Gray {
  if (f <= 1) return img;
  const w = Math.floor(img.w / f), h = Math.floor(img.h / f);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) s += img.data[(y * f + j) * img.w + x * f + i];
    out[y * w + x] = s / (f * f);
  }
  return { w, h, data: out };
}

/**
 * Flat-field correction for scans: estimates the paper brightness locally (maximum over a window
 * wider than any piece) and rescales so paper becomes white. Leaves clean renders untouched.
 */
export function flatten(img: Gray): Gray {
  const B = Math.max(16, Math.round(Math.min(img.w, img.h) / 30));
  const bw = Math.ceil(img.w / B), bh = Math.ceil(img.h / B);
  const mx = new Float32Array(bw * bh);
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    // 98th percentile rather than the maximum, so a speck of white noise does not count as paper.
    const hist = new Uint32Array(256);
    let n = 0;
    for (let y = by * B; y < Math.min(img.h, (by + 1) * B); y++) for (let x = bx * B; x < Math.min(img.w, (bx + 1) * B); x++) { hist[img.data[y * img.w + x]]++; n++; }
    let acc = 0, v = 255;
    for (let k = 255; k >= 0; k--) { acc += hist[k]; if (acc >= n * 0.02) { v = k; break; } }
    mx[by * bw + bx] = v;
  }
  // Widen to a 5×5 block neighbourhood so large dark areas (black pieces, thick frames) keep the paper level.
  const bg = new Float32Array(bw * bh);
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    let m = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = bx + dx, y = by + dy;
      if (x >= 0 && y >= 0 && x < bw && y < bh) m = Math.max(m, mx[y * bw + x]);
    }
    bg[by * bw + bx] = Math.max(64, m);
  }
  let min = 255;
  for (const v of bg) min = Math.min(min, v);
  if (min >= 248) return img;
  const out = new Uint8Array(img.w * img.h);
  for (let y = 0; y < img.h; y++) {
    const fy = Math.min(bh - 1, Math.max(0, (y + 0.5) / B - 0.5)), y0 = Math.floor(fy), y1 = Math.min(bh - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < img.w; x++) {
      const fx = Math.min(bw - 1, Math.max(0, (x + 0.5) / B - 0.5)), x0 = Math.floor(fx), x1 = Math.min(bw - 1, x0 + 1), tx = fx - x0;
      const b = (bg[y0 * bw + x0] * (1 - tx) + bg[y0 * bw + x1] * tx) * (1 - ty) + (bg[y1 * bw + x0] * (1 - tx) + bg[y1 * bw + x1] * tx) * ty;
      out[y * img.w + x] = Math.min(255, Math.round((img.data[y * img.w + x] * 255) / b));
    }
  }
  return { w: img.w, h: img.h, data: out };
}
