// Real-key first memory. The driver reads authored pointers, so this is not
// novice discovery evidence. No task award, position or physics mutation.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const h = await openHarness({ story: true });
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
    await h.page.bringToFront();
    while (Date.now() - start < 60000) {
      const s = await h.page.evaluate(id => {
        const g = window.__capy, hint = g.hintTarget(id);
        if (g.taskDone(id)) return { done: true };
        if (!hint) return null;
        const q = hint.position || hint.pos || hint, p = g.capy.body.position;
        const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
        const v = new g.THREE.Vector3(); g.camera.getWorldDirection(v); v.y = 0; v.normalize();
        return { d, f: (dx * v.x + dz * v.z) / (d || 1), r: (-dx * v.z + dz * v.x) / (d || 1),
          focused: document.hasFocus() && !document.hidden, held: g.capy.heldProp?.type || '' };
      }, id);
      if (s?.done) { done = true; break; }
      assert(s && s.focused, 'live pointer and focused browser');
      if (trace.length === 0 || Date.now() - trace.at(-1).at > 2000) trace.push({ at: Date.now(), ...s });
      const want = new Set();
      if (s.d > 1.5) {
        if (s.f > .3) want.add('KeyW'); else if (s.f < -.6) want.add('KeyS');
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
  assert.equal(h.metadata.errors.length, 0); out.pass = true;
} catch (e) { out.pass = false; out.failure = String(e.stack || e); process.exitCode = 1; }
finally {
  await keys(new Set()); await h.screenshot('homecoming-first-memory');
  await h.result('homecoming-first-memory-v1', out); await h.close();
  console.log(JSON.stringify({ pass: out.pass, seconds: out.seconds, actions: out.actions.map(({ id, done, seconds }) => ({ id, done, seconds })), failure: out.failure }));
}
