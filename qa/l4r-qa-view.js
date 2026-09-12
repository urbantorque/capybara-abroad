async page => {
  const out = {};
  const sizes = [[375, 812], [2560, 1440], [1280, 720]];
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('http://localhost:5188/');
    await page.waitForTimeout(6500);
    await page.screenshot({ path: 'qa/l4r-qa-view-' + w + '-title.png' });
    const key = w + 'x' + h;
    out[key] = {};
    out[key].title = await page.evaluate(() => {
      const t = document.querySelector('.capyui-title, #capyui-title, [class*="title"]');
      const card = document.querySelector('.capyui-card') || t;
      const r = card ? card.getBoundingClientRect() : null;
      const overflowX = document.documentElement.scrollWidth > innerWidth, overflowY = document.documentElement.scrollHeight > innerHeight;
      return { card: r && { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom) }, inner: [innerWidth, innerHeight], overflowX, overflowY, dpr: window.__capy.renderer.getPixelRatio() };
    });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(4000);
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1200); await page.keyboard.up('KeyW');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'qa/l4r-qa-view-' + w + '-game.png' });
    out[key].game = await page.evaluate(() => {
      const g = window.__capy, R = g.renderer;
      const s = R.getDrawingBufferSize(new g.THREE.Vector2());
      const els = {};
      for (const sel of ['.capyui-todo', '.capyui-marq', '.capyui-minimap', '.capyui-map', '.capyui-toasts', '.capyui-tally', '.capyui-chain', '.capyui-pad', '.capyui-touch']) {
        const e = document.querySelector(sel); if (!e) continue; const r = e.getBoundingClientRect(); if (!r.width && !r.height) continue;
        els[sel] = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), offRight: r.right > innerWidth + 1, offBottom: r.bottom > innerHeight + 1 };
      }
      // any HUD element poking off-screen
      let off = 0, tiny = 0; const small = [];
      document.querySelectorAll('#hud *').forEach(e => { const r = e.getBoundingClientRect(); if (!r.width || !r.height) return; if (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1) off++; const fs = parseFloat(getComputedStyle(e).fontSize); if (e.childElementCount === 0 && e.textContent.trim() && fs && fs < 11) { tiny++; if (small.length < 5) small.push(e.className + ':' + fs.toFixed(1)); } });
      return { started: g.state.started, drawing: [s.x, s.y], dpr: +R.getPixelRatio().toFixed(2), maxDPR: null, els, offscreen: off, tinyText: tiny, small, camFov: g.camera.fov, aspect: +g.camera.aspect.toFixed(3) };
    });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4r-qa-view.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
