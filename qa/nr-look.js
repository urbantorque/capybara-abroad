// THE LINE, SEEN — does a held line actually widen the circle of faces?
//
// See npcFLOW_LOOK in npc.js. `watchR` is the head-turn radius and it now
// carries a flow term beside the heat one, so a player who is moving well is
// watched from further out than a player who is standing about.
//
// ---- IT MEASURES THE RADIUS, NOT THE POPULATION, AND THAT IS THE POINT ----
//
// The first cut counted how many people were watching, binned by flow, and it
// cannot work: at a full line the animal is by definition two hundred metres
// from where the line started, so "fewer people are watching" is a fact about
// having run away from the crowd and not about the radius. Hanoi came back
// 1.77 watchers at rest against 0.16 at full flow — an apparently large
// NEGATIVE result from a change that can only ever widen.
//
// So: the furthest watcher, expressed as a multiple of THEIR OWN baseline
// radius. `watchR` is `r.near * 2 * (1 + heat * 0.6)` before this change, and
// every term of that is readable from outside — `r.near` is on the record and
// `game.placeHeat(x, z)` is `npcHeatAt`. The ratio is bounded by 1.00 without
// the flow term and by npcFLOW_LOOK with it, whatever the crowd does.
//
// ---- ...AND THE SECOND CUT'S OWN MISTAKE, WHICH IS WORTH THE PARAGRAPH ----
//
// The first cut used `game.state.heat` as the baseline's heat term. That is
// `npcHeatAt` AT THE ANIMAL and the radius uses it AT THE PERSON, and the two
// are different numbers — Göreme reported 23 frames of impossible watchers
// with the animal's heat reading 0.005, which was neither a bug in the feature
// nor noise: running past people startles them, a startle bumps the heat at
// the person, and the control was reading a spot ten metres away that nothing
// had happened at.
async page => {
  await page.goto('http://localhost:5188/', { waitUntil: 'load' });
  await page.waitForTimeout(6500);
  await page.keyboard.press('Space');
  await page.waitForTimeout(3000);

  const CH = ['goreme', 'hanoi', 'venice', 'sahara', 'quay', 'rio'];
  const out = [];

  for (const b of CH) {
    await page.evaluate((n) => {
      const g = window.__capy;
      try { g.hud.cross(n); } catch (e) { g.biome.switchTo(n); }
    }, b);
    await page.waitForTimeout(4500);

    // ---- OUT, AND THEN BACK THROUGH THEM -----------------------------------
    // The first corrected cut still measured nothing: 380 frames at a full line
    // across six chapters and NOT ONE watcher in any of them. That is not the
    // feature failing, it is the test — holding a line means leaving, so a
    // single outbound sprint spends its whole full-flow half in ground the
    // animal has already cleared of people.
    //
    // So the leg is out and back. `S` is camera-relative and retraces the
    // outbound line: the streak rebuilds over the first five seconds of it and
    // the animal spends the rest running back INTO the cast it just left, which
    // is the only geometry in which a widened APPROACH radius can be seen.
    //
    // FOUR BEARINGS AND NOT ONE PAIR, because a chapter has walls in it: the
    // out-and-back pair measured a clean 117 frames in Venice and could not get
    // a line under the animal AT ALL in five of six, at peak flows of 0.04 to
    // 0.23. That is a fact about which way `W` happened to point in each of
    // them and nothing else. Every leg is reported, aggregated.
    const KEYS = [['KeyW', 11000], ['KeyD', 11000], ['KeyS', 11000], ['KeyA', 11000]];
    const rows = [];
    for (const kd of KEYS) {
      const k = kd[0];
      await page.keyboard.down('ShiftLeft');
      await page.keyboard.down(k);
      const row = await page.evaluate((dur) => new Promise((res) => {
        const g = window.__capy;
        function rootOf(o) { let r = null; for (let p = o; p; p = p.parent) r = p; return r; }
        const live = g.biome.current;
        const mine = g.locals.filter(r => r.biome === live && r.group &&
                                          rootOf(r.group) === g.scene);
        const heatOf = typeof g.placeHeat === 'function' ? g.placeHeat : function () { return 0; };
        let restN = 0, fullN = 0;
        let restMax = 0, fullMax = 0;     // furthest watcher / their own baseline
        let restOver = 0, fullOver = 0;   // frames with anybody past 1.02
        let fullSeen = 0;                 // ...and frames at a full line with ANYBODY watching
        // Anybody watching from beyond npcFLOW_LOOK × their own baseline is
        // outside every radius the code can produce, so they can only be
        // somebody still turned after the animal has gone. See npcFLOW_HOLD.
        let held = 0;
        let peakFlow = 0, dist = 0;
        const p0 = g.capy.position, x0 = p0.x, z0 = p0.z;
        const t0 = performance.now();
        (function step() {
          const f = (g.state && g.state.flow) || 0;
          if (f > peakFlow) peakFlow = f;
          const p = g.capy.position;
          let ratio = 0, any = 0;
          for (let i = 0; i < mine.length; i++) {
            const r = mine[i];
            if (!r.watching) continue;
            any++;
            const d = Math.hypot(p.x - r.x, p.z - r.z);
            // Their own baseline, with their own heat, exactly as npc.js built
            // it before the flow term existed. npcHEAT_LOOK is 1.6.
            const base = (r.near || 7) * 2 * (1 + heatOf(r.x, r.z) * 0.6);
            const q = base > 0 ? d / base : 0;
            if (q > ratio) ratio = q;
          }
          if (ratio > 1.52) held++;
          if (f < 0.10) { restN++; if (ratio > restMax) restMax = ratio;
                          if (ratio > 1.02) restOver++; }
          else if (f > 0.60) { fullN++; if (ratio > fullMax) fullMax = ratio;
                               if (ratio > 1.02) fullOver++; if (any) fullSeen++; }
          dist = Math.hypot(p.x - x0, p.z - z0);
          if (performance.now() - t0 < dur) requestAnimationFrame(step);
          else res({
            cast: mine.length, peakFlow: +peakFlow.toFixed(2),
            travelled: +dist.toFixed(1),
            restFrames: restN, fullFrames: fullN, fullSeen: fullSeen, held: held,
            restMax: +restMax.toFixed(3), fullMax: +fullMax.toFixed(3),
            restOver: restOver, fullOver: fullOver,
          });
        })();
      }), kd[1]);
      await page.keyboard.up(k);
      await page.keyboard.up('ShiftLeft');
      await page.waitForTimeout(900);
      rows.push(row);
    }
    const sum = (f) => rows.reduce((s, r) => s + f(r), 0);
    const top = (f) => Math.max.apply(null, rows.map(f));
    out.push({
      biome: b, cast: rows[0].cast,
      legFlow: rows.map(r => r.peakFlow),
      restFrames: sum(r => r.restFrames), fullFrames: sum(r => r.fullFrames),
      fullSeen: sum(r => r.fullSeen), held: sum(r => r.held),
      restOver: sum(r => r.restOver), fullOver: sum(r => r.fullOver),
      // The bound has to hold on EVERY leg, not on an average of them.
      restMax: +top(r => r.restMax).toFixed(3),
      fullMax: +top(r => r.fullMax).toFixed(3),
    });
  }

  await page.evaluate(async (p) => {
    await fetch('/shot?name=NR-LOOK', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(p)))) });
  }, out);
}
