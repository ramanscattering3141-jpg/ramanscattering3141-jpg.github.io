import { describe, expect, it } from 'vitest';
import { parseInfo, formatScore, winPercent, judgeMove } from '../../src/chess/engine/uci';
import { terminalResult } from '../../src/chess/engine/engine';

describe('UCI', () => {
  it('converts side-to-move scores to White perspective', () => {
    const l = 'info depth 20 seldepth 28 multipv 2 score cp 35 nodes 123456 nps 900000 time 137 pv e7e5 g1f3';
    expect(parseInfo(l, true)!.score).toEqual({ cp: 35 });
    const b = parseInfo(l, false)!;
    expect(b.score).toEqual({ cp: -35 });
    expect(b.multipv).toBe(2);
    expect(b.pv).toEqual(['e7e5', 'g1f3']);
    expect(parseInfo('info depth 5 score mate -3 pv a1a2', false)!.score).toEqual({ mate: 3 });
    expect(parseInfo('info depth 5 score cp 10 lowerbound pv a1a2', true)!.bound).toBe('lower');
    expect(parseInfo('info string NNUE evaluation', true)).toBeNull();
  });
  it('formats scores', () => {
    expect(formatScore({ cp: 125 })).toBe('+1.25');
    expect(formatScore({ cp: -210 })).toBe('−2.10');
    expect(formatScore({ cp: 0 })).toBe('0.00');
    expect(formatScore({ mate: 3 })).toBe('M3');
    expect(formatScore({ mate: -2 })).toBe('−M2');
  });
  it('judges moves by lost winning chances', () => {
    expect(winPercent({ cp: 0 })).toBeCloseTo(50);
    expect(judgeMove({ cp: 50 }, { cp: -400 }, true, false).judgement).toBe('blunder');
    expect(judgeMove({ cp: 30 }, { cp: 20 }, true, true).judgement).toBe('best');
    expect(judgeMove({ cp: -30 }, { cp: 300 }, false, false).judgement).toBe('mistake');
  });
  it('does not search finished positions', () => {
    const s = { flavor: 'lite-single' as const, multipv: 1, threads: 1, hash: 16, limits: {} };
    const mate = terminalResult('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3', s)!;
    expect(mate.terminal).toBe('checkmate');
    expect(mate.lines[0].score).toEqual({ mate: 0, winner: 'b' });
    expect(terminalResult('k7/8/1Q6/8/8/8/8/7K b - - 0 1', s)!.terminal).toBe('stalemate');
    expect(terminalResult('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', s)).toBeNull();
  });
});
