async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.__capy.biome.switchTo('monaco'); });
  await page.waitForTimeout(3000);

  // Do the task for real: put the animal on the sun deck by the jacket and
  // grab it, so the costume comes on through the same path a player takes.
  const got = await page.evaluate(async () => {
    const g = window.__capy;
    const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
    const b = g.capy.body;
    b.position.set(11.2, 9.2, -61.4); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    for (let i = 0; i < 12; i++) {
      down('KeyE');
      await new Promise(r => setTimeout(r, 120));
      up('KeyE');
      await new Promise(r => setTimeout(r, 300));
      if (g.taskDone('black-tie')) break;
    }
    return { blackTie: g.taskDone('black-tie'), dressed: g.capy.dressed,
             err: g.state.lastError || null };
  });
  await page.waitForTimeout(2500);

  for (const s of [{ n: 'T4-tux-3q', yaw: 0.9 }, { n: 'T5-tux-face', yaw: 3.14 },
                   { n: 'T6-tux-side', yaw: 1.57 }]) {
    await page.evaluate((q) => {
      const g = window.__capy;
      if (typeof g.frameShot === 'function') {
        g.frameShot({ yaw: q.yaw, dist: 3.4, pitch: 0.10, raise: 0.5, hold: 3.0 });
      }
    }, s);
    await page.waitForTimeout(1400);
    await page.screenshot({ path: 'qa/' + s.n + '.png' });
    await page.waitForTimeout(2200);
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=tuxwear2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, got);
}
