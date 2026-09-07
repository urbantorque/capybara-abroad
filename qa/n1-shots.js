async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(4800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const PLACES = [
    { b: 'venice', far: 2.6, yaw: 2.05, dist: 2.5 },
    { b: 'kyoto', far: 12.0, yaw: 2.05, dist: 2.6 },
    { b: 'goreme', far: 2.6, yaw: 2.05, dist: 2.5 },
    { b: 'sydney', far: 2.6, yaw: 2.05, dist: 2.5 },
    { b: 'antarctic', far: 2.6, yaw: 2.05, dist: 2.6 },
    { b: 'manly', far: 2.6, yaw: 2.05, dist: 2.5 },
  ];
  const log = [];
  for (const P of PLACES) {
    const r = await page.evaluate(async (o) => {
      const g = window.__capy;
      const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
      if (window.__pinStop) { window.__pinStop(); window.__pinStop = null; }
      g.completeTask('gather', true);
      g.completeTask('the-crossing', true);
      g.biome.switchTo(o.b);
      tick(120);
      let k = g.herdDebug().kinds[0];
      for (let w = 0; w < 40 && (!k || !k.n || !k.first); w++) { tick(60); k = g.herdDebug().kinds[0]; }
      if (!k || !k.first) return { b: o.b, err: 'nothing offered' };
      const px = k.first.x + o.far * 0.71, pz = k.first.z + o.far * 0.71;
      const pin = () => {
        g.capy.body.position.x = px; g.capy.body.position.z = pz;
        g.capy.body.velocity.set(0, 0, 0); g.capy.body.angularVelocity.set(0, 0, 0);
      };
      g.capy.body.position.set(px, k.first.y + 0.8, pz);
      tick(1);
      for (let i = 0; i < 240; i++) { pin(); g.tick(1 / 60, false); }
      for (let w = 0; w < 5; w++) {
        pin();
        g.events.emit('capy:wheek', { position: g.capy.position, soft: false });
        for (let i = 0; i < 30; i++) { pin(); g.tick(1 / 60, false); }
      }
      for (let i = 0; i < 60 * 26 && g.perchCount() < 1; i++) { pin(); g.tick(1 / 60, false); }
      // ...and hold it there while the REAL clock draws it. toDataURL comes
      // back blank without preserveDrawingBuffer (trap 27), so the picture has
      // to be a playwright screenshot of a page whose rAF is running — which
      // means the pin has to run on rAF too.
      let alive = true;
      const loop = () => { if (!alive) return; pin(); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
      window.__pinStop = () => { alive = false; };
      g.frameShot({ yaw: o.yaw, dist: o.dist, pitch: 0.52, hold: 30, w: 1 });
      return { b: o.b, on: g.perchCount(), debug: g.perchDebug() };
    }, P);
    log.push(r);
    await page.waitForTimeout(2200);
    await page.screenshot({ path: 'qa/N1c-' + P.b + '.png' });
  }
  await page.evaluate((o) => {
    if (window.__pinStop) window.__pinStop();
    return fetch('/shot?name=n1-shots.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, log);
}
