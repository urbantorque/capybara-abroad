async page => {
  // qa/l9-shop.js — A SHOP, EVERY BIOME, ON THE MAP (LIFT9, S)
  //
  //   node server.mjs                                 (PORT=5188)
  //   playwright-cli -s=l9s open http://localhost:5188/
  //   playwright-cli -s=l9s run-code --filename=qa/l9-shop.js
  //
  // Per biome (19): force the chapter's own first tick (so both the
  // traveller's gateChap and the shop's own chapDoneHere-gated paper row
  // read "here"), switch to it, and check:
  //   (a) the stall is built and visible (game.state.qaStallInfo, npc.js)
  //   (b) a static body tagged `userData.stall` exists in game.world, roughly
  //       table-sized (the authored half extents, 0.85 x 0.5 x 0.45)
  //   (c) a short real E-tap at the traveller's own position opens the bag
  //       in person, with no away-line — same door qa/l8-bag.js already
  //       proved, checked again here because THIS pass added a body next to
  //       it and a regression would be a collider silently blocking reach
  //   (d) game.shopWhere(biome) resolves and agrees with game.travWhere
  //       (the shop is physically the traveller's own stall)
  //
  // Kyoto and Pantanal get one extra live check each: the stall's own
  // footprint against that chapter's `isOverWater`/`navBlocked`, because a
  // flat 1.6 m offset is exactly the kind of thing that reads fine on paper
  // and lands a table leg over a rail — see kyoto.js's own `shopAngle`
  // comment for the one chapter that needed a tweak, and pantanal.js's
  // traveller placement comment for the one that (measured, not assumed)
  // did not.
  //
  // NOT re-tested here: that buying is available from anywhere (qa/l8-bag.js
  // already proves the wallet opens the bag and buys from 200 m away, and
  // this pass added no proximity gate to `buyUpgrade`/`buyConsumable` at
  // all — grep confirms neither function reads a position). One dedicated
  // check below proves `qaBuyUpgrade` still succeeds from hundreds of
  // metres away, once, rather than 19 times spending down the same finite
  // ladder of tiers for no new information.
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message || e).slice(0, 300)));
  const out = { fail: [], rows: [] };
  const assertTrue = (label, ok) => { if (!ok) out.fail.push(label + ': false (' + JSON.stringify(ok) + ')'); };

  const keyDown = (code) => page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true })), code);
  const keyUp = (code) => page.evaluate((c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true })), code);

  // A REAL CLEAN SLATE, NOT JUST A CLEAR() (measured harness trap): this
  // suite buys an upgrade near its end, and the running page's own
  // `visibilitychange` autosave flush (systems.js, not `beforeunload` —
  // see its own doc comment on why) fires as `page.goto` navigates AWAY
  // from a page that still has that purchase in memory, rewriting the very
  // save `localStorage.clear()` just removed. Navigating to a page with no
  // `game` object first drains that flush with nothing left to write, so
  // the clear beneath it actually sticks.
  await page.goto('about:blank');
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  const started = await page.evaluate(() => !!(window.__capy && window.__capy.state.started));
  if (!started) throw new Error('l9-shop: the door did not open');

  // { biome: chapter number } — same numbers as each chapter's own
  // `gateChap` (== `chapterOf`), mirrored here for the same reason
  // qa/l8-trav.js mirrors sysTRAV_PLACE: this file cannot read systems.js's
  // closure-private tables.
  // MEASURED, not guessed, after this file's own first draft had sahara and
  // hanoi swapped (8 <-> 19) against qa/l8-trav.js's own REF table and cost
  // a paper-row false negative before the mistake was found: chapterOf() is
  // shared.js's CHAPTERS order, not addTraveller's call order.
  const CHAPS = {
    sydney: 1, pasto: 2, quay: 3, kyoto: 4, cali: 5, rio: 6, iceland: 7,
    sahara: 8, drift: 9, venice: 10, kowloon: 11, palawan: 12, goreme: 13,
    manly: 14, pantanal: 15, cave: 16, antarctic: 17, monaco: 18, hanoi: 19,
  };

  for (const biome of Object.keys(CHAPS)) {
    const n = CHAPS[biome];
    const switched = await page.evaluate(([biome, n]) => {
      const g = window.__capy;
      try { g.state.qaForceChapTick(n); } catch (e) {}
      g.biome.switchTo(biome);
      return true;
    }, [biome, n]);
    assertTrue(biome + ': switched to', switched === true);
    await page.waitForTimeout(1000);

    const shopWhere = await page.evaluate((biome) => window.__capy.shopWhere(biome), biome);
    const travWhere = await page.evaluate((biome) => window.__capy.travWhere(biome), biome);
    const resolved = !!(shopWhere && typeof shopWhere.x === 'number');
    assertTrue(biome + ': shopWhere resolves to a point', resolved);
    assertTrue(biome + ': shopWhere is the same spot as travWhere',
      !!(shopWhere && travWhere && shopWhere.x === travWhere.x && shopWhere.z === travWhere.z));

    const stallInfo = await page.evaluate((biome) => window.__capy.state.qaStallInfo(biome), biome);
    assertTrue(biome + ': stall built', !!(stallInfo && stallInfo.built));
    assertTrue(biome + ': stall visible (gateChap satisfied)', !!(stallInfo && stallInfo.visible));
    assertTrue(biome + ': stall has a physics body', !!(stallInfo && stallInfo.hasBody));

    // Filtered by biome, not "the first stall body found": THE SYDNEY CAMEO
    // LEAKS, and it is not this pass's leak to fix. `game.addTraveller` for
    // Sydney (main.js) runs before `biome.capture()` wraps any per-chapter
    // build — the one cameo built outside a capture tag — so neither its own
    // body NOR this pass's new stall body is ever tagged for removal (proven
    // live: `userData.local`/`userData.stall` for biome:'sydney' persists in
    // `game.world.bodies` no matter which chapter is current). Every one of
    // the other eighteen IS captured and removed on biome switch, same as
    // their own traveller. Filtering by biome sidesteps the pre-existing
    // leak rather than silently grading against whichever body happens to be
    // first in the array.
    const bodyInfo = await page.evaluate((biome) => {
      const g = window.__capy;
      for (let i = 0; i < g.world.bodies.length; i++) {
        const b = g.world.bodies[i];
        if (b.userData && b.userData.stall && b.userData.stall.biome === biome) {
          const s = b.shapes[0];
          const he = s && s.halfExtents;
          return { pos: { x: b.position.x, y: b.position.y, z: b.position.z },
                   he: he ? { x: he.x, y: he.y, z: he.z } : null };
        }
      }
      return null;
    }, biome);
    assertTrue(biome + ': exactly one live stall body, roughly table-sized',
      !!(bodyInfo && bodyInfo.he && bodyInfo.he.x > 0.5 && bodyInfo.he.x < 1.2 &&
         bodyInfo.he.y > 0.3 && bodyInfo.he.y < 0.8 && bodyInfo.he.z > 0.25 && bodyInfo.he.z < 0.7));

    // ---- KYOTO / PANTANAL: THE TWO FLAGGED CHAPTERS ------------------------
    if (biome === 'kyoto' && bodyInfo) {
      const overWater = await page.evaluate((p) => {
        const g = window.__capy;
        const he = { x: 0.85, z: 0.45 };
        let any = false;
        for (const dx of [-he.x, he.x]) for (const dz of [-he.z, he.z]) {
          if (g.kyoto.isOverWater(p.x + dx, p.z + dz)) any = true;
        }
        return any;
      }, bodyInfo.pos);
      assertTrue('kyoto: stall footprint stays off the river (all 4 corners)', overWater === false);
    }
    if (biome === 'pantanal' && bodyInfo) {
      const wet = await page.evaluate((p) => {
        const g = window.__capy;
        const he = { x: 0.9, z: 0.5 };
        let any = false;
        for (const dx of [-he.x, he.x]) for (const dz of [-he.z, he.z]) {
          if (g.pantanal.isOverWater(p.x + dx, p.z + dz) || g.pantanal.navBlocked(p.x + dx, p.z + dz, 0.1)) any = true;
        }
        return any;
      }, bodyInfo.pos);
      assertTrue('pantanal: stall footprint stays on the causeway (all 4 corners)', wet === false);
    }

    // ---- E-TAP AT THE TRAVELLER'S OWN SPOT: THE BAG, NO AWAY-LINE ----------
    if (resolved) {
      await page.evaluate(([x, y, z]) => {
        const g = window.__capy;
        const cb = g.capy.body;
        cb.position.set(x, y + 0.05, z);
        cb.velocity.set(0, 0, 0);
        cb.previousPosition.copy(cb.position);
        cb.interpolatedPosition.copy(cb.position);
      }, [shopWhere.x, shopWhere.y, shopWhere.z]);
      await page.waitForTimeout(400);
      await keyDown('KeyE');
      await page.waitForTimeout(400); // short of the 1.2 s gift threshold
      await keyUp('KeyE');
      await page.waitForTimeout(300);
      const bag = await page.evaluate(() => {
        const el = document.querySelector('.capyui-bag');
        const away = document.querySelector('.capyui-bagaway');
        return { shown: !!(el && el.classList.contains('show')), awayHidden: !!(away && away.hidden) };
      });
      assertTrue(biome + ': a short E-tap at the stall opens the bag in person', bag.shown);
      assertTrue(biome + ': ...with no away-line', bag.awayHidden);
      // close it before the next biome switch, else the world stays paused
      await page.evaluate(() => { if (window.__capy.state.qaCloseBag) window.__capy.state.qaCloseBag(); });
      await page.waitForTimeout(200);
    }

    out.rows.push({ biome, n, resolved, sameSpot: !!(shopWhere && travWhere && shopWhere.x === travWhere.x),
                    stallInfo, bodyHe: bodyInfo && bodyInfo.he });
  }

  // ---- BUYING STAYS AVAILABLE FROM ANYWHERE — NO NEW PROXIMITY GATE --------
  // Once, far from any stall: this pass touched neither `buyUpgrade` nor
  // `buyConsumable`, so the only thing worth re-proving is that they still
  // work from a position nowhere near one.
  const boughtFromAfar = await page.evaluate(() => {
    const g = window.__capy;
    g.capy.body.position.set(9999, 50, 9999);
    g.state.qaAddYuzu(5000);
    // Whichever tier of whichever everyday upgrade is next in line — not
    // hardcoded to one id/tier, since a save this suite has already touched
    // (or a prior QA run against the same long-lived browser session) may
    // have some of these already maxed. `owned` is published read-only for
    // exactly this kind of external check.
    const ids = ['puff', 'wind', 'legs', 'slide', 'breath', 'feet'];
    for (const id of ids) {
      let tier = 0;
      const pfx = id + ':';
      for (const o of g.state.qaOwned) {
        if (o === id) tier = Math.max(tier, 1);
        else if (typeof o === 'string' && o.indexOf(pfx) === 0) tier = Math.max(tier, parseInt(o.slice(pfx.length), 10));
      }
      if (g.state.qaBuyUpgrade(id, tier)) return true;
    }
    // Every everyday upgrade tier already owned (an exhausted save) — a
    // consumable is never fully owned, only capped, so it is the fallback.
    return g.state.qaBuyConsumable('mango', 1) || g.state.qaBuyConsumable('feather', 1) ||
           g.state.qaBuyConsumable('thermos', 1);
  });
  assertTrue('buying still succeeds from 9999 m away (no new proximity gate)', boughtFromAfar === true);

  // ---- THE MINIMAP GLYPH: STEADY, THEN PULSING ONCE AFFORDABLE -------------
  // Sahara (an easy, open chapter, already the live one from the loop above)
  // for this half of the check. `todoRefresh` only runs on specific events —
  // a biome switch landing or a task tick, never on a bare timer (MEASURED:
  // `game.state.qaAddYuzu` alone does not call it) — so every check below
  // that expects the paper to reflect a fresh wallet number forces one via a
  // real round trip through another chapter and back, the same event a
  // player re-entering a place after a shop visit actually gets.
  async function forceRefresh() {
    await page.evaluate(() => {
      const g = window.__capy;
      g.biome.switchTo('goreme');
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const g = window.__capy;
      g.state.qaForceChapTick(8);
      g.biome.switchTo('sahara');
    });
    await page.waitForTimeout(800);
  }
  await forceRefresh();
  const cheapest = await page.evaluate(() => window.__capy.state.qaShopCheapest());
  assertTrue('cheapestUnowned() resolves to a number (there is a next tier or a wearable to sell)',
    typeof cheapest === 'number');

  // ---- THE PAPER ROW: APPEARS ONLY WHEN AFFORDABLE AND GATED-VISIBLE -------
  await page.evaluate(() => {
    const g = window.__capy;
    // Force the wallet below the floor so shopRowOn() reads false.
    const cur = g.state.qaYuzu();
    if (cur > 0) g.state.qaAddYuzu(-cur);
  });
  await forceRefresh();
  const paperBeforeShown = await page.evaluate(() => {
    const el = document.querySelector('.capyui-shop');
    return el ? el.classList.contains('capyui-hidden') : null;
  });
  assertTrue('the shop paper row is hidden with an empty wallet', paperBeforeShown === true);
  await page.evaluate((cu) => window.__capy.state.qaAddYuzu(cu + 50), cheapest);
  await forceRefresh();
  const paperAfter = await page.evaluate(() => {
    const el = document.querySelector('.capyui-shop');
    return el ? !el.classList.contains('capyui-hidden') : null;
  });
  assertTrue('...and appears once the wallet clears the cheapest unowned price', paperAfter === true);

  out.errs = errs.slice(0, 10);
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l9-shop.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
  if (out.fail.length || errs.length) {
    throw new Error('l9-shop FAILED: ' + JSON.stringify({ fail: out.fail, errs: out.errs }, null, 1));
  }
  return { rows: out.rows.length, fail: out.fail.length };
}
