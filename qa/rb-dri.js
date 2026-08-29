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
  // puff-up + cloud-dive + handed-back
  R.air = await page.evaluate(() => {
    const g = window.__capy; const A = g.drift; const b = g.capy.body;
    const S = {};
    // step off the shelf and puff on the way down
    b.position.set(30, 34, 60); b.velocity.set(0, -3, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
    g.input.honkPressed = true; g.tick(1 / 60, false);
    for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
    S['puff-up'] = !!g.taskDone('puff-up');
    // now all the way down into the cloud
    for (let i = 0; i < 900; i++) {
      g.tick(1 / 60, false);
      if (g.taskDone('cloud-dive') && g.taskDone('handed-back')) break;
    }
    S['cloud-dive'] = !!g.taskDone('cloud-dive');
    S['handed-back'] = !!g.taskDone('handed-back');
    S.y = +g.capy.position.y.toFixed(2);
    S.err = g.state.lastError || null;
    return S;
  });
  // weathervane
  R.vane = await page.evaluate(() => {
    const g = window.__capy; const A = g.drift; const b = g.capy.body;
    const v = A.vane;
    for (let i = 0; i < 2400; i++) {
      if (i % 20 === 0) {
        b.position.set(v.x, A.terrainHeight(v.x, v.z) + 0.4, v.z); b.velocity.set(0, 0, 0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      }
      g.tick(1 / 60, false);
      if (g.taskDone('weathervane')) break;
    }
    return { done: !!g.taskDone('weathervane'), watch: +A.vaneWatch().toFixed(1),
             err: g.state.lastError || null };
  });
  // updraft
  R.col = await page.evaluate(() => {
    const g = window.__capy; const A = g.drift; const b = g.capy.body;
    const c = A.column;
    b.position.set(c.x, 6, c.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    let top = 6;
    for (let i = 0; i < 2400; i++) {
      g.tick(1 / 60, false);
      const p = g.capy.position;
      if (p.y > top) top = p.y;
      // keep it in the shaft against the crosswind
      if (i % 10 === 0) {
        b.position.x = c.x; b.position.z = c.z;
        b.previousPosition.x = c.x; b.previousPosition.z = c.z;
        b.interpolatedPosition.x = c.x; b.interpolatedPosition.z = c.z;
      }
      if (g.taskDone('updraft')) break;
    }
    return { done: !!g.taskDone('updraft'), top: +top.toFixed(1), err: g.state.lastError || null };
  });
  // wander-isle
  R.wander = await page.evaluate(() => {
    const g = window.__capy; const A = g.drift; const b = g.capy.body;
    const w = A.wanderer();
    b.position.set(w.x, A.terrainHeight(w.x, w.z) + 1.2, w.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    const rows = [];
    for (let i = 0; i < 1500; i++) {
      g.tick(1 / 60, false);
      if (i % 100 === 0) {
        const q = A.wanderer();
        rows.push([i, +(g.capy.position.x - q.x).toFixed(2), +(g.capy.position.z - q.z).toFixed(2),
                   +g.capy.position.y.toFixed(2), g.capy.grounded ? 1 : 0]);
      }
      if (g.taskDone('wander-isle')) break;
    }
    return { done: !!g.taskDone('wander-isle'), rows: rows, err: g.state.lastError || null };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-dri.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, R);
}
