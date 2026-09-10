async page => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector('.capyui-go').click());
  await page.waitForTimeout(3000);

  const plan = [
    ['kyoto',   ['to-kyoto','lantern-topple','torii-run','zen-ruin']],
    ['antarctic',['to-antarctic','take-tiller','station-mug','haul-out']],
    ['monaco',  ['to-monaco','superyacht','black-tie','high-dive','palace-guard','pass-the-door','the-floor','chip-stack','champagne']],
    ['hanoi',   ['to-hanoi','cross-the-road','pho-raid','flower-bike']],
    ['cave',    ['to-cave','first-echo','glow-trail','cave-river']],
    ['goreme',  ['to-cappadocia','dovecote','the-tether','the-envelope','the-mouth','aboard']],
  ];
  const out = [];
  for (const [b, ticks] of plan) {
    await page.evaluate(bb => window.__capy.hud.cross(bb), b);
    await page.waitForTimeout(2400);
    await page.evaluate(ids => { ids.forEach(i => window.__capy.hud.completeTask(i)); }, ticks);
    await page.waitForTimeout(2600);
    const r = await page.evaluate(() => {
      const rows = [];
      let over = 0;
      document.querySelectorAll('.capyui-task').forEach(e => {
        if (e.classList.contains('capyui-hidden')) return;
        if (e.scrollWidth > e.clientWidth + 1) over++;
        const rb = e.getBoundingClientRect();
        rows.push((e.textContent || '').trim() + ' [h' + Math.round(rb.height) + ']');
      });
      return { rows, over };
    });
    out.push({ b, over: r.over, rows: r.rows });
    await page.screenshot({ path: 'qa/wr-card-' + b + '.png', clip: { x: 0, y: 0, width: 520, height: 480 } });
  }
  return { out, errs: errs.slice(0, 12) };
}
