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
  for (let k = 0; k < 6; k++) {
    R['cat' + k] = await page.evaluate(() => {
      const g = window.__capy; const A = g.iceland; const b = g.capy.body;
      for (let i = 0; i < 500; i++) {
        const s = A.snowcat();
        b.position.set(s.x, s.y + 0.8, s.z); b.velocity.set(0, 0, 0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        g.tick(1 / 60, false);
        if (g.taskDone('snowcat')) break;
      }
      return { done: !!g.taskDone('snowcat'), err: g.state.lastError || null };
    });
    if (R['cat' + k].done) break;
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-ice3.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, R);
}
