async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(7000);
  const out = {};

  // ---- the front of the card: the footnote, and the fold's Esc rows -------
  out.title = await page.evaluate(() => {
    const foot = document.querySelector('.capyui-footnote');
    const rows = Array.from(document.querySelectorAll('.capyui-legend kbd')).map(e => e.textContent.trim());
    return { note: foot ? foot.textContent.trim() : null, caps: rows };
  });

  // ---- a stranger presses Begin and does nothing --------------------------
  await page.evaluate(() => {
    window.__log = [];
    const t0 = performance.now();
    const seen = new Set();
    const mo = new MutationObserver(() => {
      for (const sel of ['.capyui-place', '.capyui-toast', '.capyui-todo']) {
        for (const el of document.querySelectorAll(sel)) {
          const vis = el.classList.contains('show') || sel === '.capyui-toast';
          const tx = (el.textContent || '').trim().slice(0, 90);
          const key = sel + '|' + vis + '|' + tx;
          if (!tx || seen.has(key)) continue;
          seen.add(key);
          window.__log.push({ t: +((performance.now() - t0) / 1000).toFixed(2), sel: sel, shown: vis, text: tx });
        }
      }
    });
    mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
    return true;
  });
  await page.keyboard.press('Enter');
  await wait(900);
  await page.screenshot({ path: 'qa/F1-first-0900.png' });
  await wait(700);
  await page.screenshot({ path: 'qa/F1-first-1600.png' });
  await wait(3000);
  out.firstLog = await page.evaluate(() => window.__log);

  // ---- bubbles must never be over the paper -------------------------------
  const bubbleCheck = () => page.evaluate(() => {
    const todo = document.querySelector('.capyui-todo');
    const r = todo ? todo.getBoundingClientRect() : null;
    const hits = [];
    if (r) {
      for (const el of document.querySelectorAll('#hud div')) {
        if (/capyui/.test(el.className) || el.children.length !== 2) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || +cs.opacity < 0.2) continue;
        const b = el.getBoundingClientRect();
        if (b.width < 20) continue;
        const over = !(b.right < r.left || b.left > r.right || b.bottom < r.top || b.top > r.bottom);
        if (over) hits.push({ text: (el.textContent || '').trim().slice(0, 40), z: cs.zIndex });
      }
    }
    const todoZ = todo ? getComputedStyle(todo).zIndex : null;
    return { todoZ: todoZ, overlaps: hits };
  });
  out.bubbles = [];
  const cross = n => page.evaluate(function (n) {
    const g = window.__capy;
    try { g.hud.cross(n); } catch (e) { g.biome.switchTo(n); }
    return true;
  }, n);
  for (const n of ['sydney', 'monaco', 'venice', 'quay']) {
    await cross(n); await wait(9000);
    const b = await bubbleCheck();
    b.biome = n; out.bubbles.push(b);
  }

  // ---- the arrival lens, default and after a deliberate zoom-out ----------
  const row = tag => page.evaluate(function (tag) {
    const g = window.__capy, ci = g.camInfo, c = g.camera.position, p = g.capy.position;
    const T = g.THREE;
    const a = new T.Vector3(p.x, p.y + 0.35, p.z).project(g.camera);
    return { tag: tag, biome: g.biome.current,
             dist: +Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z).toFixed(2),
             reach: +ci.reach.toFixed(2), clear: +ci.clear.toFixed(2),
             px: Math.round((a.x * 0.5 + 0.5) * 1440), py: Math.round((0.5 - a.y * 0.5) * 900) };
  }, tag);
  out.cam = [];
  for (const zoom of [false, true]) {
    for (const n of ['manly', 'antarctic', 'rio']) {
      await cross('sydney'); await wait(4500);
      if (zoom) { for (let i = 0; i < 20; i++) await page.mouse.wheel(0, 120); await wait(2500); }
      out.cam.push(await row('sydney ' + (zoom ? 'ZOOMED' : 'default')));
      await cross(n); await wait(3000);
      out.cam.push(await row(n + ' @3s ' + (zoom ? 'ZOOMED' : 'default')));
      await page.screenshot({ path: 'qa/F1-arr-' + n + (zoom ? '-zoomed' : '') + '.png' });
      await wait(9000);
      out.cam.push(await row(n + ' @12s ' + (zoom ? 'ZOOMED' : 'default')));
    }
  }
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f1-after.json', { method: 'POST', body: s }), bl);
}
