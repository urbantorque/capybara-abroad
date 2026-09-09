async page => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'hover', value: 'none' }, { name: 'pointer', value: 'coarse' }]
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(7000);
  await page.evaluate(() => document.querySelector('canvas').dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 1 })));
  await page.waitForTimeout(3500);

  const out = await page.evaluate(() => new Promise(resolve => {
    const c = document.querySelector('canvas');
    const ev = (t, id, x, y) => c.dispatchEvent(new PointerEvent(t, {
      bubbles: true, pointerType: 'touch', pointerId: id, clientX: x, clientY: y }));
    // camDist is closure-local; read the camera's actual distance from the capy.
    const dist = () => {
      const g = window.__capy, p = g.capy.group.position, e = g.camera.position;
      return Math.round(Math.hypot(e.x - p.x, e.y - p.y, e.z - p.z) * 100) / 100;
    };
    const before = dist();

    // spread two fingers apart -> camera should come IN
    ev('pointerdown', 11, 180, 400);
    ev('pointerdown', 12, 210, 400);
    let step = 0;
    const iv = setInterval(() => {
      const d = 15 + step * 14;
      ev('pointermove', 11, 195 - d, 400);
      ev('pointermove', 12, 195 + d, 400);
      if (++step > 8) {
        clearInterval(iv);
        ev('pointerup', 11, 195 - d, 400);
        ev('pointerup', 12, 195 + d, 400);
        setTimeout(() => {
          const afterSpread = dist();
          // now pinch back together -> camera should go OUT
          ev('pointerdown', 21, 60, 400);
          ev('pointerdown', 22, 330, 400);
          let s2 = 0;
          const iv2 = setInterval(() => {
            const dd = 135 - s2 * 15;
            ev('pointermove', 21, 195 - dd, 400);
            ev('pointermove', 22, 195 + dd, 400);
            if (++s2 > 7) {
              clearInterval(iv2);
              ev('pointerup', 21, 195 - dd, 400);
              ev('pointerup', 22, 195 + dd, 400);
              setTimeout(() => resolve({
                before: before, afterSpread: afterSpread, afterPinch: dist(),
                camMovedIn: afterSpread < before - 0.3,
                camMovedOut: dist() > afterSpread + 0.3
              }), 1400);
            }
          }, 90);
        }, 1400);
      }
    }, 90);
  }));

  await page.evaluate(o => fetch('/shot?name=v52-pinch.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
