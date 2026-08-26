async page => {
  // Monte Carlo's climb shot came back a flat brown rectangle. Is that the
  // ANIMAL inside the building, or the EYE inside it with the animal fine?
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);
  const spot = await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('monaco');
    const list = g.world.bodies.filter(b => {
      if (!b || b.mass > 0 || b.isTrigger) return false;
      if (b.type !== undefined && b.type !== g.CANNON.Body.STATIC) return false;
      if (!b.aabb || !isFinite(b.aabb.upperBound.y)) return false;
      const a = b.aabb, h = a.upperBound.y - a.lowerBound.y;
      return h > 4 && h < 60 && (a.upperBound.x - a.lowerBound.x) < 120 &&
                                (a.upperBound.z - a.lowerBound.z) < 120;
    });
    list.sort((p, q) => (q.aabb.upperBound.y - q.aabb.lowerBound.y) -
                        (p.aabb.upperBound.y - p.aabb.lowerBound.y));
    for (const b of list.slice(0, 40)) {
      const a = b.aabb, y = a.lowerBound.y + 0.55;
      const mx = (a.lowerBound.x + a.upperBound.x) / 2, mz = (a.lowerBound.z + a.upperBound.z) / 2;
      const tries = [[mx, a.lowerBound.z - 0.8, 0], [mx, a.upperBound.z + 0.8, Math.PI],
                     [a.lowerBound.x - 0.8, mz, Math.PI / 2], [a.upperBound.x + 0.8, mz, -Math.PI / 2]];
      for (const t of tries) {
        const h = g.capy.climbAt(t[0], y, t[1], t[2]);
        if (h && h.top - y > 4.0) {
          return { x: t[0], y: y, z: t[1], yaw: t[2], top: h.top,
                   aabb: [a.lowerBound.x, a.lowerBound.y, a.lowerBound.z,
                          a.upperBound.x, a.upperBound.y, a.upperBound.z],
                   shapes: b.shapes.length };
        }
      }
    }
    return null;
  });
  const y0 = await page.evaluate((o) => {
    const g = window.__capy, b = g.capy.body;
    b.position.set(o.x, o.y + 0.1, o.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    g.capy.face(o.yaw);
    return g.capy.position.y;
  }, spot);
  await page.keyboard.press('KeyC');
  await page.waitForTimeout(1500);
  await page.keyboard.down('KeyE');
  await page.waitForTimeout(400);
  await page.keyboard.down('KeyW');
  const trace = [];
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(500);
    trace.push(await page.evaluate(() => {
      const g = window.__capy, c = g.camera, p = g.capy.position;
      return { cl: g.capy.climbing, y: +p.y.toFixed(2), x: +p.x.toFixed(1), z: +p.z.toFixed(1),
               cam: [+c.position.x.toFixed(1), +c.position.y.toFixed(1), +c.position.z.toFixed(1)],
               boom: +Math.hypot(c.position.x - p.x, c.position.y - p.y, c.position.z - p.z).toFixed(2),
               clear: +(g.camInfo.clear).toFixed(2) };
    }));
  }
  await page.keyboard.up('KeyW');
  await page.keyboard.up('KeyE');
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b5-mon.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, { spot: spot, y0: y0, trace: trace });
}
