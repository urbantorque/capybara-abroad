async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('BracketRight');      // ch14 Manly
  await page.waitForTimeout(4500);

  const out = await page.evaluate(() => {
    const g = window.__capy;
    const THREE = g.THREE;
    const r = { live: g.biome.current };
    if (g.biome.current !== 'manly') return r;
    const api = g.manly;
    const th = (x, z) => { const v = api.terrainHeight(x, z); return (v === v) ? v : NaN; };
    const ow = (x, z) => !!api.isOverWater(x, z);

    const ray = new THREE.Raycaster();
    ray.far = 200;
    const org = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
    // The highest visible surface anywhere under a high start. No h-relative
    // ceiling: that was what biased the first audit toward "+" errors, because
    // a mesh sitting ABOVE the law got rejected and the ray fell through to
    // whatever was beneath it.
    const drawnY = (x, z) => {
      org.set(x, 120, z);
      ray.set(org, down);
      const hits = ray.intersectObject(g.scene, true);
      for (let k = 0; k < hits.length; k++) {
        let p = hits[k].object, vis = true;
        while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
        if (vis) return hits[k].point.y;
      }
      return NaN;
    };

    // the three branches of manTerrain, so an error can be attributed
    const POINT_X = 56, BEACH_X0 = -62;
    const region = (x) => (x > POINT_X - 2) ? 'point' : (x < BEACH_X0 + 2) ? 'head' : 'profile';

    const buckets = {};
    const samples = [];
    let nDrawn = 0, nVoid = 0;
    const N = 40, R = 150;
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const x = -R + 2 * R * (i + 0.5) / N;
        const z = -R + 2 * R * (j + 0.5) / N;
        const h = th(x, z);
        if (!(h === h)) continue;
        const dy = drawnY(x, z);
        const reg = region(x) + (ow(x, z) ? '/water' : '');
        const b = buckets[reg] || (buckets[reg] = { n: 0, void: 0, sum: 0, abs: 0, o15: 0, mx: 0, mxAt: null });
        b.n++;
        if (!(dy === dy)) { b.void++; nVoid++; continue; }
        nDrawn++;
        const e = h - dy;
        if (Math.abs(e) > 40) continue;
        b.sum += e; b.abs += Math.abs(e);
        if (Math.abs(e) > 0.15) b.o15++;
        if (Math.abs(e) > Math.abs(b.mx)) { b.mx = e; b.mxAt = [Math.round(x), Math.round(z)]; }
        if (samples.length < 400) samples.push([Math.round(x), Math.round(z), +e.toFixed(2)]);
      }
    }
    r.nDrawn = nDrawn; r.nVoid = nVoid;
    r.regions = {};
    for (const k of Object.keys(buckets)) {
      const b = buckets[k];
      const m = b.n - b.void;
      r.regions[k] = {
        pts: b.n, voidPts: b.void,
        meanSigned: m ? +(b.sum / m).toFixed(3) : null,
        meanAbs: m ? +(b.abs / m).toFixed(3) : null,
        pctOver15: m ? +(100 * b.o15 / m).toFixed(1) : null,
        max: +b.mx.toFixed(2), maxAt: b.mxAt,
      };
    }
    // where does the drawn world actually end, in z, along a few x?
    r.northEdge = {};
    for (const x of [-90, -70, -40, 0, 40, 70]) {
      let last = null;
      for (let z = -140; z <= 150; z += 2) { if (drawnY(x, z) === drawnY(x, z)) last = z; }
      r.northEdge['x=' + x] = last;
    }
    // and what the law says out past it
    r.lawPastEdge = {};
    for (const p of [[-70, 110], [-70, 130], [-90, 120], [0, 120], [0, 140], [40, 120]]) {
      r.lawPastEdge[p[0] + ',' + p[1]] = { law: +th(p[0], p[1]).toFixed(2), drawn: (() => { const v = drawnY(p[0], p[1]); return v === v ? +v.toFixed(2) : null; })() };
    }
    return r;
  });

  await page.evaluate(async (o) => {
    await fetch('/shot?name=b2-manly.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
