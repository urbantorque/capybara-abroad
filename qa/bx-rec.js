async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);

  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const res = { calls: {}, improve: {}, deepest: 0, terr: 0, depth: 0 };

    // count every game.record call, and every call whose value BEAT the last
    // one it was handed for that id — which is one personal-best toast each,
    // once a best exists.
    const raw = g.record;
    const seen = {};
    g.record = function (id, v) {
      res.calls[id] = (res.calls[id] || 0) + 1;
      if (typeof v === 'number') {
        if (seen[id] !== undefined && v > seen[id]) res.improve[id] = (res.improve[id] || 0) + 1;
        if (seen[id] === undefined || v > seen[id]) seen[id] = v;
      }
      return raw.call(g, id, v);
    };

    g.biome.switchTo('palawan');
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false);

    // find deep water near the reef
    const pal = g.palawan;
    let bx = 0, bz = 0, bd = 0;
    for (let x = -60; x <= 60; x += 4) {
      for (let z = -60; z <= 60; z += 4) {
        const h = pal.terrainHeight(x, z);
        if (h < bd) { bd = h; bx = x; bz = z; }
      }
    }
    res.terr = bd;
    const b = g.capy.body;
    b.position.set(bx, 0.1, bz);
    b.velocity.set(0, 0, 0);
    if (b.previousPosition) b.previousPosition.copy(b.position);
    if (b.interpolatedPosition) b.interpolatedPosition.copy(b.position);
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false);

    // hold E — the dive key — for six seconds of ticks
    const down = new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true });
    window.dispatchEvent(down);
    for (let i = 0; i < 420; i++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true }));
      g.tick(1 / 60, false);
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', key: 'e', bubbles: true }));
    // ...and come back up, which is the edge the record is meant to be filed on
    for (let i = 0; i < 600; i++) g.tick(1 / 60, false);
    res.depth = g.capy.depth || 0;
    res.pos = [g.capy.position.x, g.capy.position.y, g.capy.position.z];
    g.record = raw;
    return res;
  });

  await page.evaluate((o) => fetch('/shot?name=bx-rec.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
