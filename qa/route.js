async page => {
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);
  const out = {};
  for (const name of ['monaco','hanoi','kyoto','goreme','venice','manly','quay','sahara']) {
    out[name] = await page.evaluate(async (n) => {
      const g = window.__capy, THREE = g.THREE;
      g.biome.switchTo(n);
      for (let i = 0; i < 120; i++) g.tick(1/60, false);
      // every drawn thing with a world position, ground plates excluded
      const items = [];
      const box = new THREE.Box3(), v = new THREE.Vector3(), sz = new THREE.Vector3();
      g.scene.traverse(o => {
        if (!(o.isMesh || o.isInstancedMesh)) return;
        for (let p = o; p; p = p.parent) if (!p.visible) return;
        if (g.capy && o === g.capy.group) return;
        try {
          // AN INSTANCED MESH IS N THINGS IN N PLACES, not one thing at the
          // centre of their bounding box. The first version of this probe took
          // the box centre, so every scattered lamp, palm, bollard and tree in
          // the game -- which is most of the dressing in every chapter -- was
          // counted as ONE object somewhere in the middle of the chapter and
          // was invisible everywhere else. It reported 48 dead cells in Monte
          // Carlo, and adding fifteen lamps along the exact line it complained
          // about moved the number UP to 53.
          if (o.isInstancedMesh) {
            const m = new THREE.Matrix4();
            for (let i = 0; i < o.count; i++) {
              o.getMatrixAt(i, m);
              v.setFromMatrixPosition(m);
              o.localToWorld(v);
              items.push({ x: v.x, z: v.z, inst: 1 });
            }
            return;
          }
          box.setFromObject(o); box.getSize(sz); box.getCenter(v);
          const r = Math.max(sz.x, sz.z) * 0.5;
          if (r > 90) return;                    // ground, sea, sky dome
          if (sz.y < 0.02 && r > 40) return;
          items.push({ x: v.x, z: v.z, inst: 1 });
        } catch (e) {}
      });
      // walk the main route: spawn -> each landmark the chapter publishes
      const a = g[n];
      const marks = [];
      for (const k of Object.keys(a)) {
        const val = a[k];
        if (val && typeof val === 'object' && typeof val.x === 'number' && typeof val.z === 'number'
            && !Array.isArray(val)) marks.push({ k, x: val.x, z: val.z });
      }
      const sp = g.biome.spawnOf(n);
      // 20 m cells along each spawn->landmark leg; count drawn things within 12 m
      const dead = [];
      for (const m of marks) {
        const dx = m.x - sp.x, dz = m.z - sp.z;
        const L = Math.hypot(dx, dz);
        if (L < 25) continue;
        const steps = Math.floor(L / 20);
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          const px = sp.x + dx * t, pz = sp.z + dz * t;
          // A CELL OVER WATER OR INSIDE A BUILDING IS NOT A DEAD CELL.
          // The first version of this counted both and reported 74 dead cells
          // in Monte Carlo -- most of them the harbour, which is empty because
          // it is a harbour. A detector that cannot tell "nothing here" from
          // "nothing can be here" is a cry-wolf detector.
          if (a.isOverWater && a.isOverWater(px, pz)) continue;
          if (a.navBlocked && a.navBlocked(px, pz, 0.6)) continue;
          let near = 0;
          for (const it of items) {
            const ex = it.x - px, ez = it.z - pz;
            if (ex*ex + ez*ez < 144) near += it.inst;
          }
          if (near === 0) dead.push({ leg: m.k, x: +px.toFixed(0), z: +pz.toFixed(0) });
        }
      }
      return { drawnObjects: items.length, landmarks: marks.length,
               deadCells: dead.length, dead: dead.slice(0, 12) };
    }, name);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=co-route.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
