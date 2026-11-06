import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { tokenize, parseHeaderLine, type TextLine, type DiagramMarker } from '../../src/chess/core/notation';
import { reconstruct } from '../../src/chess/core/reconstruct';
import { resolveMove, resolveDescriptive, normalizeMoveText, guessLanguage } from '../../src/chess/core/san';
import { writePgn, validatePgn, mainlineSans } from '../../src/chess/core/pgn';

const lines = (text: string, extra: Partial<TextLine> = {}): TextLine[] =>
  text.split('\n').map((t, i) => ({ text: t, page: 1, rect: [0.1, 0.05 * i, 0.8, 0.04] as [number, number, number, number], ...extra }));

function run(text: string, opts = {}, extra: Partial<TextLine> = {}) {
  return reconstruct(tokenize(lines(text, extra)), opts);
}

describe('move resolution', () => {
  const start = new Chess();
  it('reads figurines, dashes and long algebraic', () => {
    expect(normalizeMoveText('♘f3')).toBe('Nf3');
    expect(normalizeMoveText('♙e4')).toBe('e4');
    expect(normalizeMoveText('e8Q+')).toBe('e8=Q+');
    expect(normalizeMoveText('0–0–0')).toBe('O-O-O');
    const r = resolveMove('Ng1–f3', start);
    expect(r.kind === 'ok' && r.move.san).toBe('Nf3');
    expect(resolveMove('Ke2', start).kind).toBe('none');
  });
  it('reads German piece letters', () => {
    const r = resolveMove('Sf3', start, { language: 'de' });
    expect(r.kind === 'ok' && r.move.san).toBe('Nf3');
    expect(guessLanguage(['Sf3', 'Lb5', 'Dd1', 'Te1', 'Sc3'])).toBe('de');
    expect(guessLanguage(['Nf3', 'Bb5', 'Qd1', 'Re1'])).toBe('en');
  });
  it('reads English descriptive notation', () => {
    const c = new Chess();
    const seq = ['P-K4', 'P-K4', 'Kt-KB3', 'Kt-QB3', 'B-Kt5', 'P-QR3', 'BxKt', 'QPxB', 'Castles', 'P-B3'];
    const sans: string[] = [];
    for (const d of seq) {
      const r = resolveDescriptive(d, c);
      expect(r.kind, d).toBe('ok');
      if (r.kind === 'ok') { sans.push(r.move.san); c.move(r.move.san); }
    }
    expect(sans).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Bxc6', 'dxc6', 'O-O', 'f6']);
  });
  it('flags ambiguity instead of guessing', () => {
    const c = new Chess('4k3/8/8/2p1p3/3P4/8/8/4K3 w - - 0 1');
    const r = resolveDescriptive('PxP', c);
    expect(r.kind).toBe('ambiguous');
  });
  it('repairs OCR damage only when one legal move fits', () => {
    const c = new Chess();
    const r0 = resolveMove('&f3', c, { fuzzy: true });
    expect(r0.kind === 'ok' && r0.move.san).toBe('Nf3');
    c.move('e4'); c.move('e5');
    // After 1.e4 e5 both the knight and the queen can reach f3.
    expect(resolveMove('&f3', c, { fuzzy: true }).kind).toBe('ambiguous');
    const r2 = resolveMove('d4', c, { fuzzy: true });
    expect(r2.kind === 'ok' && r2.move.san).toBe('d4');
    const r3 = resolveMove('e+', c, { fuzzy: true });
    expect(r3.kind).toBe('none');
    // Without the fuzzy flag nothing is repaired.
    expect(resolveMove('&f3', c).kind).toBe('none');
  });
});

describe('header lines', () => {
  it('finds players, event and year', () => {
    expect(parseHeaderLine('Capablanca – Marshall, New York 1918')).toEqual({ White: 'Capablanca', Black: 'Marshall', Event: 'New York', Date: '1918.??.??' });
    expect(parseHeaderLine('Game 12: J. R. Capablanca - F. Marshall, New York 1909')?.BookGame).toBe('12');
    expect(parseHeaderLine('After the exchange - the endgame is drawn')).toBeNull();
    expect(parseHeaderLine('1.e4 e5 2.Nf3 – the main line')).toBeNull();
  });
});

