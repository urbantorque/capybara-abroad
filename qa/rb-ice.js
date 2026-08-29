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
    window.__put = function (x, y, z) {
      const b = g.capy.body;
      b.position.set(x, y, z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      b.angularVelocity.set(0, 0, 0);
    };
  });
  // --- pylsa / organ / puffins -----------------------------------------
  R.simple = await page.evaluate(() => {
    const g = window.__capy; const A = g.iceland; const put = window.__put;
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
    return S;
  });
  // --- geysir ----------------------------------------------------------
  R.geysir = await page.evaluate(() => {
    const g = window.__capy; const A = g.iceland; const put = window.__put;
    put(A.strokkur.x, A.terrainHeight(A.strokkur.x, A.strokkur.z) + 0.5, A.strokkur.z);
    for (let i = 0; i < 1500; i++) {
      g.tick(1 / 60, false);
      if (g.taskDone('geysir')) break;
      if (i % 30 === 0 && !g.taskDone('geysir') && g.capy.grounded) {
        put(A.strokkur.x, A.terrainHeight(A.strokkur.x, A.strokkur.z) + 0.5, A.strokkur.z);
      }
    }
    return { done: !!g.taskDone('geysir'), phase: A.geyserPhase() };
  });
  // --- hot spring + aurora --------------------------------------------
  R.spring = await page.evaluate(() => {
    const g = window.__capy; const A = g.iceland; const put = window.__put;
    put(A.spring.x, 0.2, A.spring.z);
    for (let i = 0; i < 900; i++) {
      g.tick(1 / 60, false);
      if (g.taskDone('hot-spring')) break;
    }
    return { done: !!g.taskDone('hot-spring'), soak: +A.soak().toFixed(2),
             y: +g.capy.position.y.toFixed(2) };
  });
  R.aurora = await page.evaluate(() => {
    const g = window.__capy; const A = g.iceland;
    for (let i = 0; i < 1800; i++) { g.tick(1 / 60, false); if (g.taskDone('aurora')) break; }
    return { done: !!g.taskDone('aurora'), aurora: +A.aurora().toFixed(2) };
  });
  // --- snowcat ---------------------------------------------------------
  R.snowcat = await page.evaluate(() => {
    const g = window.__capy; const A = g.iceland; const put = window.__put;
    for (let i = 0; i < 3000; i++) {
      const s = A.snowcat();
      put(s.x, s.y + 0.8, s.z);
      g.tick(1 / 60, false);
      if (g.taskDone('snowcat')) break;
    }
    return { done: !!g.taskDone('snowcat') };
  });
  // --- glacier run -----------------------------------------------------
  R.glacier = await page.evaluate(() => {
    const g = window.__capy; const A = g.iceland;
    const b = g.capy.body;
    const X = -16;
    let z = -180;
    b.position.set(X, A.terrainHeight(X, z) + 0.5, z);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
    const armed0 = A.sliding();
    // drive it down at 12 m/s by rewriting position AND velocity each frame
    for (let i = 0; i < 900; i++) {
      z += 12 / 60;
      b.position.set(X, A.terrainHeight(X, z) + 0.5, z);
      b.velocity.set(0, 0, 12);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.tick(1 / 60, false);
      if (g.taskDone('glacier-run')) break;
      if (z > -70) break;
    }
    return { armed0: armed0, done: !!g.taskDone('glacier-run'),
             z: +g.capy.position.z.toFixed(1), sliding: A.sliding() };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-ice.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, R);
}
