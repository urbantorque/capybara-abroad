// SYDNEY'S HARBOUR TRAFFIC: NINE SAILS AND TWO FERRIES, AND A COMMENT THAT
// SAYS YOU CANNOT REACH THEM.
//
// envBuildTraffic's own note: "all of them beyond z = -46 so they are scenery
// and nothing else: no colliders, no wakes to write, no way for the player to
// reach them". The second half of that is a reachability claim and this tests
// it. envBOUNDS publishes the harbour as x +/-140, z -150..-8, with its own
// comment saying "the seabed body under it is wider still, so swimming to the
// far shore stays legal" — so on the chapter's own published statement of where
// a player may go, every one of the eleven is inside it.
//
// Swim north for forty seconds and log how far it gets, and how close it comes
// to the nearest hull. The hulls are read out of the InstancedMesh the chapter
// draws them with, so this measures the boats that are actually in the picture.
async page => {
  const out = {};
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Digit1');            // 1 = sydney
  await page.waitForTimeout(6500);
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  out.bounds = await page.evaluate(() => {
    const a = window.__capy.env;
    return typeof a.bounds === 'function' ? a.bounds() : null;
  });
  out.fleet = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE;
    let im = null;
    g.scene.traverse(o => { if (o.name === 'envTraffic') im = o; });
    if (!im) return null;
    const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
    const rows = [];
    for (let i = 0; i < im.count; i++) {
      im.getMatrixAt(i, m); m.decompose(p, q, s);
      rows.push({ i, x: +p.x.toFixed(1), z: +p.z.toFixed(1), y: +p.y.toFixed(2),
                  scale: +s.x.toFixed(2) });
    }
    return rows;
  });

  // Put the animal in the water at the north edge of the swimmable harbour and
  // ask whether it is legal to be there, then swim north from the sea wall.
  out.deep = await page.evaluate(async () => {
    const g = window.__capy;
    g.capy.body.position.set(0, 0.3, -140);
    g.capy.body.velocity.set(0, 0, 0);
    g.capy.body.aabbNeedsUpdate = true;
    await new Promise(r => setTimeout(r, 2500));
    const p = g.capy.position;
    return { at: [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)],
             swim: !!g.capy.swimming, stuckT: +(g.capy.stuckT || 0).toFixed(2) };
  });

  // ...and the honest version: start at the sea wall and swim.
  await page.evaluate(() => {
    const g = window.__capy;
    g.capy.body.position.set(0, 0.3, -14);
    g.capy.body.velocity.set(0, 0, 0);
    g.capy.body.aabbNeedsUpdate = true;
    window.__minZ = 99; window.__near = 999;
    let im = null; g.scene.traverse(o => { if (o.name === 'envTraffic') im = o; });
    window.__im = im;
    if (window.__t) clearInterval(window.__t);
    window.__t = setInterval(() => {
      const T = g.THREE, p = g.capy.position;
      if (p.z < window.__minZ) window.__minZ = p.z;
      if (!im) return;
      const m = new T.Matrix4(), v = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
      for (let i = 0; i < im.count; i++) {
        im.getMatrixAt(i, m); m.decompose(v, q, s);
        const d = Math.hypot(v.x - p.x, v.z - p.z);
        if (d < window.__near) window.__near = d;
      }
    }, 100);
  });
  await page.waitForTimeout(400);
  for (const key of ['KeyW', 'KeyS']) {
    await page.keyboard.down(key);
    await page.waitForTimeout(20000);
    await page.keyboard.up(key);
    out['leg_' + key] = await page.evaluate(() => {
      const p = window.__capy.capy.position;
      return { at: [+p.x.toFixed(1), +p.z.toFixed(1)], minZ: +window.__minZ.toFixed(1),
               nearest: +window.__near.toFixed(1) };
    });
  }
  await page.screenshot({ path: 'qa/px-syd-traf.png' });
  out.err = await page.evaluate(() => {
    clearInterval(window.__t);
    return (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null;
  });
  await page.evaluate(o => fetch('/shot?name=px-syd-traf.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
