// Saving and loading games. PGN is authoritative; every save re-validates it and refreshes the
// position index used for position search.
import { parsePgn, writePgn, validatePgn } from '../core/pgn';
import { GameTree } from '../core/tree';
import { positionKey, placementKey } from '../core/fen';
import { classify } from '../core/eco';
import { db, uid, type GameRec, type Status } from './db';
import type { ExtractedGame } from '../core/reconstruct';

export function treeOf(rec: GameRec): GameTree {
  const [g] = parsePgn(rec.pgn);
  return g ? g.tree : new GameTree();
}

export async function fillFromTree(rec: GameRec, tree: GameTree): Promise<GameRec> {
  const eco = await classify(tree).catch(() => null);
  if (eco && !tree.headers.ECO) tree.headers.ECO = eco.eco;
  if (eco && !tree.headers.Opening) tree.headers.Opening = eco.name;
  const pgn = writePgn(tree);
  const v = validatePgn(pgn);
  if (!v.ok) throw new Error(`PGN failed validation: ${v.errors.join('; ')}`);
  const h = tree.headers;
  return {
    ...rec, pgn,
    white: h.White && h.White !== '?' ? h.White : '', black: h.Black && h.Black !== '?' ? h.Black : '',
    event: h.Event && h.Event !== '?' ? h.Event : '', date: h.Date ?? '', result: h.Result ?? '*',
    eco: h.ECO ?? '', opening: h.Opening ?? '', plies: tree.mainline().length, updatedAt: Date.now(),
  };
}

export async function saveGame(rec: GameRec, tree: GameTree): Promise<GameRec> {
  const full = await fillFromTree(rec, tree);
  const d = await db();
  const tx = d.transaction(['games', 'positions'], 'readwrite');
  await tx.objectStore('games').put(full);
  let c = await tx.objectStore('positions').index('byGame').openCursor(full.id);
  while (c) { await c.delete(); c = await c.continue(); }
  for (const n of tree.all()) {
    await tx.objectStore('positions').add({ key: positionKey(n.fen), placement: placementKey(n.fen), gameId: full.id, path: tree.pathKey(n), bookId: full.bookId });
  }
  await tx.done;
  return full;
}

export function blankGame(partial: Partial<GameRec> = {}): GameRec {
  return {
    id: uid(), bookId: null, chapterId: null, page: null, pgn: '', white: '', black: '', event: '', date: '', result: '*', eco: '', opening: '',
    type: 'imported', confidence: 1, issues: [], anchors: [], diagrams: {}, status: 'auto', plies: 0, manual: false, order: 0, updatedAt: Date.now(),
    ...partial,
  };
}

export async function saveExtracted(g: ExtractedGame, bookId: string, chapterId: string | null, order: number, source: string): Promise<GameRec> {
  const t = g.tree;
  t.headers.Source = source;
  t.headers.Page = String(g.firstRef.page);
  if (!t.headers.Event) t.headers.Event = g.type === 'fragment' ? `${source}, p. ${g.firstRef.page}` : '?';
  const status: Status = g.issues.some((i) => i.kind !== 'repaired' && i.kind !== 'diagram') || g.confidence < 0.85 ? 'needs-review' : 'auto';
  return saveGame(blankGame({
    bookId, chapterId, page: g.firstRef.page, type: g.type, confidence: g.confidence, issues: g.issues, anchors: g.anchors,
    diagrams: g.diagrams, status, firstRef: g.firstRef, lastRef: g.lastRef, order,
  }), t);
}

/** Import games from PGN text (e.g. an external file). */
export async function importPgn(text: string, bookId: string | null = null): Promise<{ saved: GameRec[]; errors: string[] }> {
  const games = parsePgn(text);
  const saved: GameRec[] = [];
  const errors: string[] = [];
  let order = Date.now();
  for (const [i, g] of games.entries()) {
    if (g.errors.length) errors.push(...g.errors.map((e) => `Game ${i + 1}: ${e.message}`));
    saved.push(await saveGame(blankGame({ bookId, type: 'imported', status: g.errors.length ? 'needs-review' : 'auto', order: order++ }), g.tree));
  }
  return { saved, errors };
}

export async function deleteGame(id: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(['games', 'positions'], 'readwrite');
  let c = await tx.objectStore('positions').index('byGame').openCursor(id);
  while (c) { await c.delete(); c = await c.continue(); }
  await tx.objectStore('games').delete(id);
  await tx.done;
}
