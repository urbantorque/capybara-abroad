async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const R = {};
    g.biome.switchTo('sydney');
    for (let i = 0; i < 200; i++) g.tick(1 / 60, false);
    const b = g.capy.body;
    function clr() { g.input.x = 0; g.input.z = 0; g.input.run = false;
      g.input.action = false; g.input.actionPressed = false; }
    function toward(tx, tz, run) {
      const p = g.capy.position;
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz) || 1;
      const cy = g.input.camYaw || 0;
      g.input.x = (dx / d) * Math.cos(cy) + (dz / d) * (-Math.sin(cy));
      g.input.z = -((dx / d) * (-Math.sin(cy)) + (dz / d) * (-Math.cos(cy)));
      g.input.run = !!run;
      return d;
    }
    const target = g.npcs.find(r => r && r.heldProp && r.heldProp.type === 'hat' && r.kind !== 'busker');
    const hat = target.heldProp;
    const q = target.group.position;
    // ---- BARGE: run flat out into them, which is what a player does --------
    b.position.set(q.x + 9, 0.5, q.z + 9); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    clr(); for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
    for (let i = 0; i < 420; i++) { toward(target.group.position.x, target.group.position.z, true); g.tick(1 / 60, false);
      if (!hat.owner) break; }
    clr(); for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
    R.afterBarge = { owner: !!hat.owner, stolenFrom: !!hat.stolenFrom, wasStolen: !!hat.wasStolen,
                     stealHat: !!g.taskDone('steal-hat'),
                     hatAt: [+hat.body.position.x.toFixed(1), +hat.body.position.z.toFixed(1)] };
    // ---- then pick the loose hat up ---------------------------------------
    for (let i = 0; i < 600 && !g.capy.heldProp; i++) {
      const hp = hat.body.position;
      const d = toward(hp.x, hp.z, false);
      if (d < 1.0) { g.input.x = 0; g.input.z = 0; g.input.action = true; g.input.actionPressed = (i % 12 === 0); }
      g.tick(1 / 60, false);
      g.input.actionPressed = false;
    }
    clr(); for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
    R.afterGrab = { held: g.capy.heldProp ? g.capy.heldProp.type : '-',
                    wasStolen: !!hat.wasStolen, stealHat: !!g.taskDone('steal-hat'),
                    npcState: target.state };
    // ---- and carry it into the harbour ------------------------------------
    for (let i = 0; i < 60 * 30 && !g.taskDone('hat-harbour'); i++) {
      toward(-10, -22, true); g.tick(1 / 60, false);
      if (g.capy.position.z < -20) break;
    }
    clr(); for (let i = 0; i < 300; i++) g.tick(1 / 60, false);
    R.afterSwim = { hatHarbour: !!g.taskDone('hat-harbour'),
                    at: [+g.capy.position.x.toFixed(1), +g.capy.position.z.toFixed(1)],
                    hatAt: [+hat.body.position.x.toFixed(1), +hat.body.position.y.toFixed(2), +hat.body.position.z.toFixed(1)],
                    inWater: !!hat.inWater, wasStolen: !!hat.wasStolen };
    R.lastError = g.state.lastError || null;
    return R;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-hat3.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
