async page => {
  // The claim is that these things swing. Two pictures at the two ends of the
  // range: Antarctica's windsock, which had the strongest air of the nineteen,
  // and Son Doong's chime, which has none at all and only answers a shout.
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} });
  await page.setViewportSize({ width: 1280, height: 760 });
  await page.goto('http://localhost:5188/');
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(5000);
  for (const [name, file] of [['antarctic', 'qa/d10s-sock.png'], ['cave', 'qa/d10s-chime.png']]) {
    await page.evaluate(n => window.__capy.biome.switchTo(n), name);
    await wait(2600);
    await page.evaluate(() => {
      const g = window.__capy, r = g.hangAudit().rows[0], b = g.capy.body;
      // Stand under it and look at it: frameShot's yaw is the bearing FROM the
      // animal TO the camera, so the thing has to be BEHIND the animal.
      b.position.set(r.x + 1.6, r.y - 1.4, r.z + 1.6);
      b.velocity.set(0, 0, 0);
    });
    await wait(1400);
    await page.evaluate(() => window.__capy.frameShot({ yaw: Math.PI * 0.75, dist: 5.5,
                                                        pitch: -0.30, raise: 1.6, hold: 9 }));
    await wait(1200);
    await page.keyboard.press('KeyQ');   // the channel with no weather in it
    await wait(700);
    await page.screenshot({ path: file });
  }
}
