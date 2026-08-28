async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);

  const out = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    const g = window.__capy, THREE = g.THREE;
    if (g.biome.current !== 'drift') { g.biome.switchTo('drift'); await sleep(1700); }
    for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
    const r = { live: g.biome.current };
    if (r.live !== 'drift') return r;
    const api = g.drift;

    // ---- 1. WHAT audit-solid IS ACTUALLY HITTING -------------------------
    // Every drawn thing in the chapter with a bounding sphere, and whether the
    // chapter's own geography answers under its centre. `islandKind` is null
    // over open air, so a silhouette with no island under it is a thing there
    // is nothing to stand on at.
    const wp = new THREE.Vector3();
    const objs = [];
    g.scene.traverse((o) => {
      if (!o.isMesh && !o.isInstancedMesh) return;
      let p = o, vis = true;
      while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
      if (!vis || !o.name) return;
      const gm = o.geometry; if (!gm) return;
      if (!gm.boundingSphere) { try { gm.computeBoundingSphere(); } catch (e) { return; } }
      o.updateWorldMatrix(true, false);
      wp.copy(gm.boundingSphere.center).applyMatrix4(o.matrixWorld);
      objs.push({ name: o.name, at: [Math.round(wp.x), Math.round(wp.y), Math.round(wp.z)],
                  r: Math.round(gm.boundingSphere.radius) });
    });
    r.named = objs;

    // ---- 2. IS THERE ANYTHING TO STAND ON OUT THERE? ---------------------
    // The far rank and the third rank as the source declares them, probed
    // through the biome's own geography rather than read off the table.
    const probes = [];
    for (const p of [[-178, -18, 'farA'], [172, -34, 'farB'], [-150, -246, 'farC'],
                     [158, -262, 'farD'], [-62, 110, 'farE'], [84, 104, 'farF'],
                     [-196, -128, 'farG'], [200, -140, 'farH'],
                     [-300, 60, 'field0'], [286, 96, 'field1'], [318, -260, 'field3'],
                     [-400, -18, 'field11'],
                     [-110, 40, 'deepA (control: solid)'], [0, 30, 'shelf (control: spawn)']]) {
      const h = api.terrainHeight(p[0], p[1]);
      probes.push({ id: p[2], at: [p[0], p[1]],
                    kind: api.islandKind(p[0], p[1]),
                    law: (h === h) ? +h.toFixed(1) : null });
    }
    r.probes = probes;

    // ---- 3. HOW FAR CAN THE ANIMAL ACTUALLY GET? -------------------------
    // Run off the edge of the outermost reachable island with the puff, and
    // measure the horizontal distance before it is below the cloud. That is
    // the number the "unreachable" verdict has to beat.
    const flights = [];
    for (const from of [[-110, 40, -1, 0, 'deepA westward'], [110, -70, 1, 0, 'deepC eastward'],
                        [-10, -234, 0, -1, 'deepE southward']]) {
      const b = g.capy.body;
      g.capy.carriedBy = null;
      const h = api.terrainHeight(from[0], from[1]);
      if (h !== h) { flights.push({ id: from[4], skipped: 'no ground' }); continue; }
      b.position.set(from[0], h + 0.6, from[1]);
      b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
      const x0 = b.position.x, z0 = b.position.z;
      // sprint speed along the bearing, a hop, and the puff on top of it
      let best = 0;
      for (let i = 0; i < 900; i++) {
        if (i < 120) { b.velocity.x = from[2] * 7.4; b.velocity.z = from[3] * 7.4; }
        if (i === 120) b.velocity.y = 6.4;                 // the hop
        if (i === 132) b.velocity.y += 4.9;                // driPUFF_V, one per flight
        g.tick(1 / 60, false);
        const d = Math.hypot(b.position.x - x0, b.position.z - z0);
        if (d > best) best = d;
        if (b.position.y < api.waterLevel - 2) break;
      }
      flights.push({ id: from[4], from: [from[0], from[1]], reach: +best.toFixed(1) });
    }
    r.flights = flights;
    r.bounds = (typeof api.bounds === 'function') ? api.bounds() : null;
    r.genBounds = g.biome.boundsOf('drift');
    return r;
  });

  await page.evaluate(async (o) => {
    await fetch('/shot?name=b10-drift.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
