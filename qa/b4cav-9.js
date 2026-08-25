async page => {
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200)));
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(7000);
  await page.evaluate(() => {
    const g = window.__capy;
    const settle = n => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    const X0 = -70, EL = 4, Z1 = 90;
    window.__hf = (api, x, z) => {
      const i = Math.floor((x - X0) / EL), j = Math.floor((Z1 - z) / EL);
      const h = (a, c) => api.terrainHeight(X0 + a * EL, Z1 - c * EL);
      const c00 = h(i, j), c10 = h(i + 1, j), c01 = h(i, j + 1), c11 = h(i + 1, j + 1);
      return +Math.max(Math.hypot((c10 - c00) / EL, (c01 - c00) / EL),
                       Math.hypot((c11 - c01) / EL, (c11 - c10) / EL)).toFixed(4);
    };
    window.__park = (name, x, z, secs, useHf) => {
      g.biome.switchTo(name);
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
      const api = (g.biome.api && g.biome.api()) || g[name];
      if (!api || !api.terrainHeight) return { name, note: 'no api' };
      const b = g.capy.body;
      b.position.set(x, api.terrainHeight(x, z) + 0.4, z);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.input.x = 0; g.input.z = 0; g.input.action = false; g.input.run = false;
      settle(180);
      const c0 = g.capy.position;
      const a = { x: c0.x, y: c0.y, z: c0.z };
      settle(60 * secs);
      const c = g.capy.position;
      const moved = Math.hypot(c.x - a.x, c.z - a.z);
      return { name, at: [+x.toFixed(1), +z.toFixed(1)], secs,
               moved: +moved.toFixed(3), mps: +(moved / secs).toFixed(4),
               analytic: +(api.slopeAt ? api.slopeAt(c.x, c.z) : -1).toFixed(4),
               hf: useHf ? window.__hf(api, c.x, c.z) : null,
               vel: +Math.hypot(b.velocity.x, b.velocity.z).toFixed(4),
               grav: +g.world.gravity.y.toFixed(2),
               slip: +(g.capy.slip || 0).toFixed(3),
               grounded: !!g.capy.grounded, swim: !!g.capy.swimming };
    };
    window.__find = (name) => {
      g.biome.switchTo(name);
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
      const api = (g.biome.api && g.biome.api()) || g[name];
      if (!api || !api.terrainHeight) return null;
      const sp = g.biome.spawnOf(name);
      for (let r = 4; r < 80; r += 4)
        for (let a = 0; a < 16; a++) {
          const x = sp.x + Math.cos(a * Math.PI / 8) * r, z = sp.z + Math.sin(a * Math.PI / 8) * r;
          let s = 0; try { s = api.slopeAt(x, z) } catch (e) { s = 0 }
          const w = api.isOverWater ? api.isOverWater(x, z) : false;
          if (!w && s > 0.045 && s < 0.075) return [+x.toFixed(1), +z.toFixed(1), +s.toFixed(4)];
        }
      return null;
    };
  });
  const rows = [];
  const jobs = [['cave', 0, 62, 30, true], ['cave', 4, -48, 30, true],
                ['cave', -50, 10, 30, true], ['cave', 30, -70, 30, true]];
  for (const j of jobs) rows.push(await page.evaluate(a => window.__park(a[0], a[1], a[2], a[3], a[4]), j));
  for (const nm of ['sydney', 'pasto', 'manly', 'iceland']) {
    const f = await page.evaluate(n => window.__find(n), nm);
    if (!f) { rows.push({ name: nm, note: 'no gentle slope near spawn' }); continue }
    const r = await page.evaluate(a => window.__park(a[0], a[1], a[2], 60, false), [nm, f[0], f[1]]);
    r.found = f; rows.push(r);
  }
  await page.evaluate(async o => {
    await fetch('/shot?name=b4cav-9.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, { errs, rows });
}
