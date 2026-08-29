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
    // who is actually WEARING a hat prop?
    const wearers = [];
    for (const r of g.npcs) {
      if (r && r.heldProp && r.heldProp.type === 'hat') {
        const p = r.group.position;
        wearers.push({ kind: r.kind, at: [+p.x.toFixed(1), +p.z.toFixed(1)],
                       grabbable: !!r.heldProp.grabbable, owner: !!r.heldProp.owner });
      }
    }
    R.hatWearers = wearers;
    let hats = 0, owned = 0, grab = 0;
    for (const p of g.props) if (p && p.type === 'hat' && !p.removed) {
      hats++; if (p.owner) owned++; if (p.grabbable) grab++;
    }
    R.hatProps = { hats, owned, grabbable: grab };
    // chase the first wearer and press E
    const target = g.npcs.find(r => r && r.heldProp && r.heldProp.type === 'hat');
    if (target) {
      const q = target.group.position;
      b.position.set(q.x + 1.5, 0.5, q.z + 1.5); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.input.x = 0; g.input.z = 0;
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
      const trace = [];
      for (let i = 0; i < 900; i++) {
        const p = g.capy.position;
        const t = target.group.position;
        const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
        const cy = g.input.camYaw || 0;
        if (d > 0.7) {
          g.input.x = (dx / d) * Math.cos(cy) + (dz / d) * (-Math.sin(cy));
          g.input.z = -((dx / d) * (-Math.sin(cy)) + (dz / d) * (-Math.cos(cy)));
          g.input.run = true;
        } else { g.input.x = 0; g.input.z = 0; g.input.run = false; }
        const near = g.physics.nearestGrabbable(g.capy.position, 1.6);
        if (i % 20 === 0) {
          g.input.action = true; g.input.actionPressed = true;
          trace.push({ i: i, d: +d.toFixed(2), near: near ? near.type : '-',
                       state: target.state, held: g.capy.heldProp ? g.capy.heldProp.type : '-' });
        }
        g.tick(1 / 60, false);
        g.input.actionPressed = false; g.input.action = false;
        if (g.taskDone('steal-hat')) break;
      }
      g.input.x = 0; g.input.z = 0; g.input.run = false;
      R.trace = trace.slice(0, 16);
      R.done = !!g.taskDone('steal-hat');
      R.held = g.capy.heldProp ? g.capy.heldProp.type : '-';
      R.targetState = target.state;
    }
    R.lastError = g.state.lastError || null;
    return R;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-hat.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
