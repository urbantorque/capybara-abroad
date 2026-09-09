async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html');
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const R = {};
    g.biome.switchTo('rio');
    const A = g.rio;
    const b = g.capy.body;
    function step(n) { for (let i = 0; i < n; i++) g.tick(1 / 60, false); }
    function put(x, y, z) {
      b.position.set(x, y, z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      b.angularVelocity.set(0, 0, 0);
    }
    const done = id => !!g.taskDone(id);
    step(120);

    // ---- where does the kiosk counter actually hold you up? ----------
    const kx = A.kiosk.x, kstand = A.kiosk.z;
    const gy = A.terrainHeight(kx, kstand);
    R.kioskProbe = [];
    for (let dz = -1; dz <= 4; dz += 0.5) {
      put(kx, gy + 3.0, kstand + dz);
      step(60);
      const p = g.capy.position;
      R.kioskProbe.push([+dz.toFixed(1), +(p.y - gy).toFixed(2), +(p.z - kstand).toFixed(2)]);
    }
    // now try the press wherever it stood highest
    let bestDz = 0, bestY = -9;
    for (const row of R.kioskProbe) if (row[1] > bestY) { bestY = row[1]; bestDz = row[0]; }
    R.bestDz = bestDz; R.bestY = bestY;
    put(kx, gy + 3.0, kstand + bestDz);
    step(90);
    g.input.actionPressed = true; g.tick(1 / 60, false);
    step(20);
    R.kiosk = done('kiosk');
    R.kioskStandY = +(g.capy.position.y - gy).toFixed(2);

    // ---- the fragata --------------------------------------------------
    put(0, A.terrainHeight(0, -8) + 0.6, -8);
    step(60);
    R.condorBefore = g.condor ? g.condor.state : 'no-condor';
    if (g.condor && g.condor.summon) g.condor.summon();
    step(60);
    R.fragata = done('fragata');
    R.condorAfter = g.condor ? g.condor.state : null;
    // wait for it to come within reach, then board
    let boarded = false;
    for (let i = 0; i < 6000; i++) {
      g.tick(1 / 60, false);
      if (g.condor && g.condor.talonInReach && g.condor.talonInReach()) {
        g.input.actionPressed = true;
        g.tick(1 / 60, false);
        if (g.condor.mounted) { boarded = true; break; }
      }
      if (i % 600 === 0 && g.condor && g.condor.body) {
        // walk under the bird so it can pick us up
        const cb = g.condor.body.position;
        put(cb.x, A.terrainHeight(cb.x, cb.z) + 0.6, cb.z);
      }
    }
    R.boarded = boarded;
    R.condorState = g.condor ? g.condor.state : null;
    step(1200);
    R['fragata-ride'] = done('fragata-ride');
    R.err = g.state.lastError || null;
    return R;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-rio2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
