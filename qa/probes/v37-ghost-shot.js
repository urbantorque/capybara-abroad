async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);

  // Lay down a trace: a slow arc across the lawn in front of the spawn.
  await page.evaluate(async () => {
    const g = window.__capy, b = g.capy.body;
    for (let i = 0; i < 60 * 8; i++) {
      const t = i / 60;
      b.position.set(-9 + t * 2.4, 0.85, 44 - t * 0.9);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      b.velocity.setZero();
      if (g.capy.group) g.capy.group.rotation.y = 1.2;
      g.recordLive('uji-run', t);
      g.tick(1 / 60, false);
    }
    g.record('uji-run', 40);
    g.recordEnd('uji-run');
    for (let i = 0; i < 20; i++) g.tick(1 / 60, false);
  });

  // Now stand the animal near the start of that arc and let REAL frames run,
  // pumping the line so the attempt stays open and the ghost walks the arc.
  await page.evaluate(() => {
    const g = window.__capy, b = g.capy.body;
    b.position.set(-4, 0.85, 41); b.velocity.setZero();
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    g.input.camYaw = 2.2;
    let t = 0;
    window.__pump = setInterval(() => { t += 0.05; g.recordLive('uji-run', t); }, 50);
  });
  await page.waitForTimeout(3200);
}
