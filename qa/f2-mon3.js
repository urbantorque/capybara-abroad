async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(3500);
  await page.evaluate(() => {
    const g = window.__capy;
    try { g.hud.cross('monaco'); } catch (e) { g.biome.switchTo('monaco'); }
    return true;
  });
  await wait(9000);
  await page.evaluate(() => {
    const g = window.__capy, T = g.THREE;
    const R = window.__mon = {};
    let mesh = null;
    g.scene.traverse(o => { if (o.isInstancedMesh && o.count === 46 && o.visible) mesh = o; });
    R.mesh = mesh;
    R.cars = g.world.bodies.filter(b => b.mass === 0 && b.shapes && b.shapes.length === 5);
    const M = new T.Matrix4(), P = new T.Vector3(), Q = new T.Quaternion(), S = new T.Vector3(), E = new T.Euler();
    // For every watcher in range of ANY car, which car is it actually facing?
    // Reported as: how many face the ridden car, how many face their nearest.
    R.who = function (ride) {
      const cp = g.capy.position;
      const cars = R.cars.map(b => ({ x: b.position.x, z: b.position.z }));
      let facesRide = 0, facesNear = 0, inRange = 0, sumRide = 0, seeN = 0;
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, M); M.decompose(P, Q, S); E.setFromQuaternion(Q, 'YXZ');
        // nearest car to this watcher
        let ni = -1, nd = 1e9;
        for (let c = 0; c < cars.length; c++) {
          const d = (cars[c].x - P.x) ** 2 + (cars[c].z - P.z) ** 2;
          if (d < nd) { nd = d; ni = c; }
        }
        const dAn = (cp.x - P.x) ** 2 + (cp.z - P.z) ** 2;
        if (nd >= 90 * 90 && dAn >= 90 * 90) continue;
        const seesAnimal = dAn < 90 * 90;
        inRange++;
        const ang = (c) => {
          let d = E.y - Math.atan2(cars[c].x - P.x, cars[c].z - P.z);
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          return Math.abs(d);
        };
        // Against the CAPYBARA rather than against a car index: the probe cannot
        // know which entry of monCarG a world-order body corresponds to, and the
        // animal is pinned to the ridden car, so its position IS the target.
        let dR = E.y - Math.atan2(cp.x - P.x, cp.z - P.z);
        while (dR > Math.PI) dR -= Math.PI * 2;
        while (dR < -Math.PI) dR += Math.PI * 2;
        const aR = Math.abs(dR), aN = ang(ni);
        if (seesAnimal) { sumRide += aR; seeN++; if (aR < 0.15) facesRide++; }
        if (aN < 0.15) facesNear++;
      }
      return { inRange: inRange, facesRide: facesRide, facesNear: facesNear,
               meanToRide: seeN ? +(sumRide / seeN).toFixed(3) : null, seeN: seeN,
               // how many watchers have a DIFFERENT nearest car from the ridden one
               cars: cars.map(c => ({ x: +c.x.toFixed(0), z: +c.z.toFixed(0) })) };
    };
    R.ride = function (i) {
      R.stop();
      const b = R.cars[i];
      R.iv = setInterval(function () {
        const c = g.capy.body;
        c.position.set(b.position.x, b.position.y + 1.15, b.position.z);
        c.velocity.set(0, 0, 0);
      }, 16);
    };
    R.stop = function () { if (R.iv) clearInterval(R.iv); R.iv = 0; };
    return true;
  });
  const out = { off: [], on: [] };
  // control: nobody riding — 'facesRide' is measured against car 0 anyway, so
  // the two runs are directly comparable.
  for (let i = 0; i < 50; i++) { await wait(400); out.off.push(await page.evaluate(() => window.__mon.who(0))); }
  await page.evaluate(() => window.__mon.ride(0));
  await wait(600);
  for (let i = 0; i < 50; i++) { await wait(400); out.on.push(await page.evaluate(() => window.__mon.who(0))); }
  await page.evaluate(() => window.__mon.stop());
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f2-mon3.json', { method: 'POST', body: s }), bl);
}
