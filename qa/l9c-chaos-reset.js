async page => {
  // qa/l9c-chaos-reset.js — LIFT9, C2: chaosReset() clears its own timers
  //
  //   playwright-cli -s=l9c open http://localhost:5188/
  //   playwright-cli -s=l9c run-code --filename=qa/l9c-chaos-reset.js
  //
  // Driven the l8-chaos.js way (game.tick in a loop, not playwright's own
  // clock). Lands in venice — squall, stampede and runaway are all live
  // there — drives forced rolls until a squall or stampede is caught still
  // mid-hold (chaosSquallReleaseT/chaosStampedeT > 0), then flips
  // `game.biome.current` directly (a plain string field — the same
  // mismatch check sysChaosTick's own gate reads) to simulate the door a
  // real chapter switch walks through, and confirms chaosReset actually
  // zeroes both timers rather than letting them bleed into the new chapter,
  // and — for a squall specifically — that the forced front is handed back
  // (`hud.front(-2)`) at the moment of the switch, not 0-8 s late.
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message || e).slice(0, 300)));
  const out = { fail: [], notes: {} };
  const assertTrue = (label, ok) => { if (!ok) out.fail.push(label + ': false (' + JSON.stringify(ok) + ')'); };

  await page.evaluate(() => {
    // `tasks` needs an entry so the title card offers "carry on" rather than
    // silently falling through to a fresh Sydney journey (jrFileCount, the
    // title-card build in systems.js) — see qa/l9c-chaos-leak.js's own note.
    try { localStorage.clear(); localStorage.setItem('capy3.journey.v1', JSON.stringify({ v: 1, biome: 'venice', tasks: ['venice.arrive'] })); } catch (e) {}
  });
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(6000);
  await page.evaluate(() => {
    const b = document.querySelector('.capyui-carry') || document.querySelector('.capyui-go');
    if (b) b.click();
  });
  await page.waitForTimeout(3000);
  const setup = await page.evaluate(() => {
    const g = window.__capy;
    const started = !!(g && g.state.started);
    const biome = g && g.biome ? g.biome.current : null;
    if (g) {
      g.state.qaChaosLog = [];
      g.state.qaForceChaosT = 5;
      g.state.qaForceChaosRoll = true;
      // Watch every call to hud.front so "handed back at the moment of the
      // switch" is checked directly, not inferred.
      window.__l9cFrontCalls = [];
      const origFront = g.hud.front.bind(g.hud);
      g.hud.front = function (v) { window.__l9cFrontCalls.push(v); return origFront(v); };
    }
    return { started, biome };
  });
  if (!setup.started) throw new Error('l9c-chaos-reset: the door did not open');
  assertTrue('landed in venice (squall+stampede+runaway all live there)', setup.biome === 'venice');

  // ---- DRIVE IN SMALL STEPS UNTIL A SQUALL OR STAMPEDE IS CAUGHT MID-HOLD --
  // Venice's own table has four live kinds and "never twice running" — a
  // squall can also be picked and then refuse (already raining) without
  // counting as fired, so this keeps going a good deal longer than the
  // fastest possible catch to give squall a real chance against stampede.
  let caught = null;
  let stampedeFallback = null;
  for (let c = 0; c < 90 && !caught; c++) {
    await page.evaluate(() => {
      const g = window.__capy;
      const dt = 1 / 60;
      const steps = Math.round(5 / dt);   // 5s per step, checked between steps
      for (let i = 0; i < steps; i++) g.tick(dt, false);
    });
    const st = await page.evaluate(() => window.__capy.state.qaChaos());
    // Squall wins outright (it is the one the reset's front-handback claim
    // needs); a stampede is kept only as a fallback in case no squall is
    // ever caught mid-hold in the iteration budget, so the run still proves
    // SOMETHING rather than nothing.
    if (st.squallT > 0) caught = { kind: 'squall', state: st };
    else if (st.stampedeT > 0 && !stampedeFallback) stampedeFallback = { kind: 'stampede', state: st };
  }
  if (!caught) caught = stampedeFallback;
  out.notes.caught = caught;
  assertTrue('caught a squall or stampede still mid-hold', !!caught);

  if (caught) {
    const before = await page.evaluate(() => ({
      chaos: window.__capy.state.qaChaos(),
      frontCalls: window.__l9cFrontCalls.slice(),
    }));
    out.notes.before = before;
    const after = await page.evaluate(() => {
      const g = window.__capy;
      g.biome.current = 'sahara';   // the exact mismatch sysChaosTick's own gate reads (`biome !== chaosBiome`)
      g.tick(1 / 60, false);
      return { chaos: g.state.qaChaos(), frontCalls: window.__l9cFrontCalls.slice() };
    });
    out.notes.after = after;
    assertTrue('chaosBiome followed the switch', after.chaos.biome === 'sahara');
    assertTrue('chaosStampedeT is zeroed by chaosReset, not carried abroad', after.chaos.stampedeT === 0);
    assertTrue('chaosSquallReleaseT is zeroed by chaosReset, not carried abroad', after.chaos.squallT === 0);
    if (caught.kind === 'squall') {
      assertTrue('a squall mid-hold at reset time got hud.front(-2) handed back at the switch, not late',
        after.frontCalls.length > before.frontCalls.length && after.frontCalls[after.frontCalls.length - 1] === -2);
    } else {
      out.notes.squallNotObserved = 'caught a stampede this run, not a squall — the front-handback assertion only applies to a squall catch';
    }
  }

  assertTrue('0 console errors', errs.length === 0);
  out.errs = errs.slice(0, 10);
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l9c-chaos-reset.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
  if (out.fail.length || errs.length) {
    throw new Error('l9c-chaos-reset FAILED: ' + JSON.stringify({ fail: out.fail, errs: out.errs, notes: out.notes }));
  }
}
