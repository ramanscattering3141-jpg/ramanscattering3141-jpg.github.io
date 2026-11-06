// Whole-game analysis: every main-line position searched to a fixed depth, then each move judged
// by the drop in the mover's winning chances, and the book's move compared with the engine's.
import { Chess } from 'chess.js';
import type { GameTree, MoveNode } from '../core/tree';
import { getEngine, type AnalysisResult, type Flavor } from './engine';
import { cached, store } from './cache';
import { judgeMove, type Judgement, type Score } from './uci';
import { kvGet, kvSet } from '../db/db';

export interface NodeEval { score: Score; best: string | null; bestSan: string | null; pv: string[]; depth: number }
export interface MoveVerdict { judgement: Judgement; loss: number; bestSan: string | null; playedBest: boolean }
export interface GameAnalysis { depth: number; flavor: Flavor; evals: Record<string, NodeEval>; verdicts: Record<string, MoveVerdict>; complete: boolean; at: number }

export function uciToSan(fen: string, uci: string): string | null {
  try { return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san; } catch { return null; }
}

export function pvToSan(fen: string, pv: string[], max = 12): string[] {
  const c = new Chess(fen);
  const out: string[] = [];
  for (const u of pv.slice(0, max)) {
    try { out.push(c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san); } catch { break; }
  }
  return out;
}

function toEval(r: AnalysisResult): NodeEval {
  const l = r.lines[0];
  return { score: l?.score ?? { cp: 0 }, best: r.bestmove ?? l?.pv[0] ?? null, bestSan: r.bestmove ? uciToSan(r.fen, r.bestmove) : null, pv: l?.pv ?? [], depth: r.depth };
}

export function verdicts(tree: GameTree, evals: Record<string, NodeEval>): Record<string, MoveVerdict> {
  const out: Record<string, MoveVerdict> = {};
  for (const n of tree.mainline()) {
    const before = evals[tree.pathKey(n.parent!)], after = evals[tree.pathKey(n)];
    if (!before || !after) continue;
    const playedBest = before.best === n.uci;
    const { judgement, loss } = judgeMove(before.score, after.score, n.ply % 2 === 1, playedBest);
    out[tree.pathKey(n)] = { judgement, loss, bestSan: before.bestSan, playedBest };
  }
  return out;
}

export async function loadGameAnalysis(gameId: string): Promise<GameAnalysis | null> { return kvGet<GameAnalysis | null>(`analysis:${gameId}`, null); }

export async function analyzeGame(tree: GameTree, opts: { gameId?: string; depth: number; flavor: Flavor; onProgress?: (done: number, total: number, a: GameAnalysis) => void; signal?: { stop: boolean } }): Promise<GameAnalysis> {
  const engine = getEngine(opts.flavor);
  const nodes: MoveNode[] = [tree.root, ...tree.mainline()];
  const evals: Record<string, NodeEval> = {};
  const res: GameAnalysis = { depth: opts.depth, flavor: opts.flavor, evals, verdicts: {}, complete: false, at: Date.now() };
  for (const [i, n] of nodes.entries()) {
    if (opts.signal?.stop) break;
    let r = await cached(n.fen, opts.flavor, 1);
    if (!r || r.depth < opts.depth) {
      r = await engine.analyze(n.fen, { depth: opts.depth }, 1);
      if (!engine.wasStopped) await store(r);
    }
    evals[tree.pathKey(n)] = toEval(r);
    res.verdicts = verdicts(tree, evals);
    opts.onProgress?.(i + 1, nodes.length, res);
  }
  res.complete = Object.keys(evals).length === nodes.length;
  if (opts.gameId) await kvSet(`analysis:${opts.gameId}`, res);
  return res;
}

/** Put the analysis into the game: NAGs on bad moves and the engine's line as a variation. */
export function annotateTree(tree: GameTree, a: GameAnalysis, fmt: (s: Score) => string): number {
  let added = 0;
  for (const n of tree.mainline()) {
    const key = tree.pathKey(n);
    const v = a.verdicts[key];
    const before = a.evals[tree.pathKey(n.parent!)];
    if (!v || !before || !['blunder', 'mistake', 'inaccuracy'].includes(v.judgement)) continue;
    const nag = { blunder: 4, mistake: 2, inaccuracy: 6 }[v.judgement as 'blunder'];
    if (!n.nags.some((g) => g >= 1 && g <= 6)) n.nags.push(nag);
    const tag = `[Stockfish d${before.depth}] ${v.judgement}; ${fmt(a.evals[key]?.score ?? before.score)}. Best was ${v.bestSan} (${fmt(before.score)}).`;
    if (!n.comment?.includes('[Stockfish')) n.comment = n.comment ? `${n.comment} ${tag}` : tag;
    let cur = n.parent!;
    for (const san of pvToSan(cur.fen, before.pv, 8)) { try { cur = tree.addMove(cur, san); } catch { break; } }
    added++;
  }
  return added;
}
