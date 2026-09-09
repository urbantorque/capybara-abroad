async page => {
  // The ledger's last line, looked at rather than measured: qa/q2-foot.js has
  // the numbers. The file is the measured masher's — eight names that are two
  // names — which is the one this sentence was written for.
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(6000);
  await page.evaluate(() => {
    const g = window.__capy;
    g.hud.forceRep({ 'hat-trick': 7, 'kleptomania': 1 });
    g.hud.forceNoto(6, 6, 3, 2, 1);
    g.biome.switchTo('venice');
    for (let i = 0; i < 60 * 14; i++) g.tick(1 / 60, false);
    g.hud.ledger();
    for (let i = 0; i < 40; i++) g.tick(1 / 60, false);
    const el = document.querySelector('.capyui-led');
    if (el) el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'qa/Q2-ledger.png' });
  const foot = await page.evaluate(() => {
    const f = document.querySelector('.capyui-ledfoot');
    const s = document.querySelector('.capyui-ledsub');
    return { foot: f ? f.textContent : null, sub: s ? s.textContent : null };
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.evaluate((o) => fetch('/shot?name=q2-ledshot.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), foot);
}
