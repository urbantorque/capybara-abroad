// REIMAGINE G: actual calls, herd travel and river crossing from fresh arrival.
// Read-only herd/hunt telemetry guides the driver; it is not novice proof.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { openHarness } from './reimagine-harness.mjs';

const source = readFileSync(new URL('../src/pantanal.js', import.meta.url), 'utf8');
const shared = readFileSync(new URL('../src/shared.js', import.meta.url), 'utf8');
const first = shared.indexOf('export const TASKS ='), last = shared.indexOf('// RECORDS —', first);
assert.ok(first >= 0 && last > first, 'authored route data exists');
const experience = vm.runInNewContext(shared.slice(first, last).replace(/^export /gm, '') + '\nCHAPTER_EXPERIENCES[15]');
const ids = [experience.signature, ...experience.supports.slice(0, 2)];
assert.equal(ids.join(','), 'the-crossing,the-locals,gather', 'this fixture exercises authored Pantanal route');
function object(name) {
  const match = source.match(new RegExp('const ' + name + ' = (\\{[^;]+\\});'));
  assert.ok(match, 'authored ' + name); return vm.runInNewContext('(' + match[1] + ')');
}
const river = object('panRIVER'), crossing = object('panCROSS');
const hear = Number(source.match(/const panHUNT_HEAR = ([\d.]+)/)?.[1]);
assert.ok(hear > 0, 'authored predator hearing radius exists');
const h = await openHarness(), name = 'reimagine-natural-pantanal';
const report = { metadata: h.metadata, authored: { ids, river, crossing, hear }, steps: [], navigation: [], calls: [], keys: [] };
const keys = new Set();
async function setKeys(want) {
  for (const k of [...keys]) if (!want.has(k)) { await h.page.keyboard.up(k); keys.delete(k); }
  for (const k of want) if (!keys.has(k)) { await h.page.keyboard.down(k); keys.add(k); }
}
const release = () => setKeys(new Set());
async function state() {
  return h.page.evaluate(ids => {
    const g = window.__capy, c = g.capy, pan = g.pantanal, target = pan?.herd();
    return { t: g.state.time, wall: performance.now(), hidden: document.hidden, paused: !!g.state.paused,
      chapter: g.biome.current, p: c.position.toArray(), yaw: g.input.camYaw,
      velocity: c.body.velocity.toArray(), grounded: !!c.grounded, swimming: !!c.swimming,
      carried: !!c.carriedBy, following: pan?.following(), crossing: pan?.crossing(),
      herd: target ? { x: target.x, y: target.y, z: target.z } : null,
      bank: pan?.bank, farBank: pan?.farBank, river: pan?.riverDebug(), hunt: pan?.huntDebug(),
      hint: g.hintTarget('the-crossing'), tasks: Object.fromEntries(ids.map(id => [id, g.taskDone(id)])),
      gate: g.gateInfo(15) };
  }, ids);
}
function live(s) {
  assert.equal(s.hidden, false, 'browser stays visible'); assert.equal(s.paused, false, 'game stays unpaused');
  assert.equal(s.chapter, 'pantanal', 'driver remains in Pantanal');
}
async function sample(label) {
  const s = { label, ...await state() }; report.steps.push(s);
  console.log(JSON.stringify({ label, t: s.t, p: s.p, following: s.following, tasks: s.tasks, memory: s.gate.enough }));
  return s;
}
function steer(s, target, radius = .5) {
  const dx = target.x - s.p[0], dz = target.z - s.p[2], want = new Set();
  if (Math.hypot(dx, dz) < radius) return want;
  const x = dx * Math.cos(s.yaw) - dz * Math.sin(s.yaw);
  const z = dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw);
  if (Math.abs(x) > Math.abs(z) * .42) want.add(x > 0 ? 'd' : 'a');
  if (Math.abs(z) > Math.abs(x) * .42) want.add(z > 0 ? 's' : 'w');
  return want;
}
async function call(reason) {
  const before = await state(); live(before);
  await h.page.keyboard.press('q'); await h.page.waitForTimeout(750);
  const after = await state(); live(after);
  report.calls.push({ reason, before, after });
}
async function detour(target) {
  // pan.navBlocked means water, not geometry. Probe actual colliders across
  // a short three-ray body-width corridor; no body or ray fixture is added.
  return h.page.evaluate(target => {
    const g = window.__capy, p = g.capy.body.position, V = p.constructor;
    const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz) || 1;
    const candidates = [];
    for (const side of [1, -1]) {
      const q = { x: p.x - dx / d + -dz / d * 4 * side, z: p.z - dz / d + dx / d * 4 * side };
      const vx = q.x - p.x, vz = q.z - p.z, len = Math.hypot(vx, vz), hits = [];
      for (const offset of [-.4, 0, .4]) {
        const ox = -vz / len * offset, oz = vx / len * offset;
        g.world.raycastAll(new V(p.x + ox, p.y + .35, p.z + oz),
          new V(q.x + ox, p.y + .35, q.z + oz), { skipBackfaces: true }, hit => {
            if (hit.hasHit && hit.body !== g.capy.body && hit.body.collisionResponse !== false)
              hits.push({ body: hit.body.id, distance: hit.distance });
          });
      }
      candidates.push({ target: q, hits, ground: g.pantanal.terrainHeight(q.x, q.z) });
    }
    return { candidates, chosen: candidates.find(q => !q.hits.length && q.ground < p.y + .8)?.target || null };
  }, target);
}
async function walkTo(target, radius = 1.3, maxMs = 50000, detours = 2) {
  const start = Date.now(); let best = Infinity, progressAt = start;
  try {
    while (Date.now() - start < maxMs) {
      const s = await state(); live(s);
      const q = target === 'herd' ? s.herd : target;
      assert.ok(q, 'actual target available');
      const distance = Math.hypot(q.x - s.p[0], q.z - s.p[2]);
      report.navigation.push({ phase: 'walk', target: q, distance, ...s });
      if (distance < radius) return;
      if (distance < best - .3) { best = distance; progressAt = Date.now(); }
      if (Date.now() - progressAt > 4500) {
        assert.ok(detours-- > 0, 'bounded walking stalled: ' + JSON.stringify(s.p));
        await release(); const option = await detour(q); report.navigation.push({ phase: 'collider detour', ...option });
        assert.ok(option.chosen, 'both physical detour corridors blocked');
        await walkTo(option.chosen, 1, 13000, 0); best = Infinity; progressAt = Date.now();
      }
      await setKeys(steer(s, q, radius * .6)); await h.page.waitForTimeout(140);
    }
    throw new Error('walk timed out: ' + JSON.stringify(target));
  } finally { await release(); }
}
async function gather() {
  await walkTo('herd', 3.7, 35000);
  await h.page.waitForFunction(() => window.__capy.taskDone('the-locals'), null, { timeout: 5000 });
  await sample('met the herd');
  for (let attempt = 0; attempt < 12; attempt++) {
    const s = await state(); live(s);
    if (s.following >= 5 && s.tasks.gather) return;
    if (Math.hypot(s.herd.x - s.p[0], s.herd.z - s.p[2]) > 11) await walkTo('herd', 8, 25000);
    await call('recruit nearest grazer');
  }
  throw new Error('twelve actual calls did not gather five followers');
}
async function catchUp() {
  await release(); const start = Date.now(); let stableAt = null;
  while (Date.now() - start < 18000) {
    const s = await state(); live(s); report.navigation.push({ phase: 'follower catch-up', ...s });
    assert.ok(s.following >= 5, 'five followers retained before crossing');
    if (s.river.maxOffTrail < 1.5) {
      if (stableAt === null) stableAt = s.t;
      if (s.t - stableAt > 1) return s;
    } else stableAt = null;
    await h.page.waitForTimeout(250);
  }
  throw new Error('followers did not catch their actual trail before water');
}
async function riverLeg(target, defend = false, maxMs = 60000) {
  const start = Date.now(); let lastCall = -99, captured = false;
  try {
    while (Date.now() - start < maxMs) {
      const s = await state(); live(s);
      report.navigation.push({ phase: defend ? 'midriver defence' : 'river travel', target, ...s });
      assert.ok(s.following >= 4, 'at least four live followers retained');
      if (s.tasks['the-crossing']) return;
      const distance = Math.hypot(target.x - s.p[0], target.z - s.p[2]);
      if (defend && s.hunt.beaten) return;
      if (!defend && distance < 1) return;
      // Short lookahead corrects current drift before it becomes a wide
      // diagonal. Stop near mid-channel while the entire line enters.
      const q = { x: target.x, z: s.p[2] + Math.max(-3, Math.min(3, target.z - s.p[2])) };
      await setKeys(steer(s, q, .65));
      if (s.hunt.on && !captured) { captured = true; await h.screenshot(name + '-predator'); }
      if (s.hunt.on && s.hunt.under <= 0 && Math.hypot(s.hunt.hx - s.p[0], s.hunt.hz - s.p[2]) < hear - .4 && s.t - lastCall > .75) {
        await h.page.keyboard.press('q'); lastCall = s.t;
        report.calls.push({ reason: 'protect the tail', before: s });
      }
      await h.page.waitForTimeout(140);
    }
    throw new Error(defend ? 'natural three-round predator defence timed out' : 'river leg timed out');
  } finally { await release(); }
}
try {
  await h.page.evaluate(() => {
    window.__naturalKeys = [];
    for (const type of ['keydown', 'keyup']) document.addEventListener(type, e =>
      window.__naturalKeys.push({ type, key: e.code, trusted: e.isTrusted, t: window.__capy.state.time }));
  });
  await h.start(); await h.arrive('pantanal');
  const arrival = await sample('fresh Pantanal arrival'); live(arrival);
  assert.ok(ids.every(id => !arrival.tasks[id]), 'all route actions start unearned');
  await gather(); await sample('five recruited'); await h.screenshot(name + '-gather');
  // Approach the crossing west of the road. Stage outside the broad river
  // slope so followers settle before the public near-bank destination.
  await walkTo({ x: crossing.x, z: 0 });
  await walkTo({ x: crossing.x, z: river.z1 + 12 });
  report.catchUp = await catchUp(); assert.equal(report.catchUp.swimming, false, 'catch-up occurred before player swimming');
  const bank = (await state()).bank; await walkTo(bank, 1.2, 18000);
  await sample('near bank with settled line'); await h.screenshot(name + '-bank');
  await riverLeg({ x: crossing.x, z: (river.z0 + river.z1) * .5 - 2 }, true);
  const defended = await sample('three real calls repelled the hunter');
  assert.ok(defended.hunt.beaten && defended.hunt.hits === 3, 'actual hunter took three successful wheeks');
  await riverLeg((await state()).farBank, false, 35000);
  await h.page.waitForFunction(() => window.__capy.taskDone('the-crossing'), null, { timeout: 6000 });
  const end = await sample('natural Pantanal memory'); await h.screenshot(name + '-memory');
  assert.ok(ids.every(id => end.tasks[id]) && end.gate.enough, 'signature plus two supports earned');
  assert.ok(end.p[2] < river.z0 - 1 && end.following >= 4, 'far-edge award threshold with at least four current followers');
  assert.ok(report.navigation.some(s => s.hunt?.crossT > .5), 'real crossing time observed');
  await h.page.waitForFunction(ids => {
    const saved = JSON.parse(localStorage.getItem('capy3.journey.v1') || '{}');
    return ids.every(id => saved.tasks?.includes(id));
  }, ids, { timeout: 12000 });
  report.saved = await h.page.evaluate(() => JSON.parse(localStorage.getItem('capy3.journey.v1')));
  report.keys = await h.page.evaluate(() => window.__naturalKeys);
  assert.ok(report.keys.some(k => k.key === 'KeyQ') && report.keys.every(k => k.trusted), 'all herd/defence controls trusted');
  await h.page.reload(); await h.start();
  const resumed = await sample('earned Pantanal memory resumed');
  assert.ok(ids.every(id => resumed.tasks[id]) && resumed.gate.enough, 'route memory survives reload');
  assert.ok(report.steps.every(s => !s.hidden && !s.paused)); assert.deepEqual(h.metadata.errors, []);
  report.scope = 'Fresh HUD chapter-arrival fixture, then real-key meeting/recruitment, follower catch-up, river crossing and three-round defence. Public moving-target/hunt telemetry and physics-ray detours assist navigation, not novice discoverability proof. No task/body/clock/input-state/animal-state writes or debug-force APIs. Shipped completion uses peak follower count; this test additionally requires four current followers at the far-edge award threshold. It does not require every animal to be ashore.';
  await h.result(name, report);
  console.log(JSON.stringify({ pass: true, navigationSamples: report.navigation.length, calls: report.calls.length, errors: h.metadata.errors }));
} catch (error) {
  await release(); report.failure = String(error.stack || error);
  try { await sample('failure'); } catch {}
  try { report.keys = await h.page.evaluate(() => window.__naturalKeys || []); } catch {}
  try { await h.screenshot(name + '-failure'); } catch {}
  await h.result(name + '-failure', report); throw error;
} finally { await h.close(); }
