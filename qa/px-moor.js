// THIRTY-THREE MOORED YACHTS: ARE THEY IN THE WORLD, AND DID MAKING THEM SOLID
// WALL ANYTHING OFF?
//
// Two questions, because the fix has two halves. The collider half: swim at a
// hull and stop. The quayHARD half: the boat you steer must be pushed out of a
// mooring field — but the FAIRWAY must be exactly as wide as it was, because a
// mooring field tucked into a cove is scenery and not a gate.
//
// So: ray the physics world at chest height through each of the three fields,
// then walk the ferry's own route past them and check the hull test never fires
// on the way through open water.
async page => {
  const out = {};
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Digit3');             // 3 = quay
  await page.waitForTimeout(7000);
  out.biome = await page.evaluate(() => window.__capy.biome.current);

  out.fields = await page.evaluate(() => {
    const g = window.__capy, C = g.CANNON, T = g.THREE;
    const FIELDS = [{ x: -104, z: -172 }, { x: 176, z: -262 }, { x: -64, z: -330 }];
    const rc = new T.Raycaster(), dir = new T.Vector3();
    const vis = (o) => { while (o) { if (o.visible === false) return false; o = o.parent; } return true; };
    return FIELDS.map(f => {
      // Fire 36 rays outward from the field centre at the height a swimming
      // capybara's chest is, and count how many find a PHYSICS hit and how
      // many find a DRAWN one. Before the fix the drawn count is high and the
      // physics count is zero; that gap is the whole bug.
      let phys = 0, drawn = 0, n = 0;
      for (let a = 0; a < 36; a++) {
        const th = (a / 36) * Math.PI * 2;
        const dx = Math.cos(th), dz = Math.sin(th);
        const y = 0.35;                       // just above the waterline
        const from = new C.Vec3(f.x, y, f.z);
        const to = new C.Vec3(f.x + dx * 44, y, f.z + dz * 44);
        const res = new C.RaycastResult();
        g.world.raycastClosest(from, to, { skipBackfaces: true }, res);
        if (res.hasHit) phys++;
        rc.set(new T.Vector3(f.x, y, f.z), dir.set(dx, 0, dz));
        rc.near = 0.05; rc.far = 44;
        const hit = rc.intersectObjects(g.scene.children, true)
          .find(h => (h.object.isMesh || h.object.isInstancedMesh) && vis(h.object) &&
                     h.object.material && h.object.material.depthWrite !== false);
        if (hit) drawn++;
        n++;
      }
      return { at: [f.x, f.z], rays: n, phys, drawn };
    });
  });

  // ...and can you actually swim into one and be stopped? Put the animal in the
  // water 14 m off a field centre, hold W towards it, and see where it ends up.
  out.swim = await page.evaluate(async () => {
    const g = window.__capy;
    const f = { x: -104, z: -172 };
    g.capy.body.position.set(f.x, 0.4, f.z + 26);
    g.capy.body.velocity.set(0, 0, 0);
    g.capy.body.aabbNeedsUpdate = true;
    await new Promise(r => setTimeout(r, 900));
    return { start: [+g.capy.position.x.toFixed(1), +g.capy.position.z.toFixed(1)],
             y: +g.capy.position.y.toFixed(2) };
  });
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(4000);
  await page.keyboard.up('KeyW');
  out.swimEnd = await page.evaluate(() => ({
    at: [+window.__capy.capy.position.x.toFixed(1), +window.__capy.capy.position.z.toFixed(1)],
    y: +window.__capy.capy.position.y.toFixed(2),
  }));
  await page.screenshot({ path: 'qa/px-moor-1.png' });

  // THE FAIRWAY IS UNCHANGED. Sample the hull test on a grid down the middle of
  // the harbour, where the ferry route runs, and count blocked cells. If this
  // moves at all, the mooring circles are reaching out of their coves.
  out.fairway = await page.evaluate(() => {
    const g = window.__capy, a = g[g.biome.current];
    if (typeof a.hardAt !== 'function') return 'no hardAt hook';
    let n = 0; const by = {};
    for (let z = -560; z <= 60; z += 10) {
      for (let x = -240; x <= 300; x += 10) {
        n++;
        const h = a.hardAt(x, z);
        if (h) by[h] = (by[h] || 0) + 1;
      }
    }
    return { cells: n, by };
  });
  out.err = await page.evaluate(() =>
    (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null);
  await page.evaluate(o => fetch('/shot?name=px-moor.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
