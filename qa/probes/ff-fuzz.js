async page => {
  const names = [
                 
                 'manly', 'pantanal'];
  const res = {};
  for (const n of names) {
    res[n] = await page.evaluate(async (name) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
      const g = window.__capy;
      const errs = [];
      const oe = console.error;
      console.error = function (...a) { errs.push(a.map(x => (x && x.stack) || String(x)).join(' ')); oe.apply(console, a); };
      const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE', 'KeyQ', 'ShiftLeft'];
      const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
      const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name), cb = g.capy.body;
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0);
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
      await sleep(300);
      // deterministic-ish PRNG so a hit is reproducible
      let s = 1234567 ^ name.length * 7919;
      const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
      let nanFrames = 0, belowVoid = 0, minY = 1e9, maxY = -1e9, maxSpeed = 0;
      let camNaN = 0, stuckFrames = 0, lastX = 0, lastZ = 0;
      const held = new Set();
      const t0 = performance.now();
      while (performance.now() - t0 < 8000) {
        if (rnd() < 0.09) {
          const k = KEYS[(rnd() * KEYS.length) | 0];
          if (held.has(k)) { up(k); held.delete(k); } else { down(k); held.add(k); }
        }
        await sleep(16);
        const p = g.capy.position, v = g.capy.body.velocity, c = g.camera.position;
        if (!(p.x === p.x && p.y === p.y && p.z === p.z)) nanFrames++;
        if (!(v.x === v.x && v.y === v.y && v.z === v.z)) nanFrames++;
        if (!(c.x === c.x && c.y === c.y && c.z === c.z)) camNaN++;
        const terr = (g[name === 'sydney' ? 'env' : name] && g[name === 'sydney' ? 'env' : name].terrainHeight)
          ? g[name === 'sydney' ? 'env' : name].terrainHeight(p.x, p.z) : 0;
        if (p.y < (terr === terr ? terr : 0) - 8) belowVoid++;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
        const spd = Math.hypot(v.x, v.y, v.z); if (spd > maxSpeed) maxSpeed = spd;
        if (Math.hypot(p.x - lastX, p.z - lastZ) < 0.004 && held.size) stuckFrames++;
        lastX = p.x; lastZ = p.z;
      }
      for (const k of held) up(k);
      console.error = oe;
      return {
        nanFrames, camNaN, belowVoid, stuckFrames,
        minY: +minY.toFixed(2), maxY: +maxY.toFixed(2), maxSpeed: +maxSpeed.toFixed(1),
        solverSaves: g.state.solverSaves || 0,
        end: [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(1), +g.capy.position.z.toFixed(1)],
        errs: errs.slice(0, 6), lastError: g.state.lastError || null,
      };
    }, n);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=ffuzz.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, res);
}
