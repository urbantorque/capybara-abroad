async page => {
  await page.setViewportSize({width:1440, height:860});
  await page.waitForFunction(() => !!window.__capy, null, {timeout: 25000});
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const g = window.__capy;
    g.renderer.setSize(1280, 760, false);
    g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix();
    window.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',bubbles:true}));
  });
  await page.waitForTimeout(1800);
  const shots = [
    ['manly',    'hero-manly',    [0, 7.5, 33], [0, 1, -22],  [0, 2.0, 30]],
    ['manly',    'hero-manly2',   [-8, 5, 6],   [-2, 1, -26], [-6, 1.0, 2]],
    ['pantanal', 'hero-pantanal', [4, 8, 50],   [-14, 1, 24], [2, 2.6, 46]],
    ['pantanal', 'hero-pantanal2',[-30, 7, 24], [-62, 1, 6],  [-28, 2.0, 20]],
    ['cave',     'hero-cave',     [22, 4, -12], [2, 14, -50], [22, -3, -12]],
    ['cave',     'hero-cave2',    [6, 1, -84],  [0, 8, -104], [6, -3, -84]],
  ];
  for (const [b, name, cam, look, cpos] of shots) {
    await page.evaluate(async (o) => {
      const g = window.__capy;
      if (g.biome.current !== o.b) g.biome.switchTo(o.b);
      g.capy.body.position.set(o.c[0], o.c[1], o.c[2]);
      g.capy.body.velocity.set(0,0,0);
      g.capy.body.previousPosition.copy(g.capy.body.position);
      g.capy.body.interpolatedPosition.copy(g.capy.body.position);
      for (let i=0;i<260;i++) g.tick(1/60,false);
      if (o.b === 'cave') {
        window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyQ',bubbles:true}));
        g.tick(1/60,false);
        window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyQ',bubbles:true}));
        for (let i=0;i<14;i++) g.tick(1/60,false);
      }
      g.camera.position.set(o.p[0], o.p[1], o.p[2]);
      g.camera.lookAt(o.l[0], o.l[1], o.l[2]);
      g.camera.updateMatrixWorld(true);
      g.post.render();
      await fetch('/shot?name=' + o.n, {method:'POST', body: g.renderer.domElement.toDataURL('image/png')});
    }, {b, n:name, p:cam, l:look, c:cpos});
    await page.waitForTimeout(200);
  }
}
