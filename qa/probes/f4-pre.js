async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(7000);
  const out = {};
  out.before = await page.evaluate(() => ({ started: window.__capy.state.started,
                                            paused: window.__capy.state.paused,
                                            cardShown: document.querySelector('.capyui-pause').classList.contains('show') }));
  await page.keyboard.press('Escape');
  await wait(1200);
  out.open = await page.evaluate(() => {
    const card = document.querySelector('.capyui-pause');
    const set = document.querySelector('.capyui-set');
    const btns = Array.from(document.querySelectorAll('.capyui-pause button'))
      .filter(b => b.closest('.capyui-set') === null)
      .map(b => ({ txt: (b.textContent || '').trim(), hidden: b.hidden }));
    const sub = document.querySelector('.capyui-pausesub') ||
                card.querySelector('div,p');
    return { shown: card.classList.contains('show'), setHidden: set ? set.hidden : 'NONE',
             buttons: btns, started: window.__capy.state.started,
             sub: card.textContent.slice(0, 90).replace(/\s+/g, ' ') };
  });
  const c = await page.evaluate(() => {
    const el = document.querySelector('.capyui-pause .capyui-pausecard') ||
               document.querySelector('.capyui-pause > div');
    const r = el.getBoundingClientRect();
    return { x: Math.max(0, Math.round(r.x) - 8), y: Math.max(0, Math.round(r.y) - 8),
             width: Math.round(r.width) + 16, height: Math.min(870, Math.round(r.height) + 16) };
  });
  await page.screenshot({ path: 'qa/F4-pre.png', clip: c });
  // ...and closing it must not have started anything.
  await page.keyboard.press('Escape');
  await wait(1200);
  out.after = await page.evaluate(() => ({ started: window.__capy.state.started,
                                           paused: window.__capy.state.paused,
                                           cardShown: document.querySelector('.capyui-pause').classList.contains('show'),
                                           title: !!document.querySelector('.capyui-title') }));
  // ...and the game still starts normally afterwards.
  await page.keyboard.press('Digit1');
  await wait(4000);
  out.started = await page.evaluate(() => ({ started: window.__capy.state.started,
                                             paused: window.__capy.state.paused,
                                             biome: window.__capy.biome.current }));
  out.err = await page.evaluate(() => window.__capy.state.lastError ? String(window.__capy.state.lastError) : null);
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f4-pre.json', { method: 'POST', body: s }), bl);
}
