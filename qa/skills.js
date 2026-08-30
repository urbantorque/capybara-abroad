async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);

  const out = {};

  // ---- 0. the registry, and that a restore does not announce ---------------
  out.registry = await page.evaluate(() => {
    const g = window.__capy, c = g.capy;
    const IDS = ['lungs', 'quiet', 'beat', 'carve', 'vault', 'seed', 'mantle', 'float', 'flow'];
    const before = IDS.map(i => c.can(i));
    c.learn('no-such-skill', true);
    return { before, unknownAdded: c.can('no-such-skill'), err: g.state.lastError || null };
  });

  // A/B every measurement: run it with the skill off, then tick the task that
  // grants it and run exactly the same thing again. A single green number
  // proves nothing — see the differential note in the harness memo.
  const ab = async (name, biome, task, fn) => {
    const off = await page.evaluate(fn, { biome, arm: false });
    await page.waitForTimeout(400);
    await page.evaluate((t) => { window.__capy.completeTask(t, true); }, task);
    await page.waitForTimeout(700);
    const on = await page.evaluate(fn, { biome, arm: true });
    out[name] = { off, on };
    await page.waitForTimeout(300);
  };

  // ---- 1. THE LUNGS: seconds of running before blown ----------------------
  await ab('lungs', 'sydney', 'the-rim-walk', async (q) => {
    const g = window.__capy, c = g.capy;
    g.biome.switchTo('sydney');
    const sp = g.biome.spawnOf('sydney');
    const b = c.body;
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
    const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
    const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
    down('KeyW'); down('ShiftLeft');
    let t = 0;
    for (let i = 0; i < 60 * 40 && !c.blown; i++) { g.tick(1 / 60, false); t += 1 / 60; }
    const runT = +t.toFixed(2);
    up('KeyW'); up('ShiftLeft');
    // ...and how long to come back
    let r = 0;
    for (let i = 0; i < 60 * 40 && c.stamina < 0.99; i++) { g.tick(1 / 60, false); r += 1 / 60; }
    return { can: c.can('lungs'), runT, backT: +r.toFixed(2) };
  });

  // ---- 2. THE SEED: metres fallen in two seconds, and metres travelled ----
  await ab('seed', 'sydney', 'driftseed', async (q) => {
    const g = window.__capy, c = g.capy;
    g.biome.switchTo('sydney');
    const b = c.body;
    const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
    const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
    b.position.set(-30, 60, 0); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
    const y0 = b.position.y, x0 = b.position.x, z0 = b.position.z;
    down('Space'); down('KeyW');
    for (let i = 0; i < 60 * 2.5; i++) g.tick(1 / 60, false);
    const r = { can: c.can('seed'), drifting: !!c.drifting,
                fell: +(y0 - b.position.y).toFixed(2),
                across: +Math.hypot(b.position.x - x0, b.position.z - z0).toFixed(2),
                vy: +b.velocity.y.toFixed(2) };
    up('Space'); up('KeyW');
    return r;
  });

  // ---- 3. THE FLOW: the flag, and what it takes to break it --------------
  await ab('flow', 'sydney', 'cross-the-road', async (q) => {
    const g = window.__capy, c = g.capy;
    g.biome.switchTo('sydney');
    const sp = g.biome.spawnOf('sydney');
    const b = c.body;
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
    const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
    for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
    down('KeyW');
    let held = 0;
    for (let i = 0; i < 60 * 3; i++) { g.tick(1 / 60, false); if (c.committed) held++; }
    const straight = held;
    // now waver, and it must shut
    let wob = 0;
    for (let i = 0; i < 60 * 3; i++) {
      if (i % 12 === 0) { up('KeyA'); up('KeyD'); down(i % 24 === 0 ? 'KeyA' : 'KeyD'); }
      g.tick(1 / 60, false);
      if (c.committed) wob++;
    }
    up('KeyW'); up('KeyA'); up('KeyD');
    return { can: c.can('flow'), straightFrames: straight, wobbleFrames: wob };
  });

  // ---- 4. THE FLOAT: does the loaf come on in water -----------------------
  await ab('float', 'sydney', 'the-crossing', async (q) => {
    const g = window.__capy, c = g.capy;
    g.biome.switchTo('sydney');
    const b = c.body;
    b.position.set(-20, 1.2, -30); b.velocity.set(0, 0, 0);   // the harbour
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i = 0; i < 60 * 14; i++) g.tick(1 / 60, false);
    return { can: c.can('float'), swimming: !!c.swimming,
             loaf: +c.loaf.toFixed(3), restT: +c.restT.toFixed(2) };
  });

  await page.evaluate(async (o) => {
    await fetch('/shot?name=skills.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
