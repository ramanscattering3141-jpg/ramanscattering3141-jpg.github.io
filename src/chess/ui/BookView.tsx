import { useEffect, useRef, useState } from 'preact/hooks';
import { db, uid, type Book, type ChapterRec, type DiagramRec, type GameRec, type PageRec } from '../db/db';
import { enqueue, pause, reprocessPages, isRunning } from '../pdf/pipeline';
import { extractBook } from '../pdf/extract';
import { writePgnDatabase, validatePgn } from '../core/pgn';
import { treeOf } from '../db/games';
import { analyzeGame } from '../engine/gameAnalysis';
import { getEngine } from '../engine/engine';
import { cached, store } from '../engine/cache';
import { formatScore } from '../engine/uci';
import { useBooks, EditBook } from './Library';
import { PdfCrop } from './PdfView';
import { gameTitle } from './Study';
import { getSettings } from './settings';
import { download, toast } from './toast';
import { go } from './router';

type Tab = 'contents' | 'diagrams' | 'problems' | 'pages' | 'settings';

export function BookView({ bookId, tab = 'contents' }: { bookId: string; tab?: Tab }) {
  const { books, prog, reload } = useBooks();
  const book = books.find((b) => b.id === bookId);
  const [chapters, setChapters] = useState<ChapterRec[]>([]);
  const [games, setGames] = useState<GameRec[]>([]);
  const [diagrams, setDiagrams] = useState<DiagramRec[]>([]);
  const [pages, setPages] = useState<PageRec[]>([]);
  const [edit, setEdit] = useState(false);
  const [batch, setBatch] = useState<string | null>(null);
  const stopRef = useRef({ stop: false });
  const loadAll = async () => {
    const d = await db();
    setChapters((await d.getAllFromIndex('chapters', 'byBook', bookId)).sort((a, b) => a.index - b.index));
    setGames((await d.getAllFromIndex('games', 'byBook', bookId)).sort((a, b) => a.order - b.order));
    setDiagrams((await d.getAllFromIndex('diagrams', 'byBook', bookId)).sort((a, b) => a.page - b.page || a.rect[1] - b.rect[1]));
    setPages((await d.getAllFromIndex('pages', 'byBook', bookId)).sort((a, b) => a.page - b.page));
  };
  const p = prog[bookId];
  useEffect(() => { void loadAll(); }, [bookId, book?.status, book?.lastExtract, p?.done]);
  if (!book) return <div class="page empty">{books.length ? 'This book is not in your library.' : 'Loading…'}</div>;

  const pct = book.pageCount ? Math.round((book.processedPages / book.pageCount) * 100) : 0;
  const review = diagrams.filter((d) => d.status === 'needs-review').length;
  const bad = games.filter((g) => g.status === 'needs-review').length;
  const exportGames = (list: GameRec[], name: string) => {
    const text = writePgnDatabase(list.map(treeOf));
    const v = validatePgn(text);
    if (!v.ok) { toast(`Export stopped: ${v.errors[0]}`, 5000); return; }
    download(`${name}.pgn`, text);
    toast(`${v.games} game${v.games === 1 ? '' : 's'} exported (all moves checked)`);
  };
  const analyzeChapter = async (list: GameRec[]) => {
    if (batch) { stopRef.current.stop = true; return; }
    const stop = (stopRef.current = { stop: false });
    const s = getSettings();
    for (const [i, g] of list.entries()) {
      if (stop.stop) break;
      setBatch(`Analysing game ${i + 1} of ${list.length}`);
      await analyzeGame(treeOf(g), { gameId: g.id, depth: s.gameDepth, flavor: s.flavor, signal: stop, onProgress: (dn, t) => setBatch(`Game ${i + 1}/${list.length}: move ${dn}/${t}`) });
    }
    setBatch(null);
    toast('Analysis saved — open a game to see its graph');
  };

  const tabs: Array<[Tab, string]> = [['contents', `Contents (${games.length})`], ['diagrams', `Diagrams (${diagrams.length}${review ? `, ${review} to check` : ''})`], ['problems', `Problems (${bad})`], ['pages', 'Pages'], ['settings', 'Reading settings']];
  return (
    <div class="page">
      <div class="row" style="align-items:flex-start;margin-bottom:.8rem">
        <div class="grow">
          <h1 style="margin-bottom:.2rem">{book.title}</h1>
          <div class="muted">{[book.author, book.edition, book.publisher, book.year].filter(Boolean).join(' · ') || 'No author details'} · {book.pageCount} pages</div>
        </div>
        <button class="btn" onClick={() => setEdit(true)}>Details</button>
        <a class="btn primary" href={`#/study/${book.id}`}>Study</a>
      </div>
      {book.status !== 'done' && (
        <div class="notice" style="margin-bottom:.8rem">
          <div class="row"><b class="grow">{book.status === 'processing' ? 'Reading the book' : book.status === 'paused' ? 'Paused' : book.status === 'error' ? 'Stopped by an error' : 'Waiting'} — {book.processedPages} of {book.pageCount} pages</b>
            {book.status === 'processing' || isRunning(book.id) ? <button class="btn" onClick={() => { pause(book.id); void reload(); }}>Pause</button> : <button class="btn primary" onClick={() => { enqueue(book.id); void reload(); }}>{book.processedPages ? 'Resume' : 'Start'}</button>}
          </div>
          <div class="progress" style="margin-top:.4rem"><i style={`width:${pct}%`} /></div>
          {p && !p.done && <div class="small muted">{p.stage}</div>}
          {book.error && <div class="small" style="color:var(--bad)">{book.error}</div>}
        </div>
      )}
      {p?.summary && <div class="notice small" style="margin-bottom:.8rem">Found {p.summary.games} games and {p.summary.fragments} positions with moves ({p.summary.moves} moves, every one checked for legality). {p.summary.issues ? `${p.summary.issues} places need your attention.` : ''} {p.summary.orphans.length ? `${p.summary.orphans.length} move sequences could not be placed.` : ''} Notation: {p.summary.language.toUpperCase()}{p.summary.boldMain ? ', main line in bold' : ''}.</div>}
      <div class="nav" role="tablist" style="margin-bottom:.8rem">{tabs.map(([t, l]) => <a key={t} role="tab" class={tab === t ? 'on' : ''} href={`#/book/${bookId}/${t}`}>{l}</a>)}</div>
      {batch && <div class="notice row" style="margin-bottom:.6rem"><span class="grow">{batch}</span><button class="btn" onClick={() => { stopRef.current.stop = true; }}>Stop</button></div>}

      {tab === 'contents' && (
        <div class="col">
          <div class="row"><button class="btn" onClick={() => exportGames(games, book.title)} disabled={!games.length}>Export whole book (PGN)</button>
            <button class="btn" onClick={() => analyzeChapter(games)} disabled={!games.length}>Analyse every game</button>
            <a class="btn" href={`#/review/${bookId}/chapters`}>Edit chapters</a></div>
          {chapters.map((c) => {
            const list = games.filter((g) => g.chapterId === c.id);
            return (
              <details class="panel" key={c.id} open={chapters.length < 6}>
                <summary class="row" style="cursor:pointer"><b class="grow">{c.title}</b><span class="small muted">pp. {c.startPage}–{c.endPage} · {list.length} games</span></summary>
                <div class="row" style="margin:.5rem 0">
                  <a class="btn small" href={`#/study/${bookId}?page=${c.startPage}`}>Read</a>
                  <button class="btn small" disabled={!list.length} onClick={() => exportGames(list, `${book.title} - ${c.title}`)}>Export chapter</button>
                  <button class="btn small" disabled={!list.length || !!batch} onClick={() => analyzeChapter(list)}>Analyse chapter</button>
                </div>
                {list.length > 0 && <GameTable games={list} bookId={bookId} />}
              </details>
            );
          })}
          {games.filter((g) => !g.chapterId).length > 0 && <div class="panel"><h3>Other games</h3><GameTable games={games.filter((g) => !g.chapterId)} bookId={bookId} /></div>}
          {!games.length && book.status === 'done' && <div class="empty">No games were found. If this is a scanned book, check “Read every page with OCR” under Reading settings.</div>}
        </div>
      )}
      {tab === 'diagrams' && <DiagramList diagrams={diagrams} games={games} bookId={bookId} />}
      {tab === 'problems' && <Problems games={games} bookId={bookId} />}
      {tab === 'pages' && <PageList pages={pages} bookId={bookId} onChange={() => { void loadAll(); void reload(); }} />}
      {tab === 'settings' && <ReadingSettings book={book} onSaved={() => { void reload(); void loadAll(); }} />}
      {edit && <EditBook book={book} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); void reload(); }} />}
    </div>
  );
}

