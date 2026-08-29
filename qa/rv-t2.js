async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const R = { rows: [] };
    g.biome.switchTo('pasto');
    for (let i = 0; i < 200; i++) g.tick(1 / 60, false);
    R.biome = g.biome.current;
    const b = g.capy.body, api = g.pasto;
    function clr() { g.input.x = 0; g.input.z = 0; g.input.run = false; g.input.action = false;
      g.input.actionPressed = false; g.input.honk = false; g.input.honkPressed = false;
      g.input.jump = false; g.input.jumpPressed = false; }
    function park(x, z, dy) {
      const h = api.terrainHeight(x, z);
      b.position.set(x, (h === h ? h : 0) + (dy === undefined ? 0.6 : dy), z);
      b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      clr(); for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
    }
    function drive(tx, tz, n, run, stop) {
      for (let i = 0; i < n; i++) {
        const p = g.capy.position;
        const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
        if (d < (stop === undefined ? 0.8 : stop)) { clr(); g.tick(1 / 60, false); continue; }
        const cy = g.input.camYaw || 0;
        g.input.x = (dx / d) * Math.cos(cy) + (dz / d) * (-Math.sin(cy));
        g.input.z = -((dx / d) * (-Math.sin(cy)) + (dz / d) * (-Math.cos(cy)));
        g.input.run = !!run;
        g.tick(1 / 60, false);
      }
      clr();
    }
    function hold(n) { for (let i = 0; i < n; i++) g.tick(1 / 60, false); }
    function wheek() { g.input.honk = true; g.input.honkPressed = true; g.tick(1 / 60, false);
      g.input.honkPressed = false; hold(40); g.input.honk = false; }
    function propOf(t, f) { for (const p of g.props) if (p && !p.removed && p.type === t &&
      (!p.biome || p.biome === 'pasto') && (!f || f(p))) return p; return null; }

    R.rows.push({ id: 'to-pasto', done: !!g.taskDone('to-pasto') });

    // ---- steal-empanada -------------------------------------------------
    {
      const p = propOf('empanada');
      let note = p ? '' : 'NO EMPANADA PROP';
      if (p) { const q = p.body.position;
        park(q.x + 2.2, q.z + 2.2);
        drive(q.x, q.z, 400, false, 0.55);
        g.input.action = true; g.input.actionPressed = true; g.tick(1 / 60, false);
        g.input.actionPressed = false; hold(120); g.input.action = false;
        note = 'held=' + (g.capy.heldProp ? g.capy.heldProp.type : '-') +
               ' d=' + Math.hypot(g.capy.position.x - q.x, g.capy.position.z - q.z).toFixed(2); }
      R.rows.push({ id: 'steal-empanada', done: !!g.taskDone('steal-empanada'), note: note });
    }

    // ---- market-chaos: run through a stall -------------------------------
    {
      const s = api.stalls && api.stalls[0];
      let note = s ? '' : 'NO STALLS';
      if (s) {
        for (const off of [[0, 6], [6, 0], [0, -6], [-6, 0]]) {
          if (g.taskDone('market-chaos')) break;
          if (g.capy.heldProp) { g.input.action = true; g.input.actionPressed = true; g.tick(1/60,false);
            g.input.actionPressed = false; g.input.action = false; hold(30); }
          park(s.x + off[0], s.z + off[1]);
          drive(s.x, s.z, 420, true, 0.15);
          hold(180);
        }
        note = 'stall=' + [s.x, s.z] + ' down=' + !!s.down + ' collapsed=' + !!s.collapsed;
      }
      R.rows.push({ id: 'market-chaos', done: !!g.taskDone('market-chaos'), note: note });
    }

    // ---- church-bell: run at the rope ------------------------------------
    {
      const rp = api.bell.ropePosition;
      for (let k = 0; k < 4 && !g.taskDone('church-bell'); k++) {
        const a = k * Math.PI / 2;
        park(rp.x + Math.cos(a) * 6, rp.z + Math.sin(a) * 6);
        drive(rp.x, rp.z, 400, true, 0.2);
        hold(240);
      }
      R.rows.push({ id: 'church-bell', done: !!g.taskDone('church-bell'),
        note: 'rope=' + [+rp.x.toFixed(1), +rp.y.toFixed(1), +rp.z.toFixed(1)] });
    }

    // ---- ruana-thief ----------------------------------------------------
    {
      const p = propOf('ruana');
      let note = p ? '' : 'NO RUANA PROP';
      if (p) { const q = p.body.position;
        if (g.capy.heldProp) { g.input.action = true; g.input.actionPressed = true; g.tick(1/60,false);
          g.input.actionPressed = false; g.input.action = false; hold(40); }
        park(q.x + 2.2, q.z + 2.2);
        drive(q.x, q.z, 400, false, 0.55);
        g.input.action = true; g.input.actionPressed = true; g.tick(1 / 60, false);
        g.input.actionPressed = false; hold(120); g.input.action = false;
        note = 'held=' + (g.capy.heldProp ? g.capy.heldProp.type : '-'); }
      R.rows.push({ id: 'ruana-thief', done: !!g.taskDone('ruana-thief'), note: note });
    }

    // ---- coffee-scatter --------------------------------------------------
    {
      const p = propOf('coffeesack');
      let note = p ? '' : 'NO COFFEESACK PROP';
      if (p) { const q = p.body.position;
        if (g.capy.heldProp) { g.input.action = true; g.input.actionPressed = true; g.tick(1/60,false);
          g.input.actionPressed = false; g.input.action = false; hold(40); }
        park(q.x + 2.0, q.z + 2.0);
        drive(q.x, q.z, 400, false, 0.55);
        g.input.action = true; g.input.actionPressed = true; g.tick(1 / 60, false);
        g.input.actionPressed = false; hold(90); g.input.action = false;
        const got = g.capy.heldProp && g.capy.heldProp.type === 'coffeesack';
        // throw it down hard: face down and press E again
        if (got) { g.input.action = true; g.input.actionPressed = true; g.tick(1 / 60, false);
          g.input.actionPressed = false; g.input.action = false; hold(200); }
        note = 'picked=' + !!got + ' burst=' + !!p.spilled; }
      R.rows.push({ id: 'coffee-scatter', done: !!g.taskDone('coffee-scatter'), note: note });
    }

    // ---- whistle-condor --------------------------------------------------
    {
      park(0, 10, 0.6);
      for (let k = 0; k < 6 && !g.taskDone('whistle-condor'); k++) { wheek(); hold(120); }
      R.rows.push({ id: 'whistle-condor', done: !!g.taskDone('whistle-condor'),
        note: 'condorState=' + (g.condor ? (g.condor.state || '') + ' active=' + !!g.condor.active : 'none') });
    }
    R.lastError = g.state.lastError || null;
    return R;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-t2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
