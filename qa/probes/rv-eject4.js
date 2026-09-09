async page => {
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const R = { runs: [] };
    g.biome.switchTo('sydney');
    for (let i = 0; i < 150; i++) g.tick(1 / 60, false);
    const b = g.capy.body, c = g.capy;
    function park(tag, x, z) {
      b.position.set(x, 0.5, z); b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.input.x = 0; g.input.z = 0; g.input.run = false;
      const rows = [];
      for (let i = 0; i < 180; i++) {
        g.tick(1 / 60, false);
        if (i % 12 === 0 || i === 179) rows.push({ i: i,
          p: [+c.position.x.toFixed(2), +c.position.y.toFixed(2), +c.position.z.toFixed(2)],
          v: +Math.hypot(b.velocity.x, b.velocity.y, b.velocity.z).toFixed(1),
          g: !!c.grounded, cl: !!c.climbing, cb: c.carriedBy ? (c.carriedBy.type || c.carriedBy.kind || 'yes') : '',
          sw: !!c.swimming, held: c.heldProp ? c.heldProp.type : '' });
      }
      R.runs.push({ tag: tag, from: [x, z], rows: rows });
    }
    let fl = null;
    for (const p of g.props) if (p && p.type === 'flower' && p.planted) { fl = p; break; }
    const q = { x: fl.body.position.x, z: fl.body.position.z };
    R.flower = [+q.x.toFixed(2), +q.z.toFixed(2)];
    const bed = (g.env.flowerBeds || []).find(o => q.x > o.x0 && q.x < o.x1 && q.z > o.z0 && q.z < o.z1) || null;
    R.bed = bed ? [bed.x0, bed.x1, bed.z0, bed.z1, bed.prize] : null;
    park('bedCentre', q.x, q.z);
    park('bedEdge', q.x, bed ? bed.z1 + 0.02 : q.z + 1);
    park('offBed', q.x, bed ? bed.z1 + 3.0 : q.z + 4);
    return R;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-eject4.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
