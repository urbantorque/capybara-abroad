async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html');
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const R = {};
  // ---- RIO: the cable car ---------------------------------------------
  R.cabin = await page.evaluate(() => {
    const g = window.__capy; const A = g.rio;
    g.biome.switchTo('rio');
    for (let i = 0; i < 240; i++) g.tick(1 / 60, false);
    const b = g.capy.body;
    const c = A.cabin();
    // the floor collider sits 1.3 below the drawn group (see rioUpdateCabin)
    const fy = c.position.y - 1.3;
    b.position.set(c.position.x, fy + 0.7, c.position.z);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    const S = { rows: [] };
    for (let i = 0; i < 1800; i++) {
      g.tick(1 / 60, false);
      if (i % 120 === 0) {
        const q = A.cabin();
        S.rows.push([i, A.riding() ? 1 : 0,
                     +(g.capy.position.x - q.position.x).toFixed(2),
                     +(g.capy.position.z - q.position.z).toFixed(2),
                     +(g.capy.position.y - q.position.y).toFixed(2)]);
      }
      if (g.taskDone('bondinho')) break;
    }
    S.done = !!g.taskDone('bondinho');
    S.err = g.state.lastError || null;
    return S;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-carry.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, R);
}
