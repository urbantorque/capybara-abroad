async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('venice');
  });
  await page.waitForTimeout(4000);
  // stand the animal in the middle of the paving where the crowd walks, and
  // let real frames run so the camera settles and the crowd is where it is
  await page.evaluate(() => {
    const g = window.__capy;
    const c = g.capy.body;
    c.position.set(-4, 1.4, -6);
    c.velocity.set(0, 0, 0);
    g.input.camYaw = 0.6;
  });
  await page.waitForTimeout(3500);
}
