async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload(); await page.waitForTimeout(6500);
  await page.mouse.click(500, 400);
  await page.waitForTimeout(2500);
  await page.evaluate(async () => {
    const g = window.__capy;
    g.renderer.setSize(1280, 760, false);
    g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix();
    const b = g.capy.body;
    const put = (x,y,z) => { b.position.set(x,y,z); b.velocity.set(0,0,0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); };
    const shot = async (n) => { g.tick(1/60,true);
      const d = document.querySelector('canvas').toDataURL('image/png');
      await fetch('/shot?name='+n, {method:'POST', body:d.split(',')[1]}); };
    // --- palawan, under, with a wheek shell in the bloom
    g.biome.switchTo('palawan');
    for (let i=0;i<300;i++) g.tick(1/60,false);
    let n=0;
    while (n < 60*200 && !(g.palawan.bloom && g.palawan.bloom() > 0.5)) {
      put(-4, -4, -17); g.tick(1/60,false); n++;
    }
    for (let i=0;i<200;i++) { put(-4,-4,-17); g.tick(1/60,false); }
    g.events.emit('capy:wheek', { position: g.capy.position });
    for (let i=0;i<60;i++) { put(-4,-4,-17); g.tick(1/60,false); }
    await shot('pal-wheek');
    // --- kowloon pavement under the AC units
    g.biome.switchTo('kowloon');
    for (let i=0;i<60*20;i++) { g.tick(1/60,false); if(i%40===0) put(-7.5,1.4,14); }
    await shot('hk-pavement');
  });
}
