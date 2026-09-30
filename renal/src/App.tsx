// Application shell: navigation, lazy page loading and the global conceptual/quantitative mode.

import { type ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { GROUPS, ROUTES, isReady, routeByPath, type RouteDef } from './routes';
import { href, navigate, useLocation } from './router';
import { ModeContext, loadMode, saveMode, type Mode } from './ui/mode';

const pageModules = import.meta.glob<{ default: ComponentType<{ query: URLSearchParams }> }>('./pages/*.tsx');

function usePage(page: string | undefined) {
  const [comp, setComp] = useState<{ name: string; C: ComponentType<{ query: URLSearchParams }> } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    if (!page) return;
    const loader = pageModules[`./pages/${page}.tsx`];
    if (!loader) {
      setFailed(true);
      return;
    }
    let live = true;
    loader()
      .then((m) => live && setComp({ name: page, C: m.default }))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [page]);
  return { comp: comp && comp.name === page ? comp.C : null, failed };
}

/** A module that is planned but not yet written: say so, and point at what already exists. */
function InPreparation(props: { route: RouteDef }) {
  const r = props.route;
  // Deliberately light: the shell is loaded before any page, so it does not import the chapter
  // content. The textbook page itself says whether a chapter has been rebuilt yet.
  const chapters = r.chapters ?? [];
  return (
    <div class="page-head">
      <div class="eyebrow">In preparation</div>
      <h1>{r.title}</h1>
      <p class="lede">{r.blurb}</p>
      <p>This module is being written.</p>
      {chapters.length > 0 && (
        <p>
          Read the physiology it will be built on in the interactive textbook:{' '}
          {chapters.map((n, i) => (
            <span key={n}>
              {i > 0 && ', '}
              <a href={href('/textbook', { ch: String(n) })}>Rose &amp; Post ch. {n}</a>
            </span>
          ))}
          .
        </p>
      )}
      <a href="#/">Back to the start</a>
    </div>
  );
}

export function App() {
  const loc = useLocation();
  const route = routeByPath.get(loc.path);
  const { comp: Page, failed } = usePage(route?.page);
  const [navOpen, setNavOpen] = useState(false);
  const [mode, setModeState] = useState<Mode>(loadMode);
  const [q, setQ] = useState('');
  const setMode = (m: Mode) => {
    setModeState(m);
    saveMode(m);
  };

  useEffect(() => {
    setNavOpen(false);
    window.scrollTo(0, 0);
    document.title = route && route.path !== '/' ? `${route.title} · Renal Physiology Laboratory` : 'Renal Physiology Laboratory';
  }, [loc.path]);

  return (
    <ModeContext.Provider value={{ mode, setMode }}>
      <a class="skip-link" href="#main">
        Skip to content
      </a>
      <div class="app">
        <div class="mobile-bar">
          <button onClick={() => setNavOpen(!navOpen)} aria-expanded={navOpen} aria-controls="sidebar">
            ☰ Menu
          </button>
          <strong style={{ fontSize: '0.95rem' }}>Renal Physiology Lab</strong>
        </div>
        <nav class={`sidebar ${navOpen ? 'open' : ''}`} id="sidebar" aria-label="Modules">
          <a class="sidebar-brand" href="#/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true">
              <rect width="64" height="64" rx="14" fill="#0f2a3d" />
              <path d="M38 14c-9 0-16 7.2-16 16 0 6 2 9 2 14 0 4-2 5-2 7h6c0-4 2-6 2-9 0-5-2-7-2-12 0-6 4.6-10 10-10z" fill="#7fd1c1" />
              <circle cx="27" cy="27" r="3.2" fill="#f2b134" />
            </svg>
            <div>
              <strong>Renal Physiology Lab</strong>
              <span>after Rose &amp; Post</span>
            </div>
          </a>
          <form
            style={{ padding: '6px 14px 4px' }}
            onSubmit={(e) => {
              e.preventDefault();
              navigate('/search', { q });
            }}
            role="search"
          >
            <input type="search" placeholder="Search physiology…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} aria-label="Search" />
          </form>
          <div class="mode-switch" role="group" aria-label="Detail level">
            <button class={mode === 'conceptual' ? 'active' : ''} onClick={() => setMode('conceptual')} title="Qualitative explanations and the main variables">
              Conceptual
            </button>
            <button class={mode === 'quantitative' ? 'active' : ''} onClick={() => setMode('quantitative')} title="Expose Starling forces, fractional reabsorption, transporter activities and the full parameter set">
              Quantitative
            </button>
          </div>
          {GROUPS.map((g) => (
            <div class="nav-group" key={g.id}>
              <h5>{g.label}</h5>
              {ROUTES.filter((r) => r.group === g.id && r.path !== '/search').map((r) =>
                isReady(r) ? (
                  <a key={r.path} class={`nav-item ${loc.path === r.path ? 'active' : ''}`} href={href(r.path)} aria-current={loc.path === r.path ? 'page' : undefined}>
                    {r.title}
                  </a>
                ) : (
                  <span key={r.path} class="nav-item pending" title="This module is being written">
                    {r.title}
                  </span>
                ),
              )}
            </div>
          ))}
        </nav>
        <main class="main" id="main">
          {route && !isReady(route) ? (
            <InPreparation route={route} />
          ) : !route || failed ? (
            <div class="page-head">
              <h1>Not found</h1>
              <p class="lede">There is no module at “{loc.path}”.</p>
              <a href="#/">Back to the start</a>
            </div>
          ) : Page ? (
            <Page query={loc.query} />
          ) : (
            <div class="loading" aria-live="polite">
              Loading {route.title}…
            </div>
          )}
        </main>
      </div>
    </ModeContext.Provider>
  );
}
