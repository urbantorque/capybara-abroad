async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html');
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const R = { trace: [] };
    g.biome.switchTo('rio');
    const A = g.rio;
    const b = g.capy.body;
    function put(x, y, z) {
      b.position.set(x, y, z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      b.angularVelocity.set(0, 0, 0);
    }
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
    put(0, A.terrainHeight(0, -8) + 0.6, -8);
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
    // whistle once: summon
    g.input.whistlePressed = true; g.tick(1 / 60, false);
    for (let i = 0; i < 240; i++) g.tick(1 / 60, false);
    R.after1 = g.condor.state;
    // whistle again: bring it down
    g.input.whistlePressed = true; g.tick(1 / 60, false);
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
    R.after2 = g.condor.state;
    let boarded = false;
    for (let i = 0; i < 3000; i++) {
      if (i % 20 === 0) {
        const cb = g.condor.body.position;
        // stand directly under the bird
        put(cb.x, Math.max(A.terrainHeight(cb.x, cb.z) + 0.4, cb.y - 2.0), cb.z);
      }
      if (g.condor.talonInReach()) { g.input.actionPressed = true; }
      g.tick(1 / 60, false);
      if (g.condor.mounted) { boarded = true; break; }
      if (i % 300 === 0) R.trace.push([i, g.condor.state, +g.condor.body.position.y.toFixed(1)]);
    }
    R.boarded = boarded;
    R.stateAtBoard = g.condor.state;
    for (let i = 0; i < 2400; i++) g.tick(1 / 60, false);
    R['fragata-ride'] = !!g.taskDone('fragata-ride');
    R.fragata = !!g.taskDone('fragata');
    R.finalState = g.condor.state;
    R.capyY = +g.capy.position.y.toFixed(1);
    R.err = g.state.lastError || null;
    return R;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-rio3.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
