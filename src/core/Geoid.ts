// EGM96 geoid undulation N (metres): ellipsoid height = height above MSL + N.
// Loaded from a 1° grid (see tools/build-geoid.mjs) and bilinearly interpolated;
// accuracy is ~1–2 m in most places, which is ample for lining up scenery.

let grid: Int16Array | null = null;
let loading: Promise<void> | null = null;

export function loadGeoid(url: string): Promise<void> {
  if (!loading) {
    loading = fetch(url)
      .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then(b => { grid = new Int16Array(b); })
      .catch(e => { console.warn('geoid grid unavailable', e); });
  }
  return loading;
}

export const geoidReady = () => grid !== null;

/** Geoid undulation N in metres at (lat, lon), or 0 if the grid is not loaded. */
export function geoidUndulation(lat: number, lon: number): number {
  if (!grid) return 0;
  const r = Math.min(179.9999, Math.max(0, 90 - lat));
  const c = Math.min(359.9999, Math.max(0, ((lon + 180) % 360 + 360) % 360));
  const r0 = Math.floor(r), c0 = Math.floor(c), fr = r - r0, fc = c - c0;
  const at = (rr: number, cc: number) => grid![rr * 361 + cc] / 100;
  return (at(r0, c0) * (1 - fc) + at(r0, c0 + 1) * fc) * (1 - fr) + (at(r0 + 1, c0) * (1 - fc) + at(r0 + 1, c0 + 1) * fc) * fr;
}
