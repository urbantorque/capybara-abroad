async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);

  const src = await (await page.request.get('http://localhost:5188/src/shared.js')).text();
  const chapters = [];
  const re = /\{\s*n:\s*(\d+),\s*biome:\s*'([a-z]+)'/g;
  let m;
  while ((m = re.exec(src))) chapters.push(m[2]);

  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);
  const started = await page.evaluate(() => !!window.__capy.state.started);

  const out = { started: started, rows: [] };

  for (let ci = 0; ci < chapters.length; ci++) {
    const name = chapters[ci];
    let row;
    try {
      row = await page.evaluate(async (arg) => {
        const g = window.__capy;
        const THREE = g.THREE;
        const nm = arg.name;
        if (g.biome.current !== nm) g.biome.switchTo(nm);
        for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
        const api = (nm === 'sydney') ? g.env : g[nm];
        const sp = g.biome.spawnOf(nm);
        const r = { biome: nm, live: g.biome.current, spawn: [sp.x, sp.z], bearings: [] };
        const th = (api && typeof api.terrainHeight === 'function')
          ? (x, z) => { const v = api.terrainHeight(x, z); return (typeof v === 'number' && v === v) ? v : 0; }
          : () => 0;
        const ow = (api && typeof api.isOverWater === 'function')
          ? (x, z) => !!api.isOverWater(x, z) : () => false;

        // "the world is drawn here": anything VISIBLE under your feet, within
        // 12 m. Not a physics ray — cannon's heightfield raycast is not a
        // reliable arbiter (see the solidity audit) and this is about what the
        // PLAYER SEES, which is what "walked off the map" actually means.
        const ray = new THREE.Raycaster();
        ray.far = 26;
        const org = new THREE.Vector3();
        const down = new THREE.Vector3(0, -1, 0);
        const drawn = (x, z) => {
          org.set(x, th(x, z) + 12, z);
          ray.set(org, down);
          const hits = ray.intersectObject(g.scene, true);
          for (let k = 0; k < hits.length; k++) {
            let p = hits[k].object, vis = true;
            while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
            // the sky dome / haze shell is not ground
            if (vis && hits[k].distance > 0.05) return true;
          }
          return false;
        };

        const NB = 8;
        for (let bi = 0; bi < NB; bi++) {
          const a = bi * Math.PI * 2 / NB;
          const ux = Math.cos(a), uz = Math.sin(a);
          // first radius with TWO consecutive undrawn samples (one gap is a
          // canal or a hole, two in a row at 8 m spacing is the edge)
          let rDraw = -1, miss = 0;
          for (let d = 8; d <= 400; d += 8) {
            const x = sp.x + ux * d, z = sp.z + uz * d;
            if (ow(x, z)) { miss = 0; continue; }
            if (!drawn(x, z)) { miss++; if (miss >= 2) { rDraw = d - 8; break; } }
            else miss = 0;
          }
          // where the game actually puts you back
          let rResc = -1;
          const start = rDraw > 0 ? rDraw : 8;
          for (let d = start; d <= 440; d += 24) {
            const x = sp.x + ux * d, z = sp.z + uz * d;
            const body = g.capy.body;
            body.position.set(x, th(x, z) + 0.4, z);
            body.velocity.set(0, 0, 0);
            body.previousPosition.copy(body.position);
            body.interpolatedPosition.copy(body.position);
            g.capy.carriedBy = null;
            for (let t = 0; t < 140; t++) g.tick(1 / 60, false);
            if (Math.hypot(body.position.x - x, body.position.z - z) > 12) { rResc = d; break; }
          }
          r.bearings.push({ deg: Math.round(a * 180 / Math.PI), rDraw: rDraw, rResc: rResc });
        }
        const body = g.capy.body;
        body.position.set(sp.x, (sp.y || 1) + 0.4, sp.z);
        body.velocity.set(0, 0, 0);
        body.previousPosition.copy(body.position);
        body.interpolatedPosition.copy(body.position);
        return r;
      }, { name: name });
    } catch (e) {
      row = { biome: name, error: String(e).slice(0, 250) };
    }
    out.rows.push(row);
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=rev-edge2.json', {
      method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
