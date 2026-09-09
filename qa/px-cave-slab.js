async page => {
  // ---------------------------------------------------------------------------
  // qa/px-cave-slab.js — THE CAVE'S 32 x 15.6 m SLAB AT z −200
  //
  // ROADMAP-PHYSICS X9 left three named faces and a decision. This is the one
  // it says matters most: *"a 32 m face at the end of a chamber that is not
  // solid is a way out of the mountain"* — wall-shaped at every height, no
  // physics behind it, and **its builder was never identified**.
  //
  // Before anything is collided, three questions, in this order, because the
  // answer to the first can make the other two moot:
  //
  //  1. WHAT IS IT? The audit could only say `Mesh < cave < Scene`. Named here
  //     off its bounding box, and then named in the source for good.
  //  2. CAN THE ANIMAL GET THERE AT ALL? The audit's ray was cast from a
  //     sample point the probe teleported to. A wall you cannot reach is
  //     scenery, and colliding scenery costs a body for nothing. So: walk at
  //     it, from inside, and see what stops it — and check what the ground
  //     out there even is.
  //  3. IS THE WALL IN FRONT OF IT SOLID? The slab sits three metres beyond
  //     the OUTER face of a fourteen-metre-thick wall. If that wall is solid
  //     the slab is behind it and unreachable; if it is not, the wall is the
  //     defect and the slab is a symptom.
  // ---------------------------------------------------------------------------
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.reload();
  await page.waitForTimeout(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(8000);

  const out = await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE, CANNON = g.CANNON;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    g.biome.switchTo('cave');
    tick(60 * 12);
    const res = { biome: g.biome.current };

    // ---- 1. what is it -----------------------------------------------------
    const found = [];
    g.scene.traverse(function (o) {
      if (!o.isMesh || !o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      if (bb.max.z < -196 && bb.min.z > -210 && (bb.max.x - bb.min.x) > 20) {
        const chain = [];
        for (let p = o; p && chain.length < 4; p = p.parent) chain.push(p.name || p.type);
        found.push({
          name: o.name || '(unnamed)', chain: chain.join(' < '),
          geo: o.geometry.type,
          bb: [+bb.min.x.toFixed(1), +bb.min.y.toFixed(1), +bb.min.z.toFixed(1),
               +bb.max.x.toFixed(1), +bb.max.y.toFixed(1), +bb.max.z.toFixed(1)],
          size: [+(bb.max.x - bb.min.x).toFixed(1), +(bb.max.y - bb.min.y).toFixed(1),
                 +(bb.max.z - bb.min.z).toFixed(1)],
        });
      }
    });
    res.meshesPastTheWall = found;

    // ---- what the ground says out there ------------------------------------
    const th = g.cave && g.cave.terrainHeight;
    res.terrain = [];
    for (const z of [-160, -170, -180, -190, -197, -200, -205, -220]) {
      res.terrain.push({ z: z, h: th ? +th(0, z).toFixed(2) : null });
    }

    // ---- 3. rays, drawn and physical, straight down the passage ------------
    // Two heights: standing on the passage floor, and level with the slot's
    // sill, which is the only line of sight the gap actually offers.
    const ray = new THREE.Raycaster();
    const drawnHit = function (x, y, z) {
      ray.set(new THREE.Vector3(x, y, z), new THREE.Vector3(0, 0, -1));
      ray.far = 60;
      const hits = ray.intersectObjects(g.scene.children, true);
      for (const h of hits) {
        let o = h.object, ok = true;
        for (let p = o; p; p = p.parent) if (!p.visible) { ok = false; break; }
        if (!ok) continue;
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (m && m.transparent && m.opacity < 0.6) continue;
        const bs = o.geometry && o.geometry.boundingSphere;
        if (bs && bs.radius > 400) continue;
        return { d: +h.distance.toFixed(2), name: o.name || '(unnamed)' };
      }
      return null;
    };
    const physHit = function (x, y, z, far) {
      const F = new CANNON.Vec3(x, y, z), T = new CANNON.Vec3(x, y, z - (far || 60));
      let best = null, kind = '';
      try {
        g.world.raycastAll(F, T, {}, function (r) {
          if (!r.hasHit || !r.body || r.body === g.capy.body) return;
          if (r.body.mass > 0 || r.body.isTrigger) return;
          if (best === null || r.distance < best) {
            best = r.distance;
            kind = (r.shape && r.shape.type === CANNON.Shape.types.HEIGHTFIELD)
              ? 'heightfield' : 'body';
          }
        });
      } catch (e) { return null; }
      return best === null ? null : { d: +best.toFixed(2), kind: kind };
    };
    res.rays = [];
    for (const [x, y, z, why] of [[0, 16.3, -175, 'at the sill, inside'],
                                  [0, 20.0, -175, 'mid-gap, inside'],
                                  [0, 14.0, -175, 'below the sill, inside'],
                                  [0, 16.3, -190, 'in the reveal'],
                                  [0, 16.3, -198, 'outside the far face']]) {
      res.rays.push({ why: why, from: [x, y, z],
                      drawn: drawnHit(x, y, z), phys: physHit(x, y, z) });
    }

    // ---- 2. and now walk at it ---------------------------------------------
    // Placed on the passage floor well inside, then driven at the wall with
    // the same input a player has. Where it STOPS is the answer.
    const walk = function (z0, y0) {
      const b = g.capy.body;
      b.position.set(0, y0, z0);
      b.velocity.set(0, 0, 0);
      tick(60);
      const start = { x: +b.position.x.toFixed(1), y: +b.position.y.toFixed(2),
                      z: +b.position.z.toFixed(1) };
      let stuckFor = 0, lastZ = b.position.z;
      for (let i = 0; i < 60 * 22; i++) {
        // straight at the far wall, hard
        b.velocity.z = -6;
        g.tick(1 / 60, false);
        if (Math.abs(b.position.z - lastZ) < 0.004) stuckFor++; else stuckFor = 0;
        lastZ = b.position.z;
        if (stuckFor > 45) break;
      }
      return { from: start,
               to: { x: +b.position.x.toFixed(1), y: +b.position.y.toFixed(2),
                     z: +b.position.z.toFixed(1) },
               grounded: !!g.capy.grounded };
    };
    res.walks = [];
    res.walks.push(Object.assign({ why: 'along the passage floor' }, walk(-160, 13.5)));
    res.walks.push(Object.assign({ why: 'level with the sill' }, walk(-175, 16.5)));
    res.walks.push(Object.assign({ why: 'started outside, past the wall' }, walk(-198, 14.0)));

    // ---- and does the chapter stop you being out there? --------------------
    // The way out of a chapter is three wheeks at the exit, not a trigger you
    // walk through, so nothing here should have teleported. Say so either way.
    res.stillInCave = g.biome.current;
    res.exitZ = -168;
    return res;
  });

  out.errs = errs; out.errN = errs.length;
  await page.evaluate((o) => fetch('/shot?name=px-cave-slab.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
