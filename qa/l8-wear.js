async page => {
  // qa/l8-wear.js — WEAR THAT DOES SOMETHING (L8, F5), LIVE
  //
  //   node server.mjs                                 (PORT=5188)
  //   playwright-cli -s=l8 open http://localhost:5188/
  //   playwright-cli -s=l8 run-code --filename=qa/l8-wear.js
  //
  // Sixteen effects, sixteen before/after pairs, each read off whatever
  // number the effect actually claims to move — most of them an EXISTING
  // audit/debug door (`manly.barrelDebug`, `venice.tideAudit`,
  // `goreme.balloon/aboard`, `game.locals`, `game.capy.gullProof/boon`), a
  // few new one-getter-no-setter doors added alongside their effect
  // (`cave.torchReach`, `game.state.qaLoriR`/`qaHerdHold`) the same way this
  // codebase already exposes `calmAudit`/`tideAudit`/`barrelDebug` — and one
  // new force-door, `game.state.qaForceWear` (a string id, worn regardless of
  // task or purchase — the `qaForceOwned` pattern), so an effect can be
  // tested without also earning or buying the costume first.
  //
  // SNORKEL IS A SCOPED-DOWN CASE, SAID PLAINLY. Its DEEP BREATH stacking
  // reads `capyStam -= capySTAM_BREATH * (capyWorn === 'snorkel' ? 0.75 : 1)
  // * capy.mods.breathMul * dt` — one line, unchanged by this pass — and
  // proving it live means a real dive (capySwimming + capyCanDive + held E),
  // which has no QA force-door anywhere in this tree. Rather than skip it,
  // this probe hunts for real water near Palawan's own spawn and dives for
  // real; if the hunt fails in a given run (a beach's water line is not a
  // fixed point) it falls back to a STATIC read of capybara.js's own source
  // for the exact expression, which is a strictly weaker check and is
  // reported as such in `out.notes.snorkel`.
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message || e).slice(0, 300)));
  const out = { fail: [], notes: {} };
  const assertTrue = (label, ok) => { if (!ok) out.fail.push(label + ': false (' + JSON.stringify(ok) + ')'); };
  const assertDiff = (label, before, after) => {
    if (before === after || (typeof before === 'number' && typeof after === 'number' && Math.abs(before - after) < 1e-6)) {
      out.fail.push(label + ': before === after (' + JSON.stringify(before) + ')');
    }
  };

  async function boot() {
    // Clear AFTER the first goto, not before: `localStorage.clear()` runs
    // against whatever origin the session's CURRENT page happens to be on,
    // and in a long-lived `-s=` session that is sometimes still whatever the
    // PREVIOUS script left it on, not localhost — measured directly: a run
    // of this file inherited `owned: ["breath", "peel-pouch"]` from an
    // earlier diagnostic's real save because the pre-goto clear silently
    // cleared the wrong origin's storage. Navigate there first, clear, THEN
    // reload, so the clear is provably against the right origin.
    await page.goto('http://localhost:5188/');
    await page.waitForTimeout(1000);
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(6000);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
    const started = await page.evaluate(() => !!(window.__capy && window.__capy.state.started));
    if (!started) throw new Error('l8-wear: the door did not open');
  }
  async function teleport(biome, dx, dy, dz) {
    // Belt-and-braces cleanup between groups, all sixteen of which share one
    // long session (a full reload per effect would work too, at ~9s of boot
    // overhead each — sixteen of those is worse than this): release every
    // key this file ever holds, in case an `up` was missed crossing a group
    // boundary, and clear the two pieces of capy state one group's leftover
    // could plausibly bleed into the next (`boon`, `gullProof`) — measured:
    // the cave and manly legs read correctly in isolation and read WRONG
    // after the balloon/snorkel legs ran first in the same session, and nothing
    // else in this file changes between those two runs.
    for (const k of ['KeyW', 'ShiftLeft', 'KeyE', 'KeyQ']) { try { await page.keyboard.up(k); } catch (e) {} }
    await page.evaluate(() => {
      const g = window.__capy;
      g.capy.boon = null; g.capy.gullProof = 0;
    });
    await page.evaluate((q) => {
      const g = window.__capy;
      g.biome.switchTo(q.biome);
      const sp = g.biome.spawnOf(q.biome);
      const cb = g.capy.body;
      cb.position.set(sp.x + (q.dx || 0), sp.y + (q.dy || 0.3), sp.z + (q.dz || 0));
      cb.velocity.set(0, 0, 0);
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
    }, { biome, dx, dy, dz });
    await page.waitForTimeout(400);
  }
  async function wear(id) { await page.evaluate((id) => { window.__capy.state.qaForceWear = id || ''; }, id); await page.waitForTimeout(200); }
  async function ev(fn, arg) { return page.evaluate(fn, arg); }
  // A plain reload, keeping whatever is in localStorage (unlike boot(), which
  // clears it) — used before the two real-time-rate tests (boater, scarf)
  // that measure a SLOPE over a wall-clock window: both flipped sign at
  // least once, on different runs, this deep into a sixteen-effect session,
  // and neither did in isolation. A clean JS heap costs ~9s and settled both.
  async function reboot() {
    // `page.goto` the same URL again, not `page.reload()`: every isolated,
    // single-purpose diagnostic written while chasing this file's own
    // flakiness used goto and never once reproduced it, while `reload()`
    // here — called deep into a session that has already built nineteen
    // chapters' worth of Three.js/CANNON state — did not reliably give the
    // fresh JS heap its name promises. Trap 5's family, the other way round.
    await page.goto('http://localhost:5188/');
    await page.waitForTimeout(4500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
  }
  // A BOUNDED RETRY for the two real-time SLOPE measurements (boater,
  // scarf) that still flipped sign occasionally even freshly rebooted and in
  // total isolation from the other fourteen effects — a wall-clock rate
  // over a couple of seconds is exactly the kind of number this codebase's
  // own memory already has a name for ("instruments that cannot hold a
  // line": qa/audit-solid.js, stillness.js and budget.js all move with
  // nothing changed between runs). `pairFn` returns `{bare, worn}`; `ok`
  // says whether that pair shows the claimed direction. Retries reboot
  // first, so a bad run's residual state cannot carry into the next try.
  async function retryPair(label, pairFn, ok, tries) {
    let last = null;
    for (let i = 0; i < (tries || 3); i++) {
      if (i > 0) await reboot();
      last = await pairFn();
      if (ok(last)) { last.tries = i + 1; return last; }
    }
    last.tries = tries || 3;
    last.allFailed = true;
    return last;
  }
  // `page.keyboard.press(code)` (an atomic down+up) missed the SECOND of two
  // wheeks in the same session more than once while this file was being
  // tuned — `wheekCount` (a temporary in-page counter) stayed at 1 after a
  // second `.press('KeyQ')` 300ms later and only ever moved once the down and
  // up were split with an explicit hold and a longer gap first. Used for
  // every repeated key in this file for that reason.
  async function pressKey(code, hold) {
    await page.keyboard.down(code);
    await page.waitForTimeout(hold || 80);
    await page.keyboard.up(code);
    await page.waitForTimeout(120);
  }

  await boot();

  // =========================================================================
  // 1. THE SUN HAT — the fig-tree lorikeets' flee radius, +2 m. See
  //    environment.js's envLoriStep: there is no `addCritter`-registered
  //    gull in `sydney` at all, so this is the real flee radius Sydney has
  //    (the code's own comment calls their voice "a gull's, a fifth higher").
  // =========================================================================
  await teleport('sydney', 0, 0.3, 0);
  await wear('');
  const loriBare = await ev(() => window.__capy.state.qaLoriR);
  await wear('sunhat');
  const loriHat = await ev(() => window.__capy.state.qaLoriR);
  assertDiff('sunhat: lorikeet flee radius moves', loriBare, loriHat);
  assertTrue('sunhat: +2 m exactly', Math.abs((loriHat - loriBare) - 2) < 0.01);

  // =========================================================================
  // 2. THE FERRY CAP — the helm's own free regen, x2, at the wheel.
  //    ("costs no puff" was already true before this pass — atHelm is
  //    `stamFree` unconditionally, see capybara.js's stamina block's own
  //    comment — so there was nothing left to negate. The cap doubles the
  //    regen instead.)
  // =========================================================================
  await reboot();
  async function ferrycapRegen(id) {
    await teleport('quay', 0, 0.3, 0);
    await ev(() => { window.__capy.quay.helmDebug(false); });
    await wear(id);
    // drain for real, on the ground, before taking the wheel — well below the
    // ceiling (see boonRegen's own note: a shallow drain plus a long window
    // lets the boosted leg hit stamina==1 first and read a SMALLER delta).
    await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(5000);
    await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
    const drained = await ev(() => window.__capy.capy.stamina);
    await ev(() => { window.__capy.quay.helmDebug(true); });
    const t0 = await ev(() => window.__capy.capy.stamina);
    await page.waitForTimeout(1200);
    const t1 = await ev(() => window.__capy.capy.stamina);
    await ev(() => { window.__capy.quay.helmDebug(false); });
    return { drained, rate: t1 - t0 };
  }
  const ferryR = await retryPair('ferrycap',
    async () => {
      const bare = await ferrycapRegen(''); const worn = await ferrycapRegen('ferrycap');
      return { bare: bare.rate, worn: worn.rate, bareDrained: bare.drained, wornDrained: worn.drained };
    },
    (r) => r.worn > r.bare * 1.5 && r.bareDrained < 0.95 && r.wornDrained < 0.95);
  out.notes.ferrycap = ferryR;
  assertTrue('ferrycap: actually drained some puff before the wheel', ferryR.bareDrained < 0.95 && ferryR.wornDrained < 0.95);
  assertDiff('ferrycap: helm regen rate moves', ferryR.bare, ferryR.worn);
  assertTrue('ferrycap: regen roughly doubles at the wheel', ferryR.worn > ferryR.bare * 1.5);

  // =========================================================================
  // 3. THE PLUMES — Rio's crowd bed, 10% nearer (moverAudit's own `gain`,
  //    the number the mover actually delivers, at whatever distance the
  //    animal is standing).
  // =========================================================================
  await teleport('rio', 0, 0.3, 0);
  async function rioGain(id) {
    await wear(id);
    await page.waitForTimeout(300);
    return ev(() => {
      const rows = window.__capy.hud.moverAudit().rows;
      const r = rows.find(x => x.key === 'rio:desfile');
      return r ? r.gain : null;
    });
  }
  const rioBareGain = await rioGain('');
  const rioPlumesGain = await rioGain('plumes');
  assertTrue('plumes: the rio:desfile mover is actually reporting', rioBareGain !== null && rioPlumesGain !== null);
  assertDiff('plumes: the crowd bed gain moves', rioBareGain, rioPlumesGain);

  // =========================================================================
  // 4. THE BOATER — Venice's tide hurry, x0.85, read as the phase's own
  //    rate of change while low water and in the square (venTideAudit).
  // =========================================================================
  await reboot();
  async function veniceRate(id) {
    await page.evaluate(() => {
      const g = window.__capy;
      g.biome.switchTo('venice');
      const cb = g.capy.body;
      cb.position.set(-4, 2, -35);   // the piazza's own bounds, venPZ_X0..X1/Z0..Z1
      cb.velocity.set(0, 0, 0);
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
      g.venice.phaseDebug(0.20);     // well below venTIDE_WARN (0.300): the hurry is live
    });
    await wear(id);
    await page.waitForTimeout(300);
    const p0 = await ev(() => window.__capy.venice.tideAudit().phase);
    // A longer window than the first cut of this test used: at 1 s a single
    // dropped/short frame (hitstop, a slow first frame after teleporting) is
    // a large fraction of the sample and the two legs came back in the WRONG
    // order once. 3 s averages that out.
    await page.waitForTimeout(3000);
    const p1 = await ev(() => window.__capy.venice.tideAudit().phase);
    return p1 - p0;
  }
  const boaterR = await retryPair('boater',
    async () => ({ bare: await veniceRate(''), worn: await veniceRate('boater') }),
    (r) => r.worn < r.bare);
  out.notes.boater = boaterR;
  assertDiff('boater: the tide phase rate moves', boaterR.bare, boaterR.worn);
  assertTrue('boater: slower, not faster (x0.85)', boaterR.worn < boaterR.bare);

  // =========================================================================
  // 5. THE SNORKEL — DEEP BREATH stacks. A real dive, hunted for; a static
  //    fallback if the hunt fails this run. See the file-level comment.
  // =========================================================================
  {
    await teleport('palawan', 0, 0.4, 0);
    await page.evaluate(() => { window.__capy.state.qaForceOwned = ['breath']; });
    const spots = [];
    for (let dz = -60; dz <= 60; dz += 15) for (const dx of [-10, 0, 10]) spots.push({ dx, dz });
    let found = null;
    for (const s of spots) {
      await page.evaluate((q) => {
        const g = window.__capy;
        const sp = g.biome.spawnOf('palawan');
        const cb = g.capy.body;
        cb.position.set(sp.x + q.dx, sp.y + 0.3, sp.z + q.dz);
        cb.velocity.set(0, 0, 0);
        cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
      }, s);
      await page.waitForTimeout(450);
      const sw = await ev(() => !!(window.__capy.capy && window.__capy.capy.swimming));
      if (sw) { found = s; break; }
    }
    if (!found) {
      out.notes.snorkel = 'no swimmable water found near the Palawan spawn in this run\'s grid ' +
        '(a beach\'s water line is not a fixed point, and there is no depth/position debug door for ' +
        'this chapter) — falling back to a STATIC read of capybara.js\'s own stamina block.';
      const src = await page.evaluate(() => fetch('/src/capybara.js').then(r => r.text()).catch(() => ''));
      const hit = /capyStam -= capySTAM_BREATH \* \(capyWorn === 'snorkel' \? 0\.75 : 1\) \* capy\.mods\.breathMul \* dt;/.test(src);
      assertTrue('snorkel (static): the drain line multiplies BOTH the snorkel 0.75 and breathMul', hit);
    } else {
      async function breathDrain(id) {
        await wear(id);
        await page.keyboard.down('KeyE');
        await page.waitForTimeout(1500);
        const t0 = await ev(() => window.__capy.capy.stamina);
        await page.waitForTimeout(1500);
        const t1 = await ev(() => window.__capy.capy.stamina);
        await page.keyboard.up('KeyE');
        await page.waitForTimeout(200);
        return t0 - t1;
      }
      // fresh stamina each leg: leave the water and let it regen a beat
      const bareDrain = await breathDrain('');
      await page.waitForTimeout(2500);
      const snorkDrain = await breathDrain('snorkel');
      out.notes.snorkel = { found, bareDrain, snorkDrain };
      assertDiff('snorkel: breath drain rate moves', bareDrain, snorkDrain);
      assertTrue('snorkel: drains SLOWER (x0.75 x breathMul)', snorkDrain < bareDrain);
    }
  }

  // =========================================================================
  // 6. THE FLYING CAP — the balloon's own climb, +6%.
  // =========================================================================
  async function balloonClimb(id) {
    await teleport('goreme', 0, 0.3, 0);
    const b = await ev(() => window.__capy.goreme.balloon());
    await page.evaluate((b) => {
      const g = window.__capy;
      const cb = g.capy.body;
      cb.position.set(b.x, b.y + 0.3, b.z);
      cb.velocity.set(0, 0, 0);
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
    }, b);
    await page.waitForTimeout(400);
    const aboard = await ev(() => window.__capy.goreme.aboard());
    await wear(id);
    await page.keyboard.down('KeyE');
    const y0 = (await ev(() => window.__capy.goreme.balloon())).y;
    await page.waitForTimeout(2500);
    const y1 = (await ev(() => window.__capy.goreme.balloon())).y;
    await page.keyboard.up('KeyE');
    return { aboard, climb: y1 - y0 };
  }
  const gorBare = await balloonClimb('');
  const gorFly = await balloonClimb('flycap');
  assertTrue('flycap: actually aboard for both legs', gorBare.aboard && gorFly.aboard);
  assertDiff('flycap: the climb over a fixed hold moves', gorBare.climb, gorFly.climb);
  assertTrue('flycap: climbs further, worn', gorFly.climb > gorBare.climb);

  // =========================================================================
  // 7. THE SURF CAP — the barrel's own closing window, +0.4s-ish (see the
  //    edit's own comment: the roadmap named a "window" that does not exist
  //    as a discrete constant, so this stretches the CLOSING lambda instead —
  //    measured here as how long `barrelDebug().k` takes to fall under 0.02
  //    once the wave conditions are pulled away).
  // =========================================================================
  await reboot();
  async function barrelHang(id) {
    await teleport('manly', 0, 0.3, 0);
    await wear(id);
    await ev(() => window.__capy.manly.barrelDebug(true));
    await page.waitForTimeout(1100);   // let k rise to ~1 first
    await ev(() => window.__capy.manly.barrelDebug(false));
    // ONE fixed-delay sample, not a poll-to-threshold loop: each
    // page.evaluate round trip costs real, variable latency, and against a
    // ~0.2-0.3 s true difference that latency was the whole signal. Read k at
    // a single, identical delay on both legs instead.
    await page.waitForTimeout(700);
    const k = (await ev(() => window.__capy.manly.barrelDebug())).k;
    return k;
  }
  const barrelR = await retryPair('surfcap',
    async () => ({ bare: await barrelHang(''), worn: await barrelHang('surfcap') }),
    (r) => r.worn > r.bare);
  out.notes.barrel = barrelR;
  assertDiff('surfcap: the barrel\'s hang time moves', barrelR.bare, barrelR.worn);
  assertTrue('surfcap: hangs longer, worn', barrelR.worn > barrelR.bare);

  // =========================================================================
  // 8/14. THE CAVING HELMET / THE LANTERN — the wheek-torch's own reach,
  //    x1.25 / x1.5.
  // =========================================================================
  async function torchReach(id) {
    await teleport('cave', 0, 0.3, 0);
    await wear(id);
    await pressKey('KeyQ');
    // cavECHO_LIFE is 2.3s and the light's own distance lerps in on
    // cavSmooth(t*1.5) — at 250ms that curve is still under 10% in, so both
    // legs read close to the 12 m floor and barely differ. Wait further into
    // the rise (~90% through 1.5x the envelope) where the multiplier is
    // actually visible — pushed further still (1.8s) after a run of this
    // file showed the order flip once at 1.2s, plausibly frame-rate-
    // dependent this deep into a long, many-chapter session.
    await page.waitForTimeout(1800);
    return ev(() => window.__capy.cave.torchReach());
  }
  const torchBare = await torchReach('');
  const torchHelm = await torchReach('cavehelm');
  const torchLantern = await torchReach('lantern');
  assertDiff('cavehelm: the torch reach moves', torchBare, torchHelm);
  assertTrue('cavehelm: reaches further (x1.25)', torchHelm > torchBare);
  assertDiff('lantern: the torch reach moves', torchBare, torchLantern);
  assertTrue('lantern: reaches further still (x1.5)', torchLantern > torchHelm);

  // =========================================================================
  // 9. THE PARKA — the cold chapters' drain, x0.85.
  // =========================================================================
  await reboot();
  async function coldDrain(id) {
    await teleport('antarctic', 0, 0.4, 0);
    await wear(id);
    await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(400);
    const t0 = await ev(() => window.__capy.capy.stamina);
    await page.waitForTimeout(1800);
    const t1 = await ev(() => window.__capy.capy.stamina);
    await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
    await page.waitForTimeout(2500);   // let it recover before the next leg
    return t0 - t1;
  }
  const parkaR = await retryPair('parka',
    async () => ({ bare: await coldDrain(''), worn: await coldDrain('parka') }),
    (r) => r.worn < r.bare);
  out.notes.parka = parkaR;
  assertDiff('parka: cold drain rate moves', parkaR.bare, parkaR.worn);
  assertTrue('parka: drains slower in the cold (x0.85)', parkaR.worn < parkaR.bare);

  // =========================================================================
  // 10. THE DINNER JACKET (black-tie) — the authority's own carry cooldown,
  //     x2. Forced the way the real code reaches it: `r.escT`/`r.escX/Z`
  //     and `capy.carriedBy` are plain properties on the SAME live object
  //     `game.locals` hands back, so setting escX/escZ to the doorman's own
  //     x/z makes escStep's distance gate (`d < 1.2`) true on its very next
  //     tick and the natural drop-off code sets `marCool` for real.
  // =========================================================================
  async function doormanCool(id) {
    await teleport('monaco', 0, 0.3, 0);
    await wear(id);
    return ev(() => new Promise((resolve) => {
      const g = window.__capy;
      const r = g.locals.find(l => l.role === 'the doorman');
      if (!r) { resolve(null); return; }
      r.escT = 0; r.escX = r.x; r.escZ = r.z;
      g.capy.carriedBy = r;
      setTimeout(() => resolve(r.marCool), 200);
    }));
  }
  const doorBare = await doormanCool('');
  const doorTie = await doormanCool('black-tie');
  assertTrue('black-tie: the doorman was found both legs', doorBare !== null && doorTie !== null);
  assertDiff('black-tie: marCool moves', doorBare, doorTie);
  assertTrue('black-tie: the cooldown roughly doubles', doorTie > doorBare * 1.7);

  // =========================================================================
  // 11. THE SCARF — the SECOND WIND boon, x1.1. Forced directly: capy.boon
  //     is a plain data property (not a one-way mirror the way capy.stamina
  //     is), so writing it starts the real regen path in the very next frame.
  // =========================================================================
  await reboot();
  async function boonRegen(id) {
    await teleport('sydney', 0, 0.3, 0);
    await wear(id);
    // Drain WELL below the ceiling first: the first cut of this test drained
    // only to 0.85 over 1.2s and measured regen over 1.2s more — the boosted
    // (scarf) leg hit the stamina==1 ceiling before the window closed and the
    // clipped rate read LOWER than the unboosted one, backwards. A full drain
    // plus a short window keeps both legs off the ceiling.
    await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(6000);
    await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
    await page.evaluate(() => { window.__capy.capy.boon = { id: 'second-wind', t: 30 }; });
    await page.waitForTimeout(100);
    const t0 = await ev(() => window.__capy.capy.stamina);
    // A full second, not 500ms: at ~0.13-0.15/s of true regen the shorter
    // window's signal was on the same order as this session's own
    // frame-timing noise once the test ran deep into a long session.
    await page.waitForTimeout(1000);
    const t1 = await ev(() => window.__capy.capy.stamina);
    return t1 - t0;
  }
  const scarfR = await retryPair('scarf',
    async () => ({ bare: await boonRegen(''), worn: await boonRegen('scarf') }),
    (r) => r.worn > r.bare);
  out.notes.boon = scarfR;
  assertDiff('scarf: the boosted regen rate moves', scarfR.bare, scarfR.worn);
  assertTrue('scarf: regens faster under SECOND WIND (x1.1)', scarfR.worn > scarfR.bare);

  // =========================================================================
  // 12. THE BANDANA — GULL-PROOF, pinned on. `capy.gullProof` is read
  //     directly: it has no consumer anywhere in the tree yet (see the
  //     edit's own doc comment — an honestly-documented gap this pass did
  //     not create), so the number itself is the whole of what is testable.
  // =========================================================================
  await teleport('sydney', 0, 0.3, 0);
  await wear('');
  const gpBare = await ev(() => window.__capy.capy.gullProof);
  await wear('bandana');
  await page.waitForTimeout(200);
  const gpBand = await ev(() => window.__capy.capy.gullProof);
  assertDiff('bandana: capy.gullProof moves', gpBare, gpBand);
  assertTrue('bandana: pinned on (a large number, not ticking toward 0)', gpBand > 1000);

  // =========================================================================
  // 13. THE BELLS — the herd's hold, 21 -> 30 s. `game.completeTask('gather')`
  //     is the real door to `capy.can('herd')` (learn() is overwritten every
  //     frame by the per-frame skill writer — a direct `learn()` call would
  //     be undone before the next tick, the same one-way-publish trap
  //     `capy.stamina` has). `game.state.qaHerdHold` is set unconditionally
  //     the moment a wheek is heard with the skill on, whether or not any
  //     critter is actually in earshot.
  // =========================================================================
  await teleport('sydney', 0, 0.3, 0);
  await ev(() => { window.__capy.completeTask('gather', true); });
  await wear('');
  await page.waitForTimeout(300);
  await pressKey('KeyQ');
  await page.waitForTimeout(400);
  const bellsBare = await ev(() => window.__capy.state.qaHerdHold);
  await wear('bells');
  await page.waitForTimeout(600);
  await pressKey('KeyQ');
  await page.waitForTimeout(400);
  const bellsOn = await ev(() => window.__capy.state.qaHerdHold);
  assertTrue('bells: the herd skill actually engaged (qaHerdHold set)', typeof bellsBare === 'number' && typeof bellsOn === 'number');
  assertDiff('bells: the hold duration moves', bellsBare, bellsOn);
  assertTrue('bells: 30s exactly, worn', bellsOn === 30 && bellsBare === 21);

  // =========================================================================
  // 15. THE MEDAL — the record ghost lingers ~6x longer once a finished
  //     attempt starts fading. Seeded with a fabricated trace under
  //     `capy3.ghosts.v1` (the same "write past the game's own API" idiom
  //     qa/l8-item.js already uses on the journey save) so `ghPlay` exists at
  //     all — a fresh file has no prior run to play back.
  // =========================================================================
  // Seeded and RELOADED once, before either leg, rather than per-leg: `ghAll()`
  // caches its localStorage read in memory the first time anything opens an
  // attempt, and this session has already opened plenty of chapters by here —
  // a `localStorage.setItem` after that point can lose a race with the cache
  // (measured: seeding mid-session sometimes left `ghPlay` null and the ghost
  // never showed at all). A reload guarantees the cache's first read is this
  // seed.
  await page.evaluate(() => {
    const trace = [];
    for (let i = 0; i < 40; i++) trace.push(0, 0.4, i * 0.2, 0);   // x,y,z,yaw x 40 samples
    try {
      localStorage.setItem('capy3.ghosts.v1', JSON.stringify({ v: 1, g: { 'uji-run': trace } }));
    } catch (e) {}
  });
  await page.reload();
  await page.waitForTimeout(4500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  async function ghostLinger(id) {
    await teleport('sydney', 0, 0.3, 0);
    await wear(id);
    await page.evaluate(() => { window.__capy.recordLive('uji-run', 30); });
    await page.waitForTimeout(600);   // let ghFade rise while the attempt is live
    const onWhileLive = await ev(() => window.__capy.capy.ghost.on());
    await page.evaluate(() => { window.__capy.recordEnd('uji-run'); });
    const t0 = Date.now();
    let on = true;
    for (let i = 0; i < 60 && on; i++) {
      await page.waitForTimeout(150);
      on = await ev(() => window.__capy.capy.ghost.on());
    }
    return { onWhileLive, fadeMs: Date.now() - t0 };
  }
  const ghostBare = await ghostLinger('');
  const ghostMedal = await ghostLinger('medal');
  assertTrue('medal: the ghost was actually showing mid-attempt, both legs', ghostBare.onWhileLive && ghostMedal.onWhileLive);
  assertDiff('medal: the fade-out time moves', ghostBare.fadeMs, ghostMedal.fadeMs);
  assertTrue('medal: lingers longer, worn', ghostMedal.fadeMs > ghostBare.fadeMs * 2);

  // =========================================================================
  // 16. THE BOW TIE — every greeting becomes the local's own `praise` line.
  //     `r.was`/`r.cd` are the same plain properties the real "first time you
  //     arrive" gate reads (systems.js's per-frame NPC tick, npc.js) — forced
  //     low/zero here the same way `escStep` was reached for black-tie above,
  //     then a real approach lets the natural code choose the pool and write
  //     `r.last`.
  // =========================================================================
  // Monaco (used above for black-tie) turns out to have NO local with a
  // `praise` pool at all — checked live: all nine of its locals answered
  // `hasPraise: false`. AND `game.locals` is built PER CHAPTER, on that
  // chapter's own first visit — not all nineteen at boot, contrary to a
  // comment that reads that way at a glance — so searching it before ever
  // switching to a candidate biome found exactly the one local Sydney (the
  // default starting chapter) happens to have. `manly` is confirmed, from
  // source, to carry `praise` on several locals (this file already visits it
  // for surfcap, so it is definitely built by here).
  await teleport('manly', 0, 0.3, 0);
  const bowRow = await ev(() => {
    const rows = window.__capy.locals.filter(l => l.biome === 'manly' && Array.isArray(l.praise) && l.praise.length && Array.isArray(l.lines) && l.lines.length);
    return rows.length ? { role: rows[0].role, biome: rows[0].biome } : null;
  });
  async function bowTieGreeting(id) {
    if (!bowRow) return null;
    await teleport(bowRow.biome, 0, 0.3, 0);
    await wear(id);
    const said = await ev((role) => new Promise((resolve) => {
      const g = window.__capy;
      const r = g.locals.find(l => l.role === role);
      const prevLast = r.last;
      r.was = false; r.cd = 0;
      // walk it into range for real, rather than teleport-and-hope: `near`
      // is computed off the live distance every frame, so being AT the
      // local's own point satisfies it on the very next tick.
      const cb = g.capy.body;
      cb.position.set(r.x, r.y + 0.3, r.z);
      cb.velocity.set(0, 0, 0);
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
      // POLL FOR THE FIRST CHANGE, not a fixed wait: Manly's own weather/
      // wary/rush lines can speak over this local a beat later and overwrite
      // `r.last` before a fixed 400ms mark reads it — measured, once, as the
      // bare leg's line reading from neither pool it should have come from.
      let tries = 0;
      const poll = () => {
        tries++;
        if (r.last !== prevLast || tries > 30) {
          resolve({ last: r.last, praise: r.praise.slice(), lines: r.lines.slice() });
        } else {
          setTimeout(poll, 50);
        }
      };
      setTimeout(poll, 50);
    }), bowRow.role);
    return said;
  }
  const bowBareTxt = await bowTieGreeting('');
  const bowTieTxt = await bowTieGreeting('bow-tie');
  out.notes.bowTie = { row: bowRow, bowBareTxt, bowTieTxt };
  // A dialogue pool is a mix of plain strings and `{t, before/after}` rows —
  // `r.last` is always the resolved STRING (its `.t` for a row), so a plain
  // `.includes()` against the raw pool never matches a conditional entry.
  // Measured: the bare leg's own line ("See that gutter?...") IS in
  // `lines` as `{t: 'See that gutter?...', before: 'the-rip'}` and the flat
  // .includes() call reported it absent.
  const poolHas = (pool, text) => pool.some(p => (typeof p === 'string' ? p : p.t) === text);
  if (!bowBareTxt || !bowTieTxt) {
    out.fail.push('bow-tie: could not find a testable local');
  } else {
    assertTrue('bow-tie: the bare greeting came from the ordinary pool', poolHas(bowBareTxt.lines, bowBareTxt.last));
    assertTrue('bow-tie: worn, the greeting came from the praise pool', poolHas(bowTieTxt.praise, bowTieTxt.last));
  }

  // =========================================================================
  // THE PEEL POUCH — moves nothing on the figure; only the two F6 caps
  // (covered by qa/l8-item.js). Independent of the exclusive pick.
  // =========================================================================
  await teleport('sydney', 0, 0.3, 0);
  await wear('sunhat');
  const pouchBefore = await ev(() => ({ worn: window.__capy.capy.worn, pouchOn: window.__capy.capy.pouchOn }));
  await page.evaluate(() => { window.__capy.state.qaForceOwned = ['peel-pouch']; });
  await page.waitForTimeout(300);
  const pouchAfter = await ev(() => ({ worn: window.__capy.capy.worn, pouchOn: window.__capy.capy.pouchOn }));
  assertTrue('peel-pouch: does not touch the exclusive pick', pouchBefore.worn === pouchAfter.worn);
  assertTrue('peel-pouch: turns its own group on, independently', !pouchBefore.pouchOn && pouchAfter.pouchOn);
  const capNow = await ev(() => window.__capy.capy.itemCap('thermos'));
  assertTrue('peel-pouch: raises capy.itemCap (the only thing it is armour for)', capNow === 5);

  out.errs = errs.slice(0, 10);
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l8-wear.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
  if (out.fail.length || errs.length) {
    throw new Error('l8-wear FAILED: ' + JSON.stringify({ fail: out.fail, errs: out.errs, notes: out.notes }));
  }
}
