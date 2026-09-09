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
    b.position.set(c.x, c.y + 4.2, c.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    // find the saddle body: kinematic, one box, near the caravan point
    let saddle = null;
    for (const bd of g.world.bodies) {
      if (bd.mass !== 0) continue;
      if (bd.shapes.length !== 1) continue;
      const d = Math.hypot(bd.position.x - c.x, bd.position.z - c.z);
      if (d < 3 && Math.abs(bd.position.y - (c.y + 2.9)) < 0.6) { saddle = bd; break; }
    }
    const S = { foundSaddle: !!saddle, rows: [] };
    for (let i = 0; i < 360; i++) {
      g.tick(1 / 60, false);
      if (i % 6 === 0) {
        const q = A.caravan();
        const cf = A.carryFrame ? A.carryFrame() : null;
        S.rows.push([i, A.riding() ? 1 : 0,
                     +(g.capy.position.x - q.x).toFixed(2),
                     +b.velocity.x.toFixed(2),
                     saddle ? +saddle.velocity.x.toFixed(2) : null,
                     cf ? +cf.x.toFixed(2) : null,
                     g.capy.grounded ? 1 : 0]);
      }
    }
    S.err = g.state.lastError || null;
    return S;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-car3.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, R);
}
