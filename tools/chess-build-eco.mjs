// Builds src/chess/data/eco.json from the Lichess chess-openings TSV files (CC0).
// Usage: node tools/chess-build-eco.mjs <dir with a.tsv … e.tsv>
import { readFileSync, writeFileSync } from 'node:fs';
import { Chess } from 'chess.js';
const dir = process.argv[2];
const out = {};
for (const f of ['a', 'b', 'c', 'd', 'e']) {
  for (const line of readFileSync(`${dir}/${f}.tsv`, 'utf8').split('\n').slice(1)) {
    const [eco, name, pgn] = line.split('\t');
    if (!pgn) continue;
    const c = new Chess();
    for (const tok of pgn.split(/\s+/)) if (!/^\d+\.$/.test(tok)) c.move(tok);
    const key = c.fen().split(' ').slice(0, 4).join(' ');
    const plies = c.history().length;
    // Keep the most specific (longest) line for each position.
    if (!out[key] || out[key][2] < plies) out[key] = [eco, name, plies];
  }
}
writeFileSync('src/chess/data/eco.json', JSON.stringify(out));
console.log(Object.keys(out).length, 'positions');
