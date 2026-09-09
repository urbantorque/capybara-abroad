async page => {
  await page.reload(); await page.waitForTimeout(6000);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const res = { shots: [] };
    g.biome.switchTo('sydney');
    for (let i = 0; i < 150; i++) g.tick(1/60, false);
    const b = g.capy.body;
    const spots = [[0, 22], [-40, 4], [26, 22], [-19, 8]];
    let k = 0;
    for (const [x, z] of spots) {
      const hold = () => { b.position.set(x, 1.4, z); b.velocity.set(0,0,0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
      hold();
      for (let i = 0; i < 150; i++) { g.tick(1/60, false); hold(); }
      g.renderer.setSize(1280, 760, false);
      g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix();
      g.tick(1/60, true);
      const u = g.renderer.domElement.toDataURL('image/png');
      await fetch('/shot?name=Z-scam' + (k++) + '.png', { method: 'POST', body: u.split(',')[1] });
      res.shots.push([x, z, +g.camera.position.y.toFixed(1)]);
    }
    res.err = g.state.lastError || null;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=zh.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
