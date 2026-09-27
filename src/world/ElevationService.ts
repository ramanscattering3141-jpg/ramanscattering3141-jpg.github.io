// Global elevation data: decoding, caching and sampling.
//
// Source: Mapzen/Nextzen "Terrarium" elevation tiles hosted on AWS Open Data
// (https://registry.opendata.aws/terrain-tiles/). They merge SRTM, GMTED,
// ETOPO1 and other public datasets; heights are metres above mean sea level,
// encoded in PNG pixels as  h = R·256 + G + B/256 − 32768.
// Tiles use the Web Mercator (XYZ) scheme, 256×256 px, zoom 0–15.
//
// This single service feeds BOTH the rendered terrain mesh and the flight
// model's ground-contact queries, so the wheels touch the ground you see.
// Runways are flattened ("FlattenIndex") to their published elevation so
// take-offs and landings are not affected by DEM noise.

import { clamp, smoothstep, DEG } from '../core/math';

export const TERRARIUM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
export const TERRARIUM_MAX_ZOOM = 15;
const TILE = 256;

export interface FlattenZone {
  lat0: number; lon0: number; lat1: number; lon1: number;
  h0: number; h1: number;
  halfWidth: number;
  /** Extra length beyond each threshold (m) */
  ext: number;
  /** Width of the smooth transition back to natural terrain (m) */
  blend: number;
}

/** Spatial index (1° buckets) of runway flattening zones. */
export class FlattenIndex {
  private buckets = new Map<string, FlattenZone[]>();
  add(z: FlattenZone) {
    const pad = (z.ext + z.blend + z.halfWidth) / 111000 + 0.01;
    const la0 = Math.floor(Math.min(z.lat0, z.lat1) - pad), la1 = Math.floor(Math.max(z.lat0, z.lat1) + pad);
    const lo0 = Math.floor(Math.min(z.lon0, z.lon1) - pad * 2), lo1 = Math.floor(Math.max(z.lon0, z.lon1) + pad * 2);
    for (let a = la0; a <= la1; a++) for (let o = lo0; o <= lo1; o++) {
      const k = `${a},${o}`;
      if (!this.buckets.has(k)) this.buckets.set(k, []);
      this.buckets.get(k)!.push(z);
    }
  }
  /** Applies any zones covering (lat, lon) to a natural terrain height. */
  apply(lat: number, lon: number, h: number): number {
    const list = this.buckets.get(`${Math.floor(lat)},${Math.floor(lon)}`);
    if (!list) return h;
    let out = h;
    for (const z of list) {
      // Local flat-earth projection around the runway (valid over a few km).
      const cosLat = Math.cos(lat * DEG);
      const ax = (z.lon0 - lon) * 111320 * cosLat, ay = (z.lat0 - lat) * 110540;
      const bx = (z.lon1 - lon) * 111320 * cosLat, by = (z.lat1 - lat) * 110540;
      const dx = bx - ax, dy = by - ay;
      const L = Math.hypot(dx, dy);
      if (L < 1) continue;
      const ux = dx / L, uy = dy / L;
      const along = (-ax) * ux + (-ay) * uy; // projection of the query point (origin)
      const cross = Math.abs((-ax) * -uy + (-ay) * ux);
      const outAlong = Math.max(0, -z.ext - along, along - (L + z.ext));
      const outCross = Math.max(0, cross - z.halfWidth);
      const d = Math.hypot(outAlong, outCross);
      if (d >= z.blend) continue;
      const w = 1 - smoothstep(0, z.blend, d);
      const t = clamp(along / L, 0, 1);
      out = out + (z.h0 + (z.h1 - z.h0) * t - out) * w;
    }
    return out;
  }
  inZone(lat: number, lon: number) {
    const list = this.buckets.get(`${Math.floor(lat)},${Math.floor(lon)}`);
    if (!list) return false;
    return this.apply(lat, lon, -99999) > -99000;
  }
}

interface TileEntry {
  heights: Float32Array;
  used: number;
}

export function lonToTileX(lon: number, z: number) {
  return ((lon + 180) / 360) * (1 << z);
}
export function latToTileY(lat: number, z: number) {
  const l = clamp(lat, -85.0511, 85.0511) * DEG;
  return ((1 - Math.log(Math.tan(l) + 1 / Math.cos(l)) / Math.PI) / 2) * (1 << z);
}

export class ElevationService {
  readonly flatten = new FlattenIndex();
  private tiles = new Map<string, TileEntry>();
  private pending = new Map<string, Promise<Float32Array | null>>();
  private failed = new Set<string>();
  private clock = 0;
  inFlight = 0;
  maxCacheTiles = 320;
  /** Fired once if the elevation server cannot be reached at all. */
  onUnavailable: (() => void) | null = null;
  private successCount = 0;
  private failCount = 0;

  constructor(private url = TERRARIUM_URL) {}

  get available() {
    return this.successCount > 0 || this.failCount < 6;
  }

  peek(z: number, x: number, y: number): Float32Array | undefined {
    const e = this.tiles.get(`${z}/${x}/${y}`);
    if (e) e.used = ++this.clock;
    return e?.heights;
  }

