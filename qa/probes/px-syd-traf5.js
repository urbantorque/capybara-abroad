// CAN YOU RIDE ONE, AND DOES IT KEEP YOU IN THE WORLD?
//
// The hulls are solid and their decks sit 0.58 m over the waterline, which is
// climbable — the Quay moorings measured the same clamber at 0.42. So riding
// one is now a thing a player can do by accident, and the question is where it
// takes them. Put the animal on the deck of each ferry and of the widest-ranging
// sail, hold nothing, and watch for twenty-five seconds.
async page => {
  const out = { rides: [] };
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(6500);
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  for (const idx of [9, 10, 5]) {
    out.rides.push(await page.evaluate(async (i) => {
      const g = window.__capy, T = g.THREE;
      let im = null; g.scene.traverse(o => { if (o.name === 'envTraffic') im = o; });
      const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
      im.getMatrixAt(i, m); m.decompose(p, q, s);
      const c = g.capy.body;
      c.position.set(p.x, p.y + 1.1, p.z);
      c.velocity.set(0, 0, 0); c.angularVelocity.setZero();
      c.aabbNeedsUpdate = true;
      let onBoard = 0, outside = 0, n = 0, maxX = -999, minX = 999, ride = 0;
      const t0 = performance.now();
      await new Promise(res => {
        const id = setInterval(() => {
          im.getMatrixAt(i, m); m.decompose(p, q, s);
          const pos = g.capy.position;
          n++;
          if (Math.hypot(pos.x - p.x, pos.z - p.z) < 5 * s.x) onBoard++;
          if (Math.abs(pos.x) > 140 || pos.z < -150 || pos.z > -8) outside++;
          if (g.capy.rideBody) ride++;
          if (pos.x > maxX) maxX = pos.x;
          if (pos.x < minX) minX = pos.x;
          if (performance.now() - t0 > 25000) { clearInterval(id); res(); }
        }, 100);
      });
      const pos = g.capy.position;
      return { instance: i, scale: +s.x.toFixed(1), frames: n,
               onBoardFrames: onBoard, rideFrames: ride, outsideFrames: outside,
               xRange: [+minX.toFixed(1), +maxX.toFixed(1)],
               end: [+pos.x.toFixed(1), +pos.y.toFixed(2), +pos.z.toFixed(1)],
               swim: !!g.capy.swimming, gnd: !!g.capy.grounded };
    }, idx));
  }
  await page.screenshot({ path: 'qa/px-syd-traf5.png' });
  out.err = await page.evaluate(() =>
    (window.__capyErr && window.__capyErr.length) ? String(window.__capyErr[0]) : null);
  await page.evaluate(o => fetch('/shot?name=px-syd-traf5.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
