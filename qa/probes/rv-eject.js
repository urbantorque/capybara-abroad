async page => {
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const out = await page.evaluate(() => {
    const g = window.__capy, CANNON = g.CANNON;
    const R = { events: [] };
    g.biome.switchTo('sydney');
    for (let i = 0; i < 150; i++) g.tick(1 / 60, false);
    const b = g.capy.body;
    let fl = null;
    for (const p of g.props) if (p && p.type === 'flower' && p.planted) { fl = p; break; }
    const q = { x: fl.body.position.x, z: fl.body.position.z };
    R.flower = [+q.x.toFixed(2), +q.z.toFixed(2)];
    // Which bed is it in?
    R.bed = (g.env.flowerBeds || []).find(o => q.x > o.x0 - 0.5 && q.x < o.x1 + 0.5 && q.z > o.z0 - 0.5 && q.z < o.z1 + 0.5) || null;
    // Every static/kinematic body whose AABB is within 3 m of the flower
    const near = [];
    for (const bd of g.world.bodies) {
      if (bd === b) continue;
      if (bd.aabbNeedsUpdate) bd.updateAABB();
      const a = bd.aabb;
      const dx = Math.max(a.lowerBound.x - q.x, 0, q.x - a.upperBound.x);
      const dz = Math.max(a.lowerBound.z - q.z, 0, q.z - a.upperBound.z);
      const d = Math.hypot(dx, dz);
      if (d < 3) near.push({ id: bd.id, mass: bd.mass, type: bd.type, d: +d.toFixed(2),
        shapes: bd.shapes.length, kind: bd.shapes[0] ? bd.shapes[0].constructor.name : '?',
        lo: [+a.lowerBound.x.toFixed(2), +a.lowerBound.y.toFixed(2), +a.lowerBound.z.toFixed(2)],
        hi: [+a.upperBound.x.toFixed(2), +a.upperBound.y.toFixed(2), +a.upperBound.z.toFixed(2)] });
    }
    near.sort((p1, p2) => p1.d - p2.d);
    R.near = near.slice(0, 14);
    // walk in and log the biggest speed spike
    b.position.set(q.x + 2.6, 0.6, q.z + 2.6); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
    let maxV = 0, at = null, prev = null;
    for (let i = 0; i < 420; i++) {
      const p = g.capy.position;
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      const cy = g.input.camYaw || 0;
      const fx = -Math.sin(cy), fz = -Math.cos(cy);
      const rx = Math.cos(cy), rz = -Math.sin(cy);
      const ux = dx / (d || 1), uz = dz / (d || 1);
      if (d > 0.45) { g.input.x = ux * rx + uz * rz; g.input.z = -(ux * fx + uz * fz); }
      else { g.input.x = 0; g.input.z = 0; }
      const before = [p.x, p.y, p.z];
      g.tick(1 / 60, false);
      const v = Math.hypot(b.velocity.x, b.velocity.y, b.velocity.z);
      if (v > maxV) { maxV = v; at = [+before[0].toFixed(2), +before[1].toFixed(2), +before[2].toFixed(2)];
                      prev = { i: i, v: +v.toFixed(1) }; }
    }
    g.input.x = 0; g.input.z = 0;
    R.maxV = +maxV.toFixed(1); R.spikeAt = at; R.spike = prev;
    R.end = [+g.capy.position.x.toFixed(2), +g.capy.position.z.toFixed(2)];
    R.solverSaves = g.state.solverSaves || 0;
    return R;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-eject.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