  getTile(z: number, x: number, y: number): Promise<Float32Array | null> {
    const n = 1 << z;
    x = ((x % n) + n) % n;
    if (y < 0 || y >= n) return Promise.resolve(null);
    const key = `${z}/${x}/${y}`;
    const e = this.tiles.get(key);
    if (e) { e.used = ++this.clock; return Promise.resolve(e.heights); }
    if (this.failed.has(key)) return Promise.resolve(null);
    let p = this.pending.get(key);
    if (!p) {
      p = this.fetchTile(z, x, y).then(h => {
        this.pending.delete(key);
        if (h) { this.tiles.set(key, { heights: h, used: ++this.clock }); this.evict(); }
        else this.failed.add(key);
        return h;
      });
      this.pending.set(key, p);
    }
    return p;
  }

  private async fetchTile(z: number, x: number, y: number): Promise<Float32Array | null> {
    const url = this.url.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
    this.inFlight++;
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const bmp = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(TILE, TILE);
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(bmp, 0, 0);
      bmp.close?.();
      const px = ctx.getImageData(0, 0, TILE, TILE).data;
      const h = new Float32Array(TILE * TILE);
      for (let i = 0; i < TILE * TILE; i++) h[i] = px[i * 4] * 256 + px[i * 4 + 1] + px[i * 4 + 2] / 256 - 32768;
      this.successCount++;
      return h;
    } catch {
      this.failCount++;
      if (this.successCount === 0 && this.failCount === 6) this.onUnavailable?.();
      return null;
    } finally {
      this.inFlight--;
    }
  }

  private evict() {
    if (this.tiles.size <= this.maxCacheTiles) return;
    const entries = [...this.tiles.entries()].sort((a, b) => a[1].used - b[1].used);
    for (let i = 0; i < entries.length - this.maxCacheTiles; i++) {
      // Keep the low-zoom world tiles forever: they are the fallback everywhere.
      if (Number(entries[i][0].split('/')[0]) <= 3) continue;
      this.tiles.delete(entries[i][0]);
    }
  }

  /** Bilinear sample of raw DEM height from the best loaded zoom ≤ zMax. */
  sampleRaw(lat: number, lon: number, zMax = TERRARIUM_MAX_ZOOM): number | null {
    for (let z = zMax; z >= 0; z--) {
      const fx = lonToTileX(lon, z), fy = latToTileY(lat, z);
      const n = 1 << z;
      const tx = ((Math.floor(fx) % n) + n) % n, ty = clamp(Math.floor(fy), 0, n - 1);
      const t = this.peek(z, tx, ty);
      if (!t) continue;
      const px = clamp((fx - Math.floor(fx)) * TILE - 0.5, 0, TILE - 1.001);
      const py = clamp((fy - Math.floor(fy)) * TILE - 0.5, 0, TILE - 1.001);
      const x0 = Math.floor(px), y0 = Math.floor(py);
      const ax = px - x0, ay = py - y0;
      const i = y0 * TILE + x0;
      const h00 = t[i], h10 = t[i + 1], h01 = t[i + TILE], h11 = t[i + TILE + 1];
      return (h00 * (1 - ax) + h10 * ax) * (1 - ay) + (h01 * (1 - ax) + h11 * ax) * ay;
    }
    return null;
  }

  /**
   * Terrain surface height used by both rendering and physics: the DEM with oceans
   * clamped to sea level and runways flattened.
   */
  height(lat: number, lon: number, zMax = TERRARIUM_MAX_ZOOM): number | null {
    const raw = this.sampleRaw(lat, lon, zMax);
    if (raw === null) return null;
    return this.flatten.apply(lat, lon, Math.max(0, raw));
  }

  isWater(lat: number, lon: number): boolean {
    const raw = this.sampleRaw(lat, lon, 13);
    if (raw === null) return false;
    return raw < -1 && !this.flatten.inZone(lat, lon);
  }

  /** Requests the tiles around a point so physics has high-resolution ground data. */
  prefetch(lat: number, lon: number, zoom: number, radiusTiles = 1): Promise<unknown> {
    const fx = Math.floor(lonToTileX(lon, zoom)), fy = Math.floor(latToTileY(lat, zoom));
    const ps: Promise<unknown>[] = [];
    for (let dx = -radiusTiles; dx <= radiusTiles; dx++) for (let dy = -radiusTiles; dy <= radiusTiles; dy++) ps.push(this.getTile(zoom, fx + dx, fy + dy));
    return Promise.all(ps);
  }

  /** Ensures the world overview tiles (zoom 0–2) are loaded as a global fallback. */
  async preloadWorld() {
    const ps: Promise<unknown>[] = [];
    for (let z = 0; z <= 2; z++) for (let x = 0; x < 1 << z; x++) for (let y = 0; y < 1 << z; y++) ps.push(this.getTile(z, x, y));
    await Promise.all(ps);
  }

  /** Mercator tiles at zoom z overlapping a lat/lon rectangle (degrees). */
  tilesFor(west: number, south: number, east: number, north: number, z: number) {
    const x0 = Math.floor(lonToTileX(west, z)), x1 = Math.floor(lonToTileX(east - 1e-9, z));
    const y0 = Math.floor(latToTileY(north, z)), y1 = Math.floor(latToTileY(south + 1e-9, z));
    const out: [number, number][] = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push([x, y]);
    return out;
  }
}
