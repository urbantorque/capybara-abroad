async page => {
  // Pushing the cliff's collider east to meet its drawn face moves that face by
  // up to 0.92 m in places. Anything that used to stand in that band is now
  // inside a static box — which is what a solver save is, and Göreme's fuzz row
  // reported two of them after the change. So: walk the whole foot of the
  // cliff, at half-metre steps, and ask at each one whether the animal is
  // inside geometry and whether it is left standing on the ground.
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.reload();
  await page.waitForTimeout(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(8000);
  const out = await page.evaluate(() => {
    const g = window.__capy, CANNON = g.CANNON;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    g.biome.switchTo('goreme');
    tick(60 * 12);
    const terr = g.goreme.terrainHeight;
    // is this point inside a static box? a short ray each way: two opposite
    // hits at zero-ish distance means the point is enclosed.
    const inSolid = function (x, y, z) {
      let hits = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const F = new CANNON.Vec3(x, y, z), T = new CANNON.Vec3(x + dx * 30, y, z + dz * 30);
        const rr = new CANNON.RaycastResult();
        try { g.world.raycastClosest(F, T, { skipBackfaces: true }, rr); } catch (e) { return null; }
        if (!rr.hasHit) hits++;      // no FRONT face outward => we are inside
      }
      return hits >= 3;
    };
    const rows = [];
    let inside = 0, sunk = 0;
    for (let z = -74; z <= -10; z += 2) {
      for (let dx = 0.5; dx <= 6; dx += 0.5) {
        // faceX, recomputed here so the probe does not need the module's private
        const fx = -78 + 4.0 + Math.sin(z * 0.098 + 0.7) * 1.75 + Math.sin(z * 0.041 - 1.3) * 1.15;
        const x = fx + 2.6 + dx;             // east of the collider's own face
        const y = terr(x, z) + 0.5;
        const b = g.capy.body;
        b.position.set(x, y, z);
        b.velocity.set(0, 0, 0);
        tick(40);
        const moved = Math.hypot(b.position.x - x, b.position.z - z);
        const enc = inSolid(x, y, z);
        if (enc) inside++;
        if (moved > 1.2) sunk++;
        if (enc || moved > 1.2) {
          rows.push({ at: [+x.toFixed(1), z], eastOfFace: +dx.toFixed(1),
                      inside: !!enc, moved: +moved.toFixed(2) });
        }
      }
    }
    return { sampled: 33 * 12, insideN: inside, shovedN: sunk, rows: rows.slice(0, 30) };
  });
  out.errs = errs; out.errN = errs.length;
  await page.evaluate((o) => fetch('/shot?name=px-goreme-foot.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
