async page => {
  await page.evaluate(() => {
    const g = window.__capy;
    const b = g.capy.body;
    b.position.set(9.6, 9.2, -66.5); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
  });
  await page.waitForTimeout(1400);
  for (const s of [{ n: 'D1-low', yaw: 3.14, pitch: -0.16 },
                   { n: 'D2-low3q', yaw: 2.35, pitch: -0.12 },
                   { n: 'D3-side', yaw: 1.57, pitch: -0.05 }]) {
    await page.evaluate((q) => {
      window.__capy.frameShot({ yaw: q.yaw, dist: 1.9, pitch: q.pitch, raise: 0.20, hold: 3.4 });
    }, s);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'qa/' + s.n + '.png',
                            clip: { x: 540, y: 310, width: 220, height: 150 } });
    await page.waitForTimeout(2600);
  }
}
