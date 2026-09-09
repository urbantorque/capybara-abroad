async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(4800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const LEGS = [
    { from: 'venice', to: 'antarctic' },
    { from: 'antarctic', to: 'venice' },
    { from: 'kyoto', to: 'sahara' },
    { from: 'goreme', to: 'monaco' },
  ];
  const log = [];
  for (const L of LEGS) {
    const r = await page.evaluate(async (a) => {
      const g = window.__capy;
      const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
      if (window.__pinStop) { window.__pinStop(); window.__pinStop = null; }
      g.completeTask('gather', true);
      g.completeTask('the-crossing', true);
      if (g.stowDebug().kind) { g.capy.launch(0, 8, 0); tick(220); }
      g.biome.switchTo(a.from);
      tick(150);
      let k = g.herdDebug().kinds[0];
      for (let w = 0; w < 40 && (!k || !k.n || !k.first); w++) { tick(60); k = g.herdDebug().kinds[0]; }
      if (!k || !k.first) return { leg: a.from + '->' + a.to, err: 'nothing offered' };
      const far = a.from === 'kyoto' ? 12.0 : 1.85;
      const px = k.first.x + far * 0.71, pz = k.first.z + far * 0.71;
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
      for (let i = 0; i < 60 * 26 && g.perchCount() < 1; i++) {
        pin();
        if (i > 0 && i % 600 === 0) g.events.emit('capy:wheek', { position: g.capy.position, soft: false });
        g.tick(1 / 60, false);
      }
      for (let i = 0; i < 90; i++) { pin(); g.tick(1 / 60, false); }
      if (!g.perchCount()) return { leg: a.from + '->' + a.to, err: 'never mounted' };
      g.biome.switchTo(a.to);
      const sp = g.biome.spawnOf(a.to);
      if (sp) { g.capy.body.position.set(sp.x, sp.y + 0.6, sp.z); g.capy.body.velocity.set(0, 0, 0); }
      tick(200);
      const at = { x: g.capy.position.x, z: g.capy.position.z };
      let alive = true;
      const loop = () => {
        if (!alive) return;
        g.capy.body.position.x = at.x; g.capy.body.position.z = at.z;
        g.capy.body.velocity.set(0, 0, 0);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      window.__pinStop = () => { alive = false; };
      g.frameShot({ yaw: 2.05, dist: 2.5, pitch: 0.5, hold: 30, w: 1 });
      return { leg: a.from + '->' + a.to, stow: g.stowDebug() };
    }, L);
    log.push(r);
    await page.waitForTimeout(2400);
    await page.screenshot({ path: 'qa/N3-' + L.from + '-' + L.to + '.png' });
    await page.evaluate(() => { if (window.__pinStop) window.__pinStop(); });
  }
  await page.evaluate((o) => fetch('/shot?name=n3-shot.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), log);
}
