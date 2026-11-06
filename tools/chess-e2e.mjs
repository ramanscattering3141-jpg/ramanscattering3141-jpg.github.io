// End-to-end check of the chess book reader in a real browser.
// Usage: node tools/chess-e2e.mjs <base-url> <out-dir>   (serve a build first, e.g. vite preview)
import { readFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:4190/';
const out = process.argv[3] ?? 'test-results/chess-e2e';
mkdirSync(out, { recursive: true });
const expected = JSON.parse(readFileSync('tests/chess/fixtures/sample-book.expected.json', 'utf8'));
const fails = [];
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`); if (!cond) fails.push(msg); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`${base}chess/`);
await page.waitForTimeout(2500); // service worker may reload the page once for isolation
await page.waitForSelector('.drop');
ok(await page.evaluate(() => window.crossOriginIsolated), 'page is cross-origin isolated (multi-threaded engine available)');
await page.setInputFiles('.drop input[type=file]', 'tests/chess/fixtures/sample-book.pdf');
await page.waitForSelector('.book', { timeout: 60000 });
await page.screenshot({ path: `${out}/library.png` });
// Wait for processing to finish (status stored in IndexedDB).
const t0 = Date.now();
let status = '';
while (Date.now() - t0 < 240000) {
  status = await page.evaluate(async () => {
    const req = indexedDB.open('chess-book-reader');
    const d = await new Promise((r) => { req.onsuccess = () => r(req.result); });
    const books = await new Promise((r) => { const q = d.transaction('books').objectStore('books').getAll(); q.onsuccess = () => r(q.result); });
    return books[0] ? `${books[0].status}:${books[0].processedPages}/${books[0].pageCount}` : 'none';
  });
  if (status.startsWith('done') || status.startsWith('error')) break;
  await page.waitForTimeout(1000);
}
ok(status.startsWith('done'), `book processed (${status}, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
const data = await page.evaluate(async () => {
  const req = indexedDB.open('chess-book-reader');
  const d = await new Promise((r) => { req.onsuccess = () => r(req.result); });
  const all = (s) => new Promise((r) => { const q = d.transaction(s).objectStore(s).getAll(); q.onsuccess = () => r(q.result); });
  return { games: await all('games'), diagrams: await all('diagrams'), chapters: await all('chapters'), pages: await all('pages') };
});
const { Chess } = await import('chess.js');
const mainline = (pgn) => { const c = new Chess(); try { c.loadPgn(pgn); } catch { return []; } return c.history(); };
console.log('games:', data.games.map((g) => `${g.white || '?'}-${g.black || '?'} p${g.page} ${g.plies} plies ${g.status} issues=${g.issues.length}`).join(' | '));
console.log('diagrams:', data.diagrams.map((x) => `p${x.page} ${x.fen} conf=${x.conf.toFixed(2)} ${x.status} ${x.errors.join(';')}`).join('\n  '));
console.log('chapters:', data.chapters.map((c) => `${c.title} ${c.startPage}-${c.endPage}`).join(' | '));
const opera = data.games.find((g) => mainline(g.pgn).join(' ') === expected.opera.join(' '));
ok(!!opera, 'Opera game extracted move for move (33 plies) from figurine notation');
if (opera) {
  ok(/\(9\.\.\. Qb4 10\. Bxf6 Qxb3 11\. Bxb3 gxf6/.test(opera.pgn), 'variation 9...Qb4 attached in the right place');
  ok(/3\.\.\. exd4 4\. Qxd4|\(3\.\.\. exd4/.test(opera.pgn), 'variation 3...exd4 attached');
  ok(opera.result === '1-0', 'result 1-0 read');
  ok(Object.keys(opera.diagrams).length === 1, 'diagram linked to the game position after 12...Rd8');
  ok(opera.anchors.length >= 33, 'every main-line move has a page location');
}
const pl = (f) => (f ?? '').split(' ')[0];
const dg = data.diagrams.map((x) => pl(x.fen));
ok(dg.includes(expected.diag1), 'diagram 1 (vector, merida pieces) recognised exactly');
ok(dg.includes(expected.backrank), 'back-rank diagram recognised exactly');
ok(dg.includes(expected.blackmate), 'black-to-move diagram recognised exactly');
const bm = data.diagrams.find((x) => pl(x.fen) === expected.blackmate);
ok(bm && bm.turn === 'b', 'side to move read from the caption "Black to move"');
const frag = data.games.filter((g) => g.type === 'fragment');
ok(frag.some((g) => /Rd8#/.test(g.pgn)) && frag.some((g) => /Rd1#/.test(g.pgn)), 'diagram fragments 1.Rd8# and 1...Rd1# extracted');
const scanned = data.pages.find((p) => p.page === 4);
ok(scanned && scanned.ocr, 'scanned page detected and read with OCR');
const ruy = data.games.find((g) => mainline(g.pgn).join(' ') === expected.ruy.join(' '));
ok(!!ruy, 'game on the scanned page read by OCR move for move');
ok(data.chapters.some((c) => /Chapter 1/.test(c.title)) && data.chapters.some((c) => /Chapter 2/.test(c.title)), 'chapters found');

// Study view with the PDF and the board.
const bookId = data.games[0]?.bookId;
await page.goto(`${base}chess/#/study/${bookId}/${opera?.id ?? ''}`);
await page.waitForSelector('.pdfpage canvas');
await page.waitForTimeout(1500);
await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
await page.waitForTimeout(400);
ok(await page.$('.pdfpage .ov.mv.cur') !== null, 'current move highlighted on the PDF page');
await page.click('.switch');
await page.waitForFunction(() => /depth (1[2-9]|[2-9]\d)/.test(document.querySelector('.eng-meta')?.textContent ?? ''), null, { timeout: 60000 }).catch(() => undefined);
const eng = await page.textContent('.panel[aria-label=Engine]').catch(() => '');
ok(/depth (1[2-9]|[2-9]\d)/.test(eng ?? ''), `Stockfish running: ${(eng ?? '').replace(/\s+/g, ' ').slice(0, 160)}`);
await page.screenshot({ path: `${out}/study.png` });
await page.click('.switch');
// Whole-game analysis.
await page.getByRole('button', { name: /Analyse game/ }).click();
await page.waitForFunction(() => /Re-analyse game/.test(document.body.textContent ?? ''), null, { timeout: 240000 }).catch(() => undefined);
ok(await page.$('.graph svg path') !== null, 'evaluation graph drawn');
await page.screenshot({ path: `${out}/study-analysed.png`, fullPage: true });
// Export the book.
await page.goto(`${base}chess/#/book/${bookId}`);
await page.waitForSelector('text=Export whole book');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=Export whole book (PGN)')]);
const pgnText = readFileSync(await dl.path(), 'utf8');
ok(/\[Event/.test(pgnText) && (pgnText.match(/\[Event/g) ?? []).length === data.games.length, `exported PGN has all ${data.games.length} games`);
await page.screenshot({ path: `${out}/book.png`, fullPage: true });
// Diagram correction screen and phone layout.
await page.goto(`${base}chess/#/review/${bookId}/diagram/${data.diagrams[0].id}`);
await page.waitForSelector('.editgrid');
await page.screenshot({ path: `${out}/diagram-review.png` });
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}chess/#/study/${bookId}/${opera?.id ?? ''}`);
await page.waitForTimeout(1500);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
ok(!overflow, 'no horizontal scrolling on a phone');
await page.screenshot({ path: `${out}/phone-study.png`, fullPage: false });
await page.emulateMedia({ colorScheme: 'dark' });
await page.setViewportSize({ width: 1440, height: 950 });
await page.goto(`${base}chess/#/analysis`);
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/analysis-dark.png` });
ok(errors.length === 0, `no console errors${errors.length ? `: ${errors.slice(0, 5).join(' | ')}` : ''}`);
await browser.close();
console.log(fails.length ? `\n${fails.length} check(s) failed` : '\nall checks passed');
process.exit(fails.length ? 1 : 0);
