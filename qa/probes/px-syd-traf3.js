// ARE THE ELEVEN ACTUALLY SOLID, AND DOES A SWIMMER MEET ONE?
//
// px-syd-traf2 proved the bodies track their instances (worst offset 0 over 440
// samples) and could not prove solidity: it pushed the animal with a velocity
// write, and capybara.js owns the animal's velocity every frame, so the shove
// was gone before the next step. Two better tests.
//
// A. Ray the PHYSICS world at swimmer height straight through each instance. A
//    hull that is in the world stops the ray at about its own half-beam.
// B. Drive the animal at one with the KEYBOARD, which is the only way to move
//    it that the controller agrees with, and watch the gap close and stop.
async page => {
  const out = {};
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(6500);
  out.biome = await page.evaluate(() => window.__capy.biome.current);

  out.rays = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE, C = g.CANNON;
    let im = null; g.scene.traverse(o => { if (o.name === 'envTraffic') im = o; });
    const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
    const rows = [];
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, m); m.decompose(p, q, s);
      // across her beam, at the waterline, from 12 m out
      const y = -0.35;
      const res = new C.RaycastResult();
      g.world.raycastClosest(new C.Vec3(p.x + 12, y, p.z), new C.Vec3(p.x - 12, y, p.z),
                             { skipBackfaces: true }, res);
      rows.push({ i, at: [+p.x.toFixed(1), +p.z.toFixed(1)], scale: +s.x.toFixed(1),
                  hit: res.hasHit, standoff: res.hasHit ? +res.distance.toFixed(2) : null });
    }
    return rows;
  });

  // B. drive at one with the keys
  out.drive = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE;
    let im = null; g.scene.traverse(o => { if (o.name === 'envTraffic') im = o; });
    const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
    im.getMatrixAt(7, m); m.decompose(p, q, s);
    g.capy.body.position.set(p.x, 0.3, p.z + 11);
    g.capy.body.velocity.set(0, 0, 0);
    g.capy.body.aabbNeedsUpdate = true;
    await new Promise(r => setTimeout(r, 800));
    return { start: [+g.capy.position.x.toFixed(1), +g.capy.position.z.toFixed(1)] };
  });
  const best = { gap: 999, key: null, y: 0, ride: false };
  for (const key of ['KeyW', 'KeyS']) {
    await page.evaluate(async () => {
      const g = window.__capy, T = g.THREE;
      let im = null; g.scene.traverse(o => { if (o.name === 'envTraffic') im = o; });
      const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
      im.getMatrixAt(7, m); m.decompose(p, q, s);
      g.capy.body.position.set(p.x, 0.3, p.z + 11);
      g.capy.body.velocity.set(0, 0, 0);
      g.capy.body.aabbNeedsUpdate = true;
      window.__minGap = 999; window.__sawRide = false; window.__maxY = -9;
      if (window.__t) clearInterval(window.__t);
      window.__t = setInterval(() => {
        im.getMatrixAt(7, m); m.decompose(p, q, s);
        const c = g.capy.position;
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        if (d < window.__minGap) window.__minGap = d;
        if (c.y > window.__maxY) window.__maxY = c.y;
        if (g.capy.rideBody) window.__sawRide = true;
      }, 80);
    });
    await page.waitForTimeout(500);
    await page.keyboard.down(key);
    await page.waitForTimeout(7000);
    await page.keyboard.up(key);
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      clearInterval(window.__t);
      const c = window.__capy.capy;
      return { minGap: +window.__minGap.toFixed(2), maxY: +window.__maxY.toFixed(2),
               ride: !!window.__sawRide, y: +c.position.y.toFixed(2) };
    });
    if (r.minGap < best.gap) { best.gap = r.minGap; best.key = key; best.y = r.maxY; best.ride = r.ride; }
    out['leg_' + key] = r;
  }
  out.best = best;
  await page.screenshot({ path: 'qa/px-syd-traf3.png' });
  out.err = await page.evaluate(() =>
    (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null);
  await page.evaluate(o => fetch('/shot?name=px-syd-traf3.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
