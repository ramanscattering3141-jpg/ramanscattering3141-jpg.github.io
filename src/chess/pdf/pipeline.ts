// Background processing of uploaded books, one page at a time. Progress is saved after every
// page, so processing resumes where it stopped after a reload, a crash or a pause.
import { db, uid, type Book, type DiagramRec, type PageRec } from '../db/db';
import { openPdf, renderPage, textItems, outline, metadata, validatePdfFile, type PdfDoc } from './pdf';
import { layoutPage, findFontDiagrams, looksGarbled, type PageDiagram, type TextItem } from './layout';
import { ocrImage } from './ocr';
import { findDiagrams } from '../vision/client';
import { fromRGBA } from '../vision/image';
import { chaptersFrom } from './chapters';
import { extractBook, type ExtractSummary } from './extract';
import { boardFromFen, type Board, type PieceChar } from '../core/fen';
import { guessOrientation, sideFromCaption, diagramPosition, orient } from '../vision/position';

/** Render scale for page analysis (≈ 150 dpi) and for OCR (≈ 300 dpi). */
const CV_SCALE = 150 / 72;
const OCR_SCALE = 300 / 72;

export interface Progress { bookId: string; page: number; pages: number; stage: string; done: boolean; error?: string; summary?: ExtractSummary }
type Listener = (p: Progress) => void;

const listeners = new Set<Listener>();
export function onProgress(l: Listener): () => void { listeners.add(l); return () => listeners.delete(l); }
const emit = (p: Progress) => listeners.forEach((l) => l(p));

const queue: Array<{ bookId: string; pages?: number[] }> = [];
let running: string | null = null;
let stopFlag: string | null = null;

export async function addBook(file: File): Promise<Book> {
  const err = await validatePdfFile(file);
  if (err) throw new Error(`${file.name}: ${err}`);
  const d = await db();
  const buf = await file.arrayBuffer();
  let doc: PdfDoc;
  try { doc = await openPdf(buf.slice(0)); } catch (e) { throw new Error(`${file.name}: the PDF could not be opened (${(e as Error).message}).`); }
  const meta = await metadata(doc);
  const book: Book = {
    id: uid(), title: meta.title || file.name.replace(/\.pdf$/i, ''), author: meta.author || '', edition: '', publisher: '', year: '',
    fileName: file.name, fileSize: file.size, pageCount: doc.numPages, addedAt: Date.now(), status: 'queued', processedPages: 0,
    settings: { language: 'auto', style: 'auto', boldMain: 'auto', forceOcr: false },
  };
  try {
    const p1 = await doc.getPage(1);
    const r = await renderPage(p1, 200 / p1.getViewport({ scale: 1 }).width);
    book.cover = r.canvas instanceof HTMLCanvasElement ? await new Promise<Blob>((res) => (r.canvas as HTMLCanvasElement).toBlob((b) => res(b!), 'image/jpeg', 0.8)) : await (r.canvas as OffscreenCanvas).convertToBlob({ type: 'image/jpeg', quality: 0.8 });
  } catch { /* no cover */ }
  await doc.loadingTask.destroy();
  await d.put('files', { bookId: book.id, blob: new Blob([buf], { type: 'application/pdf' }) });
  const tx = d.transaction('pages', 'readwrite');
  for (let p = 1; p <= book.pageCount; p++) await tx.store.put(emptyPage(book.id, p));
  await tx.done;
  await d.put('books', book);
  enqueue(book.id);
  return book;
}

function emptyPage(bookId: string, page: number): PageRec {
  return { key: [bookId, page], bookId, page, status: 'pending', ocr: false, garbled: false, width: 0, height: 0, items: [], headings: [], textLength: 0 };
}

export function enqueue(bookId: string, pages?: number[]) {
  if (!queue.some((q) => q.bookId === bookId && !pages)) queue.push({ bookId, pages });
  void pump();
}

export function pause(bookId: string) {
  const i = queue.findIndex((q) => q.bookId === bookId);
  if (i >= 0) queue.splice(i, 1);
  if (running === bookId) stopFlag = bookId;
  void db().then(async (d) => { const b = await d.get('books', bookId); if (b && b.status !== 'done') await d.put('books', { ...b, status: 'paused' }); });
}

export function isRunning(bookId: string) { return running === bookId; }

