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
  R.spring = await page.evaluate(() => {
    const g = window.__capy; const A = g.iceland; const b = g.capy.body;
    b.position.set(A.spring.x, 0.2, A.spring.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i = 0; i < 900; i++) { g.tick(1 / 60, false); if (g.taskDone('hot-spring')) break; }
    return { done: !!g.taskDone('hot-spring'), soak: +A.soak().toFixed(2),
             y: +g.capy.position.y.toFixed(2), surf: +A.waterHeightAt(A.spring.x, A.spring.z).toFixed(2),
             err: g.state.lastError || null };
  });
  for (let k = 0; k < 4; k++) {
    R['aurora' + k] = await page.evaluate(() => {
      const g = window.__capy; const A = g.iceland;
      for (let i = 0; i < 500; i++) { g.tick(1 / 60, false); if (g.taskDone('aurora')) break; }
      return { done: !!g.taskDone('aurora'), a: +A.aurora().toFixed(2), err: g.state.lastError || null };
    });
    if (R['aurora' + k].done) break;
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-ice2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, R);
}
