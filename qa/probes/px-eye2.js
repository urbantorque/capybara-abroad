async page => {
  const out = {};
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4300);
  await page.keyboard.press('BracketLeft');           // 13 = goreme, a chapter with sky in it
  await page.waitForTimeout(6000);
  await page.evaluate(() => document.querySelector('.capyui-touch').classList.add('on'));
  await page.waitForTimeout(400);
  out.layout = await page.evaluate(() => {
    const box = (s) => { const o = document.querySelector(s); if (!o) return null;
      const r = o.getBoundingClientRect();
      return { s, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width),
               h: Math.round(r.height), vis: r.width > 0 && r.height > 0 &&
               getComputedStyle(o).visibility !== 'hidden' }; };
    const sel = ['.capyui-look', '.capyui-menu', '.capyui-back', '.capyui-wheek',
                 '.capyui-grab', '.capyui-hop', '.capyui-slide', '.capyui-map', '.capyui-todo'];
    const bs = sel.map(box).filter(Boolean);
    const ov = [];
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], b = bs[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
        ov.push(a.s + ' x ' + b.s);
    }
    const l = bs.find(b => b.s === '.capyui-look');
    return { boxes: bs, overlaps: ov,
             inViewport: !!l && l.x >= 0 && l.y >= 0 && l.x + l.w <= innerWidth && l.y + l.h <= innerHeight,
             tapTarget: l ? Math.min(l.w, l.h) : 0 };
  });
  await page.screenshot({ path: 'qa/px-eye-touch-before.png' });
  await page.evaluate(() => {
    const el = document.querySelector('.capyui-look');
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true,
      pointerId: 9, pointerType: 'touch', isPrimary: true,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
  });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: 'qa/px-eye-touch-after.png' });
  out.raised = await page.evaluate(() => ({
    sky: +window.__capy.camInfo.sky.toFixed(2),
    pitch: +(window.__capy.camInfo.pitch * 180 / Math.PI).toFixed(1),
    press: document.querySelector('.capyui-look').classList.contains('press'),
  }));
  await page.evaluate(() => {
    document.querySelector('.capyui-look').dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 9, pointerType: 'touch' }));
  });
  out.err = await page.evaluate(() => window.__capy.state.lastError || null);
  await page.evaluate(o => fetch('/shot?name=px-eye2.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
