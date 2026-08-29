async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);

  const CH = ['venice', 'kowloon', 'palawan', 'goreme', 'manly'];
  const out = { rows: [] };

  for (const name of CH) {
    const row = await page.evaluate(async (n) => {
      const g = window.__capy;
      const r = { biome: n, ok: false, err: null, recSpam: {}, recMax: 0 };
      try {
        const sp = g.biome[n.toUpperCase() + '_SPAWN'];
        g.biome.switchTo(n);
        if (g.capy && g.capy.body && sp) {
          g.capy.body.position.set(sp.x, sp.y, sp.z);
          g.capy.body.velocity.set(0, 0, 0);
          if (g.capy.body.previousPosition) g.capy.body.previousPosition.copy(g.capy.body.position);
          if (g.capy.body.interpolatedPosition) g.capy.body.interpolatedPosition.copy(g.capy.body.position);
        }
        // wrap record: count consecutive frames on which the SAME id is handed
        // a strictly larger value. That is the toast-per-frame shape.
        const raw = g.record;
        const runs = {}, best = {};
        window.__recRuns = runs;
        g.record = function (id, v) {
          if (typeof v === 'number') {
            if (best[id] !== undefined && v > best[id]) { runs[id] = (runs[id] || 0) + 1; }
            if (best[id] === undefined || v > best[id]) best[id] = v;
          }
          return raw.call(g, id, v);
        };
        r.ok = true;
      } catch (e) { r.err = String(e && e.message || e); }
      return r;
    }, name);

    // random-input soak, real clock, real keys
    const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE', 'KeyQ'];
    for (let i = 0; i < 26; i++) {
      const k = KEYS[i % KEYS.length];
      await page.keyboard.down(k);
      await page.waitForTimeout(320);
      await page.keyboard.up(k);
      await page.waitForTimeout(120);
    }
    const after = await page.evaluate(() => {
      const g = window.__capy;
      const p = g.capy && g.capy.position;
      return {
        lastError: g.state && g.state.lastError ? String(g.state.lastError) : null,
        pos: p ? [Math.round(p.x), Math.round(p.y), Math.round(p.z)] : null,
        nan: p ? !(p.x === p.x && p.y === p.y && p.z === p.z) : true,
        biome: g.biome.current,
        recRuns: window.__recRuns || {},
      };
    });
    out.rows.push(Object.assign(row, after));
  }

  await page.evaluate((o) => {
    return fetch('/shot?name=bx-soak.json', {
      method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
