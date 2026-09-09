async page => {
  await page.evaluate(() => {
    const g = window.__capy;
    const cav = g.cave, b = g.capy.body, d = cav.doline;
    b.position.set(d.x, cav.terrainHeight(d.x, d.z) + 0.8, d.z);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    g.frameShot({ yaw: 0.55, dist: 20, pitch: 4 * Math.PI / 180, raise: 8.5, hold: 120 });
  });
  await page.waitForTimeout(5000);
  const out = await page.evaluate(() => {
    const g = window.__capy, cp = g.capy.position, cam = g.camera.position;
    const look = new g.THREE.Vector3(0, 0, -1).applyQuaternion(g.camera.quaternion);
    return { capy: [+cp.x.toFixed(2), +cp.y.toFixed(2), +cp.z.toFixed(2)],
             cam: [+cam.x.toFixed(2), +cam.y.toFixed(2), +cam.z.toFixed(2)],
             yawDeg: +(Math.atan2(cam.x - cp.x, cam.z - cp.z) * 180 / Math.PI).toFixed(1),
             dist: +Math.hypot(cam.x - cp.x, cam.z - cp.z).toFixed(2),
             raise: +(cam.y - cp.y).toFixed(2),
             lookPitchDeg: +(Math.asin(look.y) * 180 / Math.PI).toFixed(1),
             framing: +g.framing().toFixed(3) };
  });
  await page.evaluate(async o => {
    await fetch('/shot?name=b4cav-6.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
