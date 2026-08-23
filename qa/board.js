async page => {
  // Pasto's crater is the one exit with no extra gate on it, so it is the
  // cheapest place to test the departures board end to end.
  await page.mouse.click(400, 400);
  await page.waitForTimeout(1200);
  // stand in Cappadocia and Venice first so the board has a >9 destination open
  await page.evaluate(() => { window.__capy.biome.switchTo('goreme'); });
  await page.waitForTimeout(600);
  await page.evaluate(() => { window.__capy.biome.switchTo('venice'); });
  await page.waitForTimeout(600);
  const put = async () => page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('pasto');
    const cc = g.pasto.craterCentre;
    const y = g.pasto.terrainHeight(cc.x, cc.z) + 1.2;
    const b = g.capy.body;
    b.position.set(cc.x, y, cc.z); b.velocity.set(0, 0, 0);
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    return { at: [cc.x, +y.toFixed(1), cc.z] };
  });
  const res = { at: await put() };
  await page.waitForTimeout(1500);
  // three wheeks
  for (let i = 0; i < 3; i++) { await page.keyboard.press('q'); await page.waitForTimeout(350); }
  await page.waitForTimeout(400);
  res.board = await page.evaluate(() => {
    const el = document.querySelector('.capyui-jr');
    const rows = [...document.querySelectorAll('.capyui-jrrow')].map(r => ({
      key: r.querySelector('.capyui-jrn').textContent,
      name: r.querySelector('.capyui-jrname').textContent,
      locked: r.classList.contains('locked'),
      go: r.classList.contains('go'),
    }));
    return { shown: !!(el && el.classList.contains('show')), foot: document.querySelector('.capyui-jrfoot') ? document.querySelector('.capyui-jrfoot').textContent : '', rows };
  });
  // press '[' -> chapter 13, Cappadocia
  await page.keyboard.press('[');
  await page.waitForTimeout(3000);
  res.afterBracket = await page.evaluate(() => window.__capy.biome.current);
  await page.evaluate(async (o) => {
    await fetch('/shot?name=board.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, res);
}
