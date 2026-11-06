// Manual correction: diagrams (pieces, orientation, side to move), games (moves, boundaries)
// and chapters. Every correction is validated and then the book's games are rebuilt.
import { useEffect, useState } from 'preact/hooks';
import { db, uid, type Book, type ChapterRec, type DiagramRec, type GameRec } from '../db/db';
import { extractBook } from '../pdf/extract';
import { boardFromFen, buildFen, flipBoard, possibleCastling, type Board, type PieceChar } from '../core/fen';
import { parsePgn, writePgn } from '../core/pgn';
import { GameTree, type MoveNode } from '../core/tree';
import { diagramPosition } from '../vision/position';
import { saveGame, treeOf, blankGame, deleteGame } from '../db/games';
import { PositionEditor } from './PositionEditor';
import { PdfCrop } from './PdfView';
import { Analysis } from './Analysis';
import { gameTitle } from './Study';
import { toast } from './toast';
import { go } from './router';

export function Review({ bookId, kind, id }: { bookId: string; kind: string; id?: string }) {
  if (kind === 'diagram' && id) return <DiagramReview bookId={bookId} id={id} />;
  if (kind === 'game' && id) return <GameReview bookId={bookId} id={id} />;
  if (kind === 'chapters') return <ChapterEditor bookId={bookId} />;
  return <div class="page empty">Nothing to review.</div>;
}

const visualToBoard = (v: string): Board => v.split('/').map((r) => [...r].map((c) => (c === '.' ? '' : (c as PieceChar))));

function DiagramReview({ bookId, id }: { bookId: string; id: string }) {
  const [d, setD] = useState<DiagramRec | null>(null);
  const [all, setAll] = useState<DiagramRec[]>([]);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    void (async () => {
      const dbx = await db();
      const rec = (await dbx.get('diagrams', id)) ?? null;
      setD(rec);
      if (rec) setOrientation(rec.orientation);
      setAll((await dbx.getAllFromIndex('diagrams', 'byBook', bookId)).sort((a, b) => a.page - b.page || a.rect[1] - b.rect[1]));
    })();
  }, [id]);
  if (!d) return <div class="page empty">Loading…</div>;
  const visual = visualToBoard(d.visual);
  const oriented = orientation === 'white' ? visual : flipBoard(visual);
  const startFen = d.fen && orientation === d.orientation ? d.fen : buildFen(oriented, { turn: d.turn ?? 'w', castling: possibleCastling(oriented) });
  const conf = orientation === 'white' ? d.cellConf : [...d.cellConf].reverse();
  const idx = all.findIndex((x) => x.id === id);
  const nextReview = all.slice(idx + 1).find((x) => x.status === 'needs-review') ?? all.find((x) => x.status === 'needs-review' && x.id !== id);

  const save = async (fen: string) => {
    const dbx = await db();
    const board = boardFromFen(fen);
    const vis = orientation === 'white' ? board : flipBoard(board);
    const pos = diagramPosition(board, fen.split(' ')[1] as 'w' | 'b');
    const rec: DiagramRec = { ...d, fen, orientation, orientationCertain: true, turn: fen.split(' ')[1] as 'w' | 'b', status: 'corrected', errors: pos.errors, visual: vis.map((r) => r.map((c) => c || '.').join('')).join('/') };
    await dbx.put('diagrams', rec);
    // Learn this book's piece drawings from the confirmed squares.
    let learned = 0;
    if (d.source === 'vision' && d.cells) {
      const existing = await dbx.getAllFromIndex('templates', 'byBook', bookId);
      for (const c of d.cells) {
        if (!c) continue;
        const piece = vis[Math.floor(c.i / 8)][c.i % 8];
        if (!piece) continue;
        const same = existing.filter((t) => t.piece === piece);
        if (same.length >= 12) await dbx.delete('templates', same[0].id);
        await dbx.put('templates', { id: uid(), bookId, piece, d: c.d });
        learned++;
      }
    }
    setD(rec);
    const r = await extractBook(bookId);
    toast(`Diagram saved${learned ? ` (learned ${learned} piece drawings for this book)` : ''}. Games rebuilt: ${r.games + r.fragments}.`);
    if (nextReview) go(`review/${bookId}/diagram/${nextReview.id}`);
  };

  return (
    <div class="page">
      <div class="row" style="margin-bottom:.6rem">
        <a class="btn" href={`#/book/${bookId}/diagrams`}>← Diagrams</a>
        <h2 class="grow" style="margin:0">Diagram on page {d.page}</h2>
        {idx > 0 && <a class="btn" href={`#/review/${bookId}/diagram/${all[idx - 1].id}`}>◀ Previous</a>}
        {idx < all.length - 1 && <a class="btn" href={`#/review/${bookId}/diagram/${all[idx + 1].id}`}>Next ▶</a>}
        {nextReview && <a class="btn" href={`#/review/${bookId}/diagram/${nextReview.id}`}>Next to check</a>}
      </div>
      <div class="row" style="align-items:flex-start;gap:1.2rem">
        <div class="col" style="max-width:360px">
          <div class="small muted">As printed in the book</div>
          <PdfCrop bookId={bookId} page={d.page} rect={d.rect} width={340} pad={0.03} />
          {d.caption && <div class="small">Caption: “{d.caption}”</div>}
          <div class="small muted">Read by {d.source === 'font' ? 'decoding the chess font' : `image recognition (confidence ${Math.round(d.conf * 100)}%)`}. {d.orientationCertain ? '' : 'Orientation was guessed.'}</div>
          <label class="row small"><input type="checkbox" checked={orientation === 'black'} onChange={(e) => { setOrientation((e.target as HTMLInputElement).checked ? 'black' : 'white'); setNonce(nonce + 1); }} /> Printed from Black's side (Black at the bottom)</label>
          {d.errors.map((e) => <div class="notice bad small" key={e}>{e}</div>)}
          {d.status === 'corrected' && <span class="tag good">corrected</span>}
        </div>
        <div class="grow">
          <PositionEditor key={`${d.id}${nonce}${d.status}`} fen={startFen} conf={conf} orientation={orientation} turnUnknown={!d.turn} allowFlip={false} saveLabel="Save diagram" onSave={(f) => void save(f)} />
        </div>
      </div>
    </div>
  );
}

