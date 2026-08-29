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
    const c = A.caravan();
    let saddle = null;
    for (const bd of g.world.bodies) {
      if (bd.mass !== 0 || bd.shapes.length !== 1) continue;
      const d = Math.hypot(bd.position.x - c.x, bd.position.z - c.z);
      if (d < 3 && Math.abs(bd.position.y - (c.y + 2.9)) < 0.6) { saddle = bd; break; }
    }
    if (!saddle) return { foundSaddle: false };
    // put the animal exactly on the blanket
    b.position.set(saddle.position.x, saddle.position.y + 0.62, saddle.position.z);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    const S = { foundSaddle: true, rows: [] };
    for (let i = 0; i < 900; i++) {
      g.tick(1 / 60, false);
      if (i % 30 === 0) {
        S.rows.push([i, A.riding() ? 1 : 0,
                     +(g.capy.position.x - saddle.position.x).toFixed(2),
                     +(g.capy.position.z - saddle.position.z).toFixed(2),
                     +(g.capy.position.y - saddle.position.y).toFixed(2),
                     +b.velocity.x.toFixed(2), +saddle.velocity.x.toFixed(2)]);
      }
      if (g.taskDone('caravan')) break;
    }
    S.done = !!g.taskDone('caravan');
    S.t = +g.sahara.caravan().x.toFixed(1);
    S.err = g.state.lastError || null;
    return S;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-car5b.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, R);
}
