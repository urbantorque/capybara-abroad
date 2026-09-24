// ROADMAP-TEN T1a: a browser for the title-card instruments, with the
// patience a shared desk needs. reimagine-harness.mjs gives page.goto 20 s,
// and with six agents on one laptop the first load took longer than that
// twice running (measured 25 Sep 2026) — a title card is a layout, not a
// frame budget, so this waits as long as the load takes.
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
function playwright() {
  for (const c of [process.env.PLAYWRIGHT_MODULE_PATH, 'playwright',
    join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean)) {
    try { return require(c); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
  }
  throw new Error('Playwright unavailable. Set PLAYWRIGHT_MODULE_PATH.');
}

export async function openTitle({ url = process.env.CAPY_QA_URL || 'http://localhost:5188/',
  width = 1280, height = 720 } = {}) {
  const { chromium } = playwright();
  const browser = await chromium.launch({ channel: process.env.CAPY_QA_CHANNEL || 'msedge', headless: false,
    args: ['--mute-audio', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling'] });
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(180000); page.setDefaultTimeout(120000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.stack || e).slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__capy && !!document.querySelector('.capyui-go, .capyui-carry'));
  return { browser, page, errors, close: () => browser.close() };
}
