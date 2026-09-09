async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);

  const out = { started: await page.evaluate(() => !!window.__capy.state.started), far: [], edge: [] };

  // ---- 1. the two residuals: do they rescue when CLEARLY outside? ---------
  for (const t of [
    { biome: 'antarctic', key: 'Comma', x: 0, z: -640 },
    { biome: 'antarctic', key: 'Comma', x: 0, z: 300 },
    { biome: 'quay', key: 'Digit3', x: 600, z: -880 },
    { biome: 'cave', key: 'Quote', x: 0, z: 260 },
  ]) {
    const r = await page.evaluate(async (a) => {
      const g = window.__capy;
      if (g.biome.current !== a.biome) g.biome.switchTo(a.biome);
      for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
      if (g.biome.current !== a.biome) return { biome: a.biome, live: g.biome.current, bad: 'wrong biome' };
      const api = (a.biome === 'sydney') ? g.env : g[a.biome];
      const th = (api && typeof api.terrainHeight === 'function')
        ? (x, z) => { const v = api.terrainHeight(x, z); return (v === v) ? v : 0; } : () => 0;
      const b = g.capy.body;
      b.position.set(a.x, th(a.x, a.z) + 0.5, a.z);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position);
      b.interpolatedPosition.copy(b.position);
      g.capy.carriedBy = null;
      for (let t2 = 0; t2 < 180; t2++) g.tick(1 / 60, false);
      const moved = Math.hypot(b.position.x - a.x, b.position.z - a.z);
      const box = g.biome.boundsOf(a.biome);
      return {
        biome: a.biome, live: g.biome.current, at: [a.x, a.z],
        rescued: moved > 12, movedM: Math.round(moved),
        box: box ? { x0: Math.round(box.x0), x1: Math.round(box.x1), z0: Math.round(box.z0), z1: Math.round(box.z1) } : null,
        ownBounds: !!(api && typeof api.bounds === 'function'),
      };
    }, t);
    out.far.push(r);
  }

  // ---- 2. what can you see from just inside the edge? --------------------
  // Cave has the tightest computed box in the game (nearEdge 31 m from spawn).
  const shot = await page.evaluate(async () => {
    const g = window.__capy;
    if (g.biome.current !== 'cave') g.biome.switchTo('cave');
    for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
    const box = g.biome.boundsOf('cave');
    const api = g.cave;
    const th = (x, z) => { const v = api.terrainHeight(x, z); return (v === v) ? v : 0; };
    // 3 m INSIDE the northern edge, where the box is tightest
    const x = 0, z = box.z1 - 3;
    const b = g.capy.body;
    b.position.set(x, th(x, z) + 0.5, z);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position);
    b.interpolatedPosition.copy(b.position);
    g.capy.carriedBy = null;
    return { live: g.biome.current, at: [x, Math.round(z)], box: { z1: Math.round(box.z1) } };
  });
  out.edge.push(shot);
  await page.waitForTimeout(2500);

  await page.evaluate(async (o) => {
    await fetch('/shot?name=b1-check.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
