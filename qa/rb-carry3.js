async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html?cb=' + Math.random());
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const R = await page.evaluate(() => {
    const g = window.__capy; const A = g.rio;
    g.biome.switchTo('rio');
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
    const b = g.capy.body;
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
    const S = { foundCab: true, rows: [], lost: -1 };
    let px = cab.position.x, py = cab.position.y, pz = cab.position.z;
    for (let i = 0; i < 2600; i++) {
      g.tick(1 / 60, false);
      const dx = Math.abs(g.capy.position.x - cab.position.x);
      const dz = Math.abs(g.capy.position.z - cab.position.z);
      const dy = g.capy.position.y - cab.position.y;
      if (S.lost < 0 && (dx > 1.4 || dz > 1.4 || dy < -0.3)) {
        S.lost = i;
        S.lostAt = { x: +cab.position.x.toFixed(1), y: +cab.position.y.toFixed(1), z: +cab.position.z.toFixed(1),
                     terr: +A.terrainHeight(cab.position.x, cab.position.z).toFixed(1),
                     vy: +((cab.position.y - py) * 60).toFixed(2),
                     vx: +((cab.position.x - px) * 60).toFixed(2),
                     vz: +((cab.position.z - pz) * 60).toFixed(2),
                     dx: +dx.toFixed(2), dz: +dz.toFixed(2), dy: +dy.toFixed(2),
                     gnd: g.capy.grounded };
      }
      if (i % 100 === 0) {
        S.rows.push([i, +cab.position.y.toFixed(1),
                     +A.terrainHeight(cab.position.x, cab.position.z).toFixed(1),
                     +((cab.position.y - py) * 60).toFixed(2),
                     +dx.toFixed(2), +dz.toFixed(2), +dy.toFixed(2)]);
      }
      px = cab.position.x; py = cab.position.y; pz = cab.position.z;
      if (g.taskDone('bondinho')) break;
    }
    S.done = !!g.taskDone('bondinho');
    S.err = g.state.lastError || null;
    return S;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-carry3.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, R);
}
