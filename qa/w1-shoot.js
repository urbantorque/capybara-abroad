async page => {
  // ---------------------------------------------------------------------------
  // qa/w1-shoot.js — PRESS THE KEYS (W1)
  //
  // qa/w1-card.js composes postcards through a debug hook, which proves the
  // composite and proves nothing about the shutter. This is the real gesture:
  // K for the camera, Enter for the picture — and then the three things that
  // must all be true afterwards.
  //
  //  1. THE POSTCARD LEFT. The chain's first rung on a desktop is the
  //     clipboard, so the toast is the assertion: "postcard copied".
  //  2. THE ALBUM KEPT THE RAW FRAME. The ledger's leaves, the title card and
  //     the shelf draw album thumbnails as pictures OF A PLACE, so a
  //     letterboxed card with a caption baked into it must never be what is
  //     stored. The stored row is read back and its aspect measured.
  //  3. NOTHING THREW. photoShoot is allowed to fail quietly and this is the
  //     only place that can tell quiet failure from success.
  // ---------------------------------------------------------------------------
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.reload();
  await page.waitForTimeout(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(9000);

  const before = await page.evaluate(() => window.__capy.albumDebug
    ? window.__capy.albumDebug().stored : null);
  await page.keyboard.press('KeyK');
  await page.waitForTimeout(1200);
  const mode = await page.evaluate(() => ({
    on: !!document.querySelector('.capyui-photo.show'),
    cap: (document.querySelector('.capyui-pcap') || {}).textContent || '',
  }));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);

  const after = await page.evaluate(async () => {
    const g = window.__capy;
    const toasts = [].slice.call(document.querySelectorAll('.capyui-toast, .capyui-toasts *'))
      .map(function (e) { return e.textContent; }).filter(Boolean);
    let stored = null, aspect = null, cap = null;
    try {
      const raw = JSON.parse(localStorage.getItem('capy3.album.v1') || 'null');
      const shots = raw && raw.shots ? raw.shots : [];
      stored = shots.length;
      const last = shots[shots.length - 1];
      if (last) {
        cap = last.cap;
        aspect = await new Promise(function (r) {
          const im = new Image();
          im.onload = function () { r([im.width, im.height]); };
          im.onerror = function () { r(null); };
          im.src = last.u;
        });
      }
    } catch (e) { stored = 'threw'; }
    return { toasts: toasts, stored: stored, aspect: aspect, cap: cap };
  });

  await page.keyboard.press('KeyK');
  await page.waitForTimeout(500);
  await page.evaluate((o) => fetch('/shot?name=w1-shoot.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), { before: before, mode: mode, after: after, errN: errs.length, errs: errs.slice(0, 5) });
}
