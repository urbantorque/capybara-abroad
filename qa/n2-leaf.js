async page => {
  // A WRITE-THEN-RELOAD TEST MAY NOT INSTALL AN INIT SCRIPT (trap 10) and must
  // clear exactly once, before the only reload it does.
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(4800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  const before = await page.evaluate(async () => {
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
    for (let i = 0; i < 200; i++) { pin(); g.tick(1 / 60, false); }
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
    tick(200);
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem('capy3.journey.v1') || 'null'); } catch (e) {}
    return { most: g.perchDebug().most, pas: raw && raw.pas };
  });
  // ---- and now the reload, which is the whole point of the test ----------
  await page.reload();
  await page.waitForTimeout(4800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1800);
  const after = await page.evaluate(async () => {
    const g = window.__capy;
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
    // open the ledger and read what the leaf actually prints. The paper keeps
    // hidden rows (trap 32), so read every row's text and filter.
    let opened = false;
    try { g.hud.ledger(); opened = true; } catch (e) { opened = String(e && e.message); }
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
    const rows = [];
    document.querySelectorAll('.capyui-lednoto').forEach(el => {
      const r = el.getBoundingClientRect();
      rows.push({ t: el.textContent, w: Math.round(r.width) });
    });
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem('capy3.journey.v1') || 'null'); } catch (e) {}
    return { opened: opened, pas: raw && raw.pas, rows: rows,
             carried: rows.filter(r => /carr/.test(r.t)) };
  });
  await page.evaluate((o) => fetch('/shot?name=n2-leaf.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), { before, after });
}