/** Reprocess chosen pages (e.g. after switching on OCR). */
export async function reprocessPages(bookId: string, pages: number[]) {
  const d = await db();
  for (const p of pages) {
    await d.put('pages', emptyPage(bookId, p));
    for (const dg of await d.getAllFromIndex('diagrams', 'byPage', [bookId, p])) await d.delete('diagrams', dg.id);
  }
  const b = await d.get('books', bookId);
  if (b) await d.put('books', { ...b, status: 'queued', processedPages: Math.max(0, b.processedPages - pages.length) });
  enqueue(bookId, pages);
}

/** Resume books left unfinished by a previous visit. */
export async function resumeAll() {
  const d = await db();
  for (const b of await d.getAll('books')) if (b.status === 'processing' || b.status === 'queued') enqueue(b.id);
}

async function pump() {
  if (running) return;
  const job = queue.shift();
  if (!job) return;
  running = job.bookId;
  stopFlag = null;
  try { await processBook(job.bookId, job.pages); }
  catch (e) {
    const d = await db();
    const b = await d.get('books', job.bookId);
    if (b) await d.put('books', { ...b, status: 'error', error: (e as Error).message });
    emit({ bookId: job.bookId, page: 0, pages: b?.pageCount ?? 0, stage: 'error', done: true, error: (e as Error).message });
  } finally { running = null; void pump(); }
}

async function processBook(bookId: string, only?: number[]) {
  const d = await db();
  let book = (await d.get('books', bookId))!;
  if (!book) return;
  const file = await d.get('files', bookId);
  if (!file) throw new Error('The PDF file is missing from storage.');
  book = { ...book, status: 'processing', error: undefined };
  await d.put('books', book);
  const doc = await openPdf(await file.blob.arrayBuffer());
  try {
    const learned = (await d.getAllFromIndex('templates', 'byBook', bookId)).map((t) => ({ piece: t.piece, d: t.d }));
    const pages = (await d.getAllFromIndex('pages', 'byBook', bookId)).sort((a, b) => a.page - b.page);
    let done = pages.filter((p) => p.status === 'done').length;
    for (const rec of pages) {
      if (rec.status === 'done') continue;
      if (only && !only.includes(rec.page)) continue;
      if (stopFlag === bookId) { await d.put('books', { ...(await d.get('books', bookId))!, status: 'paused', processedPages: done }); emit({ bookId, page: rec.page, pages: book.pageCount, stage: 'paused', done: true }); return; }
      emit({ bookId, page: rec.page, pages: book.pageCount, stage: `Reading page ${rec.page} of ${book.pageCount}`, done: false });
      try {
        await processPage(doc, book, rec.page, learned);
      } catch (e) {
        await d.put('pages', { ...emptyPage(bookId, rec.page), status: 'error', error: (e as Error).message });
      }
      done++;
      const b = (await d.get('books', bookId))!;
      await d.put('books', { ...b, processedPages: done });
    }
    // Chapters (first time only, or kept if the user edited them).
    const existing = await d.getAllFromIndex('chapters', 'byBook', bookId);
    if (!existing.length || existing.every((c) => c.source !== 'manual')) {
      emit({ bookId, page: book.pageCount, pages: book.pageCount, stage: 'Finding chapters', done: false });
      for (const c of existing) await d.delete('chapters', c.id);
      const all = await d.getAllFromIndex('pages', 'byBook', bookId);
      const heads = all.flatMap((p) => p.headings.map((t) => ({ page: p.page, text: t })));
      for (const c of chaptersFrom(bookId, book.pageCount, await outline(doc), heads, uid)) await d.put('chapters', c);
    }
    emit({ bookId, page: book.pageCount, pages: book.pageCount, stage: 'Rebuilding games and checking every move', done: false });
    const summary = await extractBook(bookId);
    await d.put('books', { ...(await d.get('books', bookId))!, status: 'done' });
    emit({ bookId, page: book.pageCount, pages: book.pageCount, stage: 'done', done: true, summary });
  } finally {
    await doc.loadingTask.destroy();
  }
}

