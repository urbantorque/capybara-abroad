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
    const b = g.capy.body, api = g.pasto;
    function clr() { g.input.x = 0; g.input.z = 0; g.input.run = false; g.input.action = false;
      g.input.actionPressed = false; g.input.honk = false; g.input.honkPressed = false;
      g.input.whistle = false; g.input.whistlePressed = false;
      g.input.jump = false; g.input.jumpPressed = false; }
    function park(x, y, z) {
      b.position.set(x, y, z); b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      clr(); for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
    }
    function hold(n) { for (let i = 0; i < n; i++) g.tick(1 / 60, false); }
    function voice() {   // exactly what systems.js writes for the one voice key
      g.input.honk = true; g.input.honkPressed = true;
      g.input.whistle = true; g.input.whistlePressed = true;
      g.tick(1 / 60, false);
      g.input.honkPressed = false; g.input.whistlePressed = false;
      hold(30); g.input.honk = false; g.input.whistle = false;
    }
    function useE() { g.input.action = true; g.input.actionPressed = true; g.tick(1 / 60, false);
      g.input.actionPressed = false; hold(90); g.input.action = false; }
    function drop() { if (g.capy.heldProp) { useE(); hold(40); } }
    function propOf(t) { for (const p of g.props) if (p && !p.removed && p.type === t &&
      (!p.biome || p.biome === 'pasto')) return p; return null; }

    // ---- steal-empanada / ruana-thief: stand ON the stall beside it -------
    for (const type of ['empanada', 'ruana']) {
      const p = propOf(type);
      let note = p ? '' : 'NO ' + type.toUpperCase() + ' PROP';
      if (p) {
        drop();
        const q = p.body.position;
        park(q.x, q.y + 0.9, q.z);          // land on whatever it is sitting on
        hold(60);
        const near = g.physics.nearestGrabbable(g.capy.position, 1.6);
        useE(); hold(60);
        note = 'prop=' + [+q.x.toFixed(1), +q.y.toFixed(2), +q.z.toFixed(1)] +
               ' capy=' + [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(2), +g.capy.position.z.toFixed(1)] +
               ' nearest=' + (near ? near.type : '-') +
               ' held=' + (g.capy.heldProp ? g.capy.heldProp.type : '-');
      }
      R.rows.push({ id: type === 'empanada' ? 'steal-empanada' : 'ruana-thief',
                    done: !!g.taskDone(type === 'empanada' ? 'steal-empanada' : 'ruana-thief'), note: note });
    }

    // ---- whistle-condor: the real voice key -------------------------------
    drop();
    park(0, api.terrainHeight(0, 10) + 0.6, 10);
    voice(); hold(120);
    R.rows.push({ id: 'whistle-condor', done: !!g.taskDone('whistle-condor'),
      note: 'state=' + (g.condor ? g.condor.state : '?') + ' active=' + !!(g.condor && g.condor.active) });
    // second whistle brings it down; then hold E under it
    for (let k = 0; k < 40 && !g.taskDone('condor-ride'); k++) {
      voice();
      for (let i = 0; i < 60; i++) {
        const c = g.condor && g.condor.group;
        if (c) {
          const p = c.position;
          const bb = g.capy.body;
          const h = api.terrainHeight(p.x, p.z);
          bb.position.set(p.x, (h === h ? h : 0) + 0.6, p.z);
          bb.velocity.set(0, 0, 0);
          bb.previousPosition.copy(bb.position); bb.interpolatedPosition.copy(bb.position);
        }
        g.input.action = true; g.input.actionPressed = (i % 8 === 0);
        g.tick(1 / 60, false);
        g.input.actionPressed = false;
      }
      clr();
    }
    R.rows.push({ id: 'condor-ride', done: !!g.taskDone('condor-ride'),
      note: 'state=' + (g.condor ? g.condor.state : '?') });

    // ---- carroza: ride the float -----------------------------------------
    {
      let n = 0;
      while (!api.carrozaParked() && n++ < 6000) g.tick(1 / 60, false);
      const c = api.carroza();
      park(c.x, c.y + 2.2, c.z);
      hold(60);
      const aboard = api.onCarroza();
      for (let i = 0; i < 60 * 45 && !g.taskDone('carroza'); i++) g.tick(1 / 60, false);
      R.rows.push({ id: 'carroza', done: !!g.taskDone('carroza'),
        note: 'mounted=' + aboard + ' aboardNow=' + api.onCarroza() +
              ' capyY=' + g.capy.position.y.toFixed(2) + ' floatY=' + api.carroza().y.toFixed(2) });
    }
    R.lastError = g.state.lastError || null;
    return R;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-t2b.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
