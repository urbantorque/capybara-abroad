async page => {
  const NAMES = ['kowloon','pantanal','hanoi'];
  const out = [];
  for (const n of NAMES) {
    await page.reload();
    await page.waitForTimeout(4500);
    const r = await page.evaluate(async (name) => {
      const g = window.__capy;
      for (let w = 0; w < 300; w++) g.tick(1 / 60, false);
      g.biome.switchTo(name);
      for (let w = 0; w < 120; w++) g.tick(1 / 60, true);
      const gl = g.renderer.getContext();
      const t0 = performance.now();
      for (let f = 0; f < 240; f++) g.tick(1 / 60, true);
      gl.finish();
      const ms = (performance.now() - t0) / 240;
      return { name, biome: g.biome.current, msPerFrame: +ms.toFixed(2) };
    }, n);
    out.push(r);
  }
  await page.evaluate((o) => fetch('/shot?name=pol-perf.json', { method: 'POST',
    body: btoa(JSON.stringify(o)) }), out);
}
