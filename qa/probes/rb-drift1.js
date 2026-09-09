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
    const rows = [];
    for (let i = 0; i < 16; i++) {
      await sleep(500);
      const p = g.capy.position;
      const d = g.drift;
      rows.push({
        t: +(i * 0.5).toFixed(1),
        x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2),
        vy: +g.capy.body.velocity.y.toFixed(2),
        gnd: !!g.capy.grounded,
        terr: +d.terrainHeight(p.x, p.z).toFixed(2),
        wind: +d.windSpeed().toFixed(2),
        grav: +g.world.gravity.y.toFixed(2),
      });
    }
    return { spawn: g.biome.spawnOf('drift'), rows: rows, err: g.state.lastError || null };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-drift1.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
