async page => {
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('pasto');
    for (let i = 0; i < 200; i++) g.tick(1 / 60, false);
    const P = g.pasto.coffeePatio;
    const farmers = [];
    for (const r of (g.locals || [])) {
      if (r && r.kind === 'farmer')
        farmers.push({ at: [+r.x.toFixed(1), +r.z.toFixed(1)],
                       onPatio: Math.abs(r.x - P.x) < P.w / 2 && Math.abs(r.z - P.z) < P.d / 2,
                       dToPatio: +Math.hypot(r.x - P.x, r.z - P.z).toFixed(1) });
    }
    return { patio: { x: P.x, z: P.z, w: P.w, d: P.d, y: +P.y.toFixed(2) },
             farmers: farmers, locals: (g.locals || []).filter(r => r.biome === 'pasto').length };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-patio.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
