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

  await page.evaluate(() => {
    const g = window.__capy, T = g.THREE;
    const R = window.__mon = {};
    let mesh = null;
    g.scene.traverse(o => { if (o.isInstancedMesh && o.count === 46 && o.visible) mesh = o; });
    R.mesh = mesh;
    R.cars = g.world.bodies.filter(b => b.mass === 0 && b.shapes && b.shapes.length === 5);
    R.toasts = [];
    new MutationObserver(() => {
      for (const el of document.querySelectorAll('.capyui-toast')) {
        const t = (el.textContent || '').trim();
        if (t && R.toasts.indexOf(t) < 0) R.toasts.push(t);
      }
    }).observe(document.body, { subtree: true, childList: true });
    const M = new T.Matrix4(), P = new T.Vector3(), Q = new T.Quaternion(), S = new T.Vector3(), E = new T.Euler();
    // Mean |heading error| over the watchers that are actually IN RANGE of the
    // car — monUpdateWatchers only turns a watcher when the target is inside
    // 90 m, and beyond that they hold their idle phase, so averaging over all
    // forty-six measures the idle phases of the ones who cannot see it.
    R.err = function (tx, tz) {
      let sum = 0, n = 0, worst = 0, far = 0;
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, M); M.decompose(P, Q, S); E.setFromQuaternion(Q, 'YXZ');
        const dx = tx - P.x, dz = tz - P.z;
        if (dx * dx + dz * dz >= 90 * 90) { far++; continue; }
        let d = E.y - Math.atan2(dx, dz);
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        d = Math.abs(d);
        sum += d; n++; if (d > worst) worst = d;
      }
      return n ? { mean: +(sum / n).toFixed(3), worst: +worst.toFixed(3), inRange: n, far: far }
               : { mean: null, inRange: 0, far: far };
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
    R.at = function (i) { const b = R.cars[i]; return { x: +b.position.x.toFixed(1), z: +b.position.z.toFixed(1) }; };
    R.STAND = { x: 2, z: -102.2 };
    return true;
  });

  const sample = (riding) => page.evaluate(function (riding) {
    const R = window.__mon;
    const c = R.at(0);
    const dStand = Math.hypot(c.x - R.STAND.x, c.z - R.STAND.z);
    return { riding: riding, car: c, dStand: +dStand.toFixed(0), err: R.err(c.x, c.z) };
  }, riding);

  const out = { off: [], on: [], toasts: [] };
  // ---- CONTROL: nobody riding. Sample a whole lap. ----------------------
  for (let i = 0; i < 60; i++) { await wait(500); out.off.push(await sample(false)); }
  // ---- AFTER: ride car 0 for a lap. -------------------------------------
  await page.evaluate(() => window.__mon.ride(0));
  for (let i = 0; i < 60; i++) {
    await wait(500);
    const s = await sample(true);
    out.on.push(s);
    if (s.dStand < 60 && s.err.inRange > 20) await page.screenshot({ path: 'qa/F2-mon-stand.png' });
  }
  await page.evaluate(() => window.__mon.stop());
  out.toasts = await page.evaluate(() => window.__mon.toasts);
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f2-mon2.json', { method: 'POST', body: s }), bl);
}
