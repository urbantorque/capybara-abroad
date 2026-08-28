async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);
  const TAG = 'after';

  // TRAP 19. `g.biome.switchTo(tag)` BUILDS THE CHAPTER AND DOES NOT MOVE THE
  // ANIMAL. The first cut of this script switched and rendered, and both frames
  // were taken from wherever Sydney had left the capybara — (0, 22) in the
  // Pantanal, which is the first bridge, so the "spawn frame" was a close-up of
  // its planks. Place the body at spawnOf() and settle it, as b8-shot.js does.
  async function put(page, tag, yaw, label, dist, hgt) {
    await page.evaluate(async (q) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
      const g = window.__capy;
      if (g.biome.current !== q.tag) { g.biome.switchTo(q.tag); await sleep(1600); }
      for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
      const sp = g.biome.spawnOf(q.tag);
      const api = g[q.tag];
      const th = (x, z) => { const v = api.terrainHeight(x, z); return (v === v) ? v : 0; };
      const b = g.capy.body;
      g.capy.carriedBy = null;
      g.capy.face(q.yaw);
      b.position.set(sp.x, Math.max(sp.y, th(sp.x, sp.z) + 0.6), sp.z);
      b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.renderer.setSize(1280, 660, false);
      for (let i = 0; i < 80; i++) g.tick(1 / 60, false);
      await sleep(350);
      g.tick(1 / 60, true);
      const p = g.capy.renderPosition;
      // TRAP 20. THE ARRIVAL YAW IS THE CAMERA'S BEARING, NOT THE VIEW'S.
      // teleportCapy puts the lens at anchor + (sin camYaw, cos camYaw) * dist
      // and looks BACK at the animal, so a shot helper that copies b8-shot.js's
      // `camera at -sin(yaw)` renders every documented arrival backwards. That
      // is how Hanoi's spawn first read as an empty plain.
      g.camera.position.set(p.x + Math.sin(q.yaw) * q.d, p.y + q.h, p.z + Math.cos(q.yaw) * q.d);
      g.camera.lookAt(p.x - Math.sin(q.yaw) * 18, p.y + 1.0, p.z - Math.cos(q.yaw) * 18);
      g.camera.updateMatrixWorld(true);
      g.renderer.setRenderTarget(null);
      g.renderer.render(g.scene, g.camera);
      const url = g.renderer.domElement.toDataURL('image/png');
      await fetch('/shot?name=b9-' + q.tag + '-' + q.label + '-' + q.t + '.png', { method: 'POST', body: url.split(',')[1] });
    }, { tag: tag, yaw: yaw, label: label, t: TAG, d: dist, h: hgt });
    await page.waitForTimeout(300);
  }

  // The walk out of the spawn on a given bearing: `off` is the offset from the
  // spawn, and the view runs the same way, so this is what the player sees
  // heading that way.
  async function walk(page, tag, ox, oz, yaw, label) {
    await page.evaluate(async (q) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
      const g = window.__capy;
      if (g.biome.current !== q.tag) { g.biome.switchTo(q.tag); await sleep(1500); }
      for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
      const sp = g.biome.spawnOf(q.tag);
      const api = g[q.tag];
      const th = (x, z) => { const v = api.terrainHeight(x, z); return (v === v) ? v : 0; };
      const x = sp.x + q.ox, z = sp.z + q.oz;
      const b = g.capy.body;
      g.capy.carriedBy = null;
      g.capy.face(q.yaw + Math.PI);
      b.position.set(x, th(x, z) + 0.7, z);
      b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.renderer.setSize(1280, 660, false);
      for (let i = 0; i < 70; i++) g.tick(1 / 60, false);
      await sleep(300);
      g.tick(1 / 60, true);
      const p = g.capy.renderPosition;
      g.camera.position.set(p.x + Math.sin(q.yaw) * 12, p.y + 7.0, p.z + Math.cos(q.yaw) * 12);
      g.camera.lookAt(p.x - Math.sin(q.yaw) * 20, p.y + 1.0, p.z - Math.cos(q.yaw) * 20);
      g.camera.updateMatrixWorld(true);
      g.renderer.setRenderTarget(null);
      g.renderer.render(g.scene, g.camera);
      const url = g.renderer.domElement.toDataURL('image/png');
      await fetch('/shot?name=b9-' + q.tag + '-' + q.label + '-' + q.t + '.png', { method: 'POST', body: url.split(',')[1] });
    }, { tag: tag, ox: ox, oz: oz, yaw: yaw, label: label, t: TAG });
    await page.waitForTimeout(300);
  }

  // The arrival heading each chapter asks for, then the view behind it.
  await put(page, 'pantanal', 0, 'spawn', 11, 6.0);                // PANTANAL_SPAWN.yaw
  await put(page, 'pantanal', Math.PI, 'back', 11, 6.0);
  await put(page, 'hanoi', -1.94, 'spawn', 11, 6.0);               // HANOI_SPAWN.yaw
  await put(page, 'hanoi', -1.94 + Math.PI, 'back', 11, 6.0);      // ...and behind it

  // Hanoi's west: the quadrant the ring metric says is empty at 45 m out.
  await walk(page, 'hanoi', -30, 0, Math.PI / 2, 'w30');
  await walk(page, 'hanoi', -55, 0, Math.PI / 2, 'w55');
  await walk(page, 'hanoi', -20, -35, 2.62, 'sw40');
}
