async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(4800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const o = { steps: [] };
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    g.completeTask('gather', true);
    g.completeTask('the-crossing', true);
    // Venice, because it is the only chapter where three of one animal fit
    // (span 1, a hundred and eighty of them) — `full-house` is unreachable
    // anywhere the ridable animal takes two seats.
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
    for (let i = 0; i < 60 * 24; i++) {
      pin();
      if (i > 0 && i % 600 === 0) g.events.emit('capy:wheek', { position: g.capy.position, soft: false });
      g.tick(1 / 60, false);
    }
    o.on = g.perchCount();
    o.most = g.perchDebug().most;
    // ---- and then walk fifty metres with it, for `carried-on` ------------
    // WRITING `body.velocity` IS NOT WALKING. capybara.js's idle grip runs at
    // lambda 60 while the animal is grounded and the snap zeroes anything under
    // 0.9 m/s, so a per-frame velocity write moves a loafing capybara 1.5 m in
    // forty seconds — measured — and `carried-on` read as unreachable against a
    // find that is fine. A key, dispatched on window, is the only honest input.
    const key = (t, code) => window.dispatchEvent(
      new KeyboardEvent(t, { code: code, key: 'w', bubbles: true }));
    key('keydown', 'KeyW');
    let dist = 0;
    let last = { x: g.capy.position.x, z: g.capy.position.z };
    for (let i = 0; i < 60 * 40 && dist < 70; i++) {
      if (i % 240 === 0) g.events.emit('capy:wheek', { position: g.capy.position, soft: false });
      g.tick(1 / 60, false);
      dist += Math.hypot(g.capy.position.x - last.x, g.capy.position.z - last.z);
      last = { x: g.capy.position.x, z: g.capy.position.z };
      if (g.perchCount() === 0) break;
    }
    key('keyup', 'KeyW');
    o.walked = +dist.toFixed(1);
    o.onAfterWalk = g.perchCount();
    // ---- what the save now holds ----------------------------------------
    let raw = null;
    tick(180);   // the save is debounced and drains inside systems.update
    try { raw = JSON.parse(localStorage.getItem('capy3.journey.v1') || 'null'); } catch (e) {}
    o.savePas = raw && raw.pas || null;
    o.saveFinds = raw && raw.finds ? raw.finds.filter(f => /sat-on|carried-on|full-house/.test(f)) : null;
    o.lastError = g.state.lastError || null;
    return o;
  });
  await page.evaluate((o) => fetch('/shot?name=n2-book.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
