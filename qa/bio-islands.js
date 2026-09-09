async page => {
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);

  const CH = ['sydney', 'manly', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara',
              'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'pantanal', 'cave',
              'antarctic', 'monaco', 'hanoi', 'pasto'];
  const out = [];

  for (const b of CH) {
    await page.evaluate((n) => {
      const g = window.__capy;
      try { g.hud.cross(n); } catch (e) { g.biome.switchTo(n); }
    }, b);
    await page.waitForTimeout(4000);

    const row = await page.evaluate(() => {
      const g = window.__capy, C = g.CANNON;
      const live = g.biome.current;

      function surf(x, z, from) {
        const a = new C.Vec3(x, from === undefined ? 60 : from, z);
        const bv = new C.Vec3(x, -40, z);
        const r = new C.RaycastResult();
        g.world.raycastClosest(a, bv, {}, r);
        return r.hasHit ? r.hitPointWorld.y : null;
      }

      // Every STATIC BOX in the live world with a flat top big enough to stand
      // on. Dynamic props are excluded: a crate you can push is not a structure.
      const isles = [];
      for (const body of g.world.bodies) {
        if (body.mass !== 0) continue;
        if (!body.shapes.length) continue;
        const s = body.shapes[0];
        if (!s.halfExtents) continue;                 // boxes only, not the heightfield
        const hx = s.halfExtents.x, hy = s.halfExtents.y, hz = s.halfExtents.z;
        const area = 4 * hx * hz;
        if (area < 4) continue;                       // smaller than 2 m x 2 m is not a platform
        const top = body.position.y + hy;
        const cx = body.position.x, cz = body.position.z;

        // What is the highest thing you could be standing on just outside it?
        // Ring at the footprint plus a metre, eight points.
        let best = -1e9, ringHits = 0;
        for (let k = 0; k < 8; k++) {
          const a = k * Math.PI / 4;
          const rx = cx + Math.cos(a) * (hx + 1.2), rz = cz + Math.sin(a) * (hz + 1.2);
          const y = surf(rx, rz);
          if (y === null) continue;
          ringHits++;
          if (y > best) best = y;
        }
        if (!ringHits) continue;
        const step = top - best;
        if (step <= 0.75) continue;                   // you can simply step or hop up
        if (step > 14) continue;                      // a tower is not a design defect
        isles.push({ x: +cx.toFixed(1), y: +top.toFixed(2), z: +cz.toFixed(1),
                     w: +(hx * 2).toFixed(1), d: +(hz * 2).toFixed(1),
                     area: +area.toFixed(0), step: +step.toFixed(2) });
      }
      isles.sort((a, b) => b.area - a.area);
      // merge neighbours: a bridge is thirty boxes, not thirty findings
      const groups = [];
      for (const i of isles) {
        let g2 = null;
        for (const q of groups) {
          if (Math.abs(q.x - i.x) < 14 && Math.abs(q.z - i.z) < 26 && Math.abs(q.y - i.y) < 4) { g2 = q; break; }
        }
        if (g2) { g2.n++; g2.area += i.area; g2.step = Math.min(g2.step, i.step);
                  g2.x = (g2.x * (g2.n - 1) + i.x) / g2.n; g2.z = (g2.z * (g2.n - 1) + i.z) / g2.n; }
        else groups.push({ x: i.x, y: i.y, z: i.z, area: i.area, step: i.step, n: 1 });
      }
      groups.sort((a, b) => b.area - a.area);
      return { biome: live, boxes: isles.length,
               groups: groups.slice(0, 8).map(q => ({ x: +q.x.toFixed(0), y: +q.y.toFixed(1), z: +q.z.toFixed(0),
                                                      area: +q.area.toFixed(0), step: +q.step.toFixed(2), n: q.n })) };
    });
    out.push(row);
  }

  await page.evaluate(async (p) => {
    await fetch('/shot?name=BIO-ISLANDS', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(p)))) });
  }, out);
}
