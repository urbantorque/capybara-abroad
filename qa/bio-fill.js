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
      const g = window.__capy, C = g.CANNON;
      const live = g.biome.current;
      const t0 = performance.now();

      const cp = g.capy && g.capy.position;
      const SX = cp ? cp.x : 0, SZ = cp ? cp.z : 0;
      const R = 120, S = 2.5;                       // 240 m box around the spawn
      const n = Math.round((2 * R) / S) + 1;

      const rr = new C.RaycastResult();
      function surf(x, z) {
        rr.reset();
        g.world.raycastClosest(new C.Vec3(x, 90, z), new C.Vec3(x, -40, z), {}, rr);
        return rr.hasHit ? rr.hitPointWorld.y : NaN;
      }
      const h = new Float64Array(n * n);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        h[i * n + j] = surf(SX - R + i * S, SZ - R + j * S);
      }

      // FROM WHERE THE PLAYER ACTUALLY STARTS. capyJUMP_V 6.0 under gravity -24
      // peaks at 0.75 m, so that is the tallest thing that can be got onto; a
      // fall of six metres is survivable and one-way.
      const STEP = 0.75, DROP = 6.0;
      const seen = new Uint8Array(n * n);
      // SEED NEAR THE SPAWN, NOT EXACTLY ON IT. Seeding the single spawn cell
      // killed the fill outright in Rio, Cappadocia and Monte Carlo — all three
      // reported "1 cell reachable", which is a statement about the probe and
      // not about the chapter. The spawn can sit over water, over a gap, or in
      // the air on the frame the sample is taken. Take the nearest cell within
      // 10 m that has a surface, and record which one so a dead fill is
      // obvious rather than silently plausible.
      let start = -1, bestD = 1e9;
      const si = Math.round(R / S), sj = Math.round(R / S);
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const c = i * n + j;
        if (!(h[c] === h[c])) continue;
        const d = Math.hypot(i - si, j - sj);
        if (d * S > 10) continue;
        if (d < bestD) { bestD = d; start = c; }
      }
      const q = [];
      if (start >= 0) { seen[start] = 1; q.push(start); }
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

      // Now: which STATIC PLATFORMS have no reached cell on top of them?
      // A platform is a static box with a flat top of at least 4 m2 standing at
      // least 0.9 m clear of the ground under it.
      const miss = [];
      for (const body of g.world.bodies) {
        if (body.mass !== 0 || !body.shapes.length) continue;
        const s = body.shapes[0];
        if (!s.halfExtents) continue;
        const hx = s.halfExtents.x, hy = s.halfExtents.y, hz = s.halfExtents.z;
        if (4 * hx * hz < 4) continue;
        const cx = body.position.x, cz = body.position.z, top = body.position.y + hy;
        if (Math.abs(cx - SX) > R - 4 || Math.abs(cz - SZ) > R - 4) continue;
        // is any grid cell standing ON this box reached?
        let on = 0, reached = 0;
        const i0 = Math.max(0, Math.floor((cx - hx - (SX - R)) / S));
        const i1 = Math.min(n - 1, Math.ceil((cx + hx - (SX - R)) / S));
        const j0 = Math.max(0, Math.floor((cz - hz - (SZ - R)) / S));
        const j1 = Math.min(n - 1, Math.ceil((cz + hz - (SZ - R)) / S));
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
          const c = i * n + j;
          if (Math.abs(h[c] - top) > 0.35) continue;    // standing on THIS box
          on++;
          if (seen[c]) reached++;
        }
        if (on >= 2 && reached === 0) {
          // HOW FAR OUT OF REACH, which is the difference between a defect and a
          // roof. A deck 2 m above the nearest place you can stand is a bridge
          // nobody can use; a parapet 30 m above it is a building, and the game
          // is not obliged to let you on it.
          let lift = 1e9;
          const ri = Math.round((cx - (SX - R)) / S), rj = Math.round((cz - (SZ - R)) / S);
          const RAD = Math.ceil(10 / S);
          for (let a = -RAD; a <= RAD; a++) for (let bb = -RAD; bb <= RAD; bb++) {
            const i2 = ri + a, j2 = rj + bb;
            if (i2 < 0 || j2 < 0 || i2 >= n || j2 >= n) continue;
            const c2 = i2 * n + j2;
            if (!seen[c2]) continue;
            const d = top - h[c2];
            if (d > 0 && d < lift) lift = d;
          }
          miss.push({ x: +cx.toFixed(0), y: +top.toFixed(1), z: +cz.toFixed(0),
                      area: +(4 * hx * hz).toFixed(0), cells: on,
                      lift: lift === 1e9 ? null : +lift.toFixed(2) });
        }
      }
      // cluster: a bridge is thirty boxes, not thirty findings
      const cl = [];
      for (const m of miss) {
        let f = null;
        for (const c of cl) if (Math.abs(c.x - m.x) < 16 && Math.abs(c.z - m.z) < 30 && Math.abs(c.y - m.y) < 5) { f = c; break; }
        if (f) { f.n++; f.area += m.area; f.cells += m.cells;
                 if (m.lift !== null && (f.lift === null || m.lift < f.lift)) f.lift = m.lift;
                 f.x = (f.x * (f.n - 1) + m.x) / f.n; f.z = (f.z * (f.n - 1) + m.z) / f.n; }
        else cl.push({ x: m.x, y: m.y, z: m.z, area: m.area, cells: m.cells, lift: m.lift, n: 1 });
      }
      // Ranked by how CLOSE it is to being reachable, not by how big it is: the
      // smallest lift is the likeliest defect.
      cl.sort((a, b) => (a.lift === null ? 1e9 : a.lift) - (b.lift === null ? 1e9 : b.lift));
      let reachedCells = 0, surfCells = 0;
      for (let i = 0; i < n * n; i++) { if (h[i] === h[i]) surfCells++; if (seen[i]) reachedCells++; }
      return { biome: live, ms: Math.round(performance.now() - t0),
               grid: n, surfCells: surfCells, reachedCells: reachedCells,
               unreachablePlatforms: miss.length,
               seedOffset: +(bestD * S).toFixed(1),
               clusters: cl.filter(c => c.lift !== null && c.lift <= 6 && c.area >= 12)
                           .slice(0, 6)
                           .map(c => ({ x: +c.x.toFixed(0), y: c.y, z: +c.z.toFixed(0),
                                        area: c.area, lift: c.lift, boxes: c.n })) };
    });
    out.push(row);
  }

  await page.evaluate(async (p) => {
    await fetch('/shot?name=BIO-FILL', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(p)))) });
  }, out);
}
