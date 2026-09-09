async page => {
  await page.addInitScript(() => { window.__capyBoxLog = []; window.__capyBoxMark = {}; });
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(6500);
  await page.keyboard.press('Space');
  await page.waitForTimeout(3000);

  const CH = ['sydney', 'manly', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara',
              'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'pantanal', 'cave',
              'antarctic', 'monaco', 'hanoi', 'pasto'];
  const out = [];

  for (const b of CH) {
    // mark where this chapter's boxes start, then build it
    await page.evaluate((n) => {
      window.__capyBoxMark[n] = window.__capyBoxLog.length;
      const g = window.__capy;
      try { g.hud.cross(n); } catch (e) { g.biome.switchTo(n); }
    }, b);
    await page.waitForTimeout(4000);

    const row = await page.evaluate((n) => {
      const g = window.__capy, C = g.CANNON;
      const L = window.__capyBoxLog, from = window.__capyBoxMark[n] || 0;
      const live = g.biome.current;
      const th = (g[live] && typeof g[live].terrainHeight === 'function') ? g[live].terrainHeight : null;

      // The static colliders currently in the world, as AABBs.
      const solids = [];
      for (const body of g.world.bodies) {
        if (body.mass !== 0) continue;
        for (let si = 0; si < body.shapes.length; si++) {
          const s = body.shapes[si];
          if (!s.halfExtents) continue;
          const off = body.shapeOffsets[si] || { x: 0, y: 0, z: 0 };
          const px = body.position.x + off.x, py = body.position.y + off.y, pz = body.position.z + off.z;
          // rotation about y only, so the AABB is the box swollen to its diagonal
          const r = Math.hypot(s.halfExtents.x, s.halfExtents.z);
          solids.push({ x: px, y: py, z: pz, hx: r, hy: s.halfExtents.y, hz: r });
        }
      }
      function covered(x, y, z) {
        for (const s of solids) {
          if (Math.abs(x - s.x) <= s.hx + 0.6 &&
              Math.abs(y - s.y) <= s.hy + 0.6 &&
              Math.abs(z - s.z) <= s.hz + 0.6) return true;
        }
        return false;
      }

      // A BARRIER: thin one way, long the other, about waist high, and standing
      // clear of the ground it is on. A kerb is not a barrier and neither is a
      // wall panel of a building — the thinness plus the length is what makes it
      // a rail rather than a slab.
      const found = [];
      for (let i = from; i + 6 < L.length; i += 7) {
        const cx = L[i], cy = L[i + 1], cz = L[i + 2];
        const sx = L[i + 3], sy = L[i + 4], sz = L[i + 5];
        const thin = Math.min(sx, sz), long = Math.max(sx, sz);
        if (thin > 0.7) continue;
        if (sy < 0.35 || sy > 2.2) continue;
        if (long < 2.5) continue;
        const gy = th ? th(cx, cz) : NaN;
        const bottom = cy - sy * 0.5;
        if (gy === gy && bottom < gy + 0.25) continue;    // sitting on the ground
        if (covered(cx, cy, cz)) continue;
        found.push({ x: +cx.toFixed(1), y: +cy.toFixed(2), z: +cz.toFixed(1),
                     w: +thin.toFixed(2), h: +sy.toFixed(2), l: +long.toFixed(1),
                     clear: gy === gy ? +(bottom - gy).toFixed(2) : null });
      }
      // cluster a run of rail segments into one finding
      const cl = [];
      for (const m of found) {
        let f = null;
        for (const c of cl) if (Math.abs(c.x - m.x) < 18 && Math.abs(c.z - m.z) < 18 && Math.abs(c.y - m.y) < 2.5) { f = c; break; }
        if (f) { f.n++; f.x = (f.x * (f.n - 1) + m.x) / f.n; f.z = (f.z * (f.n - 1) + m.z) / f.n;
                 f.l = Math.max(f.l, m.l); }
        else cl.push({ x: m.x, y: m.y, z: m.z, w: m.w, h: m.h, l: m.l, clear: m.clear, n: 1 });
      }
      cl.sort((a, b) => (b.n * b.l) - (a.n * a.l));
      return { biome: live, drawn: (L.length - from) / 7, uncollided: found.length,
               clusters: cl.slice(0, 8).map(c => ({ x: +c.x.toFixed(0), y: c.y, z: +c.z.toFixed(0),
                                                    w: c.w, h: c.h, l: c.l, clear: c.clear, n: c.n })) };
    }, b);
    out.push(row);
  }

  await page.evaluate(async (p) => {
    await fetch('/shot?name=BIO-BOXES', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(p)))) });
  }, out);
}
