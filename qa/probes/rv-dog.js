async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('sydney');
    for (let i = 0; i < 200; i++) g.tick(1 / 60, false);
    const b = g.capy.body, d = g.quay.dog;
    const R = { onLeadStart: g.quay.onLead() };
    for (let i = 0; i < 60 * 40 && !g.taskDone('dog-loose'); i++) {
      const p = g.capy.position, q = d.position;
      const dx = q.x - p.x, dz = q.z - p.z, dd = Math.hypot(dx, dz) || 1;
      const cy = g.input.camYaw || 0;
      if (dd > 0.9) {
        g.input.x = (dx / dd) * Math.cos(cy) + (dz / dd) * (-Math.sin(cy));
        g.input.z = -((dx / dd) * (-Math.sin(cy)) + (dz / dd) * (-Math.cos(cy)));
        g.input.run = false;
      } else { g.input.x = 0; g.input.z = 0; }
      g.input.action = true; g.input.actionPressed = (i % 15 === 0);
      g.tick(1 / 60, false);
      g.input.actionPressed = false;
    }
    g.input.x = 0; g.input.z = 0; g.input.action = false;
    R.done = !!g.taskDone('dog-loose');
    R.onLeadEnd = g.quay.onLead();
    R.dogAt = [+d.position.x.toFixed(1), +d.position.z.toFixed(1)];
    R.capyAt = [+g.capy.position.x.toFixed(1), +g.capy.position.z.toFixed(1)];
    return R;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-dog.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
