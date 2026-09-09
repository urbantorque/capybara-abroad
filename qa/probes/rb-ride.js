async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html?cb=' + Math.random());
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const R = {};
  // ---- SAHARA: the caravan, hands off ---------------------------------
  await page.evaluate(() => {
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
    window.__saddle = saddle;
    if (saddle) {
      b.position.set(saddle.position.x, saddle.position.y + 0.62, saddle.position.z);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    }
  });
  for (let k = 0; k < 8; k++) {
    R['car' + k] = await page.evaluate(() => {
      const g = window.__capy; const A = g.sahara; const s = window.__saddle;
      for (let i = 0; i < 500; i++) { g.tick(1 / 60, false); if (g.taskDone('caravan')) break; }
      return { riding: A.riding(), done: !!g.taskDone('caravan'),
               dx: s ? +(g.capy.position.x - s.position.x).toFixed(2) : null,
               dy: s ? +(g.capy.position.y - s.position.y).toFixed(2) : null,
               err: g.state.lastError || null };
    });
    if (R['car' + k].done || !R['car' + k].riding) break;
  }
  // ---- CALI: the chiva roof, hands off --------------------------------
  await page.evaluate(() => {
    const g = window.__capy; const A = g.cali;
    g.biome.switchTo('cali');
    for (let i = 0; i < 180; i++) g.tick(1 / 60, false);
    const b = g.capy.body;
    const ch = A.chivaAt();
    b.position.set(ch.x, ch.y + 4.1, ch.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
  });
  for (let k = 0; k < 14; k++) {
    R['chiva' + k] = await page.evaluate(() => {
      const g = window.__capy; const A = g.cali;
      for (let i = 0; i < 600; i++) { g.tick(1 / 60, false); if (g.taskDone('chiva-mirador')) break; }
      const ch = A.chivaAt();
      return { onRoof: A.onChiva(), state: A.chivaState(),
               prog: +A.rideProgress().toFixed(2),
               dx: +(g.capy.position.x - ch.x).toFixed(2),
               dz: +(g.capy.position.z - ch.z).toFixed(2),
               dy: +(g.capy.position.y - ch.y).toFixed(2),
               ride: !!g.taskDone('chiva-ride'), mir: !!g.taskDone('chiva-mirador'),
               err: g.state.lastError || null };
    });
    if (R['chiva' + k].mir) break;
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-ride.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, R);
}
