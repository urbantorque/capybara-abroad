async page => {
  await page.reload();
  await page.waitForFunction(() => window.__capy && window.__capy.biome, null, { timeout: 30000 });
  await page.keyboard.press('Digit1');
  await page.waitForFunction(() => window.__capy.state.started, null, { timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__capy.biome.switchTo('drift'));
  await page.waitForTimeout(2500);
  // walk off the jetty and simply wait in the cloud
  const trace = [];
  await page.evaluate(() => {
    const g = window.__capy;
    g.capy.body.position.set(30, 28, 34);
    g.capy.body.velocity.set(0, 0, 0);
  });
  for (let i = 0; i < 90; i++) {
    await page.waitForTimeout(400);
    const s = await page.evaluate(() => {
      const g = window.__capy;
      return { y: +g.capy.position.y.toFixed(1), vy: +g.capy.body.velocity.y.toFixed(1),
               d: [].slice.call(document.querySelectorAll('.done')).map(e => e.textContent.trim()).length };
    });
    trace.push(s);
    const d = await page.evaluate(() => [].slice.call(document.querySelectorAll('.done')).map(e => e.textContent.trim()));
    if (d.join('|').indexOf('hand you back') >= 0) { trace.push('TICKED at i=' + i); break; }
  }
  const done = await page.evaluate(() => [].slice.call(document.querySelectorAll('.done')).map(e => e.textContent.trim()));
  await page.evaluate(async o => {
    await fetch('/shot?name=diag.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, { trace: trace.filter((_, i) => i % 4 === 0 || typeof trace[i] === 'string').slice(0, 30), done: done });
}