function GameReview({ bookId, id }: { bookId: string; id: string }) {
  const [g, setG] = useState<GameRec | null>(null);
  const [jump, setJump] = useState<{ path: string; nonce: number } | null>(null);
  const [pgn, setPgn] = useState('');
  const [cur, setCur] = useState<{ tree: GameTree; node: MoveNode } | null>(null);
  const [all, setAll] = useState<GameRec[]>([]);
  const load = async () => {
    const d = await db();
    const rec = (await d.get('games', id)) ?? null;
    setG(rec); if (rec) setPgn(rec.pgn);
    setAll((await d.getAllFromIndex('games', 'byBook', bookId)).sort((a, b) => a.order - b.order));
  };
  useEffect(() => { void load(); }, [id]);
  if (!g) return <div class="page empty">Loading…</div>;
  const parsed = parsePgn(pgn);
  const errs = parsed[0]?.errors ?? [{ message: 'No game found', offset: 0 }];
  const idx = all.findIndex((x) => x.id === id);
  const next = all[idx + 1];

  const savePgn = async () => {
    if (!parsed[0] || errs.length) { toast('Fix the PGN first'); return; }
    await saveGame({ ...g, manual: true, status: 'corrected' }, parsed[0].tree);
    toast('Game saved'); void load();
  };
  const markChecked = async () => { await saveGame({ ...g, status: 'corrected', manual: true }, treeOf(g)); toast('Marked as checked'); void load(); };
  const split = async () => {
    if (!cur || !cur.node.parent) { toast('Go to the move where the new game should start'); return; }
    const t = cur.tree;
    const start = cur.node.parent;
    const nt = new GameTree(start.fen);
    const copy = (from: MoveNode, to: MoveNode) => { for (const c of from.children) { const n = nt.addMove(to, c.san); n.nags = [...c.nags]; n.comment = c.comment; copy(c, n); } };
    copy(start, nt.root);
    start.children = [];
    await saveGame({ ...g, manual: true }, t);
    await saveGame(blankGame({ bookId, chapterId: g.chapterId, page: g.page, type: 'fragment', manual: true, order: g.order + 0.5, status: 'corrected' }), nt);
    toast('Game split in two'); void load();
  };
  const merge = async () => {
    if (!next) return;
    const t = treeOf(g), nt = treeOf(next);
    const end = t.lineEnd(t.root);
    if (end.fen.split(' ').slice(0, 4).join(' ') !== nt.root.fen.split(' ').slice(0, 4).join(' ')) { toast('The next game does not continue from the end of this one'); return; }
    const copy = (from: MoveNode, to: MoveNode) => { for (const c of from.children) { const n = t.addMove(to, c.san); n.nags = [...c.nags]; n.comment = c.comment; copy(c, n); } };
    copy(nt.root, end);
    await saveGame({ ...g, manual: true, anchors: [...g.anchors, ...next.anchors] }, t);
    await deleteGame(next.id);
    toast('Games merged'); void load();
  };

  const real = g.issues.filter((i) => i.kind !== 'repaired');
  return (
    <div class="page" style="max-width:none">
      <div class="row" style="margin-bottom:.6rem">
        <a class="btn" href={`#/book/${bookId}/problems`}>← Problems</a>
        <h2 class="grow" style="margin:0">{gameTitle(g)}</h2>
        <button class="btn" onClick={markChecked}>Mark as checked</button>
        <button class="btn" onClick={split} title="Start a new game at the selected move">Split here</button>
        <button class="btn" onClick={merge} disabled={!next}>Merge with next</button>
        <a class="btn" href={`#/study/${bookId}/${g.id}`}>Open in study</a>
      </div>
      <div class="row" style="align-items:flex-start;gap:1rem">
        <div class="col" style="width:min(100%,420px)">
          <div class="panel">
            <h3>Problems ({real.length})</h3>
            {real.length === 0 && <div class="small muted">No unreadable moves.</div>}
            {g.issues.map((i, k) => (
              <div key={k} style="margin-bottom:.7rem">
                <div class="small"><span class={`tag ${i.kind === 'repaired' ? 'warn' : 'bad'}`}>{i.kind}</span> p. {i.ref.page}: {i.message}</div>
                <PdfCrop bookId={bookId} page={i.ref.page} rect={[Math.max(0, i.ref.rect[0] - 0.2), i.ref.rect[1] - 0.005, Math.min(1, i.ref.rect[2] + 0.4), i.ref.rect[3] + 0.01]} width={380} pad={0} />
                {i.at !== undefined && <button class="btn small" onClick={() => setJump({ path: i.at!, nonce: Date.now() })}>Go to this position{i.kind !== 'repaired' ? ' and play the right move' : ''}</button>}
                {i.candidates && <div class="small muted">Possible moves: {i.candidates.join(', ')}</div>}
              </div>
            ))}
            <div class="small muted">Moves you play on the board are saved into this game (it is then kept when the book is re-read).</div>
          </div>
          <div class="panel">
            <h3>PGN</h3>
            <textarea class="input" rows={10} value={pgn} onInput={(e) => setPgn((e.target as HTMLTextAreaElement).value)} aria-label="PGN text" />
            {errs.map((e, k) => <div class="small" style="color:var(--bad)" key={k}>{e.message}</div>)}
            <div class="row"><button class="btn primary" onClick={savePgn} disabled={!!errs.length}>Save PGN</button><button class="btn" onClick={() => setPgn(cur ? writePgn(cur.tree) : g.pgn)}>Reload from board</button></div>
          </div>
        </div>
        <div class="grow" style="min-width:300px">
          <Analysis key={g.id + g.updatedAt} game={g} jump={jump} onCurrent={(a) => setCur({ tree: a.tree, node: a.current })} />
        </div>
      </div>
    </div>
  );
}

