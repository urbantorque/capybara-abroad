async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(4000);
  await page.evaluate(() => {
    const g = window.__capy;
    const b = g.capy.body;
    // the far (eastern) end of the Botanic Gardens: envZONES.gardens runs
    // x 14..62, z 4..58, so this is inside the named zone, not past it.
    b.position.set(58, 0.4, 50);
    b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position);
    b.interpolatedPosition.copy(b.position);
    g.capy.carriedBy = null;
  });
  await page.waitForTimeout(2500);
}
