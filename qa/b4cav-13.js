async page => {
  await page.evaluate(() => {
    const g = window.__capy;
    window.__shot = async (name) => {
      if (g.post && g.post.enabled) g.post.render(); else g.renderer.render(g.scene, g.camera);
      await fetch('/shot?name=' + name, { method: 'POST', body: g.canvas.toDataURL('image/png') });
    };
    window.__go = (o) => {
      const cav = g.cave, b = g.capy.body, d = cav.doline;
      b.position.set(d.x, cav.terrainHeight(d.x, d.z) + 0.8, d.z);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.frameShot(o);
    };
    window.__where = () => {
      const cp = g.capy.position, cam = g.camera.position;
      const look = new g.THREE.Vector3(0, 0, -1).applyQuaternion(g.camera.quaternion);
      return { dist: +Math.hypot(cam.x - cp.x, cam.z - cp.z).toFixed(1),
               raise: +(cam.y - cp.y).toFixed(1),
               yaw: +(Math.atan2(cam.x - cp.x, cam.z - cp.z) * 180 / Math.PI).toFixed(0),
               lookPitch: +(Math.asin(look.y) * 180 / Math.PI).toFixed(1) };
    };
  });
  const rows = [];
  const cands = [['E', { yaw: 0, dist: 16, pitch: 0.02, raise: 4.0, hold: 60 }],
                 ['F', { yaw: 0, dist: 16, pitch: -0.05, raise: 6.0, hold: 60 }]];
  for (const [n, o] of cands) {
    await page.evaluate(a => window.__go(a), o);
    await page.waitForTimeout(4000);
    rows.push([n, await page.evaluate(() => window.__where())]);
    await page.evaluate(nm => window.__shot(nm), 'b4cav-f' + n + '.png');
  }
  await page.evaluate(async o => {
    await fetch('/shot?name=b4cav-13.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, rows);
}
