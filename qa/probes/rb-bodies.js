async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html');
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const out = {};
  for (const n of ['sydney', 'cali', 'rio', 'iceland', 'sahara', 'drift']) {
    out[n] = await page.evaluate(async (name) => {
      const g = window.__capy;
      g.biome.switchTo(name);
      for (let i = 0; i < 200; i++) g.tick(1 / 60, false);
      let stat = 0, kine = 0, dyn = 0, shapes = 0;
      for (const b of g.world.bodies) {
        shapes += b.shapes.length;
        if (b.type === 2) kine++;
        else if (b.mass > 0) dyn++;
        else stat++;
      }
      return { total: g.world.bodies.length, stat: stat, kine: kine, dyn: dyn,
               shapes: shapes, props: g.props.length, npcs: g.npcs.length,
               tris: g.renderer.info.render.triangles, calls: g.renderer.info.render.calls };
    }, n);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-bodies.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
