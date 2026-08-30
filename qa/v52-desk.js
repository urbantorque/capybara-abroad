async page => {
  await page.setViewportSize({ width: 1280, height: 760 });
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(7000);

  const out = {};
  out.legend = await page.evaluate(() => ({
    core: Array.from(document.querySelectorAll('.capyui-legbig kbd')).map(k => k.textContent),
    isTouchMedia: window.matchMedia('(hover: none) and (pointer: coarse)').matches,
    touchLayerOn: document.querySelector('.capyui-touch').classList.contains('on')
  }));

  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);

  // the clue must still name keys on a desktop
  out.clue = await page.evaluate(() => {
    const el = document.querySelector('.capyui-clue');
    return el ? el.textContent : null;
  });

  // right-drag must still turn the camera
  out.drag = await page.evaluate(() => new Promise(res => {
    const g = window.__capy;
    const c = document.querySelector('canvas');
    const yaw0 = g.camera.rotation.y;
    c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse',
      button: 2, buttons: 2, pointerId: 3, clientX: 600, clientY: 400 }));
    let n = 0;
    const iv = setInterval(() => {
      c.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse',
        pointerId: 3, clientX: 600 + n * 12, clientY: 400, movementX: 12 }));
      if (++n > 12) {
        clearInterval(iv);
        c.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse',
          button: 2, pointerId: 3 }));
        setTimeout(() => res({ yaw0: Math.round(yaw0 * 1000) / 1000,
                               yaw1: Math.round(g.camera.rotation.y * 1000) / 1000,
                               turned: Math.abs(g.camera.rotation.y - yaw0) > 0.05 }), 900);
      }
    }, 70);
  }));

  // wheel zoom must still work
  out.wheel = await page.evaluate(() => new Promise(res => {
    const g = window.__capy;
    const p = g.capy.group.position;
    const d = () => Math.hypot(g.camera.position.x - p.x, g.camera.position.y - p.y, g.camera.position.z - p.z);
    const before = d();
    const c = document.querySelector('canvas');
    for (let i = 0; i < 6; i++) c.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 100 }));
    setTimeout(() => res({ before: Math.round(before * 100) / 100,
                           after: Math.round(d() * 100) / 100,
                           zoomed: d() > before + 0.3 }), 1200);
  }));

  await page.evaluate(o => fetch('/shot?name=v52-desk.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
