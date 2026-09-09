async page => {
  await page.reload(); await page.waitForTimeout(5600);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const res = {};
    const shoot = async (name, cx, cy, cz, tx, ty, tz) => {
      g.renderer.setSize(1280, 760, false);
      g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix();
      g.camera.position.set(cx, cy, cz); g.camera.lookAt(tx, ty, tz);
      g.camera.updateMatrixWorld(true); g.post.render();
      const url = g.renderer.domElement.toDataURL('image/png');
      await fetch('/shot?name=' + name + '.png', { method: 'POST', body: url.split(',')[1] });
    };
    const hold=(x,y,z)=>{const b=g.capy.body;b.position.set(x,y,z);b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);};
    g.biome.switchTo('sahara');
    for (let i=0;i<400;i++) g.tick(1/60,false);
    const S = g.sahara;
    // hop into the basket
    hold(S.basket.x, 1.4, S.basket.z);
    for (let i=0;i<120;i++) g.tick(1/60,false);
    res.snake = g.taskDone('snake-basket');
    res.capyY = +g.capy.position.y.toFixed(2);
    await shoot('Y7-sah-basket', S.basket.x + 3.4, 2.4, S.basket.z + 3.4, S.basket.x, 0.5, S.basket.z);
    // can it get out?
    for (let i=0;i<10;i++){ g.input.jumpPressed = true; g.tick(1/60,false); }
    hold(S.SPAWN.x, 2, S.SPAWN.z);
    for (let i=0;i<80;i++) g.tick(1/60,false);
    await shoot('Y7-sah-stalls', S.SPAWN.x - 12, 8, S.SPAWN.z + 14, S.SPAWN.x + 4, 1.6, S.SPAWN.z - 6);
    res.dusk = +S.dusk().toFixed(2);
    res.err = g.state.lastError || null;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=y7sah1.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
