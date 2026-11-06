import { describe, expect, it } from 'vitest';
import { parsePgn, writePgn, validatePgn, mainlineSans } from '../../src/chess/core/pgn';
import { GameTree, positionStatus } from '../../src/chess/core/tree';

const IMMORTAL = `[Event "London casual"]
[Site "London ENG"]
[Date "1851.06.21"]
[Round "?"]
[White "Adolf Anderssen"]
[Black "Lionel Kieseritzky"]
[Result "1-0"]

1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5 8. Nh4 Qg5
9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8 15. Bxf4 Qf6
16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6 21. Nxg7+ Kd8
22. Qf6+ Nxf6 23. Be7# 1-0`;

describe('PGN', () => {
  it('parses a full game and reaches checkmate', () => {
    const [g] = parsePgn(IMMORTAL);
    expect(g.errors).toEqual([]);
    expect(g.tree.headers.White).toBe('Adolf Anderssen');
    const line = g.tree.mainline();
    expect(line).toHaveLength(45);
    const st = positionStatus(g.tree, line[line.length - 1]);
    expect(st.checkmate).toBe(true);
  });

  it('round-trips nested variations, comments and NAGs', () => {
    const src = `[Event "T"]\n\n{Start} 1. e4 e5 (1... c5 2. Nf3 (2. c3 d5) 2... d6 {Najdorf soon}) 2. Nf3!? $14 Nc6 (2... d6 {Philidor}) 3. Bb5 a6 *`;
    const [g] = parsePgn(src);
    expect(g.errors).toEqual([]);
    expect(g.tree.root.comment).toBe('Start');
    const e5 = g.tree.root.children[0].children[0];
    expect(e5.parent!.children.map((c) => c.san)).toEqual(['e5', 'c5']);
    const nf3 = e5.children[0];
    expect(nf3.nags).toEqual([5, 14]);
    const out = writePgn(g.tree);
    expect(validatePgn(out).ok).toBe(true);
    const [again] = parsePgn(out);
    expect(again.tree.size()).toBe(g.tree.size());
    expect(writePgn(again.tree)).toBe(out);
    expect(out).toContain('(1... c5 2. Nf3 (2. c3 d5) 2... d6 {Najdorf soon})');
  });

  it('reports illegal moves instead of skipping them', () => {
    const [g] = parsePgn('1. e4 e5 2. Ke3 Nc6 *');
    expect(g.errors[0].message).toMatch(/Ke3/);
    expect(mainlineSans(g.tree)).toEqual(['e4', 'e5']);
  });

  it('handles SetUp/FEN, castling with zeros and promotion', () => {
    const [g] = parsePgn('[SetUp "1"]\n[FEN "4k3/P7/8/8/8/8/8/R3K2R w KQ - 0 40"]\n\n40. a8=Q+ Kd7 41. 0-0-0+ *');
    expect(g.errors).toEqual([]);
    expect(mainlineSans(g.tree)).toEqual(['a8=Q+', 'Kd7', 'O-O-O+']);
    expect(writePgn(g.tree)).toContain('[FEN "4k3/P7/8/8/8/8/8/R3K2R w KQ - 0 40"]');
    expect(writePgn(g.tree)).toContain('40. a8=Q+ Kd7 41. O-O-O+');
  });

  it('parses several games and en passant', () => {
    const games = parsePgn('[Event "A"]\n\n1. e4 d5 2. e5 f5 3. exf6 *\n\n[Event "B"]\n\n1. d4 1-0');
    expect(games).toHaveLength(2);
    expect(mainlineSans(games[0].tree)).toEqual(['e4', 'd5', 'e5', 'f5', 'exf6']);
    expect(games[1].result).toBe('1-0');
  });

  it('detects stalemate and threefold repetition', () => {
    const [s] = parsePgn('[SetUp "1"]\n[FEN "7k/5Q2/6K1/8/8/8/8/8 w - - 0 1"]\n\n1. Qf6 *');
    const st = positionStatus(s.tree, s.tree.mainline()[0]);
    expect(st.stalemate).toBe(false);
    const [s2] = parsePgn('[SetUp "1"]\n[FEN "k7/8/1Q6/8/8/8/8/7K w - - 0 1"]\n\n1. Kg2 *');
    expect(positionStatus(s2.tree, s2.tree.mainline()[0]).stalemate).toBe(true);
    const [r] = parsePgn('1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8 *');
    const line = r.tree.mainline();
    expect(r.tree.isThreefold(line[line.length - 1])).toBe(true);
    expect(r.tree.isThreefold(line[line.length - 5])).toBe(false);
  });

  it('tree editing keeps the original line', () => {
    const t = new GameTree();
    const e4 = t.addMove(t.root, 'e4');
    const e5 = t.addMove(e4, 'e5');
    const c5 = t.addMove(e4, 'c5');
    expect(t.addMove(e4, 'e5')).toBe(e5);
    expect(t.isMainline(c5)).toBe(false);
    t.promote(c5);
    expect(t.isMainline(c5)).toBe(true);
    expect(t.pathKey(c5)).toBe('e4 c5');
    expect(t.findByPathKey('e4 e5')).toBe(e5);
    t.remove(e5);
    expect(e4.children).toEqual([c5]);
    expect(() => t.addMove(c5, 'Ke3')).toThrow();
  });
});
