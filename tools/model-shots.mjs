// Debug: renders close-up screenshots of aircraft models (free camera) for visual checks.
import { chromium } from '@playwright/test';
const OUT = process.argv[2] ?? '.';
const ids = (process.argv[3] ?? 'b738').split(',');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
const page = await browser.newPage({ viewport: { width: 1200, height: 700 } });
page.on('pageerror', e => console.log('pageerror', e.message));
await page.goto('http://localhost:4173/');
await page.waitForSelector('.planner .ac-grid', { timeout: 60000 });
for (const id of ids) {
  await page.evaluate(id => { const b = [...document.querySelectorAll('.ac-card')].find(e => e.getAttribute('title')?.toLowerCase().includes(id)); b?.click(); }, id === 'b738' ? '737' : id === 'b744' ? '747' : id === 'c172' ? '172' : id === 'a320' ? 'a320' : id);
  await page.click('text=START FLIGHT');
  await page.waitForFunction(() => window.app?.session?.status === 'flying', null, { timeout: 90000 });
  await page.keyboard.press('Digit4');
  await page.waitForTimeout(20000);
  await page.screenshot({ path: `${OUT}/model-${id}.png` });
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  await page.click('text=End flight'); await page.waitForTimeout(1500);
}
await browser.close();
