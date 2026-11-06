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

import { guessOrientation, sideFromCaption, diagramPosition } from '../../src/chess/vision/position';
import { flipBoard } from '../../src/chess/core/fen';
describe('diagram positions', () => {
  it('guesses orientation and reads captions', () => {
    const b = boardFromFen('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3');
    expect(guessOrientation(b).orientation).toBe('white');
    expect(guessOrientation(flipBoard(b)).orientation).toBe('black');
    expect(guessOrientation(flipBoard(b), { bottomRank: '1' }).orientation).toBe('white');
    expect(sideFromCaption('Black to play and win')).toBe('b');
    expect(sideFromCaption('Diagram 4: White to move')).toBe('w');
    expect(sideFromCaption('Position after 12...Nf6')).toBeNull();
  });
  it('infers the side to move when one king is in check', () => {
    const p = diagramPosition(boardFromFen('k6R/8/8/8/8/8/8/K7 w - - 0 1'), null);
    expect(p.fen.split(' ')[1]).toBe('b');
    expect(p.turnKnown).toBe(true);
    expect(diagramPosition(boardFromFen('8/8/8/8/8/8/8/K7 w - - 0 1'), 'w').errors.length).toBeGreaterThan(0);
  });
});
