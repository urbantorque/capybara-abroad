async page => {
  // qa/l9-shop-shots.js — screenshots of the stall for the house verification
  // rule: sahara/venice (easy, open), kyoto and pantanal (the two flagged
  // chapters), plus one more. Not a pass/fail instrument — qa/l9-shop.js is
  // that; this only captures what the thing looks like.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('about:blank');
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);

  const CHAPS = { sahara: 8, venice: 10, kyoto: 4, pantanal: 15, antarctic: 17 }; // chapterOf, not call order
  for (const biome of Object.keys(CHAPS)) {
    const n = CHAPS[biome];
    await page.evaluate(([biome, n]) => {
      const g = window.__capy;
      g.state.qaForceChapTick(n);
      g.biome.switchTo(biome);
    }, [biome, n]);
    await page.waitForTimeout(1500);
    const pos = await page.evaluate((biome) => {
      const g = window.__capy;
      const trav = g.shopWhere(biome);
      if (!trav) return null;
      let sx = trav.x, sz = trav.z;
      for (let i = 0; i < g.world.bodies.length; i++) {
        const b = g.world.bodies[i];
        if (b.userData && b.userData.stall && b.userData.stall.biome === biome) { sx = b.position.x; sz = b.position.z; }
      }
      // A SIDE-ON SHOT, NOT A HEAD-ON ONE. Camera directly behind the
      // traveller looking at them puts the stall (1.6 m further along the
      // same line) right behind their own body — hidden, not shown.
      // Perpendicular to the traveller-stall axis, at the midpoint, both the
      // figure and the stall sit side by side in frame instead.
      let dx = sx - trav.x, dz = sz - trav.z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      // A PRODUCT SHOT OF THE STALL ITSELF: stand on the traveller's own
      // (known-safe) side of it, 3.5 m out along the trav->stall axis
      // continued backward, looking straight at the stall — the traveller
      // ends up in the near foreground, the stall filling the frame beyond
      // them, rather than a wide two-shot that reads as empty ground.
      // Pantanal's own solid ground is one-sided (a 3.4 m-half causeway,
      // the traveller already near its edge) — "backward past the
      // traveller" steps off it into the flood there, measured. Coming in
      // from BEYOND the stall (continuing the same trav->stall direction a
      // little further) stays on the causeway for every biome this pass
      // checked (qa/l9-shop.js), this one included.
      const back = biome === 'pantanal' ? 1 : -1;
      const dist = biome === 'pantanal' ? 2.3 : 3.5;
      const cx = trav.x + dx * dist * back, cz = trav.z + dz * dist * back;
      const cb = g.capy.body;
      cb.position.set(cx, trav.y + 0.05, cz);
      cb.velocity.set(0, 0, 0);
      cb.previousPosition.copy(cb.position);
      cb.interpolatedPosition.copy(cb.position);
      const yaw = Math.atan2((back > 0 ? trav.x : sx) - cx, (back > 0 ? trav.z : sz) - cz);
      if (g.input) g.input.camYaw = yaw;
      return { trav, sx, sz, cx, cz, yaw };
    }, biome);
    await page.waitForTimeout(1600);
    await page.screenshot({ path: 'qa/l9-shop-' + biome + '.png', timeout: 90000 });
  }

  // ---- MINIMAP GLYPH: STEADY, THEN PULSING (SAHARA) ------------------------
  // The chart is a persistent corner HUD element (mapEl), not a toggled
  // overlay — no key needed, it is already on screen whenever a biome is
  // built. Two screenshots a beat apart show the pulse (or its absence).
  await page.evaluate(() => { window.__capy.biome.switchTo('sahara'); });
  await page.waitForTimeout(800);
  await page.evaluate(() => { const cur = window.__capy.state.qaYuzu(); if (cur > 0) window.__capy.state.qaAddYuzu(-cur); });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'qa/l9-shop-map-poor.png', timeout: 90000 });
  const cheapest = await page.evaluate(() => window.__capy.state.qaShopCheapest());
  await page.evaluate((cu) => window.__capy.state.qaAddYuzu(cu + 20), cheapest);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'qa/l9-shop-map-rich-1.png', timeout: 90000 });
  await page.waitForTimeout(260); // ~quarter of the 4 Hz pulse period
  await page.screenshot({ path: 'qa/l9-shop-map-rich-2.png', timeout: 90000 });

  // ---- PAPER ROW: forced visible with an affordable price ------------------
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('goreme');
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const g = window.__capy;
    g.state.qaForceChapTick(8);
    g.biome.switchTo('sahara');
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'qa/l9-shop-paper-row.png', timeout: 90000 });

  return 'done';
}
