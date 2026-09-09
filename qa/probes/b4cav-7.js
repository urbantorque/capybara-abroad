async page => {
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200)));
  await page.addInitScript(() => {
    try { localStorage.clear() } catch (e) {}
    try {
      const c0 = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () {
        if (this.hasAttribute('download')) return; return c0.apply(this, arguments);
      };
    } catch (e) {}
  });
  await page.reload();
  await page.waitForFunction(() => window.__capy && window.__capy.biome, null, { timeout: 30000 });
  await page.keyboard.press('Digit1');
  await page.waitForFunction(() => window.__capy.state.started, null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('cave');
    window.__shot = async (name) => {
      if (g.post && g.post.enabled) g.post.render(); else g.renderer.render(g.scene, g.camera);
      const u = g.canvas.toDataURL('image/png');
      await fetch('/shot?name=' + name, { method: 'POST', body: u });
      return u.length;
    };
    window.__park = () => {
      const cav = g.cave, b = g.capy.body, d = cav.doline;
      b.position.set(d.x, cav.terrainHeight(d.x, d.z) + 0.8, d.z);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    };
    window.__where = () => {
      const cp = g.capy.position, cam = g.camera.position;
      const look = new g.THREE.Vector3(0, 0, -1).applyQuaternion(g.camera.quaternion);
      return { cam: [+cam.x.toFixed(1), +cam.y.toFixed(1), +cam.z.toFixed(1)],
               yawDeg: +(Math.atan2(cam.x - cp.x, cam.z - cp.z) * 180 / Math.PI).toFixed(1),
               dist: +Math.hypot(cam.x - cp.x, cam.z - cp.z).toFixed(1),
               raise: +(cam.y - cp.y).toFixed(1),
               lookPitchDeg: +(Math.asin(look.y) * 180 / Math.PI).toFixed(1),
               w: +g.framing().toFixed(2) };
    };
  });
  await page.evaluate(() => window.__park());
  await page.waitForTimeout(4000);
  const rows = [];
  rows.push(['default', await page.evaluate(() => window.__where())]);
  await page.evaluate(() => window.__shot('b4cav-fA.png'));
  const cands = [
    { n: 'B', o: { yaw: 0.55, dist: 16, pitch: 0.035, raise: 9, hold: 60 } },
    { n: 'C', o: { yaw: 0.55, dist: 16, pitch: -0.10, raise: 13, hold: 60 } },
    { n: 'D', o: { yaw: 0.0, dist: 16, pitch: 0.035, raise: 9, hold: 60 } }
  ];
  for (const c of cands) {
    await page.evaluate(o => { window.__park(); window.__capy.frameShot(o) }, c.o);
    await page.waitForTimeout(3500);
    rows.push([c.n, await page.evaluate(() => window.__where())]);
    await page.evaluate(n => window.__shot(n), 'b4cav-f' + c.n + '.png');
  }
  await page.evaluate(async o => {
    await fetch('/shot?name=b4cav-7.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, { errs, rows });
}
