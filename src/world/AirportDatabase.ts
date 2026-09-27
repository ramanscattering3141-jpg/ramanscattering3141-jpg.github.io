// Worldwide airport database (OurAirports, public domain).
//
// index.json (~29k airports) is loaded once for search and "nearest airport"
// queries; runway detail is split into 10° cells loaded on demand, so only the
// regions you plan or fly through are ever downloaded.

import type { Airport, Runway } from './AirportTypes';
import { distance } from '../core/geodesy';
import type { FlattenIndex } from './ElevationService';

const CELL = 10;
type IndexRow = [string, string, string, string, string, string, number, number, number | null, 0 | 1 | 2, number, 0 | 1, 0 | 1];
type RunwayRow = [string, string, number, number, Runway['surface'], 0 | 1, number, number, number | null, number, number, number | null, number, number, number, 0 | 1];

export const cellKey = (lat: number, lon: number) => `${Math.floor(lat / CELL) * CELL}_${Math.floor(lon / CELL) * CELL}`;

export class AirportDatabase {
  airports: Airport[] = [];
  private byIdent = new Map<string, Airport>();
  private grid = new Map<string, Airport[]>(); // 1° buckets for proximity queries
  private cells = new Map<string, Promise<void>>();
  private cellSet = new Set<string>();
  private loading: Promise<void> | null = null;
  source = '';

  constructor(private baseUrl: string, private flatten: FlattenIndex | null) {}

  load(): Promise<void> {
    if (!this.loading) {
      this.loading = fetch(`${this.baseUrl}/index.json`).then(async r => {
        if (!r.ok) throw new Error(`Airport database unavailable (${r.status})`);
        const data = (await r.json()) as { meta: { cells: string[]; source: string }; airports: IndexRow[] };
        this.source = data.meta.source;
        this.cellSet = new Set(data.meta.cells);
        this.airports = data.airports.map(row => ({
          ident: row[0], icao: row[1], iata: row[2], name: row[3], city: row[4], country: row[5],
          lat: row[6], lon: row[7], elevM: row[8], type: row[9], longestRunwayM: row[10], paved: !!row[11], scheduled: !!row[12],
        }));
        for (const a of this.airports) {
          this.byIdent.set(a.ident, a);
          const k = `${Math.floor(a.lat)},${Math.floor(a.lon)}`;
          if (!this.grid.has(k)) this.grid.set(k, []);
          this.grid.get(k)!.push(a);
        }
      });
    }
    return this.loading;
  }

  get(ident: string) {
    return this.byIdent.get(ident.toUpperCase());
  }

  /** Loads runway detail for the 10° cell containing (lat, lon). */
  async ensureCell(lat: number, lon: number): Promise<void> {
    // The index lists which cells exist; make sure it is loaded first (terrain tiles
    // may ask for runway flattening before the planner has loaded anything).
    await this.load().catch(() => undefined);
    const key = cellKey(lat, lon);
    if (!this.cellSet.has(key)) return;
    let p = this.cells.get(key);
    if (!p) {
      p = fetch(`${this.baseUrl}/cells/${key}.json`)
        .then(r => (r.ok ? r.json() : {}))
        .then((cell: Record<string, RunwayRow[]>) => {
          for (const [ident, rows] of Object.entries(cell)) {
            const a = this.byIdent.get(ident);
            if (!a) continue;
            a.runways = rows.map(r => ({
              leIdent: r[0], heIdent: r[1], lengthM: r[2], widthM: r[3], surface: r[4], lighted: !!r[5],
              leLat: r[6], leLon: r[7], leElevM: r[8], heLat: r[9], heLon: r[10], heElevM: r[11],
              leHeadingTrue: r[12], leDisplacedM: r[13], heDisplacedM: r[14], estimated: !!r[15],
            }));
            this.registerFlatten(a);
          }
        })
        .catch(() => { this.cells.delete(key); });
      this.cells.set(key, p);
    }
    await p;
  }

  /** Loads every cell overlapping a rectangle (degrees). */
  async ensureRect(west: number, south: number, east: number, north: number) {
    const ps: Promise<void>[] = [];
    for (let la = Math.floor(south / CELL) * CELL; la <= north; la += CELL)
      for (let lo = Math.floor(west / CELL) * CELL; lo <= east; lo += CELL) ps.push(this.ensureCell(la + 0.001, lo + 0.001));
    await Promise.all(ps);
  }

  async runways(a: Airport): Promise<Runway[]> {
    await this.ensureCell(a.lat, a.lon);
    return a.runways ?? [];
  }

  /**
   * Flatten the terrain under each runway to its published elevation, blending
   * back into the natural terrain over ~250 m. Airports without an elevation
   * are left untouched.
   */
  private registerFlatten(a: Airport) {
    if (!this.flatten || !a.runways) return;
    for (const r of a.runways) {
      if (r.surface === 'W') continue;
      const h0 = r.leElevM ?? a.elevM, h1 = r.heElevM ?? a.elevM;
      if (h0 === null || h1 === null) continue;
      this.flatten.add({
        lat0: r.leLat, lon0: r.leLon, lat1: r.heLat, lon1: r.heLon, h0: Math.max(0, h0), h1: Math.max(0, h1),
        halfWidth: r.widthM / 2 + 40, ext: 120, blend: 260,
      });
    }
  }

  nearby(lat: number, lon: number, radiusM: number, filter?: (a: Airport) => boolean): { airport: Airport; dist: number }[] {
    const dLat = radiusM / 111000;
    const dLon = radiusM / (111000 * Math.max(0.05, Math.cos((lat * Math.PI) / 180)));
    const out: { airport: Airport; dist: number }[] = [];
    for (let la = Math.floor(lat - dLat); la <= Math.floor(lat + dLat); la++) {
      for (let lo = Math.floor(lon - dLon); lo <= Math.floor(lon + dLon); lo++) {
        const wrapped = ((lo + 180) % 360 + 360) % 360 - 180;
        for (const a of this.grid.get(`${la},${wrapped}`) ?? []) {
          if (filter && !filter(a)) continue;
          const d = distance(lat, lon, a.lat, a.lon);
          if (d <= radiusM) out.push({ airport: a, dist: d });
        }
      }
    }
    return out.sort((x, y) => x.dist - y.dist);
  }

  /**
   * Search by ICAO / IATA / ident (exact matches first), then by name or city.
   * Larger airports rank higher.
   */
  search(query: string, limit = 12): Airport[] {
    const q = query.trim().toUpperCase();
    if (q.length < 2) return [];
    const scored: { a: Airport; s: number }[] = [];
    for (const a of this.airports) {
      let s = -1;
      if (a.icao === q || a.ident === q) s = 100;
      else if (a.iata === q) s = 95;
      else if (a.icao.startsWith(q) || a.ident.startsWith(q)) s = 60;
      else {
        const name = a.name.toUpperCase(), city = a.city.toUpperCase();
        if (city === q) s = 55;
        else if (name.startsWith(q) || city.startsWith(q)) s = 45;
        else if (name.includes(q) || city.includes(q)) s = 30;
      }
      if (s < 0) continue;
      s += (2 - a.type) * 8 + (a.scheduled ? 5 : 0) + Math.min(5, a.longestRunwayM / 800);
      scored.push({ a, s });
    }
    return scored.sort((x, y) => y.s - x.s).slice(0, limit).map(x => x.a);
  }
}
