// ROADMAP-REIMAGINE: one owned, headful browser per instrument. This uses
// Playwright directly when the historical playwright-cli is unavailable.
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const CHAPTERS = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio',
  'iceland', 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
  'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi'];

function playwright() {
  const candidates = [process.env.PLAYWRIGHT_MODULE_PATH, 'playwright',
    join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')].filter(Boolean);
  for (const candidate of candidates) {
    try { return require(candidate); } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') throw error;
    }
  }
  throw new Error('Playwright unavailable. Set PLAYWRIGHT_MODULE_PATH to an installed package; this harness never installs packages.');
}

const artifactName = name => {
  if (!/^[\w.-]+$/.test(name)) throw new Error('Artifact name must not contain a path.');
  return name;
};

export async function openHarness({ url = 'http://localhost:5188/',
  width = 1280, height = 760, deviceScaleFactor = 1,
  hasTouch = false, isMobile = false,
  channel = process.env.CAPY_QA_CHANNEL || 'msedge', storage = {},
  pinRung = true } = {}) {
  const { chromium } = playwright();
  // A fresh Playwright profile never attaches to the player's browser/save.
  const browser = await chromium.launch({ channel, headless: false });
  try {
    const origin = new URL(url).origin;
    const entries = { ...storage };
    if (pinRung && !Object.hasOwn(entries, 'capy3.prefs.v1')) entries['capy3.prefs.v1'] = { v: 1, pf: 1 };
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor, hasTouch, isMobile,
      // Seed only at context creation; reload tests must retain later writes.
      storageState: { cookies: [], origins: [{ origin, localStorage:
        Object.entries(entries).map(([name, value]) => ({ name,
          value: typeof value === 'string' ? value : JSON.stringify(value) })) }] } });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [], warnings = [], requests = [];
    page.on('pageerror', e => errors.push({ kind: 'pageerror', message: String(e.stack || e) }));
    page.on('crash', () => errors.push({ kind: 'crash', message: 'Owned browser page crashed' }));
    page.on('console', m => {
      if (m.type() === 'error') errors.push({ kind: 'console', message: m.text() });
      if (m.type() === 'warning') warnings.push(m.text());
    });
    page.on('requestfailed', r => requests.push({ url: r.url(), error: r.failure()?.errorText }));
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__capy && !!document.querySelector('.capyui-go'));
    await page.bringToFront();
    const cdp = await browser.newBrowserCDPSession();
    const system = await cdp.send('SystemInfo.getInfo');
    const renderer = await page.evaluate(() => {
      const gl = window.__capy.renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return { vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
        renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION), hidden: document.hidden };
    });
    const metadata = { at: new Date().toISOString(), browser: browser.version(), channel,
      headless: false, viewport: { width, height, deviceScaleFactor, hasTouch, isMobile }, renderer,
      gpu: system.gpu, errors, warnings, requests };
    const hold = async (key, ms = 350) => {
      if (ms < 1 || ms > 20000) throw new Error('Key hold must be 1–20000 ms.');
      await page.keyboard.down(key);
      try { await page.waitForTimeout(ms); } finally { await page.keyboard.up(key); }
    };
    const start = async () => {
      await page.evaluate(() => (document.querySelector('.capyui-carry') || document.querySelector('.capyui-go')).click());
      await page.waitForFunction(() => window.__capy.state.started === true);
      // Trusted input unlocks audio; an evaluated DOM click alone cannot.
      await hold('Shift', 30);
      await page.waitForTimeout(1200);
    };
    const arrive = async chapter => {
      if (!CHAPTERS.includes(chapter)) throw new Error('Unknown chapter: ' + chapter);
      if (await page.evaluate(() => window.__capy.biome.current) !== chapter) {
        await page.evaluate(name => window.__capy.hud.cross(name), chapter);
        await page.waitForTimeout(9500);
      }
      await page.waitForFunction(name => window.__capy.biome.current === name, chapter);
    };
    const screenshot = name => page.screenshot({ path: resolve(ROOT, 'qa', artifactName(name) + '.png') });
    const result = async (name, data) => {
      artifactName(name);
      const response = await page.evaluate(async ({ name, data }) => {
        const response = await fetch('/shot?name=' + encodeURIComponent(name + '.json'), {
          method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))) });
        return { ok: response.ok, status: response.status };
      }, { name, data });
      if (!response.ok) throw new Error('QA sink failed: ' + response.status);
    };
    return { browser, context, page, metadata, hold, start, arrive, screenshot, result,
      close: () => browser.close() };
  } catch (error) { await browser.close(); throw error; }
}

export async function snapshot(page) {
  return page.evaluate(() => {
    const g = window.__capy, p = g.capy.body.position;
    const visible = selector => [...document.querySelectorAll(selector)].filter(el => {
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) !== 0;
    }).map(el => ({ text: el.textContent.trim(), rect: el.getBoundingClientRect().toJSON() }));
    return { chapter: g.biome.current, started: g.state.started, paused: g.state.paused,
      time: g.state.time, hidden: document.hidden, rung: g.state.perfRung,
      lastError: g.state.lastError || null, position: { x: p.x, y: p.y, z: p.z },
      camera: { position: g.camera.position.toArray(), quaternion: g.camera.quaternion.toArray(), fov: g.camera.fov },
      renderer: { size: [g.renderer.domElement.width, g.renderer.domElement.height],
        calls: g.renderer.info.render.calls, triangles: g.renderer.info.render.triangles },
      tasks: visible('.capyui-todo .capyui-txt'),
      save: localStorage.getItem('capy3.journey.v1') };
  });
}

export async function measureTicks(page, durationMs = 4000) {
  if (durationMs < 100 || durationMs > 15000) throw new Error('Timing sample must be 100–15000 ms.');
  return page.evaluate(async durationMs => {
    const g = window.__capy, raw = g.tick, ticks = [], intervals = [];
    let last = performance.now();
    // Time normal rAF's work, not a second simulation loop competing with it.
    g.tick = function (...args) {
      const before = performance.now();
      const result = raw.apply(this, args);
      if (args[1] !== false) { ticks.push(performance.now() - before); intervals.push(before - last); last = before; }
      return result;
    };
    try { await new Promise(resolve => setTimeout(resolve, durationMs)); }
    finally { g.tick = raw; }
    const stats = values => {
      const sorted = values.slice(1).sort((a, b) => a - b);
      return { n: sorted.length, median: sorted[Math.floor(sorted.length * 0.5)] ?? null,
        p95: sorted[Math.floor(sorted.length * 0.95)] ?? null };
    };
    return { tickMs: stats(ticks), rafMs: stats(intervals), rung: g.state.perfRung,
      hidden: document.hidden, paused: !!g.state.paused,
      note: 'CPU time around the live tick; GPU identity recorded separately, not GPU timer-query duration.' };
  }, durationMs);
}
