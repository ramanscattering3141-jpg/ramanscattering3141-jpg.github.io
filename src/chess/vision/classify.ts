// Square-by-square piece recognition. Each square is compared with the empty squares of the
// same colour to find what is drawn on it; the outline (shape) and the ink inside it are matched
// against reference pieces — the bundled sets, plus pieces the user has confirmed in this book.
import { fillHoles, largestComponent, sample, otsu, type Gray } from './image';
import type { BoardRect } from './board';
import type { PieceChar } from '../core/fen';

export const CELL = 32;
const SHAPE = 20;
const INK = 12;

export interface Descriptor { shape: Uint8Array; ink: Float32Array; h: number; w: number; cy: number; dark: number; area: number }
export interface Template { piece: PieceChar; d: Descriptor; source: string }

export interface CellResult {
  piece: PieceChar | '';
  conf: number;
  /** Next-best reading, for the correction UI. */
  alt?: PieceChar | '';
  occupancy: number;
  descriptor?: Descriptor;
}

export interface Recognition {
  /** [rank 8 → 1][file a → h] as seen on the page (before any orientation flip). */
  cells: CellResult[][];
  conf: number;
}

export function cellImages(img: Gray, b: BoardRect): Float32Array[][] {
  const cs = b.size / 8;
  const m = cs * 0.05;
  const out: Float32Array[][] = [];
  for (let r = 0; r < 8; r++) {
    const row: Float32Array[] = [];
    for (let c = 0; c < 8; c++) row.push(sample(img, b.x + c * cs + m, b.y + r * cs + m, cs - 2 * m, cs - 2 * m, CELL));
    out.push(row);
  }
  return out;
}

function median(vals: number[]): number { const s = vals.slice().sort((a, b) => a - b); return s[s.length >> 1]; }

/**
 * An empty square of one colour. Empty squares look alike while occupied ones differ from each
 * other, so the largest group of mutually similar squares is taken as empty (this works even in
 * the opening position, where half the squares are occupied) and its pixelwise median is used.
 */
function background(cells: Float32Array[], coarse: Float32Array[]): Float32Array {
  const n = cells.length;
  const close = (a: Float32Array, b: Float32Array) => {
    let d = 0;
    for (let p = 0; p < a.length; p++) d += Math.abs(a[p] - b[p]);
    return d / a.length < 12;
  };
  // Similarity is judged on the coarse (8×8) squares, where print texture and hatching average out.
  const nb: number[][] = cells.map(() => []);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (close(coarse[i], coarse[j])) { nb[i].push(j); nb[j].push(i); }
  let seed = 0;
  for (let i = 1; i < n; i++) if (nb[i].length > nb[seed].length) seed = i;
  const group = nb[seed].length ? [seed, ...nb[seed]] : cells.map((_, k) => k);
  const out = new Float32Array(CELL * CELL);
  for (let p = 0; p < out.length; p++) out[p] = median(group.map((k) => cells[k][p]));
  return out;
}

/** Average-pool a CELL×CELL square to s×s. */
function pool(c: Float32Array, s: number): Float32Array {
  const f = CELL / s;
  const out = new Float32Array(s * s);
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) out[Math.floor(y / f) * s + Math.floor(x / f)] += c[y * CELL + x] / (f * f);
  return out;
}

