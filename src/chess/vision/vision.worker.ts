// Diagram detection and recognition off the main thread.
import file from '../data/piece-templates.json';
import { builtinTemplates, recognize, deserializeDescriptor, serializeDescriptor, learnTemplate, type Template, type TemplateFile } from './classify';
import { detectBoards } from './board';
import type { PieceChar } from '../core/fen';

const builtin: Template[] = builtinTemplates(file as TemplateFile);

export interface VisionRequest { id: number; w: number; h: number; data: ArrayBuffer; learned: Array<{ piece: string; d: unknown }>; skip: Array<[number, number, number, number]> }
export interface VisionBoard { x: number; y: number; size: number; score: number; pieces: string; conf: number; cellConf: number[]; cells: Array<{ i: number; d: unknown } | null> }

self.onmessage = (e: MessageEvent<VisionRequest>) => {
  const { id, w, h, data, learned, skip } = e.data;
  try {
    const img = { w, h, data: new Uint8Array(data) };
    const lt = learned.map((l) => learnTemplate(deserializeDescriptor(l.d as never), l.piece as PieceChar));
    const boards = detectBoards(img).filter((b) => !skip.some(([x, y, s]) => Math.abs(b.x - x) < s * 0.3 && Math.abs(b.y - y) < s * 0.3));
    const out: VisionBoard[] = boards.map((b) => {
      const rec = recognize(img, b, builtin, lt);
      const flat = rec.cells.flat();
      return {
        x: b.x, y: b.y, size: b.size, score: b.score,
        pieces: flat.map((c) => c.piece || '.').join(''),
        conf: rec.conf, cellConf: flat.map((c) => Math.round(c.conf * 100) / 100),
        cells: flat.map((c, i) => (c.descriptor ? { i, d: serializeDescriptor(c.descriptor) } : null)),
      };
    });
    (self as unknown as Worker).postMessage({ id, boards: out });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
