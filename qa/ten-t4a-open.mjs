// ROADMAP-TEN T4a: the reimagine harness's owned headful browser, with the one
// difference this wave needed: a 150 s navigation. Six agents on an 8-core
// laptop measured the page's load event at 48.8 s (qa/ten-t4a-ping.mjs) and
// openHarness's 20 s default timed out three runs in a row.
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = fileURLToPath(new URL('../', import.meta.url));
function playwright() {
  for (const c of [process.env.PLAYWRIGHT_MODULE_PATH, 'playwright',
    join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)) {
    try { return require(c); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
  }
  throw new Error('Playwright unavailable.');
}
export async function openSlow({ url = process.env.CAPY_QA_URL || 'http://localhost:5191/', width = 1280, height = 720 } = {}) {
  const args = ['--mute-audio', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'];
  const browser = await playwright().chromium.launch({ channel: 'msedge', headless: false, args });
  const origin = new URL(url).origin;
  const context = await browser.newContext({ viewport: { width, height },
    storageState: { cookies: [], origins: [{ origin, localStorage: [{ name: 'capy3.prefs.v1', value: JSON.stringify({ v: 1, pf: 1 }) }] }] } });
  const page = await context.newPage();
  page.setDefaultTimeout(150000);
  const errors = [];
  page.on('pageerror', e => errors.push({ kind: 'pageerror', message: String(e.stack || e) }));
  page.on('console', m => { if (m.type() === 'error') errors.push({ kind: 'console', message: m.text() }); });
  await page.goto(url, { waitUntil: 'load', timeout: 150000 });
  await page.waitForFunction(() => !!window.__capy && !!document.querySelector('.capyui-go'), null, { timeout: 150000 });
  await page.bringToFront();
  const start = async () => {
    await page.evaluate(() => (document.querySelector('.capyui-carry') || document.querySelector('.capyui-go')).click());
    await page.waitForFunction(() => window.__capy.state.started === true, null, { timeout: 60000 });
    await page.keyboard.down('Shift'); await page.waitForTimeout(30); await page.keyboard.up('Shift');
    await page.waitForTimeout(1200);
  };
  const screenshot = name => page.screenshot({ path: resolve(ROOT, 'qa', name + '.png') });
  const result = async (name, data) => {
    await fetch(new URL('/shot?name=' + encodeURIComponent(name + '.json'), origin), { method: 'POST',
      body: Buffer.from(JSON.stringify(data, null, 2), 'utf8').toString('base64') });
  };
  return { browser, page, start, screenshot, result, metadata: { errors }, close: () => browser.close() };
}
