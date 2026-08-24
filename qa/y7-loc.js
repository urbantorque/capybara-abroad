async page => {
  await page.reload(); await page.waitForTimeout(5600);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const CANNON = g.CANNON;
    const res = {};
    for (const bm of ['iceland','sahara','drift']) {
      g.biome.switchTo(bm);
      for (let i=0;i<200;i++) g.tick(1/60,false);
      const locals = [];
      const others = [];
      for (const b of g.world.bodies) {
        if (b.userData && b.userData.local) { locals.push(b); continue; }
        if (b.mass !== 0) continue;
        others.push(b);
      }
      const hits = [];
      const v = new CANNON.Vec3();
      for (const L of locals) {
        const lx = L.position.x, ly = L.position.y, lz = L.position.z;
        for (const o of others) {
          for (let si = 0; si < o.shapes.length; si++) {
            const sh = o.shapes[si];
            if (!sh.halfExtents) continue;
            const off = o.shapeOffsets[si] || { x:0, y:0, z:0 };
            const cx = o.position.x + off.x, cy = o.position.y + off.y, cz = o.position.z + off.z;
            const he = sh.halfExtents;
            // ignore rotation: an approximate AABB test is enough to catch
            // 'the person is inside the furniture'
            const rot = !!(o.shapeOrientations && o.shapeOrientations[si] && Math.abs(o.shapeOrientations[si].w) < 0.999);
            const rx2 = rot ? Math.max(he.x, he.z) : he.x;
            const rz2 = rot ? Math.max(he.x, he.z) : he.z;
            if (Math.abs(lx-cx) < rx2 + 0.05 && Math.abs(lz-cz) < rz2 + 0.05 &&
                Math.abs(ly-cy) < he.y + 0.75) {
              hits.push({ at: [+lx.toFixed(1), +ly.toFixed(1), +lz.toFixed(1)],
                          box: [+cx.toFixed(1), +cy.toFixed(1), +cz.toFixed(1)],
                          he: [+he.x.toFixed(2), +he.y.toFixed(2), +he.z.toFixed(2)] });
              si = o.shapes.length;
            }
          }
        }
      }
      res[bm] = { locals: locals.length, inside: hits };
    }
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=y7loc.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1)))) });
  }, out);
}
