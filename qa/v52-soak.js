async page => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e).slice(0, 200)));

  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(7000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);

  const KEYS = ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9',
                'Digit0','Minus','Equal','BracketLeft','BracketRight','Semicolon','Quote',
                'Comma','Period','Slash'];
  const rows = [];

  for (let i = 0; i < KEYS.length; i++) {
    await page.evaluate(() => { const g = window.__capy; if (g && g.state) g.state.lastError = null; });
    // open the departures board and pick, the way the game does it
    await page.evaluate(k => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
    }, KEYS[i]);
    await page.waitForTimeout(3500);

    // drive it about for a few seconds so systems actually run
    const before = errs.length;
    await page.evaluate(() => new Promise(res => {
      const g = window.__capy;
      let n = 0;
      const seq = ['KeyW','KeyA','KeyD','KeyS'];
      const iv = setInterval(() => {
        const c = seq[n % seq.length];
        window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
        setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true })), 400);
        if (n % 3 === 0) { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
          setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true })), 90); }
        if (n % 4 === 0) { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }));
          setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', bubbles: true })), 90); }
        if (++n >= 14) { clearInterval(iv); res(); }
      }, 420);
    }));

    const s = await page.evaluate(() => {
      const g = window.__capy;
      const t = [];
      return new Promise(resolve => {
        let last = performance.now();
        function f() {
          const n = performance.now(); t.push(n - last); last = n;
          if (t.length < 60) requestAnimationFrame(f);
          else {
            t.sort((a, b) => a - b);
            const p = g.capy && g.capy.group && g.capy.group.position;
            resolve({
              biome: g.biome && g.biome.current,
              lastError: g.state && g.state.lastError || null,
              medianMs: Math.round(t[30] * 100) / 100,
              p95Ms: Math.round(t[57] * 100) / 100,
              y: p ? Math.round(p.y * 10) / 10 : null,
              nan: !!(p && !(p.x === p.x && p.y === p.y && p.z === p.z)),
              solverSaves: g.state && g.state.solverSaves || 0,
              tris: g.renderer.info.render.triangles,
              calls: g.renderer.info.render.calls
            });
          }
        }
        requestAnimationFrame(f);
      });
    });
    s.key = KEYS[i];
    s.newErrors = errs.slice(before);
    rows.push(s);
  }

  const out = { rows: rows, totalConsoleErrors: errs.length, allErrors: errs.slice(0, 40) };
  await page.evaluate(o => fetch('/shot?name=v52-soak.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
