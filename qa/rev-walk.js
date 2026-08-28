async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);

  const src = await (await page.request.get('http://localhost:5188/src/shared.js')).text();
  const chapters = [];
  const re = /\{\s*n:\s*(\d+),\s*biome:\s*'([a-z]+)'/g;
  let m;
  while ((m = re.exec(src))) chapters.push(m[2]);

  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);
  const started = await page.evaluate(() => !!window.__capy.state.started);
  const out = { started: started, rows: [] };

  for (let ci = 0; ci < chapters.length; ci++) {
    const name = chapters[ci];
    let row;
    try {
      row = await page.evaluate(async (arg) => {
        const g = window.__capy;
        const nm = arg.name;
        if (g.biome.current !== nm) g.biome.switchTo(nm);
        for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
        const api = (nm === 'sydney') ? g.env : g[nm];
        const sp = g.biome.spawnOf(nm);
        const th = (api && typeof api.terrainHeight === 'function')
          ? (x, z) => { const v = api.terrainHeight(x, z); return (typeof v === 'number' && v === v) ? v : 0; }
          : () => 0;
        const r = { biome: nm, live: g.biome.current, spawn: [sp.x, sp.z], bearings: [] };

        const held = {};
        function key(code, down) {
          if (!!held[code] === down) return;
          held[code] = down;
          window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup',
            { code: code, key: code, bubbles: true }));
        }
        function allUp() { for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft']) key(k, false); }

        const NB = 8;
        for (let bi = 0; bi < NB; bi++) {
          const a = bi * Math.PI * 2 / NB;
          const ux = Math.cos(a), uz = Math.sin(a);
          // put it on the spawn
          const body = g.capy.body;
          body.position.set(sp.x, (sp.y || 1) + 0.4, sp.z);
          body.velocity.set(0, 0, 0);
          body.previousPosition.copy(body.position);
          body.interpolatedPosition.copy(body.position);
          g.capy.carriedBy = null;
          allUp();
          for (let i = 0; i < 20; i++) g.tick(1 / 60, false);

          let maxR = 0, rescued = -1, stuckAt = -1, lastR = 0, stall = 0;
          const T = 1500;                       // 25 s of walking
          for (let t = 0; t < T; t++) {
            // closed loop: movement is camera-relative and camYaw drifts, so
            // the WASD set has to be recomputed against the LIVE yaw.
            if (t % 6 === 0) {
              const cy = g.input.camYaw || 0;
              // world dir -> camera-relative stick
              const sx = ux * Math.cos(-cy) - uz * Math.sin(-cy);
              const sz = ux * Math.sin(-cy) + uz * Math.cos(-cy);
              key('KeyD', sx > 0.35); key('KeyA', sx < -0.35);
              key('KeyS', sz > 0.35); key('KeyW', sz < -0.35);
              key('ShiftLeft', true);
            }
            g.tick(1 / 60, false);
            const dx = body.position.x - sp.x, dz = body.position.z - sp.z;
            const R = Math.hypot(dx, dz);
            if (R > maxR) maxR = R;
            // a rescue is a big BACKWARD jump
            if (rescued < 0 && lastR - R > 12) { rescued = Math.round(lastR); }
            // stopped making progress for 3 s while still pushing = a wall
            if (R - lastR < 0.004) stall++; else stall = 0;
            if (stuckAt < 0 && stall > 180) stuckAt = Math.round(R);
            lastR = R;
          }
          allUp();
          r.bearings.push({
            deg: Math.round(a * 180 / Math.PI),
            maxR: Math.round(maxR),
            endR: Math.round(lastR),
            rescued: rescued,
            wallAt: stuckAt,
            endY: Math.round(body.position.y * 10) / 10,
            endGY: Math.round(th(body.position.x, body.position.z) * 10) / 10,
          });
        }
        allUp();
        const body = g.capy.body;
        body.position.set(sp.x, (sp.y || 1) + 0.4, sp.z);
        body.velocity.set(0, 0, 0);
        return r;
      }, { name: name });
    } catch (e) {
      row = { biome: name, error: String(e).slice(0, 250) };
    }
    out.rows.push(row);
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=rev-walk.json', {
      method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
