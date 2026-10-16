// Headless smoke test for the renal lab: visits every route in renal/src/routes.ts, every tab a page
// declares (TAB_IDS), every textbook chapter and a clinical case opened in the sandbox, at desktop
// and phone width. Fails on any console error / page error, a missing <h1>, horizontal overflow at
// phone width, camelCase SVG attributes (Preact without compat writes them literally, so the
// browser ignores them) and internal links to routes that do not exist.
// Usage: npm run build && node tools/renal-smoke.mjs [dist-dir]   (defaults to dist/)
import fs from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { preview } from 'vite';

const root = resolve(import.meta.dirname, '..');
const outDir = resolve(process.argv[2] ?? `${root}/dist`);
const src = `${root}/renal/src`;

const routes = [...fs.readFileSync(`${src}/routes.ts`, 'utf8').matchAll(/\{ path: '([^']+)', page: '([^']+)'/g)].map((m) => ({ path: m[1], page: m[2] }));
const known = new Set(routes.map((r) => r.path));
const states = [];
for (const r of routes) {
  states.push(r.path);
  const file = `${src}/pages/${r.page}.tsx`;
  const tabs = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').match(/const TAB_IDS = \[([^\]]+)\]/) : null;
  if (tabs) for (const id of [...tabs[1].matchAll(/'([^']+)'/g)].slice(1)) states.push(`${r.path}?tab=${id[1]}`);
}
for (let ch = 1; ch <= 30; ch++) states.push(`/textbook?ch=${ch}`);

// SVG attributes that really are camelCase.
const CAMEL_OK = ['viewBox', 'preserveAspectRatio', 'markerWidth', 'markerHeight', 'markerUnits', 'refX', 'refY', 'gradientUnits', 'gradientTransform', 'patternUnits', 'stdDeviation', 'clipPathUnits', 'textLength', 'lengthAdjust', 'startOffset', 'pathLength', 'attributeName', 'repeatCount', 'keyTimes', 'calcMode'];

const server = await preview({ build: { outDir }, preview: { port: 4178, strictPort: true }, logLevel: 'silent' });
const base = 'http://localhost:4178/renal/';
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args }).catch(() => chromium.launch({ args }));
let failures = 0;
let visited = 0;
for (const [w, h, label] of [[1400, 1000, 'desktop'], [390, 844, 'mobile']]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  const list = [...states];
  for (const s of list) {
    errors.length = 0;
    await page.goto(`${base}#${s}`);
    await page.waitForFunction(() => document.querySelector('h1') && !document.querySelector('.loading'), null, { timeout: 15000 }).catch(() => {});
    await page.waitForFunction(() => !document.querySelector('.busy'), null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(150);
    visited++;
    const r = await page.evaluate((ok) => {
      const allowed = new Set(ok);
      const camel = new Set();
      for (const el of document.querySelectorAll('svg, svg *')) for (const a of el.getAttributeNames()) if (/[A-Z]/.test(a) && !allowed.has(a)) camel.add(`${el.tagName}[${a}]`);
      return {
        h1: document.querySelector('h1')?.textContent ?? null,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        camel: [...camel],
        links: [...document.querySelectorAll('a[href^="#/"]')].map((a) => a.getAttribute('href')),
      };
    }, CAMEL_OK);
    const dead = [...new Set(r.links.filter((l) => !known.has(l.slice(1).split('?')[0])))];
    if (s === '/cases') for (const l of [...new Set(r.links.filter((l) => l.startsWith('#/sandbox?s=')))].slice(0, 3)) list.push(l.slice(1));
    const bad = errors.length || !r.h1 || (label === 'mobile' && r.overflow > 1) || r.camel.length || dead.length;
    if (bad) {
      failures++;
      console.log(`✗ [${label}] #${s}`, { errors: [...errors], h1: r.h1, overflow: r.overflow, camel: r.camel, dead });
    }
  }
  await page.close();
}
await browser.close();
await server.close();
console.log(failures ? `${failures} failure(s) in ${visited} page visits` : `All ${visited} page visits OK (${states.length}+ states at desktop and mobile widths)`);
process.exit(failures ? 1 : 0);
