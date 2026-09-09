async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html?cb=' + Math.random());
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const R = await page.evaluate(() => {
    const g = window.__capy; const A = g.sahara; const b = g.capy.body;
    g.biome.switchTo('sahara');
    for (let i = 0; i < 180; i++) g.tick(1 / 60, false);
    const put = (x, y, z) => { b.position.set(x, y, z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
    // rob the cart to start the chase
    put(A.cart.x + 1.5, A.terrainHeight(A.cart.x + 1.5, A.cart.z) + 0.6, A.cart.z);
    for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
    g.input.actionPressed = true; g.tick(1 / 60, false);
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
    const S = { chasing: A.chasing(), rows: [] };
    // now go and be thrown
    const m = A.acrobatMat();
    const gy = A.terrainHeight(m.x, m.z);
    put(m.x, gy + 0.5, m.z);
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
    g.input.actionPressed = true; g.tick(1 / 60, false);
    for (let i = 0; i < 300; i++) {
      g.tick(1 / 60, false);
      if (i % 5 === 0) {
        S.rows.push([i, +(g.capy.position.y - gy).toFixed(2),
                     +b.velocity.y.toFixed(1), A.acrobatFlying() ? 1 : 0,
                     +A.chaseNear().toFixed(1), A.chasing() ? 1 : 0]);
      }
      if (S.rows.length > 46) break;
    }
    S.apex = +A.acrobatTop().toFixed(2);
    S.done = !!g.taskDone('acrobats');
    S.err = g.state.lastError || null;
    return S;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-acro2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, R);
}