describe('game reconstruction', () => {
  it('builds a game with commentary, annotations and a result', () => {
    const { games, orphans } = run(`Morphy – Duke of Brunswick and Count Isouard, Paris 1858
1.e4 e5 2.Nf3 d6 3.d4 Bg4?! This pin is premature. 4.dxe5 Bxf3 5.Qxf3 dxe5
6.Bc4 Nf6 7.Qb3! Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5! cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8
13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+! Nxb8 17.Rd8# 1-0`);
    expect(orphans).toEqual([]);
    expect(games).toHaveLength(1);
    const g = games[0];
    expect(g.issues).toEqual([]);
    expect(g.tree.headers.White).toBe('Morphy');
    expect(g.tree.headers.Result).toBe('1-0');
    expect(mainlineSans(g.tree)).toHaveLength(33);
    const bg4 = g.tree.findByPathKey('e4 e5 Nf3 d6 d4 Bg4')!;
    expect(bg4.nags).toEqual([6]);
    expect(bg4.comment).toBe('This pin is premature.');
    const pgn = writePgn(g.tree);
    expect(validatePgn(pgn).ok).toBe(true);
    expect(g.anchors[0].path).toBe('e4');
  });

  it('attaches numbered alternatives as variations', () => {
    const { games } = run(`1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6
Instead 5...Nc6 is the Classical, while after 5...g6 6.Be3 Bg7 7.f3 we reach the Yugoslav Attack.
6.Be3 e5`);
    const g = games[0];
    expect(mainlineSans(g.tree)).toEqual(['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Be3', 'e5']);
    const nc3 = g.tree.findByPathKey('e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3')!;
    expect(nc3.children.map((c) => c.san)).toEqual(['a6', 'Nc6', 'g6']);
    expect(g.tree.findByPathKey('e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3')).toBeTruthy();
  });

  it('handles parenthesised variations without numbers inside', () => {
    const { games } = run('1.d4 d5 2.c4 e6 (2...c6 3.Nf3 Nf6 the Slav) 3.Nc3 Nf6');
    const g = games[0];
    expect(mainlineSans(g.tree)).toEqual(['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6']);
    const c4 = g.tree.findByPathKey('d4 d5 c4')!;
    expect(c4.children.map((c) => c.san)).toEqual(['e6', 'c6']);
    expect(g.tree.findByPathKey('d4 d5 c4 c6 Nf3 Nf6')!.comment).toBe('the Slav');
  });

  it('reports an illegal move and never invents one', () => {
    const { games } = run('1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Bxe5 Nf6 5.O-O');
    const g = games[0];
    expect(mainlineSans(g.tree)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']);
    expect(g.issues[0].kind).toBe('illegal');
    expect(g.issues[0].raw).toBe('Bxe5');
    expect(g.issues[0].at).toBe('e4 e5 Nf3 Nc6 Bb5 a6');
  });

  it('starts a fragment from a diagram, taking the side to move from the text', () => {
    const d: DiagramMarker = { kind: 'diagram', id: 'd1', fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', page: 1, rect: [0, 0, 0.3, 0.3] };
    const toks = tokenize([...lines('Diagram 12. A classic back-rank theme.'), d, ...lines('31.Rd8# and wins.')]);
    const { games } = reconstruct(toks);
    expect(games).toHaveLength(1);
    expect(games[0].type).toBe('fragment');
    expect(games[0].tree.startFen).toBe('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 31');
    expect(games[0].diagrams.d1).toBe('');
    const d2: DiagramMarker = { ...d, id: 'd2', fen: '3r2k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1' };
    const g2 = reconstruct(tokenize([d2, ...lines('24...Rd1#')])).games[0];
    expect(g2.tree.startFen.split(' ')[1]).toBe('b');
  });

  it('links a diagram to the game position it shows', () => {
    const d: DiagramMarker = { kind: 'diagram', id: 'dx', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', page: 1, rect: [0, 0, 1, 1] };
    const { games } = reconstruct(tokenize([...lines('1.e4 e5'), d, ...lines('2.Nf3 Nc6')]));
    expect(games[0].diagrams.dx).toBe('e4 e5');
    expect(mainlineSans(games[0].tree)).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
  });

  it('splits two games by headers', () => {
    const { games } = run(`Smith – Jones, London 1900\n1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6 4.Qxf7# 1-0\nBrown – Green, Paris 1901\n1.d4 d5 1/2-1/2`);
    expect(games).toHaveLength(2);
    expect(games[1].tree.headers.White).toBe('Brown');
    expect(games[1].tree.headers.Result).toBe('1/2-1/2');
  });

  it('reads descriptive notation books', () => {
    const { games } = run('1. P-K4 P-K4 2. Kt-KB3 Kt-QB3 3. B-Kt5 P-QR3 4. B-R4 Kt-B3 5. Castles B-K2', { style: 'auto' });
    expect(mainlineSans(games[0].tree)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7']);
  });

  it('reads "13 Nf3" style numbering and ellipsis for black', () => {
    const { games } = run('1 e4 e5 2 Nf3 Nc6 3 Bc4 Bc5 Now 3 ... Nf6 is the Two Knights.');
    const bc4 = games[0].tree.findByPathKey('e4 e5 Nf3 Nc6 Bc4')!;
    expect(bc4.children.map((c) => c.san)).toEqual(['Bc5', 'Nf6']);
  });

  it('uses bold type to keep the main game as the main line', () => {
    const items: TextLine[] = [
      { text: '1.e4 e5 2.Nf3', page: 1, rect: [0, 0, 1, 0.05], bold: true },
      { text: '2.f4 is the King\'s Gambit: 2...exf4 3.Nf3', page: 1, rect: [0, 0.05, 1, 0.05] },
      { text: '2...Nc6 3.Bb5', page: 1, rect: [0, 0.1, 1, 0.05], bold: true },
      { text: 'Or 2...d6 3.d4 with an edge.', page: 1, rect: [0, 0.15, 1, 0.05] },
    ];
    const { games } = reconstruct(tokenize(items), { boldMain: true });
    expect(mainlineSans(games[0].tree)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']);
    const e5 = games[0].tree.findByPathKey('e4 e5')!;
    expect(e5.children.map((c) => c.san)).toEqual(['Nf3', 'f4']);
  });

  it('flags OCR repairs and learns a figurine glyph', () => {
    const glyphs = new Map<string, string>();
    const { games } = run('1.d4 d5 2.&f3 &f6 3.&c3 &c6 4.e3', { glyphs }, { ocr: true, conf: 0.8 });
    expect(mainlineSans(games[0].tree)).toEqual(['d4', 'd5', 'Nf3', 'Nf6', 'Nc3', 'Nc6', 'e3']);
    expect(games[0].issues.filter((i) => i.kind === 'repaired').length).toBeGreaterThanOrEqual(3);
    expect(glyphs.get('&')).toBe('N');
  });
});

describe('a real descriptive-notation book (Capablanca, Chess Fundamentals, 1921)', () => {
  // Text as printed in the Project Gutenberg edition (public domain), game 1 of Part II.
  const TEXT = `GAME 1. QUEEN'S GAMBIT DECLINED
(Match, 1909)
White: F. J. Marshall. Black: J. R. Capablanca.
1. P - Q 4 P - Q 4
2. P - Q B 4 P - K 3
3. Kt - Q B 3 Kt - K B 3
4. B - Kt 5 B - K 2
5. P - K 3 Kt - K 5
I had played this defence twice before in the match with good results.
6. B × B Q × B
7. B - Q 3
P × P is preferable for reasons that we shall soon see.
7. ........ Kt × Kt
8. P × Kt Kt - Q 2
Now P × P would be a better way to develop the game. The idea is that
after 8...P × P; 9 B × B P, P - Q Kt 3, followed by B - Kt 2, would give
Black's Bishop a powerful range.
9. Kt - B 3 O - O
No longer would 9...P × P; 10 B × P, P - Q Kt 3 be good, because
11 B - Kt 5 would prevent B - Kt 2 on account of Kt - K 5.
10. P × P P × P
11. Q - Kt 3 Kt - B 3
12. P - Q R 4 P - B 4
13. Q - R 3 P - Q Kt 3`;
  it('reads the game, its headers, the dotted black move and the inline variations', () => {
    const { games, orphans } = run(TEXT);
    expect(orphans).toEqual([]);
    expect(games).toHaveLength(1);
    const g = games[0];
    expect(g.issues.filter((i) => i.kind !== 'repaired')).toEqual([]);
    expect(g.tree.headers.White).toBe('F. J. Marshall');
    expect(g.tree.headers.Black).toBe('J. R. Capablanca');
    expect(mainlineSans(g.tree)).toEqual(['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e3', 'Ne4', 'Bxe7', 'Qxe7', 'Bd3', 'Nxc3', 'bxc3', 'Nd7', 'Nf3', 'O-O', 'cxd5', 'exd5', 'Qb3', 'Nf6', 'a4', 'c5', 'Qa3', 'b6']);
    // "after 8...P × P; 9 B × B P, P - Q Kt 3" → variation 8...dxc4 9.Bxc4 b6
    expect(g.tree.findByPathKey('d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 Ne4 Bxe7 Qxe7 Bd3 Nxc3 bxc3 dxc4 Bxc4 b6')).toBeTruthy();
    // "9...P × P; 10 B × P, P - Q Kt 3 ... 11 B - Kt 5"
    // 9...P×P replaces 9...O-O; "10 B×P" is read as the recapture and flagged for checking.
    expect(g.tree.findByPathKey('d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 Ne4 Bxe7 Qxe7 Bd3 Nxc3 bxc3 Nd7 Nf3 dxc4 Bxc4 b6 Bb5')).toBeTruthy();
    expect(g.issues.some((i) => i.kind === 'repaired' && /recapture Bxc4/.test(i.message))).toBe(true);
    // Prose that starts with a move stays prose.
    expect(g.tree.findByPathKey('d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 Ne4 Bxe7 Qxe7 Bd3')!.comment).toContain('is preferable');
    expect(validatePgn(writePgn(g.tree)).ok).toBe(true);
  });
});

describe('layout details', () => {
  it('joins a wrapped header and ignores captions', () => {
    const items: TextLine[] = [
      { text: 'Morphy – Duke of Brunswick and Count Isouard, Paris', page: 1, rect: [0, 0, 1, 0.04] },
      { text: '1858', page: 1, rect: [0, 0.04, 1, 0.04] },
      { text: '1.e4 e5 2.Nf3', page: 1, rect: [0, 0.08, 1, 0.04] },
      { text: 'The position after 2.Nf3', page: 1, rect: [0, 0.12, 1, 0.04], kind: 'caption' },
      { text: '2...d6', page: 1, rect: [0, 0.16, 1, 0.04] },
    ];
    const { games } = reconstruct(tokenize(items));
    expect(games[0].tree.headers.Date).toBe('1858.??.??');
    expect(games[0].tree.headers.Event).toBe('Paris');
    expect(games[0].tree.root.comment).toBeUndefined();
    expect(games[0].tree.findByPathKey('e4 e5 Nf3')!.comment).toBeUndefined();
    expect(mainlineSans(games[0].tree)).toEqual(['e4', 'e5', 'Nf3', 'd6']);
  });
});

describe('diagram cross-check', () => {
  it('links a diagram that differs from the game position on one square and reports it', () => {
    // After 1.e4 e5 the diagram shows the white queen on d1 as a black queen (a recognition slip).
    const d: DiagramMarker = { kind: 'diagram', id: 'dz', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBqKBNR w KQkq - 0 2', page: 1, rect: [0, 0, 1, 1] };
    const { games } = reconstruct(tokenize([...lines('1.e4 e5'), d, ...lines('2.Nf3 Nc6')]));
    expect(games[0].diagrams.dz).toBe('e4 e5');
    const iss = games[0].issues.find((i) => i.kind === 'diagram')!;
    expect(iss.message).toMatch(/d1/);
    expect(iss.suggestedFen!.split(' ')[0]).toBe('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR');
  });
});
