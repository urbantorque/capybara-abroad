async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html');
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const R = {};
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('sahara');
    for (let i = 0; i < 180; i++) g.tick(1 / 60, false);
  });
  // ---- the caravan: does it carry, and what does the animal think? ----
  R.caravan = await page.evaluate(() => {
    const g = window.__capy; const A = g.sahara; const b = g.capy.body;
    // put the animal on the lead camel's blanket and then LEAVE IT ALONE
    const c = A.caravan();
    b.position.set(c.x, c.y + 3.4, c.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    const S = { trace: [], hasCarryFrame: typeof A.carryFrame === 'function' };
    for (let i = 0; i < 1800; i++) {
      g.tick(1 / 60, false);
      if (i % 120 === 0) {
        const q = A.caravan();
        S.trace.push([i, A.riding(), +(g.capy.position.x - q.x).toFixed(2),
                      +(g.capy.position.z - q.z).toFixed(2),
                      +(g.capy.position.y - q.y).toFixed(2),
                      +Math.hypot(b.velocity.x, b.velocity.z).toFixed(2)]);
      }
      if (g.taskDone('caravan')) break;
    }
    S.done = !!g.taskDone('caravan');
    S.err = g.state.lastError || null;
    return S;
  });
  // ---- the dune ------------------------------------------------------
  R.dune = await page.evaluate(() => {
    const g = window.__capy; const A = g.sahara; const b = g.capy.body;
    let x = 278;
    const z = A.duneTop.z;
    b.position.set(x, A.terrainHeight(x, z) + 0.5, z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
    const armed = A.surfing();
    for (let i = 0; i < 1200; i++) {
      x -= 9 / 60;
      b.position.set(x, A.terrainHeight(x, z) + 0.5, z);
      b.velocity.set(-9, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.tick(1 / 60, false);
      if (g.taskDone('dune-surf')) break;
      if (x < 190) break;
    }
    return { armed: armed, done: !!g.taskDone('dune-surf'), x: +x.toFixed(1),
             err: g.state.lastError || null };
  });
  // ---- the storm -----------------------------------------------------
  for (let k = 0; k < 6; k++) {
    R['storm' + k] = await page.evaluate(() => {
      const g = window.__capy; const A = g.sahara; const b = g.capy.body;
      for (let i = 0; i < 900; i++) {
        if (i % 30 === 0) {
          b.position.set(320, A.terrainHeight(320, 20) + 0.5, 20); b.velocity.set(0, 0, 0);
          b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        }
        g.tick(1 / 60, false);
        if (g.taskDone('sandstorm')) break;
      }
      return { done: !!g.taskDone('sandstorm'), storm: +A.storm().toFixed(2),
               dusk: +A.dusk().toFixed(2), err: g.state.lastError || null };
    });
    if (R['storm' + k].done) break;
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-sah2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, R);
}
