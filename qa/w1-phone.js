async page => {
  // THE PHONE'S POSTCARD (W1). The share rung is the phone's rung and the
  // phone has the smallest drawing buffer in the game — 360 x 740, measured —
  // so the composite is upscaling into a 1148 x 596 picture area. A postcard
  // that is a soft mess on the one device that can share it is the whole
  // feature not working, and no number says so.
  await page.reload();
  await page.waitForTimeout(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(8000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1200);
  const out = await page.evaluate(() => {
    const g = window.__capy;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    g.hud.forceNoto(9, 5, 4, 0, 0);
    g.biome.switchTo('cali');
    tick(60 * 14);
    try {
      const c = g.capy, mod = g[g.biome.current], p = c.position;
      if (mod && mod.terrainHeight) {
        c.body.position.set(p.x, mod.terrainHeight(p.x, p.z) + 0.5, p.z);
        c.body.velocity.set(0, 0, 0);
        tick(90);
      }
    } catch (e) {}
    const cv = document.querySelector('canvas');
    return { buf: [cv.width, cv.height], line: g.cardDebug('line'),
             touch: !!(g.hud.isTouch && g.hud.isTouch()) };
  });
  await page.evaluate(() => {
    const u = window.__capy.cardDebug();
    return fetch('/shot?name=W1-phone', { method: 'POST', body: u.split(',')[1] });
  });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.evaluate((o) => fetch('/shot?name=w1-phone.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
