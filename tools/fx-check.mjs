// Debug: toggles individual post-processing effects to find rendering artifacts.
import { chromium } from '@playwright/test';
const OUT = process.argv[2] ?? '.';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
await page.goto('http://localhost:4173/');
await page.waitForSelector('.planner .ac-grid', { timeout: 60000 });
await page.evaluate(() => { [...document.querySelectorAll('.ac-card')].find(e => e.getAttribute('title')?.includes('737'))?.click(); });
await page.click('text=START FLIGHT');
await page.waitForFunction(() => window.app?.session?.status === 'flying', null, { timeout: 90000 });
await page.keyboard.press('Digit4');
await page.waitForTimeout(15000);
const variants = { real: {} };
for (const [name, v] of Object.entries(variants)) {
  await page.evaluate(v => { const s = window.app.globe.viewer.scene; s.postProcessStages.ambientOcclusion.enabled = false; void v; const c = window.app.globe.viewer.camera; c.moveBackward(60); c.moveUp(8); }, v);
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${OUT}/fx-${name}.png` });
}
const info = await page.evaluate(() => { const c = window.app.globe.viewer.camera; const t = window.app.session.fdm.telemetry; return { camH: c.positionCartographic.height, groundElev: t.groundElev, sun: window.app.weatherVisuals.lastSunElevation, time: window.app.globe.time.toISOString() }; });
console.log(JSON.stringify(info));
const tex = await page.evaluate(() => { const v = [...window.app.airports.visuals.values()].find(x => x.ident === 'KSFO'); const p = v.runways[0]; const img = p.appearance.material.uniforms.image; return { w: img.width, h: img.height, url: img.toDataURL ? img.toDataURL() : String(img).slice(0, 50) }; });
console.log(tex.w, tex.h);
if (tex.url.startsWith('data:')) (await import('node:fs')).writeFileSync(`${OUT}/rwtex.png`, Buffer.from(tex.url.split(',')[1], 'base64'));
await browser.close(); process.exit(0);
// close-up of the livery (left side)
await page.evaluate(() => { const s = window.app.globe.viewer.scene; s.postProcessStages.ambientOcclusion.enabled = false; s.highDynamicRange = true; });
await page.evaluate(() => { const c = window.app.globe.viewer.camera; c.zoomIn(35); });
await page.waitForTimeout(8000);
await page.screenshot({ path: `${OUT}/fx-closeup.png` });
await browser.close();
