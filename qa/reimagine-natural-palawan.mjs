// REIMAGINE G: fresh chapter arrival, then real keys through the jetty,
// dive and manta. Source constants guide navigation, never award a task.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { openHarness } from './reimagine-harness.mjs';

const source = readFileSync(new URL('../src/palawan.js', import.meta.url), 'utf8');
const jettyRow = source.match(/const palJETTY = (\{[^\n]+\});/);
assert.ok(jettyRow, 'authored jetty row exists');
const jetty = vm.runInNewContext('(' + jettyRow[1] + ')');
const reach = Number(source.match(/const palMANTA_REACH = ([\d.]+)/)?.[1]);
assert.ok(reach > 0, 'authored manta reach exists');
const systems = readFileSync(new URL('../src/systems.js', import.meta.url), 'utf8');
const cameraRate = Number(systems.match(/const sysCAM_KEY_RATE\s*=\s*([\d.]+)/)?.[1]);
assert.ok(cameraRate > 0, 'authored camera key rate exists');
const ids = ['jetty-jump', 'first-dive', 'the-manta'];
const name = 'reimagine-natural-palawan', h = await openHarness();
const report = { metadata: h.metadata, authored: { jetty, reach, cameraRate }, steps: [], navigation: [], keys: [] };
const keys = new Set();
async function setKeys(want) {
  for (const key of [...keys]) if (!want.has(key)) { await h.page.keyboard.up(key); keys.delete(key); }
  for (const key of want) if (!keys.has(key)) { await h.page.keyboard.down(key); keys.add(key); }
}
const release = () => setKeys(new Set());
const phase = label => h.page.evaluate(label => { window.__naturalPhase = label; }, label);
async function state() {
  return h.page.evaluate(ids => {
    const g = window.__capy, p = g.capy.position, pal = g.palawan;
    const manta = pal?.manta();
    return { t: g.state.time, wall: performance.now(), hidden: document.hidden, paused: !!g.state.paused,
      chapter: g.biome.current, p: p.toArray(), yaw: g.input.camYaw,
      depth: g.capy.depth || 0, diving: !!g.capy.diving, swimming: !!g.capy.swimming,
      grounded: !!g.capy.grounded, stamina: g.capy.stamina, carried: !!g.capy.carriedBy,
      velocity: g.capy.body.velocity.toArray(), manta: manta ? { x: manta.x, y: manta.y, z: manta.z } : null,
      locals: (g.locals || []).filter(r => r.biome === g.biome.current)
        .map(r => ({ role: r.role || null, x: r.x, y: r.y, z: r.z,
          distance: Math.hypot(r.x - p.x, r.z - p.z),
          visible: r.group?.visible, body: r.body ? { id: r.body.id, position: r.body.position.toArray() } : null }))
        .filter(r => r.distance < 8).sort((a, b) => a.distance - b.distance).slice(0, 4),
      audit: pal?.mantaAudit(), tasks: Object.fromEntries(ids.map(id => [id, g.taskDone(id)])), gate: g.gateInfo(12) };
  }, ids);
}
function running(s) {
  assert.equal(s.hidden, false, 'browser remains visible');
  assert.equal(s.paused, false, 'game remains unpaused');
  assert.equal(s.chapter, 'palawan', 'navigation remains in Palawan');
}
async function sample(label) {
  const s = { label, ...await state() }; report.steps.push(s);
  console.log(JSON.stringify({ label, t: s.t, p: s.p, tasks: s.tasks, memory: s.gate.enough }));
  return s;
}
function steering(s, target, radius = .5) {
  const dx = target.x - s.p[0], dz = target.z - s.p[2], want = new Set();
  if (Math.hypot(dx, dz) <= radius) return want;
  const x = dx * Math.cos(s.yaw) - dz * Math.sin(s.yaw);
  const z = dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw);
  if (Math.abs(x) > Math.abs(z) * .42) want.add(x > 0 ? 'd' : 'a');
  if (Math.abs(z) > Math.abs(x) * .42) want.add(z > 0 ? 's' : 'w');
  return want;
}
async function walkTo(target, radius = .8, maxMs = 28000) {
  const started = Date.now(); let best = Infinity, progressAt = started;
  try {
    while (Date.now() - started < maxMs) {
      const s = await state(); running(s);
      const d = Math.hypot(target.x - s.p[0], target.z - s.p[2]);
      report.navigation.push({ phase: 'walk', target, distance: d, ...s });
      if (d < radius) return;
      if (d < best - .25) { best = d; progressAt = Date.now(); }
      assert.ok(Date.now() - progressAt < 6000, 'walk stuck: ' + JSON.stringify(s));
      await setKeys(steering(s, target, radius * .6)); await h.page.waitForTimeout(140);
    }
    throw new Error('walk timed out: ' + JSON.stringify(target));
  } finally { await release(); }
}
async function jumpOntoJetty() {
  await phase('jetty approach jump');
  await walkTo({ x: jetty.x, z: jetty.z1 + 4 }, .35);
  await alignJettyCamera(); await phase('jetty approach jump');
  await h.page.waitForTimeout(200);
  const started = Date.now(); let jumped = false;
  try {
    while (Date.now() - started < 10000) {
      const s = await state(); running(s);
      report.navigation.push({ phase: 'jetty approach jump', ...s });
      if (jumped && s.p[2] < jetty.z1 - .2 && s.p[1] > jetty.y + .2 && s.grounded) return;
      const want = steering(s, { x: jetty.x, z: jetty.z1 - .6 }, .3);
      if (!jumped && s.p[2] <= jetty.z1 + 3.6) {
        assert.ok(s.grounded && !s.swimming && s.p[2] > jetty.z1 + 1.2,
          'jump begins on sand before the raised deck lip: ' + JSON.stringify(s));
        want.add('Space'); await setKeys(want);
        await h.page.waitForTimeout(180); // actual held jump sustain
        want.delete('Space'); await setKeys(want); jumped = true;
      } else await setKeys(want);
      await h.page.waitForTimeout(90);
    }
    throw new Error('real jump did not land on the raised jetty');
  } finally { await release(); }
}
async function alignJettyCamera() {
  await release(); await phase('jetty camera alignment');
  // Z increases the target yaw; X decreases it. Pulse then let the actual
  // camera damper settle before measuring again, rather than writing yaw.
  for (let attempt = 0; attempt < 10; attempt++) {
    const s = await state(); running(s);
    const yaw = Math.atan2(Math.sin(s.yaw), Math.cos(s.yaw));
    report.navigation.push({ phase: 'jetty camera alignment', attempt, ...s });
    if (Math.abs(yaw) < .07) return;
    await setKeys(new Set([yaw > 0 ? 'x' : 'z']));
    await h.page.waitForTimeout(Math.max(12, Math.min(250, Math.abs(yaw) / cameraRate * 1000)));
    await release(); await h.page.waitForTimeout(350);
  }
  throw new Error('real Z/X keys did not align the jetty camera');
}
async function departJetty() {
  await alignJettyCamera(); await phase('jetty open corridor');
  let targetX = jetty.x + jetty.w * .5 - .4;
  const endZ = jetty.z0 - 2;
  const started = Date.now(); let bestZ = Infinity, progressAt = started, staged = false;
  try {
    while (Date.now() - started < 20000) {
      const s = await state(); running(s);
      // He shuffles across the deck, so use the actually open side rather
      // than assuming his authored anchor is his current collider position.
      const boatman = s.locals.find(r => r.body && Math.abs(r.x - jetty.x) < jetty.w * .5 && r.z < s.p[2] && s.p[2] - r.z < 7);
      if (boatman) targetX = jetty.x + (boatman.x > jetty.x ? -1 : 1) * (jetty.w * .5 - .4);
      report.navigation.push({ phase: 'jetty open corridor', targetX, staged, ...s });
      if (s.tasks['jetty-jump']) return;
      assert.ok(s.p[2] > endZ, 'left jetty without earning departure');
      // Stage sideways while still clear of the boatman. Velocity feedback
      // releases each short nudge before momentum takes it over the edge.
      const dx = targetX - (s.p[0] + s.velocity[0] * .13);
      if (!staged && Math.abs(targetX - s.p[0]) < .14 && Math.abs(s.velocity[0]) < .55) {
        staged = true; await release(); await alignJettyCamera();
        await phase('jetty open corridor'); progressAt = Date.now(); continue;
      }
      const yaw = Math.atan2(Math.sin(s.yaw), Math.cos(s.yaw));
      if (Math.abs(yaw) > .10) {
        await alignJettyCamera(); await phase('jetty open corridor'); continue;
      }
      const want = new Set();
      if (Math.abs(dx) > .12) want.add(dx > 0 ? 'd' : 'a');
      else if (staged) want.add('w');
      await setKeys(want);
      if (s.p[2] < bestZ - .2) { bestZ = s.p[2]; progressAt = Date.now(); }
      if (staged) assert.ok(Date.now() - progressAt < 6000, 'open corridor blocked: ' + JSON.stringify(s));
      await h.page.waitForTimeout(65);
    }
    throw new Error('precision jetty departure timed out');
  } finally { await release(); }
}
async function diveAndBoard(maxMs = 100000) {
  const started = Date.now(); let taps = 0, surfaced = false;
  try {
    while (Date.now() - started < maxMs) {
      const s = await state(); running(s); assert.ok(s.manta, 'live manta target exists');
      const horizontal = Math.hypot(s.manta.x - s.p[0], s.manta.z - s.p[2]);
      const distance = Math.hypot(horizontal, s.manta.y - s.p[1]);
      report.navigation.push({ phase: 'manta approach', distance, horizontal, ...s });
      if (s.audit.rideT >= 0) return { taps, boarded: s };
      const want = steering(s, s.manta, .7);
      // Swim on the surface until close. Recover breath with real key release;
      // no snorkel, skill or stamina upgrade is supplied by this fixture.
      if (s.stamina < .18) surfaced = true;
      if (surfaced && s.stamina > .92) surfaced = false;
      if (!surfaced && horizontal < 8 && s.p[1] > s.manta.y - 1.8) want.add('e');
      if (!surfaced && s.depth > .65 && distance < reach - .3) {
        want.delete('e'); await setKeys(want); await h.page.waitForTimeout(90);
        want.add('e'); await setKeys(want); taps++;
      } else await setKeys(want);
      await h.page.waitForTimeout(140);
    }
    throw new Error('manta boarding timed out after ' + taps + ' trusted grab attempts');
  } finally { await release(); }
}
try {
  await h.page.evaluate(() => {
    window.__naturalKeys = [];
    window.__naturalPhase = 'arrival';
    for (const type of ['keydown', 'keyup']) document.addEventListener(type, e =>
      window.__naturalKeys.push({ type, key: e.code, trusted: e.isTrusted,
        phase: window.__naturalPhase, t: window.__capy.state.time }));
  });
  await h.start(); await h.arrive('palawan');
  const arrival = await sample('fresh Palawan arrival'); running(arrival);
  assert.ok(ids.every(id => !arrival.tasks[id]), 'route actions start unearned');
  // The deck top is raised above the sand, without a ramp. Jump onto its
  // landward lip, then walk off the seaward end without another jump.
  await jumpOntoJetty();
  await phase('jetty departure');
  const deck = await sample('on the jetty');
  assert.ok(deck.p[1] > jetty.y - .3, 'walk actually reached raised deck');
  // Read both the boy and boatman, then take the open side of the deck.
  await departJetty();
  await h.page.waitForFunction(() => window.__capy.taskDone('jetty-jump'), null, { timeout: 3500 });
  await sample('jetty jump earned'); await h.screenshot(name + '-jetty');

  const reef = await h.page.evaluate(() => ({ ...window.__capy.palawan.reef }));
  await phase('reef dive');
  await walkTo(reef, 1.5);
  await setKeys(new Set(['e']));
  try {
    await h.page.waitForFunction(() => window.__capy.taskDone('first-dive'), null, { timeout: 10000 });
  } finally { await release(); }
  const dive = await sample('first dive earned'); running(dive);
  assert.ok(dive.depth > .65, 'first dive observed beneath the authored threshold');
  await h.screenshot(name + '-dive');
  await phase('manta approach');
  report.boarding = await diveAndBoard();
  await phase('manta ride');
  await sample('manta boarded with trusted E edge'); await h.screenshot(name + '-manta');
  const rideStart = Date.now();
  while (Date.now() - rideStart < 40000) {
    const s = await state(); running(s); report.navigation.push({ phase: 'manta ride', ...s });
    if (s.tasks['the-manta']) break;
    assert.ok(s.audit.rideT >= 0, 'ride ended before signature was earned');
    await h.page.waitForTimeout(200);
  }
  const end = await sample('natural Palawan memory'); await h.screenshot(name + '-memory');
  assert.ok(ids.every(id => end.tasks[id]), 'signature and both genuine support actions earned');
  assert.equal(end.gate.enough, true, 'Palawan route memory earned');
  assert.ok(end.audit.breached || end.audit.u >= .9, 'automatic breach, without a Space leap');
  await h.page.waitForFunction(ids => {
    const save = JSON.parse(localStorage.getItem('capy3.journey.v1') || '{}');
    return ids.every(id => save.tasks?.includes(id));
  }, ids, { timeout: 12000 });
  report.saved = await h.page.evaluate(() => ({
    tasks: JSON.parse(localStorage.getItem('capy3.journey.v1')).tasks, gate: window.__capy.gateInfo(12) }));
  report.keys = await h.page.evaluate(() => window.__naturalKeys);
  assert.ok(report.keys.length > 0 && report.keys.every(key => key.trusted), 'all recorded keys trusted');
  assert.ok(report.keys.some(key => key.key === 'Space' && key.type === 'keydown' && key.phase === 'jetty approach jump'),
    'raised jetty reached with a trusted jump');
  assert.ok(!report.keys.some(key => key.key === 'Space' &&
    (key.phase === 'manta ride' || key.t >= report.boarding.boarded.t)), 'no Space during the manta ride');
  await h.page.reload(); await h.start();
  const resumed = await sample('earned Palawan memory resumed');
  assert.ok(ids.every(id => resumed.tasks[id]) && resumed.gate.enough, 'saved route memory survives reload');
  report.board = await h.page.evaluate(() => window.__capy.exitBoard());
  assert.ok(report.board && report.board.x === 2 && report.board.z === 32, 'board is on the shore approach');
  assert.ok(report.board.y > -.1 && report.board.y < 1, 'board stands on beach floor, not the raised deck');
  await phase('earned departure');
  await walkTo({ x: report.board.x, z: report.board.z + 2.8 }, .35);
  await h.screenshot(name + '-shore-board');
  for (let n = 0; n < 3; n++) { await h.hold('q', 80); await h.page.waitForTimeout(220); }
  await h.page.waitForFunction(() => document.querySelector('.capyui-jr')?.classList.contains('show'), null, { timeout: 5000 });
  await h.screenshot(name + '-departure');
  report.departure = await h.page.evaluate(() => ({ bloom: window.__capy.palawan.seenBloom(),
    boardText: document.querySelector('.capyui-jr').textContent, position: window.__capy.capy.position.toArray() }));
  assert.ok(report.steps.every(row => !row.hidden && !row.paused));
  assert.deepEqual(h.metadata.errors, []);
  report.scope = 'HUD chapter-arrival fixture, then trusted jump onto the raised jetty, real Z/X camera alignment and open-side walking departure, dive, manta boarding/automatic breach and save/reload. Real walk and three Q presses open the relocated shore board. No Space during the manta ride; no task/body/clock/input-state seeding. Read-only moving-target and position telemetry assists navigation; this is not novice or unguided discoverability proof.';
  await h.result(name, report);
  console.log(JSON.stringify({ pass: true, navigationSamples: report.navigation.length, grabTaps: report.boarding.taps, errors: h.metadata.errors }));
} catch (error) {
  await release();
  try { await sample('failure'); } catch {}
  report.failure = String(error.stack || error);
  try { if (!report.keys.length) report.keys = await h.page.evaluate(() => window.__naturalKeys || []); } catch {}
  try { await h.screenshot(name + '-failure'); } catch {}
  await h.result(name + '-failure', report); throw error;
} finally { await h.close(); }
