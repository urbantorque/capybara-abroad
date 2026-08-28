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
        const CANNON = g.CANNON, THREE = g.THREE;
        const nm = arg.name;
        if (g.biome.current !== nm) g.biome.switchTo(nm);
        for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
        const api = (nm === 'sydney') ? g.env : g[nm];
        const r = { biome: nm, live: g.biome.current };
        if (!api || typeof api.terrainHeight !== 'function') { r.noTerrain = true; return r; }
        const ow = (typeof api.isOverWater === 'function') ? (x, z) => !!api.isOverWater(x, z) : () => false;

        // ---- ALL of them. Pasto has FOUR tiles and taking only the first
        // compares three quarters of the chapter against a grid that does not
        // cover it, which reads as a huge terrain error and is not one.
        const HS = [];
        for (const b of g.world.bodies) {
          if (b.mass !== 0) continue;
          for (let si = 0; si < b.shapes.length; si++) {
            const s = b.shapes[si];
            if (!(s instanceof CANNON.Heightfield)) continue;
            const D2 = s.data;
            HS.push({
              EL: s.elementSize, D: D2,
              NX: D2.length - 1, NZ: D2[0].length - 1,
              X0: b.position.x, Z1: b.position.z,
            });
          }
        }
        if (!HS.length) { r.noHf = true; return r; }
        r.tiles = HS.length;
        function tileY(H, x, z) {
          const fi = (x - H.X0) / H.EL, fj = (H.Z1 - z) / H.EL;
          const i = Math.floor(fi), j = Math.floor(fj);
          if (i < 0 || j < 0 || i >= H.NX || j >= H.NZ) return NaN;
          const u = fi - i, v = fj - j;
          const D2 = H.D;
          const h00 = D2[i][j], h10 = D2[i + 1][j], h01 = D2[i][j + 1], h11 = D2[i + 1][j + 1];
          if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
          return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
        }
        // the HIGHEST tile that covers the point: overlapping tiles stack, and
        // the one you stand on is the top one.
        function facetY(x, z) {
          let best = NaN;
          for (let k = 0; k < HS.length; k++) {
            const v = tileY(HS[k], x, z);
            if (v === v && (!(best === best) || v > best)) best = v;
          }
          return best;
        }
        // sample over the UNION of the tiles
        let X0 = Infinity, X1 = -Infinity, Z0 = Infinity, Z1u = -Infinity;
        for (const H of HS) {
          X0 = Math.min(X0, H.X0); X1 = Math.max(X1, H.X0 + H.NX * H.EL);
          Z1u = Math.max(Z1u, H.Z1); Z0 = Math.min(Z0, H.Z1 - H.NZ * H.EL);
        }
        const NX = 1, NZ = 1, EL = 1;   // unused below; kept so the loop reads the same

        const ray = new THREE.Raycaster();
        ray.far = 300;
        const org = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);

        let n = 0, near = 0, sum = 0, abs = 0, o15 = 0, o50 = 0, noHit = 0;
        const culprits = {};
        const N = 26;
        for (let a = 0; a < N; a++) {
          for (let b2 = 0; b2 < N; b2++) {
            const x = X0 + (X1 - X0) * (a + 0.37) / N;
            const z = Z1u - (Z1u - Z0) * (b2 + 0.61) / N;
            if (ow(x, z)) continue;
            const f = facetY(x, z);
            if (!(f === f)) continue;
            org.set(x, f + 90, z);
            ray.set(org, down);
            const hits = ray.intersectObject(g.scene, true);
            // the drawn surface CLOSEST to the collider: if the drawn ground and
            // the collider are the same surface this is ~0, whatever is built on
            // top of it. If it is large, the picture and the physics disagree.
            let best = null, bestObj = null;
            for (let k = 0; k < hits.length; k++) {
              let p = hits[k].object, vis = true;
              while (p) { if (!p.visible) { vis = false; break; } p = p.parent; }
              if (!vis) continue;
              const dy = hits[k].point.y - f;
              if (best === null || Math.abs(dy) < Math.abs(best)) { best = dy; bestObj = hits[k].object; }
            }
            n++;
            if (best === null) { noHit++; continue; }
            near++;
            sum += best; abs += Math.abs(best);
            if (Math.abs(best) > 0.15) o15++;
            if (Math.abs(best) > 0.50) {
              o50++;
              const nmO = (bestObj && bestObj.name) || '(unnamed)';
              culprits[nmO] = (culprits[nmO] || 0) + 1;
            }
          }
        }
        r.n = n; r.matched = near; r.noHit = noHit;
        r.meanSigned = near ? +(sum / near).toFixed(3) : null;
        r.meanAbs = near ? +(abs / near).toFixed(3) : null;
        r.pctOver15 = near ? +(100 * o15 / near).toFixed(1) : null;
        r.pctOver50 = near ? +(100 * o50 / near).toFixed(1) : null;
        r.culprits = Object.entries(culprits).sort((p, q) => q[1] - p[1]).slice(0, 4);
        return r;
      }, { name: name });
    } catch (e) {
      row = { biome: name, error: String(e).slice(0, 250) };
    }
    out.rows.push(row);
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=b3-ground.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
