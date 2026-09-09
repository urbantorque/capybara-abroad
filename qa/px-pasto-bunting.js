async page => {
  // ---------------------------------------------------------------------------
  // qa/px-pasto-bunting.js — PASTO'S TWELVE BUNTING POSTS (ROADMAP-PHYSICS X9)
  //
  // The last of X9's three, and the one it explicitly refused to settle:
  // *"Collide them or write down that thin plaza furniture stays open — either
  // is defensible... That is the owner's call, not a probe's."*
  //
  // A probe cannot make the call. It can make it an informed one, and X9's own
  // framing says what would decide it — the Göreme precedent cuts both ways
  // there: the baskets were collided at 2.4 m, the 1.9 m fan was left open
  // BECAUSE A TASK RUNS THROUGH IT. So:
  //
  //  1. WHERE ARE THEY? `pastoBUNT` puts all twelve at x ±22.5, at six z's —
  //     two columns 1.5 m inside the plaza's edge, not twelve posts scattered
  //     across the middle of it. Confirmed here against the live scene.
  //  2. IS ANYTHING ALREADY SOLID THERE? A post that stands inside a stall or
  //     against a kerb is already collided by its neighbour.
  //  3. DOES ANYTHING RUN THROUGH THEM? The carroza's route is x 10.5, which
  //     is clear by arithmetic — but the locals, the herd and the loose props
  //     move, and a post is only safe to collide if nothing needs to pass.
  //  4. AND WHAT DOES A PLAYER MEET? Walk at each of the twelve and see.
  // ---------------------------------------------------------------------------
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.reload();
  await page.waitForTimeout(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(8000);

  const out = await page.evaluate(async () => {
    const g = window.__capy, CANNON = g.CANNON;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    g.biome.switchTo('pasto');
    tick(60 * 12);
    const res = { biome: g.biome.current, posts: [] };
    const POSTS = [];
    for (const z of [12, 17, 22, 28, 34, 40]) { POSTS.push([-22.5, z]); POSTS.push([22.5, z]); }
    res.postList = POSTS;

    // ---- 2. what is already solid within two metres of each post ----------
    const near = function (px, pz, r) {
      let best = null;
      for (const b of g.world.bodies) {
        if (b.mass > 0 || b === g.capy.body) continue;
        for (let i = 0; i < b.shapes.length; i++) {
          const o = b.shapeOffsets[i];
          const wx = b.position.x + o.x, wz = b.position.z + o.z;
          const s = b.shapes[i];
          if (s.type === CANNON.Shape.types.HEIGHTFIELD ||
              s.type === CANNON.Shape.types.PLANE) continue;
          const hx = (s.halfExtents && s.halfExtents.x) || 0.3;
          const hz = (s.halfExtents && s.halfExtents.z) || 0.3;
          const dx = Math.max(0, Math.abs(px - wx) - hx);
          const dz = Math.max(0, Math.abs(pz - wz) - hz);
          const d = Math.hypot(dx, dz);
          if (d < r && (best === null || d < best.d)) {
            best = { d: +d.toFixed(2), at: [+wx.toFixed(1), +wz.toFixed(1)],
                     half: [+hx.toFixed(2), +((s.halfExtents && s.halfExtents.y) || 0).toFixed(2),
                            +hz.toFixed(2)] };
          }
        }
      }
      return best;
    };
    for (const [px, pz] of POSTS) res.posts.push({ at: [px, pz], solidWithin2m: near(px, pz, 2) });

    // ---- 4. walk at each of the twelve ------------------------------------
    // Straight at the post from two metres out, along the plaza's own axis.
    const walkAt = function (px, pz) {
      const b = g.capy.body;
      const fromX = px > 0 ? px - 2.6 : px + 2.6;
      b.position.set(fromX, g.pasto.terrainHeight(fromX, pz) + 0.5, pz);
      b.velocity.set(0, 0, 0);
      tick(45);
      let stuck = 0, last = b.position.x;
      for (let i = 0; i < 60 * 8; i++) {
        b.velocity.x = px > 0 ? 4 : -4;
        g.tick(1 / 60, false);
        if (Math.abs(b.position.x - last) < 0.004) stuck++; else stuck = 0;
        last = b.position.x;
        if (stuck > 40) break;
      }
      const through = px > 0 ? b.position.x > px + 0.3 : b.position.x < px - 0.3;
      return { at: [px, pz], endX: +b.position.x.toFixed(2), through: through };
    };
    res.walks = POSTS.map(function (p) { return walkAt(p[0], p[1]); });

    // ---- 3. and what moves near them --------------------------------------
    // Sixty seconds of the chapter running, sampling everything that moves for
    // how close it gets to any post. A post is only safe to collide if nothing
    // needs the ground it stands on.
    const b = g.capy.body;
    b.position.set(0, g.pasto.terrainHeight(0, 27) + 0.5, 27);
    b.velocity.set(0, 0, 0);
    tick(60);
    const minTo = {};
    const note = function (kind, x, z) {
      let d = 1e9;
      for (const [px, pz] of POSTS) d = Math.min(d, Math.hypot(px - x, pz - z));
      if (!(kind in minTo) || d < minTo[kind]) minTo[kind] = +d.toFixed(2);
    };
    for (let i = 0; i < 60 * 60; i++) {
      g.tick(1 / 60, false);
      if (i % 15) continue;
      for (const L of (g.locals || [])) {
        if (L && L.biome === 'pasto') note('a local', L.ax !== undefined ? L.ax : L.x,
                                          L.az !== undefined ? L.az : L.z);
      }
      for (const p of (g.props || [])) {
        if (p && p.body) note('a prop', p.body.position.x, p.body.position.z);
      }
      try {
        const hd = g.herdDebug ? g.herdDebug() : null;
        if (hd && hd.kinds) for (const k of hd.kinds) {
          if (k.near !== undefined && k.x !== undefined) note('an animal', k.x, k.z);
        }
      } catch (e) {}
    }
    res.closestMovers = minTo;
    // ...and the carroza's own line, which is arithmetic and not a sample
    res.carroza = { x: 10.5, hx: 1.62, spans: 'z 10.5 to 39.0',
                    clearOfPostsBy: +(22.5 - (10.5 + 1.62)).toFixed(2) };
    return res;
  });

  out.errs = errs; out.errN = errs.length;
  await page.evaluate((o) => fetch('/shot?name=px-pasto-bunting.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
