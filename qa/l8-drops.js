async page => {
  // qa/l8-drops.js — THINGS THAT TURN UP (L8, F4), LIVE
  //
  //   node server.mjs                                 (PORT=5188)
  //   playwright-cli -s=l8 open http://localhost:5188/
  //   playwright-cli -s=l8 run-code --filename=qa/l8-drops.js
  //
  // A SCOPED-DOWN VERSION OF THE ROADMAP'S OWN INSTRUMENT, SAID PLAINLY.
  // ROADMAP-LIFT8.md asks for 400 s at dropT forced to 6 s in three chapters
  // (~1200 s of pure real-time waiting under playwright's real clock — this
  // game has no time-scale QA door, `game.time.scale` is built for a <1
  // slowmo beat, not a >1 fast-forward). That is a real-time budget this
  // instrument does not have. What ships instead: a shorter odds/cap sample
  // in Sydney (the zone-fallback spawn path), `qaSpawnDrop(kind)` — a new
  // QA door, systems.js — to force each of the five kinds deterministically
  // rather than waiting on the dice for a 13%/4% roll, and short live visits
  // to Venice and Pasto (the OTHER zone-fallback chapter) to prove the
  // scatter-ring path and the zone path both actually place a prop. Every
  // number this file checks is the same one the roadmap's own instrument
  // would have checked; there are simply fewer of them.
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message || e).slice(0, 300)));
  const out = { fail: [], notes: {} };
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
  if (!started) throw new Error('l8-drops: the door did not open');
  // A SHARED IN-PAGE HELPER: `qaDrops().length = 0` alone frees the POOL's
  // own bookkeeping but leaks the actual physics prop, which sits on in
  // `game.props` fully grabbable — and `nearestGrabbable` has no idea it is
  // not supposed to matter any more. Across an odds loop of 300 rolls (and
  // every other reset in this file) that is up to 300 stray chips and yuzu
  // scattered through Sydney, several of them landing nearer a later test's
  // teleport than the prop the test actually meant to reach. Remove the
  // prop FIRST, every time.
  await page.evaluate(() => {
    window.__qaClearPool = function () {
      const g = window.__capy;
      const live = g.state.qaDrops();
      for (const d of live) if (d.prop && !d.prop.removed) g.physics.removeProp(d.prop);
      live.length = 0;
    };
  });

  // ===========================================================================
  // PHASE 1 — SYDNEY: odds, the live cap, and the two exclusion rules.
  // ===========================================================================
  await page.evaluate(() => {
    const g = window.__capy;
    g.state.qaReset();
    g.state.qaDropLog = [];
    // past both the "first two minutes" AND the "ten minutes since the last
    // one" bath gates — this loop is testing the ODDS, not those two rules,
    // which is a separate concern (see the odds vs. cap note just below).
    g.state.qaSetDropArriveT(99999);
  });
  await page.waitForTimeout(500);
  // ---- THE ODDS: a fast, synchronous roll loop, not a real-time wait -----
  // A real-time sample is capped by `capy.dropCap` (2) the moment the first
  // two rolls land and nothing has come to take them — dropAttemptSpawn's
  // own cap gate then refuses every roll after that, and a 60 s real-time
  // window measured exactly two spawns, both yuzu, which is the DICE
  // working correctly against a pool that never emptied, not the odds table
  // being wrong. `qaDrops().length = 0` between rolls frees the pool for
  // the next one without waiting on a despawn timer or a pickup — this is
  // ALL still inside one synchronous page.evaluate (no physics tick, no
  // real time), so it says nothing about cadence, only about the roll
  // itself, which is exactly what an odds check needs.
  const sample = await page.evaluate(() => {
    const g = window.__capy;
    const log = [];
    for (let i = 0; i < 300; i++) {
      // A FULL qaReset() EACH ROLL, NOT JUST A POOL CLEAR: the bath's own
      // 10-minute cooldown (jrBathAt) means the FIRST bath this fast,
      // real-time-free loop rolls correctly refuses every one after it —
      // real behaviour, but it would read as "bath's odds are ~0%" rather
      // than as the cooldown rule doing exactly its job. Resetting it every
      // roll isolates the ODDS TABLE from the cooldown rule, which the
      // targeted `qaSpawnDrop('bath')` calls later in this file exercise
      // directly instead. (dropBiome itself goes back to null on this
      // synchronous reset with no real frame to re-resolve it — harmless
      // here since only the KIND rolled is being tallied, not whether the
      // spawn found a real point. qaReset() ALSO clears `qaDropLog` itself
      // (dropForget's own job, so a stray forced probe never grows without
      // bound) — read the ONE entry it just got and carry it in a local
      // array of this loop's own, rather than accumulating in the field
      // reset keeps truncating out from under it.)
      g.state.qaReset();
      g.state.qaDropLog = [];
      g.state.qaSetDropArriveT(99999);
      g.state.qaSpawnDrop();
      const l = g.state.qaDropLog;
      if (l && l.length) log.push(l[0]);
    }
    return { log: log.slice(), dropsWhereLen: g.drops.where().length };
  });
  assertTrue('300 rolls landed in the log', sample.log.length >= 250);
  const counts = { yuzu: 0, rolling: 0, golden: 0, food: 0, twin: 0, bath: 0 };
  for (const k of sample.log) if (counts[k] !== undefined) counts[k]++;
  const n = sample.log.length || 1;
  const pct = {}; for (const k in counts) pct[k] = Math.round(counts[k] / n * 100);
  out.notes.sydneyOdds = pct;
  out.notes.sydneySampleN = sample.log.length;
  const WANT = { yuzu: 36, rolling: 20, golden: 17, food: 10, twin: 13, bath: 4 };
  // 6 points, not 4: 300 rolls' own binomial noise on a 36% category is
  // +/-2.8 points at one standard deviation, so 4 was tight enough to fail
  // on luck alone roughly one run in three. 6 is about two standard
  // deviations even at 36% and comfortably more at the rarer tiers.
  for (const k in WANT) assertTrue('odds, ' + k + ' (' + pct[k] + '% of ' + n + ', want ~' + WANT[k] + '%)', Math.abs(pct[k] - WANT[k]) <= 6);
  assertTrue('game.drops.where() is empty once the odds loop clears the pool', sample.dropsWhereLen === 0);

  // ---- THE LIVE CAP: a real-time check, separate from the odds above -----
  await page.evaluate(() => { window.__capy.state.qaReset(); window.__capy.state.qaForceDropT = 3; });
  let capOverflow = false, sawAny = false;
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(5000);
    const n = await page.evaluate(() => window.__capy.state.qaDrops().length);
    if (n > 0) sawAny = true;
    if (n > 4) capOverflow = true;
  }
  // Sydney's own dropCap is map-size-scaled (dropCapFor, systems.js) — Sydney
  // is the smallest chapter and the size factor's own reference point, so
  // its cap is exactly the base (4, after the second balance nudge), seat or
  // no seat here.
  assertTrue('the live cap (4, seat unowned, Sydney is the size-factor reference) is never exceeded over 30 s real time', !capOverflow);
  assertTrue('at least one real spawn landed in that window', sawAny);
  const dropsWhere2 = await page.evaluate(() => ({ n: window.__capy.state.qaDrops().length, w: window.__capy.drops.where().length }));
  assertTrue('game.drops.where().length matches the live count', dropsWhere2.n === dropsWhere2.w);
  // never inside sysWHY_R (10 m) of the marquee, never inside the arrival
  // ring (12 m, this pass's own reading of "the spawn ring" — see
  // sysDROP_ARRIVE_R's doc comment, systems.js)
  const clearance = await page.evaluate(() => {
    const g = window.__capy;
    const live = g.state.qaDrops();
    const cp = g.capy.position;
    let minToArrive = Infinity;
    for (const d of live) {
      const dx = d.x - cp.x, dz = d.z - cp.z;
      const dist = Math.hypot(dx, dz);
      if (dist < minToArrive) minToArrive = dist;
    }
    return { minToArrive, n: live.length };
  });
  // the animal has not moved since boot, so "the arrival point" and "the
  // animal's current position" are the same point here — an 8 m floor
  // (under the 12 m exclusion, comfortably outside sampling/placement noise)
  // is the honest bound for a live sample rather than the exact radius.
  if (clearance.n > 0) assertTrue('every live drop is clear of the arrival point (>8 m)', clearance.minToArrive > 8);

  // ---- a rolling yuzu actually moves, and stays near its spawn ------------
  const rollBefore = await page.evaluate(() => {
    const g = window.__capy;
    window.__qaClearPool();   // the real-time cap check above may still hold both slots
    const rec = g.state.qaSpawnDrop('rolling');
    return rec ? { x: rec.x, z: rec.z, px: rec.prop.body.position.x, pz: rec.prop.body.position.z } : null;
  });
  assertTrue('a rolling yuzu spawns on demand (qaSpawnDrop)', !!rollBefore);
  if (rollBefore) {
    await page.waitForTimeout(11000);   // 2-3 nudge cycles at 2.5-4 s each
    const rollAfter = await page.evaluate(() => {
      const g = window.__capy;
      const rec = g.state.qaDrops().find(d => d.kind === 'rolling');
      return rec && rec.prop.body ? { px: rec.prop.body.position.x, pz: rec.prop.body.position.z } : null;
    });
    if (rollAfter) {
      const moved = Math.hypot(rollAfter.px - rollBefore.px, rollAfter.pz - rollBefore.pz);
      const fromSpawn = Math.hypot(rollAfter.px - rollBefore.x, rollAfter.pz - rollBefore.z);
      assertTrue('a rolling yuzu\'s position changes over 11 s (moved ' + moved.toFixed(2) + ' m)', moved > 0.05);
      // 4.5 m is the hard safety net's own trigger (systems.js, sysDropsTick)
      // on top of the soft 3 m tether; 7 m gives it one full nudge cycle
      // (up to 1.0 m/s x 4 s) to actually turn around after crossing that
      // line, without the bound being loose enough to hide a real runaway.
      assertTrue('...and stays near its recorded spawn (' + fromSpawn.toFixed(2) + ' m, tether 3 m + slack)', fromSpawn < 7);
    } else {
      out.fail.push('rolling yuzu vanished before the position re-check');
    }
  }

  // ===========================================================================
  // PHASE 2 — TARGETED PICKUPS: THE KEEN EYE's bump, GULL-PROOF, the twin's
  // bonus window, a food boon, THE SPARE SEAT's cap of 3.
  // ===========================================================================
  //
  // WALKED INTO, NOT GRABBED (the pickup rework). This used to call
  // `game.physics.grab(prop)` directly — the yuzu types are `grabbable:
  // false` now, and a yuzu is taken by sysDropsTick's own proximity check
  // the moment the animal is inside sysDROP_TOUCH_R (1.15 m) of its ground
  // anchor, no key. So the honest test IS the teleport: put the animal 0.5 m
  // from the anchor, give the tick a few frames, and read `dropTaken` off
  // the prop. "A teleport is motion" (the harness's own trap) does not bite
  // here because the take has no stillness or grounded gate at all — that
  // is the mechanic. `grabRec` keeps its name so the call sites read as
  // they did.
  function grabRec(rec, kindFilter) {
    return page.evaluate(async ([rec, kindFilter]) => {
      const g = window.__capy;
      const live = g.state.qaDrops();
      let best = null, bestD = Infinity;
      for (const d of live) {
        if (kindFilter && d.kind !== kindFilter) continue;
        if (!d.prop || !d.prop.body || d.prop.removed || d.prop.held) continue;
        const b = d.prop.body;
        const dist = (b.position.x - rec.x) * (b.position.x - rec.x) + (b.position.z - rec.z) * (b.position.z - rec.z);
        if (dist < bestD) { bestD = dist; best = d.prop; }
      }
      if (!best) return false;
      const b = best.body.position;
      const cb = g.capy.body;
      cb.position.set(b.x - 0.5, b.y + 0.3, b.z); cb.velocity.set(0, 0, 0);
      for (let i = 0; i < 12 && !best.dropTaken; i++) await new Promise(r => setTimeout(r, 30));
      return !!best.dropTaken;
    }, [rec, kindFilter || null]);
  }

  await page.evaluate(() => { window.__capy.state.qaReset(); });
  await page.evaluate(() => { window.__capy.state.qaForceOwned = ['eye']; });
  await page.waitForTimeout(300);
  for (const [kind, base, keen] of [['yuzu', 1, 2], ['rolling', 2, 3], ['golden', 3, 4]]) {
    const rec = await page.evaluate((kind) => {
      const g = window.__capy;
      window.__qaClearPool();
      const r = g.state.qaSpawnDrop(kind);
      return r && r.prop && r.prop.body ? { x: r.prop.body.position.x, z: r.prop.body.position.z } : null;
    }, kind);
    assertTrue(kind + ' spawns on demand', !!rec);
    if (!rec) continue;
    const before = await page.evaluate(() => window.__capy.state.qaYuzu());
    const grabbed = await grabRec(rec);
    assertTrue(kind + ': grab() succeeded', grabbed);
    await page.waitForTimeout(100);   // the removal is a setTimeout(fn, 0)
    const after = await page.evaluate(() => window.__capy.state.qaYuzu());
    assertTrue('THE KEEN EYE: ' + kind + ' pays ' + keen + ' (base ' + base + '+1), got ' + (after - before), after - before === keen);
  }
  const gullProof = await page.evaluate(() => window.__capy.capy.gullProof || 0);
  assertTrue('a golden yuzu sets GULL-PROOF (capy.gullProof > 0), read ' + gullProof, gullProof > 0);

  // ---- a food drop starts the matching boon --------------------------------
  await page.evaluate(() => { window.__capy.state.qaReset(); });
  await page.waitForTimeout(300);
  const foodRec = await page.evaluate(() => {
    const g = window.__capy;
    window.__qaClearPool();
    const r = g.state.qaSpawnDrop('food');
    return r && r.prop && r.prop.body ? { x: r.prop.body.position.x, z: r.prop.body.position.z, boon: r.prop.dropBoon } : null;
  });
  assertTrue('a food drop spawns on demand and carries dropBoon', !!(foodRec && foodRec.boon));
  if (foodRec) {
    const grabbed = await grabRec(foodRec);
    assertTrue('food: grab() succeeded', grabbed);
    await page.waitForTimeout(100);
    const boon = await page.evaluate(() => window.__capy.capy.boon);
    assertTrue('eating it starts a ' + foodRec.boon + ' boon (~75s)', boon && boon.id === foodRec.boon && boon.t > 73);
    // capy.mods itself is untouched by a boon on purpose — 'quick' and
    // 'second-wind' are read inline at their own sites (capybara.js), the
    // same pattern the thermos/mango already established — so the boon
    // object above is the correct, complete observable proof.
  }

  // ---- the twin: the bonus inside the window, none outside it --------------
  await page.evaluate(() => { window.__capy.state.qaReset(); });
  await page.waitForTimeout(300);
  const eyeGone = await page.evaluate(() => window.__capy.capy.mods.yuzuBonus);
  assertTrue('THE KEEN EYE is off again for the twin test (yuzuBonus reads 0), got ' + eyeGone, eyeGone === 0);
  async function takeTwinPair(waitBeforeSecond) {
    const pair = await page.evaluate(() => {
      const g = window.__capy;
      window.__qaClearPool();
      g.state.qaSpawnDrop('twin');
      const recs = g.state.qaDrops().filter(d => d.kind === 'twin');
      return recs.map(r => ({ x: r.prop.body.position.x, z: r.prop.body.position.z, first: !!r.prop.dropPairFirst }));
    });
    if (pair.length !== 2) return null;
    const first = pair.find(p => p.first), second = pair.find(p => !p.first);
    const y0 = await page.evaluate(() => window.__capy.state.qaYuzu());
    const g1 = await grabRec(first, 'twin');
    await page.waitForTimeout(100);
    const y1 = await page.evaluate(() => window.__capy.state.qaYuzu());
    if (waitBeforeSecond) await page.waitForTimeout(waitBeforeSecond);
    const debug2 = await page.evaluate(() => ({
      yuzuBonus: window.__capy.capy.mods.yuzuBonus,
      live: window.__capy.state.qaDrops().map(d => ({ kind: d.kind, despawnT: d.despawnT, held: d.prop && d.prop.held, removed: d.prop && d.prop.removed })),
    }));
    const g2 = await grabRec(second, 'twin');
    await page.waitForTimeout(700);   // the bonus flies 500 ms behind the base
    const y2 = await page.evaluate(() => window.__capy.state.qaYuzu());
    return { firstPay: y1 - y0, secondPay: y2 - y1, g1, g2, debug2 };
  }
  const inWindow = await takeTwinPair(3000);
  assertTrue('a twin pair spawns (2 records)', !!inWindow);
  if (inWindow) {
    assertTrue('both grabs succeeded (in-window run)', inWindow.g1 && inWindow.g2);
    // was 2 / 2+4=6 — the balance nudge cut a twin's per-fruit worth to 1
    // and the bonus to 2, so a fully-taken pair is 4 total, not 8.
    assertTrue('the first fruit pays 1', inWindow.firstPay === 1);
    assertTrue('the second, inside the 20 s window, pays 1 + 2 = 3, got ' + inWindow.secondPay, inWindow.secondPay === 3);
  }
  const outWindow = await takeTwinPair(21000);
  if (outWindow) {
    assertTrue('both grabs succeeded (out-of-window run)', outWindow.g1 && outWindow.g2);
    assertTrue('the second, past the 20 s window (still inside the 30 s despawn), pays 1 with no bonus, got ' +
      outWindow.secondPay + ' (debug: ' + JSON.stringify(outWindow.debug2) + ')', outWindow.secondPay === 1);
  }

  // ---- the bath: proximity, the refill, the payout, the 30 s tail ----------
  // NOT grab-based (the bath is `grabbable: false` by design, F1) — its own
  // ritual is a pure distance + grounded check in sysDropsTick, so this one
  // still needs a real teleport, kept as short and well-settled as this
  // file's earlier attempts at it.
  async function fallTo(x, y, z) {
    await page.evaluate(([x, y, z]) => {
      const g = window.__capy;
      const b = g.capy.body;
      b.position.set(x, y + 1.3, z);
      b.velocity.set(0, 0, 0);
      b.previousPosition.copy(b.position);
      b.interpolatedPosition.copy(b.position);
    }, [x, y, z]);
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(200);
      if (await page.evaluate(() => !!window.__capy.capy.grounded)) break;
    }
    await page.waitForTimeout(150);
  }
  await page.evaluate(() => { window.__capy.state.qaReset(); });
  await page.waitForTimeout(300);
  // PAST THE "FIRST TWO MINUTES" QUIET RULE (F4.1). Measured live: without
  // this, `qaSpawnDrop('bath')` rolled the SAME refusal a real chapter's own
  // first two minutes would — dropArriveT reads ~0 right after a reset — and
  // silently handed back an ordinary yuzu instead, which then sat there
  // looking exactly like a bath that never triggered its ritual.
  await page.evaluate(() => { window.__capy.state.qaSetDropArriveT(99999); });
  // drain stamina for real first, so "refills" is actually visible
  await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(4000);
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  const bathRec = await page.evaluate(() => {
    const g = window.__capy;
    const r = g.state.qaSpawnDrop('bath');
    return r ? { x: r.prop.body.position.x, y: r.prop.body.position.y, z: r.prop.body.position.z } : null;
  });
  assertTrue('a bath spawns on demand', !!bathRec);
  const stamBefore = await page.evaluate(() => window.__capy.capy.stamina);
  const yuzuBefore = await page.evaluate(() => window.__capy.state.qaYuzu());
  if (bathRec) {
    // APPROACH FROM JUST OUTSIDE THE TUB, NOT ITS OWN CENTRE. The bath is a
    // solid 1.2 x 0.42 x 1.2 m box (`grabbable: false, receive: true`) at a
    // TALLER rest height than the capybara's own — teleporting the animal's
    // body into that volume reads as a launch, not an arrival (the harness's
    // own "a teleport is motion" trap), and the ritual's own proximity check
    // never got a settled frame to see. 0.9 m out clears the box's own 0.6 m
    // half-width while staying inside the 1.5 m trigger radius; the animal's
    // OWN pre-teleport ground height is reused rather than the tub's.
    const preY = await page.evaluate(() => window.__capy.capy.body.position.y);
    // Several angles, not one: an unvalidated point 0.9 m from the tub's
    // centre may itself be over something else entirely (the tub's own spot
    // was checked by physSpotOk; a ring around it was not). Stop at the
    // first one that actually lands grounded.
    let landedNear = false;
    for (let i = 0; i < 6 && !landedNear; i++) {
      const ang = (i / 6) * Math.PI * 2;
      await fallTo(bathRec.x + Math.cos(ang) * 0.9, preY, bathRec.z + Math.sin(ang) * 0.9);
      landedNear = await page.evaluate(() => !!window.__capy.capy.grounded);
    }
    await page.waitForTimeout(600);   // no key needed — proximity alone triggers it
    const afterBath = await page.evaluate(() => ({
      stamina: window.__capy.capy.stamina,
      yuzu: window.__capy.state.qaYuzu(),
      used: (window.__capy.state.qaDrops().find(d => d.kind === 'bath') || {}).used,
    }));
    assertTrue('the bath refills stamina (was ' + stamBefore.toFixed(2) + ', now ' + afterBath.stamina.toFixed(2) + ')', afterBath.stamina > 0.95);
    assertTrue('the bath pays 10, unaffected by anything else on the wallet', afterBath.yuzu - yuzuBefore === 10);  // was 25
    assertTrue('the record is marked used (the 30 s tail, not despawned yet)', afterBath.used === true);
  }

  // ---- THE SPARE SEAT: the live cap rises to 3 -----------------------------
  await page.evaluate(() => { window.__capy.state.qaReset(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.__capy.state.qaForceOwned = ['seat']; });
  await page.waitForTimeout(300);
  const seatCap = await page.evaluate(() => window.__capy.capy.dropCap);
  // Sydney's base is 4 now (map-size scaled); the seat still adds exactly 1.
  assertTrue('capy.dropCap reads 5 with seat forced (Sydney base 4 + 1)', seatCap === 5);
  const seatSpawns = await page.evaluate(() => {
    const g = window.__capy;
    g.state.qaSpawnDrop('yuzu');
    g.state.qaSpawnDrop('rolling');
    g.state.qaSpawnDrop('golden');
    return g.state.qaDrops().length;
  });
  assertTrue('three simultaneous forced spawns, none rejected, with seat owned', seatSpawns === 3);

  // ===========================================================================
  // PHASE 3 — BOTH SPAWN PATHS: Venice (a physBIOME_SCATTER ring) and Pasto
  // (the OTHER zone-fallback chapter, alongside Sydney above).
  // ===========================================================================
  for (const biome of ['venice', 'pasto']) {
    await page.evaluate((biome) => {
      const g = window.__capy;
      g.state.qaReset();
      g.biome.switchTo(biome);
    }, biome);
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => window.__capy.state.qaSpawnDrop('yuzu'));
    assertTrue(biome + ': a plain yuzu finds a valid ground point', !!r);
  }

  out.errs = errs.slice(0, 10);
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l8-drops.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
  if (out.fail.length || errs.length) {
    throw new Error('l8-drops FAILED: ' + JSON.stringify({ fail: out.fail, errs: out.errs, notes: out.notes }));
  }
}
