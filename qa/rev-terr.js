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
        ray.far = 260;
        const org = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
        // ---- THE CEILING THIS USED TO HAVE WAS THE BUG (integrity 2) --------
        // It took "the highest visible hit at or BELOW h + 1.0", so wherever
        // the mesh sat above the law the mesh was REJECTED and the ray fell
        // through to whatever was underneath — a seabed, a lower terrace, the
        // ground under a building. The error then read as a huge POSITIVE, and
        // that is most of what made Manly look like a mean +1.29 m outlier.
        // Attributed by region, Manly's playable middle is 15%, not 37.8%.
        // Highest visible surface, full stop. A roof IS what is drawn over that
        // point; if the law disagrees with it that is worth seeing, and the
        // regions where a roof is the honest answer are excluded below instead.
        const drawnY = (x, z) => {
          org.set(x, 130, z);
          ray.set(org, down);
          const hits = ray.intersectObject(g.scene, true);
          for (let k = 0; k < hits.length; k++) {
            let p = hits[k].object, vis = true;
            while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
            if (vis) return hits[k].point.y;
          }
          return NaN;
        };

        // ---- AND SAMPLES OUTSIDE THE WORLD ARE NOT A LAW ERROR -------------
        // Past the chapter's own edge there is nothing to be right about, and
        // since integrity 1 the player is rescued from there anyway. Points
        // with nothing drawn under them are counted separately as `void`.
        const bx = (typeof api.bounds === 'function') ? api.bounds()
                 : (g.biome.boundsOf ? g.biome.boundsOf(nm) : null);
        const inWorld = (x, z) => {
          if (!bx) return true;
          const list = bx.rects || [bx];
          for (let i = 0; i < list.length; i++) {
            const b2 = list[i];
            if (x >= b2.x0 && x <= b2.x1 && z >= b2.z0 && z <= b2.z1) return true;
          }
          return false;
        };

        const N = 20, R = 100;
        let n = 0, sum = 0, sumAbs = 0, mx = 0, mxAt = null, over15 = 0, over30 = 0;
        let outside = 0, voidPts = 0, wild = 0, nanLaw = 0;
        const worst = [];
        for (let i = 0; i < N; i++) {
          for (let j = 0; j < N; j++) {
            const x = sp.x - R + 2 * R * (i + 0.5) / N;
            const z = sp.z - R + 2 * R * (j + 0.5) / N;
            if (ow(x, z)) continue;             // seabed vs sea surface is not an error
            if (!inWorld(x, z)) { outside++; continue; }
            const h = th(x, z);
            if (!(h === h)) { nanLaw++; continue; }
            const dy = drawnY(x, z);
            if (!(dy === dy)) { voidPts++; continue; }   // nothing drawn here
            const e = h - dy;                    // + = law ABOVE the mesh (animal floats)
            if (Math.abs(e) > 6) { wild++; continue; }   // a cliff edge / a bridge
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
        r.outside = outside; r.voidPts = voidPts; r.wild = wild; r.nanLaw = nanLaw;
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
