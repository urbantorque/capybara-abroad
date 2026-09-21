// C2: a cold summon and held-key pickup, no seeded tasks or body teleport.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const tag = process.argv[2] || 'repeat';
const flap = process.argv.includes('--flap');
const steer = process.argv.includes('--steer');
assert.ok(/^[\w.-]+$/.test(tag));
const h = await openHarness(), name = 'reimagine-boarding-pasto-' + tag;
try {
  await h.start(); await h.arrive('pasto');
  await h.page.evaluate(() => {
    const g = window.__capy;
    window.__board = { keys: [], rows: [], edges: [], contacts: [] };
    const vector = v => [v.x, v.y, v.z];
    const physical = () => ({ state: g.condor.state, t: g.state.time, wall: performance.now(),
      bird: vector(g.condor.body.position), velocity: vector(g.condor.body.velocity),
      force: vector(g.condor.body.force), quaternion: g.condor.body.quaternion.toArray(),
      capy: vector(g.capy.body.position), capyVelocity: vector(g.capy.body.velocity),
      input: { x:g.input.x, z:g.input.z, camYaw:g.input.camYaw,
        honkPressed:g.input.honkPressed, actionPressed:g.input.actionPressed } });
    // Read actual solver contacts. A sampled velocity jump alone cannot name
    // an obstacle or distinguish the wing from the hanging passenger.
    const contacts = [g.condor.body, g.capy.body].map((self, index) => {
      const onContact = event => {
        if (!g.condor.mounted || window.__board.contacts.length >= 256) return;
        const c=event.contact, other=event.body;
        window.__board.contacts.push({ self:index ? 'capy' : 'condor', t:g.state.time,
          wall:performance.now(), physical:physical(), other:{ id:other.id, mass:other.mass,
            position:vector(other.position),velocity:vector(other.velocity),quaternion:other.quaternion.toArray(),
            collisionGroup:other.collisionFilterGroup,collisionMask:other.collisionFilterMask,
            shapes:other.shapes.map((s,i)=>({type:s.type,radius:s.radius,
              halfExtents:s.halfExtents?vector(s.halfExtents):null,
              offset:vector(other.shapeOffsets[i]),orientation:other.shapeOrientations[i].toArray()})) },
          enabled:c.enabled,bi:c.bi.id,bj:c.bj.id,ni:vector(c.ni),ri:vector(c.ri),rj:vector(c.rj),
          impact:c.getImpactVelocityAlongNormal() });
      };
      self.addEventListener('collide',onContact);
      return {self,onContact};
    });
    const raw = g.condor.update;
    const wrapper = function (...args) {
      const before = physical();
      const result = raw.apply(this, args);
      if (before.state !== g.condor.state) window.__board.edges.push({ before, after: physical() });
      return result;
    };
    g.condor.update = wrapper;
    const keydown = e => {
      window.__board.keys.push({ type: 'keydown', key: e.code, trusted: e.isTrusted, t: g.state.time });
    };
    const keyup = e => {
      window.__board.keys.push({ type: 'keyup', key: e.code, trusted: e.isTrusted, t: g.state.time });
    };
    // Keep the exact listener identities so cleanup cannot leak observers.
    document.addEventListener('keydown', keydown);
    document.addEventListener('keyup', keyup);
    const timer = setInterval(() => {
      const c = g.condor, p = g.capy.position;
      window.__board.rows.push({ t: g.state.time, wall: performance.now(), ac: g.hud.audioBus().ac?.state,
        hidden: document.hidden, paused: g.state.paused, state: c.state,
        mounted: c.mounted, reach: c.talonInReach(), action: g.input.action,
        pressed: g.input.actionPressed, position: [p.x, p.y, p.z], physical: physical(),
        summoned: g.taskDone('whistle-condor'), ridden: g.taskDone('condor-ride') });
    }, 100);
    window.__boardTimer = timer;
    window.__boardObserver = { raw, wrapper, timer, keydown, keyup };
    window.__boardCleanup = () => {
      const observer = window.__boardObserver;
      if (!observer) return { restored: false, removed: false, timerCleared: false, repeated: true };
      if (observer.cleaned) return { restored: g.condor.update === observer.raw,
        removed: false, timerCleared: true, repeated: true };
      const owned = g.condor.update === observer.wrapper;
      if (owned) g.condor.update = observer.raw;
      document.removeEventListener('keydown', observer.keydown);
      document.removeEventListener('keyup', observer.keyup);
      clearInterval(observer.timer);
      for (const {self,onContact} of contacts) self.removeEventListener('collide',onContact);
      window.__boardTimer = null;
      observer.cleaned = true;
      return { restored: owned && g.condor.update === observer.raw, owned,
        removed: true, timerCleared: true, repeated: false };
    };
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
  if (steer) {
    // Follow a broad turn instead of flying straight into the map fence.
    // Only trusted direction/voice keys; velocity and camera yaw are read-only.
    const start = Date.now(), held = new Set(); let flappedAt = start;
    const heading = await h.page.evaluate(() => {
      const v = window.__capy.condor.body.velocity; return Math.atan2(v.x, v.z);
    });
    try {
      while (Date.now() - start < 30000 && !await h.page.evaluate(() => window.__capy.taskDone('condor-ride'))) {
        assert.equal(await h.page.evaluate(() => window.__capy.condor.mounted), true, 'steered signature remains mounted');
        const yaw = await h.page.evaluate(() => window.__capy.input.camYaw);
        const a = heading + (Date.now() - start) / 1000 * .25;
        const dx = Math.sin(a), dz = Math.cos(a);
        const x = dx * Math.cos(yaw) - dz * Math.sin(yaw), z = dx * Math.sin(yaw) + dz * Math.cos(yaw);
        const want = new Set();
        if (Math.abs(x) > Math.abs(z) * .42) want.add(x > 0 ? 'd' : 'a');
        if (Math.abs(z) > Math.abs(x) * .42) want.add(z > 0 ? 's' : 'w');
        for (const k of [...held]) if (!want.has(k)) { await h.page.keyboard.up(k); held.delete(k); }
        for (const k of want) if (!held.has(k)) { await h.page.keyboard.down(k); held.add(k); }
        if (Date.now() - flappedAt >= 1500) { await h.page.keyboard.press('q'); flappedAt = Date.now(); }
        await h.page.waitForTimeout(140);
      }
    } finally { for (const k of held) await h.page.keyboard.up(k); }
  } else if (flap) {
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
  const report = await h.page.evaluate(() => window.__board);
  const cleanup = await h.page.evaluate(() => window.__boardCleanup());
  assert.equal(cleanup.restored, true, 'observer cleanup restored condor.update');
  const boarded = report.rows.find(r => r.mounted);
  assert.ok(boarded?.action && !boarded.pressed, 'pickup occurred from held action, not a second press');
  assert.ok(report.keys.every(k => k.trusted), 'all input trusted');
  assert.ok(report.rows.every(r => !r.hidden && !r.paused), 'visible unpaused real clock');
  assert.deepEqual(h.metadata.errors, []);
  await h.result(name, { metadata: h.metadata, ...report, cleanup,
    steer, scope: 'Natural Pasto summon/pickup/signature/release; optional broad turn uses real camera-relative direction keys. Not a complete chapter or full route.' });
  console.log(JSON.stringify({ firstMount: boarded, end: report.rows.at(-1), keys: report.keys, errors: h.metadata.errors }, null, 2));
} catch (error) {
  try { await h.screenshot(name + '-failure'); } catch {}
  let report = {};
  try { report = await h.page.evaluate(() => { const out = window.__board || {}; window.__boardCleanup?.(); return out; }); } catch {}
  await h.result(name + '-failure', { metadata: h.metadata, ...report, failure: String(error.stack || error) });
  throw error;
} finally {
  try { await h.page.evaluate(() => window.__boardCleanup?.()); } catch {}
  await h.close();
}
