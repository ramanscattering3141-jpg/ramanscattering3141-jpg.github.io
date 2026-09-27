// Browser smoke test: loads the built app, starts flights and flies them.
// Usage: npm run build && npx vite preview --port 4173 & node tools/smoke.mjs [outDir]
import { chromium } from '@playwright/test';
const OUT = process.argv[2] ?? process.env.S ?? '.';
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined,
});
const page = await browser.newPage({ viewport: { width: 1400, height: 850 } });
const logs = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
const tel = () => page.evaluate(() => {
  const s = window.app.session; const t = s.fdm.telemetry;
  return { ias: +(t.ias / 0.5144).toFixed(0), altFt: +(t.alt / 0.3048).toFixed(0), aglFt: +(t.agl / 0.3048).toFixed(0), vs: +(t.vs / 0.00508).toFixed(0), hdg: +t.heading.toFixed(0), pitch: +t.pitch.toFixed(1), roll: +t.roll.toFixed(1), gnd: t.onGround, crashed: s.fdm.crashed, status: s.status, ap: `${s.ap.lateral}/${s.ap.vertical}` };
});
const fps = () => page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(+(n / 3).toFixed(1)); }; requestAnimationFrame(f); }));

await page.goto('http://localhost:4173/', { waitUntil: 'load' });
await page.waitForSelector('.planner .ac-grid', { timeout: 60000 });
await page.waitForTimeout(5000);
await page.screenshot({ path: `${OUT}/01-planner.png` });
console.log('planner ok');

// --- Cessna take-off from KSFO ---
await page.click('text=START FLIGHT');
await page.waitForFunction(() => window.app?.session?.status === 'flying', null, { timeout: 90000 });
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/02-runway.png` });
console.log('on runway', JSON.stringify(await tel()), 'fps', await fps());
// Software rendering runs ~1 fps here, so fast-forward the real in-page simulation
// (terrain, airports, weather — everything but rendering) with a scripted pilot.
const ff = (seconds, pilot) => page.evaluate(([sec, src]) => {
  const s = window.app.session, c = s.fdm.controls;
  const fn = new Function('t', 'c', 's', src);
  for (let i = 0; i < sec * 60; i++) { fn(s.fdm.telemetry, c, s); s.update(1 / 60); if (s.status !== 'flying') break; }
}, [seconds, pilot]);
await page.keyboard.press('Shift+KeyR');
await ff(25, `c.throttle = 1; c.parkingBrake = false;
  c.rudder = Math.max(-1, Math.min(1, ((((s.config.depRunway.headingTrue - t.heading) + 540) % 360) - 180) * 0.15));
  if (t.ias > 55 * 0.5144) c.elevator = Math.max(-1, Math.min(1, (8 - t.pitch) * 0.1));
  c.aileron = -t.roll * 0.05;`);
console.log('after takeoff roll', JSON.stringify(await tel()));
await ff(20, `c.elevator = Math.max(-1, Math.min(1, (7 - t.pitch) * 0.1)); c.aileron = -t.roll * 0.05; c.rudder = 0;`);
console.log('climb', JSON.stringify(await tel()));
await page.screenshot({ path: `${OUT}/03-climb-chase.png` });
await page.keyboard.press('Digit1'); await page.waitForTimeout(12000);
await page.screenshot({ path: `${OUT}/04-cockpit.png` });
await page.keyboard.press('Digit3'); await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/05-wing.png` });
await page.keyboard.press('Digit5'); await page.waitForTimeout(12000);
await page.screenshot({ path: `${OUT}/06-tower.png` });
console.log('after views', JSON.stringify(await tel()));

// --- 737 autoland mission at JFK ---
await page.keyboard.press('Escape'); await page.waitForTimeout(500);
await page.click('text=End flight');
await page.click('.tab[data-tab=missions]');
await page.locator('.mission', { hasText: 'Airliner approach into JFK' }).locator('text=Start mission').click();
await page.waitForFunction(() => window.app?.session?.status === 'flying', null, { timeout: 90000 });
await page.waitForTimeout(3000);
await page.evaluate(() => { const ap = window.app.session.ap; ap.engage(true); ap.setLateral('HDG'); ap.setVertical('ALT'); ap.setAthr(true); ap.targets.speedKt = Math.round(window.app.session.fdm.vrefKt() + 5); ap.armApproach(); });
await page.keyboard.press('Digit1'); await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/07-737-cockpit.png` });
await page.keyboard.press('Digit2');
for (let i = 0; i < 12; i++) {
  await ff(30, `if (t.onGround) { c.brakes = 1; c.reverse = false; }`);
  const t = await tel();
  console.log('approach', JSON.stringify(t));
  if (t.status !== 'flying' || t.crashed) break;
}
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/08-737-landed.png` });
console.log('final', JSON.stringify(await tel()));
console.log('report', JSON.stringify(await page.evaluate(() => window.app.session.report)));
console.log(logs.filter(l => !l.includes('ERR_TUNNEL_CONNECTION_FAILED')).slice(0, 30).join('\n'));
await browser.close();
