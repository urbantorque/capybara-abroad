async page => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector('.capyui-go').click());
  await page.waitForTimeout(3000);
  const started = await page.evaluate(() => window.__capy && window.__capy.state && window.__capy.state.started);
  const report = await page.evaluate(() => {
    const T = window.__capy.TASKS || (window.__capy.shared && window.__capy.shared.TASKS);
    if (!T) return { err: 'no TASKS on __capy', keys: Object.keys(window.__capy) };
    const bad = [], long = [], seen = {}, dup = [];
    const verbs = {};
    for (const t of T) {
      if (!t.text || typeof t.text !== 'string' || !t.text.trim()) bad.push(t.id);
      if (t.text && t.text.length > 46) long.push(t.id + ' (' + t.text.length + ') ' + t.text);
      if (seen[t.id]) dup.push(t.id); seen[t.id] = 1;
      const v = (t.text || '').split(' ')[0];
      verbs[v] = (verbs[v] || 0) + 1;
    }
    const top = Object.entries(verbs).sort((a, b) => b[1] - a[1]).slice(0, 10);
    return { n: T.length, bad, long, dup, top };
  });
  return { started, report, errs: errs.slice(0, 10) };
}
