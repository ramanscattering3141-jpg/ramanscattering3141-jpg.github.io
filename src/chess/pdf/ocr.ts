// Tesseract OCR for scanned pages, self-hosted (no CDN). One worker, created on first use.
import { createWorker, type Worker as TWorker } from 'tesseract.js';
import { vendorUrl } from '../paths';
import type { TextItem } from './layout';

let worker: Promise<TWorker> | null = null;

function getWorker(): Promise<TWorker> {
  worker ??= createWorker('eng', 1, {
    workerPath: vendorUrl('tesseract/worker.min.js'),
    corePath: vendorUrl('tesseract/'),
    langPath: vendorUrl('tesseract/lang/'),
    gzip: true,
    workerBlobURL: false,
  });
  return worker;
}

/** OCR an image; returns words as text items scaled by `toScale` (OCR pixels → layout pixels). */
export async function ocrImage(image: HTMLCanvasElement | OffscreenCanvas | Blob, toScale: number): Promise<TextItem[]> {
  const w = await getWorker();
  let input: HTMLCanvasElement | Blob = image as HTMLCanvasElement;
  if (typeof OffscreenCanvas !== 'undefined' && image instanceof OffscreenCanvas) input = await image.convertToBlob({ type: 'image/png' });
  const { data } = await w.recognize(input, {}, { blocks: true, text: false });
  const out: TextItem[] = [];
  for (const b of data.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) {
    const lh = (l.bbox.y1 - l.bbox.y0) * toScale;
    for (const wd of l.words) {
      const t = wd.text.trim();
      if (!t) continue;
      out.push({ str: t, x: wd.bbox.x0 * toScale, y: wd.bbox.y0 * toScale, w: (wd.bbox.x1 - wd.bbox.x0) * toScale, h: Math.max(lh * 0.8, (wd.bbox.y1 - wd.bbox.y0) * toScale), conf: wd.confidence / 100, bold: !!(wd as { is_bold?: boolean }).is_bold });
    }
  }
  return out;
}

export async function terminateOcr() { if (worker) { (await worker).terminate(); worker = null; } }
