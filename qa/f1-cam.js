async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(3500);
  const cross = n => page.evaluate(function (n) {
    const g = window.__capy;
    try { g.hud.cross(n); } catch (e) { g.biome.switchTo(n); }
    return true;
  }, n);
  const row = tag => page.evaluate(function (tag) {
    const g = window.__capy, ci = g.camInfo, c = g.camera.position, p = g.capy.position;
    const o = { tag: tag, biome: g.biome.current,
                dist: +Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z).toFixed(2) };
    for (const k in ci) o[k] = +(+ci[k]).toFixed(2);
    return o;
  }, tag);
  const out = [];
  // Control: default zoom.
  await cross('sydney'); await wait(6000);
  out.push(await row('sydney default'));
  for (const n of ['manly', 'antarctic', 'rio', 'kowloon']) {
    await cross(n); await wait(9000); out.push(await row(n + ' <- default'));
    await cross('sydney'); await wait(5000);
  }
  // Now zoom all the way out and repeat, so an inherited target would show.
  for (let i = 0; i < 20; i++) await page.mouse.wheel(0, 120);
  await wait(3000);
  out.push(await row('sydney ZOOMED'));
  for (const n of ['manly', 'antarctic', 'rio', 'kowloon']) {
    await cross(n); await wait(9000); out.push(await row(n + ' <- ZOOMED'));
    await page.screenshot({ path: 'qa/F1C-' + n + '-zoomed.png' });
    await cross('sydney'); await wait(5000);
    for (let i = 0; i < 20; i++) await page.mouse.wheel(0, 120);
    await wait(2000);
  }
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), { out });
  await page.evaluate(s => fetch('/shot?name=f1-cam.json', { method: 'POST', body: s }), bl);
}
