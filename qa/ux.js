async page => {
  const res = {};
  await page.mouse.click(400, 400);
  await page.waitForTimeout(1500);
  const read = () => page.evaluate(() => {
    const rows = [...document.querySelectorAll('.capyui-task')]
      .filter(li => !li.classList.contains('capyui-hidden'))
      .map(li => ({ t: li.querySelector('.capyui-txt').textContent,
                    aim: li.querySelector('.capyui-aim').classList.contains('on'),
                    d: li.querySelector('.capyui-aim').textContent }));
    return { rows, clue: document.querySelector('.capyui-clue').textContent,
             count: document.querySelector('.capyui-count').textContent };
  });
  res.before = await read();
  await page.keyboard.press('f'); await page.waitForTimeout(700);
  res.afterF = await read();
  await page.keyboard.press('f'); await page.waitForTimeout(700);
  res.afterFF = await read();
  for (let i = 0; i < 12; i++) { await page.keyboard.press('f'); await page.waitForTimeout(200); }
  await page.waitForTimeout(600);
  res.afterWrap = await read();
  // help card
  await page.keyboard.press('h'); await page.waitForTimeout(600);
  res.help = await page.evaluate(() => ({
    shown: document.querySelector('.capyui-jr').classList.contains('show'),
    keysOpen: document.querySelector('.capyui-jrkeys').open,
    legend: [...document.querySelectorAll('.capyui-jrkeys kbd')].map(k => k.textContent),
    paused: window.__capy.state.paused,
  }));
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  res.afterEsc = await page.evaluate(() => ({
    shown: document.querySelector('.capyui-jr').classList.contains('show'),
    paused: window.__capy.state.paused,
  }));
  // Escape as pause
  await page.keyboard.press('Escape'); await page.waitForTimeout(600);
  res.escPause = await page.evaluate(() => ({
    shown: document.querySelector('.capyui-jr').classList.contains('show'),
    paused: window.__capy.state.paused,
  }));
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  // put me back
  res.back = await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
    const g = window.__capy;
    return { start: [+g.capy.position.x.toFixed(1), +g.capy.position.z.toFixed(1)] };
  });
  await page.keyboard.down('w'); await page.waitForTimeout(5000); await page.keyboard.up('w');
  res.back.walked = await page.evaluate(() => [+window.__capy.capy.position.x.toFixed(1), +window.__capy.capy.position.z.toFixed(1)]);
  await page.keyboard.down('r'); await page.waitForTimeout(1200); await page.keyboard.up('r');
  await page.waitForTimeout(600);
  res.back.after = await page.evaluate(() => [+window.__capy.capy.position.x.toFixed(1), +window.__capy.capy.position.z.toFixed(1)]);
  res.lastError = await page.evaluate(() => window.__capy.state.lastError || null);
  await page.evaluate(async (o) => {
    await fetch('/shot?name=ux.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, res);
}
