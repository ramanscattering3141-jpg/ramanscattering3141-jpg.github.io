// Debug: screenshot the airliner cockpit view on the JFK approach after the camera blend settles.
import { chromium } from '@playwright/test';
const OUT = process.argv[2] ?? '.';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
const page = await browser.newPage({ viewport: { width: 1200, height: 750 } });
await page.goto('http://localhost:4173/');
await page.waitForSelector('.planner .ac-grid', { timeout: 60000 });
await page.click('.tab[data-tab=missions]');
await page.locator('.mission', { hasText: 'Airliner approach into JFK' }).locator('text=Start mission').click();
await page.waitForFunction(() => window.app?.session?.status === 'flying', null, { timeout: 90000 });
await page.evaluate(() => { const s = window.app.session; s.ap.engage(true); s.ap.setVertical('ALT'); s.ap.setLateral('HDG'); s.ap.setAthr(true); });
await page.keyboard.press('Digit1');
await page.waitForTimeout(20000);
console.log(await page.evaluate(() => { const c = window.app.globe.viewer.camera; const t = window.app.session.fdm.telemetry; return JSON.stringify({ mode: window.app.camera.mode, camPitch: c.pitch * 57.3, camHdg: c.heading * 57.3, acPitch: t.pitch, acHdg: t.heading }); }));
await page.screenshot({ path: `${OUT}/09-737-cockpit-settled.png` });
await browser.close();
