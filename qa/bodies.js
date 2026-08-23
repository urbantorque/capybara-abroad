async page => {
  await page.reload();
  await page.waitForFunction(() => window.__capy && window.__capy.biome, null, { timeout: 30000 });
  await page.keyboard.press('Digit1');
  await page.waitForFunction(() => window.__capy.biome.current === 'sydney', null, { timeout: 20000 });
  const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme'];
  const out = [];
  for (const n of names) {
    await page.evaluate(x => window.__capy.biome.switchTo(x), n);
    await page.waitForTimeout(2200);
    const s = await page.evaluate(() => {
      const g = window.__capy;
      return { want: null, got: g.biome.current, bodies: g.world.bodies.length,
               tris: g.renderer.info.render.triangles, calls: g.renderer.info.render.calls };
    });
    s.want = n;
    out.push(s);
  }
  await page.evaluate(async o => {
    await fetch('/shot?name=bodies.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
