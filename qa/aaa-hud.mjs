// AAA A5: the paper in play. Arrive, wait for the tuck, read the tab (text,
// arrow shown, metres, the sub-line), press L (the full sheet), L again (tucked).
//   node qa/aaa-hud.mjs [chapter]
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const chapter = process.argv[2] || 'kyoto';
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ width: 1280, height: 720 });
let checks = 0; const ok = (c, m) => { assert.ok(c, m); checks++; };
const read = () => h.page.evaluate(() => {
  const t = document.querySelector('.capyui-todo'), vis = e => !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0;
  const tab = document.querySelector('.capyui-tab'), aim = tab && tab.querySelector('.capyui-aim');
  const r = t.getBoundingClientRect();
  return { away: t.classList.contains('away'), w: Math.round(r.width), hgt: Math.round(r.height),
    tab: tab ? tab.textContent.trim().slice(0, 90) : '', aim: vis(aim), count: (document.querySelector('.capyui-count') || {}).textContent };
});
try {
  await h.start(); await h.arrive(chapter); await h.page.bringToFront();
  await h.page.waitForTimeout(11000);
  let s = await read(); console.log('tucked', JSON.stringify(s)); await h.screenshot('aaa-hud-' + chapter + '-tab');
  ok(s.away, 'tucks after arrival');
  ok(s.aim, 'the tab carries the arrow');
  await h.page.keyboard.press('KeyL'); await h.page.waitForTimeout(500);
  s = await read(); console.log('open', JSON.stringify(s)); await h.screenshot('aaa-hud-' + chapter + '-open');
  ok(!s.away, 'L opens the list');
  await h.page.keyboard.press('KeyL'); await h.page.waitForTimeout(500);
  s = await read(); ok(s.away, 'L tucks it again');
  ok(h.metadata.errors.length === 0, 'no errors');
  console.log('HUD: ' + checks + ' checks pass.');
} finally { await h.close(); }
