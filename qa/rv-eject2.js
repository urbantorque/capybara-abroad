async page => {
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2000);
  const out = await page.evaluate(() => {
    const g = window.__capy, CANNON = g.CANNON, THREE = g.THREE;
    const R = { frames: [] };
    g.biome.switchTo('sydney');
    for (let i = 0; i < 150; i++) g.tick(1 / 60, false);
    const b = g.capy.body;
    let fl = null;
    for (const p of g.props) if (p && p.type === 'flower' && p.planted) { fl = p; break; }
    const q = { x: fl.body.position.x, z: fl.body.position.z };
    R.flower = [+q.x.toFixed(2), +q.z.toFixed(2)];
    b.position.set(q.x + 2.6, 0.6, q.z + 2.6); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
    let spike = null;
    for (let i = 0; i < 420; i++) {
      const p = g.capy.position;
      const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
      const cy = g.input.camYaw || 0;
      const fx = -Math.sin(cy), fz = -Math.cos(cy);
      const rx = Math.cos(cy), rz = -Math.sin(cy);
      const ux = dx / (d || 1), uz = dz / (d || 1);
      if (d > 0.45) { g.input.x = ux * rx + uz * rz; g.input.z = -(ux * fx + uz * fz); }
      else { g.input.x = 0; g.input.z = 0; }
      const px = p.x, py = p.y, pz = p.z;
      g.tick(1 / 60, false);
      const v = Math.hypot(b.velocity.x, b.velocity.y, b.velocity.z);
      R.frames.push({ i: i, at: [+px.toFixed(2), +py.toFixed(2), +pz.toFixed(2)], v: +v.toFixed(1) });
      if (v > 12 && !spike) {
        spike = { i: i, at: [px, py, pz], v: v,
                  vel: [+b.velocity.x.toFixed(1), +b.velocity.y.toFixed(1), +b.velocity.z.toFixed(1)] };
        // every SHAPE within 2 m of where the capybara was standing
        const hits = [];
        const wp = new CANNON.Vec3(), wq = new CANNON.Quaternion();
        for (const bd of g.world.bodies) {
          if (bd === b) continue;
          for (let s = 0; s < bd.shapes.length; s++) {
            const sh = bd.shapes[s], off = bd.shapeOffsets[s], ori = bd.shapeOrientations[s];
            bd.quaternion.vmult(off, wp); wp.vadd(bd.position, wp);
            const dd = Math.hypot(wp.x - px, wp.z - pz);
            if (dd > 2.4) continue;
            hits.push({ body: bd.id, mass: bd.mass, type: bd.type, si: s,
                        kind: sh.constructor.name,
                        he: sh.halfExtents ? [+sh.halfExtents.x.toFixed(2), +sh.halfExtents.y.toFixed(2), +sh.halfExtents.z.toFixed(2)] : (sh.radius || null),
                        at: [+wp.x.toFixed(2), +wp.y.toFixed(2), +wp.z.toFixed(2)],
                        d: +dd.toFixed(2) });
          }
        }
        hits.sort((a, c) => a.d - c.d);
        spike.shapes = hits.slice(0, 12);
      }
    }
    g.input.x = 0; g.input.z = 0;
    R.spike = spike;
    R.frames = R.frames.filter(f => !spike || Math.abs(f.i - spike.i) < 8);
    R.end = [+g.capy.position.x.toFixed(2), +g.capy.position.z.toFixed(2)];
    return R;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-eject2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