export function describe(cell: Float32Array, bg: Float32Array | number, inkCell: Float32Array = cell): Descriptor | null {
  const n = CELL * CELL;
  const mask = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const b = typeof bg === 'number' ? bg : bg[p];
    mask[p] = Math.abs(cell[p] - b) > 55 ? 1 : 0;
  }
  let m = largestComponent(fillHoles(mask, CELL, CELL), CELL, CELL);
  m = fillHoles(m, CELL, CELL);
  let area = 0, x0 = CELL, y0 = CELL, x1 = -1, y1 = -1, sy = 0, darkN = 0;
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    if (!m[y * CELL + x]) continue;
    area++; sy += y;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (inkCell[y * CELL + x] < 110) darkN++;
  }
  if (area < n * 0.04) return null;
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const shape = new Uint8Array(SHAPE * SHAPE);
  const ink = new Float32Array(INK * INK);
  for (let j = 0; j < SHAPE; j++) for (let i = 0; i < SHAPE; i++) {
    const x = Math.min(CELL - 1, Math.floor(x0 + ((i + 0.5) * bw) / SHAPE));
    const y = Math.min(CELL - 1, Math.floor(y0 + ((j + 0.5) * bh) / SHAPE));
    shape[j * SHAPE + i] = m[y * CELL + x];
  }
  const cnt = new Float32Array(INK * INK);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!m[y * CELL + x]) continue;
    const k = Math.min(INK - 1, Math.floor(((y - y0) * INK) / bh)) * INK + Math.min(INK - 1, Math.floor(((x - x0) * INK) / bw));
    cnt[k]++;
    if (inkCell[y * CELL + x] < 110) ink[k]++;
  }
  for (let k = 0; k < ink.length; k++) ink[k] = cnt[k] ? ink[k] / cnt[k] : 0;
  return { shape, ink, h: bh / CELL, w: bw / CELL, cy: sy / area / CELL, dark: darkN / area, area: area / n };
}

export function distance(a: Descriptor, b: Descriptor): number {
  let inter = 0, uni = 0;
  for (let i = 0; i < a.shape.length; i++) { inter += a.shape[i] & b.shape[i]; uni += a.shape[i] | b.shape[i]; }
  const iou = uni ? inter / uni : 0;
  let ink = 0;
  for (let i = 0; i < a.ink.length; i++) ink += Math.abs(a.ink[i] - b.ink[i]);
  ink /= a.ink.length;
  return (1 - iou) + 0.8 * ink + 1.2 * Math.abs(a.h - b.h) + 0.6 * Math.abs(a.w - b.w) + 1.5 * Math.abs(a.dark - b.dark);
}

const PIECES: Array<[string, PieceChar]> = [['wK', 'K'], ['wQ', 'Q'], ['wR', 'R'], ['wB', 'B'], ['wN', 'N'], ['wP', 'P'], ['bK', 'k'], ['bQ', 'q'], ['bR', 'r'], ['bB', 'b'], ['bN', 'n'], ['bP', 'p']];

function decode(b64: string): Uint8Array {
  if (typeof atob === 'function') { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  return new Uint8Array((globalThis as unknown as { Buffer: { from(s: string, e: string): Uint8Array } }).Buffer.from(b64, 'base64'));
}

export interface TemplateFile { size: number; sets: Record<string, Record<string, { gray: string; alpha: string }>> }

/** The reference piece image composed on a plain background (for building descriptors and test boards). */
export function templateImage(file: TemplateFile, set: string, key: string): { gray: Uint8Array; alpha: Uint8Array; size: number } {
  const t = file.sets[set][key];
  return { gray: decode(t.gray), alpha: decode(t.alpha), size: file.size };
}

export function builtinTemplates(file: TemplateFile, exclude: string[] = []): Template[] {
  const out: Template[] = [];
  for (const set of Object.keys(file.sets)) {
    if (exclude.includes(set)) continue;
    for (const [key, piece] of PIECES) {
      const { gray: g, alpha: a, size } = templateImage(file, set, key);
      const img: Gray = { w: size, h: size, data: new Uint8Array(size * size) };
      for (let i = 0; i < size * size; i++) img.data[i] = Math.round((g[i] * a[i] + 255 * (255 - a[i])) / 255);
      const m = size * 0.05;
      const cell = sample(img, m, m, size - 2 * m, size - 2 * m, CELL);
      const d = describe(cell, 255);
      if (d) out.push({ piece, d, source: set });
    }
  }
  return out;
}

/** Recognise all 64 squares. `learned` templates (from this book) are preferred when close. */
export function recognize(img: Gray, b: BoardRect, templates: Template[], learned: Template[] = []): Recognition {
  const raw = cellImages(img, b);
  const lightCells: Float32Array[] = [], darkCells: Float32Array[] = [];
  const lightCoarse: Float32Array[] = [], darkCoarse: Float32Array[] = [];
  const cells = raw;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const light = (r + c) % 2 === 0;
    (light ? lightCells : darkCells).push(cells[r][c]);
    (light ? lightCoarse : darkCoarse).push(pool(cells[r][c], 8));
  }
  const bgL = background(lightCells, lightCoarse), bgD = background(darkCells, darkCoarse);
  // Occupancy: how different each square is from an empty one of its colour.
  const occ: number[] = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const cell = cells[r][c], bg = (r + c) % 2 === 0 ? bgL : bgD;
    let s2 = 0, n = 0;
    for (let y = 4; y < CELL - 4; y++) for (let x = 4; x < CELL - 4; x++) { s2 += Math.abs(cell[y * CELL + x] - bg[y * CELL + x]); n++; }
    occ.push(s2 / n / 255);
  }
  const thr = Math.min(0.07, Math.max(0.035, otsu(occ, 128, 0, 0.5) * 0.5));
  const all = [...learned, ...templates];
  const result: CellResult[][] = [];
  let confSum = 0;
  for (let r = 0; r < 8; r++) {
    const row: CellResult[] = [];
    for (let c = 0; c < 8; c++) {
      const o = occ[r * 8 + c];
      const d = o > thr ? describe(cells[r][c], (r + c) % 2 === 0 ? bgL : bgD, raw[r][c]) : null;
      if (!d) { const conf = Math.min(1, Math.max(0.5, 1 - o / thr / 2)); row.push({ piece: '', conf, occupancy: o }); confSum += conf; continue; }
      const best = new Map<PieceChar, number>();
      for (const t of all) {
        const dist = distance(d, t.d) - (t.source === 'learned' ? 0.08 : 0);
        if (dist < (best.get(t.piece) ?? Infinity)) best.set(t.piece, dist);
      }
      const ranked = [...best.entries()].sort((a, b) => a[1] - b[1]);
      const [p1, d1] = ranked[0];
      const [p2, d2] = ranked[1] ?? ['', d1 + 1];
      const conf = Math.max(0, Math.min(1, (d2 - d1) / Math.max(0.05, d2) * 2.5));
      row.push({ piece: p1, conf, alt: p2 as PieceChar, occupancy: o, descriptor: d });
      confSum += conf;
    }
    result.push(row);
  }
  fixKings(result, all);
  return { cells: result, conf: confSum / 64 };
}

