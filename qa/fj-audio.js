async page => {
  // Real (trusted) key events so the AudioContext actually unlocks, then a long
  // real-time soak per biome with the ambience and the score running.
  // Console errors are collected by playwright itself (`playwright-cli console`);
  // this script only drives the game and reports game.state.lastError.
  await page.mouse.click(400, 400);          // trusted gesture -> audio unlock
  await page.waitForTimeout(1500);
  const names = [
                 'manly', 'pantanal'];
  const res = { perBiome: {} };
  for (const n of names) {
    await page.evaluate((name) => {
      const g = window.__capy;
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name), b = g.capy.body;
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      g.state.lastError = null;
    }, n);
    for (let i = 0; i < 5; i++) {
      await page.keyboard.down('w');
      await page.waitForTimeout(1200);
      await page.keyboard.up('w');
      await page.keyboard.down('q');
      await page.waitForTimeout(120);
      await page.keyboard.up('q');
      await page.keyboard.down('d');
      await page.waitForTimeout(900);
      await page.keyboard.up('d');
      await page.keyboard.down(' ');
      await page.waitForTimeout(150);
      await page.keyboard.up(' ');
      await page.waitForTimeout(1600);
    }
    res.perBiome[n] = await page.evaluate(() => {
      const g = window.__capy;
      return {
        lastError: g.state.lastError || null,
        musicOn: !!(g.hud && g.hud.musicVolume && g.hud.musicVolume() > 0),
        t: Math.round(g.state.time),
      };
    });
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=fjaudio.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, res);
}
