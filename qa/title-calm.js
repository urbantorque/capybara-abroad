async page => {
  const sample = async () => {
    const a = await page.evaluate(() => window.__capy.camera.position.toArray());
    await page.waitForTimeout(7000);
    const b = await page.evaluate(() => ({
      p: window.__capy.camera.position.toArray(),
      calm: window.__capy.calm !== undefined ? window.__capy.calm : null,
      reach: +window.__capy.camInfo.reach.toFixed(3),
    }));
    return { moved: +(Math.abs(b.p[0] - a[0]) + Math.abs(b.p[1] - a[1]) +
                      Math.abs(b.p[2] - a[2])).toFixed(4), reach: b.reach };
  };
  const out = {};
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('http://localhost:5188/');
  await page.reload();
  await page.waitForTimeout(6500);
  out.normal = await sample();
  await page.screenshot({ path: 'qa/TC-normal.png' });

  // calmOn() follows prefers-reduced-motion when the player has set no
  // preference of their own, so this is the whole switch, not a proxy for it.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.waitForTimeout(6500);
  out.reduced = await sample();
  await page.screenshot({ path: 'qa/TC-reduced.png' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await page.evaluate(o => fetch('/shot?name=tc.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
