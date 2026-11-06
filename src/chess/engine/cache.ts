// Stored engine results, so the same position is never searched twice to the same depth.
import { db } from '../db/db';
import { positionKey } from '../core/fen';
import type { AnalysisResult, Flavor } from './engine';

const key = (fen: string, flavor: Flavor, multipv: number) => `${flavor}|${multipv}|${positionKey(fen)}`;
const mem = new Map<string, AnalysisResult>();

export async function cached(fen: string, flavor: Flavor, multipv: number): Promise<AnalysisResult | null> {
  const k = key(fen, flavor, multipv);
  if (mem.has(k)) return mem.get(k)!;
  const r = await (await db()).get('engine', k);
  if (r) mem.set(k, { ...r.result, fen });
  return r ? { ...r.result, fen } : null;
}

export async function store(res: AnalysisResult): Promise<void> {
  if (!res.lines.length || res.terminal) return;
  const k = key(res.fen, res.settings.flavor, res.settings.multipv);
  const prev = mem.get(k) ?? (await (await db()).get('engine', k))?.result;
  if (prev && prev.depth >= res.depth) return;
  mem.set(k, res);
  await (await db()).put('engine', { key: k, result: res, depth: res.depth, at: Date.now() });
}
