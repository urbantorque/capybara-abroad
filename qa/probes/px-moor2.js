// THE MOORING FIELD, LOOKED AT RATHER THAN COUNTED.
//
// px-bodies.js proved the colliders exist (+33 static bodies) and that a
// swimming animal is stopped by one. It also produced a frame that is a wall of
// hull with no animal in it, and ended with the body at y 1.73 when the deck it
// should be standing on is at 0.42. Both of those need an answer before the
// change can be called finished.
//
// So: what is under the animal, is it grounded, where is it on the screen, and
// what is between the lens and it.
async page => {
  const out = {};
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(7000);
  out.biome = await page.evaluate(() => window.__capy.biome.current);

  out.hull = await page.evaluate(() => {
    const g = window.__capy, C = g.CANNON;
    const F = { x: -104, z: -172 };
    const y = g[g.biome.current].waterLevel + 0.25;
    for (let r = 4; r < 40; r += 1.5) {
      for (let th = 0; th < 48; th++) {
        const a2 = th / 48 * 6.283;
        const x = F.x + Math.cos(a2) * r, z = F.z + Math.sin(a2) * r;
        const res = new C.RaycastResult();
        g.world.raycastClosest(new C.Vec3(x, y + 6, z), new C.Vec3(x, y - 0.4, z),
                               { skipBackfaces: true }, res);
        if (res.hasHit) return { x: +x.toFixed(2), z: +z.toFixed(2),
                                 hitY: +res.hitPointWorld.y.toFixed(2) };
      }
    }
    return null;
  });

  // Stand the animal ON the deck rather than swimming at it, and let it settle.
  await page.evaluate((h) => {
    const g = window.__capy;
    g.capy.body.position.set(h.x, h.hitY + 0.9, h.z);
    g.capy.body.velocity.set(0, 0, 0);
    g.capy.body.aabbNeedsUpdate = true;
  }, out.hull);
  await page.waitForTimeout(2500);

  out.rest = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE, C = g.CANNON;
    const c = g.capy, p = c.position, cam = g.camera, cp = cam.position;
    // What is directly under it, in the physics world.
    const res = new C.RaycastResult();
    g.world.raycastClosest(new C.Vec3(p.x, p.y, p.z), new C.Vec3(p.x, p.y - 4, p.z),
                           { skipBackfaces: true }, res);
    // Where it is on the screen.
    const a = new T.Vector3(p.x, p.y - 0.34, p.z).project(cam);
    const b = new T.Vector3(p.x, p.y + 0.42, p.z).project(cam);
    // What is between the lens and it.
    const rc = new T.Raycaster(), dir = new T.Vector3(p.x - cp.x, p.y - cp.y, p.z - cp.z);
    const d2 = dir.length(); dir.normalize();
    rc.set(cp, dir); rc.near = 0.02; rc.far = Math.max(0.05, d2 - 0.75);
    const vis = (o) => { while (o) { if (o.visible === false) return false; o = o.parent; } return true; };
    let occ = null;
    for (const h of rc.intersectObjects(g.scene.children, true)) {
      const o = h.object;
      if (!o.isMesh && !o.isInstancedMesh) continue;
      if (!vis(o)) continue;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (!m || (m.transparent && m.opacity < 0.35) || m.depthWrite === false) continue;
      occ = { d: +h.distance.toFixed(2), name: o.name || o.type,
              inst: !!o.isInstancedMesh, count: o.count || 0 };
      break;
    }
    return {
      at: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
      grounded: !!c.grounded, swimming: !!c.swimming,
      under: res.hasHit ? +res.hitPointWorld.y.toFixed(2) : null,
      underDist: res.hasHit ? +res.distance.toFixed(2) : null,
      camY: +cp.y.toFixed(2), boom: +Math.hypot(cp.x - p.x, cp.y - p.y, cp.z - p.z).toFixed(2),
      clear: +g.camInfo.clear.toFixed(2),
      screenX: +((a.x + b.x) / 4).toFixed(2), screenY: +((a.y + b.y) / 4).toFixed(2),
      onScreen: Math.abs((a.x + b.x) / 4) < 0.5 && Math.abs((a.y + b.y) / 4) < 0.5,
      occ,
    };
  });
  await page.screenshot({ path: 'qa/px-moor2-deck.png' });

  // ...and from outside the field, which is the shot a player actually gets:
  // swim past it rather than into it.
  await page.evaluate((h) => {
    const g = window.__capy;
    g.capy.body.position.set(h.x + 22, 0.3, h.z + 22);
    g.capy.body.velocity.set(0, 0, 0);
    g.capy.body.aabbNeedsUpdate = true;
  }, out.hull);
  await page.waitForTimeout(2200);
  await page.screenshot({ path: 'qa/px-moor2-off.png' });
  out.err = await page.evaluate(() =>
    (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null);
  await page.evaluate(o => fetch('/shot?name=px-moor2.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
