async page => {
  await page.reload();
  await page.waitForTimeout(5500);
  await page.keyboard.press('Digit1');
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(1000);
    const b = await page.evaluate(() => {
      const g = window.__capy;
      return g && g.biome ? g.biome.current : null;
    });
    if (b === 'sydney') break;
  }
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('kowloon');
    const s = g.biome.spawnOf ? g.biome.spawnOf('kowloon') : null;
    if (s && g.capy && g.capy.body) {
      g.capy.body.position.set(s.x, s.y + 0.4, s.z);
      g.capy.body.velocity.set(0, 0, 0);
    }
  });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const g = window.__capy;
    for (let i = 0; i < 300; i++) g.tick(1 / 60, false);
  });
  await page.waitForTimeout(4000);
}
