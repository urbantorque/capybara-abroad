async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);

  const out = await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE;
    if (g.biome.current !== 'sydney') g.biome.switchTo('sydney');
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
    const r = { live: g.biome.current };

    // ---- WHY THIS IS NOT rev-people.js's RING METRIC ----------------------
    // That one opens with `if (!o.isMesh) return`, so it never sees a single
    // InstancedMesh — and Sydney's hedges, flower petals, stems, lily pads and
    // half its dressing are instanced. It also drops any mesh with a bounding
    // radius over 60 m, which is every merged garden mesh in the chapter. It
    // was reading 29/0/0/3 on a chapter whose beds are full.
    //
    // This counts POSITIONS: one per non-instanced mesh, one per instance. Then
    // a cell counts as dressed only if it holds two positions at least 3 m
    // apart, so forty petals on one bed are one thing and not forty.
    const pts = [];
    const wp = new THREE.Vector3(), m4 = new THREE.Matrix4();
    g.scene.traverse((o) => {
      if (!o.isMesh && !o.isInstancedMesh) return;
      let p = o, vis = true;
      while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
      if (!vis) return;
      const gm = o.geometry; if (!gm) return;
      if (!gm.boundingSphere) { try { gm.computeBoundingSphere(); } catch (e) { return; } }
      const bs = gm.boundingSphere;
      o.updateWorldMatrix(true, false);
      if (o.isInstancedMesh) {
        // ...AND A PETAL IS NOT SCENERY. A first cut counted every instance
        // and read the east garden at 93 per cent full against a screenshot of
        // bare lawn, because one flower bed is four hundred petal spheres. Only
        // instances that are half a metre of something: a hedge block, a stem,
        // a bench slat, a tree. Radius is the UNIT geometry times the instance
        // scale, so it has to be measured per instance, not per mesh.
        if (bs && bs.radius > 12) return;              // a merged backdrop
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m4);
          wp.setFromMatrixPosition(m4);
          const sc = Math.max(Math.abs(m4.elements[0]), Math.abs(m4.elements[5]), Math.abs(m4.elements[10]));
          if (bs && bs.radius * sc < 0.40) continue;
          o.localToWorld(wp);
          if (wp.x === wp.x) pts.push(wp.x, wp.y, wp.z);
        }
      } else {
        if (bs && (bs.radius > 60 || bs.radius < 0.40)) return;   // sheet, sky, crumbs
        wp.setFromMatrixPosition(o.matrixWorld);
        if (wp.x === wp.x) pts.push(wp.x, wp.y, wp.z);
      }
    });
    r.points = pts.length / 3;

    const sp = g.biome.spawnOf('sydney');
    const api = g.env;
    const th = (x, z) => {
      if (!api || typeof api.terrainHeight !== 'function') return 0;
      const v = api.terrainHeight(x, z); return (v === v) ? v : 0;
    };
    const ow = (api && typeof api.isOverWater === 'function') ? (x, z) => !!api.isOverWater(x, z) : () => false;

    r.rings = [];
    for (const R of [20, 45, 70, 95]) {
      let cells = 0, filled = 0, water = 0;
      for (let a = 0; a < 6.283; a += 20 / R) {
        const x = sp.x + Math.cos(a) * R, z = sp.z + Math.sin(a) * R;
        if (ow(x, z)) { water++; continue; }
        cells++;
        const y0 = th(x, z);
        const near = [];
        for (let i = 0; i < pts.length; i += 3) {
          const dx = pts[i] - x, dz = pts[i + 2] - z;
          if (dx * dx + dz * dz > 100) continue;
          if (pts[i + 1] < y0 + 0.30 || pts[i + 1] > y0 + 25) continue;
          near.push(pts[i], pts[i + 2]);
          if (near.length > 400) break;
        }
        let ok = false;
        for (let i = 0; i < near.length && !ok; i += 2) {
          for (let k = i + 2; k < near.length; k += 2) {
            const dx = near[i] - near[k], dz = near[i + 1] - near[k + 1];
            if (dx * dx + dz * dz >= 9) { ok = true; break; }
          }
        }
        if (ok) filled++;
      }
      r.rings.push({ R: R, cells: cells, water: water, filled: filled,
                     pct: cells ? Math.round(100 * filled / cells) : 0 });
    }

    // ---- and the EAST GARDEN specifically, which is the reported hole
    let east = 0, eastFull = 0;
    for (let x = 40; x <= 66; x += 6) {
      for (let z = 24; z <= 66; z += 6) {
        east++;
        let n = 0;
        for (let i = 0; i < pts.length; i += 3) {
          const dx = pts[i] - x, dz = pts[i + 2] - z;
          if (dx * dx + dz * dz <= 64 && pts[i + 1] > 0.30) { n++; if (n >= 3) break; }
        }
        if (n >= 3) eastFull++;
      }
    }
    r.eastCells = east; r.eastFull = eastFull;
    r.eastPct = east ? Math.round(100 * eastFull / east) : 0;

    let tris = 0;
    g.scene.traverse((o) => {
      if (!o.isMesh && !o.isInstancedMesh) return;
      let p = o, vis = true;
      while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
      if (!vis) return;
      const gm = o.geometry; if (!gm) return;
      const t = gm.index ? gm.index.count / 3 : (gm.attributes.position ? gm.attributes.position.count / 3 : 0);
      tris += t * (o.isInstancedMesh ? o.count : 1);
    });
    r.tris = Math.round(tris);
    r.bodies = g.world.bodies.length;
    return r;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b7-ring.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
