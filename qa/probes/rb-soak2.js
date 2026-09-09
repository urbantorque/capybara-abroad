async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html?cb=' + Math.random());
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);
  const names = ['cali', 'rio', 'iceland', 'sahara', 'drift'];
  const out = {};
  for (const n of names) {
    await page.evaluate((name) => {
      const g = window.__capy;
      g.state.lastError = null;
      g.biome.switchTo(name);
    }, n);
    await page.waitForTimeout(1200);
    // real keys, real clock, audio unlocked
    const keys = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
    for (let r = 0; r < 5; r++) {
      const k = keys[r % 4];
      await page.keyboard.down(k === 'KeyW' ? 'w' : k === 'KeyA' ? 'a' : k === 'KeyS' ? 's' : 'd');
      await page.waitForTimeout(600);
      await page.keyboard.up(k === 'KeyW' ? 'w' : k === 'KeyA' ? 'a' : k === 'KeyS' ? 's' : 'd');
      if (r % 3 === 0) await page.keyboard.press('e');
      if (r % 3 === 1) await page.keyboard.press('q');
      if (r % 3 === 2) await page.keyboard.press(' ');
      await page.waitForTimeout(220);
    }
    out[n] = await page.evaluate(() => {
      const g = window.__capy;
      const p = g.capy.position;
      const api = g[g.biome.current];
      return { biome: g.biome.current, err: g.state.lastError || null,
               pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)],
               finite: (p.x === p.x && p.y === p.y && p.z === p.z),
               bodies: g.world.bodies.length,
               under: api && api.terrainHeight ? +(p.y - api.terrainHeight(p.x, p.z)).toFixed(2) : null,
               score: Math.round(g.state.score || 0) };
    });
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-soak2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
