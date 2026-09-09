async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html?cb=' + Math.random());
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const g = window.__capy;
    g.state.lastError = null;
    g.biome.switchTo('sahara');
  });
  await page.waitForTimeout(1500);
  const keys = ['w', 'a', 's', 'd'];
  for (let r = 0; r < 8; r++) {
    const k = keys[r % 4];
    await page.keyboard.down(k);
    await page.waitForTimeout(700);
    await page.keyboard.up(k);
    if (r % 3 === 0) await page.keyboard.press('e');
    if (r % 3 === 1) await page.keyboard.press('q');
    if (r % 3 === 2) await page.keyboard.press(' ');
    await page.waitForTimeout(200);
  }
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const p = g.capy.position;
    const api = g[g.biome.current];
    return { biome: g.biome.current, err: g.state.lastError || null,
             pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)],
             finite: (p.x === p.x && p.y === p.y && p.z === p.z),
             bodies: g.world.bodies.length,
             under: api && api.terrainHeight ? +(p.y - api.terrainHeight(p.x, p.z)).toFixed(2) : null };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-sk-sahara.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
