async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2600);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const R = {};
    function api(n) { return n === 'sydney' ? g.env : g[n]; }
    function tp(x, z, dy) {
      const b = g.capy.body, a = api(g.biome.current);
      let y = 0; try { y = a.terrainHeight(x, z); } catch (e) { y = 0; }
      b.position.set(x, y + (dy === undefined ? 0.45 : dy), z);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      b.velocity.set(0, 0, 0); b.wakeUp();
      g.capy.position.set(b.position.x, b.position.y, b.position.z);
    }
    function run(n) { for (let i = 0; i < n; i++) g.tick(1 / 60, false); }
    g.biome.switchTo('sydney'); run(30);
    const e = api('sydney');
    const sp = e.sprinklers[0];
    tp(sp.x, sp.z); run(30);
    R.on = sp.on;
    tp(sp.x + 1.6, sp.z);
    let wetMax = 0, inArc = 0;
    for (let i = 0; i < 700; i++) { g.tick(1/60, false); if (g.capy.wet > wetMax) wetMax = g.capy.wet; if (sp.sprays(g.capy.position.x, g.capy.position.z)) inArc++; }
    R.wetMax = +wetMax.toFixed(3); R.arcFrames = inArc;
    R.grounded = g.capy.grounded;
    R['the-sprinkler'] = g.noticed('the-sprinkler');
    // ---- the queue -------------------------------------------------------
    let w = 0; while (!e.vanParked() && w < 9000) { g.tick(1/60, false); w++; }
    R.vanParked = e.vanParked(); R.vanWait = w;
    const q0 = e.vanQueueSpot(1); tp(q0.x, q0.z);
    let held = 0;
    for (let i = 0; i < 600; i++) {
      g.tick(1/60, false);
      const q = e.vanQueueSpot(1);
      const d = Math.hypot(g.capy.position.x - q.x, g.capy.position.z - q.z);
      if (d < 1.7) held++;
      if (d > 1.0) tp(q.x, q.z);
    }
    R.queueHeld = held; R.dwellLeft = +e.vanDwellLeft().toFixed(1);
    R['the-queue'] = g.noticed('the-queue');
    R.lastError = g.state.lastError || null;
    return R;
  });
  await page.evaluate((o) => fetch('/shot?name=dl-fire1.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
