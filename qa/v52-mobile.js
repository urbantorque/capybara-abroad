async page => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(8000);

  const out = await page.evaluate(() => {
    const g = window.__capy;
    const q = s => document.querySelector(s);
    const touch = q('.capyui-touch');
    const vis = el => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { w: Math.round(r.width), h: Math.round(r.height),
               display: cs.display, x: Math.round(r.x), y: Math.round(r.y) };
    };
    // Which on-screen controls exist at all
    const buttons = Array.from(document.querySelectorAll('.capyui-btn')).map(b => ({
      cls: b.className, label: b.textContent, box: vis(b) }));

    // Which HUD panels overlap the touch controls / each other at 390x844
    const panels = {};
    ['.capyui-todo', '.capyui-map', '.capyui-clue', '.capyui-toasts', '.capyui-score',
     '.capyui-zone', '.capyui-journal', '.capyui-stam'].forEach(s => { panels[s] = vis(q(s)); });

    return {
      viewport: window.innerWidth + 'x' + window.innerHeight,
      touchLayerOn: touch ? touch.classList.contains('on') : null,
      touchLayerDisplay: touch ? getComputedStyle(touch).display : null,
      buttons: buttons,
      panels: panels,
      // the verbs the legend advertises
      legendCore: Array.from(document.querySelectorAll('.capyui-legbig kbd')).map(k => k.textContent),
      biome: g && g.biome && g.biome.current,
      started: g && g.state && g.state.started
    };
  });

  await page.evaluate(o => fetch('/shot?name=v52-mobile.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
