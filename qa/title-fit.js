async page => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  const out = { sizes: [], errors: errs };
  await page.goto('http://localhost:5188/');
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6500);

  // the seven fold sizes the memory names, plus 2560 for the zoom ceiling
  const SIZES = [[1280, 720], [1280, 760], [1366, 768], [1600, 900],
                 [1920, 1080], [2560, 1440], [900, 620], [390, 844]];
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(1100);
    const m = await page.evaluate(() => {
      const g = window.__capy;
      const card = document.querySelector('.capyui-card').getBoundingClientRect();
      const foot = document.querySelector('.capyui-p1 .capyui-foot');
      const fr = foot ? foot.getBoundingClientRect() : null;
      const mast = document.querySelector('.capyui-mast svg').getBoundingClientRect();
      const p = g.capy && g.capy.group ? g.capy.group.position : null;
      let nx = -9;
      if (p) { const v = new g.THREE.Vector3(p.x, p.y + 0.5, p.z); v.project(g.camera); nx = +v.x.toFixed(3); }
      const btns = [...document.querySelectorAll('.capyui-p1 button')]
        .filter(b => b.offsetParent)
        .map(b => (b.className.replace('capyui-', '') + ':' + b.textContent.trim().slice(0, 22)));
      // anything sticking out of the window
      let over = 0;
      document.querySelectorAll('.capyui-card *').forEach(el => {
        const b = el.getBoundingClientRect();
        if (b.width && (b.right > window.innerWidth + 1 || b.left < -1)) over++;
      });
      return {
        ui: getComputedStyle(document.querySelector('.capyui-card')).zoom,
        cardW: Math.round(card.width), cardL: Math.round(card.left), cardR: Math.round(card.right),
        cardPct: +(card.width / window.innerWidth * 100).toFixed(1),
        mastPct: +(mast.width / window.innerWidth * 100).toFixed(1),
        footBottom: fr ? Math.round(fr.bottom) : -1,
        footAbove: fr ? fr.bottom <= window.innerHeight : null,
        animalNx: nx, animalClear: nx * 0.5 + 0.5 > card.right / window.innerWidth,
        btns, over,
      };
    });
    out.sizes.push({ w, h, ...m });
    if ([1280, 1920, 390].includes(w) && (w !== 1280 || h === 720)) {
      await page.screenshot({ path: 'qa/TF-p1-' + w + 'x' + h + '.png' });
    }
  }

  // page two at the two ends
  for (const [w, h] of [[1920, 1080], [1280, 720], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(900);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => {
      const card = document.querySelector('.capyui-card').getBoundingClientRect();
      const foot = document.querySelector('.capyui-p2 .capyui-foot');
      const fr = foot ? foot.getBoundingClientRect() : null;
      const caps = [...document.querySelectorAll('.capyui-card *')].filter(e => {
        const cs = getComputedStyle(e);
        return cs.textTransform === 'uppercase' && e.children.length === 0 &&
               e.textContent.trim() && e.offsetParent && e.tagName !== 'KBD';
      }).map(e => e.textContent.trim().slice(0, 34));
      return { cardW: Math.round(card.width), cardB: Math.round(card.bottom),
        cardPct: +(card.width / window.innerWidth * 100).toFixed(1),
        footAbove: fr ? fr.bottom <= window.innerHeight : null,
        fits: card.bottom <= window.innerHeight + 1, caps };
    });
    out['p2_' + w] = m;
    await page.screenshot({ path: 'qa/TF-p2-' + w + '.png' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1100);
  }

  // and page one's uppercase leaves, at 1440
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(1100);
  out.p1caps = await page.evaluate(() =>
    [...document.querySelectorAll('.capyui-p1 *')].filter(e => {
      const cs = getComputedStyle(e);
      return cs.textTransform === 'uppercase' && e.children.length === 0 &&
             e.textContent.trim() && e.offsetParent && e.tagName !== 'KBD';
    }).map(e => e.textContent.trim().slice(0, 40)));

  await page.evaluate(o => fetch('/shot?name=tf.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
