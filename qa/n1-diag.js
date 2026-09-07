async page => {
  await page.reload();
  await page.waitForTimeout(4800);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const o = { steps: [] };
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    o.can0 = g.capy.can('herd');
    try { g.completeTask('gather', true); } catch (e) { o.ctErr = String(e && e.message); }
    tick(10);
    o.can1 = g.capy.can('herd');
    g.biome.switchTo('goreme');
    tick(120);
    o.can2 = g.capy.can('herd');
    const d = g.herdDebug();
    o.first = d.kinds[0] && d.kinds[0].first;
    // stand beside it, on the ground, and hold still
    const t = o.first;
    const px = t.x + 2.2, pz = t.z + 2.2;
    const pin = (y) => {
      g.capy.body.position.set(px, y === undefined ? g.capy.body.position.y : y, pz);
      g.capy.body.velocity.set(0, 0, 0);
    };
    pin(t.y + 0.5); tick(1); pin(); tick(60);
    o.grounded = g.capy.grounded;
    o.restT = +g.capy.restT.toFixed(2);
    o.by = +g.capy.body.position.y.toFixed(2);
    for (let w = 0; w < 3; w++) {
      pin();
      g.events.emit('capy:wheek', { position: g.capy.position, soft: false });
      for (let i = 0; i < 45; i++) { pin(); g.tick(1 / 60, false); }
      o.steps.push({ w: w, herd: g.herdDebug().kinds[0], rest: +g.capy.restT.toFixed(2),
                     loaf: +g.capy.loaf.toFixed(2), grounded: g.capy.grounded });
    }
    for (let i = 0; i < 60 * 16; i++) { pin(); g.tick(1 / 60, false); }
    o.end = { herd: g.herdDebug().kinds[0], perch: g.perchDebug(),
              loaf: +g.capy.loaf.toFixed(3), rest: +g.capy.restT.toFixed(2),
              grounded: g.capy.grounded, err: g.state.lastError || null };
    return o;
  });
  await page.evaluate((o) => fetch('/shot?name=n1-diag.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
