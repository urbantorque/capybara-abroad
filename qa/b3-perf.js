async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);

  const out = { rows: [] };
  for (const nm of ['pasto', 'monaco', 'sydney']) {
    const r = await page.evaluate(async (name) => {
      const g = window.__capy;
      if (g.biome.current !== name) g.biome.switchTo(name);
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
      const sp = g.biome.spawnOf(name);
      const b = g.capy.body;
      b.position.set(sp.x, (sp.y || 1) + 0.4, sp.z);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position);
      b.interpolatedPosition.copy(b.position);
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false);   // warm
      const ms = [];
      for (let k = 0; k < 240; k++) {
        const t0 = performance.now();
        g.tick(1 / 60, false);
        ms.push(performance.now() - t0);
      }
      ms.sort((p, q) => p - q);
      let verts = 0, tiles = 0;
      for (const bd of g.world.bodies) {
        if (bd.mass !== 0) continue;
        for (const s of bd.shapes) {
          if (s instanceof g.CANNON.Heightfield) { tiles++; verts += s.data.length * s.data[0].length; }
        }
      }
      return {
        biome: name, live: g.biome.current,
        medianMs: +ms[Math.floor(ms.length / 2)].toFixed(3),
        p90Ms: +ms[Math.floor(ms.length * 0.9)].toFixed(3),
        hfTiles: tiles, hfVerts: verts,
        bodies: g.world.bodies.length,
      };
    }, nm);
    out.rows.push(r);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b3-perf.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
