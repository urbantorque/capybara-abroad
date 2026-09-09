async page => {
  await page.reload();
  await page.waitForTimeout(5500);
  await page.keyboard.press('Digit1');
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(1000);
    const b = await page.evaluate(() => {
      const g = window.__capy;
      return g && g.biome ? g.biome.current : null;
    });
    if (b === 'sydney') break;
  }
  await page.waitForTimeout(2000);

  const names = ['sydney', 'pasto', 'quay', 'kyoto', 'iceland', 'sahara',
                 'venice', 'kowloon', 'goreme', 'palawan', 'monaco', 'hanoi'];
  const out = { tag: 'BATCH3C', rows: [] };
  for (const n of names) {
    const row = await page.evaluate(name => {
      const g = window.__capy;
      g.biome.switchTo(name);
      const s = g.biome.spawnOf ? g.biome.spawnOf(name) : null;
      if (s && g.capy && g.capy.body) {
        g.capy.body.position.set(s.x, s.y + 0.4, s.z);
        g.capy.body.velocity.set(0, 0, 0);
      }
      let nan = 0;
      for (let c = 0; c < 3; c++) {
        for (let i = 0; i < 400; i++) g.tick(1 / 60, false);
        const p = g.capy && g.capy.position;
        if (p && (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z))) nan++;
      }
      return { want: name, biome: g.biome.current, nan: nan,
               bodies: g.world.bodies.length,
               tris: g.renderer.info.render.triangles,
               lastError: g.state.lastError || null };
    }, n);
    out.rows.push(row);
  }
  await page.evaluate(payload => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 1))));
    return fetch('/shot?name=batch3c-result.json', { method: 'POST', body: s });
  }, out);
}
