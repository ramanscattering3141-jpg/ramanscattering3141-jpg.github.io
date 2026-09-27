import 'cesium/Build/Cesium/Widgets/widgets.css';
import './style.css';
import { App } from './App';

// Cesium looks for its workers/assets relative to this URL (copied by vite.config.ts).
(window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = new URL(`${import.meta.env.BASE_URL}${CESIUM_BASE_URL}/`, window.location.href).toString();

function fatal(msg: string) {
  document.body.insertAdjacentHTML('beforeend', `<div class="fatal"><h2>Unable to start</h2><p>${msg}</p></div>`);
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

if (!webglAvailable()) {
  fatal('This simulator needs WebGL. Please use a recent Chrome, Edge, Firefox or Safari with hardware acceleration enabled.');
} else {
  const app = new App(document.getElementById('cesium')!, document.getElementById('ui')!);
  app.init().catch(e => { console.error(e); fatal(String(e?.message ?? e)); });
  (window as unknown as { app: App }).app = app;
}
