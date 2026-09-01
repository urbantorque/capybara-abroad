async page => {
  // ======================================================================
  // R6 — THE WALL. A SCRIPTED MID-SKILL DANCER ON THE CALI SALSA FLOOR.
  //
  // The floor scores a deliberate act (turn / hop / wheek) that lands within
  // caliBEAT_WINDOW of a beat — 0.19 beats, 114 ms at this palette's 100 bpm.
  // Eight in a row, and one miss zeroes the combo.
  //
  // This drives the REAL code path: the tick is wrapped, so the dancer runs
  // inside the frame and sets input.jumpPressed before cali's update reads it.
  // It does not model the scoring; it asks the game.
  //
  // THE JITTER IS SEEDED. The whole value of this instrument is that the same
  // dancer, making the same mistakes in the same order, can be run against the
  // code before and after a change. An unseeded run measures the RNG.
  // ======================================================================
  const out = { conds: [] };
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);

  // Three timing spreads. 90 ms is the one the batch is specified against; 60
  // and 120 bracket it, because a mercy rule tuned to a single assumed player
  // is tuned to nothing.
  const SIGMAS = [60, 90, 120];

  for (let ci = 0; ci < SIGMAS.length; ci++) {
    const sigma = SIGMAS[ci];

    // R3 put saveFlush() on pagehide, so `clear(); reload()` writes the live
    // journey straight back — and the dance task from the PREVIOUS condition
    // with it, which would make every condition after the first a no-op.
    // Reload first (spending the flush), then clear from the title.
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

    // ---- the dancer -----------------------------------------------------
    await page.evaluate(function (sig) {
      const g = window.__capy, A = g.cali;
      const raw = g.tick.bind(g);
      window.__rawTick = raw;

      // Seeded, so the sequence of mistakes is a fixed property of the test.
      let seed = 1337 >>> 0;
      const rnd = function () {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      let spare = null;
      const gauss = function () {                     // Box-Muller
        if (spare !== null) { const s = spare; spare = null; return s; }
        let u = 0, v = 0;
        do { u = rnd(); } while (u <= 1e-9);
        v = rnd();
        const r = Math.sqrt(-2 * Math.log(u)), t = 2 * Math.PI * v;
        spare = r * Math.sin(t);
        return r * Math.cos(t);
      };

      const L = window.__r6 = {
        sigma: sig, music: false, beatLen: 0,
        planned: 0, fired: 0, judged: 0, hits: 0, misses: 0,
        combo: 0, best: 0,
        attempts: 0,            // streaks that ended in a miss before the tick
        cleared: false, tClear: -1, attemptsToClear: -1,
        offs: [],               // |achieved off|, ms — the REAL distribution
        streaks: [],            // length of each broken streak, in order
        t: 0
      };

      let lastIdx = -999, jit = 0, fired = false, lastCombo = 0, t0 = -1;

      g.tick = function (dt, r) {
        // Pin her on the floor: a scripted dancer that wanders off the disc is
        // measuring the lapse timer, not the window. Velocity zeroed too, or
        // the pin fights the solver.
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
            // sigma is in ms; the clock is in beats.
            const sb = (sig / 1000) / m.beatLen;
            jit = Math.max(-0.45, Math.min(0.45, gauss() * sb));
            L.planned++;
          }
          if (!fired && beats >= idx + jit) {
            fired = true;
            g.input.jumpPressed = true;
            L.fired++;
            L.offs.push(Math.round(Math.abs(m.off()) * m.beatLen * 1000));
            if (t0 < 0) t0 = L.t;
          }
        }

        const res = raw(dt, r);
        L.t += dt;

        // Read the answer AFTER the frame the act was judged in.
        const c = A.combo();
        if (c > L.best) L.best = c;
        if (c > lastCombo) { L.judged++; L.hits++; }
        else if (c === 0 && lastCombo > 0) {
          L.judged++; L.misses++;
          L.attempts++; L.streaks.push(lastCombo);
        }
        L.combo = c; lastCombo = c;

        if (!L.cleared && g.hud && g.hud.isTaskDone('salsa-dance')) {
          L.cleared = true;
          L.tClear = +(L.t - (t0 < 0 ? 0 : t0)).toFixed(2);
          L.attemptsToClear = L.attempts + 1;
        }
        return res;
      };
    }, sigma);

    // 100 s of dancing. A beat is 0.6 s, so ~166 beats — enough for a clear
    // and a long tail after it.
    for (let k = 0; k < 5; k++) await wait(20000);

    const row = await page.evaluate(() => {
      const g = window.__capy;
      g.tick = window.__rawTick;
      const L = window.__r6;
      const offs = L.offs.slice();
      const sorted = offs.slice().sort(function (a, b) { return a - b; });
      const pct = function (q) { return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : -1; };
      return {
        sigma: L.sigma, music: L.music, beatLenMs: Math.round(L.beatLen * 1000),
        onFloor: g.cali.onFloor(), target: g.cali.comboTarget,
        planned: L.planned, fired: L.fired,
        judged: L.judged, hits: L.hits, misses: L.misses,
        p: L.judged ? +(L.hits / L.judged).toFixed(3) : -1,
        best: L.best, cleared: L.cleared,
        tClear: L.tClear, attemptsToClear: L.attemptsToClear,
        totalAttempts: L.attempts,
        streaks: L.streaks.slice(0, 40),
        offMedian: pct(0.5), offP90: pct(0.9), offMax: sorted[sorted.length - 1],
        err: g.state.lastError ? String(g.state.lastError) : null
      };
    });
    out.conds.push(row);
  }

  const b = await page.evaluate(o =>
    btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=r6-dancer.json', { method: 'POST', body: s }), b);
}
