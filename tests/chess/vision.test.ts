import { describe, expect, it } from 'vitest';
import file from '../../src/chess/data/piece-templates.json';
import { builtinTemplates, recognize, learnTemplate, type TemplateFile } from '../../src/chess/vision/classify';
import { detectBoards } from '../../src/chess/vision/board';
import { synthBoard } from './synth';
import { boardFromFen } from '../../src/chess/core/fen';

const F = file as TemplateFile;
const POSITIONS = [
  'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
  '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
  'r2q1rk1/pp2bppp/2n1bn2/3p4/3P4/2NBBN2/PP3PPP/R2Q1RK1 w - - 0 11',
  '8/8/4k3/3p4/3P4/4K3/8/8 w - - 0 1',
];

function accuracy(set: string, exclude: string[], dark: 'hatch' | 'grey', cell = 48) {
  const templates = builtinTemplates(F, exclude);
  let right = 0, total = 0, occRight = 0;
  for (const fen of POSITIONS) {
    const s = synthBoard(F, set, fen, { dark, cell });
    const boards = detectBoards(s.img);
    expect(boards.length, `board found (${set}, ${dark})`).toBe(1);
    const b = boards[0];
    expect(Math.abs(b.x - s.x)).toBeLessThanOrEqual(3);
    expect(Math.abs(b.size - s.size)).toBeLessThanOrEqual(5);
    const rec = recognize(s.img, b, templates);
    const truth = boardFromFen(fen);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      total++;
      if (rec.cells[r][c].piece === truth[r][c]) right++;
      if (!!rec.cells[r][c].piece === !!truth[r][c]) occRight++;
    }
  }
  return { acc: right / total, occ: occRight / total };
}

describe('diagram recognition', () => {
  it('finds no board on a text-only page', () => {
    const s = synthBoard(F, 'cburnett', '8/8/8/8/8/8/8/8 w - - 0 1', { frame: 0, dark: 'grey' });
    // Blank out the board area: only text remains.
    for (let i = 0; i < s.img.data.length; i++) { const x = i % s.img.w, y = (i / s.img.w) | 0; if (x >= s.x - 5 && y >= s.y - 5 && x < s.x + s.size + 5 && y < s.y + s.size + 5) s.img.data[i] = 255; }
    expect(detectBoards(s.img)).toEqual([]);
  });

  for (const dark of ['hatch', 'grey'] as const) {
    it(`reads every square with the same piece set (${dark} squares)`, () => {
      const { acc, occ } = accuracy('merida', [], dark);
      expect(occ).toBe(1);
      expect(acc).toBe(1);
    });
    it(`generalises to an unseen piece set (${dark} squares)`, () => {
      const { acc, occ } = accuracy('merida', ['merida'], dark);
      expect(occ).toBe(1);
      expect(acc).toBeGreaterThan(0.9);
    });
  }

  it('works at small print sizes and with noise', () => {
    const templates = builtinTemplates(F);
    const fen = POSITIONS[2];
    const s = synthBoard(F, 'cburnett', fen, { cell: 26, noise: 30 });
    const [b] = detectBoards(s.img);
    const rec = recognize(s.img, b, templates);
    const truth = boardFromFen(fen);
    let right = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (rec.cells[r][c].piece === truth[r][c]) right++;
    expect(right / 64).toBeGreaterThan(0.95);
  });

  it('learned templates from a corrected diagram fix the rest of the book', () => {
    const base = builtinTemplates(F, ['chessnut']);
    const s1 = synthBoard(F, 'chessnut', POSITIONS[2]);
    const r1 = recognize(s1.img, detectBoards(s1.img)[0], base);
    const truth = boardFromFen(POSITIONS[2]);
    const learned = r1.cells.flat().map((c, i) => (c.descriptor && truth[(i / 8) | 0][i % 8] ? learnTemplate(c.descriptor, truth[(i / 8) | 0][i % 8] as never) : null)).filter(Boolean) as never[];
    const s2 = synthBoard(F, 'chessnut', POSITIONS[0]);
    const r2 = recognize(s2.img, detectBoards(s2.img)[0], base, learned);
    const t2 = boardFromFen(POSITIONS[0]);
    let right = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (r2.cells[r][c].piece === t2[r][c]) right++;
    expect(right).toBe(64);
  });
});
