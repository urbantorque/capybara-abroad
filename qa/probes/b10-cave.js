async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);

  const out = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    const g = window.__capy, THREE = g.THREE;
    if (g.biome.current !== 'cave') { g.biome.switchTo('cave'); await sleep(1700); }
    for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
    const r = { live: g.biome.current };
    if (r.live !== 'cave') return r;
    const api = g.cave;
    g.capy.group.visible = false;                       // trap 11
    const rc = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);

    // ---- A CAVE IS A CORRIDOR, SO MEASURE ALONG IT -----------------------
    // rev-edge2 walks eight radial bearings from the spawn, which in a passage
    // 90 m wide means six of them are into a wall at 40 m. The chapter runs
    // z = 80 to -176; this asks, every 8 m down that line, how wide the drawn
    // floor is and whether the terrain law answers there.
    r.axis = [];
    for (let z = 88; z >= -200; z -= 8) {
      const row = { z: z, law: null, floor: null, wallW: null, wallE: null };
      const h = api.terrainHeight(0, z);
      row.law = (h === h) ? +h.toFixed(1) : null;
      if (row.law !== null) {
        rc.set(new THREE.Vector3(0, row.law + 30, z), down); rc.far = 90;
        const hit = rc.intersectObject(g.scene, true).filter(q => q.object.visible)
                      .sort((a, b) => b.point.y - a.point.y)
                      .filter(q => q.point.y < row.law + 3)[0];
        row.floor = hit ? +hit.point.y.toFixed(1) : null;
      }
      // how far the drawn floor runs either way across the passage
      for (const dir of [-1, 1]) {
        let last = 0;
        for (let d = 2; d <= 108; d += 2) {
          const x = dir * d;
          const hh = api.terrainHeight(x, z);
          if (hh !== hh) break;
          rc.set(new THREE.Vector3(x, hh + 30, z), down); rc.far = 90;
          const hit = rc.intersectObject(g.scene, true).filter(q => q.object.visible)[0];
          if (!hit) break;
          last = d;
        }
        if (dir < 0) row.wallW = last; else row.wallE = last;
      }
      r.axis.push(row);
    }

    // ---- CAN THE ANIMAL LEAVE THE PASSAGE SIDEWAYS? ----------------------
    // The generic bounds are x +/-107, which is the terrain law's domain, not
    // the cave. If the wall is solid the question never arises; if it is not,
    // the player walks 60 m into rock that is not drawn and is not rescued
    // until 107.
    const walk = [];
    for (const z of [40, 10, -20, -50, -90, -130, -160]) {
      const b = g.capy.body;
      g.capy.carriedBy = null;
      const h0 = api.terrainHeight(0, z);
      if (h0 !== h0) continue;
      b.position.set(0, h0 + 0.7, z);
      b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
      // shove east hard for four seconds and see where it stops
      for (let i = 0; i < 240; i++) {
        b.velocity.x = 7.0;
        g.tick(1 / 60, false);
      }
      const endX = b.position.x, endZ = b.position.z;
      // is anything drawn under where it ended up?
      const hh = api.terrainHeight(endX, endZ);
      let under = null;
      if (hh === hh) {
        rc.set(new THREE.Vector3(endX, hh + 30, endZ), down); rc.far = 90;
        const hit = rc.intersectObject(g.scene, true).filter(q => q.object.visible)[0];
        under = hit ? +hit.point.y.toFixed(1) : null;
      }
      walk.push({ fromZ: z, endX: +endX.toFixed(1), endZ: +endZ.toFixed(1),
                  law: (hh === hh) ? +hh.toFixed(1) : null, drawnUnder: under });
    }
    r.eastWalk = walk;
    g.capy.group.visible = true;
    return r;
  });

  await page.evaluate(async (o) => {
    await fetch('/shot?name=b10-cave.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
