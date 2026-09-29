// Application shell: navigation, lazy page loading and the global conceptual/quantitative mode.

import { type ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { GROUPS, ROUTES, routeByPath } from './routes';
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
              {ROUTES.filter((r) => r.group === g.id && r.path !== '/search').map((r) => (
                <a key={r.path} class={`nav-item ${loc.path === r.path ? 'active' : ''}`} href={href(r.path)} aria-current={loc.path === r.path ? 'page' : undefined}>
                  {r.title}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <main class="main" id="main">
          {!route || failed ? (
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
