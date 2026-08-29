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
  R.grab = await page.evaluate(() => {
    const g = window.__capy; const A = g.drift; const b = g.capy.body;
    const sd = A.seed();
    b.position.set(sd.x, sd.y - 1.0, sd.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i = 0; i < 10; i++) g.tick(1 / 60, false);
    g.input.actionPressed = true; g.tick(1 / 60, false);
    return { onSeed: A.onSeed(), err: g.state.lastError || null };
  });
  for (let k = 0; k < 8; k++) {
    R['ride' + k] = await page.evaluate(() => {
      const g = window.__capy; const A = g.drift;
      for (let i = 0; i < 900; i++) {
        g.tick(1 / 60, false);
        if (!A.onSeed()) break;
        if (g.taskDone('driftseed')) break;
      }
      return { onSeed: A.onSeed(), ride: +A.seedRide().toFixed(1),
               done: !!g.taskDone('driftseed'), y: +g.capy.position.y.toFixed(1),
               err: g.state.lastError || null };
    });
    if (R['ride' + k].done || !R['ride' + k].onSeed) break;
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-dri2b.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, R);
}
