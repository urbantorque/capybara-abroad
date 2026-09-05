async page => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5188/');
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6500);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(3000);           // well past the deal-in
  const tile = page.locator('.capyui-picks .capyui-pick').nth(2);
  const before = await tile.evaluate(e => getComputedStyle(e).transform);
  await tile.hover();
  await page.waitForTimeout(400);
  const after = await tile.evaluate(e => getComputedStyle(e).transform);
  const anim = await tile.evaluate(e => {
    const cs = getComputedStyle(e);
    return { name: cs.animationName, fill: cs.animationFillMode,
             running: e.getAnimations().map(a => a.playState + ':' + (a.animationName || '')) };
  });
  await page.evaluate(o => { document.title = JSON.stringify(o); },
    { before, after, anim, lifted: before !== after });
}
