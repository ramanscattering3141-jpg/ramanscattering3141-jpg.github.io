// A PDF page with clickable overlays (diagrams, moves) and a highlight for the current move.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { bookPdf } from './pdfdocs';
import type { RenderTask } from 'pdfjs-dist';

export interface Overlay { key: string; rect: [number, number, number, number]; cls: string; title?: string; onClick?: () => void }

export function PdfPage({ bookId, page, overlays, scrollTo, children }: { bookId: string; page: number; overlays: Overlay[]; scrollTo?: [number, number, number, number] | null; children?: ComponentChildren }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const ro = new ResizeObserver(() => setWidth(box.current?.clientWidth ?? 0));
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    let task: RenderTask | null = null;
    let alive = true;
    if (!width) return;
    void (async () => {
      try {
        const doc = await bookPdf(bookId);
        const pg = await doc.getPage(page);
        if (!alive || !canvas.current) return;
        const base = pg.getViewport({ scale: 1 });
        const scale = (width / base.width) * Math.min(2, devicePixelRatio || 1);
        const vp = pg.getViewport({ scale });
        const c = canvas.current;
        c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
        task = pg.render({ canvasContext: c.getContext('2d')!, viewport: vp, canvas: c });
        await task.promise;
        setErr(null);
      } catch (e) { if (alive && (e as Error).name !== 'RenderingCancelledException') setErr((e as Error).message); }
    })();
    return () => { alive = false; task?.cancel(); };
  }, [bookId, page, width]);
  useEffect(() => {
    if (!scrollTo || !box.current) return;
    const el = box.current;
    const y = scrollTo[1] * el.scrollHeight - el.clientHeight / 3;
    el.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }, [scrollTo?.join(','), page]);
  return (
    <div class="pdfpage" ref={box}>
      <div style="position:relative">
        <canvas ref={canvas} aria-label={`Page ${page}`} />
        {overlays.map((o) => (
          <div key={o.key} class={`ov ${o.cls}`} title={o.title} onClick={o.onClick} role={o.onClick ? 'button' : undefined}
            style={`left:${o.rect[0] * 100}%;top:${o.rect[1] * 100}%;width:${o.rect[2] * 100}%;height:${o.rect[3] * 100}%`} />
        ))}
        {children}
      </div>
      {err && <div class="notice bad">Could not show page {page}: {err}</div>}
    </div>
  );
}

/** A rendered region of a page (diagram crops, the printed text of a problem move). */
export function PdfCrop({ bookId, page, rect, width = 320, pad = 0.01 }: { bookId: string; page: number; rect: [number, number, number, number]; width?: number; pad?: number }) {
  const c = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const doc = await bookPdf(bookId);
      const pg = await doc.getPage(page);
      const base = pg.getViewport({ scale: 1 });
      const [x, y, w, h] = [Math.max(0, rect[0] - pad), Math.max(0, rect[1] - pad), Math.min(1, rect[2] + 2 * pad), Math.min(1, rect[3] + 2 * pad)];
      const scale = (width * 2) / (w * base.width);
      const vp = pg.getViewport({ scale });
      const full = document.createElement('canvas');
      full.width = Math.floor(vp.width); full.height = Math.floor(vp.height);
      await pg.render({ canvasContext: full.getContext('2d')!, viewport: vp, canvas: full }).promise;
      if (!alive || !c.current) return;
      const sx = x * full.width, sy = y * full.height, sw = w * full.width, sh = h * full.height;
      c.current.width = Math.floor(sw); c.current.height = Math.floor(sh);
      c.current.getContext('2d')!.drawImage(full, sx, sy, sw, sh, 0, 0, sw, sh);
    })().catch(() => undefined);
    return () => { alive = false; };
  }, [bookId, page, rect.join(','), width]);
  return <canvas ref={c} class="crop" style={`width:${width}px;max-width:100%`} aria-label={`Printed on page ${page}`} />;
}
