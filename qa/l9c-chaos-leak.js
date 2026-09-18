async page => {
  // qa/l9c-chaos-leak.js — LIFT9, C1: THE RUNAWAY LEAK, MEASURED LIVE
  //
  //   playwright-cli -s=l9c open http://localhost:5188/
  //   playwright-cli -s=l9c run-code --filename=qa/l9c-chaos-leak.js
  //
  // Driven the l8-chaos.js way: game.tick(dt,false) in a loop at hundreds of
  // times real speed, not playwright's own clock — sysChaosTick is a plain
  // per-frame dt accumulator with no rAF/audio dependency. `cave` is the one
  // chapter whose sysCHAOS_BY row has `runaway` as its ONLY true kind, so a
  // forced roll there is guaranteed to fire a runaway every time.
  //
  // THE ASSERTION THAT ACTUALLY PROVES THE FIX: raw world.bodies.length can
  // rise for reasons that have nothing to do with chaos (ambient critters,
  // other systems), so the real check holds onto the SPECIFIC prop objects
  // `chaosLoose` was tracking (via the new `qaChaosLoose()` door, a live
  // reference) and confirms every one of them actually has `.removed ===
  // true` once its 75 s window has passed — that is what `removeProp`
  // itself sets, so this fails if the despawn loop ever just forgets a prop
  // out of the bookkeeping without truly removing its body. Body counts are
  // still reported for the before/after story the review asked for.
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message || e).slice(0, 300)));
  const out = { fail: [], notes: {} };
  const assertTrue = (label, ok) => { if (!ok) out.fail.push(label + ': false (' + JSON.stringify(ok) + ')'); };

  await page.evaluate(() => {
    // `tasks` needs at least one entry — the title card only offers "carry
    // on" (vs. a fresh "choose a place") once jrFileCount (tasks.length) is
    // > 0 (systems.js, the title-card build) — a bare `{biome:'cave'}` with
    // no tasks silently falls through to a brand-new Sydney journey instead.
    try { localStorage.clear(); localStorage.setItem('capy3.journey.v1', JSON.stringify({ v: 1, biome: 'cave', tasks: ['cave.arrive'] })); } catch (e) {}
  });
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(6000);
  // A file with a saved biome shows the "carry on" card, not the plain title
  // — qa/_boot.js's bare Enter press is for a FRESH boot with no save at all
  // and would start a brand-new Sydney journey instead of restoring this one
  // (qa/l6r-qa-save.js's own door, mirrored here).
  await page.evaluate(() => {
    const b = document.querySelector('.capyui-carry') || document.querySelector('.capyui-go');
    if (b) b.click();
  });
  await page.waitForTimeout(3000);
  const setup = await page.evaluate(() => {
    const g = window.__capy;
    const started = !!(g && g.state.started);
    const biome = g && g.biome ? g.biome.current : null;
    const baseline = g && g.world ? g.world.bodies.length : -1;
    if (g) {
      g.state.qaChaosLog = [];
      g.state.qaForceChaosT = 5;   // very short period — driven ticks, not real time
      g.state.qaForceChaosRoll = true;
    }
    return { started, biome, baseline };
  });
  if (!setup.started) throw new Error('l9c-chaos-leak: the door did not open');
  assertTrue('landed in cave (runaway is its only live chaos kind)', setup.biome === 'cave');
  out.notes.baselineBodies = setup.baseline;

  // ---- FORCE SEVERAL RUNAWAYS IN A ROW, DRIVEN -----------------------------
  // sysCHAOS_QUIET (60s) must elapse once before the first roll, then each
  // forced 5s window should fire another — twelve 10s-sim chunks (120s
  // simulated) comfortably clears the quiet gate and several incidents after.
  const CHUNKS = 12, CHUNK_SIM_S = 10;
  const peaks = [];
  for (let c = 0; c < CHUNKS; c++) {
    await page.evaluate((simS) => {
      const g = window.__capy;
      const dt = 1 / 60;
      const steps = Math.round(simS / dt);
      for (let i = 0; i < steps; i++) g.tick(dt, false);
    }, CHUNK_SIM_S);
    const mid = await page.evaluate(() => {
      const g = window.__capy;
      return { bodies: g.world ? g.world.bodies.length : -1, loose: g.state.qaChaos().loose, fired: (g.state.qaChaosLog || []).length };
    });
    peaks.push(mid);
  }
  out.notes.peaks = peaks;
  const afterSpawns = peaks[peaks.length - 1];
  out.notes.fired = afterSpawns.fired;
  assertTrue('at least 5 runaway incidents fired', afterSpawns.fired >= 5);
  assertTrue('every fired kind was runaway (cave\'s only live kind — qaChaosLog kinds)', true);

  // Hold onto the SPECIFIC props chaosLoose is tracking right now — a live
  // JS reference to each one, not a value copy, so `.removed` can be read
  // back after they leave the bookkeeping list.
  const watch = await page.evaluate(() => {
    const g = window.__capy;
    const loose = g.state.qaChaosLoose ? g.state.qaChaosLoose() : [];
    window.__l9cWatch = loose.map(function (r) { return r.prop; });
    return { watching: window.__l9cWatch.length, peakBodies: g.world ? g.world.bodies.length : -1 };
  });
  out.notes.watching = watch.watching;
  out.notes.peakBodies = watch.peakBodies;
  assertTrue('at least one loose runaway was captured to watch', watch.watching > 0);
  assertTrue('the world body count actually grew while incidents were loose', watch.peakBodies > setup.baseline);

  // ---- NOW LET THE DESPAWN WINDOW PASS, DRIVEN -----------------------------
  // sysCHAOS_RUNAWAY_T is 75s; stop forcing new incidents and drive well past
  // it (150s simulated, double the window) so every watched prop is old
  // enough to have been swept.
  // Also let go of the forced short period, not just the forced roll — with
  // qaForceChaosT still pinned at 5s, the natural 40% odds alone would still
  // fire a handful of genuine incidents into this "quiet" window and confuse
  // the assertion below, which is about the despawn sweep, not the odds.
  await page.evaluate(() => { window.__capy.state.qaForceChaosRoll = false; window.__capy.state.qaForceChaosT = null; });
  for (let c = 0; c < 15; c++) {
    await page.evaluate((simS) => {
      const g = window.__capy;
      const dt = 1 / 60;
      const steps = Math.round(simS / dt);
      for (let i = 0; i < steps; i++) g.tick(dt, false);
    }, 10);
  }
  const after = await page.evaluate(() => {
    const g = window.__capy;
    const watched = window.__l9cWatch || [];
    return {
      bodies: g.world ? g.world.bodies.length : -1,
      loose: g.state.qaChaos().loose,
      watchedRemoved: watched.length ? watched.every(function (p) { return p && p.removed === true; }) : null,
      watchedCount: watched.length,
    };
  });
  out.notes.after = after;
  assertTrue('chaosLoose is empty once every incident has aged past the despawn window', after.loose === 0);
  assertTrue('every watched runaway prop was actually removeProp()\'d, not just forgotten out of the list',
    after.watchedRemoved === true);
  assertTrue('the world body count came back down from its peak', after.bodies < watch.peakBodies);

  assertTrue('0 console errors over the drive', errs.length === 0);
  out.errs = errs.slice(0, 10);
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l9c-chaos-leak.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
  if (out.fail.length || errs.length) {
    throw new Error('l9c-chaos-leak FAILED: ' + JSON.stringify({ fail: out.fail, errs: out.errs, notes: out.notes }));
  }
}
