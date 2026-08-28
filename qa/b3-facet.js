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
        const CANNON = g.CANNON;
        const nm = arg.name;
        if (g.biome.current !== nm) g.biome.switchTo(nm);
        for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
        const api = (nm === 'sydney') ? g.env : g[nm];
        const r = { biome: nm, live: g.biome.current };
        if (!api || typeof api.terrainHeight !== 'function') { r.noTerrain = true; return r; }
        const th = (x, z) => { const v = api.terrainHeight(x, z); return (v === v) ? v : NaN; };

        // find the heightfield collider(s)
        const hfs = [];
        for (const b of g.world.bodies) {
          if (b.mass !== 0) continue;
          for (let si = 0; si < b.shapes.length; si++) {
            const s = b.shapes[si];
            if (s instanceof CANNON.Heightfield) hfs.push({ b: b, s: s });
          }
        }
        r.heightfields = hfs.length;
        if (!hfs.length) return r;

        // THE MAPPING, from the build code: body sits at (X0, 0, Z1) with
        // rotX(-90), so local (i*EL, j*EL, h) -> world (X0 + i*EL, h, Z1 - j*EL).
        const H = hfs[0];
        const EL = H.s.elementSize;
        const D = H.s.data;
        const NX = D.length - 1, NZ = D[0].length - 1;
        const X0 = H.b.position.x, Z1 = H.b.position.z;
        r.grid = { EL: EL, NX: NX, NZ: NZ, X0: Math.round(X0), Z1: Math.round(Z1) };

        // the faceted surface the animal actually stands on
        function facetY(x, z) {
          const fi = (x - X0) / EL, fj = (Z1 - z) / EL;
          const i = Math.floor(fi), j = Math.floor(fj);
          if (i < 0 || j < 0 || i >= NX || j >= NZ) return NaN;
          const u = fi - i, v = fj - j;
          const h00 = D[i][j], h10 = D[i + 1][j], h01 = D[i][j + 1], h11 = D[i + 1][j + 1];
          // cannon splits each cell on the u+v = 1 diagonal
          if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
          return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
        }

        let n = 0, sum = 0, abs = 0, mx = 0, mxAt = null, o15 = 0;
        // correlation between |error| and distance from the nearest grid vertex,
        // which is what the smooth-law-over-faceted-mesh hypothesis predicts
        const byDist = [0, 0, 0, 0].map(() => ({ n: 0, sum: 0 }));
        const N = 60;
        for (let a = 0; a < N; a++) {
          for (let b2 = 0; b2 < N; b2++) {
            // deliberately off-lattice so samples are not all on vertices
            const x = X0 + (NX * EL) * (a + 0.37) / N;
            const z = Z1 - (NZ * EL) * (b2 + 0.61) / N;
            const t = th(x, z), f = facetY(x, z);
            if (!(t === t) || !(f === f)) continue;
            const e = t - f;                 // + = the LAW sits above the collider
            if (Math.abs(e) > 20) continue;
            n++; sum += e; abs += Math.abs(e);
            if (Math.abs(e) > 0.15) o15++;
            if (Math.abs(e) > Math.abs(mx)) { mx = e; mxAt = [Math.round(x), Math.round(z)]; }
            const fi = (x - X0) / EL, fj = (Z1 - z) / EL;
            const du = Math.min(fi - Math.floor(fi), 1 - (fi - Math.floor(fi)));
            const dv = Math.min(fj - Math.floor(fj), 1 - (fj - Math.floor(fj)));
            const d = Math.min(du, dv) * 2;   // 0 at a vertex, 1 mid-facet
            const k = Math.min(3, Math.floor(d * 4));
            byDist[k].n++; byDist[k].sum += Math.abs(e);
          }
        }
        r.n = n;
        r.meanSigned = n ? +(sum / n).toFixed(4) : null;
        r.meanAbs = n ? +(abs / n).toFixed(4) : null;
        r.pctOver15 = n ? +(100 * o15 / n).toFixed(1) : null;
        r.max = +mx.toFixed(2); r.maxAt = mxAt;
        r.byDist = byDist.map((b3) => (b3.n ? +(b3.sum / b3.n).toFixed(4) : null));
        return r;
      }, { name: name });
    } catch (e) {
      row = { biome: name, error: String(e).slice(0, 250) };
    }
    out.rows.push(row);
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=b3-facet.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
