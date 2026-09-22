import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const touch = process.argv.includes('--touch');
const h = await openHarness(touch ? { width: 390, height: 844, hasTouch: true, isMobile: true } : {});
const out = { touch, metadata: h.metadata, checks: 0 };
function check(ok, why) { assert(ok, why); out.checks++; }
try {
  const p = h.page;
  await p.keyboard.press('ArrowRight');
  await p.locator('.capyui-card.two').waitFor();
  const folds = p.locator('.capyui-act');
  check(await folds.count() === 5, 'five folds');
  check(await p.locator('.capyui-act[open]').count() === 1, 'one open fold on fresh title');
  check(await folds.first().getAttribute('open') !== null, 'first act open');
  check(await p.locator('.capyui-act[open] .capyui-pick').count() === 2, 'only Quay and Manly join Sydney initially');
  check(await p.locator('.capyui-pick').count() === 19, 'all destinations retained');
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
  check(await p.evaluate(() => document.activeElement.classList.contains('capyui-pick')), 'Down enters exposed postcards');
  await folds.nth(2).locator('summary').focus(); await p.keyboard.press('Enter');
  await p.keyboard.press('ArrowDown');
  check(await p.evaluate(() => document.activeElement === document.querySelectorAll('.capyui-act>summary')[3]), 'Down skips closed postcards');
  check(await p.evaluate(() => localStorage.getItem('capy3.journey.v1')) === saved, 'browsing does not change save');
  await folds.nth(2).locator('summary').click();
  const hanoi = folds.nth(2).locator('.capyui-pick').filter({ hasText: /Hanoi/i });
  await hanoi.focus(); await p.keyboard.press('Enter');
  await p.waitForFunction(() => window.__capy.state.started && window.__capy.biome.current === 'hanoi');
  check(await p.evaluate(() => window.__capy.biome.current === 'hanoi'), 'native postcard Enter travels to selected place');
  await p.waitForFunction(() => {
    try { return JSON.parse(localStorage.getItem('capy3.journey.v1')).biome === 'hanoi'; } catch { return false; }
  });
  const file = await p.evaluate(() => localStorage.getItem('capy3.journey.v1'));
  out.saveBeforeReload = JSON.parse(file);
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => !!window.__capy && !!document.querySelector('.capyui-go'));
  await p.keyboard.press('ArrowRight');
  check(await folds.nth(2).getAttribute('open') !== null, 'saved location opens its own fold');
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
