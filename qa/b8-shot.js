async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);
  const TAG = 'after';
  const sp = await page.evaluate(() => {
    const g = window.__capy;
    if (g.biome.current !== 'pasto') g.biome.switchTo('pasto');
    const s = g.biome.spawnOf('pasto');
    return { x: s.x, z: s.z };
  });
  await page.waitForTimeout(1200);
  const A = [0, 1.0, 2.1, 3.1, 4.2, 5.2];
  for (let k = 0; k < A.length; k++) {
    await page.evaluate(async (q) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
      const g = window.__capy;
      if (g.biome.current !== 'pasto') { g.biome.switchTo('pasto'); await sleep(1200); }
      for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
      const api = g.pasto;
      const th = (x, z) => { const v = api.terrainHeight(x, z); return (v === v) ? v : 0; };
      const x = q.sx + Math.cos(q.a) * 45, z = q.sz + Math.sin(q.a) * 45;
      const b = g.capy.body;
      const yaw = Math.atan2(x - q.sx, z - q.sz);
      g.capy.face(yaw); g.capy.carriedBy = null;
      b.position.set(x, th(x, z) + 0.6, z);
      b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.renderer.setSize(1280, 660, false);
      for (let i = 0; i < 70; i++) g.tick(1 / 60, false);
      await sleep(350);
      g.tick(1 / 60, true);
      const p = g.capy.renderPosition;
      g.camera.position.set(p.x - Math.sin(yaw) * 12, p.y + 7.0, p.z - Math.cos(yaw) * 12);
      g.camera.lookAt(p.x + Math.sin(yaw) * 10, p.y + 1.0, p.z + Math.cos(yaw) * 10);
      g.camera.updateMatrixWorld(true);
      g.renderer.setRenderTarget(null);
      g.renderer.render(g.scene, g.camera);
      const url = g.renderer.domElement.toDataURL('image/png');
      await fetch('/shot?name=b8-r45-' + q.k + '-' + q.t + '.png', { method: 'POST', body: url.split(',')[1] });
    }, { sx: sp.x, sz: sp.z, a: A[k], k: k, t: TAG });
    await page.waitForTimeout(300);
  }
}
