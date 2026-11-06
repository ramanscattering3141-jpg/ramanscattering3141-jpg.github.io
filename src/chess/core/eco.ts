// Opening classification by position (handles transpositions): the deepest main-line position
// found in the Lichess chess-openings table (CC0) names the opening.
import type { GameTree } from './tree';
import { positionKey } from './fen';

type Table = Record<string, [string, string, number]>;
let table: Table | null = null;

export async function loadEco(): Promise<Table> {
  if (!table) table = (await import('../data/eco.json')).default as unknown as Table;
  return table;
}

export function classifyWith(t: Table, tree: GameTree): { eco: string; name: string } | null {
  let hit: { eco: string; name: string } | null = null;
  const k0 = t[positionKey(tree.root.fen)];
  if (k0) hit = { eco: k0[0], name: k0[1] };
  for (const n of tree.mainline().slice(0, 40)) {
    const e = t[positionKey(n.fen)];
    if (e) hit = { eco: e[0], name: e[1] };
  }
  return hit;
}

export async function classify(tree: GameTree) { return classifyWith(await loadEco(), tree); }
