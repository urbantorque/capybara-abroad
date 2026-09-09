async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(4500);
  await page.keyboard.press('Escape');
  await wait(1200);
  // open the settings block
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.capyui-pause button, .capyui-pause .capyui-pbtn'))
      .find(x => /setting|sound|option/i.test(x.textContent || x.getAttribute('aria-label') || ''));
    if (b) { b.click(); return b.textContent; }
    return 'NO SETTINGS BUTTON';
  });
  await wait(1200);
  const out = {};
  out.card = await page.evaluate(() => {
    const s = document.querySelector('.capyui-set');
    const card = document.querySelector('.capyui-pausecard') || document.querySelector('.capyui-pause > div');
    const r = card ? card.getBoundingClientRect() : null;
    return { setHidden: s ? s.hidden : 'NO SET',
             rows: s ? Array.from(s.querySelectorAll('.capyui-setrow')).map(function (x) {
               const n = x.querySelector('.capyui-setname');
               const v = x.querySelector('.capyui-setval');
               const g = x.querySelector('input[type=range]');
               return { name: n ? n.textContent : '', val: v ? v.textContent : '',
                        aria: g ? g.getAttribute('aria-label') : '', value: g ? g.value : '',
                        min: g ? g.min : '', max: g ? g.max : '' };
             }) : [],
             switches: s ? Array.from(s.querySelectorAll('.capyui-setcalm')).map(x => x.textContent) : [],
             card: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null };
  });
  if (out.card.card) {
    const c = out.card.card;
    await page.screenshot({ path: 'qa/F4-settings.png',
      clip: { x: Math.max(0, c.x - 8), y: Math.max(0, c.y - 8), width: c.w + 16, height: Math.min(880, c.h + 16) } });
  }
  // ---- the look fader actually reaches the camera ------------------------
  // THE CARD PAUSES THE WORLD. The first cut measured 0.002 rad at every
  // setting and that was not the fader failing, it was a paused game refusing
  // to turn its camera. The range elements go on working while hidden, so the
  // value is set from the closed card and the turning happens in a live world.
  await page.keyboard.press('Escape');
  await wait(1400);
  out.look = await page.evaluate(async () => {
    const g = window.__capy;
    const rng = Array.from(document.querySelectorAll('.capyui-setrange'))
      .find(x => x.getAttribute('aria-label') === 'camera sensitivity');
    if (!rng) return { missing: true };
    // sysCamInfo has no yaw in it, so the bearing is read the way camYaw is
    // DEFINED — from the capybara to the camera — which is a faithful read of
    // the rig from outside rather than a second copy of it.
    const bearing = () => Math.atan2(g.camera.position.x - g.capy.position.x,
                                     g.camera.position.z - g.capy.position.z);
    const turn = async (n) => {
      const before = bearing();
      for (let i = 0; i < n; i++) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true }));
        await new Promise(r => setTimeout(r, 260));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyZ', bubbles: true }));
        await new Promise(r => setTimeout(r, 120));
      }
      let d = bearing() - before;
      d = ((d + Math.PI * 3) % (Math.PI * 2)) - Math.PI;   // shortest arc
      return +Math.abs(d).toFixed(3);
    };
    rng.value = '100'; rng.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
    const at100 = await turn(2);
    rng.value = '200'; rng.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
    const at200 = await turn(2);
    rng.value = '25'; rng.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 400));
    const at25 = await turn(2);
    rng.value = '100'; rng.dispatchEvent(new Event('input', { bubbles: true }));
    return { at25, at100, at200 };
  });
  // ---- the FOV and the type reach their targets --------------------------
  out.fov = await page.evaluate(async () => {
    const g = window.__capy;
    const rng = Array.from(document.querySelectorAll('.capyui-setrange'))
      .find(x => x.getAttribute('aria-label') === 'field of view');
    if (!rng) return { missing: true };
    const set = async (v) => { rng.value = String(v); rng.dispatchEvent(new Event('input', { bubbles: true }));
                               await new Promise(r => setTimeout(r, 700)); return +g.camera.fov.toFixed(1); };
    const lo = await set(41), hi = await set(61), back = await set(48);
    return { lo, hi, back };
  });
  out.text = await page.evaluate(async () => {
    const rng = Array.from(document.querySelectorAll('.capyui-setrange'))
      .find(x => x.getAttribute('aria-label') === 'text size');
    if (!rng) return { missing: true };
    const hud = document.getElementById('hud');
    const probe = document.querySelector('.capyui-todo h2');
    const read = () => ({ t: hud.style.getPropertyValue('--capyui-t'),
                          px: probe ? +getComputedStyle(probe).fontSize.replace('px', '') : -1 });
    const set = async (v) => { rng.value = String(v); rng.dispatchEvent(new Event('input', { bubbles: true }));
                               await new Promise(r => setTimeout(r, 300)); return read(); };
    const small = await set(0), normal = await set(1), large = await set(2);
    await set(1);
    return { small, normal, large };
  });
  out.err = await page.evaluate(() => window.__capy.state.lastError ? String(window.__capy.state.lastError) : null);
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f4-set.json', { method: 'POST', body: s }), bl);
}
