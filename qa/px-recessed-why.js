async page => {
  // ---------------------------------------------------------------------------
  // qa/px-recessed-why.js — WHAT IS THE ANIMAL ACTUALLY INSIDE? (recessed, 2)
  //
  // `qa/px-recessed.js` re-walked the audit's thirty-two and found eleven that
  // are real, eight of them in Göreme — and four of those eight report the SAME
  // three numbers (face 0.45 m ahead, walked 1.14 m, ended 1.03 m in) at four x
  // positions seventeen metres apart. Identical numbers across seventeen metres
  // is not forty-six randomly scattered boulders; it is one long thing.
  //
  // So this stops guessing and asks, at each of the eleven: what mesh is the
  // ray hitting, what body stopped the animal, and where is that body's face
  // against the drawn one. The answer decides whether this is one fix or eight.
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

  const REAL = {
    goreme: [[-71, -15, -1, 0], [-21, -2, 0, -1], [-90, -72, 0, 1], [-87, -72, 0, 1],
             [-85, -72, 0, 1], [-73, -72, 0, 1], [-71, -37, -1, 0], [-42, 65, 0, -1],
             [-4, 53, 0, 1]],
    kowloon: [[13, -60, -1, 0], [-7, -42, -1, 0]],
  };

  const out = { errs: errs, rows: [] };
  for (const b of Object.keys(REAL)) {
    const rows = await page.evaluate(async (arg) => {
      const g = window.__capy, THREE = g.THREE, CANNON = g.CANNON;
      const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
      g.biome.switchTo(arg.b);
      tick(60 * 12);
      const terr = g[arg.b] && g[arg.b].terrainHeight;
      const ray = new THREE.Raycaster();
      const res = [];
      for (const [x, z, dx, dz] of arg.list) {
        const y = (terr ? terr(x, z) : 0) + 0.55;
        // the drawn thing, named as fully as the graph allows
        ray.set(new THREE.Vector3(x, y, z), new THREE.Vector3(dx, 0, dz).normalize());
        ray.far = 8;
        let drawn = null;
        for (const h of ray.intersectObjects(g.scene.children, true)) {
          let ok = true;
          for (let p = h.object; p; p = p.parent) if (!p.visible) { ok = false; break; }
          if (!ok) continue;
          const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
          if (m && m.transparent && m.opacity < 0.6) continue;
          if (h.point.y <= (terr ? terr(h.point.x, h.point.z) : 0) + 0.4) continue;
          const chain = [];
          for (let p = h.object; p && chain.length < 4; p = p.parent) chain.push(p.name || p.type);
          if (!h.object.geometry.boundingBox) h.object.geometry.computeBoundingBox();
          const bb = h.object.geometry.boundingBox.clone().applyMatrix4(h.object.matrixWorld);
          drawn = { d: +h.distance.toFixed(2), chain: chain.join('<'),
                    hitAt: [+h.point.x.toFixed(2), +h.point.y.toFixed(2), +h.point.z.toFixed(2)],
                    meshSize: [+(bb.max.x - bb.min.x).toFixed(1), +(bb.max.y - bb.min.y).toFixed(1),
                               +(bb.max.z - bb.min.z).toFixed(1)] };
          break;
        }
        // ...and the body that stops you, with its own face on this axis
        const F = new CANNON.Vec3(x, y, z);
        const T = new CANNON.Vec3(x + dx * 8, y, z + dz * 8);
        let phys = null;
        try {
          const rr = new CANNON.RaycastResult();
          g.world.raycastClosest(F, T, { skipBackfaces: false }, rr);
          if (rr.hasHit) {
            const bd = rr.body;
            let sz = null, ctr = null;
            for (let i = 0; i < bd.shapes.length; i++) {
              const s = bd.shapes[i], o = bd.shapeOffsets[i];
              if (!s.halfExtents) continue;
              const cx = bd.position.x + o.x, cz = bd.position.z + o.z;
              // the shape whose span contains the hit point
              if (Math.abs(rr.hitPointWorld.x - cx) <= s.halfExtents.x + 0.2 &&
                  Math.abs(rr.hitPointWorld.z - cz) <= s.halfExtents.z + 0.2) {
                sz = [+(s.halfExtents.x * 2).toFixed(1), +(s.halfExtents.y * 2).toFixed(1),
                      +(s.halfExtents.z * 2).toFixed(1)];
                ctr = [+cx.toFixed(2), +cz.toFixed(2)];
                break;
              }
            }
            phys = { d: +rr.distance.toFixed(2), shapes: bd.shapes.length,
                     type: (rr.shape && rr.shape.type) === CANNON.Shape.types.HEIGHTFIELD
                       ? 'heightfield' : 'box', size: sz, centre: ctr };
          }
        } catch (e) { phys = { err: String(e).slice(0, 60) }; }
        res.push({ b: arg.b, at: [x, z], dir: dx + ',' + dz, drawn: drawn, phys: phys,
                   gap: (drawn && phys) ? +(phys.d - drawn.d).toFixed(2) : null });
      }
      return res;
    }, { b: b, list: REAL[b] });
    for (const r of rows) out.rows.push(r);
  }
  out.errN = errs.length;
  await page.evaluate((o) => fetch('/shot?name=px-recessed-why.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
