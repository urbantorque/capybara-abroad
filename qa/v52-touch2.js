async page => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'hover', value: 'none' }, { name: 'pointer', value: 'coarse' }]
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(7000);

  const out = {};
  out.title = await page.evaluate(() => ({
    legend: Array.from(document.querySelectorAll('.capyui-legbig kbd')).map(k => k.textContent),
    matches: window.matchMedia('(hover: none) and (pointer: coarse)').matches
  }));

  // start the game
  await page.evaluate(() => {
    const c = document.querySelector('canvas');
    c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 1 }));
  });
  await page.waitForTimeout(3000);

  out.layout = await page.evaluate(() => {
    const box = s => { const el = document.querySelector(s); if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const sel = ['.capyui-wheek', '.capyui-grab', '.capyui-hop', '.capyui-slide',
                 '.capyui-back', '.capyui-map', '.capyui-zone'];
    const b = {}; sel.forEach(s => b[s] = box(s));
    const live = sel.filter(s => b[s] && b[s].w > 0);
    const over = [];
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const A = b[live[i]], B = b[live[j]];
      const ox = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
      const oy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
      if (ox > 0 && oy > 0) over.push({ a: live[i], b: live[j], px: ox * oy });
    }
    const btns = ['.capyui-wheek', '.capyui-grab', '.capyui-hop', '.capyui-slide', '.capyui-back'];
    return {
      touchOn: document.querySelector('.capyui-touch').classList.contains('on'),
      boxes: b,
      overlaps: over,
      undersized: btns.filter(s => b[s] && (b[s].w < 44 || b[s].h < 44)),
      offscreen: btns.filter(s => b[s] && (b[s].x < 0 || b[s].y < 0 ||
                   b[s].x + b[s].w > innerWidth || b[s].y + b[s].h > innerHeight))
    };
  });

  // ---- does SLIDE actually set input.slide? ----
  out.slide = await page.evaluate(() => new Promise(res => {
    const el = document.querySelector('.capyui-slide');
    const g = window.__capy;
    const before = g.input.slide;
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 7 }));
    setTimeout(() => {
      const during = g.input.slide;
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', pointerId: 7 }));
      setTimeout(() => res({ before: before, during: during, after: g.input.slide }), 300);
    }, 500);
  }));

  // ---- does holding STUCK actually move the animal back? ----
  out.rescue = await page.evaluate(() => new Promise(res => {
    const g = window.__capy;
    const el = document.querySelector('.capyui-back');
    // walk a little so there is a breadcrumb that is not here
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true }));
    setTimeout(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }));
      const p = g.capy.group.position;
      const from = { x: p.x, z: p.z };
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 8 }));
      setTimeout(() => {
        el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', pointerId: 8 }));
        const q = g.capy.group.position;
        res({ from: from, to: { x: Math.round(q.x * 10) / 10, z: Math.round(q.z * 10) / 10 },
              moved: Math.round(Math.hypot(q.x - from.x, q.z - from.z) * 10) / 10 });
      }, 1400);
    }, 4000);
  }));

  await page.evaluate(o => fetch('/shot?name=v52-touch2.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
