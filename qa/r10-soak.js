async page => {
  // ======================================================================
  // R10 — THE SHIPPING SOAK. Nineteen chapters, clean profile.
  //
  // Not on a deployed address, because there is not one: no host has been
  // chosen and deploying is not a call this run gets to make. On localhost the
  // only thing the soak cannot see is the host's own compression and TLS,
  // neither of which the game touches — the vendored libraries mean there is
  // no third-party host involved in starting it at all.
  //
  // Per chapter: enter it, drive for nine seconds of real time, sample every
  // frame. What is being watched for is the class of thing a soak is FOR —
  // a NaN position, a solver save, a console error, a task ticking on arrival
  // — rather than a frame rate, which rAF pins to the display and which says
  // nothing (see CONTRACT.md, THE AUDIT).
  // ======================================================================
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);

  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);

  const boot = await page.evaluate(() => {
    const g = window.__capy;
    return { running: !!window.__capyRunning, failed: !!window.__capyFailed,
             soft: window.__capySoftGL || null,
             save: (function () { try { return localStorage.getItem('capy3.journey.v1'); }
                                  catch (e) { return 'ERR'; } })() };
  });

  await page.keyboard.press('Digit1');
  await wait(5000);

  await page.evaluate(() => {
    const g = window.__capy;
    window.__soak = { errs: [], rows: [] };
    // A random-ish drive, so the chapter is exercised rather than stood in.
    const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE', 'KeyQ', 'ShiftLeft'];
    let s = 20260902 >>> 0;
    const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
    const held = new Set();
    window.__drive = null;
    window.__go = function () {
      window.__drive = setInterval(function () {
        if (rnd() < 0.11) {
          const k = KEYS[(rnd() * KEYS.length) | 0];
          const ev = held.has(k) ? 'keyup' : 'keydown';
          if (held.has(k)) held.delete(k); else held.add(k);
          window.dispatchEvent(new KeyboardEvent(ev, { code: k, bubbles: true }));
        }
      }, 16);
    };
    window.__stop = function () {
      clearInterval(window.__drive);
      for (const k of held) window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
      held.clear();
    };
  });

  const ALL = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara',
               'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal',
               'cave', 'antarctic', 'monaco', 'hanoi'];
  const rows = [];
  for (let i = 0; i < ALL.length; i++) {
    await page.evaluate(function (name) {
      const g = window.__capy;
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name), b = g.capy.body;
      if (sp) { b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0); }
      window.__w = { nan: 0, solver: 0, minY: 1e9, maxY: -1e9, frames: 0, tasks0: -1 };
      window.__w.tasks0 = g.hud.tasksDone();
      window.__go();
      return true;
    }, ALL[i]);
    await wait(2000);
    await page.evaluate(function () {
      const g = window.__capy;
      const w = window.__w;
      window.__samp = setInterval(function () {
        const p = g.capy && g.capy.position;
        if (!p) return;
        w.frames++;
        if (!(p.x === p.x && p.y === p.y && p.z === p.z)) w.nan++;
        if (p.y < w.minY) w.minY = p.y;
        if (p.y > w.maxY) w.maxY = p.y;
        // under the floor by more than a body is the shape the rescue exists for
        if (g.state && g.state.solverSaves) w.solver = g.state.solverSaves;
      }, 16);
      return true;
    });
    await wait(9000);
    rows.push(await page.evaluate(function (name) {
      const g = window.__capy;
      clearInterval(window.__samp);
      window.__stop();
      const w = window.__w;
      return { n: name, biome: g.biome.current, frames: w.frames, nan: w.nan,
               minY: +w.minY.toFixed(1), maxY: +w.maxY.toFixed(1),
               tasks: g.hud.tasksDone() - w.tasks0,
               bodies: g.world ? g.world.bodies.length : -1,
               props: g.props ? g.props.length : -1,
               npcs: g.npcs ? g.npcs.length : -1,
               err: g.state.lastError ? String(g.state.lastError) : null };
    }, ALL[i]));
  }

  const out = { boot: boot, rows: rows };
  out.after = await page.evaluate(() => {
    const g = window.__capy;
    return { biome: g.biome.current, time: +g.state.time.toFixed(1),
             done: g.hud.tasksDone(),
             err: g.state.lastError ? String(g.state.lastError) : null,
             records: Object.keys(g.hud.recordAudit().best).length,
             orphans: g.hud.recordAudit().orphans };
  });
  const bl = await page.evaluate(o =>
    btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=r10-soak.json', { method: 'POST', body: s }), bl);
}
