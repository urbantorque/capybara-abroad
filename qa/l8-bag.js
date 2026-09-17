async page => {
  // qa/l8-bag.js — THE BAG (L8, F2), LIVE
  //
  //   node server.mjs                                 (PORT=5188)
  //   playwright-cli -s=l8 open http://localhost:5188/
  //   playwright-cli -s=l8 run-code --filename=qa/l8-bag.js
  //
  // Two real doors, driven for real: E held on the traveller (the actual
  // KeyE binding, not a synthetic call — see systems.js:36362 and the
  // input.action wiring at :44231) and a real click on `.capyui-wallet`.
  // `game.state.qaForceChapTick`/`qaAddYuzu`/`qaAddGifted`/`qaGifted`/
  // `qaOwned`/`qaInv` are this pass's own test doors, beside `bagGift`'s and
  // `chapDoneHere`'s own doc comments in systems.js.
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message || e).slice(0, 300)));
  const out = { fail: [] };
  const assertTrue = (label, ok) => { if (!ok) out.fail.push(label + ': false (' + JSON.stringify(ok) + ')'); };
  // `page.keyboard.down('KeyE')` held across many seconds and frames proved
  // unreliable in this harness — measured with a temporary counter in
  // npc.js: `game.input.action` intermittently read false for single
  // frames in the middle of an unbroken CDP-level hold, which this
  // feature correctly (and unavoidably) treats as a release. fuzz.js hit
  // the same family of issue and solved it by dispatching the
  // KeyboardEvent directly rather than going through CDP's key state —
  // that is the actual house convention for a HELD key in this suite, so
  // this file uses it too, in favour of `page.keyboard.down/up`.
  const keyDown = (code) => page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true })), code);
  const keyUp = (code) => page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true })), code);
  // The title card's own arrival plays a short paused transition on Enter/
  // reload; forcing a biome switch while it is still running can leave
  // whatever set `game.state.paused` with no "clear" call left to run.
  // Polled rather than a fixed wait, so a slow CI box gets more time and a
  // fast one does not waste any.
  async function waitForUnpaused(maxMs) {
    const t0 = Date.now();
    while (Date.now() - t0 < (maxMs || 4000)) {
      const p = await page.evaluate(() => window.__capy.state.paused);
      if (!p) return true;
      await page.waitForTimeout(150);
    }
    return false;
  }

  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  const started = await page.evaluate(() => !!(window.__capy && window.__capy.state.started));
  if (!started) throw new Error('l8-bag: the door did not open');
  await waitForUnpaused();

  // ---- SET UP VENICE, FORCE ITS FIRST TICK, STAND BY THE TRAVELLER ---------
  const setup = await page.evaluate(() => {
    const g = window.__capy;
    g.state.qaForceChapTick(10); // venice is chapter 10 (see shared.js CHAPTERS)
    g.biome.switchTo('venice');
    return true;
  });
  assertTrue('venice switched to', setup === true);
  await page.waitForTimeout(1200);
  const trav = await page.evaluate(() => window.__capy.travWhere('venice'));
  assertTrue('travWhere(venice) resolves once the first tick is forced', !!(trav && typeof trav.x === 'number'));
  if (trav) {
    await page.evaluate(([x, y, z]) => {
      const g = window.__capy;
      const cb = g.capy.body;
      cb.position.set(x, y + 0.05, z + 1.0); // a metre off, inside npcTRAV_MET_R (3.2)
      cb.velocity.set(0, 0, 0);
      cb.previousPosition.copy(cb.position);
      cb.interpolatedPosition.copy(cb.position);
    }, [trav.x, trav.y, trav.z]);
  }
  await page.waitForTimeout(500);

  // ---- DOOR 1: E IN PERSON — a real hold, short of the gift threshold -----
  await keyDown('KeyE');
  await page.waitForTimeout(500); // well short of the 1.2s gift threshold
  await keyUp('KeyE');
  await page.waitForTimeout(300);
  const inPerson = await page.evaluate(() => {
    const el = document.querySelector('.capyui-bag');
    const away = document.querySelector('.capyui-bagaway');
    return {
      shown: !!(el && el.classList.contains('show')),
      awayHidden: !!(away && away.hidden),
      counts: window.__capy.state.qaBagCounts(),
      paused: window.__capy.state.paused,
    };
  });
  assertTrue('a short E-tap opens the bag in person', inPerson.shown);
  assertTrue('...with no "found it on your own" line', inPerson.awayHidden);
  assertTrue('world paused while the bag is open', inPerson.paused === true);
  assertTrue('upgrades shelf has 9 rows (6 everyday + 3 capstones)', inPerson.counts.up === 9);
  assertTrue('the pocketed kind shelf has 3 rows', inPerson.counts.pock === 3);
  assertTrue('wear shelf has 0 rows (F5 not built yet)', inPerson.counts.wear === 0);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const afterEsc = await page.evaluate(() => ({
    shown: document.querySelector('.capyui-bag').classList.contains('show'),
    paused: window.__capy.state.paused,
  }));
  assertTrue('Escape closes the bag', !afterEsc.shown);
  assertTrue('...and unpauses the world', afterEsc.paused === false);

  // ---- DOOR 2: THE WALLET, FROM 200 M AWAY ---------------------------------
  await page.evaluate(([x, z]) => {
    const g = window.__capy;
    const y = (g.venice && typeof g.venice.terrainHeight === 'function') ? g.venice.terrainHeight(x, z) : 0;
    const cb = g.capy.body;
    cb.position.set(x, (isFinite(y) ? y : 0) + 0.3, z);
    cb.velocity.set(0, 0, 0);
    cb.previousPosition.copy(cb.position);
    cb.interpolatedPosition.copy(cb.position);
  }, [trav ? trav.x + 200 : 200, trav ? trav.z : 0]);
  await page.waitForTimeout(500);
  // A real `page.click` fights `yuzuWalletReposition` (systems.js), which
  // moves the pill every 350ms and never leaves it stable for Playwright's
  // actionability wait — measured, a 30s timeout with "element is not
  // stable" on every retry. A dispatched click on the element itself still
  // exercises the real listener (walletEl.addEventListener('click', ...)),
  // just without fighting a HUD element that is SUPPOSED to keep moving.
  await page.evaluate(() => document.querySelector('.capyui-wallet').click());
  await page.waitForTimeout(300);
  const away = await page.evaluate(() => {
    const el = document.querySelector('.capyui-bag');
    const awayEl = document.querySelector('.capyui-bagaway');
    return { shown: el.classList.contains('show'), awayHidden: awayEl.hidden, awayText: awayEl.textContent };
  });
  assertTrue('the wallet opens the bag from 200 m away', away.shown);
  assertTrue('...with the away line showing', !away.awayHidden && !!away.awayText);
  const AWAY_LINES = [
    'you found the bag on your own. fine by me.',
    'ah — you already know it is there. saves us both the walk.',
    'straight to the bag, then. no small talk necessary.',
    'you did not even come and say hello. the bag does not mind.',
  ];
  assertTrue('...and it is one of the four written lines', AWAY_LINES.indexOf(away.awayText) >= 0);

  // ---- BUY THE CHEAPEST UPGRADE AND ONE CONSUMABLE, THEN RELOAD -----------
  await page.evaluate(() => window.__capy.state.qaAddYuzu(1000));
  const before = await page.evaluate(() => ({
    yuzu: document.querySelector('.capyui-wallet').textContent,
    owned: window.__capy.state.qaOwned.length,
    inv: Object.assign({}, window.__capy.state.qaInv),
  }));
  // re-open (buying yuzu doesn't rebuild an already-open card's stale prices)
  await page.evaluate(() => window.__capy.state.qaCloseBag());
  await page.evaluate(() => window.__capy.state.qaOpenBag(true));
  await page.waitForTimeout(200);
  const bought = await page.evaluate(() => {
    const upBtn = document.querySelector('.capyui-bag .capyui-bagshelf .capyui-bagbuy');
    if (upBtn) upBtn.click();
    return true;
  });
  assertTrue('clicked the cheapest upgrade’s buy button', bought);
  await page.waitForTimeout(200);
  // the pocketed kind's own first buy button, after the upgrades shelf
  const pockClicked = await page.evaluate(() => {
    const shelves = document.querySelectorAll('.capyui-bag .capyui-bagshelf');
    const pockShelf = shelves[1]; // upgrades, pocketed kind, wear — in that order
    const btn = pockShelf ? pockShelf.querySelector('.capyui-bagbuy') : null;
    if (btn) btn.click();
    return !!btn;
  });
  assertTrue('clicked a consumable’s +1 button', pockClicked);
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => ({
    yuzu: document.querySelector('.capyui-wallet').textContent,
    owned: window.__capy.state.qaOwned.length,
    inv: Object.assign({}, window.__capy.state.qaInv),
  }));
  assertTrue('yuzu fell after the two buys', after.yuzu !== before.yuzu);
  assertTrue('owned grew by one upgrade', after.owned === before.owned + 1);
  const invGrew = Object.keys(after.inv).some(k => (after.inv[k] || 0) > (before.inv[k] || 0));
  assertTrue('a consumable bank grew by one', invGrew);
  await page.evaluate(() => window.__capy.state.qaCloseBag());

  // ---- THE SAVE FILE ITSELF, NOT A ROUND TRIP THROUGH THE TITLE CARD -------
  // A real `page.reload()` + Enter goes through `startResume`, which only
  // RESTORES anything at all when `jrFileCount` (systems.js) — literally
  // `jrFile.tasks.length` — is greater than zero: with no task EVER ticked
  // (this probe uses the bag's QA doors, never `completeTask`), Enter always
  // takes the fresh-Sydney branch and silently overwrites the very save
  // being tested, which is a property of the pre-existing title card, not
  // of the bag. Proving the actual claim — "buying through the bag writes a
  // save `startGame`'s restore branch can read" — means reading the written
  // JSON directly, the same file a real returning player's `jrFileCount > 0`
  // restore would consume.
  await page.waitForTimeout(1200); // clear the save's 700ms debounce, with margin
  const savedRaw = await page.evaluate(() => { try { return localStorage.getItem('capy3.journey.v1'); } catch (e) { return null; } });
  let saved = null;
  try { saved = savedRaw && JSON.parse(savedRaw); } catch (e) { saved = null; }
  assertTrue('a save file was written at all', !!saved);
  if (saved) {
    assertTrue('the bought upgrade is in the written save', Array.isArray(saved.owned) && saved.owned.length === after.owned);
    const invAfter = after.inv;
    const invMatches = saved.inv && Object.keys(invAfter).every(k => saved.inv[k] === invAfter[k]);
    assertTrue('the consumable bank is in the written save', !!invMatches);
    assertTrue('gifted is in the written save, starting at 0', saved.gifted === 0);
  }

  // ---- THE GIFT: twenty holds cross 100, once; a 21st does not refire -----
  await page.evaluate(() => {
    const g = window.__capy;
    g.biome.switchTo('venice');
  });
  await page.waitForTimeout(1000);
  await waitForUnpaused();
  const trav2 = await page.evaluate(() => window.__capy.travWhere('venice'));
  assertTrue('travWhere(venice) resolves again for the gift section', !!(trav2 && typeof trav2.x === 'number'));
  if (trav2) {
    await page.evaluate(([x, y, z]) => {
      const cb = window.__capy.capy.body;
      cb.position.set(x, y + 0.05, z + 1.0);
      cb.velocity.set(0, 0, 0);
      cb.previousPosition.copy(cb.position);
      cb.interpolatedPosition.copy(cb.position);
    }, [trav2.x, trav2.y, trav2.z]);
  }
  await page.waitForTimeout(500);
  const giftedBefore = await page.evaluate(() => window.__capy.state.qaGifted());
  assertTrue('starting gifted total is a clean multiple of 5 (0 after a fresh journey)', giftedBefore % 5 === 0);

  // ---- game.bagGift ITSELF NEVER TOUCHES jrYuzu, CHECKED IN ONE TICK ------
  // Venice runs its own ambient economy (finds, ambient tasks) independently
  // of the bag, and a capybara held near the traveller for the 20-30s the
  // full UI-driven loop below takes is exactly the kind of held position
  // that can pick up an unrelated ambient payout mid-loop (measured: a
  // stray +3 landed during a hold with nothing to do with the gift). A
  // direct, synchronous call — before and after in the SAME `page.evaluate`,
  // no frames elapse in between — isolates `bagGift`'s own effect on
  // `jrYuzu` from anything else live in the chapter.
  const directCheck = await page.evaluate(() => {
    const g = window.__capy;
    const yuzuBefore = g.state.qaYuzu();
    const giftedBefore2 = g.state.qaGifted();
    g.bagGift('venice');
    return { yuzuDelta: g.state.qaYuzu() - yuzuBefore, giftedDelta: g.state.qaGifted() - giftedBefore2 };
  });
  assertTrue('game.bagGift never touches jrYuzu', directCheck.yuzuDelta === 0);
  assertTrue('game.bagGift credits jrGifted by 5', directCheck.giftedDelta === 5);
  const giftedAfterDirect = await page.evaluate(() => window.__capy.state.qaGifted());

  // A single 1.2s-plus hold, real KeyE down/up. Occasionally a headless
  // tab's rAF-driven input.action read races the down/up pair and the hold
  // reads as released a frame early — which this game correctly treats as a
  // TAP (it opens the bag instead of gifting; see npc.js's own -1/-2 state
  // machine, "release before re-arm"). That is a genuine, intentional
  // behaviour of the feature under test, not a bug to paper over — but a
  // mistimed `page.keyboard` pair is a harness artifact, not a player
  // pressing twice, so a mistap here is detected and retried rather than
  // either silently ignored or the whole test forced to slow down. Success
  // is checked against `qaGifted()` actually rising by 5 — not merely "the
  // bag did not open" — because a capybara nudged out of npcTRAV_MET_R by
  // physics (standing pressed against the traveller's own collider for
  // twenty-odd holds in a row) would pass that weaker check while gifting
  // nothing at all. Re-teleporting before every hold is the fix for the
  // drift, and the delta check is what would have caught it if it weren't.
  async function holdGift() {
    for (let attempt = 0; attempt < 5; attempt++) {
      if (!(await waitForUnpaused(2000))) {
        await page.evaluate(() => window.__capy.state.qaCloseBag());
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
        continue;
      }
      const t = await page.evaluate(() => window.__capy.travWhere('venice'));
      if (t) {
        await page.evaluate(([x, y, z]) => {
          const cb = window.__capy.capy.body;
          cb.position.set(x, y + 0.05, z + 1.0);
          cb.velocity.set(0, 0, 0);
          cb.previousPosition.copy(cb.position);
          cb.interpolatedPosition.copy(cb.position);
        }, [t.x, t.y, t.z]);
      }
      const giftedBeforeHold = await page.evaluate(() => window.__capy.state.qaGifted());
      await keyDown('KeyE');
      await page.waitForTimeout(1700); // ample margin over the 1.2s threshold
      await keyUp('KeyE');
      await page.waitForTimeout(250); // let the release land before re-arming
      const afterState = await page.evaluate(() => ({
        gifted: window.__capy.state.qaGifted(),
        opened: document.querySelector('.capyui-bag').classList.contains('show'),
      }));
      if (afterState.gifted === giftedBeforeHold + 5) return true;
      if (afterState.opened) await page.evaluate(() => window.__capy.state.qaCloseBag());
      await page.waitForTimeout(200);
    }
    return false;
  }

  // however many holds it takes to CROSS 100 from wherever we start (>=1, at most 20+).
  // jrYuzu is already proven untouched by the direct `bagGift` call above;
  // this loop is about the UI door (the hold, the tap-vs-gift split, the
  // peel-pouch crossing), not a second, noisier way to re-prove the ledger.
  const holdsNeeded = Math.max(1, Math.ceil((100 - giftedAfterDirect) / 5));
  for (let i = 1; i <= holdsNeeded; i++) {
    const ok = await holdGift();
    assertTrue('hold #' + i + ' actually gifted (+5) within 5 attempts', ok);
  }
  const crossed = await page.evaluate(() => ({
    gifted: window.__capy.state.qaGifted(),
    ownedPouch: window.__capy.state.qaOwned.filter(id => id === 'peel-pouch').length,
  }));
  assertTrue('gifted reaches >= 100 by the expected hold', crossed.gifted >= 100);
  assertTrue('the peel pouch is owned exactly once at the crossing', crossed.ownedPouch === 1);
  const capsAfter = await page.evaluate(() => {
    const g = window.__capy;
    return { thermos: g.capy.itemCap('thermos'), mango: g.capy.itemCap('mango'), feather: g.capy.itemCap('feather') };
  });
  assertTrue('thermos cap rises to 5', capsAfter.thermos === 5);
  assertTrue('mango cap rises to 7', capsAfter.mango === 7);
  assertTrue('feather cap rises to 5', capsAfter.feather === 5);
  // one more hold, past 100: gifts again, no second moment / no duplicate id
  const past100ok = await holdGift();
  assertTrue('the 21st hold also landed as a gift', past100ok);
  const finalState = await page.evaluate(() => ({
    gifted: window.__capy.state.qaGifted(),
    pouchCount: window.__capy.state.qaOwned.filter(id => id === 'peel-pouch').length,
  }));
  assertTrue('a gift past 100 still counts up', finalState.gifted >= 100 + 5);
  assertTrue('...but the peel pouch is still owned exactly once, not twice', finalState.pouchCount === 1);

  out.errs = errs.slice(0, 10);
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l8-bag.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
  if (out.fail.length || errs.length) {
    throw new Error('l8-bag FAILED: ' + JSON.stringify({ fail: out.fail, errs: out.errs }));
  }
}
