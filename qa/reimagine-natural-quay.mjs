// REIMAGINE G: earn Quay's route memory with real keys, no seeded tasks,
// bodies, clocks or input state. Waypoints steer the live ferry; a stuck run
// fails rather than teleporting through the harbour.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';

const h = await openHarness(), name = 'reimagine-natural-quay';
const report = { metadata: h.metadata, steps: [], navigation: [], keys: [] };
const keys = new Set();
async function release() {
  for (const key of keys) await h.page.keyboard.up(key);
  keys.clear();
}
async function sample(label) {
  const row = await h.page.evaluate(label => {
    const g = window.__capy, q = g.quay && g.quay.boat;
    return { label, t: g.state.time, wall: performance.now(), hidden: document.hidden, paused: g.state.paused,
      pos: g.capy.position.toArray(), boat: q ? { pos: q.position.toArray(), speed: q.speed,
        heading: q.heading, atHelm: q.atHelm, throttle: q.throttle } : null,
      tasks: Object.fromEntries(['take-helm', 'to-quay', 'under-bridge', 'manly-voyage'].map(id => [id, g.taskDone(id)])),
      gate: g.gateInfo(3) };
  }, label);
  report.steps.push(row); return row;
}
async function walkTo(target, radius = 1.1, maxMs = 35000) {
  const started = Date.now(); let best = Infinity, progressAt = Date.now(), from = null;
  try {
    while (Date.now() - started < maxMs) {
      const s = await h.page.evaluate(target => {
        const g = window.__capy, p = g.capy.position, q = typeof target === 'string' ? g.hintTarget(target) : target;
        return { p: p.toArray(), target: q, yaw: g.input.camYaw, t: g.state.time };
      }, target);
      assert.ok(s.target, 'actual waypoint exists: ' + target);
      if(!from)from={x:s.p[0],z:s.p[2]};
      const d = Math.hypot(s.target.x-s.p[0],s.target.z-s.p[2]);
      // Eight keyboard directions need short lookahead, or a small heading
      // error drifts metres sideways over a long wharf approach.
      const sx=s.target.x-from.x,sz=s.target.z-from.z,len=Math.hypot(sx,sz);
      const along=len>0?Math.max(0,Math.min(len,((s.p[0]-from.x)*sx+(s.p[2]-from.z)*sz)/len)):0;
      const u=len>0?Math.min(1,(along+1)/len):1;
      const aim={x:from.x+sx*u,z:from.z+sz*u};
      const dx=aim.x-s.p[0],dz=aim.z-s.p[2];
      report.navigation.push({ mode:'walk',...s,aim,distance:d });
      if (d < radius) return;
      if (d < best - .35) { best = d; progressAt = Date.now(); }
      const x = dx * Math.cos(s.yaw) - dz * Math.sin(s.yaw);
      const z = dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw), want = new Set();
      if (Math.abs(x) > Math.abs(z) * .42) want.add(x > 0 ? 'd' : 'a');
      if (Math.abs(z) > Math.abs(x) * .42) want.add(z > 0 ? 's' : 'w');
      for (const k of [...keys]) if (!want.has(k)) { await h.page.keyboard.up(k); keys.delete(k); }
      for (const k of want) if (!keys.has(k)) { await h.page.keyboard.down(k); keys.add(k); }
      if (Date.now() - progressAt > 3500) throw new Error('walk stuck at ' + JSON.stringify(s));
      await h.page.waitForTimeout(80);
    }
    throw new Error('walk waypoint timed out: ' + target);
  } finally { await release(); }
}
async function sailTo(target, { final = false, radius = 12, maxMs = 70000 } = {}) {
  const started = Date.now(); let best = Infinity, progressAt = Date.now();
  try {
    while (Date.now() - started < maxMs) {
      const s = await h.page.evaluate(target => {
        const g = window.__capy, q = g.quay.boat, p = q.position;
        return { p: p.toArray(), yaw: q.heading, speed: q.speed, throttle: q.throttle, t: g.state.time };
      }, target);
      const dx = target.x - s.p[0], dz = target.z - s.p[2], d = Math.hypot(dx, dz);
      report.navigation.push({ target, ...s, distance: d });
      if (d < radius && (!final || Math.abs(s.speed) < 4.5)) return;
      if (d < best - 1.0) { best = d; progressAt = Date.now(); }
      // Boat forward=(sin(yaw),cos(yaw)); positive x input turns yaw down.
      // This cross product is positive when the target is to that right.
      const turn = Math.sin(s.yaw) * dz - Math.cos(s.yaw) * dx;
      let throttle = 'w';
      if (final) {
        if (d < 115 && s.speed > 4.5) throttle = 's';
        else if (d < 115 && d > 30 && s.speed < 3) throttle = 'w';
        else if (d < 115) throttle = null; // coast; never brake into reverse
      }
      const want = new Set(throttle ? [throttle] : []);
      if (Math.abs(turn) > Math.max(4, d * .08)) want.add(turn > 0 ? 'd' : 'a');
      for (const k of [...keys]) if (!want.has(k)) { await h.page.keyboard.up(k); keys.delete(k); }
      for (const k of want) if (!keys.has(k)) { await h.page.keyboard.down(k); keys.add(k); }
      if (Date.now() - progressAt > 7000) throw new Error('boat stuck at ' + JSON.stringify(s));
      await h.page.waitForTimeout(180);
    }
    throw new Error('boat waypoint timed out: ' + JSON.stringify(target));
  } finally { await release(); }
}
try {
  await h.page.evaluate(() => {
    window.__naturalKeys = [];
    for (const type of ['keydown', 'keyup']) document.addEventListener(type, e =>
      window.__naturalKeys.push({ type, key: e.code, trusted: e.isTrusted, t: window.__capy.state.time }));
  });
  await h.start(); await h.arrive('quay'); await sample('fresh Quay arrival');
  // Stay on the finger wharf, then cross the open forward gangway. A straight
  // line from spawn to the wheel runs through the solid stern/cabin.
  // The central apron group can stand across the direct spawn-to-lane walk.
  // Pass behind it before taking the clear west edge of the finger wharf.
  await walkTo({x:4,z:31},.3);await walkTo({x:-3.3,z:31},.3);
  await walkTo({x:-3.3,z:3.65},.2);
  await walkTo({x:5.8,z:3.65},.3);
  await walkTo('take-helm', 1.0);
  await h.page.keyboard.press('e');
  await h.page.waitForFunction(() => window.__capy.taskDone('take-helm') && window.__capy.quay.boat.atHelm, null, { timeout: 12000 });
  await sample('natural helm');

  // Clear the bridge while holding x≈8, then turn east well before Fort
  // Denison at x=6,z=-126. The horn is a real support action under the arch.
  await sailTo({ x: 8, z: -70 }, { radius: 10 });
  await h.page.keyboard.press('q');
  await h.page.waitForFunction(() => window.__capy.taskDone('under-bridge'), null, { timeout: 8000 });
  assert.ok(await h.page.evaluate(() => window.__capy.taskDone('to-quay')), 'cast-off support earned');
  await sample('bridge support and cast-off');
  await sailTo({ x: 35, z: -100 }, { radius: 12 });
  await sailTo({ x: 35, z: -170 }, { radius: 13 });
  await sailTo({ x: 70, z: -320 }, { radius: 16 });
  await sailTo({ x: 108, z: -500 }, { radius: 18 });
  await sailTo({ x: 118, z: -544 }, { final: true, radius: 30, maxMs: 50000 });
  await h.page.waitForFunction(() => window.__capy.taskDone('manly-voyage'), null, { timeout: 12000 });
  await h.page.waitForTimeout(200);
  report.navigationCard = await h.page.evaluate(() => {
    const paper=document.querySelector('.capyui-todo');
    const way=document.querySelector('.capyui-way:not(.capyui-trav):not(.capyui-shop)');
    const r=way.getBoundingClientRect();let visible=r.width>0&&r.height>0;
    for(let p=way;p;p=p.parentElement){const s=getComputedStyle(p);visible&&=s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>.01;}
    return {compact:paper.classList.contains('marq'),way:way.textContent,visible,atHelm:window.__capy.quay.boat.atHelm};
  });
  assert.ok(report.navigationCard.atHelm&&!report.navigationCard.compact&&report.navigationCard.visible,
    'completed voyage shows way on while still at helm');
  const end = await sample('natural Manly arrival');
  await h.screenshot(name + '-manly');
  assert.ok(end.tasks['take-helm'] && end.tasks['to-quay'] && end.tasks['under-bridge'] && end.tasks['manly-voyage']);
  assert.ok(end.boat.speed < 4.5, 'Manly arrival counted below docking speed');
  assert.equal(end.gate.enough, true, 'Quay signature plus two supports earns route memory');
  await h.page.waitForFunction(() => {
    const save = JSON.parse(localStorage.getItem('capy3.journey.v1') || '{}');
    return ['take-helm', 'to-quay', 'under-bridge', 'manly-voyage'].every(id => save.tasks?.includes(id));
  }, null, { timeout: 12000 });
  report.saved = await h.page.evaluate(() => ({
    tasks: JSON.parse(localStorage.getItem('capy3.journey.v1')).tasks,
    gate: window.__capy.gateInfo(3), next: window.__capy.gateInfo().find(x => x.recommended)?.n }));
  assert.equal(report.saved.gate.enough, true);
  report.keys = await h.page.evaluate(() => window.__naturalKeys);
  assert.ok(report.keys.length > 0 && report.keys.every(k => k.trusted));
  await h.page.reload(); await h.start();
  const resumed = await sample('earned Quay memory resumed');
  assert.ok(resumed.tasks['manly-voyage'] && resumed.gate.enough, 'route memory survives reload');
  assert.ok(report.steps.every(s => !s.hidden && !s.paused));
  assert.deepEqual(h.metadata.errors, []);
  report.scope = 'Natural Quay helm, cast-off, bridge horn and Manly docking from fresh arrival; real keys and live boat telemetry, no task/body/clock/input-state seeding.';
  await h.result(name, report);
  console.log(JSON.stringify({ steps: report.steps, errors: h.metadata.errors }, null, 2));
} catch (error) {
  await release();
  try { await sample('failure'); } catch {}
  report.failure = String(error.stack || error);
  if (!report.keys.length) report.keys = await h.page.evaluate(() => window.__naturalKeys || []);
  try { await h.screenshot(name + '-failure'); } catch {}
  await h.result(name + '-failure', report);
  throw error;
} finally { await h.close(); }
