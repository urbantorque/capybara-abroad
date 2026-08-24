async page => {
  await page.reload(); await page.waitForTimeout(5600);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const shoot = async (name, cx, cy, cz, tx, ty, tz) => {
      g.renderer.setSize(1280, 760, false);
      g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix();
      g.camera.position.set(cx, cy, cz); g.camera.lookAt(tx, ty, tz);
      g.camera.updateMatrixWorld(true); g.post.render();
      const url = g.renderer.domElement.toDataURL('image/png');
      await fetch('/shot?name=' + name + '.png', { method: 'POST', body: url.split(',')[1] });
    };
    const hold = (x,y,z) => { const b=g.capy.body; b.position.set(x,y,z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
    g.biome.switchTo('iceland');
    for (let i=0;i<400;i++) g.tick(1/60,false);
    hold(10, 3, 20); for (let i=0;i<120;i++) g.tick(1/60,false);
    await shoot('Y7-ice-geo2', 10, 14, 40, -8, 1, -6);
    hold(2, 2, -10); for (let i=0;i<120;i++) g.tick(1/60,false);
    await shoot('Y7-ice-vent', 2, 4.6, 4, 6, 0.6, -12);
    return { err: g.state.lastError || null };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=y7ice1.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
