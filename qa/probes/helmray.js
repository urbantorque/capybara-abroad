async page => {
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(6000);
  await page.evaluate(() => {
    const g = window.__capy;
    const h = g.quay.boat.helm;
    g.capy.body.position.set(h.x, h.y + 0.4, h.z);
    g.capy.body.velocity.set(0, 0, 0);
  });
  await page.waitForTimeout(600);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(800);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(6000);

  const out = await page.evaluate(() => {
    const g = window.__capy;
    const CANNON = g.CANNON || null;
    const w = g.world;
    const cam = g.camera;
    const p = g.capy.body.position;
    // Rebuild the rig's own desired point: anchor = capy + 1.0, 21 m at 27 deg
    // on the bearing the camera is actually on.
    const dx = cam.position.x - p.x, dz = cam.position.z - p.z;
    const yaw = Math.atan2(dx, dz);
    const pitch = 27 * Math.PI / 180;
    const cp = Math.cos(pitch), sn = Math.sin(pitch);
    const ax = p.x, ay = p.y + 1.0, az = p.z;
    const D = 21;
    const bx = ax + Math.sin(yaw) * cp * D;
    const by = ay + sn * D;
    const bz = az + Math.cos(yaw) * cp * D;

    const from = new w.bodies[0].position.constructor(ax, ay, az);
    const to = new w.bodies[0].position.constructor(bx, by, bz);
    const len = Math.hypot(bx - ax, by - ay, bz - az);
    const hits = [];
    // index bodies so a hit can be named
    const boatPos = g.quay.boat.position;
    w.raycastAll(from, to, { skipBackfaces: false }, res => {
      if (!res.hasHit) return;
      const b = res.body;
      const idx = w.bodies.indexOf(b);
      hits.push({
        idx,
        mass: b.mass,
        type: b.type,
        isTrigger: !!b.isTrigger,
        shapes: b.shapes.length,
        shapeType: res.shape && res.shape.type,
        dist: +res.distance.toFixed(2),
        f: +(res.distance / len).toFixed(3),
        bodyPos: [+b.position.x.toFixed(1), +b.position.y.toFixed(1), +b.position.z.toFixed(1)],
        isBoat: Math.hypot(b.position.x - boatPos.x, b.position.z - boatPos.z) < 1.5 && b.type === 4,
      });
    });
    hits.sort((a, b2) => a.dist - b2.dist);
    return {
      biome: g.biome.current,
      speed: +g.quay.boat.speed.toFixed(2),
      capy: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
      boat: [+boatPos.x.toFixed(2), +boatPos.y.toFixed(2), +boatPos.z.toFixed(2)],
      yawDeg: +(yaw * 180 / Math.PI).toFixed(1),
      headingDeg: +(g.quay.boat.heading * 180 / Math.PI).toFixed(1),
      len: +len.toFixed(2),
      KINEMATIC: 4,
      hits: hits.slice(0, 12),
    };
  });
  await page.keyboard.up('KeyW');
  await page.evaluate(o => fetch('/shot?name=helmray.json', {
    method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
