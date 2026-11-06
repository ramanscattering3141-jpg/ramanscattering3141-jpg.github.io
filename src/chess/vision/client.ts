import type { VisionBoard, VisionRequest } from './vision.worker';
import type { Gray } from './image';

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (b: VisionBoard[]) => void; reject: (e: Error) => void }>();

function w(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./vision.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.error) p.reject(new Error(e.data.error)); else p.resolve(e.data.boards);
    };
  }
  return worker;
}

export function findDiagrams(img: Gray, learned: Array<{ piece: string; d: unknown }>, skip: Array<[number, number, number, number]> = []): Promise<VisionBoard[]> {
  const id = ++seq;
  const data = img.data.buffer.slice(0) as ArrayBuffer;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const msg: VisionRequest = { id, w: img.w, h: img.h, data, learned, skip };
    w().postMessage(msg, [data]);
  });
}
export type { VisionBoard };
