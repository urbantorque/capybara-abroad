async page => {
  // The two things R4 built and did not finish wiring. No addInitScript
  // anywhere: it survives the whole browser context and would wipe the very
  // files these legs write (harness traps 10 and 19 — and trap 19 is exactly
  // what made qa/r3-save.js report two false failures when it was run in the
  // same session after qa/r1-door.js).
  const out = {};
  const PK = 'capy3.prefs.v1';

  // ======================================================================
  // 1. THE SETTINGS FILE FLUSHES ON HIDDEN, NOT ONLY ON pagehide.
  //    prefsSoon() is a 250 ms timer; pauseHide() flushes it and so does the
  //    quit button, which leaves exactly one window open — a slider moved with
  //    the card still up, and then the tab backgrounded. Done in ONE
  //    synchronous turn so no timer can fire in the middle and pass the test
  //    for a build that has no flush at all.
  // ======================================================================
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));
  await page.keyboard.press('Digit1');
  await page.evaluate(() => new Promise(r => setTimeout(r, 4000)));
  await page.keyboard.press('Escape');            // the pause card
  await page.evaluate(() => new Promise(r => setTimeout(r, 700)));
  out.cardUp = await page.evaluate(() =>
    !!(document.querySelector('.capyui-pause') || {}).classList &&
    document.querySelector('.capyui-pause').classList.contains('show'));

  out.hiddenFlush = await page.evaluate(() => {
    const g = window.__capy;
    // Move a bus WITHOUT closing the card — the one uncovered window.
    g.hud.setMusicVolume(0.33, true);
    const before = localStorage.getItem('capy3.prefs.v1');
    const d = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
    Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    const after = localStorage.getItem('capy3.prefs.v1');
    Object.defineProperty(document, 'hidden', d || { get: () => false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    const at = s => { try { return JSON.parse(s).u; } catch (e) { return null; } };
    return { before: at(before), after: at(after) };
  });

  // ...and it is really on disk, not merely in a node.
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));
  await page.keyboard.press('Digit1');
  await page.evaluate(() => new Promise(r => setTimeout(r, 3500)));
  out.afterReload = await page.evaluate(() => {
    const b = window.__capy.hud.audioBuses();
    return { music: b.levels.music, file: JSON.parse(localStorage.getItem('capy3.prefs.v1')).u };
  });

  // ======================================================================
  // 2. STORAGE THAT WILL NOT TAKE A WRITE IS SAID ONCE — including when it is
  //    the PREFS file that found out first. `sysPrefsOff` was written in two
  //    places and read in none, which is the shape of the __capySoftGL bug R3
  //    had just removed from this same file.
  // ======================================================================
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));
  // QUOTA IS SIZE-DEPENDENT, AND THAT IS THE WHOLE POINT OF THIS LEG. R3's
  // saveSayDegraded probes storage by writing the two bytes `capy3.probe='1'`,
  // and a nearly-full store accepts that and rejects a 90-byte settings blob —
  // so on the commonest non-private-mode failure the probe says "fine" and the
  // only component that knows better is the prefs writer. Anything over ten
  // characters throws here, which is exactly that machine.
  await page.evaluate(() => {
    const ls = window.localStorage;
    const real = ls.setItem.bind(ls);
    ls.setItem = function (k, v) {
      if (String(v).length > 10) throw new Error('QuotaExceededError');
      return real(k, v);
    };
  });
  await page.keyboard.press('Digit1');
  await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));
  // Touch a preference so sysPrefsWrite is the thing that throws first.
  await page.evaluate(() => { window.__capy.hud.setMusicVolume(0.5, true); });
  const seen = [];
  for (let i = 0; i < 20; i++) {
    await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
    const t = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.capyui-toast')).map(e => e.textContent));
    for (const s of t) if (seen.indexOf(s) < 0) seen.push(s);
  }
  out.storageOff = { toasts: seen,
                     said: seen.some(s => s.indexOf('will not let the game keep a file') >= 0) };

  out.err = await page.evaluate(() => {
    const g = window.__capy; return g.state.lastError ? String(g.state.lastError) : null;
  });
  const b = await page.evaluate(o =>
    btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=r4-gaps.json', { method: 'POST', body: s }), b);
}
