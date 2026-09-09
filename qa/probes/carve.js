async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);
  const out = {};
  for (const bio of ['iceland', 'antarctic']) {
    await page.evaluate((n) => { window.__capy.biome.switchTo(n); }, bio);
    await page.waitForTimeout(2600);
    out[bio] = await page.evaluate(() => {
      const g = window.__capy, c = g.capy, b = c.body;
      const sp = g.biome.spawnOf(g.biome.current);
      let maxSlip = 0, at = null;
      for (let r = 10; r <= 260; r += 18) {
        for (let a = 0; a < 6.28; a += 0.45) {
          const x = sp.x + Math.sin(a) * r, z = sp.z + Math.cos(a) * r;
          b.position.set(x, sp.y + 4, z); b.velocity.set(0, 0, 0);
          b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
          for (let i = 0; i < 45; i++) g.tick(1 / 60, false);
          if (!c.grounded) continue;
          if (c.slip > maxSlip) {
            maxSlip = c.slip;
            at = { x: +b.position.x.toFixed(1), y: +b.position.y.toFixed(2), z: +b.position.z.toFixed(1) };
          }
        }
      }
      if (at && maxSlip > 0.3) window.__slip = at;
      return { maxSlip: +maxSlip.toFixed(3), at };
    });
    if (out[bio].maxSlip > 0.3) { out.picked = bio; break; }
  }
  if (out.picked) {
    out.carve = {};
    for (const F of [false, true]) {
      out.carve[F ? 'on' : 'off'] = await page.evaluate((force) => {
        const g = window.__capy, c = g.capy, b = c.body, S = window.__slip;
        const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
        const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
        const ALL = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
        const T = () => { c.learn('carve', !!force); g.tick(1 / 60, false); };
        b.position.set(S.x, S.y + 0.4, S.z); b.velocity.set(0, 0, 0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        for (let i = 0; i < 60; i++) T();
        down('KeyW');
        for (let i = 0; i < 90; i++) T();      // get it sliding
        const vx = b.velocity.x, vz = b.velocity.z;
        const sp0 = Math.hypot(vx, vz) || 1;
        const mx = b.position.x, mz = b.position.z;
        ALL.forEach(up); down('KeyA');          // steer hard across the fall line
        for (let i = 0; i < 150; i++) T();
        ALL.forEach(up);
        const ax = b.position.x - mx, az = b.position.z - mz;
        return { can: c.can('carve'), slip: +c.slip.toFixed(2),
                 across: +Math.abs(ax * (-vz / sp0) + az * (vx / sp0)).toFixed(2),
                 along: +(ax * (vx / sp0) + az * (vz / sp0)).toFixed(2),
                 speed: +Math.hypot(b.velocity.x, b.velocity.z).toFixed(2) };
      }, F);
      await page.waitForTimeout(400);
    }
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=carve.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
