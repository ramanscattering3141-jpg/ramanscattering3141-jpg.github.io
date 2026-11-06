import { useEffect, useState } from 'preact/hooks';
import { db, type Bookmark, type Book } from '../db/db';
import { go } from './router';

export function Bookmarks() {
  const [list, setList] = useState<Bookmark[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const load = async () => { const d = await db(); setList((await d.getAll('bookmarks')).sort((a, b) => b.createdAt - a.createdAt)); setBooks(await d.getAll('books')); };
  useEffect(() => { void load(); }, []);
  const open = (b: Bookmark) => {
    if (b.bookId && b.gameId) go(`study/${b.bookId}/${b.gameId}${b.path ? `?path=${encodeURIComponent(b.path)}` : ''}`);
    else if (b.gameId) go(`analysis/${b.gameId}${b.path ? `?path=${encodeURIComponent(b.path)}` : ''}`);
    else if (b.bookId) go(`study/${b.bookId}?page=${b.page ?? 1}`);
    else if (b.fen) go(`analysis?fen=${encodeURIComponent(b.fen)}`);
  };
  return (
    <div class="page">
      <h1>Bookmarks and notes</h1>
      <p class="muted">Bookmark games, positions and variations from the analysis board (<i>More → Bookmark this position</i>). Notes are saved as you type.</p>
      {!list.length && <div class="empty">No bookmarks yet.</div>}
      <div class="col">
        {list.map((b) => (
          <div class="panel" key={b.id}>
            <div class="row"><span class="tag">{b.kind}</span><b class="grow" style="cursor:pointer" onClick={() => open(b)}>{b.label}</b>
              <span class="small muted">{books.find((x) => x.id === b.bookId)?.title}{b.page ? `, p. ${b.page}` : ''}</span>
              <button class="btn small" onClick={() => open(b)}>Open</button>
              <button class="btn small danger" onClick={async () => { await (await db()).delete('bookmarks', b.id); void load(); }}>Remove</button></div>
            <textarea class="input" rows={2} style="font-family:var(--serif);margin-top:.4rem" placeholder="Your note…" value={b.note}
              onChange={async (e) => { await (await db()).put('bookmarks', { ...b, note: (e.target as HTMLTextAreaElement).value }); }} aria-label="Note" />
          </div>
        ))}
      </div>
    </div>
  );
}
