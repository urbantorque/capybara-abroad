import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
// ROADMAP-TEN T1a: the atlas is the STORY's shelf now. A fresh title's
// ArrowRight is the Free roam door and shows the flat wall (qa/ten-modes.mjs
// proves that), so this instrument makes a story file first — Begin — and
// reaches the atlas the way a player does: pause's "choose a place", which
// reloads with the pick flag. On a fresh story file only Sydney is open, so
// the old last act (Enter on Hanoi travels there) became: Hanoi is shut and
// says what opens it, Enter on it does nothing, and the hero carries on.
const touch = process.argv.includes('--touch');
const url = process.env.CAPY_QA_URL || 'http://localhost:5188/';
const h = await openHarness(touch ? { url, width: 390, height: 844, hasTouch: true, isMobile: true } : { url });
const out = { touch, metadata: h.metadata, checks: 0 };
function check(ok, why) { assert(ok, why); out.checks++; }
try {
  const p = h.page;
  p.setDefaultTimeout(90000); p.setDefaultNavigationTimeout(150000);
  await p.evaluate(() => [...document.querySelectorAll('.capyui-go')].find(b => !b.classList.contains('alt')).click());
  await p.waitForFunction(() => window.__capy.state.started === true);
  await p.waitForTimeout(4000);
  const toAtlas = async () => {
    await p.evaluate(() => sessionStorage.setItem('capy3.pick', '1'));
    await p.reload({ waitUntil: 'load' });
    await p.waitForFunction(() => !!window.__capy && !!document.querySelector('.capyui-carry'));
    await p.locator('.capyui-card.two').waitFor();
  };
  await toAtlas();
  const folds = p.locator('.capyui-act');
  check(await folds.count() === 5, 'five folds');
  check(await p.locator('.capyui-act[open]').count() === 1, 'one open fold on a fresh story file');
  check(await folds.first().getAttribute('open') !== null, 'first act open');
  check(await p.locator('.capyui-act[open] .capyui-pick').count() === 2, 'only Quay and Manly join Sydney initially');
  check(await p.locator('.capyui-act .capyui-pick').count() === 18, 'all destinations retained (18 in folds + the hero)');
  check(await p.locator('.capyui-picks.flat').isHidden(), 'the flat wall is not drawn under the atlas');
  await h.screenshot('homecoming-atlas-fresh-' + (touch ? 'touch' : 'desktop'));
  const saved = await p.evaluate(() => localStorage.getItem('capy3.journey.v1'));
  for (let i = 1; i < 5; i++) {
    const label = folds.nth(i).locator('summary');
    await label.click();
    check(await folds.nth(i).getAttribute('open') !== null, 'fold opens');
    check(await folds.nth(i).locator('.capyui-pick').count() === 4, 'four places in later fold');
    const r = await label.boundingBox();
    check(r.height >= 44 && r.x >= 0 && r.x + r.width <= (touch ? 390 : 1280), 'fold target fits');
    await label.focus(); await p.keyboard.press('Space');
    check(await folds.nth(i).getAttribute('open') === null, 'Space closes fold');
    check(!await p.evaluate(() => window.__capy.state.started), 'fold keyboard never starts game');
  }
  await folds.nth(2).locator('summary').focus();
  await p.keyboard.press('Enter');
  check(await folds.nth(2).getAttribute('open') !== null, 'Enter opens fold');
  await p.keyboard.press('ArrowDown');
  // Every postcard in a later fold is gated on a fresh story file, and the
  // rect walk skips a disabled tile: down from the summary is the next summary.
  check(await p.evaluate(() => document.activeElement === document.querySelectorAll('.capyui-act>summary')[3]),
    'Down skips gated postcards');
  check(await p.evaluate(() => localStorage.getItem('capy3.journey.v1')) === saved, 'browsing does not change save');
  const hanoi = folds.nth(2).locator('.capyui-pick').filter({ hasText: /Hanoi/i });
  check(await hanoi.isDisabled(), 'Hanoi is shut to a fresh story');
  check(/Sydney memory/.test(await hanoi.textContent()), 'and says a Sydney memory opens the way');
  await p.keyboard.press('Slash');   // Hanoi's own key, printed on its picture
  await p.waitForTimeout(600);
  check(!await p.evaluate(() => window.__capy.state.started), 'a digit for a shut place starts nothing');
  await p.locator('.capyui-pick.hero.compact').focus(); await p.keyboard.press('Enter');
  await p.waitForFunction(() => window.__capy.state.started && window.__capy.biome.current === 'sydney');
  check(await p.evaluate(() => window.__capy.state.journeyMode) === 'story', 'the hero carries the story on');
  await p.waitForTimeout(3000);
  const file = await p.evaluate(() => localStorage.getItem('capy3.journey.v1'));
  out.saveBeforeReload = JSON.parse(file);
  await toAtlas();
  check(await folds.nth(0).getAttribute('open') !== null, 'saved location opens its own fold');
  check(await p.locator('.capyui-act[open]').count() === 1, 'returning title opens only current fold');
  out.saveAfterReload = await p.evaluate(() => JSON.parse(localStorage.getItem('capy3.journey.v1')));
  // pagehide flushes the elapsed journey clock; every progress field stays.
  const { ms: beforeMs, ...beforeProgress } = out.saveBeforeReload;
  const { ms: afterMs, ...afterProgress } = out.saveAfterReload;
  assert.deepEqual(afterProgress, beforeProgress); out.checks++;
  check(afterMs >= beforeMs && afterMs - beforeMs < 5000, 'only elapsed play time advances on unload');
  await h.screenshot('homecoming-atlas-return-' + (touch ? 'touch' : 'desktop'));
  check(h.metadata.errors.length === 0, 'no runtime errors');
  out.pass = true;
} catch (e) { out.pass = false; out.failure = String(e.stack || e); process.exitCode = 1; }
finally { await h.result('homecoming-atlas-v3-' + (touch ? 'touch' : 'desktop'), out); await h.close(); console.log(JSON.stringify({ touch, checks: out.checks, pass: out.pass, failure: out.failure, errors: h.metadata.errors })); }