function GameTable({ games, bookId }: { games: GameRec[]; bookId: string }) {
  return (
    <div class="scroll">
      <table class="list">
        <thead><tr><th>Game</th><th>Opening</th><th>Moves</th><th>Page</th><th>Status</th></tr></thead>
        <tbody>
          {games.map((g) => (
            <tr class="click" key={g.id} onClick={() => go(`study/${bookId}/${g.id}`)}>
              <td>{gameTitle(g)}{g.event && g.event !== '?' && !g.event.includes(', p.') ? <span class="small muted"> · {g.event}</span> : null}</td>
              <td class="small">{g.eco} {g.opening}</td>
              <td>{Math.ceil(g.plies / 2)}{g.result && g.result !== '*' ? ` · ${g.result}` : ''}</td>
              <td>{g.page}</td>
              <td>{g.status === 'needs-review' ? <span class="tag warn">check</span> : g.manual ? <span class="tag">edited</span> : <span class="tag good">{Math.round(g.confidence * 100)}%</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DiagramList({ diagrams, games, bookId }: { diagrams: DiagramRec[]; games: GameRec[]; bookId: string }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [evals, setEvals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'all' | 'review'>('all');
  const list = diagrams.filter((d) => filter === 'all' || d.status === 'needs-review');
  const toggle = (id: string) => { const s = new Set(sel); if (s.has(id)) s.delete(id); else s.add(id); setSel(s); };
  const analyse = async () => {
    const s = getSettings();
    const eng = getEngine(s.flavor);
    setBusy(true);
    for (const d of diagrams.filter((x) => sel.has(x.id) && x.fen && !x.errors.length)) {
      let r = await cached(d.fen!, s.flavor, 1);
      if (!r || r.depth < s.gameDepth) { r = await eng.analyze(d.fen!, { depth: s.gameDepth }, 1); await store(r); }
      setEvals((e) => ({ ...e, [d.id]: `${formatScore(r!.lines[0]?.score ?? { cp: 0 })} d${r!.depth}${r!.terminal ? ` (${r!.terminal})` : ''}` }));
    }
    setBusy(false);
  };
  const exercises = async () => {
    const d = await db();
    let n = 0;
    for (const dg of diagrams.filter((x) => sel.has(x.id) && x.fen && !x.errors.length)) {
      const g = games.find((x) => dg.id in x.diagrams);
      let solution: string[] = [];
      if (g) { const t = treeOf(g); const node = t.findByPathKey(g.diagrams[dg.id]); if (node?.children[0]) solution = [node.children[0].uci]; }
      await d.put('exercises', { id: uid(), bookId, diagramId: dg.id, gameId: g?.id, path: g?.diagrams[dg.id], fen: g ? (treeOf(g).findByPathKey(g.diagrams[dg.id])?.fen ?? dg.fen!) : dg.fen!, solution, kind: solution.length ? 'author-move' : 'best-move', theme: dg.caption ?? '', prompt: dg.caption || `${dg.fen!.split(' ')[1] === 'w' ? 'White' : 'Black'} to move`, createdAt: Date.now(), page: dg.page });
      n++;
    }
    toast(`${n} exercise${n === 1 ? '' : 's'} added to Training`);
  };
  const fens = () => download('diagrams.txt', diagrams.filter((x) => sel.has(x.id) || !sel.size).map((x) => `p. ${x.page}\t${x.fen ?? '(not a legal position yet)'}${x.caption ? `\t${x.caption}` : ''}`).join('\n') + '\n', 'text/plain');
  return (
    <div class="col">
      <div class="row">
        <select class="input" value={filter} onChange={(e) => setFilter((e.target as HTMLSelectElement).value as 'all')}><option value="all">All diagrams</option><option value="review">Only those to check</option></select>
        <button class="btn small" onClick={() => setSel(new Set(list.map((d) => d.id)))}>Select all</button>
        <button class="btn small" onClick={() => setSel(new Set())}>Select none</button>
        <span class="muted small">{sel.size} selected</span>
        <span class="grow" />
        <button class="btn" disabled={!sel.size || busy} onClick={analyse}>{busy ? 'Analysing…' : 'Analyse selected'}</button>
        <button class="btn" disabled={!sel.size} onClick={exercises}>Make exercises</button>
        <button class="btn" onClick={fens}>Download FENs</button>
      </div>
      <div class="books">
        {list.map((d) => (
          <div class="card" key={d.id} style="padding:.5rem">
            <PdfCrop bookId={bookId} page={d.page} rect={d.rect} width={200} />
            <div class="row small" style="margin-top:.3rem">
              <input type="checkbox" checked={sel.has(d.id)} onChange={() => toggle(d.id)} aria-label="Select diagram" />
              <span>p. {d.page}</span>
              {d.status === 'needs-review' ? <span class="tag warn">check</span> : d.status === 'corrected' ? <span class="tag good">corrected</span> : <span class="tag good">{Math.round(d.conf * 100)}%</span>}
              {d.source === 'font' && <span class="tag">chess font</span>}
            </div>
            {d.errors[0] && <div class="small" style="color:var(--bad)">{d.errors[0]}</div>}
            {evals[d.id] && <div class="small mono">{evals[d.id]}</div>}
            <div class="row" style="margin-top:.3rem"><a class="btn small" href={`#/review/${bookId}/diagram/${d.id}`}>Check / correct</a>
              {d.fen && !d.errors.length && <a class="btn small" href={`#/analysis?fen=${encodeURIComponent(d.fen)}`}>Analyse</a>}</div>
          </div>
        ))}
      </div>
      {!list.length && <div class="empty">No diagrams.</div>}
    </div>
  );
}

function Problems({ games, bookId }: { games: GameRec[]; bookId: string }) {
  const list = games.filter((g) => g.status === 'needs-review' || g.issues.some((i) => i.kind !== 'repaired'));
  if (!list.length) return <div class="empty">Nothing to fix: every extracted move was read and is legal.</div>;
  return (
    <div class="col">
      {list.map((g) => (
        <div class="panel" key={g.id}>
          <div class="row"><b class="grow">{gameTitle(g)}</b><a class="btn small primary" href={`#/review/${bookId}/game/${g.id}`}>Correct</a></div>
          {g.issues.filter((i) => i.kind !== 'repaired').slice(0, 4).map((i, k) => <div class="small" key={k}>p. {i.ref.page}: {i.message}</div>)}
        </div>
      ))}
    </div>
  );
}

function PageList({ pages, bookId, onChange }: { pages: PageRec[]; bookId: string; onChange: () => void }) {
  const [sel, setSel] = useState<Set<number>>(new Set());
  return (
    <div class="col">
      <div class="row">
        <span class="small muted">{pages.filter((p) => p.status === 'done').length} read · {pages.filter((p) => p.ocr).length} with OCR · {pages.filter((p) => p.status === 'error').length} failed</span>
        <span class="grow" />
        <button class="btn" disabled={!sel.size} onClick={async () => { await reprocessPages(bookId, [...sel]); setSel(new Set()); toast('Pages queued'); onChange(); }}>Read selected pages again</button>
      </div>
      <div class="scroll" style="max-height:60vh">
        <table class="list">
          <thead><tr><th></th><th>Page</th><th>Status</th><th>Text</th><th>Headings</th></tr></thead>
          <tbody>{pages.map((p) => (
            <tr key={p.page}>
              <td><input type="checkbox" checked={sel.has(p.page)} onChange={() => { const s = new Set(sel); if (s.has(p.page)) s.delete(p.page); else s.add(p.page); setSel(s); }} aria-label={`Select page ${p.page}`} /></td>
              <td><a href={`#/study/${bookId}?page=${p.page}`}>{p.page}</a></td>
              <td>{p.status === 'error' ? <span class="tag bad" title={p.error}>failed</span> : p.status === 'done' ? <span class="tag good">read</span> : <span class="tag">waiting</span>}</td>
              <td class="small">{p.ocr ? 'OCR' : 'text layer'}{p.garbled ? ' (text layer unreadable)' : ''}</td>
              <td class="small">{p.headings.join(' · ')}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function ReadingSettings({ book, onSaved }: { book: Book; onSaved: () => void }) {
  const [s, setS] = useState(book.settings);
  const [busy, setBusy] = useState(false);
  const save = async (reread: boolean) => {
    setBusy(true);
    const d = await db();
    await d.put('books', { ...(await d.get('books', book.id))!, settings: s });
    if (reread) await reprocessPages(book.id, Array.from({ length: book.pageCount }, (_, i) => i + 1));
    else { const r = await extractBook(book.id); toast(`Re-read notation: ${r.games} games, ${r.fragments} positions`); }
    setBusy(false); onSaved();
  };
  return (
    <div class="panel col" style="max-width:640px">
      <label class="field">Piece letters in the notation
        <select class="input" value={s.language} onChange={(e) => setS({ ...s, language: (e.target as HTMLSelectElement).value as never })}>
          <option value="auto">Detect automatically</option><option value="en">English (K Q R B N)</option><option value="de">German (K D T L S)</option><option value="fr">French (R D T F C)</option><option value="es">Spanish (R D T A C)</option><option value="it">Italian (R D T A C)</option><option value="nl">Dutch (K D T L P)</option><option value="pt">Portuguese (R D T B C)</option><option value="sv">Swedish (K D T L S)</option><option value="cs">Czech (K D V S J)</option><option value="pl">Polish (K H W G S)</option><option value="hu">Hungarian (K V B F H)</option>
        </select>
      </label>
      <label class="field">Notation style
        <select class="input" value={s.style} onChange={(e) => setS({ ...s, style: (e.target as HTMLSelectElement).value as never })}>
          <option value="auto">Detect (algebraic, figurine or descriptive)</option><option value="algebraic">Algebraic only</option><option value="descriptive">Descriptive (P-K4)</option>
        </select>
      </label>
      <label class="field">Main line printed in bold
        <select class="input" value={s.boldMain} onChange={(e) => setS({ ...s, boldMain: (e.target as HTMLSelectElement).value as never })}>
          <option value="auto">Detect</option><option value="yes">Yes</option><option value="no">No</option>
        </select>
      </label>
      <label class="row"><input type="checkbox" checked={s.forceOcr} onChange={(e) => setS({ ...s, forceOcr: (e.target as HTMLInputElement).checked })} /> Read every page with OCR (for scans with a poor text layer)</label>
      <div class="row">
        <button class="btn primary" disabled={busy} onClick={() => save(false)}>Save and rebuild games</button>
        <button class="btn" disabled={busy} onClick={() => save(true)} title="Needed after changing the OCR option">Save and read all pages again</button>
      </div>
      <div class="small muted">Rebuilding is quick and keeps games you edited. Reading pages again repeats OCR and diagram recognition.</div>
    </div>
  );
}
