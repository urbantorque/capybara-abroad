async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);

  const src = await (await page.request.get('http://localhost:5188/src/shared.js')).text();
  const chapters = [];
  const re = /\{\s*n:\s*(\d+),\s*biome:\s*'([a-z]+)'/g;
  let m;
  while ((m = re.exec(src))) chapters.push(m[2]);

  // START THE GAME FOR REAL. Without this `started` is false, systems.js never
  // calls backVoid(), and every biome reports "never rescued" — see the 9999s.
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);
  const started = await page.evaluate(() => !!window.__capy.state.started);

  const out = { started: started, rows: [] };
  if (!started) {
    await page.evaluate(async () => {
      await fetch('/shot?name=rev-edge.json', { method: 'POST', body: btoa('{"started":false}') });
    });
    return;
  }

  for (let ci = 0; ci < chapters.length; ci++) {
    const name = chapters[ci];
    let row;
    try {
      row = await page.evaluate(async (arg) => {
        const g = window.__capy;
        const nm = arg.name;
        if (g.biome.current !== nm) g.biome.switchTo(nm);
        for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
        const api = (nm === 'sydney') ? g.env : g[nm];
        const sp = g.biome.spawnOf(nm);
        const r = { biome: nm, live: g.biome.current, spawn: [sp.x, sp.z], bearings: [] };
        const th = (api && typeof api.terrainHeight === 'function')
          ? (x, z) => { const v = api.terrainHeight(x, z); return (typeof v === 'number' && v === v) ? v : 0; }
          : () => 0;
        const ow = (api && typeof api.isOverWater === 'function')
          ? (x, z) => !!api.isOverWater(x, z) : () => false;
        const CANNON = g.CANNON;
        const rf = new CANNON.Vec3(), rt = new CANNON.Vec3();
        const res = new CANNON.RaycastResult();
        const supported = (x, z) => {
          const h = th(x, z);
          res.reset();
          rf.set(x, h + 5, z); rt.set(x, h - 6, z);
          g.world.raycastClosest(rf, rt, { skipBackfaces: false }, res);
          return res.hasHit;
        };

        const NB = 8;
        for (let bi = 0; bi < NB; bi++) {
          const a = bi * Math.PI * 2 / NB;
          const ux = Math.cos(a), uz = Math.sin(a);
          // radius at which support runs out (walking, so skip water)
          let rOut = -1;
          for (let d = 4; d <= 600; d += 4) {
            const x = sp.x + ux * d, z = sp.z + uz * d;
            if (ow(x, z)) continue;          // swimming is legal
            if (!supported(x, z)) { rOut = d; break; }
          }
          // radius at which the game actually puts you back
          let rResc = -1;
          if (rOut > 0) {
            for (let d = rOut; d <= 620; d += 20) {
              const x = sp.x + ux * d, z = sp.z + uz * d;
              const y = th(x, z) + 0.4;
              const body = g.capy.body;
              body.position.set(x, y, z);
              body.velocity.set(0, 0, 0);
              body.previousPosition.copy(body.position);
              body.interpolatedPosition.copy(body.position);
              g.capy.carriedBy = null;
              // 2.5 s is well past sysVOID_HOLD (0.35 s)
              for (let t = 0; t < 150; t++) g.tick(1 / 60, false);
              const px = body.position.x, pz = body.position.z;
              const moved = Math.hypot(px - x, pz - z);
              if (moved > 12) { rResc = d; break; }
            }
          }
          r.bearings.push({
            deg: Math.round(a * 180 / Math.PI),
            rOut: rOut,
            rResc: rResc,
            gap: (rOut > 0) ? (rResc > 0 ? rResc - rOut : -1) : 0,
          });
        }
        // put it back
        const body = g.capy.body;
        body.position.set(sp.x, (sp.y || 1) + 0.4, sp.z);
        body.velocity.set(0, 0, 0);
        body.previousPosition.copy(body.position);
        body.interpolatedPosition.copy(body.position);
        return r;
      }, { name: name });
    } catch (e) {
      row = { biome: name, error: String(e).slice(0, 250) };
    }
    out.rows.push(row);
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=rev-edge.json', {
      method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
