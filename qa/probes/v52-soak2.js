async page => {
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 220)); });
  page.on('pageerror', e => errs.push('PAGEERROR ' + String(e).slice(0, 220)));

  const KEYS = ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9',
                'Digit0','Minus','Equal','BracketLeft','BracketRight','Semicolon','Quote',
                'Comma','Period','Slash'];
  const rows = [];

  for (let i = 0; i < KEYS.length; i++) {
    const before = errs.length;
    await page.goto('http://localhost:5188/', { waitUntil: 'load' });
    await page.waitForTimeout(5500);
    // page one -> the picker
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(900);
    // pick the chapter
    await page.keyboard.press(KEYS[i]);
    await page.waitForTimeout(4500);

    // drive it about so systems, NPCs, props and the score actually run
    await page.evaluate(() => new Promise(res => {
      let n = 0;
      const seq = ['KeyW','KeyA','KeyW','KeyD'];
      const iv = setInterval(() => {
        const c = seq[n % seq.length];
        window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
        setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true })), 420);
        if (n % 3 === 0) { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
          setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true })), 90); }
        if (n % 4 === 1) { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', bubbles: true }));
          setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', bubbles: true })), 90); }
        if (n % 5 === 2) { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }));
          setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', bubbles: true })), 90); }
        if (++n >= 20) { clearInterval(iv); res(); }
      }, 430);
    }));

    const s = await page.evaluate(() => new Promise(resolve => {
      const g = window.__capy;
      const t = []; let last = performance.now();
      function f() {
        const n = performance.now(); t.push(n - last); last = n;
        if (t.length < 70) requestAnimationFrame(f);
        else {
          t.sort((a, b) => a - b);
          const p = g.capy && g.capy.group && g.capy.group.position;
          // CONTRACT: read the counters with autoReset off, or the post pass
          // has already zeroed them and every chapter reports 1 and 1.
          g.renderer.info.autoReset = false;
          g.renderer.info.reset();
          g.tick(1 / 60, true);
          resolve({
            biome: g.biome && g.biome.current,
            lastError: (g.state && g.state.lastError) || null,
            medianMs: Math.round(t[35] * 100) / 100,
            p95Ms: Math.round(t[66] * 100) / 100,
            y: p ? Math.round(p.y * 10) / 10 : null,
            nan: !!(p && !(p.x === p.x && p.y === p.y && p.z === p.z)),
            solverSaves: (g.state && g.state.solverSaves) || 0,
            tris: g.renderer.info.render.triangles,
            calls: g.renderer.info.render.calls,
            bodies: g.world && g.world.bodies && g.world.bodies.length
          });
        }
      }
      requestAnimationFrame(f);
    }));
    s.key = KEYS[i];
    s.newErrors = errs.slice(before);
    rows.push(s);
  }

  const out = { rows: rows, totalConsoleErrors: errs.length, allErrors: errs.slice(0, 40) };
  await page.evaluate(o => fetch('/shot?name=v52-soak2.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
