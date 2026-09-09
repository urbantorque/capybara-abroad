async page => {
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);

  const out = {};

  // ---- KYOTO: is the Uji bridge reachable on foot? -------------------------
  await page.evaluate(() => { const g = window.__capy; try { g.hud.cross('kyoto'); } catch (e) { g.biome.switchTo('kyoto'); } });
  await page.waitForTimeout(4500);
  out.kyoto = await page.evaluate(() => {
    const g = window.__capy, C = g.CANNON;
    const bx = 4, bz = 128;
    // TOP SOLID SURFACE by downward ray — cheaper than dropping a body and it
    // is the same question. Physics ray, so it sees colliders and not drawings.
    function surf(x, z) {
      const from = new C.Vec3(x, 40, z), to = new C.Vec3(x, -20, z);
      const r = new C.RaycastResult();
      g.world.raycastClosest(from, to, {}, r);
      return r.hasHit ? r.hitPointWorld.y : null;
    }
    const X0 = bx - 16, X1 = bx + 16, Z0 = bz - 34, Z1 = bz + 34, S = 1;
    const nx = Math.round((X1 - X0) / S) + 1, nz = Math.round((Z1 - Z0) / S) + 1;
    const h = new Float64Array(nx * nz);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const y = surf(X0 + i * S, Z0 + j * S);
      h[i * nz + j] = (y === null) ? NaN : y;
    }
    // FLOOD FILL from the southern approach, stepping at most STEP up.
    // capyJUMP_V is 6.0 m/s and gravity is -24, so the peak of a standing jump
    // is v^2/2g = 0.75 m. Anything above that cannot be got onto.
    const STEP = 0.75, DROP = 6.0;
    const seen = new Uint8Array(nx * nz);
    // SEED FROM ALL GROUND, NOT ONE CORNER. The first version of this seeded a
    // single cell on the southern approach, that cell happened to have no
    // surface under it at all, and the fill died on the spot — which reports
    // "0 of 426 deck cells reachable" for a reason that has nothing to do with
    // the bridge. Seeding every cell at ground level also answers the harder
    // question, which is whether the deck can be reached from ANY side.
    const q = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const c = i * nz + j, y = h[c];
      if (!(y === y) || y > 0.5) continue;    // ground, not deck
      seen[c] = 1; q.push(c);
    }
    const seeds = q.length;
    while (q.length) {
      const c = q.pop(), ci = (c / nz) | 0, cj = c % nz, hc = h[c];
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [di, dj] of nb) {
        const i2 = ci + di, j2 = cj + dj;
        if (i2 < 0 || j2 < 0 || i2 >= nx || j2 >= nz) continue;
        const c2 = i2 * nz + j2;
        if (seen[c2]) continue;
        const h2 = h[c2];
        if (!(h2 === h2) || !(hc === hc)) continue;
        const rise = h2 - hc;
        if (rise > STEP || rise < -DROP) continue;
        seen[c2] = 1; q.push(c2);
      }
    }
    // The deck: the drawn hump is y = 1.5 + sin(t*pi)*1.5 over 46 m, so any
    // surface at or above 1.4 within the span is bridge and not ground.
    let deck = 0, deckReached = 0, minGapToDeck = 1e9;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const c = i * nz + j, y = h[c];
      if (!(y === y) || y < 1.4) continue;
      const z = Z0 + j * S;
      if (Math.abs(z - bz) > 23) continue;
      deck++;
      if (seen[c]) deckReached++;
      // how far below is the nearest REACHED cell?
      for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
        const i2 = i + a, j2 = j + b;
        if (i2 < 0 || j2 < 0 || i2 >= nx || j2 >= nz) continue;
        const c2 = i2 * nz + j2;
        if (!seen[c2]) continue;
        const gap = y - h[c2];
        if (gap > 0 && gap < minGapToDeck) minGapToDeck = gap;
      }
    }
    // the profile down the middle of the bridge
    const prof = [];
    const mid = Math.round((bx - X0) / S);
    for (let j = 0; j < nz; j += 3) {
      const c = mid * nz + j;
      prof.push({ z: Z0 + j * S, y: h[c] === h[c] ? +h[c].toFixed(2) : null, reached: !!seen[c] });
    }
    return { seeds: seeds, deckCells: deck, deckReached: deckReached,
             smallestStepOntoDeck: minGapToDeck === 1e9 ? null : +minGapToDeck.toFixed(2),
             jumpPeak: 0.75, profile: prof };
  });

  // ---- CALI: is the bridge parapet solid? ---------------------------------
  await page.evaluate(() => { const g = window.__capy; try { g.hud.cross('cali'); } catch (e) { g.biome.switchTo('cali'); } });
  await page.waitForTimeout(4500);
  out.cali = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE, C = g.CANNON;
    const bx = -6, bz = 0;
    const rz = (function () { try { return g.cali.riverZ; } catch (e) { return 0; } })();
    const z0 = (typeof rz === 'number') ? rz : 0;
    // Fire outward across each parapet at deck height + 0.5 and ask both the
    // drawing and the physics. Drawn hit + no physics hit = you walk through it.
    const rc = new T.Raycaster();
    const res = [];
    for (const s of [-1, 1]) {
      for (let k = -12; k <= 12; k += 3) {
        const oy = 1.03 + 0.5;
        const o = new T.Vector3(bx + s * 2.0, oy, z0 + k);
        const d = new T.Vector3(s, 0, 0);
        rc.set(o, d); rc.far = 4.5;
        const hits = rc.intersectObject(g.scene, true).filter(h => {
          for (let p = h.object; p; p = p.parent) if (!p.visible) return false;
          return true;
        });
        const drawn = hits.length ? +hits[0].distance.toFixed(2) : null;
        const r = new C.RaycastResult();
        g.world.raycastClosest(new C.Vec3(o.x, o.y, o.z),
                               new C.Vec3(o.x + d.x * 4.5, o.y, o.z + d.z * 4.5), {}, r);
        const phys = r.hasHit ? +Math.hypot(r.hitPointWorld.x - o.x, r.hitPointWorld.z - o.z).toFixed(2) : null;
        res.push({ side: s, k: k, drawn: drawn, phys: phys, through: drawn !== null && phys === null });
      }
    }
    // and can you fall off the deck where the parapet is drawn?
    const through = res.filter(r => r.through).length;
    return { samples: res.length, walkThrough: through, rows: res };
  });

  await page.evaluate(async (p) => {
    await fetch('/shot?name=BIO-REACH', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(p)))) });
  }, out);
}
