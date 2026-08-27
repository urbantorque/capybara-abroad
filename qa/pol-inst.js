async page => {
  // THE THREE CORRECTED CHAPTERS, and the three that must not have moved.
  //
  // Same name-resolved tally as the ambience probe: the bundle keeps its
  // function names, so an Error captured inside createOscillator names the
  // generator that asked for it. That is the only way to tell WHICH voice the
  // score is using without listening to it.
  //
  // Each chapter gets ninety seconds of its own bed and then has its LIFT fired
  // through game.music.swell(1) and held for eight seconds — held, because in
  // Cappadocia and the Pantanal the swell is carried across a whole climb and
  // the figure is a melody rather than a punctuation mark.
  const CH = [['BracketLeft', 'goreme'], ['Semicolon', 'pantanal'], ['Equal', 'palawan'],
              ['Digit1', 'sydney'], ['Digit0', 'venice'], ['Comma', 'antarctic']];
  const out = [];
  for (const [key, name] of CH) {
    await page.reload();
    await page.evaluate(() => {
      window.__tally = {}; window.__lift = {};
      window.__which = 'bed';
      for (const k of ['createOscillator', 'createBufferSource']) {
        const o = AudioContext.prototype[k];
        if (!o) continue;
        AudioContext.prototype[k] = function () {
          try {
            const st = new Error().stack || '';
            const m = st.match(/(mus|sfx)[A-Z]\w+/g);
            if (m && m.length) {
              const bag = window.__which === 'lift' ? window.__lift : window.__tally;
              bag[m[0]] = (bag[m[0]] || 0) + 1;
            }
          } catch (e) { /* never break the game for a counter */ }
          return o.apply(this, arguments);
        };
      }
    });
    await page.waitForTimeout(5000);
    await page.keyboard.press(key);
    await page.waitForTimeout(7000);
    await page.evaluate(() => { window.__tally = {}; });
    for (let i = 0; i < 9; i++) await page.waitForTimeout(10000);
    // ---- and now the lift -------------------------------------------------
    await page.evaluate(() => { window.__which = 'lift'; });
    for (let i = 0; i < 16; i++) {
      await page.evaluate(() => { window.__capy.music.swell(1); });
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(4000);
    const r = await page.evaluate((want) => {
      const g = window.__capy;
      return { want, biome: g.biome && g.biome.current,
               live: !!g.music.live,
               lastError: g.state.lastError ? String(g.state.lastError) : null,
               bed: window.__tally, lift: window.__lift };
    }, name);
    out.push(r);
  }
  await page.evaluate((o) => fetch('/shot?name=pol-inst.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
