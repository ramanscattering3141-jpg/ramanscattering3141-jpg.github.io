// Synthetic book-style diagrams for recogniser tests: a framed board with hatched or grey dark
// squares and pieces drawn from one of the bundled sets.
import { boardFromFen } from '../../src/chess/core/fen';
import { templateImage, type TemplateFile } from '../../src/chess/vision/classify';
import type { Gray } from '../../src/chess/vision/image';

export interface SynthOpts { cell?: number; dark?: 'hatch' | 'grey'; frame?: number; margin?: number; pageW?: number; pageH?: number; noise?: number; text?: boolean }

export function synthBoard(file: TemplateFile, set: string, fen: string, o: SynthOpts = {}): { img: Gray; x: number; y: number; size: number } {
  const cell = o.cell ?? 48, frame = o.frame ?? 3, margin = o.margin ?? 60;
  const size = cell * 8;
  const W = o.pageW ?? size + 2 * margin + 200, H = o.pageH ?? size + 2 * margin + 300;
  const img: Gray = { w: W, h: H, data: new Uint8Array(W * H).fill(255) };
  const x0 = margin + 100, y0 = margin + 150;
  const set1 = (x: number, y: number, v: number) => { if (x >= 0 && y >= 0 && x < W && y < H) img.data[y * W + x] = v; };
  // Frame.
  for (let k = 1; k <= frame; k++) for (let i = -k; i < size + k; i++) { set1(x0 + i, y0 - k, 0); set1(x0 + i, y0 + size - 1 + k, 0); set1(x0 - k, y0 + i, 0); set1(x0 + size - 1 + k, y0 + i, 0); }
  // Squares.
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if ((r + c) % 2 === 0) continue;
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
      const X = x0 + c * cell + x, Y = y0 + r * cell + y;
      if (o.dark === 'grey') set1(X, Y, 175);
      else if ((X + Y) % 4 === 0) set1(X, Y, 40);
    }
  }
  // Fake paragraph text above and below.
  if (o.text !== false) for (let line = 0; line < 4; line++) for (let x = 20; x < W - 20; x++) {
    if ((x * 7 + line) % 11 < 6) for (let y = 0; y < 7; y++) { set1(x, 30 + line * 14 + y, 30); set1(x, H - 90 + line * 14 + y, 30); }
  }
  const b = boardFromFen(fen);
  const keys: Record<string, string> = { K: 'wK', Q: 'wQ', R: 'wR', B: 'wB', N: 'wN', P: 'wP', k: 'bK', q: 'bQ', r: 'bR', b: 'bB', n: 'bN', p: 'bP' };
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = b[r][c];
    if (!p) continue;
    const t = templateImage(file, set, keys[p]);
    for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
      // Bilinear sample of the template.
      const fx = (x + 0.5) * (t.size / cell) - 0.5, fy = (y + 0.5) * (t.size / cell) - 0.5;
      const ix = Math.max(0, Math.min(t.size - 2, Math.floor(fx))), iy = Math.max(0, Math.min(t.size - 2, Math.floor(fy)));
      const ax = fx - ix, ay = fy - iy;
      const g = (i: number, j: number, arr: Uint8Array) => arr[j * t.size + i];
      const bil = (arr: Uint8Array) => (g(ix, iy, arr) * (1 - ax) + g(ix + 1, iy, arr) * ax) * (1 - ay) + (g(ix, iy + 1, arr) * (1 - ax) + g(ix + 1, iy + 1, arr) * ax) * ay;
      const a = Math.max(0, Math.min(1, bil(t.alpha) / 255));
      if (a <= 0.02) continue;
      const X = x0 + c * cell + x, Y = y0 + r * cell + y;
      const under = img.data[Y * W + X];
      set1(X, Y, Math.round(bil(t.gray) * a + under * (1 - a)));
    }
  }
  if (o.noise) { let s = 7; for (let i = 0; i < img.data.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; img.data[i] = Math.max(0, Math.min(255, img.data[i] + ((s % 1000) / 1000 - 0.5) * o.noise)); } }
  return { img, x: x0, y: y0, size };
}
