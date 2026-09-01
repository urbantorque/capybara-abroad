async page => {
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 6000)));
  await page.keyboard.press('Digit1');
  await page.evaluate(() => new Promise(r => setTimeout(r, 4000)));
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('pantanal');
    const b = g.capy.body;
    // stand on the west approach, looking at him and the crossing beyond
    b.position.set(-48, g.pantanal.standHeight(-48, -44) + 0.6, -44);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
  });
  await page.evaluate(() => new Promise(r => setTimeout(r, 4000)));
  const shot = await page.evaluate(() => {
    const g = window.__capy;
    g.renderer.setSize(1280, 760, false);
    const cam = g.camera;
    cam.position.set(-30, 22, -26);
    cam.lookAt(-40, 0.6, -50);
    g.tick(1 / 60, true);
    g.renderer.render(g.scene, g.camera);
    return g.renderer.domElement.toDataURL('image/png').split(',')[1];
  });
  await page.evaluate(s => fetch('/shot?name=r10-cattleman2', { method: 'POST', body: s }), shot);
}
