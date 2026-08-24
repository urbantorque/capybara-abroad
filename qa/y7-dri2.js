async page => {
  await page.reload(); await page.waitForTimeout(5600);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const res = { settles: [], walls: 0, wallSamples: 0 };
    const hold=(x,y,z)=>{const b=g.capy.body;b.position.set(x,y,z);b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);};
    g.biome.switchTo('drift');
    for (let i=0;i<300;i++) g.tick(1/60,false);
    const D = g.drift;
    const pts = [D.shelf, D.orchard, D.arch, D.crown, D.jetty, D.column, D.column2];
    for (const p of pts) {
      if (!p) { res.settles.push(null); continue; }
      const ty = D.terrainHeight(p.x, p.z);
      hold(p.x, ty + 3, p.z);
      for (let i=0;i<150;i++) g.tick(1/60,false);
      res.settles.push([+g.capy.position.y.toFixed(2), +ty.toFixed(2),
                        +(g.capy.position.y - ty).toFixed(2), !!g.capy.grounded]);
    }
    // walls: sample a grid over the walled islands and count solid hits
    const CANNON = g.CANNON;
    let solid = 0, n = 0;
    for (const b of g.world.bodies) {
      if (b.mass !== 0) continue;
      n += b.shapes.length;
    }
    res.shapes = n;
    res.bodies = g.world.bodies.length;
    res.err = g.state.lastError || null;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=y7dri2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
