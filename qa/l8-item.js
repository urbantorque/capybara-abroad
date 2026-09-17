async page => {
  // qa/l8-item.js — THE POCKETED KIND (L8, F6), LIVE
  //
  //   node server.mjs                                 (PORT=5188)
  //   playwright-cli -s=l8 open http://localhost:5188/
  //   playwright-cli -s=l8 run-code --filename=qa/l8-item.js
  //
  // `game.state.qaAddYuzu`/`qaBuyConsumable`/`qaForceOwned` are this pass's
  // own test doors (systems.js, beside buyConsumable's own doc comment). The
  // T key is the real one a player presses — this probe uses it, not a
  // synthetic call into the handler, so a rebind or a gating mistake would
  // actually be caught.
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message || e).slice(0, 300)));
  const out = { fail: [] };
  const assertTrue = (label, ok) => { if (!ok) out.fail.push(label + ': false (' + JSON.stringify(ok) + ')'); };
  const assertClose = (label, got, want, tol) => {
    if (Math.abs(got - want) > tol) out.fail.push(label + ': ' + got + ' not within ' + tol + ' of ' + want);
  };

  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  const started = await page.evaluate(() => !!(window.__capy && window.__capy.state.started));
  if (!started) throw new Error('l8-item: the door did not open');

  // ---- THE THERMOS: instant full, then 45s of zero drain -------------------
  const t1 = await page.evaluate(() => {
    const g = window.__capy;
    g.state.qaAddYuzu(500);
    const bought = g.state.qaBuyConsumable('thermos', 2);
    return { bought, item: g.capy.item, inv: Object.assign({}, g.state.qaInv) };
  });
  assertTrue('thermos x2 bought and auto-equipped', t1.bought && t1.item && t1.item.id === 'thermos' && t1.inv.thermos === 2);

  // drain stamina for real (a direct write is a one-way-published no-op —
  // see the same trap in qa/l8-upgrades.js's settle()) before pressing T, so
  // the "instant full" is actually visible rather than a no-op at 1.0 already.
  await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(4000);
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  const drained = await page.evaluate(() => window.__capy.capy.stamina);
  assertTrue('stamina actually drained before the press (< 0.9)', drained < 0.9);

  await page.keyboard.press('KeyT');
  await page.waitForTimeout(150);
  const afterPress = await page.evaluate(() => {
    const g = window.__capy;
    return { stamina: g.capy.stamina, boon: g.capy.boon, inv: Object.assign({}, g.state.qaInv) };
  });
  assertClose('capy.stamina hits 1.0 within one frame of the press', afterPress.stamina, 1.0, 0.02);
  assertTrue('inv.thermos falls 2 -> 1', afterPress.inv.thermos === 1);
  assertTrue('a running boon named thermos, ~45s', afterPress.boon && afterPress.boon.id === 'thermos' && afterPress.boon.t > 43 && afterPress.boon.t <= 45);
  const hudText1 = await page.evaluate(() => {
    const el = document.querySelector('.capyui-item .capyui-item-txt');
    return el ? el.textContent : null;
  });
  assertTrue('the HUD slot text matches (thermos, 1 left)', /thermos/.test(hudText1 || '') && /1/.test(hudText1 || ''));

  // drain reads 0 for the duration: hold a sprint under the boon and confirm
  // stamina does not fall (it may even rise a hair from residual regen ticks
  // the boon doesn't touch, but it must never DROP).
  await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(2500);
  const underBoon = await page.evaluate(() => window.__capy.capy.stamina);
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  assertTrue('stamina does not fall while the thermos boon is running (drain reads x0)', underBoon >= 0.98);

  // ---- A WRAPPED MANGO: two sequential boons, not stacked -------------------
  await page.evaluate(() => {
    const g = window.__capy;
    g.state.qaAddYuzu(500);
  });
  const m1 = await page.evaluate(() => window.__capy.state.qaBuyConsumable('mango', 3));
  assertTrue('mango x3 bought', m1 === true);
  // Switching the equipped id is the bag's job (F2, not built yet) — the
  // T-key handler reads the systems.js closure `jrItem`, not the published
  // `capy.item` mirror, so `qaSetItem` (not a direct `capy.item` write) is
  // the only door that actually changes what a T press fires.
  await page.evaluate(() => { window.__capy.state.qaSetItem('mango'); });
  await page.keyboard.press('KeyT');
  await page.waitForTimeout(150);
  const mangoBoon1 = await page.evaluate(() => window.__capy.capy.boon);
  assertTrue('first mango press starts a mango boon, ~75s', mangoBoon1 && mangoBoon1.id === 'mango' && mangoBoon1.t > 73);
  await page.keyboard.press('KeyT');
  await page.waitForTimeout(150);
  const mangoBoon2 = await page.evaluate(() => window.__capy.capy.boon);
  assertTrue('second press REPLACES, not stacks — still one boon at ~75s, not ~150', mangoBoon2 && mangoBoon2.id === 'mango' && mangoBoon2.t > 73 && mangoBoon2.t <= 75);
  const invAfterMango = await page.evaluate(() => Object.assign({}, window.__capy.state.qaInv));
  assertTrue('inv.mango falls 3 -> 1 (two presses)', invAfterMango.mango === 1);

  // ---- A LUCKY FEATHER: increments capy.ward, decrements the bank ----------
  await page.evaluate(() => { window.__capy.state.qaAddYuzu(500); });
  const f1 = await page.evaluate(() => window.__capy.state.qaBuyConsumable('feather', 1));
  assertTrue('feather x1 bought', f1 === true);
  const wardBefore = await page.evaluate(() => window.__capy.capy.ward || 0);
  await page.evaluate(() => { window.__capy.state.qaSetItem('feather'); });
  await page.keyboard.press('KeyT');
  await page.waitForTimeout(150);
  const afterFeather = await page.evaluate(() => ({ ward: window.__capy.capy.ward || 0, feather: window.__capy.state.qaInv.feather }));
  assertTrue('capy.ward increments by one', afterFeather.ward === wardBefore + 1);
  assertTrue('inv.feather falls to 0', afterFeather.feather === 0);
  // a second press with the bank at 0 does nothing at all
  const beforeSecond = await page.evaluate(() => ({ ward: window.__capy.capy.ward, feather: window.__capy.state.qaInv.feather }));
  await page.keyboard.press('KeyT');
  await page.waitForTimeout(150);
  const afterSecond = await page.evaluate(() => ({ ward: window.__capy.capy.ward, feather: window.__capy.state.qaInv.feather }));
  assertTrue('a press at 0 charges does nothing', afterSecond.ward === beforeSecond.ward && afterSecond.feather === beforeSecond.feather);

  // ---- THE CAP: refused at the base cap, raised by the peel pouch ---------
  // thermos base cap is 3; one is already banked from earlier (after the T
  // press above it should read 1) — top it back up to the cap first.
  await page.evaluate(() => { window.__capy.state.qaAddYuzu(500); });
  const topUp = await page.evaluate(() => {
    const g = window.__capy;
    const cur = g.state.qaInv.thermos;
    const need = 3 - cur;
    return need > 0 ? g.state.qaBuyConsumable('thermos', need) : true;
  });
  assertTrue('topped back up to the base cap (3)', topUp === true);
  const atCap = await page.evaluate(() => window.__capy.state.qaInv.thermos);
  assertTrue('thermos bank now at the base cap', atCap === 3);
  const refused = await page.evaluate(() => window.__capy.state.qaBuyConsumable('thermos', 1));
  assertTrue('a fourth thermos is refused at the base cap', refused === false);
  await page.evaluate(() => { window.__capy.state.qaForceOwned = ['peel-pouch']; });
  await page.waitForTimeout(250);
  const capNow = await page.evaluate(() => window.__capy.capy.itemCap('thermos'));
  assertTrue('capy.itemCap raised by 2 with the peel pouch forced', capNow === 5);
  const okNow = await page.evaluate(() => window.__capy.state.qaBuyConsumable('thermos', 2));
  assertTrue('the same purchase now succeeds up to the raised cap', okNow === true);
  const cappedInv = await page.evaluate(() => window.__capy.state.qaInv.thermos);
  assertTrue('thermos bank reads 5, not past it', cappedInv === 5);
  const refusedPastRaised = await page.evaluate(() => window.__capy.state.qaBuyConsumable('thermos', 1));
  assertTrue('a purchase past the RAISED cap is still refused', refusedPastRaised === false);

  // ---- RELOAD: banks and the equipped id survive; a made-up id is dropped --
  // The save is written on a 700 ms WALL-CLOCK debounce (sysSAVE_DEBOUNCE) —
  // "a streak of ticks writes once" — so a reload immediately after the last
  // mutation races an unwritten file and restores nothing at all, which
  // reads exactly like every one of these fields failing to persist. Clear
  // that race rather than chase it as a bug.
  //
  // `feather` is still equipped from its own test above with its bank at 0 —
  // per the spec an equipped id restores ONLY if its bank is > 0, so a
  // reload correctly clears it and the auto-equip fallback picks a charged
  // id instead (that is the OTHER thing this section proves, not a second
  // "survives" case). Switch to `mango`, which still has a real charge, to
  // test the id that is actually supposed to survive.
  await page.evaluate(() => { window.__capy.state.qaSetItem('mango'); });
  await page.waitForTimeout(1000);
  const before = await page.evaluate(() => ({
    inv: Object.assign({}, window.__capy.state.qaInv),
    item: window.__capy.capy.item && window.__capy.capy.item.id,
  }));
  await page.evaluate(() => {
    // a bank forced onto a made-up id must not survive a restore — write one
    // straight into localStorage's own journey file, past the game's API.
    try {
      const key = 'capy3.journey.v1';
      const raw = localStorage.getItem(key);
      if (raw) {
        const j = JSON.parse(raw);
        j.inv = Object.assign({}, j.inv, { 'made-up-id': 7 });
        localStorage.setItem(key, JSON.stringify(j));
      }
    } catch (e) {}
  });
  await page.reload();
  await page.waitForTimeout(4500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  const restored = await page.evaluate(() => ({
    started: window.__capy.state.started,
    inv: Object.assign({}, window.__capy.state.qaInv),
    item: window.__capy.capy.item && window.__capy.capy.item.id,
  }));
  assertTrue('still started after reload (auto-resumed)', restored.started === true);
  assertTrue('thermos bank survives the reload', restored.inv.thermos === before.inv.thermos);
  assertTrue('mango bank survives the reload', restored.inv.mango === before.inv.mango);
  assertTrue('the equipped id survives the reload', restored.item === before.item);
  assertTrue('the made-up id was NOT restored into inv', restored.inv['made-up-id'] === undefined);

  out.errs = errs.slice(0, 10);
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l8-item.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
  if (out.fail.length || errs.length) {
    throw new Error('l8-item FAILED: ' + JSON.stringify({ fail: out.fail, errs: out.errs }));
  }
}
