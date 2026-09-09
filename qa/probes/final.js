async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.__capy.biome.switchTo('monaco'); });
  await page.waitForTimeout(3500);
  await page.evaluate(async () => {
    const g = window.__capy;
    const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
    const b = g.capy.body;
    b.position.set(11.2, 9.2, -61.4); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i = 0; i < 12; i++) {
      down('KeyE'); await new Promise(r => setTimeout(r, 120)); up('KeyE');
      await new Promise(r => setTimeout(r, 300));
      if (g.taskDone('black-tie')) break;
    }
  });
  await page.waitForTimeout(2000);
  const SH = [
    { n: 'F1-face', x: 9.6, y: 9.2, z: -66.5, yaw: 3.14, pitch: -0.12, dist: 2.0, clip: 1 },
    { n: 'F2-3q',   x: 9.6, y: 9.2, z: -66.5, yaw: 2.30, pitch: -0.08, dist: 2.0, clip: 1 },
    { n: 'F3-side', x: 9.6, y: 9.2, z: -66.5, yaw: 1.57, pitch: -0.04, dist: 2.2, clip: 1 },
    { n: 'F4-flightA', x: 7.8, y: 3.6, z: -75.0, yaw: 3.14, pitch: 0.12, dist: 7.0, clip: 0 },
    { n: 'F5-deck', x: 6.9, y: 6.3, z: -62.0, yaw: 3.14, pitch: 0.10, dist: 9.0, clip: 0 },
  ];
  for (const s of SH) {
    await page.evaluate((q) => {
      const g = window.__capy;
      const b = g.capy.body;
      b.position.set(q.x, q.y, q.z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    }, s);
    await page.waitForTimeout(1300);
    await page.evaluate((q) => {
      window.__capy.frameShot({ yaw: q.yaw, dist: q.dist, pitch: q.pitch, raise: 0.35, hold: 3.4 });
    }, s);
    await page.waitForTimeout(1500);
    const opt = { path: 'qa/' + s.n + '.png' };
    if (s.clip) opt.clip = { x: 520, y: 305, width: 250, height: 165 };
    await page.screenshot(opt);
    await page.waitForTimeout(2500);
  }
}
