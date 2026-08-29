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
  R.glacier = await page.evaluate(() => {
    const g = window.__capy; const A = g.iceland; const b = g.capy.body;
    const X = -16;
    let z = -180;
    b.position.set(X, A.terrainHeight(X, z) + 0.5, z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
    const armed0 = A.sliding();
    const trace = [];
    for (let i = 0; i < 900; i++) {
      z += 12 / 60;
      b.position.set(X, A.terrainHeight(X, z) + 0.5, z);
      b.velocity.set(0, 0, 12);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.tick(1 / 60, false);
      if (i % 100 === 0) trace.push([+z.toFixed(0), A.sliding(), !!g.taskDone('glacier-run')]);
      if (g.taskDone('glacier-run')) break;
      if (z > -70) break;
    }
    return { armed0: armed0, done: !!g.taskDone('glacier-run'), trace: trace,
             z: +g.capy.position.z.toFixed(1), sliding: A.sliding(),
             slipTop: +A.groundSlip(X, -180).toFixed(2),
             slipMid: +A.groundSlip(X, -120).toFixed(2),
             slipEnd: +A.groundSlip(X, -80).toFixed(2),
             err: g.state.lastError || null };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-ice4.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, R);
}
