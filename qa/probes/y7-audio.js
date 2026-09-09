async page => {
  await page.reload(); await page.waitForTimeout(6000);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(1500);
  for (const b of ['iceland','sahara','drift']) {
    await page.evaluate((n) => {
      const g = window.__capy;
      g.biome.switchTo(n);
      const sp = g.biome.spawnOf(n), cb = g.capy.body;
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0,0,0);
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
    }, b);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(9000);
    await page.keyboard.up('KeyW');
    await page.keyboard.press('KeyQ');
    await page.waitForTimeout(3000);
  }
  const out = await page.evaluate(() => {
    const g = window.__capy;
    return { err: g.state.lastError || null, started: g.state.started, t: +g.state.time.toFixed(1) };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=y7audio.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
