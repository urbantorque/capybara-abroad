async page => {
  await page.reload();
  await page.evaluate(() => {
    window.__err = [];
    const e0 = console.error;
    console.error = function () { window.__err.push([].slice.call(arguments).join(' ')); e0.apply(console, arguments); };
    window.addEventListener('error', ev => window.__err.push('WINDOW ' + (ev.message || ev.error)));
  });
  await page.waitForFunction(() => window.__capy && window.__capy.biome, null, { timeout: 30000 });
  await page.keyboard.press('Digit6');
  await page.waitForFunction(() => window.__capy.biome.current === 'rio', null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const r = window.__capy.rio;
    r.rig = function () { return { w: 1, dist: 22, pitch: 0.30, raise: 1.6, lambda: 3 }; };
  });
  const out = { trace: [], errors: [] };
  // wait for tram 0 to be down at the street terminus, then stand on its board
  for (let i = 0; i < 80; i++) {
    if (await page.evaluate(() => window.__capy.rio.bonde().x > 34)) break;
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => {
    const g = window.__capy;
    const b = g.rio.bonde();
    g.capy.body.position.set(b.x, b.y + 1.4, b.z + 1.5);
    g.capy.body.velocity.set(0, 0, 0);
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'qa/bonde-street.png' });

  let shotRamp = false, shotArch = false, shotPass = false;
  for (let i = 0; i < 110; i++) {
    await page.waitForTimeout(400);
    const s = await page.evaluate(() => {
      const g = window.__capy;
      const b = g.rio.bonde();
      const c = g.capy.position;
      return { bx: +b.x.toFixed(1), by: +b.y.toFixed(2),
               cy: +c.y.toFixed(2), dy: +(c.y - b.y).toFixed(2),
               gap: +Math.hypot(c.x - b.x, c.z - b.z).toFixed(2),
               score: g.state.score };
    });
    out.trace.push(s);
    if (!shotRamp && s.by > 8 && s.by < 15) { shotRamp = true; await page.screenshot({ path: 'qa/bonde-ramp.png' }); }
    if (!shotArch && s.bx < -2 && s.by > 16) { shotArch = true; await page.screenshot({ path: 'qa/bonde-arch.png' }); }
    if (!shotPass && s.bx < -16 && s.bx > -24) { shotPass = true; await page.screenshot({ path: 'qa/bonde-pass.png' }); }
    if (s.bx < -40) break;
  }
  out.errors = await page.evaluate(() => window.__err.slice(0, 10));
  out.done = await page.evaluate(() => [].slice.call(document.querySelectorAll('.done'))
    .map(e => (e.textContent || '').trim()));
  await page.evaluate(async o => {
    await fetch('/shot?name=bonde-result.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
