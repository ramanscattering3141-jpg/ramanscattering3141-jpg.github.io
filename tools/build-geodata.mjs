// Converts Natural Earth (public domain, https://www.naturalearthdata.com/) GeoJSON
// layers into compact line/point files for overlays and the moving map.
// Usage: node tools/build-geodata.mjs [dirContainingGeojson]
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('public/data/geo');
const MIRROR = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';

async function load(dir, name) {
  if (dir) return JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
  const res = await fetch(MIRROR + name);
  if (!res.ok) throw new Error(`download ${name}: ${res.status}`);
  return res.json();
}

const r3 = v => Math.round(v * 1000) / 1000;

// Flattens (Multi)LineString/(Multi)Polygon geometries into arrays of flat [lon,lat,...] lists,
// dropping consecutive points closer than `tol` degrees to keep files small.
function lines(fc, tol = 0.02, filter = () => true) {
  const out = [];
  const push = coords => {
    const flat = [];
    let px = 1e9, py = 1e9;
    for (const [x, y] of coords) {
      if (Math.abs(x - px) < tol && Math.abs(y - py) < tol) continue;
      flat.push(r3(x), r3(y)); px = x; py = y;
    }
    if (flat.length >= 4) out.push(flat);
  };
  for (const f of fc.features) {
    if (!filter(f.properties)) continue;
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'LineString') push(g.coordinates);
    else if (g.type === 'MultiLineString') g.coordinates.forEach(push);
    else if (g.type === 'Polygon') g.coordinates.forEach(push);
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => p.forEach(push));
  }
  return out;
}

async function main() {
  const dir = process.argv[2];
  fs.mkdirSync(OUT, { recursive: true });
  const write = (name, data) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(data));
  const src = 'Natural Earth (public domain) https://www.naturalearthdata.com/';

  write('borders.json', { source: src, lines: lines(await load(dir, 'ne_50m_admin_0_boundary_lines_land.geojson')) });
  write('coastline.json', { source: src, lines: lines(await load(dir, 'ne_50m_coastline.geojson'), 0.03) });
  write('rivers.json', { source: src, lines: lines(await load(dir, 'ne_50m_rivers_lake_centerlines.geojson'), 0.03) });
  write('lakes.json', { source: src, lines: lines(await load(dir, 'ne_50m_lakes.geojson'), 0.03) });

  const places = await load(dir, 'ne_10m_populated_places_simple.geojson');
  const cities = places.features
    .map(f => f.properties)
    .filter(p => (p.pop_max || 0) >= 150000)
    .sort((a, b) => b.pop_max - a.pop_max)
    .map(p => [p.name, p.adm0name || '', r3(p.latitude), r3(p.longitude), p.pop_max, p.megacity ? 1 : 0, p.adm0cap ? 1 : 0]);
  write('cities.json', { source: src, fields: ['name', 'country', 'lat', 'lon', 'popMax', 'megacity', 'capital'], cities });
  console.log(`cities ${cities.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
