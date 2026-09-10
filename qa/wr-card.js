async page => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector('.capyui-go').click());
  await page.waitForTimeout(3000);
  const hudKeys = await page.evaluate(() => Object.keys(window.__capy.hud));
  const cls = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll('[class]').forEach(e => {
      const c = e.className;
      if (typeof c === 'string' && /todo|card|task|paper/i.test(c)) out[c] = (out[c] || 0) + 1;
    });
    return out;
  });
  return { hudKeys, cls, errs: errs.slice(0, 5) };
}
