// C2: a cold summon and held-key pickup, no seeded tasks or body teleport.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const tag = process.argv[2] || 'repeat';
const flap = process.argv.includes('--flap');
assert.ok(/^[\w.-]+$/.test(tag));
const h = await openHarness(), name = 'reimagine-boarding-pasto-' + tag;
try {
  await h.start(); await h.arrive('pasto');
  await h.page.evaluate(() => {
    const g = window.__capy;
    window.__board = { keys: [], rows: [], edges: [] };
    const vector = v => [v.x, v.y, v.z];
    const physical = () => ({ state: g.condor.state, t: g.state.time, wall: performance.now(),
      bird: vector(g.condor.body.position), velocity: vector(g.condor.body.velocity),
      force: vector(g.condor.body.force), quaternion: g.condor.body.quaternion.toArray(),
      capy: vector(g.capy.body.position), capyVelocity: vector(g.capy.body.velocity) });
    const raw = g.condor.update;
    g.condor.update = function (...args) {
      const before = physical();
      const result = raw.apply(this, args);
      if (before.state !== g.condor.state) window.__board.edges.push({ before, after: physical() });
      return result;
    };
    for (const type of ['keydown', 'keyup']) document.addEventListener(type, e => {
      window.__board.keys.push({ type, key: e.code, trusted: e.isTrusted, t: g.state.time });
    });
    window.__boardTimer = setInterval(() => {
      const c = g.condor, p = g.capy.position;
      window.__board.rows.push({ t: g.state.time, wall: performance.now(), ac: g.hud.audioBus().ac?.state,
        hidden: document.hidden, paused: g.state.paused, state: c.state,
        mounted: c.mounted, reach: c.talonInReach(), action: g.input.action,
        pressed: g.input.actionPressed, position: [p.x, p.y, p.z], physical: physical(),
        summoned: g.taskDone('whistle-condor'), ridden: g.taskDone('condor-ride') });
    }, 100);
  });
  await h.page.keyboard.press('q');
  console.log('summoned');
  await h.page.waitForFunction(() => window.__capy.condor.state === 'circling', null, { timeout: 60000 });
  assert.equal(await h.page.evaluate(() => window.__capy.condor.talonInReach()), false, 'first orbit still out of reach');
  await h.page.keyboard.press('q');
  await h.page.keyboard.down('e');
  await h.page.waitForFunction(() => window.__capy.condor.mounted, null, { timeout: 60000 });
  await h.page.waitForTimeout(500);
  console.log('boarded from held E');
  await h.page.keyboard.up('e');
  await h.screenshot(name + '-aboard');
  if (flap) {
    // Follow the on-screen wingbeat lesson with real repeated Q presses.
    for (let i = 0; i < 20 && !await h.page.evaluate(() => window.__capy.taskDone('condor-ride')); i++) {
      await h.page.waitForTimeout(1500); await h.page.keyboard.press('q');
    }
  } else await h.page.waitForFunction(() => window.__capy.taskDone('condor-ride'), null, { timeout: 30000 });
  assert.equal(await h.page.evaluate(() => window.__capy.taskDone('condor-ride')), true, 'twelve-second signature earned');
  assert.equal(await h.page.evaluate(() => window.__capy.condor.mounted), true, 'natural twelve-second signature ride');
  await h.screenshot(name + '-signature');
  await h.page.keyboard.down('e');
  await h.page.waitForTimeout(2200);
  assert.equal(await h.page.evaluate(() => window.__capy.condor.mounted), false, 'held dismount stays released');
  await h.page.keyboard.up('e');
  const report = await h.page.evaluate(() => { clearInterval(window.__boardTimer); return window.__board; });
  const boarded = report.rows.find(r => r.mounted);
  assert.ok(boarded?.action && !boarded.pressed, 'pickup occurred from held action, not a second press');
  assert.ok(report.keys.every(k => k.trusted), 'all input trusted');
  assert.ok(report.rows.every(r => !r.hidden && !r.paused), 'visible unpaused real clock');
  assert.deepEqual(h.metadata.errors, []);
  await h.result(name, { metadata: h.metadata, ...report,
    scope: 'Natural Pasto summon/pickup/signature/release; not a complete chapter or full route.' });
  console.log(JSON.stringify({ firstMount: boarded, end: report.rows.at(-1), keys: report.keys, errors: h.metadata.errors }, null, 2));
} catch (error) {
  await h.screenshot(name + '-failure');
  const report = await h.page.evaluate(() => { clearInterval(window.__boardTimer); return window.__board || {}; });
  await h.result(name + '-failure', { metadata: h.metadata, ...report, failure: String(error.stack || error) });
  throw error;
} finally { await h.close(); }
