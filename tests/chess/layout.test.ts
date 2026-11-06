import { describe, expect, it } from 'vitest';
import { layoutPage, findFontDiagrams, looksGarbled, type TextItem } from '../../src/chess/pdf/layout';

const item = (str: string, x: number, y: number, h = 10, extra: Partial<TextItem> = {}): TextItem => ({ str, x, y, w: str.length * h * 0.5, h, ...extra });

describe('page layout', () => {
  it('reads two columns left then right, with full-width headings first', () => {
    const items: TextItem[] = [item('Chapter 3 The Ruy Lopez', 100, 40, 20)];
    for (let i = 0; i < 10; i++) { items.push(item(`left ${i} words here`, 50, 100 + i * 14)); items.push(item(`right ${i} words here`, 330, 100 + i * 14)); }
    const r = layoutPage(items, 600, 800, 7, []);
    const texts = r.items.map((x) => ('text' in x ? x.text : 'D'));
    expect(texts[0]).toBe('Chapter 3 The Ruy Lopez');
    expect(texts[1]).toBe('left 0 words here');
    expect(texts[10]).toBe('left 9 words here');
    expect(texts[11]).toBe('right 0 words here');
    expect(r.headings).toEqual(['Chapter 3 The Ruy Lopez']);
  });
  it('joins a heading that wraps onto two lines', () => {
    const items = [item('Chapter 2 Back-Rank', 50, 40, 20), item('Combinations', 50, 64, 20), ...[0, 1, 2, 3, 4].map((k) => item('Body text here', 50, 120 + k * 14))];
    expect(layoutPage(items, 600, 800, 2, []).headings).toEqual(['Chapter 2 Back-Rank Combinations']);
  });
  it('places diagrams in reading order, reads captions and coordinates', () => {
    const items = [item('1.e4 e5 2.Nf3', 50, 50), item('1', 40, 390), item('a', 52, 405), item('White to move', 60, 420), item('2...Nc6 3.Bb5', 50, 460)];
    const r = layoutPage(items, 600, 800, 1, [{ id: 'd1', x: 50, y: 100, size: 300, fen: null, source: 'vision' }]);
    expect(r.items.map((x) => ('text' in x ? x.text : 'kind' in x && x.kind === 'diagram' ? 'DIAGRAM' : '?'))).toEqual(['1.e4 e5 2.Nf3', 'DIAGRAM', 'White to move', '2...Nc6 3.Bb5']);
    expect(r.captions.d1).toBe('White to move');
    expect(r.labels.d1).toEqual({ bottomRank: '1', leftFile: 'a' });
  });
  it('joins items into words and keeps bold words', () => {
    const items = [item('12.', 10, 10, 10, { bold: true }), item('Nf3', 28, 10, 10, { bold: true }), item('is', 50, 10), item('best', 62, 10)];
    const r = layoutPage(items, 600, 800, 1, []);
    const line = r.items[0] as { text: string; boldWords?: boolean[] };
    expect(line.text).toBe('12. Nf3 is best');
    expect(line.boldWords).toEqual([true, true, false, false]);
  });
  it('decodes a chess-font diagram', () => {
    const rows = ['!""""""""#', '$tMvWlVmT%', '$OoOoOoOo%', '$ + + + +%', '$+ + + + %', '$ + + + +%', '$+ + + + %', '$pPpPpPpP%', '$RnBqKbNr%', '/(((((((()'];
    const items = rows.map((r, i) => item(r, 100, 100 + i * 20, 20, { font: 'ABCDEF+ChessMerida' }));
    const d = findFontDiagrams(items);
    expect(d).toHaveLength(1);
    expect(d[0].fen.split(' ')[0]).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
    // Ordinary prose in a text font is never taken for a diagram.
    expect(findFontDiagrams(rows.map((r, i) => item(r, 100, 100 + i * 20, 20, { font: 'Times-Roman' })))).toEqual([]);
  });
  it('spots a garbled text layer', () => {
    expect(looksGarbled([item('\u0003\u0007\u0012\u0014\u0016\u0019 \u001b\u001c\u001d'.repeat(10), 0, 0)])).toBe(true);
    expect(looksGarbled([item('The knight on f3 defends the king and controls the centre squares d4 and e5 nicely.', 0, 0)])).toBe(false);
  });
});

import { runningHeadFilter } from '../../src/chess/pdf/layout';
describe('running heads', () => {
  it('drops repeated margin text and page numbers but keeps body text', () => {
    const page = (n: number, extra: string) => ({ items: [
      { text: 'Chapter 3 – Defence', page: n, rect: [0.3, 0.03, 0.4, 0.02] as [number, number, number, number] },
      { text: extra, page: n, rect: [0.1, 0.4, 0.8, 0.03] as [number, number, number, number] },
      { text: String(100 + n), page: n, rect: [0.48, 0.95, 0.04, 0.02] as [number, number, number, number] },
    ] });
    const pages = [page(1, '21.Rxe4 Qxe4'), page(2, '22.Qd3 Qxd3'), page(3, '23.cxd3 Kf8')];
    const f = runningHeadFilter(pages);
    expect(f(pages[1].items[0] as never)).toBe(true);
    expect(f(pages[1].items[2] as never)).toBe(true);
    expect(f(pages[1].items[1] as never)).toBe(false);
  });
});

import { markParagraphsFromRects } from '../../src/chess/pdf/layout';
describe('paragraphs from stored lines', () => {
  it('finds indented, after-short-line and after-gap paragraph starts', () => {
    const L = (text: string, x: number, y: number, w: number) => ({ text, page: 1, rect: [x, y, w, 0.015] as [number, number, number, number] });
    const items = [L('1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5', 0.1, 0.1, 0.8), L('7.Bb3 d6', 0.1, 0.12, 0.2), L('Instead 7...O-O is common nowadays', 0.13, 0.14, 0.77), L('and keeps more options.', 0.1, 0.16, 0.3), L('8.c3 O-O', 0.1, 0.21, 0.2)];
    markParagraphsFromRects(items);
    expect(items.map((l) => !!(l as { para?: boolean }).para)).toEqual([true, false, true, false, true]);
  });
});
