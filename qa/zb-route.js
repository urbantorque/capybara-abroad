async page => {
  await page.reload(); await page.waitForTimeout(5200);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    g.biome.switchTo('pasto');
    for (let i = 0; i < 90; i++) g.tick(1/60, false);
    const res = { lanes: {} };
    // For each candidate lane x, walk the route and report where the float's
    // 1.62 m half-width is blocked.
    for (const lx of [0, 9.5, 10, 10.5, 11, -10, -10.5]) {
      const bad = [];
      for (let z = 7; z <= 43; z += 0.5) {
        if (g.pasto.navBlocked(lx, z, 1.62)) bad.push(+z.toFixed(1));
      }
      res.lanes[lx] = bad;
    }
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=zb.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
