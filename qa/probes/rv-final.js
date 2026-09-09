async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const step = (body) => page.evaluate(new Function(`
    const g = window.__capy;
    const b = g.capy.body;
    function clr() { g.input.x = 0; g.input.z = 0; g.input.run = false; g.input.action = false;
      g.input.actionPressed = false; g.input.honk = false; g.input.honkPressed = false;
      g.input.whistle = false; g.input.whistlePressed = false;
      g.input.jump = false; g.input.jumpPressed = false; }
    function hold(n) { for (let i = 0; i < n; i++) g.tick(1/60, false); }
    function useE() { g.input.action = true; g.input.actionPressed = true; g.tick(1/60,false);
      g.input.actionPressed = false; g.input.action = false; hold(20); }
    function toward(tx, tz, run) {
      const p = g.capy.position;
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz) || 1;
      const cy = g.input.camYaw || 0;
      g.input.x = (dx/d) * Math.cos(cy) + (dz/d) * (-Math.sin(cy));
      g.input.z = -((dx/d) * (-Math.sin(cy)) + (dz/d) * (-Math.cos(cy)));
      g.input.run = !!run;
      return d;
    }
    ` + body));
  const R = {};

  // ---- FIX 1: the café tables, and the task that needed them -------------
  R.cafe = await step(`
    g.biome.switchTo('sydney'); hold(200);
    const drawn = g.env.cafeTables.map(t => [t.x, t.z]);
    const pat = g.npcs.filter(r => r && r.kind === 'patron')
      .map(r => ({ table: [+r.tableX.toFixed(1), +r.tableZ.toFixed(1)],
                   offDrawn: +Math.min.apply(null, drawn.map(d => Math.hypot(d[0] - r.tableX, d[1] - r.tableZ))).toFixed(2) }));
    const t = g.env.cafeTables[0];
    b.position.set(t.x, t.top + 0.36, t.z); b.velocity.set(0,0,0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    clr(); hold(420);
    return { patrons: pat, maxOff: Math.max.apply(null, pat.map(p => p.offDrawn)),
             done: !!g.taskDone('cafe-table') };`);

  // ---- FIX 2: the drying patio -------------------------------------------
  R.patio = await step(`
    g.biome.switchTo('pasto'); hold(260);
    const P = g.pasto.coffeePatio;
    const f = g.npcs.filter(r => r && r.kind === 'farmer').map(r => {
      const p = r.group.position;
      return { at: [+p.x.toFixed(1), +p.z.toFixed(1)],
               onPatio: Math.abs(p.x - P.x) < P.w / 2 && Math.abs(p.z - P.z) < P.d / 2 };
    });
    return { patio: [P.x, P.z, P.w, P.d], farmers: f, anyOnPatio: f.some(r => r.onPatio) };`);

  // ---- FIX 3: barge the hat off, pick it up, drop it in the harbour -------
  R.hat = await step(`
    g.biome.switchTo('sydney'); hold(200);
    const t = g.npcs.find(r => r && r.heldProp && r.heldProp.type === 'hat' && r.kind !== 'busker');
    const hat = t.heldProp, q = t.group.position;
    b.position.set(q.x + 9, 0.5, q.z + 9); b.velocity.set(0,0,0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    clr(); hold(40);
    for (let i = 0; i < 420 && hat.owner; i++) { toward(t.group.position.x, t.group.position.z, true); g.tick(1/60,false); }
    clr(); hold(40);
    const barged = { owner: !!hat.owner, stolenFrom: !!hat.stolenFrom, wasStolen: !!hat.wasStolen };
    for (let i = 0; i < 600 && !g.capy.heldProp; i++) {
      const hp = hat.body.position;
      const d = toward(hp.x, hp.z, false);
      if (d < 1.0) { g.input.x = 0; g.input.z = 0; g.input.action = true; g.input.actionPressed = (i % 12 === 0); }
      g.tick(1/60, false); g.input.actionPressed = false;
    }
    clr(); hold(60);
    const grabbed = { held: g.capy.heldProp ? g.capy.heldProp.type : '-',
                      wasStolen: !!hat.wasStolen, stealHat: !!g.taskDone('steal-hat') };
    for (let i = 0; i < 60 * 25; i++) { toward(-10, -24, true); g.tick(1/60,false);
      if (g.capy.position.z < -14) break; }
    clr(); hold(30); useE(); hold(300);
    return { barged: barged, grabbed: grabbed,
             hatHarbour: !!g.taskDone('hat-harbour'), inWater: !!hat.inWater };`);

  // ---- FIX 4: the manly-pine beacon now lands on the counter -------------
  R.chips = await step(`
    g.biome.switchTo('quay'); hold(200);
    const c = g.quay.chips;
    return { published: !!c, at: c ? [c.x, +c.y.toFixed(2), c.z] : null,
             oldLiteral: [118, -586],
             offOld: c ? +Math.hypot(c.x - 118, c.z + 586).toFixed(2) : null };`);
  R.chipsRun = await step(`
    const c = g.quay.chips;
    const gy = (x, z) => { const h = g.quay.terrainHeight(x, z); return h === h ? h : 0; };
    b.position.set(c.x, gy(c.x, c.z) + 0.8, c.z + 8); b.velocity.set(0,0,0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    clr(); hold(60);
    for (let i = 0; i < 900 && !g.taskDone('manly-pine'); i++) {
      const d = toward(c.x, c.z, true);
      if (d < 0.6) clr();
      g.tick(1/60, false);
    }
    clr(); hold(120);
    return { done: !!g.taskDone('manly-pine'),
             at: [+g.capy.position.x.toFixed(1), +g.capy.position.z.toFixed(1)] };`);

  // ---- FIX 5: the Freshwater answers from where she is --------------------
  R.horn = await step(`
    const probe = g.hud.audioProbe;
    const f = g.quay.freshwater();
    const near = probe(f.x, -0.5 + 6, f.z);
    return { freshwaterAt: [+f.x.toFixed(0), +f.z.toFixed(0)],
             gainFromHer: +near.gain.toFixed(3), pan: +near.pan.toFixed(2) };`);

  R.tail = await step(`return { lastError: g.state.lastError || null, biome: g.biome.current };`);
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-final.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, R);
}
