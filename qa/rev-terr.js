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
        const r = { biome: nm, live: g.biome.current };
        if (!api || typeof api.terrainHeight !== 'function') { r.noTerrain = true; return r; }
        const th = (x, z) => { const v = api.terrainHeight(x, z); return (v === v) ? v : NaN; };
        const ow = (typeof api.isOverWater === 'function') ? (x, z) => !!api.isOverWater(x, z) : () => false;

        const ray = new THREE.Raycaster();
        ray.far = 80;
        const org = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
        // the drawn ground under (x,z): the HIGHEST visible hit at or below
        // the analytic height + 1 m, so a roof or a tree canopy is not ground.
        const drawnY = (x, z, h) => {
          org.set(x, h + 40, z);
          ray.set(org, down);
          const hits = ray.intersectObject(g.scene, true);
          for (let k = 0; k < hits.length; k++) {
            let p = hits[k].object, vis = true;
            while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
            if (!vis) continue;
            const y = hits[k].point.y;
            if (y <= h + 1.0) return y;
          }
          return NaN;
        };

        const N = 20, R = 100;
        let n = 0, sum = 0, sumAbs = 0, mx = 0, mxAt = null, over15 = 0, over30 = 0;
        const worst = [];
        for (let i = 0; i < N; i++) {
          for (let j = 0; j < N; j++) {
            const x = sp.x - R + 2 * R * (i + 0.5) / N;
            const z = sp.z - R + 2 * R * (j + 0.5) / N;
            if (ow(x, z)) continue;
            const h = th(x, z);
            if (!(h === h)) continue;
            const dy = drawnY(x, z, h);
            if (!(dy === dy)) continue;         // nothing drawn here
            const e = h - dy;                    // + = law ABOVE the mesh (animal floats)
            if (Math.abs(e) > 6) continue;       // a cliff edge / a bridge; not a fit error
            n++; sum += e; sumAbs += Math.abs(e);
            if (Math.abs(e) > 0.15) over15++;
            if (Math.abs(e) > 0.30) over30++;
            if (Math.abs(e) > Math.abs(mx)) { mx = e; mxAt = [Math.round(x), Math.round(z)]; }
            if (worst.length < 8 && Math.abs(e) > 0.3) worst.push([Math.round(x), Math.round(z), +e.toFixed(2)]);
          }
        }
        r.n = n;
        r.meanSigned = n ? +(sum / n).toFixed(3) : 0;
        r.meanAbs = n ? +(sumAbs / n).toFixed(3) : 0;
        r.max = +mx.toFixed(2); r.maxAt = mxAt;
        r.pctOver15 = n ? +(100 * over15 / n).toFixed(1) : 0;
        r.pctOver30 = n ? +(100 * over30 / n).toFixed(1) : 0;
        r.worst = worst;
        return r;
      }, { name: name });
    } catch (e) {
      row = { biome: name, error: String(e).slice(0, 250) };
    }
    out.rows.push(row);
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=rev-terr.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
