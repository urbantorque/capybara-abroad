// THE ELEVEN HULLS, AFTER THEY BECAME HULLS.
//
// Three assertions. (1) each drawn instance has a body under it, within a
// tolerance far tighter than a hull is long — that is the test that catches a
// body which has drifted away from its own picture. (2) a swimmer put alongside
// one is stopped by it rather than passing through. (3) nothing else in Sydney
// moved: the body count is +11 and no more.
async page => {
  const out = {};
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(6500);
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  out.bodies = await page.evaluate(() => window.__capy.world.bodies.length);

  // (1) drawn instance versus body, sampled over four seconds of sailing
  out.register = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE, C = g.CANNON;
    let im = null; g.scene.traverse(o => { if (o.name === 'envTraffic') im = o; });
    if (!im) return { err: 'no envTraffic mesh' };
    const kin = g.world.bodies.filter(b => b.type === C.Body.KINEMATIC);
    const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
    let worst = 0, worstI = -1, n = 0;
    const t0 = performance.now();
    await new Promise(res => {
      const id = setInterval(() => {
        for (let i = 0; i < im.count; i++) {
          im.getMatrixAt(i, m); m.decompose(p, q, s);
          // the nearest kinematic body to this instance
          let best = 1e9;
          for (const b of kin) {
            const d = Math.hypot(b.position.x - p.x, b.position.z - p.z);
            if (d < best) best = d;
          }
          n++;
          if (best > worst) { worst = best; worstI = i; }
        }
        if (performance.now() - t0 > 4000) { clearInterval(id); res(); }
      }, 100);
    });
    return { samples: n, worstOffset: +worst.toFixed(3), worstInstance: worstI,
             kinematic: kin.length };
  });

  // (2) swim at one and be stopped
  out.bump = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE;
    let im = null; g.scene.traverse(o => { if (o.name === 'envTraffic') im = o; });
    const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
    // instance 7 sits at z -47.7, the nearest of the eleven to the shore
    im.getMatrixAt(7, m); m.decompose(p, q, s);
    g.capy.body.position.set(p.x, 0.3, p.z + 9);
    g.capy.body.velocity.set(0, 0, -3.0);          // straight at her
    g.capy.body.aabbNeedsUpdate = true;
    await new Promise(r => setTimeout(r, 2600));
    im.getMatrixAt(7, m); m.decompose(p, q, s);
    const c = g.capy.position;
    return { hull: [+p.x.toFixed(1), +p.z.toFixed(1)],
             capy: [+c.x.toFixed(1), +c.y.toFixed(2), +c.z.toFixed(1)],
             gap: +Math.hypot(c.x - p.x, c.z - p.z).toFixed(2),
             swim: !!g.capy.swimming, gnd: !!g.capy.grounded,
             ride: !!g.capy.rideBody };
  });
  await page.screenshot({ path: 'qa/px-syd-traf2.png' });
  out.err = await page.evaluate(() =>
    (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null);
  await page.evaluate(o => fetch('/shot?name=px-syd-traf2.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