async function processPage(doc: PdfDoc, book: Book, n: number, learned: Array<{ piece: string; d: unknown }>) {
  const d = await db();
  const page = await doc.getPage(n);
  const r = await renderPage(page, CV_SCALE);
  let items: TextItem[] = await textItems(page, CV_SCALE);
  const ctx = r.canvas.getContext('2d') as CanvasRenderingContext2D;
  const gray = fromRGBA(ctx.getImageData(0, 0, r.width, r.height).data, r.width, r.height);

  // Diagrams typeset in a chess font come straight from the text layer.
  const fontDiagrams = findFontDiagrams(items);
  const used = new Set(fontDiagrams.flatMap((f) => f.used));
  items = items.filter((i) => !used.has(i));
  const boards = await findDiagrams(gray, learned, fontDiagrams.map((f) => [f.x, f.y, f.size, f.size] as [number, number, number, number]));

  const pageDiagrams: PageDiagram[] = [];
  const recs: DiagramRec[] = [];
  const mk = (x: number, y: number, size: number, visual: Board, conf: number, cellConf: number[], source: 'vision' | 'font', cells?: DiagramRec['cells']) => {
    const id = uid();
    pageDiagrams.push({ id, x, y, size, fen: null, source });
    recs.push({
      id, bookId: book.id, page: n, rect: [x / r.width, y / r.height, size / r.width, size / r.height],
      visual: visual.map((row) => row.map((p) => p || '.').join('')).join('/'), orientation: 'white', orientationCertain: false, turn: null,
      fen: null, conf, cellConf, status: 'auto', source, errors: [], cells,
    });
  };
  for (const f of fontDiagrams) mk(f.x, f.y, f.size, boardFromFen(f.fen), 1, new Array(64).fill(1), 'font');
  for (const b of boards) {
    const visual: Board = [];
    for (let rr = 0; rr < 8; rr++) visual.push([...b.pieces.slice(rr * 8, rr * 8 + 8)].map((c) => (c === '.' ? '' : (c as PieceChar))));
    mk(b.x, b.y, b.size, visual, b.conf, b.cellConf, 'vision', b.cells);
  }

  // OCR for scanned pages and pages whose text layer is unreadable.
  const textLen = items.reduce((s, i) => s + i.str.trim().length, 0);
  const garbled = looksGarbled(items);
  const needOcr = book.settings.forceOcr || textLen < 40 || garbled;
  if (needOcr) {
    const o = await renderPage(page, OCR_SCALE);
    const octx = o.canvas.getContext('2d') as CanvasRenderingContext2D;
    octx.fillStyle = '#fff';
    const k = OCR_SCALE / CV_SCALE;
    // Blank out the boards so their pieces are not read as letters.
    for (const pd of pageDiagrams) octx.fillRect(pd.x * k - 4, pd.y * k - 4, pd.size * k + 8, pd.size * k + 8);
    const ocrItems = await ocrImage(o.canvas, CV_SCALE / OCR_SCALE);
    // Keep coordinate labels from the text layer, if any, and use OCR for the rest.
    items = ocrItems;
  }

  const lay = layoutPage(items, r.width, r.height, n, pageDiagrams, { ocr: needOcr || garbled });
  for (const rec of recs) {
    const visual = rec.visual.split('/').map((row) => [...row].map((c) => (c === '.' ? '' : c))) as Board;
    const o = guessOrientation(visual, lay.labels[rec.id]);
    rec.orientation = o.orientation; rec.orientationCertain = o.certain;
    rec.caption = lay.captions[rec.id];
    rec.turn = sideFromCaption(rec.caption);
    const pos = diagramPosition(orient(visual, o.orientation), rec.turn);
    rec.fen = pos.fen; rec.errors = pos.errors;
    if (pos.turnKnown && !rec.turn) rec.turn = pos.fen.split(' ')[1] as 'w' | 'b';
    rec.status = rec.errors.length || rec.conf < 0.85 || Math.min(...rec.cellConf) < 0.3 ? 'needs-review' : 'auto';
  }
  for (const it of lay.items) if ('kind' in it && it.kind === 'diagram') it.fen = recs.find((x) => x.id === it.id)?.fen ?? null;
  const tx = d.transaction(['pages', 'diagrams'], 'readwrite');
  for (const rec of recs) await tx.objectStore('diagrams').put(rec);
  await tx.objectStore('pages').put({
    key: [book.id, n], bookId: book.id, page: n, status: 'done', ocr: needOcr, garbled, width: r.width, height: r.height,
    items: lay.items, headings: lay.headings, textLength: textLen,
  });
  await tx.done;
  page.cleanup();
}
