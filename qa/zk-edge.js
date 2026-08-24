async page => {
  await page.reload(); await page.waitForTimeout(6000);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    g.biome.switchTo('quay');
    for (let i = 0; i < 120; i++) g.tick(1/60, false);
    const res = { walk: [], bounds: typeof g.quay.bounds };
    const b = g.capy.body;
    for (const [x, z] of [[0, 60], [0, 90], [0, 200], [200, 20], [-200, 20], [0, -600], [400, -300]]) {
      b.position.set(x, 6, z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      for (let i = 0; i < 240; i++) g.tick(1/60, false);
      const p = g.capy.position;
      res.walk.push([x, z, +p.x.toFixed(0), +p.y.toFixed(2), +p.z.toFixed(0)]);
    }
    res.err = g.state.lastError || null;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=zk.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
