// Converts the OurAirports public-domain CSV dump (https://ourairports.com/data/)
// into compact JSON the browser loads on demand:
//   public/data/airports/index.json          – every usable airport (for search / planning)
//   public/data/airports/cells/<lat>_<lon>.json – runway detail, split into 10° cells
//
// Usage: node tools/build-airports.mjs [dirContainingCsvs]
// Without a directory the CSVs are downloaded from the OurAirports GitHub mirror.
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('public/data/airports');
const MIRROR = 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/';
const FT = 0.3048;
export const CELL_DEG = 10;

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const head = rows.shift();
  return rows.filter(r => r.length === head.length).map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

async function load(dir, name) {
  if (dir) return fs.readFileSync(path.join(dir, name), 'utf8');
  const res = await fetch(MIRROR + name);
  if (!res.ok) throw new Error(`download ${name}: ${res.status}`);
  return res.text();
}

const PAVED = /^(ASP|CON|BIT|PEM|TAR|PAV|MAC|BRI|COP|TRE|SEAL|ASF|ASB)/i;
function surfaceCode(s) {
  const u = (s || '').toUpperCase();
  if (PAVED.test(u)) return 'P';
  if (/^(TURF|GRS|GRA|GRE|GRASS|G$)/.test(u)) return 'G';
  if (/(GRV|GRAV|GVL|GRAVEL)/.test(u)) return 'V';
  if (/(DIRT|EART|SAND|CLAY|SOIL|LAT)/.test(u)) return 'D';
  if (/(WATER|WAT)/.test(u)) return 'W';
  if (/(SNOW|ICE)/.test(u)) return 'S';
  return 'U';
}

const num = v => (v === '' || v === undefined ? NaN : Number(v));
const r5 = v => Math.round(v * 1e5) / 1e5;
const r1 = v => Math.round(v * 10) / 10;

