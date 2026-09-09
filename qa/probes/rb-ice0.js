async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html?cb=' + Math.random());
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const R = {};
  R.enter = await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('iceland');
    for (let i = 0; i < 180; i++) g.tick(1 / 60, false);
    return { biome: g.biome.current, err: g.state.lastError || null,
             y: +g.capy.position.y.toFixed(2) };
  });
  R.simple = await page.evaluate(() => {
    const g = window.__capy; const A = g.iceland;
    const b = g.capy.body;
    const put = (x, y, z) => { b.position.set(x, y, z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
    const S = {};
    put(A.pylsa.x + 1, A.terrainHeight(A.pylsa.x + 1, A.pylsa.z) + 0.6, A.pylsa.z);
    for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
    g.input.actionPressed = true; g.tick(1 / 60, false);
    for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
    S.pylsa = !!g.taskDone('pylsa');
    put(A.organ.x + 1, A.terrainHeight(A.organ.x + 1, A.organ.z) + 0.6, A.organ.z);
    for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
    g.input.actionPressed = true; g.tick(1 / 60, false);
    for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
    S.organ = !!g.taskDone('organ');
    S.organY = +(g.capy.position.y - A.terrainHeight(A.organ.x, A.organ.z)).toFixed(2);
    put(A.cliff.x, A.terrainHeight(A.cliff.x, A.cliff.z) + 0.7, A.cliff.z);
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
    S.cliffY = +g.capy.position.y.toFixed(2);
    g.input.honkPressed = true; g.tick(1 / 60, false);
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
    S.puffins = !!g.taskDone('puffins');
    S.err = g.state.lastError || null;
    return S;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-ice0.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, R);
}
