async page => {
  const out = {};
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(6500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3500);
  const st = () => page.evaluate(() => { const g = window.__capy; const p = g.capy.position, v = g.capy.body.velocity; return { started: g.state.started, paused: g.state.paused, ts: g.state.timeScale, t: +g.state.time.toFixed(2), pos: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], vel: [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)], err: g.state.lastError || null, ac: (g.hud.audioBuses() || {}).ac && g.hud.audioBuses().ac.state, pauseShown: g.hud.pauseShown() }; });
  // 1. alt-tab mid-hop: W held, Space, 120 ms later the tab hides; 1.5 s later it comes back
  await page.keyboard.down('KeyW'); await page.waitForTimeout(800);
  await page.keyboard.down('Space'); await page.waitForTimeout(120);
  out.hopAir = await st();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(150);
  out.hiddenNow = await st();
  await page.waitForTimeout(1500);
  out.hiddenLater = await st();
  await page.keyboard.up('Space'); await page.keyboard.up('KeyW');   // real keyups arrive while hidden (or never)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(200);
  out.backNow = await st();
  await page.waitForTimeout(2500);
  out.backLater = await st();
  // 1b. hidden while W is held and NO keyup ever arrives (the OS ate it)
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true })));
  await page.waitForTimeout(600);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(300);
  const p0 = await st();
  await page.waitForTimeout(1500);
  const p1 = await st();
  out.ghostKey = { movedAfterReturn: +Math.hypot(p1.pos[0] - p0.pos[0], p1.pos[2] - p0.pos[2]).toFixed(2), paused: p1.paused, err: p1.err };
  // 2. every key at once, held three seconds, then released in reverse
  const codes = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE', 'KeyQ', 'ShiftLeft', 'KeyG', 'KeyF', 'Tab', 'KeyJ', 'KeyH', 'KeyM', 'KeyN', 'KeyP', 'KeyC', 'KeyR', 'KeyT', 'KeyX', 'KeyZ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Digit1', 'Digit5', 'Digit9', 'Minus', 'Equal', 'BracketLeft', 'BracketRight', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash', 'Enter', 'Backspace', 'ControlLeft', 'AltLeft', 'Escape'];
  out.allKeys = {};
  for (const c of codes) { try { await page.keyboard.down(c); } catch (e) { out.allKeys['down-' + c] = String(e).slice(0, 60); } }
  await page.waitForTimeout(3000);
  out.allKeys.held = await st();
  out.allKeys.modals = await page.evaluate(() => ({ jr: !!document.querySelector('.capyui-jr.show, .capyui-jr:not([hidden])'), pause: window.__capy.hud.pauseShown(), biome: window.__capy.biome.current, active: document.activeElement && (document.activeElement.className || document.activeElement.tagName) }));
  for (const c of codes.slice().reverse()) { try { await page.keyboard.up(c); } catch (e) {} }
  await page.waitForTimeout(1500);
  out.allKeys.released = await st();
  out.allKeys.modalsAfter = await page.evaluate(() => ({ pause: window.__capy.hud.pauseShown(), biome: window.__capy.biome.current, paused: window.__capy.state.paused }));
  // close whatever opened
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
  out.afterEsc = await st();
  if (out.afterEsc.pauseShown) { await page.keyboard.press('Escape'); await page.waitForTimeout(500); out.afterEsc2 = await st(); }
  // 3. pause under a held beat: slowmo 0.4 for 4 s, pause at 0.5 s, resume at 3 s
  await page.evaluate(() => window.__capy.slowmo(0.4, 4));
  await page.waitForTimeout(500);
  out.slowBefore = await st();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  out.slowPaused = await st();
  await page.waitForTimeout(2000);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  out.slowResumed = await st();
  await page.waitForTimeout(1200);
  out.slowResumedLater = await st();
  // 4. blur with W held
  await page.keyboard.down('KeyW'); await page.waitForTimeout(500);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(100);
  const b0 = await st(); await page.waitForTimeout(1200); const b1 = await st();
  out.blur = { movedAfterBlur: +Math.hypot(b1.pos[0] - b0.pos[0], b1.pos[2] - b0.pos[2]).toFixed(2), err: b1.err };
  await page.keyboard.up('KeyW');
  // 5. a 3 s rAF stall (the tab-switch guard: dt capped at 0.1) — simulate by blocking the main thread
  const before = await st();
  await page.evaluate(() => { const t = performance.now(); while (performance.now() - t < 3000) {} });
  await page.waitForTimeout(400);
  const after = await st();
  out.stall = { dtWorld: +(after.t - before.t).toFixed(2), pos: after.pos, err: after.err };
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4r-qa-input.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
