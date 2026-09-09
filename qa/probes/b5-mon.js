async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);
  const out = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    const g = window.__capy, THREE = g.THREE, CANNON = g.CANNON;
    if (g.biome.current !== 'monaco') { g.biome.switchTo('monaco'); await sleep(1200); }
    for (let i = 0; i < 25; i++) g.tick(1 / 60, false);
    const r = { live: g.biome.current, bodies: [], probes: [] };
    const api = g.monaco;
    const th = (x, z) => { const v = api.terrainHeight(x, z); return (typeof v === 'number' && v === v) ? v : 0; };

    // every static body, with its shape count and AABB
    for (const b of g.world.bodies) {
      if (b.mass !== 0) continue;
      let kinds = {};
      for (const s of b.shapes) { const k = s.constructor.name; kinds[k] = (kinds[k] || 0) + 1; }
      b.updateAABB();
      const lo = b.aabb.lowerBound, hi = b.aabb.upperBound;
      r.bodies.push({
        kinds: kinds, n: b.shapes.length,
        pos: [+b.position.x.toFixed(1), +b.position.y.toFixed(1), +b.position.z.toFixed(1)],
        aabb: [lo.x, lo.y, lo.z, hi.x, hi.y, hi.z].map(v => isFinite(v) ? +v.toFixed(1) : String(v)),
      });
    }

    const meshes = [];
    g.scene.traverse(o => {
      if (!o.isMesh && !o.isInstancedMesh) return;
      for (let p = o; p; p = p.parent) if (!p.visible) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m || m.transparent) return;
      meshes.push(o);
    });
    const ray = new THREE.Raycaster(); ray.far = 3;
    const org = new THREE.Vector3(), dir = new THREE.Vector3();
    const from = new CANNON.Vec3(), to = new CANNON.Vec3();
    const rr = new CANNON.RaycastResult();

    const PTS = [[-145,-25],[-140,-55],[-140,-25],[-140,-20],[-135,-35],
                 [-135,-15],[-130,-50],[-130,-35],[-120,5],[-110,-20],[-145,-30],[-145,-15]];
    for (const [x, z] of PTS) {
      const y = th(x, z) + 0.55;
      const row = { at: [x, z], y: +y.toFixed(2), hits: [] };
      for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        org.set(x, y, z); dir.set(dx, 0, dz); ray.set(org, dir);
        const its = ray.intersectObjects(meshes, false);
        if (!its.length || its[0].distance > 2.5) continue;
        const it = its[0];
        if (it.point.y <= th(it.point.x, it.point.z) + 0.40) continue;
        from.set(x, y, z);
        to.set(x + dx * (it.distance + 0.7), y, z + dz * (it.distance + 0.7));
        rr.reset();
        g.world.raycastClosest(from, to, { skipBackfaces: false }, rr);
        row.hits.push({
          dir: [dx, dz], d: +it.distance.toFixed(2),
          pt: [+it.point.x.toFixed(1), +it.point.y.toFixed(1), +it.point.z.toFixed(1)],
          obj: it.object.name || it.object.type,
          tris: it.object.geometry && it.object.geometry.index
            ? it.object.geometry.index.count / 3
            : (it.object.geometry ? it.object.geometry.attributes.position.count / 3 : 0),
          solid: !!rr.hasHit,
        });
      }
      r.probes.push(row);
    }
    return r;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b5-mon.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
