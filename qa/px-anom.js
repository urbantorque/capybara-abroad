async page => {
  const CH = [
    ['Comma', 'antarctic', [[0, 0], [0, -14], [0, -30], [-30, -4], [30, -4], [0, 16]]],
  ];
  const rows = [];
  const maxes = () => page.evaluate(() => {
    const m = window.__px.max; m.sfx = window.__px.sfx.slice(); return m;
  });
  const reset = () => page.evaluate(() => { window.__px.max = {}; window.__px.sfx.length = 0; });
  for (const [key, name, offs] of CH) {
    await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(4200);
    await page.keyboard.press(key);
    await page.waitForTimeout(5200);
    await page.evaluate(() => {
      const g = window.__capy;
      window.__px = { biome: g.biome.current, sfx: [], max: {} };
      const raw = g.sfx;
      g.sfx = function (n) { window.__px.sfx.push(String(n)); return raw.apply(g, arguments); };
      window.__pxT = setInterval(() => {
        const c = g.capy, m = window.__px.max, v = c.velocity;
        const sp = Math.hypot(v.x, v.z);
        m.sp = Math.max(m.sp || 0, sp);
        m.vy = Math.max(m.vy === undefined ? -99 : m.vy, v.y);
        if (c.sliding) m.slide = 1;
        if (c.grounded) m.ground = (m.ground || 0) + 1;
        m.n = (m.n || 0) + 1;
      }, 30);
    });
    const live = await page.evaluate(() => window.__capy.biome.current);
    for (const off of offs) {
      // Put the animal down on the terrain at spawn + offset and let it settle.
      const put = await page.evaluate(o => {
        const g = window.__capy, a = g[g.biome.current];
        const sp = (a && a.SPAWN) || { x: 0, y: 2, z: 0 };
        const x = sp.x + o[0], z = sp.z + o[1];
        let h = 0;
        if (a && typeof a.terrainHeight === 'function') { const v = a.terrainHeight(x, z); if (v === v) h = v; }
        g.capy.body.position.set(x, h + 1.1, z);
        g.capy.body.velocity.set(0, 0, 0);
        g.capy.body.angularVelocity.set(0, 0, 0);
        g.capy.body.aabbNeedsUpdate = true;
        return { x: +x.toFixed(1), z: +z.toFixed(1), h: +h.toFixed(2) };
      }, off);
      await page.waitForTimeout(1600);
      const rest = await page.evaluate(() => {
        const g = window.__capy, c = g.capy, p = c.position, a = g[g.biome.current];
        let h = 0, gx = 0, gz = 0;
        if (a && typeof a.terrainHeight === 'function') {
          h = a.terrainHeight(p.x, p.z);
          gx = (a.terrainHeight(p.x + 1, p.z) - a.terrainHeight(p.x - 1, p.z)) / 2;
          gz = (a.terrainHeight(p.x, p.z + 1) - a.terrainHeight(p.x, p.z - 1)) / 2;
        }
        // How many static bodies have a chest-height overlap within 3 m.
        let near = 0;
        const w = g.world;
        for (let i = 0; i < w.bodies.length; i++) {
          const b = w.bodies[i];
          if (b === c.body || b.mass > 0 || b.collisionResponse === false) continue;
          if (!b.aabb || !b.shapes.length) continue;
          const s = b.shapes[0];
          if (s && (s.type === 4 || s.type === 8)) continue;   // plane, heightfield
          const d = Math.hypot(b.position.x - p.x, b.position.z - p.z);
          if (d < 3) near++;
        }
        return { y: +p.y.toFixed(2), grounded: !!c.grounded, ground: +h.toFixed(2),
                 slope: +(Math.atan(Math.hypot(gx, gz)) * 180 / Math.PI).toFixed(1), near };
      });
      const legs = {};
      for (const [tag, k] of [['W', 'KeyW'], ['A', 'KeyA'], ['S', 'KeyS'], ['D', 'KeyD']]) {
        // walk
        await reset();
        await page.keyboard.down(k);
        await page.waitForTimeout(1100);
        const wlk = (await maxes()).sp;
        // run, continuing from the walk
        await reset();
        await page.keyboard.down('ShiftLeft');
        await page.waitForTimeout(1400);
        const rn = await maxes();
        await page.keyboard.up('ShiftLeft');
        await page.keyboard.up(k);
        await page.waitForTimeout(500);
        // ...then put it back, so four legs do not walk it into the sea
        await page.evaluate(o => {
          const g = window.__capy, a = g[g.biome.current];
          const sp = (a && a.SPAWN) || { x: 0, y: 2, z: 0 };
          const x = sp.x + o[0], z = sp.z + o[1];
          let h = 0;
          if (a && typeof a.terrainHeight === 'function') { const v = a.terrainHeight(x, z); if (v === v) h = v; }
          g.capy.body.position.set(x, h + 1.1, z);
          g.capy.body.velocity.set(0, 0, 0);
          g.capy.body.aabbNeedsUpdate = true;
        }, off);
        await page.waitForTimeout(900);
        legs[tag] = { walk: +(wlk || 0).toFixed(2), run: +(rn.sp || 0).toFixed(2),
                      gnd: rn.n ? +((rn.ground || 0) / rn.n).toFixed(2) : 0 };
      }
      // WHEEK, with the FULL sfx list rather than the last four
      await reset();
      await page.keyboard.press('KeyQ');
      await page.waitForTimeout(700);
      const wk = await maxes();
      rows.push({ biome: live, at: put, rest, legs,
                  bestWalk: Math.max.apply(null, Object.keys(legs).map(t => legs[t].walk)),
                  bestRun: Math.max.apply(null, Object.keys(legs).map(t => legs[t].run)),
                  wheek: wk.sfx });
    }
    await page.evaluate(() => clearInterval(window.__pxT));
  }
  await page.evaluate(o => fetch('/shot?name=px-anom-ant.json', {
    method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), rows);
}
