async page => {
  // ---- BE A PHONE, PROPERLY ---------------------------------------------
  // setViewportSize moves pixels and nothing else. The game switches its whole
  // scheme on `(hover: none) and (pointer: coarse)`, which is not a viewport
  // fact and which page.emulateMedia cannot reach; CDP can. Set BEFORE the
  // load, because sysIsTouch() and the touch layer both resolve at module time.
  //
  // ...AND THEN NEVER TOUCH THE KEYBOARD. `addEventListener('keydown', ...,
  // {once:true})` removes the touch layer the first time a real key arrives —
  // correct behaviour (a keyboard means you are not holding a phone) and fatal
  // to a probe that starts the game with Digit1 and then measures the layer.
  // The first run of this file did exactly that and reported the MENU button as
  // a 0x0 box at the origin: the CSS was right and its PARENT was display:none.
  // A probe is part of the experiment. Everything below is done with a finger.
  const out = {};
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'hover', value: 'none' }, { name: 'pointer', value: 'coarse' }]
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await page.setViewportSize({ width: 390, height: 844 });

  // R3 put saveFlush() on pagehide, so `clear(); reload()` writes the live
  // journey straight back. Reload FIRST, then clear from the title.
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 4000)));
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));

  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);

  // A finger, not a mouse: a real mouse pointermove tears the layer off too
  // (sysSawMouse), so page.mouse would destroy the thing under test as surely
  // as the keyboard does.
  const tapAt = (sel, cx, cy) => page.evaluate(a => {
    const el = document.querySelector(a.sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, pointerId: 7,
                pointerType: 'touch', isPrimary: true,
                clientX: a.cx === null ? r.left + r.width / 2 : a.cx,
                clientY: a.cy === null ? r.top + r.height / 2 : a.cy };
    el.dispatchEvent(new PointerEvent('pointerdown', o));
    el.dispatchEvent(new PointerEvent('pointerup', o));
    return true;
  }, { sel: sel, cx: cx === undefined ? null : cx, cy: cy === undefined ? null : cy });
  const tap = sel => tapAt(sel);
  // A tap on the SURROUND of a modal — the gesture the ledger and the album
  // have always closed on. Aimed at a corner, well clear of the card.
  const tapSurround = sel => tapAt(sel, 8, 8);
  // A real <button> in a card. A tap on one produces pointerdown, pointerup and
  // then a click, and these listen for the click; .click() is the faithful part.
  const press = (sel, re) => page.evaluate(a => {
    const b = Array.from(document.querySelectorAll(a.sel))
      .find(e => new RegExp(a.re, 'i').test(e.textContent || ''));
    if (!b) return false;
    b.click();
    return true;
  }, { sel: sel, re: re });

  out.emu = await page.evaluate(() => ({
    coarse: matchMedia('(hover: none) and (pointer: coarse)').matches,
    w: innerWidth, h: innerHeight,
    layerOn: !!document.querySelector('.capyui-touch.on')
  }));

  // ---- 1. THE TITLE FOOT RAIL -------------------------------------------
  // Every <kbd> down here named a key a phone does not have.
  out.foot = await page.evaluate(() => {
    const f = document.querySelector('.capyui-title .capyui-foot');
    if (!f) return null;
    return { caps: Array.from(f.querySelectorAll('kbd')).map(k => k.textContent),
             text: (f.textContent || '').trim().slice(0, 130) };
  });

  // ---- 2. THE TOUCH LEGEND ----------------------------------------------
  out.legend = await page.evaluate(() => {
    const el = document.querySelector('.capyui-title .capyui-legend');
    if (!el) return null;
    const caps = Array.from(el.querySelectorAll('kbd')).map(k => k.textContent);
    return { caps: caps, saysMenu: caps.some(c => /MENU/.test(c)) };
  });

  // ---- 3. START THE GAME WITH A THUMB ------------------------------------
  await tap('.capyui-title');
  await wait(5000);
  out.started = await page.evaluate(() => ({
    started: !!window.__capy.state.started,
    layerOn: !!document.querySelector('.capyui-touch.on')
  }));

  out.menuBtn = await page.evaluate(() => {
    const b = document.querySelector('.capyui-menu');
    if (!b) return { present: false };
    const r = b.getBoundingClientRect();
    const map = document.querySelector('.capyui-map');
    const stuck = document.querySelector('.capyui-back.capyui-btn');
    const hits = (a, c) => !!(a && c && !(a.right < c.left || a.left > c.right ||
                                          a.bottom < c.top || a.top > c.bottom));
    return { present: true, w: Math.round(r.width), h: Math.round(r.height),
             top: Math.round(r.top), right: Math.round(innerWidth - r.right),
             onScreen: r.width > 40 && r.height > 40 && r.top >= 0 &&
                       r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
             // 44 CSS px is the smallest target anybody should have to hit.
             bigEnough: r.width >= 44 && r.height >= 44,
             overlapsMap: hits(r, map && map.getBoundingClientRect()),
             overlapsStuck: hits(r, stuck && stuck.getBoundingClientRect()) };
  });

  // ---- 4. MENU OPENS THE CARD, AND RESUME CLOSES IT ----------------------
  await tap('.capyui-menu');
  await wait(900);
  out.menuOpens = { pause: await page.evaluate(() =>
    !!document.querySelector('.capyui-pause.show')) };
  await press('.capyui-pausebtn', 'resume');
  await wait(800);
  out.menuOpens.resumed = await page.evaluate(() =>
    !document.querySelector('.capyui-pause.show') && !window.__capy.state.paused);

  // ======================================================================
  // 5. THE TRAP. Three wheeks at the way out opens the departures board.
  //    Before R5 that card had NO pointerdown listener at all — the ledger and
  //    the album have closed on a tap on their surround since they were built,
  //    and this one, the only one a phone player can actually reach, did not.
  //    Its foot said "ESC to stay". Measured before the fix: open, world
  //    paused, surround tap does nothing, no close control of any kind, and
  //    the only exits were to travel — an irreversible move nobody asked for —
  //    or to reload a three-hour game.
  // ======================================================================
  await page.evaluate(() => {
    const g = window.__capy;
    g.capy.body.position.set(-40, 1.0, -20.6);   // the ferry wharf (R1)
    g.capy.body.velocity.set(0, 0, 0);
  });
  await wait(2000);
  out.atWharf = await page.evaluate(() => ({
    prompt: !!document.querySelector('.capyui-home.show'),
    paused: !!window.__capy.state.paused
  }));
  for (let i = 0; i < 3; i++) { await tap('.capyui-wheek'); await wait(600); }
  await wait(1200);
  out.board = await page.evaluate(() => ({
    open: !!document.querySelector('.capyui-jr.show'),
    foot: (document.querySelector('.capyui-jrfoot') || {}).textContent || null,
    paused: !!window.__capy.state.paused
  }));
  if (out.board.open) {
    await tapSurround('.capyui-jr');
    await wait(900);
    out.board.closedByTap = await page.evaluate(() =>
      !document.querySelector('.capyui-jr.show'));
    out.board.resumed = await page.evaluate(() => !window.__capy.state.paused);
    out.board.stillInSydney = await page.evaluate(() => window.__capy.biome.current);
  }

  // ======================================================================
  // 6. THE JOURNAL, REACHED THE WAY A THUMB REACHES IT. §3's other loose end:
  //    the album, the ledger and the records were behind Tab only.
  // ======================================================================
  await tap('.capyui-menu');
  await wait(800);
  await press('.capyui-pausebtn', 'journey so far');
  await wait(1000);
  out.journal = await page.evaluate(() => ({
    open: !!document.querySelector('.capyui-jr.show'),
    foot: (document.querySelector('.capyui-jrfoot') || {}).textContent || null,
    onward: Array.from(document.querySelectorAll('.capyui-jr button'))
      .map(b => (b.textContent || '').trim())
      .filter(t => /journey|album/i.test(t))
  }));
  await tapSurround('.capyui-jr');
  await wait(900);
  out.journal.closedByTap = await page.evaluate(() =>
    !document.querySelector('.capyui-jr.show'));
  out.journal.resumed = await page.evaluate(() => !window.__capy.state.paused);

  // ---- 7. AND THE VOLUME, BY THUMB --------------------------------------
  await tap('.capyui-menu');
  await wait(800);
  await press('.capyui-pausebtn', 'settings');
  await wait(800);
  out.audio = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.capyui-pause input[type=range]'));
    const before = window.__capy.hud.audioBuses().levels.master;
    if (rows[0]) { rows[0].value = 30; rows[0].dispatchEvent(new Event('input', { bubbles: true })); }
    const mutes = Array.from(document.querySelectorAll('.capyui-pause button'))
      .filter(b => b.getAttribute('aria-pressed') !== null);
    if (mutes[0]) mutes[0].click();
    const b = window.__capy.hud.audioBuses();
    return { faders: rows.length, mutes: mutes.length,
             before: before, after: b.levels.master, muted: b.mutes.master };
  });
  // ---- 8. AND EVERY TARGET ON IT BIG ENOUGH TO HIT ----------------------
  // R4's card was designed at 1280x720. Measured here at 390x844, eleven of its
  // controls were under 44 px — the floor in Apple's guidelines, 48 dp in
  // Android's, and WCAG 2.2's AAA target size. The 16x16 calm checkbox was the
  // worst of them. The label wrapping it counts as the target, not the box.
  out.targets = await page.evaluate(() => {
    const rows = [];
    const add = (label, el) => {
      if (!el) { rows.push({ label: label, missing: true }); return; }
      const r = el.getBoundingClientRect();
      rows.push({ label: label, w: Math.round(r.width), h: Math.round(r.height),
                  ok: r.width >= 44 && r.height >= 44 });
    };
    Array.from(document.querySelectorAll('.capyui-pausebtn'))
      .forEach(b => add('btn:' + (b.textContent || '').trim().slice(0, 12).toLowerCase(), b));
    Array.from(document.querySelectorAll('.capyui-pause input[type=range]'))
      .forEach((e, i) => add('fader:' + i, e));
    Array.from(document.querySelectorAll('.capyui-pause button[aria-pressed]'))
      .forEach((e, i) => add('mute:' + i, e));
    add('calm (the label)', document.querySelector('.capyui-setcalm'));
    // ...and the touch layer's own two non-verb buttons, which are 58 px.
    add('MENU', document.querySelector('.capyui-menu'));
    add('STUCK', document.querySelector('.capyui-touch .capyui-back'));
    return { rows: rows, under44: rows.filter(r => !r.missing && !r.ok) };
  });

  // ...and out again, by tapping the veil.
  await tapSurround('.capyui-pause');
  await wait(800);
  out.audio.closedByTap = await page.evaluate(() =>
    !document.querySelector('.capyui-pause.show') && !window.__capy.state.paused);

  out.err = await page.evaluate(() => {
    const g = window.__capy; return g.state.lastError ? String(g.state.lastError) : null;
  });
  const b = await page.evaluate(o =>
    btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=r5-touch.json', { method: 'POST', body: s }), b);
}
