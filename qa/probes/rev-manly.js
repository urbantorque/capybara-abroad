async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('BracketRight');   // chapter 14 - Manly (Period is Monaco)
  await page.waitForTimeout(4500);
  const info = await page.evaluate(() => {
    const g = window.__capy;
    const r = { live: g.biome.current };
    const api = g.manly;
    if (!api || g.biome.current !== 'manly') return r;
    const th = (x, z) => { const v = api.terrainHeight(x, z); return (v === v) ? v : 0; };
    const sp = g.biome.spawnOf('manly');
    // walk out to the worst cluster the terrain probe found: x -75, z 101..141
    const b = g.capy.body;
    b.position.set(-70, th(-70, 110) + 1.0, 110);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position);
    b.interpolatedPosition.copy(b.position);
    g.capy.carriedBy = null;
    r.terrainSays = +th(-70, 110).toFixed(2);
    return r;
  });
  await page.waitForTimeout(3000);
  const after = await page.evaluate(() => {
    const g = window.__capy;
    const THREE = g.THREE;
    const b = g.capy.body;
    const capyRoot = g.capy.group;
    const isCapy = (o) => { let p = o; while (p) { if (p === capyRoot) return true; p = p.parent; } return false; };
    const ray = new THREE.Raycaster(); ray.far = 80;
    ray.set(new THREE.Vector3(b.position.x, b.position.y - 0.04, b.position.z), new THREE.Vector3(0, -1, 0));
    const hits = ray.intersectObject(g.scene, true);
    let gy = null, what = null;
    for (const h of hits) {
      if (isCapy(h.object)) continue;
      let p = h.object, vis = true;
      while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
      if (vis) { gy = h.point.y; what = h.object.name || '(unnamed)'; break; }
    }
    const api = g.manly;
    const t = api.terrainHeight(b.position.x, b.position.z);
    return {
      pos: [+b.position.x.toFixed(1), +b.position.y.toFixed(2), +b.position.z.toFixed(1)],
      terrainHeightSays: +t.toFixed(2),
      drawnGroundAt: gy === null ? null : +gy.toFixed(2),
      drawnBy: what,
      feetAboveDrawnGround: gy === null ? null : +((b.position.y - 0.34) - gy).toFixed(2),
    };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rev-manly.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, { info, after });
}
