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
  const out = { started: await page.evaluate(() => !!window.__capy.state.started), rows: [] };

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
        const r = { biome: nm, live: g.biome.current, pts: [] };
        const th = (api && typeof api.terrainHeight === 'function')
          ? (x, z) => { const v = api.terrainHeight(x, z); return (v === v) ? v : 0; } : () => 0;
        const ow = (api && typeof api.isOverWater === 'function')
          ? (x, z) => !!api.isOverWater(x, z) : () => false;

        const capyRoot = g.capy.group;
        const isCapy = (o) => { let p = o; while (p) { if (p === capyRoot) return true; p = p.parent; } return false; };
        const ray = new THREE.Raycaster();
        ray.far = 60;
        const org = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
        // highest visible non-capybara surface strictly below `from`
        const groundUnder = (x, from, z) => {
          org.set(x, from, z);
          ray.set(org, down);
          const hits = ray.intersectObject(g.scene, true);
          for (let k = 0; k < hits.length; k++) {
            const o = hits[k].object;
            if (isCapy(o)) continue;
            let p = o, vis = true;
            while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
            if (vis) return hits[k].point.y;
          }
          return NaN;
        };

        const body = g.capy.body;
        // 16 points on two rings round the spawn, land only
        const cand = [];
        for (const R of [28, 62]) {
          for (let k = 0; k < 12; k++) {
            const a = k * Math.PI * 2 / 12;
            const x = sp.x + Math.cos(a) * R, z = sp.z + Math.sin(a) * R;
            if (!ow(x, z)) cand.push([x, z]);
          }
        }
        for (let ci2 = 0; ci2 < cand.length && r.pts.length < 16; ci2++) {
          const x = cand[ci2][0], z = cand[ci2][1];
          body.position.set(x, th(x, z) + 1.2, z);
          body.velocity.set(0, 0, 0);
          body.previousPosition.copy(body.position);
          body.interpolatedPosition.copy(body.position);
          g.capy.carriedBy = null;
          for (let t = 0; t < 110; t++) g.tick(1 / 60, false);   // settle
          const bx = body.position.x, by = body.position.y, bz = body.position.z;
          const footY = by - 0.34;              // capyFOOT_Y: where the model's feet are drawn
          // Start just ABOVE the feet, not high overhead: from 25 m up the ray
          // hits the roof of whatever the animal is standing under, and a
          // rooftop 7 m over its head reads as a 7 m "sink". 0.30 m is the
          // whole sink range that is worth reporting anyway.
          const gy = groundUnder(bx, footY + 0.30, bz);
          if (!(gy === gy)) { r.pts.push({ x: Math.round(bx), z: Math.round(bz), gap: null, nothingUnder: true }); continue; }
          const gap = footY - gy;               // + floating, - sunk
          if (gap > 8) continue;                // it is genuinely airborne; not a fit reading
          const slope = (() => {
            const D = 1;
            const gx = (th(bx + D, bz) - th(bx - D, bz)) / (2 * D);
            const gz = (th(bx, bz + D) - th(bx, bz - D)) / (2 * D);
            return Math.atan(Math.hypot(gx, gz)) * 180 / Math.PI;
          })();
          r.pts.push({ x: Math.round(bx), z: Math.round(bz), gap: +gap.toFixed(2),
                       slopeDeg: +slope.toFixed(0), terrVsMesh: +(th(bx, bz) - gy).toFixed(2) });
        }
        const gs = r.pts.filter(p => p.gap !== null && p.gap !== undefined).map(p => p.gap);
        r.nVoid = r.pts.filter(p => p.nothingUnder).length;
        r.n = gs.length;
        r.meanGap = gs.length ? +(gs.reduce((a, b) => a + b, 0) / gs.length).toFixed(3) : null;
        r.maxFloat = gs.length ? +Math.max.apply(null, gs).toFixed(2) : null;
        r.maxSink = gs.length ? +Math.min.apply(null, gs).toFixed(2) : null;
        r.nBad = gs.filter(v => Math.abs(v) > 0.12).length;
        return r;
      }, { name: name });
    } catch (e) {
      row = { biome: name, error: String(e).slice(0, 250) };
    }
    out.rows.push(row);
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=rev-foot.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
