// pdf.js wrapper. PDFs are parsed in pdf.js's own worker; pdf.js never evaluates code from the
// file, and XFA forms, embedded JavaScript and form actions are not run.
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { vendorUrl } from '../paths';
import type { TextItem } from './layout';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfDoc = pdfjs.PDFDocumentProxy;
export type PdfPage = pdfjs.PDFPageProxy;

export const MAX_PDF_BYTES = 400 * 1024 * 1024;

/** Check the file really is a PDF and within the size limit before parsing it. */
export async function validatePdfFile(file: Blob & { name?: string }): Promise<string | null> {
  if (file.size === 0) return 'The file is empty.';
  if (file.size > MAX_PDF_BYTES) return `The file is larger than ${MAX_PDF_BYTES / 1024 / 1024} MB.`;
  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  const s = String.fromCharCode(...head);
  if (!s.includes('%PDF-')) return 'This is not a PDF file.';
  return null;
}

export async function openPdf(data: ArrayBuffer): Promise<PdfDoc> {
  return pdfjs.getDocument({
    data: new Uint8Array(data),
    enableXfa: false,
    cMapUrl: vendorUrl('pdfjs/cmaps/'),
    cMapPacked: true,
    standardFontDataUrl: vendorUrl('pdfjs/standard_fonts/'),
    disableAutoFetch: true,
  }).promise;
}

export interface Rendered { canvas: HTMLCanvasElement | OffscreenCanvas; width: number; height: number; scale: number }

export async function renderPage(page: PdfPage, scale: number): Promise<Rendered> {
  const vp = page.getViewport({ scale });
  const w = Math.floor(vp.width), h = Math.floor(vp.height);
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  await page.render({ canvasContext: ctx, viewport: vp, canvas: canvas as HTMLCanvasElement }).promise;
  return { canvas, width: w, height: h, scale };
}

/** Text items in viewport pixels at `scale` (call after rendering so font names are known). */
export async function textItems(page: PdfPage, scale: number): Promise<TextItem[]> {
  const vp = page.getViewport({ scale });
  const tc = await page.getTextContent();
  const out: TextItem[] = [];
  const fontInfo = new Map<string, { name: string; bold: boolean }>();
  for (const raw of tc.items) {
    if (!('str' in raw) || !raw.str) continue;
    const tx = pdfjs.Util.transform(vp.transform, raw.transform);
    const h = Math.hypot(tx[2], tx[3]);
    if (h < 2) continue;
    let info = fontInfo.get(raw.fontName);
    if (!info) {
      let name = tc.styles[raw.fontName]?.fontFamily ?? '';
      let bold = false;
      try {
        if (page.commonObjs.has(raw.fontName)) {
          const f = page.commonObjs.get(raw.fontName) as { name?: string; bold?: boolean; black?: boolean };
          name = f.name ?? name;
          bold = !!f.bold || !!f.black || /bold|black|heavy|semibold|demi/i.test(f.name ?? '');
        }
      } catch { /* font not loaded */ }
      info = { name, bold };
      fontInfo.set(raw.fontName, info);
    }
    out.push({ str: raw.str, x: tx[4], y: tx[5] - h, w: raw.width * scale, h, font: info.name, bold: info.bold });
  }
  return out;
}

export interface OutlineEntry { title: string; page: number }

export async function outline(doc: PdfDoc): Promise<OutlineEntry[]> {
  const ol = await doc.getOutline().catch(() => null);
  if (!ol) return [];
  const out: OutlineEntry[] = [];
  for (const e of ol) {
    try {
      const dest = typeof e.dest === 'string' ? await doc.getDestination(e.dest) : e.dest;
      if (!dest) continue;
      const idx = await doc.getPageIndex(dest[0] as never);
      out.push({ title: e.title.trim(), page: idx + 1 });
    } catch { /* unresolvable entry */ }
  }
  return out.sort((a, b) => a.page - b.page);
}

export async function metadata(doc: PdfDoc): Promise<{ title?: string; author?: string }> {
  const m = await doc.getMetadata().catch(() => null);
  const info = (m?.info ?? {}) as { Title?: string; Author?: string };
  return { title: info.Title?.trim() || undefined, author: info.Author?.trim() || undefined };
}
