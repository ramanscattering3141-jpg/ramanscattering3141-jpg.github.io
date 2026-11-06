// From recognised squares to a position: orientation, side to move from captions, FEN, checks.
import { buildFen, checkPosition, flipBoard, possibleCastling, type Board, type PieceChar } from '../core/fen';
import type { Recognition } from './classify';

export type Orientation = 'white' | 'black';

export function visualBoard(rec: Recognition): Board { return rec.cells.map((row) => row.map((c) => c.piece)); }

export function orient(b: Board, o: Orientation): Board { return o === 'white' ? b : flipBoard(b); }

/**
 * Which side is at the bottom of the diagram. Coordinates printed beside the board decide it;
 * otherwise the pawns and kings are used (White's pawns normally stand below Black's).
 */
export function guessOrientation(b: Board, labels?: { bottomRank?: string; leftFile?: string }): { orientation: Orientation; certain: boolean; reason: string } {
  if (labels?.bottomRank === '1' || labels?.leftFile === 'a') return { orientation: 'white', certain: true, reason: 'board coordinates' };
  if (labels?.bottomRank === '8' || labels?.leftFile === 'h') return { orientation: 'black', certain: true, reason: 'board coordinates' };
  let score = 0, n = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = b[r][c];
    if (p === 'P') { score += r - 3.5; n++; }
    else if (p === 'p') { score -= r - 3.5; n++; }
    else if (p === 'K') { score += (r - 3.5) * 0.5; n++; }
    else if (p === 'k') { score -= (r - 3.5) * 0.5; n++; }
  }
  if (score < -2 && n >= 4) return { orientation: 'black', certain: false, reason: "White's pawns stand above Black's" };
  return { orientation: 'white', certain: score > 2, reason: score > 2 ? "pawn structure" : 'default (White at the bottom)' };
}

/** "White to move", "Black to play", "(W)", "Black wins" … in a caption. */
export function sideFromCaption(caption: string | undefined): 'w' | 'b' | null {
  if (!caption) return null;
  const t = caption.toLowerCase();
  if (/\bwhite\b[^.]{0,20}\b(to (move|play)|plays|wins|draws|mates|moves)\b/.test(t) || /\(w\)|^w$/.test(t)) return 'w';
  if (/\bblack\b[^.]{0,20}\b(to (move|play)|plays|wins|draws|mates|moves)\b/.test(t) || /\(b\)|^b$/.test(t)) return 'b';
  if (/\bwhite\b/.test(t) && !/\bblack\b/.test(t)) return 'w';
  if (/\bblack\b/.test(t) && !/\bwhite\b/.test(t)) return 'b';
  return null;
}

export interface DiagramPosition {
  board: Board;
  /** Placement + side to move ('w' if unknown — see turnKnown) + castling rights still possible. */
  fen: string;
  turnKnown: boolean;
  errors: string[];
}

export function diagramPosition(b: Board, turn: 'w' | 'b' | null): DiagramPosition {
  const castling = possibleCastling(b);
  // Castling rights cannot be read from a diagram; the placement only tells us what is possible.
  // They are kept as "possible" because removing them would forbid legal book moves (O-O).
  const fen = buildFen(b, { turn: turn ?? 'w', castling });
  let check = checkPosition(fen);
  let finalFen = fen;
  if (!turn && !check.ok && check.errors.some((e) => /in check but it is not their move/.test(e))) {
    // The side in check must be the side to move.
    const other = buildFen(b, { turn: 'b', castling });
    const c2 = checkPosition(other);
    if (c2.ok) { finalFen = other; check = c2; return { board: b, fen: finalFen, turnKnown: true, errors: [] }; }
  }
  return { board: b, fen: finalFen, turnKnown: !!turn, errors: check.errors };
}

export function pieceAt(b: Board, sq: string): PieceChar | '' { return b[8 - Number(sq[1])]['abcdefgh'.indexOf(sq[0])]; }
