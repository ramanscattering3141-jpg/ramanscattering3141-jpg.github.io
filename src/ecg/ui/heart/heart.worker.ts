// Web Worker: builds the heart geometry and per-beat activation maps off the main thread.

import type { EcgRun } from '../../engine';
import { computeAnatomy, computeMap, computeZones, type BeatJob } from './compute';

type Req = { id: number; type: 'anatomy'; run: EcgRun } | { id: number; type: 'maps'; run: EcgRun; jobs: BeatJob[] };

const ctx = self as unknown as { postMessage: (m: unknown, t?: Transferable[]) => void; onmessage: ((e: MessageEvent<Req>) => void) | null };

ctx.onmessage = (e: MessageEvent<Req>): void => {
  const req = e.data;
  try {
    if (req.type === 'anatomy') {
      const { result } = computeAnatomy(req.run.physio);
      const zones = computeZones(req.run);
      // Copies, so the cached originals stay usable for later runs in this worker.
      const mesh = { pos: result.mesh.pos.slice(), normal: result.mesh.normal.slice(), index: result.mesh.index.slice() };
      const info = result.info.slice();
      const depth = result.depth.slice();
      const near = result.near.slice();
      ctx.postMessage({ id: req.id, type: 'anatomy', key: result.key, meta: result.meta, mesh, info, depth, near, zones }, [mesh.pos.buffer, mesh.normal.buffer, mesh.index.buffer, info.buffer, depth.buffer, near.buffer, zones.buffer]);
    } else {
      const zones = computeZones(req.run);
      for (const job of req.jobs) {
        const m = computeMap(req.run, job, zones);
        ctx.postMessage({ id: req.id, type: 'map', map: m }, [m.data.buffer, m.half.buffer]);
      }
      ctx.postMessage({ id: req.id, type: 'mapsDone' });
    }
  } catch (err) {
    ctx.postMessage({ id: req.id, type: 'error', message: String(err) });
  }
};
