async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch(e){} });
  await page.reload();
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('rio');
    const b = g.capy.body; b.position.set(0,1.4,0); b.velocity.set(0,0,0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    const r = g.rio; const orig = r.update.bind(r);
    r.update = function (dt) {
      const bb = g.capy.body;
      bb.position.set(-8.0, 2.95, -7.95); bb.velocity.set(0,0,0);
      bb.previousPosition.copy(bb.position); bb.interpolatedPosition.copy(bb.position);
      g.capy.position.set(-8.0, 2.95, -7.95);
      g.input.camYaw = 3.0;
      orig(dt);
    };
  });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: 'qa/B6-kiosk-top.png' });
  await page.evaluate(() => { window.__capy.input.camYaw = 1.4; });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'qa/B6-kiosk-side.png' });
}
