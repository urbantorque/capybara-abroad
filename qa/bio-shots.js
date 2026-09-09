async page => {
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(6500);
  await page.keyboard.press('Space');
  await page.waitForTimeout(3000);

  // Stand the animal somewhere and hold it there. A teleport is motion (the
  // correction reads as tens of m/s for several frames), so the body is pinned
  // on an interval for the length of the shot rather than written once.
  async function stand(biome, x, z, yaw, name, hold) {
    await page.evaluate((o) => {
      const g = window.__capy;
      try { g.hud.cross(o.b); } catch (e) { g.biome.switchTo(o.b); }
    }, { b: biome });
    await page.waitForTimeout(4500);
    await page.evaluate((o) => {
      const g = window.__capy;
      const th = (g[o.b] && g[o.b].terrainHeight) ? g[o.b].terrainHeight(o.x, o.z) : 0;
      const y = (th === th ? th : 0) + 1.2;
      window.__pin && clearInterval(window.__pin);
      window.__pin = setInterval(function () {
        const b = g.capy && g.capy.body;
        if (!b) return;
        b.position.set(o.x, y, o.z);
        b.velocity.set(0, 0, 0);
        b.angularVelocity.set(0, 0, 0);
      }, 16);
      if (typeof o.yaw === 'number' && g.input) g.input.camYaw = o.yaw;
    }, { b: biome, x: x, z: z, yaw: yaw });
    await page.waitForTimeout(hold || 4000);
    await page.screenshot({ path: 'qa/BIO-' + name + '.png' });
    await page.evaluate(() => { if (window.__pin) { clearInterval(window.__pin); window.__pin = null; } });
  }

  // KYOTO — stand on the bank at the south end of the Uji bridge and look at it.
  // The bridge runs x=4, z=105..151; the ground here is about -0.8.
  await stand('kyoto', 4, 96, Math.PI, 'kyoto-bridge', 5000);

  // CALI — stand on the bridge deck itself, beside the parapet you can walk
  // through. Deck top is 1.03, parapets at x = -6 +/- 4.3.
  await stand('cali', -6, 0, Math.PI * 0.5, 'cali-bridge', 5000);

  // RIO and MARRAKECH — stand next to the locals and let them not move.
  await page.evaluate(() => {
    const g = window.__capy;
    try { g.hud.cross('rio'); } catch (e) { g.biome.switchTo('rio'); }
  });
  await page.waitForTimeout(4500);
  const rioAt = await page.evaluate(() => {
    const g = window.__capy;
    function rootOf(o) { let r = null; for (let p = o; p; p = p.parent) r = p; return r; }
    function shown(o) { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; }
    const live = g.locals.filter(r => r.group && rootOf(r.group) === g.scene && shown(r.group));
    if (!live.length) return null;
    // the densest knot of people
    let best = null, bestN = -1;
    for (const a of live) {
      let k = 0;
      for (const b of live) if (Math.hypot(a.x - b.x, a.z - b.z) < 14) k++;
      if (k > bestN) { bestN = k; best = a; }
    }
    return { x: best.x, z: best.z, n: bestN, total: live.length };
  });
  if (rioAt) await stand('rio', rioAt.x + 6, rioAt.z + 6, Math.atan2(-6, -6), 'rio-locals', 5000);

  await page.evaluate(() => {
    const g = window.__capy;
    try { g.hud.cross('sahara'); } catch (e) { g.biome.switchTo('sahara'); }
  });
  await page.waitForTimeout(4500);
  const sahAt = await page.evaluate(() => {
    const g = window.__capy;
    function rootOf(o) { let r = null; for (let p = o; p; p = p.parent) r = p; return r; }
    function shown(o) { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; }
    const live = g.locals.filter(r => r.group && rootOf(r.group) === g.scene && shown(r.group));
    if (!live.length) return null;
    let best = null, bestN = -1;
    for (const a of live) {
      let k = 0;
      for (const b of live) if (Math.hypot(a.x - b.x, a.z - b.z) < 14) k++;
      if (k > bestN) { bestN = k; best = a; }
    }
    return { x: best.x, z: best.z, n: bestN, total: live.length };
  });
  if (sahAt) await stand('sahara', sahAt.x + 6, sahAt.z + 6, Math.atan2(-6, -6), 'sahara-locals', 5000);

  await page.evaluate(async (p) => {
    await fetch('/shot?name=BIO-SHOTS', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(p)))) });
  }, { rioAt: rioAt, sahAt: sahAt });
}
