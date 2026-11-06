// Builds a small test chess book (tests/chess/fixtures/sample-book.pdf) in the style of a modern
// typeset book: figurine algebraic, main line in bold, analysis in parentheses, vector diagrams
// with captions, two chapters, and one page that is only a scanned image (no text layer).
// Every position and move below is checked with chess.js before the PDF is written.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { Chess } from 'chess.js';
import { chromium } from 'playwright';

const FIG = { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘' };
const fig = (san) => san.replace(/^[KQRBN]/, (c) => FIG[c]).replace(/=([QRBN])/, (_, c) => `=${FIG[c]}`);
function check(fen, sans) { const c = new Chess(fen); for (const s of sans) c.move(s); return c.fen(); }
const START = new Chess().fen();

const OPERA = 'e4 e5 Nf3 d6 d4 Bg4 dxe5 Bxf3 Qxf3 dxe5 Bc4 Nf6 Qb3 Qe7 Nc3 c6 Bg5 b5 Nxb5 cxb5 Bxb5+ Nbd7 O-O-O Rd8 Rxd7 Rxd7 Rd1 Qe6 Bxd7+ Nxd7 Qb8+ Nxb8 Rd8#'.split(' ');
check(START, OPERA);
check(START, ['e4', 'e5', 'Nf3', 'd6', 'd4', 'exd4', 'Qxd4']);
const afterBg5 = check(START, OPERA.slice(0, 17));
check(afterBg5, ['Qb4', 'Bxf6', 'Qxb3', 'Bxb3', 'gxf6']);
const DIAG1 = check(START, OPERA.slice(0, 24)); // after 12...Rd8
const BACKRANK = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1';
check(BACKRANK, ['Rd8#']);
const BLACKMATE = '3r2k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1';
check(BLACKMATE, ['Rd1#']);
const RUY = 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7'.split(' ');
check(START, RUY);

function moves(sans, startNo = 1, white = true, boldFrom = 0, boldTo = 999) {
  let n = startNo, w = white, out = '';
  sans.forEach((s, i) => {
    const t = (w ? `${n}.` : i === 0 ? `${n}...` : '') + fig(s);
    out += (i >= boldFrom && i < boldTo ? `<b>${t}</b>` : t) + ' ';
    if (!w) n++;
    w = !w;
  });
  return out.trim();
}

const pieces = {};
for (const c of ['w', 'b']) for (const p of 'KQRBNP') pieces[c + p] = readFileSync(`tools/chess-pieces/merida/${c}${p}.svg`, 'utf8').replace(/<svg[^>]*>/, '').replace('</svg>', '');
function diagramSvg(fen) {
  const rows = fen.split(' ')[0].split('/');
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 368 368" width="240" height="240"><defs><pattern id="h" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#fff"/><rect width="1.4" height="4" fill="#333"/></pattern></defs><rect x="-4" y="-4" width="368" height="368" fill="#000"/><rect x="0" y="0" width="360" height="360" fill="#fff"/>`;
  rows.forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) { for (let k = 0; k < +ch; k++) { if ((r + f) % 2) s += `<rect x="${f * 45}" y="${r * 45}" width="45" height="45" fill="url(#h)"/>`; f++; } continue; }
      if ((r + f) % 2) s += `<rect x="${f * 45}" y="${r * 45}" width="45" height="45" fill="url(#h)"/>`;
      const key = (ch === ch.toUpperCase() ? 'w' : 'b') + ch.toUpperCase();
      s += `<svg x="${f * 45}" y="${r * 45}" width="45" height="45" viewBox="0 0 45 45">${pieces[key]}</svg>`;
      f++;
    }
  });
  return s + '</svg>';
}

const css = `@page { size: A5; margin: 16mm 14mm; } body { font-family: 'DejaVu Serif', serif; font-size: 10.5pt; line-height: 1.45; } h1 { font-size: 20pt; margin: 0 0 6mm; } .hdr { font-weight: bold; margin: 3mm 0 1mm; } .d { text-align: center; margin: 3mm 0 1mm; } .cap { text-align: center; font-style: italic; margin-bottom: 3mm; } .page { page-break-after: always; } .scan { page-break-before: always; } .scan img { width: 100%; }`;
const html = (scanSrc) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>
<div class="page">
<h1>Chapter 1 The Open Games</h1>
<p>Our first example is one of the best known games ever played. It shows rapid development and the power of open lines.</p>
<p class="hdr">Morphy – Duke of Brunswick and Count Isouard, Paris 1858</p>
<p>${moves(OPERA.slice(0, 6))}?! This pin is premature. Instead ${moves(['exd4', 'Qxd4'], 3, false, 99)} is a quieter line.</p>
<p>${moves(OPERA.slice(6, 17), 4, true)} ${moves(OPERA.slice(17, 18), 9, false)} (${moves(['Qb4', 'Bxf6', 'Qxb3', 'Bxb3', 'gxf6'], 9, false, 99)} was better.) ${moves(OPERA.slice(18, 24), 10, true)}</p>
<div class="d">${diagramSvg(DIAG1)}</div>
<p class="cap">The position after 12...♖d8</p>
<p>${moves(OPERA.slice(24), 13, true)} 1–0</p>
</div>
<div class="page">
<h1>Chapter 2 Back-Rank Combinations</h1>
<p>A king without an escape square on the back rank is a classic target.</p>
<div class="d">${diagramSvg(BACKRANK)}</div>
<p class="cap">White to move</p>
<p><b>1.♖d8#</b> ends the game at once.</p>
<div class="d">${diagramSvg(BLACKMATE)}</div>
<p class="cap">Black to move</p>
<p><b>1...♖d1#</b> is the mirror image.</p>
</div>
<div class="scan"><img src="${scanSrc}"></div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
// The "scanned" page: an image of typeset text, with no text layer.
await page.setContent(`<div id="s" style="width:520px;padding:30px;font:19px/1.55 'DejaVu Serif',serif;background:#fff;color:#111"><p style="font-weight:bold">Game 3. Lopez – Garcia, Madrid 1575</p><p>1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 and the players agreed a draw. 1/2-1/2</p><p>This page was scanned: it has no text layer.</p></div>`);
const png = await (await page.$('#s')).screenshot({ type: 'png' });
await page.setContent(html(`data:image/png;base64,${png.toString('base64')}`), { waitUntil: 'load' });
mkdirSync('tests/chess/fixtures', { recursive: true });
writeFileSync('tests/chess/fixtures/sample-book.pdf', await page.pdf({ format: 'A5', printBackground: true }));
await browser.close();
writeFileSync('tests/chess/fixtures/sample-book.expected.json', JSON.stringify({ opera: OPERA, diag1: DIAG1.split(' ')[0], backrank: BACKRANK.split(' ')[0], blackmate: BLACKMATE.split(' ')[0], ruy: RUY }, null, 2));
console.log('wrote tests/chess/fixtures/sample-book.pdf');
