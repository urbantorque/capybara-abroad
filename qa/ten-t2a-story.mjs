// ROADMAP-TEN T2a: the story's beats, on a fresh story file at 1280x720.
//   1. the premise: FIVE FOLDS OF A MAP, up for five seconds or more
//   2. the grace: no ibis theft and no scene while there is no memory
//   3. the Sydney memory: exactly one A MEMORY card, rank 3 — a heat-ladder
//      card raised under it is dropped — and the keepsake within 3 m
//   4. the Quay memory turns the fold: the ACT II card, 'story:act' on the
//      bus, game.journeyAct() === 2
//   5. a reload does not play the act card again; the atlas tile for
//      Sydney reads in the story's terms and the page does not scroll
// The ticks are fired through game.completeTask, the same door a real tick
// goes through: this instrument proves the beats, not the concert.
//   CAPY_QA_URL=http://localhost:5191/ node qa/ten-t2a-story.mjs
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { openTitle } from './ten-t1a-open.mjs';

const h = await openTitle({ width: 1280, height: 720 });
const p = h.page;
let checks = 0;
const out = {};
const ok = (c, m) => { assert.ok(c, m); checks++; console.log('  ok  ' + m); };
const wait = ms => p.waitForTimeout(ms);
const shot = name => p.screenshot({ path: new URL('./' + name + '.png', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1') });
try {
  // ---- 1. Begin, and the premise --------------------------------------
  await p.evaluate(() => [...document.querySelectorAll('.capyui-go')].find(b => !b.classList.contains('alt')).click());
  await p.waitForFunction(() => window.__capy.state.started === true);
  ok(await p.evaluate(() => window.__capy.state.journeyMode) === 'story', 'Begin is the story');
  // installed now: a sampler of the moment card and the bus, drained later
  await p.evaluate(() => {
    const g = window.__capy;
    window.__t2a = { prem: [], acts: [], mems: [], memCards: 0, actCards: 0, lastMem: false, lastAct: false };
    g.events.on('story:act', e => window.__t2a.acts.push(e));
    g.events.on('story:memory', e => window.__t2a.mems.push(e));
    window.__t2aT = setInterval(() => {
      const m = document.querySelector('.capyui-moment');
      if (m && m.classList.contains('show') && /FIVE FOLDS/.test(m.textContent)) window.__t2a.prem.push(performance.now());
      const d = document.querySelector('.capyui-done');
      const mem = !!(d && d.classList.contains('show') && d.classList.contains('mem'));
      const act = !!(d && d.classList.contains('show') && d.classList.contains('act'));
      if (mem && !window.__t2a.lastMem) window.__t2a.memCards++;
      if (act && !window.__t2a.lastAct) window.__t2a.actCards++;
      window.__t2a.lastMem = mem; window.__t2a.lastAct = act;
    }, 100);
  });
  await p.waitForFunction(() => window.__t2a.prem.length > 0, null, { timeout: 90000 });
  await p.waitForFunction(() => {
    const m = document.querySelector('.capyui-moment');
    return !(m && m.classList.contains('show') && /FIVE FOLDS/.test(m.textContent));
  }, null, { timeout: 30000 });
  const prem = await p.evaluate(() => window.__t2a.prem);
  out.premiseS = +((prem[prem.length - 1] - prem[0]) / 1000).toFixed(2);
  ok(out.premiseS >= 4.6, 'the premise is up ' + out.premiseS + ' s (>= 5 s less one sample)');
  const premText = await p.evaluate(() => window.__capy.state.qaMoments().shown.map(s => s.k + ':' + s.pri).join(','));
  ok(/A TRAVELLER'S BAG:2/.test(premText), 'the premise is rank 2 (' + premText + ')');

  // ---- 2. the grace ----------------------------------------------------
  ok(await p.evaluate(() => window.__capy.graceOn()) === true, 'a fresh story file is in its grace');
  ok(await p.evaluate(() => window.__capy.rivalOK()) === false, 'the ibis may not steal in the grace');

  // ---- 3. the Sydney memory --------------------------------------------
  await p.evaluate(() => window.__capy.completeTask('steal-hat'));
  await wait(3500);
  ok(await p.evaluate(() => window.__t2a.memCards) === 0, 'one small thing is not a memory');
  await p.evaluate(() => window.__capy.completeTask('opera-stage'));
  await p.waitForFunction(() => window.__t2a.memCards > 0, null, { timeout: 20000 });
  // a heat-ladder card raised under the memory: rank 0, dropped
  const before = await p.evaluate(() => window.__capy.state.qaMoments().dropped);
  await p.evaluate(() => window.__capy.hud.showMoment('AN INCIDENT', 'three bins', '', true));
  await wait(200);
  const qm = await p.evaluate(() => window.__capy.state.qaMoments());
  out.dropped = [before, qm.dropped, qm.shown];
  ok(qm.dropped > before && !qm.shown.some(c => c.k === 'AN INCIDENT'), 'a rank-0 card under the memory is dropped');
  ok(await p.evaluate(() => !document.querySelector('.capyui-moment').classList.contains('show')), 'and the moment card is not up over it');
  await wait(1700);
  await shot('ten-t2a-memory');
  out.memText = await p.evaluate(() => document.querySelector('.capyui-done').innerText.replace(/\s+/g, ' '));
  ok(/A MEMORY/i.test(out.memText) && /OPERA HOUSE CONCERT/i.test(out.memText), 'the card names the memory: ' + out.memText);
  out.keepDist = await p.evaluate(() => {
    const g = window.__capy, k = g.physics.keepOut('sydney');
    if (!k) return -1;
    const b = k.body ? k.body.position : (k.mesh ? k.mesh.position : k.position);
    const c = g.capy.position;
    return +Math.hypot(b.x - c.x, b.z - c.z).toFixed(2);
  });
  ok(out.keepDist >= 0 && out.keepDist < 3, 'the keepsake is at its feet: ' + out.keepDist + ' m');
  await wait(9000);
  ok(await p.evaluate(() => window.__t2a.memCards) === 1, 'exactly one A MEMORY card');
  ok(await p.evaluate(() => window.__t2a.actCards) === 0, 'Sydney alone does not turn the fold');
  ok(await p.evaluate(() => window.__capy.graceOn()) === false, 'the grace ends with the first memory');
  ok(await p.evaluate(() => window.__capy.journeyAct()) === 1, 'journeyAct() is 1');
  out.footer = await p.evaluate(() => (document.querySelector('.capyui-todo') || {}).innerText || '');

  // ---- 4. the Quay memory turns the fold --------------------------------
  await p.evaluate(() => window.__capy.hud.cross('quay'));
  await p.waitForFunction(() => window.__capy.biome.current === 'quay', null, { timeout: 60000 });
  await wait(9000);
  await p.evaluate(() => window.__capy.completeTask('ferry-salute'));
  await wait(2500);
  await p.evaluate(() => window.__capy.completeTask('under-bridge'));
  await p.waitForFunction(() => window.__t2a.memCards > 1, null, { timeout: 20000 });
  await p.waitForFunction(() => window.__t2a.actCards > 0, null, { timeout: 30000 });
  await wait(1600);
  await shot('ten-t2a-act2');
  out.actText = await p.evaluate(() => document.querySelector('.capyui-done').innerText.replace(/\s+/g, ' '));
  ok(/ACT II/i.test(out.actText) && /IN GOOD COMPANY/i.test(out.actText), 'the act card: ' + out.actText);
  const acts = await p.evaluate(() => window.__t2a.acts);
  ok(acts.length === 1 && acts[0].act === 2, "'story:act' once, act 2: " + JSON.stringify(acts));
  ok(await p.evaluate(() => window.__capy.journeyAct()) === 2, 'journeyAct() is 2');
  await wait(7000);
  out.errors = h.errors.slice();

  // ---- 5. a reload plays nothing again; the atlas reads the story ---------
  await p.evaluate(() => { try { window.__capy.saveFlush && window.__capy.saveFlush(); } catch (e) {} });
  await wait(1500);
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => !!window.__capy && !!document.querySelector('.capyui-carry'));
  await p.evaluate(() => {
    window.__t2b = { acts: 0 };
    window.__capy.events.on('story:act', () => window.__t2b.acts++);
    window.__t2bT = setInterval(() => { const d = document.querySelector('.capyui-done');
      if (d && d.classList.contains('show') && d.classList.contains('act')) window.__t2b.actCard = true; }, 100);
  });
  await p.evaluate(() => document.querySelector('.capyui-carry').click());
  await p.waitForFunction(() => window.__capy.state.started === true);
  await wait(12000);
  ok(await p.evaluate(() => window.__t2b.acts === 0 && !window.__t2b.actCard), 'no act card on reload');
  ok(await p.evaluate(() => window.__capy.journeyAct()) === 2, 'the file is still in act II');
  await p.evaluate(() => sessionStorage.setItem('capy3.pick', '1'));
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => !!window.__capy && !!document.querySelector('.capyui-carry'));
  await p.locator('.capyui-card.two').waitFor();
  await wait(1500);
  out.atlas = await p.evaluate(() => {
    const se = document.scrollingElement;
    const hero = document.querySelector('.capyui-pick.hero.compact');
    return { scrollH: se.scrollHeight, clientH: se.clientHeight, bodyH: document.body.scrollHeight,
      innerH: innerHeight, hero: hero ? hero.innerText.replace(/\s+/g, ' ') : '' };
  });
  await shot('ten-t2a-atlas');
  ok(!/\/\s*\d+|things to do/.test(out.atlas.hero) && /remembered/.test(out.atlas.hero), 'the Sydney tile counts memories: ' + out.atlas.hero);
  ok(out.atlas.scrollH <= out.atlas.clientH, 'the atlas does not scroll: ' + out.atlas.scrollH + ' vs ' + out.atlas.clientH);
  ok(h.errors.length === 0, 'no runtime errors (' + h.errors.length + ')');
  out.pass = true;
} catch (e) {
  out.fail = String(e.message || e);
  out.errors = h.errors.slice();
  console.log('FAIL ' + out.fail);
  process.exitCode = 1;
} finally {
  out.checks = checks;
  writeFileSync(new URL('./ten-t2a-story.json.png', import.meta.url), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
  await h.close();
}
