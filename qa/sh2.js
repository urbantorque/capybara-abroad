async page => {
  await page.evaluate(() => {
    const g = window.__capy;
    const b = g.capy.body;
    b.position.set(9.6, 9.2, -66.5); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
  });
  await page.waitForTimeout(1500);
  for (const s of [{ n: 'C1-face', yaw: 3.14 }, { n: 'C2-3q', yaw: 2.2 }, { n: 'C3-side', yaw: 1.57 }]) {
    await page.evaluate((q) => {
      window.__capy.frameShot({ yaw: q.yaw, dist: 2.4, pitch: 0.0, raise: 0.30, hold: 3.4 });
    }, s);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'qa/' + s.n + '.png',
                            clip: { x: 500, y: 300, width: 300, height: 190 } });
    await page.waitForTimeout(2600);
  }
}
