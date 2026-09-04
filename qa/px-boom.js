async page => {
  const out = { samples: [] };
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4200);
  await page.keyboard.press('Digit0');           // 10 = venice
  await page.waitForTimeout(6000);
  out.biome = await page.evaluate(() => window.__capy.biome.current);
  // The arcade corner px-cam-walls stopped at.
  await page.evaluate(() => {
    const g = window.__capy;
    g.capy.body.position.set(-7.5, 1.6, 14.5);
    g.capy.body.velocity.set(0, 0, 0);
    g.capy.body.aabbNeedsUpdate = true;
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const g = window.__capy, T = g.THREE;
    const rc = new T.Raycaster(), dir = new T.Vector3(), from = new T.Vector3();
    const a = new T.Vector3(), b = new T.Vector3();
    const vis = (o) => { while (o) { if (o.visible === false) return false; o = o.parent; } return true; };
    window.__bm = [];
    window.__bmT = setInterval(() => {
      const c = g.capy, p = c.position, cam = g.camera;
      const cp = cam.position;
      const dx = cp.x - p.x, dy = cp.y - p.y, dz = cp.z - p.z;
      const dist = Math.hypot(dx, dy, dz);
      // Is the animal actually behind something, in the picture?
      const tx = p.x, ty = p.y + 0.35, tz = p.z;
      dir.set(tx - cp.x, ty - cp.y, tz - cp.z);
      const d2 = dir.length(); dir.normalize();
      from.copy(cp);
      rc.set(from, dir); rc.near = 0.02; rc.far = Math.max(0.05, d2 - 0.75);
      let occ = null;
      for (const h of rc.intersectObjects(g.scene.children, true)) {
        const o = h.object;
        if (!o.isMesh && !o.isInstancedMesh) continue;
        if (!vis(o)) continue;
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (!m || (m.transparent && m.opacity < 0.35) || m.depthWrite === false) continue;
        occ = { d: +h.distance.toFixed(2), name: o.name || o.type };
        break;
      }
      // How big the animal is on the screen, in fractions of the frame height.
      a.set(p.x, p.y - 0.34, p.z).project(cam);
      b.set(p.x, p.y + 0.42, p.z).project(cam);
      const hFrac = Math.abs(b.y - a.y) / 2;
      const cx = (a.x + b.x) / 4, cy = (a.y + b.y) / 4;
      window.__bm.push({ dist: +dist.toFixed(2), clear: +g.camInfo.clear.toFixed(2),
                         reach: +g.camInfo.reach.toFixed(1),
                         lift2: +(g.camInfo.lift2 || 0).toFixed(2),
                         camY: +cp.y.toFixed(2), capY: +p.y.toFixed(2),
                         eyeUp: +(cp.y - p.y).toFixed(2),
                         hFrac: +hFrac.toFixed(3), cx: +cx.toFixed(2), cy: +cy.toFixed(2),
                         onScreen: Math.abs(cx) < 0.5 && Math.abs(cy) < 0.5,
                         occ, at: [+p.x.toFixed(1), +p.z.toFixed(1)] });
      if (window.__bm.length > 400) window.__bm.shift();
    }, 100);
  });
  await page.keyboard.down('KeyW'); await page.keyboard.down('KeyD');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'qa/px-boom-venice-1.png' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'qa/px-boom-venice-2.png' });
  await page.waitForTimeout(900);
  out.samples = await page.evaluate(() => window.__bm.slice());
  await page.screenshot({ path: 'qa/px-boom-venice-3.png' });
  await page.keyboard.up('KeyW'); await page.keyboard.up('KeyD');
  // ...and what a RISE would have to clear: the height of the thing the boom is
  // being cut by, straight up from the eye.
  out.roof = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE;
    const rc = new T.Raycaster(new T.Vector3(), new T.Vector3(0, 1, 0));
    const cp = g.camera.position;
    rc.set(new T.Vector3(cp.x, cp.y, cp.z), new T.Vector3(0, 1, 0));
    rc.near = 0.02; rc.far = 60;
    const hits = rc.intersectObjects(g.scene.children, true).filter(h => {
      const o = h.object; if (!o.isMesh && !o.isInstancedMesh) return false;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      return m && !(m.transparent && m.opacity < 0.35) && m.depthWrite !== false;
    });
    return hits.slice(0, 3).map(h => ({ d: +h.distance.toFixed(2), name: h.object.name || h.object.type }));
  });
  await page.evaluate(() => clearInterval(window.__bmT));
  await page.evaluate(o => fetch('/shot?name=px-boom.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
