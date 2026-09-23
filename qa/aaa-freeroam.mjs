// Free roam, as a player finds it (23 Sep 2026). Fresh profile, real clicks:
//   1. Begin (story), play, reload: the title's second door must say Free
//      roam and its shelf must open all nineteen places.
//   2. Free roam, then back, then Carry on: the story file is untouched.
//   3. Free roam, then Hanoi: arrives in Hanoi, mode free, and after a reload
//      the file is free and the shelf has nothing locked.
//   node qa/aaa-freeroam.mjs [tag]
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';

const tag = process.argv[2] || 'fr';
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ width: 1280, height: 720 });
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };
const title = () => h.page.waitForFunction(() => window.__capy && document.querySelector('.capyui-go, .capyui-carry'), null, { timeout: 60000 });
const read = () => h.page.evaluate(() => {
  const go = document.querySelector('.capyui-go.alt');
  const picks = [...document.querySelectorAll('.capyui-pick')];
  return { started: !!window.__capy.state.started, mode: window.__capy.state.journeyMode, biome: window.__capy.biome.current,
    second: go ? go.textContent.trim() : null, carry: !!document.querySelector('.capyui-carry'),
    picks: picks.length, locked: picks.filter(p => p.disabled).length,
    file: (() => { try { return JSON.parse(localStorage.getItem('capy3.journey.v1')).journeyMode; } catch (e) { return null; } })() };
});
const click = sel => h.page.evaluate(sel => { const b = document.querySelector(sel); b.click(); return !!b; }, sel);
try {
  await title();
  // 1. a story file exists
  await h.page.evaluate(() => [...document.querySelectorAll('.capyui-go')].find(x => !x.classList.contains('alt')).click());
  await h.page.waitForFunction(() => window.__capy.state.started === true, null, { timeout: 60000 });
  await h.page.waitForTimeout(5000);
  let s = await read(); ok(s.mode === 'story', 'Begin is story');
  await h.page.reload(); await title(); await h.page.waitForTimeout(800);
  s = await read(); console.log('story title', JSON.stringify(s));
  ok(s.carry && s.second === 'Free roam', 'story file: the second door is Free roam');
  ok(s.locked === 18, 'story shelf is gated before the door is used');
  await click('.capyui-go.alt'); await h.page.waitForTimeout(700);
  s = await read(); console.log('after Free roam', JSON.stringify(s));
  ok(s.picks === 19 && s.locked === 0, 'Free roam opens all nineteen tiles');
  await h.screenshot('aaa-' + tag + '-free-shelf');
  // 2. back out and carry on: still story
  await h.page.keyboard.press('Escape'); await h.page.waitForTimeout(600);
  await click('.capyui-carry');
  await h.page.waitForFunction(() => window.__capy.state.started === true, null, { timeout: 60000 });
  await h.page.waitForTimeout(3000);
  s = await read(); console.log('carry on', JSON.stringify(s));
  ok(s.mode === 'story', 'looking at the free shelf and backing out changes nothing');
  // 3. Free roam, then Hanoi
  await h.page.reload(); await title(); await h.page.waitForTimeout(800);
  await click('.capyui-go.alt'); await h.page.waitForTimeout(700);
  await h.page.evaluate(() => [...document.querySelectorAll('.capyui-pick')].find(p => /^Hanoi/.test(p.getAttribute('aria-label') || '')).click());
  await h.page.waitForFunction(() => window.__capy.state.started === true, null, { timeout: 60000 });
  await h.page.waitForFunction(() => window.__capy.biome.current === 'hanoi', null, { timeout: 60000 });
  await h.page.waitForTimeout(4000);
  s = await read(); console.log('hanoi', JSON.stringify(s));
  ok(s.biome === 'hanoi' && s.mode === 'free', 'a locked place is reachable and the mode is free');
  await h.screenshot('aaa-' + tag + '-hanoi');
  // every place travels from inside the game, too
  const open = await h.page.evaluate(async () => {
    const g = window.__capy, names = ['sydney', 'kyoto', 'antarctic', 'drift', 'cave'];
    const got = [];
    for (const n of names) {
      // Asked again every 2 s: a crossing asked for while the last arrival
      // is still settling is dropped (transBusy), and a player at the board
      // simply presses again.
      const t0 = performance.now();
      for (let k = 0; g.biome.current !== n && performance.now() - t0 < 30000; k++) {
        if (k % 8 === 0) g.hud.cross(n);
        await new Promise(r => setTimeout(r, 250));
      }
      got.push(g.biome.current);
      // an arrival holds its card and lens for a few seconds; a player cannot
      // leave faster than that and a crossing asked for inside it is dropped
      await new Promise(r => setTimeout(r, 4000));
    }
    return got;
  });
  console.log('crossings', open.join(' '));
  ok(open.join() === 'sydney,kyoto,antarctic,drift,cave', 'free travel reaches places in every act');
  await h.page.evaluate(() => { try { window.__capy.saveFlush && window.__capy.saveFlush(); } catch (e) {} });
  await h.page.waitForTimeout(2500);
  await h.page.reload(); await title(); await h.page.waitForTimeout(800);
  s = await read(); console.log('free title', JSON.stringify(s));
  ok(s.file === 'free' && s.second === 'Go somewhere else' && s.locked === 0, 'the file stays free and nothing is locked');
  ok(h.metadata.errors.length === 0, 'no page errors: ' + JSON.stringify(h.metadata.errors.slice(0, 2)));
  console.log('Free roam: ' + checks + ' checks pass.');
} finally { await h.close(); }
