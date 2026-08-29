async page => {
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const R = {};
    for (const n of ['sydney', 'pasto', 'quay', 'kyoto']) {
      g.biome.switchTo(n);
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false);
      const api = n === 'sydney' ? g.env : g[n];
      R[n] = {
        own: api && typeof api.bounds === 'function' ? api.bounds() : null,
        derived: g.biome.boundsOf ? g.biome.boundsOf(n) : 'no boundsOf',
      };
    }
    return R;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-b2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
