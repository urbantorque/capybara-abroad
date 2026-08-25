async page => {
  await page.evaluate(() => {
    const g = window.__capy;
    if (window.__capy.state.started) return;
  });
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('cave');
    const cav = g.cave, b = g.capy.body;
    const d = cav.doline;
    b.position.set(d.x, cav.terrainHeight(d.x, d.z) + 0.8, d.z);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
  });
  await page.waitForTimeout(4000);
  const out = await page.evaluate(() => {
    const g = window.__capy, cav = g.cave;
    const cp = g.capy.position, cam = g.camera.position;
    const dx = cam.x - cp.x, dz = cam.z - cp.z, dy = cam.y - cp.y;
    const hor = Math.hypot(dx, dz);
    const look = new g.THREE.Vector3(0, 0, -1).applyQuaternion(g.camera.quaternion);
    return {
      capy: [+cp.x.toFixed(2), +cp.y.toFixed(2), +cp.z.toFixed(2)],
      cam: [+cam.x.toFixed(2), +cam.y.toFixed(2), +cam.z.toFixed(2)],
      yawDeg: +(Math.atan2(dx, dz) * 180 / Math.PI).toFixed(1),
      dist: +hor.toFixed(2), raise: +dy.toFixed(2),
      camPitchDeg: +(Math.asin(look.y) * 180 / Math.PI).toFixed(1),
      lookYawDeg: +(Math.atan2(look.x, look.z) * 180 / Math.PI).toFixed(1),
      skyward: +cav.skyward().toFixed(3), day: +cav.daylight().toFixed(3),
      framing: +g.framing().toFixed(3),
      done: g.hud && g.hud.mapMarkAudit ? 1 : 0
    };
  });
  await page.evaluate(async o => {
    await fetch('/shot?name=b4cav-4.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
