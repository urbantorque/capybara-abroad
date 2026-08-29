async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html');
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);
  const names = ['cali', 'rio', 'iceland', 'sahara', 'drift'];
  const out = { boot: null, rows: [] };
  out.boot = await page.evaluate(() => {
    const g = window.__capy;
    return { have: !!g, started: g && g.state.started, biome: g && g.biome.current,
             err: (g && g.state.lastError) || null };
  });
  for (const n of names) {
    const row = await page.evaluate(async (name) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
      const g = window.__capy;
      g.state.lastError = null;
      g.biome.switchTo(name);
      await sleep(2500);
      const api = g[name];
      const sp = g.biome.spawnOf(name);
      const bd = g.capy.body;
      bd.position.set(sp.x, sp.y, sp.z); bd.velocity.set(0, 0, 0);
      bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position);
      await sleep(4000);
      const p = g.capy.position;
      return {
        biome: g.biome.current,
        err: g.state.lastError || null,
        bodies: g.world.bodies.length,
        pos: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
        grounded: !!g.capy.grounded,
        terrain: api && api.terrainHeight ? +api.terrainHeight(p.x, p.z).toFixed(2) : null,
        apiKeys: api ? Object.keys(api).length : 0,
      };
    }, n);
    out.rows.push(row);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-boot.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
