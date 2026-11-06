// Page layout: PDF text items (or OCR words) → lines in reading order, with columns, headings,
// captions and diagram positions. Pure functions, so they can be tested without a browser.
import type { DiagramMarker, TextLine } from '../core/notation';
import { boardFromFen, type Board, type PieceChar, placementFromBoard } from '../core/fen';

export interface TextItem {
  str: string;
  /** Left, top, width and font height in page pixels (y grows downward). */
  x: number; y: number; w: number; h: number;
  font?: string;
  bold?: boolean;
  conf?: number;
}

export interface PageDiagram { id: string; x: number; y: number; size: number; fen: string | null; source: 'vision' | 'font' }

export interface LayoutResult {
  items: Array<TextLine | DiagramMarker>;
  captions: Record<string, string>;
  labels: Record<string, { bottomRank?: string; leftFile?: string }>;
  headings: string[];
  bodyHeight: number;
}

interface Seg { items: TextItem[]; x0: number; x1: number; y: number; h: number; text: string; col: 'L' | 'R' | 'F' }

const FIGURINE_FONT = /figurin|fig\b|figur|chess|diagram|fritz|\bcb\b|cbase|usual|alpha|merida|leipzig|linares/i;

const median = (a: number[]) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };

function inside(it: TextItem, d: PageDiagram, pad: number): boolean {
  const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
  return cx > d.x - pad && cx < d.x + d.size + pad && cy > d.y - pad && cy < d.y + d.size + pad;
}

