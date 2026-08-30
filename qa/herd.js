async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);
  const out = {};

  for (const biome of ['venice', 'goreme', 'kyoto', 'iceland']) {
    await page.evaluate((n) => { window.__capy.biome.switchTo(n); }, biome);
    await page.waitForTimeout(2800);
    out[biome] = await page.evaluate(() => {
      const g = window.__capy, c = g.capy;
      const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
      const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
      // FORCING THE SKILL IN THE TICK LOOP DOES NOT WORK for this one:
      // herdUpdate() runs at the END of systems.update(), which is AFTER the
      // skill table has rewritten learn('herd') from the task list — so every
      // recruit was undone in the same frame it was made. Tick the real task.
      const T = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
      const wheek = () => { down('KeyQ'); T(5); up('KeyQ'); T(14); };

      const d0 = g.herdDebug();
      if (!d0.kinds.length || !d0.kinds[0].first) return { none: true, dbg: d0 };
      const K = d0.kinds[0];
      // stand next to the first animal of the chapter's kind
      const b = c.body;
      b.position.set(K.first.x + 1.6, K.first.y + 0.6, K.first.z + 1.6);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
      T(45);

      // ---- 1. does anything follow with the SKILL OFF ----------------------
      wheek(); wheek(); wheek();
      const withoutSkill = g.herdCount();

      // ---- 2. wheek by wheek, with it on ----------------------------------
      g.completeTask('gather', true);
      T(10);
      const perWheek = [];
      for (let w = 1; w <= 4; w++) {
        wheek();
        T(24);
        const d = g.herdDebug();
        perWheek.push({ wheek: w, following: d.total,
                        looking: d.kinds[0].looking, heard: d.kinds[0].heard });
      }

      // ---- 3. stop asking, and watch it come apart ------------------------
      const decay = [];
      for (let s = 0; s < 5; s++) {
        T(60 * 6);
        decay.push({ t: (s + 1) * 6, following: g.herdCount() });
      }

      // ---- 4. and it can be rebuilt --------------------------------------
      wheek(); wheek(); wheek(); T(24);
      const rebuilt = g.herdCount();

      return { kind: K.kind, obey: K.obey, n: K.n, withoutSkill, perWheek, decay,
               rebuilt, err: g.state.lastError || null };
    });
  }

  // ---- 5. and it does not follow you out of the chapter -------------------
  out.crossChapter = await page.evaluate(() => {
    const g = window.__capy, c = g.capy;
    const before = g.herdCount();
    g.biome.switchTo('sydney');
    for (let i = 0; i < 120; i++) { c.learn('herd', true); g.tick(1 / 60, false); }
    return { before, afterSwitch: g.herdCount() };
  });

  await page.evaluate(async (o) => {
    await fetch('/shot?name=herd.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
