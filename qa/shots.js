async page => {
  const biomes = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift','venice','kowloon','palawan','goreme'];
  await page.evaluate(() => {
    const g = window.__capy;
    g.renderer.setSize(1280, 760, false);
    g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix();
    // start the game without the title card
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
    // settle: prime atmosphere by ticking a while
    await page.evaluate(() => { const g = window.__capy; for (let i=0;i<240;i++) g.tick(1/60, false); });
    await page.waitForTimeout(400);
    await page.evaluate(async (name) => {
      const g = window.__capy;
      g.tick(1/60, true);
      const url = g.renderer.domElement.toDataURL('image/png');
      await fetch('/shot?name=vis-' + name, {method:'POST', body:url});
    }, b);
    await page.waitForTimeout(200);
  }
}
