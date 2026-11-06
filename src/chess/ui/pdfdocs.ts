// One open pdf.js document per book, shared by the viewer and the crops; closed when idle.
import { db } from '../db/db';
import { openPdf, type PdfDoc } from '../pdf/pdf';

const open = new Map<string, { doc: Promise<PdfDoc>; used: number }>();

export function bookPdf(bookId: string): Promise<PdfDoc> {
  let e = open.get(bookId);
  if (!e) {
    const doc = (async () => {
      const f = await (await db()).get('files', bookId);
      if (!f) throw new Error('PDF not found');
      return openPdf(await f.blob.arrayBuffer());
    })();
    e = { doc, used: Date.now() };
    open.set(bookId, e);
    // Keep at most two books open.
    if (open.size > 2) {
      const oldest = [...open.entries()].filter(([k]) => k !== bookId).sort((a, b) => a[1].used - b[1].used)[0];
      if (oldest) { open.delete(oldest[0]); void oldest[1].doc.then((d) => d.loadingTask.destroy()).catch(() => undefined); }
    }
  }
  e.used = Date.now();
  return e.doc;
}
