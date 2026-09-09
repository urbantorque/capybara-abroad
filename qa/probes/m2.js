async page => {
  await page.evaluate(() => {
    const g = window.__capy;
    g.renderer.setSize(1280, 760, false);
    g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix();
    window.dispatchEvent(new KeyboardEvent('keydown', {code:'Space', key:' ', bubbles:true}));
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('manly');
    const s = g.biome.spawnOf('manly');
    g.capy.body.position.set(s.x, s.y, s.z); g.capy.body.velocity.set(0,0,0);
  });
  await page.evaluate(() => { const g = window.__capy; for (let i=0;i<300;i++) g.tick(1/60,false); });
  const shots = [
    ['M1-wide', [0, 30, 66], [0, 0, -20]],
    ['M2-surf', [0, 14, 24], [0, 0, -30]],
    ['M3-back', [0, 9, -46], [0, 0, 10]],
    ['M4-point', [72, 16, 42], [78, 0, 0]],
    ['M5-corso', [0, 8, 70], [0, 3, 40]],
    ['M6-rip',  [-34, 12, 30], [-34, 0, -30]],
  ];
  for (const [name, pos, look] of shots) {
    await page.evaluate(async (o) => {
      const g = window.__capy;
      g.camera.position.set(o.p[0], o.p[1], o.p[2]);
      g.camera.lookAt(o.l[0], o.l[1], o.l[2]);
      g.camera.updateMatrixWorld(true);
      g.post.render();
      await fetch('/shot?name=' + o.n, {method:'POST', body: g.renderer.domElement.toDataURL('image/png')});
    }, {n:name, p:pos, l:look});
    await page.waitForTimeout(120);
  }
  const info = await page.evaluate(() => {
    const g = window.__capy;
    g.tick(1/60, true);
    return {err: g.state.lastError||null, draws: g.renderer.info.render.calls,
            tris: g.renderer.info.render.triangles, bodies: g.world.bodies.length};
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=result.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))});
  }, info);
}
