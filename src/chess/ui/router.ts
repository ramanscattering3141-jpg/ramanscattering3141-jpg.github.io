import { useEffect, useState } from 'preact/hooks';

export interface Route { parts: string[]; query: URLSearchParams }

function parse(): Route {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, q] = h.split('?');
  return { parts: path.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q ?? '') };
}

export function useRoute(): Route {
  const [r, setR] = useState(parse);
  useEffect(() => { const on = () => setR(parse()); addEventListener('hashchange', on); return () => removeEventListener('hashchange', on); }, []);
  return r;
}

export function go(path: string) { location.hash = path.startsWith('#') ? path : `#/${path.replace(/^\//, '')}`; }
export function href(path: string) { return `#/${path.replace(/^\//, '')}`; }
