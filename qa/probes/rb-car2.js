async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html');
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const R = await page.evaluate(() => {
    const g = window.__capy; const A = g.sahara;
    g.biome.switchTo('sahara');
    for (let i = 0; i < 180; i++) g.tick(1 / 60, false);
    const b = g.capy.body;
    // find the caravan's kinematic saddle body
    let saddle = null;
    for (const bd of g.world.bodies) {
      if (bd.type !== 4 && bd.type !== 2) continue;   // KINEMATIC === 4 in cannon-es? check both
    }
    const c = A.caravan();
    b.position.set(c.x, c.y + 4.2, c.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    const S = { rows: [] };
    for (let i = 0; i < 420; i++) {
      g.tick(1 / 60, false);
      const q = A.caravan();
      if (i % 6 === 0) {
        S.rows.push([i, A.riding() ? 1 : 0,
                     +(g.capy.position.x - q.x).toFixed(2),
                     +(g.capy.position.z - q.z).toFixed(2),
                     +(g.capy.position.y - q.y - 2.9).toFixed(2),
                     g.capy.grounded ? 1 : 0,
                     +b.velocity.y.toFixed(2)]);
      }
    }
    S.done = !!g.taskDone('caravan');
    S.err = g.state.lastError || null;
    return S;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-car2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, R);
}
