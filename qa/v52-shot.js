async page => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'hover', value: 'none' }, { name: 'pointer', value: 'coarse' }]
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(7000);
  // Start with a touch, never a key: any keydown retires the touch layer, which
  // is correct behaviour and which every earlier probe here tripped over.
  await page.evaluate(() => {
    document.querySelector('canvas').dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 1 }));
  });
  await page.waitForTimeout(4000);
  // Drive it with the stick so there is something to look at, still no keys.
  await page.evaluate(() => new Promise(res => {
    const z = document.querySelector('.capyui-zone');
    const r = z.getBoundingClientRect();
    const at = (t, x, y) => z.dispatchEvent(new PointerEvent(t, { bubbles: true,
      pointerType: 'touch', pointerId: 4, clientX: r.left + x, clientY: r.top + y }));
    at('pointerdown', 90, 300);
    let n = 0;
    const iv = setInterval(() => {
      at('pointermove', 90, 300 - 45);
      if (++n > 14) { clearInterval(iv); at('pointerup', 90, 255); res(); }
    }, 120);
  }));
  await page.waitForTimeout(1200);
}
