import './style.css';
import { h, clear, storageGet, storageSet } from './ui/dom';
import { renderHome } from './pages/home';
import { renderFundamentals } from './pages/fundamentals';
import { renderPhysiology, renderWhy } from './pages/physiology';
import { renderSimulator } from './pages/simulator';
import { renderLibrary, renderDx, renderSection } from './pages/library';
import { renderAvnrtLab, renderAvrtLab, renderFlutterLab } from './pages/labs_svt';
import { renderConduction } from './pages/conduction';
import { renderIschemia } from './pages/ischemia';
import { renderElectrolytes } from './pages/electrolytes';
import { renderManagement } from './pages/management';
import { renderAcls } from './pages/acls';
import { renderCases } from './pages/cases';
import { renderChallenge } from './pages/challenge';
import { renderSandbox } from './pages/sandbox';
import { renderDdx } from './pages/ddx';
import { renderSearch, renderSources } from './pages/search';
import { renderTools } from './pages/tools';
import { renderGlossary } from './pages/glossary';
import { renderPath } from './pages/path';
import { renderHeart3d } from './pages/heart3dPage';
import { renderAZ, renderEponyms, renderNormal, renderOmi } from './pages/reference';
import { disclaimer } from './ui/common';

export type Cleanup = (() => void) | void;
type Renderer = (root: HTMLElement, parts: string[], query: URLSearchParams) => Cleanup;

const NAV: { letter: string; label: string; href: string; match: string }[] = [
  { letter: 'A', label: 'ECG Fundamentals', href: '#/fundamentals', match: 'fundamentals' },
  { letter: 'B', label: 'ECG Physiology', href: '#/physiology', match: 'physiology' },
  { letter: 'C', label: 'ECG Simulator', href: '#/simulator', match: 'simulator' },
  { letter: 'D', label: 'Rhythm Library', href: '#/rhythms', match: 'rhythms' },
  { letter: 'E', label: 'Conduction Disorders', href: '#/conduction', match: 'conduction' },
  { letter: 'F', label: 'Structural / Physiological', href: '#/structural', match: 'structural' },
  { letter: 'G', label: 'Ischaemia & Infarction', href: '#/ischemia', match: 'ischemia' },
  { letter: 'H', label: 'Electrolytes & Toxicology', href: '#/electrolytes', match: 'electrolytes' },
  { letter: 'I', label: 'Inherited / Electrical', href: '#/inherited', match: 'inherited' },
  { letter: 'J', label: 'Arrhythmia Management', href: '#/management', match: 'management' },
  { letter: 'K', label: 'ACLS ECG Reference', href: '#/acls', match: 'acls' },
  { letter: 'L', label: 'ECG Cases', href: '#/cases', match: 'cases' },
  { letter: 'M', label: 'ECG Challenge Mode', href: '#/challenge', match: 'challenge' },
  { letter: 'N', label: 'Physiology Sandbox', href: '#/sandbox', match: 'sandbox' },
];
const EXTRA: { label: string; href: string; match: string }[] = [
  { label: '3-D heart, mechanics & slow-motion ECG', href: '#/heart3d', match: 'heart3d' },
  { label: 'ECG library A–Z', href: '#/az', match: 'az' },
  { label: 'Named signs & eponyms', href: '#/eponyms', match: 'eponyms' },
  { label: 'Normal values & variants', href: '#/normal', match: 'normal' },
  { label: 'STEMI equivalents & mimics', href: '#/omi', match: 'omi' },
  { label: 'Learning path & progress', href: '#/path', match: 'path' },
  { label: 'Differential diagnosis engine', href: '#/ddx', match: 'ddx' },
  { label: 'Clinical tools & calculators', href: '#/tools', match: 'tools' },
  { label: 'Glossary', href: '#/glossary', match: 'glossary' },
  { label: 'Sources & evidence', href: '#/sources', match: 'sources' },
];

