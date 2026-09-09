async page => {
  // ---------------------------------------------------------------------------
  // qa/q2-page.js — THE FORTY, ON THE JOURNAL (Q2)
  //
  // Three questions the page cannot ship without answering, and none of them
  // can be answered by reading the code:
  //
  //  1. IS THE FOLD THERE BEFORE THE FIRST NAME? It must not be: a page reading
  //     "0 of 40" is a nag about a system the player has not been told exists.
  //  2. DOES IT FIT? Forty cells inside a 660 px card that already carries a
  //     seventeen-slot shelf, nineteen board rows and the controls. Four
  //     widths, and the phone is the one that decides it.
  //  3. DOES AN UNEARNED CELL OCCUPY THE SAME BOX AS AN EARNED ONE? If it does
  //     not, a name arriving reflows the grid under the player's eye instead of
  //     lighting a cell up where it already was.
  //
  // The names are seeded with `hud.forceRep`, which exists for forceNoto's
  // reason: a chain pays out once every fifty seconds at best, most have no
  // name, and which name you get is whichever the props to hand allow — so
  // playing to a full page is hours and still cannot choose what it gets.
  // ---------------------------------------------------------------------------
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  const out = { errs: errs };

  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(6000);

  // ---- 1. the fold must NOT be there with nothing in it -------------------
  await page.keyboard.press('KeyJ');
  await page.waitForTimeout(800);
  out.before = await page.evaluate(() => {
    const d = document.querySelector('.capyui-jrrep');
    return { exists: !!d, hidden: d ? d.hidden : null,
             cells: document.querySelectorAll('.capyui-repcell').length };
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Seven of the forty, chosen to put every shape on the page at once: the two
  // a player actually finds out by accident, one counted three times, one
  // counted twice, the longest name in the table, and one that is locked to a
  // chapter.
  const SEED = { 'same-again': 3, 'hat-trick': 1, 'bin-day': 2, 'flat-white': 1,
                 'smash-grab': 1, 'deep-six': 1, 'gondoliers-farewell': 1 };
  out.forced = await page.evaluate((seed) => {
    const g = window.__capy;
    const d = g.hud.forceRep(seed);
    return { found: d.found, n: d.n, counts: d.counts };
  }, SEED);
  // ...and the save, on the debounce's own clock: the page reads jrRep, but a
  // page that is only right in the session that earned the names is a page
  // nobody sees full. Q1 measured the read side; this is the write side.
  await page.waitForTimeout(1500);
  out.saved = await page.evaluate(() => {
    let f = null;
    try { f = JSON.parse(localStorage.getItem('capy3.journey.v1') || 'null'); } catch (e) {}
    return f ? (f.rep || null) : 'no save';
  });

  // ---- 2 and 3. look at it, at four widths --------------------------------
  const sizes = [];
  for (const [w, h] of [[360, 740], [430, 932], [900, 800], [1280, 800]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(400);
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(700);
    sizes.push(await page.evaluate((vw) => {
      const d = document.querySelector('.capyui-jrrep');
      if (!d) return { w: vw, err: 'no fold' };
      const sum = d.querySelector('summary');
      const summary = sum ? sum.textContent : '';
      d.open = true;
      const cells = [].slice.call(document.querySelectorAll('.capyui-repcell'));
      const card = document.querySelector('.capyui-jrcard');
      const cr = card.getBoundingClientRect();
      const rects = cells.map(function (c) { return c.getBoundingClientRect(); });
      const hs = rects.map(function (r) { return Math.round(r.height); });
      const cols = {};
      rects.forEach(function (r) { cols[Math.round(r.left)] = 1; });
      const have = cells.filter(function (c) { return c.classList.contains('have'); });
      const not = cells.filter(function (c) { return !c.classList.contains('have'); });
      const hOf = function (list) {
        return list.length ? Math.max.apply(null, list.map(function (c) {
          return Math.round(c.getBoundingClientRect().height); })) : null;
      };
      const hMin0 = Math.min.apply(null, hs);
      return { w: vw, summary: summary, cells: cells.length, have: have.length,
               cols: Object.keys(cols).length,
               hMin: hMin0, hMax: Math.max.apply(null, hs),
               hHave: hOf(have), hNot: hOf(not),
               taller: hs.filter(function (x) { return x > hMin0 + 2; }).length,
               overflow: rects.filter(function (r) {
                 return r.right > cr.right + 1 || r.left < cr.left - 1; }).length,
               cardW: Math.round(cr.width), cardH: Math.round(cr.height),
               scrollH: card.scrollHeight, clientH: card.clientHeight,
               firstHave: have.length ? have[0].textContent : null,
               // the silhouette's own numbers: how wide the bars in one
               // unearned cell are, so "a shape and not noise" is a measurement
               bars: not.length ? [].slice.call(not[0].querySelectorAll('.capyui-repbar'))
                 .map(function (b) { return Math.round(b.getBoundingClientRect().width); }) : null };
    }, w));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
  out.sizes = sizes;

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyJ');
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const d = document.querySelector('.capyui-jrrep');
    if (d) d.open = true;
    const c = document.querySelector('.capyui-jrcard');
    if (c && d) c.scrollTop = d.offsetTop - 30;
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'qa/Q2-page.png' });
  out.errN = errs.length;
  await page.evaluate((o) => fetch('/shot?name=q2-page.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
