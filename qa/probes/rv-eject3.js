async page => {
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const R = {};
    g.biome.switchTo('sydney');
    for (let i = 0; i < 150; i++) g.tick(1 / 60, false);
    const b = g.capy.body;
    let fl = null;
    for (const p of g.props) if (p && p.type === 'flower' && p.planted) { fl = p; break; }
    const q = { x: fl.body.position.x, z: fl.body.position.z };
    R.flower = [+q.x.toFixed(2), +q.z.toFixed(2)];
    const bed = (g.env.flowerBeds || []).find(o => q.x > o.x0 && q.x < o.x1 && q.z > o.z0 && q.z < o.z1) || null;
    R.bed = bed;

    function park(x, z) {
      b.position.set(x, 0.5, z); b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.input.x = 0; g.input.z = 0; g.input.run = false;
      const vs = [];
      for (let i = 0; i < 180; i++) {
        g.tick(1 / 60, false);
        vs.push(+Math.hypot(b.velocity.x, b.velocity.y, b.velocity.z).toFixed(1));
      }
      return { at: [+g.capy.position.x.toFixed(2), +g.capy.position.y.toFixed(2), +g.capy.position.z.toFixed(2)],
               maxV: Math.max(...vs), tail: vs.slice(-20) };
    }
    R.onBedCentre = park(q.x, q.z);
    R.onBedEdge = park(q.x, bed ? bed.z1 + 0.02 : q.z + 1);
    R.offBed = park(q.x, bed ? bed.z1 + 3.0 : q.z + 4);
    R.lawn = park(0, 30);
    // and with the flower prop taken out of the world
    fl.body.position.set(500, 0, 500);
    fl.body.previousPosition.copy(fl.body.position);
    fl.body.interpolatedPosition.copy(fl.body.position);
    R.onBedEdgeNoFlower = park(q.x, bed ? bed.z1 + 0.02 : q.z + 1);
    return R;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-eject3.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
