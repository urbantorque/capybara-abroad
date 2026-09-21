// REIMAGINE B: real startup/restore and seeded ordinary-route homecoming.
// This is a regression fixture, not evidence of a natural full playthrough.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { openHarness } from './reimagine-harness.mjs';

const s = readFileSync('src/shared.js', 'utf8');
const data = vm.runInNewContext(s.slice(s.indexOf('export const TASKS ='), s.indexOf('// RECORDS —'))
  .replace(/^export /gm, '') + '\n({CHAPTERS,JOURNEY,CHAPTER_EXPERIENCES})');
const tasks = data.JOURNEY.flatMap(n => {
  const e = data.CHAPTER_EXPERIENCES[n];
  return [e.signature, ...e.supports.slice(0, 2)];
});
const lastMemoryTask = data.CHAPTER_EXPERIENCES[1].supports[1];
const h = await openHarness();
const out = { metadata: h.metadata, seededTasks: tasks };
try {
  await h.start();
  out.fresh = await h.page.evaluate(() => window.__capy.gateInfo());
  assert.equal(out.fresh.filter(c => c.open).length, 19);
  assert.equal(out.fresh.find(c => c.recommended).n, 3);
  await h.screenshot('reimagine-route-opening');
  // Seed the new route only, without completing any entire chapter.
  await h.page.evaluate(({ tasks, journey }) => {
    localStorage.setItem('capy3.journey.v1', JSON.stringify({ v: 1, tasks, seen: journey,
      biome: 'sydney', tut: 1, ms: 1200000, nb: {
        3: { d: '21 Sep', f: { met: 1 } }, 19: { d: '21 Sep', f: { met: 1 } },
      } }));
  }, { tasks: tasks.filter(id => id !== lastMemoryTask), journey: data.JOURNEY });
  await h.page.reload(); await h.start();
  await h.page.waitForTimeout(3000);
  out.beforeLast = await h.page.evaluate(() => ({ finale: !!window.__capy.state.finaleOn,
    held: window.__capy.shelfAudit().keep }));
  assert.equal(out.beforeLast.finale, false);
  assert.equal(out.beforeLast.held, 6);
  // Exercise the shipped completion event while already home, rather than
  // allowing startup alone to stand in for the final-memory edge.
  assert.equal(await h.page.evaluate(id => window.__capy.hud.completeTask(id), lastMemoryTask), true);
  await h.page.waitForFunction(() => window.__capy.state.finaleOn);
  out.route = await h.page.evaluate(() => {
    const g = window.__capy;
    return { gates: g.gateInfo(), shelf: g.shelfAudit(), met: g.travMet(),
      keeps: g.props.filter(p => p.keep && !p.removed).map(p => ({ name: p.keep,
        position: { x: p.body.position.x, y: p.body.position.y, z: p.body.position.z } })) };
  });
  assert.equal(out.route.gates.filter(c => c.complete).length, 0);
  assert.equal(out.route.shelf.keep, 7);
  assert.equal(out.route.keeps.length, 6);
  assert.equal(out.route.keeps.some(p => p.name === 'pantanal'), false);
  assert.equal(out.route.met, 2, 'saved acquaintance restored without visiting again');
  await h.page.evaluate(() => {
    const c = window.__capy.capy;
    c.body.position.set(30, .8, 26); c.body.velocity.set(0, 0, 0);
    c.body.angularVelocity.set(0, 0, 0); c.body.wakeUp();
  });
  // Re-enter ordinary locomotion after the fixture relocation. Real players
  // walk onto the lawn; a stationary solver teleport is not that approach.
  await h.hold('w', 160);
  await h.page.bringToFront();
  out.settleStart = await h.page.evaluate(() => ({ wall: performance.now(), game: window.__capy.state.time,
    rest: window.__capy.capy.restT, focus: document.hasFocus(), hidden: document.hidden }));
  await h.page.waitForFunction(() => window.__capy.hud.codaAudit().running, null, { timeout: 120000 });
  out.settleEnd = await h.page.evaluate(() => ({ wall: performance.now(), game: window.__capy.state.time,
    rest: window.__capy.capy.restT, focus: document.hasFocus(), hidden: document.hidden }));
  await h.page.waitForTimeout(2200);
  await h.screenshot('reimagine-route-coda');
  await h.page.waitForFunction(() => document.querySelector('.capyui-led.show'), null, { timeout: 30000 });
  await h.page.waitForTimeout(1200);
  await h.screenshot('reimagine-route-ledger');
  out.ending = await h.page.evaluate(() => {
    window.dispatchEvent(new Event('pagehide'));
    return { coda: window.__capy.hud.codaAudit(),
      title: document.querySelector('.capyui-led h2').textContent,
      notebook: window.__capy.notebook(),
      save: JSON.parse(localStorage.getItem('capy3.journey.v1')) };
  });
  assert.equal(out.ending.save.fin, 1);
  assert.equal(out.ending.title, 'BACK WHERE IT BEGAN');
  assert.equal(out.ending.coda.notes, 20);
  assert.equal(out.ending.coda.whole, true);
  assert.equal(/nineteen/i.test(out.ending.notebook.fin), false);
  assert.equal(h.metadata.errors.length, 0);
  await h.result('reimagine-route-browser', out);
  console.log(JSON.stringify({ open: 19, seededTasks: tasks.length, keeps: out.route.shelf.keep,
    physicalKeeps: out.route.keeps.length, restoredMeetings: out.route.met,
    ending: out.ending.coda, errors: h.metadata.errors }, null, 2));
} catch (error) {
  out.error = String(error.stack || error);
  out.failureState = await h.page.evaluate(() => {
    const g = window.__capy, c = g.capy;
    return { position: { x: c.body.position.x, y: c.body.position.y, z: c.body.position.z },
      velocity: { x: c.body.velocity.x, y: c.body.velocity.y, z: c.body.velocity.z },
      loaf: c.loaf, restT: c.restT, grounded: c.grounded, swimming: c.swimming,
      climbing: c.climbing, carried: !!c.carriedBy, helm: c.atHelm, input: g.input,
      wall: performance.now(), gameTime: g.state.time, focus: document.hasFocus(), hidden: document.hidden,
      finale: g.state.finaleOn, coda: g.hud.codaAudit(), errors: g.state.lastError };
  });
  await h.screenshot('reimagine-route-failure');
  await h.result('reimagine-route-browser', out);
  throw error;
} finally { await h.close(); }
