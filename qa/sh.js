async page => {
  await page.evaluate(() => {
    const g = window.__capy;
    const b = g.capy.body;
    b.position.set(9.6, 9.2, -66.5); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
  });
  await page.waitForTimeout(1800);
  for (const s of [{ n: 'T7-3q', yaw: 2.3 }, { n: 'T8-face', yaw: 3.14 }, { n: 'T9-side', yaw: 1.57 }]) {
    await page.evaluate((q) => {
      const g = window.__capy;
      g.frameShot({ yaw: q.yaw, dist: 2.6, pitch: 0.02, raise: 0.35, hold: 3.2 });
    }, s);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'qa/' + s.n + '.png' });
    await page.waitForTimeout(2400);
  }
}
