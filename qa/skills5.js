async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);
  const out = {};

  // ---- THE MANTLE --------------------------------------------------------
  // Hunting a low lip by settling the animal at every candidate cost more than
  // two minutes and never finished. The face at (10.9, 10.95) topping out at
  // 11.9 m is already known from qa/diag.js, so the test is CONSTRUCTED: put
  // the animal in the air beside it with its feet in the catch band, moving
  // into the face, and see whether it ends up standing on top.
  await page.evaluate(() => { window.__capy.biome.switchTo('kowloon'); });
  await page.waitForTimeout(2600);
  out.mantle = {};
  for (const F of [false, true]) {
    out.mantle[F ? 'on' : 'off'] = await page.evaluate((force) => {
      const g = window.__capy, c = g.capy, b = c.body;
      const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
      const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
      const T = () => { c.learn('mantle', !!force); c.learn('vault', false); c.learn('seed', false); g.tick(1 / 60, false); };
      const TOP = 11.9, YAW = 2.75;
      const rows = [];
      for (let n = 0; n < 6; n++) {
        const rise = -0.2 + n * 0.16;                 // feet from 0.2 below the lip to 0.6 above
        const feet = TOP - rise;
        b.position.set(10.9 - Math.sin(YAW) * 1.0, feet + 0.34, 10.95 - Math.cos(YAW) * 1.0);
        b.velocity.set(Math.sin(YAW) * 2.5, 0.4, Math.cos(YAW) * 2.5);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        c.face(YAW);
        down('KeyW');
        let hi = -99;
        for (let i = 0; i < 80; i++) { T(); hi = Math.max(hi, b.position.y - 0.34); }
        up('KeyW');
        for (let i = 0; i < 20; i++) T();
        rows.push({ rise: +rise.toFixed(2), peakFeet: +hi.toFixed(2),
                    ended: +(b.position.y - 0.34).toFixed(2),
                    onTop: (b.position.y - 0.34) > TOP - 0.25 });
      }
      return { can: c.can('mantle'), toppedOut: rows.filter(r => r.onTop).length,
               of: rows.length, rows };
    }, F);
    await page.waitForTimeout(400);
  }

  // ---- SOFT FEET ---------------------------------------------------------
  await page.evaluate(() => { window.__capy.biome.switchTo('sydney'); });
  await page.waitForTimeout(2600);
  out.quiet = {};
  for (const F of [false, true]) {
    out.quiet[F ? 'on' : 'off'] = await page.evaluate((force) => {
      const g = window.__capy, c = g.capy, b = c.body;
      const T = () => { c.learn('quiet', !!force); g.tick(1 / 60, false); };
      const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
      const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
      const ALL = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
      const list = g.npcs || [];
      const sp = g.biome.spawnOf('sydney');
      let best = null, bd = 1e9;
      for (const r of list) {
        if (!r || !r.group) continue;
        const d = Math.hypot(r.group.position.x - sp.x, r.group.position.z - sp.z);
        if (d < bd) { bd = d; best = r; }
      }
      if (!best) return { none: true };
      best.wary = 0; best.alarm = 0;
      const tx = best.group.position.x, tz = best.group.position.z;
      b.position.set(tx - 7, sp.y, tz - 7); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      down('ShiftLeft');
      let peakAlarm = 0, peakWary = 0;
      for (let i = 0; i < 60 * 7; i++) {
        const wx = best.group.position.x - b.position.x, wz = best.group.position.z - b.position.z;
        const d = Math.hypot(wx, wz) || 1;
        const cy = Math.cos(g.input.camYaw), sy = Math.sin(g.input.camYaw);
        const nx = wx / d, nz = wz / d;
        const ix = nx * cy - nz * sy, iz = nx * sy + nz * cy;
        ALL.forEach(up);
        if (iz < -0.35) down('KeyW');
        if (iz > 0.35) down('KeyS');
        if (ix < -0.35) down('KeyA');
        if (ix > 0.35) down('KeyD');
        T();
        peakAlarm = Math.max(peakAlarm, best.alarm || 0);
        peakWary = Math.max(peakWary, best.wary || 0);
      }
      ALL.forEach(up); up('ShiftLeft');
      return { can: c.can('quiet'), peakAlarm: +peakAlarm.toFixed(3),
               peakWary: +peakWary.toFixed(3),
               gotTo: +Math.hypot(best.group.position.x - b.position.x,
                                  best.group.position.z - b.position.z).toFixed(2) };
    }, F);
    await page.waitForTimeout(400);
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=skills5.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
