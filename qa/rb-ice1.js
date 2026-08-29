async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html');
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const R = {};
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('iceland');
    for (let i = 0; i < 180; i++) g.tick(1 / 60, false);
  });
  R.geysir = await page.evaluate(() => {
    const g = window.__capy; const A = g.iceland; const b = g.capy.body;
    const put = (x, y, z) => { b.position.set(x, y, z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
    put(A.strokkur.x, A.terrainHeight(A.strokkur.x, A.strokkur.z) + 0.5, A.strokkur.z);
    let n = 0;
    for (let i = 0; i < 1500; i++) {
      g.tick(1 / 60, false); n++;
      if (g.taskDone('geysir')) break;
      if (i % 60 === 0 && g.capy.grounded) {
        put(A.strokkur.x, A.terrainHeight(A.strokkur.x, A.strokkur.z) + 0.5, A.strokkur.z);
      }
    }
    return { done: !!g.taskDone('geysir'), ticks: n, phase: A.geyserPhase(),
             err: g.state.lastError || null };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-ice1.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, R);
}
