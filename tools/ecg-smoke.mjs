// Headless smoke test for the ECG app: visits every ECG route in Chromium, fails on any console
// error / page error, a missing <h1>, a "not found" page, or horizontal overflow at phone width.
// Usage: npm run build && node tools/ecg-smoke.mjs
// Options (environment variables):
//   ECG_DIST=<dir>   built site to serve (default: dist)
//   PORT=<n>         preview port (default: 4179)
//   ECG_ROUTES=a,b   only these routes (e.g. "dx/avnrt,tools/qtc")
//   ECG_QUICK=1      main pages only (skip the per-diagnosis, eponym, glossary and case pages)
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const src = (f) => readFileSync(new URL(`../src/ecg/${f}`, import.meta.url), 'utf8');
const ids = (f, re) => [...src(f).matchAll(re)].map((m) => m[1]);

const MAIN = [
  '', 'fundamentals', 'fundamentals/leads', 'fundamentals/ap', 'fundamentals/systematic', 'physiology', 'physiology/activation',
  'simulator', 'simulator?preset=dextrocardia', 'simulator?preset=wpw', 'rhythms', 'rhythms/avnrt-lab', 'rhythms/avrt-lab', 'rhythms/flutter-lab',
  'conduction', 'conduction/av', 'conduction/bbb', 'structural', 'ischemia', 'electrolytes', 'electrolytes/drugs', 'inherited', 'management', 'acls',
  'cases', 'cases?dx=avnrt', 'challenge', 'sandbox', 'sandbox/one', 'sandbox/build', 'sandbox/adenosine', 'sandbox/compare', 'sandbox/axis', 'sandbox/p',
  'sandbox/qrs', 'sandbox/st', 'sandbox/hierarchy', 'ddx', 'search', 'search?q=wide%20QRS', 'search?q=regular%20narrow%20tachycardia', 'search?q=adenosine',
  'search?q=epsilon', 'sources', 'tools', 'tools/qtc', 'tools/chads', 'tools/sgarbossa', 'tools/wct', 'tools/leads', 'glossary', 'path',
  'heart3d', 'heart3d?preset=lbbb', 'heart3d?preset=chbVentricular', 'heart3d?preset=vf', 'az', 'eponyms', 'normal', 'omi',
];
// Every diagnosis, finding ("why"), differential, eponym and glossary page, read from the content files.
const DETAIL = [
  ...['dx_rhythm', 'dx_reentry', 'dx_ventricular', 'dx_conduction', 'dx_morph', 'dx_metabolic', 'dx_extra'].flatMap((f) => ids(`content/${f}.ts`, /^ {4}id: '([^']+)'/gm)).map((id) => `dx/${id}`),
  ...ids('content/findings.ts', /^ {4}id: '([^']+)'/gm).map((id) => `why/${id}`),
  ...ids('content/differentials.ts', /^ {4}id: '([^']+)'/gm).map((id) => `ddx/${id}`),
  ...ids('content/eponyms.ts', /^ {4}id: '([^']+)'/gm).map((id) => `eponyms/${id}`),
  ...ids('content/glossary.ts', /id: '([^']+)'/g).map((id) => `glossary/${id}`),
];
const ROUTES = process.env.ECG_ROUTES ? process.env.ECG_ROUTES.split(',') : process.env.ECG_QUICK ? MAIN : [...MAIN, ...DETAIL];

const port = Number(process.env.PORT || 4179);
const server = await preview({ build: { outDir: process.env.ECG_DIST || 'dist' }, preview: { port, strictPort: true }, logLevel: 'silent' });
const base = `http://localhost:${port}/ecg/`;
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args }).catch(() => chromium.launch({ args }));
let failures = 0;
for (const [w, h, label] of [[1280, 900, 'desktop'], [390, 844, 'mobile']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  for (const r of ROUTES) {
    errors.length = 0;
    await page.goto(`${base}#/${r}`);
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const h1 = await page.locator('h1').first().textContent().catch(() => null);
    const notFound = !!h1 && /not found|does not exist/i.test(h1);
    const bad = errors.length || !h1 || notFound || (label === 'mobile' && overflow > 1);
    if (bad) {
      failures++;
      console.log(`✗ [${label}] #/${r}`, { errors, h1, overflow });
    }
  }
  await page.close();
}
await browser.close();
await server.close();
console.log(failures ? `${failures} failure(s)` : `All ${ROUTES.length} routes OK at desktop and mobile widths`);
process.exit(failures ? 1 : 0);
