async page => {
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const R = {};
    g.biome.switchTo('sydney');
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
    const b = g.capy.body, api = g.env;
    // ---- the planted flowers -------------------------------------------
    const fl = [];
    for (const p of g.props) if (p && p.type === 'flower')
      fl.push({ planted: !!p.planted, biome: p.biome || '',
                at: [+p.body.position.x.toFixed(1), +p.body.position.y.toFixed(2), +p.body.position.z.toFixed(1)],
                nav: api.navBlocked ? api.navBlocked(p.body.position.x, p.body.position.z, 0.45) : null });
    R.flowers = fl;
    R.beds = api.flowerBeds;
    // ---- the bins -------------------------------------------------------
    const bins = [];
    for (const p of g.props) if (p && p.type === 'bin')
      bins.push({ biome: p.biome || '', mass: p.mass, tipped: !!p.tipped,
                  at: [+p.body.position.x.toFixed(1), +p.body.position.y.toFixed(2), +p.body.position.z.toFixed(1)] });
    R.bins = bins;
    return R;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-diag1.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
