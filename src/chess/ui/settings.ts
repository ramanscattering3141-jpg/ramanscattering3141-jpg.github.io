// User preferences (stored per browser). Small and synchronous, so they live in localStorage.
import { useEffect, useState } from 'preact/hooks';
import type { Flavor } from '../engine/engine';

export interface Settings {
  theme: 'auto' | 'light' | 'dark';
  pieces: 'cburnett' | 'merida';
  flavor: Flavor;
  mode: 'depth' | 'time' | 'infinite';
  depth: number;
  movetime: number;
  multipv: number;
  threads: number;
  hash: number;
  /** Register the service worker that enables the multi-threaded engine. */
  isolation: boolean;
  gameDepth: number;
  coords: boolean;
  showArrows: boolean;
}

const DEFAULTS: Settings = {
  theme: 'auto', pieces: 'cburnett', flavor: 'lite-single', mode: 'infinite', depth: 22, movetime: 3000, multipv: 3,
  threads: 0, hash: 64, isolation: true, gameDepth: 16, coords: true, showArrows: true,
};

const KEY = 'chess-reader-settings';
let current: Settings = load();
const subs = new Set<(s: Settings) => void>();

function load(): Settings {
  try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>) }; } catch { return { ...DEFAULTS }; }
}

export function getSettings(): Settings { return current; }
export function setSettings(p: Partial<Settings>) {
  current = { ...current, ...p };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* private mode */ }
  applyTheme();
  subs.forEach((f) => f(current));
}
export function useSettings(): Settings {
  const [s, set] = useState(current);
  useEffect(() => { subs.add(set); return () => { subs.delete(set); }; }, []);
  return s;
}
export function applyTheme() {
  const t = current.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  document.documentElement.className = `pieces-${current.pieces}`;
}
