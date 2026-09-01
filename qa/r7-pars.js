async page => {
  // ======================================================================
  // R7 — THE MACHINE FLOORS FOR THE THREE NEW RECORDS.
  //
  // A par below the floor is unreachable by anybody, and a par a scripted
  // sprint beats by half is not a par. So: drive the animal at full sprint
  // along each of the three, with a closed-loop steer (movement is
  // camera-relative and input.camYaw drifts, so the WASD set is recomputed
  // every few frames from the vector to the target), and read the number the
  // GAME files rather than one this probe computes.
  //
  //   calcadao   longest unbroken span of the wave, in metres — 188 drawn,
  //              132 tick it
  //   the-calli  side-to-side extent of the maze, in metres — 48 across,
  //              36 tick it
  //   rialto     side to side over the arch, in seconds
  //
  // Hand-driven ticks, so this runs at many times real time; pumped in slices
  // because a single page.evaluate past ~20 s loses its execution context.
  // ======================================================================
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  const out = {};

  const boot = async function (biome, key) {
    await page.reload();
    await wait(4500);
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await wait(6000);
    await page.keyboard.press(key);
    await wait(6000);
    await page.evaluate(function (b) {
      const g = window.__capy;
      if (g.biome.current !== b) {
        g.biome.switchTo(b);
        const sp = g.biome.spawnOf(b), bd = g.capy.body;
        if (sp) { bd.position.set(sp.x, sp.y, sp.z); bd.velocity.set(0, 0, 0); }
      }
    }, biome);
    await wait(3000);
  };

  // A steering driver, installed on window so the slices share it.
  const driver = function () {
    const g = window.__capy, D = 1 / 60;
    const inp = g.input;
    window.__drv = {
      // Put her exactly here, standing still, and forget every held key.
      place: function (x, y, z) {
        const b = g.capy.body;
        b.position.set(x, y, z); b.velocity.set(0, 0, 0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        inp.x = 0; inp.z = 0; inp.run = false;
        inp.jump = false; inp.jumpPressed = false;
        inp.action = false; inp.actionPressed = false;
        inp.honk = false; inp.honkPressed = false;
      },
      // Sprint at a world-space target. camYaw is pinned to 0, which makes
      // input.x/z world axes — see the note in qa/r6-condor.js.
      run: function (tx, tz, ticks, hop) {
        for (let i = 0; i < ticks; i++) {
          const p = g.capy.position;
          const dx = tx - p.x, dz = tz - p.z;
          const d = Math.hypot(dx, dz) || 1;
          inp.camYaw = 0; inp.x = dx / d; inp.z = dz / d; inp.run = true;
          inp.jump = false; inp.jumpPressed = false;
          if (hop && i % 40 === 0) { inp.jump = true; inp.jumpPressed = true; }
          g.tick(D, false);
          inp.jumpPressed = false; inp.honkPressed = false; inp.actionPressed = false;
        }
      },
      idle: function (ticks) {
        for (let i = 0; i < ticks; i++) {
          inp.x = 0; inp.z = 0; inp.run = false;
          g.tick(D, false);
        }
      },
      rec: function (id) {
        const a = g.hud && g.hud.recordAudit ? g.hud.recordAudit() : null;
        return a ? a.best[id] : undefined;
      },
      live: function () {
        const a = g.hud && g.hud.recordAudit ? g.hud.recordAudit() : null;
        return a ? { id: a.live, val: a.val } : null;
      }
    };
    return true;
  };

  // ---- 1. THE CALCADAO -------------------------------------------------
  await boot('rio', 'Digit1');
  await page.evaluate(driver);
  out.calcadao = { legs: [] };
  // Start hard against the west end of the counted band and sprint east.
  // rioCALC_Z0..Z1 is the paving; aim down the middle of it.
  const calcSetup = await page.evaluate(() => {
    const g = window.__capy, R = g.rio;
    const zMid = -1.2;
    const x0 = -92, x1 = 92;
    window.__drv.place(x0, R.terrainHeight(x0, zMid) + 0.6, zMid);
    return { zMid: zMid, x0: x0, x1: x1, y: R.terrainHeight(x0, zMid) };
  });
  out.calcadao.setup = calcSetup;
  for (let k = 0; k < 8; k++) {
    const st = await page.evaluate(function (s) {
      const g = window.__capy;
      const trail = [];
      for (let n = 0; n < 40; n++) {
        window.__drv.run(s.x1, s.zMid, 30, false);
        const q = g.capy.position;
        const L = window.__drv.live();
        trail.push({ x: +q.x.toFixed(1), z: +q.z.toFixed(2),
                     dy: +(q.y - g.rio.terrainHeight(q.x, q.z)).toFixed(2),
                     v: L && L.id === 'calcadao' ? +L.val.toFixed(1) : -1 });
      }
      const p = g.capy.position;
      return { x: +p.x.toFixed(1), z: +p.z.toFixed(1),
               live: window.__drv.live(), trail: trail };
    }, calcSetup);
    out.calcadao.legs.push(st);
    if (st.x > calcSetup.x1 - 3) break;
  }
  out.calcadao.filed = await page.evaluate(() => {
    const g = window.__capy;
    // step off the paving to close the run, then read what was filed
    const R = g.rio, z = 14;
    window.__drv.run(g.capy.position.x, z, 240, false);
    window.__drv.idle(60);
    return { rec: window.__drv.rec('calcadao'),
             done: !!(g.hud && g.hud.isTaskDone('calcadao')),
             err: g.state.lastError ? String(g.state.lastError) : null };
  });

  // ---- 2. THE CALLI ----------------------------------------------------
  await boot('venice', 'Digit1');
  await page.evaluate(driver);
  const calliSetup = await page.evaluate(() => {
    const g = window.__capy, V = g.venice;
    // venCAL_X0..Z1 and venCITY_Y are module constants in venice.js, read here
    // rather than added to the API: a probe should not grow the game surface
    // to measure something that is a fixed number in the source.
    return { x0: -78, x1: -30, z0: -56, z1: 4, y: 1.30 };
  });
  out.calli = { setup: calliSetup, legs: [] };
  if (calliSetup) {
    await page.evaluate(function (s) {
      const g = window.__capy;
      const zm = (s.z0 + s.z1) * 0.5;
      window.__drv.place(s.x0 + 1.5, s.y + 0.8, zm);
    }, calliSetup);
    // Walk east in short legs, nudging north/south to find a bridge — a maze
    // cannot be crossed by aiming straight at the far wall.
    for (let k = 0; k < 14; k++) {
      const st = await page.evaluate(function (a) {
        const g = window.__capy, s = a.s;
        const zm = (s.z0 + s.z1) * 0.5;
        const zTry = zm + ((a.k % 5) - 2) * (s.z1 - s.z0) * 0.18;
        window.__drv.run(s.x1 - 1.5, zTry, 700, true);
        const p = g.capy.position;
        return { x: +p.x.toFixed(1), z: +p.z.toFixed(1),
                 live: window.__drv.live() };
      }, { s: calliSetup, k: k });
      out.calli.legs.push(st);
      if (st.x > calliSetup.x1 - 3) break;
    }
    out.calli.filed = await page.evaluate(function (s) {
      const g = window.__capy;
      // out of the maze entirely, to close the visit
      window.__drv.run(s.x1 + 22, (s.z0 + s.z1) * 0.5, 600, false);
      window.__drv.idle(60);
      return { rec: window.__drv.rec('the-calli'),
               done: !!(g.hud && g.hud.isTaskDone('the-calli')),
               err: g.state.lastError ? String(g.state.lastError) : null };
    }, calliSetup);
  }

  // ---- 3. THE RIALTO ---------------------------------------------------
  out.rialto = await page.evaluate(() => {
    const g = window.__capy, V = g.venice;
    const r = V.rialto();   // it is a METHOD — the axis is computed per call
    if (!r) return { missing: true };
    // Approach from one bank, over the arch, down the other side. The zone
    // test is along the canal's own line, so aim across it.
    // rialto() publishes the AXIS the bridge is crossed on (ax, az) precisely
    // because a diagonal that looks right on a map misses the deck. Use it.
    const a = { x: r.x + r.ax * 16, z: r.z + r.az * 16 };
    const b = { x: r.x - r.ax * 16, z: r.z - r.az * 16 };
    window.__drv.place(a.x, r.y + 0.8, a.z);
    window.__drv.idle(30);
    window.__drv.run(b.x, b.z, 900, false);
    return { rec: window.__drv.rec('rialto'),
             done: !!(g.hud && g.hud.isTaskDone('rialto')),
             endX: +g.capy.position.x.toFixed(1), endZ: +g.capy.position.z.toFixed(1),
             a: a, b: b, err: g.state.lastError ? String(g.state.lastError) : null };
  });

  const bl = await page.evaluate(o =>
    btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=r7-pars.json', { method: 'POST', body: s }), bl);
}
