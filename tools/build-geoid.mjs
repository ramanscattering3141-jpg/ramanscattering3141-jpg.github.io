// Builds a compact 1° EGM96 geoid-undulation grid (N, metres) used to line up
// Google Photorealistic 3D Tiles (true WGS84 ellipsoid heights) with the
// simulator's terrain, which is in metres above mean sea level.
// Output: public/data/geo/egm96-1deg.bin — Int16 little-endian, centimetres,
// 181 rows (lat 90 → -90) × 361 columns (lon -180 → 180).
// Source: EGM96 via the MIT-licensed egm96-universal package.
import fs from 'node:fs';
import { egm96ToEllipsoid } from 'egm96-universal';

const rows = 181, cols = 361;
const out = new Int16Array(rows * cols);
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const lat = 90 - r, lon = -180 + c;
    out[r * cols + c] = Math.round(egm96ToEllipsoid(lat, lon, 0) * 100);
  }
}
fs.mkdirSync('public/data/geo', { recursive: true });
fs.writeFileSync('public/data/geo/egm96-1deg.bin', Buffer.from(out.buffer));
console.log('egm96 grid written', out.length * 2, 'bytes');
