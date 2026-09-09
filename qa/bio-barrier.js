async page => {
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(6500);
  await page.keyboard.press('Space');
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
      const R = 120, S = 2;
      const n = Math.round((2 * R) / S) + 1;

      const rr = new C.RaycastResult();
      function surf(x, z) {
        rr.reset();
        g.world.raycastClosest(new C.Vec3(x, 90, z), new C.Vec3(x, -40, z), {}, rr);
        return rr.hasHit ? rr.hitPointWorld.y : NaN;
      }
      const h = new Float64Array(n * n);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) h[i * n + j] = surf(SX - R + i * S, SZ - R + j * S);

      // walkable, ground-seeded (three chapters start you on something that moves)
      const th = (g[live] && typeof g[live].terrainHeight === 'function') ? g[live].terrainHeight : null;
      const seen = new Uint8Array(n * n);
      const q = [];
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const c = i * n + j, y = h[c];
        if (!(y === y)) continue;
        const x = SX - R + i * S, z = SZ - R + j * S;
        const gy = th ? th(x, z) : 0;
        if (!(gy === gy) || Math.abs(y - gy) > 0.6) continue;
        seen[c] = 1; q.push(c);
      }
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

      // AN EDGE IS A WALKABLE CELL NEXT TO A DROP. That is where a railing goes,
      // and it is the only place where "drawn but not solid" is dangerous rather
      // than merely untidy: walking through a wall into a field is a curiosity,
      // walking through a parapet into a river is a fall.
      const rc = new T.Raycaster();
      const hits = [];
      const EDGE_DROP = 1.8;
      for (let i = 1; i < n - 1; i++) for (let j = 1; j < n - 1; j++) {
        const c = i * n + j;
        if (!seen[c]) continue;
        const y = h[c];
        const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (let k = 0; k < 4; k++) {
          const i2 = i + nb[k][0], j2 = j + nb[k][1];
          const c2 = i2 * n + j2;
          const h2 = h[c2];
          const falls = !(h2 === h2) || (y - h2) > EDGE_DROP;
          if (!falls) continue;
          // fire outward, from just inside the edge, at knee/chest height
          const ox = SX - R + i * S, oz = SZ - R + j * S;
          const dx = nb[k][0], dz = nb[k][1];
          for (const oy of [0.35, 0.8]) {
            const o = new T.Vector3(ox, y + oy, oz);
            const d = new T.Vector3(dx, 0, dz);
            rc.set(o, d); rc.far = 2.6;
            const dr = rc.intersectObject(g.scene, true).filter(q2 => {
              for (let p = q2.object; p; p = p.parent) if (!p.visible) return false;
              return true;
            });
            if (!dr.length) continue;
            rr.reset();
            g.world.raycastClosest(new C.Vec3(o.x, o.y, o.z),
                                   new C.Vec3(o.x + dx * 2.6, o.y, o.z + dz * 2.6), {}, rr);
            if (rr.hasHit) continue;                       // it is solid; fine
            hits.push({ x: +ox.toFixed(1), y: +(y).toFixed(1), z: +oz.toFixed(1),
                        at: +dr[0].distance.toFixed(2), oy: oy });
            break;
          }
        }
      }
      // cluster so a parapet is one finding and not ninety
      const cl = [];
      for (const m of hits) {
        let f = null;
        for (const c of cl) if (Math.abs(c.x - m.x) < 12 && Math.abs(c.z - m.z) < 12 && Math.abs(c.y - m.y) < 3) { f = c; break; }
        if (f) { f.n++; f.x = (f.x * (f.n - 1) + m.x) / f.n; f.z = (f.z * (f.n - 1) + m.z) / f.n; }
        else cl.push({ x: m.x, y: m.y, z: m.z, n: 1 });
      }
      cl.sort((a, b) => b.n - a.n);
      return { biome: live, edgeHits: hits.length,
               clusters: cl.filter(c => c.n >= 3).slice(0, 6)
                           .map(c => ({ x: +c.x.toFixed(0), y: c.y, z: +c.z.toFixed(0), n: c.n })) };
    });
    out.push(row);
  }

  await page.evaluate(async (p) => {
    await fetch('/shot?name=BIO-BARRIER', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(p)))) });
  }, out);
}
