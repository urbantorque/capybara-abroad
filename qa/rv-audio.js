async page => {
  await page.reload();
  await page.waitForTimeout(6500);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2500);
  const names = ['sydney', 'quay', 'pasto', 'manly', 'kyoto'];
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
      await page.waitForTimeout(1100);
      await page.keyboard.up('w');
      await page.keyboard.press('q');
      await page.keyboard.down('d');
      await page.waitForTimeout(800);
      await page.keyboard.up('d');
      await page.keyboard.press(' ');
      await page.waitForTimeout(1400);
    }
    res.perBiome[n] = await page.evaluate(() => {
      const g = window.__capy;
      const h = g.hud || {};
      return {
        lastError: g.state.lastError || null,
        musicOn: !!(h.musicVolume && h.musicVolume() > 0),
        room: h.roomAudit ? h.roomAudit().biome : 'n/a',
        probe: h.audioProbe ? h.audioProbe(g.capy.position.x + 20, 1, g.capy.position.z) : 'n/a',
        t: Math.round(g.state.time),
      };
    });
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rv-audio.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, res);
}
