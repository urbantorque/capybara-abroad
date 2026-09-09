async page => {
  // ---------------------------------------------------------------------------
  // qa/w2-sheet.js — THE CONTACT SHEET (W2)
  //
  // Four questions, and the first two are the ones that decide whether the
  // thing is worth making at all:
  //
  //  1. WHAT DOES A SHEET LOOK LIKE WITH ALMOST NOTHING IN IT? A journey with
  //     two photographs is the state most players will press this in, and if
  //     that sheet is seventeen holes the feature is a trophy for finishers.
  //  2. WHAT DOES IT COST? Nineteen image decodes and a PNG of a canvas the
  //     size of a poster. Milliseconds and bytes, measured, because the
  //     clipboard is the rung a desktop player gets and a 12 MB blob is not a
  //     thing you paste into a chat window.
  //  3. Does every tile land inside the sheet, and does the name under a long
  //     chapter run into the clock beside it?
  //  4. Does the button work, once, and not twice at the same time?
  //
  // Three states: a fresh journey, a few pictures, and a journey that has been
  // everywhere — which is forced through the album's own store rather than
  // played, because playing it is eight hours.
  // ---------------------------------------------------------------------------
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.reload();
  await page.waitForTimeout(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(8000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(600);

  const out = { errs: errs, states: [] };

  async function shoot(page, tag) {
    const r = await page.evaluate(async () => {
      const t0 = performance.now();
      const u = await window.__capy.sheetDebug();
      const ms = performance.now() - t0;
      const im = await new Promise(function (r) {
        const i = new Image();
        i.onload = function () { r([i.width, i.height]); };
        i.onerror = function () { r(null); };
        i.src = u;
      });
      return { ms: Math.round(ms), kb: Math.round(u.length / 1024), size: im };
    });
    await page.evaluate((nm) => window.__capy.sheetDebug().then(function (u) {
      return fetch('/shot?name=W2-' + nm, { method: 'POST', body: u.split(',')[1] });
    }), tag);
    return r;
  }

  // ---- 1. a fresh journey, one chapter in --------------------------------
  out.states.push(Object.assign({ name: 'fresh' }, await shoot(page, 'fresh')));

  // ---- 2. a few pictures, taken for real ---------------------------------
  for (const b of ['venice', 'hanoi', 'kyoto']) {
    await page.evaluate(async (bi) => {
      const g = window.__capy;
      g.biome.switchTo(bi);
      for (let i = 0; i < 60 * 14; i++) g.tick(1 / 60, false);
      try {
        const c = g.capy, mod = g[g.biome.current], p = c.position;
        if (mod && mod.terrainHeight) {
          c.body.position.set(p.x, mod.terrainHeight(p.x, p.z) + 0.5, p.z);
          c.body.velocity.set(0, 0, 0);
          for (let i = 0; i < 90; i++) g.tick(1 / 60, false);
        }
      } catch (e) {}
    }, b);
    await page.keyboard.press('KeyK');
    await page.waitForTimeout(700);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1600);
    await page.keyboard.press('KeyK');
    await page.waitForTimeout(500);
  }
  out.some = await page.evaluate(() => {
    let n = 0;
    try {
      const f = JSON.parse(localStorage.getItem('capy3.album.v1') || 'null');
      n = f && f.shots ? f.shots.length : 0;
    } catch (e) {}
    return n;
  });
  out.states.push(Object.assign({ name: 'some' }, await shoot(page, 'some')));

  // ---- 3. a journey that has been everywhere -----------------------------
  // The album is written to directly: the alternative is eight hours, and what
  // is being measured is the SHEET, not the game that fills it.
  await page.evaluate(() => {
    const g = window.__capy;
    let shots = [];
    try {
      const f = JSON.parse(localStorage.getItem('capy3.album.v1') || 'null');
      shots = f && f.shots ? f.shots : [];
    } catch (e) {}
    const one = shots[0];
    if (!one) return;
    const names = ['sydney', 'pasto', 'quay', 'manly', 'kyoto', 'cali', 'rio',
                   'iceland', 'sahara', 'drift', 'venice', 'kowloon', 'palawan',
                   'goreme', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi'];
    const all = names.map(function (p, i) {
      return { u: shots[i % shots.length].u, place: p, cap: p, n: i + 1, tag: 0 };
    });
    localStorage.setItem('capy3.album.v1', JSON.stringify({ v: 1, shots: all }));
  });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.evaluate(() => {
    const b = document.querySelector('.capyui-carry');
    if (b) b.click();
  });
  await page.waitForTimeout(8000);
  await page.evaluate(() => {
    const g = window.__capy;
    // ...and a journey that has BEEN there, so the tiles are not all dim: the
    // three states of a tile are the sheet's whole design and a probe that
    // only ever shows one of them has measured nothing.
    g.hud.forceNoto(22, 12, 11, 4, 2);
    g.hud.forceRep({ 'hat-trick': 4, 'flat-white': 1, 'deep-six': 2,
                     'smash-grab': 1, 'bin-day': 3, 'high-tea': 1 });
    for (let n = 1; n <= 8; n++) {
      for (const id of g.hud.taskIds(n)) { try { g.hud.completeTask(id); } catch (e) {} }
    }
  });
  await page.waitForTimeout(1500);
  out.states.push(Object.assign({ name: 'full' }, await shoot(page, 'full')));

  // ---- 4. the button -----------------------------------------------------
  out.button = await page.evaluate(async () => {
    const g = window.__capy;
    g.hud.albumShow();
    await new Promise(function (r) { setTimeout(r, 600); });
    const b = document.querySelector('.capyui-albsheet');
    const res = { there: !!b, label: b ? b.textContent : null };
    if (b) { b.click(); b.click(); }   // twice on purpose: the guard
    await new Promise(function (r) { setTimeout(r, 2500); });
    res.toasts = [].slice.call(document.querySelectorAll('.capyui-toast'))
      .map(function (e) { return e.textContent; });
    return res;
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  out.errN = errs.length;
  await page.evaluate((o) => fetch('/shot?name=w2-sheet.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