function ChapterEditor({ bookId }: { bookId: string }) {
  const [book, setBook] = useState<Book | null>(null);
  const [rows, setRows] = useState<Array<{ title: string; startPage: number }>>([]);
  useEffect(() => {
    void (async () => {
      const d = await db();
      setBook((await d.get('books', bookId)) ?? null);
      setRows((await d.getAllFromIndex('chapters', 'byBook', bookId)).sort((a, b) => a.index - b.index).map((c) => ({ title: c.title, startPage: c.startPage })));
    })();
  }, [bookId]);
  if (!book) return <div class="page empty">Loading…</div>;
  const save = async () => {
    const d = await db();
    const sorted = rows.filter((r) => r.title.trim()).sort((a, b) => a.startPage - b.startPage);
    for (const c of await d.getAllFromIndex('chapters', 'byBook', bookId)) await d.delete('chapters', c.id);
    for (const [i, r] of sorted.entries()) {
      const rec: ChapterRec = { id: uid(), bookId, index: i, title: r.title.trim(), startPage: Math.max(1, Math.min(book.pageCount, r.startPage)), endPage: i + 1 < sorted.length ? Math.max(r.startPage, sorted[i + 1].startPage - 1) : book.pageCount, source: 'manual' };
      await d.put('chapters', rec);
    }
    const res = await extractBook(bookId);
    toast(`Chapters saved; ${res.games + res.fragments} games rebuilt`);
    go(`book/${bookId}`);
  };
  return (
    <div class="page" style="max-width:800px">
      <div class="row"><a class="btn" href={`#/book/${bookId}`}>← {book.title}</a><h2 class="grow" style="margin:0">Chapters</h2></div>
      <div class="panel col" style="margin-top:.6rem">
        {rows.map((r, i) => (
          <div class="row" key={i}>
            <input class="input grow" value={r.title} aria-label="Chapter title" onInput={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, title: (e.target as HTMLInputElement).value } : x)))} />
            <label class="row small">starts on page <input class="input" type="number" min={1} max={book.pageCount} value={r.startPage} style="width:5.5rem" onInput={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, startPage: +(e.target as HTMLInputElement).value || 1 } : x)))} /></label>
            <button class="btn icon danger" aria-label="Remove chapter" onClick={() => setRows(rows.filter((_, k) => k !== i))}>✕</button>
          </div>
        ))}
        <div class="row"><button class="btn" onClick={() => setRows([...rows, { title: 'New chapter', startPage: 1 }])}>Add chapter</button><span class="grow" /><button class="btn primary" onClick={save}>Save chapters</button></div>
      </div>
    </div>
  );
}
