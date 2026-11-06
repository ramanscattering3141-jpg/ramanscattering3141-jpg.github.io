// Study mode: the book page beside the board, kept in step both ways. Clicking a diagram loads
// its position, clicking printed moves goes to them, and moving through the game turns the
// pages and highlights where the current move is printed.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { db, type Book, type ChapterRec, type DiagramRec, type GameRec } from '../db/db';
import { Analysis, rememberPlace, type AnalysisApi } from './Analysis';
import { PdfPage, type Overlay } from './PdfView';
import { go } from './router';

export function Study({ bookId, gameId, page: page0, path }: { bookId: string; gameId?: string; page?: number; path?: string }) {
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<ChapterRec[]>([]);
  const [games, setGames] = useState<GameRec[]>([]);
  const [diagrams, setDiagrams] = useState<DiagramRec[]>([]);
  const [page, setPage] = useState(page0 ?? 1);
  const [game, setGame] = useState<GameRec | null>(null);
  const [freeFen, setFreeFen] = useState<{ fen: string; n: number } | null>(null);
  const [jump, setJump] = useState<{ path: string; nonce: number } | null>(null);
  const [cur, setCur] = useState<{ path: string; id: string } | null>(null);
  const [follow, setFollow] = useState(true);
  const [focus, setFocus] = useState(false);

  useEffect(() => {
    void (async () => {
      const d = await db();
      setBook((await d.get('books', bookId)) ?? null);
      setChapters((await d.getAllFromIndex('chapters', 'byBook', bookId)).sort((a, b) => a.index - b.index));
      const gs = (await d.getAllFromIndex('games', 'byBook', bookId)).sort((a, b) => a.order - b.order);
      setGames(gs);
      setDiagrams(await d.getAllFromIndex('diagrams', 'byBook', bookId));
      const g = gameId ? gs.find((x) => x.id === gameId) ?? null : null;
      setGame(g);
      if (g && path !== undefined) setJump({ path, nonce: Date.now() });
      const a = g && path ? g.anchors.find((x) => x.path === path) : undefined;
      if (g && !page0) setPage(a?.ref.page ?? g.page ?? 1);
    })();
  }, [bookId, gameId]);

  useEffect(() => { if (book) rememberPlace({ view: 'study', bookId, gameId: game?.id, page, title: book.title }); }, [page, game?.id, book]);

  const onCurrent = (api: AnalysisApi) => {
    const path = api.tree.pathKey(api.current);
    setCur({ path, id: game?.id ?? '' });
    if (!game || !follow) return;
    const a = game.anchors.find((x) => x.path === path);
    if (a && a.ref.page !== page) setPage(a.ref.page);
  };

  const anchor = game && cur ? game.anchors.find((x) => x.path === cur.path) : undefined;
  const overlays: Overlay[] = useMemo(() => {
    const out: Overlay[] = [];
    for (const dg of diagrams.filter((x) => x.page === page)) {
      const linked = games.find((g) => dg.id in g.diagrams);
      out.push({
        key: dg.id, rect: dg.rect, cls: `dg${dg.status === 'needs-review' ? ' review' : ''}`,
        title: dg.status === 'needs-review' ? 'Diagram — please check the recognised position' : 'Diagram — click to load this position',
        onClick: () => {
          if (linked) { setFreeFen(null); openGame(linked, linked.diagrams[dg.id]); }
          else if (dg.fen && !dg.errors.length) { setGame(null); setFreeFen({ fen: dg.fen, n: Date.now() }); }
          else go(`review/${bookId}/diagram/${dg.id}`);
        },
      });
    }
    // Printed moves of games on this page.
    for (const g of games) for (const a of g.anchors) {
      if (a.ref.page !== page) continue;
      const isCur = game?.id === g.id && cur?.path === a.path;
      out.push({ key: `${g.id}:${a.path}`, rect: a.ref.rect, cls: `mv${isCur ? ' cur' : ''}`, title: 'Go to this move', onClick: () => openGame(g, a.path) });
    }
    for (const g of games) for (const [k, i] of g.issues.entries()) if (i.ref.page === page && i.kind !== 'repaired') out.push({ key: `${g.id}:i${k}`, rect: i.ref.rect, cls: 'issue', title: i.message, onClick: () => go(`review/${bookId}/game/${g.id}`) });
    return out;
  }, [diagrams, games, page, game?.id, cur?.path]);

  const openGame = (g: GameRec, path: string) => {
    setGame(g);
    setJump({ path, nonce: Date.now() });
  };

  const chapter = chapters.find((c) => page >= c.startPage && page <= c.endPage);
  const pageGames = games.filter((g) => g.anchors.some((a) => a.ref.page === page) || g.page === page);
  if (!book) return <div class="page empty">Loading…</div>;
  const n = book.pageCount;
  return (
    <div class="page" style="max-width:none">
      {!focus && (
        <div class="row" style="margin-bottom:.6rem">
          <a href={`#/book/${bookId}`} class="btn">← {book.title}</a>
          <select class="input" value={chapter?.id ?? ''} onChange={(e) => { const c = chapters.find((x) => x.id === (e.target as HTMLSelectElement).value); if (c) setPage(c.startPage); }} aria-label="Chapter">
            {chapters.map((c) => <option key={c.id} value={c.id}>{c.title} (p. {c.startPage})</option>)}
          </select>
          <select class="input" value={game?.id ?? ''} onChange={(e) => { const g = games.find((x) => x.id === (e.target as HTMLSelectElement).value); if (g) { openGame(g, ''); setPage(g.page ?? page); } }} aria-label="Game">
            <option value="">{pageGames.length ? `Games on this page (${pageGames.length})` : 'No game on this page'}</option>
            {pageGames.map((g) => <option key={g.id} value={g.id}>{gameTitle(g)}</option>)}
            {game && !pageGames.includes(game) && <option value={game.id}>{gameTitle(game)}</option>}
          </select>
          <label class="row small"><input type="checkbox" checked={follow} onChange={(e) => setFollow((e.target as HTMLInputElement).checked)} /> Turn pages with the moves</label>
          <span class="grow" />
          <button class="btn" onClick={() => setFocus(true)} title="Hide navigation">Focus mode</button>
        </div>
      )}
      <div class="study">
        <div class="pdfview">
          <div class="row">
            <button class="btn icon" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} aria-label="Previous page">◀</button>
            <label class="row small">Page <input class="input" type="number" min={1} max={n} value={page} style="width:5rem" onChange={(e) => setPage(Math.max(1, Math.min(n, +(e.target as HTMLInputElement).value || 1)))} /> of {n}</label>
            <button class="btn icon" onClick={() => setPage(Math.min(n, page + 1))} disabled={page >= n} aria-label="Next page">▶</button>
            <span class="grow" />
            {focus && <button class="btn" onClick={() => setFocus(false)}>Exit focus</button>}
            <span class="small muted">{chapter?.title}</span>
          </div>
          <PdfPage bookId={bookId} page={page} overlays={overlays} scrollTo={anchor && anchor.ref.page === page ? anchor.ref.rect : null} />
          <div class="small muted">Click a diagram to load its position, or a printed move to go to it. Orange frames are diagrams to check; red underlines are moves that could not be read.</div>
        </div>
        <div class="studyside">
          {game ? <Analysis key={game.id} game={game} jump={jump} onCurrent={onCurrent} />
            : freeFen ? <Analysis key={`f${freeFen.n}`} initialFen={freeFen.fen} />
              : <Analysis key="blank" onCurrent={onCurrent} />}
        </div>
      </div>
    </div>
  );
}

export function gameTitle(g: GameRec): string {
  if (g.white || g.black) return `${g.white || '?'} – ${g.black || '?'}${g.date ? `, ${g.date.slice(0, 4)}` : ''}`;
  return `${g.type === 'fragment' ? 'Position' : 'Game'} p. ${g.page ?? '?'}${g.opening ? ` · ${g.opening}` : ''}`;
}
