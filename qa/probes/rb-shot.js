async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html?cb=' + Math.random());
  await page.waitForTimeout(7000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('rio');
  });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const g = window.__capy;
    const b = g.capy.body;
    // stand on the beach south-west of the line, looking at the whole cable run
    b.position.set(30, g.rio.terrainHeight(30, -14) + 0.5, -14);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    g.input.camYaw = -Math.PI * 0.35;
  });
  await page.waitForTimeout(4000);
}
