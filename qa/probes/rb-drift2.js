async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html');
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const out = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    const g = window.__capy;
    g.biome.switchTo('drift');
    await sleep(2000);
    const sp = g.biome.spawnOf('drift');
    const bd = g.capy.body;
    bd.position.set(sp.x, sp.y, sp.z); bd.velocity.set(0, 0, 0);
    bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position);
    const rows = [];
    for (let i = 0; i < 16; i++) {
      await sleep(400);
      const p = g.capy.position;
      const d = g.drift;
      rows.push({ t: +(i * 0.4).toFixed(1), x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2),
                  vy: +bd.velocity.y.toFixed(2), gnd: !!g.capy.grounded,
                  terr: +d.terrainHeight(p.x, p.z).toFixed(2),
                  isle: d.islandKind(p.x, p.z) });
    }
    // and a grid of terrain vs island around the spawn
    const grid = [];
    for (let dz = -12; dz <= 12; dz += 4) {
      const line = [];
      for (let dx = -12; dx <= 12; dx += 4) {
        line.push(g.drift.terrainHeight(sp.x + dx, sp.z + dz));
      }
      grid.push(line);
    }
    return { spawn: sp, rows: rows, grid: grid, err: g.state.lastError || null };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-drift2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
