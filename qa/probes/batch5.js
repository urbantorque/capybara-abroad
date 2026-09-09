async page => {
  await page.reload();
  await page.waitForTimeout(5500);
  await page.keyboard.press('Digit1');
  for (let i = 0; i < 25; i++) {
    await page.waitForTimeout(1000);
    const b = await page.evaluate(() => {
      const g = window.__capy;
      return g && g.biome ? g.biome.current : null;
    });
    if (b === 'sydney') break;
  }
  await page.waitForTimeout(2000);

  const out = { tag: 'BATCH5', rows: [] };

  // ---- exercise the input paths the buffers lived in ----------------------
  for (const k of ['KeyE', 'Space', 'KeyQ', 'KeyR', 'ShiftLeft', 'KeyF']) {
    await page.keyboard.press(k);
    await page.waitForTimeout(120);
  }
  out.afterKeys = await page.evaluate(() => {
    const g = window.__capy;
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
    return { lastError: g.state.lastError || null,
             jumpBuf: g.input ? g.input.jumpBuf : null,
             actionBuf: g.input ? g.input.actionBuf : null };
  });

  // every chapter, with a wheek in each — the voice path, the records, the
  // biome:enter clear, and every chapter's own onEnter
  const names = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi'];
  for (const n of names) {
    const row = await page.evaluate(name => {
      const g = window.__capy;
      g.biome.switchTo(name);
      const s = g.biome.spawnOf ? g.biome.spawnOf(name) : null;
      if (s && g.capy && g.capy.body) {
        g.capy.body.position.set(s.x, s.y + 0.4, s.z);
        g.capy.body.velocity.set(0, 0, 0);
      }
      let threw = null;
      try {
        for (let c = 0; c < 3; c++) {
          g.events.emit('capy:wheek', { position: g.capy.position, soft: false });
          for (let i = 0; i < 200; i++) g.tick(1 / 60, false);
        }
      } catch (e) { threw = String((e && e.message) || e); }
      const p = g.capy && g.capy.position;
      return { want: name, biome: g.biome.current, threw: threw,
               nan: !!(p && (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z))),
               lastError: g.state.lastError || null };
    }, n);
    out.rows.push(row);
  }

  // ---- and the condor, whose render pose lost two damped terms ------------
  out.condor = await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('pasto');
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false);
    const r = { biome: g.biome.current };
    let threw = null;
    try {
      if (g.condor && typeof g.condor.summon === 'function') {
        r.summoned = !!g.condor.summon();
      } else { r.summoned = 'no summon api'; }
      for (let i = 0; i < 900; i++) g.tick(1 / 60, false);
    } catch (e) { threw = String((e && e.message) || e); }
    r.threw = threw;
    r.lastError = g.state.lastError || null;
    return r;
  });

  await page.evaluate(payload => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 1))));
    return fetch('/shot?name=batch5-result.json', { method: 'POST', body: s });
  }, out);
}
