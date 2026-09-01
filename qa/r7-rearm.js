async page => {
  // ======================================================================
  // R7 — DO THEY STILL HAPPEN THE SECOND TIME?
  //
  // Five set pieces that switched themselves off the first time they paid out.
  // For each: perform it, confirm the tick, perform it AGAIN and confirm the
  // world still answers — which is the whole batch. The record rows are checked
  // for the thing that makes a row invisible (a key that is not a task id).
  // ======================================================================
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  const out = {};

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
      window.__toasts = [];
      if (!window.__toastHook) {
        window.__toastHook = true;
        const raw = g.toast;
        g.toast = function (t) { window.__toasts.push(String(t)); return raw.call(g, t); };
      }
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
        rec: function (id) { const a = g.hud.recordAudit(); return a.best[id]; },
        say: function () { const t = window.__toasts.slice(); window.__toasts.length = 0; return t; }
      };
      return true;
    });
  };

  // ---- ROW HYGIENE: a key that is not a task id can never be shown -------
  await boot('sydney');
  out.rows = await page.evaluate(() => {
    const a = window.__capy.hud.recordAudit();
    return { rows: a.rows, orphans: a.orphans };
  });

  // ================================================== 1 + 2. RIO =========
  await boot('rio');
  out.calcadao = await page.evaluate(() => {
    const g = window.__capy, R = g.rio, D = { };
    const walk = function () {
      window.__drv.place(-90, R.terrainHeight(-90, 16) + 0.6, 16);
      window.__drv.idle(90);
      window.__drv.run(-90, -1.2, 240);
      for (let k = 0; k < 9; k++) {
        window.__drv.run(92, -1.2, 900);
        if (g.capy.position.x > 89) break;
      }
      const x = g.capy.position.x;
      window.__drv.run(x, 16, 300);
      window.__drv.idle(45);
      return { rec: +window.__drv.rec('calcadao').toFixed(1),
               done: !!g.hud.isTaskDone('calcadao'), said: window.__drv.say() };
    };
    window.__drv.say();
    const first = walk();
    const second = walk();
    return { first: first, second: second };
  });

  out.arpoador = await page.evaluate(() => {
    const g = window.__capy, R = g.rio;
    const a = R.arpoadorRock;
    const visit = function () {
      // away, then up on the rock
      window.__drv.place(a.x + 40, R.terrainHeight(a.x + 40, a.z + 40) + 0.6, a.z + 40);
      window.__drv.idle(60);
      const clapBefore = R.clap();
      window.__drv.place(a.x, R.terrainHeight(a.x, a.z) + 0.8, a.z);
      window.__drv.idle(20);
      return { clap: +R.clap().toFixed(2),
               was: +clapBefore.toFixed(2), done: !!g.hud.isTaskDone('arpoador'),
               said: window.__drv.say() };
    };
    window.__drv.say();
    const first = visit();
    const second = visit();
    return { first: first, second: second };
  });

  // ================================================== 3. THE DRIFT =======
  await boot('drift');
  out.vane = await page.evaluate(() => {
    const g = window.__capy, Dr = g.drift;
    const v = { x: Dr.vane.x, z: Dr.vane.z, y: 30 };   // driVANE.y, a constant in drift.js
    const stand = function (secs) {
      window.__drv.place(v.x, v.y + 0.6, v.z);
      let watched = 0;
      for (let i = 0; i < secs * 60; i++) {
        window.__drv.idle(1);
        const w = Dr.vaneWatch();
        if (w > watched) watched = w;
      }
      return { watch: +watched.toFixed(1),
               live: +Dr.vaneWatch().toFixed(1),
               done: !!g.hud.isTaskDone('weathervane') };
    };
    // Away first, so the watch starts clean.
    window.__drv.place(v.x + 30, v.y + 0.6, v.z + 30); window.__drv.idle(30);
    const first = stand(42);
    window.__drv.place(v.x + 30, v.y + 0.6, v.z + 30); window.__drv.idle(60);
    const second = stand(20);
    return { first: first, second: second };
  });

  // ================================================== 4 + 5. VENICE =====
  await boot('venice');
  out.rialto = await page.evaluate(() => {
    const g = window.__capy, V = g.venice;
    const cross = function (s) {
      const r = V.rialto();
      const a = { x: r.x + r.ax * 17 * s, z: r.z + r.az * 17 * s };
      const b = { x: r.x - r.ax * 17 * s, z: r.z - r.az * 17 * s };
      window.__drv.place(a.x, r.y + 0.6, a.z);
      window.__drv.idle(40);
      window.__drv.run(b.x, b.z, 700);
      const rec = window.__drv.rec('rialto');
      window.__drv.run(b.x - r.ax * 30 * s, b.z - r.az * 30 * s, 300);
      window.__drv.idle(30);
      return { rec: rec === undefined ? -1 : +rec.toFixed(2),
               done: !!g.hud.isTaskDone('rialto'), said: window.__drv.say() };
    };
    window.__drv.say();
    const first = cross(1);
    const second = cross(-1);           // back the other way
    return { first: first, second: second };
  });

  out.calli = await page.evaluate(() => {
    const g = window.__capy;
    const X0 = -78, X1 = -30, Z0 = -56, Z1 = 4, Y = 1.30;
    const cross = function (i) {
      const zm = (Z0 + Z1) * 0.5;
      window.__drv.place(X0 - 6, Y + 0.8, zm);
      window.__drv.idle(60);
      for (let k = 0; k < 16; k++) {
        window.__drv.run(X1 + 2, zm + ((k % 5) - 2) * 9, 420);
        if (g.capy.position.x > X1 - 1) break;
      }
      window.__drv.run(X1 + 20, zm, 420);
      window.__drv.idle(60);
      const rec = window.__drv.rec('the-calli');
      return { rec: rec === undefined ? -1 : +rec.toFixed(1),
               done: !!g.hud.isTaskDone('the-calli'), said: window.__drv.say() };
    };
    window.__drv.say();
    const first = cross(0);
    const second = cross(1);
    return { first: first, second: second };
  });

  out.err = await page.evaluate(() => {
    const g = window.__capy; return g.state.lastError ? String(g.state.lastError) : null;
  });
  const bl = await page.evaluate(o =>
    btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=r7-rearm.json', { method: 'POST', body: s }), bl);
}
