async page => {
  // ---------------------------------------------------------------------------
  // qa/px-kyoto-zen.js — KYOTO'S 32 x 22 x 2.4 m MESH (ROADMAP-PHYSICS X9)
  //
  // The second of X9's three unidentified wall-shaped faces. The arithmetic
  // names it before this runs: `kyoZEN` is { x −34, z 8, hx 15, hz 10 }, so
  // `kyoBuildZen`'s merged mesh spans exactly x −50…−18, z −3…19 and stands
  // 2.4 m tall — the dry garden and the earth wall round it. The audit's two
  // WALL samples are at (−37, 20) and (−32, 20), both facing north into the
  // SOUTH wall, drawn at 1.2–1.25 m at every height with no physics behind it.
  //
  // AND THE SOUTH WALL IS THE ONE WITH THE DOOR IN IT. kyoBuildZen draws the
  // wall across the full width and then collides it in TWO pieces with a gap
  // between them — "the south wall has a gap in it, or nobody could get in to
  // spoil it". So the question is not whether the wall is solid. It is
  // **whether the doorway the colliders leave is a doorway you can see**, and
  // that is a question for a rendered frame, not for a number.
  //
  // Measured here: where the physics gap actually is, whether the drawn wall
  // has one in the same place, and what the entrance looks like from outside.
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
    g.biome.switchTo('kyoto');
    tick(60 * 12);
    const res = { biome: g.biome.current, zen: { x: -34, z: 8, hx: 15, hz: 10 } };

    // ---- 1. name it -------------------------------------------------------
    const found = [];
    g.scene.traverse(function (o) {
      if (!o.isMesh || !o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
      if (bb.min.x > -52 && bb.max.x < -16 && bb.min.z > -5 && bb.max.z < 21 &&
          (bb.max.x - bb.min.x) > 20) {
        const chain = [];
        for (let p = o; p && chain.length < 4; p = p.parent) chain.push(p.name || p.type);
        found.push({ name: o.name || '(unnamed)', chain: chain.join(' < '),
                     size: [+(bb.max.x - bb.min.x).toFixed(1), +(bb.max.y - bb.min.y).toFixed(1),
                            +(bb.max.z - bb.min.z).toFixed(1)] });
      }
    });
    res.mesh = found;

    // ---- 2. WHERE IS THE DOOR, drawn and physical -------------------------
    // Swept across the whole south wall at 20 cm steps, from a metre outside
    // it, looking north: what the eye meets, and what the body meets.
    const ray = new THREE.Raycaster();
    const drawnAt = function (x, y, z) {
      ray.set(new THREE.Vector3(x, y, z), new THREE.Vector3(0, -0, -1).normalize());
      ray.far = 6;
      const hits = ray.intersectObjects(g.scene.children, true);
      for (const h of hits) {
        let ok = true;
        for (let p = h.object; p; p = p.parent) if (!p.visible) { ok = false; break; }
        if (!ok) continue;
        const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
        if (m && m.transparent && m.opacity < 0.6) continue;
        return +h.distance.toFixed(2);
      }
      return null;
    };
    const physAt = function (x, y, z) {
      const F = new CANNON.Vec3(x, y, z), T = new CANNON.Vec3(x, y, z - 6);
      let best = null;
      try {
        g.world.raycastAll(F, T, {}, function (r) {
          if (!r.hasHit || !r.body || r.body === g.capy.body) return;
          if (r.body.mass > 0 || r.body.isTrigger) return;
          if (r.shape && r.shape.type === CANNON.Shape.types.HEIGHTFIELD) return;
          if (best === null || r.distance < best) best = r.distance;
        });
      } catch (e) { return null; }
      return best === null ? null : +best.toFixed(2);
    };
    res.sweep = [];
    for (let x = -50; x <= -18; x += 0.5) {
      res.sweep.push({ x: +x.toFixed(1), drawn: drawnAt(x, 1.0, 20), phys: physAt(x, 1.0, 20) });
    }
    // where the two gaps are, as spans
    const span = function (key) {
      const runs = [];
      let a = null;
      for (const s of res.sweep) {
        const open = s[key] === null;
        if (open && a === null) a = s.x;
        if (!open && a !== null) { runs.push([a, s.x - 0.5]); a = null; }
      }
      if (a !== null) runs.push([a, -18]);
      return runs;
    };
    res.drawnGaps = span('drawn');
    res.physGaps = span('phys');

    // ---- 3. and can you walk in? -----------------------------------------
    const walk = function (x0) {
      const b = g.capy.body;
      b.position.set(x0, g.kyoto.terrainHeight(x0, 24) + 0.5, 24);
      b.velocity.set(0, 0, 0);
      tick(60);
      let stuck = 0, lastZ = b.position.z;
      for (let i = 0; i < 60 * 12; i++) {
        b.velocity.z = -4.5;
        g.tick(1 / 60, false);
        if (Math.abs(b.position.z - lastZ) < 0.004) stuck++; else stuck = 0;
        lastZ = b.position.z;
        if (stuck > 40) break;
        if (b.position.z < 12) break;      // well inside the garden
      }
      return { x: x0, endZ: +b.position.z.toFixed(1), endX: +b.position.x.toFixed(1),
               gotIn: b.position.z < 17 };
    };
    res.walks = [];
    for (const x of [-45, -40, -37, -34, -32, -29, -24]) res.walks.push(walk(x));
    return res;
  });

  // ---- and look at it ------------------------------------------------------
  await page.evaluate(() => {
    const g = window.__capy;
    // stand the animal in the doorway and frame the wall from outside it
    const b = g.capy.body;
    b.position.set(-34, g.kyoto.terrainHeight(-34, 24) + 0.4, 24);
    b.velocity.set(0, 0, 0);
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false);
    g.frameShot({ dist: 15, pitch: 0.20, raise: 1.2, hold: 6, w: 1, yaw: Math.PI });
    for (let i = 0; i < 60 * 3; i++) g.tick(1 / 60, false);
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'qa/PX-kyoto-zen-door.png' });

  out.errs = errs; out.errN = errs.length;
  await page.evaluate((o) => fetch('/shot?name=px-kyoto-zen.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
