async page => {
  // ======================================================================
  // R7 — THE MACHINE FLOORS, SECOND CUT.
  //
  // TWO THINGS THE FIRST CUT GOT WRONG, both of them the probe and not the
  // game, and both worth writing down:
  //
  //   1. `V.rialto` IS A METHOD. Read without the parentheses it is a truthy
  //      function object whose .ax is undefined, so every coordinate derived
  //      from it came out NaN and serialised as null. Nothing threw.
  //   2. TELEPORTING ONTO THE PAVING DOES NOT START A RUN. The chapter spawns
  //      the animal ON the calçadão, so by the time the probe placed her at
  //      the west end the tracker was already armed with rioCalcFrom at the
  //      spawn — and a teleport does not leave the band, so the start never
  //      moved. Every metre of the "sprint" was measured against x = 0 and the
  //      answer was 91, which is exactly half of what it should have been and
  //      therefore looked plausible. She has to WALK ON, from off it.
  //
  // Three repeats of each, because a floor is a minimum and one sample of a
  // physics run is not one.
  // ======================================================================
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  const out = { calcadao: [], rialto: [], calli: [] };

  const boot = async function (biome) {
    await page.reload();
    await wait(4500);
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await wait(6000);
    await page.keyboard.press('Digit1');
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
    await page.evaluate(function () {
      const g = window.__capy, D = 1 / 60, inp = g.input;
      window.__drv = {
        place: function (x, y, z) {
          const b = g.capy.body;
          b.position.set(x, y, z); b.velocity.set(0, 0, 0);
          b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
          inp.x = 0; inp.z = 0; inp.run = false;
          inp.jump = false; inp.jumpPressed = false;
          inp.action = false; inp.actionPressed = false;
          inp.honk = false; inp.honkPressed = false;
        },
        run: function (tx, tz, ticks) {
          for (let i = 0; i < ticks; i++) {
            const p = g.capy.position;
            const dx = tx - p.x, dz = tz - p.z;
            const d = Math.hypot(dx, dz) || 1;
            inp.camYaw = 0; inp.x = dx / d; inp.z = dz / d; inp.run = true;
            g.tick(D, false);
            inp.jumpPressed = false; inp.honkPressed = false; inp.actionPressed = false;
          }
        },
        idle: function (ticks) {
          for (let i = 0; i < ticks; i++) { inp.x = 0; inp.z = 0; inp.run = false; g.tick(D, false); }
        },
        rec: function (id) {
          const a = g.hud.recordAudit();
          return a.best[id];
        },
        live: function (id) {
          const a = g.hud.recordAudit();
          return a.live === id ? a.val : -1;
        }
      };
      return true;
    });
  };

  // ---- THE CALCADAO ----------------------------------------------------
  await boot('rio');
  for (let t = 0; t < 3; t++) {
    // Off the paving first — on the sand, well south of the band — and idle
    // there long enough for the tracker to let go of the spawn's run.
    await page.evaluate(() => {
      const g = window.__capy, R = g.rio;
      window.__drv.place(-90, R.terrainHeight(-90, 16) + 0.6, 16);
      window.__drv.idle(90);
    });
    // Walk on at the west end, then east, in slices.
    await page.evaluate(() => { window.__drv.run(-90, -1.2, 240); });
    let live = -1;
    for (let k = 0; k < 8; k++) {
      const st = await page.evaluate(() => {
        window.__drv.run(92, -1.2, 900);
        const g = window.__capy;
        return { x: +g.capy.position.x.toFixed(1), live: +window.__drv.live('calcadao').toFixed(1) };
      });
      live = st.live;
      if (st.x > 89) break;
    }
    const row = await page.evaluate(() => {
      const g = window.__capy, R = g.rio;
      const x = g.capy.position.x;
      window.__drv.run(x, 16, 300);            // step off to close the run
      window.__drv.idle(60);
      return { rec: +window.__drv.rec('calcadao').toFixed(1),
               done: !!g.hud.isTaskDone('calcadao'),
               err: g.state.lastError ? String(g.state.lastError) : null };
    });
    row.liveAtEnd = live;
    out.calcadao.push(row);
  }

  // ---- THE RIALTO ------------------------------------------------------
  await boot('venice');
  for (let t = 0; t < 3; t++) {
    const row = await page.evaluate(function (i) {
      const g = window.__capy, V = g.venice;
      const r = V.rialto();
      // rialto() publishes the AXIS the bridge is crossed on, because a
      // diagonal that looks right on a map misses the deck entirely.
      const s = i % 2 ? -1 : 1;
      const a = { x: r.x + r.ax * 17 * s, z: r.z + r.az * 17 * s };
      const b = { x: r.x - r.ax * 17 * s, z: r.z - r.az * 17 * s };
      window.__drv.place(a.x, r.y + 0.6, a.z);
      window.__drv.idle(40);
      window.__drv.run(b.x, b.z, 700);
      const rec = window.__drv.rec('rialto');
      window.__drv.run(b.x + r.ax * -30 * s, b.z + r.az * -30 * s, 300);  // out of the zone
      window.__drv.idle(30);
      return { rec: rec === undefined ? -1 : +rec.toFixed(2),
               done: !!g.hud.isTaskDone('rialto'),
               span: +(Math.hypot(a.x - b.x, a.z - b.z)).toFixed(1),
               err: g.state.lastError ? String(g.state.lastError) : null };
    }, t);
    out.rialto.push(row);
  }

  // ---- THE CALLI -------------------------------------------------------
  // 48 m wide, 36 tick it. The ceiling is what a crossing that starts hard
  // against one wall and ends hard against the other can reach.
  for (let t = 0; t < 3; t++) {
    const row = await page.evaluate(function (i) {
      const g = window.__capy;
      const X0 = -78, X1 = -30, Z0 = -56, Z1 = 4, Y = 1.30;
      const zm = (Z0 + Z1) * 0.5 + ((i % 3) - 1) * 12;
      window.__drv.place(X0 - 6, Y + 0.8, zm);         // outside, to the west
      window.__drv.idle(60);
      let best = -1;
      for (let k = 0; k < 16; k++) {
        window.__drv.run(X1 + 2, zm + ((k % 5) - 2) * 9, 420);
        const v = window.__drv.live('the-calli');
        if (v > best) best = v;
        if (g.capy.position.x > X1 - 1) break;
      }
      window.__drv.run(X1 + 20, zm, 420);              // out of the maze
      window.__drv.idle(60);
      const rec = window.__drv.rec('the-calli');
      return { rec: rec === undefined ? -1 : +rec.toFixed(1),
               liveBest: +best.toFixed(1),
               done: !!g.hud.isTaskDone('the-calli'),
               err: g.state.lastError ? String(g.state.lastError) : null };
    }, t);
    out.calli.push(row);
  }

  const bl = await page.evaluate(o =>
    btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=r7-pars2.json', { method: 'POST', body: s }), bl);
}
