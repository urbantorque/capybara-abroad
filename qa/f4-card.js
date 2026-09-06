async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(5000);
  const out = {};
  const shoot = async (name) => {
    const box = await page.evaluate(() => {
      const el = document.querySelector('.capyui-todo');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    });
    if (box && box.w > 0) {
      await page.screenshot({ path: 'qa/F4-card-' + name + '.png',
        clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: box.w + 16, height: box.h + 16 } });
    }
    return box;
  };
  // Tick forward until the marquee and the middle rung are in the window: the
  // card shows the next few OPEN rows, so a chapter's set pieces are not on it
  // at the start of that chapter — which is the point of the card.
  await page.evaluate(() => {
    const g = window.__capy;
    ['wheek','steal-hat','coffee-spill','picnic-thief','bin-chicken','dig-flower','chased','photo-op'].forEach(id => g.completeTask(id));
    return true;
  });
  await wait(2500);
  out.sydney = await shoot('sydney');
  // What is actually on the visible rows: the tier mark and the clock.
  out.rows = await page.evaluate(() => {
    const li = document.querySelectorAll('.capyui-todo li.capyui-task:not(.capyui-hidden)');
    const r = [];
    li.forEach(function (e) {
      const t = e.querySelector('.capyui-tier');
      const m = e.querySelector('.capyui-meas');
      const g = t ? t.querySelector('svg') : null;
      const rect = t ? t.getBoundingClientRect() : null;
      r.push({ txt: (e.querySelector('.capyui-txt') || {}).textContent,
               tier: t ? t.className.replace('capyui-tier ', '') : null,
               aria: t ? t.getAttribute('aria-label') : null,
               poly: g ? g.querySelectorAll('polygon').length : 0,
               w: rect ? +rect.width.toFixed(1) : 0, h: rect ? +rect.height.toFixed(1) : 0,
               timed: !!m });
    });
    return r;
  });
  // ...and Venice, which has a marquee AND a timed row in the same window.
  await page.evaluate(() => { window.__capy.biome.switchTo('venice'); return true; });
  await wait(3500);
  out.venice = await shoot('venice');
  out.err = await page.evaluate(() => window.__capy.state.lastError ? String(window.__capy.state.lastError) : null);
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f4-card.json', { method: 'POST', body: s }), bl);
}
