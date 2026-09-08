async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(4800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  // The loaf and the nap from the same lens, so the difference is the only
  // thing that changed. A pose that reads in a description and not in a still
  // is a pose nobody has: this is the whole test.
  for (const shot of [{ name: 'loaf', wait: 10 }, { name: 'nap', wait: 40 }]) {
    await page.evaluate(async (o) => {
      const g = window.__capy;
      if (window.__pinStop) { window.__pinStop(); window.__pinStop = null; }
      g.biome.switchTo('sydney');
      for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
      g.capy.body.position.set(6, 1.0, 34);
      g.capy.body.velocity.set(0, 0, 0);
      for (let i = 0; i < 60 * o.wait; i++) g.tick(1 / 60, false);
      let alive = true;
      const loop = () => { if (!alive) return; requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
      window.__pinStop = () => { alive = false; };
      // close, and level with the animal: the nap is a head going down and two
      // ears going out, and neither reads from the marquee lens.
      g.frameShot({ yaw: 2.35, dist: 1.9, pitch: 0.30, hold: 30, w: 1 });
      return null;
    }, shot);
    await page.waitForTimeout(2200);
    await page.screenshot({ path: 'qa/N4-' + shot.name + '.png' });
    // ...AND A CROP, because the difference between a loafing capybara and a
    // sleeping one is a head, two ears and four centimetres, and none of that
    // survives being 90 px wide in a 1280 px frame. `sysCAM_MIN` clamps the
    // boom, so the lens cannot come closer; the crop is the only way to look
    // at the pose the way a player leaning in would.
    await page.screenshot({ path: 'qa/N4-' + shot.name + '-close.png',
                            clip: { x: 470, y: 420, width: 420, height: 250 } });
    await page.evaluate((n) => {
      const g = window.__capy;
      return fetch('/shot?name=n4-' + n + '.json', {
        method: 'POST',
        body: btoa(unescape(encodeURIComponent(JSON.stringify({
          nap: +g.capy.nap.toFixed(3), loaf: +g.capy.loaf.toFixed(3),
          rest: +g.capy.restT.toFixed(1),
        })))),
      });
    }, shot.name);
  }
  await page.evaluate(() => { if (window.__pinStop) window.__pinStop(); });
}
