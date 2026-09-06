async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await wait(7000);
  // THE F1 TRAP: pressing Enter to start removes the touch layer's `.on`
  // class. Click the Begin button instead, which is what a thumb does.
  const began = await page.evaluate(() => {
    const b = document.querySelector('.capyui-go');
    if (!b) return 'NO BUTTON';
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    b.click();
    return 'clicked';
  });
  await page.keyboard.press('Digit1');   // the Begin click does not take here
  await wait(5000);
  // The layer is gated on a (pointer: coarse) media query and headless
  // Chromium is not coarse, so it is forced on HERE, in the probe, purely so
  // the seven controls have a box to measure. Nothing about the conversion
  // depends on it — but say so, because a forced state is a state the game
  // did not choose.
  await page.evaluate(() => {
    const l = document.querySelector('.capyui-touch');
    if (l) l.classList.add('on');
    return true;
  });
  await wait(600);
  const out = { began, started: await page.evaluate(() => window.__capy.state.started) };
  out.fan = await page.evaluate(() => {
    const layer = document.querySelector('.capyui-touch');
    const on = layer ? layer.classList.contains('on') : false;
    const btns = Array.from(document.querySelectorAll('.capyui-btn'));
    return {
      layerOn: on,
      n: btns.length,
      rows: btns.map(function (b) {
        const r = b.getBoundingClientRect();
        const cs = getComputedStyle(b);
        return { tag: b.tagName, type: b.type || '', label: b.getAttribute('aria-label'),
                 role: b.getAttribute('role'), w: Math.round(r.width), h: Math.round(r.height),
                 pad: cs.padding, font: cs.fontFamily.slice(0, 18),
                 touch: cs.touchAction, disabled: b.disabled === true,
                 glyph: !!b.querySelector('svg') };
      }),
    };
  });
  // ...and it still WORKS: a pointerdown on HOP has to reach input.jump.
  out.press = await page.evaluate(async () => {
    const g = window.__capy;
    const b = document.querySelector('.capyui-hop');
    if (!b) return { missing: true };
    const before = !!g.input.jump;
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7 }));
    const during = !!g.input.jump;
    const pressed = b.classList.contains('press');
    b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7 }));
    await new Promise(r => setTimeout(r, 60));
    return { before, during, pressed, after: !!g.input.jump };
  });
  // ...and the STICK, which is the thing a change here could break.
  out.stick = await page.evaluate(async () => {
    const g = window.__capy;
    const z = document.querySelector('.capyui-zone');
    if (!z) return { missing: true };
    const r = z.getBoundingClientRect();
    const cx = r.x + r.width * 0.5, cy = r.y + r.height * 0.6;
    z.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 9, clientX: cx, clientY: cy }));
    await new Promise(x => setTimeout(x, 60));
    z.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 9, clientX: cx, clientY: cy - 55 }));
    await new Promise(x => setTimeout(x, 120));
    const zz = g.input.z, xx = g.input.x;
    z.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9, clientX: cx, clientY: cy - 55 }));
    await new Promise(x => setTimeout(x, 80));
    return { z: +zz.toFixed(2), x: +xx.toFixed(2), zAfter: +g.input.z.toFixed(2) };
  });
  await page.screenshot({ path: 'qa/F4-touch.png' });
  out.err = await page.evaluate(() => window.__capy.state.lastError ? String(window.__capy.state.lastError) : null);
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f4-touch.json', { method: 'POST', body: s }), bl);
}
