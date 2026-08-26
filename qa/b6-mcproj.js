async page => {
  // Is the Casino actually in the arrival frame from the new spawn? A bearing
  // sum is not an answer — `camera.fov` is the VERTICAL angle and the frame is
  // 16:9, so the horizontal half-angle is atan(tan(fov/2) * aspect), which is
  // half as much again. Project the thing and look.
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Period');
  await page.waitForTimeout(2000);
  const out = await page.evaluate(() => {
    const g = window.__capy, cam = g.camera;
    // The Casino and the yacht, from monaco.js: monCASINO {118,119,y 28},
    // monYACHT {10,-59}. Projected through the LIVE arrival camera.
    const pts = { casino: [118, 30, 119], terrace: [118, 28, 97], yacht: [10, 6, -59],
                  yachtBow: [10, 6, -38], yachtStern: [10, 6, -80] };
    const out = { fov: cam.fov, aspect: +cam.aspect.toFixed(3), pts: {} };
    out.halfH = +(Math.atan(Math.tan(cam.fov * Math.PI / 360) * cam.aspect) * 180 / Math.PI).toFixed(1);
    out.halfV = +(cam.fov / 2).toFixed(1);
    const V = cam.position.constructor;
    for (const k in pts) {
      const v = new V(pts[k][0], pts[k][1], pts[k][2]);
      const d = v.distanceTo(cam.position);
      v.project(cam);
      out.pts[k] = { x: +v.x.toFixed(2), y: +v.y.toFixed(2), z: +v.z.toFixed(3),
                     inFrame: Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && v.z < 1,
                     dist: +d.toFixed(1) };
    }
    out.cam = [+cam.position.x.toFixed(1), +cam.position.y.toFixed(1), +cam.position.z.toFixed(1)];
    return out;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b6-mcproj.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
