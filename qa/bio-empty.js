async page => {
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);

  const CH = ['sydney', 'manly', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara',
              'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'pantanal', 'cave',
              'antarctic', 'monaco', 'hanoi', 'pasto'];
  const out = [];

  for (const b of CH) {
    await page.evaluate((n) => {
      const g = window.__capy;
      try { g.hud.cross(n); } catch (e) { g.biome.switchTo(n); }
    }, b);
    await page.waitForTimeout(4000);

    const row = await page.evaluate(() => {
      const g = window.__capy, T = g.THREE, C = g.CANNON;
      const live = g.biome.current;
      const cp = g.capy && g.capy.position;
      const SX = cp ? cp.x : 0, SZ = cp ? cp.z : 0;
      const R = 120, S = 4;
      const n = Math.round((2 * R) / S) + 1;

      const rr = new C.RaycastResult();
      function surf(x, z) {
        rr.reset();
        g.world.raycastClosest(new C.Vec3(x, 90, z), new C.Vec3(x, -40, z), {}, rr);
        return rr.hasHit ? rr.hitPointWorld.y : NaN;
      }
      const h = new Float64Array(n * n);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) h[i * n + j] = surf(SX - R + i * S, SZ - R + j * S);

      // GROUND-SEEDED, not spawn-seeded. Three chapters start you ON SOMETHING
      // THAT MOVES — Rio's float, Cappadocia's balloon basket, Monte Carlo's
      // deck — so a fill seeded at the spawn cannot step off and reports the
      // whole chapter unreachable. Seeding every cell within half a metre of
      // the chapter's own analytic terrain asks the question that matters:
      // what can be walked, starting from the ground.
      const th = (g[live] && typeof g[live].terrainHeight === 'function') ? g[live].terrainHeight : null;
      const seen = new Uint8Array(n * n);
      const q = [];
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const c = i * n + j, y = h[c];
        if (!(y === y)) continue;
        const x = SX - R + i * S, z = SZ - R + j * S;
        const gy = th ? th(x, z) : 0;
        if (!(gy === gy)) continue;
        if (Math.abs(y - gy) > 0.6) continue;
        seen[c] = 1; q.push(c);
      }
      const seeds = q.length;
      const STEP = 0.75, DROP = 6.0;
      while (q.length) {
        const c = q.pop(), ci = (c / n) | 0, cj = c % n, hc = h[c];
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (let k = 0; k < 4; k++) {
          const i2 = ci + nb[k][0], j2 = cj + nb[k][1];
          if (i2 < 0 || j2 < 0 || i2 >= n || j2 >= n) continue;
          const c2 = i2 * n + j2;
          if (seen[c2]) continue;
          const h2 = h[c2];
          if (!(h2 === h2)) continue;
          const rise = h2 - hc;
          if (rise > STEP || rise < -DROP) continue;
          seen[c2] = 1; q.push(c2);
        }
      }

      // WHAT IS THERE TO LOOK AT. Every visible mesh centre, with instanced
      // meshes sampled so a field of grass counts as many things and not one.
      const pts = [];
      const w = new T.Vector3(), m4 = new T.Matrix4();
      g.scene.traverse(function (o) {
        if (!o.isMesh) return;
        for (let p = o; p; p = p.parent) if (!p.visible) return;
        const ge = o.geometry;
        if (!ge) return;
        if (o.isInstancedMesh) {
          const step = Math.max(1, Math.floor(o.count / 60));
          for (let i = 0; i < o.count; i += step) {
            o.getMatrixAt(i, m4);
            w.setFromMatrixPosition(m4).applyMatrix4(o.matrixWorld);
            pts.push(w.x, w.z);
          }
          return;
        }
        // A merged batch is ONE mesh covering a whole district, so its centre
        // is meaningless. Use its bounding sphere: a big one is scenery spread
        // over an area, and it is credited across that area, not at a point.
        if (!ge.boundingSphere) { try { ge.computeBoundingSphere(); } catch (e) { return; } }
        const bs = ge.boundingSphere;
        if (!bs) return;
        o.getWorldPosition(w);
        const rad = bs.radius * Math.max(o.scale.x, o.scale.z);
        if (rad > 14) {
          const ring = Math.min(40, Math.max(6, Math.round(rad / 4)));
          for (let k = 0; k < ring; k++) {
            const a = (k / ring) * Math.PI * 2, rr2 = rad * 0.6;
            pts.push(w.x + Math.cos(a) * rr2, w.z + Math.sin(a) * rr2);
          }
        } else pts.push(w.x, w.z);
      });

      // bin the scenery on the same grid
      const cnt = new Uint16Array(n * n);
      for (let k = 0; k < pts.length; k += 2) {
        const i = Math.round((pts[k] - (SX - R)) / S), j = Math.round((pts[k + 1] - (SZ - R)) / S);
        if (i < 0 || j < 0 || i >= n || j >= n) continue;
        if (cnt[i * n + j] < 65000) cnt[i * n + j]++;
      }
      // a cell is EMPTY if nothing at all sits within 12 m of it
      const RAD = Math.round(12 / S);
      let reach = 0, empty = 0;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        if (!seen[i * n + j]) continue;
        reach++;
        let near = 0;
        for (let a = -RAD; a <= RAD && !near; a++) for (let bb = -RAD; bb <= RAD; bb++) {
          const i2 = i + a, j2 = j + bb;
          if (i2 < 0 || j2 < 0 || i2 >= n || j2 >= n) continue;
          if (cnt[i2 * n + j2]) { near = 1; break; }
        }
        if (!near) empty++;
      }
      return { biome: live, seeds: seeds, scenery: pts.length / 2,
               reachCells: reach, emptyCells: empty,
               reachArea: +(reach * S * S / 1000).toFixed(1),
               emptyPct: reach ? +(100 * empty / reach).toFixed(0) : null };
    });
    out.push(row);
  }

  await page.evaluate(async (p) => {
    await fetch('/shot?name=BIO-EMPTY', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(p)))) });
  }, out);
}
