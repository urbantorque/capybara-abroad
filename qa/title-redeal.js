async page => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:5188/');
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6500);
  const look = () => page.evaluate(() => {
    const t = document.querySelector('.capyui-picks .capyui-pick:nth-child(6)');
    if (!t) return null;
    return { op: +(+getComputedStyle(t).opacity).toFixed(2),
      anims: t.getAnimations().map(a => a.playState) };
  });
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(260);            // just after the swap
  const first = await look();
  await page.waitForTimeout(2500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1400);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(260);            // same moment, second visit
  const second = await look();
  await page.evaluate(o => { document.title = JSON.stringify(o); },
    { first, second, redeals: !!(second && second.op < 0.99) });
}
