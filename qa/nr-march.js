// PUSH YOUR LUCK — the chain gets a cost, and therefore a decision.
//
// Three witnessed things in twelve seconds is AN INCIDENT and five is A SCENE.
// It is the only repeatable reward in the game and it has never contained a
// choice: you could not aim at it, could not lose it, and were never asked
// whether the fifth was worth going for. `capy:chain` now fires on every rung,
// and at four somebody puts down what they are doing and walks over.
//
// ---- HOW THE CHAIN IS CAUSED, AND WHY THAT IS NOT A CHEAT ---------------
// `incAdd` fires on a prop impact over sysINC_HIT (2.6 m/s) whose prop carries
// `disturbed`, with somebody inside sysINC_SEE (16 m) to see it. `disturbed` is
// props.js's word for "the capybara did this to it, just now" — set by
// physStampTouch on a grab, a throw or a shove. This probe stamps it and drops
// the prop, which is the same state a thrown prop is in when it lands; what it
// skips is the animal's arm, not the chain's own gates. Every one of those is
// live here: the same-prop cooldown (four seconds, which is why this uses five
// DIFFERENT props), the witness test, the radius and the window.
//
// ---- WHAT IT ASSERTS -----------------------------------------------------
//   marches   somebody sets off at rung four and not before
//   closes    they actually get nearer — a marcher whose steer is blocked
//             looks identical from the state and is the failure that matters
//   caught    standing still ends the chain (repRing empties)
//   escaped   running away does NOT: the window survives and so does the ring
//   leash     they never go further from their own anchor than npcOWN_LEASH
//   one       there is never more than one of them
async page => {
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(6500);
  await page.keyboard.press('Space');
  await page.waitForTimeout(3000);

  const out = [];
  for (const mode of ['caught', 'escaped']) {
    await page.evaluate(() => {
      const g = window.__capy;
      try { g.hud.cross('goreme'); } catch (e) { g.biome.switchTo('goreme'); }
    });
    await page.waitForTimeout(4500);

    // ---- THIRTEEN METRES, AND THE NUMBER IS THE WHOLE TEST DESIGN --------
    // A chain needs a witness inside sysINC_SEE (16 m) and a marcher needs
    // somewhere to march from. The first cut stood the person at SEVEN, and
    // every run died the same way: `gave up: fetching`. Seven metres is inside
    // npcOWN_R (11), which is the radius inside which somebody OWNS a prop —
    // so the five cones this probe drops became that person's property, they
    // set off to retrieve one, and retrieval outranks the march by design.
    //
    // Thirteen is witnessed and not owned. It is also inside npcMAR_R (18) and
    // inside the leash (15), so the walk is legal the whole way.
    //
    // AND THE INTERFERENCE IS NOT A BUG. Throwing somebody's own stock at them
    // makes them come and get it, which is already the reaction; the march is
    // for a chain in which nothing of theirs was taken. The probe simply has
    // to choose which of the two it is measuring.
    //
    // The PERSON is moved and never the animal: the animal's position is the
    // thing under test's own input.
    await page.evaluate(() => {
      const g = window.__capy;
      const p = g.capy.position;
      const live = g.biome.current;
      let best = null, bd = 1e9;
      for (const r of g.locals) {
        if (r.biome !== live || !r.group) continue;
        const d = Math.hypot(p.x - r.x, p.z - r.z);
        if (d < bd) { bd = d; best = r; }
      }
      // ...AND IT HAS TO BE THE WHOLE CAST, NOT THE NEAREST ONE.
      // Moving one person to thirteen metres still died `fetching`, because
      // the handler picks whoever is nearest THE EVENT — and the event is at
      // the animal's feet, so the person it picked was the next local along,
      // who was still inside the eleven-metre ownership radius. Every live
      // local goes on a 13 m ring: witnessed by all of them, owned by none.
      let k = 0, n = 0;
      for (const r of g.locals) if (r.biome === live && r.group) n++;
      for (const r of g.locals) {
        if (r.biome !== live || !r.group) continue;
        const a = (k++ / Math.max(1, n)) * 6.283185;
        r.x = p.x + Math.sin(a) * 13; r.z = p.z + Math.cos(a) * 13;
        r.ax = r.x; r.az = r.z; r.tx = r.x; r.tz = r.z;
        r.group.position.set(r.x, r.group.position.y, r.z);
        if (r.body) {
          r.body.position.x = r.x; r.body.position.z = r.z;
          r.body.aabbNeedsUpdate = true;
        }
      }
    });
    await page.waitForTimeout(600);

    // ---- ONE TIMELINE, NOT A SEQUENCE OF SNAPSHOTS -----------------------
    // The first cut spawned a prop and read the audit on the same line, five
    // times, and then watched for nine seconds afterwards. Both halves were
    // blind: a dropped prop lands about four tenths of a second after it is
    // spawned, so every snapshot was taken BEFORE the impact it was about, and
    // by the time the watching started the march had already begun and ended
    // inside the gap. It reported `marched false` for a march that had plainly
    // happened — the ring in the second row shows it — which is the worst kind
    // of wrong answer.
    //
    // So: the spawning and the sampling are the same rAF loop, and the whole
    // run is one timeline. The chain's own window is twelve seconds and the
    // march's ceiling is seven; nothing about either is observable at a
    // cadence coarser than a frame.
    // ---- THE CHAIN IS BUILT STANDING STILL, AND ONLY THEN DO YOU RUN -----
    // Dropping props WHILE running scatters them across the chapter, and every
    // one that lands near somebody on the ring makes that person its owner —
    // so the escape row kept dying `fetching` for a reason that had nothing to
    // do with escaping. Phase one stands still and builds the chain until
    // somebody sets off; phase two is the decision. The gap between them is one
    // round trip, against a march that now lasts twelve seconds.
    await page.evaluate(() => new Promise((res) => {
      const g = window.__capy;
      let dropped = 0, nextDrop = 0;
      const t0 = performance.now();
      (function step() {
        const t = (performance.now() - t0) / 1000;
        if (dropped < 5 && t >= nextDrop) {
          dropped++; nextDrop = t + 1.5;
          const p = g.capy.position;
          const pr = g.physics.spawnProp('cone', p.x + 1.4, p.z + 1.4);
          if (pr && pr.body) {
            pr.disturbed = true;
            pr.lastCapyTouch = g.state ? g.state.time : 0;
            pr.body.wakeUp();
            pr.body.position.y += 2.4;
            pr.body.velocity.set(0, -6, 0);
          }
        }
        const a = g.marchAudit ? g.marchAudit() : null;
        if ((a && a.on) || t > 10) res(null);
        else requestAnimationFrame(step);
      })();
    }));
    if (mode === 'escaped') {
      await page.keyboard.down('ShiftLeft');
      await page.keyboard.down('KeyW');
    }
    const track = await page.evaluate((m) => new Promise((res) => {
      const g = window.__capy;
      const marks = [];
      let sawMarch = false, minDist = 1e9, maxAnchor = 0, ends = 0;
      let marchers = 0, wasOn = false, startedAtRing = -1;
      let ringPeak = 0, ringAtCatch = -1;
      const t0 = performance.now();
      (function step() {
        const t = (performance.now() - t0) / 1000;
        const ring = g.repRing ? g.repRing().length : -1;
        if (ring > ringPeak) ringPeak = ring;
        const a = g.marchAudit ? g.marchAudit() : null;
        if (a && a.on) {
          if (!sawMarch) startedAtRing = ring;
          sawMarch = true;
          if (!wasOn) { marchers++; wasOn = true; }
          if (a.dist >= 0 && a.dist < minDist) minDist = a.dist;
          if (a.fromAnchor > maxAnchor) maxAnchor = a.fromAnchor;
        } else if (wasOn) {
          wasOn = false; ends++;
          if (ringAtCatch < 0) ringAtCatch = ring;
        }
        if (marks.length < 400 && (marks.length === 0 ||
            t - marks[marks.length - 1].t > 0.4)) {
          marks.push({ t: +t.toFixed(1), ring: ring,
                       on: !!(a && a.on), d: a ? a.dist : -1,
                       why: a ? a.why : '', blk: a ? a.blocked : -1 });
        }
        if (t < 20) requestAnimationFrame(step);
        else res({
          mode: m, sawMarch: sawMarch, marchers: marchers, ends: ends,
          startedAtRing: startedAtRing,
          minDist: minDist === 1e9 ? -1 : +minDist.toFixed(2),
          maxFromAnchor: +maxAnchor.toFixed(2),
          ringPeak: ringPeak, ringAtEnd: ringAtCatch,
          ringAfter: g.repRing ? g.repRing().length : -1,
          marks: marks,
        });
      })();
    }), mode);
    if (mode === 'escaped') {
      await page.keyboard.up('KeyW');
      await page.keyboard.up('ShiftLeft');
    }
    out.push(track);
    await page.waitForTimeout(2000);
  }

  await page.evaluate(async (p) => {
    await fetch('/shot?name=NR-MARCH', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(p)))) });
  }, out);
}
