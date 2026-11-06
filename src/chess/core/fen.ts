// FEN validation, construction from an 8×8 board, and position keys for search.
import { Chess, validateFen } from 'chess.js';

export type PieceChar = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P' | 'k' | 'q' | 'r' | 'b' | 'n' | 'p';
/** board[rank][file], rank 0 = 8th rank (top, as in FEN), file 0 = a-file. '' = empty. */
export type Board = Array<Array<PieceChar | ''>>;

export interface FenCheck { ok: boolean; errors: string[]; warnings: string[] }

export function emptyBoard(): Board { return Array.from({ length: 8 }, () => Array(8).fill('') as Array<PieceChar | ''>); }

export function boardFromFen(fen: string): Board {
  const b = emptyBoard();
  const rows = fen.split(' ')[0].split('/');
  rows.forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else { if (r < 8 && f < 8) b[r][f] = ch as PieceChar; f++; }
    }
  });
  return b;
}

export function placementFromBoard(b: Board): string {
  return b.map((row) => {
    let s = '';
    let run = 0;
    for (const sq of row) {
      if (!sq) run++;
      else { if (run) s += run; run = 0; s += sq; }
    }
    return s + (run ? run : '');
  }).join('/');
}

/** Castling rights that the piece placement still allows (king and rook on their home squares). */
export function possibleCastling(b: Board): string {
  let s = '';
  if (b[7][4] === 'K') { if (b[7][7] === 'R') s += 'K'; if (b[7][0] === 'R') s += 'Q'; }
  if (b[0][4] === 'k') { if (b[0][7] === 'r') s += 'k'; if (b[0][0] === 'r') s += 'q'; }
  return s || '-';
}

export interface FenParts { turn: 'w' | 'b'; castling: string; ep: string; halfmove: number; fullmove: number }

export function buildFen(b: Board, p: Partial<FenParts> = {}): string {
  const turn = p.turn ?? 'w';
  const castling = p.castling ?? '-';
  return `${placementFromBoard(b)} ${turn} ${castling || '-'} ${p.ep ?? '-'} ${p.halfmove ?? 0} ${p.fullmove ?? 1}`;
}

/**
 * Full legality check for positions recognised from diagrams. Errors make the FEN unusable
 * (an engine or the move generator would misbehave); warnings flag positions that are legal to
 * set up but unlikely in a real game, which usually means a recognition mistake.
 */
export function checkPosition(fen: string): FenCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const parts = fen.trim().split(/\s+/);
  if (parts.length !== 6) errors.push('A FEN needs six fields.');
  const b = boardFromFen(fen);
  const count = (pc: string) => b.flat().filter((x) => x === pc).length;
  const wk = count('K'); const bk = count('k');
  if (wk !== 1) errors.push(`White must have exactly one king (found ${wk}).`);
  if (bk !== 1) errors.push(`Black must have exactly one king (found ${bk}).`);
  if (b[0].some((x) => x === 'P' || x === 'p') || b[7].some((x) => x === 'P' || x === 'p')) errors.push('Pawns cannot stand on the first or eighth rank.');
  for (const side of ['w', 'b'] as const) {
    const up = (c: string) => (side === 'w' ? c.toUpperCase() : c.toLowerCase());
    const pawns = count(up('p'));
    const pieces = b.flat().filter((x) => x && (side === 'w' ? x === x.toUpperCase() : x === x.toLowerCase())).length;
    const name = side === 'w' ? 'White' : 'Black';
    if (pawns > 8) errors.push(`${name} has ${pawns} pawns.`);
    if (pieces > 16) errors.push(`${name} has ${pieces} pieces.`);
    // Promoted pieces beyond the originals must come from missing pawns.
    const extra = Math.max(0, count(up('q')) - 1) + Math.max(0, count(up('r')) - 2) + Math.max(0, count(up('b')) - 2) + Math.max(0, count(up('n')) - 2);
    if (extra > 8 - pawns) errors.push(`${name} has more promoted pieces than missing pawns.`);
  }
  if (wk === 1 && bk === 1) {
    const pos = (k: string) => { for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) if (b[r][f] === k) return [r, f]; return [0, 0]; };
    const [r1, f1] = pos('K'); const [r2, f2] = pos('k');
    if (Math.abs(r1 - r2) <= 1 && Math.abs(f1 - f2) <= 1) errors.push('The kings are on adjacent squares.');
  }
  if (!errors.length) {
    const v = validateFen(fen);
    if (!v.ok) errors.push(v.error ?? 'Invalid FEN.');
  }
  if (!errors.length) {
    // The side not to move must not be in check.
    const flipped = parts.slice();
    flipped[1] = parts[1] === 'w' ? 'b' : 'w';
    flipped[3] = '-';
    try {
      if (new Chess(flipped.join(' '), { skipValidation: true }).inCheck()) errors.push(`${parts[1] === 'w' ? 'Black' : 'White'} is in check but it is not their move.`);
    } catch { /* validated above */ }
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** Position identity for search and caching: placement, side to move, castling, en passant. */
export function positionKey(fen: string): string { return fen.trim().split(/\s+/).slice(0, 4).join(' '); }

/** Placement only (for "same pieces regardless of side to move" search). */
export function placementKey(fen: string): string { return fen.trim().split(/\s+/)[0]; }

export function flipBoard(b: Board): Board { return b.slice().reverse().map((row) => row.slice().reverse()); }

export function squareName(rank: number, file: number): string { return 'abcdefgh'[file] + (8 - rank); }

export function materialCount(fen: string): { w: Record<string, number>; b: Record<string, number>; diff: number } {
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const w: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
  const bl: Record<string, number> = { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 };
  for (const ch of fen.split(' ')[0]) {
    if (/[PNBRQK]/.test(ch)) w[ch.toLowerCase()]++;
    else if (/[pnbrqk]/.test(ch)) bl[ch]++;
  }
  let diff = 0;
  for (const k of Object.keys(values)) diff += (w[k] - bl[k]) * values[k];
  return { w, b: bl, diff };
}
