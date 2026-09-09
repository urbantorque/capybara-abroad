async page => {
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(6500);
  await page.keyboard.press('Space');
  await page.waitForTimeout(3000);

  const CH = ['manly', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara', 'drift',
              'venice', 'kowloon', 'palawan', 'goreme', 'pantanal', 'cave',
              'antarctic', 'monaco', 'hanoi'];
  const out = [];

  for (const b of CH) {
    await page.evaluate((n) => {
      const g = window.__capy;
      try { g.hud.cross(n); } catch (e) { g.biome.switchTo(n); }
    }, b);
    // long enough that everybody has shuffled several times
    await page.waitForTimeout(9000);

    const row = await page.evaluate(() => {
      const g = window.__capy;
      const live = g.biome.current;
      function rootOf(o) { let r = null; for (let p = o; p; p = p.parent) r = p; return r; }
      function shown(o) { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; }
      const api = live === 'sydney' ? g.env : g[live];
      const nav = api && typeof api.navBlocked === 'function' ? api.navBlocked : null;
      const th = api && typeof api.terrainHeight === 'function' ? api.terrainHeight : null;
      const locals = g.locals.filter(r => r.group && rootOf(r.group) === g.scene && shown(r.group));
      let inSolid = 0, floating = 0, drift = 0;
      const bad = [];
      for (const r of locals) {
        if (nav) { try { if (nav(r.x, r.z, 0.28)) { inSolid++; bad.push({ why: 'in solid', x: +r.x.toFixed(1), z: +r.z.toFixed(1) }); } } catch (e) {} }
        if (th) {
          try {
            const gy = th(r.x, r.z);
            // `baseY` is authority inside the radius, so a person whose drawn
            // height is far off the ground under them is floating or sunk.
            if (gy === gy && Math.abs(r.y - gy) > 1.2) {
              floating++; bad.push({ why: 'off ground by ' + (r.y - gy).toFixed(2), x: +r.x.toFixed(1), z: +r.z.toFixed(1) });
            }
          } catch (e) {}
        }
        // and nobody may have left the anchor by more than the radius
        const d = Math.hypot(r.x - r.ax, r.z - r.az);
        if (d > 2.2) { drift++; bad.push({ why: 'drifted ' + d.toFixed(2) + ' m from anchor', x: +r.x.toFixed(1), z: +r.z.toFixed(1) }); }
      }
      return { biome: live, n: locals.length, hasNav: !!nav,
               inSolid: inSolid, floating: floating, drift: drift, bad: bad.slice(0, 4) };
    });
    out.push(row);
  }

  await page.evaluate(async (p) => {
    await fetch('/shot?name=BIO-CLIP', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(p)))) });
  }, out);
}
