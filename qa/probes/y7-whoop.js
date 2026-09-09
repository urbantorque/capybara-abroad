async page => {
  await page.reload(); await page.waitForTimeout(5600);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
    const hold=(x,y,z)=>{const b=g.capy.body;b.position.set(x,y,z);b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position);b.interpolatedPosition.copy(b.position);};
    const shoot = async (name, cx, cy, cz, tx, ty, tz) => {
      g.renderer.setSize(1280, 760, false);
      g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix();
      g.camera.position.set(cx, cy, cz); g.camera.lookAt(tx, ty, tz);
      g.camera.updateMatrixWorld(true); g.post.render();
      const url = g.renderer.domElement.toDataURL('image/png');
      await fetch('/shot?name=' + name + '.png', { method: 'POST', body: url.split(',')[1] });
    };
    g.biome.switchTo('drift');
    for (let i=0;i<300;i++) g.tick(1/60,false);
    hold(-60, -0.2, 60);
    for (let i=0;i<120;i++) g.tick(1/60,false);
    const before = g.taskDone('cloud-dive');
    for (let i=0;i<5;i++){ g.input.honkPressed = true; g.tick(1/60,false); }
    for (let i=0;i<14;i++) g.tick(1/60,false);
    await shoot('Y7F-dri-whoop', -70, 5, 74, -60, 0.2, 60);
    return { dive: before, err: g.state.lastError || null,
             y: +g.capy.position.y.toFixed(2) };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=y7whoop.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
