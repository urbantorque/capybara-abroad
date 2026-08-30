async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);
  const out = {};

  // ---- THE CARVE: lateral gain on ground that slides ----------------------
  // Iceland's glacier. Find a cell with real slip on it first, then hold a
  // straight run and press hard across it; what is measured is how far the
  // animal gets off the fall line in three seconds.
  await page.evaluate(() => { window.__capy.biome.switchTo('iceland'); });
  await page.waitForTimeout(2600);
  out.slipSpot = await page.evaluate(() => {
    const g = window.__capy, c = g.capy, b = c.body;
    const sp = g.biome.spawnOf('iceland');
    let best = null;
    for (let r = 20; r <= 220 && !best; r += 20) {
      for (let a = 0; a < 6.28; a += 0.5) {
        const x = sp.x + Math.sin(a) * r, z = sp.z + Math.cos(a) * r;
        const y = (typeof g.groundY === 'function' ? g.groundY(x, z) : 0) + 1.2;
        b.position.set(x, y, z); b.velocity.set(0, 0, 0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
        if (c.slip > 0.35 && c.grounded) {
          best = { x: +x.toFixed(1), y: +b.position.y.toFixed(1), z: +z.toFixed(1),
                   slip: +c.slip.toFixed(2) };
          break;
        }
      }
    }
    if (best) window.__slip = best;
    return best;
  });

  if (out.slipSpot) {
    out.carve = {};
    for (const F of [false, true]) {
      out.carve[F ? 'on' : 'off'] = await page.evaluate((force) => {
        const g = window.__capy, c = g.capy, b = c.body, S = window.__slip;
        const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
        const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
        const T = () => { c.learn('carve', !!force); g.tick(1 / 60, false); };
        b.position.set(S.x, S.y + 0.6, S.z); b.velocity.set(0, 0, 0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        for (let i = 0; i < 60; i++) T();
        const x0 = b.position.x, z0 = b.position.z;
        // let it get going down the fall line, then steer hard across it
        for (let i = 0; i < 90; i++) T();
        const mx = b.position.x, mz = b.position.z;
        const vx = b.velocity.x, vz = b.velocity.z;
        const sp0 = Math.hypot(vx, vz) || 1;
        down('KeyA');
        for (let i = 0; i < 180; i++) T();
        up('KeyA');
        // how far off the line it got: the perpendicular component of the move
        const ax = b.position.x - mx, az = b.position.z - mz;
        const across = Math.abs(ax * (-vz / sp0) + az * (vx / sp0));
        return { can: c.can('carve'), slip: +c.slip.toFixed(2),
                 across: +across.toFixed(2),
                 speed: +Math.hypot(b.velocity.x, b.velocity.z).toFixed(2),
                 travelled: +Math.hypot(b.position.x - x0, b.position.z - z0).toFixed(1) };
      }, F);
      await page.waitForTimeout(300);
    }
  }

  // ---- THE MANTLE: a lip within a hop of the feet -------------------------
  await page.evaluate(() => { window.__capy.biome.switchTo('kowloon'); });
  await page.waitForTimeout(2600);
  out.lip = await page.evaluate(() => {
    const g = window.__capy, c = g.capy;
    const sp = g.biome.spawnOf('kowloon');
    for (let r = 3; r <= 30; r += 1.2) {
      for (let a = 0; a < 6.28; a += 0.25) {
        const x = sp.x + Math.sin(a) * r, z = sp.z + Math.cos(a) * r;
        const gy = (typeof g.groundY === 'function' ? g.groundY(x, z) : 0);
        const h = c.climbAt(x, gy + 0.5, z, a);
        if (h && typeof h.top === 'number' && h.top - gy > 0.9 && h.top - gy < 2.1) {
          const o = { x: +x.toFixed(2), z: +z.toFixed(2), gy: +gy.toFixed(2),
                      top: +h.top.toFixed(2), yaw: +a.toFixed(2) };
          window.__lip = o;
          return o;
        }
      }
    }
    return null;
  });

  if (out.lip) {
    out.mantle = {};
    for (const F of [false, true]) {
      out.mantle[F ? 'on' : 'off'] = await page.evaluate((force) => {
        const g = window.__capy, c = g.capy, b = c.body, L = window.__lip;
        const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
        const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
        const T = () => { c.learn('mantle', !!force); c.learn('vault', false); c.learn('seed', false); g.tick(1 / 60, false); };
        let onTop = 0;
        for (let n = 0; n < 6; n++) {
          b.position.set(L.x - Math.sin(L.yaw) * (2.0 + n * 0.25), L.gy + 0.5,
                         L.z - Math.cos(L.yaw) * (2.0 + n * 0.25));
          b.velocity.set(0, 0, 0);
          b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
          c.face(L.yaw);
          for (let i = 0; i < 40; i++) T();
          down('KeyW');
          for (let i = 0; i < 22; i++) T();
          down('Space'); for (let i = 0; i < 5; i++) T(); up('Space');
          for (let i = 0; i < 90; i++) T();
          up('KeyW');
          for (let i = 0; i < 30; i++) T();
          if (b.position.y - L.gy > (L.top - L.gy) - 0.15) onTop++;
        }
        return { can: c.can('mantle'), toppedOut: onTop, of: 6 };
      }, F);
      await page.waitForTimeout(300);
    }
  }

  // ---- SOFT FEET: what a scare leaves behind ------------------------------
  await page.evaluate(() => { window.__capy.biome.switchTo('sydney'); });
  await page.waitForTimeout(2600);
  out.quiet = {};
  for (const F of [false, true]) {
    out.quiet[F ? 'on' : 'off'] = await page.evaluate((force) => {
      const g = window.__capy, c = g.capy, b = c.body;
      const T = () => { c.learn('quiet', !!force); g.tick(1 / 60, false); };
      const list = g.npcs || [];
      // pick somebody, reset what they remember, then run at them
      let best = null, bd = 1e9;
      const sp = g.biome.spawnOf('sydney');
      for (const r of list) {
        if (!r || !r.group) continue;
        const d = Math.hypot(r.group.position.x - sp.x, r.group.position.z - sp.z);
        if (d < bd) { bd = d; best = r; }
      }
      if (!best) return { none: true };
      best.wary = 0; best.alarm = 0;
      const tx = best.group.position.x, tz = best.group.position.z;
      b.position.set(tx - 6, sp.y, tz); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
      const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
      down('KeyD'); down('ShiftLeft');
      let peakAlarm = 0, peakWary = 0;
      for (let i = 0; i < 60 * 6; i++) {
        T();
        peakAlarm = Math.max(peakAlarm, best.alarm || 0);
        peakWary = Math.max(peakWary, best.wary || 0);
      }
      up('KeyD'); up('ShiftLeft');
      return { can: c.can('quiet'), peakAlarm: +peakAlarm.toFixed(3),
               peakWary: +peakWary.toFixed(3) };
    }, F);
    await page.waitForTimeout(300);
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=skills4.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
