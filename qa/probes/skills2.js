async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);
  const out = {};
  const ab = async (name, skill, fn) => {
    const off = await page.evaluate(fn, { skill: skill, force: false });
    await page.waitForTimeout(400);
    const on = await page.evaluate(fn, { skill: skill, force: true });
    out[name] = { off, on };
    await page.waitForTimeout(300);
  };

  // ---- THE LUNGS ---------------------------------------------------------
  await ab('lungs', 'lungs', async (Q) => {
    const g = window.__capy, c = g.capy;
    const TICK = () => { if (Q.force) c.learn(Q.skill, true); g.tick(1 / 60, false); };
    g.biome.switchTo('sydney');
    const sp = g.biome.spawnOf('sydney'), b = c.body;
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i = 0; i < 60; i++) TICK();
    const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
    const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
    down('KeyW'); down('ShiftLeft');
    let t = 0;
    for (let i = 0; i < 60 * 40 && !c.blown; i++) { TICK(); t += 1 / 60; }
    up('KeyW'); up('ShiftLeft');
    let r = 0;
    for (let i = 0; i < 60 * 40 && c.stamina < 0.99; i++) { TICK(); r += 1 / 60; }
    return { can: c.can('lungs'), runT: +t.toFixed(2), backT: +r.toFixed(2) };
  });

  // ---- THE SEED, again ---------------------------------------------------
  await ab('seed', 'seed', async (Q) => {
    const g = window.__capy, c = g.capy;
    const TICK = () => { if (Q.force) c.learn(Q.skill, true); g.tick(1 / 60, false); };
    g.biome.switchTo('sydney');
    const b = c.body;
    const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
    const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
    b.position.set(-30, 60, 0); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i = 0; i < 30; i++) TICK();
    const y0 = b.position.y, x0 = b.position.x, z0 = b.position.z;
    down('Space'); down('KeyW');
    for (let i = 0; i < 60 * 2.5; i++) TICK();
    const r = { can: c.can('seed'), fell: +(y0 - b.position.y).toFixed(2),
                across: +Math.hypot(b.position.x - x0, b.position.z - z0).toFixed(2),
                vy: +b.velocity.y.toFixed(2) };
    up('Space'); up('KeyW');
    return r;
  });

  // ---- ON THE TWO: hop distance, on the beat and off it ------------------
  await ab('beat', 'beat', async (Q) => {
    const g = window.__capy, c = g.capy;
    const TICK = () => { if (Q.force) c.learn(Q.skill, true); g.tick(1 / 60, false); };
    g.biome.switchTo('cali');
    await new Promise(r => setTimeout(r, 900));
    const sp = g.biome.spawnOf('cali'), b = c.body;
    const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
    const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
    let best = 0, apex = 0;
    for (let n = 0; n < 14; n++) {
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      for (let i = 0; i < 45; i++) TICK();
      const x0 = b.position.x, z0 = b.position.z, y0 = b.position.y;
      down('KeyW');
      for (let i = 0; i < 20; i++) TICK();
      down('Space');
      let hi = 0;
      for (let i = 0; i < 70; i++) {
        TICK();
        if (i === 2) up('Space');
        hi = Math.max(hi, b.position.y - y0);
      }
      up('KeyW');
      const d = Math.hypot(b.position.x - x0, b.position.z - z0);
      if (d > best) { best = d; apex = hi; }
    }
    return { can: c.can('beat'), playing: !!(g.music && g.music.playing),
             bestHop: +best.toFixed(2), apexAtBest: +apex.toFixed(2) };
  });

  // ---- THE VAULT: can a wall be kicked off --------------------------------
  await ab('vault', 'vault', async (Q) => {
    const g = window.__capy, c = g.capy;
    const TICK = () => { if (Q.force) c.learn(Q.skill, true); g.tick(1 / 60, false); };
    g.biome.switchTo('kowloon');
    await new Promise(r => setTimeout(r, 1200));
    const sp = g.biome.spawnOf('kowloon'), b = c.body;
    const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
    const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
    // walk into a wall, hop, then hop again at the top of the arc
    let bestY = -99, holds = 0;
    for (let n = 0; n < 10; n++) {
      const a = (n / 10) * Math.PI * 2;
      b.position.set(sp.x + Math.sin(a) * 5, sp.y + 0.4, sp.z + Math.cos(a) * 5);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      for (let i = 0; i < 40; i++) TICK();
      const y0 = b.position.y;
      if (c.climbAt(b.position.x, b.position.y, b.position.z, a)) holds++;
      down('KeyW');
      for (let i = 0; i < 30; i++) TICK();
      down('Space');
      for (let i = 0; i < 4; i++) TICK();
      up('Space');
      for (let i = 0; i < 14; i++) TICK();
      down('Space');                       // the kick
      for (let i = 0; i < 4; i++) TICK();
      up('Space');
      let hi = 0;
      for (let i = 0; i < 60; i++) { TICK(); hi = Math.max(hi, b.position.y - y0); }
      up('KeyW');
      bestY = Math.max(bestY, hi);
    }
    return { can: c.can('vault'), holdsFound: holds, bestRise: +bestY.toFixed(2) };
  });

  await page.evaluate(async (o) => {
    await fetch('/shot?name=skills2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
