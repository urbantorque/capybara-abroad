async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(7000);
  const out = {};
  // The card's page two, which the scoped back-button rule touches.
  await page.keyboard.press('ArrowRight');
  await wait(1600);
  await page.screenshot({ path: 'qa/F1-title-p2.png' });
  out.backBtn = await page.evaluate(() => {
    const b = document.querySelector('.capyui-p2head .capyui-back');
    if (!b) return { missing: true };
    const r = b.getBoundingClientRect();
    const cs = getComputedStyle(b);
    const g = b.querySelector('.capyui-g');
    return { w: Math.round(r.width), h: Math.round(r.height), pad: cs.padding,
             radius: cs.borderRadius, gMargin: g ? getComputedStyle(g).marginRight : null,
             text: (b.textContent || '').trim() };
  });
  await page.keyboard.press('ArrowLeft');
  await wait(1200);
  await page.keyboard.press('Enter');
  await wait(5000);

  // ---- nineteen chapters, driven, with the frame clock ------------------
  await page.evaluate(() => {
    const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE', 'KeyQ', 'ShiftLeft'];
    let s = 20260906 >>> 0;
    const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
    const held = new Set();
    window.__go = function () {
      window.__drive = setInterval(function () {
        if (rnd() < 0.11) {
          const k = KEYS[(rnd() * KEYS.length) | 0];
          const ev = held.has(k) ? 'keyup' : 'keydown';
          if (held.has(k)) held.delete(k); else held.add(k);
          window.dispatchEvent(new KeyboardEvent(ev, { code: k, bubbles: true }));
        }
      }, 16);
    };
    window.__stop = function () {
      clearInterval(window.__drive);
      for (const k of held) window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
      held.clear();
    };
    window.__ft = [];
    let last = performance.now();
    const raf = () => { const n = performance.now(); window.__ft.push(n - last); last = n; requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    return true;
  });
  const ALL = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara',
               'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal',
               'cave', 'antarctic', 'monaco', 'hanoi'];
  out.rows = [];
  for (const n of ALL) {
    await page.evaluate(function (n) {
      const g = window.__capy;
      g.biome.switchTo(n);
      const sp = g.biome.spawnOf(n), b = g.capy.body;
      if (sp) { b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0); }
      window.__ft.length = 0;
      window.__go();
      return true;
    }, n);
    await wait(9000);
    out.rows.push(await page.evaluate(function (n) {
      const g = window.__capy;
      window.__stop();
      const a = window.__ft.slice().sort((x, y) => x - y);
      const p = g.capy.position;
      return { n: n, biome: g.biome.current,
               ftMed: a.length ? +a[a.length >> 1].toFixed(2) : -1,
               nan: !(p.x === p.x && p.y === p.y && p.z === p.z),
               bodies: g.world.bodies.length,
               err: g.state.lastError ? String(g.state.lastError) : null };
    }, n));
  }
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f1-soak.json', { method: 'POST', body: s }), bl);
}
