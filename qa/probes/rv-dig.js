async page => {
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const R = { trace: [] };
    g.biome.switchTo('sydney');
    for (let i = 0; i < 150; i++) g.tick(1 / 60, false);
    const b = g.capy.body;
    let fl = null;
    for (const p of g.props) if (p && p.type === 'flower' && p.planted) { fl = p; break; }
    const q = { x: fl.body.position.x, z: fl.body.position.z };
    R.flower = [q.x, q.z];
    b.position.set(q.x + 2.0, 0.6, q.z + 2.0); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    g.input.x = 0; g.input.z = 0; g.input.run = false; g.input.action = false;
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
    R.afterPut = [+g.capy.position.x.toFixed(2), +g.capy.position.y.toFixed(2), +g.capy.position.z.toFixed(2)];
    for (let i = 0; i < 300; i++) {
      const p = g.capy.position;
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      const cy = g.input.camYaw || 0;
      const fx = -Math.sin(cy), fz = -Math.cos(cy);
      const rx = Math.cos(cy), rz = -Math.sin(cy);
      const ux = dx / (d || 1), uz = dz / (d || 1);
      if (d > 0.5) { g.input.x = ux * rx + uz * rz; g.input.z = -(ux * fx + uz * fz); }
      else { g.input.x = 0; g.input.z = 0; }
      g.tick(1 / 60, false);
      if (i % 30 === 0) R.trace.push({ i: i, d: +d.toFixed(2), camYaw: +cy.toFixed(2),
        p: [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)],
        stick: [+g.input.x.toFixed(2), +g.input.z.toFixed(2)] });
    }
    g.input.x = 0; g.input.z = 0;
    R.beforeDig = [+g.capy.position.x.toFixed(2), +g.capy.position.z.toFixed(2)];
    R.dist = +Math.hypot(g.capy.position.x - q.x, g.capy.position.z - q.z).toFixed(2);
    // now hold E
    for (let i = 0; i < 420; i++) { g.input.action = true; g.tick(1 / 60, false); }
    g.input.action = false;
    R.digDone = !!g.taskDone('dig-flower');
    R.plantedAfter = !!fl.planted;
    R.digging = !!g.capy.digging;
    R.held = !!(g.capy.heldProp);
    return R;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-dig.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
