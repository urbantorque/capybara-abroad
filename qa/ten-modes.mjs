// ROADMAP-TEN T1a: two games that share a world, driven as a player finds
// them. Fresh profile, 1280x720, real keys where the item names a key.
//   1. page one: two doors with two different sublines and no tooltip
//   2. the Free roam door: the flat wall, all nineteen tiles in view, no
//      fold, no "more below" pill, "Where to?"
//   3. Digit1 on page one is Begin: journeyMode === 'story'
//   4. story -> free from the title (ArrowRight, the Sydney tile): free, and
//      the paper in Sydney has no "memories" on it; Tab is a departures
//      board with nineteen live rows
//   5. free -> story -> free in play (pause), the second switch asking once
//   6. free -> story from the title: a free file left in Hanoi, "Carry on
//      the story", lands in the story's frontier (Sydney) in story mode
//   CAPY_QA_URL=http://localhost:5191/ node qa/ten-modes.mjs
// The static half (the source keeps the flat loop, the atlas gate, the page
// two digit rule and the free gates) is qa/ten-t1a-modes-static.mjs, in npm test.
import assert from 'node:assert/strict';
import { openTitle } from './ten-t1a-open.mjs';

const h = await openTitle({ width: 1280, height: 720 });
const p = h.page;
let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; console.log('  ok  ' + m); };
const title = () => p.waitForFunction(() => window.__capy && document.querySelector('.capyui-go, .capyui-carry'));
const started = () => p.waitForFunction(() => window.__capy.state.started === true);
const mode = () => p.evaluate(() => window.__capy.state.journeyMode);
const file = () => p.evaluate(() => { try { return JSON.parse(localStorage.getItem('capy3.journey.v1')); } catch (e) { return null; } });
const flush = async () => { await p.evaluate(() => { try { window.__capy.saveFlush && window.__capy.saveFlush(); } catch (e) {} }); await p.waitForTimeout(1200); };
const pauseBtn = label => p.evaluate(l => {
  const b = [...document.querySelectorAll('.capyui-pausebtn,.capyui-pauseask button')].find(x => x.textContent.trim() === l && x.offsetParent !== null);
  if (b) b.click(); return !!b;
}, label);
const inView = () => p.evaluate(() => {
  const vh = innerHeight, vw = innerWidth;
  const shelf = [...document.querySelectorAll('.capyui-picks')].find(s => s.offsetParent !== null);
  const sr = shelf.getBoundingClientRect();
  const live = [...document.querySelectorAll('.capyui-p2 .capyui-pick')].filter(t => t.offsetParent !== null);
  const seen = live.filter(t => { const r = t.getBoundingClientRect();
    const inShelf = t.classList.contains('hero') || (r.top >= sr.top - 2 && r.bottom <= sr.bottom + 2);
    return inShelf && r.top >= 0 && r.bottom <= vh && r.left >= 0 && r.right <= vw; });
  const more = document.querySelector('.capyui-more2');
  return { live: live.length, seen: seen.length, flat: shelf.classList.contains('flat'),
    folds: [...document.querySelectorAll('.capyui-act')].filter(f => f.offsetParent !== null).length,
    pill: !!(more && !more.hidden), head: document.querySelector('.capyui-h2').textContent,
    locked: live.filter(t => t.disabled).length };
});
try {
  await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await p.reload(); await title(); await p.waitForTimeout(1500);

  // 1. two doors that say what they are
  const doors = await p.evaluate(() => [...document.querySelectorAll('.capyui-p1 .capyui-go')].map(b => ({
    word: b.querySelector('b').textContent, line: (b.querySelector('.capyui-goline') || {}).textContent || '',
    tip: b.getAttribute('title') })));
  console.log('doors', JSON.stringify(doors));
  ok(doors.length === 2 && doors[0].line && doors[1].line && doors[0].line !== doors[1].line, 'two doors, two different sublines');
  ok(doors.every(d => !d.tip), 'no title= tooltip on either door');

  // 2. the flat wall
  await p.evaluate(() => document.querySelector('.capyui-go[data-free]').click());
  await p.waitForTimeout(3000);
  let v = await inView(); console.log('free shelf', JSON.stringify(v));
  ok(v.flat && v.folds === 0 && v.live === 19 && v.locked === 0, 'Free roam shows the flat shelf: 19 tiles, no folds, none locked');
  ok(v.seen === 19 && !v.pill, 'all 19 in view at 1280x720, no "more below" pill');
  ok(v.head === 'Where to?', 'the free heading is "Where to?"');
  await p.screenshot({ path: 'qa/ten-t1a-p2-free.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(700);

  // 3. Digit1 on page one is Begin
  await p.keyboard.press('Digit1');
  await started(); await p.waitForTimeout(5000);
  ok(await mode() === 'story', 'Digit1 on page one begins the story');
  await flush();
  ok((await file()).journeyMode === 'story', 'the file is a story file');

  // the atlas, from pause's door, for the picture
  await p.evaluate(() => sessionStorage.setItem('capy3.pick', '1'));
  await p.reload(); await title(); await p.waitForTimeout(3500);
  v = await inView(); console.log('atlas', JSON.stringify(v));
  ok(!v.flat && v.folds === 5 && v.head === 'Where next?', 'pause\'s "choose a place" on a story file is the atlas');
  await p.screenshot({ path: 'qa/ten-t1a-p2-atlas.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(700);

  // 4. story -> free from the title: ArrowRight is the Free roam door
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(1500);
  v = await inView();
  ok(v.flat && v.locked === 0 && v.live === 19, 'ArrowRight on page one shows the flat shelf, nothing locked');
  await p.evaluate(() => document.querySelector('.capyui-pick.hero.flat').click());
  await started(); await p.waitForTimeout(7000);
  ok(await mode() === 'free', 'a tile on the flat shelf starts Free Roam');
  await p.evaluate(() => { try { window.__capy.hud.todoRefresh && window.__capy.hud.todoRefresh(); } catch (e) {} });
  const paper = await p.evaluate(() => (document.querySelector('.capyui-todo') || {}).textContent || '');
  console.log('paper', JSON.stringify(paper.slice(0, 200)));
  ok(paper.length > 0 && !/memories/i.test(paper), 'the free Sydney paper says nothing about memories');
  await p.keyboard.press('Tab'); await p.waitForTimeout(900);
  const board = await p.evaluate(() => ({ go: document.querySelectorAll('.capyui-jr.show .go').length,
    head: (document.querySelector('.capyui-jrcard h2') || {}).textContent,
    sub: (document.querySelector('.capyui-jrsub') || {}).textContent }));
  console.log('board', JSON.stringify(board));
  ok(board.go === 19, 'Tab in Free Roam is a departures board with 19 live rows');
  ok(/anywhere/.test(board.sub) && !/memor/.test(board.sub), 'its head line is the free one, no memory count');
  await p.keyboard.press('Escape'); await p.waitForTimeout(700);

  // 5. free -> story -> free, in play
  await p.keyboard.press('Escape'); await p.waitForTimeout(700);
  ok(await pauseBtn('back to the story'), 'pause offers "back to the story" in Free Roam');
  await p.waitForTimeout(900);
  ok(await mode() === 'story', 'back to the story: journeyMode story');
  await p.keyboard.press('Escape'); await p.waitForTimeout(700);
  ok(await pauseBtn('free roam: open every place'), 'pause offers the free switch in the story');
  await p.waitForTimeout(400);
  const asked = await p.evaluate(() => [...document.querySelectorAll('.capyui-pauseask')].some(a => !a.hidden && /the story waits/.test(a.textContent)));
  ok(asked && await mode() === 'story', 'the first story-to-free switch asks, and has not switched yet');
  ok(await pauseBtn('open every place'), 'the answer is on the question');
  await p.waitForTimeout(900);
  ok(await mode() === 'free', 'free again: the round trip holds');

  // 6. a free file left in Hanoi, carried back to the story from the title
  await p.evaluate(() => window.__capy.hud.cross('hanoi'));
  await p.waitForFunction(() => window.__capy.biome.current === 'hanoi', null, { timeout: 90000 });
  await p.waitForTimeout(5000);
  // the reload's pagehide is the flush (window.__capy has no saveFlush)
  await p.reload(); await title(); await p.waitForTimeout(1500);
  const f = await file();
  console.log('file', JSON.stringify({ mode: f.journeyMode, biome: f.biome }));
  ok(f.journeyMode === 'free' && f.biome === 'hanoi', 'the file is free, and in Hanoi');
  const storyDoor = await p.evaluate(() => { const b = document.querySelector('.capyui-go.story'); return b ? b.querySelector('b').textContent : ''; });
  ok(storyDoor === 'Carry on the story', 'a free file has "Carry on the story" on the title');
  await p.evaluate(() => document.querySelector('.capyui-go.story').click());
  await started(); await p.waitForTimeout(7000);
  const st = await p.evaluate(() => ({ mode: window.__capy.state.journeyMode, biome: window.__capy.biome.current }));
  console.log('story again', JSON.stringify(st));
  ok(st.mode === 'story' && st.biome === 'sydney', 'Carry on the story lands in the frontier (Sydney), not silently nowhere');
  ok(h.errors.length === 0, 'no page errors: ' + JSON.stringify(h.errors.slice(0, 2)));
  console.log('Ten modes: ' + checks + ' checks pass.');
} finally { await h.close(); }
