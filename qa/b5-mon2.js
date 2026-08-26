async page => {
  // Monte Carlo's climb frame is still a flat brown rectangle after the pad
  // fix. Two possibilities and they matter very differently:
  //   the ANIMAL is inside solid geometry — the fallback grabbed an interior
  //   face, which would be a defect of job 3;
  //   or the EYE is inside RENDER-ONLY geometry, which the occlusion ray
  //   cannot see by construction and which is a pre-existing limit of the rig.
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.__capy.biome.switchTo('monaco'));
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE;
    const P = { x: 97.7, y: 27.37, z: 113.6 };          // where the climb ended
    const api = g.monaco || {};
    const out = { navBlocked: null, ground: null, meshes: [], bodiesNear: [] };
    if (typeof api.navBlocked === 'function') out.navBlocked = !!api.navBlocked(P.x, P.z, 0.6);
    if (typeof api.terrainHeight === 'function') out.ground = +api.terrainHeight(P.x, P.z).toFixed(2);
    // Which physics bodies contain or nearly contain the point?
    for (const b of g.world.bodies) {
      if (!b.aabb) continue;
      const a = b.aabb;
      if (P.x > a.lowerBound.x - 1 && P.x < a.upperBound.x + 1 &&
          P.z > a.lowerBound.z - 1 && P.z < a.upperBound.z + 1 &&
          P.y > a.lowerBound.y - 1 && P.y < a.upperBound.y + 1) {
        out.bodiesNear.push({ mass: b.mass, shapes: b.shapes.length,
          aabb: [+a.lowerBound.x.toFixed(0), +a.lowerBound.y.toFixed(0), +a.lowerBound.z.toFixed(0),
                 +a.upperBound.x.toFixed(0), +a.upperBound.y.toFixed(0), +a.upperBound.z.toFixed(0)] });
      }
    }
    // ...and which DRAWN things are within four metres of the eye position?
    const eye = new T.Vector3(96.7, 30.9, 114.3);
    const box = new T.Box3(), v = new T.Vector3();
    g.scene.traverse(o => {
      if (!(o.isMesh || o.isInstancedMesh)) return;
      try {
        box.setFromObject(o);
        if (box.distanceToPoint(eye) < 1.2) {
          box.getSize(v);
          out.meshes.push({ name: o.name || '(unnamed)', geo: o.geometry && o.geometry.type,
                            size: [+v.x.toFixed(0), +v.y.toFixed(0), +v.z.toFixed(0)],
                            side: o.material && o.material.side, inside: box.containsPoint(eye) });
        }
      } catch (e) {}
    });
    out.meshes = out.meshes.slice(0, 14);
    return out;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b5-mon2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, r);
}
