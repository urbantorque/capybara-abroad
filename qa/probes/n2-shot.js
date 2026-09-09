async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(4800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const g = window.__capy;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    g.completeTask('gather', true);
    g.biome.switchTo('venice');
    tick(120);
    const k = g.herdDebug().kinds[0];
    const px = k.first.x + 1.85, pz = k.first.z + 1.85;
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
    for (let i = 0; i < 60 * 22; i++) {
      pin();
      if (i > 0 && i % 600 === 0) g.events.emit('capy:wheek', { position: g.capy.position, soft: false });
      g.tick(1 / 60, false);
    }
    let alive = true;
    const loop = () => { if (!alive) return; pin(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    window.__pinStop = () => { alive = false; };
    g.frameShot({ yaw: 2.05, dist: 2.4, pitch: 0.52, hold: 30, w: 1 });
    return { on: g.perchCount(), most: g.perchDebug().most, err: g.state.lastError || null };
  });
  await page.waitForTimeout(2400);
  await page.screenshot({ path: 'qa/N2-perch.png' });
  await page.evaluate(() => { if (window.__pinStop) window.__pinStop(); });
  // ...and the leaf, which is the other half of this batch
  await page.evaluate(() => { window.__capy.hud.ledger(); });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'qa/N2-leaf.png' });
  await page.evaluate((o) => fetch('/shot?name=n2-shot.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), r);
}
