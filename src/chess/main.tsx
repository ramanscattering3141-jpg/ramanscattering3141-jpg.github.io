import { render } from 'preact';
import '@lichess-org/chessground/assets/chessground.base.css';
import './ui/style.css';
import './ui/pieces.css';
import { App } from './ui/App';
import { applyTheme, getSettings } from './ui/settings';
import { resumeAll } from './pdf/pipeline';

applyTheme();

// Cross-origin isolation (for the multi-threaded engine) via a service worker; GitHub Pages
// cannot send the required headers itself. Reloads once after the worker first takes control.
async function isolation() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  if (!getSettings().isolation) {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const r of regs) if (r.scope.endsWith('/chess/')) await r.unregister();
    return;
  }
  if (window.crossOriginIsolated) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    if (reg.active && !navigator.serviceWorker.controller) { if (!sessionStorage.getItem('coi-reload')) { sessionStorage.setItem('coi-reload', '1'); location.reload(); } return; }
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!sessionStorage.getItem('coi-reload')) { sessionStorage.setItem('coi-reload', '1'); location.reload(); } });
  } catch { /* stays single-threaded */ }
}
void isolation();

render(<App />, document.getElementById('app')!);
void resumeAll();
