async page => {
  await page.goto('http://localhost:5188/index.html');
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);
  // one carrier per chapter, generic: the fastest-moving rideable kinematic body seen in a 3 s watch
  const names = ['sydney', 'pasto', 'quay', 'cali', 'rio', 'iceland', 'sahara', 'venice', 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal', 'cave', 'hanoi'];
  const out = {};
  for (const n of names) {
    const cands = await page.evaluate(async (name) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
      const g = window.__capy; const C = g.CANNON;
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name), cb = g.capy.body;
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0);
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
      await sleep(2500);
      const kin = [];
      for (const bd of g.world.bodies) {
        if (bd.type !== C.Body.KINEMATIC || bd.collisionResponse === false) continue;
        if (bd.userData && (bd.userData.npc || bd.userData.local)) continue;
        kin.push({ b: bd, moved: 0, maxV: 0, lx: bd.position.x, ly: bd.position.y, lz: bd.position.z });
      }
      const t0 = performance.now();
      while (performance.now() - t0 < 3000) {
        await sleep(50);
        for (const k of kin) { const p = k.b.position; k.moved += Math.hypot(p.x - k.lx, p.y - k.ly, p.z - k.lz); k.lx = p.x; k.ly = p.y; k.lz = p.z; const v = k.b.velocity; const vs = Math.hypot(v.x, v.y, v.z); if (vs > k.maxV) k.maxV = vs; }
      }
      // rideable: has a box shape whose top is the highest and half extents >= 0.6 in both plan axes; moving; not absurdly fast
      const res = [];
      for (const k of kin) {
        if (k.moved < 0.5 || k.maxV > 20) continue;
        let best = null;
        for (let i = 0; i < k.b.shapes.length; i++) { const s = k.b.shapes[i]; if (!s.halfExtents) continue; const h = s.halfExtents; if (h.x < 0.6 || h.z < 0.6) continue; const top = k.b.shapeOffsets[i].y + h.y; if (!best || h.x * h.z > best.area) best = { i, area: h.x * h.z, top, hx: h.x, hz: h.z }; }
        if (!best) continue;
        res.push({ id: k.b.id, moved: +k.moved.toFixed(1), maxV: +k.maxV.toFixed(1), top: +best.top.toFixed(2), hx: best.hx, hz: best.hz, nsh: k.b.shapes.length, at: [+k.b.position.x.toFixed(1), +k.b.position.y.toFixed(1), +k.b.position.z.toFixed(1)] });
      }
      res.sort((a, b) => b.moved - a.moved);
      return res.slice(0, 2);
    }, n);
    out[n] = { cands, rides: [] };
    for (const c of cands) {
      // put the animal down ONCE, above the deck centre, then touch nothing for 14 s
      await page.evaluate((id) => {
        const g = window.__capy; const C = g.CANNON; const bd = g.world.bodies.find(b => b.id === id);
        let best = null; for (let i = 0; i < bd.shapes.length; i++) { const s = bd.shapes[i]; if (!s.halfExtents) continue; const h = s.halfExtents; if (h.x < 0.6 || h.z < 0.6) continue; if (!best || h.x * h.z > best.area) best = { i, area: h.x * h.z, top: bd.shapeOffsets[i].y + h.y, off: bd.shapeOffsets[i] }; }
        const w = new C.Vec3(); bd.quaternion.vmult(best.off, w); w.vadd(bd.position, w);
        const cb = g.capy.body;
        cb.position.set(w.x, bd.position.y + best.top + 0.75, w.z); cb.velocity.set(0, 0, 0);
        cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
        window.__rd = { id, rows: [], o0: null, maxDev: 0, minY: 1e9, maxY: -1e9, off: 0, rideFrames: 0, frames: 0, start: [w.x, bd.position.y + best.top, w.z] };
        const qi = new C.Quaternion(), d = new C.Vec3(), l = new C.Vec3();
        window.__rdTimer = setInterval(() => {
          const R = window.__rd; const g = window.__capy; const bd = g.world.bodies.find(b => b.id === R.id); if (!bd) return;
          bd.quaternion.inverse(qi);
          d.set(g.capy.position.x - bd.position.x, g.capy.position.y - bd.position.y, g.capy.position.z - bd.position.z); qi.vmult(d, l);
          R.frames++;
          if (R.frames < 6) { R.o0 = [l.x, l.y, l.z]; return; }   // settle 0.5 s, then this is the reference
          const dev = Math.hypot(l.x - R.o0[0], l.z - R.o0[2]);
          if (dev > R.maxDev) R.maxDev = dev;
          if (l.y < R.minY) R.minY = l.y; if (l.y > R.maxY) R.maxY = l.y;
          if (g.capy.rideBody === bd || (g.capy.frame && (g.capy.frame.x || g.capy.frame.z))) R.rideFrames++;
          if (R.frames % 10 === 0) R.rows.push([+dev.toFixed(2), +l.y.toFixed(2), +Math.hypot(bd.velocity.x, bd.velocity.z).toFixed(1), +bd.position.x.toFixed(0), +bd.position.z.toFixed(0)]);
        }, 100);
      }, c.id);
      for (let i = 0; i < 2; i++) await page.evaluate(() => new Promise(r => setTimeout(r, 7000)));
      const r = await page.evaluate(() => {
        clearInterval(window.__rdTimer);
        const R = window.__rd; const g = window.__capy; const bd = g.world.bodies.find(b => b.id === R.id);
        const tr = Math.hypot(bd.position.x - R.start[0], bd.position.z - R.start[2]);
        return { id: R.id, o0: R.o0 && R.o0.map(v => +v.toFixed(2)), maxDev: +R.maxDev.toFixed(2), minY: +R.minY.toFixed(2), maxY: +R.maxY.toFixed(2), rideFrames: R.rideFrames, frames: R.frames,
                 carrierTravelled: +tr.toFixed(1), endDy: +(g.capy.position.y - bd.position.y).toFixed(2), rows: R.rows, err: g.state.lastError || null };
      });
      out[n].rides.push(r);
    }
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=px-body-ride.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
