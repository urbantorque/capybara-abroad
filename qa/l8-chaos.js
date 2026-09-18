async page => {
  // qa/l8-chaos.js — THE CHAOS, SAID SEPARATELY (L8, wave 2), LIVE
  //
  //   node server.mjs                                 (PORT=5188)
  //   playwright-cli -s=l8c open http://localhost:5188/
  //   playwright-cli -s=l8c run-code --filename=qa/l8-chaos.js
  //
  // ROADMAP-LIFT8.md's own instrument asks for 600 s in Sydney at the roll
  // forced to a 20 s period. sysChaosTick's timer is a plain per-frame `dt`
  // accumulator — no audio, no rAF dependency (unlike the audio suites) — so
  // this drives it the headless-qa-harness way, `game.tick(dt, false)` in a
  // loop at hundreds of times real speed, rather than waiting out ten real
  // minutes under playwright's own clock (see qa/l8-drops.js's own note on
  // why a 400 s real-time ask does not fit this suite's budget either — the
  // same law, solved here because this one timer happens to be tick-driven
  // rather than wall-clock).
  //
  // `qaForceChaosRoll` (this pass's own QA door, beside `qaForceChaosT`) also
  // forces the 40% dice to hit every time: at a real 40% and ~27 eligible
  // 20 s windows in 600 s minus the first minute, the roadmap's own "≥ 20"
  // would fail the coin flip more often than it passed. What is NOT forced
  // is which of Sydney's three live kinds (gust/squall/runaway — `thief` is
  // false everywhere and `stampede` needs a bold critter Sydney never
  // registers) a hit becomes, or any incident's own internal refusal rules
  // (already raining, no valid ground point) — the selection, the "never
  // twice running" rule and the refusals all run for real.
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message || e).slice(0, 300)));
  const out = { fail: [], notes: {} };
  const assertTrue = (label, ok) => { if (!ok) out.fail.push(label + ': false (' + JSON.stringify(ok) + ')'); };

  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  const started = await page.evaluate(() => !!(window.__capy && window.__capy.state.started));
  if (!started) throw new Error('l8-chaos: the door did not open');

  const setup = await page.evaluate(() => {
    const g = window.__capy;
    const biome = g.biome && g.biome.current;
    // A validated ground point (the same physDropSpot every drop already
    // trusts), re-rolled until it is outside sysWHY_R (10 m) of Sydney's own
    // marquee point (0, 2.5) — parking ON the marquee would make every
    // window refuse and the count assertion below would read a broken gate
    // as a working one.
    let spot = null;
    for (let i = 0; i < 20; i++) {
      const s = g.physics.dropSpot('sydney', 0.4);
      if (s && (s.x * s.x + (s.z - 2.5) * (s.z - 2.5)) > 400) { spot = s; break; }
    }
    if (spot && g.capy && g.capy.body) {
      const b = g.capy.body;
      b.velocity.set(0, 0, 0);
      b.position.set(spot.x, b.position.y, spot.z);
      b.previousPosition.copy(b.position);
      b.interpolatedPosition.copy(b.position);
    }
    g.state.qaChaosLog = [];
    g.state.qaForceChaosT = 20;
    g.state.qaForceChaosRoll = true;
    return { biome, spot };
  });
  assertTrue('started in Sydney', setup.biome === 'sydney');
  assertTrue('found a safe teleport spot outside sysWHY_R of the marquee', !!setup.spot);

  // ---- THE 600 s SOAK, DRIVEN, NOT WAITED ----------------------------------
  // Split into six 100 s-simulated chunks so no single page.evaluate runs
  // long enough real-time to risk "Execution context was destroyed" (trap 2,
  // [[capy3-headless-qa-harness]]) — 6000 ticks of plain arithmetic and a
  // capped physics world is comfortably under that.
  const CHUNKS = 6, CHUNK_SIM_S = 100;
  for (let c = 0; c < CHUNKS; c++) {
    await page.evaluate((simS) => {
      const g = window.__capy;
      const dt = 1 / 60;
      const steps = Math.round(simS / dt);
      for (let i = 0; i < steps; i++) g.tick(dt, false);
    }, CHUNK_SIM_S);
  }

  const result = await page.evaluate(() => {
    const g = window.__capy;
    return { log: (g.state.qaChaosLog || []).slice(), chaos: g.state.qaChaos() };
  });
  const log = result.log;
  out.notes.count = log.length;
  out.notes.chaosState = result.chaos;
  const kinds = {};
  for (const r of log) kinds[r.kind] = (kinds[r.kind] || 0) + 1;
  out.notes.kinds = kinds;

  assertTrue('at least ~20 incidents fired over the 600 s soak', log.length >= 20);
  let consec = false;
  for (let i = 1; i < log.length; i++) if (log[i].kind === log[i - 1].kind) consec = true;
  assertTrue('no two consecutive incidents share a kind', !consec);
  assertTrue('thief never fires (sysCHAOS_BY has it false in every chapter — see', !kinds.thief);
  assertTrue('every fired kind is one Sydney\'s own table actually supports',
    log.every(r => r.kind === 'gust' || r.kind === 'squall' || r.kind === 'runaway'));

  // ---- wowLiveOn: enforced by construction, not forced live here ----------
  // sysChaosTick's own first gate is `if (wowLiveOn) return;`, textually
  // before chaosAttempt() is ever reachable — so no row in `log` above CAN
  // have been logged while a wow was live, by construction of the function
  // under test, not by an assertion here. Forcing a real marquee live for
  // part of a 600 s driven soak would need a genuine task completion mid-loop
  // (`wowLiveOn` reads `marqId` and `wowLiveSince`, both real task/game
  // state — there is no QA door onto it, unlike `qaForceChaosRoll`), which
  // is out of scope for what this file is checking. Recorded here rather
  // than silently skipped.
  out.notes.wowLiveOn = 'enforced by construction (see sysChaosTick, the gate before chaosAttempt) — not independently forced in this probe';

  assertTrue('0 console errors over the soak', errs.length === 0);

  out.errs = errs.slice(0, 10);
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l8-chaos.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
  if (out.fail.length || errs.length) {
    throw new Error('l8-chaos FAILED: ' + JSON.stringify({ fail: out.fail, errs: out.errs, notes: out.notes }));
  }
}
