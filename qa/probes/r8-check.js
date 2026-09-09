async page => {
  // ======================================================================
  // R8 — DID THE SECOND CHAPTER GET DEEPER?
  //
  //   1. the bell's par, measured by a scripted puller (machine floor first)
  //   2. the acts stage, and nothing is gated
  //   3. the ambience bed answers in every zone, with the new voices
  //   4. the record row is a task id, and files on the lapse not the stroke
  // ======================================================================
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  const out = {};

  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6000);
  await page.keyboard.press('Digit2');
  await wait(7000);

  out.where = await page.evaluate(() => ({
    biome: window.__capy.biome.current,
    started: !!window.__capy.state.started
  }));

  // ---- 1. THE ACTS -----------------------------------------------------
  // The paper offers the lowest act with something open in it. Nothing is
  // gated: an act-3 row must still tick if it is done in the first minute.
  out.acts = await page.evaluate(() => {
    const g = window.__capy;
    const card = document.querySelector('.capyui-todo');
    const text = card ? (card.textContent || '').replace(/\s+/g, ' ').trim() : '';
    return { card: text.slice(0, 220),
             mentionsCondor: /condor|talons/i.test(text),
             mentionsTown: /empanada|stall|bell|ruana|coffee|float/i.test(text) };
  });

  // ---- 2. THE BELL, AND ITS FLOOR --------------------------------------
  out.bell = await page.evaluate(() => {
    const g = window.__capy, P = g.pasto, D = 1 / 60;
    const inp = g.input;
    const b = P.bell;
    const rope = b.ropePosition;
    const cb = g.capy.body;
    const idle = function (n) {
      for (let i = 0; i < n; i++) { inp.x = 0; inp.z = 0; inp.run = false; g.tick(D, false); }
    };
    // Stand at the rope and keep pulling. P.bell.ring() is the same hook the
    // rope-yank uses, so this is a player who never lets go.
    cb.position.set(rope.x, 1.2, rope.z); cb.velocity.set(0, 0, 0);
    cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
    idle(30);
    let peak = 0;
    for (let s = 0; s < 30; s++) {
      b.ring();
      for (let i = 0; i < 72; i++) {
        g.tick(D, false);
        const a = g.hud.recordAudit();
        if (a.live === 'church-bell' && a.val > peak) peak = a.val;
      }
    }
    const liveEnd = g.hud.recordAudit();
    // ...and let it die, which is what files the peal.
    idle(60 * 9);
    const a = g.hud.recordAudit();
    return { peakLive: peak, filed: a.best['church-bell'],
             liveAfter: a.live, done: !!g.hud.isTaskDone('church-bell'),
             wasLive: liveEnd.live };
  });

  // ---- 3. THE BED, ZONE BY ZONE ----------------------------------------
  // Count what the ambience ladder actually plays when the animal is stood in
  // each zone. Real time, because the bed runs off its own wall clock.
  const ZONES = ['plaza', 'market', 'church', 'coffee', 'paramo', 'street'];
  out.bed = {};
  for (let i = 0; i < ZONES.length; i++) {
    await page.evaluate(function (z) {
      const g = window.__capy, P = g.pasto;
      const p = P.randomPointIn(z);
      if (p) {
        const cb = g.capy.body;
        const y = P.terrainHeight(p.x, p.z) + 0.6;
        cb.position.set(p.x, y, p.z); cb.velocity.set(0, 0, 0);
        cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
      }
      // PIN her: last run she was placed in the páramo, slid down the mountain
      // and measured the branch below it — inZone came back false and the
      // páramo voice never appeared, which looked like a dead voice.
      if (!window.__pinHook) {
        window.__pinHook = true;
        const raw = g.tick.bind(g);
        g.tick = function (dt, r) {
          const q = window.__pin;
          if (q) {
            const cb = g.capy.body;
            cb.position.set(q.x, q.y, q.z); cb.velocity.set(0, 0, 0);
            cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
          }
          return raw(dt, r);
        };
      }
      window.__pin = p ? { x: p.x, y: P.terrainHeight(p.x, p.z) + 0.6, z: p.z } : null;
      window.__capy.hud.ambAudit(true);   // clear the ring; the bed is measured from here
      return !!p;
    }, ZONES[i]);
    await wait(26000);
    out.bed[ZONES[i]] = await page.evaluate(function (z) {
      const g = window.__capy;
      const a = g.hud.ambAudit();
      const heard = {};
      for (const k in a.tally) heard[k.replace(/^[a-z]+:/, "")] = a.tally[k];
      return { inZone: g.pasto.inZone(z, g.capy.position.x, g.capy.position.z),
               heard: heard, voices: Object.keys(heard).length, total: a.n };
    }, ZONES[i]);
  }

  // ---- 4. ROW HYGIENE --------------------------------------------------
  out.rows = await page.evaluate(() => {
    const a = window.__capy.hud.recordAudit();
    return { rows: a.rows, orphans: a.orphans, best: a.best };
  });
  out.err = await page.evaluate(() => {
    const g = window.__capy; return g.state.lastError ? String(g.state.lastError) : null;
  });

  const bl = await page.evaluate(o =>
    btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=r8-check.json', { method: 'POST', body: s }), bl);
}
