async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const g = window.__capy;
    ['steal-hat','manly-voyage','samba-parade','gondola-ride','first-dive',
     'sunrise','all-the-way','the-doline','orca-ride','black-tie']
      .forEach(t => g.completeTask(t, true));
  });
  const ROWS = [
    { b: 'sydney',    n: 'S1-sunhat' },
    { b: 'quay',      n: 'S2-ferrycap' },
    { b: 'rio',       n: 'S3-plumes' },
    { b: 'venice',    n: 'S4-boater' },
    { b: 'palawan',   n: 'S5-snorkel' },
    { b: 'goreme',    n: 'S6-flycap' },
    { b: 'manly',     n: 'S7-surfcap' },
    { b: 'cave',      n: 'S8-cavehelm' },
    { b: 'antarctic', n: 'S9-parka' },
    { b: 'monaco',    n: 'SA-blacktie' },
  ];
  for (const r of ROWS) {
    await page.evaluate((q) => {
      const g = window.__capy;
      g.biome.switchTo(q.b);
      const sp = g.biome.spawnOf(q.b);
      const bd = g.capy.body;
      bd.position.set(sp.x, sp.y + 0.4, sp.z);
      bd.velocity.set(0, 0, 0);
      bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position);
    }, r);
    await page.waitForTimeout(2800);
    await page.evaluate(() => {
      window.__capy.frameShot({ yaw: 2.45, dist: 1.85, pitch: -0.05, raise: 0.30, hold: 3.6 });
    });
    await page.waitForTimeout(1600);
    await page.screenshot({ path: 'qa/' + r.n + '.png',
                            clip: { x: 500, y: 280, width: 300, height: 205 } });
    await page.waitForTimeout(2400);
  }
}
