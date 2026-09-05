async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.setViewportSize({ width: 1440, height: 900 });
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

  // Install a rider harness: pin the animal to a car's roof every frame.
  await page.evaluate(() => {
    const g = window.__capy, T = g.THREE;
    window.__mon = {};
    let mesh = null;
    g.scene.traverse(o => { if (o.isInstancedMesh && o.count === 46 && o.visible) mesh = o; });
    window.__mon.mesh = mesh;
    window.__mon.cars = g.world.bodies.filter(b => b.mass === 0 && b.shapes && b.shapes.length === 5);
    const M = new T.Matrix4(), P = new T.Vector3(), Q = new T.Quaternion(), S = new T.Vector3(), E = new T.Euler();
    // mean |angle error| from each watcher's drawn heading to a given point
    window.__mon.err = function (tx, tz) {
      if (!mesh) return null;
      let sum = 0, n = 0, worst = 0;
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, M); M.decompose(P, Q, S); E.setFromQuaternion(Q, 'YXZ');
        const want = Math.atan2(tx - P.x, tz - P.z);
        let d = E.y - want;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        d = Math.abs(d);
        sum += d; n++; if (d > worst) worst = d;
      }
      return { mean: +(sum / n).toFixed(3), worst: +worst.toFixed(3), n: n };
    };
    window.__mon.ride = function (i) {
      const b = window.__mon.cars[i];
      if (!b) return false;
      window.__mon.stop();
      window.__mon.iv = setInterval(function () {
        const c = g.capy.body;
        c.position.set(b.position.x, b.position.y + 1.15, b.position.z);
        c.velocity.set(0, 0, 0);
      }, 16);
      return true;
    };
    window.__mon.stop = function () { if (window.__mon.iv) clearInterval(window.__mon.iv); window.__mon.iv = 0; };
    window.__mon.carAt = function (i) {
      const b = window.__mon.cars[i];
      return b ? { x: +b.position.x.toFixed(1), z: +b.position.z.toFixed(1) } : null;
    };
    return { mesh: !!mesh, cars: window.__mon.cars.length };
  });

  const out = { cars: await page.evaluate(() => window.__mon.cars.length) };

  // BEFORE: nobody is riding. Error against car 0 should be large and it is
  // the nearest-car behaviour, which is what the fix replaces.
  out.before = await page.evaluate(() => {
    const c = window.__mon.carAt(0);
    return { car: c, err: window.__mon.err(c.x, c.z) };
  });

  // AFTER: ride car 0 for a second and re-read.
  await page.evaluate(() => window.__mon.ride(0));
  await wait(1000);
  out.after1s = await page.evaluate(() => {
    const c = window.__mon.carAt(0);
    return { car: c, err: window.__mon.err(c.x, c.z) };
  });
  await wait(2500);
  out.after35s = await page.evaluate(() => {
    const c = window.__mon.carAt(0);
    return { car: c, err: window.__mon.err(c.x, c.z) };
  });
  await page.screenshot({ path: 'qa/F2-mon-ride.png' });
  await page.evaluate(() => window.__mon.stop());
  await wait(2500);
  out.released = await page.evaluate(() => {
    const c = window.__mon.carAt(0);
    return { car: c, err: window.__mon.err(c.x, c.z) };
  });

  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f2-mon.json', { method: 'POST', body: s }), bl);
}
