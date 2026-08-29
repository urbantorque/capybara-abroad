async page => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'qa/UI-p1-390.png' });
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1600);
  await page.screenshot({ path: 'qa/UI-p2-390.png' });
  const wide = await page.evaluate(() => ({
    docW: document.documentElement.scrollWidth,
    winW: window.innerWidth,
    titleW: document.querySelector('.capyui-title').scrollWidth,
  }));
  // ...and back to a desktop window, then actually go somewhere
  await page.setViewportSize({ width: 1280, height: 760 });
  await page.waitForTimeout(900);
  await page.locator('.capyui-pick').nth(2).click();
  await page.waitForTimeout(9000);
  const run = await page.evaluate(() => {
    const g = window.__capy;
    return { biome: g.biome.current, started: !!g.state.started,
             err: g.state.lastError ? String(g.state.lastError).slice(0, 140) : '',
             titleGone: !!document.querySelector('.capyui-title.gone') };
  });
  await page.screenshot({ path: 'qa/UI-ingame.png' });
  await page.evaluate(o => fetch('/shot?name=uimobile.json', {
    method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), { wide, run });
}
