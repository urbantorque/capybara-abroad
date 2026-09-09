async page => {
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('quay');
    for (let i = 0; i < 200; i++) g.tick(1 / 60, false);
    const b = g.capy.body, api = g.quay;
    const f = api.freshwater();
    const rows = [];
    for (const d of [10, 30, 55, 80]) {
      b.position.set(f.x + d, -0.5 + 1.0, f.z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.input.x = 0; g.input.z = 0;
      for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
      const p = g.hud.audioProbe(f.x, -0.5 + 6.0, f.z);
      rows.push({ d: d, gain: +p.gain.toFixed(3), pan: +p.pan.toFixed(2) });
    }
    return { freshwater: [+f.x.toFixed(0), +f.z.toFixed(0)], rows: rows };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-horn.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
