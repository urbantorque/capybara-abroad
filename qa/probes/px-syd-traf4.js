// WHAT A MOVING HULL DOES TO THE ANIMAL IT MEETS.
//
// Making a thing solid is only half the change; the other half is what happens
// when it arrives. A kinematic body that runs into a swimmer can shove it, and
// a shove that ends with the animal out of the world, under the seabed, or
// stuck inside the hull is worse than swimming through the boat was.
//
// Two cases, both deliberately unkind: the animal placed exactly INSIDE a hull
// (the worst the solver can ever be asked to resolve), and the animal parked in
// the path of one and left there to be run down.
async page => {
  const out = {};
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(6500);
  out.biome = await page.evaluate(() => window.__capy.biome.current);

  const watch = (idx, place) => page.evaluate(async (a) => {
    const g = window.__capy, T = g.THREE;
    let im = null; g.scene.traverse(o => { if (o.name === 'envTraffic') im = o; });
    const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
    im.getMatrixAt(a.idx, m); m.decompose(p, q, s);
    const c = g.capy.body;
    c.position.set(p.x + a.dx, a.y, p.z + a.dz);
    c.velocity.set(0, 0, 0);
    c.angularVelocity.setZero();
    c.aabbNeedsUpdate = true;
    let maxSpd = 0, minY = 99, maxY = -99, outside = 0, n = 0;
    const t0 = performance.now();
    await new Promise(res => {
      const id = setInterval(() => {
        const v = g.capy.velocity, pos = g.capy.position;
        const sp = Math.hypot(v.x, v.y, v.z);
        if (sp > maxSpd) maxSpd = sp;
        if (pos.y < minY) minY = pos.y;
        if (pos.y > maxY) maxY = pos.y;
        // is it still inside the harbour rectangle the chapter publishes?
        if (Math.abs(pos.x) > 140 || pos.z < -150 || pos.z > -8) outside++;
        n++;
        if (performance.now() - t0 > a.ms) { clearInterval(id); res(); }
      }, 50);
    });
    im.getMatrixAt(a.idx, m); m.decompose(p, q, s);
    const pos = g.capy.position;
    return { maxSpeed: +maxSpd.toFixed(2), minY: +minY.toFixed(2), maxY: +maxY.toFixed(2),
             outsideFrames: outside, frames: n,
             endGap: +Math.hypot(pos.x - p.x, pos.z - p.z).toFixed(2),
             end: [+pos.x.toFixed(1), +pos.y.toFixed(2), +pos.z.toFixed(1)],
             swim: !!g.capy.swimming, stuck: +(g.capy.stuckT || 0).toFixed(2) };
  }, { idx, ...place });

  // 1. placed exactly inside a sail's hull
  out.inside = await watch(7, { dx: 0, dz: 0, y: -0.3, ms: 4000 });
  // 2. placed inside a FERRY's hull, which is 2.1x the size and the fastest
  out.insideFerry = await watch(9, { dx: 0, dz: 0, y: -0.3, ms: 4000 });
  // 3. parked on the line a ferry is sailing down, and left there
  out.runDown = await watch(10, { dx: 0, dz: 26, y: -0.3, ms: 12000 });
  await page.screenshot({ path: 'qa/px-syd-traf4.png' });
  out.err = await page.evaluate(() =>
    (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null);
  await page.evaluate(o => fetch('/shot?name=px-syd-traf4.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
