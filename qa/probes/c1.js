async page => {
  await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', {code:'Space', key:' ', bubbles:true})); });
  await page.waitForTimeout(1400);
  await page.evaluate(() => {
    const g = window.__capy;
    g.renderer.setSize(1280, 760, false);
    g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix();
    g.biome.switchTo('cave');
    const s = g.biome.spawnOf('cave');
    g.capy.body.position.set(s.x, s.y, s.z); g.capy.body.velocity.set(0,0,0);
  });
  await page.evaluate(() => { const g = window.__capy; for (let i=0;i<300;i++) g.tick(1/60,false); });
  const shots = [
    ['C1-outside', [0, 14, 86], [0, 6, 46]],
    ['C2-mouth', [0, 8, 44], [0, 6, 10]],
    ['C3-passage', [10, 6, 20], [10, 8, -40]],
    ['C4-doline', [4, 12, -8], [4, 30, -48]],
    ['C5-doline2', [4, 6, -70], [4, 20, -46]],
    ['C6-wall', [0, 2, -84], [0, 14, -106]],
  ];
  for (const [name, pos, look] of shots) {
    await page.evaluate(async (o) => {
      const g = window.__capy;
      // put the animal where the camera is, so the atmosphere reads the right daylight
      g.capy.body.position.set(o.p[0], o.p[1], o.p[2]);
      for (let i=0;i<60;i++) g.tick(1/60,false);
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
    const c = g.cave;
    return {err: g.state.lastError||null, bodies: g.world.bodies.length,
      terr: [ +c.terrainHeight(0,62).toFixed(2), +c.terrainHeight(0,20).toFixed(2),
              +c.terrainHeight(4,-48).toFixed(2), +c.terrainHeight(0,-120).toFixed(2)],
      day: [ +c.daylight().toFixed(2) ]};
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=result.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))});
  }, info);
}
