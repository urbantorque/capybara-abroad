// The reference lessons never start play, award progress or spend currency.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const touch = process.argv.includes('--touch');
const h = await openHarness(touch ? { width: 390, height: 844, hasTouch: true, isMobile: true } : {});
const out = { touch, metadata: h.metadata, checks: 0 };
function check(ok, why) { assert(ok, why); out.checks++; }
async function actionPractice(guide) {
  const snapshot = () => h.page.evaluate(() => ({ started: window.__capy.state.started,
    paused: window.__capy.state.paused, save: localStorage.getItem('capy3.journey.v1') }));
  const before = await snapshot();
  const move = guide.locator('.capyui-learnlesson').nth(0);
  if (await move.getAttribute('open') === null) await move.locator('summary').click();
  await move.locator('.capyui-movepractice-open').click();
  const scene = move.locator('.capyui-learnpractice-scene');
  const marker = move.locator('.capyui-learnpractice-marker');
  check(await scene.evaluate(el => el === document.activeElement), 'movement diagram receives focus');
  await h.page.keyboard.press('d'); await h.page.keyboard.press('d');
  await h.page.keyboard.press('w'); await h.page.keyboard.press('w');
  check((await move.locator('.capyui-movepractice-status').textContent()).includes('star'), 'local target reached using real keys');
  await move.locator('.capyui-movepractice-reset').click();
  await move.locator('[data-action="KeyX"]').click();
  const prior = await marker.boundingBox();
  await h.page.keyboard.press('d');
  const after = await marker.boundingBox();
  check(after.x > prior.x && Math.abs(after.y - prior.y) < 2, 'right remains screen-right after view rotation');
  const controls = move.locator('.capyui-learnpractice-controls button');
  for (let i = 0; i < await controls.count(); i++) {
    await controls.nth(i).scrollIntoViewIfNeeded();
    const box = await controls.nth(i).boundingBox();
    check(box.height >= 44 && box.x >= 0 && box.x + box.width <= (touch ? 390 : 1280), 'movement button fits touch target');
  }
  await h.screenshot('homecoming-move-practice-' + (before.started ? 'pause' : 'title') + '-' + (touch ? 'touch' : 'desktop'));
  const interaction = guide.locator('.capyui-learnlesson').nth(1);
  if (await interaction.getAttribute('open') === null) await interaction.locator('summary').click();
  await interaction.locator('.capyui-interactionpractice-open').click();
  const host = interaction.locator('.capyui-learninteraction');
  const action = host.locator('button').filter({ hasText: /^E / });
  check(await action.isDisabled(), 'prop begins out of reach');
  await host.locator('button').nth(1).click();
  check(!await action.isDisabled(), 'local approach exposes action');
  await h.page.keyboard.press('e');
  check((await action.textContent()).includes('put'), 'E picks local prop');
  await h.page.keyboard.press('e');
  check(!(await action.textContent()).includes('put'), 'second E drops local prop');
  await h.page.keyboard.press('q');
  check((await host.locator('.capyui-interactionpractice-status').textContent()).includes('answers'), 'Q produces local response');
  await host.locator('.capyui-interactionpractice-reset').click();
  check(await action.isDisabled(), 'interaction reset restores distance');
  await h.screenshot('homecoming-interaction-practice-' + (before.started ? 'pause' : 'title') + '-' + (touch ? 'touch' : 'desktop'));
  assert.deepEqual(await snapshot(), before); out.checks++;
}
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
async function memoryPractice(guide) {
  const lesson=guide.locator('.capyui-learnlesson').nth(2);
  if(await lesson.getAttribute('open')===null)await lesson.locator('summary').click();
  const snapshot=()=>h.page.evaluate(()=>({started:window.__capy.state.started,
    save:localStorage.getItem('capy3.journey.v1')}));
  const before=await snapshot();
  await lesson.locator('.capyui-memorypractice-open').click();
  const choices=lesson.locator('.capyui-memorypractice-choice'),status=lesson.locator('.capyui-memorypractice-status');
  check(await choices.count()===4,'fresh Story rehearsal offers both core routes and two supports');
  check(await choices.first().evaluate(el=>document.activeElement===el),'opening focuses first choice');
  for(let i=0;i<4;i++){
    await choices.nth(i).scrollIntoViewIfNeeded();const box=await choices.nth(i).boundingBox();
    check(box.height>=44&&box.x>=0&&box.x+box.width<=(touch?390:1280),'memory choice remains a usable target');
  }
  await choices.nth(2).click();await choices.nth(3).click();
  check((await status.textContent()).includes('still missing'),'small moments alone do not complete memory');
  await choices.nth(1).focus();await h.page.keyboard.press('Enter');
  check((await status.textContent()).includes('complete'),'quiet route plus support completes rehearsal');
  check(await choices.nth(1).getAttribute('aria-pressed')==='true','choice exposes selected state');
  await choices.nth(1).click();check((await status.textContent()).includes('still missing'),'choice can be undone');
  await choices.first().click();check((await status.textContent()).includes('complete'),'big experience is an alternative');
  await h.screenshot('homecoming-memory-practice-'+(before.started?'pause':'title')+'-'+(touch?'touch':'desktop'));
  await lesson.locator('.capyui-memorypractice-reset').click();
  check(await choices.first().evaluate(el=>document.activeElement===el),'reset restores focus');
  check(await lesson.locator('.capyui-memorypractice-choice[aria-pressed="true"]').count()===0,'reset clears local choices');
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
  await actionPractice(title.locator('.capyui-learn'));
  await rehearse(title.locator('.capyui-learn'));
  await memoryPractice(title.locator('.capyui-learn'));
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
  await actionPractice(guide);
  await rehearse(guide);
  await memoryPractice(guide);
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
  try { await h.result('homecoming-learning-v13-' + (touch ? 'touch' : 'desktop'), out); }
  finally { await h.close(); }
  console.log(JSON.stringify({ touch, checks: out.checks, pass: out.pass, failure: out.failure, errors: h.metadata.errors }));
}
