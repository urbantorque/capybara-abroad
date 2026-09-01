async page => {
  // A phone, and never a keypress: the first keydown removes the touch layer.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'hover', value: 'none' }, { name: 'pointer', value: 'coarse' }]
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 4000)));
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  const tap = sel => page.evaluate(s => {
    const el = document.querySelector(s);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch',
                isPrimary: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    el.dispatchEvent(new PointerEvent('pointerdown', o));
    el.dispatchEvent(new PointerEvent('pointerup', o));
    return true;
  }, sel);
  await tap('.capyui-title');
  await wait(6000);
  const st = await page.evaluate(() => {
    const b = document.querySelector('.capyui-menu');
    const r = b && b.getBoundingClientRect();
    return { started: !!window.__capy.state.started,
             layerOn: !!document.querySelector('.capyui-touch.on'),
             menu: r ? { top: Math.round(r.top), right: Math.round(innerWidth - r.right) } : null };
  });
  await page.evaluate(o => fetch('/shot?name=r5-shot-state.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), st);
}
