async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html');
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const R = {};
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('rio');
    const b = g.capy.body;
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
    b.position.set(0, g.rio.terrainHeight(0, -8) + 0.6, -8); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
    g.input.whistlePressed = true; g.tick(1 / 60, false);
    for (let i = 0; i < 240; i++) g.tick(1 / 60, false);
    g.input.whistlePressed = true; g.tick(1 / 60, false);
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
    window.__R = { after: g.condor.state, trace: [] };
  });
  R.a = await page.evaluate(() => window.__R);
  // board, in short slices
  for (let slice = 0; slice < 6; slice++) {
    const s = await page.evaluate(() => {
      const g = window.__capy;
      const b = g.capy.body;
      let boarded = false;
      for (let i = 0; i < 400; i++) {
        if (i % 20 === 0 && g.condor.body) {
          const cb = g.condor.body.position;
          const y = Math.max(g.rio.terrainHeight(cb.x, cb.z) + 0.4, cb.y - 2.0);
          b.position.set(cb.x, y, cb.z); b.velocity.set(0, 0, 0);
          b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        }
        if (g.condor.talonInReach()) g.input.actionPressed = true;
        g.tick(1 / 60, false);
        if (g.condor.mounted) { boarded = true; break; }
      }
      return { boarded: boarded, state: g.condor.state, err: g.state.lastError || null,
               y: +g.condor.body.position.y.toFixed(1) };
    });
    R['slice' + slice] = s;
    if (s.boarded) break;
  }
  // fly for a bit
  for (let slice = 0; slice < 5; slice++) {
    R['fly' + slice] = await page.evaluate(() => {
      const g = window.__capy;
      for (let i = 0; i < 400; i++) g.tick(1 / 60, false);
      return { mounted: !!g.condor.mounted, state: g.condor.state,
               ride: !!g.taskDone('fragata-ride'),
               y: +g.capy.position.y.toFixed(1), err: g.state.lastError || null };
    });
    if (R['fly' + slice].ride) break;
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-rio4.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, R);
}
