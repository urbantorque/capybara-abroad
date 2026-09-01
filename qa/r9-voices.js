async page => {
  // ======================================================================
  // R9 — DO THE FOUR THIN CHAPTERS SOUND LIKE THEMSELVES?
  //
  // Two questions, and the second is the one that catches a synth that throws:
  //   1. does the bed play the new voice in the right place (hud.ambAudit)
  //   2. does the synth actually PRODUCE anything — a voice that raises no
  //      node graph is a silent success, and every one of these is new code
  //      that has never run.
  //
  // (2) is answered by counting AudioContext node creations across the call,
  // which is the only thing about a Web Audio synth that can be observed from
  // outside without hearing it.
  // ======================================================================
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  const out = {};

  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6000);
  await page.keyboard.press('Digit1');
  await wait(5000);

  // ---- 1. EVERY NEW SYNTH, CALLED DIRECTLY -----------------------------
  // game.sfx dispatches by name; a name missing from sfxTable is dropped in
  // silence, which is exactly the fault the table's own comment records
  // ("synthesised but never reachable through game.sfx()").
  out.synths = await page.evaluate(() => {
    const g = window.__capy;
    const NAMES = ['frailejon', 'banda', 'corso', 'roulette', 'burner', 'farbell'];
    const res = {};
    // Count nodes made. Patch the prototype, not an instance: the game holds
    // its own AudioContext reference and never hands it out.
    const AC = window.AudioContext || window.webkitAudioContext;
    const METHODS = ['createOscillator', 'createGain', 'createBiquadFilter', 'createBufferSource'];
    let made = 0;
    const orig = {};
    for (const m of METHODS) {
      orig[m] = AC.prototype[m];
      AC.prototype[m] = function () { made++; return orig[m].apply(this, arguments); };
    }
    try {
      for (const n of NAMES) {
        made = 0;
        let threw = null;
        try { g.sfx(n, { volume: 0.0001, force: true }); } catch (e) { threw = String(e); }
        res[n] = { nodes: made, threw: threw };
      }
    } finally {
      for (const m of METHODS) AC.prototype[m] = orig[m];
    }
    return res;
  });

  // ---- 2. THE BED, PER CHAPTER -----------------------------------------
  const PLACES = [
    { biome: 'manly', want: 'corso', at: null },
    { biome: 'monaco', want: 'roulette', at: 'casino' },
    { biome: 'goreme', want: 'burner', at: null },
    { biome: 'drift', want: 'farbell', at: null }
  ];
  out.bed = {};
  for (let i = 0; i < PLACES.length; i++) {
    const P = PLACES[i];
    await page.evaluate(function (cfg) {
      const g = window.__capy;
      g.biome.switchTo(cfg.biome);
      const sp = g.biome.spawnOf(cfg.biome), cb = g.capy.body;
      if (sp) { cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0); }
      return true;
    }, P);
    await wait(2500);
    await page.evaluate(function (cfg) {
      const g = window.__capy;
      // Monaco's roulette line is inside the salon only — the town keeps its
      // deliberately quiet generics, because monaco.js already runs a full
      // positional bed out there and a second mono layer would fight it.
      let pin = null;
      if (cfg.at) {
        const b = g[cfg.biome];
        const q = b && b.randomPointIn ? b.randomPointIn(cfg.at) : null;
        if (q) pin = { x: q.x, y: b.terrainHeight(q.x, q.z) + 0.6, z: q.z };
      }
      if (!window.__pinHook) {
        window.__pinHook = true;
        const raw = g.tick.bind(g);
        g.tick = function (dt, r) {
          const t = window.__pin;
          if (t) {
            const cb = g.capy.body;
            cb.position.set(t.x, t.y, t.z); cb.velocity.set(0, 0, 0);
            cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
          }
          return raw(dt, r);
        };
      }
      window.__pin = pin;
      g.hud.ambAudit(true);
      return true;
    }, P);
    await wait(30000);
    out.bed[P.biome] = await page.evaluate(function (cfg) {
      const g = window.__capy;
      const a = g.hud.ambAudit();
      const heard = {};
      for (const k in a.tally) heard[k.replace(/^[a-z]+:/, '')] = a.tally[k];
      return { biome: g.biome.current, want: cfg.want,
               got: !!heard[cfg.want], heard: heard, n: a.n };
    }, P);
  }

  out.err = await page.evaluate(() => {
    const g = window.__capy; return g.state.lastError ? String(g.state.lastError) : null;
  });
  const bl = await page.evaluate(o =>
    btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=r9-voices.json', { method: 'POST', body: s }), bl);
}
