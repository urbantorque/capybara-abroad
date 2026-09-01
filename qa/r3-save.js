async page => {
  const out = {};
  const K = 'capy3.journey.v1', BAD = 'capy3.journey.broken.v1';
  const ALB = 'capy3.album.v1', GH = 'capy3.ghosts.v1';
  const wait = ms => page.evaluate(() => new Promise(r => setTimeout(r, 4500)));

  // No addInitScript anywhere in this file: it fires on EVERY navigation and
  // for the rest of the browser context (harness traps 10 and 19), and every
  // leg below is a write-then-reload test of the very store it would wipe.
  const fresh = async () => {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await wait();
  };
  const start = async () => {
    await page.keyboard.press('Digit1');
    await page.evaluate(() => new Promise(r => setTimeout(r, 4000)));
  };

  // ======================================================================
  // A. THE FLUSH. The debounce drains only inside the rAF loop, so the test
  //    has to happen in ONE synchronous turn — tick, read, fire the lifecycle
  //    event, read again — or a frame lands in the middle and writes it anyway
  //    and the probe passes against a game that has no flush at all.
  // ======================================================================
  await fresh();
  await start();
  out.pagehide = await page.evaluate(() => {
    const g = window.__capy;
    g.hud.completeTask('bin-chicken');
    const before = localStorage.getItem('capy3.journey.v1');
    dispatchEvent(new Event('pagehide'));
    const after = localStorage.getItem('capy3.journey.v1');
    const has = s => { try { return JSON.parse(s).tasks.indexOf('bin-chicken') >= 0; }
                       catch (e) { return false; } };
    return { beforeHas: has(before), afterHas: has(after),
             beforeNull: before === null, afterNull: after === null };
  });

  await fresh();
  await start();
  out.hidden = await page.evaluate(() => {
    const g = window.__capy;
    g.hud.completeTask('dig-flower');
    const before = localStorage.getItem('capy3.journey.v1');
    // The handler reads document.hidden, so the emulation has to move it.
    const d = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
    Object.defineProperty(document, 'hidden', { get: () => true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    const after = localStorage.getItem('capy3.journey.v1');
    Object.defineProperty(document, 'hidden', d || { get: () => false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    const has = s => { try { return JSON.parse(s).tasks.indexOf('dig-flower') >= 0; }
                       catch (e) { return false; } };
    return { beforeHas: has(before), afterHas: has(after) };
  });

  // ...and it survives a real reload, which is the thing the player actually did.
  await page.reload();
  await wait();
  out.survived = await page.evaluate(() => {
    try {
      const o = JSON.parse(localStorage.getItem('capy3.journey.v1'));
      return { n: o.tasks.length, has: o.tasks.indexOf('dig-flower') >= 0,
               told: Object.prototype.hasOwnProperty.call(o, 'told') };
    } catch (e) { return { err: String(e) }; }
  });

  // A JOURNEY THAT HAS NOT BEGUN MUST NOT GET A FILE. The flush is
  // unconditional on purpose (the clock is always stale) and the one thing it
  // may not do is manufacture a save at the title card.
  await fresh();
  out.titleFlush = await page.evaluate(() => {
    dispatchEvent(new Event('pagehide'));
    return { file: localStorage.getItem('capy3.journey.v1') };
  });

  // ======================================================================
  // B. QUARANTINE. A file we cannot parse presented as a first run, and the
  //    first tile press then saveClear()d the only copy of it.
  // ======================================================================
  const GARBAGE = '{"v":1,"tasks":["wheek","steal-hat","dig-fl';
  await page.evaluate(g => {
    localStorage.clear();
    localStorage.setItem('capy3.journey.v1', g);
  }, GARBAGE);
  await page.reload();
  await wait();
  out.corruptTitle = await page.evaluate(g => ({
    journey: localStorage.getItem('capy3.journey.v1'),
    broken: localStorage.getItem('capy3.journey.broken.v1'),
    kept: localStorage.getItem('capy3.journey.broken.v1') === g,
    // A file that would not parse must present as a first run — this is the
    // pre-existing behaviour and it is fine; what was not fine was the delete.
    // SCOPED TO THE TITLE CARD, not to document.body: R4's pause card lives in
    // the DOM from boot and its quit-to-title copy contains the words "carry
    // on", so the whole-document search this used to be reported a carry-on
    // title on a file that was not there.
    carryOn: ((document.querySelector('.capyui-title') || {}).textContent || '')
      .indexOf('carry on') >= 0
  }), GARBAGE);
  await start();                       // the tile press that used to destroy it
  await page.evaluate(() => new Promise(r => setTimeout(r, 2500)));
  out.corruptAfterStart = await page.evaluate(g => ({
    broken: localStorage.getItem('capy3.journey.broken.v1'),
    kept: localStorage.getItem('capy3.journey.broken.v1') === g,
    journeyIsFresh: (function () {
      try { const o = JSON.parse(localStorage.getItem('capy3.journey.v1'));
            return Array.isArray(o.tasks); } catch (e) { return null; }
    })()
  }), GARBAGE);

  // ...and a SECOND boot on a broken file must not overwrite the quarantine
  // with whatever replaced it.
  await page.evaluate(g => { localStorage.setItem('capy3.journey.v1', g + 'XX'); }, GARBAGE);
  await page.reload();
  await wait();
  out.corruptTwice = await page.evaluate(g => ({
    kept: localStorage.getItem('capy3.journey.broken.v1') === g
  }), GARBAGE);

  // ======================================================================
  // C. START OVER MEANS START OVER. The confirm copy promises "every record
  //    and every souvenir"; saveClear removed one key of three.
  // ======================================================================
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('capy3.journey.v1', JSON.stringify({
      v: 1, tasks: ['wheek', 'steal-hat'], seen: [1], recs: { 'x': 1 }, ms: 1000,
      chapms: {}, finds: [], foundAt: {}, biome: 'sydney', fin: 0
    }));
    localStorage.setItem('capy3.album.v1', JSON.stringify({
      v: 1, shots: [{ u: 'data:image/png;base64,AA', place: 'Sydney', cap: 'x', n: 1 }]
    }));
    localStorage.setItem('capy3.ghosts.v1', JSON.stringify({
      v: 1, g: { 'swim-lap': [0, 0, 0, 0, 1, 0, 1, 0] }
    }));
  });
  await page.reload();
  await wait();
  out.beforeWipe = await page.evaluate(() => ({
    journey: !!localStorage.getItem('capy3.journey.v1'),
    album: !!localStorage.getItem('capy3.album.v1'),
    ghosts: !!localStorage.getItem('capy3.ghosts.v1'),
    hasOverBtn: !!document.querySelector('.capyui-overbtn')
  }));
  // The only control in the game that is allowed to throw a journey away.
  await page.evaluate(() => {
    const b = document.querySelector('.capyui-overbtn');
    if (b) b.click();
  });
  await page.evaluate(() => new Promise(r => setTimeout(r, 400)));
  await page.evaluate(() => {
    const y = document.querySelector('.capyui-overyes');
    if (y) y.click();
  });
  await page.evaluate(() => new Promise(r => setTimeout(r, 3000)));
  out.afterWipe = await page.evaluate(() => ({
    started: !!window.__capy.state.started,
    album: localStorage.getItem('capy3.album.v1'),
    ghosts: localStorage.getItem('capy3.ghosts.v1'),
    // the journey key may legitimately have been re-written by the new run
    journeyTasks: (function () {
      try { return JSON.parse(localStorage.getItem('capy3.journey.v1')).tasks.length; }
      catch (e) { return null; }
    })()
  }));

  // ======================================================================
  // D. THE TWO SILENT DEGRADATIONS, SAID ONCE.
  // ======================================================================
  await fresh();
  await page.evaluate(() => { window.__capySoftGL = 'Google SwiftShader'; });
  await start();
  let softSeen = [];
  for (let i = 0; i < 22; i++) {
    await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
    const t = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.capyui-toast')).map(e => e.textContent));
    for (const s of t) if (softSeen.indexOf(s) < 0) softSeen.push(s);
  }
  out.softGL = { toasts: softSeen,
                 said: softSeen.some(s => s.indexOf('without its graphics card') >= 0) };

  // Storage that will not take a write. Stubbed AFTER the clear so the leg
  // starts from a real first run, and it is the last leg for that reason.
  await fresh();
  await page.evaluate(() => {
    const ls = window.localStorage;
    const real = ls.setItem.bind(ls);
    Object.defineProperty(window, '__realSet', { value: real, configurable: true });
    ls.setItem = function () { throw new Error('QuotaExceededError'); };
  });
  await start();
  let offSeen = [];
  for (let i = 0; i < 22; i++) {
    await page.evaluate(() => new Promise(r => setTimeout(r, 600)));
    const t = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.capyui-toast')).map(e => e.textContent));
    for (const s of t) if (offSeen.indexOf(s) < 0) offSeen.push(s);
  }
  out.storageOff = { toasts: offSeen,
                     said: offSeen.some(s => s.indexOf('will not let the game keep a file') >= 0),
                     lied: offSeen.some(s => s.indexOf('saved — you can close this') >= 0) };

  out.err = await page.evaluate(() => {
    const g = window.__capy; return g.state.lastError ? String(g.state.lastError) : null;
  });
  const b = await page.evaluate(o =>
    btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=r3-save.json', { method: 'POST', body: s }), b);
}
