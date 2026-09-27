// Debug: fast-forwards an approach mission (default: JFK) with the autopilot and prints the last seconds + score.
// Usage: npx vite preview --port 4173 & node tools/probe-approach.mjs ["Mission title"]
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined });
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
await page.goto('http://localhost:4173/');
await page.waitForSelector('.planner .ac-grid', { timeout: 60000 });
await page.click('.tab[data-tab=missions]');
await page.locator('.mission', { hasText: process.argv[2] ?? 'Airliner approach into JFK' }).locator('text=Start mission').click();
await page.waitForFunction(() => window.app?.session?.status === 'flying', null, { timeout: 90000 });
const out = await page.evaluate(() => {
  const s = window.app.session, ap = s.ap; ap.engage(true); ap.setLateral('HDG'); ap.setVertical('ALT'); ap.setAthr(true); ap.targets.speedKt = Math.round(s.fdm.vrefKt() + 5); ap.armApproach();
  const rows = []; let prevMode = '';
  for (let i = 0; i < 60 * 400; i++) {
    const t = s.fdm.telemetry;
    if (t.onGround) { s.fdm.controls.brakes = 1; }
    s.update(1 / 60);
    const mode = ap.vertical;
    if (i % 60 === 0 || mode !== prevMode) rows.push(`${(i / 60).toFixed(0)}s ${mode} alt=${(t.alt / 0.3048).toFixed(0)} gnd=${(t.groundElev / 0.3048).toFixed(0)} agl=${(t.agl / 0.3048).toFixed(0)} vs=${(t.vs / 0.00508).toFixed(0)} ias=${(t.ias / 0.5144).toFixed(0)} pitch=${t.pitch.toFixed(1)} gsDots=${s.approach?.gsDots.toFixed(2)} dthr=${s.approach?.distThresholdM.toFixed(0)} xtk=${s.approach?.crossTrackM.toFixed(0)} gp=${(s.approach?.glidepathAltM/0.3048).toFixed(0)} rwel=${s.approach?.runway.elev} ${s.status} ${s.fdm.crashed ?? ''} ${s.fdm.crashPart}`);
    prevMode = mode;
    if (s.status !== 'flying') break;
  }
  return rows.slice(-10).join("\n") + "\nREPORT " + JSON.stringify(s.report) + " " + JSON.stringify(s.missionResult);
});
console.log(out);
await browser.close();
