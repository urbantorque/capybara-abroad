// REIMAGINE G: earn Sydney's route memory with real keys, no seeded tasks.
// Read-only coordinates steer the driver; bodies, clocks and input state are
// never assigned. A stuck waypoint fails rather than teleporting past it.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';

const h = await openHarness(), name = 'reimagine-natural-sydney';
const report = { metadata: h.metadata, steps: [], navigation: [], keys: [] };
const keys = new Set();
async function release() {
  for (const key of keys) await h.page.keyboard.up(key);
  keys.clear();
}
async function sample(label) {
  const s = await h.page.evaluate(label => {
    const g = window.__capy;
    return { label, t: g.state.time, wall: performance.now(),
      pos: g.capy.position.toArray(), held: g.capy.heldProp?.type || null,
      stage: g.env.concertAudit(), hidden: document.hidden, paused: g.state.paused,
      tasks: Object.fromEntries(['opera-stage', 'picnic-thief', 'swim'].map(id => [id, g.taskDone(id)])) };
  }, label);
  report.steps.push(s); return s;
}
async function go(target, radius = 1.1, maxMs = 35000, run = false) {
  const start = Date.now(); let best = Infinity, progressAt = Date.now(), jumps = 0;
  try {
    while (Date.now() - start < maxMs) {
      const s = await h.page.evaluate(target => {
        const g = window.__capy, p = g.capy.position;
        const q = typeof target === 'string' ? g.hintTarget(target) : target;
        return { p: p.toArray(), target: q, yaw: g.input.camYaw, t: g.state.time,
          carried: g.capy.carriedBy?.kind || null, velocity:g.capy.body.velocity.toArray() };
      }, target);
      assert.ok(s.target, 'actual waypoint exists: ' + target);
      const dx = s.target.x - s.p[0], dz = s.target.z - s.p[2], d = Math.hypot(dx, dz);
      report.navigation.push({ ...s, distance: d });
      if (d < radius) return;
      if (d < best - .35) { best = d; progressAt = Date.now(); }
      const x = dx * Math.cos(s.yaw) - dz * Math.sin(s.yaw);
      const z = dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw);
      const want = new Set();
      if (run) want.add('Shift');
      if (Math.abs(x) > Math.abs(z) * .42) want.add(x > 0 ? 'd' : 'a');
      if (Math.abs(z) > Math.abs(x) * .42) want.add(z > 0 ? 's' : 'w');
      for (const k of [...keys]) if (!want.has(k)) { await h.page.keyboard.up(k); keys.delete(k); }
      for (const k of want) if (!keys.has(k)) { await h.page.keyboard.down(k); keys.add(k); }
      if (Date.now() - progressAt > 3500) {
        assert.ok(jumps < 2, 'navigation stuck, no teleport: ' + JSON.stringify(s));
        await h.page.keyboard.press('Space'); jumps++; progressAt = Date.now();
      }
      await h.page.waitForTimeout(160);
    }
    throw new Error('waypoint timed out: ' + JSON.stringify(target));
  } finally { await release(); }
}
try {
  await h.page.evaluate(() => {
    window.__naturalKeys = [];
    for (const type of ['keydown', 'keyup']) document.addEventListener(type, e =>
      window.__naturalKeys.push({ type, key: e.code, trusted: e.isTrusted, t: window.__capy.state.time }));
  });
  await h.start(); await sample('fresh start');
  await go('opera-stage', .7);
  for (let i = 0; i < 3; i++) { await h.page.keyboard.press('q'); await h.page.waitForTimeout(1200); }
  await h.page.waitForFunction(() => window.__capy.taskDone('opera-stage'), null, { timeout: 30000 });
  await sample('natural stage'); await h.screenshot(name + '-stage');
  // The eastern hedge starts at z14. Walk around its harbour end rather
  // than treating a straight arrow as a path through a solid garden hedge.
  await go({ x: 12, z: 10 }); await go({ x: 30, z: 10 });
  await go('picnic-thief', .7, 35000, true);
  await h.page.keyboard.press('e');
  await h.page.waitForTimeout(300);
  assert.equal((await sample('sandwich grabbed')).held, 'sandwich');
  await go({ x: 30, z: 10 }, 1.1, 35000, true); await go({ x: 12, z: 10 }, 1.1, 35000, true);
  await h.page.waitForFunction(() => window.__capy.taskDone('picnic-thief'), null, { timeout: 20000 });
  await sample('natural getaway');
  // Take the open western quay edge; the central arrow can lead into the
  // Opera House itself after a crowd nudge changes its nearest-edge x.
  await go({ x: -30, z: 10 }); await go({ x: -30, z: -14 }, 1.5);
  await h.page.waitForFunction(() => window.__capy.taskDone('swim'), null, { timeout: 12000 });
  const end = await sample('natural memory');
  assert.ok(Object.values(end.tasks).every(Boolean), 'signature plus two support actions earned');
  await h.screenshot(name + '-memory');
  report.keys = await h.page.evaluate(() => window.__naturalKeys);
  assert.ok(report.keys.every(k => k.trusted));
  await h.page.waitForFunction(() => {
    const save = JSON.parse(localStorage.getItem('capy3.journey.v1') || '{}');
    return ['opera-stage', 'picnic-thief', 'swim'].every(id => save.tasks?.includes(id));
  }, null, { timeout: 12000 });
  report.saved = await h.page.evaluate(() => ({
    tasks: JSON.parse(localStorage.getItem('capy3.journey.v1')).tasks,
    gates: window.__capy.gateInfo() }));
  assert.equal(report.saved.gates.find(g => g.n === 1).enough, true, 'Sydney route memory earned');
  assert.equal(report.saved.gates.find(g => g.recommended).n, 3, 'Quay recommended next');
  await h.page.reload(); await h.start();
  const resumed = await sample('earned save resumed');
  assert.ok(Object.values(resumed.tasks).every(Boolean), 'naturally earned actions survive reload');
  assert.equal(await h.page.evaluate(() => window.__capy.gateInfo(1).enough), true, 'memory survives reload');
  assert.ok(report.steps.every(s => !s.hidden && !s.paused));
  assert.deepEqual(h.metadata.errors, []);
  report.scope = 'Natural Sydney signature, theft, swim and save/reload from a fresh profile; scripted waypoint knowledge, no task/body/clock/input-state seeding.';
  await h.result(name, report);
  console.log(JSON.stringify({ steps: report.steps, errors: h.metadata.errors }, null, 2));
} catch (error) {
  await release(); await sample('failure');
  report.failure = String(error.stack || error);
  if (!report.keys.length) report.keys = await h.page.evaluate(() => window.__naturalKeys || []);
  await h.screenshot(name + '-failure'); await h.result(name + '-failure', report);
  throw error;
} finally { await h.close(); }
