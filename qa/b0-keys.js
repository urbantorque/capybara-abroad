async page => {
  // ---------------------------------------------------------------------------
  // qa/b0-keys.js — WHICH KEYS DOES THE GAME ACTUALLY CLAIM? (B0)
  //
  // ROADMAP-FUN item 0's first question about a stranger is "the first thing
  // they try that does nothing". A watcher can only catch that if they happen
  // to be looking at the keyboard, so the recorder that goes with the session
  // wants to answer it mechanically — and the cheapest honest signal is
  // `e.defaultPrevented`: systems.js calls preventDefault on the keys it takes
  // and does not on the ones it ignores.
  //
  // THAT IS AN ASSUMPTION UNTIL IT IS MEASURED, and a recorder built on a
  // false one would file every press under "did nothing". So this presses the
  // whole plausible keyboard, twice — once at the title card and once in a
  // live game — and writes down which keys the game claims in each state.
  //
  // It presses nothing destructive on purpose: no Escape at the title (it
  // would leave the card), and the game is left running.
  // ---------------------------------------------------------------------------
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.reload();
  await page.waitForTimeout(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);

  const KEYS = [
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'KeyE', 'KeyQ',
    'KeyF', 'KeyR', 'KeyC', 'KeyV', 'KeyX', 'KeyZ', 'KeyG', 'KeyH', 'KeyJ',
    'KeyK', 'KeyL', 'KeyM', 'KeyN', 'KeyP', 'KeyT', 'KeyU', 'KeyI', 'KeyO',
    'KeyB', 'KeyY', 'Tab', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft',
    'ArrowRight', 'BracketLeft', 'BracketRight', 'Slash', 'Backquote',
    'Digit1', 'Digit9', 'Minus', 'Equal', 'Comma', 'Period',
  ];

  async function sweep(page, label) {
    await page.evaluate(() => {
      window.__kp = {};
      // ON WINDOW, NOT ON DOCUMENT, and that distinction is the whole
      // measurement. systems.js binds a bare `addEventListener('keydown')`,
      // which is window's — and a document-level bubble listener fires
      // BEFORE window's, because document is a descendant of window in the
      // propagation path. The first cut of this probe read defaultPrevented
      // false for EVERY key in all three states, including a J that had just
      // opened the journal. Same target, later registration, so it runs
      // second and sees what the game did.
      window.__kpH = function (e) { window.__kp[e.code] = !!e.defaultPrevented; };
      window.addEventListener('keydown', window.__kpH);
    });
    for (const k of KEYS) {
      await page.keyboard.press(k);
      await page.waitForTimeout(90);
    }
    const claimed = await page.evaluate(() => {
      window.removeEventListener('keydown', window.__kpH);
      const took = [], left = [];
      for (const k in window.__kp) (window.__kp[k] ? took : left).push(k);
      return { took: took.sort(), left: left.sort() };
    });
    return Object.assign({ where: label }, claimed);
  }

  const out = { errs: errs, sweeps: [] };
  out.sweeps.push(await sweep(page, 'the title card'));
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(9000);
  out.sweeps.push(await sweep(page, 'in the game'));
  // ...and once more with a card open, because the modals swallow keys and a
  // stranger with the journal up is in a third state.
  await page.keyboard.press('KeyJ');
  await page.waitForTimeout(900);
  out.sweeps.push(await sweep(page, 'with the journal open'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);

  out.errN = errs.length;
  await page.evaluate((o) => fetch('/shot?name=b0-keys.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
