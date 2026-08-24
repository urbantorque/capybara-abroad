async page => {
  await page.reload(); await page.waitForTimeout(5200);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const res = { q: [], cones: 0 };
    if (!g.biome.isActive('sydney')) { g.biome.switchTo('sydney'); for (let i=0;i<90;i++) g.tick(1/60,false); }
    const b = g.capy.body;
    // wait for her to reach the west terminus and stop
    let guard = 0;
    while (guard++ < 6000) {
      g.tick(1/60, false);
      const v = g.env.van();
      if (g.env.vanDwellLeft() > 10.5 && v.x < -50) break;
      // keep the animal near that end so the crowd is loaded and awake
      b.position.set(-52, 1.0, 4); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    }
    res.foundStop = guard < 6000;
    // now let the queue form
    for (let i = 0; i < 480; i++) {
      g.tick(1/60, false);
      b.position.set(-52, 1.0, 5.5); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      if (i % 60 === 0) res.q.push(+g.env.vanDwellLeft().toFixed(1));
    }
    g.renderer.setSize(1280, 760, false);
    g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix();
    g.tick(1/60, true);
    const url = g.renderer.domElement.toDataURL('image/png');
    await fetch('/shot?name=Z-vanq.png', { method: 'POST', body: url.split(',')[1] });
    res.van = [+g.env.van().x.toFixed(1), +g.env.van().z.toFixed(1)];
    res.err = g.state.lastError || null;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=z4.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
