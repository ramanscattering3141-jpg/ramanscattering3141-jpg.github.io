// UCI protocol parsing and evaluation conventions. Scores from the engine are relative to the
// side to move; everything the app shows is converted to White's point of view.

/** cp: centipawns; mate: moves to mate (+ White mates, − Black mates); mate 0 = the game is over by mate, `winner` says who won. */
export interface Score { cp?: number; mate?: number; winner?: 'w' | 'b' }

export interface PvLine {
  multipv: number;
  depth: number;
  seldepth?: number;
  /** White-perspective score. */
  score: Score;
  bound?: 'lower' | 'upper';
  nodes?: number;
  nps?: number;
  time?: number;
  pv: string[]; // UCI moves
}

export function parseInfo(line: string, whiteToMove: boolean): PvLine | null {
  if (!line.startsWith('info ') || !/ pv /.test(line) || !/ score /.test(line)) return null;
  const tok = line.split(/\s+/);
  const out: PvLine = { multipv: 1, depth: 0, score: {}, pv: [] };
  for (let i = 1; i < tok.length; i++) {
    const k = tok[i];
    switch (k) {
      case 'depth': out.depth = Number(tok[++i]); break;
      case 'seldepth': out.seldepth = Number(tok[++i]); break;
      case 'multipv': out.multipv = Number(tok[++i]); break;
      case 'nodes': out.nodes = Number(tok[++i]); break;
      case 'nps': out.nps = Number(tok[++i]); break;
      case 'time': out.time = Number(tok[++i]); break;
      case 'score': {
        const kind = tok[++i];
        const v = Number(tok[++i]);
        const sign = whiteToMove ? 1 : -1;
        if (kind === 'cp') out.score = { cp: v * sign };
        else if (kind === 'mate') out.score = v === 0 ? { mate: 0, winner: whiteToMove ? 'b' : 'w' } : { mate: v * sign };
        if (tok[i + 1] === 'lowerbound' || tok[i + 1] === 'upperbound') {
          const b = tok[++i] === 'lowerbound' ? 'lower' : 'upper';
          // Bounds flip with the perspective too.
          out.bound = whiteToMove ? b : b === 'lower' ? 'upper' : 'lower';
        }
        break;
      }
      case 'pv': out.pv = tok.slice(i + 1); i = tok.length; break;
      default: break;
    }
  }
  return out;
}

/** "+1.25", "−2.10", "M3" (White mates in 3), "−M2" (Black mates in 2), "#0" for a finished mate. */
export function formatScore(s: Score): string {
  if (s.mate !== undefined) {
    if (s.mate === 0) return s.winner === 'w' ? '1-0#' : '0-1#';
    return s.mate > 0 ? `M${s.mate}` : `−M${-s.mate}`;
  }
  const cp = s.cp ?? 0;
  const p = cp / 100;
  if (Math.abs(p) < 0.005) return '0.00';
  return (p > 0 ? '+' : '−') + Math.abs(p).toFixed(2);
}

/** Win probability for White (0–100) from a centipawn score — the logistic model Lichess uses. */
export function winPercent(s: Score): number {
  if (s.mate !== undefined) return s.mate > 0 || s.winner === 'w' ? 100 : 0;
  const cp = Math.max(-1000, Math.min(1000, s.cp ?? 0));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** A bar/graph value in pawns, clamped, with mates pinned to the ends. */
export function graphValue(s: Score, clamp = 8): number {
  if (s.mate !== undefined) return s.mate > 0 || s.winner === 'w' ? clamp : -clamp;
  return Math.max(-clamp, Math.min(clamp, (s.cp ?? 0) / 100));
}

export type Judgement = 'blunder' | 'mistake' | 'inaccuracy' | 'good' | 'best';

/**
 * Judge a move by how much it lowered the mover's winning chances (Lichess thresholds:
 * 10/20/30 percentage points for inaccuracy/mistake/blunder).
 */
export function judgeMove(before: Score, after: Score, whiteMoved: boolean, playedBest: boolean): { judgement: Judgement; loss: number } {
  const wb = winPercent(before);
  const wa = winPercent(after);
  const loss = whiteMoved ? wb - wa : wa - wb;
  let judgement: Judgement = playedBest ? 'best' : 'good';
  if (loss >= 30) judgement = 'blunder';
  else if (loss >= 20) judgement = 'mistake';
  else if (loss >= 10) judgement = 'inaccuracy';
  // Missing a forced mate is at least a mistake even if the position stays winning.
  if (before.mate !== undefined && after.mate === undefined && (whiteMoved ? before.mate > 0 : before.mate < 0) && judgement !== 'blunder') {
    const stillWinning = whiteMoved ? (after.cp ?? 0) > 300 : (after.cp ?? 0) < -300;
    judgement = stillWinning ? 'inaccuracy' : 'mistake';
  }
  return { judgement, loss: Math.max(0, loss) };
}

export const JUDGEMENT_NAG: Record<Judgement, number | null> = { blunder: 4, mistake: 2, inaccuracy: 6, good: null, best: null };
