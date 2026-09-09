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
        const CANNON = g.CANNON;
        const nm = arg.name;
        if (g.biome.current !== nm) g.biome.switchTo(nm);
        for (let i = 0; i < 25; i++) g.tick(1 / 60, false);
        const r = { biome: nm, live: g.biome.current };
        const sp = g.biome.spawnOf(nm);

        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        let nPlane = 0, nHf = 0, nBox = 0;
        const v = new CANNON.Vec3();
        function eat(wx, wz) {
          if (wx < x0) x0 = wx;
          if (wx > x1) x1 = wx;
          if (wz < z0) z0 = wz;
          if (wz > z1) z1 = wz;
        }
        for (const b of g.world.bodies) {
          if (b.mass !== 0) continue;
          for (let si = 0; si < b.shapes.length; si++) {
            const s = b.shapes[si];
            const off = b.shapeOffsets[si];
            const cn = s.constructor && s.constructor.name;
            if (cn === 'Plane') { nPlane++; continue; }   // infinite: tells us nothing
            if (cn === 'Heightfield') {
              // extent is (n-1)*elementSize in local x and local y
              const d = s.data;
              if (!d || !d.length || !d[0] || !d[0].length) continue;
              const w = (d.length - 1) * s.elementSize;
              const h = (d[0].length - 1) * s.elementSize;
              nHf++;
              for (const c of [[0, 0], [w, 0], [0, h], [w, h]]) {
                v.set(c[0], c[1], 0);
                if (off) v.vadd(off, v);
                b.quaternion.vmult(v, v);
                v.vadd(b.position, v);
                eat(v.x, v.z);
              }
              continue;
            }
            // everything else: use the shape's own bounding radius about its
            // world-space centre. Cheap, slightly generous, and never infinite.
            nBox++;
            v.copy(off || new CANNON.Vec3());
            b.quaternion.vmult(v, v);
            v.vadd(b.position, v);
            const rad = s.boundingSphereRadius || 0;
            eat(v.x - rad, v.z - rad);
            eat(v.x + rad, v.z + rad);
          }
        }
        r.planes = nPlane; r.heightfields = nHf; r.shapes = nBox;
        if (!isFinite(x0)) { r.box = null; return r; }
        r.box = { x0: Math.round(x0), x1: Math.round(x1), z0: Math.round(z0), z1: Math.round(z1) };
        r.w = Math.round(x1 - x0); r.d = Math.round(z1 - z0);
        r.nearEdge = Math.round(Math.min(sp.x - x0, x1 - sp.x, sp.z - z0, z1 - sp.z));
        r.spawnInside = sp.x > x0 && sp.x < x1 && sp.z > z0 && sp.z < z1;
        return r;
      }, { name: name });
    } catch (e) {
      row = { biome: name, error: String(e).slice(0, 250) };
    }
    out.rows.push(row);
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=b1-aabb2.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
