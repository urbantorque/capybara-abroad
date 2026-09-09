async page => {
  await page.reload(); await page.waitForTimeout(6000);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = {};
  for (const bm of ['sydney', 'pasto', 'quay']) {
    out[bm] = await page.evaluate(async (name) => {
      const g = window.__capy;
      g.biome.switchTo(name);
      for (let i = 0; i < 120; i++) g.tick(1/60, false);
      const sp = g.biome.spawnOf(name), b = g.capy.body;
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      const KEYS = ['KeyW','KeyA','KeyS','KeyD','Space','KeyE','KeyQ','ShiftLeft','KeyF'];
      const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
      const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
      let s = 4242 ^ name.length * 131;
      const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
      const held = new Set();
      let nan = 0, void_ = 0;
      for (let i = 0; i < 60 * 240; i++) {          // 4 minutes of game time each
        if (rnd() < 0.06) { const k = KEYS[(rnd() * KEYS.length) | 0];
          if (held.has(k)) { up(k); held.delete(k); } else { down(k); held.add(k); } }
        g.tick(1/60, false);
        const p = g.capy.position, v = g.capy.body.velocity;
        if (!(p.x === p.x && p.y === p.y && p.z === p.z)) nan++;
        if (!(v.x === v.x && v.y === v.y && v.z === v.z)) nan++;
        const mod = g[name === 'sydney' ? 'env' : name];
        const th = (mod && mod.terrainHeight) ? mod.terrainHeight(p.x, p.z) : 0;
        if (p.y < (th === th ? th : 0) - 8) void_++;
      }
      for (const k of held) up(k);
      return { nan, void: void_, err: g.state.lastError || null,
               end: [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(1), +g.capy.position.z.toFixed(1)] };
    }, bm);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=zi.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
