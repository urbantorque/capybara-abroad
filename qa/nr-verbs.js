// AND THEN — MEASURE THE PREMISE BEFORE BUILDING ANYTHING.
//
// The proposal says the game's eight verbs "never touch each other: every one
// of them is entered from standing and exited to standing". That is a claim
// about the code, it is the whole argument for the feature, and this repo has
// a standing lesson about exactly this shape (see `capy3-measure-the-premise`:
// five ROADMAP-FUN claims failed on measurement, and two of them were features
// that turned out to be already built).
//
// So: six pairs, driven with real keys against the real controller, and for
// each one the honest question — DOES IT ALREADY WORK, and if it does, is
// anything in the game acknowledging it?
//
//   hop -> grab     snatch something out of the air
//   grab -> slide   go down while carrying
//   slide -> hop    launch out of a slide            (CHANGES REACH)
//   slide -> people does going down at somebody do anything
//   wheek -> run    does the call work at a flat run
//   dive -> hop     porpoise                          (CHANGES REACH)
//
// The two marked CHANGES REACH are measured but not built here: a longer hop
// re-opens every reachability judgement in nineteen chapters, and the Kyoto
// bridge needed approach ramps nine days ago for exactly that reason. What
// this file produces for those two is the NUMBER — how much further the animal
// gets — which is the input that decides whether a sweep is affordable.
async page => {
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(6500);
  await page.keyboard.press('Space');
  await page.waitForTimeout(3000);
  // Marrakech: the flattest big open ground in the game, so a hop's range is a
  // fact about the hop and not about a kerb.
  await page.evaluate(() => {
    const g = window.__capy;
    try { g.hud.cross('sahara'); } catch (e) { g.biome.switchTo('sahara'); }
  });
  await page.waitForTimeout(4500);

  const out = {};
  const hold = async (code, ms) => {
    await page.keyboard.down(code);
    await page.waitForTimeout(ms);
    await page.keyboard.up(code);
  };

  // ---- 1. hop -> grab ----------------------------------------------------
  out.hopGrab = await (async () => {
    await page.evaluate(() => {
      const g = window.__capy;
      const p = g.capy.position;
      window.__pr = g.physics.spawnProp('cone', p.x + 0.8, p.z);
    });
    await page.waitForTimeout(700);
    await page.keyboard.press('Space');
    await page.waitForTimeout(180);              // mid-arc
    const air = await page.evaluate(() => ({
      grounded: window.__capy.capy.grounded,
      y: +window.__capy.capy.position.y.toFixed(2),
    }));
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(500);
    const got = await page.evaluate(() => !!(window.__capy.capy.heldProp));
    await page.evaluate(() => { const g = window.__capy;
      if (g.capy.heldProp) g.physics.release(null); });
    return { airborneAtPress: !air.grounded, y: air.y, grabbed: got };
  })();

  // ---- 2. grab -> slide --------------------------------------------------
  out.grabSlide = await (async () => {
    await page.evaluate(() => {
      const g = window.__capy;
      const p = g.capy.position;
      const pr = g.physics.spawnProp('cone', p.x + 0.5, p.z + 0.2);
      if (pr) g.physics.grab(pr);
    });
    await page.waitForTimeout(400);
    const held = await page.evaluate(() => !!window.__capy.capy.heldProp);
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(2200);             // get up to a run
    await page.keyboard.down('KeyG');
    await page.waitForTimeout(500);
    const slid = await page.evaluate(() => ({
      sliding: !!window.__capy.capy.sliding,
      stillHeld: !!window.__capy.capy.heldProp,
    }));
    await page.keyboard.up('KeyG');
    await page.keyboard.up('KeyW');
    await page.keyboard.up('ShiftLeft');
    await page.evaluate(() => { const g = window.__capy;
      if (g.capy.heldProp) g.physics.release(null); });
    await page.waitForTimeout(900);
    return { heldBefore: held, sliding: slid.sliding, stillHeld: slid.stillHeld };
  })();

  // ---- 3. slide -> hop, and the plain running hop it has to beat ---------
  // THE NUMBER THAT DECIDES WHETHER THE REACH-CHANGING HALF IS AFFORDABLE.
  const arc = async (viaSlide) => {
    await page.evaluate(() => { window.__capy.capy.body.velocity.set(0, 0, 0); });
    await page.waitForTimeout(600);
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(2600);             // a full run-up
    if (viaSlide) {
      await page.keyboard.down('KeyG');
      await page.waitForTimeout(420);
    }
    const r = await page.evaluate(() => new Promise((res) => {
      const g = window.__capy;
      const p0 = g.capy.position;
      const x0 = p0.x, z0 = p0.z, y0 = p0.y;
      let peakY = y0, air = 0, wasAir = false;
      const t0 = performance.now();
      (function step() {
        const p = g.capy.position;
        if (p.y > peakY) peakY = p.y;
        if (!g.capy.grounded) { wasAir = true; air += 1 / 60; }
        if (performance.now() - t0 < 2200) requestAnimationFrame(step);
        else res({ range: +Math.hypot(p.x - x0, p.z - z0).toFixed(2),
                   rise: +(peakY - y0).toFixed(2), air: +air.toFixed(2),
                   leftGround: wasAir });
      })();
    }));
    await page.keyboard.press('Space');
    await page.waitForTimeout(60);
    const r2 = await page.evaluate(() => new Promise((res) => {
      const g = window.__capy;
      const p0 = g.capy.position, x0 = p0.x, z0 = p0.z, y0 = p0.y;
      let peakY = y0, air = 0;
      const t0 = performance.now();
      (function step() {
        const p = g.capy.position;
        if (p.y > peakY) peakY = p.y;
        if (!g.capy.grounded) air += 1 / 60;
        if (performance.now() - t0 < 1800) requestAnimationFrame(step);
        else res({ range: +Math.hypot(p.x - x0, p.z - z0).toFixed(2),
                   rise: +(peakY - y0).toFixed(2), air: +air.toFixed(2),
                   sliding: !!g.capy.sliding });
      })();
    }));
    if (viaSlide) await page.keyboard.up('KeyG');
    await page.keyboard.up('KeyW');
    await page.keyboard.up('ShiftLeft');
    await page.waitForTimeout(900);
    return { runUp: r, hop: r2 };
  };
  out.plainHop = await arc(false);
  out.slideHop = await arc(true);

  // ---- 4. going down at somebody -----------------------------------------
  out.slideAtPeople = await (async () => {
    await page.keyboard.down("ShiftLeft");
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(2000);
    const set = await page.evaluate(() => {
      const g = window.__capy;
      const p = g.capy.position;
      const live = g.biome.current;
      let best = null, bd = 1e9;
      for (const r of g.locals) {
        if (r.biome !== live || !r.group) continue;
        const d = Math.hypot(p.x - r.x, p.z - r.z);
        if (d < bd) { bd = d; best = r; }
      }
      if (!best) return null;
      // ---- IN FRONT MEANS ALONG THE HEADING, NOT ALONG +Z ----------------
      // The first cut put them at `p.z + 9` and drove with `KeyS`, and the
      // animal finished 23.74 m away: WASD is camera-relative, so neither the
      // key nor the world axis says which way "forward" is. The heading is
      // read off the body's own velocity after the run-up instead, which is
      // the only thing in the frame that knows.
      const v = g.capy.body.velocity;
      const s = Math.hypot(v.x, v.z) || 1;
      best.x = p.x + (v.x / s) * 9; best.z = p.z + (v.z / s) * 9;
      best.ax = best.x; best.az = best.z; best.tx = best.x; best.tz = best.z;
      best.group.position.set(best.x, best.group.position.y, best.z);
      window.__vic = best;
      return { fl: +(best.fl || 0).toFixed(3), wary: +(best.wary || 0).toFixed(3) };
    });
    if (!set) return { skipped: "no locals" };
    // ...and the run-up has to happen BEFORE they are placed, because the
    // placement reads the heading off it. The animal is already moving here.
    await page.keyboard.down("KeyG");
    await page.waitForTimeout(1600);
    const after = await page.evaluate(() => {
      const b = window.__vic;
      return { fl: +(b.fl || 0).toFixed(3), wary: +(b.wary || 0).toFixed(3),
               near: +Math.hypot(window.__capy.capy.position.x - b.x,
                                 window.__capy.capy.position.z - b.z).toFixed(2) };
    });
    await page.keyboard.up("KeyG");
    await page.keyboard.up("KeyW");
    await page.keyboard.up("ShiftLeft");
    return { before: set, after: after };
  })();

  // ---- 5. the call, at a flat run ----------------------------------------
  out.wheekRunning = await (async () => {
    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(2400);
    const before = await page.evaluate(() => {
      const g = window.__capy;
      return { flow: +((g.state && g.state.flow) || 0).toFixed(2),
               heat: +((g.state && g.state.heat) || 0).toFixed(3) };
    });
    await page.keyboard.press('KeyQ');
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => {
      const g = window.__capy;
      return { flow: +((g.state && g.state.flow) || 0).toFixed(2),
               heat: +((g.state && g.state.heat) || 0).toFixed(3) };
    });
    await page.keyboard.up('KeyW');
    await page.keyboard.up('ShiftLeft');
    return { before: before, after: after };
  })();

  await page.evaluate(async (p) => {
    await fetch('/shot?name=NR-VERBS', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(p)))) });
  }, out);
}
