async page => {
  // ------------------------------------------------------------------------
  // THE PLAYTHROUGH. Real keys, real clock, rAF running, audio unlocked, from
  // a cleared save — the closest an unattended run gets to playing it by hand,
  // and the only mode in which a whole class of bug is visible at all (see the
  // harness memory). Sydney and Marrakech, the two the batch names.
  //
  // It takes PICTURES. Every framing and posture claim in this pass is settled
  // from the rendered image and not from a number: a guard pose is two arm
  // rotations and the only honest test of it is whether it reads as a person
  // standing over their stock.
  // ------------------------------------------------------------------------
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3500);

  // Pictures come from playwright-cli screenshot, NOT from toDataURL: a manual
  // read needs the render and the read in one JS turn and still gives a
  // stretched projection, and here it gave four identical 20 KB blank white
  // frames. See harness trap 12. This file marks the moments instead.
  const shot = async (name) => { await page.evaluate((n) => { window.__b7mark = n; }, name); };
  const hold = async (code, ms) => {
    await page.keyboard.down(code);
    await page.waitForTimeout(ms);
    await page.keyboard.up(code);
  };

  const log = [];
  for (const chap of ['sydney', 'sahara']) {
    // Per chapter, or the tally is cumulative and Marrakech reports Sydney's.
    await page.evaluate((n) => { window.__capy.biome.switchTo(n); window.__capy.state.heatLog = {}; }, chap);
    await page.waitForTimeout(2500);

    // Walk about under real keys for a while: this is the chapter's own life
    // running at real speed, which is the thing the tick loop cannot show.
    await hold('KeyW', 1400);
    await hold('KeyD', 900);
    await hold('KeyQ', 300);
    await page.waitForTimeout(1200);
    await shot('B7-play-' + chap + '-cold');

    const before = await page.evaluate(() => {
      const g = window.__capy;
      return { heat: +(g.state.heat || 0).toFixed(3), sites: g.state.heatN,
               biome: g.biome.current, err: g.state.lastError || null };
    });

    // Stand at the busiest stall and rob it three times, on the clock.
    const at = await page.evaluate((n) => {
      const g = window.__capy;
      const live = g.biome.current;
      const PA = { vendor: 1, abuela: 1, farmer: 1, churchgoer: 1, llama: 1, streetdog: 1 };
      const folk = [];
      for (const L of (g.locals || [])) if (L && L.biome === live) folk.push(L);
      if (live === 'sydney' || live === 'pasto') {
        for (const h of (g.npcs || [])) {
          if (!h || !h.group) continue;
          if ((live === 'pasto') !== !!PA[h.kind]) continue;
          folk.push(h);
        }
      }
      const pos = (p) => p.group ? p.group.position : { x: p.x, y: p.y, z: p.z };
      let stall = null, best = 1e9;
      for (const p of (g.props || [])) {
        if (!p || (p.biome && p.biome !== live)) continue;
        if (typeof p.homeX !== 'number' || !isFinite(p.homeX)) continue;
        let d0 = 1e9;
        for (const f of folk) { const q = pos(f); const d = Math.hypot(q.x - p.homeX, q.z - p.homeZ); if (d < d0) d0 = d; }
        if (d0 < best) { best = d0; stall = p; }
      }
      if (!stall) return null;
      window.__b7stall = stall;
      const b = g.capy.body;
      let y = b.position.y;
      try { const api = live === 'sydney' ? g.env : g[live];
            const t = api.terrainHeight(stall.homeX + 2, stall.homeZ); if (isFinite(t)) y = t + 0.6; } catch (e) {}
      b.position.set(stall.homeX + 2, y, stall.homeZ);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      return { x: +stall.homeX.toFixed(1), z: +stall.homeZ.toFixed(1), type: stall.type, nearest: +best.toFixed(1) };
    }, chap);
    await page.waitForTimeout(1500);

    for (let k = 0; k < 3; k++) {
      await page.evaluate(() => {
        const g = window.__capy, s = window.__b7stall;
        try { g.events.emit('capy:grab', { prop: s, from: null }); } catch (e) {}
        try { g.events.emit('capy:graze', s); } catch (e) {}
      });
      await page.waitForTimeout(2500);
      await hold('KeyS', 500);
      await page.waitForTimeout(2500);
    }
    await page.waitForTimeout(2000);
    await shot('B7-play-' + chap + '-hot');

    const after = await page.evaluate(() => {
      const g = window.__capy;
      const live = g.biome.current;
      let guards = 0, watching = 0;
      for (const L of (g.locals || [])) {
        if (!L || L.biome !== live) continue;
        if (L.grd > 0.05) guards++;
        if (L.watching) watching++;
      }
      for (const h of (g.npcs || [])) if (h && h.watching) watching++;
      return { heat: +(g.state.heat || 0).toFixed(3), sites: g.state.heatN,
               guards, watching, log: g.state.heatLog || {},
               err: g.state.lastError || null };
    });
    log.push({ chapter: chap, stall: at, before, after });
  }

  await page.evaluate((o) => fetch('/shot?name=B7-play.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), log);
}
