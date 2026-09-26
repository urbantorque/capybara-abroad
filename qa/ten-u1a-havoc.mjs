// HAVOC, as Free Roam plays it (ROADMAP-TEN U1a/U1g, 26 Sep 2026).
// Fresh profile, the Free roam door, Sydney. Headful on the real GPU.
//   1. the ring is placed and shows; the arrival card's pill contrast
//   2. the streak: three mischief links chain to x3 and a broken chain pays
//   3. a run: KNOCKDOWN started from the ring door, gold ends it early, the
//      best is saved, and after a reload the Free Roam tile shows the medal
//   4. the pests: a warden in front, real V presses knock it out; a gull
//      circles and throws its shadow; three hits and the animal is caught
//   node qa/ten-u1a-havoc.mjs [tag]
// The streak and the run count are fed through the same 'capy:mischief'
// event props.js and systems.js emit; that the sources emit it is proved by
// the knock-over leg (a real bin, real keys) at the end.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';

const tag = process.argv[2] || 'a';
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ width: 1280, height: 720 });
const { page } = h;
let checks = 0;
const ok = (c, m, d) => { if (!c) console.log('FAIL', m, d !== undefined ? JSON.stringify(d) : ''); assert.ok(c, m); checks++; console.log('ok', m); };
const audit = () => page.evaluate(() => window.__capy.havoc.audit());
const out = {};
try {
  await h.start();
  await page.waitForFunction(() => window.__capy.biome.current === 'sydney' && window.__capy.state.journeyMode === 'free', null, { timeout: 60000 });
  // the arrival card, read while it is up
  await page.waitForTimeout(900);
  out.card = await page.evaluate(() => {
    const s = document.querySelector('.capyui-placesub'), n = document.querySelector('.capyui-placenews');
    const cs = e => e ? { color: getComputedStyle(e).color, bg: getComputedStyle(e).backgroundColor, size: getComputedStyle(e).fontSize, text: e.textContent } : null;
    return { sub: cs(s), news: cs(n), shown: !!document.querySelector('.capyui-place.show') };
  });
  await h.screenshot('ten-u1a-' + tag + '-arrival');
  // a fresh file plays its ten-second opening first; HAVOC waits for it
  await page.waitForFunction(() => window.__capy.havocOK(), null, { timeout: 30000 });
  await page.waitForTimeout(3600);
  let a = await audit();
  ok(a.live, 'HAVOC is live in Free Roam', a);
  ok(a.ring && a.ring.visible, 'the ring is placed and shows', a.ring);
  await h.screenshot('ten-u1a-' + tag + '-ring');

  // 2. the streak
  await page.evaluate(() => {
    const g = window.__capy, p = g.capy.position;
    window.__yz0 = g.yuzuHave();
    for (let i = 0; i < 3; i++) g.events.emit('capy:mischief', { kind: 'tip', x: p.x, z: p.z, type: 'bin' });
  });
  a = await audit();
  ok(a.links === 3 && a.mult === 3, 'three links chain to x3', a);
  await page.waitForTimeout(250);
  await h.screenshot('ten-u1a-' + tag + '-streak');
  await page.waitForTimeout(4600);
  const paid = await page.evaluate(() => window.__capy.yuzuHave() - window.__yz0);
  a = await audit();
  ok(a.links === 0 && paid >= 1, 'a broken chain of three pays yuzu', { paid, links: a.links });

  // 3. a run from the ring: walk the animal's own body into it is the door;
  // the probe uses the run's own start (qaStart) so the leg does not depend
  // on a walk path, and then counts through the event the sources emit.
  await page.evaluate(() => window.__capy.havoc.qaStart('knock'));
  await page.waitForTimeout(700);
  await h.screenshot('ten-u1a-' + tag + '-intro');
  await page.waitForFunction(() => window.__capy.havoc.audit().run === 'live', null, { timeout: 8000 });
  await page.evaluate(() => { const g = window.__capy, p = g.capy.position;
    for (let i = 0; i < 6; i++) g.events.emit('capy:mischief', { kind: 'tip', x: p.x, z: p.z, type: 'bin' }); });
  await page.waitForTimeout(400);
  await h.screenshot('ten-u1a-' + tag + '-live');
  await page.evaluate(() => { const g = window.__capy, p = g.capy.position;
    for (let i = 0; i < 6; i++) g.events.emit('capy:mischief', { kind: 'bang', x: p.x, z: p.z, type: 'crate' }); });
  await page.waitForTimeout(600);
  a = await audit();
  ok(a.run === 'result' && a.medal === 3 && a.score > 0, 'gold ends the run early with a score', a);
  await h.screenshot('ten-u1a-' + tag + '-result');
  out.run = { medal: a.medal, score: a.score };
  const stored = await page.evaluate(() => window.__capy.havocStore.get(1));
  ok(stored && stored.medal === 3 && stored.best === a.score, 'the best is in the store', stored);
  // Enter runs it again
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  a = await audit();
  ok(a.run === 'intro', 'Enter starts another go', a.run);
  await page.waitForTimeout(3200);

  // 4. the pests
  await page.evaluate(() => { window.__ko = 0; window.__capy.events.on('havoc:ko', () => window.__ko++);
    window.__hits = []; window.__capy.events.on('havoc:hit', e => window.__hits.push(e.hearts));
    window.__caught = 0; window.__capy.events.on('havoc:caught', () => window.__caught++);
    window.__capy.havoc.qaQuiet(); window.__capy.havoc.qaPest('warden', 11); });
  await page.waitForTimeout(300);
  await h.screenshot('ten-u1a-' + tag + '-warden');
  for (let i = 0; i < 8 && !(await page.evaluate(() => window.__ko)); i++) {
    // keep the animal's nose on the warden: turn toward it with A/D holds
    await page.evaluate(() => {
      const g = window.__capy, p = g.capy.position, a = g.havoc.audit().pests.find(q => q.kind === 'warden' && q.state !== 'ko');
      if (a) g.capy.group.rotation.y = Math.atan2(a.x - p.x, a.z - p.z);
    });
    await h.hold('KeyV', 60);
    await page.waitForTimeout(450);
  }
  const ko = await page.evaluate(() => window.__ko);
  ok(ko >= 1, 'V knocks a warden out', { ko });
  await page.waitForTimeout(300);
  await h.screenshot('ten-u1a-' + tag + '-ko');
  // a gull circles, then its shadow
  await page.evaluate(() => window.__capy.havoc.qaPest('gull', 8));
  await page.waitForFunction(() => window.__capy.havoc.audit().pests.some(q => q.kind === 'gull' && q.state === 'aim'), null, { timeout: 12000 });
  await page.waitForTimeout(500);
  await h.screenshot('ten-u1a-' + tag + '-gull');
  // three hits and it is caught: stand still in front of a warden, again and again
  const home = await page.evaluate(() => { const s = window.__capy.biome.spawnOf('sydney'); return { x: s.x, z: s.z }; });
  for (let i = 0; i < 40 && !(await page.evaluate(() => window.__caught)); i++) {
    await page.evaluate(() => { const g = window.__capy; if (!g.havoc.audit().pests.some(q => q.kind === 'warden' && q.state !== 'ko')) g.havoc.qaPest('warden', 6); });
    await page.waitForTimeout(700);
  }
  const hits = await page.evaluate(() => window.__hits.slice());
  const caught = await page.evaluate(() => window.__caught);
  ok(hits.length >= 3 && caught >= 1, 'three hits and the animal is caught', { hits, caught });
  await page.waitForTimeout(400);
  await h.screenshot('ten-u1a-' + tag + '-caught');
  a = await audit();
  const at = await page.evaluate(() => ({ x: window.__capy.capy.position.x, z: window.__capy.capy.position.z }));
  ok(a.hearts === 3 && Math.hypot(at.x - home.x, at.z - home.z) < 6, 'caught: back at the start with three hearts', { a: a.hearts, at, home });
  out.hits = hits;

  // 5. the medal on the wall after a reload
  await page.evaluate(() => { try { window.__capy.saveFlush && window.__capy.saveFlush(); } catch (e) {} });
  await page.waitForTimeout(1500);
  await page.reload();
  await page.waitForFunction(() => window.__capy && document.querySelector('.capyui-go, .capyui-carry'), null, { timeout: 90000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { const b = document.querySelector('.capyui-go.alt'); if (b) b.click(); });
  await page.waitForTimeout(900);
  const tile = await page.evaluate(() => { const e = document.querySelector('.capyui-pick.hero .capyui-pickhavoc'); return e ? { cls: e.className, text: e.textContent } : null; });
  ok(tile && /m3/.test(tile.cls) && +tile.text === out.run.score, 'the Sydney tile shows the gold medal and the best', tile);
  await h.screenshot('ten-u1a-' + tag + '-wall');
  out.checks = checks;
  await h.result('ten-u1a-' + tag, out);
  console.log('HAVOC: ' + checks + ' checks passed');
} finally {
  await h.close();
}
