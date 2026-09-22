// Real-key ferry memory, using the established harbour approach. Reading
// authored waypoints guides the driver; it does not prove novice discovery.
import assert from 'node:assert/strict';

export async function earnFerryMemory(h) {
  const held = new Set(), trace = [], started = Date.now();
  async function keys(want) {
    for (const k of [...held]) if (!want.has(k)) { await h.page.keyboard.up(k); held.delete(k); }
    for (const k of want) if (!held.has(k)) { await h.page.keyboard.down(k); held.add(k); }
  }
  async function walk(target, radius) {
    const start = Date.now(); let from;
    while (Date.now() - start < 35000) {
      const s = await h.page.evaluate(target => {
        const g = window.__capy;
        return { p: g.capy.position.toArray(), yaw: g.input.camYaw,
          q: typeof target === 'string' ? g.hintTarget(target) : target };
      }, target);
      assert(s.q, 'waypoint exists'); from ||= { x: s.p[0], z: s.p[2] };
      const distance = Math.hypot(s.q.x - s.p[0], s.q.z - s.p[2]);
      if (distance < radius) { await keys(new Set()); return; }
      const sx = s.q.x - from.x, sz = s.q.z - from.z, len = Math.hypot(sx, sz);
      const along = len ? Math.max(0, Math.min(len, ((s.p[0]-from.x)*sx+(s.p[2]-from.z)*sz)/len)) : 0;
      const u = len ? Math.min(1, (along + 1) / len) : 1;
      const dx = from.x + sx*u - s.p[0], dz = from.z + sz*u - s.p[2];
      const x = dx*Math.cos(s.yaw)-dz*Math.sin(s.yaw), z = dx*Math.sin(s.yaw)+dz*Math.cos(s.yaw);
      const want = new Set();
      if (Math.abs(x) > Math.abs(z)*.42) want.add(x > 0 ? 'd' : 'a');
      if (Math.abs(z) > Math.abs(x)*.42) want.add(z > 0 ? 's' : 'w');
      await keys(want); await h.page.waitForTimeout(80);
    }
    throw new Error('ferry approach timed out: ' + JSON.stringify(target));
  }
  try {
    await h.arrive('quay');
    for (const [x,z,r] of [[4,31,.3],[-3.3,31,.3],[-3.3,3.65,.2],[5.8,3.65,.3]]) await walk({x,z},r);
    await walk('take-helm', 1); await h.page.keyboard.press('e');
    await h.page.waitForFunction(() => window.__capy.taskDone('take-helm') && window.__capy.quay.boat.atHelm);
    const start = Date.now(); let reached = false;
    while (Date.now() - start < 70000) {
      const s = await h.page.evaluate(() => {
        const b = window.__capy.quay.boat;
        return { p: b.position.toArray(), yaw: b.heading, focused: document.hasFocus() && !document.hidden };
      });
      assert(s.focused, 'ferry run focused');
      const dx = 8-s.p[0], dz = -70-s.p[2], d = Math.hypot(dx,dz);
      trace.push(s);
      if (d < 10) { reached = true; break; }
      const turn = Math.sin(s.yaw)*dz-Math.cos(s.yaw)*dx, want = new Set(['w']);
      if (Math.abs(turn) > Math.max(4,d*.08)) want.add(turn > 0 ? 'd' : 'a');
      await keys(want); await h.page.waitForTimeout(180);
    }
    assert(reached, 'bridge reached'); await keys(new Set()); await h.page.keyboard.press('q');
    await h.page.waitForFunction(() => window.__capy.taskDone('under-bridge'));
    return { seconds: (Date.now()-started)/1000, trace };
  } finally { await keys(new Set()); }
}
