async page => {
  await page.reload(); await page.waitForTimeout(6500);
  await page.mouse.click(500, 400);
  await page.waitForTimeout(2500);
  await page.evaluate(async () => {
    const g = window.__capy;
    g.biome.switchTo('kowloon');
    g.renderer.setSize(1280, 760, false);
    g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix();
    const b = g.capy.body;
    const put = (x,y,z) => { b.position.set(x,y,z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
    const shot = async (name) => { g.tick(1/60, true);
      const d = document.querySelector('canvas').toDataURL('image/png');
      await fetch('/shot?name=' + name, { method: 'POST', body: d.split(',')[1] }); };
    put(0, 1.4, 22);
    for (let i=0;i<60*14;i++) { g.tick(1/60,false); if(i%40===0) put(0,1.4,22); }
    await shot('hk-street');
    put(-6, 1.4, 26);
    for (let i=0;i<60*8;i++) { g.tick(1/60,false); if(i%40===0) put(-6,1.4,26); }
    await shot('hk-drip');
  });
}
