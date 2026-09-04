// WHAT IS BETWEEN THE LENS AND THE ANIMAL IN MONG KOK, BY NAME.
//
// X7 found this and could not fix it inside its own scope: walking A off the
// Kowloon spawn, the frame is one dark awning and the animal is not in it —
// identically before and after the radial clamp, because sysCamClear rays the
// PHYSICS world and the awnings are drawn only. The boom cut does fire
// (`clear` 0.18) but against something else entirely, so the camera is solving
// a problem it can see while the picture is ruined by one it cannot.
//
// To fix it you have to know WHICH mesh. This walks the spawn route and rays
// camera -> animal against the SCENE, then reports the occluder's name, its
// world-space bounding box, and whether the physics world has anything at that
// point at all. That last column is the whole question: a drawn-only occluder
// is one the ray cannot see.
async page => {
  const out = { samples: [] };
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Minus');            // 11 = kowloon (Equal is Palawan)
  await page.waitForTimeout(6500);
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  out.spawn = await page.evaluate(() => {
    const g = window.__capy, a = g[g.biome.current];
    return a && a.SPAWN ? { x: a.SPAWN.x, y: a.SPAWN.y, z: a.SPAWN.z } : null;
  });
  await page.evaluate(() => {
    const g = window.__capy, a = g[g.biome.current];
    const sp = a.SPAWN;
    g.capy.body.position.set(sp.x, sp.y + 0.2, sp.z);
    g.capy.body.velocity.set(0, 0, 0);
    g.capy.body.aabbNeedsUpdate = true;
  });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const g = window.__capy, T = g.THREE, C = g.CANNON;
    const rc = new T.Raycaster(), dir = new T.Vector3(), box = new T.Box3();
    const vis = (o) => { while (o) { if (o.visible === false) return false; o = o.parent; } return true; };
    // The chain of names up to the biome root, which is how you find the
    // builder that made a mesh nobody thought to name.
    const chain = (o) => { const n = []; while (o && n.length < 6) { n.push(o.name || o.type); o = o.parent; } return n.join('/'); };
    window.__hk = [];
    window.__hkT = setInterval(() => {
      const c = g.capy, p = c.position, cam = g.camera, cp = cam.position;
      dir.set(p.x - cp.x, (p.y + 0.35) - cp.y, p.z - cp.z);
      const d2 = dir.length(); dir.normalize();
      rc.set(cp, dir); rc.near = 0.02; rc.far = Math.max(0.05, d2 - 0.75);
      let occ = null;
      for (const h of rc.intersectObjects(g.scene.children, true)) {
        const o = h.object;
        if (!o.isMesh && !o.isInstancedMesh) continue;
        if (!vis(o)) continue;
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (!m || (m.transparent && m.opacity < 0.35) || m.depthWrite === false) continue;
        box.setFromObject(o);
        // ...AND WHETHER THE PHYSICS WORLD HAS ANYTHING THERE. A cannon ray
        // from the lens along the same direction: if it stops much further away
        // than the drawn hit did, the drawn thing is not in the physics world
        // and sysCamClear is blind to it.
        const from = new C.Vec3(cp.x, cp.y, cp.z);
        const to = new C.Vec3(cp.x + dir.x * d2, cp.y + dir.y * d2, cp.z + dir.z * d2);
        const res = new C.RaycastResult();
        g.world.raycastClosest(from, to, { skipBackfaces: true }, res);
        occ = {
          name: o.name || o.type, chain: chain(o),
          d: +h.distance.toFixed(2),
          box: [+box.min.x.toFixed(1), +box.min.y.toFixed(1), +box.min.z.toFixed(1),
                +box.max.x.toFixed(1), +box.max.y.toFixed(1), +box.max.z.toFixed(1)],
          physHit: res.hasHit ? +res.distance.toFixed(2) : null,
          drawnOnly: !res.hasHit || res.distance > h.distance + 0.5,
        };
        break;
      }
      window.__hk.push({
        at: [+p.x.toFixed(1), +p.z.toFixed(1)],
        camY: +cp.y.toFixed(2), capY: +p.y.toFixed(2),
        clear: +g.camInfo.clear.toFixed(2),
        dist: +Math.hypot(cp.x - p.x, cp.y - p.y, cp.z - p.z).toFixed(2),
        occ,
      });
      if (window.__hk.length > 300) window.__hk.shift();
    }, 100);
  });
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'qa/px-hk-awn-1.png' });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'qa/px-hk-awn-2.png' });
  await page.keyboard.up('KeyA');
  out.samples = await page.evaluate(() => window.__hk.slice());
  await page.evaluate(() => clearInterval(window.__hkT));
  await page.evaluate(o => fetch('/shot?name=px-hk-awn.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
