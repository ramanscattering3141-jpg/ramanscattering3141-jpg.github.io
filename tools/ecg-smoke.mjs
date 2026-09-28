// Headless smoke test for the ECG app: visits every main route in Chromium, fails on any
// console error / page error, and checks for horizontal overflow at phone width.
// Usage: npm run build && node tools/ecg-smoke.mjs
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const ROUTES = [
  '', 'fundamentals', 'fundamentals/leads', 'fundamentals/ap', 'fundamentals/systematic', 'physiology', 'physiology/activation', 'why/wide-qrs',
  'simulator', 'simulator?preset=dextrocardia', 'rhythms', 'rhythms/avnrt-lab', 'rhythms/avrt-lab', 'rhythms/flutter-lab', 'conduction', 'conduction/av', 'conduction/bbb',
  'structural', 'ischemia', 'electrolytes', 'electrolytes/drugs', 'inherited', 'management', 'acls', 'cases', 'challenge',
  'sandbox', 'sandbox/one', 'sandbox/build', 'sandbox/adenosine', 'sandbox/compare', 'sandbox/axis', 'sandbox/p', 'sandbox/qrs', 'sandbox/st', 'sandbox/hierarchy',
  'ddx', 'search?q=wide%20QRS', 'search?q=epsilon', 'sources', 'tools', 'tools/qtc', 'tools/chads', 'tools/sgarbossa', 'tools/wct', 'tools/leads', 'glossary', 'glossary/reentry', 'path',
  'dx/avnrt', 'dx/stemi', 'dx/hcm', 'dx/arvc', 'dx/athlete', 'dx/takotsubo', 'dx/deWinter', 'dx/lvAneurysm', 'dx/cpvt', 'dx/dextrocardia', 'dx/leadReversal', 'dx/artifact',
];

const server = await preview({ preview: { port: 4179, strictPort: true }, logLevel: 'silent' });
const base = 'http://localhost:4179/ecg/';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
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
    const bad = errors.length || !h1 || (label === 'mobile' && overflow > 1);
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
