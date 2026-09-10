async page => {
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector('.capyui-go').click());
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.__capy.hud.cross('iceland'));
  for (let i = 1; i <= 5; i++) {
    await page.waitForTimeout(900);
    await page.screenshot({ path: 'qa/wr-ice-t' + i + '.png' });
  }
  return { errs };
}
