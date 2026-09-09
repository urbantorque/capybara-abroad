async page => {
  // sysIsTouch() reads `(hover: none) and (pointer: coarse)`, which
  // page.emulateMedia cannot set — it has to be CDP, and forcing the class
  // instead measures a layout the real rule never produces. Never press a key
  // in this run: a synthetic keydown retires the touch layer.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', { features: [
    { name: 'hover', value: 'none' },
    { name: 'pointer', value: 'coarse' },
    { name: 'any-hover', value: 'none' },
    { name: 'any-pointer', value: 'coarse' },
  ] });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5188/');
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(7000);

  const out = {};
  out.card = await page.evaluate(() => ({
    isTouch: window.matchMedia('(hover: none) and (pointer: coarse)').matches,
    buttons: [...document.querySelectorAll('.capyui-p1 button')].filter(b => b.offsetParent)
      .map(b => b.className.replace('capyui-', '') + ':' + b.textContent.trim().slice(0, 20)),
    footKeycaps: document.querySelectorAll('.capyui-p1 .capyui-foot kbd').length,
    footText: (document.querySelector('.capyui-p1 .capyui-foot') || {}).textContent || '',
    legendKeycaps: document.querySelectorAll('.capyui-p1 .capyui-legend kbd').length,
    legendFirst: [...document.querySelectorAll('.capyui-p1 .capyui-legend kbd')]
      .slice(0, 3).map(k => k.textContent.trim()),
  }));
  await page.screenshot({ path: 'qa/TT-touch-p1.png' });

  // Tap Begin with a real touch, never a key. page.touchscreen needs hasTouch
  // on the CONTEXT, which run-code cannot set, so the tap goes through the
  // same CDP session that enabled touch emulation in the first place.
  const b = await page.locator('.capyui-go:not(.alt)').boundingBox();
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{ x, y, radiusX: 8, radiusY: 8, force: 1, id: 1 }],
  });
  await page.waitForTimeout(60);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(6000);
  out.afterTap = await page.evaluate(() => {
    const g = window.__capy;
    return { started: !!g.state.started, biome: g.biome ? g.biome.current : '',
      err: g.state.lastError ? String(g.state.lastError).slice(0, 120) : '',
      touchLayer: !!document.querySelector('.capyui-touch.on') };
  });
  await page.screenshot({ path: 'qa/TT-touch-ingame.png' });
  await page.evaluate(o => fetch('/shot?name=ttouch.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
