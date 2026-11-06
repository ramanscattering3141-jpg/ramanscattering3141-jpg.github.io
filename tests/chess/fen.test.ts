import { describe, expect, it } from 'vitest';
import { checkPosition, boardFromFen, buildFen, possibleCastling, positionKey } from '../../src/chess/core/fen';

describe('FEN', () => {
  it('accepts the start position and round-trips the board', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(checkPosition(fen).ok).toBe(true);
    const b = boardFromFen(fen);
    expect(buildFen(b, { castling: possibleCastling(b) })).toBe(fen);
  });
  it('rejects impossible diagrams', () => {
    expect(checkPosition('8/8/8/8/8/8/8/K7 w - - 0 1').errors.join()).toMatch(/Black must have exactly one king/);
    expect(checkPosition('k7/8/8/8/8/8/P7/K7 w - - 0 1').ok).toBe(true);
    expect(checkPosition('kP6/8/8/8/8/8/8/K7 w - - 0 1').errors.join()).toMatch(/first or eighth rank/);
    expect(checkPosition('8/8/8/3kK3/8/8/8/8 w - - 0 1').errors.join()).toMatch(/adjacent/);
    // Black king attacked by the rook while White is to move.
    expect(checkPosition('k6R/8/8/8/8/8/8/K7 w - - 0 1').errors.join()).toMatch(/in check but it is not their move/);
    expect(checkPosition('k7/8/8/8/8/8/PPPPPPPP/KQQQQQQQ w - - 0 1').ok).toBe(false);
  });
  it('position keys ignore move counters', () => {
    expect(positionKey('8/8/8/8/8/8/8/K6k w - - 12 40')).toBe('8/8/8/8/8/8/8/K6k w - -');
  });
});
