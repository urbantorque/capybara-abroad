async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);

  const res = {};

  // ---- 1. the chapter builds, runs and nothing is standing in a wall ------
  res.state = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    const g = window.__capy, THREE = g.THREE;
    if (g.biome.current !== 'hanoi') { g.biome.switchTo('hanoi'); await sleep(1800); }
    g.state.lastError = null;
    for (let i = 0; i < 900; i++) g.tick(1 / 60, false);      // 15 s of ticks
    const r = { live: g.biome.current, err: g.state.lastError || null };
    const api = g.hanoi;

    // people inside the new frontage. navBlocked knows about the terraces now,
    // so this is the test that says whether anything was placed before they
    // were registered.
    const bad = [];
    g.scene.traverse((o) => {
      if (!o.isGroup && !o.isMesh) return;
      const nm = (o.name || '');
      if (!/folk|local|npc|stool|cau|puppet/i.test(nm)) return;
      o.updateWorldMatrix(true, false);
      const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
      if (p.x !== p.x) return;
      if (api.navBlocked(p.x, p.z, 0.4)) bad.push([nm, Math.round(p.x), Math.round(p.z)]);
    });
    r.inWall = bad.length; r.inWallList = bad.slice(0, 10);

    // every task anchor: is it somewhere the animal could stand?
    const t = [];
    const list = (g.tasks && typeof g.tasks.open === 'function') ? g.tasks.open() : null;
    if (list) for (const q of list) {
      const a = q && q.anchor;
      if (!a) { t.push([q && q.id, 'no anchor']); continue; }
      if (api.navBlocked(a.x, a.z, 0.5)) t.push([q.id, 'blocked', Math.round(a.x), Math.round(a.z)]);
    }
    r.tasks = t;
    return r;
  });

  // ---- 2. terrain law vs the drawn ground, hanoi only ---------------------
  res.terr = await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE;
    const api = g.hanoi;
    g.capy.group.visible = false;                              // trap 11
    const rc = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
    let n = 0, over15 = 0, over50 = 0, sum = 0;
    for (let i = 0; i < 24; i++) {
      for (let k = 0; k < 24; k++) {
        const x = -140 + 280 * (i + 0.5) / 24, z = -150 + 300 * (k + 0.5) / 24;
        if (api.isOverWater(x, z)) continue;
        const h = api.terrainHeight(x, z);
        if (h !== h) continue;
        rc.set(new THREE.Vector3(x, h + 40, z), down); rc.far = 80;
        const hits = rc.intersectObject(g.scene, true).filter(q => q.object.visible);
        // the LOWEST hit is the ground; a roof is not the terrain (block 3)
        let ground = null;
        for (const q of hits) if (ground === null || q.point.y < ground) ground = q.point.y;
        if (ground === null) continue;
        const e = Math.abs(ground - h);
        n++; sum += e;
        if (e > 0.15) over15++;
        if (e > 0.50) over50++;
      }
    }
    g.capy.group.visible = true;
    return { n: n, mean: +(sum / Math.max(1, n)).toFixed(3),
             p15: +(100 * over15 / Math.max(1, n)).toFixed(1),
             p50: +(100 * over50 / Math.max(1, n)).toFixed(1) };
  });

  // ---- 3. does anything new block ground that used to be walkable? -------
  //  block 5's test: a point the capybara's own collider overlaps a static box
  //  AND has nothing drawn above it was never rock.
  res.block = await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE, CANNON = g.CANNON;
    const api = g.hanoi;
    const rc = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
    const boxes = [];
    for (const b of g.world.bodies) {
      if (b.mass !== 0) continue;
      for (let si = 0; si < b.shapes.length; si++) {
        const sh = b.shapes[si];
        if (!(sh instanceof CANNON.Box)) continue;
        const off = b.shapeOffsets[si];
        const c = new CANNON.Vec3(off.x, off.y, off.z);
        b.quaternion.vmult(c, c); c.vadd(b.position, c);
        const q = b.quaternion.mult(b.shapeOrientations[si]);
        boxes.push({ c: c, q: q, h: sh.halfExtents });
      }
    }
    const inv = new CANNON.Quaternion(), loc = new CANNON.Vec3();
    let n = 0, blocked = 0, ghost = 0;
    for (let i = 0; i < 30; i++) {
      for (let k = 0; k < 30; k++) {
        const x = -140 + 280 * (i + 0.5) / 30, z = -150 + 300 * (k + 0.5) / 30;
        if (api.isOverWater(x, z)) continue;
        const y = api.terrainHeight(x, z) + 0.34;
        if (y !== y) continue;
        n++;
        let hit = false;
        for (const B of boxes) {
          if (Math.abs(x - B.c.x) > B.h.x + 3 || Math.abs(z - B.c.z) > B.h.z + 3) continue;
          if (Math.abs(y - B.c.y) > B.h.y + 0.4) continue;
          B.q.conjugate(inv);
          loc.set(x - B.c.x, y - B.c.y, z - B.c.z);
          inv.vmult(loc, loc);
          if (Math.abs(loc.x) < B.h.x + 0.34 && Math.abs(loc.y) < B.h.y + 0.34 &&
              Math.abs(loc.z) < B.h.z + 0.34) { hit = true; break; }
        }
        if (!hit) continue;
        blocked++;
        rc.set(new THREE.Vector3(x, api.terrainHeight(x, z) + 40, z), down); rc.far = 80;
        const hits = rc.intersectObject(g.scene, true).filter(q => q.object.visible);
        let top = -99;
        for (const q of hits) if (q.point.y > top) top = q.point.y;
        if (top < api.terrainHeight(x, z) + 0.9) ghost++;
      }
    }
    return { n: n, blocked: blocked, ghost: ghost };
  });

  await page.evaluate(async (o) => {
    await fetch('/shot?name=b9-verify.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, res);
}
