async page => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector('.capyui-go').click());
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.__capy.hud.cross('iceland'));
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'qa/wr-iceland-title.png' });
  await page.waitForTimeout(4000);
  await page.evaluate(() => ['to-iceland','pylsa','organ','puffins','geysir','glacier-run','snowcat']
    .forEach(i => window.__capy.hud.completeTask(i)));
  await page.waitForTimeout(2600);
  await page.screenshot({ path: 'qa/wr-iceland-card.png', clip: { x: 0, y: 0, width: 520, height: 420 } });
  const rows = await page.evaluate(() => {
    const o = [];
    document.querySelectorAll('.capyui-task').forEach(e => {
      if (!e.classList.contains('capyui-hidden')) o.push((e.textContent || '').trim());
    });
    return o;
  });
  return { rows, errs: errs.slice(0, 10) };
}
