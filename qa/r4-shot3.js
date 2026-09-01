async page => {
  // The pause card with its settings drawer open, at a mid-mix so the faders
  // are not all pinned at one end. A picture, because a card is the one kind of
  // thing a passing probe cannot judge: the probe can say "three rows exist",
  // it cannot say the third one wraps or that the mute glyph is invisible.
  // ---- TWO RELOADS, AND R3 IS THE REASON --------------------------------
  // `clear(); reload()` is no longer a clean start. R3 put saveFlush() on
  // `pagehide`, which fires DURING the reload — so the journey still in memory
  // is written straight back over the cleared key and the new page restores it.
  // Measured: this card came up reading "SYDNEY · 1:01:27" on what was supposed
  // to be a fresh run, because the previous probe had left an hour on the clock.
  // Reload first so the flush spends itself, THEN clear from the title, where
  // saveFlush's `started` gate makes the second navigation write nothing.
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 4000)));
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));
  await page.keyboard.press('Digit1');
  await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));
  await page.keyboard.press('Escape');
  await page.evaluate(() => new Promise(r => setTimeout(r, 800)));
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.capyui-pausebtn'))
      .find(e => (e.textContent || '').indexOf('settings') >= 0);
    if (b) b.click();
  });
  await page.evaluate(() => new Promise(r => setTimeout(r, 900)));
  await page.evaluate(() => {
    const g = window.__capy.hud;
    g.setMasterVolume(0.7, true);
    g.setMusicVolume(0.45, true);
    g.setSfxVolume(0.85, true);
  });
  await page.evaluate(() => new Promise(r => setTimeout(r, 900)));
  const st = await page.evaluate(() => {
    const el = document.querySelector('.capyui-pause');
    const r = el ? el.getBoundingClientRect() : null;
    return {
      shown: !!(el && el.classList.contains('show')),
      box: r ? { w: Math.round(r.width), h: Math.round(r.height),
                 top: Math.round(r.top), bottom: Math.round(r.bottom) } : null,
      viewport: { w: innerWidth, h: innerHeight },
      // A card taller than the window is the one layout failure a screenshot
      // of the top half would not show.
      fits: !!(r && r.top >= 0 && r.bottom <= innerHeight),
      paused: !!window.__capy.state.paused
    };
  });
  await page.evaluate(o => fetch('/shot?name=r4-shot3-state.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), st);
}
