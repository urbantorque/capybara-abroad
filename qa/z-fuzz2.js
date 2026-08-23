async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(1500)
  const names = ['sahara', 'drift']
  const res = {}
  for (const n of names) {
    res[n] = await page.evaluate(async (name) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
      const g = window.__capy;
      const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE', 'KeyQ', 'ShiftLeft'];
      const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
      const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name), cb = g.capy.body;
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0);
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
      await sleep(300);
      let s = 1234567 ^ name.length * 7919;
      const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
      let nanFrames = 0, belowVoid = 0, minY = 1e9, maxY = -1e9, maxSpeed = 0;
      const held = new Set();
      const t0 = performance.now();
      while (performance.now() - t0 < 9000) {
        if (rnd() < 0.09) {
          const k = KEYS[(rnd() * KEYS.length) | 0];
          if (held.has(k)) { up(k); held.delete(k); } else { down(k); held.add(k); }
        }
        for (let i = 0; i < 4; i++) g.tick(1 / 60, false);
        const p = cb.position, v = cb.velocity;
        if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z) ||
            !isFinite(v.x) || !isFinite(v.y) || !isFinite(v.z)) nanFrames++;
        if (p.y < -60) belowVoid++;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
        const sp2 = Math.hypot(v.x, v.y, v.z); if (sp2 > maxSpeed) maxSpeed = sp2;
        if (!isFinite(g.camera.position.x)) nanFrames++;
        await sleep(0);
      }
      for (const k of held) up(k);
      return { nanFrames, belowVoid, minY: +minY.toFixed(1), maxY: +maxY.toFixed(1),
               maxSpeed: +maxSpeed.toFixed(1), err: g.state.lastError || null,
               bodies: g.world.bodies.length };
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=zfuzz.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, res)
}
