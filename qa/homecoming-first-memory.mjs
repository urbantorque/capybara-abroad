// Real-key first memory. The driver reads authored pointers, so this is not
// novice discovery evidence. No task award, position or physics mutation.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const h = await openHarness({ story: true });
const firstAct = process.argv.includes('--first-act');
const out = { metadata: h.metadata, actions: [], fixture: 'trusted keys guided by hintTarget' };
const held = new Set();
async function keys(want) {
  for (const key of [...held]) if (!want.has(key)) { await h.page.keyboard.up(key); held.delete(key); }
  for (const key of want) if (!held.has(key)) { await h.page.keyboard.down(key); held.add(key); }
}
try {
  await h.start(); const beginning = Date.now();
  for (const id of ['steal-hat', 'picnic-thief']) {
    const start = Date.now(), trace = []; let done = false;
    let bestDistance = Infinity, movedAt = Date.now(), detours = 0;
    const waypoints = id === 'picnic-thief' ? await h.page.evaluate(() => {
      const p = window.__capy.capy.position, q = window.__capy.hintTarget('picnic-thief');
      // Western bed collider: x=15..18.2, z=14..52. Use its north end.
      return q && p.x < 19 && q.x > 19 && p.z > 11 ? [{x:12,z:10},{x:23,z:10}] : [];
    }) : [];
    if (id === 'picnic-thief' && await h.page.evaluate(() => window.__capy.capy.heldProp?.type === 'hat')) {
      await h.page.keyboard.press('KeyE'); await h.page.waitForTimeout(400);
    }
    await h.page.bringToFront();
    while (Date.now() - start < 60000) {
      const s = await h.page.evaluate(({id, waypoint}) => {
        const g = window.__capy, hint = g.hintTarget(id);
        if (g.taskDone(id)) return { done: true };
        const held = g.capy.heldProp?.type || '';
        const focused = document.hasFocus() && !document.hidden;
        // Theft pointers leave the ground when picked up. Keep playing the
        // escape instead of mistaking an armed task for a missing landmark.
        if (!hint) return { missing: true, held, focused };
        const q = waypoint || hint.position || hint.pos || hint, p = g.capy.body.position;
        const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
        const v = new g.THREE.Vector3(); g.camera.getWorldDirection(v); v.y = 0; v.normalize();
        return { d, f: (dx * v.x + dz * v.z) / (d || 1), r: (-dx * v.z + dz * v.x) / (d || 1),
          focused, held };
      }, {id, waypoint: waypoints[0]});
      if (s?.done) { done = true; break; }
      assert(s?.focused, 'focused browser');
      if (s.held === (id === 'steal-hat' ? 'hat' : 'sandwich')) {
        await keys(new Set(['KeyW', 'ShiftLeft']));
        await h.page.waitForTimeout(220); continue;
      }
      assert(!s.missing, 'authored hint target available when no prop is held');
      if (waypoints.length && s.d < 1.5) {
        waypoints.shift(); bestDistance = Infinity; movedAt = Date.now(); continue;
      }
      if (s.d < bestDistance - 1) { bestDistance = s.d; movedAt = Date.now(); }
      if (s.d > 2 && Date.now() - movedAt > 3500) {
        // Walk along an obstacle before trying the target again. Alternating
        // sides bounds this simple driver; it is not a novice discovery test.
        const side = detours++ % 2 ? -1 : 1;
        const f = -s.r * side, r = s.f * side, bypass = new Set();
        if (f > .25) bypass.add('KeyW'); else if (f < -.25) bypass.add('KeyS');
        if (r > .25) bypass.add('KeyD'); else if (r < -.25) bypass.add('KeyA');
        await keys(bypass); await h.page.keyboard.press('Space');
        // Longer hedges need more than the original two-second sidestep.
        // Widen successive attempts while keeping the total task timeout.
        await h.page.waitForTimeout(Math.min(8000, 2000 + detours * 1000)); await keys(new Set());
        bestDistance = Infinity; movedAt = Date.now(); continue;
      }
      if (trace.length === 0 || Date.now() - trace.at(-1).at > 2000) trace.push({ at: Date.now(), ...s });
      const want = new Set();
      if (s.d > 1.5) {
        if (s.f > .3) want.add('KeyW'); else if (s.f < -.3) want.add('KeyS');
        if (s.r > .25) want.add('KeyD'); else if (s.r < -.25) want.add('KeyA');
        if (s.d > 6) want.add('ShiftLeft');
      } else {
        await keys(new Set()); await h.page.keyboard.press('KeyE'); await h.page.waitForTimeout(400);
      }
      await keys(want); await h.page.waitForTimeout(220);
    }
    await keys(new Set());
    out.actions.push({ id, done, seconds: (Date.now() - start) / 1000, trace });
    assert(done, 'driver earned ' + id);
  }
  out.seconds = (Date.now() - beginning) / 1000;
  out.gates = await h.page.evaluate(() => window.__capy.gateInfo());
  assert.equal(out.gates.filter(r => r.open).map(r => r.n).join(','), '1,3,14');
  assert(out.gates[0].enough && !out.gates[0].experience.signatureDone);
  if (firstAct) {
    const { earnFerryMemory } = await import('./homecoming-ferry-memory.mjs');
    out.ferry = await earnFerryMemory(h);
    out.actGates = await h.page.evaluate(() => window.__capy.gateInfo());
    const expected = '1,2,3,5,6,14,15';
    assert.equal(out.actGates.filter(r => r.open).map(r => r.n).join(','), expected);
    assert(out.actGates.find(r => r.n === 3).enough, 'second earned memory');
    await h.page.waitForFunction(() => {
      const s = JSON.parse(localStorage.getItem('capy3.journey.v1') || '{}');
      return ['steal-hat','picnic-thief','take-helm','under-bridge'].every(id => s.tasks?.includes(id));
    });
    await h.page.reload();
    await h.page.waitForFunction(() => window.__capyRunning && !!document.querySelector('.capyui-go'));
    await h.start();
    out.resumed = await h.page.evaluate(() => window.__capy.gateInfo());
    assert.equal(out.resumed.filter(r => r.open).map(r => r.n).join(','), expected, 'earned unlock survives reload');
  }
  assert.equal(h.metadata.errors.length, 0); out.pass = true;
} catch (e) { out.pass = false; out.failure = String(e.stack || e); process.exitCode = 1; }
finally {
  await keys(new Set()); await h.screenshot('homecoming-first-memory');
  await h.result(firstAct ? 'homecoming-first-act-v3' : 'homecoming-first-memory-v5', out); await h.close();
  console.log(JSON.stringify({ pass: out.pass, seconds: out.seconds, actions: out.actions.map(({ id, done, seconds }) => ({ id, done, seconds })), failure: out.failure }));
}
