async page => {
  await page.waitForTimeout(5500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);

  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const res = {};
    const raw = g.record;
    let calls = {}, improve = {}, seen = {};
    g.record = function (id, v) {
      calls[id] = (calls[id] || 0) + 1;
      if (typeof v === 'number') {
        if (seen[id] !== undefined && v > seen[id]) improve[id] = (improve[id] || 0) + 1;
        if (seen[id] === undefined || v > seen[id]) seen[id] = v;
      }
      return raw.call(g, id, v);
    };
    const reset = () => { calls = {}; improve = {}; seen = {}; };
    const holdE = () => window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true }));
    const dropE = () => window.dispatchEvent(
      new KeyboardEvent('keyup', { code: 'KeyE', key: 'e', bubbles: true }));
    const put = (x, y, z) => {
      const b = g.capy.body;
      b.position.set(x, y, z); b.velocity.set(0, 0, 0);
      if (b.previousPosition) b.previousPosition.copy(b.position);
      if (b.interpolatedPosition) b.interpolatedPosition.copy(b.position);
    };

    g.biome.switchTo('palawan');
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
    const pal = g.palawan;

    // ---- the turtle: sit on her for 14 s, then leave --------------------
    reset();
    for (let i = 0; i < 840; i++) {
      const t = pal.turtle();
      put(t.x, t.y, t.z);
      holdE();
      g.tick(1 / 60, false);
    }
    res.turtleDuring = { calls: calls['sea-turtle'] || 0, improve: improve['sea-turtle'] || 0 };
    // walk away and let the grace expire
    dropE();
    put(0, 2, 60);
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
    res.turtleAfter = { calls: calls['sea-turtle'] || 0, improve: improve['sea-turtle'] || 0 };

    // ---- the cathedral: hold a breath in it for 12 s, then surface ------
    reset();
    const c = pal.cathedral;
    for (let i = 0; i < 720; i++) {
      put(c.x, pal.terrainHeight(c.x, c.z) + 1.2, c.z);
      holdE();
      g.tick(1 / 60, false);
    }
    res.cathDuring = { calls: calls['cathedral'] || 0, improve: improve['cathedral'] || 0,
                       inZone: pal.inZone('cathedral', c.x, c.z), depth: g.capy.depth };
    dropE();
    put(0, 2, 60);
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
    res.cathAfter = { calls: calls['cathedral'] || 0, improve: improve['cathedral'] || 0 };

    g.record = raw;
    return res;
  });

  await page.evaluate((o) => fetch('/shot?name=bx-rec2.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
