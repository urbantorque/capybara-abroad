async page => {
  const FROM = [36.5, 19.5], STAND = [32.9, 23.1];
  const ids = await page.evaluate(async () => (await fetch('/qa/all-task-ids.json')).json());
  // fin: 1 — the lawn is still laid (staging is not gated on it) but the closing
  // beat is spent, so the ledger will not open over the picture.
  await page.evaluate(o => {
    localStorage.clear();
    localStorage.setItem('capy3.journey.v1', JSON.stringify({
      v: 1, tasks: o.ids,
      seen: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19],
      recs: {}, ms: 3600000, chapms: {}, finds: [], foundAt: {},
      biome: 'sydney', fin: 1
    }));
  }, { ids: ids });
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));
  await page.keyboard.press('Digit1');
  await page.evaluate(() => new Promise(r => setTimeout(r, 4000)));

  const out = { legs: [] };

  // ---- AIMING THE LENS IS AIMING THE ANIMAL ------------------------------
  // `camYaw` is closure-local and Z/X only nudge `camYawTarget`, which the
  // idle tidy-up drags straight back behind the capybara's own heading — a
  // press-and-release loop measured no movement at all. So the shot is framed
  // the way the game frames every shot: point the animal, then press C.
  // Dropped in west of the mouth and walked east into it.
  await page.evaluate(f => {
    const g = window.__capy;
    g.capy.body.position.set(f[0], 1.2, f[1]);
    g.capy.body.velocity.set(0, 0, 0);
    g.capy.body.angularVelocity.set(0, 0, 0);
  }, FROM);
  await page.evaluate(() => new Promise(r => setTimeout(r, 1500)));

  const KEYS = ['KeyW', 'KeyS', 'KeyA', 'KeyD'];
  const held = {};
  const setKeys = async (want) => {
    for (const k of KEYS) {
      if (want[k] && !held[k]) { await page.keyboard.down(k); held[k] = 1; }
      else if (!want[k] && held[k]) { await page.keyboard.up(k); held[k] = 0; }
    }
  };
  const walkTo = async (tx, tz, budgetMs, near) => {
    const t0 = Date.now();
    let best = 1e9;
    while (Date.now() - t0 < budgetMs) {
      const st = await page.evaluate(([x, z]) => {
        const g = window.__capy, p = g.capy.position, y = g.input.camYaw;
        const wx = x - p.x, wz = z - p.z;
        const d = Math.hypot(wx, wz);
        const nx = d > 0.001 ? wx / d : 0, nz = d > 0.001 ? wz / d : 0;
        const c = Math.cos(y), s = Math.sin(y);
        return { d: d, ix: nx * c - nz * s, iz: nx * s + nz * c };
      }, [tx, tz]);
      if (st.d < best) best = st.d;
      if (st.d < (near || 1.2)) break;
      await setKeys({ KeyD: st.ix > 0.34, KeyA: st.ix < -0.34,
                      KeyS: st.iz > 0.34, KeyW: st.iz < -0.34 });
      await page.evaluate(() => new Promise(r => setTimeout(r, 110)));
    }
    await setKeys({});
    out.legs.push({ to: [tx, tz], closest: +best.toFixed(2) });
  };

  await walkTo(STAND[0], STAND[1], 22000, 1.0);
  // ...and the rig behind it, right now rather than after the idle timer.
  await page.keyboard.press('KeyC');

  // Settle, so the camera eases in and the animal loafs rather than standing.
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => new Promise(r => setTimeout(r, 900)));
    await page.evaluate(st => {
      const g = window.__capy, p = g.capy.position;
      const dx = p.x - st[0], dz = p.z - st[1];
      if (dx * dx + dz * dz > 1.5) {
        g.capy.body.position.set(st[0], 1.0, st[1]);
        g.capy.body.velocity.set(0, 0, 0);
      }
    }, STAND);
  }

  out.state = await page.evaluate(() => {
    const g = window.__capy, p = g.capy.position;
    return { x: +p.x.toFixed(2), z: +p.z.toFixed(2), camYaw: +g.input.camYaw.toFixed(3),
             loaf: +(g.capy.loaf || 0).toFixed(2), paused: !!g.state.paused,
             biome: g.biome.current, done: g.hud.tasksDone() };
  });
  // How many souvenirs are actually on the lawn and how far each sits from the
  // ring — the picture is the proof, this is the count behind it.
  out.ring = await page.evaluate(() => {
    const g = window.__capy;
    const src = (g.physics && g.physics.list && g.physics.list()) || g.props || [];
    const arr = [];
    for (let i = 0; i < src.length; i++) {
      const p = src[i];
      if (p && p.keep && !p.removed) {
        const dx = p.body.position.x - 30, dz = p.body.position.z - 26;
        arr.push({ keep: p.keep, r: +Math.hypot(dx, dz).toFixed(2),
                   y: +p.body.position.y.toFixed(2) });
      }
    }
    return { n: arr.length, list: arr };
  });
  out.err = await page.evaluate(() => {
    const g = window.__capy; return g.state.lastError ? String(g.state.lastError) : null;
  });
  const b = await page.evaluate(o =>
    btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=r2-horseshoe.json', { method: 'POST', body: s }), b);
}
