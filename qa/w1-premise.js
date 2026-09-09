async page => {
  // ---------------------------------------------------------------------------
  // qa/w1-premise.js — WHAT A POSTCARD WOULD ACTUALLY COST (ROADMAP-NEXT item 5)
  //
  // Five questions, all of them from the item's own "premises to measure
  // first", and not one of them can be answered by reading the code:
  //
  //  1. WHAT IS IN THE DRAWING BUFFER? The composite draws from the game's
  //     canvas, and everything below depends on how big that actually is on a
  //     desktop, on a phone, and at devicePixelRatio 2.
  //  2. WHAT DOES THE COMPOSITE COST? A 2D canvas, one drawImage off the live
  //     buffer, and a toDataURL. Milliseconds and bytes, PNG and JPEG, at three
  //     sizes — because the item wants the auto-shots (the nap, the scene card)
  //     to be postcards too, and that is a per-90-seconds cost, not a per-press
  //     one.
  //  3. DOES CANVAS TEXT COME OUT IN THE HUD'S FACE? The item warns that the
  //     first postcard of a session prints in a fallback. Measured against the
  //     DOM's own metrics for the same string.
  //  4. CAN IT LEAVE? navigator.share and clipboard.write, under the harness —
  //     which the item already says will refuse, so what is measured here is
  //     WHICH of them refuses and how, so the fallback chain is built on the
  //     real failure and not an imagined one.
  //  5. WHAT IS THERE TO SAY? The caption is supposed to be in the world's
  //     voice. This asks every source the item names whether it can be read at
  //     the moment the shutter goes.
  // ---------------------------------------------------------------------------
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(8000);

  const out = { errs: errs };

  // ---- 1 + 2, at three viewports ----------------------------------------
  const buf = [];
  for (const [w, h] of [[360, 740], [1280, 800], [1800, 1200]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(900);
    buf.push(await page.evaluate((vw) => {
      const g = window.__capy;
      const cv = document.querySelector('canvas');
      const r = cv.getBoundingClientRect();
      const res = { vw: vw, dpr: window.devicePixelRatio,
                    buf: [cv.width, cv.height],
                    css: [Math.round(r.width), Math.round(r.height)], sizes: [] };
      // Render, then read, in one turn — the rule photoShoot and napShoot both
      // obey. Without it the composite reads a blank buffer.
      for (const [cw, ch] of [[800, 500], [1200, 750], [1600, 1000]]) {
        const t0 = performance.now();
        try {
          if (g.post && g.post.enabled) g.post.render();
          const c2 = document.createElement('canvas');
          c2.width = cw; c2.height = ch;
          const x = c2.getContext('2d');
          x.drawImage(cv, 0, 0, cw, ch);
          const tDraw = performance.now() - t0;
          const t1 = performance.now();
          const png = c2.toDataURL('image/png');
          const tPng = performance.now() - t1;
          const t2 = performance.now();
          const jpg = c2.toDataURL('image/jpeg', 0.85);
          const tJpg = performance.now() - t2;
          // is it actually a picture, or a blank buffer? sample the middle.
          const d = x.getImageData((cw / 2) | 0, (ch / 2) | 0, 1, 1).data;
          res.sizes.push({ at: cw + 'x' + ch, drawMs: +tDraw.toFixed(1),
                           pngMs: +tPng.toFixed(1), jpgMs: +tJpg.toFixed(1),
                           pngKB: Math.round(png.length / 1024),
                           jpgKB: Math.round(jpg.length / 1024),
                           pixel: [d[0], d[1], d[2], d[3]] });
        } catch (e) { res.sizes.push({ at: cw + 'x' + ch, err: String(e).slice(0, 90) }); }
      }
      return res;
    }, w));
  }
  out.buffer = buf;

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(600);

  // ---- 3, 4 and 5 --------------------------------------------------------
  out.rest = await page.evaluate(async () => {
    const g = window.__capy;
    const res = {};

    // 3. the face
    const FACE = '"Trebuchet MS","Segoe UI",system-ui,sans-serif';
    const S = 'THE GONDOLIER IS NOT GOING TO TALK ABOUT THIS';
    const c2 = document.createElement('canvas').getContext('2d');
    c2.font = '700 24px ' + FACE;
    const wBefore = +c2.measureText(S).width.toFixed(1);
    let ready = 'no fonts api';
    try { await document.fonts.ready; ready = 'resolved'; } catch (e) { ready = String(e); }
    c2.font = '700 24px ' + FACE;
    const wAfter = +c2.measureText(S).width.toFixed(1);
    // ...and what the HUD itself measures, which is the thing it has to match
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;' +
                          'font:700 24px ' + FACE;
    probe.textContent = S;
    document.body.appendChild(probe);
    const wDom = +probe.getBoundingClientRect().width.toFixed(1);
    document.body.removeChild(probe);
    // and against a face that certainly is not installed, to prove the metric
    // can tell two faces apart at all
    c2.font = '700 24px "No Such Face At All", monospace';
    const wOther = +c2.measureText(S).width.toFixed(1);
    res.font = { fontsApi: !!document.fonts, ready: ready, before: wBefore,
                 after: wAfter, dom: wDom, differentFace: wOther,
                 canTellFacesApart: Math.abs(wOther - wAfter) > 1,
                 matchesDom: Math.abs(wDom - wAfter) < 1 };

    // 4. can it leave
    const share = { hasShare: typeof navigator.share === 'function',
                    hasShareFiles: typeof navigator.canShare === 'function',
                    hasClipboard: !!(navigator.clipboard && navigator.clipboard.write),
                    hasClipboardItem: typeof window.ClipboardItem === 'function',
                    secure: window.isSecureContext };
    if (share.hasClipboard && share.hasClipboardItem) {
      try {
        const cv = document.createElement('canvas');
        cv.width = 8; cv.height = 8;
        const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        share.clipboardWrite = 'ok';
      } catch (e) { share.clipboardWrite = String(e).slice(0, 120); }
    } else share.clipboardWrite = 'not offered';
    if (share.hasShare) {
      try { await navigator.share({ text: 'x' }); share.shareCall = 'ok'; }
      catch (e) { share.shareCall = String(e).slice(0, 120); }
    } else share.shareCall = 'not offered';
    res.share = share;

    // 5. what is there to say, in Venice with a regular warmed up
    const say = {};
    const has = (n, f) => { try { say[n] = f(); } catch (e) { say[n] = 'THREW: ' + String(e).slice(0, 60); } };
    has('biome', () => g.biome.current);
    has('palWho', () => g.palWho(g.biome.current));
    has('palTier', () => g.palDebug().tier);
    has('palBest', () => g.palDebug().best);
    has('repLast', () => g.repDebug().last);
    has('repFound', () => g.repDebug().found);
    has('perch', () => g.perchCount());
    has('noto', () => { const a = g.hud.notoAudit(); return { tier: a.tier, name: a.name }; });
    has('weather', () => g.weather && g.weather.label && g.weather.label());
    has('keep', () => typeof g.hud.keepHeld);
    // the two the item names that may not be reachable at all from here
    has('headline', () => typeof g.hud.notoHeadline);
    has('blame', () => typeof g.blameDebug);
    res.say = say;
    return res;
  });

  out.errN = errs.length;
  await page.evaluate((o) => fetch('/shot?name=w1-premise.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
