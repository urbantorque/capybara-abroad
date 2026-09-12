async page => {
  await page.reload();
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  const out = {};
  for (const n of ['kyoto', 'cali', 'sydney', 'rio']) {
    await page.evaluate((name) => { window.__capy.hud.cross(name); }, n);
    await page.waitForTimeout(5000);
    out[n] = await page.evaluate(() => {
      const g = window.__capy, w = g.world, bs = w.bodies;
      for (const b of bs) b.updateAABB();
      const res = {};
      for (const ax of ['x', 'y', 'z']) {
        const s = bs.slice().sort((a, b) => a.aabb.lowerBound[ax] - b.aabb.lowerBound[ax]);
        let tests = 0;
        for (let i = 0; i < s.length; i++) { const hi = s[i].aabb.upperBound[ax]; for (let j = i + 1; j < s.length; j++) { if (s[j].aabb.lowerBound[ax] > hi) break; tests++; } }
        let mean = 0; for (const b of bs) mean += b.position[ax]; mean /= bs.length;
        let v = 0; for (const b of bs) v += (b.position[ax] - mean) ** 2; v /= bs.length;
        res[ax] = { tests, variance: +v.toFixed(1) };
      }
      // the widest aabbs on the current axis
      const ax = ['x', 'y', 'z'][w.broadphase.axisIndex];
      const wide = bs.map(b => ({ w: +(b.aabb.upperBound[ax] - b.aabb.lowerBound[ax]).toFixed(1), t: b.type, sh: b.shapes.map(s => s.constructor.name).join('+').slice(0, 30), n: b.shapes.length })).sort((a, b) => b.w - a.w).slice(0, 8);
      return { axis: w.broadphase.axisIndex, bodies: bs.length, res, wide };
    });
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4-bp-axis.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
