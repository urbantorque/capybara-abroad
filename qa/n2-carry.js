async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(4800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const PLACES = ['sydney', 'venice', 'goreme', 'manly', 'antarctic'];
  const rows = [];
  for (const b of PLACES) {
    const r = await page.evaluate(async (bi) => {
      const g = window.__capy;
      const out = { biome: bi, legs: [] };
      const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
      const key = (t, code) => window.dispatchEvent(
        new KeyboardEvent(t, { code: code, key: 'x', bubbles: true }));
      key('keyup', 'KeyW');
      g.completeTask('gather', true);
      g.completeTask('the-crossing', true);
      g.biome.switchTo(bi);
      tick(120);
      // HOW FAR CAN YOU ACTUALLY CARRY ONE. Three attempts, because the answer
      // is a property of the ground you happen to be walking over — a kerb, a
      // prop and a step are three different dismounts and only one of them is
      // the mechanic being strict.
      for (let leg = 0; leg < 3; leg++) {
        const k = g.herdDebug().kinds[0];
        if (!k || !k.n || !k.first) { out.legs.push({ err: 'nothing offered' }); continue; }
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
        for (let i = 0; i < 60 * 24 && g.perchCount() < 1; i++) {
          pin();
          if (i > 0 && i % 600 === 0) g.events.emit('capy:wheek', { position: g.capy.position, soft: false });
          g.tick(1 / 60, false);
        }
        if (g.perchCount() < 1) { out.legs.push({ err: 'never mounted' }); continue; }
        key('keydown', 'KeyW');
        // `perchDebug().off` is the LAST reason, ever, so across three legs it
        // goes stale and reads as the previous leg's cause — measured, an
        // Antarctic leg with the passenger still on reported "barge". Take the
        // reason only when it is newer than the moment this leg started.
        const t0 = g.state.time;
        let dist = 0, last = { x: g.capy.position.x, z: g.capy.position.z };
        let vyMax = 0, air = 0;
        let i = 0;
        for (; i < 60 * 40 && dist < 120; i++) {
          if (i % 240 === 0) g.events.emit('capy:wheek', { position: g.capy.position, soft: false });
          g.tick(1 / 60, false);
          dist += Math.hypot(g.capy.position.x - last.x, g.capy.position.z - last.z);
          last = { x: g.capy.position.x, z: g.capy.position.z };
          if (g.capy.velocity.y > vyMax) vyMax = g.capy.velocity.y;
          if (!g.capy.grounded) air++;
          if (g.perchCount() === 0) break;
        }
        key('keyup', 'KeyW');
        const d = g.perchDebug();
        const row = { m: +dist.toFixed(1), s: +(i / 60).toFixed(1), on: d.on,
                      why: d.offAt >= t0 ? d.off : '-',
                      vyMax: +vyMax.toFixed(2), airPct: Math.round(100 * air / Math.max(1, i)) };
        // ...AND THE HOP MUST STILL WORK. A dismount rule loosened until the
        // walk survives is worth nothing if the gesture it exists for stops
        // firing, so every leg that still has a passenger presses Space.
        if (d.on > 0) {
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
          for (let q = 0; q < 4; q++) g.tick(1 / 60, false);
          window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
          for (let q = 0; q < 40; q++) g.tick(1 / 60, false);
          row.afterJump = g.perchDebug().on;
        }
        out.legs.push(row);
        tick(60);
      }
      out.lastError = g.state.lastError || null;
      return out;
    }, b);
    rows.push(r);
  }
  await page.evaluate((o) => fetch('/shot?name=n2-carry.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), rows);
}
