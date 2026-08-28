async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);

  const src = await (await page.request.get('http://localhost:5188/src/shared.js')).text();
  const chapters = [];
  const re = /\{\s*n:\s*(\d+),\s*biome:\s*'([a-z]+)'/g;
  let m;
  while ((m = re.exec(src))) chapters.push(m[2]);

  const out = { chapters: chapters, rows: [] };

  for (let ci = 0; ci < chapters.length; ci++) {
    const name = chapters[ci];
    let row;
    try {
      row = await page.evaluate(async (arg) => {
        const g = window.__capy;
        const nm = arg.name;
        if (g.biome.current !== nm) { g.biome.switchTo(nm); }
        for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
        const api = (nm === 'sydney') ? g.env : g[nm];
        const r = { biome: nm, live: g.biome.current, ok: !!api };
        if (!api) return r;

        const hasB = typeof api.bounds === 'function';
        const b = hasB ? api.bounds() : null;
        r.bounds = b ? { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1 } : null;
        r.hasTerrain = typeof api.terrainHeight === 'function';
        r.hasSlope = typeof api.slopeAt === 'function';
        r.hasWater = typeof api.isOverWater === 'function';
        r.hasSlip = typeof api.groundSlip === 'function';

        const th = r.hasTerrain
          ? (x, z) => { const v = api.terrainHeight(x, z); return (typeof v === 'number' && v === v) ? v : 0; }
          : () => 0;
        const ow = r.hasWater ? (x, z) => !!api.isOverWater(x, z) : () => false;

        const sp = g.biome.spawnOf ? g.biome.spawnOf(nm) : null;
        const cx = sp ? sp.x : 0, cz = sp ? sp.z : 0;
        const X0 = b ? b.x0 : cx - 150, X1 = b ? b.x1 : cx + 150;
        const Z0 = b ? b.z0 : cz - 150, Z1 = b ? b.z1 : cz + 150;
        const N = 34;
        const CANNON = g.CANNON;
        const rf = new CANNON.Vec3(), rt = new CANNON.Vec3();
        const res = new CANNON.RaycastResult();
        const opts = { skipBackfaces: false };

        let land = 0, water = 0, noPhys = 0;
        const deadPts = [];
        let burSum = 0, burN = 0, burMax = 0, burMaxAt = null, bur10 = 0, bur20 = 0;

        for (let i = 0; i < N; i++) {
          for (let j = 0; j < N; j++) {
            const x = X0 + (X1 - X0) * (i + 0.5) / N;
            const z = Z0 + (Z1 - Z0) * (j + 0.5) / N;
            if (ow(x, z)) { water++; continue; }
            land++;
            const h = th(x, z);

            const D = 0.45;
            const hx = Math.max(Math.abs(th(x + D, z) - h), Math.abs(th(x - D, z) - h));
            const hz = Math.max(Math.abs(th(x, z + D) - h), Math.abs(th(x, z - D) - h));
            const bur = Math.max(hx, hz);
            if (bur === bur && bur < 12) {
              burSum += bur; burN++;
              if (bur > 0.10) bur10++;
              if (bur > 0.20) bur20++;
              if (bur > burMax) { burMax = bur; burMaxAt = [Math.round(x), Math.round(z)]; }
            }

            res.reset();
            rf.set(x, h + 5, z); rt.set(x, h - 6, z);
            g.world.raycastClosest(rf, rt, opts, res);
            if (!res.hasHit) {
              noPhys++;
              if (deadPts.length < 14) deadPts.push([Math.round(x), Math.round(z), Math.round(h * 10) / 10]);
            }
          }
        }
        r.landPts = land; r.waterPts = water;
        r.noPhys = noPhys; r.noPhysPct = land ? +(100 * noPhys / land).toFixed(1) : 0;
        r.deadPts = deadPts;
        r.burMean = burN ? +(burSum / burN).toFixed(3) : 0;
        r.burMax = +burMax.toFixed(2);
        r.burMaxAt = burMaxAt;
        r.bur10pct = burN ? +(100 * bur10 / burN).toFixed(1) : 0;
        r.bur20pct = burN ? +(100 * bur20 / burN).toFixed(1) : 0;
        r.areaM2 = Math.round((X1 - X0) * (Z1 - Z0));
        r.deadM2 = Math.round(r.areaM2 * noPhys / (N * N));
        r.bodies = g.world.bodies.length;
        return r;
      }, { name: name });
    } catch (e) {
      row = { biome: name, error: String(e).slice(0, 200) };
    }
    out.rows.push(row);
  }

  await page.evaluate(async (o) => {
    const s = JSON.stringify(o, null, 1);
    await fetch('/shot?name=rev-world.json', {
      method: 'POST',
      body: btoa(unescape(encodeURIComponent(s))),
    });
  }, out);
}
