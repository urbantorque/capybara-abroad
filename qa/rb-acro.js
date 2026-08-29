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
  R.acro = await page.evaluate(() => {
    const g = window.__capy; const A = g.sahara; const b = g.capy.body;
    const m = A.acrobatMat();
    const gy = A.terrainHeight(m.x, m.z);
    b.position.set(m.x, gy + 0.5, m.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false);
    const S = { onMatBefore: [+g.capy.position.x.toFixed(2), +g.capy.position.y.toFixed(2), +g.capy.position.z.toFixed(2)],
                gy: +gy.toFixed(2), trace: [] };
    g.input.actionPressed = true; g.tick(1 / 60, false);
    for (let i = 0; i < 300; i++) {
      g.tick(1 / 60, false);
      if (i % 4 === 0) {
        S.trace.push([i, +(g.capy.position.y - gy).toFixed(2), +b.velocity.y.toFixed(2),
                      A.acrobatFlying(), !!g.capy.grounded]);
      }
      if (S.trace.length > 60) break;
    }
    S.apex = +A.acrobatTop().toFixed(2);
    S.done = !!g.taskDone('acrobats');
    S.gravity = +g.world.gravity.y.toFixed(2);
    S.err = g.state.lastError || null;
    return S;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-acro.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, R);
}
