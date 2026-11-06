// Renders the bundled piece sets (tools/chess-pieces/<set>/<piece>.svg) to small grayscale
// images with alpha, used as reference shapes by the diagram recogniser and by its tests.
// Usage: node tools/chess-build-templates.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { chromium } from 'playwright';
const S = 40;
const sets = readdirSync('tools/chess-pieces');
const pieces = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];
const browser = await chromium.launch();
const page = await browser.newPage();
const out = { size: S, sets: {} };
for (const set of sets) {
  out.sets[set] = {};
  for (const p of pieces) {
    const svg = readFileSync(`tools/chess-pieces/${set}/${p}.svg`, 'utf8');
    const res = await page.evaluate(async ({ svg, S }) => {
      const img = new Image();
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
      await img.decode();
      const draw = (bg) => {
        const c = document.createElement('canvas'); c.width = S; c.height = S;
        const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, S, S); g.drawImage(img, 0, 0, S, S);
        const d = g.getImageData(0, 0, S, S).data; const o = [];
        for (let i = 0; i < d.length; i += 4) o.push(Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]));
        return o;
      };
      return { w: draw('#fff'), k: draw('#000') };
    }, { svg, S });
    const gray = new Uint8Array(S * S), alpha = new Uint8Array(S * S);
    for (let i = 0; i < S * S; i++) {
      const a = Math.max(0, Math.min(255, 255 - (res.w[i] - res.k[i])));
      alpha[i] = a;
      gray[i] = a > 8 ? Math.max(0, Math.min(255, Math.round((res.k[i] * 255) / a))) : 255;
    }
    out.sets[set][p] = { gray: Buffer.from(gray).toString('base64'), alpha: Buffer.from(alpha).toString('base64') };
  }
}
await browser.close();
writeFileSync('src/chess/data/piece-templates.json', JSON.stringify(out));
console.log('sets:', sets.join(', '));
