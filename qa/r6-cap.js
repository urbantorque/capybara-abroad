async page => {
  // ======================================================================
  // R6 — DOES THE FLOOR STOP GIVING? (the ceiling half of qa/r6-mercy.js) The same scripted dancers as qa/r6-dancer.js,
  // now run as a DIFFERENTIAL: `git stash push -- src/cali.js`, run, pop, run.
  // The jitter is seeded per condition, so the before and after passes make
  // the same mistakes in the same order and the only variable is the code.
  //
  // Three σ=90 seeds, because the gate ("clears within ~3 attempts") is a
  // statement about a distribution and one seed is not a distribution. σ=60
  // is the CONTROL: a near-clean dancer must clear on the first streak, with
  // mercy still at 0, or the assist is not invisible. σ=120 is the far tail.
  // ======================================================================
  const out = { conds: [] };
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);

  // ONE HARSH DANCER, TO EXERCISE THE CEILING. Across all ten paired runs in
  // qa/r6-mercy.js the highest mercy ever reached live was 2 — so levels 3 and
  // 4, and the cap itself, had never once run in the game. This is the row
  // that makes 'difficulty saturates' a measurement instead of a claim.
  const CONDS = [{ sigma: 160, seed: 1337 }];

  for (let ci = 0; ci < CONDS.length; ci++) {
    const C = CONDS[ci];

    // R3's pagehide flush writes the live journey back, so `clear(); reload()`
    // would carry the previous condition's tick over. Reload, clear, reload.
    await page.reload();
    await wait(4500);
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await wait(5000);
    await page.keyboard.press('Digit1');
    await wait(4000);
    await page.evaluate(() => {
      const g = window.__capy;
      g.biome.switchTo('cali');
      const sp = g.biome.spawnOf('cali'), b = g.capy.body;
      if (sp) { b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0); }
    });
    await wait(3000);

    await page.evaluate(function (cfg) {
      const g = window.__capy, A = g.cali;
      const raw = g.tick.bind(g);
      window.__rawTick = raw;

      let seed = cfg.seed >>> 0;
      const rnd = function () {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      let spare = null;
      const gauss = function () {
        if (spare !== null) { const s = spare; spare = null; return s; }
        let u = 0, v = 0;
        do { u = rnd(); } while (u <= 1e-9);
        v = rnd();
        const r = Math.sqrt(-2 * Math.log(u)), t = 2 * Math.PI * v;
        spare = r * Math.sin(t);
        return r * Math.cos(t);
      };

      const L = window.__r6 = {
        sigma: cfg.sigma, seed: cfg.seed, music: false, beatLen: 0,
        fired: 0, judged: 0, hits: 0, misses: 0, best: 0,
        attempts: 0, streaks: [],
        cleared: false, tClear: -1, attemptsToClear: -1,
        // the mechanism itself, sampled rather than inferred
        offs: [],           // |achieved off|, ms — the DANCER, independent of code
        mercyAt: [],        // mercy value at the end of each broken streak
        winAt: [],          // and the window (ms) it bought, at that moment
        mercyAtClear: -1, winAtClear: -1,
        mercyAfter: -1, winAfter: -1,
        // the tail: everything judged AFTER the tick, at whatever window is
        // live then. If mercy leaked past the door, this rate will show it.
        tailJudged: 0, tailHits: 0, tailBest: 0,
        t: 0
      };

      let lastIdx = -999, jit = 0, fired = false, lastCombo = 0, t0 = -1;

      g.tick = function (dt, r) {
        const b = g.capy.body, f = A.floor;
        const y = A.terrainHeight(f.x, f.z) + 0.6;
        b.position.set(f.x, y, f.z);
        b.velocity.set(0, 0, 0);
        b.previousPosition.copy(b.position);
        b.interpolatedPosition.copy(b.position);

        const m = g.music;
        if (m && m.playing) {
          L.music = true; L.beatLen = m.beatLen;
          const beats = m.beats();
          const idx = Math.round(beats);
          if (idx !== lastIdx) {
            lastIdx = idx; fired = false;
            const sb = (cfg.sigma / 1000) / m.beatLen;
            jit = Math.max(-0.45, Math.min(0.45, gauss() * sb));
          }
          if (!fired && beats >= idx + jit) {
            fired = true;
            g.input.jumpPressed = true;
            L.fired++;
            L.offs.push(Math.round(Math.abs(m.off()) * m.beatLen * 1000));
            if (t0 < 0) t0 = L.t;
          }
        }

        // SAMPLE THE WINDOW BEFORE THE FRAME, NOT AFTER IT. Reaching eight
        // resets mercy inside the same frame that scores the eighth step, so a
        // reading taken after raw() reports 114 ms for every clear in the run
        // and looks like proof that mercy did nothing. It was the probe.
        const preMercy = A.mercy ? A.mercy() : -1;
        const preWin = A.window && L.beatLen ? +(A.window() * L.beatLen * 1000).toFixed(0) : -1;

        const res = raw(dt, r);
        L.t += dt;

        const mercy = A.mercy ? A.mercy() : -1;
        const win = A.window && L.beatLen ? +(A.window() * L.beatLen * 1000).toFixed(0) : -1;
        const c = A.combo();
        if (c > L.best) L.best = c;
        if (c > lastCombo) {
          L.judged++; L.hits++;
          if (L.cleared) { L.tailJudged++; L.tailHits++; if (c > L.tailBest) L.tailBest = c; }
        } else if (c === 0 && lastCombo > 0) {
          L.judged++; L.misses++;
          if (L.cleared) L.tailJudged++;
          else { L.attempts++; L.streaks.push(lastCombo); L.mercyAt.push(mercy); L.winAt.push(win); }
        }
        lastCombo = c;

        if (!L.cleared && g.hud && g.hud.isTaskDone('salsa-dance')) {
          L.cleared = true;
          L.tClear = +(L.t - (t0 < 0 ? 0 : t0)).toFixed(2);
          L.attemptsToClear = L.attempts + 1;
          L.mercyAtClear = preMercy; L.winAtClear = preWin;
        }
        if (L.cleared) { L.mercyAfter = mercy; L.winAfter = win; }
        return res;
      };
    }, C);

    // Dance until it clears, or 80 s. Poll in 10 s slices: a lucky seed does
    // not need to sit here for the full run, and a single evaluate longer than
    // ~20 s loses its execution context (harness trap 2).
    let held = 0;
    for (let k = 0; k < 8; k++) {
      await wait(10000);
      const st = await page.evaluate(() => {
        const L = window.__r6;
        return { cleared: L.cleared, t: L.t };
      });
      if (st.cleared) held++;   // ...and keep going: the offs sample is the point
    }

    const row = await page.evaluate(() => {
      const g = window.__capy;
      g.tick = window.__rawTick;
      const L = window.__r6, A = g.cali;
      return {
        sigma: L.sigma, seed: L.seed, music: L.music,
        beatLenMs: Math.round(L.beatLen * 1000),
        baseWindowMs: Math.round(0.19 * L.beatLen * 1000),
        fired: L.fired, judged: L.judged, hits: L.hits, misses: L.misses,
        p: L.judged ? +(L.hits / L.judged).toFixed(3) : -1,
        cleared: L.cleared, attemptsToClear: L.attemptsToClear, tClear: L.tClear,
        streaks: L.streaks.slice(0, 24),
        mercyAt: L.mercyAt.slice(0, 24), winAt: L.winAt.slice(0, 24),
        mercyAtClear: L.mercyAtClear, winAtClear: L.winAtClear,
        mercyAfter: L.mercyAfter, winAfter: L.winAfter,
        mercyNow: A.mercy ? A.mercy() : -1,
        tailJudged: L.tailJudged, tailHits: L.tailHits,
        tailP: L.tailJudged ? +(L.tailHits / L.tailJudged).toFixed(3) : -1,
        best: L.best, onFloor: A.onFloor(), offs: L.offs,
        err: g.state.lastError ? String(g.state.lastError) : null
      };
    });
    out.conds.push(row);
  }

  const b = await page.evaluate(o =>
    btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=r6-cap.json', { method: 'POST', body: s }), b);
}
