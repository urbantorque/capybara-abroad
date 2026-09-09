// AND THEN, PART TWO — the reactions the two working pairs never had.
//
// `qa/nr-verbs.js` measured the premise and half of it was wrong: hop-then-grab
// and grab-then-slide BOTH already work and always have. What they have never
// had is anybody noticing, which is the whole difference between a move and an
// accident that happens to work. So this checks the two reactions that were
// built instead of the two verbs that did not need building.
//
//   snatch   a grab that fires with the animal's feet off the ground gets a
//            wider, harder reaction and its own words
//   slide    a capybara coming at you on its belly gets seen at five metres
//            rather than three-four, jumps people harder, and has its own pool
//
// BOTH ARE READ OFF THE FLINCH SPRING, which is the only honest place: a line
// is on a per-person cooldown and can be swallowed by somebody having just
// spoken, whereas `fl` moves on every person inside the circle every time.
async page => {
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(6500);
  await page.keyboard.press('Space');
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const g = window.__capy;
    try { g.hud.cross('goreme'); } catch (e) { g.biome.switchTo('goreme'); }
  });
  await page.waitForTimeout(4500);

  const out = {};

  // ---- 1. THE SNATCH, against a grab of the same prop on the ground ------
  // Paired in one run: same chapter, same person, same distance, same prop
  // type. The only difference between the two rows is whether the feet were
  // down, which is the only way to read a reaction that is scaled by nearness.
  const grabAt = async (airborne) => {
    await page.evaluate(() => {
      const g = window.__capy;
      const p = g.capy.position;
      const live = g.biome.current;
      // Stand somebody a fixed 4 m away and clear their spring, so the two
      // rows are measured from the same zero.
      let best = null, bd = 1e9;
      for (const r of g.locals) {
        if (r.biome !== live || !r.group) continue;
        const d = Math.hypot(p.x - r.x, p.z - r.z);
        if (d < bd) { bd = d; best = r; }
      }
      if (best) {
        best.x = p.x + 4; best.z = p.z;
        best.ax = best.x; best.az = best.z; best.tx = best.x; best.tz = best.z;
        best.group.position.set(best.x, best.group.position.y, best.z);
        best.fl = 0; best.flV = 0; best.wary = 0;
        window.__vic = best;
      }
      const pr = g.physics.spawnProp('cone', p.x + 0.7, p.z);
      window.__pr = pr;
    });
    await page.waitForTimeout(700);
    if (airborne) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(170);
    }
    const air = await page.evaluate(() => !window.__capy.capy.grounded);
    await page.keyboard.press('KeyE');
    // The spring peaks a few frames after the kick; sample it rather than
    // reading it once, because `fl` is a damped value on its way back to zero.
    const r = await page.evaluate(() => new Promise((res) => {
      const g = window.__capy;
      let peak = 0, held = false;
      const t0 = performance.now();
      (function step() {
        const b = window.__vic;
        if (b && Math.abs(b.fl || 0) > peak) peak = Math.abs(b.fl);
        if (g.capy.heldProp) held = true;
        if (performance.now() - t0 < 1600) requestAnimationFrame(step);
        else res({ peakFlinch: +peak.toFixed(3), grabbed: held,
                   wary: +((window.__vic && window.__vic.wary) || 0).toFixed(3) });
      })();
    }));
    await page.evaluate(() => {
      const g = window.__capy;
      if (g.capy.heldProp) g.physics.release(null);
    });
    await page.waitForTimeout(900);
    r.airborneAtPress = air;
    return r;
  };
  out.grounded = await grabAt(false);
  out.snatch = await grabAt(true);

  // ---- 2. THE SLIDE SCATTER, against the same pass upright ---------------
  const passBy = async (slide) => {
    // ---- EACH PASS STARTS FROM THE SPAWN ---------------------------------
    // The second pass came back at a top speed of 1.11 m/s — under the slide's
    // own 3.30 floor — because the first one had left the animal wedged
    // somewhere in a chapter made of cliffs, and a run-up that never happens
    // is not a measurement of anything. Re-entering the chapter is the only
    // reset in the game that does not write the animal's position by hand,
    // which is a thing this codebase does not do.
    await page.evaluate(() => {
      const g = window.__capy;
      try { g.hud.cross('goreme'); } catch (e) { g.biome.switchTo('goreme'); }
    });
    await page.waitForTimeout(4200);
    const r = await page.evaluate(() => {
      const g = window.__capy;
      const p = g.capy.position;
      const live = g.biome.current;
      for (const r2 of g.locals) {
        if (r2.biome !== live || !r2.group) continue;
        r2.fl = 0; r2.flV = 0; r2.rushWas = false;
      }
      return { x: p.x, z: p.z };
    });
    // ---- NO SHIFT, AND THE REASON IS THE HOLD-TO-TOGGLE LATCH -----------
    // Holding Shift and then G collapsed the animal to 1.2 m/s for the whole
    // window while the identical upright pass reached 8.58 — the two keys are
    // wrapped by the same hold-to-toggle latch (see sysLatch), so pressing one
    // while holding the other is not the input this test means to give. It
    // does not need Shift anyway: capyWALK is 4.2 m/s and the slide floor is
    // 3.30, so a walk is already fast enough to go down.
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(2000);
    // ---- BESIDE THE LINE, NOT ON IT --------------------------------------
    // The first cut stood them four metres straight ahead and both rows came
    // back wrong: a local is a SOLID BODY, so the animal ran into them, closed
    // to 0.06 m and stopped — which is also why the slide never started, since
    // it needs 3.3 m/s of ground speed to begin. Standing them off to one side
    // at 4.2 m puts the closest approach inside npcLOC_SLIDE_R (5.0) and
    // outside npcLOC_RUSH_R (3.4), which is exactly the band this change is
    // about, and leaves the animal a clear run.
    await page.evaluate(() => {
      const g = window.__capy;
      const p = g.capy.position, v = g.capy.body.velocity;
      const s = Math.hypot(v.x, v.z) || 1;
      // ...and re-find the victim: the cross above rebuilt the cast, so the
      // reference from the snatch rows points at a person in a detached world.
      const live2 = g.biome.current;
      let b = null, bd2 = 1e9;
      for (const r2 of g.locals) {
        if (r2.biome !== live2 || !r2.group) continue;
        const d2 = Math.hypot(p.x - r2.x, p.z - r2.z);
        if (d2 < bd2) { bd2 = d2; b = r2; }
      }
      window.__vic = b;
      if (!b) return;
      const px = -v.z / s, pz = v.x / s;          // perpendicular to the line
      b.x = p.x + (v.x / s) * 6 + px * 4.2;
      b.z = p.z + (v.z / s) * 6 + pz * 4.2;
      b.ax = b.x; b.az = b.z; b.tx = b.x; b.tz = b.z;
      b.group.position.set(b.x, b.group.position.y, b.z);
      b.fl = 0; b.flV = 0; b.rushWas = false;
    });
    if (slide) await page.keyboard.down('KeyG');
    const got = await page.evaluate(() => new Promise((res) => {
      const g = window.__capy;
      let peak = 0, closest = 1e9, wasSliding = false;
      // ...and the ground speed, because the slide REFUSES below capySLIDE_MIN
      // (3.30 m/s) and "it did not slide" and "it could not slide" are two
      // different reports.
      let minSpd = 1e9, maxSpd = 0;
      const t0 = performance.now();
      (function step() {
        const b = window.__vic;
        const v = g.capy.body.velocity;
        const sp = Math.hypot(v.x, v.z);
        if (sp < minSpd) minSpd = sp;
        if (sp > maxSpd) maxSpd = sp;
        if (g.capy.sliding) wasSliding = true;
        if (b) {
          if (Math.abs(b.fl || 0) > peak) peak = Math.abs(b.fl);
          const d = Math.hypot(g.capy.position.x - b.x, g.capy.position.z - b.z);
          if (d < closest) closest = d;
        }
        if (performance.now() - t0 < 2400) requestAnimationFrame(step);
        else res({ peakFlinch: +peak.toFixed(3), closest: +closest.toFixed(2),
                   wasSliding: wasSliding, minSpd: +minSpd.toFixed(2),
                   maxSpd: +maxSpd.toFixed(2) });
      })();
    }));
    if (slide) await page.keyboard.up("KeyG");
    await page.keyboard.up("KeyW");
    await page.waitForTimeout(1200);
    return got;
  };
  out.upright = await passBy(false);
  out.onBelly = await passBy(true);

  await page.evaluate(async (p) => {
    await fetch('/shot?name=NR-PAIRS', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(p)))) });
  }, out);
}