export function layoutPage(raw: TextItem[], W: number, H: number, page: number, diagrams: PageDiagram[], opts: { ocr?: boolean } = {}): LayoutResult {
  const labels: LayoutResult['labels'] = {};
  const items: TextItem[] = [];
  for (const it of raw) {
    if (!it.str.trim()) continue;
    const d = diagrams.find((dd) => inside(it, dd, dd.size * 0.08));
    if (d) {
      // Coordinates around the board: digits on the left, letters underneath.
      const t = it.str.trim();
      const lab = (labels[d.id] ??= {});
      if (/^[1-8]$/.test(t) && it.x < d.x + d.size * 0.1 && it.y + it.h > d.y + d.size * 0.85) lab.bottomRank = t;
      if (/^[a-h]$/.test(t) && it.y > d.y + d.size * 0.9 && it.x < d.x + d.size * 0.12) lab.leftFile = t;
      continue;
    }
    items.push(it);
  }
  const bodyHeight = median(items.map((i) => i.h)) || 10;

  // 1. Lines: items on the same baseline, split where a wide horizontal gap separates columns.
  items.sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: TextItem[][] = [];
  for (const it of items) {
    const row = rows.find((r) => Math.abs(r[0].y + r[0].h / 2 - (it.y + it.h / 2)) < Math.min(r[0].h, it.h) * 0.5);
    if (row) row.push(it); else rows.push([it]);
  }
  const segs: Seg[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    let cur: TextItem[] = [];
    const flush = () => { if (cur.length) segs.push(makeSeg(cur)); cur = []; };
    for (const it of row) {
      const prev = cur[cur.length - 1];
      if (prev && it.x - (prev.x + prev.w) > Math.max(prev.h, it.h) * 2.5) flush();
      cur.push(it);
    }
    flush();
  }

  // 2. Columns: a vertical strip in the middle of the page that no line crosses.
  const bins = 100;
  const cover = new Array(bins).fill(0);
  for (const s of segs) for (let b = Math.floor((s.x0 / W) * bins); b <= Math.min(bins - 1, Math.floor((s.x1 / W) * bins)); b++) cover[b]++;
  let gutter = -1;
  if (segs.length > 12) {
    let best = Infinity;
    for (let b = 30; b <= 70; b++) if (cover[b] < best) { best = cover[b]; gutter = b; }
    const left = segs.filter((s) => s.x1 / W * bins <= gutter).length, right = segs.filter((s) => s.x0 / W * bins >= gutter).length;
    if (!(best <= segs.length * 0.06 && left > segs.length * 0.2 && right > segs.length * 0.2)) gutter = -1;
  }
  const gx = gutter < 0 ? -1 : ((gutter + 0.5) / bins) * W;
  for (const s of segs) s.col = gx < 0 ? 'F' : s.x1 <= gx ? 'L' : s.x0 >= gx ? 'R' : 'F';

  // 3. Headings and captions.
  const headings: string[] = [];
  const captions: Record<string, string> = {};
  const kinds = new Map<Seg, TextLine['kind']>();
  let lastHeading: Seg | null = null;
  for (const s of [...segs].sort((a, b) => a.y - b.y)) {
    const t = s.text.trim();
    const isChapter = /^(chapter|part|lesson|section|kapitel|chapitre|cap[ií]tulo)\s+([0-9]+|[IVXLC]+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(t);
    const big = s.h > bodyHeight * 1.3 && t.length < 90 && !/^\d+\s*\.\s*[a-hKQRBNO]/.test(t) && /[A-Za-z]{3}/.test(t);
    if (isChapter || big) {
      // A heading that wraps onto a second line is one heading.
      const prev = lastHeading;
      if (prev && prev.col === s.col && s.y - prev.y < prev.h * 1.9 && Math.abs(s.h - prev.h) < prev.h * 0.25) headings[headings.length - 1] += ` ${t}`;
      else headings.push(t);
      kinds.set(s, 'heading'); lastHeading = s;
      continue;
    }
    for (const d of diagrams) {
      const below = s.y - (d.y + d.size);
      const overlaps = s.x1 > d.x && s.x0 < d.x + d.size;
      if (overlaps && below > -bodyHeight * 0.3 && below < Math.max(H * 0.05, bodyHeight * 3) && t.length < 140 && !captions[d.id]) {
        captions[d.id] = t; kinds.set(s, 'caption');
      }
    }
  }

  // 4. Reading order: full-width lines split the page into bands; in each band the left column
  // is read before the right. Diagrams take their place by position.
  type Entry = { y: number; col: 'L' | 'R' | 'F'; v: TextLine | DiagramMarker };
  const segOf = new Map<TextLine, Seg>();
  const entries: Entry[] = segs.map((s) => ({
    y: s.y, col: s.col,
    v: {
      text: s.text, page, rect: [s.x0 / W, s.y / H, (s.x1 - s.x0) / W, s.h / H] as [number, number, number, number],
      kind: kinds.get(s) ?? 'body', bold: s.items.every((i) => i.bold), boldWords: boldWords(s),
      // Figurine fonts (ChessBase, Quality Chess, Gambit, NIC books) may map piece symbols to
      // arbitrary characters; marking the line lets the reader infer them from legal moves.
      conf: s.items.some((i) => i.conf !== undefined) ? Math.min(...s.items.map((i) => i.conf ?? 1)) : s.items.some((i) => i.font && FIGURINE_FONT.test(i.font)) ? 0.97 : 1, ocr: !!opts.ocr,
    } satisfies TextLine,
  }));
  entries.forEach((e, i) => segOf.set(e.v as TextLine, segs[i]));
  for (const d of diagrams) {
    const cx = d.x + d.size / 2;
    entries.push({
      y: d.y, col: gx < 0 ? 'F' : cx < gx ? 'L' : 'R',
      v: { kind: 'diagram', id: d.id, fen: d.fen, page, rect: [d.x / W, d.y / H, d.size / W, d.size / H], caption: captions[d.id] },
    });
  }
  entries.sort((a, b) => a.y - b.y);
  const out: Array<TextLine | DiagramMarker> = [];
  let band: Entry[] = [];
  const flushBand = () => {
    out.push(...band.filter((e) => e.col !== 'R').map((e) => e.v), ...band.filter((e) => e.col === 'R').map((e) => e.v));
    band = [];
  };
  for (const e of entries) {
    if (e.col === 'F' && gx >= 0) { flushBand(); out.push(e.v); } else band.push(e);
  }
  flushBand();
  markParagraphs(out, segs, segOf, bodyHeight);
  return { items: out, captions, labels, headings, bodyHeight };
}

/**
 * First lines of paragraphs: indented, after a line that stopped short, after a larger gap, or
 * after a heading or diagram. Main-game moves in books start paragraphs; that is how a line of
 * play that resumes the game is told from one that continues a variation.
 */
function markParagraphs(out: Array<TextLine | DiagramMarker>, segs: Seg[], segOf: Map<TextLine, Seg>, bodyHeight: number): void {
  const cols = new Map<string, { left: number; right: number }>();
  for (const s of segs) {
    const c = cols.get(s.col) ?? { left: Infinity, right: -Infinity };
    c.left = Math.min(c.left, s.x0); c.right = Math.max(c.right, s.x1);
    cols.set(s.col, c);
  }
  let prev: { seg: Seg; line: TextLine } | null = null;
  let afterBreak = true;
  for (const it of out) {
    if ('kind' in it && it.kind === 'diagram') { afterBreak = true; continue; }
    const line = it as TextLine;
    if (line.kind === 'heading' || line.kind === 'caption') { afterBreak = true; prev = null; continue; }
    const seg = segOf.get(line);
    if (!seg) continue;
    const col = cols.get(seg.col)!;
    let para = afterBreak;
    if (!para && prev && prev.seg.col === seg.col) {
      const indent = seg.x0 - col.left > bodyHeight * 0.9;
      const shortPrev = col.right - prev.seg.x1 > bodyHeight * 4;
      const gap = seg.y - prev.seg.y > Math.max(prev.seg.h, seg.h) * 1.9;
      para = indent || shortPrev || gap;
    } else if (!prev) para = true;
    if (para) line.para = true;
    prev = { seg, line };
    afterBreak = false;
  }
}

function makeSeg(items: TextItem[]): Seg {
  let text = '';
  let prev: TextItem | null = null;
  for (const it of items) {
    if (prev) {
      const gap = it.x - (prev.x + prev.w);
      if (gap > Math.min(prev.h, it.h) * 0.12 && !text.endsWith(' ') && !it.str.startsWith(' ')) text += ' ';
    }
    text += it.str;
    prev = it;
  }
  const x0 = Math.min(...items.map((i) => i.x)), x1 = Math.max(...items.map((i) => i.x + i.w));
  return { items, x0, x1, y: Math.min(...items.map((i) => i.y)), h: median(items.map((i) => i.h)), text: text.replace(/\s+/g, ' ').trim(), col: 'F' };
}

/** Bold flag for each whitespace-separated word of a segment (books set main-line moves in bold). */
function boldWords(s: Seg): boolean[] | undefined {
  if (!s.items.some((i) => i.bold) || s.items.every((i) => i.bold)) return undefined;
  const out: boolean[] = [];
  for (const it of s.items) for (const _w of it.str.split(/\s+/).filter(Boolean)) out.push(!!it.bold);
  return out.length === s.text.split(/\s+/).filter(Boolean).length ? out : undefined;
}

/** True when a text layer is mostly unreadable (fonts without a Unicode map produce junk). */
export function looksGarbled(items: TextItem[]): boolean {
  const text = items.map((i) => i.str).join(' ');
  const letters = text.replace(/\s/g, '');
  if (letters.length < 40) return false;
  const good = (letters.match(/[A-Za-z0-9.,;:!?()'"\-–—…½♔-♟+#=À-ɏ]/g) ?? []).length;
  const words = text.split(/\s+/).filter((w) => /^[A-Za-z]{2,}$/.test(w)).length;
  return good / letters.length < 0.75 || words < letters.length / 40;
}

// ---- Diagrams typeset with a chess font (Linares/Alpha/Merida/Leipzig encoding) ----

const CHESS_FONT = /chess|merida|alpha|leipzig|linares|cases|diagram|usual|kingdom|marroquin|berlin|condal|magnetic|maya|mark|motif|alfonso|harlequin|lucena|tilburg/i;
const LIGHT: Record<string, PieceChar | ''> = { ' ': '', p: 'P', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K', o: 'p', m: 'n', v: 'b', t: 'r', w: 'q', l: 'k' };
const DARK: Record<string, PieceChar | ''> = { '+': '', P: 'P', N: 'N', B: 'B', R: 'R', Q: 'Q', K: 'K', O: 'p', M: 'n', V: 'b', T: 'r', W: 'q', L: 'k' };

/**
 * Diagrams set in a chess font arrive as eight text rows of square characters. Decodes the
 * common Linares encoding used by Alpha, Merida, Leipzig and similar fonts.
 */
export function findFontDiagrams(items: TextItem[]): Array<{ x: number; y: number; size: number; fen: string; used: TextItem[] }> {
  const chessItems = items.filter((i) => i.font && CHESS_FONT.test(i.font));
  if (chessItems.length < 8) return [];
  const rows: Array<{ y: number; x: number; w: number; h: number; sq: string; items: TextItem[] }> = [];
  const sorted = chessItems.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  for (const it of sorted) {
    const r = rows.find((rw) => Math.abs(rw.y - it.y) < it.h * 0.4 && it.x < rw.x + rw.w + it.h * 2);
    if (r) { r.items.push(it); r.w = Math.max(r.w, it.x + it.w - r.x); } else rows.push({ y: it.y, x: it.x, w: it.w, h: it.h, sq: '', items: [it] });
  }
  for (const r of rows) {
    r.items.sort((a, b) => a.x - b.x);
    r.sq = [...r.items.map((i) => i.str).join('')].filter((ch) => ch in LIGHT || ch in DARK).join('');
  }
  const out: Array<{ x: number; y: number; size: number; fen: string; used: TextItem[] }> = [];
  const good = rows.filter((r) => r.sq.length === 8);
  for (let i = 0; i + 8 <= good.length; i++) {
    const block = good.slice(i, i + 8);
    const h = block[0].h;
    if (block.some((r, k) => k > 0 && Math.abs(r.y - block[k - 1].y - h) > h * 0.5)) continue;
    const board: Board = block.map((r, rank) => [...r.sq].map((ch, file) => ((rank + file) % 2 === 0 ? LIGHT[ch] ?? DARK[ch] : DARK[ch] ?? LIGHT[ch]) ?? ''));
    const fen = `${placementFromBoard(board)} w - - 0 1`;
    void boardFromFen;
    const x = Math.min(...block.map((r) => r.x));
    out.push({ x, y: block[0].y, size: block[7].y + h - block[0].y, fen, used: block.flatMap((r) => r.items) });
    i += 7;
  }
  return out;
}

/**
 * Running heads and footers: text in the top or bottom margin that repeats on several pages (book
 * or chapter title, "Game 12" banners) or is just a page number.
 */
export function runningHeadFilter(pages: Array<{ items: Array<TextLine | DiagramMarker> }>): (l: TextLine) => boolean {
  const key = (t: string) => t.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
  const inMargin = (l: TextLine) => l.rect[1] < 0.08 || l.rect[1] + l.rect[3] > 0.92;
  const count = new Map<string, number>();
  for (const p of pages) {
    const seen = new Set<string>();
    for (const it of p.items) if (!('kind' in it && it.kind === 'diagram') && inMargin(it as TextLine)) seen.add(key((it as TextLine).text));
    for (const k of seen) count.set(k, (count.get(k) ?? 0) + 1);
  }
  const need = Math.max(2, Math.min(3, Math.ceil(pages.length / 4)));
  return (l) => inMargin(l) && (/^[\divxlc\s.\-–|]+$/i.test(l.text.trim()) || (count.get(key(l.text)) ?? 0) >= need);
}

/**
 * Paragraph starts from stored line rectangles (page fractions), for pages read before paragraph
 * detection existed, and as a second opinion: indented first line, previous line stopped short,
 * larger vertical gap, or after a heading, caption or diagram.
 */
export function markParagraphsFromRects(items: Array<TextLine | DiagramMarker>): void {
  const lines = items.filter((it) => !('kind' in it && it.kind === 'diagram')) as TextLine[];
  if (!lines.length) return;
  const rawCol = (l: TextLine) => (l.rect[0] + l.rect[2] <= 0.56 && l.rect[2] < 0.5 ? 'L' : l.rect[0] >= 0.44 && l.rect[2] < 0.5 ? 'R' : 'F');
  // Only a page with real columns has them (short lines on a one-column page are just short).
  const n = { L: 0, R: 0, F: 0 };
  for (const l of lines) if (l.kind !== 'heading') n[rawCol(l)]++;
  const twoCol = n.L >= 3 && n.R >= 3 && n.F <= (n.L + n.R) / 3;
  const colOf = (l: TextLine) => (twoCol ? rawCol(l) : 'F');
  const edges = new Map<string, { left: number; right: number }>();
  for (const l of lines) {
    if (l.kind === 'heading') continue;
    const c = colOf(l);
    const e = edges.get(c) ?? { left: 1, right: 0 };
    e.left = Math.min(e.left, l.rect[0]); e.right = Math.max(e.right, l.rect[0] + l.rect[2]);
    edges.set(c, e);
  }
  const hs = lines.map((l) => l.rect[3]).sort((a, b) => a - b);
  const h = hs[hs.length >> 1] || 0.015;
  let prev: TextLine | null = null;
  let afterBreak = true;
  for (const it of items) {
    if ('kind' in it && it.kind === 'diagram') { afterBreak = true; continue; }
    const l = it as TextLine;
    if (l.kind === 'heading' || l.kind === 'caption') { afterBreak = true; prev = null; continue; }
    const c = colOf(l), e = edges.get(c);
    let para = afterBreak || !prev || colOf(prev) !== c;
    if (!para && prev && e) {
      const indent = l.rect[0] - e.left > h * 0.9;
      const shortPrev = e.right - (prev.rect[0] + prev.rect[2]) > h * 4;
      const gap = l.rect[1] - prev.rect[1] > Math.max(prev.rect[3], l.rect[3]) * 1.9;
      para = indent || shortPrev || gap;
    }
    l.para = para || !!l.para;
    prev = l;
    afterBreak = false;
  }
}
