async page => {
  // R10 — THE PRIVATE-WINDOW RUN.
  //
  // What a player in a private window actually gets: a three-hour journey that
  // will not be there tomorrow, and before R3 they were never told. Simulated
  // by making localStorage THROW on write, which is what Safari private mode
  // and a quota-exhausted profile both do — not by clearing it, which is a
  // different and much friendlier failure.
  await page.addInitScript(() => {
    const boom = function () { throw new DOMException('QuotaExceededError'); };
    try {
      const real = window.localStorage;
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get: function () {
          return { getItem: function () { return null; }, setItem: boom,
                   removeItem: boom, clear: boom, key: function () { return null; },
                   get length() { return 0; } };
        }
      });
      void real;
    } catch (e) { /* if it cannot be shadowed the run below will say so */ }
  });
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 6500)));

  const before = await page.evaluate(() => ({
    running: !!window.__capyRunning, failed: !!window.__capyFailed,
    canWrite: (function () {
      try { localStorage.setItem('x', '1'); return true; } catch (e) { return false; }
    })()
  }));

  // ---- WATCH THE DOM, NOT game.toast ------------------------------------
  // The first cut of this hooked `g.toast` and saw NOTHING AT ALL — not even
  // "be a menace." — because startGame calls the module-private `toast()`, and
  // `game.toast` is a separate binding onto it that systems.js never uses for
  // its own lines. Exactly the blindness the ambient bed had (see ambAudit):
  // hooking the public name sees what the CHAPTERS say and none of what the
  // GAME says. A MutationObserver on the toast rail sees both.
  await page.evaluate(() => {
    window.__said = [];
    const rail = document.querySelector(".capyui-toasts");
    if (!rail) { window.__said.push("NO RAIL"); return; }
    new MutationObserver(function (recs) {
      for (const r of recs) {
        for (const n of r.addedNodes) {
          const t = (n.textContent || "").trim();
          if (t) window.__said.push(t);
        }
      }
    }).observe(rail, { childList: true });
  });
  await page.keyboard.press('Digit1');
  await page.evaluate(() => new Promise(r => setTimeout(r, 14000)));

  const out = await page.evaluate(() => {
    const g = window.__capy;
    const said = window.__said.slice();
    return { before: null, said: said,
             told: said.some(function (s) { return /will not let the game keep a file|lasts as long as the tab/i.test(s); }),
             started: !!g.state.started, biome: g.biome.current,
             err: g.state.lastError ? String(g.state.lastError) : null };
  });
  out.before = before;
  const b = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=r10-private.json', { method: 'POST', body: s }), b);
}
