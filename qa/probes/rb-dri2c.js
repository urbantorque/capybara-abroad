async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html');
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const R = {};
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('drift');
    for (let i = 0; i < 180; i++) g.tick(1 / 60, false);
  });
  R.gap = await page.evaluate(() => {
    const g = window.__capy; const A = g.drift; const b = g.capy.body;
    const s = A.shelf;
    b.position.set(s.x - 12, A.terrainHeight(s.x - 12, s.z) + 0.5, s.z);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
    g.capy.launch(14, 8, 0);
    for (let i = 0; i < 600; i++) { g.tick(1 / 60, false); if (g.taskDone('long-gap')) break; }
    return { done: !!g.taskDone('long-gap'),
             p: [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(1), +g.capy.position.z.toFixed(1)],
             err: g.state.lastError || null };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-dri2c.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, R);
}