/** Exactly one king per side: if none was read, take the piece of that colour that looks most like a king. */
function fixKings(cells: CellResult[][], templates: Template[]): void {
  for (const [king, isSide] of [['K', (p: string) => p !== '' && p === p.toUpperCase()], ['k', (p: string) => p !== '' && p === p.toLowerCase()]] as const) {
    const flat = cells.flat();
    const kings = flat.filter((c) => c.piece === king);
    const kingT = templates.filter((t) => t.piece === king);
    const kd = (c: CellResult) => (c.descriptor ? Math.min(...kingT.map((t) => distance(c.descriptor!, t.d))) : Infinity);
    if (kings.length === 0) {
      const cands = flat.filter((c) => isSide(c.piece) && c.descriptor).sort((a, b) => kd(a) - kd(b));
      if (cands[0] && kd(cands[0]) < 1.2) { cands[0].alt = cands[0].piece; cands[0].piece = king; cands[0].conf = Math.min(cands[0].conf, 0.4); }
    } else if (kings.length > 1) {
      kings.sort((a, b) => kd(a) - kd(b));
      for (const k of kings.slice(1)) { const alt = k.alt && k.alt !== king ? k.alt : (king === 'K' ? 'Q' : 'q'); k.alt = king; k.piece = alt as PieceChar; k.conf = Math.min(k.conf, 0.4); }
    }
  }
}

/** Turn a confirmed square into a learned template for this book. */
export function learnTemplate(d: Descriptor, piece: PieceChar): Template { return { piece, d, source: 'learned' }; }

export function serializeDescriptor(d: Descriptor): { shape: number[]; ink: number[]; h: number; w: number; cy: number; dark: number; area: number } {
  return { shape: [...d.shape], ink: [...d.ink], h: d.h, w: d.w, cy: d.cy, dark: d.dark, area: d.area };
}
export function deserializeDescriptor(o: ReturnType<typeof serializeDescriptor>): Descriptor {
  return { shape: Uint8Array.from(o.shape), ink: Float32Array.from(o.ink), h: o.h, w: o.w, cy: o.cy, dark: o.dark, area: o.area };
}
