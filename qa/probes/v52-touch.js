async page => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(8000);

  const out = await page.evaluate(() => {
    // Force the touch layer on, as a real phone's media query would.
    const t = document.querySelector('.capyui-touch');
    if (t) t.classList.add('on');
    const box = el => { if (!el) return null; const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const named = {};
    ['.capyui-wheek', '.capyui-grab', '.capyui-hop', '.capyui-zone', '.capyui-map',
     '.capyui-todo', '.capyui-stam', '.capyui-clue'].forEach(s => { named[s] = box(document.querySelector(s)); });

    // pairwise overlap of the interactive things
    const keys = Object.keys(named).filter(k => named[k] && named[k].w > 0);
    const overlaps = [];
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      const a = named[keys[i]], b = named[keys[j]];
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 0 && oy > 0) overlaps.push({ a: keys[i], b: keys[j], px: ox * oy });
    }
    // Touch targets under 44px fail the standard guideline.
    const small = keys.filter(k => named[k].w < 44 || named[k].h < 44)
                      .map(k => ({ el: k, w: named[k].w, h: named[k].h }));
    return { viewport: innerWidth + 'x' + innerHeight, boxes: named, overlaps: overlaps, undersized: small };
  });

  await page.evaluate(o => fetch('/shot?name=v52-touch.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
