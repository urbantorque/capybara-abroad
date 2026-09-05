// TWO CLAIMS THAT NEED A CLOSER LOOK.
//
// px-claims.js swam at Bennelong Point from the NORTH only and never grounded,
// topping out at 2.27 against a podium at 2.60 — 33 cm short, which is close
// enough that one approach is not an answer. And it measured a running jump in
// the Drift at 4.54 m over the arch island against a ring whose springline is
// 3.6, which would make "the ring is over four metres up and out of reach"
// wrong twice.
//
// So: Bennelong from all four sides, and the arch measured against the mesh
// that is actually drawn rather than against the constants in the roost code.
async page => {
  const out = {};

  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(7000);
  out.quayBiome = await page.evaluate(() => window.__capy.biome.current);
  out.ben = await page.evaluate(() => {
    const a = window.__capy.quay;
    return { top: +a.terrainHeight(78, 6).toFixed(2), water: a.waterLevel,
             // where the nine steps are, which is the land route on
             stepTop: +a.terrainHeight(78, 26).toFixed(2),
             stepFoot: +a.terrainHeight(78, 33).toFixed(2) };
  });
  out.bennelong = [];
  for (const [side, dx, dz] of [['N', 0, -1], ['S', 0, 1], ['E', 1, 0], ['W', -1, 0]]) {
    for (const key of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) {
      const ok = await page.evaluate(a => {
        const g = window.__capy, q = g.quay;
        let s = null;
        for (let d = 24; d < 140; d += 2) {
          const x = 78 + a.dx * d, z = 6 + a.dz * d;
          if (q.isOverWater(x, z) && q.terrainHeight(x, z) < 1) { s = { x, z }; break; }
        }
        if (!s) return false;
        g.capy.body.position.set(s.x, 0.3, s.z);
        g.capy.body.velocity.set(0, 0, 0);
        g.capy.body.aabbNeedsUpdate = true;
        window.__m = -999; window.__g = -999;
        if (window.__t) clearInterval(window.__t);
        window.__t = setInterval(() => {
          const p = g.capy.position;
          if (p.y > window.__m) window.__m = p.y;
          if (g.capy.grounded && p.y > window.__g) window.__g = p.y;
        }, 40);
        return true;
      }, { dx, dz });
      if (!ok) { out.bennelong.push({ side, key, err: 'no water' }); continue; }
      await page.waitForTimeout(500);
      await page.keyboard.down(key);
      for (let k = 0; k < 10; k++) { await page.waitForTimeout(600); await page.keyboard.press('Space'); }
      await page.keyboard.up(key);
      await page.waitForTimeout(400);
      out.bennelong.push(await page.evaluate(a => {
        const g = window.__capy, p = g.capy.position;
        clearInterval(window.__t);
        return { side: a.side, key: a.key, maxY: +window.__m.toFixed(2),
                 maxGnd: window.__g < -900 ? null : +window.__g.toFixed(2),
                 end: [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)],
                 gnd: !!g.capy.grounded, swim: !!g.capy.swimming };
      }, { side, key }));
    }
  }

  // ---- the Drift arch, against the mesh that is drawn --------------------
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Digit9');
  await page.waitForTimeout(7000);
  out.driBiome = await page.evaluate(() => window.__capy.biome.current);
  // Ray UP from the island under the archway on a grid, and record the lowest
  // drawn surface over each point, and whether the physics world has anything
  // there. That is the height a jump has to beat to be inside drawn stone.
  out.archScan = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE, C = g.CANNON;
    const rc = new T.Raycaster(), up = new T.Vector3(0, 1, 0);
    const vis = o => { while (o) { if (o.visible === false) return false; o = o.parent; } return true; };
    const rows = [];
    const gy = g.drift.terrainHeight(5, -106);
    for (let u = -4; u <= 4; u += 1) {
      for (let v = -2; v <= 2; v += 2) {
        const x = 5 + u, z = -106 + v;
        rc.set(new T.Vector3(x, gy + 0.5, z), up);
        rc.near = 0.05; rc.far = 20;
        const h = rc.intersectObjects(g.scene.children, true).find(hit => {
          const o = hit.object;
          if (!o.isMesh && !o.isInstancedMesh) return false;
          if (!vis(o)) return false;
          const m = Array.isArray(o.material) ? o.material[0] : o.material;
          return m && !(m.transparent && m.opacity < 0.35) && m.depthWrite !== false;
        });
        if (!h) continue;
        const drawnY = gy + 0.5 + h.distance;
        const res = new C.RaycastResult();
        g.world.raycastClosest(new C.Vec3(x, gy + 0.5, z), new C.Vec3(x, drawnY + 0.4, z),
                               { skipBackfaces: true }, res);
        rows.push({ u, v, drawn: +(drawnY - gy).toFixed(2),
                    solid: res.hasHit ? +(res.hitPointWorld.y - gy).toFixed(2) : null });
      }
    }
    return { islandY: +gy.toFixed(2), rows };
  });
  // ...and the apex, running, from four directions
  out.archJump = [];
  for (const key of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) {
    await page.evaluate(() => {
      const g = window.__capy, a = g.drift;
      const h = a.terrainHeight(5, -106);
      g.capy.body.position.set(5, (h === h ? h : 84) + 0.6, -106 + 7);
      g.capy.body.velocity.set(0, 0, 0);
      g.capy.body.aabbNeedsUpdate = true;
      window.__m = -999; window.__inside = 0;
      if (window.__t) clearInterval(window.__t);
      window.__t = setInterval(() => {
        const p = g.capy.position;
        if (p.y > window.__m) window.__m = p.y;
      }, 40);
    });
    await page.waitForTimeout(500);
    await page.keyboard.down(key);
    for (let k = 0; k < 8; k++) { await page.waitForTimeout(700); await page.keyboard.press('Space'); }
    await page.keyboard.up(key);
    await page.waitForTimeout(400);
    out.archJump.push(await page.evaluate(a => {
      const g = window.__capy, p = g.capy.position;
      clearInterval(window.__t);
      const gy = g.drift.terrainHeight(5, -106);
      return { key: a, apexOverIsland: +(window.__m - gy).toFixed(2),
               end: [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)] };
    }, key));
  }
  await page.screenshot({ path: 'qa/px-claims2-arch.png' });
  out.err = await page.evaluate(() =>
    (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null);
  await page.evaluate(o => fetch('/shot?name=px-claims2.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
