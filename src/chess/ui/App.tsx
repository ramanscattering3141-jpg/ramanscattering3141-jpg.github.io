import { useEffect, useState } from 'preact/hooks';
import { useRoute, href } from './router';
import { Library } from './Library';
import { BookView } from './BookView';
import { Study } from './Study';
import { Analysis, rememberPlace } from './Analysis';
import { Review } from './Review';
import { Training } from './Training';
import { Search } from './Search';
import { Bookmarks } from './Bookmarks';
import { SettingsPage, About } from './SettingsPage';
import { db, type GameRec } from '../db/db';

function AnalysisRoute({ id, fen, path }: { id?: string; fen?: string; path?: string }) {
  const [g, setG] = useState<GameRec | null | undefined>(id ? undefined : null);
  useEffect(() => { if (id) void db().then((d) => d.get('games', id)).then((x) => setG(x ?? null)); else setG(null); }, [id]);
  useEffect(() => { if (g) rememberPlace({ view: 'analysis', gameId: g.id }); }, [g?.id]);
  if (g === undefined) return <div class="page empty">Loading…</div>;
  return <div class="page" style="max-width:none"><Analysis key={id ?? fen ?? 'free'} game={g} initialFen={fen} jump={path ? { path, nonce: 1 } : null} /></div>;
}

export function App() {
  const r = useRoute();
  const [a, b, c, d2] = r.parts;
  const section = a ?? 'library';
  let view;
  switch (section) {
    case 'book': view = <BookView bookId={b} tab={(c as never) ?? 'contents'} />; break;
    case 'study': view = <Study key={`${b}${c ?? ''}`} bookId={b} gameId={c} page={r.query.get('page') ? +r.query.get('page')! : undefined} path={r.query.get('path') ?? undefined} />; break;
    case 'analysis': view = <AnalysisRoute id={b} fen={r.query.get('fen') ?? undefined} path={r.query.get('path') ?? undefined} />; break;
    case 'review': view = <Review bookId={b} kind={c} id={d2} />; break;
    case 'train': view = <Training />; break;
    case 'search': view = <Search />; break;
    case 'bookmarks': view = <Bookmarks />; break;
    case 'settings': view = <SettingsPage />; break;
    case 'about': view = <About />; break;
    default: view = <Library />;
  }
  const nav: Array<[string, string]> = [['library', 'Library'], ['analysis', 'Analysis'], ['train', 'Training'], ['search', 'Search'], ['bookmarks', 'Bookmarks'], ['settings', 'Settings'], ['about', 'About']];
  const on = (k: string) => section === k || (k === 'library' && ['book', 'study', 'review'].includes(section));
  return (
    <>
      <header class="topbar">
        <a class="brand" href={href('library')}>
          <svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="12" fill="#2b2a27" /><path d="M22 50h20l-2-6H24zm2-8h16c-1-6-2-10 1-15-3-1-5-4-5-7 0-3 2-5 4-6l-4-4-3 3-3-3-4 4c2 1 4 3 4 6 0 3-2 6-5 7 3 5 2 9 0 15z" fill="#e9c46a" /></svg>
          <span>Chess Book Reader</span>
        </a>
        <nav class="nav" aria-label="Main">{nav.map(([k, l]) => <a key={k} href={href(k)} class={on(k) ? 'on' : ''} aria-current={on(k) ? 'page' : undefined}>{l}</a>)}</nav>
      </header>
      <main>{view}</main>
    </>
  );
}
