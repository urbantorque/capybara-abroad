async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);

  const src = await (await page.request.get('http://localhost:5188/src/shared.js')).text();
  const chapters = [];
  const re = /\{\s*n:\s*(\d+),\s*biome:\s*'([a-z]+)'/g;
  let m;
  while ((m = re.exec(src))) chapters.push(m[2]);

  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);
  const out = { started: await page.evaluate(() => !!window.__capy.state.started), rows: [] };

  for (let ci = 0; ci < chapters.length; ci++) {
    const name = chapters[ci];
    let row;
    try {
      row = await page.evaluate(async (arg) => {
        const g = window.__capy;
        const nm = arg.name;
        if (g.biome.current !== nm) g.biome.switchTo(nm);
        for (let i = 0; i < 25; i++) g.tick(1 / 60, false);
        const r = { biome: nm, live: g.biome.current };
        const sp = g.biome.spawnOf(nm);

        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        let n = 0, skippedDyn = 0;
        const big = [];
        for (const b of g.world.bodies) {
          if (b.mass !== 0) { skippedDyn++; continue; }   // the capybara, props
          let lo, hi;
          try {
            if (typeof b.updateAABB === 'function') b.updateAABB();
            else if (typeof b.computeAABB === 'function') b.computeAABB();
            lo = b.aabb && b.aabb.lowerBound; hi = b.aabb && b.aabb.upperBound;
          } catch (e) { lo = null; }
          if (!lo || !hi || !(lo.x === lo.x) || !(hi.x === hi.x)) continue;
          if (!isFinite(lo.x) || !isFinite(hi.x) || !isFinite(lo.z) || !isFinite(hi.z)) continue;
          n++;
          const w = hi.x - lo.x, d = hi.z - lo.z;
          if (w > 300 || d > 300) {
            big.push({ w: Math.round(w), d: Math.round(d),
                       x: Math.round((lo.x + hi.x) / 2), z: Math.round((lo.z + hi.z) / 2),
                       shapes: b.shapes.map((s) => s.constructor && s.constructor.name).join(',') });
          }
          if (lo.x < x0) x0 = lo.x;
          if (hi.x > x1) x1 = hi.x;
          if (lo.z < z0) z0 = lo.z;
          if (hi.z > z1) z1 = hi.z;
        }
        r.staticBodies = n; r.dynamic = skippedDyn;
        if (!isFinite(x0)) { r.union = null; return r; }
        r.union = { x0: Math.round(x0), x1: Math.round(x1), z0: Math.round(z0), z1: Math.round(z1) };
        r.w = Math.round(x1 - x0); r.d = Math.round(z1 - z0);
        // how far from spawn is the nearest edge? that is what the player hits.
        r.nearEdge = Math.round(Math.min(sp.x - x0, x1 - sp.x, sp.z - z0, z1 - sp.z));
        r.farEdge = Math.round(Math.max(sp.x - x0, x1 - sp.x, sp.z - z0, z1 - sp.z));
        r.bigBodies = big.slice(0, 5);
        // and the union WITHOUT the horizon-spanning plates, for comparison
        let a0 = Infinity, a1 = -Infinity, c0 = Infinity, c1 = -Infinity;
        for (const b of g.world.bodies) {
          if (b.mass !== 0) continue;
          try { if (typeof b.updateAABB === 'function') b.updateAABB(); } catch (e) { continue; }
          const lo = b.aabb && b.aabb.lowerBound, hi = b.aabb && b.aabb.upperBound;
          if (!lo || !isFinite(lo.x) || !isFinite(hi.x)) continue;
          if (hi.x - lo.x > 300 || hi.z - lo.z > 300) continue;
          if (lo.x < a0) a0 = lo.x;
          if (hi.x > a1) a1 = hi.x;
          if (lo.z < c0) c0 = lo.z;
          if (hi.z > c1) c1 = hi.z;
        }
        r.trimmed = isFinite(a0)
          ? { x0: Math.round(a0), x1: Math.round(a1), z0: Math.round(c0), z1: Math.round(c1) } : null;
        return r;
      }, { name: name });
    } catch (e) {
      row = { biome: name, error: String(e).slice(0, 250) };
    }
    out.rows.push(row);
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=b1-aabb.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
