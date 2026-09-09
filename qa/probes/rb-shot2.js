async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html?cb=' + Math.random());
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.__capy.biome.switchTo('rio'); });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const g = window.__capy;
    const b = g.capy.body;
    // on the beach just west of the bottom station, so the whole run to the
    // summit is across the frame
    b.position.set(44, g.rio.terrainHeight(44, -14) + 0.5, -14);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const g = window.__capy;
    // camera to the WEST looking east up the line
    g.frameShot({ yaw: -Math.PI * 0.62, dist: 34, pitch: 6 * Math.PI / 180, raise: 8, hold: 30 });
  });
  await page.waitForTimeout(3500);
}
