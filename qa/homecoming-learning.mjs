// The reference lessons never start play, award progress or spend currency.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const touch = process.argv.includes('--touch');
const h = await openHarness(touch ? { width: 390, height: 844, hasTouch: true, isMobile: true } : {});
const out = { touch, metadata: h.metadata, checks: 0 };
function check(ok, why) { assert(ok, why); out.checks++; }
async function rehearse(guide) {
  const lesson = guide.locator('.capyui-learnlesson').nth(3);
  if (await lesson.getAttribute('open') === null) await lesson.locator('summary').click();
  const saved = () => h.page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('capy3.journey.v1') || 'null');
    return s ? { yuzu:s.yuzu, owned:s.owned, tasks:s.tasks } : null;
  });
  const before = await saved(), started = await h.page.evaluate(() => window.__capy.state.started);
  await lesson.locator('.capyui-practice-open').click();
  const buy = lesson.locator('.capyui-practice-buy');
  check(await buy.isDisabled(), 'practice price initially unaffordable');
  await lesson.locator('.capyui-practice-collect').focus(); await h.page.keyboard.press('Enter');
  check(!await buy.isDisabled(), 'practice collection makes real-price preview affordable');
  await buy.click();
  check(await lesson.locator('.capyui-practice-wallet').textContent() === 'Practice wallet: 0 yuzu', 'practice subtracts displayed price');
  check(await buy.isDisabled(), 'no double purchase');
  check((await lesson.locator('.capyui-practice-status').textContent()).includes('unchanged'), 'rehearsal clearly labelled');
  await lesson.locator('.capyui-practice-reset').click();
  check(await buy.isDisabled(), 'reset permits another rehearsal');
  assert.deepEqual(await saved(),before); out.checks++;
  check(await h.page.evaluate(() => window.__capy.state.started) === started, 'practice never starts the world');
}
async function mapPractice(guide) {
  const lesson=guide.locator('.capyui-learnlesson').nth(4);
  if(await lesson.getAttribute('open')===null)await lesson.locator('summary').click();
  const snapshot=()=>h.page.evaluate(()=>({started:window.__capy.state.started,
    save:localStorage.getItem('capy3.journey.v1')}));
  const before=await snapshot();
  await lesson.locator('.capyui-mappractice-open').click();
  const next=lesson.locator('.capyui-mappractice-next'),status=lesson.locator('.capyui-mappractice-status');
  for(const shape of ['coin','ring','boat']){
    check(await lesson.locator('.capyui-mappractice-question').evaluate(el=>document.activeElement===el),'question receives focus after explicit advance');
    check(await next.isDisabled(),'map practice waits for a correct answer');
    const wrong=lesson.locator('.capyui-mappractice-answer').filter({has: h.page.locator('.capyui-mlswatch-'+(shape==='coin'?'boat':'coin'))});
    await wrong.click();
    check(await next.isDisabled()&&(await status.textContent()).includes('another'),'wrong answer permits retry');
    const answer=lesson.locator('.capyui-mappractice-answer[data-shape="'+shape+'"]');
    await answer.scrollIntoViewIfNeeded();const box=await answer.boundingBox();
    check(box.height>=44&&box.x>=0&&box.x+box.width<=(touch?390:1280),'map answer is a usable target');
    check(await answer.locator('.capyui-mlswatch-'+shape).count()===1,'answer reuses live legend glyph');
    await answer.focus();await h.page.keyboard.press('Enter');
    check(!await next.isDisabled(),'correct symbol enables next');
    await next.click();
  }
  check((await status.textContent()).includes('unchanged'),'map completion describes isolation');
  check(await lesson.locator('.capyui-mappractice-reset').evaluate(el=>document.activeElement===el),'completion retains keyboard focus');
  await h.screenshot('homecoming-map-practice-'+(before.started?'pause':'title')+'-'+(touch?'touch':'desktop'));
  await lesson.locator('.capyui-mappractice-reset').click();
  check(await next.isDisabled(),'map reset starts a new rehearsal');
  assert.deepEqual(await snapshot(),before);out.checks++;
}
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
  await rehearse(title.locator('.capyui-learn'));
  await mapPractice(title.locator('.capyui-learn'));
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
  await rehearse(guide);
  await mapPractice(guide);
  // Map practice scrolled past the shop. Re-open it to exercise the actual
  // disclosure scroll contract instead of asserting an old offscreen lesson.
  if (await guide.locator('.capyui-learnlesson').nth(3).getAttribute('open') !== null) await guide.locator('summary').nth(3).click();
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
  try { await h.result('homecoming-learning-v11-' + (touch ? 'touch' : 'desktop'), out); }
  finally { await h.close(); }
  console.log(JSON.stringify({ touch, checks: out.checks, pass: out.pass, failure: out.failure, errors: h.metadata.errors }));
}
