async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html?cb=' + Math.random());
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const R = await page.evaluate(() => {
    const g = window.__capy; const A = g.rio;
    g.biome.switchTo('rio');
    for (let i = 0; i < 240; i++) g.tick(1 / 60, false);
    const b = g.capy.body;
    // find the cabin's kinematic slab
    let cab = null;
    for (const bd of g.world.bodies) {
      if (bd.type !== 4) continue;
      const s = bd.shapes[0];
      if (bd.shapes.length === 1 && s && s.halfExtents &&
          Math.abs(s.halfExtents.x - 1.4) < 0.01 && Math.abs(s.halfExtents.y - 0.16) < 0.01) { cab = bd; break; }
    }
    if (!cab) return { foundCab: false };
    b.position.set(cab.position.x, cab.position.y + 0.6, cab.position.z);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    const S = { foundCab: true, rows: [] };
    for (let i = 0; i < 2400; i++) {
      g.tick(1 / 60, false);
      if (i % 150 === 0) {
        S.rows.push([i, A.riding() ? 1 : 0,
                     +(g.capy.position.x - cab.position.x).toFixed(2),
                     +(g.capy.position.z - cab.position.z).toFixed(2),
                     +(g.capy.position.y - cab.position.y).toFixed(2),
                     +cab.velocity.y.toFixed(2)]);
      }
      if (g.taskDone('bondinho')) break;
    }
    S.done = !!g.taskDone('bondinho');
    S.err = g.state.lastError || null;
    return S;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-carry2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, R);
}
