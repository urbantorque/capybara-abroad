async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const R = { rows: [] };
    g.biome.switchTo('sydney');
    for (let i = 0; i < 150; i++) g.tick(1 / 60, false);
    const b = g.capy.body, api = g.env;
    function clr() { g.input.x = 0; g.input.z = 0; g.input.run = false; g.input.action = false;
      g.input.actionPressed = false; g.input.honk = false; g.input.honkPressed = false;
      g.input.jump = false; g.input.jumpPressed = false; }
    function park(x, z, y) {
      b.position.set(x, y === undefined ? 0.5 : y, z); b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
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

    // ---- wheek (the real key is honk) -----------------------------------
    park(0, 20);
    g.input.honk = true; g.input.honkPressed = true; g.tick(1 / 60, false);
    g.input.honkPressed = false; hold(60); g.input.honk = false;
    R.rows.push({ id: 'wheek', done: !!g.taskDone('wheek') });

    // ---- dig-flower: get within 1.5 m, STOP, then hold E -----------------
    {
      let fl = null;
      for (const p of g.props) if (p && p.type === 'flower' && p.planted) { fl = p; break; }
      const q = { x: fl.body.position.x, z: fl.body.position.z };
      // approach from four sides; whichever gets closest is where we dig
      let best = null;
      for (const off of [[0, 3], [0, -3], [3, 0], [-3, 0]]) {
        park(q.x + off[0], q.z + off[1]);
        drive(q.x, q.z, 240, false, 0.9);
        clr(); hold(40);
        const d = Math.hypot(g.capy.position.x - q.x, g.capy.position.z - q.z);
        if (!best || d < best.d) best = { d: d, off: off,
          at: [+g.capy.position.x.toFixed(2), +g.capy.position.z.toFixed(2)] };
      }
      park(best.at[0], best.at[1]);
      for (let i = 0; i < 420; i++) { g.input.action = true; g.tick(1 / 60, false); }
      clr(); hold(60);
      R.rows.push({ id: 'dig-flower', done: !!g.taskDone('dig-flower'),
        note: 'flower=' + [+q.x.toFixed(1), +q.z.toFixed(1)] + ' closest=' + best.d.toFixed(2) +
              ' from=' + best.off + ' planted=' + !!fl.planted });
    }

    // ---- bin-chicken: charge a bin from four sides -----------------------
    {
      let bin = null, note = '';
      for (const p of g.props) if (p && p.type === 'bin' && !p.tipped &&
        p.body.position.y < 1.0) { bin = p; break; }
      if (!bin) for (const p of g.props) if (p && p.type === 'bin') { bin = p; break; }
      const q = { x: bin.body.position.x, z: bin.body.position.z, y: bin.body.position.y };
      for (const off of [[0, 7], [7, 0], [0, -7], [-7, 0]]) {
        if (g.taskDone('bin-chicken')) break;
        park(q.x + off[0], q.z + off[1], q.y + 0.2);
        drive(q.x, q.z, 420, true, 0.15);
        hold(180);
      }
      note = 'bin=' + [+q.x.toFixed(1), +q.y.toFixed(2), +q.z.toFixed(1)] +
             ' tipped=' + !!bin.tipped + ' now=' + [+bin.body.position.x.toFixed(1), +bin.body.position.y.toFixed(2), +bin.body.position.z.toFixed(1)];
      R.rows.push({ id: 'bin-chicken', done: !!g.taskDone('bin-chicken'), note: note });
    }
    R.lastError = g.state.lastError || null;
    return R;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-t1b.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
