async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html?cb=' + Math.random());
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const R = {};
  // ---- ICELAND: the whale --------------------------------------------
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('iceland');
    for (let i = 0; i < 180; i++) g.tick(1 / 60, false);
  });
  for (let k = 0; k < 6; k++) {
    R['whale' + k] = await page.evaluate(() => {
      const g = window.__capy; const A = g.iceland; const b = g.capy.body;
      for (let i = 0; i < 900; i++) {
        if (i % 30 === 0) {
          b.position.set(A.pier.x, A.terrainHeight(A.pier.x, A.pier.z) + 0.6, A.pier.z);
          b.velocity.set(0, 0, 0);
          b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        }
        g.tick(1 / 60, false);
        if (g.taskDone('the-whale')) break;
      }
      return { done: !!g.taskDone('the-whale'), up: A.whaleUp(),
               y: +g.capy.position.y.toFixed(2), err: g.state.lastError || null };
    });
    if (R['whale' + k].done) break;
  }
  // ---- DRIFT: the seed -----------------------------------------------
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('drift');
    for (let i = 0; i < 180; i++) g.tick(1 / 60, false);
  });
  R.grab = await page.evaluate(() => {
    const g = window.__capy; const A = g.drift; const b = g.capy.body;
    const sd = A.seed();
    b.position.set(sd.x, sd.y - 1.2, sd.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i = 0; i < 10; i++) g.tick(1 / 60, false);
    g.input.actionPressed = true; g.tick(1 / 60, false);
    return { onSeed: A.onSeed(), err: g.state.lastError || null };
  });
  for (let k = 0; k < 10; k++) {
    R['seed' + k] = await page.evaluate(() => {
      const g = window.__capy; const A = g.drift;
      for (let i = 0; i < 600; i++) {
        g.tick(1 / 60, false);
        if (!A.onSeed()) break;
        if (g.taskDone('driftseed')) break;
      }
      return { onSeed: A.onSeed(), ride: +A.seedRide().toFixed(1),
               done: !!g.taskDone('driftseed'), y: +g.capy.position.y.toFixed(1),
               err: g.state.lastError || null };
    });
    if (R['seed' + k].done || !R['seed' + k].onSeed) break;
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-rest.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, R);
}
