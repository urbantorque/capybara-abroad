async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const R = { trace: [] };
    g.biome.switchTo('sydney');
    for (let i = 0; i < 200; i++) g.tick(1 / 60, false);
    const b = g.capy.body;
    const target = g.npcs.find(r => r && r.heldProp && r.heldProp.type === 'hat' && r.kind !== 'busker');
    const hat = target.heldProp;
    // ease up to them at a WALK and press E once, the way the clue says
    const q = target.group.position;
    b.position.set(q.x + 2.2, 0.5, q.z + 2.2); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    g.input.x = 0; g.input.z = 0; g.input.run = false;
    for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
    let pressed = false;
    for (let i = 0; i < 600; i++) {
      const p = g.capy.position, t = target.group.position;
      const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
      const cy = g.input.camYaw || 0;
      if (d > 1.0) {
        g.input.x = (dx / d) * Math.cos(cy) + (dz / d) * (-Math.sin(cy));
        g.input.z = -((dx / d) * (-Math.sin(cy)) + (dz / d) * (-Math.cos(cy)));
        g.input.run = false;                      // a WALK. never a barge.
      } else { g.input.x = 0; g.input.z = 0; }
      // one press, the first time we are inside grab range and it is still theirs
      if (!pressed && d < 1.4) {
        pressed = true;
        g.input.action = true; g.input.actionPressed = true;
        R.atPress = { i: i, d: +d.toFixed(2), owner: !!hat.owner, heldByNpc: target.heldProp === hat,
                      state: target.state, wasStolen: !!hat.wasStolen };
      }
      g.tick(1 / 60, false);
      g.input.actionPressed = false; g.input.action = false;
      if (i % 30 === 0 || (pressed && i < 100)) {
        if (R.trace.length < 24) R.trace.push({ i: i, d: +d.toFixed(2),
          owner: !!hat.owner, stolenFrom: !!hat.stolenFrom, wasStolen: !!hat.wasStolen,
          held: g.capy.heldProp === hat, npcState: target.state,
          done: !!g.taskDone('steal-hat') });
      }
      if (g.taskDone('steal-hat')) break;
    }
    g.input.x = 0; g.input.z = 0;
    R.done = !!g.taskDone('steal-hat');
    R.hat = { owner: !!hat.owner, stolenFrom: !!hat.stolenFrom, wasStolen: !!hat.wasStolen,
              held: !!hat.held, grabbable: !!hat.grabbable };
    R.capyHolds = g.capy.heldProp ? g.capy.heldProp.type : '-';
    R.npcState = target.state;
    R.lastError = g.state.lastError || null;
    return R;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-hat2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
