async page => {
  const out = { tag: 'BATCH3B' };

  await page.reload();
  await page.waitForTimeout(5500);
  await page.keyboard.press('Digit1');
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(1000);
    const b = await page.evaluate(() => {
      const g = window.__capy;
      return g && g.biome ? g.biome.current : null;
    });
    if (b === 'sydney') break;
  }
  await page.waitForTimeout(2000);

  // ---- A. switchTo rollback on a build that throws ------------------------
  out.rollback = await page.evaluate(() => {
    const g = window.__capy;
    const r = { before: g.biome.current };
    r.alreadyBuilt = !!(g.biome.has('antarctic'));
    let built = 0;
    g.biome.register('antarctic', {
      ensureBuilt() {
        built++;
        const marker = new g.scene.constructor();
        marker.name = '__ROLLBACK_MARKER__';
        g.scene.add(marker);
        throw new Error('deliberate rollback test failure');
      },
    });
    r.switchReturned = g.biome.switchTo('antarctic');
    r.currentAfter = g.biome.current;
    r.markerLeftInScene = !!g.scene.getObjectByName('__ROLLBACK_MARKER__');
    // a retry must not accumulate a second copy
    r.switchReturned2 = g.biome.switchTo('antarctic');
    r.markerAfterRetry = !!g.scene.getObjectByName('__ROLLBACK_MARKER__');
    let markers = 0;
    g.scene.traverse(o => { if (o.name === '__ROLLBACK_MARKER__') markers++; });
    r.markerCount = markers;
    r.buildsAttempted = built;
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
    r.stillAlive = g.biome.current;
    return r;
  });

  // ---- B. do the chase cues carry a position? -----------------------------
  out.sfx = await page.evaluate(() => {
    const g = window.__capy;
    const seen = [];
    const raw = g.sfx.bind(g);
    g.sfx = function (name, opts) {
      if (name === 'whistle' || name === 'gasp' || name === 'gull' || name === 'wheek') {
        seen.push({ n: name, at: !!(opts && opts.at) });
      }
      return raw(name, opts);
    };
    for (let i = 0; i < 2400; i++) g.tick(1 / 60, false);
    g.sfx = raw;
    const tally = {};
    for (const s of seen) {
      const k = s.n + (s.at ? ':placed' : ':MONO');
      tally[k] = (tally[k] || 0) + 1;
    }
    return { calls: seen.length, tally: tally };
  });

  out.soak = await page.evaluate(() => {
    const g = window.__capy;
    let nan = 0;
    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < 600; i++) g.tick(1 / 60, false);
      const p = g.capy && g.capy.position;
      if (p && (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z))) nan++;
    }
    return { biome: g.biome.current, nan: nan, lastError: g.state.lastError || null,
             bodies: g.world.bodies.length };
  });

  await page.evaluate(payload => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 1))));
    return fetch('/shot?name=batch3b-result.json', { method: 'POST', body: s });
  }, out);
}
