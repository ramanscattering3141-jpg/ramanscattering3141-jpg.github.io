// Hash-based router. The laboratory is served as static files (GitHub Pages), so the path lives
// after the '#': /renal/#/loop?p=... Each page reads its query string for scenario presets, which
// is how a clinical case opens a simulator already set to that patient's physiology.

import { useEffect, useState } from 'preact/hooks';

export interface Location {
  path: string;
  query: URLSearchParams;
}

function read(): Location {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  return { path: normalise(path), query: new URLSearchParams(qs ?? '') };
}

/** '/renal/loop/', 'loop', '#/loop' → '/loop' */
export function normalise(path: string): string {
  let p = path.replace(/^#/, '').replace(/^\/?renal\//, '/');
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p || '/';
}

/** Turns an internal route into an href usable in an <a>. */
export function href(route: string, query?: Record<string, string>): string {
  const [path, qs] = route.split('?');
  const q = new URLSearchParams(qs ?? '');
  if (query) for (const [k, v] of Object.entries(query)) q.set(k, v);
  const s = q.toString();
  return `#${normalise(path)}${s ? `?${s}` : ''}`;
}

export function navigate(route: string, query?: Record<string, string>) {
  window.location.hash = href(route, query);
}

export function useLocation(): Location {
  const [loc, setLoc] = useState(read);
  useEffect(() => {
    const on = () => setLoc(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return loc;
}

/** Encode a scenario (a parameter patch plus optional UI settings) into a URL-safe string. */
export function encodeState(obj: unknown): string {
  const json = JSON.stringify(obj);
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeState<T>(s: string | null): T | undefined {
  if (!s) return undefined;
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(b64)))) as T;
  } catch {
    return undefined;
  }
}
