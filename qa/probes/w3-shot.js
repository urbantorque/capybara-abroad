async page => {
  await page.reload(); await page.waitForTimeout(6500);
  await page.mouse.click(500, 400);
  await page.waitForTimeout(2500);
  await page.evaluate(async () => {
    const g = window.__capy;
    g.biome.switchTo('venice');
    g.renderer.setSize(1280, 760, false);
    g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix();
    const b = g.capy.body;
    const put = (x,y,z) => { b.position.set(x,y,z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
    const shot = async (name) => {
      g.tick(1/60, true);
      const d = document.querySelector('canvas').toDataURL('image/png');
      await fetch('/shot?name=' + name, { method: 'POST', body: d.split(',')[1] });
    };
    put(-4, 3, -20);
    for (let i=0;i<200;i++) g.tick(1/60,false);
    await shot('ven-dry');
    // run to the top of the tide
    let n = 0;
    while (g.venice.tide() < 0.9 && n < 60*220) { g.tick(1/60,false); n++;
      if (n % 40 === 0) put(-4, Math.max(g.capy.position.y, g.venice.tideY()+0.3), -20); }
    for (let i=0;i<90;i++) g.tick(1/60,false);
    await shot('ven-high');
    // and a look along the boards
    const bk = g.venice.boardPath();
    put(bk[0], g.venice.tideY()+2.4, bk[1]);
    for (let i=0;i<90;i++) g.tick(1/60,false);
    await shot('ven-boards');
  });
}
