async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);
  const TAG = 'after';

  // Camera per trap 20: the game's own convention is lens at
  // p + (sin yaw, cos yaw) * d, looking BACK along it.
  async function at(page, tag, x, z, yaw, label, dist, hgt) {
    await page.evaluate(async (q) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
      const g = window.__capy;
      if (g.biome.current !== q.tag) { g.biome.switchTo(q.tag); await sleep(1600); }
      for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
      const api = g[q.tag];
      const th = (x, z) => { const v = api.terrainHeight(x, z); return (v === v) ? v : 0; };
      const b = g.capy.body;
      g.capy.carriedBy = null;
      g.capy.face(q.yaw + Math.PI);
      b.position.set(q.x, th(q.x, q.z) + 0.8, q.z);
      b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.renderer.setSize(1280, 660, false);
      for (let i = 0; i < 80; i++) g.tick(1 / 60, false);
      await sleep(320);
      g.tick(1 / 60, true);
      const p = g.capy.renderPosition;
      g.camera.position.set(p.x + Math.sin(q.yaw) * q.d, p.y + q.h, p.z + Math.cos(q.yaw) * q.d);
      g.camera.lookAt(p.x - Math.sin(q.yaw) * 20, p.y + 1.0, p.z - Math.cos(q.yaw) * 20);
      g.camera.updateMatrixWorld(true);
      g.renderer.setRenderTarget(null);
      g.renderer.render(g.scene, g.camera);
      const url = g.renderer.domElement.toDataURL('image/png');
      await fetch('/shot?name=b10-' + q.tag + '-' + q.label + '-' + q.t + '.png', { method: 'POST', body: url.split(',')[1] });
    }, { tag: tag, x: x, z: z, yaw: yaw, label: label, t: TAG, d: dist, h: hgt });
    await page.waitForTimeout(280);
  }

  // Monte Carlo: the 45 and 70 m rings the card says are 20% and 18% full.
  const S = { x: 10, z: -80 };
  for (const R of [45, 70]) {
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + 0.5;
      const x = S.x + Math.cos(a) * R, z = S.z + Math.sin(a) * R;
      // look back at the spawn, so the frame is what a player standing there
      // sees on the way in
      await at(page, 'monaco', x, z, Math.atan2(x - S.x, z - S.z), 'r' + R + '-' + k, 13, 7.5);
    }
  }

  // Son Doong down the passage: the great passage, the doline, the far side.
  await at(page, 'cave', 0, 40, Math.PI, 'z40', 13, 7.0);
  await at(page, 'cave', 6, 0, Math.PI, 'z0', 14, 7.5);
  await at(page, 'cave', 10, -34, Math.PI, 'doline', 15, 8.0);
  await at(page, 'cave', 8, -118, Math.PI, 'z118', 14, 7.5);
  await at(page, 'cave', 10, -150, Math.PI, 'z150', 14, 7.5);
}