const ROUTES: Record<string, Renderer> = {
  '': renderHome,
  fundamentals: renderFundamentals,
  physiology: renderPhysiology,
  why: renderWhy,
  simulator: renderSimulator,
  rhythms: (root, parts) => {
    if (parts[0] === 'avnrt-lab') return renderAvnrtLab(root);
    if (parts[0] === 'avrt-lab') return renderAvrtLab(root);
    if (parts[0] === 'flutter-lab') return renderFlutterLab(root);
    return renderLibrary(root);
  },
  dx: renderDx,
  conduction: renderConduction,
  structural: (root) => renderSection(root, 'structural'),
  ischemia: renderIschemia,
  electrolytes: renderElectrolytes,
  inherited: (root) => renderSection(root, 'inherited'),
  management: renderManagement,
  acls: renderAcls,
  cases: renderCases,
  challenge: renderChallenge,
  sandbox: renderSandbox,
  ddx: renderDdx,
  search: renderSearch,
  sources: renderSources,
  tools: renderTools,
  glossary: renderGlossary,
  path: renderPath,
  heart3d: renderHeart3d,
  az: renderAZ,
  eponyms: renderEponyms,
  normal: renderNormal,
  omi: renderOmi,
};

function applyTheme(t: string): void {
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
}

function build(): void {
  applyTheme(storageGet('ecg.theme', 'auto'));
  const app = document.getElementById('app')!;
  app.classList.add('app');
  const nav = h('nav', { class: 'nav', 'aria-label': 'Main' });
  const main = h('main', { class: 'main', id: 'content', tabindex: '-1' });
  const menuBtn = h('button', { class: 'btn', 'aria-label': 'Open menu', 'aria-expanded': 'false' }, '☰');
  const topbar = h('div', { class: 'topbar' }, menuBtn, h('strong', null, 'ECG Physiology Lab'));
  menuBtn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });

  const search = h('input', { type: 'search', placeholder: 'Search: "wide QRS", "adenosine"…', 'aria-label': 'Search' });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && search.value.trim()) location.hash = `#/search?q=${encodeURIComponent(search.value.trim())}`;
  });
  const logo = h('span', {
    html: '<svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="currentColor" opacity=".12"/><path d="M3 18h6l2-6 3 12 3-17 3 11h9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  });
  nav.append(h('a', { class: 'brand', href: '#/' }, logo, 'ECG Physiology Lab'), h('div', { class: 'nav-search' }, search));
  const items: HTMLAnchorElement[] = [];
  for (const n of NAV) {
    const a = h('a', { class: 'nav-item', href: n.href, dataset: { match: n.match } }, h('span', { class: 'letter' }, n.letter), h('span', null, n.label));
    items.push(a);
    nav.append(a);
  }
  nav.append(h('div', { class: 'sep' }));
  for (const n of EXTRA) {
    const a = h('a', { class: 'nav-item', href: n.href, dataset: { match: n.match } }, h('span', { class: 'letter' }, '•'), h('span', null, n.label));
    items.push(a);
    nav.append(a);
  }
  const themeSel = h('select', { 'aria-label': 'Colour theme', class: 'btn theme-btn' }, h('option', { value: 'auto' }, 'Theme: system'), h('option', { value: 'light' }, 'Theme: light'), h('option', { value: 'dark' }, 'Theme: dark'));
  themeSel.value = storageGet('ecg.theme', 'auto');
  themeSel.addEventListener('change', () => {
    storageSet('ecg.theme', themeSel.value);
    applyTheme(themeSel.value);
    route();
  });
  nav.append(themeSel);
  app.append(nav, h('div', null, topbar, main));

  let cleanup: Cleanup;
  function route(): void {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
    const key = parts[0] ?? '';
    const fn = ROUTES[key] ?? renderHome;
    if (typeof cleanup === 'function') cleanup();
    clear(main);
    const root = h('div');
    main.append(root, disclaimer());
    cleanup = fn(root, parts.slice(1), new URLSearchParams(qs ?? ''));
    for (const a of items) a.classList.toggle('on', a.dataset.match === (key === 'dx' ? '' : key));
    nav.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
    window.scrollTo(0, 0);
    const h1 = root.querySelector('h1');
    document.title = h1 ? `${h1.textContent} · ECG Physiology Lab` : 'ECG Physiology Lab';
  }
  window.addEventListener('hashchange', route);
  route();
}

build();
