async page => {
  await page.reload();
  await page.evaluate(() => {
    window.__err = [];
    const e0 = console.error;
    console.error = function () { window.__err.push([].slice.call(arguments).join(' ')); e0.apply(console, arguments); };
    window.addEventListener('error', ev => window.__err.push('WINDOW ' + (ev.message || ev.error)));
  });
  await page.waitForFunction(() => window.__capy && window.__capy.biome, null, { timeout: 30000 });
  await page.keyboard.press('Digit0');
  await page.waitForFunction(() => window.__capy.biome.current === 'venice', null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const v = window.__capy.venice;
    v.rig = function () { return { w: 1, dist: 20, pitch: 0.34, raise: 1.6, lambda: 3 }; };
  });
  const out = { trace: [], errors: [] };
  // wait for the cradle to be on the stage, then stand the animal in it
  for (let i = 0; i < 60; i++) {
    if (await page.evaluate(() => window.__capy.venice.volo().y < 1.4)) break;
    await page.waitForTimeout(500);
  }
  await page.evaluate(() => {
    const g = window.__capy;
    const p = g.venice.volo();
    g.capy.body.position.set(p.x, p.y + 0.9, p.z);
    g.capy.body.velocity.set(0, 0, 0);
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'qa/volo-stage.png' });
  await page.keyboard.press('KeyE');

  let shotUp = false, shotTop = false, shotDown = false;
  for (let i = 0; i < 90; i++) {
    await page.waitForTimeout(400);
    const s = await page.evaluate(() => {
      const g = window.__capy;
      const p = g.venice.volo();
      const c = g.capy.position;
      return { vy: +p.y.toFixed(2), vz: +p.z.toFixed(1),
               cy: +c.y.toFixed(2), dy: +(c.y - p.y).toFixed(2),
               gap: +Math.hypot(c.x - p.x, c.z - p.z).toFixed(2),
               score: g.state.score };
    });
    out.trace.push(s);
    if (!shotUp && s.vy > 14) { shotUp = true; await page.screenshot({ path: 'qa/volo-up.png' }); }
    if (!shotTop && s.vy > 32.5) { shotTop = true; await page.screenshot({ path: 'qa/volo-top.png' }); }
    if (shotTop && !shotDown && s.vy < 20) { shotDown = true; await page.screenshot({ path: 'qa/volo-down.png' }); }
    if (shotDown && s.vy < 2) break;
  }
  out.errors = await page.evaluate(() => window.__err.slice(0, 10));
  out.lastError = await page.evaluate(() => (window.__capy.state && window.__capy.state.lastError) || null);
  out.mods = await page.evaluate(() => { const g=window.__capy; return { biome: g.biome.current, tide: g.venice && g.venice.waterLevel }; });
  out.done = await page.evaluate(() => [].slice.call(document.querySelectorAll('.done'))
    .map(e => (e.textContent || '').trim()));
  await page.evaluate(async o => {
    await fetch('/shot?name=volo-result.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
