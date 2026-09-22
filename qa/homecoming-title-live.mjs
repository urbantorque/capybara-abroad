// Headful title layout, native reference disclosure and actual entry.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const touch = process.argv.includes('--touch');
const h = await openHarness(touch ? { width: 390, height: 844, hasTouch: true, isMobile: true } : {});
const out = { metadata: h.metadata, touch, checks: 0 };
function check(ok, why) { assert(ok, why); out.checks++; }
try {
  const p = h.page;
  await p.waitForFunction(() => window.__capyRunning && window.__capy.state.frames > 0);
  await p.waitForTimeout(2500);
  check((await p.locator('.capyui-mast').textContent()).replace(/\s+/g, ' ').trim() === 'Capybara Abroad', 'readable title');
  const measure = () => p.evaluate(() => {
    const card = document.querySelector('.capyui-card').getBoundingClientRect();
    const mast = document.querySelector('.capyui-mast').getBoundingClientRect();
    const word = document.querySelector('.capyui-word').getBoundingClientRect();
    return { x: card.x, right: card.right, width: innerWidth,
      wordFits: word.left >= mast.left - 1 && word.right <= mast.right + 1,
      family: getComputedStyle(document.querySelector('.capyui-word')).fontFamily,
      overflow: document.documentElement.scrollWidth > innerWidth,
      started: window.__capy.state.started };
  });
  const m = await measure(); out.layout = m;
  check(m.x >= 0 && m.right <= m.width && m.wordFits && !m.overflow, 'title fits viewport');
  check(m.family.includes('Georgia'), 'book face');
  check(!m.started, 'title stays live without starting');
  check(await p.locator('.capyui-touch').evaluate(el => getComputedStyle(el).visibility === 'hidden'), 'gameplay controls do not clutter title');
  check(await p.locator('.capyui-p1>.capyui-legend').count() === 0, 'reference off first page');
  check(!await p.locator('.capyui-title-keys').isVisible(), 'keys folded initially');
  check(await p.locator('.capyui-p1>.capyui-sub,.capyui-p1>.capyui-why,.capyui-p1>.capyui-orn,.capyui-p1>.capyui-foot').count() === 0, 'opening contains no slogan, duplicated mascot or footer');
  for (const selector of ['.capyui-p1 .capyui-go', '.capyui-p1 .capyui-more>summary']) {
    const r = await p.locator(selector).first().boundingBox();
    check(r.height >= 44 && r.y >= 0 && r.y + r.height <= (touch ? 844 : 760), 'menu target visible and usable');
  }
  await h.screenshot('homecoming-title-' + (touch ? 'touch' : 'desktop'));
  const summary = p.locator('.capyui-p1 .capyui-more>summary');
  await summary.focus(); await p.keyboard.press('Enter');
  check(await p.locator('.capyui-title-keys').isVisible(), 'Enter reveals controls');
  check(!await p.evaluate(() => window.__capy.state.started), 'reference Enter never begins');
  await summary.focus(); await p.keyboard.press('Enter');
  await p.emulateMedia({ reducedMotion: 'reduce' });
  check(await p.locator('.capyui-word').isVisible(), 'reduced motion retains title');
  await p.locator('.capyui-p1 .capyui-go').first().focus();
  check(await p.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== 'none'), 'keyboard focus visible');
  await p.keyboard.press('Enter');
  await p.waitForFunction(() => window.__capy.state.started);
  check(await p.evaluate(() => window.__capy.state.journeyMode === 'story'), 'Begin still starts Story');
  check(await p.locator('.capyui-touch').evaluate(el => getComputedStyle(el).visibility !== 'hidden'), 'title releases gameplay controls');
  check(h.metadata.errors.length === 0, 'no runtime errors');
  out.pass = true;
} catch (e) { out.pass = false; out.failure = String(e.stack || e); process.exitCode = 1; }
finally {
  await h.result('homecoming-title-' + (touch ? 'touch' : 'desktop') + '-v1', out);
  await h.close(); console.log(JSON.stringify({ pass: out.pass, checks: out.checks, failure: out.failure }));
}
