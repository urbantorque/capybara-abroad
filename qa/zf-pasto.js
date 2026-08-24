async page => {
  await page.reload(); await page.waitForTimeout(6000);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const res = {};
    g.biome.switchTo('pasto');
    for (let i = 0; i < 150; i++) g.tick(1/60, false);
    const b = g.capy.body;
    const hold = (x,z) => { b.position.set(x, 1.5, z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
    hold(0, 26);
    for (let i = 0; i < 90; i++) { g.tick(1/60, false); hold(0, 26); }
    const shoot = async (n, cx, cy, cz, tx, ty, tz) => {
      g.renderer.setSize(1280, 760, false);
      g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix();
      g.camera.position.set(cx, cy, cz); g.camera.lookAt(tx, ty, tz);
      g.camera.updateMatrixWorld(true);
      g.post.render();
      const u = g.renderer.domElement.toDataURL('image/png');
      await fetch('/shot?name=' + n + '.png', { method: 'POST', body: u.split(',')[1] });
    };
    await shoot('Z-plaza', 0, 9, 4, 0, 4.5, 34);
    await shoot('Z-plaza2', -20, 11, 8, 4, 4, 32);
    res.err = g.state.lastError || null;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=zf.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
