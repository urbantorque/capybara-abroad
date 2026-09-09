async page => {
  await page.reload(); await page.waitForTimeout(5600);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2200);
  await page.evaluate(async () => {
    const g = window.__capy;
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
    g.biome.switchTo('iceland');
    for (let i=0;i<500;i++) g.tick(1/60,false);
    hold(-20, 1.0, 0); for (let i=0;i<120;i++) g.tick(1/60,false);
    await shoot('Y7F-ice-basin', -6, 7.5, 26, -22, 0.6, -6);
    hold(26, 2.2, 137); for (let i=0;i<200;i++) g.tick(1/60,false);
    await shoot('Y7F-ice-pier', 40, 10, 152, 12, 2, 158);
    g.biome.switchTo('sahara');
    for (let i=0;i<400;i++) g.tick(1/60,false);
    hold(-10, 1.2, 13); for (let i=0;i<150;i++) g.tick(1/60,false);
    await shoot('Y7F-sah-basket', -6.2, 3.0, 16.4, -10, 0.6, 13);
    await shoot('Y7F-sah-square', 4, 16, 34, -6, 1.5, 2);
    g.biome.switchTo('drift');
    for (let i=0;i<400;i++) g.tick(1/60,false);
    hold(-4, 34, -2); for (let i=0;i<120;i++) g.tick(1/60,false);
    await shoot('Y7F-dri-stairs', 14, 46, 18, -20, 34, -22);
  });
}