// Spherical destination point, good enough for placing estimated runway ends (< few km).
function destination(lat, lon, brgDeg, distM) {
  const R = 6371008.8, d = distM / R, b = brgDeg * Math.PI / 180;
  const p1 = lat * Math.PI / 180, l1 = lon * Math.PI / 180;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [p2 * 180 / Math.PI, ((l2 * 180 / Math.PI + 540) % 360) - 180];
}
function bearing(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180, dl = (lon2 - lon1) * Math.PI / 180;
  const y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function headingFromIdent(ident) {
  const m = /^(\d{1,2})/.exec(ident || '');
  return m ? (Number(m[1]) * 10) % 360 : NaN;
}

async function main() {
  const dir = process.argv[2];
  const airports = parseCsv(await load(dir, 'airports.csv'));
  const runways = parseCsv(await load(dir, 'runways.csv'));

  const byIdent = new Map();
  for (const r of runways) {
    if (r.closed === '1') continue;
    if (/^H/i.test(r.le_ident)) continue; // helipads
    const len = num(r.length_ft);
    if (!(len > 0)) continue;
    if (!byIdent.has(r.airport_ident)) byIdent.set(r.airport_ident, []);
    byIdent.get(r.airport_ident).push(r);
  }

  const TYPE = { large_airport: 0, medium_airport: 1, small_airport: 2 };
  const index = [];
  const cells = new Map();
  let estimated = 0, total = 0;

  for (const a of airports) {
    if (!(a.type in TYPE)) continue;
    const rws = byIdent.get(a.ident);
    if (!rws) continue;
    const lat = num(a.latitude_deg), lon = num(a.longitude_deg);
    if (!isFinite(lat) || !isFinite(lon)) continue;
    const elevFt = isFinite(num(a.elevation_ft)) ? num(a.elevation_ft) : null;
    const elevM = elevFt === null ? null : r1(elevFt * FT);

    const outRw = [];
    let longest = 0, paved = 0;
    for (const r of rws) {
      const lengthM = num(r.length_ft) * FT;
      const widthM = isFinite(num(r.width_ft)) && num(r.width_ft) > 0 ? num(r.width_ft) * FT : Math.max(18, Math.min(60, lengthM / 50));
      let leLat = num(r.le_latitude_deg), leLon = num(r.le_longitude_deg);
      let heLat = num(r.he_latitude_deg), heLon = num(r.he_longitude_deg);
      let hdg = num(r.le_heading_degT);
      let est = 0;
      if (!(isFinite(leLat) && isFinite(leLon) && isFinite(heLat) && isFinite(heLon))) {
        // No surveyed threshold coordinates: centre the runway on the airport reference
        // point, oriented by true heading if published, else by the runway number
        // (magnetic, so this can be off by the local magnetic variation).
        if (!isFinite(hdg)) hdg = headingFromIdent(r.le_ident);
        if (!isFinite(hdg)) hdg = isFinite(headingFromIdent(r.he_ident)) ? (headingFromIdent(r.he_ident) + 180) % 360 : 0;
        [leLat, leLon] = destination(lat, lon, hdg + 180, lengthM / 2);
        [heLat, heLon] = destination(lat, lon, hdg, lengthM / 2);
        est = 1;
        estimated++;
      } else {
        hdg = bearing(leLat, leLon, heLat, heLon);
      }
      total++;
      const leEl = isFinite(num(r.le_elevation_ft)) ? r1(num(r.le_elevation_ft) * FT) : elevM;
      const heEl = isFinite(num(r.he_elevation_ft)) ? r1(num(r.he_elevation_ft) * FT) : elevM;
      const surf = surfaceCode(r.surface);
      if (surf === 'P') paved = 1;
      longest = Math.max(longest, lengthM);
      outRw.push([
        r.le_ident || '', r.he_ident || '',
        Math.round(lengthM), Math.round(widthM), surf, r.lighted === '1' ? 1 : 0,
        r5(leLat), r5(leLon), leEl, r5(heLat), r5(heLon), heEl,
        r1(hdg),
        Math.round((num(r.le_displaced_threshold_ft) || 0) * FT),
        Math.round((num(r.he_displaced_threshold_ft) || 0) * FT),
        est,
      ]);
    }
    const icao = a.icao_code || (/^[A-Z]{4}$/.test(a.gps_code) ? a.gps_code : '');
    index.push([a.ident, icao, a.iata_code || '', a.name, a.municipality || '', a.iso_country || '',
      r5(lat), r5(lon), elevM, TYPE[a.type], Math.round(longest), paved, a.scheduled_service === 'yes' ? 1 : 0]);
    const key = cellKey(lat, lon);
    if (!cells.has(key)) cells.set(key, {});
    cells.get(key)[a.ident] = outRw;
  }

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'cells'), { recursive: true });
  const meta = {
    source: 'OurAirports (public domain) https://ourairports.com/data/',
    generated: new Date().toISOString().slice(0, 10),
    cellDeg: CELL_DEG,
    fields: ['ident', 'icao', 'iata', 'name', 'city', 'country', 'lat', 'lon', 'elevM', 'type(0=large,1=medium,2=small)', 'longestRunwayM', 'paved', 'scheduled'],
    runwayFields: ['leIdent', 'heIdent', 'lengthM', 'widthM', 'surface(P=paved,G=grass,V=gravel,D=dirt,W=water,S=snow,U=unknown)', 'lighted', 'leLat', 'leLon', 'leElevM', 'heLat', 'heLon', 'heElevM', 'leHeadingTrue', 'leDisplacedM', 'heDisplacedM', 'estimatedGeometry'],
    cells: [...cells.keys()].sort(),
  };
  fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ meta, airports: index }));
  for (const [k, v] of cells) fs.writeFileSync(path.join(OUT, 'cells', `${k}.json`), JSON.stringify(v));
  console.log(`airports ${index.length}, runways ${total} (${estimated} estimated geometry), cells ${cells.size}`);
}

export function cellKey(lat, lon) {
  const la = Math.floor(lat / CELL_DEG) * CELL_DEG, lo = Math.floor(lon / CELL_DEG) * CELL_DEG;
  return `${la}_${lo}`;
}

main().catch(e => { console.error(e); process.exit(1); });
