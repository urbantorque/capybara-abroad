async page => {
  // The south wall of the dry garden, from outside it, on a clean chapter —
  // the frame that decides whether the doorway the colliders leave is a
  // doorway anybody can see. The first attempt shot it from INSIDE (the walk
  // tests had already driven the animal in, and it ticked "redesign the rock
  // garden" on the way, which is the correct behaviour and a ruined photo).
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.reload();
  await page.waitForTimeout(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(8000);
  await page.evaluate(() => {
    const g = window.__capy;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    g.biome.switchTo('kyoto');
    tick(60 * 12);
    const b = g.capy.body;
    // stand south of the wall and FACE it: the camera rides behind the animal,
    // so the only way to point it north is to send the animal north.
    b.position.set(-34, g.kyoto.terrainHeight(-34, 30) + 0.4, 30);
    b.velocity.set(0, 0, 0);
    tick(60);
    for (let i = 0; i < 40; i++) { b.velocity.z = -3; g.tick(1 / 60, false); }
    b.velocity.set(0, 0, 0);
    tick(20);
    g.frameShot({ dist: 13, pitch: 0.16, raise: 1.4, hold: 8, w: 1 });
    tick(60 * 3);
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'qa/PX-kyoto-zen-door.png' });
  // ...and the same wall from the side, so the opening's depth is visible
  await page.evaluate(() => {
    const g = window.__capy;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    const b = g.capy.body;
    b.position.set(-44, g.kyoto.terrainHeight(-44, 22) + 0.4, 22);
    b.velocity.set(0, 0, 0);
    tick(40);
    for (let i = 0; i < 40; i++) { b.velocity.x = 3; g.tick(1 / 60, false); }
    b.velocity.set(0, 0, 0);
    tick(20);
    g.frameShot({ dist: 16, pitch: 0.14, raise: 1.4, hold: 8, w: 1 });
    tick(60 * 3);
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'qa/PX-kyoto-zen-along.png' });
  await page.evaluate((o) => fetch('/shot?name=px-kyoto-door-shot.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), { errN: errs.length, errs: errs.slice(0, 4) });
}
