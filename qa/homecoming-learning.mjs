// The reference lessons never start play, award progress or spend currency.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const touch = process.argv.includes('--touch');
const h = await openHarness(touch ? { width: 390, height: 844, hasTouch: true, isMobile: true } : {});
const out = { touch, metadata: h.metadata, checks: 0 };
function check(ok, why) { assert(ok, why); out.checks++; }
try {
  const p = h.page;
  const title = p.locator('.capyui-more').filter({ hasText: 'learn to play' });
  await title.locator(':scope > summary').click();
  const lessons = title.locator('.capyui-learnlesson');
  check(await lessons.count() === 5, 'five selectable lessons');
  for (let i = 0; i < 5; i++) {
    const label = lessons.nth(i).locator('summary');
    await label.click();
    check(await lessons.nth(i).getAttribute('open') !== null, 'lesson opens');
    const box = await label.boundingBox();
    check(box.height >= 44 && box.x >= 0 && box.x + box.width <= (touch ? 390 : 1280), 'usable summary target');
  }
  const body = await lessons.first().textContent();
  check(touch ? body.includes('movement stick') && !body.includes('W, A, S, D') : body.includes('W, A, S, D'), 'correct control scheme');
  check(!await p.evaluate(() => window.__capy.state.started), 'reading does not begin game');
  await lessons.first().locator('summary').focus();
  await p.keyboard.press('Enter');
  check(await lessons.first().getAttribute('open') === null, 'keyboard toggles lesson');
  check(!await p.evaluate(() => window.__capy.state.started), 'lesson keyboard does not begin game');
  check(await p.locator('.capyui-title').evaluate(el => getComputedStyle(el).overflowX === 'hidden'), 'title does not offer horizontal scrolling');
  await h.screenshot('homecoming-learning-title-' + (touch ? 'touch' : 'desktop'));
  await h.start();
  await p.keyboard.press('Escape');
  await p.locator('.capyui-pausebtn').filter({ hasText: /^learn to play$/ }).click();
  check(await p.locator('.capyui-jrkeys').filter({ has: p.locator('.capyui-learn') }).getAttribute('open') !== null, 'pause opens guide and controls');
  check(await p.evaluate(() => window.__capy.state.paused), 'reference pauses play');
  check(await p.evaluate(() => document.activeElement.textContent.includes('learn to play and controls')), 'pause focuses learning reference');
  check(await p.locator('.capyui-jrkeys').filter({ has: p.locator('.capyui-learn') }).evaluate(el => el.parentNode.firstElementChild === el), 'learning precedes the destination board');
  const progress = () => p.evaluate(() => ({ score: window.__capy.state.score,
    yuzu: document.querySelector('.capyui-wallet')?.textContent }));
  const before = await progress();
  const guide = p.locator('.capyui-jrkeys .capyui-learn');
  await guide.locator('summary').nth(3).click();
  await p.waitForTimeout(350);
  const lessonBody = await guide.locator('.capyui-learnlesson').nth(3).locator('p').first().boundingBox();
  check(lessonBody.y >= 0 && lessonBody.y + lessonBody.height <= (touch ? 844 : 760), 'opened lesson body enters viewport');
  check((await guide.textContent()).includes('These lessons spend nothing'), 'economy lesson visible');
  assert.deepEqual(await progress(), before); out.checks++;
  await h.screenshot('homecoming-learning-pause-' + (touch ? 'touch' : 'desktop'));
  await p.keyboard.press('Escape');
  await p.keyboard.press('Tab');
  check(await p.locator('.capyui-jrkeys').filter({ has: p.locator('.capyui-learn') }).evaluate(el => el.parentNode.firstElementChild !== el), 'ordinary journal restores destination order');
  check(h.metadata.errors.length === 0, 'no browser errors');
  out.pass = true;
} catch (e) { out.pass = false; out.failure = String(e.stack || e); process.exitCode = 1; }
finally {
  try { await h.result('homecoming-learning-v8-' + (touch ? 'touch' : 'desktop'), out); }
  finally { await h.close(); }
  console.log(JSON.stringify({ touch, checks: out.checks, pass: out.pass, failure: out.failure, errors: h.metadata.errors }));
}
