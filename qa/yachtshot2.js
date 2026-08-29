async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('monaco');
  });
  await page.waitForTimeout(3000);
  const SPOTS = [
    { n: 'Y1-stern', x: 10, y: 3.6, z: -78 },
    { n: 'Y2-flightA', x: 7.8, y: 3.6, z: -76.0 },
    { n: 'Y3-bridge', x: 6.9, y: 6.3, z: -64 },
    { n: 'Y4-flightB', x: 10, y: 6.3, z: -51.5 },
    { n: 'Y5-sundeck', x: 10.4, y: 9.1, z: -60.0 },
    { n: 'Y6-beam', x: -8, y: 0.2, z: -60 },
  ];
  for (const s of SPOTS) {
    await page.evaluate((q) => {
      const g = window.__capy;
      const b = g.capy.body;
      b.position.set(q.x, q.y, q.z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    }, s);
    await page.waitForTimeout(2200);
    await page.screenshot({ path: 'qa/' + s.n + '.png' });
  }
}
