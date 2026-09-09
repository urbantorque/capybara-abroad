async page => {
  await page.reload(); await page.waitForTimeout(6000);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    g.biome.switchTo('sydney');
    for (let i = 0; i < 120; i++) g.tick(1/60, false);
    const res = { walk: [], api: Object.keys(g.env).join(','), bounds: typeof g.env.bounds };
    const b = g.capy.body;
    // drop the animal at increasing z and see where it stands
    for (const z of [60, 68, 72, 80, 100, 140, 160, 200]) {
      b.position.set(0, 6, z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      for (let i = 0; i < 180; i++) g.tick(1/60, false);
      res.walk.push([z, +g.capy.position.y.toFixed(2), +g.capy.position.z.toFixed(1)]);
    }
    // and the same to the east/west and south
    for (const x of [66, 72, 90, 140, -140]) {
      b.position.set(x, 6, 30); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      for (let i = 0; i < 180; i++) g.tick(1/60, false);
      res.walk.push(['x' + x, +g.capy.position.y.toFixed(2), +g.capy.position.x.toFixed(1)]);
    }
    res.err = g.state.lastError || null;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=zj.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
