// IS THE BRIDGE DECK REACHABLE FROM ANY SIDE? — with a control.
//
// px-bridge5 swam at the landfall bluff, a pylon and an approach pier from the
// +z side and topped out at 2.2 m against a deck at 25. That is one side of one
// approach, and a comment in quay.js says of Bradleys Head "the one you can
// actually swim to: the animal stands on the rim at 21 m", which if true means
// a headland CAN be got onto and the bluff test was too narrow.
//
// So: swim at the bluff from all four sides, and swim at Bradleys Head the same
// way. If the control gets up and the bluff does not, the difference is real; if
// neither does, the comment is about a probe that teleported.
async page => {
  const out = { legs: [] };
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(7000);
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  const targets = await page.evaluate(() => {
    const g = window.__capy, B = g.quay.bridge;
    const cs = Math.cos(B.yaw), sn = Math.sin(B.yaw);
    return [{ name: 'bluff', x: B.x + 190 * cs, z: B.z - 190 * sn },
            { name: 'bradleys', x: -76, z: -196 }];
  });
  for (const t of targets) {
    for (const [dn, dx, dz] of [['N', 0, 1], ['S', 0, -1], ['E', 1, 0], ['W', -1, 0]]) {
      const st = await page.evaluate(a => {
        const g = window.__capy, q = g.quay;
        for (let d = 20; d < 240; d += 2) {
          const x = a.t.x + a.dx * d, z = a.t.z + a.dz * d;
          if (q.isOverWater(x, z) && q.terrainHeight(x, z) < 1) return { x, z, d };
        }
        return null;
      }, { t, dx, dz });
      if (!st) { out.legs.push({ target: t.name, side: dn, err: 'no water' }); continue; }
      // swim at it with whichever key closes: run both, keep the better
      let best = null;
      for (const key of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) {
        await page.evaluate(s => {
          const g = window.__capy;
          g.capy.body.position.set(s.x, 0.3, s.z);
          g.capy.body.velocity.set(0, 0, 0);
          g.capy.body.aabbNeedsUpdate = true;
          window.__m = -99;
          if (window.__t) clearInterval(window.__t);
          window.__t = setInterval(() => {
            const y = g.capy.position.y; if (y > window.__m) window.__m = y;
          }, 50);
        }, st);
        await page.waitForTimeout(400);
        await page.keyboard.down(key);
        for (let k = 0; k < 9; k++) { await page.waitForTimeout(600); await page.keyboard.press('Space'); }
        await page.keyboard.up(key);
        await page.waitForTimeout(400);
        const r = await page.evaluate(a => {
          const g = window.__capy, c = g.capy, p = c.position;
          clearInterval(window.__t);
          const d0 = Math.hypot(a.st.x - a.t.x, a.st.z - a.t.z);
          const d1 = Math.hypot(p.x - a.t.x, p.z - a.t.z);
          return { key: a.key, closed: +(d0 - d1).toFixed(1), maxY: +window.__m.toFixed(2),
                   y: +p.y.toFixed(2), gnd: !!c.grounded, swim: !!c.swimming };
        }, { st, t, key });
        if (!best || r.maxY > best.maxY) best = r;
      }
      out.legs.push({ target: t.name, side: dn, startDist: st.d, ...best });
    }
  }
  out.err = await page.evaluate(() =>
    (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null);
  await page.evaluate(o => fetch('/shot?name=px-bridge6.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
