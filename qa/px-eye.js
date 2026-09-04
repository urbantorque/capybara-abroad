async page => {
  const out = {};
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(4300);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(5500);
  const snap = () => page.evaluate(() => {
    const g = window.__capy, c = g.camera.position, p = g.capy.position;
    const dy = c.y - p.y, hz = Math.hypot(c.x - p.x, c.z - p.z);
    return { sky: +g.camInfo.sky.toFixed(2), pitch: +(g.camInfo.pitch * 180 / Math.PI).toFixed(1),
             look: +(Math.atan2(dy, hz) * 180 / Math.PI).toFixed(1),
             dy: +dy.toFixed(2), dist: +Math.hypot(c.x - p.x, dy, c.z - p.z).toFixed(2) };
  });

  // ---- 1. the key, as the reference ---------------------------------------
  out.key0 = await snap();
  await page.keyboard.down('KeyV'); await page.waitForTimeout(2500);
  out.key1 = await snap();
  await page.keyboard.up('KeyV'); await page.waitForTimeout(2500);

  // ---- 2. the touch button -------------------------------------------------
  out.btn = await page.evaluate(() => {
    const el = document.querySelector('.capyui-look');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    document.querySelector('.capyui-touch').classList.add('on');
    return { w: +r.width.toFixed(0), h: +r.height.toFixed(0), top: +r.top.toFixed(0),
             right: +(innerWidth - r.right).toFixed(0),
             label: el.getAttribute('aria-label'), role: el.getAttribute('role'),
             glyph: !!el.querySelector('svg'),
             // Does it land on top of anything else in the column?
             hits: ['.capyui-menu', '.capyui-back', '.capyui-chart', '.capyui-map']
               .map(s => { const o = document.querySelector(s); if (!o) return null;
                 const q = o.getBoundingClientRect();
                 const ov = !(q.right < r.left || q.left > r.right || q.bottom < r.top || q.top > r.bottom);
                 return ov ? s : null; }).filter(Boolean) };
  });
  out.touch0 = await snap();
  await page.evaluate(() => {
    const el = document.querySelector('.capyui-look');
    const r = el.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch',
                clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, isPrimary: true };
    el.dispatchEvent(new PointerEvent('pointerdown', o));
  });
  await page.waitForTimeout(2500);
  out.touch1 = await snap();
  out.pressed = await page.evaluate(() => document.querySelector('.capyui-look').classList.contains('press'));
  await page.evaluate(() => {
    const el = document.querySelector('.capyui-look');
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch' }));
  });
  await page.waitForTimeout(2500);
  out.touch2 = await snap();

  // ---- 3. the pad: R3 tapped, then held ------------------------------------
  await page.evaluate(() => {
    window.__padB = new Array(17).fill(0);
    const mk = () => ({ index: 0, connected: true, mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: window.__padB.map(v => ({ pressed: !!v, touched: !!v, value: v })) });
    navigator.getGamepads = () => [mk()];
  });
  await page.waitForTimeout(700);
  out.padSeen = await page.evaluate(() => { const g = window.__capy; return !!g; });
  // a TAP: down for ~100 ms
  const yaw0 = await page.evaluate(() => +window.__capy.input.camYaw.toFixed(3));
  await page.evaluate(() => { window.__padB[11] = 1; });
  await page.waitForTimeout(100);
  await page.evaluate(() => { window.__padB[11] = 0; });
  await page.waitForTimeout(1200);
  out.tap = await snap();
  out.tapYawMoved = await page.evaluate(y0 => Math.abs(window.__capy.input.camYaw - y0) > 0.001, yaw0);
  await page.waitForTimeout(1800);
  out.pad0 = await snap();
  // a HOLD
  await page.evaluate(() => { window.__padB[11] = 1; });
  await page.waitForTimeout(2600);
  out.pad1 = await snap();
  await page.evaluate(() => { window.__padB[11] = 0; });
  await page.waitForTimeout(2500);
  out.pad2 = await snap();
  out.err = await page.evaluate(() => window.__capy.state.lastError || null);
  await page.evaluate(o => fetch('/shot?name=px-eye.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
