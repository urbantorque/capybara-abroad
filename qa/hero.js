async page => {
  const biomes = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift','venice','kowloon','palawan','goreme'];
  const tag = 'A';
  await page.evaluate(() => {
    const g = window.__capy;
    g.renderer.setSize(1280, 760, false);
    g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix();
    window.dispatchEvent(new KeyboardEvent('keydown', {code:'Space', key:' ', bubbles:true}));
  });
  await page.waitForTimeout(1500);
  for (const b of biomes) {
    await page.evaluate((name) => {
      const g = window.__capy;
      g.biome.switchTo(name);
      const s = g.biome.spawnOf(name);
      if (g.capy && g.capy.body) { g.capy.body.position.set(s.x, s.y, s.z); g.capy.body.velocity.set(0,0,0); }
    }, b);
    await page.evaluate(() => { const g = window.__capy; for (let i=0;i<300;i++) g.tick(1/60, false); });
    await page.waitForTimeout(300);
    // WIDE: pull the lens back and drop the pitch so the sky and the skyline
    // are in the frame — the gameplay rig at 41 deg never shows either.
    await page.evaluate(async (name) => {
      const g = window.__capy;
      const s = g.biome.spawnOf(name);
      const T = g.THREE;
      // look from behind-and-above the spawn, toward the world origin
      const dx = -s.x, dz = -s.z;
      let L = Math.hypot(dx, dz);
      let ux, uz;
      if (L < 6) { ux = 0; uz = -1; } else { ux = dx / L; uz = dz / L; }
      const back = 30, up = 15;
      g.camera.position.set(s.x - ux*back, s.y + up, s.z - uz*back);
      g.camera.lookAt(s.x + ux*14, s.y + 3.5, s.z + uz*14);
      g.camera.updateMatrixWorld(true);
      g.post.render();
      await fetch('/shot?name=hero-' + name, {method:'POST', body: g.renderer.domElement.toDataURL('image/png')});
    }, b);
    await page.waitForTimeout(200);
  }
}
