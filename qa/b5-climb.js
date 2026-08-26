async page => {
  // ---- P1, MEASURED: HOW MUCH OF THIS GAME CAN BE CLIMBED? ---------------
  // Two probes, deliberately different instruments, because the two things
  // they answer are different:
  //
  //  A. THE AUTHORED LATTICES, on the ORIGINAL 1 m grid, calling each biome's
  //     own `climbHold` directly — arithmetic, so a grid is affordable. Hong
  //     Kong 150 m², Cappadocia 528, Son Doong 1,157. These three must not
  //     move by a square metre: if they do, the generic fallback is being
  //     reached somewhere a biome already answered, which is trap 3.
  //
  //  B. THE WHOLE GAME, through `capy.climbAt` — the entry point the
  //     controller itself uses, so it sees whichever of the two answered.
  //
  // B CANNOT BE A GRID, and that is worth stating plainly rather than quietly
  // shrinking the numbers. The fallback is two raycasts against every static
  // body in the chapter and it needs a FACING, so one cell of the original
  // grid costs eight rays instead of one property lookup: ±140 m at 1 m is
  // 79,000 cells and about two million raycasts per chapter. So B walks the
  // OUTSIDE of every static body's own footprint at 1 m spacing instead, at
  // chest height, facing in. That is where a wall can be — a probe that
  // sampled open ground would spend all of its time proving that a plaza is
  // not a wall — and it counts the same thing the original grid counted: the
  // distinct square metres of ground plan a climb can be started from.
  //
  // It UNDER-COUNTS on purpose, in two ways, and both are stated so the
  // number is not read as a survey: a body whose AABB contains a whole street
  // is walked round the street, so interior walls are missed; and only the
  // outside of an AABB is sampled, so a re-entrant courtyard is missed.
  const TAG = 'after';
  const A_R = 140, A_STEP = 1;        // the original grid, for the authored three
  const B_SPACE = 1.0;                // m along each body's footprint
  const B_OUT = 0.80;                 // m out from the face the animal stands
  const B_CHUNK = 60;                 // bodies per evaluate — see harness trap 2

  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);
  const names = await page.evaluate(async () => {
    const src = await (await fetch('/src/shared.js', { cache: 'no-store' })).text();
    const i = src.indexOf('export const CHAPTERS = [');
    if (i < 0) throw new Error('b5-climb: CHAPTERS not found — this audit has gone stale');
    const k = [];
    for (const m of src.slice(i, src.indexOf('\n];', i)).matchAll(/\bbiome:\s*'([a-z]+)'/g)) k.push(m[1]);
    return k;
  });

  const out = {};
  for (const n of names) {
    await page.evaluate((name) => { window.__capy.biome.switchTo(name); }, n);
    await page.waitForTimeout(800);

    // ---- A: the authored lattice, on the original grid ------------------
    out[n] = await page.evaluate((o) => {
      const g = window.__capy;
      const api = o.n === 'sydney' ? g.env : g[o.n];
      const res = { authored: null, publishes: false };
      if (!api || typeof api.climbHold !== 'function') return res;
      res.publishes = true;
      const th = (typeof api.terrainHeight === 'function')
        ? (x, z) => { const h = api.terrainHeight(x, z); return (h === h) ? h : 0; }
        : () => 0;
      let cells = 0;
      for (let x = -o.AR; x <= o.AR; x += o.AS) {
        for (let z = -o.AR; z <= o.AR; z += o.AS) {
          const gy = th(x, z);
          for (let d = 1.2; d <= 20.0001; d += 1.2) {
            if (api.climbHold(x, gy + d, z)) { cells++; break; }
          }
        }
      }
      res.authored = cells * o.AS * o.AS;
      return res;
    }, { n: n, AR: A_R, AS: A_STEP });

    // ---- B: the survey, through the controller's own entry point --------
    const nBodies = await page.evaluate(() => {
      const g = window.__capy;
      window.__b5 = g.world.bodies.filter(b => {
        if (!b || b.mass > 0 || b.isTrigger) return false;
        if (b.type !== undefined && g.CANNON.Body && b.type !== g.CANNON.Body.STATIC) return false;
        if (b.userData && (b.userData.npc || b.userData.local)) return false;
        if (!b.aabb || !isFinite(b.aabb.upperBound.y)) return false;
        const a = b.aabb, h = a.upperBound.y - a.lowerBound.y;
        if (!(h > 0.9)) return false;             // nothing under a metre is a wall
        for (const s of b.shapes) {
          const t = s && s.type;
          if (t === 32 || t === 2) return false;  // heightfield, plane
        }
        return true;
      });
      return window.__b5.length;
    });

    let cells = 0, probes = 0, sample = [];
    const seen = new Set();
    for (let i = 0; i < nBodies; i += B_CHUNK) {
      const r = await page.evaluate((o) => {
        const g = window.__capy, list = window.__b5;
        const hits = [], out = { probes: 0 };
        for (let bi = o.i; bi < Math.min(o.i + o.CH, list.length); bi++) {
          const a = list[bi].aabb;
          const x0 = a.lowerBound.x, x1 = a.upperBound.x;
          const z0 = a.lowerBound.z, z1 = a.upperBound.z;
          const y = a.lowerBound.y + 0.55;        // chest height against the foot of it
          if (!(isFinite(x0) && isFinite(x1) && isFinite(z0) && isFinite(z1))) continue;
          if ((x1 - x0) > 260 || (z1 - z0) > 260) continue;   // the whole-chapter shells
          const probe = (px, pz, yaw) => {
            out.probes++;
            if (g.capy.climbAt(px, y, pz, yaw)) hits.push([Math.round(px), Math.round(pz)]);
          };
          // the four sides, facing in. yaw convention: facing = (sin, cos).
          for (let x = x0; x <= x1; x += o.SP) {
            probe(x, z0 - o.O, 0);                       // south side, looking +z
            probe(x, z1 + o.O, Math.PI);                 // north side, looking -z
          }
          for (let z = z0; z <= z1; z += o.SP) {
            probe(x0 - o.O, z, Math.PI / 2);             // west side, looking +x
            probe(x1 + o.O, z, -Math.PI / 2);            // east side, looking -x
          }
        }
        out.hits = hits;
        return out;
      }, { i: i, CH: B_CHUNK, SP: B_SPACE, O: B_OUT });
      probes += r.probes;
      for (const h of r.hits) {
        const k = h[0] + '|' + h[1];
        if (!seen.has(k)) { seen.add(k); cells++; if (sample.length < 8) sample.push(h); }
      }
    }
    out[n].bodies = nBodies;
    out[n].probes = probes;
    out[n].area = cells;               // one distinct square metre per cell
    out[n].sample = sample;
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b5-climb-' + o.tag + '.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o.d, null, 1)))) });
  }, { tag: TAG, d: out });
}
