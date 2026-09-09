async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Period');           // ch18 Monte Carlo
  await page.waitForTimeout(4000);

  const soak = await page.evaluate(async () => {
    const g = window.__capy;
    const r = { chapters: {} };
    for (const nm of ['monaco', 'pasto']) {
      if (g.biome.current !== nm) g.biome.switchTo(nm);
      for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
      if (g.biome.current !== nm) { r.chapters[nm] = { bad: 'wrong biome' }; continue; }
      const sp = g.biome.spawnOf(nm);
      const b = g.capy.body;
      b.position.set(sp.x, (sp.y || 1) + 0.4, sp.z);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position);
      b.interpolatedPosition.copy(b.position);
      for (let t = 0; t < 1800; t++) g.tick(1 / 60, false);   // 30 s
      r.chapters[nm] = {
        lastError: g.state.lastError ? String(g.state.lastError).slice(0, 140) : null,
        restY: +b.position.y.toFixed(2),
        bodies: g.world.bodies.length,
      };
    }
    // stand it on the Monaco rock for the picture: the climb, where the
    // collider and the drawn ground disagreed most
    if (g.biome.current !== 'monaco') g.biome.switchTo('monaco');
    for (let i = 0; i < 25; i++) g.tick(1 / 60, false);
    const api = g.monaco;
    const th = (x, z) => { const v = api.terrainHeight(x, z); return (v === v) ? v : 0; };
    const b = g.capy.body;
    b.position.set(-40, th(-40, -20) + 0.6, -20);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position);
    b.interpolatedPosition.copy(b.position);
    g.capy.carriedBy = null;
    r.shotAt = [-40, +th(-40, -20).toFixed(2), -20];
    return r;
  });
  await page.waitForTimeout(2500);
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b3-final.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, soak);
}
