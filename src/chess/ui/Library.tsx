import { useEffect, useState } from 'preact/hooks';
import { db, deleteBook, kvGet, type Book } from '../db/db';
import { addBook, onProgress, type Progress } from '../pdf/pipeline';
import { importPgn } from '../db/games';
import { Modal } from './Modal';
import { toast } from './toast';
import { go } from './router';

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [prog, setProg] = useState<Record<string, Progress>>({});
  const load = async () => setBooks((await (await db()).getAll('books')).sort((a, b) => b.addedAt - a.addedAt));
  useEffect(() => {
    void load();
    return onProgress((p) => { setProg((x) => ({ ...x, [p.bookId]: p })); if (p.done || p.page % 5 === 0) void load(); });
  }, []);
  return { books, prog, reload: load };
}

export function Library() {
  const { books, prog, reload } = useBooks();
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState<string[]>([]);
  const [edit, setEdit] = useState<Book | null>(null);
  const [last, setLast] = useState<{ view: string; bookId?: string; gameId?: string; page?: number; title?: string } | null>(null);
  const [myGames, setMyGames] = useState(0);
  useEffect(() => { void kvGet('last', null).then(setLast); void db().then(async (d) => setMyGames((await d.getAll('games')).filter((g) => !g.bookId).length)); }, []);

  const upload = async (files: FileList | File[]) => {
    for (const f of [...files]) {
      if (/\.pgn$/i.test(f.name)) {
        const r = await importPgn(await f.text());
        toast(`${r.saved.length} game(s) imported from ${f.name}${r.errors.length ? ` — ${r.errors.length} problem(s)` : ''}`);
        setMyGames((n) => n + r.saved.length);
        continue;
      }
      setBusy((b) => [...b, f.name]);
      try { await addBook(f); } catch (e) { toast((e as Error).message, 5000); }
      setBusy((b) => b.filter((x) => x !== f.name));
      void reload();
    }
  };

  return (
    <div class="page">
      <div class="row" style="align-items:flex-end;margin-bottom:.8rem">
        <div class="grow"><h1>Your chess library</h1><div class="muted">Books are read and stored only in this browser. Upload books you have the right to use.</div></div>
        <a class="btn" href="#/analysis">Open analysis board</a>
        {myGames > 0 && <a class="btn" href="#/search?q=">My imported games ({myGames})</a>}
      </div>
      {last && last.bookId && (
        <div class="notice row" style="margin-bottom:.8rem">
          <span class="grow">Continue where you left off: <b>{last.title}</b>{last.page ? `, page ${last.page}` : ''}</span>
          <a class="btn primary" href={`#/study/${last.bookId}${last.gameId ? `/${last.gameId}` : ''}${last.page ? `?page=${last.page}` : ''}`}>Continue</a>
        </div>
      )}
      <label class={`drop${over ? ' over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer?.files.length) void upload(e.dataTransfer.files); }}>
        <div style="font-size:1.05rem"><b>Drop chess books (PDF) here</b>, or click to choose files</div>
        <div class="small muted">Several files at once are fine. Digital and scanned books both work; large books are read in the background, page by page. PGN files are imported as games.</div>
        <input type="file" accept="application/pdf,.pdf,.pgn" multiple class="sr" onChange={(e) => { const f = (e.target as HTMLInputElement).files; if (f) void upload(f); (e.target as HTMLInputElement).value = ''; }} />
        {busy.length > 0 && <div class="small" style="margin-top:.5rem">Checking {busy.join(', ')}…</div>}
      </label>
      {books.length === 0 ? <div class="empty">No books yet.</div> : (
        <div class="books">
          {books.map((b) => <BookCard key={b.id} b={b} p={prog[b.id]} onEdit={() => setEdit(b)} />)}
        </div>
      )}
      {edit && <EditBook book={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); void reload(); }} />}
    </div>
  );
}

function BookCard({ b, p, onEdit }: { b: Book; p?: Progress; onEdit: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { if (!b.cover) return; const u = URL.createObjectURL(b.cover); setUrl(u); return () => URL.revokeObjectURL(u); }, [b.cover]);
  const pct = b.pageCount ? Math.round((b.processedPages / b.pageCount) * 100) : 0;
  return (
    <div class="card book" onClick={() => go(`book/${b.id}`)} role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') go(`book/${b.id}`); }}>
      <div class="cover">{url ? <img src={url} alt="" /> : <span class="muted">PDF</span>}</div>
      <div class="meta">
        <div class="title">{b.title}</div>
        {b.author && <div class="small muted">{b.author}</div>}
        <div class="row small muted"><span>{b.pageCount} pages</span>
          <span class={`tag ${b.status === 'done' ? 'good' : b.status === 'error' ? 'bad' : 'warn'}`}>{b.status === 'done' ? 'ready' : b.status === 'processing' ? `reading ${pct}%` : b.status}</span>
        </div>
        {b.status !== 'done' && <div class="progress"><i style={`width:${pct}%`} /></div>}
        {p && !p.done && <div class="small muted">{p.stage}</div>}
        <div class="row"><button class="btn small" onClick={(e) => { e.stopPropagation(); onEdit(); }}>Details</button></div>
      </div>
    </div>
  );
}

export function EditBook({ book, onClose, onSaved }: { book: Book; onClose: () => void; onSaved: () => void }) {
  const [b, setB] = useState(book);
  const f = (k: keyof Book, label: string) => <label class="field" style="flex:1;min-width:200px">{label}<input class="input" value={String(b[k] ?? '')} onInput={(e) => setB({ ...b, [k]: (e.target as HTMLInputElement).value })} /></label>;
  return (
    <Modal title="Book details" onClose={onClose}>
      <div class="row">{f('title', 'Title')}{f('author', 'Author')}</div>
      <div class="row">{f('edition', 'Edition')}{f('publisher', 'Publisher')}{f('year', 'Year')}</div>
      <div class="small muted" style="margin:.4rem 0">{book.fileName} · {(book.fileSize / 1024 / 1024).toFixed(1)} MB · {book.pageCount} pages</div>
      <div class="row">
        <button class="btn primary" onClick={async () => { await (await db()).put('books', b); onSaved(); }}>Save</button>
        <span class="grow" />
        <button class="btn danger" onClick={async () => {
          if (!confirm(`Delete “${book.title}” and everything extracted from it (games, diagrams, notes, exercises)? This cannot be undone.`)) return;
          await deleteBook(book.id); toast('Book deleted'); onSaved(); go('library');
        }}>Delete book</button>
      </div>
    </Modal>
  );
}
