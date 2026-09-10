async page => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector('.capyui-go').click());
  await page.waitForTimeout(3000);

  const biomes = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                  'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic',
                  'monaco','hanoi'];
  const shots = ['sydney','kyoto','iceland','palawan','antarctic','hanoi'];
  const out = [];
  const allText = new Set();
  let empties = 0;

  for (const b of biomes) {
    await page.evaluate(bb => window.__capy.hud.cross(bb), b);
    await page.waitForTimeout(2600);
    const r = await page.evaluate(() => {
      const card = document.querySelector('.capyui-todo');
      const cb = card.getBoundingClientRect();
      const rows = [];
      let over = 0, empty = 0;
      document.querySelectorAll('.capyui-task').forEach(e => {
        if (e.classList.contains('capyui-hidden')) return;
        const t = (e.textContent || '').trim();
        if (!t) empty++;
        const rb = e.getBoundingClientRect();
        if (e.scrollWidth > e.clientWidth + 1) over++;
        rows.push({ t, h: Math.round(rb.height), w: Math.round(rb.width) });
      });
      return { card: { w: Math.round(cb.width), h: Math.round(cb.height), x: Math.round(cb.x), y: Math.round(cb.y) },
               rows, over, empty, vw: window.innerWidth };
    });
    empties += r.empty;
    r.rows.forEach(x => allText.add(x.t));
    out.push({ b, card: r.card, over: r.over, empty: r.empty,
               maxH: Math.max(...r.rows.map(x => x.h)), n: r.rows.length,
               rows: r.rows.map(x => x.t) });
    if (shots.includes(b)) {
      await page.screenshot({ path: 'qa/wr-card-' + b + '.png',
        clip: { x: 0, y: 0, width: Math.min(560, r.vw), height: 460 } });
    }
  }
  return { out, empties, errs: errs.slice(0, 12) };
}
