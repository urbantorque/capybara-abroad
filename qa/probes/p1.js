async page => {
  await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', {code:'Space', key:' ', bubbles:true})); });
  await page.waitForTimeout(1400);
  await page.evaluate(() => {
    const g = window.__capy;
    g.renderer.setSize(1280, 760, false);
    g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix();
    g.biome.switchTo('pantanal');
    const s = g.biome.spawnOf('pantanal');
    g.capy.body.position.set(s.x, s.y, s.z); g.capy.body.velocity.set(0,0,0);
  });
  await page.evaluate(() => { const g = window.__capy; for (let i=0;i<300;i++) g.tick(1/60,false); });
  const shots = [
    ['P1-road', [0, 18, 88], [0, 0, 20]],
    ['P2-campo', [-6, 10, 44], [-16, 1, 20]],
    ['P3-baia', [-14, 16, 26], [-60, 0, 6]],
    ['P4-river', [-34, 12, -40], [-34, 0, -80]],
    ['P5-fazenda', [36, 14, 104], [36, 2, 76]],
    ['P6-nest', [50, 10, 40], [50, 6, 18]],
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
    const p = g.capy.body.position;
    return {err: g.state.lastError||null, pos:[+p.x.toFixed(1),+p.y.toFixed(2),+p.z.toFixed(1)],
            grounded: g.capy.grounded, bodies: g.world.bodies.length,
            terrSpawn: +g.pantanal.terrainHeight(0,62).toFixed(2),
            over: g.pantanal.isOverWater(0,62)};
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=result.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))});
  }, info);
}
